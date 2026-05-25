# BoxBoxBox

Modern overlays for iRacing. Single-monitor. No subscription.

## Setup

```bash
npm install
npm start
```

On Mac/Linux (or Windows without iRacing running), the app starts in **mock mode** with synthetic data — no iRacing needed for development.

### Windows — full iRacing telemetry

Real telemetry depends on `node-irsdk-2023`, which compiles a native addon and is listed as an `optionalDependency`. If the build fails, npm hides the error and the app silently falls back to mock mode. To get real data:

1. **Install MSVC Build Tools** (one-time, required by `node-gyp`):
   ```powershell
   winget install Microsoft.VisualStudio.2022.BuildTools --override "--wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
   ```
2. **Reinstall the native addon** with foreground logs so failures aren't hidden:
   ```bash
   npm install node-irsdk-2023 --foreground-scripts
   ```
3. **Don't upgrade Electron past 33.x.** `node-irsdk-2023@2.1.8` pulls in `nan@2.27`, which uses old `v8::External` signatures that no longer compile against the V8 in Electron 34+. The pinned range in `package.json` (`^33.x`) is intentional.

### Windows — Electron binary fails to extract

The Electron postinstall sometimes downloads the binary but fails silently during zip extraction, leaving `node_modules/electron/path.txt` missing. Symptom:

```
Error: ENOENT: no such file or directory, open 'node_modules\electron\path.txt'
```

Fix:

```bash
npm run fix-electron
```

This re-downloads the matching Electron build, extracts it via PowerShell, and writes `path.txt`. Run after any `npm install` that breaks the binary.

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
