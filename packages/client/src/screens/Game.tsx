import { useEffect, useState } from "react";
import { canPlay, type Card as CardT, type Color } from "@uno/shared";
import { send } from "../ws.js";
import { useStore } from "../store.js";
import Card from "../components/Card.js";
import Hand from "../components/Hand.js";
import PlayerList from "../components/PlayerList.js";
import ColorPicker from "../components/ColorPicker.js";

export default function Game() {
  const { game, playerId } = useStore();
  const [pendingWild, setPendingWild] = useState<CardT | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  if (!game || !playerId) return null;
  const myTurn = game.currentPlayerId === playerId;
  const me = game.players.find((p) => p.id === playerId)!;
  const secondsLeft = Math.max(0, Math.ceil((game.turnEndsAt - now) / 1000));
  const canCallUno = me.cardCount === 1 || (myTurn && me.cardCount === 2);

  const isPlayable = (card: CardT) => myTurn && canPlay(card, game.topCard, game.activeColor);

  const play = (card: CardT) => {
    if (!isPlayable(card)) return;
    if (card.color === "wild") setPendingWild(card);
    else send({ type: "playCard", cardId: card.id });
  };

  const chooseColor = (color: Color) => {
    if (pendingWild) send({ type: "playCard", cardId: pendingWild.id, chosenColor: color });
    setPendingWild(null);
  };

  return (
    <main className="game">
      <PlayerList players={game.players} currentPlayerId={game.currentPlayerId} playerId={playerId} direction={game.direction} />

      <section className="table">
        <button className="draw-pile" onClick={() => send({ type: "drawCard" })} disabled={!myTurn || game.hasDrawnThisTurn}>
          <div className="card back" />
          <span>{game.drawPileCount}</span>
        </button>
        <div className={`discard color-${game.activeColor}`}>
          <Card card={game.topCard} />
        </div>
      </section>

      <div className="status">
        <div className={`turn ${myTurn ? "mine" : ""}`}>
          {myTurn ? "Your turn" : `${game.players.find((p) => p.id === game.currentPlayerId)?.name}'s turn`} · {secondsLeft}s
        </div>
        {game.lastEvent && <div className="event">{game.lastEvent}</div>}
      </div>

      <div className="actions">
        <button className="uno" disabled={!canCallUno || me.unoCalled} onClick={() => send({ type: "callUno" })}>UNO!</button>
        {myTurn && game.hasDrawnThisTurn && <button onClick={() => send({ type: "passTurn" })}>Pass</button>}
      </div>

      <Hand cards={game.hand} isPlayable={isPlayable} onPlay={play} />

      {pendingWild && <ColorPicker onPick={chooseColor} onCancel={() => setPendingWild(null)} />}
    </main>
  );
}
