"use client";

import { act, leaveRoom } from "@/lib/client/api";
import { useStore } from "@/lib/client/store";
import { MIN_PLAYERS } from "@/lib/rules";

export default function Lobby() {
  const view = useStore((s) => s.view)!;
  const { roomCode, players, playerId } = view;
  const me = players.find((p) => p.id === playerId);
  const canStart = me?.isHost && players.length >= MIN_PLAYERS && players.every((p) => p.ready);
  const copy = () => navigator.clipboard?.writeText(`${location.origin}/?room=${roomCode}`);

  return (
    <main className="lobby">
      <h2>Room code</h2>
      <div className="room-code" onClick={copy} title="Copy invite link">{roomCode}</div>
      <p className="hint">Share the code with your friends. {players.length}/6 players.</p>
      <ul className="player-list">
        {players.map((p) => (
          <li key={p.id} className={p.connected ? "" : "offline"}>
            <span>{p.name}{p.isHost && " 👑"}{p.id === playerId && " (you)"}</span>
            <span className={p.ready ? "ready" : "not-ready"}>{p.ready ? "Ready" : "Not ready"}</span>
          </li>
        ))}
      </ul>
      <div className="actions">
        <button onClick={() => act({ type: "ready", ready: !me?.ready })} className={me?.ready ? "" : "primary"}>
          {me?.ready ? "Not ready" : "Ready"}
        </button>
        {me?.isHost && (
          <button className="primary" disabled={!canStart} onClick={() => act({ type: "start" })}>Start game</button>
        )}
        <button className="ghost" onClick={leaveRoom}>Leave</button>
      </div>
    </main>
  );
}
