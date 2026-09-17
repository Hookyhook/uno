import { COLORS, type Color } from "@/lib/cards";

export default function ColorPicker({ onPick, onCancel }: { onPick: (c: Color) => void; onCancel: () => void }) {
  return (
    <div className="modal" onClick={onCancel}>
      <div className="color-picker" onClick={(e) => e.stopPropagation()}>
        <h3>Choose a color</h3>
        <div className="swatches">
          {COLORS.map((c) => (
            <button key={c} className={`swatch color-${c}`} onClick={() => onPick(c)} aria-label={c} />
          ))}
        </div>
      </div>
    </div>
  );
}
