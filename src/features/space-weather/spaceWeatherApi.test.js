import { describe, it, expect, vi, afterEach } from "vitest";
import {
  parseKp,
  parseSolarWind,
  auroraLevel,
  fetchSpaceWeather,
} from "./spaceWeatherApi";

// NOAA's planetary-K product is an array of OBJECTS (verified live 2026-06-08),
// with Kp as a number — NOT the header-row array-of-arrays the solar-wind
// products use.
const KP_RAW = [
  { time_tag: "2026-06-08T00:00:00", Kp: 2.33, a_running: 9, station_count: 8 },
  { time_tag: "2026-06-08T03:00:00", Kp: 5.67, a_running: 48, station_count: 8 },
];
const WIND_RAW = [
  ["time_tag", "density", "speed", "temperature"],
  ["2026-06-08T11:58:00", "4.21", "512.4", "120000"],
  ["2026-06-08T11:59:00", "3.90", "548.9", "121000"],
];

describe("parseKp", () => {
  it("returns the latest entry's Kp as a number", () => {
    expect(parseKp(KP_RAW)).toBe(5.67);
  });
  it("returns null for empty, null, or Kp-less rows", () => {
    expect(parseKp([])).toBeNull();
    expect(parseKp(null)).toBeNull();
    expect(parseKp([{ time_tag: "2026-06-08T00:00:00" }])).toBeNull();
  });
});

describe("parseSolarWind", () => {
  it("returns latest speed and density as numbers", () => {
    expect(parseSolarWind(WIND_RAW)).toEqual({ speed: 548.9, density: 3.9 });
  });
  it("returns nulls for malformed data", () => {
    expect(parseSolarWind([])).toEqual({ speed: null, density: null });
  });
});

describe("auroraLevel", () => {
  it("maps Kp to label + intensity at each threshold", () => {
    expect(auroraLevel(0)).toEqual({ label: "Quiet", intensity: 0.15 });
    expect(auroraLevel(2.9)).toEqual({ label: "Quiet", intensity: 0.15 });
    expect(auroraLevel(3)).toEqual({ label: "Active", intensity: 0.4 });
    expect(auroraLevel(4.9)).toEqual({ label: "Active", intensity: 0.4 });
    expect(auroraLevel(5)).toEqual({ label: "Storm", intensity: 0.7 });
    expect(auroraLevel(6.9)).toEqual({ label: "Storm", intensity: 0.7 });
    expect(auroraLevel(7)).toEqual({ label: "Severe Storm", intensity: 1 });
    expect(auroraLevel(9)).toEqual({ label: "Severe Storm", intensity: 1 });
  });
  it("falls back to Quiet when Kp is null", () => {
    expect(auroraLevel(null)).toEqual({ label: "Quiet", intensity: 0.15 });
  });
});

describe("fetchSpaceWeather", () => {
  afterEach(() => vi.restoreAllMocks());
  it("combines Kp and solar wind", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((url) =>
      Promise.resolve({
        ok: true,
        json: async () => (String(url).includes("k-index") ? KP_RAW : WIND_RAW),
      })
    );
    const r = await fetchSpaceWeather(new AbortController().signal);
    expect(r).toEqual({ kp: 5.67, speed: 548.9, density: 3.9 });
  });
});
