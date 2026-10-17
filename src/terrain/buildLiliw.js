import * as THREE from "three";

// Turns public/liliw-terrain.json into world-space geometry:
// - one solid piece per barangay (terrain top + side walls + an "iceberg" underside that
//   is flat until the piece is lifted), tiling the municipality with no gaps,
// - draped barangay outlines, the demo route, landmarks, and a faint context terrain.
// Every vertex carries `aElev` (0 = lowest point in Liliw, 1 = highest) for the shaders.

const NONE = 255;

function decode(b64, Type) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Type(bytes.buffer);
}

// deterministic 0..1 noise per grid point (keeps the iceberg the same on every load)
const hash = (i, j) => {
  const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

export function buildLiliw(d, { size = 10, exaggeration = 1.7, base = -0.32, contextStride = 2 } = {}) {
  const { w, h } = d;
  const cw = w - 1, ch = h - 1;
  const heights = decode(d.heights, Uint16Array);
  const cells = decode(d.cells, Uint8Array);
  const hn = (i, j) => heights[j * w + i] / 65535;
  const cell = (i, j) => (i < 0 || j < 0 || i >= cw || j >= ch ? NONE : cells[j * cw + i]);

  const S = size / Math.max(d.km.x, d.km.y);
  const sx = d.km.x * S, sz = d.km.y * S;
  const topScale = ((d.elevation_m.max - d.elevation_m.min) / 1000) * S * exaggeration;
  const X = (i) => (i / (w - 1) - 0.5) * sx;
  const Z = (j) => (j / (h - 1) - 0.5) * sz;
  const Y = (e) => e * topScale;
  const baseElev = base / topScale;
  const cellSize = sx / (w - 1);

  // bilinear height lookup at uv (0..1), in normalised elevation
  const elevAt = (u, v) => {
    const fx = Math.min(Math.max(u * (w - 1), 0), w - 1.001), fy = Math.min(Math.max(v * (h - 1), 0), h - 1.001);
    const i = Math.floor(fx), j = Math.floor(fy), a = fx - i, b = fy - j;
    return hn(i, j) * (1 - a) * (1 - b) + hn(i + 1, j) * a * (1 - b) + hn(i, j + 1) * (1 - a) * b + hn(i + 1, j + 1) * a * b;
  };
  const world = (u, v, lift = 0) => new THREE.Vector3((u - 0.5) * sx, Y(elevAt(u, v)) + lift, (v - 0.5) * sz);

  // distance (in cells) from each cell to the edge of its own barangay; shapes the iceberg
  const dist = new Uint16Array(cw * ch);
  const queue = [];
  for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
    const k = cells[j * cw + i];
    if (k === NONE) continue;
    if (cell(i - 1, j) !== k || cell(i + 1, j) !== k || cell(i, j - 1) !== k || cell(i, j + 1) !== k) {
      dist[j * cw + i] = 1;
      queue.push(j * cw + i);
    }
  }
  for (let q = 0; q < queue.length; q++) {
    const c = queue[q], i = c % cw, j = (c - i) / cw, k = cells[c];
    for (const [ni, nj] of [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]]) {
      if (cell(ni, nj) !== k) continue;
      const n = nj * cw + ni;
      if (!dist[n]) { dist[n] = dist[c] + 1; queue.push(n); }
    }
  }

  const pieces = d.barangays.map((meta, index) => ({ index, meta, cells: [], maxDist: 1, anchor: null }));
  for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
    const k = cells[j * cw + i];
    if (k === NONE) continue;
    const p = pieces[k];
    p.cells.push(i, j);
    const dd = dist[j * cw + i];
    if (dd >= p.maxDist) { p.maxDist = dd; p.anchorCell = [i, j]; }
  }

  for (const p of pieces) {
    const k = p.index;
    // ---- top surface ----
    const idx = new Map();
    const pos = [], elev = [], tri = [];
    const vert = (i, j) => {
      const key = j * w + i;
      let v = idx.get(key);
      if (v === undefined) {
        v = pos.length / 3;
        idx.set(key, v);
        const e = hn(i, j);
        pos.push(X(i), Y(e), Z(j));
        elev.push(e);
      }
      return v;
    };
    // ---- walls ----
    const wp = [], wn = [], we = [];
    const pushTri = (pts, n, e) => { for (let t = 0; t < 3; t++) { wp.push(...pts[t]); wn.push(...n); we.push(e[t]); } };
    const wall = (i0, j0, i1, j1, n) => {
      const e0 = hn(i0, j0), e1 = hn(i1, j1);
      const a = [X(i0), Y(e0), Z(j0)], b = [X(i1), Y(e1), Z(j1)];
      const A = [X(i0), base, Z(j0)], B = [X(i1), base, Z(j1)];
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [A[0] - a[0], A[1] - a[1], A[2] - a[2]];
      const cx = u[1] * v[2] - u[2] * v[1], cy = u[2] * v[0] - u[0] * v[2], cz = u[0] * v[1] - u[1] * v[0];
      if (cx * n[0] + cy * n[1] + cz * n[2] > 0) { pushTri([a, b, A], n, [e0, e1, baseElev]); pushTri([b, B, A], n, [e1, baseElev, baseElev]); }
      else { pushTri([b, a, B], n, [e1, e0, baseElev]); pushTri([a, A, B], n, [e0, baseElev, baseElev]); }
    };
    // ---- iceberg underside (relative to the base plane; scaled in y when lifted) ----
    const uIdx = new Map();
    const up = [], ue = [], ut = [];
    const depthScale = cellSize * p.maxDist * 1.7;
    const uvert = (i, j) => {
      const key = j * w + i;
      let v = uIdx.get(key);
      if (v === undefined) {
        v = up.length / 3;
        uIdx.set(key, v);
        const around = [cell(i - 1, j - 1), cell(i, j - 1), cell(i - 1, j), cell(i, j)];
        let depth = 0;
        if (around.every((c) => c === k)) {
          const dd = (dist[(j - 1) * cw + i - 1] + dist[(j - 1) * cw + i] + dist[j * cw + i - 1] + dist[j * cw + i]) / 4 - 0.5;
          depth = depthScale * Math.pow(dd / p.maxDist, 0.62) * (0.8 + 0.4 * hash(i, j));
        }
        up.push(X(i), -depth, Z(j));
        ue.push(baseElev - depth / topScale);
      }
      return v;
    };

    for (let c = 0; c < p.cells.length; c += 2) {
      const i = p.cells[c], j = p.cells[c + 1];
      const a = vert(i, j), b = vert(i + 1, j), cc = vert(i, j + 1), dd = vert(i + 1, j + 1);
      tri.push(a, cc, b, b, cc, dd);
      if (cell(i, j - 1) !== k) wall(i, j, i + 1, j, [0, 0, -1]);
      if (cell(i, j + 1) !== k) wall(i, j + 1, i + 1, j + 1, [0, 0, 1]);
      if (cell(i - 1, j) !== k) wall(i, j, i, j + 1, [-1, 0, 0]);
      if (cell(i + 1, j) !== k) wall(i + 1, j, i + 1, j + 1, [1, 0, 0]);
      const ua = uvert(i, j), ub = uvert(i + 1, j), uc = uvert(i, j + 1), ud = uvert(i + 1, j + 1);
      ut.push(ua, ub, uc, ub, ud, uc); // faces down
    }

    p.top = new THREE.BufferGeometry();
    p.top.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    p.top.setAttribute("aElev", new THREE.Float32BufferAttribute(elev, 1));
    p.top.setIndex(tri);
    p.top.computeVertexNormals();

    p.walls = new THREE.BufferGeometry();
    p.walls.setAttribute("position", new THREE.Float32BufferAttribute(wp, 3));
    p.walls.setAttribute("normal", new THREE.Float32BufferAttribute(wn, 3));
    p.walls.setAttribute("aElev", new THREE.Float32BufferAttribute(we, 1));

    const under = new THREE.BufferGeometry();
    under.setAttribute("position", new THREE.Float32BufferAttribute(up, 3));
    under.setAttribute("aElev", new THREE.Float32BufferAttribute(ue, 1));
    under.setIndex(ut);
    p.under = under.toNonIndexed(); // flat-shaded facets read as rock
    p.under.computeVertexNormals();
    under.dispose();

    const [ai, aj] = p.anchorCell || [p.cells[0], p.cells[1]];
    p.anchor = new THREE.Vector3(X(ai + 0.5), Y(hn(ai, aj)), Z(aj + 0.5));
    p.lift = Math.max(0.9, depthScale + 0.5);
    // outlines, densified so they follow the terrain
    p.rings = p.meta.rings.map((ring) => {
      const pts = [];
      for (let r = 0; r < ring.length; r++) {
        const [u0, v0] = ring[r], [u1, v1] = ring[(r + 1) % ring.length];
        const steps = Math.max(1, Math.ceil(Math.hypot((u1 - u0) * sx, (v1 - v0) * sz) / (cellSize * 0.7)));
        for (let s = 0; s < steps; s++) pts.push(world(u0 + ((u1 - u0) * s) / steps, v0 + ((v1 - v0) * s) / steps, 0.014));
      }
      pts.push(pts[0].clone());
      return pts;
    });
    delete p.cells;
  }

  // ---- surrounding terrain (context ghost, coarser) ----
  const gw = Math.floor((w - 1) / contextStride) + 1, gh = Math.floor((h - 1) / contextStride) + 1;
  const cp = [], ce = [], ci = [];
  for (let jj = 0; jj < gh; jj++) for (let ii = 0; ii < gw; ii++) {
    const i = Math.min(ii * contextStride, w - 1), j = Math.min(jj * contextStride, h - 1);
    const e = hn(i, j);
    cp.push(X(i), Y(e) - 0.02, Z(j));
    ce.push(e);
  }
  for (let jj = 0; jj < gh - 1; jj++) for (let ii = 0; ii < gw - 1; ii++) {
    const a = jj * gw + ii, b = a + 1, c = a + gw, dd = c + 1;
    ci.push(a, c, b, b, c, dd);
  }
  const context = new THREE.BufferGeometry();
  context.setAttribute("position", new THREE.Float32BufferAttribute(cp, 3));
  context.setAttribute("aElev", new THREE.Float32BufferAttribute(ce, 1));
  context.setIndex(ci);

  // ---- route (draped) with cumulative length for arc-length animation ----
  const routePts = d.route.points.map(([u, v]) => world(u, v, 0.03));
  const routeLen = [0];
  for (let r = 1; r < routePts.length; r++) routeLen.push(routeLen[r - 1] + routePts[r].distanceTo(routePts[r - 1]));

  let peak = { e: -1, i: 0, j: 0 };
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    if (cell(i, j) === NONE && cell(i - 1, j - 1) === NONE) continue;
    if (hn(i, j) > peak.e) peak = { e: hn(i, j), i, j };
  }

  const landmarks = Object.fromEntries(d.landmarks.map((l) => [l.id, { ...l, position: world(l.uv[0], l.uv[1]) }]));
  return {
    pieces, context,
    route: { points: routePts, lengths: routeLen, total: routeLen[routeLen.length - 1], meters: d.route.distance_m, seconds: d.route.duration_s },
    landmarks,
    size: { x: sx, z: sz, top: topScale, base },
    contourStep: 100 / (d.elevation_m.max - d.elevation_m.min), // one line per 100 m
    peak: { position: new THREE.Vector3(X(peak.i), Y(peak.e), Z(peak.j)), meters: Math.round(d.elevation_m.max) },
    world,
    kmPerUnit: d.km.y / sz,
    // index of the barangay under a world point (-1 outside Liliw)
    pieceAt: (x, z) => {
      const k = cell(Math.floor((x / sx + 0.5) * cw), Math.floor((z / sz + 0.5) * ch));
      return k === NONE ? -1 : k;
    },
  };
}

// One build per terrain JSON, shared by the story map and the app demo.
const builds = new WeakMap();
export function getLiliw(d) {
  if (!builds.has(d)) builds.set(d, buildLiliw(d));
  return builds.get(d);
}
