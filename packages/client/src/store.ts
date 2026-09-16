import { create } from "zustand";
import type { GameResult, GameView, LobbyPlayer, Phase, ServerMessage } from "@uno/shared";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

interface State {
  status: ConnectionStatus;
  playerId: string | null;
  roomCode: string | null;
  phase: Phase | null;
  players: LobbyPlayer[];
  game: GameView | null;
  result: GameResult | null;
  error: string | null;
  setStatus: (status: ConnectionStatus) => void;
  setError: (error: string | null) => void;
  applyServerMessage: (msg: ServerMessage) => void;
  reset: () => void;
}

const initial = {
  status: "connecting" as ConnectionStatus,
  playerId: null,
  roomCode: null,
  phase: null,
  players: [],
  game: null,
  result: null,
  error: null,
};

export const useStore = create<State>((set) => ({
  ...initial,
  setStatus: (status) => set({ status }),
  setError: (error) => set({ error }),
  reset: () => set({ ...initial, status: "connected" }),
  applyServerMessage: (msg) => {
    switch (msg.type) {
      case "joined":
        set({ playerId: msg.playerId, roomCode: msg.roomCode, error: null });
        return;
      case "roomState":
        set((s) => ({
          phase: msg.phase,
          roomCode: msg.roomCode,
          players: msg.players,
          game: msg.phase === "lobby" ? null : s.game,
          result: msg.phase === "lobby" ? null : s.result,
        }));
        return;
      case "gameState":
        set({ game: msg.game });
        return;
      case "gameOver":
        set({ result: msg.result });
        return;
      case "error":
        set({ error: msg.message });
        return;
    }
  },
}));
