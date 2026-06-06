import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePerfTier } from "./usePerfTier.js";

describe("usePerfTier", () => {
  it("returns a valid tier with a dpr pair", () => {
    const { result } = renderHook(() => usePerfTier());
    expect(["low", "high"]).toContain(result.current.tier);
    expect(Array.isArray(result.current.dpr)).toBe(true);
    expect(result.current.dpr).toHaveLength(2);
    expect(typeof result.current.textureSize).toBe("number");
  });
});
