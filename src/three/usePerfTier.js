import { useMemo } from "react";

/**
 * Coarse device capability tier for scaling 3D cost.
 * Returns { tier: "low"|"high", dpr, textureSize }.
 */
export function usePerfTier() {
  return useMemo(() => {
    if (typeof navigator === "undefined") {
      return { tier: "high", dpr: [1, 2], textureSize: 2048 };
    }
    const cores = navigator.hardwareConcurrency ?? 4;
    const mem = navigator.deviceMemory ?? 4;
    const coarse =
      typeof window !== "undefined" &&
      window.matchMedia?.("(pointer: coarse)").matches;
    const low = cores <= 4 || mem <= 4 || coarse;
    return low
      ? { tier: "low", dpr: [1, 1.5], textureSize: 1024 }
      : { tier: "high", dpr: [1, 2], textureSize: 2048 };
  }, []);
}
