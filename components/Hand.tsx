"use client";

import { useEffect, useRef, useState } from "react";
import type { Card as CardT } from "@/lib/cards";
import Card from "./Card";

const COLOR_ORDER = { red: 0, yellow: 1, green: 2, blue: 3, wild: 4 } as const;
const VALUE_ORDER: Record<string, number> = { skip: 10, reverse: 11, draw2: 12, wild: 13, wild4: 14 };

const MAX_TILT_DEG = 2.4;
const MAX_ARC_PX = 10;
/** Cards may cover at most this much of each other before the hand scales down instead. */
const MAX_OVERLAP_RATIO = 0.62;
/** Breathing room so tilted cards and their shadows do not touch the screen edges. */
const HAND_GUTTER_PX = 14;

interface Metrics {
  width: number;
  cardWidth: number;
}

function sortHand(cards: CardT[]): CardT[] {
  const rank = (card: CardT) => VALUE_ORDER[String(card.value)] ?? Number(card.value);
  return [...cards].sort((a, b) => COLOR_ORDER[a.color] - COLOR_ORDER[b.color] || rank(a) - rank(b));
}

function layoutFor(count: number, { width, cardWidth }: Metrics): { overlap: number; scale: number } {
  if (count < 2 || !width || !cardWidth) return { overlap: 0, scale: 1 };
  const available = Math.max(cardWidth, width - HAND_GUTTER_PX);
  const needed = (count * cardWidth - available) / (count - 1);
  const overlap = Math.max(0, Math.min(needed, cardWidth * MAX_OVERLAP_RATIO));
  const required = count * cardWidth - (count - 1) * overlap;
  return { overlap, scale: required > available ? available / required : 1 };
}

/** Reads the live card width so the layout follows the CSS breakpoints. */
function useHandMetrics() {
  const ref = useRef<HTMLElement>(null);
  const [metrics, setMetrics] = useState<Metrics>({ width: 0, cardWidth: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      const cardWidth = parseFloat(getComputedStyle(element).getPropertyValue("--card-w"));
      setMetrics({ width: element.clientWidth, cardWidth: Number.isFinite(cardWidth) ? cardWidth : 0 });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, metrics };
}

export default function Hand({
  cards,
  isPlayable,
  onPlay,
}: {
  cards: CardT[];
  isPlayable: (card: CardT) => boolean;
  onPlay: (card: CardT) => void;
}) {
  const { ref, metrics } = useHandMetrics();
  const sorted = sortHand(cards);
  const count = sorted.length;
  const { overlap, scale } = layoutFor(count, metrics);
  const mid = (count - 1) / 2;

  return (
    <section className="hand" ref={ref} aria-label={`Your hand, ${count} cards`}>
      <div className="hand__inner" style={{ transform: `scale(${scale.toFixed(3)})` }}>
        {sorted.map((card, i) => {
          const offset = mid === 0 ? 0 : (i - mid) / mid;
          const playable = isPlayable(card);
          return (
            <div
              key={card.id}
              className={`hand__slot ${playable ? "playable" : "idle"}`}
              style={{
                marginLeft: i === 0 ? 0 : `-${overlap.toFixed(1)}px`,
                zIndex: i,
                transform: `rotate(${(offset * MAX_TILT_DEG).toFixed(2)}deg) translateY(${(Math.abs(offset) * MAX_ARC_PX).toFixed(1)}px)`,
              }}
            >
              <div className="hand__deal" style={{ ["--delay" as string]: `${Math.min(i * 40, 400)}ms` }}>
                <Card card={card} playable={playable} onClick={() => onPlay(card)} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
