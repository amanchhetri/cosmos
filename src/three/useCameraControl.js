import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Owns the camera interaction mode and the idle auto-resume timer.
 *
 * - `mode` is "auto" (AutoFollow drives the camera) or "manual" (user drives it
 *   via OrbitControls).
 * - `beginInteraction()` is called on the user's grab (OrbitControls onStart):
 *   switch to manual and cancel any pending resume so a long drag never resumes
 *   mid-gesture.
 * - `endInteraction()` is called on release (OrbitControls onEnd): start the
 *   idle countdown; when it elapses, resume auto.
 * - `resume()` (the pill) returns to auto immediately.
 *
 * @param {{ idleMs?: number }} opts
 */
export function useCameraControl({ idleMs = 8000 } = {}) {
  const [mode, setMode] = useState("auto");
  const timer = useRef(null);

  const clearTimer = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const beginInteraction = useCallback(() => {
    clearTimer();
    setMode("manual");
  }, [clearTimer]);

  const endInteraction = useCallback(() => {
    clearTimer();
    timer.current = setTimeout(() => {
      timer.current = null;
      setMode("auto");
    }, idleMs);
  }, [clearTimer, idleMs]);

  const resume = useCallback(() => {
    clearTimer();
    setMode("auto");
  }, [clearTimer]);

  useEffect(() => clearTimer, [clearTimer]); // clear pending timer on unmount

  return { mode, beginInteraction, endInteraction, resume };
}
