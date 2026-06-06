# Mission Control — Design Spec (v1: ISS module)

**Date:** 2026-06-06
**Status:** Approved (design phase)
**Owner:** Aman Chhetri

## Overview

A standalone, space-themed dashboard ("Mission Control") that showcases real
space-data integration paired with strong interaction/motion design and full 3D
rendering. Deployed independently (Vercel) and linked from the portfolio as a
case study.

**Primary goals (chosen by owner):**
1. Real data + API integration skills.
2. Interaction / motion design.

3D rendering is "full 3D everywhere" per owner preference, kept performant via
existing perf-tier patterns.

## Stack

Reuse the portfolio toolchain for consistency and velocity:

- React + Vite
- Tailwind CSS
- Framer Motion (motion / micro-interactions)
- Lenis (smooth scroll)
- React Three Fiber + drei (3D)
- `usePerfTier` pattern (ported from portfolio) for graceful degradation

Rationale: the project demonstrates depth, not tool novelty. No new paradigms.

## Architecture

Single-page scroll experience, built **feature-module-first** so each phase is
isolated and independently shippable.

```
src/
  features/
    iss/        # v1 — globe + telemetry + crew
    launches/   # P2
    system/     # P3 — solar-system scrollytelling
    apod/        # P4
  lib/
    data/       # shared fetch + cache + error/offline layer
  three/        # shared R3F primitives (Globe, lighting, perf)
```

**Boundary rules:**
- Each feature exposes exactly **one data hook** responsible for fetching,
  caching, polling, and loading/error/offline state.
- Presentation components **never fetch** — they receive data via props/context.
- Shared 3D primitives live in `src/three/` and are feature-agnostic.

These boundaries keep each unit understandable in isolation and easy to test.

## v1 Scope — ISS Module

The only module shipped in v1. Everything else is deferred to later phases.

### Features
- **3D Earth globe** (R3F): day/night textures, atmosphere glow, ISS rendered as
  a marker on a live orbital trail.
- **Live ISS position** via `wheretheiss.at` API (no key required; returns
  latitude, longitude, altitude, velocity, visibility). Polled every ~5s.
- **Crew ("who's in space now")** via Open-Notify `astros` endpoint.
- **Telemetry panel**: altitude / velocity / latitude-longitude with count-up
  animations and staggered reveals.
- **Globe auto-follow**: globe gently rotates to keep the ISS in view; subtle
  idle rotation otherwise.
- **Loading skeletons** and an **explicit offline/error state** (visible, not
  hidden).

### Data reliability (senior consideration)
- `wheretheiss.at` is the primary, reliable position source.
- Open-Notify `astros` is **known flaky**: cache the last good response and ship
  a static fallback crew list so the UI never breaks.
- All fetches: abortable, with interval cleanup on unmount.

### Orbital math
- Convert ISS lat/lon/altitude → 3D position on/above the globe surface.
- Maintain a trailing path of recent positions for the orbital trail.

## Cross-Cutting Concerns

- **Data layer**: a small custom `useResource` hook (fetch + interval + cache +
  abort) for v1 rather than React Query — fewer dependencies, demonstrates
  fundamentals. Revisit when P2+ introduces multiple data sources.
- **Identity**: family resemblance to the portfolio's "Quiet Cinematic" dark
  mood, but its own space identity (deep blacks, instrument-panel accents).
- **Performance**: texture sizing per perf tier, capped DPR, render paused when
  the canvas is offscreen.

## Testing

- Unit-test the data hook (mock fetch: success, error, offline, stale-cache).
- Unit-test the lat/lon/altitude → 3D-position orbital math.
- Visual-verify the globe via headless Chrome + SwiftShader screenshot + sharp
  crop (existing portfolio workflow).

## Phasing

| Phase | Scope |
|-------|-------|
| **v1** | ISS globe + crew + telemetry (this spec) |
| P2 | Launch tracker + live countdowns (Launch Library 2) |
| P3 | Solar-system 3D scrollytelling (NASA planetary stats) |
| P4 | APOD hero + near-Earth asteroids (NeoWs) |

## Out of Scope (v1)

- Launch tracking, scrollytelling, APOD, asteroids (later phases).
- User accounts, persistence, or any backend beyond static hosting.
- React Query / global state libraries.

## APIs Referenced

- ISS position: `https://api.wheretheiss.at/v1/satellites/25544` (no key)
- Crew: `http://api.open-notify.org/astros.json` (no key; flaky → fallback)
- (Later) Launch Library 2, NASA APOD, NASA NeoWs
