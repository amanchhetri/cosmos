# Interactive Camera Control — Design Spec

**Date:** 2026-06-07
**Status:** Approved (design phase)
**Owner:** Aman Chhetri
**Context:** Enhancement to Mission Control v1 (ISS module).

## Overview

Re-introduce user camera control (drag-rotate + zoom) to the ISS scene without
losing the headline auto-follow behavior. The scene currently has a fully
auto-driven camera (`AutoFollow` writes `camera.position` every frame); v1
deliberately omitted `OrbitControls` because two writers fighting over the
camera produces jank. This spec resolves that by making the two writers
**mutually exclusive** via an explicit mode.

## Behavior

- **Default mode is `auto`** — unchanged: the camera orbits to keep the ISS
  centered, idle-spins when there is no fix.
- **Drag or zoom switches to `manual`.** `OrbitControls` drives the camera;
  `AutoFollow` stops writing to it. A **"↻ Resume auto-follow"** pill fades in.
- **Return to `auto`** happens two ways:
  1. The user clicks the Resume pill.
  2. **8 seconds** elapse with no camera interaction (idle auto-resume), so the
     showcase drifts back to live tracking for the next viewer.
- On resume, `AutoFollow` eases the camera back **smoothly** from wherever the
  user left it — including any zoom/rotation — with no snap (see the AutoFollow
  change below; today's code *sets* the position directly, which would jump, so
  this spec changes it to interpolate).
- **Controls:** drag-rotate and scroll/pinch-zoom enabled; **pan disabled**;
  zoom clamped to `minDistance 2` / `maxDistance 6`; damping enabled for a
  weighted feel. (These match the values from the original v1 plan.)

## Architecture

Preserves Scene's existing separation of concerns; adds one focused unit.

### New: `src/three/useCameraControl.js`
A headless hook owning camera-mode state and the idle timer. Single
responsibility, no R3F/DOM dependency, unit-testable in isolation.

- **State:** `mode: "auto" | "manual"`.
- **API:** returns `{ mode, enterManual, resume }`.
  - `enterManual()` — sets `mode = "manual"` and (re)starts the idle timer.
  - `resume()` — sets `mode = "auto"` and clears the idle timer.
  - While in manual, each `enterManual()` call (fired on every interaction)
    resets the 8s countdown; when it fires, the hook auto-resumes.
- **Cleanup:** clears any pending timer on unmount.
- **Param:** `idleMs` (default `8000`) for testability.

### Changed: `src/three/Scene.jsx`
- Calls `useCameraControl()` and renders `<OrbitControls>` again with
  `enablePan={false}`, `enableZoom`, `enableDamping`, `minDistance={2}`,
  `maxDistance={6}`.
- `OrbitControls` `onChange` → `enterManual()`. Using `onChange` (not `onStart`)
  means every interaction frame resets the idle countdown, so a drag longer than
  8s won't auto-resume mid-drag, and the 8s counts from the last camera change
  (including damping settle). `onChange` is silent in auto mode because
  `OrbitControls` is disabled there, so it can't spuriously trip the switch.
- `AutoFollow` receives `active={mode === "auto"}` and its `useFrame` early-returns
  when not active, so it never fights `OrbitControls`. `OrbitControls` is
  `enabled={mode === "manual"}` so its damping loop never overwrites the auto camera.
- **Smooth handoff (resume):** `AutoFollow` is changed so that, instead of calling
  `camera.position.set(...)` each frame, it **lerps** `camera.position` toward the
  computed orbit target (`camera.position.lerp(target, 1 - exp(-k·delta))`,
  frame-rate-independent damping). On the first active frame after a manual session
  it also re-seeds `angle.current` from the camera's current XZ azimuth
  (`Math.atan2(camera.position.x, camera.position.z)`) so the azimuth is continuous.
  Net effect: a zoomed-in / rotated manual view glides back to the live-tracking
  orbit instead of snapping. (The existing shortest-arc angle easing is retained for
  tracking the ISS once back on the orbit.)
- Scene accepts `mode` + `onEnterManual`/`onResume` via props from `App` so the
  HTML overlay (the pill) can live in the DOM layer. The `useCameraControl` hook
  is lifted to `App` (it owns both the canvas and the overlay).

### Changed: `src/App.jsx`
- Owns `useCameraControl()`, passes `mode` + `enterManual` into `<Scene>` and
  renders the **Resume pill** as an HTML overlay over the canvas section
  (top-right, under the status badge), shown only when `mode === "manual"`,
  with a Framer Motion fade. Clicking it calls `resume()`.

### New: `src/features/iss/ResumeFollowButton.jsx` (or inline in App)
Small presentational pill: `{ onClick }`, teal instrument styling, an `aria-label`,
Framer Motion fade in/out. Kept as its own component for clarity and reuse.

## Data flow

`App` → `useCameraControl()` → `{mode, enterManual, resume}`
- `mode` + `enterManual` → `<Scene>` (gates AutoFollow, wires OrbitControls onStart/enabled)
- `mode === "manual"` → render `<ResumeFollowButton onClick={resume}>`

No change to ISS/crew data hooks.

## Testing

- **Unit-test `useCameraControl`** (`useCameraControl.test.js`) with fake timers:
  - starts in `auto`
  - `enterManual()` → `manual`
  - idle timer fires after `idleMs` → back to `auto`
  - interaction (repeat `enterManual`) resets the countdown (does not resume early)
  - `resume()` → `auto` and clears the timer
  - timer cleared on unmount (no state update after unmount)
- **Build + run check:** `npm run build`, then run the dev server and confirm the
  pill toggles. OrbitControls drag is hard to assert in a headless screenshot, so
  mode logic is covered by the hook tests; the visual check confirms wiring +
  pill appearance.

## Out of scope

- Touch-gesture tuning beyond OrbitControls defaults.
- Persisting camera position across reloads.
- A manual "lock onto ISS and zoom" cinematic — possible later polish.
- Changing the auto-follow math itself.
