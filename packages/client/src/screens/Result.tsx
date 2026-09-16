import { leaveRoom, send } from "../ws.js";
import { useStore } from "../store.js";

export default function Result() {
  const { result, players, playerId } = useStore();
  const isHost = players.find((p) => p.id === playerId)?.isHost;
  if (!result) return null;
  const winner = result.scores.find((s) => s.playerId === result.winnerId);

  return (
    <main className="result">
      <h1>{winner?.playerId === playerId ? "You win! 🎉" : `${winner?.name ?? "Someone"} wins!`}</h1>
      <table>
        <thead><tr><th>Player</th><th>Cards left (points)</th></tr></thead>
        <tbody>
          {result.scores.map((s) => (
            <tr key={s.playerId} className={s.playerId === result.winnerId ? "winner" : ""}>
              <td>{s.name}</td><td>{s.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="actions">
        {isHost ? (
          <button className="primary" onClick={() => send({ type: "playAgain" })}>Play again</button>
        ) : (
          <p className="hint">Waiting for the host to start a new round…</p>
        )}
        <button className="ghost" onClick={leaveRoom}>Leave</button>
      </div>
    </main>
  );
}
