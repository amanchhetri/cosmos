import { useResource } from "../../lib/data/useResource";
import { fetchSpaceWeather } from "./spaceWeatherApi";

// SWPC updates on a 1-minute cadence; poll every 60s.
export function useSpaceWeather() {
  return useResource(fetchSpaceWeather, { intervalMs: 60_000 });
}
