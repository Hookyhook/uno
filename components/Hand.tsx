import type { Card as CardT } from "@/lib/cards";
import Card from "./Card";

const order = { red: 0, yellow: 1, green: 2, blue: 3, wild: 4 } as const;

export default function Hand({ cards, isPlayable, onPlay }: { cards: CardT[]; isPlayable: (c: CardT) => boolean; onPlay: (c: CardT) => void }) {
  const sorted = [...cards].sort((a, b) => order[a.color] - order[b.color] || String(a.value).localeCompare(String(b.value)));
  return (
    <section className="hand">
      {sorted.map((card) => (
        <Card key={card.id} card={card} playable={isPlayable(card)} onClick={() => onPlay(card)} />
      ))}
    </section>
  );
}
