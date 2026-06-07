import { useResource } from "../../lib/data/useResource";
import { fetchDonkiEvents } from "./donkiApi";

// DONKI notifications are infrequent; poll every 15 min. Empty-list fallback so
// the feed renders a quiet state instead of null.
export function useDonki() {
  return useResource(fetchDonkiEvents, { intervalMs: 900_000, fallback: [] });
}
