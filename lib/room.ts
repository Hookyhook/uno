import { randomUUID } from "node:crypto";
import * as engine from "./engine";
import { MAX_PLAYERS, MIN_PLAYERS } from "./rules";
import type { Action, Phase, RoomView } from "./protocol";

export const PRESENCE_TIMEOUT_MS = 10_000;
export const ABANDON_TIMEOUT_MS = 2 * 60 * 1000;

export interface Seat {
  id: string;
  name: string;
  token: string;
  ready: boolean;
  lastSeen: number;
}

export interface RoomState {
  code: string;
  hostId: string | null;
  phase: Phase;
  seats: Seat[];
  game: engine.EngineState | null;
  updatedAt: number;
}

export class RoomError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export function createRoom(code: string, now: number): RoomState {
  return { code, hostId: null, phase: "lobby", seats: [], game: null, updatedAt: now };
}

export function addSeat(room: RoomState, name: string, now: number): { room: RoomState; seat: Seat } {
  if (room.phase !== "lobby") throw new RoomError("game_running", "That game has already started");
  if (room.seats.length >= MAX_PLAYERS) throw new RoomError("room_full", "That room is full");
  const seat: Seat = { id: randomUUID(), name, token: randomUUID(), ready: false, lastSeen: now };
  const next = { ...room, seats: [...room.seats, seat], hostId: room.hostId ?? seat.id, updatedAt: now };
  return { room: next, seat };
}

export function touch(room: RoomState, playerId: string, now: number): RoomState {
  return {
    ...room,
    seats: room.seats.map((s) => (s.id === playerId ? { ...s, lastSeen: now } : s)),
  };
}

/** Applies time-based changes that a live server would do with timers: turn timeouts and pruning of abandoned seats. */
export function tick(room: RoomState, now: number): RoomState {
  let next = room;
  for (const seat of room.seats) {
    if (now - seat.lastSeen > ABANDON_TIMEOUT_MS) next = removeSeat(next, seat.id, now);
  }
  while (next.game && !next.game.winnerId && now >= next.game.turnEndsAt) {
    const expiredAt = next.game.turnEndsAt;
    next = withGame(next, engine.timeoutTurn(next.game, { now: () => expiredAt }), now);
  }
  return next;
}

export function applyAction(room: RoomState, playerId: string, action: Action, now: number): RoomState {
  const seat = room.seats.find((s) => s.id === playerId);
  if (!seat) throw new RoomError("not_in_room", "You are not in this room", 403);
  const deps = { now: () => now };

  switch (action.type) {
    case "ready":
      requirePhase(room, "lobby");
      return { ...room, seats: room.seats.map((s) => (s.id === playerId ? { ...s, ready: action.ready } : s)), updatedAt: now };
    case "start": {
      requirePhase(room, "lobby");
      requireHost(room, playerId);
      if (room.seats.length < MIN_PLAYERS) throw new RoomError("not_enough_players", `Need at least ${MIN_PLAYERS} players`);
      if (!room.seats.every((s) => s.ready)) throw new RoomError("not_ready", "Everyone must be ready");
      const game = engine.createGame(room.seats.map((s) => ({ id: s.id, name: s.name })), deps);
      return withGame({ ...room, phase: "playing" }, game, now);
    }
    case "playAgain":
      requirePhase(room, "finished");
      requireHost(room, playerId);
      return { ...room, phase: "lobby", game: null, seats: room.seats.map((s) => ({ ...s, ready: false })), updatedAt: now };
    case "leave":
      return removeSeat(room, playerId, now);
    case "playCard":
      return withGame(room, engine.playCard(requireGame(room), playerId, action.cardId, action.chosenColor, deps), now);
    case "drawCard":
      return withGame(room, engine.drawCard(requireGame(room), playerId, deps), now);
    case "passTurn":
      return withGame(room, engine.passTurn(requireGame(room), playerId, deps), now);
    case "callUno":
      return withGame(room, engine.callUno(requireGame(room), playerId), now);
    case "catchUno":
      return withGame(room, engine.catchUno(requireGame(room), playerId, action.playerId), now);
  }
}

export function removeSeat(room: RoomState, playerId: string, now: number): RoomState {
  if (!room.seats.some((s) => s.id === playerId)) return room;
  const seats = room.seats.filter((s) => s.id !== playerId);
  const hostId = room.hostId === playerId ? (seats[0]?.id ?? null) : room.hostId;
  const next: RoomState = { ...room, seats, hostId, updatedAt: now };
  if (next.game && !next.game.winnerId) return withGame(next, engine.removePlayer(next.game, playerId, { now: () => now }), now);
  return next;
}

export function viewFor(room: RoomState, playerId: string, now: number): RoomView {
  const isOnline = (id: string) => now - (room.seats.find((s) => s.id === id)?.lastSeen ?? 0) < PRESENCE_TIMEOUT_MS;
  const game = room.game ? engine.viewFor(room.game, playerId) : null;
  if (game) for (const p of game.players) p.connected = isOnline(p.id);
  return {
    roomCode: room.code,
    playerId,
    phase: room.phase,
    version: room.updatedAt,
    players: room.seats.map((s) => ({
      id: s.id,
      name: s.name,
      ready: s.ready,
      connected: isOnline(s.id),
      isHost: s.id === room.hostId,
    })),
    game,
    result: room.game?.winnerId ? engine.result(room.game) : null,
  };
}

function withGame(room: RoomState, game: engine.EngineState, now: number): RoomState {
  return { ...room, game, phase: game.winnerId ? "finished" : room.phase, updatedAt: now };
}

function requireGame(room: RoomState): engine.EngineState {
  if (!room.game || room.phase !== "playing") throw new RoomError("no_game", "No game in progress");
  return room.game;
}

function requirePhase(room: RoomState, phase: Phase): void {
  if (room.phase !== phase) throw new RoomError("wrong_phase", `Not allowed while ${room.phase}`);
}

function requireHost(room: RoomState, playerId: string): void {
  if (room.hostId !== playerId) throw new RoomError("not_host", "Only the host can do that");
}
