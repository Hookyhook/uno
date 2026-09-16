import type { Card, Color } from "./cards.js";

export function canPlay(card: Card, top: Card, activeColor: Color): boolean {
  if (card.color === "wild") return true;
  return card.color === activeColor || card.value === top.value;
}

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;
export const HAND_SIZE = 7;
export const TURN_SECONDS = 45;
