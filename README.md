# BoxBoxBox

Modern overlays for iRacing. Single-monitor. No subscription.

## Setup

```bash
npm install
npm start
```

On Mac/Linux (or Windows without iRacing running), the app starts in **mock mode** with synthetic data — no iRacing needed for development.

## Shortcuts

| Key | Action |
|-----|--------|
| `F9` | Toggle edit mode (drag/resize overlays) |
| `F10` | Hide/show all overlays |

## Overlays

- **Relative** — nearby cars with session-aware delta (race gap / qualy best lap)
- **Inputs** — throttle, brake, clutch trace (5s) + steering bar
- **Fuel** — level, consumption, laps remaining, target, delta
- **Tires** — hot pressure + carcass temps with auto-calibration per car
- **Track Map** — self-building SVG from first lap, numbered car dots
- **Standings** — full leaderboard with multiclass grouping, purple fastest lap, iR estimator
- **Spotter** — top-down proximity radar (8-slot, color-coded by distance)

## Tests

```bash
npm test
```

## Stack

Electron + node-irsdk-2023 + HTML/CSS/JS vanilla. No React, no build pipeline.
