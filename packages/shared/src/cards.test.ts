import { describe, expect, it } from "vitest";
import { buildDeck, shuffle } from "./cards.js";
import { canPlay } from "./rules.js";

describe("deck", () => {
  it("has 108 unique cards", () => {
    const deck = buildDeck();
    expect(deck).toHaveLength(108);
    expect(new Set(deck.map((c) => c.id)).size).toBe(108);
    expect(deck.filter((c) => c.value === "wild4")).toHaveLength(4);
    expect(deck.filter((c) => c.color === "red" && c.value === 0)).toHaveLength(1);
  });

  it("shuffle preserves cards", () => {
    const deck = buildDeck();
    const shuffled = shuffle(deck, () => 0.42);
    expect(shuffled.map((c) => c.id).sort()).toEqual(deck.map((c) => c.id).sort());
  });
});

describe("canPlay", () => {
  const top = { id: "t", color: "red", value: 5 } as const;
  it("matches color, value, or wild", () => {
    expect(canPlay({ id: "a", color: "red", value: 9 }, top, "red")).toBe(true);
    expect(canPlay({ id: "b", color: "blue", value: 5 }, top, "red")).toBe(true);
    expect(canPlay({ id: "c", color: "wild", value: "wild" }, top, "red")).toBe(true);
    expect(canPlay({ id: "d", color: "blue", value: 6 }, top, "red")).toBe(false);
  });
  it("uses active color after a wild", () => {
    const wildTop = { id: "w", color: "wild", value: "wild" } as const;
    expect(canPlay({ id: "a", color: "green", value: 1 }, wildTop, "green")).toBe(true);
    expect(canPlay({ id: "b", color: "red", value: 1 }, wildTop, "green")).toBe(false);
  });
});
