# Space Weather Module — Design Spec

Date: 2026-06-08
Status: Approved (pending user spec review)
Phase: 1 of 3 (API expansion: Space Weather → Launches → Imagery & Exploration)

## Goal

Add a live **Space Weather** feature to the Mission Control dashboard, combining
real-time NOAA SWPC solar/geomagnetic telemetry with NASA DONKI space-weather
event notifications. The module surfaces as a scrolling section below the existing
globe hero, and additionally drives an **aurora glow shader on the 3D Earth**
whose intensity tracks the planetary Kp index.

This is the first phase of a larger expansion. It also builds the **shared
infrastructure** (NASA-key proxy pattern, Lenis scroll shell) that Phases 2–3 reuse.

## Scope

In scope:
- NOAA SWPC live telemetry: planetary **Kp index**, **solar wind** speed & density.
- Derived **aurora likelihood** status (from Kp), shown in the panel and as a
  globe glow.
- NASA **DONKI** notifications feed (flares / CME / geomagnetic storms), proxied.
- New `space-weather` feature module + presentation panel.
- 3D Earth **aurora glow** tied to Kp index.
- Shared infra: NASA proxy convention, `.env` handling, Lenis scroll shell, a
  reusable scroll-reveal section wrapper.

Out of scope (deferred):
- N2YO satellite tracking (dropped this round).
- Phases 2–3 modules (launches, imagery, exploration).
- Parsing NOAA's Ovation aurora coordinate grid — aurora is derived from Kp instead.
- Per-hemisphere / geographic aurora positioning on the globe (uniform glow for now).

## Architecture

Follows the established feature-module convention exactly. Presentation components
never fetch; all data flows through the existing `useResource` polling hook
(abort + last-good-degrade + `isStale`).

### Data sources & access patterns

| Source | Key? | CORS? | Access pattern |
|---|---|---|---|
| NOAA SWPC Kp | no | yes | direct client fetch |
| NOAA SWPC solar wind (plasma + mag) | no | yes | direct client fetch |
| NASA DONKI notifications | yes | n/a | **Vercel proxy** `api/donki.js` |

Endpoints:
- Kp: `https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json`
  — an **array of objects** `{time_tag, Kp, a_running, station_count}` (verified
  live 2026-06-08), `Kp` is a number, at 3-hour cadence. Parser reads the latest
  entry's `Kp`. (Note: this product is NOT the header-row array-of-arrays shape the
  solar-wind products use — they differ.)
- Solar wind plasma: `https://services.swpc.noaa.gov/products/solar-wind/plasma-1-day.json`
  — array-of-arrays, header `["time_tag","density","speed","temperature"]`. Latest row → speed (km/s), density (p/cm³).
- DONKI: `https://api.nasa.gov/DONKI/notifications?type=all&startDate=…` via proxy,
  key injected server-side. Each item: `messageType` (CME/FLR/GST/IPS/RBE/Report),
  `messageID`, `messageURL`, `messageIssueTime`, `messageBody`. We display the most
  recent non-Report events; `messageBody` is truncated to a summary line.

### Shared infrastructure (built here, reused by Phases 2–3)

1. **NASA proxy convention** — `api/<endpoint>.js` Vercel functions that build the
   upstream URL with `process.env.NASA_API_KEY`, set `Cache-Control`
   `s-maxage` + `stale-while-revalidate`, and return JSON. Mirrors the existing
   `api/astros.js`. `api/donki.js` is the first instance.
2. **Env handling** — `NASA_API_KEY` in `.env.local` (local) and Vercel project env
   (prod). `.gitignore` widened from `.env` to `.env*`. A committed `.env.example`
   documents the variable. Key is never bundled client-side.
3. **Lenis scroll shell** — `App.jsx` becomes a smooth-scroll page. A small
   `useLenis` setup (respecting `prefers-reduced-motion`) plus a reusable
   `<RevealSection>` wrapper (Framer `whileInView`, motion-safe) that all future
   sections use.

### Module layout

```
src/features/space-weather/
  spaceWeatherApi.js        # fetchKp, fetchSolarWind, parse helpers, auroraLevel(kp)
  spaceWeatherApi.test.js   # parsing + auroraLevel thresholds + malformed-row guards
  donkiApi.js               # fetchDonkiEvents(signal) → normalized event list
  donkiApi.test.js
  useSpaceWeather.js        # useResource(Kp+solar wind), polls 60s
  useDonki.js               # useResource(DONKI), polls 15m
  KpGauge.jsx               # radial/arc gauge, 0–9 scale, color by severity
  SolarWindReadout.jsx      # speed + density count-ups (reuse CountUp)
  AuroraStatus.jsx          # derived likelihood badge (Quiet→Storm)
  DonkiFeed.jsx             # recent events list (type chip + time + summary + link)
  SpaceWeatherPanel.jsx     # composes the four above into the section
```

3D:
```
src/three/AuroraGlow.jsx    # additive shader ring/halo on Earth; intensity = f(kp)
```
`Scene.jsx` renders `<AuroraGlow kp={…} />`; Kp is lifted to `App.jsx` and passed
to both the panel and the Scene (single source of truth, no duplicate fetch).

### Aurora derivation

`auroraLevel(kp)` maps Kp → { label, intensity 0–1 }:
- Kp < 3 → "Quiet" (0.15)
- 3 ≤ Kp < 5 → "Active" (0.4)
- 5 ≤ Kp < 7 → "Storm" (0.7)
- Kp ≥ 7 → "Severe Storm" (1.0)

The same `intensity` drives the `AuroraGlow` shader opacity/scale and the
`AuroraStatus` badge. Pure function, unit-tested at the thresholds.

## Data flow

```
App.jsx
 ├─ useSpaceWeather() → { kp, solarWind, isStale }   (60s poll)
 ├─ useDonki()        → { events, isStale }           (15m poll, via proxy)
 ├─ passes kp → <Scene><AuroraGlow intensity={auroraLevel(kp).intensity}/>
 └─ <SpaceWeatherPanel kp solarWind events ... /> inside <RevealSection>
```

## Error handling

- Reuses `useResource` semantics: failures degrade to last-good data, surface via
  `isStale`; never blank out a populated panel.
- Malformed/empty SWPC arrays → parser returns `null` for that metric; components
  render an em-dash placeholder rather than throwing.
- DONKI proxy failure → 502 from the function (like `astros.js`); hook keeps
  last-good events; feed shows a quiet "events unavailable" state when empty.
- `AuroraGlow` defaults to the "Quiet" intensity when Kp is null, so the globe
  never flickers to nothing.

## Testing

- `spaceWeatherApi.test.js`: header-row stripping, latest-row selection, numeric
  coercion, malformed-row guard, `auroraLevel` at each threshold boundary.
- `donkiApi.test.js`: normalization, Report filtering, summary truncation, empty list.
- Follows existing vitest setup; aim to keep the suite green (currently 35 tests).
- Headless SwiftShader screenshot to confirm the aurora glow renders and tracks a
  mocked high-Kp value (per the established `reference_verify_3d_scene` method).

## Deployment notes

- Add `NASA_API_KEY` to Vercel project env before deploying.
- `api/donki.js` runs only on Vercel; locally the DONKI feed shows its
  unavailable/last-good state (same as `astros` in v1) — expected.
- Widen `.gitignore` to `.env*`; commit `.env.example`.
- The user pasted the NASA key in chat — recommend regenerating it at api.nasa.gov
  after deploy as hygiene.

## Open risks

- SWPC product schemas are positional arrays; if NOAA reorders columns the parser
  breaks. Mitigated by reading the header row where present and guarding types.
- DONKI `messageBody` is free-text; summary extraction is best-effort (first
  meaningful line), not structured.
