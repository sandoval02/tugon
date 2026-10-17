# TUGON public site

Landing page with APK/IPA downloads, the citizen user manual, hotlines and FAQ.
The top of the page is a scroll story rendered live in 3D from real data: a printed relief of Liliw,
a fall through the clouds onto the map, all 33 barangays (tap one to lift it out), and a simulated
responder driving a real road route to an incident.

Stack: Vite + React, three.js via @react-three/fiber/drei, GSAP (ScrollTrigger, SplitText).
Dark + light mode (follows the device, toggle in the header); respects reduced motion.

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm build      # static site in dist/
pnpm preview    # serve dist/ locally
```

Deploy: upload `dist/` to any static host (Netlify, Vercel, GitHub Pages, Render static).
It uses relative paths, so it also works from a sub-folder.

## Editing

- Page copy, hotlines, manual topics, FAQ: `src/content.js`
- Release version and download paths: `RELEASE` in `src/content.js`
- Release files: put `tugon.apk` / `tugon.ipa` in `public/downloads/` (see the README there).
  Until a file exists its button shows "Coming soon" automatically.

## Terrain data

`public/liliw-terrain.json` bakes elevation (AWS Terrain Tiles, SRTM z14), barangay cells and outlines
(PSA/NAMRIA 2023, `tools/data/liliw-barangays.geojson`) and the demo route
(OSRM / OpenStreetMap, `tools/data/route-osrm.json`):

```bash
pip install numpy pillow
pnpm terrain    # python tools/build_terrain.py --grid 320
```
