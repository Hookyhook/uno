"use client";

import { useEffect, useRef } from "react";
import { COLORS, type Color } from "@/lib/cards";

/**
 * The click that opens this dialog can land on the backdrop once it mounts, and a tap
 * on touch devices fires a ghost click a moment later. Both would dismiss it instantly,
 * so backdrop dismissal is ignored until the dialog has been open briefly.
 */
const DISMISS_GUARD_MS = 300;

export default function ColorPicker({ onPick, onCancel }: { onPick: (color: Color) => void; onCancel: () => void }) {
  const openedAt = useRef(Date.now());

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  const dismiss = () => {
    if (Date.now() - openedAt.current >= DISMISS_GUARD_MS) onCancel();
  };

  return (
    <div className="modal" onClick={dismiss} role="dialog" aria-modal="true" aria-label="Choose a color">
      <div className="picker" onClick={(event) => event.stopPropagation()}>
        <h3>Choose a color</h3>
        <p>The next player must match it.</p>
        <div className="swatches">
          {COLORS.map((color, i) => (
            <button
              key={color}
              className={`swatch swatch-${color}`}
              style={{ ["--delay" as string]: `${i * 45}ms` }}
              onClick={() => onPick(color)}
              aria-label={color}
              autoFocus={i === 0}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
