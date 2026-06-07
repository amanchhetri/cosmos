import { describe, it, expect, vi, afterEach } from "vitest";
import { normalizeDonki, fetchDonkiEvents } from "./donkiApi";

const RAW = [
  {
    messageType: "FLR",
    messageID: "20260608-AL-001",
    messageURL: "https://example.com/1",
    messageIssueTime: "2026-06-08T10:00Z",
    messageBody: "Summary:\nM-class solar flare observed.\nMore detail follows.",
  },
  {
    messageType: "Report",
    messageID: "20260608-AL-002",
    messageURL: "https://example.com/2",
    messageIssueTime: "2026-06-08T09:00Z",
    messageBody: "Weekly summary.",
  },
];

describe("normalizeDonki", () => {
  it("drops Report items and extracts a summary line", () => {
    const out = normalizeDonki(RAW);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({
      id: "20260608-AL-001",
      type: "FLR",
      issueTime: "2026-06-08T10:00Z",
      url: "https://example.com/1",
      summary: "M-class solar flare observed.",
    });
  });
  it("handles null/empty input", () => {
    expect(normalizeDonki(null)).toEqual([]);
    expect(normalizeDonki([])).toEqual([]);
  });
});

describe("fetchDonkiEvents", () => {
  afterEach(() => vi.restoreAllMocks());
  it("returns normalized events on success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => RAW,
    });
    const out = await fetchDonkiEvents(new AbortController().signal);
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe("FLR");
  });
  it("degrades to [] on a failed response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false, status: 502 });
    expect(await fetchDonkiEvents(new AbortController().signal)).toEqual([]);
  });
  it("re-throws AbortError", async () => {
    const err = Object.assign(new Error("aborted"), { name: "AbortError" });
    vi.spyOn(globalThis, "fetch").mockRejectedValue(err);
    await expect(
      fetchDonkiEvents(new AbortController().signal)
    ).rejects.toThrow("aborted");
  });
});
