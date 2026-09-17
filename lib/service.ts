import { ZodError } from "zod";
import { EngineError } from "./engine";
import type { Action, RoomView, Session } from "./protocol";
import { addSeat, applyAction, createRoom, RoomError, tick, touch, viewFor, type RoomState } from "./room";
import { getStore, type Store } from "./store";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CAS_RETRIES = 4;
const PRESENCE_WRITE_INTERVAL_MS = 4000;

export async function createRoomForPlayer(name: string): Promise<Session> {
  const store = getStore();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const now = Date.now();
    const { room, seat } = addSeat(createRoom(code, now), name, now);
    if (await store.save(room, 0)) {
      await store.putToken(seat.token, { roomCode: code, playerId: seat.id });
      return { token: seat.token, roomCode: code, playerId: seat.id };
    }
  }
  throw new RoomError("no_code", "Could not allocate a room code, try again", 500);
}

export async function joinRoom(code: string, name: string): Promise<Session> {
  const store = getStore();
  let session: Session | null = null;
  await mutate(store, code, (room, now) => {
    const { room: next, seat } = addSeat(room, name, now);
    session = { token: seat.token, roomCode: code, playerId: seat.id };
    return next;
  });
  await store.putToken(session!.token, { roomCode: code, playerId: session!.playerId });
  return session!;
}

export async function resolveSession(token: string): Promise<Session> {
  const entry = await getStore().getToken(token);
  if (!entry) throw new RoomError("bad_token", "That session has expired", 401);
  return { token, ...entry };
}

export async function pollRoom(session: Session): Promise<RoomView> {
  const store = getStore();
  const loaded = await store.load(session.roomCode);
  if (!loaded) throw new RoomError("no_such_room", "That room no longer exists", 404);
  const now = Date.now();
  const seat = loaded.room.seats.find((s) => s.id === session.playerId);
  if (!seat) throw new RoomError("not_in_room", "You are no longer in this room", 403);

  const ticked = tick(loaded.room, now);
  const needsPresenceWrite = now - seat.lastSeen > PRESENCE_WRITE_INTERVAL_MS;
  if (ticked === loaded.room && !needsPresenceWrite) return viewFor(ticked, session.playerId, now);

  const room = await mutate(store, session.roomCode, (r, t) => touch(r, session.playerId, t));
  return viewFor(room, session.playerId, now);
}

export async function act(session: Session, action: Action): Promise<RoomView | null> {
  const store = getStore();
  const room = await mutate(store, session.roomCode, (r, now) => applyAction(touch(r, session.playerId, now), session.playerId, action, now));
  if (action.type === "leave") return null;
  return viewFor(room, session.playerId, Date.now());
}

async function mutate(store: Store, code: string, fn: (room: RoomState, now: number) => RoomState): Promise<RoomState> {
  for (let attempt = 0; attempt < CAS_RETRIES; attempt++) {
    const loaded = await store.load(code);
    if (!loaded) throw new RoomError("no_such_room", "No room with that code", 404);
    const now = Date.now();
    const next = fn(tick(loaded.room, now), now);
    if (next.seats.length === 0) {
      await store.remove(code);
      return next;
    }
    if (await store.save(next, loaded.version)) return next;
  }
  throw new RoomError("conflict", "Too many simultaneous changes, try again", 409);
}

export function toErrorResponse(err: unknown): { status: number; body: { error: { code: string; message: string } } } {
  if (err instanceof RoomError) return { status: err.status, body: { error: { code: err.code, message: err.message } } };
  if (err instanceof EngineError) return { status: 400, body: { error: { code: err.code, message: err.message } } };
  if (err instanceof ZodError) return { status: 400, body: { error: { code: "bad_request", message: "Invalid request" } } };
  console.error(err);
  return { status: 500, body: { error: { code: "internal", message: "Something went wrong" } } };
}

function randomCode(): string {
  let out = "";
  for (let i = 0; i < 5; i++) out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return out;
}
