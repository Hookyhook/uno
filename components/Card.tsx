import type { Card as CardT, Value } from "@/lib/cards";

const ICON_VALUES = new Set<Value>(["skip", "reverse"]);

function SkipIcon() {
  return (
    <svg className="card__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3.4" />
      <line x1="5.6" y1="18.4" x2="18.4" y2="5.6" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
    </svg>
  );
}

function ReverseIcon() {
  return (
    <svg className="card__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M8.5 4.5v5M8.5 4.5 4 9M8.5 4.5C13.5 4.5 20 6 20 12"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15.5 19.5v-5M15.5 19.5 20 15M15.5 19.5C10.5 19.5 4 18 4 12"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function faceLabel(value: Value): string {
  if (value === "draw2") return "+2";
  if (value === "wild4") return "+4";
  if (value === "wild") return "";
  return String(value);
}

function describe(card: CardT): string {
  const names: Partial<Record<string, string>> = {
    skip: "skip",
    reverse: "reverse",
    draw2: "draw two",
    wild: "wild",
    wild4: "wild draw four",
  };
  const value = names[String(card.value)] ?? String(card.value);
  return card.color === "wild" ? value : `${card.color} ${value}`;
}

function Symbol({ value }: { value: Value }) {
  if (value === "skip") return <SkipIcon />;
  if (value === "reverse") return <ReverseIcon />;
  return <>{faceLabel(value)}</>;
}

interface Props {
  card: CardT;
  playable?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export default function Card({ card, playable, onClick, style }: Props) {
  const isWild = card.color === "wild";
  const label = faceLabel(card.value);
  const usesIcon = ICON_VALUES.has(card.value);
  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      className={`card${card.value === "wild4" ? " card--wild4" : ""}`}
      style={style}
      {...(onClick ? { type: "button" as const, onClick, disabled: !playable, "aria-label": describe(card) } : {})}
    >
      <div className={`card__face face-${card.color}`}>
        <span className={`card__corner card__corner--tl${usesIcon ? " card__corner--icon" : ""}`}>
          <Symbol value={card.value} />
        </span>

        {card.value === "wild" ? (
          <div className="wild-wheel" />
        ) : (
          <>
            <div className="card__oval" />
            <span className={`card__value${isWild ? "" : ` value-${card.color}`}`}>
              {usesIcon ? <Symbol value={card.value} /> : label}
            </span>
          </>
        )}

        <span className={`card__corner card__corner--br${usesIcon ? " card__corner--icon" : ""}`}>
          <Symbol value={card.value} />
        </span>
      </div>
    </Tag>
  );
}

export function CardBack({ style }: { style?: React.CSSProperties }) {
  return (
    <div className="card card--back" style={style} aria-hidden="true">
      <div className="card__face">
        <div className="card__oval" />
        <span className="card__value">UNO</span>
      </div>
    </div>
  );
}
