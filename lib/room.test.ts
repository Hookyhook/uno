import { describe, expect, it } from "vitest";
import { ABANDON_TIMEOUT_MS, addSeat, applyAction, createRoom, RoomError, tick, viewFor } from "./room";

function lobbyWith(n: number, now = 1000) {
  let room = createRoom("ABCDE", now);
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const r = addSeat(room, `P${i}`, now);
    room = r.room;
    ids.push(r.seat.id);
  }
  return { room, ids };
}

function started(n: number, now = 1000) {
  let { room, ids } = lobbyWith(n, now);
  for (const id of ids) room = applyAction(room, id, { type: "ready", ready: true }, now);
  room = applyAction(room, ids[0]!, { type: "start" }, now);
  return { room, ids };
}

describe("lobby", () => {
  it("first seat is host, start needs everyone ready", () => {
    const { room, ids } = lobbyWith(2);
    expect(room.hostId).toBe(ids[0]);
    expect(() => applyAction(room, ids[1]!, { type: "start" }, 1000)).toThrowError(/host/);
    expect(() => applyAction(room, ids[0]!, { type: "start" }, 1000)).toThrowError(/ready/);
    expect(started(2).room.phase).toBe("playing");
  });

  it("rejects joining a running game and a 7th player", () => {
    expect(() => addSeat(started(2).room, "late", 1)).toThrow(RoomError);
    expect(() => addSeat(lobbyWith(6).room, "seven", 1)).toThrowError(/full/);
  });

  it("host leaving hands host to the next seat", () => {
    const { room, ids } = lobbyWith(3);
    const next = applyAction(room, ids[0]!, { type: "leave" }, 1000);
    expect(next.hostId).toBe(ids[1]);
    expect(next.seats).toHaveLength(2);
  });
});

describe("tick", () => {
  it("applies expired turns lazily, possibly several in a row", () => {
    const { room: fresh } = started(3, 1000);
    const at = fresh.game!.turnEndsAt + 2 * 45_000 + 1;
    const room = { ...fresh, seats: fresh.seats.map((s) => ({ ...s, lastSeen: at })) };
    const later = tick(room, at);
    expect(later.game!.turnEndsAt).toBe(room.game!.turnEndsAt + 3 * 45_000);
    const cards = (g: typeof room.game) => g!.players.reduce((n, p) => n + p.hand.length, 0);
    expect(cards(later.game)).toBe(cards(room.game) + 3);
  });

  it("removes seats nobody has polled for two minutes", () => {
    const { room, ids } = started(3, 1000);
    const polled = { ...room, seats: room.seats.map((s) => (s.id === ids[0] ? { ...s, lastSeen: 1000 + ABANDON_TIMEOUT_MS } : s)) };
    const pruned = tick(polled, 1000 + ABANDON_TIMEOUT_MS + 1);
    expect(pruned.seats.map((s) => s.id)).toEqual([ids[0]]);
    expect(pruned.phase).toBe("finished");
    expect(pruned.game!.winnerId).toBe(ids[0]);
  });

  it("returns the same object when nothing changed", () => {
    const { room } = started(2, 1000);
    expect(tick(room, 1001)).toBe(room);
  });
});

describe("viewFor", () => {
  it("only reveals the viewer's hand and marks stale players offline", () => {
    const { room, ids } = started(2, 1000);
    const view = viewFor(room, ids[0]!, 1000 + 20_000);
    expect(view.game!.hand).toHaveLength(7);
    expect(view.players.every((p) => !p.connected)).toBe(true);
    expect(view.game!.players.every((p) => !p.connected)).toBe(true);
    expect(JSON.stringify(view)).not.toContain(room.game!.players[1]!.hand[0]!.id);
  });
});
