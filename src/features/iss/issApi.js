const ISS_URL = "https://api.wheretheiss.at/v1/satellites/25544";

export function parseISS(raw) {
  return {
    latitude: raw.latitude,
    longitude: raw.longitude,
    altitude: raw.altitude, // km
    velocity: raw.velocity, // km/h
    visibility: raw.visibility,
    timestamp: raw.timestamp,
  };
}

export async function fetchISS(signal) {
  const res = await fetch(ISS_URL, { signal });
  if (!res.ok) throw new Error(`ISS fetch failed: ${res.status}`);
  return parseISS(await res.json());
}
