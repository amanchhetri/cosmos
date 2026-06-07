import { AnimatePresence } from "framer-motion";
import { useISS } from "./features/iss/useISS";
import { useCrew } from "./features/iss/useCrew";
import { useSpaceWeather } from "./features/space-weather/useSpaceWeather";
import { useDonki } from "./features/space-weather/useDonki";
import { auroraLevel } from "./features/space-weather/spaceWeatherApi";
import { Scene } from "./three/Scene";
import { useCameraControl } from "./three/useCameraControl";
import { ResumeFollowButton } from "./three/ResumeFollowButton";
import { TelemetryPanel } from "./features/iss/TelemetryPanel";
import { CrewPanel } from "./features/iss/CrewPanel";
import { StatusBadge } from "./features/iss/StatusBadge";
import { SpaceWeatherPanel } from "./features/space-weather/SpaceWeatherPanel";
import { RevealSection } from "./components/RevealSection";
import { useLenis } from "./lib/scroll/useLenis";

export default function App() {
  useLenis();
  const { data: iss, loading, isStale } = useISS();
  const { data: crew } = useCrew();
  const { data: weather } = useSpaceWeather();
  const { data: events } = useDonki();
  const { mode, beginInteraction, endInteraction, resume } = useCameraControl();

  const kp = weather?.kp ?? null;
  const auroraIntensity = auroraLevel(kp).intensity;

  return (
    <main className="min-h-screen bg-space-0 text-gray-200">
      <header className="flex items-center justify-between px-6 py-5">
        <h1 className="font-mono text-lg tracking-widest text-instrument">
          MISSION CONTROL
        </h1>
        <StatusBadge loading={loading} isStale={isStale} />
      </header>

      <section className="relative h-[60vh] w-full">
        <Scene
          iss={iss}
          mode={mode}
          auroraIntensity={auroraIntensity}
          onBeginInteraction={beginInteraction}
          onEndInteraction={endInteraction}
        />
        <div className="pointer-events-none absolute right-4 top-4">
          <AnimatePresence>
            {mode === "manual" && <ResumeFollowButton onClick={resume} />}
          </AnimatePresence>
        </div>
        {loading && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="animate-pulse font-mono text-sm text-gray-500">
              Acquiring ISS signal…
            </div>
          </div>
        )}
      </section>

      <section className="mx-auto max-w-5xl space-y-4 px-6 py-8">
        <TelemetryPanel iss={iss} />
        <CrewPanel crew={crew} />
      </section>

      <RevealSection className="mx-auto max-w-5xl px-6 py-8">
        <SpaceWeatherPanel
          kp={kp}
          speed={weather?.speed ?? null}
          density={weather?.density ?? null}
          events={events}
        />
      </RevealSection>
    </main>
  );
}
