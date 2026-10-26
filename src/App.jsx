import { lazy, Suspense, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";
import Icon from "./Icon";
import { FAQ, FEATURES, HOTLINES, INSTALL, MANUAL, RELEASE } from "./content";
import Story, { WebGLBoundary } from "./story/Story";

const PhoneScene = lazy(() => import("./PhoneScene"));
const FooterTerrain = lazy(() => import("./FooterTerrain"));

gsap.registerPlugin(ScrollTrigger, ScrambleTextPlugin, SplitText, useGSAP);

const NAV = [
  ["download", "Download"],
  ["features", "The app"],
  ["manual", "User manual"],
  ["hotlines", "Hotlines"],
  ["faq", "FAQ"],
];

function useTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || "dark");
  const toggle = () => {
    const t = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem("tugon-theme", t); } catch {}
    setTheme(t);
  };
  return [theme, toggle];
}

function useReducedMotion() {
  const q = "(prefers-reduced-motion: reduce)";
  const [reduced, setReduced] = useState(() => matchMedia(q).matches);
  useEffect(() => {
    const m = matchMedia(q);
    const on = () => setReduced(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return reduced;
}

function Nav({ theme, onTheme }) {
  const [open, setOpen] = useState(false);
  const [away, setAway] = useState(false);
  useEffect(() => {
    let last = scrollY;
    const on = () => {
      const y = scrollY, dy = y - last;
      if (y < 80 || dy < -2) setAway(false); // near the top, or any scroll up: show
      else if (dy > 6) setAway(true); // scrolling down: tuck it away
      last = y;
    };
    addEventListener("scroll", on, { passive: true });
    return () => removeEventListener("scroll", on);
  }, []);
  // let the page reclaim the navbar's room while it is away (CSS eases --nav-space)
  useEffect(() => { document.documentElement.classList.toggle("nav-away", away && !open); }, [away, open]);
  useEffect(() => {
    const close = (e) => e.key === "Escape" && setOpen(false);
    addEventListener("keydown", close);
    return () => removeEventListener("keydown", close);
  }, []);
  return (
    <header className={away && !open ? "nav is-away" : "nav"}>
      <a className="brand" href="#top" aria-label="TUGON home">
        <img src="logo.png" alt="" width="32" height="32" />
        <span>TUGON</span>
      </a>
      <nav id="site-menu" className={open ? "nav-links open" : "nav-links"} aria-label="Main">
        {NAV.map(([id, label]) => (
          <a key={id} href={`#${id}`} onClick={() => setOpen(false)}>{label}</a>
        ))}
      </nav>
      <div className="nav-actions">
        <button className="icon-btn" onClick={onTheme} aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}>
          <Icon name={theme === "dark" ? "sun" : "moon"} size={20} />
        </button>
        <button className="icon-btn menu-btn" aria-expanded={open} aria-controls="site-menu" aria-label="Menu" onClick={() => setOpen(!open)}>
          <Icon name={open ? "close" : "menu"} size={20} />
        </button>
      </div>
    </header>
  );
}

function SectionHead({ index, label, title, children }) {
  return (
    <header className="section-head reveal">
      <p className="mono eyebrow"><span>{index}</span> {label}</p>
      <h2>{title}</h2>
      {children && <p className="section-lead">{children}</p>}
    </header>
  );
}

function Features({ reduced }) {
  return (
    <section className="section" id="app">
      <div className="features-top">
        <SectionHead index="04" label="The app" title="Built for the minutes that matter.">
          Everything a resident needs before, during and after an emergency, in one app that works on any phone.
        </SectionHead>
        <WebGLBoundary><Suspense fallback={null}><PhoneScene reduced={reduced} /></Suspense></WebGLBoundary>
      </div>
    </section>
  );
}

function fmtSize(b) {
  return b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
}

function useRelease(href) {
  const [state, setState] = useState({ status: "checking" });
  useEffect(() => {
    let alive = true;
    // Absolute links (GitHub Releases) can't be probed cross-origin; trust them.
    if (/^https?:\/\//.test(href)) {
      setState({ status: "ok", size: null });
      return;
    }
    fetch(href, { method: "HEAD" })
      .then((r) => {
        const ct = r.headers.get("content-type") || "";
        if (!r.ok || ct.includes("text/html")) throw new Error("missing"); // SPA fallback is not a file
        const len = Number(r.headers.get("content-length"));
        alive && setState({ status: "ok", size: len ? fmtSize(len) : null });
      })
      .catch(() => alive && setState({ status: "missing" }));
    return () => { alive = false; };
  }, [href]);
  return state;
}

function DownloadCard({ icon, platform, file, href, note }) {
  const r = useRelease(href);
  const missing = r.status === "missing";
  const [steps, setSteps] = useState(0); // bumping it replays the install walkthrough
  return (
    <article className="dl reveal">
      <Icon name={icon} size={36} className="dl-icon" />
      <div className="dl-meta mono">
        <span>{file}</span>
        <span>v{RELEASE.version}{r.size ? ` · ${r.size}` : ""}{missing ? " · not published yet" : ""}</span>
      </div>
      <h3>{platform}</h3>
      <p>{note}</p>
      <a
        className={missing ? "btn btn-primary is-disabled" : "btn btn-primary"}
        onClick={() => setSteps((n) => n + 1)}
        href={missing ? undefined : href}
        download={missing ? undefined : true}
        aria-disabled={missing || undefined}
      >
        <Icon name="download" size={20} /> {missing ? "Coming soon" : `Download ${file.split(".").pop().toUpperCase()}`}
      </a>
      <button className="dl-how mono" onClick={() => setSteps((n) => n + 1)} aria-expanded={steps > 0}>How installing works</button>
      {steps > 0 && (
        <ol className="install" key={steps}>
          {INSTALL[icon].map((s, i) => <li key={s} style={{ "--i": i }}><span className="mono">{i + 1}</span>{s}</li>)}
          {missing && <li className="install-soon mono" style={{ "--i": 3 }}>Coming soon · the file isn’t published yet</li>}
        </ol>
      )}
    </article>
  );
}

function Download() {
  return (
    <section className="section" id="download">
      <div className="dl-top">
        <SectionHead index="05" label="Download" title="Get TUGON on your phone.">
          Free for every resident. Download only from this official page.
        </SectionHead>
        <div className="phone-slot" aria-hidden="true" />
      </div>
      <div className="dl-grid">
        <DownloadCard
          icon="android" platform="Android" file="tugon.apk" href={RELEASE.apk}
          note="Android 8 or newer. When asked, allow installing from this browser, just for this install."
        />
        <DownloadCard
          icon="apple" platform="iPhone" file="tugon.ipa" href={RELEASE.ipa}
          note="iOS 13 or newer. Install the IPA with AltStore or Sideloadly until the App Store listing is live."
        />
      </div>
    </section>
  );
}

const plain = (html) => html.replace(/<[^>]+>/g, "").toLowerCase();

// the app buttons a step mentions (its <b> words), as they would show on the phone
const terms = (html) => [...html.matchAll(/<b>(.*?)<\/b>/g)].map((m) => m[1].replace(/&amp;/g, "&"));

function ManualPhone({ topic, step }) {
  const all = [...new Set(topic.steps.flatMap(terms))].slice(0, 6);
  const now = terms(topic.steps[step] || "");
  return (
    <div className="mphone" aria-hidden="true">
      <div className="mphone-screen">
        <p className="mphone-bar mono"><span>9:41</span><span>TUGON</span></p>
        <b className="mphone-title"><Icon name={topic.icon} size={16} /> {topic.title}</b>
        <div className="mphone-ui">
          {all.length ? all.map((t) => (
            <span key={t} className={now.includes(t) ? "mphone-btn is-on" : "mphone-btn"}>{t}</span>
          )) : <span className="mphone-btn is-on">{topic.title}</span>}
        </div>
        <p className="mphone-step mono">Step {step + 1} of {topic.steps.length}</p>
      </div>
    </div>
  );
}

function Manual() {
  const [active, setActive] = useState(MANUAL[0].id);
  const [step, setStep] = useState(0);
  const body = useRef();
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const shown = query
    ? MANUAL.filter((t) => plain([t.title, t.keywords, t.lead, ...t.steps].join(" ")).includes(query))
    : MANUAL.filter((t) => t.id === active);
  const topic = MANUAL.find((t) => t.id === active);
  // walk through the steps on the phone; pointing at a step jumps to it
  useEffect(() => { setStep(0); }, [active]);
  useEffect(() => {
    if (query) return;
    const id = setInterval(() => setStep((s) => (s + 1) % topic.steps.length), 2600);
    return () => clearInterval(id);
  }, [topic, query, step]);
  // switching topics slides the steps in
  useGSAP(() => {
    gsap.matchMedia().add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(".topic li, .topic .tip", { x: 24, autoAlpha: 0, duration: 0.45, stagger: 0.06, ease: "power3.out" });
    });
  }, { dependencies: [active], scope: body });

  return (
    <section className="section" id="manual">
      <SectionHead index="06" label="User manual" title="How to use the app.">
        Short, step-by-step guides. Search or pick a topic.
      </SectionHead>
      <div className="manual reveal">
        <aside className="manual-side">
          <label className="search">
            <Icon name="search" size={18} />
            <span className="sr-only">Search the manual</span>
            <input type="search" placeholder="Search, e.g. “password”" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <div className="toc" role="tablist" aria-label="Manual topics" aria-orientation="vertical">
            {MANUAL.map((t) => (
              <button
                key={t.id}
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={!query && t.id === active}
                aria-controls="manual-panel"
                onClick={() => { setActive(t.id); setQ(""); }}
              >
                <Icon name={t.icon} size={18} /> {t.title}
              </button>
            ))}
          </div>
        </aside>
        <div className="manual-body" id="manual-panel" role="tabpanel" aria-live="polite" ref={body}>
          {shown.length === 0 && <p className="empty">No topic matches “{q}”. Try another word, or call a hotline if you need help now.</p>}
          {shown.map((t) => (
            <article key={t.id} className="topic">
              <h3><Icon name={t.icon} size={22} /> {t.title}</h3>
              <p className="topic-lead">{t.lead}</p>
              <ol>
                {t.steps.map((s, i) => (
                  <li key={i} className={!query && i === step ? "is-now" : undefined} onMouseEnter={() => setStep(i)} onFocus={() => setStep(i)} tabIndex={-1} dangerouslySetInnerHTML={{ __html: s }} />
                ))}
              </ol>
              {t.tip && <p className="tip" dangerouslySetInnerHTML={{ __html: t.tip }} />}
            </article>
          ))}
        </div>
        {!query && <ManualPhone topic={topic} step={step} />}
      </div>
    </section>
  );
}

function Hotlines() {
  return (
    <section className="section hotlines-section" id="hotlines">
      <SectionHead index="07" label="Hotlines" title="In danger right now? Call first.">
        Then file a report in the app so responders get your exact location.
      </SectionHead>
      <ul className="hotlines">
        {HOTLINES.map((h, i) => (
          <li key={h.name} className={i === 0 ? "hotline hotline--main reveal" : "hotline reveal"}>
            <div>
              <h3>{h.name}</h3>
              <p>{h.note}</p>
            </div>
            <div className="hotline-nums">
              {h.numbers.map((n) => (
                <a key={n} className="tel mono" href={`tel:${n.replace(/-/g, "")}`}>
                  <Icon name="phone" size={18} className="ring" /> <span className="num">{n}</span>
                </a>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// a location pin that stays dark until a report is active
function LocationDemo() {
  return (
    <span className="loc-demo mono" aria-hidden="true">
      <Icon name="pin" size={18} />
      <span className="loc-txt"><span className="loc-off">Location off</span><span className="loc-on">Report active · sharing location</span></span>
    </span>
  );
}

function Faq() {
  // answers open and close with a height + fade animation instead of snapping
  const toggle = (e) => {
    e.preventDefault();
    const d = e.currentTarget.parentElement, a = d.querySelector(".faq-a");
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { d.open = !d.open; return; }
    if (!d.open) {
      d.open = true;
      gsap.fromTo(a, { height: 0, autoAlpha: 0 }, { height: "auto", autoAlpha: 1, duration: 0.45, ease: "power3.out" });
    } else {
      gsap.to(a, { height: 0, autoAlpha: 0, duration: 0.3, ease: "power2.in", onComplete: () => { d.open = false; gsap.set(a, { clearProps: "all" }); } });
    }
  };
  return (
    <section className="section" id="faq">
      <SectionHead index="08" label="FAQ" title="Questions, answered." />
      <div className="faq">
        {FAQ.map((f) => (
          <details key={f.q} className="reveal">
            <summary onClick={toggle}>{f.q}<Icon name="plus" size={20} /></summary>
            <div className="faq-a">
              <p>{f.a}</p>
              {f.demo === "location" && <LocationDemo />}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

function Footer({ theme, reduced }) {
  return (
    <footer className="footer">
      <div className="footer-brand">
        <WebGLBoundary><Suspense fallback={null}><FooterTerrain theme={theme} reduced={reduced} /></Suspense></WebGLBoundary>
        <img src="logo.png" alt="" width="40" height="40" />
        <div>
          <strong>TUGON</strong>
          <p>Emergency response for the Municipality of Liliw, Laguna.</p>
        </div>
      </div>
      <p className="mono footer-meta">
        Terrain: AWS Terrain Tiles (SRTM). Barangay boundaries: PSA/NAMRIA 2023.<br />
        Demo route: © OpenStreetMap contributors, routed with OSRM.<br />
        © {new Date().getFullYear()} TUGON · Liliw, Laguna
      </p>
    </footer>
  );
}

// Always-available call button: someone who needs help should never have to scroll for a number.
function EmergencyFab() {
  const [open, setOpen] = useState(false);
  const [tucked, setTucked] = useState(true);
  useEffect(() => {
    const on = () => setTucked(scrollY < innerHeight * 0.4); // shown once you leave the hero
    on();
    addEventListener("scroll", on, { passive: true });
    return () => removeEventListener("scroll", on);
  }, []);
  useEffect(() => {
    const close = (e) => e.key === "Escape" && setOpen(false);
    addEventListener("keydown", close);
    return () => removeEventListener("keydown", close);
  }, []);
  return (
    <div className={`fab${open ? " open" : ""}${tucked && !open ? " is-tucked" : ""}`}>
      <div className="fab-sheet" id="fab-sheet" hidden={!open}>
        <p className="mono">Emergency hotlines</p>
        {HOTLINES.map((h) => (
          <div key={h.name} className="fab-row">
            <span>{h.name}</span>
            {h.numbers.map((n) => (
              <a key={n} className="mono" href={`tel:${n.replace(/-/g, "")}`}><Icon name="phone" size={16} /> {n}</a>
            ))}
          </div>
        ))}
      </div>
      <button className="fab-btn" aria-expanded={open} aria-controls="fab-sheet" onClick={() => setOpen(!open)}>
        <Icon name={open ? "close" : "phone"} size={20} /> {open ? "Close" : "Emergency"}
      </button>
    </div>
  );
}

export default function App() {
  const [theme, toggleTheme] = useTheme();
  const reduced = useReducedMotion();
  const root = useRef();

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      // section headings: words rise out of a mask as they scroll in
      gsap.utils.toArray(".section-head h2").forEach((h) => {
        SplitText.create(h, {
          type: "lines,words", mask: "lines", autoSplit: true,
          onSplit: (self) => gsap.from(self.words, {
            yPercent: 110, duration: 0.9, stagger: 0.04, ease: "expo.out",
            scrollTrigger: { trigger: h, start: "top 88%", once: true },
          }),
        });
      });
      // feature icons draw themselves
      gsap.utils.toArray(".feature-icon").forEach((svg) => {
        const parts = svg.querySelectorAll("path, circle");
        parts.forEach((el) => el.setAttribute("pathLength", "1"));
        gsap.fromTo(parts, { strokeDasharray: 1, strokeDashoffset: 1 }, {
          strokeDashoffset: 0, duration: 1.3, ease: "power2.inOut", stagger: 0.15,
          scrollTrigger: { trigger: svg, start: "top 88%", once: true },
        });
      });
      // hotline numbers lock in like a dispatch board
      gsap.utils.toArray(".tel .num").forEach((el, i) => {
        gsap.to(el, {
          duration: 1.2, delay: i * 0.08, ease: "none",
          scrambleText: { text: el.textContent, chars: "0123456789", revealDelay: 0.35, speed: 0.6 },
          scrollTrigger: { trigger: el, start: "top 92%", once: true },
        });
      });

      gsap.set(".reveal", { y: 28, autoAlpha: 0 });
      ScrollTrigger.batch(".reveal", {
        start: "top 88%",
        once: true,
        onEnter: (els) => gsap.to(els, { y: 0, autoAlpha: 1, duration: 0.8, ease: "power3.out", stagger: 0.07 }),
      });
    });
  }, { scope: root });

  // In-page links: a smooth scroll across the 11-screen 3D story races through every chapter.
  // Far jumps cut most of the way instantly and glide only the last half screen.
  useEffect(() => {
    const go = (e) => {
      const a = e.target.closest?.('a[href^="#"]');
      if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const el = a.hash.length > 1 && document.getElementById(a.hash.slice(1));
      if (!el) return;
      e.preventDefault();
      const pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
      const top = el.getBoundingClientRect().top + scrollY - pad;
      const far = top - scrollY;
      if (Math.abs(far) > innerHeight * 1.5) scrollTo({ top: top - Math.sign(far) * innerHeight * 0.5, behavior: "instant" });
      scrollTo({ top, behavior: reduced ? "instant" : "smooth" });
      history.pushState(null, "", a.hash);
      el.focus?.({ preventScroll: true });
    };
    document.addEventListener("click", go);
    return () => document.removeEventListener("click", go);
  }, [reduced]);

  // cursor spotlight on cards (CSS reads --mx / --my)
  useEffect(() => {
    const move = (e) => {
      const card = e.target.closest?.(".dl, .hotline");
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${e.clientX - r.left}px`);
      card.style.setProperty("--my", `${e.clientY - r.top}px`);
    };
    addEventListener("pointermove", move, { passive: true });
    return () => removeEventListener("pointermove", move);
  }, []);

  return (
    <div ref={root}>
      <a className="skip" href="#main">Skip to content</a>
      <Nav theme={theme} onTheme={toggleTheme} />
      <main id="main">
        <Story theme={theme} reduced={reduced} />
        <Features reduced={reduced} />
        <Download />
        <Manual />
        <Hotlines />
        <Faq />
      </main>
      <Footer theme={theme} reduced={reduced} />
      <EmergencyFab />
    </div>
  );
}
