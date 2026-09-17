import { describe, expect, it } from "vitest";
import type { Card, Color } from "./cards";
import {
  callUno,
  catchUno,
  createGame,
  drawCard,
  EngineError,
  passTurn,
  playCard,
  result,
  timeoutTurn,
  type EngineState,
} from "./engine";

const seats = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
const now = () => 1_000_000;
const card = (color: Card["color"], value: Card["value"], id = `${color}-${value}`): Card => ({ id, color, value });

function fixture(hands: Card[][], top: Card, overrides: Partial<EngineState> = {}): EngineState {
  const base = createGame(seats(hands.length), { now, random: () => 0.5 });
  return {
    ...base,
    players: base.players.map((p, i) => ({ ...p, hand: hands[i]!, unoCalled: false })),
    discard: [top],
    activeColor: top.color === "wild" ? "red" : (top.color as Color),
    drawPile: Array.from({ length: 20 }, (_, i) => card("green", 3, `pile${i}`)),
    currentIndex: 0,
    direction: 1,
    hasDrawnThisTurn: false,
    drawnCardId: null,
    pendingUnoPlayerId: null,
    winnerId: null,
    ...overrides,
  };
}

describe("createGame", () => {
  it("deals 7 cards and never opens on wild4", () => {
    for (let i = 0; i < 50; i++) {
      const g = createGame(seats(4));
      expect(g.players.every((p) => p.hand.length >= 7)).toBe(true);
      expect(g.discard[0]!.value).not.toBe("wild4");
      expect(g.drawPile.length + g.discard.length + g.players.reduce((s, p) => s + p.hand.length, 0)).toBe(108);
    }
  });
});

describe("playCard", () => {
  it("rejects out-of-turn and illegal cards", () => {
    const g = fixture([[card("red", 1)], [card("blue", 9)]], card("red", 5));
    expect(() => playCard(g, "p1", "blue-9", undefined)).toThrow(EngineError);
    const g2 = fixture([[card("blue", 1)], [card("blue", 9)]], card("red", 5));
    expect(() => playCard(g2, "p0", "blue-1", undefined)).toThrowError(/can't be played/);
  });

  it("plays a number card and advances the turn", () => {
    const g = fixture([[card("red", 1), card("red", 2)], [card("blue", 9)]], card("red", 5));
    const n = playCard(g, "p0", "red-1", undefined, { now });
    expect(n.discard.at(-1)!.id).toBe("red-1");
    expect(n.currentIndex).toBe(1);
    expect(n.turnEndsAt).toBe(now() + 45_000);
  });

  it("skip jumps one player, reverse flips direction, reverse with 2 players skips", () => {
    const g3 = fixture([[card("red", "skip"), card("red", 1)], [], []], card("red", 5));
    expect(playCard(g3, "p0", "red-skip", undefined).currentIndex).toBe(2);
    const r3 = fixture([[card("red", "reverse"), card("red", 1)], [], []], card("red", 5));
    const after = playCard(r3, "p0", "red-reverse", undefined);
    expect(after.direction).toBe(-1);
    expect(after.currentIndex).toBe(2);
    const r2 = fixture([[card("red", "reverse"), card("red", 1)], []], card("red", 5));
    expect(playCard(r2, "p0", "red-reverse", undefined).currentIndex).toBe(0);
  });

  it("draw2 and wild4 make the next player draw and lose their turn", () => {
    const g = fixture([[card("red", "draw2"), card("red", 1)], [card("blue", 1)], []], card("red", 5));
    const n = playCard(g, "p0", "red-draw2", undefined);
    expect(n.players[1]!.hand).toHaveLength(3);
    expect(n.currentIndex).toBe(2);

    const w = fixture([[card("wild", "wild4"), card("red", 1)], [card("blue", 1)], []], card("red", 5));
    expect(() => playCard(w, "p0", "wild-wild4", undefined)).toThrowError(/Choose a color/);
    const wn = playCard(w, "p0", "wild-wild4", "blue");
    expect(wn.players[1]!.hand).toHaveLength(5);
    expect(wn.activeColor).toBe("blue");
    expect(wn.currentIndex).toBe(2);
  });

  it("wins when the hand is empty", () => {
    const g = fixture([[card("red", 1)], [card("blue", "wild4", "x"), card("green", 7)]], card("red", 5));
    const n = playCard(g, "p0", "red-1", undefined);
    expect(n.winnerId).toBe("p0");
    expect(result(n).scores.find((s) => s.playerId === "p1")!.points).toBe(57);
  });
});

describe("draw / pass / timeout", () => {
  it("auto-passes when the drawn card is unplayable", () => {
    const g = fixture([[card("red", 1)], []], card("blue", 5));
    const n = drawCard(g, "p0");
    expect(n.players[0]!.hand).toHaveLength(2);
    expect(n.currentIndex).toBe(1);
  });

  it("keeps the turn when the drawn card is playable and only allows that card", () => {
    const g = fixture([[card("green", 1)], []], card("blue", 3));
    const n = drawCard(g, "p0");
    expect(n.currentIndex).toBe(0);
    expect(n.hasDrawnThisTurn).toBe(true);
    expect(() => drawCard(n, "p0")).toThrowError(/already drew/);
    expect(() => playCard(n, "p0", "green-1", undefined)).toThrowError(/only play the drawn/);
    const played = playCard(n, "p0", n.drawnCardId!, undefined);
    expect(played.currentIndex).toBe(1);
    expect(passTurn(n, "p0").currentIndex).toBe(1);
  });

  it("rejects pass before drawing", () => {
    const g = fixture([[card("green", 1)], []], card("blue", 5));
    expect(() => passTurn(g, "p0")).toThrowError(/Draw a card/);
  });

  it("timeout draws and passes", () => {
    const g = fixture([[card("green", 1)], []], card("blue", 5));
    const n = timeoutTurn(g);
    expect(n.players[0]!.hand).toHaveLength(2);
    expect(n.currentIndex).toBe(1);
  });

  it("reshuffles the discard pile when the draw pile is empty", () => {
    const g = fixture([[card("green", 1)], []], card("blue", 5), {
      drawPile: [],
      discard: [card("red", 1), card("red", 2), card("blue", 5)],
    });
    const n = drawCard(g, "p0");
    expect(n.players[0]!.hand).toHaveLength(2);
    expect(n.discard).toHaveLength(1);
    expect(n.discard[0]!.id).toBe("blue-5");
    expect(n.drawPile).toHaveLength(1);
  });
});

describe("uno", () => {
  it("can be caught until the next player acts", () => {
    const g = fixture([[card("red", 1), card("red", 2)], [card("blue", 1)], []], card("red", 5));
    const n = playCard(g, "p0", "red-1", undefined);
    expect(n.pendingUnoPlayerId).toBe("p0");
    const caught = catchUno(n, "p2", "p0");
    expect(caught.players[0]!.hand).toHaveLength(3);
    expect(caught.pendingUnoPlayerId).toBeNull();
    expect(() => catchUno(caught, "p2", "p0")).toThrowError(/can't be caught/);

    const afterNext = drawCard(n, "p1");
    expect(afterNext.pendingUnoPlayerId).toBeNull();
  });

  it("calling uno in time prevents a catch, pre-calling with two cards works", () => {
    const g = fixture([[card("red", 1), card("red", 2)], [card("blue", 1)], []], card("red", 5));
    const played = playCard(g, "p0", "red-1", undefined);
    const called = callUno(played, "p0");
    expect(called.pendingUnoPlayerId).toBeNull();
    expect(() => catchUno(called, "p1", "p0")).toThrow(EngineError);

    const pre = playCard(callUno(g, "p0"), "p0", "red-1", undefined);
    expect(pre.pendingUnoPlayerId).toBeNull();
    expect(pre.players[0]!.unoCalled).toBe(true);
  });

  it("rejects calling uno with many cards", () => {
    const g = fixture([[card("red", 1), card("red", 2), card("red", 3)], []], card("red", 5));
    expect(() => callUno(g, "p0")).toThrowError(/one card left/);
  });
});
