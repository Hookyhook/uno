import { MIN_PLAYERS } from "@uno/shared";
import { leaveRoom, send } from "../ws.js";
import { useStore } from "../store.js";

export default function Lobby() {
  const { roomCode, players, playerId } = useStore();
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
        <button onClick={() => send({ type: "ready", ready: !me?.ready })} className={me?.ready ? "" : "primary"}>
          {me?.ready ? "Not ready" : "Ready"}
        </button>
        {me?.isHost && (
          <button className="primary" disabled={!canStart} onClick={() => send({ type: "start" })}>Start game</button>
        )}
        <button className="ghost" onClick={leaveRoom}>Leave</button>
      </div>
    </main>
  );
}
