"use client";

import { useMemo } from "react";
import { act, leaveRoom } from "@/lib/client/api";
import { useStore } from "@/lib/client/store";

const CONFETTI_COLORS = ["var(--red)", "var(--yellow)", "var(--green)", "var(--blue)"];

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        left: `${(i * 37) % 100}%`,
        background: CONFETTI_COLORS[i % CONFETTI_COLORS.length]!,
        animationDelay: `${(i % 12) * 0.12}s`,
        animationDuration: `${2.2 + ((i * 7) % 10) / 10}s`,
      })),
    [],
  );

  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((style, i) => (
        <i key={i} style={style} />
      ))}
    </div>
  );
}

export default function Result() {
  const view = useStore((s) => s.view)!;
  const { result, players, playerId } = view;

  const isHost = players.find((p) => p.id === playerId)?.isHost;
  if (!result) return null;

  const iWon = result.winnerId === playerId;
  const winner = result.scores.find((s) => s.playerId === result.winnerId);
  const ranked = [...result.scores].sort((a, b) =>
    a.playerId === result.winnerId ? -1 : b.playerId === result.winnerId ? 1 : a.points - b.points,
  );

  return (
    <main className="result">
      {iWon && <Confetti />}
      <h1 className={iWon ? "win" : ""}>{iWon ? "You win!" : `${winner?.name ?? "Someone"} wins`}</h1>

      <div className="scores">
        {ranked.map((score, i) => (
          <div
            key={score.playerId}
            className={`score-row${score.playerId === result.winnerId ? " winner" : ""}`}
            style={{ ["--delay" as string]: `${i * 70}ms` }}
          >
            <span>
              {score.name}
              {score.playerId === playerId && " (you)"}
            </span>
            <span className="points">{score.playerId === result.winnerId ? "winner" : `${score.points} pts`}</span>
          </div>
        ))}
      </div>

      <div className="actions">
        {isHost ? (
          <button className="primary" onClick={() => act({ type: "playAgain" })}>
            Play again
          </button>
        ) : (
          <p className="hint">Waiting for the host to start a new round.</p>
        )}
        <button className="ghost" onClick={leaveRoom}>
          Leave
        </button>
      </div>
    </main>
  );
}
