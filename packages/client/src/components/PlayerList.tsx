import type { PublicPlayer } from "@uno/shared";
import { send } from "../ws.js";

interface Props { players: PublicPlayer[]; currentPlayerId: string; playerId: string; direction: 1 | -1 }

export default function PlayerList({ players, currentPlayerId, playerId, direction }: Props) {
  return (
    <section className="players">
      <span className="direction">{direction === 1 ? "↻" : "↺"}</span>
      {players.map((p) => (
        <div key={p.id} className={`player ${p.id === currentPlayerId ? "current" : ""} ${p.connected ? "" : "offline"}`}>
          <div className="name">{p.name}{p.id === playerId && " (you)"}</div>
          <div className="count">{p.cardCount} 🂠</div>
          {p.unoCalled && <div className="badge">UNO</div>}
          {p.id !== playerId && p.cardCount === 1 && !p.unoCalled && (
            <button className="catch" onClick={() => send({ type: "catchUno", playerId: p.id })}>Catch!</button>
          )}
        </div>
      ))}
    </section>
  );
}
