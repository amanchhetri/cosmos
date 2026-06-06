import { describe, it, expect, vi, afterEach } from "vitest";
import { parseISS, fetchISS } from "./issApi";

const RAW = {
  latitude: 12.34,
  longitude: -56.78,
  altitude: 421.5,
  velocity: 27600,
  visibility: "daylight",
  timestamp: 1700000000,
};

describe("parseISS", () => {
  it("maps raw fields to a clean shape", () => {
    expect(parseISS(RAW)).toEqual({
      latitude: 12.34,
      longitude: -56.78,
      altitude: 421.5,
      velocity: 27600,
      visibility: "daylight",
      timestamp: 1700000000,
    });
  });
});

describe("fetchISS", () => {
  afterEach(() => vi.restoreAllMocks());

  it("throws on a non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false, status: 503 });
    await expect(fetchISS(new AbortController().signal)).rejects.toThrow("503");
  });

  it("returns parsed data on success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => RAW,
    });
    const result = await fetchISS(new AbortController().signal);
    expect(result.latitude).toBe(12.34);
  });
});
