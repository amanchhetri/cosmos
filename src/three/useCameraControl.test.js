import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useCameraControl } from "./useCameraControl";

describe("useCameraControl", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("starts in auto mode", () => {
    const { result } = renderHook(() => useCameraControl({ idleMs: 1000 }));
    expect(result.current.mode).toBe("auto");
  });

  it("beginInteraction switches to manual", () => {
    const { result } = renderHook(() => useCameraControl({ idleMs: 1000 }));
    act(() => result.current.beginInteraction());
    expect(result.current.mode).toBe("manual");
  });

  it("auto-resumes idleMs after endInteraction", () => {
    const { result } = renderHook(() => useCameraControl({ idleMs: 1000 }));
    act(() => result.current.beginInteraction());
    act(() => result.current.endInteraction());
    expect(result.current.mode).toBe("manual");
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.mode).toBe("auto");
  });

  it("stays manual while a gesture is active (no endInteraction yet)", () => {
    const { result } = renderHook(() => useCameraControl({ idleMs: 1000 }));
    act(() => result.current.beginInteraction());
    act(() => vi.advanceTimersByTime(5000));
    expect(result.current.mode).toBe("manual");
  });

  it("a new beginInteraction cancels a pending resume timer", () => {
    const { result } = renderHook(() => useCameraControl({ idleMs: 1000 }));
    act(() => result.current.beginInteraction());
    act(() => result.current.endInteraction());
    act(() => vi.advanceTimersByTime(500));
    act(() => result.current.beginInteraction()); // new gesture
    act(() => vi.advanceTimersByTime(800)); // would have fired at 1000 from first end
    expect(result.current.mode).toBe("manual");
  });

  it("a second endInteraction restarts the countdown from the later release", () => {
    const { result } = renderHook(() => useCameraControl({ idleMs: 1000 }));
    act(() => result.current.beginInteraction());
    act(() => result.current.endInteraction());
    act(() => vi.advanceTimersByTime(600));
    act(() => result.current.endInteraction()); // second release supersedes the first
    act(() => vi.advanceTimersByTime(600)); // 1200ms since first release, 600ms since second
    expect(result.current.mode).toBe("manual"); // first timer was cleared
    act(() => vi.advanceTimersByTime(400)); // 1000ms since second release
    expect(result.current.mode).toBe("auto");
  });

  it("resume() returns to auto and clears the timer", () => {
    const { result } = renderHook(() => useCameraControl({ idleMs: 1000 }));
    act(() => result.current.beginInteraction());
    act(() => result.current.endInteraction());
    act(() => result.current.resume());
    expect(result.current.mode).toBe("auto");
    act(() => vi.advanceTimersByTime(2000)); // no late fire
    expect(result.current.mode).toBe("auto");
  });

  it("does not fire after unmount", () => {
    const { result, unmount } = renderHook(() =>
      useCameraControl({ idleMs: 1000 })
    );
    act(() => result.current.beginInteraction());
    act(() => result.current.endInteraction());
    unmount();
    // Advancing timers after unmount must not throw / update state.
    expect(() => vi.advanceTimersByTime(2000)).not.toThrow();
  });
});
