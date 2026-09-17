import type { Action, ApiError, RoomView, Session } from "../protocol";
import { useStore } from "./store";

const SESSION_KEY = "uno.session";
export const POLL_INTERVAL_MS = 1500;

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function saveSession(session: Session | null): void {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(SESSION_KEY);
  useStore.getState().setSession(session);
}

class RequestError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(url: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (init.token) headers["x-uno-token"] = init.token;
  const res = await fetch(url, { ...init, headers, cache: "no-store" });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiError | null;
    throw new RequestError(res.status, body?.error.code ?? "http", body?.error.message ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export async function createRoom(name: string): Promise<void> {
  await withErrorToast(async () => {
    const session = await request<Session>("/api/rooms", { method: "POST", body: JSON.stringify({ name }) });
    saveSession(session);
    await poll();
  });
}

export async function joinRoom(code: string, name: string): Promise<void> {
  await withErrorToast(async () => {
    const session = await request<Session>(`/api/rooms/${code}/join`, { method: "POST", body: JSON.stringify({ name }) });
    saveSession(session);
    await poll();
  });
}

export async function act(action: Action): Promise<void> {
  const session = useStore.getState().session;
  if (!session) return;
  await withErrorToast(async () => {
    const view = await request<RoomView | { left: true }>(`/api/rooms/${session.roomCode}`, {
      method: "POST",
      token: session.token,
      body: JSON.stringify({ action }),
    });
    if ("left" in view) leave();
    else useStore.getState().setView(view);
  });
}

export async function poll(): Promise<void> {
  const session = useStore.getState().session;
  if (!session) return;
  try {
    const view = await request<RoomView>(`/api/rooms/${session.roomCode}`, { token: session.token });
    useStore.getState().setView(view);
  } catch (err) {
    if (err instanceof RequestError && [401, 403, 404].includes(err.status)) leave();
    else useStore.getState().setOffline(true);
  }
}

export function leave(): void {
  saveSession(null);
  useStore.getState().reset();
}

export async function leaveRoom(): Promise<void> {
  await act({ type: "leave" }).catch(() => undefined);
  leave();
}

async function withErrorToast(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    useStore.getState().setError(err instanceof Error ? err.message : "Something went wrong");
  }
}
