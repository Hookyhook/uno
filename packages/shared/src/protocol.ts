import { z } from "zod";
import type { Card, Color } from "./cards.js";

const name = z.string().trim().min(1).max(20);
const code = z.string().trim().toUpperCase().length(5);
const colorSchema = z.enum(["red", "yellow", "green", "blue"]);

export const clientMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("createRoom"), name }),
  z.object({ type: z.literal("joinRoom"), code, name }),
  z.object({ type: z.literal("reconnect"), token: z.string().min(1) }),
  z.object({ type: z.literal("ready"), ready: z.boolean() }),
  z.object({ type: z.literal("start") }),
  z.object({ type: z.literal("playCard"), cardId: z.string(), chosenColor: colorSchema.optional() }),
  z.object({ type: z.literal("drawCard") }),
  z.object({ type: z.literal("passTurn") }),
  z.object({ type: z.literal("callUno") }),
  z.object({ type: z.literal("catchUno"), playerId: z.string() }),
  z.object({ type: z.literal("playAgain") }),
  z.object({ type: z.literal("leave") }),
]);
export type ClientMessage = z.infer<typeof clientMessageSchema>;

export interface LobbyPlayer {
  id: string;
  name: string;
  ready: boolean;
  connected: boolean;
  isHost: boolean;
}

export interface PublicPlayer {
  id: string;
  name: string;
  cardCount: number;
  connected: boolean;
  unoCalled: boolean;
}

export type Phase = "lobby" | "playing" | "finished";

export interface GameView {
  players: PublicPlayer[];
  currentPlayerId: string;
  direction: 1 | -1;
  topCard: Card;
  activeColor: Color;
  drawPileCount: number;
  hand: Card[];
  hasDrawnThisTurn: boolean;
  turnEndsAt: number;
  lastEvent: string | null;
}

export interface GameResult {
  winnerId: string;
  scores: { playerId: string; name: string; points: number }[];
}

export type ServerMessage =
  | { type: "joined"; token: string; playerId: string; roomCode: string }
  | { type: "roomState"; phase: Phase; roomCode: string; players: LobbyPlayer[] }
  | { type: "gameState"; game: GameView }
  | { type: "gameOver"; result: GameResult }
  | { type: "error"; code: string; message: string };
