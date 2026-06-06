import { describe, it, expect, vi, afterEach } from "vitest";
import { parseCrew, fetchCrew, FALLBACK_CREW } from "./crewApi";

describe("parseCrew", () => {
  it("keeps only ISS crew names", () => {
    const raw = {
      people: [
        { name: "Alice", craft: "ISS" },
        { name: "Bob", craft: "Tiangong" },
        { name: "Carol", craft: "ISS" },
      ],
    };
    expect(parseCrew(raw)).toEqual(["Alice", "Carol"]);
  });

  it("returns an empty array when people is missing", () => {
    expect(parseCrew({})).toEqual([]);
  });

  it("is null-safe", () => {
    expect(parseCrew(null)).toEqual([]);
    expect(parseCrew(undefined)).toEqual([]);
  });
});

describe("fetchCrew", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns the static fallback on a non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false, status: 502 });
    const result = await fetchCrew(new AbortController().signal);
    expect(result).toEqual(FALLBACK_CREW);
  });

  it("returns parsed ISS crew names on success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ people: [{ name: "Zoe", craft: "ISS" }] }),
    });
    const result = await fetchCrew(new AbortController().signal);
    expect(result).toEqual(["Zoe"]);
  });

  it("returns the static fallback when crew is empty", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ people: [] }),
    });
    const result = await fetchCrew(new AbortController().signal);
    expect(result).toEqual(FALLBACK_CREW);
  });

  it("re-throws AbortError instead of returning the fallback", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      Object.assign(new Error("aborted"), { name: "AbortError" }),
    );
    await expect(fetchCrew(new AbortController().signal)).rejects.toThrow();
  });
});
