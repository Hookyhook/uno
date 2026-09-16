import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyWebsocket from "@fastify/websocket";
import { handleConnection } from "./connection.js";
import { RoomManager } from "./rooms.js";

const port = Number(process.env.PORT ?? 8080);
const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../client/dist");

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? "info" } });
const rooms = new RoomManager();

await app.register(fastifyWebsocket);
app.get("/ws", { websocket: true }, (socket) => handleConnection(socket, rooms));
app.get("/health", async () => ({ ok: true }));

await app.register(fastifyStatic, { root: clientDist, wildcard: false });
app.setNotFoundHandler((_req, reply) => reply.sendFile("index.html"));

await app.listen({ port, host: "0.0.0.0" });
