// Static fallback so the UI never shows an empty crew. Refresh occasionally.
export const FALLBACK_CREW = ["Crew data unavailable"];

export function parseCrew(raw) {
  return (raw?.people ?? [])
    .filter((p) => p.craft === "ISS")
    .map((p) => p.name);
}

export async function fetchCrew(signal) {
  try {
    const res = await fetch("/api/astros", { signal });
    if (!res.ok) throw new Error(`crew fetch failed: ${res.status}`);
    const names = parseCrew(await res.json());
    return names.length ? names : FALLBACK_CREW;
  } catch (err) {
    if (err?.name === "AbortError") throw err;
    return FALLBACK_CREW;
  }
}
