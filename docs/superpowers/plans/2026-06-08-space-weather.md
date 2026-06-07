# Space Weather Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a live Space Weather section (NOAA SWPC Kp + solar wind, NASA DONKI events) to the Mission Control dashboard, with a Kp-driven aurora glow on the 3D globe, plus the shared infra (NASA proxy convention + Lenis scroll shell) reused by later phases.

**Architecture:** Follows the existing feature-module convention — `src/features/space-weather/` with pure API/parse modules, `useResource`-based polling hooks, and presentation components that never fetch. NOAA is called directly (keyless, CORS-friendly); NASA DONKI is proxied through a Vercel function (`api/donki.js`) so `NASA_API_KEY` stays server-side. Aurora likelihood is derived from Kp via a pure function that drives both the panel badge and the globe shader.

**Tech Stack:** React 19, Vite, Tailwind, Framer Motion, @react-three/fiber + drei, three.js, @studio-freight/lenis, vitest.

**Spec:** `docs/superpowers/specs/2026-06-08-space-weather-design.md`

---

## File Structure

Create:
- `.env.example` — documents `NASA_API_KEY`
- `.env.local` — real key (gitignored)
- `api/donki.js` — Vercel proxy for DONKI notifications
- `src/features/space-weather/spaceWeatherApi.js` — SWPC fetch/parse + `auroraLevel`
- `src/features/space-weather/spaceWeatherApi.test.js`
- `src/features/space-weather/donkiApi.js` — DONKI client fetch + normalize
- `src/features/space-weather/donkiApi.test.js`
- `src/features/space-weather/useSpaceWeather.js` — Kp + solar wind hook
- `src/features/space-weather/useDonki.js` — DONKI events hook
- `src/features/space-weather/KpGauge.jsx`
- `src/features/space-weather/SolarWindReadout.jsx`
- `src/features/space-weather/AuroraStatus.jsx`
- `src/features/space-weather/DonkiFeed.jsx`
- `src/features/space-weather/SpaceWeatherPanel.jsx`
- `src/three/AuroraGlow.jsx` — additive glow mesh, intensity-driven
- `src/lib/scroll/useLenis.js` — smooth-scroll setup (reduced-motion aware)
- `src/components/RevealSection.jsx` — scroll-reveal wrapper

Modify:
- `.gitignore` — widen `.env` → `.env*`
- `src/three/Scene.jsx` — render `<AuroraGlow intensity>` , accept `auroraIntensity` prop
- `src/App.jsx` — Lenis shell, lift Kp, render Space Weather section in `<RevealSection>`

---

## Task 1: Env scaffolding & gitignore

**Files:**
- Modify: `.gitignore:3`
- Create: `.env.example`, `.env.local`

- [ ] **Step 1: Widen the gitignore env pattern**

In `.gitignore`, replace the line `.env` with:

```
.env*
!.env.example
```

- [ ] **Step 2: Create `.env.example`**

```
# NASA API key — get a free one at https://api.nasa.gov
# Used server-side only (Vercel functions); never exposed to the client bundle.
NASA_API_KEY=DEMO_KEY
```

- [ ] **Step 3: Create `.env.local` with the real key**

```
NASA_API_KEY=mDGYsRvGUfyzmb4cKRohP06FBcjjETjHQx2sfbf9
```

- [ ] **Step 4: Verify `.env.local` is ignored**

Run: `git status --short`
Expected: `.env.local` does NOT appear; `.env.example` and `.gitignore` do.

- [ ] **Step 5: Commit**

```bash
git add .gitignore .env.example
git commit -m "chore: add NASA_API_KEY env scaffolding"
```

---

## Task 2: DONKI proxy (Vercel function)

**Files:**
- Create: `api/donki.js`

Serverless proxy, mirrors `api/astros.js`. Injects the key server-side, requests the last 30 days of notifications, edge-caches for 15 min. No unit test (serverless runtime); verified live on Vercel.

- [ ] **Step 1: Write the proxy**

```js
// Proxies NASA DONKI notifications so the API key stays server-side,
// with short edge caching. Requests the trailing 30 days of events.
export default async function handler(req, res) {
  const key = process.env.NASA_API_KEY || "DEMO_KEY";
  const end = new Date();
  const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  const fmt = (d) => d.toISOString().slice(0, 10); // YYYY-MM-DD
  const url =
    `https://api.nasa.gov/DONKI/notifications` +
    `?startDate=${fmt(start)}&endDate=${fmt(end)}&type=all&api_key=${key}`;
  try {
    const upstream = await fetch(url);
    if (!upstream.ok) throw new Error(String(upstream.status));
    const data = await upstream.json();
    res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=3600");
    res.status(200).json(data);
  } catch {
    res.status(502).json({ error: "upstream unavailable" });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add api/donki.js
git commit -m "feat: add DONKI notifications proxy function"
```

---

## Task 3: SWPC API + aurora derivation (TDD)

**Files:**
- Create: `src/features/space-weather/spaceWeatherApi.js`
- Test: `src/features/space-weather/spaceWeatherApi.test.js`

SWPC products are arrays-of-arrays with a header row at index 0. We strip the header, read the latest row, coerce numerics. `auroraLevel(kp)` is a pure threshold map driving both the badge and the globe glow.

- [ ] **Step 1: Write the failing tests**

```js
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  parseKp,
  parseSolarWind,
  auroraLevel,
  fetchSpaceWeather,
} from "./spaceWeatherApi";

const KP_RAW = [
  ["time_tag", "Kp", "a_running", "station_count"],
  ["2026-06-08T00:00:00", "2.33", "9", "8"],
  ["2026-06-08T03:00:00", "5.67", "48", "8"],
];
const WIND_RAW = [
  ["time_tag", "density", "speed", "temperature"],
  ["2026-06-08T11:58:00", "4.21", "512.4", "120000"],
  ["2026-06-08T11:59:00", "3.90", "548.9", "121000"],
];

describe("parseKp", () => {
  it("returns the latest Kp as a number, dropping the header", () => {
    expect(parseKp(KP_RAW)).toBe(5.67);
  });
  it("returns null for empty or header-only data", () => {
    expect(parseKp([["time_tag", "Kp"]])).toBeNull();
    expect(parseKp([])).toBeNull();
    expect(parseKp(null)).toBeNull();
  });
});

describe("parseSolarWind", () => {
  it("returns latest speed and density as numbers", () => {
    expect(parseSolarWind(WIND_RAW)).toEqual({ speed: 548.9, density: 3.9 });
  });
  it("returns nulls for malformed data", () => {
    expect(parseSolarWind([])).toEqual({ speed: null, density: null });
  });
});

describe("auroraLevel", () => {
  it("maps Kp to label + intensity at each threshold", () => {
    expect(auroraLevel(0)).toEqual({ label: "Quiet", intensity: 0.15 });
    expect(auroraLevel(2.9)).toEqual({ label: "Quiet", intensity: 0.15 });
    expect(auroraLevel(3)).toEqual({ label: "Active", intensity: 0.4 });
    expect(auroraLevel(4.9)).toEqual({ label: "Active", intensity: 0.4 });
    expect(auroraLevel(5)).toEqual({ label: "Storm", intensity: 0.7 });
    expect(auroraLevel(6.9)).toEqual({ label: "Storm", intensity: 0.7 });
    expect(auroraLevel(7)).toEqual({ label: "Severe Storm", intensity: 1 });
    expect(auroraLevel(9)).toEqual({ label: "Severe Storm", intensity: 1 });
  });
  it("falls back to Quiet when Kp is null", () => {
    expect(auroraLevel(null)).toEqual({ label: "Quiet", intensity: 0.15 });
  });
});

describe("fetchSpaceWeather", () => {
  afterEach(() => vi.restoreAllMocks());
  it("combines Kp and solar wind", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((url) =>
      Promise.resolve({
        ok: true,
        json: async () => (String(url).includes("k-index") ? KP_RAW : WIND_RAW),
      })
    );
    const r = await fetchSpaceWeather(new AbortController().signal);
    expect(r).toEqual({ kp: 5.67, speed: 548.9, density: 3.9 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/space-weather/spaceWeatherApi.test.js`
Expected: FAIL — module not found / exports undefined.

- [ ] **Step 3: Implement `spaceWeatherApi.js`**

```js
const KP_URL =
  "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json";
const WIND_URL =
  "https://services.swpc.noaa.gov/products/solar-wind/plasma-1-day.json";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// SWPC products are array-of-arrays with a header row at index 0.
function latestRow(rows) {
  if (!Array.isArray(rows) || rows.length < 2) return null;
  return rows[rows.length - 1];
}

export function parseKp(rows) {
  const row = latestRow(rows);
  return row ? num(row[1]) : null;
}

export function parseSolarWind(rows) {
  const row = latestRow(rows);
  if (!row) return { speed: null, density: null };
  return { density: num(row[1]), speed: num(row[2]) };
}

export function auroraLevel(kp) {
  if (kp == null || kp < 3) return { label: "Quiet", intensity: 0.15 };
  if (kp < 5) return { label: "Active", intensity: 0.4 };
  if (kp < 7) return { label: "Storm", intensity: 0.7 };
  return { label: "Severe Storm", intensity: 1 };
}

async function getJson(url, signal) {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`SWPC fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchSpaceWeather(signal) {
  const [kpRaw, windRaw] = await Promise.all([
    getJson(KP_URL, signal),
    getJson(WIND_URL, signal),
  ]);
  const { speed, density } = parseSolarWind(windRaw);
  return { kp: parseKp(kpRaw), speed, density };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/space-weather/spaceWeatherApi.test.js`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Commit**

```bash
git add src/features/space-weather/spaceWeatherApi.js src/features/space-weather/spaceWeatherApi.test.js
git commit -m "feat: SWPC Kp + solar wind parsing and aurora derivation"
```

---

## Task 4: DONKI client API (TDD)

**Files:**
- Create: `src/features/space-weather/donkiApi.js`
- Test: `src/features/space-weather/donkiApi.test.js`

Consumes the `/api/donki` proxy. Normalizes raw notifications, drops weekly `Report` summaries, and extracts a one-line summary from the free-text `messageBody`. Degrades to `[]` on failure (the panel shows an empty state), re-throwing only `AbortError` — same contract as `crewApi.js`.

- [ ] **Step 1: Write the failing tests**

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/space-weather/donkiApi.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `donkiApi.js`**

```js
const SUMMARY_MAX = 140;

// Pull the first meaningful line out of DONKI's free-text body. Skips a leading
// "Summary:" label line when present.
function summarize(body) {
  if (!body) return "";
  const lines = String(body)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !/^summary:?$/i.test(l));
  const first = lines[0] ?? "";
  return first.length > SUMMARY_MAX ? `${first.slice(0, SUMMARY_MAX)}…` : first;
}

export function normalizeDonki(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e) => e?.messageType && e.messageType !== "Report")
    .map((e) => ({
      id: e.messageID,
      type: e.messageType,
      issueTime: e.messageIssueTime,
      url: e.messageURL,
      summary: summarize(e.messageBody),
    }));
}

export async function fetchDonkiEvents(signal) {
  try {
    const res = await fetch("/api/donki", { signal });
    if (!res.ok) throw new Error(`donki fetch failed: ${res.status}`);
    return normalizeDonki(await res.json());
  } catch (err) {
    if (err?.name === "AbortError") throw err;
    return [];
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/space-weather/donkiApi.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/space-weather/donkiApi.js src/features/space-weather/donkiApi.test.js
git commit -m "feat: DONKI event client + normalization"
```

---

## Task 5: Data hooks

**Files:**
- Create: `src/features/space-weather/useSpaceWeather.js`
- Create: `src/features/space-weather/useDonki.js`

Thin wrappers over the existing `useResource` polling hook (no new tests — `useResource` is already covered; these only wire fetcher + interval).

- [ ] **Step 1: Implement `useSpaceWeather.js`**

```js
import { useResource } from "../../lib/data/useResource";
import { fetchSpaceWeather } from "./spaceWeatherApi";

// SWPC updates on a 1-minute cadence; poll every 60s.
export function useSpaceWeather() {
  return useResource(fetchSpaceWeather, { intervalMs: 60_000 });
}
```

- [ ] **Step 2: Implement `useDonki.js`**

```js
import { useResource } from "../../lib/data/useResource";
import { fetchDonkiEvents } from "./donkiApi";

// DONKI notifications are infrequent; poll every 15 min. Empty-list fallback so
// the feed renders a quiet state instead of null.
export function useDonki() {
  return useResource(fetchDonkiEvents, { intervalMs: 900_000, fallback: [] });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/features/space-weather/useSpaceWeather.js src/features/space-weather/useDonki.js
git commit -m "feat: space weather + DONKI data hooks"
```

---

## Task 6: Presentation components

**Files:**
- Create: `KpGauge.jsx`, `SolarWindReadout.jsx`, `AuroraStatus.jsx`, `DonkiFeed.jsx`, `SpaceWeatherPanel.jsx` (all in `src/features/space-weather/`)

Presentation only — receive data as props, never fetch. Reuse `CountUp` and the existing Tailwind tokens (`bg-space-1`, `text-instrument`, `ring-white/5`, `text-gray-400`). No unit tests (pure presentation; verified via build + screenshot in Task 10).

- [ ] **Step 1: `KpGauge.jsx`** — Kp 0–9 arc gauge, colored by severity.

```jsx
import { auroraLevel } from "./spaceWeatherApi";

const COLOR = {
  Quiet: "#3bf0a0",
  Active: "#7dd3fc",
  Storm: "#fbbf24",
  "Severe Storm": "#f87171",
};

export function KpGauge({ kp }) {
  const { label } = auroraLevel(kp);
  const pct = kp == null ? 0 : Math.min(kp, 9) / 9;
  const color = COLOR[label];
  // Half-circle arc: 126px circumference (semi of r=40). Stroke dashoffset = remaining.
  const C = Math.PI * 40;
  return (
    <div className="rounded-xl bg-space-1 p-4 ring-1 ring-white/5">
      <div className="text-xs uppercase tracking-widest text-gray-400">
        Planetary Kp
      </div>
      <div className="mt-2 flex items-end gap-3">
        <svg viewBox="0 0 100 56" className="h-14 w-24">
          <path
            d="M5 50 A45 45 0 0 1 95 50"
            fill="none"
            stroke="#ffffff14"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <path
            d="M5 50 A45 45 0 0 1 95 50"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - pct)}
            className="transition-[stroke-dashoffset] duration-700"
          />
        </svg>
        <div>
          <div className="text-2xl text-instrument tabular-nums">
            {kp == null ? "—" : kp.toFixed(2)}
          </div>
          <div className="text-xs" style={{ color }}>
            {label}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `SolarWindReadout.jsx`** — speed + density count-ups.

```jsx
import { CountUp } from "../iss/CountUp";

function Cell({ label, value, decimals, suffix }) {
  return (
    <div className="rounded-xl bg-space-1 p-4 ring-1 ring-white/5">
      <div className="text-xs uppercase tracking-widest text-gray-400">{label}</div>
      <div className="mt-1 text-2xl text-instrument">
        {value == null ? (
          <span className="font-mono">—</span>
        ) : (
          <CountUp value={value} decimals={decimals} suffix={suffix} />
        )}
      </div>
    </div>
  );
}

export function SolarWindReadout({ speed, density }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Cell label="Solar Wind Speed" value={speed} decimals={0} suffix=" km/s" />
      <Cell label="Proton Density" value={density} decimals={1} suffix=" p/cm³" />
    </div>
  );
}
```

- [ ] **Step 3: `AuroraStatus.jsx`** — derived likelihood badge.

```jsx
import { auroraLevel } from "./spaceWeatherApi";

const DOT = {
  Quiet: "bg-emerald-400",
  Active: "bg-sky-400",
  Storm: "bg-amber-400",
  "Severe Storm": "bg-red-400",
};

export function AuroraStatus({ kp }) {
  const { label } = auroraLevel(kp);
  return (
    <div className="flex items-center gap-2 rounded-xl bg-space-1 px-4 py-3 ring-1 ring-white/5">
      <span className={`h-2 w-2 rounded-full ${DOT[label]} motion-safe:animate-pulse`} />
      <span className="text-xs uppercase tracking-widest text-gray-400">
        Aurora
      </span>
      <span className="ml-auto text-sm text-instrument">{label}</span>
    </div>
  );
}
```

- [ ] **Step 4: `DonkiFeed.jsx`** — recent events list.

```jsx
const CHIP = {
  FLR: "bg-amber-500/20 text-amber-300",
  CME: "bg-fuchsia-500/20 text-fuchsia-300",
  GST: "bg-red-500/20 text-red-300",
  IPS: "bg-sky-500/20 text-sky-300",
  RBE: "bg-violet-500/20 text-violet-300",
};

function timeLabel(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 16).replace("T", " ") + "Z";
}

export function DonkiFeed({ events }) {
  const list = (events ?? []).slice(0, 6);
  return (
    <div className="rounded-xl bg-space-1 p-4 ring-1 ring-white/5">
      <div className="text-xs uppercase tracking-widest text-gray-400">
        Recent Events
      </div>
      {list.length === 0 ? (
        <div className="mt-3 font-mono text-sm text-gray-500">
          No recent space-weather events
        </div>
      ) : (
        <ul className="mt-3 space-y-3">
          {list.map((e) => (
            <li key={e.id} className="flex gap-3 text-sm">
              <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-mono ${CHIP[e.type] ?? "bg-white/10 text-gray-300"}`}>
                {e.type}
              </span>
              <a
                href={e.url}
                target="_blank"
                rel="noreferrer"
                className="text-gray-300 hover:text-instrument"
              >
                {e.summary || e.type}
                <span className="ml-2 text-xs text-gray-500">{timeLabel(e.issueTime)}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 5: `SpaceWeatherPanel.jsx`** — composes the four.

```jsx
import { KpGauge } from "./KpGauge";
import { SolarWindReadout } from "./SolarWindReadout";
import { AuroraStatus } from "./AuroraStatus";
import { DonkiFeed } from "./DonkiFeed";

export function SpaceWeatherPanel({ kp, speed, density, events }) {
  return (
    <div className="space-y-4">
      <h2 className="font-mono text-sm uppercase tracking-widest text-instrument">
        Space Weather
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <KpGauge kp={kp} />
        <AuroraStatus kp={kp} />
        <SolarWindReadout speed={speed} density={density} />
      </div>
      <DonkiFeed events={events} />
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/features/space-weather/KpGauge.jsx src/features/space-weather/SolarWindReadout.jsx src/features/space-weather/AuroraStatus.jsx src/features/space-weather/DonkiFeed.jsx src/features/space-weather/SpaceWeatherPanel.jsx
git commit -m "feat: space weather presentation components"
```

---

## Task 7: Lenis scroll shell + RevealSection

**Files:**
- Create: `src/lib/scroll/useLenis.js`
- Create: `src/components/RevealSection.jsx`

Activates the already-installed `@studio-freight/lenis`. Skips smooth-scroll under `prefers-reduced-motion`.

- [ ] **Step 1: Implement `useLenis.js`**

```js
import { useEffect } from "react";
import Lenis from "@studio-freight/lenis";

// Smooth-scroll the page, honoring reduced-motion (no-op if the user opts out).
export function useLenis() {
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({ duration: 1.1, smoothWheel: true });
    let raf;
    const loop = (time) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, []);
}
```

- [ ] **Step 2: Implement `RevealSection.jsx`**

```jsx
import { motion } from "framer-motion";

// Reusable scroll-reveal wrapper for dashboard sections. Reveals once on enter;
// reduced-motion users get the content immediately (no transform).
export function RevealSection({ children, className = "" }) {
  return (
    <motion.section
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      {children}
    </motion.section>
  );
}
```

- [ ] **Step 3: Verify the build compiles**

Run: `npm run build`
Expected: build succeeds (these modules are imported in Task 9; this confirms no syntax/import errors).

- [ ] **Step 4: Commit**

```bash
git add src/lib/scroll/useLenis.js src/components/RevealSection.jsx
git commit -m "feat: Lenis scroll shell + RevealSection wrapper"
```

---

## Task 8: Aurora glow on the globe

**Files:**
- Create: `src/three/AuroraGlow.jsx`

An additive back-side sphere just outside the existing atmosphere shell (which is at scale 1.03). Greenish, opacity + scale driven by `intensity` (0–1). Mirrors the atmosphere mesh pattern in `Globe.jsx` — no custom shader, low risk. Smoothly lerps opacity so Kp changes don't pop.

- [ ] **Step 1: Implement `AuroraGlow.jsx`**

`EARTH_RADIUS` is exported from `src/three/orbital.js` (same import `Globe.jsx` uses: `./orbital`).

```jsx
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BackSide, AdditiveBlending } from "three";
import { EARTH_RADIUS } from "./orbital";

export function AuroraGlow({ intensity = 0.15 }) {
  const matRef = useRef();
  const target = 0.06 + intensity * 0.5; // map 0..1 → ~0.06..0.56 opacity
  useFrame((_, delta) => {
    const m = matRef.current;
    if (!m) return;
    m.opacity += (target - m.opacity) * Math.min(1, delta * 3);
  });
  return (
    <mesh scale={1.08}>
      <sphereGeometry args={[EARTH_RADIUS, 64, 64]} />
      <meshBasicMaterial
        ref={matRef}
        color="#3bf0a0"
        transparent
        opacity={0.06}
        side={BackSide}
        blending={AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/three/AuroraGlow.jsx
git commit -m "feat: Kp-driven aurora glow mesh for the globe"
```

---

## Task 9: Wire into Scene + App

**Files:**
- Modify: `src/three/Scene.jsx`
- Modify: `src/App.jsx`

Kp is fetched once in `App`, passed to `Scene` (for the glow) and to the panel (single source of truth, no duplicate fetch).

- [ ] **Step 1: Add the glow to `Scene.jsx`**

Add the import near the other `./` imports (after the `ISSMarker` import, line 6):

```js
import { AuroraGlow } from "./AuroraGlow";
```

Change the `Scene` signature (line 64) to accept `auroraIntensity`:

```js
export function Scene({ iss, mode, auroraIntensity, onBeginInteraction, onEndInteraction }) {
```

Inside the `<Suspense fallback={null}>` block, after `<Globe />` (line 85), add:

```jsx
        <AuroraGlow intensity={auroraIntensity} />
```

- [ ] **Step 2: Rewrite `App.jsx`** to add the Lenis shell, lift Kp, and render the section

```jsx
import { AnimatePresence } from "framer-motion";
import { useISS } from "./features/iss/useISS";
import { useCrew } from "./features/iss/useCrew";
import { useSpaceWeather } from "./features/space-weather/useSpaceWeather";
import { useDonki } from "./features/space-weather/useDonki";
import { auroraLevel } from "./features/space-weather/spaceWeatherApi";
import { Scene } from "./three/Scene";
import { useCameraControl } from "./three/useCameraControl";
import { ResumeFollowButton } from "./three/ResumeFollowButton";
import { TelemetryPanel } from "./features/iss/TelemetryPanel";
import { CrewPanel } from "./features/iss/CrewPanel";
import { StatusBadge } from "./features/iss/StatusBadge";
import { SpaceWeatherPanel } from "./features/space-weather/SpaceWeatherPanel";
import { RevealSection } from "./components/RevealSection";
import { useLenis } from "./lib/scroll/useLenis";

export default function App() {
  useLenis();
  const { data: iss, loading, isStale } = useISS();
  const { data: crew } = useCrew();
  const { data: weather } = useSpaceWeather();
  const { data: events } = useDonki();
  const { mode, beginInteraction, endInteraction, resume } = useCameraControl();

  const kp = weather?.kp ?? null;
  const auroraIntensity = auroraLevel(kp).intensity;

  return (
    <main className="min-h-screen bg-space-0 text-gray-200">
      <header className="flex items-center justify-between px-6 py-5">
        <h1 className="font-mono text-lg tracking-widest text-instrument">
          MISSION CONTROL
        </h1>
        <StatusBadge loading={loading} isStale={isStale} />
      </header>

      <section className="relative h-[60vh] w-full">
        <Scene
          iss={iss}
          mode={mode}
          auroraIntensity={auroraIntensity}
          onBeginInteraction={beginInteraction}
          onEndInteraction={endInteraction}
        />
        <div className="pointer-events-none absolute right-4 top-4">
          <AnimatePresence>
            {mode === "manual" && <ResumeFollowButton onClick={resume} />}
          </AnimatePresence>
        </div>
        {loading && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="animate-pulse font-mono text-sm text-gray-500">
              Acquiring ISS signal…
            </div>
          </div>
        )}
      </section>

      <section className="mx-auto max-w-5xl space-y-4 px-6 py-8">
        <TelemetryPanel iss={iss} />
        <CrewPanel crew={crew} />
      </section>

      <RevealSection className="mx-auto max-w-5xl px-6 py-8">
        <SpaceWeatherPanel
          kp={kp}
          speed={weather?.speed ?? null}
          density={weather?.density ?? null}
          events={events}
        />
      </RevealSection>
    </main>
  );
}
```

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: all tests pass (the existing 35 + the new spaceWeatherApi/donkiApi tests).

- [ ] **Step 4: Run the build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/three/Scene.jsx src/App.jsx
git commit -m "feat: wire space weather panel + aurora glow into the dashboard"
```

---

## Task 10: Verify end-to-end

**Files:** none (verification only)

- [ ] **Step 1: Full test run**

Run: `npm test`
Expected: PASS, no skipped suites.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: success; note bundle size (three.js chunk is ~355KB gzip baseline).

- [ ] **Step 3: Headless visual check of the aurora glow**

Use the established `reference_verify_3d_scene` method (headless Chrome + SwiftShader screenshot, sharp crop) against `npm run preview`. Temporarily force a high Kp by mocking `useSpaceWeather` to return `{ kp: 8 }`, or pass `auroraIntensity={1}` to `Scene`, and confirm the green aurora halo is visibly stronger than at `intensity={0.15}`. Revert the mock after.

Expected: green additive halo around the globe; brighter at high intensity. SWPC telemetry populates the Kp gauge + solar-wind cells locally (NOAA has CORS); the DONKI feed shows its empty/last-good state locally since `/api/donki` only runs on Vercel — expected, matches `astros` in v1.

- [ ] **Step 4: Confirm the key is not in the client bundle**

Run: `grep -r "mDGYsR" dist/ ; echo "exit: $?"`
Expected: no matches (grep exit 1) — the NASA key never reaches the client.

---

## Post-plan notes (carry into review / deploy)

- Before Vercel deploy: add `NASA_API_KEY` to the Vercel project env; redeploy; confirm `/api/donki` returns real events.
- Recommend regenerating the NASA key at api.nasa.gov after deploy (it was shared in chat).
- Update the `project_mission_control` memory after merge (Phase 1 done; Phases 2–3 remaining).
- Phases 2 (Launch Library 2) and 3 (APOD/EPIC/Mars/NeoWs) reuse the `api/<endpoint>.js` proxy convention and `RevealSection` established here.
