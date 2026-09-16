import type { ClientMessage, ServerMessage } from "@uno/shared";
import { useStore } from "./store.js";

const TOKEN_KEY = "uno.token";
let socket: WebSocket | null = null;
let retryDelay = 500;

export function connect(): void {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  socket = new WebSocket(`${proto}://${location.host}/ws`);
  useStore.getState().setStatus("connecting");

  socket.onopen = () => {
    retryDelay = 500;
    useStore.getState().setStatus("connected");
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) send({ type: "reconnect", token });
  };

  socket.onmessage = (event) => {
    const msg = JSON.parse(event.data) as ServerMessage;
    if (msg.type === "joined") localStorage.setItem(TOKEN_KEY, msg.token);
    if (msg.type === "error" && msg.code === "bad_token") {
      localStorage.removeItem(TOKEN_KEY);
      return;
    }
    useStore.getState().applyServerMessage(msg);
  };

  socket.onclose = () => {
    useStore.getState().setStatus("disconnected");
    setTimeout(connect, retryDelay);
    retryDelay = Math.min(retryDelay * 2, 10_000);
  };
}

export function send(msg: ClientMessage): void {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
}

export function leaveRoom(): void {
  send({ type: "leave" });
  localStorage.removeItem(TOKEN_KEY);
  useStore.getState().reset();
}
