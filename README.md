# Mission Control

Live 3D dashboard tracking the International Space Station in real time —
position, telemetry, and current crew. Built with React, React Three Fiber,
Framer Motion, and Lenis.

## Develop
```bash
npm install
npm run dev
```

## Test
```bash
npm test
```

## Data sources
- ISS position: wheretheiss.at (no key)
- Crew: Open-Notify, proxied via `/api/astros` (Vercel function) to bypass http-only + flakiness

## Roadmap
- P2 Launch tracker + countdowns
- P3 Solar-system scrollytelling
- P4 NASA APOD + near-Earth asteroids
