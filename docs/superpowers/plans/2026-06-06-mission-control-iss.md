# Mission Control — v1 (ISS Module) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the v1 Mission Control dashboard — a live 3D Earth globe tracking the ISS in real time, with telemetry, current crew, and graceful loading/offline states.

**Architecture:** A Vite + React single-page app. Data lives behind one reusable polling hook (`useResource`) feeding feature-specific clients; presentation components never fetch. 3D is React Three Fiber: a textured Earth globe with an ISS marker + orbital trail, positioned from live lat/lon via a pure orbital-math module. A thin Vercel serverless function proxies the http-only crew endpoint.

**Tech Stack:** React, Vite, Tailwind CSS, React Three Fiber + drei, three, Framer Motion, Lenis, Vitest + React Testing Library + jsdom.

---

## File Structure

```
mission-control/
  api/
    astros.js                      # Vercel proxy for http-only crew endpoint
  src/
    main.jsx                       # entry
    App.jsx                        # layout assembly
    index.css                      # tailwind + base theme
    lib/
      data/
        useResource.js             # generic fetch + poll + cache + abort hook
        useResource.test.js
    three/
      orbital.js                   # pure lat/lon/alt -> Vector3 math
      orbital.test.js
      Globe.jsx                    # textured Earth + atmosphere
      ISSMarker.jsx                # marker + orbital trail
      Scene.jsx                    # canvas, lighting, camera, auto-follow
      usePerfTier.js               # perf tier (ported from portfolio)
    features/
      iss/
        issApi.js                  # fetch + parse wheretheiss
        issApi.test.js
        useISS.js                  # useResource(fetchISS) wrapper
        crewApi.js                 # fetch + parse crew (via /api/astros) + fallback
        crewApi.test.js
        useCrew.js                 # useResource(fetchCrew) wrapper
        TelemetryPanel.jsx         # altitude/velocity/lat-lon with count-ups
        CrewPanel.jsx              # who's in space now
        CountUp.jsx                # animated number
        StatusBadge.jsx            # loading / live / offline indicator
  vercel.json
  vite.config.js
  tailwind.config.js
  postcss.config.js
  package.json
  README.md
```

---

## Task 1: Scaffold the project

**Files:**
- Create: `package.json`, `vite.config.js`, `index.html`, `src/main.jsx`, `src/App.jsx`, `src/index.css`, `tailwind.config.js`, `postcss.config.js`

- [ ] **Step 1: Create the Vite app and install dependencies**

Run (from `D:\Code\mission-control`):
```bash
npm create vite@latest . -- --template react
npm install three @react-three/fiber @react-three/drei framer-motion @studio-freight/lenis
npm install -D tailwindcss postcss autoprefixer vitest @testing-library/react @testing-library/dom jsdom @vitejs/plugin-react
npx tailwindcss init -p
```
Expected: `node_modules/` populated, `tailwind.config.js` + `postcss.config.js` created. If `npm create` complains the directory is non-empty, choose "Ignore files and continue".

- [ ] **Step 2: Configure Tailwind content paths**

Replace `tailwind.config.js`:
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        space: { 0: "#05060a", 1: "#0a0d16", 2: "#121726" },
        instrument: "#5eead4", // teal instrument-panel accent
      },
      fontFamily: { mono: ["ui-monospace", "SFMono-Regular", "monospace"] },
    },
  },
  plugins: [],
};
```

- [ ] **Step 3: Set base styles**

Replace `src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root { height: 100%; }
body {
  margin: 0;
  background: #05060a;
  color: #e5e7eb;
  font-family: ui-sans-serif, system-ui, sans-serif;
  overflow-x: hidden;
}
```

- [ ] **Step 4: Configure Vitest**

Replace `vite.config.js`:
```js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
  },
});
```

Add to `package.json` `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Minimal app shell**

Replace `src/App.jsx`:
```jsx
export default function App() {
  return (
    <main className="min-h-screen bg-space-0 text-gray-200">
      <h1 className="p-8 font-mono text-instrument">Mission Control</h1>
    </main>
  );
}
```

- [ ] **Step 6: Verify it boots**

Run: `npm run dev`
Expected: dev server starts, page shows "Mission Control" in teal. Stop the server.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold vite + react + tailwind + vitest"
```

---

## Task 2: Generic data hook (`useResource`)

**Files:**
- Create: `src/lib/data/useResource.js`
- Test: `src/lib/data/useResource.test.js`

- [ ] **Step 1: Write the failing test**

`src/lib/data/useResource.test.js`:
```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- useResource`
Expected: FAIL — cannot resolve `./useResource`.

- [ ] **Step 3: Implement the hook**

`src/lib/data/useResource.js`:
```js
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Generic polling data hook.
 * @param {(signal: AbortSignal) => Promise<any>} fetcher
 * @param {{ intervalMs?: number, fallback?: any, enabled?: boolean }} opts
 */
export function useResource(fetcher, opts = {}) {
  const { intervalMs, fallback = null, enabled = true } = opts;
  const [data, setData] = useState(fallback);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const lastGood = useRef(fallback);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(async (signal) => {
    try {
      const result = await fetcherRef.current(signal);
      if (signal.aborted) return;
      lastGood.current = result;
      setData(result);
      setError(null);
    } catch (err) {
      if (signal.aborted || err.name === "AbortError") return;
      setError(err);
      setData(lastGood.current); // degrade to last-good, never to null
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    load(controller.signal);
    const id = intervalMs
      ? setInterval(() => load(controller.signal), intervalMs)
      : null;
    return () => {
      controller.abort();
      if (id) clearInterval(id);
    };
  }, [enabled, intervalMs, load]);

  return { data, error, loading, isStale: error != null && data != null };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- useResource`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/useResource.js src/lib/data/useResource.test.js
git commit -m "feat: add generic polling useResource hook with stale-on-error"
```

---

## Task 3: Orbital math

**Files:**
- Create: `src/three/orbital.js`
- Test: `src/three/orbital.test.js`

- [ ] **Step 1: Write the failing test**

`src/three/orbital.test.js`:
```js
import { describe, it, expect } from "vitest";
import { latLonToVector3, issPosition, EARTH_RADIUS } from "./orbital";

describe("latLonToVector3", () => {
  it("maps (0,0) to the +X point on the surface", () => {
    const v = latLonToVector3(0, 0);
    expect(v.x).toBeCloseTo(EARTH_RADIUS);
    expect(v.y).toBeCloseTo(0);
    expect(v.z).toBeCloseTo(0);
  });

  it("maps the north pole to +Y", () => {
    const v = latLonToVector3(90, 0);
    expect(v.y).toBeCloseTo(EARTH_RADIUS);
  });

  it("keeps points on the sphere of the requested radius", () => {
    const v = latLonToVector3(37, -122, 2);
    expect(v.length()).toBeCloseTo(2);
  });
});

describe("issPosition", () => {
  it("places the ISS above the Earth surface", () => {
    const v = issPosition(0, 0);
    expect(v.length()).toBeGreaterThan(EARTH_RADIUS);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- orbital`
Expected: FAIL — cannot resolve `./orbital`.

- [ ] **Step 3: Implement the math**

`src/three/orbital.js`:
```js
import { Vector3 } from "three";

export const EARTH_RADIUS = 1;
// ISS orbits ~420 km above Earth's ~6371 km radius.
const ISS_ALTITUDE = (EARTH_RADIUS * 420) / 6371;

/** Convert geographic coords to a point on a sphere of `radius`. */
export function latLonToVector3(latDeg, lonDeg, radius = EARTH_RADIUS) {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  return new Vector3(
    radius * Math.cos(lat) * Math.cos(lon),
    radius * Math.sin(lat),
    -radius * Math.cos(lat) * Math.sin(lon)
  );
}

/** Position of the ISS marker, slightly above the globe surface. */
export function issPosition(latDeg, lonDeg) {
  return latLonToVector3(latDeg, lonDeg, EARTH_RADIUS + ISS_ALTITUDE);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- orbital`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/three/orbital.js src/three/orbital.test.js
git commit -m "feat: add pure orbital lat/lon->Vector3 math"
```

---

## Task 4: ISS data client + hook

**Files:**
- Create: `src/features/iss/issApi.js`, `src/features/iss/useISS.js`
- Test: `src/features/iss/issApi.test.js`

- [ ] **Step 1: Write the failing test**

`src/features/iss/issApi.test.js`:
```js
import { describe, it, expect, vi, afterEach } from "vitest";
import { parseISS, fetchISS } from "./issApi";

const RAW = {
  latitude: 12.34,
  longitude: -56.78,
  altitude: 421.5,
  velocity: 27600,
  visibility: "daylight",
  timestamp: 1700000000,
};

describe("parseISS", () => {
  it("maps raw fields to a clean shape", () => {
    expect(parseISS(RAW)).toEqual({
      latitude: 12.34,
      longitude: -56.78,
      altitude: 421.5,
      velocity: 27600,
      visibility: "daylight",
      timestamp: 1700000000,
    });
  });
});

describe("fetchISS", () => {
  afterEach(() => vi.restoreAllMocks());

  it("throws on a non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false, status: 503 });
    await expect(fetchISS(new AbortController().signal)).rejects.toThrow("503");
  });

  it("returns parsed data on success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => RAW,
    });
    const result = await fetchISS(new AbortController().signal);
    expect(result.latitude).toBe(12.34);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- issApi`
Expected: FAIL — cannot resolve `./issApi`.

- [ ] **Step 3: Implement the client**

`src/features/iss/issApi.js`:
```js
const ISS_URL = "https://api.wheretheiss.at/v1/satellites/25544";

export function parseISS(raw) {
  return {
    latitude: raw.latitude,
    longitude: raw.longitude,
    altitude: raw.altitude, // km
    velocity: raw.velocity, // km/h
    visibility: raw.visibility,
    timestamp: raw.timestamp,
  };
}

export async function fetchISS(signal) {
  const res = await fetch(ISS_URL, { signal });
  if (!res.ok) throw new Error(`ISS fetch failed: ${res.status}`);
  return parseISS(await res.json());
}
```

- [ ] **Step 4: Implement the hook (no test — thin wrapper)**

`src/features/iss/useISS.js`:
```js
import { useResource } from "../../lib/data/useResource";
import { fetchISS } from "./issApi";

export function useISS() {
  return useResource(fetchISS, { intervalMs: 5000 });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- issApi`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/features/iss/issApi.js src/features/iss/issApi.test.js src/features/iss/useISS.js
git commit -m "feat: add ISS position client and polling hook"
```

---

## Task 5: Crew proxy + client + hook

**Files:**
- Create: `api/astros.js`, `src/features/iss/crewApi.js`, `src/features/iss/useCrew.js`
- Test: `src/features/iss/crewApi.test.js`

- [ ] **Step 1: Write the failing test**

`src/features/iss/crewApi.test.js`:
```js
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
});

describe("fetchCrew", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns the static fallback on a non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false, status: 502 });
    const result = await fetchCrew(new AbortController().signal);
    expect(result).toEqual(FALLBACK_CREW);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- crewApi`
Expected: FAIL — cannot resolve `./crewApi`.

- [ ] **Step 3: Implement the client (with fallback)**

`src/features/iss/crewApi.js`:
```js
// Static fallback so the UI never shows an empty crew. Refresh occasionally.
export const FALLBACK_CREW = ["Crew data unavailable"];

export function parseCrew(raw) {
  return (raw.people ?? [])
    .filter((p) => p.craft === "ISS")
    .map((p) => p.name);
}

export async function fetchCrew(signal) {
  try {
    const res = await fetch("/api/astros", { signal });
    if (!res.ok) throw new Error(`crew fetch failed: ${res.status}`);
    const names = parseCrew(await res.json());
    return names.length ? names : FALLBACK_CREW;
  } catch (err) {
    if (err.name === "AbortError") throw err;
    return FALLBACK_CREW;
  }
}
```

- [ ] **Step 4: Implement the hook**

`src/features/iss/useCrew.js`:
```js
import { useResource } from "../../lib/data/useResource";
import { fetchCrew, FALLBACK_CREW } from "./crewApi";

export function useCrew() {
  return useResource(fetchCrew, { intervalMs: 60000, fallback: FALLBACK_CREW });
}
```

- [ ] **Step 5: Implement the Vercel proxy**

`api/astros.js`:
```js
// Proxies the http-only Open-Notify endpoint so it works over https,
// with short edge caching.
export default async function handler(req, res) {
  try {
    const upstream = await fetch("http://api.open-notify.org/astros.json");
    if (!upstream.ok) throw new Error(String(upstream.status));
    const data = await upstream.json();
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=3600");
    res.status(200).json(data);
  } catch {
    res.status(502).json({ error: "upstream unavailable" });
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- crewApi`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add api/astros.js src/features/iss/crewApi.js src/features/iss/crewApi.test.js src/features/iss/useCrew.js
git commit -m "feat: add crew client with fallback and Vercel proxy"
```

---

## Task 6: Perf tier hook

**Files:**
- Create: `src/three/usePerfTier.js`

- [ ] **Step 1: Implement the perf tier**

`src/three/usePerfTier.js`:
```js
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
```

- [ ] **Step 2: Smoke-check the import**

Run: `node -e "import('./src/three/usePerfTier.js').then(()=>console.log('ok')).catch(e=>{console.error(e);process.exit(1)})"`
Expected: prints `ok` (or, if ESM resolution errors in bare node, skip — it is validated when the app builds in Task 11).

- [ ] **Step 3: Commit**

```bash
git add src/three/usePerfTier.js
git commit -m "feat: add coarse perf-tier hook for 3D scaling"
```

---

## Task 7: Earth globe component

**Files:**
- Create: `src/three/Globe.jsx`
- Assets: download Earth textures into `public/textures/`

- [ ] **Step 1: Add Earth textures**

Download two equirectangular textures into `public/textures/`:
- `earth-day.jpg` (e.g. NASA Blue Marble, 2048px wide)
- `earth-normal.jpg` (optional bump/normal; if unavailable, skip the normalMap prop)

Sources: NASA Visible Earth (public domain). Keep files < 1.5 MB each.

- [ ] **Step 2: Implement the globe**

`src/three/Globe.jsx`:
```jsx
import { useTexture } from "@react-three/drei";
import { EARTH_RADIUS } from "./orbital";

export function Globe() {
  const day = useTexture("/textures/earth-day.jpg");
  return (
    <group>
      <mesh>
        <sphereGeometry args={[EARTH_RADIUS, 64, 64]} />
        <meshStandardMaterial map={day} roughness={1} metalness={0} />
      </mesh>
      {/* atmosphere glow */}
      <mesh scale={1.03}>
        <sphereGeometry args={[EARTH_RADIUS, 64, 64]} />
        <meshBasicMaterial
          color="#5b8bff"
          transparent
          opacity={0.12}
          side={2 /* BackSide */}
        />
      </mesh>
    </group>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add public/textures src/three/Globe.jsx
git commit -m "feat: add textured Earth globe with atmosphere"
```

---

## Task 8: ISS marker + orbital trail

**Files:**
- Create: `src/three/ISSMarker.jsx`

- [ ] **Step 1: Implement marker + trail**

`src/three/ISSMarker.jsx`:
```jsx
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import { issPosition } from "./orbital";

const MAX_TRAIL = 120;

export function ISSMarker({ latitude, longitude }) {
  const trail = useRef([]);
  const lineRef = useRef();
  const markerRef = useRef();

  const target = useMemo(
    () => issPosition(latitude, longitude),
    [latitude, longitude]
  );

  useFrame(() => {
    if (markerRef.current) markerRef.current.position.copy(target);
    const pts = trail.current;
    const last = pts[pts.length - 1];
    if (!last || last.distanceTo(target) > 0.01) {
      pts.push(target.clone());
      if (pts.length > MAX_TRAIL) pts.shift();
      if (lineRef.current && pts.length > 1) {
        lineRef.current.geometry.setFromPoints(pts);
      }
    }
  });

  return (
    <group>
      <mesh ref={markerRef}>
        <sphereGeometry args={[0.02, 16, 16]} />
        <meshStandardMaterial
          color="#5eead4"
          emissive="#5eead4"
          emissiveIntensity={2}
        />
      </mesh>
      <Line ref={lineRef} points={[target, target]} color="#5eead4" lineWidth={1} transparent opacity={0.5} />
    </group>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/three/ISSMarker.jsx
git commit -m "feat: add ISS marker with fading orbital trail"
```

---

## Task 9: Scene (canvas, lighting, camera auto-follow)

**Files:**
- Create: `src/three/Scene.jsx`

- [ ] **Step 1: Implement the scene**

`src/three/Scene.jsx`:
```jsx
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { useRef } from "react";
import { Globe } from "./Globe";
import { ISSMarker } from "./ISSMarker";
import { issPosition } from "./orbital";
import { usePerfTier } from "./usePerfTier";

function AutoFollow({ latitude, longitude, enabled }) {
  // Slowly orient the camera toward the ISS longitude; idle-spin when no fix.
  // The active camera is read from `state.camera` inside useFrame.
  const angle = useRef(0);
  useFrame((state, delta) => {
    if (!enabled) {
      angle.current += delta * 0.05; // idle spin
    } else {
      const p = issPosition(latitude, longitude);
      const targetAngle = Math.atan2(p.x, p.z);
      angle.current += (targetAngle - angle.current) * Math.min(1, delta * 0.5);
    }
    const r = 3;
    state.camera.position.set(
      Math.sin(angle.current) * r,
      0.6,
      Math.cos(angle.current) * r
    );
    state.camera.lookAt(0, 0, 0);
  });
  return null;
}

export function Scene({ iss }) {
  const perf = usePerfTier();
  const hasFix = iss != null;
  return (
    <Canvas
      dpr={perf.dpr}
      camera={{ position: [0, 0.6, 3], fov: 45 }}
      gl={{ antialias: perf.tier === "high" }}
    >
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 3, 5]} intensity={1.5} />
      <Stars radius={50} depth={20} count={perf.tier === "high" ? 3000 : 1200} factor={4} fade />
      <Globe />
      {hasFix && (
        <ISSMarker latitude={iss.latitude} longitude={iss.longitude} />
      )}
      <AutoFollow
        latitude={hasFix ? iss.latitude : 0}
        longitude={hasFix ? iss.longitude : 0}
        enabled={hasFix}
      />
      <OrbitControls enablePan={false} enableZoom minDistance={2} maxDistance={6} />
    </Canvas>
  );
}
```

> Note: `AutoFollow` and `OrbitControls` both touch the camera. `AutoFollow` sets position every frame, so OrbitControls' user rotation will be overridden while a fix exists — acceptable for v1 (auto-follow is the headline behavior). If you'd rather let users free-look, gate `AutoFollow` behind an "auto" toggle in a later pass.

- [ ] **Step 2: Commit**

```bash
git add src/three/Scene.jsx
git commit -m "feat: add 3D scene with stars, lighting and ISS auto-follow"
```

---

## Task 10: Telemetry, crew, count-up, status

**Files:**
- Create: `src/features/iss/CountUp.jsx`, `TelemetryPanel.jsx`, `CrewPanel.jsx`, `StatusBadge.jsx`

- [ ] **Step 1: CountUp**

`src/features/iss/CountUp.jsx`:
```jsx
import { useEffect } from "react";
import { animate, useMotionValue, useTransform, motion } from "framer-motion";

export function CountUp({ value, decimals = 0, suffix = "" }) {
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => `${v.toFixed(decimals)}${suffix}`);
  useEffect(() => {
    const controls = animate(mv, value ?? 0, { duration: 0.8, ease: "easeOut" });
    return controls.stop;
  }, [value, mv]);
  return <motion.span className="font-mono tabular-nums">{text}</motion.span>;
}
```

- [ ] **Step 2: TelemetryPanel**

`src/features/iss/TelemetryPanel.jsx`:
```jsx
import { motion } from "framer-motion";
import { CountUp } from "./CountUp";

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

function Stat({ label, value, decimals, suffix }) {
  return (
    <motion.div variants={item} className="rounded-xl bg-space-1 p-4 ring-1 ring-white/5">
      <div className="text-xs uppercase tracking-widest text-gray-400">{label}</div>
      <div className="mt-1 text-2xl text-instrument">
        <CountUp value={value} decimals={decimals} suffix={suffix} />
      </div>
    </motion.div>
  );
}

export function TelemetryPanel({ iss }) {
  if (!iss) return null;
  return (
    <motion.div
      className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.08 } } }}
    >
      <Stat label="Altitude" value={iss.altitude} decimals={1} suffix=" km" />
      <Stat label="Velocity" value={iss.velocity} decimals={0} suffix=" km/h" />
      <Stat label="Latitude" value={iss.latitude} decimals={2} suffix="°" />
      <Stat label="Longitude" value={iss.longitude} decimals={2} suffix="°" />
    </motion.div>
  );
}
```

- [ ] **Step 3: CrewPanel**

`src/features/iss/CrewPanel.jsx`:
```jsx
import { motion } from "framer-motion";

export function CrewPanel({ crew }) {
  const names = crew ?? [];
  return (
    <div className="rounded-xl bg-space-1 p-4 ring-1 ring-white/5">
      <div className="text-xs uppercase tracking-widest text-gray-400">
        Aboard the ISS — {names.length}
      </div>
      <ul className="mt-2 space-y-1">
        {names.map((name, i) => (
          <motion.li
            key={name}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="text-sm text-gray-200"
          >
            {name}
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: StatusBadge**

`src/features/iss/StatusBadge.jsx`:
```jsx
export function StatusBadge({ loading, isStale }) {
  const { color, label } = loading
    ? { color: "bg-amber-400", label: "Acquiring signal…" }
    : isStale
    ? { color: "bg-red-400", label: "Offline — last known" }
    : { color: "bg-instrument", label: "Live" };
  return (
    <div className="flex items-center gap-2 text-xs text-gray-300">
      <span className={`h-2 w-2 animate-pulse rounded-full ${color}`} />
      {label}
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/features/iss/CountUp.jsx src/features/iss/TelemetryPanel.jsx src/features/iss/CrewPanel.jsx src/features/iss/StatusBadge.jsx
git commit -m "feat: add telemetry, crew, count-up and status components"
```

---

## Task 11: Assemble the app

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Wire everything together**

Replace `src/App.jsx`:
```jsx
import { useISS } from "./features/iss/useISS";
import { useCrew } from "./features/iss/useCrew";
import { Scene } from "./three/Scene";
import { TelemetryPanel } from "./features/iss/TelemetryPanel";
import { CrewPanel } from "./features/iss/CrewPanel";
import { StatusBadge } from "./features/iss/StatusBadge";

export default function App() {
  const { data: iss, loading, isStale } = useISS();
  const { data: crew } = useCrew();

  return (
    <main className="min-h-screen bg-space-0 text-gray-200">
      <header className="flex items-center justify-between px-6 py-5">
        <h1 className="font-mono text-lg tracking-widest text-instrument">
          MISSION CONTROL
        </h1>
        <StatusBadge loading={loading} isStale={isStale} />
      </header>

      <section className="relative h-[60vh] w-full">
        <Scene iss={iss} />
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
    </main>
  );
}
```

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: PASS (all tests from Tasks 2–5).

- [ ] **Step 3: Build to verify everything compiles**

Run: `npm run build`
Expected: build succeeds with no import/type errors.

- [ ] **Step 4: Run the app and verify live**

Run: `npm run dev`
Expected: globe renders, stars visible, an ISS marker appears once position loads, telemetry numbers count up, status badge shows "Live". (Crew shows fallback in dev — the `/api/astros` proxy only runs on Vercel; that is expected locally.)

- [ ] **Step 5: Visual-verify the globe headlessly (optional but recommended)**

Use the existing portfolio workflow: headless Chrome + SwiftShader screenshot of `http://localhost:5173`, then crop with sharp. Confirm the globe + marker are visible.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "feat: assemble Mission Control ISS dashboard"
```

---

## Task 12: Deploy config + README

**Files:**
- Create: `vercel.json`, `README.md`

- [ ] **Step 1: Vercel config**

`vercel.json`:
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist"
}
```

- [ ] **Step 2: README**

`README.md`:
```markdown
# Mission Control

Live 3D dashboard tracking the International Space Station in real time —
position, telemetry, and current crew. Built with React, React Three Fiber,
Framer Motion, and Lenis.

## Develop
\`\`\`bash
npm install
npm run dev
\`\`\`

## Test
\`\`\`bash
npm test
\`\`\`

## Data sources
- ISS position: wheretheiss.at (no key)
- Crew: Open-Notify, proxied via `/api/astros` (Vercel function) to bypass http-only + flakiness

## Roadmap
- P2 Launch tracker + countdowns
- P3 Solar-system scrollytelling
- P4 NASA APOD + near-Earth asteroids
```

- [ ] **Step 3: Commit**

```bash
git add vercel.json README.md
git commit -m "chore: add Vercel config and README"
```

- [ ] **Step 4: Deploy**

Push to a GitHub remote and import into Vercel (or run `vercel`). Verify the live `/api/astros` returns real crew data.

---

## Self-Review Notes

- **Spec coverage:** 3D globe (T7), live ISS position (T4), crew + flaky/http-only mitigation via proxy + fallback (T5), telemetry count-ups (T10), auto-follow + idle spin (T9), loading/offline states (T10 StatusBadge + T11), data layer `useResource` (T2), perf tier (T6), orbital math (T3), testing of hook+math+clients (T2–T5). All v1 spec items mapped.
- **Out of scope honored:** no launches/scrollytelling/APOD/asteroids; only the thin crew proxy as the spec allows.
- **Lenis:** installed in T1; v1 is mostly single-viewport so smooth-scroll is wired when P2+ adds long scroll content. Not load-bearing for v1.
```
