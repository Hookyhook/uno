"use client";

import { useEffect, useState } from "react";
import type { Card as CardT, Color } from "@/lib/cards";
import { canPlay, TURN_SECONDS } from "@/lib/rules";
import { act } from "@/lib/client/api";
import { useStore } from "@/lib/client/store";
import Card, { CardBack } from "@/components/Card";
import Hand from "@/components/Hand";
import Seats from "@/components/Seats";
import ColorPicker from "@/components/ColorPicker";
import TurnTimer from "@/components/TurnTimer";

/** Stable per-card tilt so the discard pile doesn't jitter on every poll. */
function tiltFor(id: string, spread: number): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(hash) % 100) / 100 - 0.5) * spread;
}

export default function Game() {
  const view = useStore((s) => s.view)!;
  const { game, playerId } = view;
  const [pendingWild, setPendingWild] = useState<CardT | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);

  if (!game) return null;

  const myTurn = game.currentPlayerId === playerId;
  const me = game.players.find((p) => p.id === playerId)!;
  const currentName = game.players.find((p) => p.id === game.currentPlayerId)?.name;
  const secondsLeft = Math.max(0, Math.ceil((game.turnEndsAt - now) / 1000));
  const canCallUno = me.cardCount === 1 || (myTurn && me.cardCount === 2);
  const canDraw = myTurn && !game.hasDrawnThisTurn;

  const isPlayable = (card: CardT) => myTurn && canPlay(card, game.topCard, game.activeColor);

  const play = (card: CardT) => {
    if (!isPlayable(card)) return;
    if (card.color === "wild") setPendingWild(card);
    else void act({ type: "playCard", cardId: card.id });
  };

  const chooseColor = (color: Color) => {
    if (pendingWild) void act({ type: "playCard", cardId: pendingWild.id, chosenColor: color });
    setPendingWild(null);
  };

  return (
    <main className="game">
      <Seats
        players={game.players}
        currentPlayerId={game.currentPlayerId}
        playerId={playerId}
        direction={game.direction}
      />

      <section className="table">
        <button
          className={`draw-pile${canDraw ? " ready-to-draw" : ""}`}
          onClick={() => act({ type: "drawCard" })}
          disabled={!canDraw}
          aria-label="Draw a card"
        >
          <span className="pile">
            <CardBack style={{ position: "absolute", top: 4, left: 4, opacity: 0.4 }} />
            <CardBack style={{ position: "absolute", top: 2, left: 2, opacity: 0.7 }} />
            <CardBack />
          </span>
          <span className="draw-pile__count">{game.drawPileCount} left</span>
        </button>

        <span className="pile discard">
          <span className={`discard__glow glow-${game.activeColor}`} />
          <span
            className="pile__under"
            style={{ transform: `rotate(${tiltFor(game.topCard.id, 16)}deg) translate(3px, 2px)` }}
            aria-hidden="true"
          >
            <span className="card card--ghost" />
          </span>
          <Card
            key={game.topCard.id}
            card={game.topCard}
            style={{
              ["--spin" as string]: `${tiltFor(game.topCard.id, 40)}deg`,
              ["--rest" as string]: `${tiltFor(game.topCard.id, 10)}deg`,
            }}
          />
        </span>
      </section>

      <div className="status">
        <div className={`turn${myTurn ? " mine" : ""}`}>
          <TurnTimer secondsLeft={secondsLeft} total={TURN_SECONDS} />
          {myTurn ? "Your turn" : `${currentName ?? "Someone"}'s turn`}
        </div>
        {game.lastEvent && (
          <div className="event" key={game.lastEvent}>
            {game.lastEvent}
          </div>
        )}
      </div>

      <div className="actions">
        <button className="uno" disabled={!canCallUno || me.unoCalled} onClick={() => act({ type: "callUno" })}>
          UNO!
        </button>
        {myTurn && game.hasDrawnThisTurn && <button onClick={() => act({ type: "passTurn" })}>Pass turn</button>}
      </div>

      <Hand cards={game.hand} isPlayable={isPlayable} onPlay={play} />

      {pendingWild && <ColorPicker onPick={chooseColor} onCancel={() => setPendingWild(null)} />}
    </main>
  );
}
