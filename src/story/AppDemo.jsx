import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html, Line, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import gsap from "gsap";
import FACILITIES from "../terrain/facilities.json";
import { fmtTime, S } from "./state";
import { DEMO_SECONDS } from "../content";

// The story's last chapter, "The app": each feature played out on the same Liliw terrain the story uses.
// Places are real (PSA barangays, OSM route + facilities); the people and the incident are a simulation.

const AMBULANCE = `${import.meta.env.BASE_URL}models/ambulance.glb`;
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => x * x * (3 - 2 * x);
const say = (el, text) => { if (el && el.textContent !== text) el.textContent = text; };
const piece = (built, name) => built.pieces.find((p) => p.meta.name === name);
const flatKm = (built, a, b) => Math.hypot(a.x - b.x, a.z - b.z) * built.kmPerUnit;
// zoom the camera to this feature's place while it plays: a point, the ground it needs in view, a turn of the angle
function useFocus(point, span, yaw = 0) {
  useLayoutEffect(() => {
    S.appX = point.x; S.appY = point.y; S.appZ = point.z; S.appSpan = span; S.appYaw = yaw;
  }, [point, span, yaw]);
}
const spanOf = (pts, pad) => {
  const xs = pts.map((p) => p.x), zs = pts.map((p) => p.z);
  return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) + pad;
};
const centre = (pts) => pts.reduce((s, p) => s.add(p), v3(0, 0, 0)).multiplyScalar(1 / pts.length);

// a line laid on the terrain between two world points
const drape = (built, a, b, n = 40, lift = 0.03) => Array.from({ length: n + 1 }, (_, i) => {
  const p = a.clone().lerp(b, i / n);
  return built.world(p.x / built.size.x + 0.5, p.z / built.size.z + 0.5, lift);
});

// The feature's clock is the scroll: where you are within its stretch of the chapter sets how far it has played
// (the last 15% holds the end state). It eases toward that point, so a hard flick of the wheel still plays smoothly,
// and scrolling back plays it in reverse.
function useDemoClock(reduced, index) {
  const t = useRef({ now: 0 });
  useFrame((_, dt) => {
    const want = Math.min(1, Math.max(0, (S.feature - index) / 0.85)) * DEMO_SECONDS;
    t.current.now = reduced ? want : t.current.now + (want - t.current.now) * (1 - Math.exp(-dt * 5));
  }, -1);
  return t;
}

// barangay names; the five small town-centre barangays share one tag. A lit barangay's name turns accent.
const POBLACION = ["Rizal", "Pag-Asa", "Bagong Anyo", "Masikap", "Maslun"];
function BarangayTags({ built, glow }) {
  const shown = useMemo(() => built.pieces.filter((p) => p.meta.area_km2 >= 1), [built]);
  const els = useRef([]);
  useFrame(() => shown.forEach((p, i) => els.current[i]?.classList.toggle("is-hot", glow[p.index].uHi.value > 0.3)));
  const pob = built.landmarks.hq.position;
  return (
    <>
      {shown.map((p, i) => (
        <Html key={p.index} position={[p.anchor.x, p.anchor.y + 0.04, p.anchor.z]} center zIndexRange={[10, 0]}>
          <span ref={(el) => (els.current[i] = el)} className="bgy-tag">{p.meta.name}</span>
        </Html>
      ))}
      <Html position={[pob.x, pob.y + 0.04, pob.z]} center zIndexRange={[10, 0]}>
        <span className="bgy-tag bgy-tag--pob" title={POBLACION.join(", ")}>Poblacion · {POBLACION.length} barangays</span>
      </Html>
    </>
  );
}

// a map pin: beam, head, pulsing ring, label
function Marker({ position, color, height = 0.3, children, place, headRef, ringRef }) {
  const ring = useRef();
  useFrame(({ clock }) => {
    const k = (clock.elapsedTime % 2.4) / 2.4;
    ring.current.scale.setScalar(1 + k * 2.2);
    ring.current.material.opacity = 0.5 * (1 - k);
  });
  return (
    <group position={position} scale={1.2}>
      <mesh position-y={height / 2}>
        <cylinderGeometry args={[0.0035, 0.0035, height, 6, 1, true]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} depthWrite={false} />
      </mesh>
      <mesh position-y={height}>
        <sphereGeometry args={[0.02, 18, 18]} />
        <meshBasicMaterial ref={headRef} color={color} />
      </mesh>
      <mesh position-y={height}>
        <sphereGeometry args={[0.028, 18, 18]} />
        <meshBasicMaterial color="#ffffff" side={THREE.BackSide} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.012}>
        <circleGeometry args={[0.032, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.35} depthWrite={false} />
      </mesh>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position-y={0.013}>
        <ringGeometry args={[0.03, 0.036, 48]} />
        <meshBasicMaterial ref={ringRef} color={color} transparent depthWrite={false} />
      </mesh>
      {children && (
        <Html position-y={height + 0.1} center zIndexRange={[20, 0]}>
          <span className="map-label">{children}{place && <span className="map-label__place"> · {place}</span>}</span>
        </Html>
      )}
    </group>
  );
}

// ---------------------------------------------------------------- 01 report: photo + GPS travel from the resident to MAT Liliw
function Report({ ctx }) {
  const { built, colors, glow, status, reduced } = ctx;
  const { incident: inc, hq } = built.landmarks;
  const k = piece(built, "Ilayang Sungi").index;
  const curve = useMemo(() => {
    const a = inc.position.clone().setY(inc.position.y + 0.3), b = hq.position.clone().setY(hq.position.y + 0.3);
    const m = a.clone().lerp(b, 0.5);
    m.y += 1.2;
    return new THREE.QuadraticBezierCurve3(a, m, b);
  }, [inc, hq]);
  const pts = useMemo(() => curve.getPoints(64), [curve]);
  const view = useMemo(() => ({ at: inc.position.clone().lerp(hq.position, 0.5), span: spanOf([inc.position, hq.position], 0.8) }), [inc, hq]);
  useFocus(view.at, view.span, 0.35);
  const clock = useDemoClock(reduced, ctx.index);
  const packet = useRef(), packetTag = useRef(), trail = useRef(), hqText = useRef();
  useFrame(() => {
    const t = clock.current.now, f = clamp01((t - 1.8) / 1.4);
    glow[k].uHi.value = clamp01(t / 0.6) * 0.8;
    curve.getPoint(f, packet.current.position);
    packet.current.visible = t > 1.8 && f < 1;
    if (packetTag.current) packetTag.current.style.display = packet.current.visible ? "" : "none";
    trail.current.visible = t > 1.8;
    trail.current.geometry.instanceCount = Math.round(f * (pts.length - 1));
    say(hqText.current, f >= 1 ? "MAT Liliw · report received" : "MAT Liliw · Municipal Hall");
    say(status.current, t < 1.8 ? "A resident in Ilayang Sungi reports a landslide and attaches a photo"
      : f < 1 ? `Sending photo + GPS (${inc.lat.toFixed(4)}° N, ${inc.lon.toFixed(4)}° E) · ${(t - 1.8).toFixed(1)} s`
      : "Report received by MAT Liliw · the dispatcher sees the exact spot on the map");
  });
  return (
    <>
      <Marker position={inc.position} color={colors.incident} height={0.3} place="Ilayang Sungi">Resident</Marker>
      <Marker position={hq.position} color={colors.hq} height={0.3}><b ref={hqText} /></Marker>
      <Line ref={trail} points={pts} color={colors.accent} lineWidth={2.5} transparent opacity={0.9} depthWrite={false} />
      <group ref={packet}>
        <mesh><sphereGeometry args={[0.05, 16, 16]} /><meshBasicMaterial color={colors.accent} /></mesh>
        <Html position-y={0.14} center zIndexRange={[20, 0]}><span ref={packetTag} className="map-label map-label--pin">Photo + GPS</span></Html>
      </group>
    </>
  );
}

// ---------------------------------------------------------------- 02 tracking: a rescue from report to on scene, on the real road route
function Tracking({ ctx }) {
  const { built, colors, glow, status, reduced } = ctx;
  const { points, lengths, total, seconds, meters } = built.route;
  const { scene } = useGLTF(AMBULANCE);
  const amb = useMemo(() => scene.clone(true), [scene]); // the story map uses the cached original
  const parts = useMemo(() => ({
    wheels: ["front-left", "front-right", "back-left", "back-right"].map((n) => amb.getObjectByName(`wheel-${n}`)).filter(Boolean),
    doorL: amb.getObjectByName("door-left"), doorR: amb.getObjectByName("door-right"),
  }), [amb]);
  const scene0 = piece(built, "Ilayang Sungi").index;
  const view = useMemo(() => ({ at: centre(points.map((p) => p.clone())), span: spanOf(points, 0.6) }), [points]);
  useFocus(view.at, view.span, -0.25);
  const clock = useDemoClock(reduced, ctx.index);
  const car = useRef(), done = useRef(), eta = useRef(), etaTag = useRef(), siren = useRef(), ahead = useMemo(() => v3(), []);
  useFrame(({ clock: c }) => {
    const t = clock.current.now;
    const p = smooth(clamp01((t - 2) / (DEMO_SECONDS - 3))); // report 0-1.2 s, dispatch 1.2-2 s, drive 2-8 s
    const d = p * total;
    let r = 0;
    while (r < lengths.length - 2 && lengths[r + 1] < d) r++;
    const f = clamp01((d - lengths[r]) / (lengths[r + 1] - lengths[r] || 1));
    car.current.position.lerpVectors(points[r], points[r + 1], f);
    ahead.copy(points[Math.min(r + 4, points.length - 1)]).setY(car.current.position.y);
    if (ahead.distanceToSquared(car.current.position) > 1e-8) car.current.lookAt(ahead);
    const out = t > 1.2;
    car.current.visible = out;
    if (etaTag.current) etaTag.current.style.display = out ? "" : "none";
    done.current.geometry.instanceCount = r + (f > 0 ? 1 : 0);
    parts.wheels.forEach((w) => { w.rotation.x = p * 400; });
    const open = clamp01((t - DEMO_SECONDS + 0.9) / 0.6); // rear doors open on scene
    if (parts.doorL) parts.doorL.rotation.y = -1.9 * open;
    if (parts.doorR) parts.doorR.rotation.y = 1.9 * open;
    siren.current.color.set(Math.floor(c.elapsedTime * 5) % 2 ? "#ff3b30" : "#3d7bff");
    siren.current.intensity = out && p < 1 ? 0.8 : 0;
    // the incident's barangay stays marked; the one the unit is driving through lights up
    const here = built.pieceAt(car.current.position.x, car.current.position.z);
    glow.forEach((g, k) => { g.uHi.value = out && p < 1 && k === here ? 0.9 : k === scene0 ? 0.5 : 0; });
    const left = fmtTime(seconds * (1 - p)), km = ((meters * (1 - p)) / 1000).toFixed(1);
    say(eta.current, p < 1 ? `Rescue 1 · ETA ${left} · ${km} km` : "Rescue 1 · on scene");
    say(status.current, !out ? "01 · Report received: a landslide blocks the road in Ilayang Sungi"
      : t < 2 ? "02 · MAT Liliw dispatches Rescue 1 · the alarm rings on the responder’s phone"
      : p < 1 ? `03 · En route through ${here >= 0 ? built.pieces[here].meta.name : "Liliw"} · ETA ${left} · ${km} km`
      : "04 · On scene · responders update the report until it is resolved");
  });
  return (
    <>
      <Line points={points} color={colors.line} lineWidth={1.4} dashed dashSize={0.05} gapSize={0.04} transparent opacity={0.5} depthWrite={false} />
      <Line ref={done} points={points} color={colors.accent} lineWidth={4} transparent depthWrite={false} />
      <Marker position={built.landmarks.hq.position} color={colors.hq} height={0.3} place="Rescue 1">MAT Liliw</Marker>
      <Marker position={built.landmarks.incident.position} color={colors.incident} height={0.3} place="Ilayang Sungi">Landslide</Marker>
      <group ref={car}>
        <primitive object={amb} scale={0.065} />
        <pointLight ref={siren} position-y={0.3} distance={1.4} />
        <Html position-y={0.62} center zIndexRange={[20, 0]}><span ref={etaTag} className="map-label map-label--pin map-label--float"><b ref={eta} /></span></Html>
      </group>
    </>
  );
}

// ---------------------------------------------------------------- 03 alerts: an announcement spreads out from the hall, barangay by barangay
// soft wall of light: bright at the ground, fading upward
function makePulseMaterial(color, additive) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0 } },
    vertexShader: "varying float vY; void main(){ vY = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: "uniform vec3 uColor; uniform float uOpacity; varying float vY; void main(){ gl_FragColor = vec4(uColor, pow(1.0 - vY, 2.6) * uOpacity); }",
  });
}

const PULSE_SECONDS = 4.5; // one pulse crossing Liliw
function Alerts({ ctx }) {
  const { built, colors, glow, status, reduced } = ctx;
  const hq = built.landmarks.hq.position;
  const dists = useMemo(() => built.pieces.map((p) => Math.hypot(p.anchor.x - hq.x, p.anchor.z - hq.z)), [built, hq]);
  const far = Math.max(...dists) * 1.04;
  const height = hq.y + 0.55 - built.size.base;
  const mats = useMemo(() => [0, 1, 2].map(() => makePulseMaterial(colors.accent, colors.netAdd)), [colors]);
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats]);
  const pulses = useRef([]), pops = useRef([]);
  const clock = useDemoClock(reduced, ctx.index);
  // GSAP drives three staggered pulses that keep rippling out from the hall
  useEffect(() => {
    if (reduced) {
      pulses.current.forEach((m, i) => { m.scale.set((far * (i + 1)) / 3, 1, (far * (i + 1)) / 3); mats[i].uniforms.uOpacity.value = 0.18; });
      return;
    }
    const tweens = pulses.current.flatMap((m, i) => {
      const delay = 0.5 + (i * PULSE_SECONDS) / 3;
      return [
        gsap.fromTo(m.scale, { x: 0.05, z: 0.05 }, { x: far, z: far, duration: PULSE_SECONDS, ease: "sine.out", repeat: -1, delay }),
        gsap.fromTo(mats[i].uniforms.uOpacity, { value: 0.32 }, { value: 0, duration: PULSE_SECONDS, ease: "sine.in", repeat: -1, delay }),
      ];
    });
    return () => tweens.forEach((t) => t.kill());
  }, [far, mats, reduced]);
  useFrame(() => {
    // the announcement's reach, driven by the scroll like every feature
    const r = clamp01((clock.current.now - 0.3) / (DEMO_SECONDS * 0.7)) * far;
    let n = 0;
    dists.forEach((d, k) => {
      const hit = d <= r;
      if (hit) n++;
      const since = r - d;
      glow[k].uHi.value = hit ? 0.25 + 0.65 * Math.exp(-since * 1.5) : 0;
      pops.current[k].scale.setScalar(hit ? 0.03 * (1 + 0.8 * Math.exp(-since * 3)) : 0.0001);
    });
    say(status.current, n < dists.length
      ? `Official announcement from MAT Liliw · delivered to ${n} of ${dists.length} barangays`
      : `Delivered to all ${dists.length} barangays · it arrives even when the app is closed`);
  });
  return (
    <>
      {mats.map((m, i) => (
        <mesh key={i} ref={(el) => (pulses.current[i] = el)} material={m} position={[hq.x, built.size.base + height / 2, hq.z]} renderOrder={2}>
          <cylinderGeometry args={[1, 1, height, 96, 1, true]} />
        </mesh>
      ))}
      {built.pieces.map((p, k) => (
        <mesh key={k} ref={(el) => (pops.current[k] = el)} position={[p.anchor.x, p.anchor.y + 0.12, p.anchor.z]}>
          <sphereGeometry args={[1, 14, 14]} />
          <meshBasicMaterial color={colors.accent} />
        </mesh>
      ))}
      <Marker position={hq} color={colors.hq} height={0.4} place="announcement">MAT Liliw</Marker>
    </>
  );
}

// ---------------------------------------------------------------- 04 facilities: the nearest of each kind, measured from where you are
const KINDS = [["health", "#3fb68b"], ["fire", "#ff4a3d"], ["police", "#3d7bff"], ["school", "#e0b03c"]];
const KIND_LABEL = { health: "Health unit", fire: "Fire station", police: "Police", school: "School (evacuation site)" };
const HOME = "Ibabang San Roque";
function Facilities({ ctx }) {
  const { built, colors, status, reduced } = ctx;
  const you = piece(built, HOME).anchor;
  const near = useMemo(() => KINDS.map(([kind, color]) => {
    const [best] = FACILITIES.filter((f) => f.kind === kind)
      .map((f) => { const pos = built.world(f.uv[0], f.uv[1]); return { ...f, pos, km: flatKm(built, pos, you) }; })
      .sort((a, b) => a.km - b.km);
    return best && { ...best, color, path: drape(built, you, best.pos) };
  }).filter(Boolean).map((f, i, all) => {
    // places on the same block (Liliw's fire and police stations) share one pin and label
    const twin = all.findIndex((g, j) => j < i && flatKm(built, g.pos, f.pos) < 0.15);
    const tag = all.filter((g, j) => j >= i && flatKm(built, g.pos, f.pos) < 0.15).map((g) => KIND_LABEL[g.kind]).join(" + ");
    // farther places get taller pins, so their labels stack above the nearer ones
    const rank = all.filter((g) => g.km < f.km).length;
    return { ...f, tag: twin < 0 ? `${tag} · ${f.km.toFixed(1)} km` : null, height: 0.22 + rank * 0.17 };
  }), [built, you]);
  const view = useMemo(() => ({ at: centre([you.clone(), ...near.map((f) => f.pos.clone())]), span: spanOf([you, ...near.map((f) => f.pos)], 1.6) }), [you, near]);
  useFocus(view.at, view.span, 0.5);
  const clock = useDemoClock(reduced, ctx.index);
  const radar = useRef(), groups = useRef([]);
  useFrame(() => {
    const t = clock.current.now;
    const k = (t % 2) / 2;
    radar.current.scale.setScalar(0.05 + k * 0.5);
    radar.current.material.opacity = 0.5 * (1 - k);
    const shown = near.filter((_, i) => t > 1 + i * 1.4).length;
    groups.current.forEach((g, i) => { g.visible = i < shown; });
    const f = near[shown - 1];
    say(status.current, !f ? `Finding facilities near you in ${HOME}…`
      : `Nearest ${KIND_LABEL[f.kind].toLowerCase()}: ${f.name} · ${f.km.toFixed(1)} km`);
  });
  return (
    <>
      <Marker position={you} color={colors.netHot} height={0.22} place={HOME}>You</Marker>
      <mesh ref={radar} position={[you.x, you.y + 0.02, you.z]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.92, 1, 64]} />
        <meshBasicMaterial color={colors.netHot} transparent depthWrite={false} />
      </mesh>
      {near.map((f, i) => (
        <group key={f.kind} ref={(el) => (groups.current[i] = el)} visible={false}>
          <Line points={f.path} color={f.color} lineWidth={2.5} dashed dashSize={0.04} gapSize={0.03} depthWrite={false} />
          {f.tag && <Marker position={f.pos} color={f.color} height={f.height}>{f.tag}</Marker>}
        </group>
      ))}
    </>
  );
}

// ---------------------------------------------------------------- 05 family circle: live locations; one member raises an alert
const FAMILY = [["You", HOME, "#3d7bff"], ["Mama", "Bubukal", "#3fb68b"], ["Papa", "Rizal", "#e0b03c"], ["Lola", "Ilayang Sungi", "#b98cff"]];
const ALERT = 3; // Lola
function Family({ ctx }) {
  const { built, colors, status, reduced } = ctx;
  const homes = useMemo(() => FAMILY.map(([, bgy]) => piece(built, bgy).anchor), [built]);
  const view = useMemo(() => ({ at: centre(homes.map((h) => h.clone())), span: spanOf(homes, 0.9) }), [homes]);
  useFocus(view.at, view.span, -0.45);
  const clock = useDemoClock(reduced, ctx.index);
  const members = useRef([]), heads = useRef([]), rings = useRef([]), links = useRef([]), sos = useRef();
  const red = useMemo(() => new THREE.Color(colors.incident), [colors]);
  useFrame(({ clock: c }) => {
    const t = clock.current.now, alert = t > 4, flash = alert && Math.floor(c.elapsedTime * 4) % 2 === 0;
    members.current.forEach((g, i) => {
      // live location: small drift around home (Lola stops once she raises the alert)
      const a = c.elapsedTime * 0.5 + i * 2;
      const r = i === ALERT && alert ? 0 : 0.06;
      g.position.set(homes[i].x + Math.cos(a) * r, homes[i].y, homes[i].z + Math.sin(a) * r);
      heads.current[i].color.set(i === ALERT && flash ? red : FAMILY[i][2]);
      rings.current[i].color.set(i === ALERT && alert ? red : FAMILY[i][2]);
    });
    links.current.forEach((l, i) => {
      const a = members.current[0].position, b = members.current[i + 1].position;
      l.geometry.setPositions([a.x, a.y + 0.4, a.z, b.x, b.y + 0.4, b.z]);
      l.material.color.set(alert && i + 1 === ALERT ? colors.incident : colors.line);
      l.material.linewidth = alert && i + 1 === ALERT ? 2.6 : 1.2;
    });
    sos.current.visible = alert;
    sos.current.position.copy(members.current[ALERT].position);
    sos.current.scale.setScalar(1 + ((c.elapsedTime * 1.2) % 1) * 4);
    sos.current.material.opacity = 0.8 * (1 - ((c.elapsedTime * 1.2) % 1));
    say(status.current, alert ? "Lola reported an emergency in Ilayang Sungi · everyone in the circle is alerted"
      : "Sharing live location with 3 people you trust");
  });
  return (
    <>
      {FAMILY.slice(1).map((_, i) => (
        <Line key={i} ref={(el) => (links.current[i] = el)} points={[[0, 0, 0], [1, 0, 0]]} color={colors.line} lineWidth={1.2} transparent opacity={0.8} depthWrite={false} />
      ))}
      {FAMILY.map(([who, bgy, color], i) => (
        <group key={who} ref={(el) => (members.current[i] = el)}>
          <Marker position={[0, 0, 0]} color={color} height={0.24 + i * 0.1}
            headRef={(m) => (heads.current[i] = m)} ringRef={(m) => (rings.current[i] = m)} place={bgy}>{who}</Marker>
        </group>
      ))}
      <mesh ref={sos} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.06, 0.08, 48]} />
        <meshBasicMaterial color={colors.incident} transparent depthWrite={false} />
      </mesh>
    </>
  );
}

// ---------------------------------------------------------------- 06 go-bag: typhoon warning, pack, walk to the nearest school
// where the checklist goes: phones get a fixed spot bottom-left (above the Features pill, clear of the walk at the
// top); wider screens keep it beside the walker, held below the status bar and inside the edges
const onScreen = new THREE.Vector3();
const clampToScreen = (el, camera, size) => {
  if (size.width < 600) return [8, size.height - 180];
  onScreen.setFromMatrixPosition(el.matrixWorld).project(camera);
  const x = ((onScreen.x + 1) * size.width) / 2, y = ((1 - onScreen.y) * size.height) / 2;
  return [Math.min(Math.max(x, 8), size.width - 230), Math.min(Math.max(y, 270), size.height - 120)];
};

const BAG = ["Water for 3 days", "Flashlight + batteries", "First-aid kit", "Radio", "IDs and documents"];
const LOWLAND = "Dita"; // 30–59 m, by the lake
function GoBag({ ctx }) {
  const { built, colors, glow, status, reduced } = ctx;
  const start = piece(built, LOWLAND).anchor;
  const school = useMemo(() => FACILITIES.filter((f) => f.kind === "school")
    .map((f) => { const pos = built.world(f.uv[0], f.uv[1]); return { ...f, pos, km: flatKm(built, pos, start) }; })
    .sort((a, b) => a.km - b.km)[0], [built, start]);
  const path = useMemo(() => drape(built, start, school.pos, 60), [built, start, school]);
  const view = useMemo(() => ({ at: start.clone().lerp(school.pos, 0.5), span: spanOf([start, school.pos], 1.1) }), [start, school]);
  useFocus(view.at, view.span, 0.3);
  // flood-prone: the lake-level barangays (top under 70 m) are shaded as the warning zone
  const lowland = useMemo(() => built.pieces.filter((p) => p.meta.elev_m[1] < 70).map((p) => p.index), [built]);
  const clock = useDemoClock(reduced, ctx.index);
  const walker = useRef(), trail = useRef(), items = useRef([]), check = useRef();
  const drops = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(400 * 6), 3));
    return g;
  }, []);
  const seeds = useMemo(() => Array.from({ length: 400 }, (_, i) => [Math.sin(i * 12.9) * 0.5 + 0.5, Math.sin(i * 78.2) * 0.5 + 0.5, Math.sin(i * 37.7) * 0.5 + 0.5]), []);
  useEffect(() => () => drops.dispose(), [drops]);
  useFrame(({ clock: c }) => {
    const t = clock.current.now;
    const packed = BAG.filter((_, i) => t > 0.5 + i * 0.5).length;
    items.current.forEach((el, i) => el?.classList.toggle("is-done", i < packed));
    if (check.current) check.current.style.display = t < 3.6 ? "" : "none";
    const w = smooth(clamp01((t - 3.3) / (DEMO_SECONDS - 4.3)));
    const at = w * (path.length - 1), i = Math.min(path.length - 2, Math.floor(at));
    walker.current.position.lerpVectors(path[i], path[i + 1], at - i);
    trail.current.geometry.instanceCount = Math.floor(at);
    // rain over the area
    lowland.forEach((k) => { glow[k].uHi.value = 0.4; });
    const a = drops.attributes.position.array, span = 1.6;
    seeds.forEach(([x, y, z], k) => {
      const px = start.x + (x - 0.5) * span * 2, pz = start.z + (z - 0.5) * span * 2;
      const py = start.y + 0.05 + ((y * 2.5 - c.elapsedTime * 2.2) % 2.5 + 2.5) % 2.5;
      a.set([px, py, pz, px - 0.01, py + 0.05, pz], k * 6);
    });
    drops.attributes.position.needsUpdate = true;
    say(status.current, t < 3.3 ? `Typhoon warning for lowland ${LOWLAND} · packing the go-bag (${packed}/${BAG.length})`
      : w < 0.97 ? `Heading to ${school.name} · ${(school.km * (1 - w)).toFixed(1)} km`
      : `Safe at ${school.name}, the nearest evacuation site`);
  });
  return (
    <>
      <lineSegments geometry={drops}>
        <lineBasicMaterial color={colors.netHot} transparent opacity={0.22} depthWrite={false} />
      </lineSegments>
      <Line points={path} color={colors.line} lineWidth={1.2} dashed dashSize={0.03} gapSize={0.03} transparent opacity={0.6} depthWrite={false} />
      <Line ref={trail} points={path} color={colors.accent} lineWidth={3} depthWrite={false} />
      <Marker position={school.pos} color="#e0b03c" height={0.28} place={school.name}>Evacuation site</Marker>
      <group ref={walker}>
        <Marker position={[0, 0, 0]} color={colors.netHot} height={0.18} />
        <Html position-y={0.2} zIndexRange={[20, 0]} calculatePosition={clampToScreen}>
          <div className="demo-check" ref={check}>
            <b className="mono">Go-bag</b>
            <ul>{BAG.map((item, i) => <li key={item} ref={(el) => (items.current[i] = el)}>{item}</li>)}</ul>
          </div>
        </Html>
      </group>
    </>
  );
}

const DEMOS = [Report, Tracking, Alerts, Facilities, Family, GoBag];

// rendered inside the story's model group while the "app" chapter is on; `glow` = the barangays' highlight uniforms
export function AppDemo({ built, colors, glow, feature, status, reduced }) {
  // reset when a feature ends (cleanup), so the next feature's own focus, set on mount, is what stays
  useLayoutEffect(() => { glow.forEach((g) => { g.uHi.value = 0; }); return () => { S.appSpan = 0; S.appYaw = 0; }; }, [feature, glow]);
  const Feature = DEMOS[feature];
  return (
    <>
      <BarangayTags built={built} glow={glow} />
      {/* a model still loading must not suspend (and remount) the whole canvas */}
      <Suspense fallback={null}><Feature key={feature} ctx={{ built, colors, glow, status, reduced, index: feature }} /></Suspense>
    </>
  );
}
