import type { Card as CardT } from "@uno/shared";

const LABELS: Record<string, string> = { skip: "⊘", reverse: "⇄", draw2: "+2", wild: "★", wild4: "+4" };

export default function Card({ card, playable, onClick }: { card: CardT; playable?: boolean; onClick?: () => void }) {
  const label = LABELS[String(card.value)] ?? String(card.value);
  return (
    <button
      type="button"
      className={`card color-${card.color} ${playable ? "playable" : ""} ${onClick && !playable ? "dim" : ""}`}
      onClick={onClick}
      disabled={onClick ? !playable : true}
      aria-label={`${card.color} ${card.value}`}
    >
      <span className="corner">{label}</span>
      <span className="center">{label}</span>
      <span className="corner bottom">{label}</span>
    </button>
  );
}
