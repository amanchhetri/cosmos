import { KpGauge } from "./KpGauge";
import { SolarWindReadout } from "./SolarWindReadout";
import { AuroraStatus } from "./AuroraStatus";
import { DonkiFeed } from "./DonkiFeed";

export function SpaceWeatherPanel({ kp, speed, density, events }) {
  return (
    <div className="space-y-4">
      <h2 className="font-mono text-sm uppercase tracking-widest text-instrument">
        Space Weather
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <KpGauge kp={kp} />
        <AuroraStatus kp={kp} />
        <SolarWindReadout speed={speed} density={density} />
      </div>
      <DonkiFeed events={events} />
    </div>
  );
}
