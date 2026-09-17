"use client";

import { useEffect } from "react";
import { loadSession, poll, POLL_INTERVAL_MS } from "@/lib/client/api";
import { useStore } from "@/lib/client/store";
import Home from "@/screens/Home";
import Lobby from "@/screens/Lobby";
import Game from "@/screens/Game";
import Result from "@/screens/Result";

export default function App() {
  const { session, view, error, offline, setSession, setError } = useStore();

  useEffect(() => {
    setSession(loadSession());
  }, [setSession]);

  useEffect(() => {
    if (!session) return;
    void poll();
    const timer = setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [session]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(t);
  }, [error, setError]);

  const phase = session && view ? view.phase : null;
  const screen =
    phase === "lobby" ? <Lobby /> : phase === "playing" ? <Game /> : phase === "finished" ? <Result /> : <Home />;

  return (
    <div className="app">
      {offline && <div className="banner">Connection lost, retrying…</div>}
      {error && <div className="toast">{error}</div>}
      {screen}
    </div>
  );
}
