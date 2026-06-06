import { renderHook, waitFor } from "@testing-library/react";
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
});
