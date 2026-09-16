import { useEffect } from "react";
import { useStore } from "./store.js";
import Home from "./screens/Home.js";
import Lobby from "./screens/Lobby.js";
import Game from "./screens/Game.js";
import Result from "./screens/Result.js";

export default function App() {
  const { status, phase, error, setError } = useStore();

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(t);
  }, [error, setError]);

  const screen =
    phase === "lobby" ? <Lobby /> : phase === "playing" ? <Game /> : phase === "finished" ? <Result /> : <Home />;

  return (
    <div className="app">
      {status !== "connected" && <div className="banner">{status === "connecting" ? "Connecting…" : "Connection lost, retrying…"}</div>}
      {error && <div className="toast">{error}</div>}
      {screen}
    </div>
  );
}
