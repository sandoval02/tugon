"""Build public/liliw-terrain.json — the elevation model, barangays and demo route behind the 3D story.

Source data
- Elevation: AWS Open Data "Terrain Tiles" (Terrarium PNG encoding, ~30 m SRTM-based, public).
- Barangays: PSA/NAMRIA 2023 boundaries for Liliw (PSGC 0403410000), via faeldon/philippines-json-maps,
  saved in tools/data/liliw-barangays.geojson.
- Route: one real road route from the municipal hall to Ilayang Sungi (OSRM / OpenStreetMap),
  saved in tools/data/route-osrm.json.

Usage:  python tools/build_terrain.py [--cache DIR] [--grid 320]
Needs Pillow + numpy. Downloaded tiles are cached in --cache (default: a temp folder).
"""
import argparse, base64, json, math, os, tempfile, urllib.request

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(HERE)
BARANGAYS = os.path.join(HERE, "data", "liliw-barangays.geojson")
ROUTE = os.path.join(HERE, "data", "route-osrm.json")
TILE_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
ZOOM = 14
NONE = 255

# Places drawn on the model (lat, lon).
LANDMARKS = [
    {"id": "hq", "label": "MAT Liliw · Municipal Hall", "lat": 14.130578, "lon": 121.436356},
    {"id": "incident", "label": "Incident · Ilayang Sungi", "lat": 14.096556, "lon": 121.463119},
]


def lonlat_to_tile(lon, lat, z):
    n = 2 ** z
    x = (np.asarray(lon) + 180) / 360 * n
    y = (1 - np.arcsinh(np.tan(np.radians(lat))) / math.pi) / 2 * n
    return x, y


def fetch_tile(z, x, y, cache):
    path = os.path.join(cache, f"{z}_{x}_{y}.png")
    if not os.path.exists(path):
        req = urllib.request.Request(TILE_URL.format(z=z, x=x, y=y), headers={"User-Agent": "tugon-site-build"})
        with urllib.request.urlopen(req, timeout=30) as r, open(path, "wb") as f:
            f.write(r.read())
    img = Image.open(path).convert("RGB")
    a = np.asarray(img, dtype=np.float64)
    return a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768  # metres


def point_in_poly(x, y, poly):
    """Vectorised even-odd test. x, y: arrays; poly: list of (x, y)."""
    inside = np.zeros(x.shape, dtype=bool)
    n = len(poly)
    j = n - 1
    for i in range(n):
        xi, yi = poly[i]
        xj, yj = poly[j]
        cond = ((yi > y) != (yj > y)) & (x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-12) + xi)
        inside ^= cond
        j = i
    return inside


def load_barangays():
    out = []
    for f in json.load(open(BARANGAYS, encoding="utf-8"))["features"]:
        g = f["geometry"]
        polys = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
        out.append({"name": f["properties"]["adm4_en"], "psgc": f["properties"]["adm4_psgc"], "polys": polys})
    out.sort(key=lambda b: b["name"])
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache", default=os.path.join(tempfile.gettempdir(), "tugon_terrain_tiles"))
    ap.add_argument("--grid", type=int, default=320, help="cells along the longer side")
    args = ap.parse_args()
    os.makedirs(args.cache, exist_ok=True)

    bgys = load_barangays()
    lons = [x for b in bgys for p in b["polys"] for x, _ in p[0]]
    lats = [y for b in bgys for p in b["polys"] for _, y in p[0]]
    pad = 0.004
    s, n_, w, e = min(lats) - pad, max(lats) + pad, min(lons) - pad, max(lons) + pad

    # Stitch the covering tiles into one elevation raster.
    x0, y1 = lonlat_to_tile(w, s, ZOOM)
    x1, y0 = lonlat_to_tile(e, n_, ZOOM)
    tx0, tx1, ty0, ty1 = int(float(x0)), int(float(x1)), int(float(y0)), int(float(y1))
    rows = []
    for ty in range(ty0, ty1 + 1):
        rows.append(np.concatenate([fetch_tile(ZOOM, tx, ty, args.cache) for tx in range(tx0, tx1 + 1)], axis=1))
    big = np.concatenate(rows, axis=0)

    # Resample onto a regular lat/lon grid with metric aspect ratio.
    km_x = (e - w) * 111.32 * math.cos(math.radians((s + n_) / 2))
    km_y = (n_ - s) * 110.57
    if km_x >= km_y:
        gw, gh = args.grid, max(8, round(args.grid * km_y / km_x))
    else:
        gh, gw = args.grid, max(8, round(args.grid * km_x / km_y))
    lon_g = np.linspace(w, e, gw)
    lat_g = np.linspace(n_, s, gh)  # row 0 = north
    LON, LAT = np.meshgrid(lon_g, lat_g)
    px, py = lonlat_to_tile(LON, LAT, ZOOM)
    fx = (px - tx0) * 256
    fy = (py - ty0) * 256
    xi = np.clip(fx.astype(int), 0, big.shape[1] - 2)
    yi = np.clip(fy.astype(int), 0, big.shape[0] - 2)
    dx, dy = fx - xi, fy - yi
    elev = (big[yi, xi] * (1 - dx) * (1 - dy) + big[yi, xi + 1] * dx * (1 - dy)
            + big[yi + 1, xi] * (1 - dx) * dy + big[yi + 1, xi + 1] * dx * dy)

    # Each grid cell belongs to the barangay that contains its centre (so the pieces tile with no gaps).
    CLON, CLAT = np.meshgrid((lon_g[:-1] + lon_g[1:]) / 2, (lat_g[:-1] + lat_g[1:]) / 2)
    cells = np.full(CLON.shape, NONE, dtype=np.uint8)
    for k, b in enumerate(bgys):
        hit = np.zeros(CLON.shape, dtype=bool)
        for poly in b["polys"]:
            for ring in poly:  # even-odd across rings handles holes
                hit ^= point_in_poly(CLON, CLAT, ring)
        cells[hit & (cells == NONE)] = k

    used = cells != NONE
    corner = np.zeros(elev.shape, dtype=bool)  # grid points touched by any used cell
    corner[:-1, :-1] |= used; corner[1:, :-1] |= used; corner[:-1, 1:] |= used; corner[1:, 1:] |= used
    lo, hi = float(elev[corner].min()), float(elev[corner].max())
    norm = np.clip((elev - lo) / (hi - lo), 0, 1)
    q = (norm * 65535).round().astype("<u2")

    def to_uv(lat, lon):
        return [round((lon - w) / (e - w), 5), round((n_ - lat) / (n_ - s), 5)]

    cell_km2 = (km_x / (gw - 1)) * (km_y / (gh - 1))
    meta = []
    for k, b in enumerate(bgys):
        mine = cells == k
        ce = elev[:-1, :-1][mine]
        meta.append({
            "name": b["name"],
            "psgc": b["psgc"],
            "area_km2": round(float(mine.sum()) * cell_km2, 2),
            "elev_m": [round(float(ce.min())), round(float(ce.max()))] if ce.size else [0, 0],
            "rings": [[to_uv(la, lo_) for lo_, la in poly[0]] for poly in b["polys"]],
        })

    r = json.load(open(ROUTE, encoding="utf-8"))["routes"][0]
    route = {
        "distance_m": round(r["distance"]),
        "duration_s": round(r["duration"]),
        "points": [to_uv(la, lo_) for lo_, la in r["geometry"]["coordinates"]],
    }

    out = {
        "source": "AWS Terrain Tiles (z14) · PSA/NAMRIA 2023 barangay boundaries · OSRM/OpenStreetMap route",
        "w": gw, "h": gh,
        "bbox": {"south": s, "north": n_, "west": w, "east": e},
        "km": {"x": round(km_x, 3), "y": round(km_y, 3)},
        "elevation_m": {"min": round(lo, 1), "max": round(hi, 1)},
        "heights": base64.b64encode(q.tobytes()).decode(),
        "cells": base64.b64encode(cells.tobytes()).decode(),  # (h-1) x (w-1), barangay index or 255
        "barangays": meta,
        "route": route,
        "landmarks": [{**lm, "uv": to_uv(lm["lat"], lm["lon"])} for lm in LANDMARKS],
    }
    dst = os.path.join(SITE, "public", "liliw-terrain.json")
    with open(dst, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"grid {gw}x{gh}, {int(used.sum())} cells in {len(bgys)} barangays, elevation {lo:.0f}-{hi:.0f} m, "
          f"{km_x:.1f} x {km_y:.1f} km, route {route['distance_m']} m -> {dst} ({os.path.getsize(dst) // 1024} KB)")
    empty = [m["name"] for m in meta if m["area_km2"] == 0]
    assert not empty, f"barangays with no cells: {empty}"


if __name__ == "__main__":
    main()
