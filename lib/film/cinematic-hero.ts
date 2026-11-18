/**
 * The cinematic hero's motion, framework-free (ported from the approved
 * design-lab mockup `public/design-lab/cinematic/hero.html`).
 *
 * Intro (~4.5s, once): darkness lifts, the moon glows in, the kicker and the
 * name rise, a katana slash cuts across the name (it splits along the cut),
 * then the subtitle, nav and scroll cue arrive. Scrolling drives a camera
 * push toward the swordsman and a closing fog curtain, fully reversible.
 * Embers, maple leaves and fog run throughout.
 *
 * `root` is the hero section. Returns a cleanup function.
 */

type EaseName = "out" | "expo" | "inOut" | "back" | "lin";
interface Track {
  start: number;
  dur: number;
  fn: (p: number) => void;
  e: (t: number) => number;
}
interface Ember { x: number; y: number; r: number; v: number; w: number; hue: number }
interface Leaf { x: number; y: number; s: number; v: number; w: number; rot: number; spin: number; red: boolean }

export interface CinematicHeroOptions {
  /** The fixed site nav to fade in after the slash. */
  nav?: HTMLElement | null;
  /** The fixed progress rail, faded in with the nav. */
  progress?: HTMLElement | null;
}

const EASE: Record<EaseName, (t: number) => number> = {
  out: (t) => 1 - Math.pow(1 - t, 3),
  expo: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  back: (t) => {
    const c = 1.7;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  },
  lin: (t) => t,
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function must<T extends Element>(root: ParentNode, sel: string): T {
  const el = root.querySelector<T>(sel);
  if (!el) throw new Error(`cinematic hero: missing ${sel}`);
  return el;
}

/** Procedural fog: SVG turbulence as a tiling background image. */
function fogTexture(seed: number, freq: string): string {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='1400' height='700'><filter id='f' x='0' y='0'>` +
    `<feTurbulence type='fractalNoise' baseFrequency='${freq}' numOctaves='4' seed='${seed}' stitchTiles='stitch'/>` +
    `<feColorMatrix values='0 0 0 0 0.78  0 0 0 0 0.85  0 0 0 0 0.93  0 0 0 1.25 -0.42'/></filter>` +
    `<rect width='100%' height='100%' filter='url(%23f)'/></svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}

export function initCinematicHero(root: HTMLElement, opts: CinematicHeroOptions = {}): () => void {
  const doc = root.ownerDocument;
  const win = doc.defaultView ?? window;
  const reduce = win.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const lowPower = (navigator.hardwareConcurrency || 8) <= 4 || win.innerWidth < 700;
  const nav = opts.nav ?? null;
  const progressEl = opts.progress ?? null;

  const el = {
    stage: must<HTMLElement>(root, ".ch-stage"),
    bg: must<HTMLElement>(root, ".ch-bg"),
    glow: must<HTMLElement>(root, ".ch-moonglow"),
    veil: must<HTMLElement>(root, ".ch-veil"),
    flash: must<HTMLElement>(root, ".ch-flash"),
    fogA: must<HTMLElement>(root, ".ch-fog-a"),
    fogB: must<HTMLElement>(root, ".ch-fog-b"),
    fogWall: must<HTMLElement>(root, ".ch-fogwall"),
    copy: must<HTMLElement>(root, ".ch-copy"),
    vlabel: must<HTMLElement>(root, ".ch-vlabel"),
    kicker: must<HTMLElement>(root, ".ch-kicker"),
    name: must<HTMLElement>(root, ".ch-name"),
    sub: must<HTMLElement>(root, ".ch-sub"),
    cue: must<HTMLElement>(root, ".ch-cue"),
    cutTop: must<HTMLElement>(root, ".ch-cut-top"),
    cutBot: must<HTMLElement>(root, ".ch-cut-bot"),
    slash: must<SVGSVGElement>(root, ".ch-slash"),
    canvas: must<HTMLCanvasElement>(root, ".ch-particles"),
  };

  // ---------- split text ----------
  // text comes from the markup (data-text), which comes from content/site.json
  el.kicker.innerHTML = `<span class="ch-kicker-txt">${(el.kicker.dataset.text ?? "").split("")
    .map((c) => `<span>${c === " " ? "&nbsp;" : c}</span>`)
    .join("")}</span>`;
  const kickerChars = [...el.kicker.querySelectorAll<HTMLElement>(".ch-kicker-txt span")];
  const lines = [...el.name.querySelectorAll<HTMLElement>(":scope > .ch-name-line")];
  lines.forEach((l) => {
    l.innerHTML = (l.dataset.text ?? "")
      .split("")
      .map((c) => `<span class="ch-char">${c}</span>`)
      .join("");
  });
  const nameChars = lines.flatMap((l) => [...l.querySelectorAll<HTMLElement>(".ch-char")]);
  const copyLines = lines.map((l) => `<span class="ch-name-line">${l.innerHTML}</span>`).join("");
  for (const half of [el.cutTop, el.cutBot]) {
    half.innerHTML = copyLines;
    half.querySelectorAll<HTMLElement>(".ch-char, .ch-name-line").forEach((n) => (n.style.opacity = "1"));
  }

  el.fogA.style.backgroundImage = fogTexture(3, "0.0035 0.009");
  el.fogB.style.backgroundImage = fogTexture(11, "0.0025 0.007");

  // ---------- intro timeline ----------
  const tracks: Track[] = [];
  const at = (start: number, dur: number, fn: (p: number) => void, e: EaseName = "out") =>
    tracks.push({ start, dur, fn, e: EASE[e] });
  const intro = { bgScale: 1.14, bgBright: 0.15, done: false };

  at(0.0, 1.8, (p) => (el.veil.style.opacity = String(1 - p)), "inOut");
  at(0.0, 2.6, (p) => {
    intro.bgScale = lerp(1.14, 1.04, p);
    intro.bgBright = lerp(0.15, 1, p);
  });
  at(0.6, 2.0, (p) => {
    el.glow.style.opacity = String(p);
    el.glow.style.transformOrigin = "79% 27%";
    el.glow.style.transform = `scale(${lerp(0.7, 1, p)})`;
  });
  at(1.1, 0.8, (p) => (el.vlabel.style.opacity = String(p)));
  kickerChars.forEach((c, i) =>
    at(1.2 + i * 0.022, 0.5, (p) => {
      c.style.opacity = String(p);
      c.style.transform = `translateY(${lerp(10, 0, p)}px)`;
    }),
  );
  nameChars.forEach((c, i) =>
    at(
      1.7 + i * 0.06,
      0.95,
      (p) => {
        c.style.opacity = String(p);
        c.style.transform = `translateY(${lerp(105, 0, p)}%) scaleY(${lerp(1.25, 1, p)})`;
      },
      "expo",
    ),
  );

  // the cut: a blade streak travels the arc, leaves a scar, the name splits and settles
  const SLASH = 3.15;
  const [scar, glow, core] = [...el.slash.querySelectorAll<SVGPathElement>("path")];
  const len = scar.getTotalLength();
  for (const p of [glow, core]) {
    p.style.strokeDasharray = `${len * 0.28} ${len * 2}`;
    p.style.strokeDashoffset = `${len * 0.28}`;
    p.style.opacity = "0";
  }
  scar.style.strokeDasharray = `${len} ${len}`;
  scar.style.strokeDashoffset = `${len}`;
  scar.style.opacity = "0";
  const showCut = (on: boolean) => {
    el.cutTop.style.visibility = el.cutBot.style.visibility = on ? "visible" : "hidden";
    lines.forEach((l) => (l.style.visibility = on ? "hidden" : "visible"));
  };
  const offsetCut = (k: number) => {
    el.cutTop.style.transform = `translate(${16 * k}px, ${-9 * k}px)`;
    el.cutBot.style.transform = `translate(${-16 * k}px, ${9 * k}px)`;
  };

  at(SLASH, 0.34, (p) => {
    for (const q of [glow, core]) {
      q.style.opacity = p < 1 ? "1" : "0";
      q.style.strokeDashoffset = `${lerp(len * 0.28, -len, p)}`;
    }
  }, "expo");
  at(SLASH, 0.3, (p) => {
    scar.style.opacity = "1";
    scar.style.strokeDashoffset = `${lerp(len, 0, p)}`;
  }, "expo");
  at(SLASH + 0.35, 1.3, (p) => (scar.style.opacity = String(1 - p)), "inOut");
  at(SLASH + 0.04, 0.12, (p) => (el.flash.style.opacity = String(p * 0.9)));
  at(SLASH + 0.16, 0.7, (p) => (el.flash.style.opacity = String(0.9 * (1 - p))));
  at(SLASH + 0.06, 0.32, (p) => {
    const s = (1 - p) * 9;
    el.stage.style.transform = `translate(${Math.sin(p * 40) * s}px, ${Math.cos(p * 33) * s * 0.6}px)`;
  }, "lin");
  at(SLASH + 0.08, 0.05, (p) => showCut(p > 0), "lin");
  at(SLASH + 0.08, 0.16, (p) => offsetCut(p));
  at(SLASH + 0.5, 0.55, (p) => offsetCut(1 - p), "back");
  at(SLASH + 1.06, 0.01, () => showCut(false), "lin");
  at(SLASH + 0.45, 0.8, (p) => {
    el.sub.style.opacity = String(p);
    el.sub.style.transform = `translateY(${lerp(18, 0, p)}px)`;
  });
  at(SLASH + 0.7, 0.9, (p) => {
    if (nav) nav.style.opacity = String(p);
    if (progressEl) progressEl.style.opacity = String(p);
  });
  at(SLASH + 0.9, 0.9, (p) => (el.cue.style.opacity = String(p)));
  const INTRO_END = Math.max(...tracks.map((t) => t.start + t.dur));

  // Steps that have not started are skipped, so a later step never overrides an earlier one early.
  const renderIntro = (t: number) => {
    for (const k of tracks) if (t >= k.start) k.fn(k.e(clamp01((t - k.start) / k.dur)));
  };

  // ---------- particles ----------
  const ctx = el.canvas.getContext("2d");
  let W = 0;
  let H = 0;
  const DPR = Math.min(win.devicePixelRatio || 1, 2);
  const resize = () => {
    W = el.canvas.clientWidth;
    H = el.canvas.clientHeight;
    el.canvas.width = W * DPR;
    el.canvas.height = H * DPR;
    ctx?.setTransform(DPR, 0, 0, DPR, 0, 0);
  };
  resize();
  let seed = 42;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const nEmbers = reduce ? 0 : lowPower ? 26 : 70;
  const nLeaves = reduce ? 0 : lowPower ? 5 : 14;
  const embers: Ember[] = Array.from({ length: nEmbers }, () => ({
    x: rnd(), y: rnd(), r: 0.6 + rnd() * 1.8, v: 0.012 + rnd() * 0.03, w: rnd() * 6.28, hue: rnd(),
  }));
  const leaves: Leaf[] = Array.from({ length: nLeaves }, () => ({
    x: rnd(), y: rnd(), s: 5 + rnd() * 7, v: 0.02 + rnd() * 0.025, w: rnd() * 6.28,
    rot: rnd() * 6.28, spin: (rnd() - 0.5) * 2, red: rnd() > 0.5,
  }));
  let particleAlpha = 0;
  const drawParticles = (dt: number, time: number) => {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    if (!nEmbers || particleAlpha <= 0) return;
    ctx.globalCompositeOperation = "lighter";
    for (const e of embers) {
      e.y -= e.v * dt;
      e.x += Math.sin(time * 0.9 + e.w) * 0.0006 * dt * 60;
      if (e.y < -0.05) {
        e.y = 1.05;
        e.x = rnd();
      }
      const flick = 0.55 + 0.45 * Math.sin(time * 6 + e.w * 9);
      const x = e.x * W;
      const y = e.y * H;
      const r = e.r * (1 + flick * 0.4);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 5);
      const c = e.hue > 0.82 ? "255,60,40" : "255,140,50";
      g.addColorStop(0, `rgba(255,230,180,${0.9 * flick * particleAlpha})`);
      g.addColorStop(0.25, `rgba(${c},${0.5 * flick * particleAlpha})`);
      g.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r * 5, 0, 6.283);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
    for (const l of leaves) {
      l.y += l.v * dt;
      l.x += Math.sin(time * 1.3 + l.w) * 0.0012 * dt * 60 + 0.0004 * dt * 60;
      l.rot += l.spin * dt;
      if (l.y > 1.06 || l.x > 1.06) {
        l.y = -0.05;
        l.x = rnd() * 0.9;
      }
      ctx.save();
      ctx.translate(l.x * W, l.y * H);
      ctx.rotate(l.rot);
      ctx.scale(1, 0.55 + 0.45 * Math.abs(Math.sin(time * 2 + l.w)));
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const rr = i % 2 ? l.s * 0.42 : l.s;
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fillStyle = l.red ? `rgba(196,52,36,${0.85 * particleAlpha})` : `rgba(226,120,40,${0.85 * particleAlpha})`;
      ctx.fill();
      ctx.restore();
    }
  };

  // ---------- scroll: camera push + fog curtain (reversible) ----------
  let introT = reduce ? INTRO_END : 0;
  const skipIntro = () => {
    introT = INTRO_END;
  };
  let scrollP = 0;
  const readScroll = () => {
    const r = root.getBoundingClientRect();
    const travel = r.height - win.innerHeight;
    scrollP = travel > 0 ? clamp01(-r.top / travel) : 0;
    if (!intro.done && scrollP > 0.02) skipIntro(); // never block someone who wants to scroll
  };

  let shownP = 0;
  const renderScroll = () => {
    shownP += (scrollP - shownP) * (reduce ? 1 : 0.12);
    const p = shownP;
    const push = EASE.inOut(clamp01(p / 0.85));
    const scale = intro.bgScale * lerp(1, 1.42, push);
    el.bg.style.transform = `scale(${scale}) translate3d(${lerp(0, -2.5, push)}%, ${lerp(0, 1.5, push)}%, 0)`;
    el.bg.style.filter = `brightness(${intro.bgBright * lerp(1, 0.82, push)}) saturate(${lerp(1, 1.15, push)})`;
    el.copy.style.transform = `translate3d(0, ${lerp(0, -16, EASE.out(clamp01(p / 0.5)))}vh, 0)`;
    el.copy.style.opacity = String(1 - clamp01((p - 0.08) / 0.32));
    el.cue.style.visibility = p > 0.06 ? "hidden" : "visible";
    el.fogA.style.opacity = String(lerp(0.38, 0.75, clamp01(p / 0.7)));
    el.fogWall.style.opacity = String(EASE.inOut(clamp01((p - 0.62) / 0.38)));
    el.glow.style.filter = `brightness(${lerp(1, 1.4, push)})`;
  };

  // ---------- main loop ----------
  let raf = 0;
  const t0 = performance.now();
  let last = t0;
  const loop = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const time = (now - t0) / 1000;
    if (!intro.done) {
      introT = Math.min(INTRO_END, introT + dt);
      renderIntro(introT);
      if (introT >= INTRO_END) intro.done = true;
    }
    particleAlpha = Math.min(1, Math.max(0, (introT - 0.8) / 1.5));
    if (!reduce) {
      el.fogA.style.backgroundPosition = `${-time * 22}px 0`;
      el.fogB.style.backgroundPosition = `${time * 12}px 0`;
    }
    renderScroll();
    drawParticles(dt, time);
    raf = win.requestAnimationFrame(loop);
  };

  if (reduce) {
    renderIntro(INTRO_END);
    intro.done = true;
    el.veil.style.opacity = "0";
  }
  win.addEventListener("scroll", readScroll, { passive: true });
  win.addEventListener("resize", resize);
  readScroll();
  raf = win.requestAnimationFrame(loop);

  // pause the loop while the hero is off screen
  const io = new IntersectionObserver(([entry]) => {
    if (entry?.isIntersecting && !raf) {
      last = performance.now();
      raf = win.requestAnimationFrame(loop);
    }
    if (!entry?.isIntersecting && raf) {
      win.cancelAnimationFrame(raf);
      raf = 0;
    }
  });
  io.observe(root);

  return () => {
    win.cancelAnimationFrame(raf);
    raf = 0;
    io.disconnect();
    win.removeEventListener("scroll", readScroll);
    win.removeEventListener("resize", resize);
  };
}
