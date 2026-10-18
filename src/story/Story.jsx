import { Component, lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";
import Icon from "../Icon";
import { fmtTime, MISSION_STEPS, missionStage, S } from "./state";
import { loadLiliwData } from "../terrain/data";
import { FEATURES } from "../content";

gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP);

// three.js is the heavy part, so load it after the hero text has painted
const Scene = lazy(() => import("./Scene"));

export class WebGLBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <p className="terrain-fallback">3D map isn’t available on this device.</p> : this.props.children;
  }
}

// extra scroll (in timeline units) for touring the barangays one by one
const TOUR = 0.45;
// the app chapter: where its features start, and how much scroll they share
const APP_AT = TOUR + 1.12, APP_SPAN = 0.72;
const pad = (n) => String(n).padStart(2, "0");

export default function Story({ theme, reduced }) {
  const root = useRef();
  const [data, setData] = useState(null);
  const [built, setBuilt] = useState(null);
  const [chapter, setChapter] = useState("hero");
  const [selected, setSelected] = useState(null);
  const [active, setActive] = useState(true);
  const [loadScene, setLoadScene] = useState(false);
  const layer = useRef(), eta = useRef(), dist = useRef(), steps = useRef([]);
  const [tour, setTour] = useState(null);
  const [hideBgy, setHideBgy] = useState(true); // the map gets the whole screen until the user opens the panel
  const [hideMission, setHideMission] = useState(true);
  const [feature, setFeature] = useState(0);
  const [hideApp, setHideApp] = useState(true); // the map gets the screen; the Features pill opens the list
  const status = useRef(), tlRef = useRef(), featureRef = useRef(0); // opened from the Mission pill; the car carries the steps meanwhile
  S.hideBgy = hideBgy;
  S.hideMission = hideMission;
  const chapterRef = useRef("hero"), selRef = useRef(null), tourRef = useRef(null);
  // tour order: north to south
  const order = useMemo(() => built && built.pieces.map((p, k) => [p.anchor.z, k]).sort((a, b) => a[0] - b[0]).map(([, k]) => k), [built]);
  selRef.current = selected;

  useEffect(() => {
    let alive = true;
    loadLiliwData().then((d) => alive && setData(d)).catch(() => {});
    const id = (window.requestIdleCallback || setTimeout)(() => setLoadScene(true), { timeout: 500 });
    return () => { alive = false; (window.cancelIdleCallback || clearTimeout)(id); };
  }, []);

  // stop rendering 3D once the story has scrolled away
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setActive(e.isIntersecting), { rootMargin: "100px" });
    io.observe(root.current);
    return () => io.disconnect();
  }, []);

  // per-frame bookkeeping outside React: chapter changes, interactivity, the mission HUD
  useEffect(() => {
    const tick = () => {
      const ch = S.cam < 0.5 ? "hero" : S.cam < 1.6 ? "fall" : S.cam < 2.5 ? "map" : S.cam < 3.5 ? "mission" : "app";
      if (ch !== chapterRef.current) {
        chapterRef.current = ch;
        setChapter(ch);
        // each chapter starts from its own framing: undo any drag (by the shortest turn)
        S.yaw = Math.round(S.yaw / (2 * Math.PI)) * 2 * Math.PI;
        S.pitch = 0; S.zoom = 1; S.panX = 0; S.panZ = 0;
      }
      S.interactive = S.p > 0.3 && S.p < TOUR + 0.56;
      S.tourOn = S.p > 0.305 && S.p < TOUR + 0.55;
      const ti = S.tourOn && order ? order[Math.min(order.length - 1, Math.floor(S.tour))] : null;
      if (ti !== tourRef.current) {
        tourRef.current = ti;
        setTour(ti);
        // scrolling on to the next barangay releases a clicked one, so the tour keeps moving instead of sticking
        if (selRef.current !== null) setSelected(null);
      }
      S.orbit = ch !== "fall"; // drag to turn Liliw on the hero, the map, the mission and the app
      S.appOn = ch === "app";
      const fi = Math.min(FEATURES.length - 1, Math.floor(S.feature));
      if (fi !== featureRef.current) { featureRef.current = fi; setFeature(fi); }
      if (!S.interactive && selRef.current !== null) setSelected(null);
      if (ch === "mission" && built && eta.current) {
        eta.current.textContent = fmtTime(built.route.seconds * (1 - S.route));
        dist.current.textContent = `${((built.route.meters * (1 - S.route)) / 1000).toFixed(1)} km`;
        const stage = missionStage();
        steps.current.forEach((el, i) => el && el.setAttribute("data-state", i < stage ? "done" : i === stage ? "active" : "todo"));
      }
    };
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, [built, order]);

  useGSAP(() => {
    // hero intro
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const split = SplitText.create(".hero-title", {
        type: "lines,words", mask: "lines", autoSplit: true,
        onSplit: (self) => gsap.from(self.words, { yPercent: 110, duration: 1.1, stagger: 0.05, ease: "expo.out" }),
      });
      gsap.from([".hero-kicker", ".hero-aside", ".hero-foot > *", ".scroll-cue"], { y: 18, autoAlpha: 0, duration: 0.9, stagger: 0.08, delay: 0.35, ease: "expo.out" });
      return () => split.revert();
    });

    // the scroll story: one timeline, 0..1 = top..bottom of the story section
    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: root.current, start: "top top", end: "bottom bottom", scrub: 0.8,
        onUpdate: (st) => { S.p = st.progress * tl.duration(); }, // in timeline units
      },
    });
    const at = (t, target, vars, d) => tl.to(target, { duration: d, ...vars }, t);

    // 1 · leave the hero: text dissolves upward, camera climbs into the clouds
    // phones: the hero copy just fades where it is (no drift, no blur); wider screens lift and blur it away
    const phone = () => innerWidth < 761;
    at(0.04, ".hero-layer", { autoAlpha: 0, y: () => (phone() ? 0 : -70), filter: () => (phone() ? "blur(0px)" : "blur(14px)"), ease: "power2.in" }, 0.07);
    at(0.05, S, { cam: 1, ease: "power2.in" }, 0.08);
    at(0.05, S, { rot: 0, sway: 0, ease: "power2.inOut" }, 0.08);
    at(0.07, S, { clouds: 1 }, 0.05);
    at(0.085, ".mist", { autoAlpha: 1, ease: "power1.in" }, 0.04);
    // behind the white-out: the print turns into a map
    at(0.12, S, { ghost: 0 }, 0.01);
    // 2 · fall through the clouds onto Liliw
    at(0.13, S, { cam: 2, ease: "power2.out" }, 0.12);
    at(0.13, ".mist", { autoAlpha: 0, ease: "power1.out" }, 0.05);
    at(0.18, S, { clouds: 0 }, 0.07);
    at(0.17, ".ch-land", { autoAlpha: 1, y: 0, ease: "power2.out" }, 0.03);
    at(0.25, ".ch-land", { autoAlpha: 0, y: -30, ease: "power2.in" }, 0.03);
    // 3 · barangay boundaries draw in; the map slides aside for the panel
    at(0.24, S, { borders: 1, ease: "power1.inOut" }, 0.08);
    at(0.25, S, { shift: 1, ease: "power2.inOut" }, 0.05);
    at(0.28, ".ch-bgy", { autoAlpha: 1, y: 0, ease: "power2.out" }, 0.03);
    // with nothing picked, scrolling lifts each barangay in turn, north to south
    at(0.31, S, { tour: 33 }, TOUR + 0.225);
    at(TOUR + 0.555, ".ch-bgy", { autoAlpha: 0, y: -30, ease: "power2.in" }, 0.025);
    // 4 · a mission, live
    at(TOUR + 0.57, S, { cam: 3, shift: 0, ease: "power2.inOut" }, 0.07);
    at(TOUR + 0.58, S, { borders: 0.3 }, 0.05);
    at(TOUR + 0.6, S, { mission: 1, ease: "power2.out" }, 0.04);
    at(TOUR + 0.62, ".ch-mission", { autoAlpha: 1, y: 0, ease: "power2.out" }, 0.03);
    at(TOUR + 0.645, S, { dispatch: 1 }, 0.01);
    at(TOUR + 0.66, S, { route: 1, ease: "power1.inOut" }, 0.27);
    at(TOUR + 0.97, ".ch-mission", { autoAlpha: 0, ease: "power1.in" }, 0.03);
    // 5 · the app: the same terrain, the camera pulls back to all of Liliw, and scrolling plays each feature on it
    at(TOUR + 1.02, S, { cam: 4, mission: 0, ease: "power2.inOut" }, 0.1);
    at(TOUR + 1.02, S, { borders: 1, ease: "power1.inOut" }, 0.06);
    at(TOUR + 1.1, ".ch-app", { autoAlpha: 1, y: 0, ease: "power2.out" }, 0.03);
    at(APP_AT, S, { feature: FEATURES.length }, APP_SPAN);
    tlRef.current = tl;
  }, { scope: root });

  // app chapter: each new feature drops the status bar in and eases its description open
  useGSAP(() => {
    if (reduced) return;
    gsap.fromTo(".ch-app .demo-status", { y: -12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" });
    gsap.fromTo('.ch-app .demo-tab[aria-selected="true"] small', { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power2.out", delay: 0.05 });
  }, { dependencies: [feature], scope: root });
  // picking a feature scrolls to its part of the chapter, so scroll and selection never disagree
  const playFeature = (i) => {
    const tl = tlRef.current, el = root.current;
    if (!tl) return;
    const t = APP_AT + ((i + 0.5) / FEATURES.length) * APP_SPAN;
    scrollTo({ top: el.getBoundingClientRect().top + scrollY + (el.offsetHeight - innerHeight) * (t / tl.duration()), behavior: reduced ? "instant" : "smooth" });
  };

  const choose = (k) => setSelected((s) => (s === k ? null : k));
  const zoomBy = (f) => { S.zoom = Math.min(2.2, Math.max(0.35, S.zoom * f)); };
  const resetView = () => { S.yaw = Math.round(S.yaw / (2 * Math.PI)) * 2 * Math.PI; S.pitch = 0; S.zoom = 1; S.panX = 0; S.panZ = 0; };
  const shown = selected ?? tour;
  const sel = shown !== null && built ? built.pieces[shown] : null;
  const touring = selected === null && tour !== null;
  const km = sel ? sel.anchor.clone().setY(0).distanceTo(built.landmarks.hq.position.clone().setY(0)) * built.kmPerUnit : 0;

  return (
    <section className="story" ref={root} aria-label="Liliw, from above">
      {/* nav target for "The app": the start of the app chapter */}
      <span id="features" className="story-anchor" style={{ top: `calc(${(APP_AT + 0.02) / (APP_AT + APP_SPAN)} * (100% - 100vh))` }} />
      <div className="stage" data-chapter={chapter}>
        <div className="stage-canvas">
          <WebGLBoundary>
            <Suspense fallback={<p className="terrain-fallback mono">Loading terrain…</p>}>
              {loadScene && (
                <Scene
                  data={data} theme={theme} reduced={reduced} selected={shown} onSelect={choose} active={active} chapter={chapter}
                  onBuilt={setBuilt}
                  panelOpen={!hideBgy}
                  missionOpen={!hideMission}
                  note={touring && order ? `Tour · ${order.indexOf(shown) + 1} of ${order.length}` : "Selected"}
                  onLayer={(n) => { if (layer.current) layer.current.textContent = String(n).padStart(3, "0"); }}
                  feature={feature} status={status}
                />
              )}
            </Suspense>
          </WebGLBoundary>
        </div>
        <div className="mist" aria-hidden="true" />

        {/* hero */}
        <div className="layer hero-layer">
          <p className="hero-kicker mono">Liliw, Laguna · 14.13° N, 121.44° E</p>
          <header className="hero-head">
            <h1 className="hero-title">Every call for help in Liliw, answered.</h1>
          </header>
          <p className="hero-aside">From the lakeshore to Mt. Banahaw,<br />help that knows the way.</p>
          <div className="hero-foot">
            <div className="hero-copy">
              <p className="hero-lead">
                <em>Tugon</em> means response. The app connects residents with MAT Liliw, the fire station and the police:
                report what is happening, see who is coming, and get alerts.
              </p>
              <div className="hero-cta">
                <a className="btn btn-primary" href="#download"><Icon name="download" size={20} /> Download the app</a>
                <a className="btn btn-ghost" href="#hotlines"><Icon name="phone" size={20} /> Emergency hotlines</a>
              </div>
            </div>
            <dl className="hero-stats">
              <div><dt>Barangays</dt><dd>33</dd></div>
              <div><dt>Elevation</dt><dd>{data ? `${Math.round(data.elevation_m.min)}–${Math.round(data.elevation_m.max).toLocaleString()} m` : "…"}</dd></div>
              <div><dt>Print</dt><dd className="mono-dd">{reduced ? "Ready" : <><b ref={layer}>000</b>/240</>}</dd></div>
            </dl>
          </div>
          <button
            className="scroll-cue mono"
            onClick={() => scrollTo({ top: root.current.offsetTop + (root.current.offsetHeight - innerHeight) * 0.15, behavior: reduced ? "auto" : "smooth" })}
          >
            <span>Scroll to descend</span><i aria-hidden="true" />
          </button>
        </div>

        {/* chapter: the land */}
        <div className="layer ch ch-land">
          <div className="ch-card">
            <p className="mono eyebrow"><span>01</span> The land</p>
            <h2>From lakeshore plains to the forests of Mt. Banahaw.</h2>
            <p>Liliw climbs from {data ? Math.round(data.elevation_m.min) : 15} m to {data ? Math.round(data.elevation_m.max).toLocaleString() : "2,099"} m in 17 km. Every report lands on this terrain.</p>
          </div>
        </div>

        {/* chapter: barangays */}
        <div className="layer ch ch-bgy">
          <div className={hideBgy ? "ch-card bgy-panel is-hidden" : "ch-card bgy-panel"} aria-hidden={hideBgy || undefined}>
            <button className="ch-hide mono" onClick={() => setHideBgy(true)} aria-label="Hide the barangay panel"><Icon name="minus" size={16} /> Hide</button>
            <p className="mono eyebrow"><span>02</span> 33 barangays</p>
            <h2>Every barangay, on one map.</h2>
            <p className="ch-lead">Drag to turn the map, right-drag or Shift+drag to move it. Tap a barangay to lift it out. Boundaries: PSA 2023.</p>
            <label className="bgy-select">
              <span className="sr-only">Choose a barangay</span>
              <select value={selected ?? ""} onChange={(e) => setSelected(e.target.value === "" ? null : Number(e.target.value))}>
                <option value="">Choose a barangay…</option>
                {data?.barangays.map((b, k) => <option key={b.psgc} value={k}>{b.name}</option>)}
              </select>
            </label>
            <div className="bgy-info" aria-live="polite">
              {sel ? (
                <>
                  {touring && <p className="bgy-touring mono">Tour · {order.indexOf(shown) + 1} of {order.length} · tap any barangay to pick it</p>}
                  <h3>{sel.meta.name}</h3>
                  <dl>
                    <div><dt>Area</dt><dd>{sel.meta.area_km2.toFixed(2)} km²</dd></div>
                    <div><dt>Elevation</dt><dd>{sel.meta.elev_m[0]}–{sel.meta.elev_m[1].toLocaleString()} m</dd></div>
                    <div><dt>To <span className="hide-sm">municipal </span>hall</dt><dd>{km < 0.1 ? "< 0.1" : km.toFixed(1)} km</dd></div>
                  </dl>
                  {!touring && <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>Put it back</button>}
                </>
              ) : (
                <p className="bgy-hint mono">No barangay selected</p>
              )}
            </div>
          </div>
          {hideBgy && (
            <button className="ch-pill" onClick={() => setHideBgy(false)}><Icon name="map" size={18} /> Barangays</button>
          )}
        </div>

        {/* chapter: mission */}
        <div className="layer ch ch-mission">
          <div className={hideMission ? "ch-card mission-card is-hidden" : "ch-card mission-card"} aria-hidden={hideMission || undefined}>
            <button className="ch-hide mono" onClick={() => setHideMission(true)} aria-label="Hide the mission panel"><Icon name="minus" size={16} /> Hide</button>
            <p className="mono eyebrow"><span>03</span> A mission, live <em className="sim">simulation</em></p>
            <h2>Help you can watch arrive.</h2>
            <div className="mission-meter mono">
              <div><span>ETA</span><b ref={eta}>9:19</b></div>
              <div><span>Distance</span><b ref={dist}>5.3 km</b></div>
              <div><span>Unit</span><b>Rescue 1</b></div>
            </div>
            <ol className="mission-steps">
              {MISSION_STEPS.map((s, i) => (
                <li key={s.k} ref={(el) => (steps.current[i] = el)} data-state="todo">
                  <span className="mono">{s.k}</span>
                  <div><h3>{s.title}</h3><p>{s.body}</p></div>
                </li>
              ))}
            </ol>
            <p className="mission-note mono">Real road route from OpenStreetMap · 5.3 km uphill</p>
          </div>
          {hideMission && (
            <button className="ch-pill" onClick={() => setHideMission(false)}><Icon name="route" size={18} /> Mission</button>
          )}
        </div>

        {/* chapter: the app, played on the same terrain */}
        <div className={hideApp ? "layer ch ch-app tabs-hidden" : "layer ch ch-app"}>
          <div className="demo-status">
            <b className="mono">{pad(feature + 1)} / {pad(FEATURES.length)} · {FEATURES[feature].title}</b>
            <p ref={status} />
          </div>
          <p className="demo-note mono">Simulation on the real Liliw terrain · facilities and roads from OpenStreetMap</p>
          <div className="demo-panel" aria-hidden={hideApp || undefined}>
            <button className="ch-hide mono" onClick={() => setHideApp(true)} aria-label="Hide the feature list"><Icon name="minus" size={16} /> Hide</button>
            <div className="demo-tabs" role="tablist" aria-label="App features">
              {FEATURES.map((f, i) => (
                <button key={f.title} className="demo-tab" role="tab" aria-selected={i === feature} onClick={() => playFeature(i)}>
                  <span className="mono">{pad(i + 1)}</span>
                  <Icon name={f.icon} size={22} className="feature-icon" />
                  <span><b>{f.title}</b><small>{f.body}</small></span>
                </button>
              ))}
            </div>
          </div>
          {hideApp && <button className="ch-pill demo-pill" onClick={() => setHideApp(false)}><Icon name="menu" size={18} /> Features</button>}
        </div>

        <div className="map-tools" role="group" aria-label="Map view">
          <button onClick={() => zoomBy(0.8)} aria-label="Zoom in"><Icon name="plus" size={18} /></button>
          <button onClick={() => zoomBy(1.25)} aria-label="Zoom out"><Icon name="minus" size={18} /></button>
          <button onClick={resetView} aria-label="Reset view"><Icon name="rotate" size={18} /></button>
        </div>
      </div>
    </section>
  );
}
