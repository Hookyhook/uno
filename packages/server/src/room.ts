import { randomUUID } from "node:crypto";
import type { WebSocket } from "ws";
import { MAX_PLAYERS, MIN_PLAYERS, type ClientMessage, type Phase, type ServerMessage } from "@uno/shared";
import * as engine from "./engine.js";

const DISCONNECT_GRACE_MS = 2 * 60 * 1000;

interface Seat {
  id: string;
  name: string;
  token: string;
  ready: boolean;
  socket: WebSocket | null;
  removeTimer: NodeJS.Timeout | null;
}

export class RoomError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export class Room {
  phase: Phase = "lobby";
  hostId: string | null = null;
  lastActivity = Date.now();
  private seats = new Map<string, Seat>();
  private game: engine.EngineState | null = null;
  private turnTimer: NodeJS.Timeout | null = null;

  constructor(
    public readonly code: string,
    private readonly onEmpty: (room: Room) => void,
  ) {}

  get playerCount(): number {
    return this.seats.size;
  }

  get connectedCount(): number {
    return [...this.seats.values()].filter((s) => s.socket).length;
  }

  addPlayer(name: string, socket: WebSocket): Seat {
    if (this.phase !== "lobby") throw new RoomError("game_running", "That game has already started");
    if (this.seats.size >= MAX_PLAYERS) throw new RoomError("room_full", "That room is full");
    const seat: Seat = { id: randomUUID(), name, token: randomUUID(), ready: false, socket, removeTimer: null };
    this.seats.set(seat.id, seat);
    this.hostId ??= seat.id;
    this.touch();
    this.send(seat, { type: "joined", token: seat.token, playerId: seat.id, roomCode: this.code });
    this.broadcast();
    return seat;
  }

  reconnect(playerId: string, socket: WebSocket): Seat | null {
    const seat = this.seats.get(playerId);
    if (!seat) return null;
    seat.socket?.close();
    seat.socket = socket;
    if (seat.removeTimer) clearTimeout(seat.removeTimer);
    seat.removeTimer = null;
    this.touch();
    this.send(seat, { type: "joined", token: seat.token, playerId: seat.id, roomCode: this.code });
    this.broadcast();
    return seat;
  }

  disconnect(playerId: string, socket: WebSocket): void {
    const seat = this.seats.get(playerId);
    if (!seat || seat.socket !== socket) return;
    seat.socket = null;
    seat.removeTimer = setTimeout(() => this.removePlayer(playerId), DISCONNECT_GRACE_MS);
    this.broadcast();
  }

  handle(playerId: string, msg: ClientMessage): void {
    const seat = this.seats.get(playerId);
    if (!seat) return;
    this.touch();
    try {
      this.dispatch(seat, msg);
    } catch (err) {
      if (err instanceof engine.EngineError || err instanceof RoomError) {
        this.send(seat, { type: "error", code: err.code, message: err.message });
        return;
      }
      throw err;
    }
  }

  private dispatch(seat: Seat, msg: ClientMessage): void {
    switch (msg.type) {
      case "ready":
        this.requirePhase("lobby");
        seat.ready = msg.ready;
        this.broadcast();
        return;
      case "start":
        this.start(seat);
        return;
      case "playAgain":
        this.requirePhase("finished");
        this.requireHost(seat);
        this.game = null;
        this.phase = "lobby";
        for (const s of this.seats.values()) s.ready = false;
        this.broadcast();
        return;
      case "leave":
        this.removePlayer(seat.id);
        return;
      case "playCard":
        this.update(engine.playCard(this.requireGame(), seat.id, msg.cardId, msg.chosenColor));
        return;
      case "drawCard":
        this.update(engine.drawCard(this.requireGame(), seat.id));
        return;
      case "passTurn":
        this.update(engine.passTurn(this.requireGame(), seat.id));
        return;
      case "callUno":
        this.update(engine.callUno(this.requireGame(), seat.id));
        return;
      case "catchUno":
        this.update(engine.catchUno(this.requireGame(), seat.id, msg.playerId));
        return;
      case "createRoom":
      case "joinRoom":
      case "reconnect":
        throw new RoomError("already_in_room", "You are already in a room");
    }
  }

  private start(seat: Seat): void {
    this.requirePhase("lobby");
    this.requireHost(seat);
    const seats = [...this.seats.values()];
    if (seats.length < MIN_PLAYERS) throw new RoomError("not_enough_players", `Need at least ${MIN_PLAYERS} players`);
    if (!seats.every((s) => s.ready)) throw new RoomError("not_ready", "Everyone must be ready");
    this.phase = "playing";
    this.update(engine.createGame(seats.map((s) => ({ id: s.id, name: s.name }))));
  }

  private update(state: engine.EngineState): void {
    this.game = state;
    this.scheduleTurnTimer();
    if (state.winnerId) {
      this.phase = "finished";
      this.clearTurnTimer();
    }
    this.broadcast();
  }

  private scheduleTurnTimer(): void {
    this.clearTurnTimer();
    if (!this.game || this.game.winnerId) return;
    const delay = Math.max(0, this.game.turnEndsAt - Date.now());
    this.turnTimer = setTimeout(() => {
      if (this.game && !this.game.winnerId) this.update(engine.timeoutTurn(this.game));
    }, delay);
  }

  private clearTurnTimer(): void {
    if (this.turnTimer) clearTimeout(this.turnTimer);
    this.turnTimer = null;
  }

  private removePlayer(playerId: string): void {
    const seat = this.seats.get(playerId);
    if (!seat) return;
    if (seat.removeTimer) clearTimeout(seat.removeTimer);
    this.seats.delete(playerId);
    seat.socket?.close();

    if (this.hostId === playerId) this.hostId = this.seats.keys().next().value ?? null;

    if (this.game && !this.game.winnerId) this.update(engine.removePlayer(this.game, playerId));
    else this.broadcast();

    if (this.seats.size === 0) {
      this.clearTurnTimer();
      this.onEmpty(this);
    }
  }

  broadcast(): void {
    for (const seat of this.seats.values()) {
      if (!seat.socket) continue;
      this.send(seat, {
        type: "roomState",
        phase: this.phase,
        roomCode: this.code,
        players: [...this.seats.values()].map((s) => ({
          id: s.id,
          name: s.name,
          ready: s.ready,
          connected: s.socket !== null,
          isHost: s.id === this.hostId,
        })),
      });
      if (this.game) {
        const view = engine.viewFor(this.game, seat.id);
        for (const p of view.players) p.connected = this.seats.get(p.id)?.socket !== null;
        this.send(seat, { type: "gameState", game: view });
        if (this.game.winnerId) this.send(seat, { type: "gameOver", result: engine.result(this.game) });
      }
    }
  }

  private send(seat: Seat, msg: ServerMessage): void {
    if (seat.socket?.readyState === seat.socket?.OPEN) seat.socket?.send(JSON.stringify(msg));
  }

  private requireGame(): engine.EngineState {
    if (!this.game || this.phase !== "playing") throw new RoomError("no_game", "No game in progress");
    return this.game;
  }

  private requirePhase(phase: Phase): void {
    if (this.phase !== phase) throw new RoomError("wrong_phase", `Not allowed while ${this.phase}`);
  }

  private requireHost(seat: Seat): void {
    if (seat.id !== this.hostId) throw new RoomError("not_host", "Only the host can do that");
  }

  private touch(): void {
    this.lastActivity = Date.now();
  }
}
