const KP_URL =
  "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json";
const WIND_URL =
  "https://services.swpc.noaa.gov/products/solar-wind/plasma-1-day.json";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// The solar-wind products are array-of-arrays with a header row at index 0.
function latestRow(rows) {
  if (!Array.isArray(rows) || rows.length < 2) return null;
  return rows[rows.length - 1];
}

// The planetary-K product is different: an array of OBJECTS (no header row),
// with Kp as a number. Read the latest entry's `Kp` field directly.
export function parseKp(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return num(rows[rows.length - 1]?.Kp);
}

export function parseSolarWind(rows) {
  const row = latestRow(rows);
  if (!row) return { speed: null, density: null };
  return { density: num(row[1]), speed: num(row[2]) };
}

export function auroraLevel(kp) {
  if (kp == null || kp < 3) return { label: "Quiet", intensity: 0.15 };
  if (kp < 5) return { label: "Active", intensity: 0.4 };
  if (kp < 7) return { label: "Storm", intensity: 0.7 };
  return { label: "Severe Storm", intensity: 1 };
}

async function getJson(url, signal) {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`SWPC fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchSpaceWeather(signal) {
  const [kpRaw, windRaw] = await Promise.all([
    getJson(KP_URL, signal),
    getJson(WIND_URL, signal),
  ]);
  const { speed, density } = parseSolarWind(windRaw);
  return { kp: parseKp(kpRaw), speed, density };
}
