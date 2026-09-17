export const COLORS = ["red", "yellow", "green", "blue"] as const;
export type Color = (typeof COLORS)[number];

export type NumberValue = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type ActionValue = "skip" | "reverse" | "draw2";
export type WildValue = "wild" | "wild4";
export type Value = NumberValue | ActionValue | WildValue;

export interface Card {
  id: string;
  color: Color | "wild";
  value: Value;
}

export function isWild(card: Card): boolean {
  return card.color === "wild";
}

export function buildDeck(): Card[] {
  const deck: Card[] = [];
  let n = 0;
  const push = (color: Card["color"], value: Value) => deck.push({ id: `c${n++}`, color, value });

  for (const color of COLORS) {
    push(color, 0);
    for (let v = 1; v <= 9; v++) {
      push(color, v as NumberValue);
      push(color, v as NumberValue);
    }
    for (const action of ["skip", "reverse", "draw2"] as const) {
      push(color, action);
      push(color, action);
    }
  }
  for (let i = 0; i < 4; i++) {
    push("wild", "wild");
    push("wild", "wild4");
  }
  return deck;
}

export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export function cardPoints(card: Card): number {
  if (typeof card.value === "number") return card.value;
  if (card.value === "wild" || card.value === "wild4") return 50;
  return 20;
}
