// Facilities inside Liliw for the app demo, from OpenStreetMap (© OSM contributors, ODbL).
// Source: tools/data/osm-facilities.json, an Overpass export over the terrain bbox:
//   nwr["amenity"~"hospital|clinic|doctors|fire_station|police|townhall|school"](bbox); nwr["healthcare"](bbox); out center tags;
// Run: node tools/build_facilities.mjs  ->  src/terrain/facilities.json
import fs from "node:fs";

const d = JSON.parse(fs.readFileSync("public/liliw-terrain.json", "utf8"));
const osm = JSON.parse(fs.readFileSync("tools/data/osm-facilities.json", "utf8"));
const { north: n, south: s, west: w, east: e } = d.bbox;
const KIND = { hospital: "health", clinic: "health", doctors: "health", health_post: "health", fire_station: "fire", police: "police", school: "school" };

// even-odd point in polygon, in the terrain's uv space
const inside = (u, v, ring) => {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > v !== yj > v && u < ((xj - xi) * (v - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};

const out = [];
for (const el of osm.elements) {
  const kind = KIND[el.tags.amenity] || KIND[el.tags.healthcare];
  const name = el.tags.name;
  if (!kind || !name || out.some((f) => f.name === name)) continue;
  const { lat, lon } = el.center || el;
  const uv = [+((lon - w) / (e - w)).toFixed(5), +((n - lat) / (n - s)).toFixed(5)];
  const bgy = d.barangays.find((b) => b.rings.some((r) => inside(uv[0], uv[1], r)));
  if (bgy) out.push({ kind, name, bgy: bgy.name, lat: +lat.toFixed(6), lon: +lon.toFixed(6), uv });
}
fs.writeFileSync("src/terrain/facilities.json", JSON.stringify(out, null, 1) + "\n");
console.log(`${out.length} facilities inside Liliw`);
for (const f of out) console.log(`  ${f.kind.padEnd(7)} ${f.name} · ${f.bgy}`);
