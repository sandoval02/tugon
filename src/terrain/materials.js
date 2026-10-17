import * as THREE from "three";

// Scene colours per theme (story map + app demo).
export const PALETTE = {
  dark: {
    filament: "#e4dfd4", contour: "#6c6455", accent: "#ff6a2b", ghost: "#6f9bd6",
    dim: "#14233a", soil: "#5b4636", rock: "#8197a6", ground: "#0a1528", cloud: "#a9b4c1", line: "#f3f5f7",
    net: "#2f7bff", netHot: "#a8d4ff", netAdd: true,
    hq: "#7fb08a", incident: "#ff4a3d",
    hyp: ["#35603f", "#5f8a4c", "#9c9a5c", "#8a6c52", "#d9d4ca"],
  },
  light: {
    filament: "#e3ecf8", contour: "#5f6f86", accent: "#d2480f", ghost: "#3d6fae",
    dim: "#9fb3cf", soil: "#6e523d", rock: "#8aa3b8", ground: "#d3e2f6", cloud: "#ffffff", line: "#0d1b2e",
    net: "#2a63b8", netHot: "#0f7bff", netAdd: false,
    hq: "#2f6b4f", incident: "#d42a1e",
    hyp: ["#35603f", "#5f8a4c", "#9c9a5c", "#8a6c52", "#e4dfd4"],
  },
};

// Uniforms shared by every piece: the print cut (hero) and the print -> map blend (scroll).
export function makeSharedUniforms() {
  return { uPrint: { value: 1.2 }, uMap: { value: 0 } };
}

// Terrain material for barangay tops (wall = false) and side walls (wall = true).
// Print look: matte filament with 100 m contours and FDM layer lines.
// Map look: hypsometric tint (lowland green -> slope brown -> summit) with contours.
// `own` = per-piece uniforms { uHi, uDim } shared by that piece's top and walls.
export function makeTerrainMaterial({ shared, own, wall, colors, contourStep }) {
  const uniforms = {
    ...shared,
    ...own,
    uContour: { value: new THREE.Color(colors.contour) },
    uAccent: { value: new THREE.Color(colors.accent) },
    uDimTo: { value: new THREE.Color(colors.dim) },
    uStep: { value: contourStep },
    uWall: { value: wall ? 1 : 0 },
    uSoil: { value: new THREE.Color(colors.soil) },
    uH0: { value: new THREE.Color(colors.hyp[0]) },
    uH1: { value: new THREE.Color(colors.hyp[1]) },
    uH2: { value: new THREE.Color(colors.hyp[2]) },
    uH3: { value: new THREE.Color(colors.hyp[3]) },
    uH4: { value: new THREE.Color(colors.hyp[4]) },
  };
  const mat = new THREE.MeshStandardMaterial({ color: colors.filament, roughness: 0.85, metalness: 0, side: THREE.DoubleSide });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aElev;\nvarying float vElev;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvElev = aElev;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
uniform float uPrint; uniform float uMap; uniform float uHi; uniform float uDim; uniform float uWall; uniform float uStep;
uniform vec3 uContour; uniform vec3 uAccent; uniform vec3 uDimTo; uniform vec3 uSoil;
uniform vec3 uH0; uniform vec3 uH1; uniform vec3 uH2; uniform vec3 uH3; uniform vec3 uH4;
varying float vElev;
vec3 hyp(float e) {
  float t = pow(clamp(e, 0.0, 1.0), 0.5);
  if (t < 0.25) return mix(uH0, uH1, t / 0.25);
  if (t < 0.45) return mix(uH1, uH2, (t - 0.25) / 0.2);
  if (t < 0.7) return mix(uH2, uH3, (t - 0.45) / 0.25);
  return mix(uH3, uH4, (t - 0.7) / 0.3);
}`
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
if (vElev > uPrint) discard;
float t = vElev / uStep;
float line = 1.0 - min(abs(fract(t - 0.5) - 0.5) / max(fwidth(t), 1e-4), 1.0);
vec3 printCol = diffuseColor.rgb;
printCol = mix(printCol, uContour, line * 0.6 * step(0.0, vElev) * (1.0 - uWall));
printCol *= 0.965 + 0.035 * sin(vElev * 900.0);
vec3 mapCol = uWall > 0.5 ? uSoil * (0.88 + 0.12 * sin(vElev * 140.0)) : hyp(vElev);
mapCol = mix(mapCol, mapCol * 0.55, line * 0.55 * (1.0 - uWall));
diffuseColor.rgb = mix(printCol, mapCol, uMap);
diffuseColor.rgb = mix(diffuseColor.rgb, uDimTo, uDim * 0.38);
diffuseColor.rgb = mix(diffuseColor.rgb, uAccent, uHi * (uWall > 0.5 ? 0.06 : 0.2));`
      )
      .replace(
        "#include <dithering_fragment>",
        `#include <dithering_fragment>
if (uPrint < 1.0 && !gl_FrontFacing) gl_FragColor.rgb = uAccent * 0.9;
if (uPrint < 1.0 && vElev > uPrint - 0.008) gl_FragColor.rgb = mix(gl_FragColor.rgb, uAccent * 1.4, 0.85);`
      );
  };
  return mat;
}

// The iceberg underside of a lifted barangay: faceted rock with faint strata.
export function makeRockMaterial({ colors }) {
  const mat = new THREE.MeshStandardMaterial({ color: colors.rock, roughness: 0.95, metalness: 0, flatShading: true });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aElev;\nvarying float vElev;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvElev = aElev;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vElev;")
      .replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.rgb *= 0.86 + 0.14 * sin(vElev * 55.0);");
  };
  return mat;
}

// Surrounding terrain: contour lines only, fading out toward the edges.
export function makeContextMaterial({ color, contourStep, opacity }) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uStep: { value: contourStep * 2.0 },
      uOpacity: { value: opacity },
    },
    vertexShader: `attribute float aElev; varying float vElev; varying vec2 vXZ;
      void main(){ vElev = aElev; vXZ = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uColor; uniform float uStep; uniform float uOpacity; varying float vElev; varying vec2 vXZ;
      void main(){
        float t = vElev / uStep;
        float line = 1.0 - min(abs(fract(t - 0.5) - 0.5) / max(fwidth(t), 1e-4), 1.0);
        float a = line * (1.0 - smoothstep(3.0, 6.5, length(vXZ))) * uOpacity;
        if (a < 0.01) discard;
        gl_FragColor = vec4(uColor, a);
      }`,
  });
}

// Ground under the map: a soft disc so a lifted barangay leaves a visible socket.
export function makeGroundMaterial({ color }) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv;
      void main(){ float r = length(vUv - 0.5) * 2.0; gl_FragColor = vec4(uColor, (1.0 - smoothstep(0.35, 1.0, r)) * uOpacity); }`,
  });
}

// The net: thin grid lines with nodes, a cursor glow with ripples, and a slow pulse from the centre.
export function makeNetMaterial({ color, hot, additive }) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uHot: { value: new THREE.Color(hot) },
      uMouse: { value: new THREE.Vector2(99, 99) },
      uTime: { value: 0 },
    },
    vertexShader: `varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uColor; uniform vec3 uHot; uniform vec2 uMouse; uniform float uTime; varying vec3 vPos;
      void main(){
        vec2 p = vPos.xz;
        vec2 c = p / 0.42;
        vec2 g = abs(fract(c - 0.5) - 0.5) / fwidth(c);
        float line = 1.0 - min(min(g.x, g.y), 1.0);
        float node = 1.0 - smoothstep(0.05, 0.12, length(fract(c + 0.5) - 0.5));
        float r = length(p);
        float fade = 1.0 - smoothstep(3.0, 17.0, r);
        float d = distance(p, uMouse);
        float near = exp(-d * d * 0.28);
        float ripple = smoothstep(0.7, 1.0, sin(d * 4.5 - uTime * 3.2)) * exp(-d * 0.45);
        float pulse = smoothstep(0.94, 1.0, sin(r * 0.9 - uTime * 0.9)) * 0.6;
        float energy = 0.22 + near * 1.3 + ripple * 0.9 + pulse;
        float a = (line * 0.5 + node * 0.85) * energy * fade;
        if (a < 0.004) discard;
        gl_FragColor = vec4(mix(uColor, uHot, clamp(near + ripple * 0.6, 0.0, 1.0)), min(a, 1.0));
      }`,
  });
}

// Soft cloud puff drawn on a canvas, no image download needed.
let cloudTex;
export function cloudTexture() {
  if (cloudTex) return cloudTex;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  for (let k = 0; k < 14; k++) {
    const x = 64 + Math.cos(k * 2.4) * 22 * ((k % 3) / 3 + 0.4), y = 64 + Math.sin(k * 2.4) * 14 * ((k % 4) / 4 + 0.4);
    const r = 22 + (k % 5) * 6;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, "rgba(255,255,255,0.55)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
  }
  cloudTex = new THREE.CanvasTexture(c);
  cloudTex.colorSpace = THREE.SRGBColorSpace;
  return cloudTex;
}
