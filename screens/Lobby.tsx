"use client";

import { useState } from "react";
import { act, leaveRoom } from "@/lib/client/api";
import { useStore } from "@/lib/client/store";
import { MAX_PLAYERS, MIN_PLAYERS } from "@/lib/rules";

export default function Lobby() {
  const view = useStore((s) => s.view)!;
  const { roomCode, players, playerId } = view;
  const [copied, setCopied] = useState(false);

  const me = players.find((p) => p.id === playerId);
  const readyCount = players.filter((p) => p.ready).length;
  const canStart = me?.isHost && players.length >= MIN_PLAYERS && readyCount === players.length;

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(`${location.origin}/?room=${roomCode}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <main className="lobby">
      <h2>Room code</h2>
      <div className="room-code" onClick={copyInvite} title="Copy invite link">
        {roomCode}
      </div>
      <p className="hint">
        {copied ? "Invite link copied" : `Tap the code to copy an invite. ${players.length}/${MAX_PLAYERS} players.`}
      </p>

      <ul className="player-list">
        {players.map((player, i) => (
          <li key={player.id} className={player.connected ? "" : "offline"} style={{ animationDelay: `${i * 50}ms` }}>
            <span>
              <span className={`status-dot ${player.connected ? "on" : "off"}`} />
              {player.name}
              {player.isHost && " 👑"}
              {player.id === playerId && " (you)"}
            </span>
            <span className={player.ready ? "ready" : "not-ready"}>{player.ready ? "Ready" : "Waiting"}</span>
          </li>
        ))}
      </ul>

      <div className="actions">
        <button onClick={() => act({ type: "ready", ready: !me?.ready })} className={me?.ready ? "" : "primary"}>
          {me?.ready ? "Not ready" : "I'm ready"}
        </button>
        {me?.isHost && (
          <button className="primary" disabled={!canStart} onClick={() => act({ type: "start" })}>
            Start game
          </button>
        )}
        <button className="ghost" onClick={leaveRoom}>
          Leave
        </button>
      </div>

      {!me?.isHost && <p className="hint">The host starts the game once everyone is ready.</p>}
      {me?.isHost && players.length < MIN_PLAYERS && <p className="hint">Waiting for at least one more player.</p>}
    </main>
  );
}
