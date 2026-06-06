import { Vector3 } from "three";

export const EARTH_RADIUS = 1;
// ISS orbits ~420 km above Earth's ~6371 km radius.
const ISS_ALTITUDE = (EARTH_RADIUS * 420) / 6371;

/** Convert geographic coords to a point on a sphere of `radius`. */
export function latLonToVector3(latDeg, lonDeg, radius = EARTH_RADIUS) {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  return new Vector3(
    radius * Math.cos(lat) * Math.cos(lon),
    radius * Math.sin(lat),
    -radius * Math.cos(lat) * Math.sin(lon)
  );
}

/** Position of the ISS marker, slightly above the globe surface. */
export function issPosition(latDeg, lonDeg) {
  return latLonToVector3(latDeg, lonDeg, EARTH_RADIUS + ISS_ALTITUDE);
}
