import { CountUp } from "../iss/CountUp";

function Cell({ label, value, decimals, suffix }) {
  return (
    <div className="rounded-xl bg-space-1 p-4 ring-1 ring-white/5">
      <div className="text-xs uppercase tracking-widest text-gray-400">{label}</div>
      <div className="mt-1 text-2xl text-instrument">
        {value == null ? (
          <span className="font-mono">—</span>
        ) : (
          <CountUp value={value} decimals={decimals} suffix={suffix} />
        )}
      </div>
    </div>
  );
}

export function SolarWindReadout({ speed, density }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Cell label="Solar Wind Speed" value={speed} decimals={0} suffix=" km/s" />
      <Cell label="Proton Density" value={density} decimals={1} suffix=" p/cm³" />
    </div>
  );
}
