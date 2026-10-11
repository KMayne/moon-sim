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
| `src/ui/`    | Sidebar controls (Mantine), transport bar, HUD and phase disc panel.          |

Layering is enforced by `no-restricted-imports` in `eslint.config.js`.

## Deployment

Hosted at kianmayne.co.uk/moon-sim/ on DigitalOcean App Platform (the app spec lives in the
kianmayne.co.uk repo). Production builds need the subpath:

```sh
BASE_PATH=/moon-sim/ npm run build
```

## Credits

- **Earth texture:** Blue Marble: Next Generation, NASA Earth Observatory / Reto Stöckli (public
  domain).
- **Moon texture:** CGI Moon Kit, NASA's Scientific Visualization Studio, from LRO data (public
  domain).
- **Ephemerides:** [Astronomy Engine](https://github.com/cosinekitty/astronomy) by Don Cross (MIT).
- **Sky:** [takram three-atmosphere](https://github.com/takram-design-engineering/three-geospatial)
  (MIT), after Eric Bruneton's precomputed atmospheric scattering.
- **Stars:** Yale Bright Star Catalog, 5th revised edition (Hoffleit & Warren), via takram.
- **Place search and names:** [Photon](https://photon.komoot.io), © OpenStreetMap contributors
  (ODbL).
- **Time zones:** [timezone-boundary-builder](https://github.com/evansiroky/timezone-boundary-builder)
  (OpenStreetMap data, ODbL) via `@photostructure/tz-lookup` (CC0).

Asset provenance is in `public/textures/PROVENANCE.md` and `public/atmosphere/PROVENANCE.md`.
Every production build ships `third-party-licenses.md` with the licence texts of all bundled
packages (Vite `build.license`).

## Licence

MIT — see [LICENSE](LICENSE).
