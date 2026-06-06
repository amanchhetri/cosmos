import { useResource } from "../../lib/data/useResource";
import { fetchCrew, FALLBACK_CREW } from "./crewApi";

export function useCrew() {
  return useResource(fetchCrew, { intervalMs: 60000, fallback: FALLBACK_CREW });
}
