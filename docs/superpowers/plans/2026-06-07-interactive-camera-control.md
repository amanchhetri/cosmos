# Interactive Camera Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add user-controlled camera (drag-rotate + zoom) to the ISS scene with an auto-follow ⟷ manual mode that switches on interaction and auto-resumes after 8s idle, plus a "Resume auto-follow" pill.

**Architecture:** A headless `useCameraControl` hook owns `mode` + idle-timer logic (lifted to `App`). `OrbitControls` is re-introduced and stays **enabled in both modes** (so it can detect grabs via `onStart`/`onEnd`); it never fights `AutoFollow` because drei runs `controls.update()` at frame priority `-1` and three's `update()` re-reads `camera.position` each frame, so AutoFollow's write becomes OrbitControls' synced state. `AutoFollow` only writes the camera when `active` (auto mode) and now **lerps** position (re-seeding its azimuth from the live camera) for a smooth glide-back on resume.

**Tech Stack:** React, React Three Fiber, `@react-three/drei@10.7.7` OrbitControls, `three@0.184`, Framer Motion, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-06-07-interactive-camera-control-design.md`

---

## File Structure

- **Create** `src/three/useCameraControl.js` — headless mode/idle-timer hook (one responsibility, no R3F/DOM deps).
- **Create** `src/three/useCameraControl.test.js` — unit tests (fake timers).
- **Create** `src/three/ResumeFollowButton.jsx` — presentational pill overlay.
- **Modify** `src/three/Scene.jsx` — re-add `OrbitControls`; make `AutoFollow` `active`-gated + lerp/re-seed; accept `mode`/`onBeginInteraction`/`onEndInteraction` props.
- **Modify** `src/App.jsx` — own `useCameraControl()`, wire Scene props, render the pill.

---

## Task 1: `useCameraControl` hook (TDD)

**Files:**
- Create: `src/three/useCameraControl.js`
- Test: `src/three/useCameraControl.test.js`

- [ ] **Step 1: Write the failing test**

`src/three/useCameraControl.test.js`:
```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- useCameraControl`
Expected: FAIL — cannot resolve `./useCameraControl`.

- [ ] **Step 3: Implement the hook**

`src/three/useCameraControl.js`:
```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- useCameraControl`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/three/useCameraControl.js src/three/useCameraControl.test.js
git commit -m "feat: add useCameraControl mode + idle-resume hook"
```

---

## Task 2: `ResumeFollowButton` pill

**Files:**
- Create: `src/three/ResumeFollowButton.jsx`

- [ ] **Step 1: Implement the component**

`src/three/ResumeFollowButton.jsx`:
```jsx
import { motion } from "framer-motion";

/** Pill shown over the canvas in manual mode; click to resume auto-follow. */
export function ResumeFollowButton({ onClick }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label="Resume auto-follow"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-space-2/80 px-3 py-1.5 font-mono text-xs text-instrument ring-1 ring-instrument/30 backdrop-blur transition-colors hover:bg-space-2"
    >
      <span aria-hidden="true">↻</span> Resume auto-follow
    </motion.button>
  );
}
```

- [ ] **Step 2: Build to verify it compiles**

Run: `npm run build`
Expected: build succeeds (component is not imported yet; this just confirms it parses). The next task wires it in.

- [ ] **Step 3: Commit**

```bash
git add src/three/ResumeFollowButton.jsx
git commit -m "feat: add Resume auto-follow pill component"
```

---

## Task 3: Wire OrbitControls + active-gated AutoFollow into Scene

**Files:**
- Modify: `src/three/Scene.jsx`

Replace the entire contents of `src/three/Scene.jsx` with:

```jsx
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { Suspense, useRef } from "react";
import { Vector3 } from "three";
import { Globe } from "./Globe";
import { ISSMarker } from "./ISSMarker";
import { usePerfTier } from "./usePerfTier";

const CAMERA_RADIUS = 3;
const CAMERA_HEIGHT = 0.6;
const IDLE_SPIN_RATE = 0.05;
const FOLLOW_LERP_RATE = 0.5;
const RETURN_DAMP = 4; // how fast the camera glides back to the orbit on resume

function AutoFollow({ longitude, hasFix, active }) {
  // Drives the camera in auto mode: track the ISS longitude (or idle-spin with no
  // fix). Yields entirely to OrbitControls when `active` is false. The camera is
  // read from `state.camera` inside useFrame.
  const angle = useRef(0);
  const wasActive = useRef(true); // default mode is auto (active)
  const target = useRef();
  if (!target.current) target.current = new Vector3();

  useFrame((state, delta) => {
    if (!active) {
      wasActive.current = false;
      return; // manual mode: the user (via OrbitControls) owns the camera
    }
    // First active frame after a manual session: re-seed the orbit angle from the
    // camera's current azimuth so the glide-back is continuous (no azimuth snap).
    if (!wasActive.current) {
      angle.current = Math.atan2(state.camera.position.x, state.camera.position.z);
      wasActive.current = true;
    }

    if (!hasFix) {
      angle.current += delta * IDLE_SPIN_RATE; // idle spin
    } else {
      // Azimuth matches orbital.js's latLonToVector3 convention (atan2(p.x, p.z)
      // with the cos(lat) factor cancelling), computed directly from longitude to
      // avoid a per-frame Vector3 allocation.
      const lon = (longitude * Math.PI) / 180;
      const targetAngle = Math.atan2(Math.cos(lon), -Math.sin(lon));
      // Shortest signed arc so a fix arriving after idle spin doesn't over-rotate.
      let d = targetAngle - angle.current;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      angle.current += d * Math.min(1, delta * FOLLOW_LERP_RATE);
    }

    target.current.set(
      Math.sin(angle.current) * CAMERA_RADIUS,
      CAMERA_HEIGHT,
      Math.cos(angle.current) * CAMERA_RADIUS
    );
    // Lerp (frame-rate independent) toward the orbit target so resuming from a
    // zoomed/rotated manual view glides back to the default view instead of
    // snapping. At steady state the camera sits on the orbit and tracks the ISS.
    state.camera.position.lerp(target.current, 1 - Math.exp(-RETURN_DAMP * delta));
    state.camera.lookAt(0, 0, 0);
  });
  return null;
}

export function Scene({ iss, mode, onBeginInteraction, onEndInteraction }) {
  const perf = usePerfTier();
  const hasFix = iss != null;
  return (
    <Canvas
      dpr={perf.dpr}
      camera={{ position: [0, CAMERA_HEIGHT, CAMERA_RADIUS], fov: 45 }}
      gl={{ antialias: perf.tier === "high" }}
    >
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 3, 5]} intensity={1.5} />
      <Stars
        radius={50}
        depth={20}
        count={perf.tier === "high" ? 3000 : 1200}
        factor={4}
        fade
      />
      {/* Globe suspends while its texture loads; null fallback is fine since the
          HTML loading overlay is owned by App. */}
      <Suspense fallback={null}>
        <Globe />
        {hasFix && (
          <ISSMarker latitude={iss.latitude} longitude={iss.longitude} />
        )}
      </Suspense>
      <AutoFollow
        longitude={hasFix ? iss.longitude : 0}
        hasFix={hasFix}
        active={mode === "auto"}
      />
      {/* OrbitControls stays enabled in BOTH modes so it can catch the user's grab
          (onStart) in auto mode. It does NOT fight AutoFollow: drei runs
          controls.update() at useFrame priority -1 (before AutoFollow), and three's
          update() re-derives its spherical state from the current camera.position,
          so AutoFollow's per-frame write becomes OrbitControls' synced state.
          onStart -> manual; onEnd -> start the idle-resume countdown. */}
      <OrbitControls
        makeDefault
        enablePan={false}
        enableZoom
        enableDamping
        minDistance={2}
        maxDistance={6}
        onStart={onBeginInteraction}
        onEnd={onEndInteraction}
      />
    </Canvas>
  );
}
```

- [ ] **Step 1: Apply the file replacement above.**

- [ ] **Step 2: Build to verify it compiles**

Run: `npm run build`
Expected: build succeeds. (Scene now expects `mode`/`onBeginInteraction`/`onEndInteraction`; `App` still passes only `iss` until Task 4 — in auto mode `mode` is `undefined` so `active={mode === "auto"}` is `false`, meaning AutoFollow yields and the globe is purely OrbitControls-driven. That is a transient intermediate state; do not ship between tasks. Proceed to Task 4.)

- [ ] **Step 3: Run the test suite (no regressions)**

Run: `npm test`
Expected: PASS (all prior tests + the 7 from Task 1).

- [ ] **Step 4: Commit**

```bash
git add src/three/Scene.jsx
git commit -m "feat: re-add OrbitControls and active-gated auto-follow with glide-back"
```

---

## Task 4: Wire the hook + pill into App

**Files:**
- Modify: `src/App.jsx`

Replace the entire contents of `src/App.jsx` with:

```jsx
import { AnimatePresence } from "framer-motion";
import { useISS } from "./features/iss/useISS";
import { useCrew } from "./features/iss/useCrew";
import { Scene } from "./three/Scene";
import { useCameraControl } from "./three/useCameraControl";
import { ResumeFollowButton } from "./three/ResumeFollowButton";
import { TelemetryPanel } from "./features/iss/TelemetryPanel";
import { CrewPanel } from "./features/iss/CrewPanel";
import { StatusBadge } from "./features/iss/StatusBadge";

export default function App() {
  const { data: iss, loading, isStale } = useISS();
  const { data: crew } = useCrew();
  const { mode, beginInteraction, endInteraction, resume } = useCameraControl();

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
          onBeginInteraction={beginInteraction}
          onEndInteraction={endInteraction}
        />
        {/* Camera-mode control: top-right over the canvas, only in manual mode. */}
        <div className="pointer-events-none absolute right-4 top-4">
          <AnimatePresence>
            {mode === "manual" && (
              <ResumeFollowButton onClick={resume} />
            )}
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
    </main>
  );
}
```

- [ ] **Step 1: Apply the file replacement above.**

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: PASS (all tests).

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build succeeds, no import/type errors.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: wire camera-control hook and resume pill into App"
```

---

## Task 5: Manual verification

**Files:** none (verification only)

- [ ] **Step 1: Run the dev server**

Run: `npm run dev`
Expected: dev server starts (note the printed port; 5173 unless taken).

- [ ] **Step 2: Verify auto mode (default)**

In a browser at the printed URL: the globe auto-follows the ISS / idle-spins, and the "Resume auto-follow" pill is **not** visible.

- [ ] **Step 3: Verify manual takeover**

Drag the globe (rotate) and scroll (zoom). Confirm: the camera responds with damping, pan does nothing, zoom is clamped, and the "↻ Resume auto-follow" pill **fades in** (top-right).

- [ ] **Step 4: Verify resume (button)**

Click the pill. Confirm the camera **glides** back to the default orbit (no snap) and resumes following; the pill fades out.

- [ ] **Step 5: Verify resume (idle)**

Drag, release, and wait ~8s without interacting. Confirm it auto-resumes to auto-follow and the pill fades out.

- [ ] **Step 6: Headless smoke screenshot (optional)**

Capture a headless SwiftShader screenshot of the running URL (existing portfolio workflow) and confirm the scene still renders the globe + marker + stars. (OrbitControls drag and the pill's manual-only visibility can't be exercised headlessly; they are covered by Steps 2–5 and the Task 1 unit tests.)

- [ ] **Step 7: Stop the dev server.**

---

## Self-Review Notes

- **Spec coverage:** mode state + idle resume (T1), pill (T2), OrbitControls re-introduction with always-enabled no-fight wiring + glide-back AutoFollow (T3), App wiring + pill placement/visibility (T4), manual + headless verification (T5). All spec sections mapped.
- **API consistency:** hook returns `{ mode, beginInteraction, endInteraction, resume }`; Scene consumes `mode`/`onBeginInteraction`/`onEndInteraction`; App passes them and uses `resume` for the pill. Names match across tasks.
- **Out of scope honored:** no camera persistence, no touch-gesture tuning, no auto-follow math change beyond the position-lerp/re-seed needed for a non-snapping resume.
- **Known transient:** after T3 and before T4, `mode` is `undefined` in `App`, so `active` is false and the camera is OrbitControls-only. This is expected mid-plan and resolved by T4; don't ship between these tasks.
