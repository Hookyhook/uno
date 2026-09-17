import { Redis } from "@upstash/redis";
import type { RoomState } from "./room";

export const ROOM_TTL_SECONDS = 6 * 60 * 60;

export interface TokenEntry {
  roomCode: string;
  playerId: string;
}

export interface Loaded {
  room: RoomState;
  version: number;
}

export interface Store {
  load(code: string): Promise<Loaded | null>;
  /** Writes only if the stored version still matches `expectedVersion` (0 = must not exist). Returns false on conflict. */
  save(room: RoomState, expectedVersion: number): Promise<boolean>;
  remove(code: string): Promise<void>;
  putToken(token: string, entry: TokenEntry): Promise<void>;
  getToken(token: string): Promise<TokenEntry | null>;
}

const CAS_SCRIPT = `
local v = redis.call('GET', KEYS[2])
if (v or '0') ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
redis.call('SET', KEYS[2], ARGV[4], 'EX', ARGV[3])
return 1
`;

class UpstashStore implements Store {
  constructor(private redis: Redis) {}

  async load(code: string): Promise<Loaded | null> {
    const [raw, version] = await this.redis.mget<[string | null, string | null]>(roomKey(code), versionKey(code));
    if (!raw) return null;
    return { room: JSON.parse(raw) as RoomState, version: Number(version ?? 0) };
  }

  async save(room: RoomState, expectedVersion: number): Promise<boolean> {
    const result = await this.redis.eval(
      CAS_SCRIPT,
      [roomKey(room.code), versionKey(room.code)],
      [String(expectedVersion), JSON.stringify(room), String(ROOM_TTL_SECONDS), String(expectedVersion + 1)],
    );
    return result === 1;
  }

  async remove(code: string): Promise<void> {
    await this.redis.del(roomKey(code), versionKey(code));
  }

  async putToken(token: string, entry: TokenEntry): Promise<void> {
    await this.redis.set(tokenKey(token), JSON.stringify(entry), { ex: ROOM_TTL_SECONDS });
  }

  async getToken(token: string): Promise<TokenEntry | null> {
    const raw = await this.redis.get<string>(tokenKey(token));
    return raw ? (JSON.parse(raw) as TokenEntry) : null;
  }
}

class MemoryStore implements Store {
  private rooms = new Map<string, Loaded>();
  private tokens = new Map<string, TokenEntry>();

  async load(code: string): Promise<Loaded | null> {
    const entry = this.rooms.get(code);
    return entry ? { room: structuredClone(entry.room), version: entry.version } : null;
  }
  async save(room: RoomState, expectedVersion: number): Promise<boolean> {
    const current = this.rooms.get(room.code)?.version ?? 0;
    if (current !== expectedVersion) return false;
    this.rooms.set(room.code, { room: structuredClone(room), version: expectedVersion + 1 });
    return true;
  }
  async remove(code: string): Promise<void> {
    this.rooms.delete(code);
  }
  async putToken(token: string, entry: TokenEntry): Promise<void> {
    this.tokens.set(token, entry);
  }
  async getToken(token: string): Promise<TokenEntry | null> {
    return this.tokens.get(token) ?? null;
  }
}

const roomKey = (code: string) => `uno:room:${code}`;
const versionKey = (code: string) => `uno:room:${code}:v`;
const tokenKey = (token: string) => `uno:token:${token}`;

const globalStore = globalThis as unknown as { __unoStore?: Store };

export function getStore(): Store {
  if (globalStore.__unoStore) return globalStore.__unoStore;
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (url && token) {
    globalStore.__unoStore = new UpstashStore(new Redis({ url, token, automaticDeserialization: false }));
  } else {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "No Redis credentials. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN " +
          "(or KV_REST_API_URL and KV_REST_API_TOKEN) in the project's environment variables, then redeploy.",
      );
    }
    console.warn("[uno] Upstash env vars not set, using in-memory store (dev only)");
    globalStore.__unoStore = new MemoryStore();
  }
  return globalStore.__unoStore;
}
