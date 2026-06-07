import { auroraLevel } from "./spaceWeatherApi";

const DOT = {
  Quiet: "bg-emerald-400",
  Active: "bg-sky-400",
  Storm: "bg-amber-400",
  "Severe Storm": "bg-red-400",
};

export function AuroraStatus({ kp }) {
  const { label } = auroraLevel(kp);
  return (
    <div className="flex items-center gap-2 rounded-xl bg-space-1 px-4 py-3 ring-1 ring-white/5">
      <span className={`h-2 w-2 rounded-full ${DOT[label]} motion-safe:animate-pulse`} />
      <span className="text-xs uppercase tracking-widest text-gray-400">
        Aurora
      </span>
      <span className="ml-auto text-sm text-instrument">{label}</span>
    </div>
  );
}
