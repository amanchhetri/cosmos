import { useResource } from "../../lib/data/useResource";
import { fetchISS } from "./issApi";

export function useISS() {
  return useResource(fetchISS, { intervalMs: 5000 });
}
