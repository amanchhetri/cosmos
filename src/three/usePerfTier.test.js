import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePerfTier } from "./usePerfTier.js";

describe("usePerfTier", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns a valid tier with a dpr pair", () => {
    const { result } = renderHook(() => usePerfTier());
    expect(["low", "high"]).toContain(result.current.tier);
    expect(Array.isArray(result.current.dpr)).toBe(true);
    expect(result.current.dpr).toHaveLength(2);
    expect(typeof result.current.textureSize).toBe("number");
  });

  it("returns low tier when hardware concurrency is low", () => {
    vi.stubGlobal("navigator", { hardwareConcurrency: 2, deviceMemory: 8 });
    vi.stubGlobal("window", {
      matchMedia: () => ({ matches: false }),
    });

    const { result } = renderHook(() => usePerfTier());
    expect(result.current.tier).toBe("low");
    expect(result.current.dpr).toEqual([1, 1.5]);
    expect(result.current.textureSize).toBe(1024);
  });

  it("returns low tier when pointer is coarse", () => {
    vi.stubGlobal("navigator", { hardwareConcurrency: 16, deviceMemory: 16 });
    vi.stubGlobal("window", {
      matchMedia: () => ({ matches: true }),
    });

    const { result } = renderHook(() => usePerfTier());
    expect(result.current.tier).toBe("low");
  });

  it("returns high tier on capable hardware with a fine pointer", () => {
    vi.stubGlobal("navigator", { hardwareConcurrency: 16, deviceMemory: 16 });
    vi.stubGlobal("window", {
      matchMedia: () => ({ matches: false }),
    });

    const { result } = renderHook(() => usePerfTier());
    expect(result.current.tier).toBe("high");
    expect(result.current.dpr).toEqual([1, 2]);
    expect(result.current.textureSize).toBe(2048);
  });
});
