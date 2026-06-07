const SUMMARY_MAX = 140;

// Pull the first meaningful line out of DONKI's free-text body. Skips a leading
// "Summary:" label line when present.
function summarize(body) {
  if (!body) return "";
  const lines = String(body)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !/^summary:?$/i.test(l));
  const first = lines[0] ?? "";
  return first.length > SUMMARY_MAX ? `${first.slice(0, SUMMARY_MAX)}…` : first;
}

export function normalizeDonki(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e) => e?.messageType && e.messageType !== "Report")
    .map((e) => ({
      id: e.messageID,
      type: e.messageType,
      issueTime: e.messageIssueTime,
      url: e.messageURL,
      summary: summarize(e.messageBody),
    }));
}

export async function fetchDonkiEvents(signal) {
  try {
    const res = await fetch("/api/donki", { signal });
    if (!res.ok) throw new Error(`donki fetch failed: ${res.status}`);
    return normalizeDonki(await res.json());
  } catch (err) {
    if (err?.name === "AbortError") throw err;
    return [];
  }
}
