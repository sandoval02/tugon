import { Suspense, use, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { getLiliw } from "./terrain/buildLiliw";
import { loadLiliwData } from "./terrain/data";
import { makeSharedUniforms, makeTerrainMaterial, PALETTE } from "./terrain/materials";

// A small Liliw turning slowly by the footer logo: the page ends on the terrain it opened with.
function Liliw({ theme, reduced }) {
  const built = getLiliw(use(loadLiliwData()));
  const colors = PALETTE[theme];
  const mats = useMemo(() => {
    const shared = makeSharedUniforms();
    shared.uMap.value = 1; // map tint, as in the story
    return built.pieces.map(() => {
      const own = { uHi: { value: 0 }, uDim: { value: 0 } };
      return [false, true].map((wall) => makeTerrainMaterial({ shared, own, wall, colors, contourStep: built.contourStep }));
    });
  }, [built, colors]);
  useEffect(() => () => mats.flat().forEach((m) => m.dispose()), [mats]);
  const group = useRef();
  useFrame((_, dt) => { if (!reduced) group.current.rotation.y += dt * 0.18; });
  return (
    <group ref={group} rotation-y={0.6}>
      {built.pieces.map((p, k) => (
        <group key={k}>
          <mesh geometry={p.top} material={mats[k][0]} />
          <mesh geometry={p.walls} material={mats[k][1]} />
        </group>
      ))}
    </group>
  );
}

export default function FooterTerrain({ theme, reduced }) {
  const wrap = useRef();
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting));
    io.observe(wrap.current);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={wrap} className="footer-terrain" aria-hidden="true">
      <Canvas frameloop={inView ? "always" : "never"} dpr={[1, 1.5]} camera={{ position: [9.5, 9, 9.5], fov: 30 }} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={0.7} />
        <hemisphereLight args={["#fff6e5", "#36414c", 0.55]} />
        <directionalLight position={[-6, 10, -5]} intensity={1.6} />
        {/* waiting for the terrain must suspend in here: outside, it would remount the canvas and lose its context */}
        <Suspense fallback={null}><Liliw theme={theme} reduced={reduced} /></Suspense>
      </Canvas>
    </div>
  );
}
