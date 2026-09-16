import type { WebSocket } from "ws";
import { clientMessageSchema, type ServerMessage } from "@uno/shared";
import { RoomError, type Room } from "./room.js";
import type { RoomManager } from "./rooms.js";

export function handleConnection(socket: WebSocket, rooms: RoomManager): void {
  let room: Room | null = null;
  let playerId: string | null = null;

  const send = (msg: ServerMessage) => socket.send(JSON.stringify(msg));

  socket.on("message", (raw) => {
    const parsed = clientMessageSchema.safeParse(safeJson(raw.toString()));
    if (!parsed.success) {
      send({ type: "error", code: "bad_message", message: "Malformed message" });
      return;
    }
    const msg = parsed.data;

    if (room && playerId) {
      room.handle(playerId, msg);
      return;
    }

    try {
      switch (msg.type) {
        case "createRoom": {
          room = rooms.create();
          const seat = room.addPlayer(msg.name, socket);
          playerId = seat.id;
          rooms.registerToken(seat.token, room.code, seat.id);
          return;
        }
        case "joinRoom": {
          const target = rooms.get(msg.code);
          if (!target) throw new RoomError("no_such_room", "No room with that code");
          const seat = target.addPlayer(msg.name, socket);
          room = target;
          playerId = seat.id;
          rooms.registerToken(seat.token, target.code, seat.id);
          return;
        }
        case "reconnect": {
          const resolved = rooms.resolveToken(msg.token);
          if (!resolved || !resolved.room.reconnect(resolved.playerId, socket)) {
            throw new RoomError("bad_token", "That session has expired");
          }
          room = resolved.room;
          playerId = resolved.playerId;
          return;
        }
        default:
          throw new RoomError("not_in_room", "Join a room first");
      }
    } catch (err) {
      if (err instanceof RoomError) send({ type: "error", code: err.code, message: err.message });
      else throw err;
    }
  });

  socket.on("close", () => {
    if (room && playerId) room.disconnect(playerId, socket);
  });
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
