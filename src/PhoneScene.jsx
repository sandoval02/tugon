import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import * as THREE from "three";

// A phone running the app: the screen is a canvas redrawn every frame (live tracking demo).
const W = 480, H = 1020, LOOP = 9; // seconds per demo loop
const ROUTE = [[90, 640], [150, 600], [140, 520], [230, 470], [260, 390], [350, 340], [330, 260], [400, 200]];
const LENS = ROUTE.reduce((a, p, i) => (i ? [...a, a[i - 1] + Math.hypot(p[0] - ROUTE[i - 1][0], p[1] - ROUTE[i - 1][1])] : [0]), []);
const TOTAL = LENS[LENS.length - 1];

const at = (d) => {
  let i = 0;
  while (i < LENS.length - 2 && LENS[i + 1] < d) i++;
  const f = (d - LENS[i]) / (LENS[i + 1] - LENS[i]);
  return [ROUTE[i][0] + (ROUTE[i + 1][0] - ROUTE[i][0]) * f, ROUTE[i][1] + (ROUTE[i + 1][1] - ROUTE[i][1]) * f, i];
};
// roundRect is missing before Safari 16 (iOS 15): square corners there instead of an error every frame
const rrect = (c, x, y, w, h, r) => (c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h));
const box = (c, x, y, w, h, r, fill) => { c.beginPath(); rrect(c, x, y, w, h, r); c.fillStyle = fill; c.fill(); };

function draw(c, t) {
  const k = (t % LOOP) / LOOP;
  const p = Math.min(1, Math.max(0, (k - 0.15) / 0.7)); // drive between 15% and 85% of the loop
  c.fillStyle = "#071228"; c.fillRect(0, 0, W, H);
  c.fillStyle = "#e9edf2"; c.font = "600 22px 'Plus Jakarta Sans', sans-serif"; c.fillText("9:41", 36, 52);
  c.font = "700 34px Sora, sans-serif"; c.fillText("TUGON", 36, 112);
  c.fillStyle = "#9aa7b4"; c.font = "400 20px 'Plus Jakarta Sans', sans-serif";
  c.fillText(p >= 1 ? "Rescue 1 has arrived" : "Rescue 1 is on the way", 36, 142);

  // map
  c.save();
  c.beginPath(); rrect(c, 24, 170, W - 48, 540, 22); c.clip();
  c.fillStyle = "#0c1e3d"; c.fillRect(24, 170, W - 48, 540);
  c.strokeStyle = "rgba(47,123,255,0.22)"; c.lineWidth = 1;
  for (let x = 24; x < W; x += 40) { c.beginPath(); c.moveTo(x, 170); c.lineTo(x, 710); c.stroke(); }
  for (let y = 170; y < 710; y += 40) { c.beginPath(); c.moveTo(24, y); c.lineTo(W, y); c.stroke(); }
  c.lineCap = c.lineJoin = "round";
  c.setLineDash([8, 10]); c.strokeStyle = "rgba(233,237,242,0.45)"; c.lineWidth = 4;
  c.beginPath(); ROUTE.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
  c.setLineDash([]);
  const [cx, cy, seg] = at(p * TOTAL);
  c.strokeStyle = "#ff6b2c"; c.lineWidth = 8;
  c.beginPath(); c.moveTo(...ROUTE[0]); for (let i = 1; i <= seg; i++) c.lineTo(...ROUTE[i]); c.lineTo(cx, cy); c.stroke();
  // municipal hall, incident (pulsing), unit
  c.fillStyle = "#7fb08a"; c.beginPath(); c.arc(...ROUTE[0], 11, 0, 7); c.fill();
  const pulse = (t * 0.8) % 1;
  c.strokeStyle = `rgba(255,74,61,${1 - pulse})`; c.lineWidth = 4;
  c.beginPath(); c.arc(...ROUTE[ROUTE.length - 1], 12 + pulse * 34, 0, 7); c.stroke();
  c.fillStyle = "#ff4a3d"; c.beginPath(); c.arc(...ROUTE[ROUTE.length - 1], 12, 0, 7); c.fill();
  c.fillStyle = "rgba(255,107,44,0.3)"; c.beginPath(); c.arc(cx, cy, 24, 0, 7); c.fill();
  c.fillStyle = "#fff"; c.beginPath(); c.arc(cx, cy, 12, 0, 7); c.fill();
  c.restore();

  // trip card
  box(c, 24, 730, W - 48, 250, 22, "#10203d");
  c.fillStyle = "#9aa7b4"; c.font = "500 18px 'JetBrains Mono', monospace";
  c.fillText("ETA", 52, 782); c.fillText("DISTANCE", 260, 782);
  c.fillStyle = "#e9edf2"; c.font = "700 52px Sora, sans-serif";
  const s = Math.round(559 * (1 - p));
  c.fillText(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`, 52, 842);
  c.fillText(`${(5.3 * (1 - p)).toFixed(1)}`, 260, 842);
  c.font = "500 22px 'Plus Jakarta Sans', sans-serif"; c.fillStyle = "#9aa7b4"; c.fillText("km", 372, 842);
  box(c, 52, 880, W - 104, 12, 6, "#243040");
  box(c, 52, 880, Math.max(12, (W - 104) * p), 12, 6, "#ff6b2c");
  c.fillStyle = "#e9edf2"; c.font = "600 22px 'Plus Jakarta Sans', sans-serif"; c.fillText("Rescue 1 · MAT Liliw", 52, 940);

  // push notification slides in at the start of each loop
  const n = Math.min(1, Math.max(0, k < 0.3 ? k / 0.04 : (0.36 - k) / 0.06));
  if (n > 0) {
    const y = -110 + n * 180;
    box(c, 20, y, W - 40, 96, 20, "rgba(233,237,242,0.96)");
    box(c, 38, y + 22, 52, 52, 12, "#ff6b2c");
    c.fillStyle = "#0b0f14"; c.font = "700 21px 'Plus Jakarta Sans', sans-serif"; c.fillText("Report received", 106, y + 44);
    c.font = "400 18px 'Plus Jakarta Sans', sans-serif"; c.fillText("MAT Liliw is responding", 106, y + 72);
  }
}

function Phone({ reduced }) {
  const group = useRef(), pin = useRef();
  const { canvas, tex } = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return { canvas, tex };
  }, []);
  const ctx = useMemo(() => canvas.getContext("2d"), [canvas]);
  useEffect(() => () => tex.dispose(), [tex]);
  useFrame(({ clock, pointer }) => {
    const t = reduced ? LOOP * 0.6 : clock.elapsedTime;
    draw(ctx, t);
    tex.needsUpdate = true;
    if (reduced) return;
    const g = group.current;
    g.rotation.y += (-0.35 + Math.sin(t * 0.5) * 0.12 + pointer.x * 0.35 - g.rotation.y) * 0.06;
    g.rotation.x += (-pointer.y * 0.15 - g.rotation.x) * 0.06;
    g.position.y = Math.sin(t * 0.9) * 0.05;
    pin.current.position.y = 0.95 + Math.abs(Math.sin(t * 2)) * 0.18;
    pin.current.rotation.y = t;
  });
  return (
    <group ref={group}>
      <RoundedBox args={[1, 2.05, 0.1]} radius={0.12} smoothness={6}>
        <meshStandardMaterial color="#1a2433" metalness={0.6} roughness={0.35} />
      </RoundedBox>
      <mesh position-z={0.051}>
        <planeGeometry args={[0.92, 1.95]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      {/* a location pin bouncing beside the phone */}
      <group ref={pin} position={[0.78, 0.95, 0.15]} scale={0.16}>
        <mesh position-y={0.55}><sphereGeometry args={[0.5, 32, 32]} /><meshStandardMaterial color="#ff6b2c" roughness={0.35} /></mesh>
        <mesh rotation-x={Math.PI} position-y={-0.15}><coneGeometry args={[0.43, 0.9, 32]} /><meshStandardMaterial color="#ff6b2c" roughness={0.35} /></mesh>
        <mesh position={[0, 0.55, 0.42]}><sphereGeometry args={[0.18, 20, 20]} /><meshStandardMaterial color="#fff" /></mesh>
      </group>
    </group>
  );
}

export default function PhoneScene({ reduced }) {
  const wrap = useRef();
  const [active, setActive] = useState(false);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setActive(e.isIntersecting));
    io.observe(wrap.current);
    return () => io.disconnect();
  }, []);
  // scrolling into Download flies the phone down from "The app" to settle beside the download heading
  useGSAP(() => {
    gsap.registerPlugin(ScrollTrigger);
    const slot = document.querySelector(".phone-slot");
    if (!slot || reduced) return;
    gsap.matchMedia().add("(min-width: 761px)", () => {
      const el = wrap.current;
      const delta = () => {
        gsap.set(el, { x: 0, y: 0 }); // measure from the resting spot
        const a = el.getBoundingClientRect(), b = slot.getBoundingClientRect();
        return { x: b.left + b.width / 2 - (a.left + a.width / 2), y: b.top + b.height / 2 - (a.top + a.height / 2) };
      };
      let d = delta();
      gsap.to(el, {
        x: () => d.x, y: () => d.y, scale: 0.78, rotation: -6, ease: "power1.inOut",
        scrollTrigger: { trigger: "#download", start: "top 95%", end: "top 25%", scrub: 0.6, invalidateOnRefresh: true, onRefreshInit: () => { d = delta(); } },
      });
    });
  }, { dependencies: [reduced] });
  return (
    <div ref={wrap} className="phone-3d" aria-hidden="true">
      <Canvas frameloop={active ? "always" : "never"} dpr={[1, 1.75]} camera={{ position: [0, 0, 4.2], fov: 35 }} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 4, 5]} intensity={1.8} />
        <directionalLight position={[-4, -2, 2]} intensity={0.8} color="#3d7bff" />
        <Phone reduced={reduced} />
      </Canvas>
    </div>
  );
}
