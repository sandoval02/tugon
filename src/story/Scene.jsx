import { memo, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, Line, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import gsap from "gsap";
import { getLiliw } from "../terrain/buildLiliw";
import {
  cloudTexture, makeContextMaterial, PALETTE, makeGroundMaterial, makeNetMaterial, makeRockMaterial, makeSharedUniforms, makeTerrainMaterial,
} from "../terrain/materials";
import { fmtTime, MISSION_STEPS, missionStage, S } from "./state";
import { AppDemo } from "./AppDemo";

const LAYERS = 240;
const UP = new THREE.Vector3(0, 1, 0);
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------- camera
function CameraRig({ built, vehicle, selected }) {
  const { camera, size, pointer, gl } = useThree();
  const routeCenter = useMemo(() => new THREE.Box3().setFromPoints(built.route.points).getCenter(v3()), [built]);
  const t = useMemo(() => ({ pos: v3(), tgt: v3(), a: v3(), b: v3(), focus: v3(), want: v3(), zoom: 0, off: v3(), sph: new THREE.Spherical(), yaw: 0, pitch: 0, scale: 1, panX: 0, panZ: 0, side: 1, mside: 1, right: v3(), fwd: v3(), af: v3(0, 0.55, 0), afWant: v3(), aw: 0, aspan: 3, ayaw: 0, aoff: v3() }), []);

  // drag to orbit (mouse: any direction; touch: sideways, since vertical swipes scroll the page)
  useEffect(() => {
    const el = gl.domElement;
    let down = null;
    const onDown = (e) => {
      if (S.orbit) down = { x: e.clientX, y: e.clientY, id: e.pointerId, pan: e.button === 2 || e.shiftKey };
      S.dragged = false;
    };
    const noMenu = (e) => { if (S.orbit) e.preventDefault(); }; // right-drag pans
    const onMove = (e) => {
      if (!down || e.pointerId !== down.id) return;
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (!S.dragged && Math.hypot(dx, dy) < 6) return;
      S.dragged = true;
      if (down.pan) {
        // move the terrain with the cursor, in the camera's ground plane
        const s = t.pos.distanceTo(t.tgt) * 0.0012;
        t.right.setFromMatrixColumn(camera.matrixWorld, 0).setY(0).normalize();
        camera.getWorldDirection(t.fwd).setY(0).normalize();
        S.panX = Math.max(-8, Math.min(8, S.panX + (-t.right.x * dx + t.fwd.x * dy) * s));
        S.panZ = Math.max(-8, Math.min(8, S.panZ + (-t.right.z * dx + t.fwd.z * dy) * s));
      } else {
        S.yaw -= dx * 0.006;
        S.pitch = Math.min(0.75, Math.max(-0.55, S.pitch + dy * 0.004));
      }
      down.x = e.clientX; down.y = e.clientY;
    };
    const onUp = () => { down = null; setTimeout(() => { S.dragged = false; }, 0); }; // click fires before this clears
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("contextmenu", noMenu);
    addEventListener("pointermove", onMove);
    addEventListener("pointerup", onUp);
    addEventListener("pointercancel", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("contextmenu", noMenu);
      removeEventListener("pointermove", onMove);
      removeEventListener("pointerup", onUp);
      removeEventListener("pointercancel", onUp);
    };
  }, [gl, camera, t]);

  useFrame((_, dt) => {
    const aspect = size.width / size.height;
    const fit = (k) => Math.max(1, k / aspect); // portrait screens: back off so Liliw fits the width
    const wide = aspect > 1.15;
    const narrow = aspect < 0.8; // phones: the card is a bottom sheet, so lift the scene into the top half
    const ease = 1 - Math.exp(-dt * 3);
    // hidden panels give the scene the whole screen
    t.side += ((S.hideBgy ? 0 : 1) - t.side) * ease;
    t.mside += ((S.hideMission ? 0 : 1) - t.mside) * ease;
    const shift = wide ? S.shift * 2.2 * t.side : 0;
    const follow = routeCenter.clone().lerp(vehicle.current, 0.5);
    // side view from the east: screen-right is north (-z), screen-up is +y
    if (wide) follow.z -= 1.4 * t.mside; // keep the action left of the mission card
    if (narrow) follow.y -= 1.2 * t.mside; // lift it above the bottom sheet
    // ease toward a lifted barangay so it never sits cropped at the edge
    const p = selected !== null ? built.pieces[selected] : null;
    if (p) t.want.set(p.anchor.x, p.anchor.y + p.lift * 0.5, p.anchor.z); else t.want.set(0, 0, 0);
    t.focus.lerp(t.want, ease);
    t.zoom += ((p ? 1 : 0) - t.zoom) * ease;
    // [target, offset from target, fit factor]
    const poses = [
      [v3(0, narrow ? 0.1 : 0.35, 0), v3(11, 8, 13.4), fit(0.95) * (narrow ? 0.7 : 1)], // phones: closer, Liliw fills the hero
      [v3(0, 0, 0), v3(0, 30, 0.6), fit(1.0)],
      [v3(-shift, -0.2, narrow ? 0.3 + 2.9 * t.side : 0.3).lerp(t.focus.clone().setX(t.focus.x - shift * 0.5).setZ(t.focus.z + (narrow ? 2 : 0)), t.zoom * 0.85), v3(0, 9.4, 11.6), fit(1.0) * (1 - t.zoom * 0.2)],
      [follow, v3(10.5, 4.6, 0.8), fit(0.9)], // low side view from the east: Mt. Banahaw left, the hall right
      null, // the app chapter, below
    ];
    // the app: all of Liliw pulled back (on phones from the south, so its length runs down the screen).
    // Each feature can zoom to its own place (AppDemo sets S.appX/Y/Z + S.appSpan): the camera glides there at a
    // lower three-quarter angle and pushes in a little while the feature plays.
    const glide = 1 - Math.exp(-dt * 1.6);
    t.af.lerp(t.afWant.set(S.appX, S.appY, S.appZ), glide);
    t.aw += ((S.appSpan > 0 ? 1 : 0) - t.aw) * glide;
    if (S.appSpan > 0) t.aspan += (S.appSpan - t.aspan) * glide;
    t.ayaw += (S.appYaw - t.ayaw) * glide;
    const whole = narrow ? [v3(0.4, 0.5, 0.4), v3(11.5, 20, 8.8), 1] : [v3(0, 0.55, 0), v3(13.5, 6.6, 0.4), fit(1.0)];
    const half = THREE.MathUtils.degToRad(camera.fov / 2);
    const push = 1 - 0.12 * (S.feature % 1);
    const near = Math.max(3.6, (1.5 * t.aspan) / (2 * Math.tan(half) * Math.min(aspect, 1.8))) * push;
    t.aoff.copy(narrow ? v3(0.45, 1.25, 0.8) : v3(1, 0.85, 0.7)).normalize().applyAxisAngle(UP, t.ayaw).multiplyScalar(near);
    poses[4] = [whole[0].clone().lerp(t.af, t.aw), whole[1].clone().multiplyScalar(whole[2]).lerp(t.aoff, t.aw), 1];
    const seg = Math.min(poses.length - 2, Math.floor(S.cam)), f = S.cam - seg;
    const [ta, oa, ka] = poses[seg], [tb, ob, kb] = poses[seg + 1];
    t.tgt.lerpVectors(ta, tb, f);
    t.a.copy(ta).addScaledVector(oa, ka);
    t.b.copy(tb).addScaledVector(ob, kb);
    t.pos.lerpVectors(t.a, t.b, f);
    // orbit / pan / zoom: settle back to the story framing whenever the view is not interactive
    if (!S.orbit) {
      const turns = Math.round(t.yaw / (2 * Math.PI)) * 2 * Math.PI;
      t.yaw -= turns; S.yaw -= turns;
      S.yaw += (0 - S.yaw) * ease; S.pitch += (0 - S.pitch) * ease;
      S.zoom += (1 - S.zoom) * ease; S.panX += (0 - S.panX) * ease; S.panZ += (0 - S.panZ) * ease;
    }
    const k = 1 - Math.exp(-dt * 8);
    t.yaw += (S.yaw - t.yaw) * k; t.pitch += (S.pitch - t.pitch) * k;
    t.scale += (S.zoom - t.scale) * k; t.panX += (S.panX - t.panX) * k; t.panZ += (S.panZ - t.panZ) * k;
    t.tgt.x += t.panX; t.tgt.z += t.panZ; t.pos.x += t.panX; t.pos.z += t.panZ;
    t.sph.setFromVector3(t.off.subVectors(t.pos, t.tgt));
    t.sph.theta += t.yaw;
    t.sph.phi = Math.min(1.5, Math.max(0.06, t.sph.phi + t.pitch));
    t.sph.radius *= t.scale;
    t.pos.copy(t.tgt).add(t.off.setFromSpherical(t.sph));
    t.pos.x += pointer.x * 0.9 * S.sway;
    t.pos.y += pointer.y * 0.6 * S.sway;
    camera.position.copy(t.pos);
    camera.lookAt(t.tgt);
  });
  return null;
}

// ---------------------------------------------------------------- barangay pieces
function FollowLabel({ piece, group, className, children }) {
  const ref = useRef();
  useFrame(() => { if (ref.current && group) ref.current.position.y = group.position.y; });
  return (
    <group ref={ref}>
      <Html position={[piece.anchor.x, piece.anchor.y + 0.18, piece.anchor.z]} center zIndexRange={[20, 0]}>
        <span className={className}>{children}</span>
      </Html>
    </group>
  );
}

function BarangayCard({ built, piece, note }) {
  const { meta } = piece;
  const km = Math.hypot(piece.anchor.x - built.landmarks.hq.position.x, piece.anchor.z - built.landmarks.hq.position.z) * built.kmPerUnit;
  return (
    <>
      {note && <em className="mono">{note}</em>}
      <strong>{meta.name}</strong>
      <dl>
        <div><dt>Area</dt><dd>{meta.area_km2.toFixed(2)} km²</dd></div>
        <div><dt>Elevation</dt><dd>{meta.elev_m[0]}–{meta.elev_m[1].toLocaleString()} m</dd></div>
        <div><dt>To hall</dt><dd>{km < 0.1 ? "< 0.1" : km.toFixed(1)} km</dd></div>
      </dl>
    </>
  );
}

const Pieces = memo(function Pieces({ built, colors, shared, own, selected, onSelect, onHover, hover, chapter, panelOpen, note }) {
  const mats = useMemo(
    () => built.pieces.map((p, k) => ({
      top: makeTerrainMaterial({ shared, own: own[k], wall: false, colors, contourStep: built.contourStep }),
      walls: makeTerrainMaterial({ shared, own: own[k], wall: true, colors, contourStep: built.contourStep }),
    })),
    [built, colors, shared, own]
  );
  const rock = useMemo(() => makeRockMaterial({ colors }), [colors]);
  useEffect(() => () => { mats.forEach((m) => { m.top.dispose(); m.walls.dispose(); }); rock.dispose(); }, [mats, rock]);

  const lift = useMemo(() => built.pieces.map(() => ({ v: 0 })), [built]);
  const groups = useRef([]), unders = useRef([]), lines = useRef([]);
  const hoverRef = useRef(null);
  const selRef = useRef(selected);
  selRef.current = selected;

  // lift the chosen barangay like a slice of cake; settle the previous one back into its socket
  useEffect(() => {
    lift.forEach((l, k) =>
      gsap.to(l, k === selected
        ? { v: 1, duration: 1.1, ease: "back.out(1.3)", overwrite: true }
        : { v: 0, duration: 0.7, ease: "power2.inOut", overwrite: true })
    );
  }, [selected, lift]);

  const lineColor = useMemo(() => new THREE.Color(colors.line), [colors]);
  const accent = useMemo(() => new THREE.Color(colors.accent), [colors]);

  useFrame(({ clock }) => {
    const time = clock.elapsedTime, sel = selRef.current;
    built.pieces.forEach((p, k) => {
      const L = lift[k].v, g = groups.current[k], u = unders.current[k];
      if (!g) return;
      g.position.y = L * p.lift + (L > 0.01 ? Math.sin(time * 1.3 + k) * 0.03 * L : 0);
      u.scale.y = Math.max(L, 0.0001);
      u.visible = L > 0.003;
      const hi = (S.interactive && hoverRef.current === k) || sel === k ? 1 : 0;
      const dim = sel !== null && sel !== k ? 1 : 0;
      if (!S.appOn) own[k].uHi.value += (hi - own[k].uHi.value) * 0.15; // the app chapter drives highlights itself
      own[k].uDim.value += (dim - own[k].uDim.value) * 0.1;
      const line = lines.current[k];
      if (line) {
        const segs = line.geometry.attributes.instanceStart.count;
        line.geometry.instanceCount = Math.ceil(S.borders * segs);
        line.visible = S.borders > 0.002;
        line.material.color.copy(sel === k ? accent : lineColor);
        line.material.linewidth = sel === k ? 2.6 : 1.1;
        line.material.opacity = sel === k ? 1 : 0.55 * (1 - own[k].uDim.value * 0.6);
      }
    });
  });

  const handlers = (k) => ({
    onPointerMove: (e) => {
      if (!S.interactive) return;
      e.stopPropagation();
      if (hoverRef.current !== k) { hoverRef.current = k; onHover(k); }
    },
    onPointerOut: () => { if (hoverRef.current === k) { hoverRef.current = null; onHover(null); } },
    onClick: (e) => { if (!S.interactive || S.dragged) return; e.stopPropagation(); onSelect(k); },
  });

  const showHover = chapter === "map" && hover !== null && hover !== selected;
  return (
    <>
      {built.pieces.map((p, k) => (
        <group key={k} ref={(el) => (groups.current[k] = el)}>
          <mesh geometry={p.top} material={mats[k].top} {...handlers(k)} />
          <mesh geometry={p.walls} material={mats[k].walls} {...handlers(k)} />
          <mesh geometry={p.under} material={rock} position-y={built.size.base} ref={(el) => (unders.current[k] = el)} {...handlers(k)} />
          {p.rings.map((ring, r) => (
            <Line key={r} ref={(el) => r === 0 && (lines.current[k] = el)} points={ring} color={colors.line} lineWidth={1.1} transparent opacity={0.55} depthWrite={false} />
          ))}
        </group>
      ))}
      {showHover && <FollowLabel piece={built.pieces[hover]} group={groups.current[hover]} className="map-label">{built.pieces[hover].meta.name}</FollowLabel>}
      {chapter === "map" && selected !== null && (panelOpen ? (
        <FollowLabel piece={built.pieces[selected]} group={groups.current[selected]} className="map-label map-label--pin">{built.pieces[selected].meta.name}</FollowLabel>
      ) : (
        // panel closed: the lifted barangay carries its own details
        <FollowLabel piece={built.pieces[selected]} group={groups.current[selected]} className="map-card">
          <BarangayCard built={built} piece={built.pieces[selected]} note={note} />
        </FollowLabel>
      ))}
    </>
  );
});

// ---------------------------------------------------------------- atmosphere
function Clouds({ color }) {
  const group = useRef();
  const mat = useMemo(() => new THREE.SpriteMaterial({ map: cloudTexture(), color, transparent: true, depthWrite: false, opacity: 0 }), [color]);
  const puffs = useMemo(() => Array.from({ length: 48 }, (_, i) => {
    const r = (n) => { const s = Math.sin(i * 91.7 + n * 47.3) * 43758.5; return s - Math.floor(s); };
    return { x: r(1) * 18 - 9, y: 12.5 + r(2) * 17, z: r(3) * 18 - 9, s: 5 + r(4) * 8, sp: 0.2 + r(5) * 0.4 };
  }), []);
  useFrame(({ clock }) => {
    const g = group.current;
    g.visible = S.clouds > 0.01;
    if (!g.visible) return;
    mat.opacity = S.clouds * 0.9;
    g.children.forEach((c, i) => { c.position.x = puffs[i].x + Math.sin(clock.elapsedTime * puffs[i].sp + i) * 0.6; });
  });
  useEffect(() => () => mat.dispose(), [mat]);
  return (
    <group ref={group}>
      {puffs.map((c, i) => <sprite key={i} material={mat} position={[c.x, c.y, c.z]} scale={[c.s, c.s * 0.7, 1]} />)}
    </group>
  );
}

// Blue net under Liliw. It glows and ripples around the cursor, and a slow pulse sweeps outward.
function Net({ built, colors }) {
  const { camera, pointer, raycaster } = useThree();
  const mat = useMemo(() => makeNetMaterial({ color: colors.net, hot: colors.netHot, additive: colors.netAdd }), [colors]);
  const geo = useMemo(() => new THREE.PlaneGeometry(44, 44).rotateX(-Math.PI / 2), []);
  const ref = useRef();
  const tmp = useMemo(() => ({ plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), -built.size.base), hit: v3() }), [built]);
  useFrame(({ clock }, dt) => {
    const u = mat.uniforms;
    u.uTime.value = clock.elapsedTime;
    raycaster.setFromCamera(pointer, camera);
    if (raycaster.ray.intersectPlane(tmp.plane, tmp.hit)) {
      ref.current.parent.worldToLocal(tmp.hit);
      const k = 1 - Math.exp(-dt * 6);
      u.uMouse.value.x += (tmp.hit.x - u.uMouse.value.x) * k;
      u.uMouse.value.y += (tmp.hit.z - u.uMouse.value.y) * k;
    }
  });
  useEffect(() => () => { mat.dispose(); geo.dispose(); }, [mat, geo]);
  return <mesh ref={ref} geometry={geo} material={mat} position-y={built.size.base - 0.002} renderOrder={-1} raycast={() => null} />;
}

function Ground({ built, color }) {
  const mat = useMemo(() => makeGroundMaterial({ color }), [color]);
  const ref = useRef();
  useFrame(() => {
    mat.uniforms.uOpacity.value = 0.9;
  });
  useEffect(() => () => mat.dispose(), [mat]);
  return (
    <mesh ref={ref} material={mat} rotation-x={-Math.PI / 2} position-y={built.size.base - 0.004} renderOrder={-2} raycast={() => null}>
      <planeGeometry args={[26, 26]} />
    </mesh>
  );
}

// ---------------------------------------------------------------- mission
function Beacon({ position, color, label, show, height = 0.9 }) {
  const ring = useRef(), beam = useRef(), root = useRef();
  useFrame(({ clock }) => {
    const t = (clock.elapsedTime % 1.8) / 1.8;
    root.current.scale.setScalar(Math.max(S.mission, 0.0001));
    ring.current.scale.setScalar(0.5 + t * 3);
    ring.current.material.opacity = 0.9 * (1 - t);
    beam.current.material.opacity = 0.28 + 0.12 * Math.sin(clock.elapsedTime * 4);
  });
  return (
    <group ref={root} position={position}>
      <mesh ref={beam} position-y={height / 2}>
        <cylinderGeometry args={[0.012, 0.03, height, 12, 1, true]} />
        <meshBasicMaterial color={color} transparent depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
      </mesh>
      <mesh position-y={height}>
        <sphereGeometry args={[0.038, 20, 20]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position-y={0.02}>
        <ringGeometry args={[0.06, 0.08, 48]} />
        <meshBasicMaterial color={color} transparent depthWrite={false} />
      </mesh>
      {show && (
        <Html position={[0, height + 0.16, 0]} center zIndexRange={[20, 0]}>
          <span className="map-label map-label--pin">{label}</span>
        </Html>
      )}
    </group>
  );
}

// Kenney Car Kit (CC0, kenney.nl). Models face +Z and are ~3.3 units long.
const MODELS = `${import.meta.env.BASE_URL}models/`;
const CAR_SCALE = 0.045;

function Ambulance() {
  const { scene } = useGLTF(`${MODELS}ambulance.glb`);
  const parts = useMemo(() => ({
    wheels: ["front-left", "front-right", "back-left", "back-right"].map((n) => scene.getObjectByName(`wheel-${n}`)).filter(Boolean),
    doorL: scene.getObjectByName("door-left"), doorR: scene.getObjectByName("door-right"),
  }), [scene]);
  const open = useRef(0);
  useFrame((_, dt) => {
    parts.wheels.forEach((w) => { w.rotation.x = S.route * 260; }); // wheels roll with the distance driven
    // rear doors swing open on scene
    open.current += ((S.route >= 0.995 ? 1 : 0) - open.current) * (1 - Math.exp(-dt * 3));
    if (parts.doorL) parts.doorL.rotation.y = -1.9 * open.current;
    if (parts.doorR) parts.doorR.rotation.y = 1.9 * open.current;
  });
  return <primitive object={scene} scale={CAR_SCALE} />;
}

// units on standby beside the municipal hall
function Parked({ built, name, du, dv, heading }) {
  const { scene } = useGLTF(`${MODELS}${name}.glb`);
  const ref = useRef();
  const { uv } = built.landmarks.hq;
  const pos = useMemo(() => built.world(uv[0] + du, uv[1] + dv, 0.005), [built, uv, du, dv]);
  useFrame(() => ref.current.scale.setScalar(CAR_SCALE * 1.5 * Math.max(S.mission, 0.0001)));
  return <primitive ref={ref} object={scene} position={pos} rotation-y={heading} />;
}

// the landslide that blocks the road: a settled pile plus rocks still tumbling down onto it
function Landslide({ built, color }) {
  const { uv } = built.landmarks.incident;
  const geo = useMemo(() => new THREE.DodecahedronGeometry(1, 0), []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.95, flatShading: true }), [color]);
  const rocks = useMemo(() => Array.from({ length: 18 }, (_, i) => {
    const r = (n) => { const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453; return x - Math.floor(x); };
    const a = r(1) * Math.PI * 2, d = 0.002 + r(2) * 0.009;
    const end = built.world(uv[0] + Math.cos(a) * d, uv[1] + Math.sin(a) * d, 0.01);
    const start = end.clone().add(v3(Math.cos(a) * 0.15, 0.45 + r(3) * 0.2, Math.sin(a) * 0.15));
    return { end, start, s: 0.012 + r(4) * 0.022, falling: i % 3 === 0, phase: r(5), spin: v3(r(6), r(7), r(8)).multiplyScalar(6) };
  }), [built, uv]);
  const group = useRef();
  useFrame(({ clock }) => {
    const m = S.mission, time = clock.elapsedTime;
    group.current.visible = m > 0.01;
    group.current.children.forEach((o, i) => {
      const k = rocks[i];
      if (!k.falling) { o.position.copy(k.end); o.scale.setScalar(k.s * m); o.rotation.set(k.spin.x, k.spin.y, k.spin.z); return; }
      const t = (time * 0.45 + k.phase) % 1;
      const f = Math.min(1, t / 0.7); // fall for 70% of the loop, then rest on the pile and fade
      o.position.lerpVectors(k.start, k.end, f * f);
      o.position.y += Math.abs(Math.sin(f * Math.PI * 3)) * 0.06 * (1 - f); // bounces as it tumbles
      o.rotation.set(k.spin.x * time, k.spin.y * time, 0);
      o.scale.setScalar(k.s * m * Math.min(1, t * 8) * (t > 0.85 ? (1 - t) / 0.15 : 1));
    });
  });
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  return <group ref={group}>{rocks.map((_, i) => <mesh key={i} geometry={geo} material={mat} />)}</group>;
}

function Mission({ built, colors, chapter, vehicle, missionOpen }) {
  const { points, lengths, total } = built.route;
  const full = useRef(), done = useRef(), car = useRef(), glow = useRef(), siren = useRef();
  const tag = useRef(), tagStep = useRef(), tagEta = useRef();
  const ahead = useMemo(() => v3(), []);

  useFrame(({ clock }) => {
    const m = S.mission, time = clock.elapsedTime;
    const d = S.route * total;
    let r = 0;
    while (r < lengths.length - 2 && lengths[r + 1] < d) r++;
    const f = Math.min(1, Math.max(0, (d - lengths[r]) / (lengths[r + 1] - lengths[r] || 1)));
    vehicle.current.lerpVectors(points[r], points[r + 1], f);
    car.current.position.copy(vehicle.current);
    ahead.copy(points[Math.min(r + 4, points.length - 1)]);
    ahead.y = vehicle.current.y;
    if (ahead.distanceToSquared(vehicle.current) > 1e-8) car.current.lookAt(ahead);
    car.current.visible = m > 0.05 && S.dispatch > 0.5;
    car.current.scale.setScalar(1.5 * Math.min(1, S.dispatch));

    full.current.visible = done.current.visible = m > 0.01;
    full.current.material.opacity = 0.45 * m;
    done.current.material.opacity = m;
    done.current.geometry.instanceCount = Math.max(0, r + (f > 0 ? 1 : 0));
    siren.current.color.set(Math.floor(time * 5) % 2 === 0 ? "#ff3b30" : "#3d7bff");
    siren.current.intensity = car.current.visible && S.route < 0.995 ? 0.25 : 0;
    glow.current.material.opacity = 0.5 + 0.3 * Math.sin(time * 6);

    // panel closed: the step label rides on the unit (on the incident before dispatch)
    if (tag.current && tagStep.current) { // the Html label mounts a frame after its group
      const st = missionStage();
      tag.current.position.copy(st === 0 ? built.landmarks.incident.position : vehicle.current);
      const step = `${MISSION_STEPS[st].k} · ${MISSION_STEPS[st].title}`;
      const eta = st === 3 ? "Arrived" : `ETA ${fmtTime(built.route.seconds * (1 - S.route))} · ${((built.route.meters * (1 - S.route)) / 1000).toFixed(1)} km`;
      if (tagStep.current.textContent !== step) tagStep.current.textContent = step;
      if (tagEta.current.textContent !== eta) tagEta.current.textContent = eta;
    }
  });

  return (
    <group>
      <Line ref={full} points={points} color={colors.line} lineWidth={1.4} dashed dashSize={0.05} gapSize={0.04} transparent depthWrite={false} />
      <Line ref={done} points={points} color={colors.accent} lineWidth={4} transparent depthWrite={false} />
      <Beacon position={built.landmarks.hq.position} color={colors.hq} label="MAT Liliw · Municipal Hall" show={chapter === "mission"} height={0.32} />
      <Beacon position={built.landmarks.incident.position} color={colors.incident} label="Incident · Ilayang Sungi" show={chapter === "mission"} height={0.4} />
      <Suspense fallback={null}>
        <Landslide built={built} color={colors.soil} />
        <Parked built={built} name="firetruck" du={-0.018} dv={0.006} heading={0.6} />
        <Parked built={built} name="police" du={0.016} dv={-0.008} heading={-2.2} />
      </Suspense>
      <group ref={car}>
        <Suspense fallback={null}><Ambulance /></Suspense>
        <pointLight ref={siren} position={[0, 0.12, 0]} distance={0.8} decay={1.5} />
        <mesh ref={glow} rotation-x={-Math.PI / 2} position-y={0.004}>
          <ringGeometry args={[0.1, 0.14, 40]} />
          <meshBasicMaterial color={colors.accent} transparent depthWrite={false} />
        </mesh>
      </group>
      {chapter === "mission" && !missionOpen && (
        <group ref={tag}>
          <Html position-y={0.12} zIndexRange={[20, 0]}>
            <span className="map-step"><b ref={tagStep} className="mono" /><i ref={tagEta} className="mono" /></span>
          </Html>
        </group>
      )}
    </group>
  );
}

useGLTF.preload(`${MODELS}ambulance.glb`);

// ---------------------------------------------------------------- hero extras
function HeroExtras({ built, colors, theme }) {
  const ghost = useMemo(() => makeContextMaterial({ color: colors.ghost, contourStep: built.contourStep, opacity: 0 }), [built, colors]);
  const ghostMesh = useRef();
  const base = theme === "dark" ? 0.55 : 0.45;
  useFrame(() => {
    ghost.uniforms.uOpacity.value = base * S.ghost;
    ghostMesh.current.visible = S.ghost > 0.01;
  });
  useEffect(() => () => ghost.dispose(), [ghost]);
  return (
    <>
      <mesh ref={ghostMesh} geometry={built.context} material={ghost} renderOrder={-1} />
    </>
  );
}

function World({ data, theme, reduced, selected, onSelect, onBuilt, onLayer, chapter, panelOpen, missionOpen, note, feature, status }) {
  const { gl, size } = useThree();
  const colors = PALETTE[theme];
  const built = useMemo(() => getLiliw(data), [data]);
  const shared = useMemo(() => makeSharedUniforms(), []);
  // per-barangay highlight uniforms, shared by the map (hover/select) and the app chapter
  const own = useMemo(() => built.pieces.map(() => ({ uHi: { value: 0 }, uDim: { value: 0 } })), [built]);
  const model = useRef();
  const vehicle = useRef(built.route.points[0].clone());
  const [hover, setHover] = useState(null);

  useEffect(() => { onBuilt?.(built); }, [built]); // eslint-disable-line react-hooks/exhaustive-deps

  // the print: layers build up from the bed once the data arrives
  useEffect(() => {
    const u = shared.uPrint;
    if (reduced) { u.value = 1.2; onLayer?.(LAYERS); return; }
    const st = { v: -0.2 };
    const tw = gsap.to(st, {
      v: 1.02, duration: 3.6, delay: 0.3, ease: "power1.inOut",
      onUpdate: () => { u.value = st.v; onLayer?.(Math.round(Math.max(0, Math.min(1, st.v)) * LAYERS)); },
      onComplete: () => { u.value = 1.2; },
    });
    return () => tw.kill();
  }, [shared, reduced]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    gl.domElement.style.cursor = hover !== null && chapter === "map" ? "pointer" : ""; // else CSS grab
  }, [hover, chapter, gl]);

  useFrame(({ clock }) => {
    shared.uMap.value = S.map;
    // phones: on the hero, turn Liliw so its length runs down the tall screen (sway fades to 0 as the story starts)
    const tall = size.width / size.height < 0.8 ? 0.75 * S.sway : 0;
    model.current.rotation.y = S.rot + tall + (reduced ? 0 : S.sway * 0.16 * Math.sin(clock.elapsedTime * 0.22));
  });

  return (
    <>
      <CameraRig built={built} vehicle={vehicle} selected={selected} />
      <group ref={model}>
        <HeroExtras built={built} colors={colors} theme={theme} />
        <Pieces built={built} colors={colors} shared={shared} own={own} selected={selected} onSelect={onSelect} onHover={setHover} hover={hover} chapter={chapter} panelOpen={panelOpen} note={note} />
        <Ground built={built} color={colors.ground} />
        <Net built={built} colors={colors} />
        <Mission built={built} colors={colors} chapter={chapter} vehicle={vehicle} missionOpen={missionOpen} />
        {chapter === "app" && <AppDemo built={built} colors={colors} glow={own} feature={feature} status={status} reduced={reduced} />}
      </group>
      <Clouds color={colors.cloud} />
    </>
  );
}

export default function Scene({ data, theme, reduced, selected, onSelect, onBuilt, onLayer, chapter, active, panelOpen, missionOpen, note, feature, status }) {
  return (
    <Canvas
      frameloop={active ? "always" : "never"}
      dpr={[1, 1.75]}
      camera={{ position: [10.5, 8.3, 12.4], fov: 30, near: 0.1, far: 160 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ touchAction: "pan-y" }}
    >
      <ambientLight intensity={theme === "dark" ? 0.5 : 0.7} />
      <hemisphereLight args={["#fff6e5", "#36414c", 0.55]} />
      <directionalLight position={[-6, 10, -5]} intensity={1.6} />
      <directionalLight position={[6, 4, 6]} intensity={0.35} color="#bcd2ff" />
      {data && (
        <World data={data} theme={theme} reduced={reduced} selected={selected} onSelect={onSelect} onBuilt={onBuilt} onLayer={onLayer} chapter={chapter} panelOpen={panelOpen} missionOpen={missionOpen} note={note} feature={feature} status={status} />
      )}
    </Canvas>
  );
}
