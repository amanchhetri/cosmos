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
- **API:** returns `{ mode, beginInteraction, endInteraction, resume }`.
  - `beginInteraction()` — sets `mode = "manual"` and **clears** any pending idle
    timer (the user is actively interacting). Wired to OrbitControls `onStart`.
  - `endInteraction()` — **starts** the idle timer; when it fires (after `idleMs`),
    sets `mode = "auto"`. Wired to OrbitControls `onEnd`. Counting from gesture end
    means a drag longer than `idleMs` never auto-resumes mid-drag, and each new
    gesture restarts the countdown.
  - `resume()` — sets `mode = "auto"` and clears the idle timer. Wired to the pill.
- **Cleanup:** clears any pending timer on unmount.
- **Param:** `idleMs` (default `8000`) for testability.

> **Why `onStart`/`onEnd`, not `onChange`:** three's `OrbitControls.update()`
> dispatches a `'change'` event whenever the camera moves *by any cause* —
> including AutoFollow's own per-frame writes. So `onChange` would fire every
> frame in auto mode and falsely flip to manual. `'start'`/`'end'` fire only on
> real user input (pointer/wheel), making them the correct interaction signal.

### Changed: `src/three/Scene.jsx`
- Renders `<OrbitControls>` again with `makeDefault`, `enablePan={false}`,
  `enableZoom`, `enableDamping`, `minDistance={2}`, `maxDistance={6}`,
  `onStart={onBeginInteraction}`, `onEnd={onEndInteraction}`.
- **`OrbitControls` stays `enabled` in BOTH modes** (no `enabled={...}` gate).
  This is required so it can detect the user's grab (`onStart`) in auto mode, and
  it does **not** fight AutoFollow because of frame ordering: drei runs
  `controls.update()` at `useFrame` priority `-1` (before AutoFollow at default
  priority `0`), and three's `update()` re-derives its spherical state from the
  *current* `camera.position` each frame. So AutoFollow's write becomes
  OrbitControls' synced state next frame — they agree instead of fighting. (This
  was verified against `@react-three/drei@10.7.7` / `three@0.184`.)
- `AutoFollow` receives `active={mode === "auto"}`; its `useFrame` early-returns
  when not active, yielding the camera fully to the user during manual mode.
- **Smooth handoff (resume):** `AutoFollow` is changed so that, instead of calling
  `camera.position.set(...)` each frame, it **lerps** `camera.position` toward the
  computed orbit target (`camera.position.lerp(target, 1 - exp(-RETURN_DAMP·delta))`,
  frame-rate-independent). On the first active frame after a manual session it
  re-seeds `angle.current` from the camera's current XZ azimuth
  (`Math.atan2(camera.position.x, camera.position.z)`) so the azimuth is continuous.
  Net effect: a zoomed-in / rotated manual view **glides** back to the default
  live-tracking orbit (radius `CAMERA_RADIUS`, height `CAMERA_HEIGHT`) instead of
  snapping. The shortest-arc angle easing is retained for tracking the ISS.
- The `useCameraControl` hook is lifted to `App` (it owns both the canvas and the
  overlay); Scene receives `mode`, `onBeginInteraction`, `onEndInteraction` as props.

### Changed: `src/App.jsx`
- Owns `useCameraControl()`, passes `mode` + `beginInteraction` + `endInteraction`
  into `<Scene>` and renders the **Resume pill** as an HTML overlay over the canvas
  section (top-right, under the status badge), shown only when `mode === "manual"`,
  with a Framer Motion fade. Clicking it calls `resume()`.

### New: `src/three/ResumeFollowButton.jsx`
Small presentational pill: `{ onClick }`, teal instrument styling, an `aria-label`,
Framer Motion fade in/out. Lives in `src/three/` because it is a control for the
3D scene's camera (not ISS-domain data). Kept as its own component for clarity.

## Data flow

`App` → `useCameraControl()` → `{mode, beginInteraction, endInteraction, resume}`
- `mode` + `beginInteraction` + `endInteraction` → `<Scene>` (gates AutoFollow,
  wires OrbitControls `onStart`/`onEnd`)
- `mode === "manual"` → render `<ResumeFollowButton onClick={resume}>`

No change to ISS/crew data hooks.

## Testing

- **Unit-test `useCameraControl`** (`useCameraControl.test.js`) with fake timers:
  - starts in `auto`
  - `beginInteraction()` → `manual`
  - `beginInteraction()` then `endInteraction()`, advance `idleMs` → back to `auto`
  - `beginInteraction()` alone (no `endInteraction`), advance past `idleMs` → stays
    `manual` (no timer pending during an active gesture)
  - after `endInteraction()`, a new `beginInteraction()` clears the pending timer
    (does not auto-resume)
  - `resume()` → `auto` and clears the timer
  - timer cleared on unmount (no state update / no fire after unmount)
- **Build + run check:** `npm run build`, then run the dev server and confirm the
  pill toggles. OrbitControls drag is hard to assert in a headless screenshot, so
  mode logic is covered by the hook tests; the visual check confirms wiring +
  pill appearance.

## Out of scope

- Touch-gesture tuning beyond OrbitControls defaults.
- Persisting camera position across reloads.
- A manual "lock onto ISS and zoom" cinematic — possible later polish.
- Changing the auto-follow math itself.
