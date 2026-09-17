import type { PublicPlayer } from "@/lib/protocol";
import { act } from "@/lib/client/api";

const MAX_PIPS = 8;

function Pips({ count }: { count: number }) {
  return (
    <span className="seat__pips" aria-hidden="true">
      {Array.from({ length: Math.min(count, MAX_PIPS) }, (_, i) => (
        <span key={i} className="seat__pip" />
      ))}
    </span>
  );
}

interface Props {
  players: PublicPlayer[];
  currentPlayerId: string;
  playerId: string;
  direction: 1 | -1;
}

export default function Seats({ players, currentPlayerId, playerId, direction }: Props) {
  return (
    <section className="seats" aria-label="Players">
      <span className={`direction${direction === -1 ? " reversed" : ""}`} title={direction === 1 ? "Clockwise" : "Counter-clockwise"}>
        {direction === 1 ? "↻" : "↺"}
      </span>

      {players.map((player) => {
        const isMe = player.id === playerId;
        const catchable = !isMe && player.cardCount === 1 && !player.unoCalled;
        return (
          <div
            key={player.id}
            className={`seat${player.id === currentPlayerId ? " current" : ""}${player.connected ? "" : " offline"}`}
          >
            {player.unoCalled && <span className="seat__badge">UNO</span>}
            <span className="seat__name">{isMe ? "You" : player.name}</span>
            <span className="seat__count">
              <Pips count={player.cardCount} />
              {player.cardCount}
            </span>
            {catchable && (
              <button className="seat__catch" onClick={() => act({ type: "catchUno", playerId: player.id })}>
                Catch
              </button>
            )}
          </div>
        );
      })}
    </section>
  );
}
