import { auroraLevel } from "./spaceWeatherApi";

const COLOR = {
  Quiet: "#3bf0a0",
  Active: "#7dd3fc",
  Storm: "#fbbf24",
  "Severe Storm": "#f87171",
};

export function KpGauge({ kp }) {
  const { label } = auroraLevel(kp);
  const pct = kp == null ? 0 : Math.min(kp, 9) / 9;
  const color = COLOR[label];
  // Half-circle arc: stroke dashoffset = remaining fraction of the semicircle.
  const C = Math.PI * 40;
  return (
    <div className="rounded-xl bg-space-1 p-4 ring-1 ring-white/5">
      <div className="text-xs uppercase tracking-widest text-gray-400">
        Planetary Kp
      </div>
      <div className="mt-2 flex items-end gap-3">
        <svg viewBox="0 0 100 56" className="h-14 w-24">
          <path
            d="M5 50 A45 45 0 0 1 95 50"
            fill="none"
            stroke="#ffffff14"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <path
            d="M5 50 A45 45 0 0 1 95 50"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - pct)}
            className="transition-[stroke-dashoffset] duration-700"
          />
        </svg>
        <div>
          <div className="text-2xl text-instrument tabular-nums">
            {kp == null ? "—" : kp.toFixed(2)}
          </div>
          <div className="text-xs" style={{ color }}>
            {label}
          </div>
        </div>
      </div>
    </div>
  );
}
