# Moon Sim

Browser-based 3D Earth–Moon–Sun simulator. Every body's position and rotation is computed from a
single simulated timestamp via [astronomy-engine](https://github.com/cosinekitty/astronomy) — never
accumulated per frame — so true rate ratios hold at any playback speed.

## Development

Requires Node 26 (`nvm use`).

```sh
npm install
npm run dev        # local dev server
npm test           # Vitest (astronomy + acceptance checks)
npm run lint       # ESLint, including layering rules
npm run typecheck
npm run build
```

## Layout

| Path         | Role                                                                          |
| ------------ | ----------------------------------------------------------------------------- |
| `src/astro/` | Pure ephemeris layer. Imports only astronomy-engine.                          |
| `src/sim/`   | Pure clock + scene math (frames, visual-aid scaling). Depends only on astro/. |
| `src/state/` | zustand store: settings and the single sim clock.                             |
| `src/scene/` | React Three Fiber views.                                                      |
| `src/ui/`    | Controls (Leva, confined to `Controls.tsx`) and HUD.                          |

Layering is enforced by `no-restricted-imports` in `eslint.config.js`.

## Deployment

Hosted at kianmayne.co.uk/moon-sim/ on DigitalOcean App Platform (the app spec lives in the
kianmayne.co.uk repo). Production builds need the subpath:

```sh
BASE_PATH=/moon-sim/ npm run build
```
