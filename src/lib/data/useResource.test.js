import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useResource } from "./useResource";

describe("useResource", () => {
  it("returns data on success", async () => {
    const fetcher = vi.fn().mockResolvedValue({ value: 42 });
    const { result } = renderHook(() => useResource(fetcher));
    await waitFor(() => expect(result.current.data).toEqual({ value: 42 }));
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("shows fallback before the first load resolves", () => {
    const fetcher = vi.fn(() => new Promise(() => {}));
    const { result } = renderHook(() =>
      useResource(fetcher, { fallback: { value: 0 } })
    );
    expect(result.current.data).toEqual({ value: 0 });
    expect(result.current.loading).toBe(true);
  });

  it("keeps last-good data and flags stale on error", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ value: 1 })
      .mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() =>
      useResource(fetcher, { intervalMs: 20 })
    );
    await waitFor(() => expect(result.current.data).toEqual({ value: 1 }));
    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.data).toEqual({ value: 1 });
    expect(result.current.isStale).toBe(true);
  });

  it("never calls the fetcher when disabled", async () => {
    const fetcher = vi.fn().mockResolvedValue({ value: 99 });
    const { result } = renderHook(() =>
      useResource(fetcher, { enabled: false })
    );
    // let any pending microtasks/effects settle
    await act(async () => {});
    expect(fetcher).toHaveBeenCalledTimes(0);
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
  });

  it("stops polling after unmount", async () => {
    vi.useFakeTimers();
    try {
      const fetcher = vi.fn().mockResolvedValue({ value: 1 });
      const { unmount } = renderHook(() =>
        useResource(fetcher, { intervalMs: 20 })
      );
      // run the initial load
      await vi.advanceTimersByTimeAsync(0);
      // advance through a couple of poll intervals
      await vi.advanceTimersByTimeAsync(60);
      const callsAtUnmount = fetcher.mock.calls.length;
      unmount();
      await vi.advanceTimersByTimeAsync(200);
      expect(fetcher.mock.calls.length).toBe(callsAtUnmount);
    } finally {
      vi.useRealTimers();
    }
  });

  it("clears error and stale flag after recovery", async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValue({ value: 7 });
    const { result } = renderHook(() =>
      useResource(fetcher, { intervalMs: 20 })
    );
    // first poll rejects, a subsequent poll resolves and clears the error
    await waitFor(() => expect(result.current.data).toEqual({ value: 7 }));
    expect(fetcher.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(result.current.error).toBeNull();
    expect(result.current.isStale).toBe(false);
  });
});
