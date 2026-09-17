const RADIUS = 12;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const URGENT_SECONDS = 10;

export default function TurnTimer({ secondsLeft, total }: { secondsLeft: number; total: number }) {
  const fraction = Math.max(0, Math.min(1, secondsLeft / total));
  const urgent = secondsLeft <= URGENT_SECONDS;

  return (
    <span className={`timer${urgent ? " urgent" : ""}`} aria-label={`${secondsLeft} seconds left`}>
      <svg width="30" height="30" viewBox="0 0 30 30">
        <circle className="timer__track" cx="15" cy="15" r={RADIUS} fill="none" strokeWidth="3" />
        <circle
          className="timer__fill"
          cx="15"
          cy="15"
          r={RADIUS}
          fill="none"
          strokeWidth="3"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
        />
      </svg>
      <span className="timer__text">{secondsLeft}</span>
    </span>
  );
}
