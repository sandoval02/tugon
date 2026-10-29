# TUGON public site

Official website of TUGON, the emergency response app of MAT / MDRRMO Liliw, Laguna. Live at
**[tugon.live](https://tugon.live)**.

Residents use it to download the app, read the user manual, and find emergency hotlines and the FAQ.
The top of the page is a scroll story rendered live in 3D from real data: a printed relief of Liliw,
a fall through the clouds onto the map, all 33 barangays (tap one to lift it out), and a simulated
responder driving a real road route to an incident.

Stack: Vite + React, three.js via @react-three/fiber/drei, GSAP (ScrollTrigger, SplitText).
Dark and light mode follow the device (toggle in the header); reduced motion is respected.

## Run it

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm build      # static site in dist/
pnpm preview    # serve dist/ locally
```

Deploy: upload `dist/` to any static host (Netlify, Vercel, GitHub Pages, Render static).
Paths are relative, so it also works from a sub-folder.

## Publishing a new app version

The APK is over 100 MB, too big for git, so it ships as a **GitHub Release asset**. The Download
button links to `releases/latest/download/tugon.apk`, so it always serves the newest release.

1. Build the app in `tugon_flutter/tugon`: `flutter build apk --release`
   (output: `build/app/outputs/flutter-apk/app-release.apk`).
2. Rename the file to exactly `tugon.apk`.
3. On GitHub: **Releases → Draft a new release**, create the tag (e.g. `v1.0.2`), attach `tugon.apk`,
   keep **Set as the latest release** checked, and publish.
4. Update `RELEASE.version` in `src/content.js` to the same number, then rebuild and redeploy the
   site so the label next to the button matches.

The iPhone build (`tugon.ipa`, built on a Mac or Codemagic) still goes in `public/downloads/`.
Until that file exists, its button shows "Coming soon" automatically.

## Editing

| What | Where |
| --- | --- |
| Page copy, hotlines, manual topics, FAQ | `src/content.js` |
| Release version and download links | `RELEASE` in `src/content.js` |
| Install steps on each download card | `INSTALL` in `src/content.js` |
| 3D story and app demo | `src/story/` |
| Terrain building and materials | `src/terrain/` |
| Vehicle models (Kenney, CC0) | `public/models/` |

## Map data

`public/liliw-terrain.json` bakes elevation (AWS Terrain Tiles, SRTM z14), barangay cells and
outlines (PSA/NAMRIA 2023, `tools/data/liliw-barangays.geojson`) and the demo route
(OSRM / OpenStreetMap, `tools/data/route-osrm.json`):

```bash
pip install numpy pillow
pnpm terrain      # python tools/build_terrain.py --grid 320
```

Facilities shown in the app demo (hospitals, clinics, fire and police stations, schools) come from
an OpenStreetMap Overpass export (`tools/data/osm-facilities.json`, © OSM contributors, ODbL):

```bash
pnpm facilities   # node tools/build_facilities.mjs -> src/terrain/facilities.json
```
