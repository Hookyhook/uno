import { Room } from "./room.js";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const EMPTY_ROOM_TTL_MS = 5 * 60 * 1000;
const IDLE_ROOM_TTL_MS = 6 * 60 * 60 * 1000;

export class RoomManager {
  private rooms = new Map<string, Room>();
  private tokens = new Map<string, { roomCode: string; playerId: string }>();

  constructor() {
    setInterval(() => this.sweep(), 60 * 1000).unref();
  }

  create(): Room {
    let code: string;
    do code = this.randomCode();
    while (this.rooms.has(code));
    const room = new Room(code, (r) => this.delete(r.code));
    this.rooms.set(code, room);
    return room;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  registerToken(token: string, roomCode: string, playerId: string): void {
    this.tokens.set(token, { roomCode, playerId });
  }

  resolveToken(token: string): { room: Room; playerId: string } | null {
    const entry = this.tokens.get(token);
    const room = entry && this.rooms.get(entry.roomCode);
    if (!entry || !room) return null;
    return { room, playerId: entry.playerId };
  }

  private delete(code: string): void {
    this.rooms.delete(code);
    for (const [token, entry] of this.tokens) if (entry.roomCode === code) this.tokens.delete(token);
  }

  private sweep(): void {
    const now = Date.now();
    for (const room of this.rooms.values()) {
      const idle = now - room.lastActivity;
      const abandoned = room.connectedCount === 0 && idle > EMPTY_ROOM_TTL_MS;
      if (abandoned || idle > IDLE_ROOM_TTL_MS) this.delete(room.code);
    }
  }

  private randomCode(): string {
    let out = "";
    for (let i = 0; i < 5; i++) out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    return out;
  }
}
