/**
 * Scene "Breathing Techniques" (Skills), framework-free.
 *
 * The scene is pinned; each technique owns one slice of the scroll. In each
 * slice a katana slash in the technique's colour reveals its name, the
 * environment crossfades in with a slow camera push, the element effect
 * plays over it (water ribbons, lightning, fire, mist, sound rings), and the
 * skills arrive as "forms". Scrolling back up reverses everything; the
 * effects themselves animate with time while the scene is on screen.
 *
 * `root` is the scene section. Returns a cleanup function.
 */
import { fogTexture } from "./cinematic-hero";

type Effect = "water" | "thunder" | "flame" | "mist" | "sound";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const seg = (v: number, a: number, b: number) => clamp01((v - a) / (b - a));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function hexToRgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

/** Deterministic 0..1 noise from an integer seed. */
function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function must<T extends Element>(root: ParentNode, sel: string): T {
  const el = root.querySelector<T>(sel);
  if (!el) throw new Error(`breathing: missing ${sel}`);
  return el;
}

export function initBreathing(root: HTMLElement): () => void {
  const win = root.ownerDocument.defaultView ?? window;
  const reduce = win.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const lowPower = (navigator.hardwareConcurrency || 8) <= 4 || win.innerWidth < 700;

  const bgs = [...root.querySelectorAll<HTMLElement>(".br-bg")];
  const techs = [...root.querySelectorAll<HTMLElement>(".br-tech")];
  const N = techs.length;
  const meta = techs.map((t) => ({
    effect: (t.dataset.effect ?? "water") as Effect,
    rgb: hexToRgb(t.dataset.color ?? "#ffffff"),
    color: t.dataset.color ?? "#ffffff",
  }));
  const parts = techs.map((t) => ({
    kanji: must<HTMLElement>(t, ".br-kanji"),
    name: must<HTMLElement>(t, ".br-name"),
    style: t.querySelector<HTMLElement>(".br-style"),
    line: t.querySelector<HTMLElement>(".br-line"),
    forms: [...t.querySelectorAll<HTMLElement>(".br-form")],
  }));
  const counter = must<HTMLElement>(root, ".br-count-now");
  const head = must<HTMLElement>(root, ".br-head");
  const fade = must<HTMLElement>(root, ".br-fade");
  const fogA = must<HTMLElement>(root, ".br-fog-a");
  const fogB = must<HTMLElement>(root, ".br-fog-b");
  const slash = must<SVGSVGElement>(root, ".br-slash");
  const canvas = must<HTMLCanvasElement>(root, ".br-fx");
  const ctx = canvas.getContext("2d");

  fogA.style.backgroundImage = fogTexture(5, "0.003 0.008");
  fogB.style.backgroundImage = fogTexture(17, "0.0022 0.006");

  const [scar, glow, core] = [...slash.querySelectorAll<SVGPathElement>("path")];
  const len = scar.getTotalLength();
  for (const p of [glow, core]) p.style.strokeDasharray = `${len * 0.3} ${len * 2}`;
  scar.style.strokeDasharray = `${len} ${len}`;

  // ---------- canvas ----------
  let W = 0;
  let H = 0;
  const DPR = Math.min(win.devicePixelRatio || 1, 2);
  const resize = () => {
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    ctx?.setTransform(DPR, 0, 0, DPR, 0, 0);
  };
  resize();

  const nEmbers = lowPower ? 40 : 90;
  const embers = Array.from({ length: nEmbers }, (_, i) => ({
    x: hash(i), y: hash(i + 99), r: 0.8 + hash(i + 7) * 2.2, v: 0.04 + hash(i + 3) * 0.08, w: hash(i + 5) * 6.28,
  }));

  const drawWater = (a: number, t: number, rgb: string) => {
    if (!ctx) return;
    ctx.globalCompositeOperation = "lighter";
    const ribbons = lowPower ? 4 : 7;
    for (let k = 0; k < ribbons; k++) {
      ctx.beginPath();
      const base = H * (0.38 + k * 0.07);
      for (let x = -20; x <= W + 20; x += 16) {
        const y = base + Math.sin(x * 0.0042 + t * (0.9 + k * 0.12) + k * 1.7) * H * 0.07 + Math.sin(x * 0.011 - t * 1.6 + k) * H * 0.015;
        if (x === -20) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(${rgb},${a * (0.12 + 0.05 * (k % 3))})`;
      ctx.lineWidth = 1.5 + (k % 3) * 2.5;
      ctx.shadowColor = `rgba(${rgb},${a * 0.6})`;
      ctx.shadowBlur = 14;
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  };

  const bolt = (seed: number, x0: number) => {
    const pts: [number, number][] = [[x0, -10]];
    let x = x0;
    for (let i = 1; i <= 12; i++) {
      x += (hash(seed + i) - 0.5) * W * 0.06;
      pts.push([x, (H * 0.62 * i) / 12]);
    }
    return pts;
  };
  const drawThunder = (a: number, t: number, rgb: string) => {
    if (!ctx) return;
    const period = 1.15;
    const strike = Math.floor(t / period);
    const local = t - strike * period;
    if (local > 0.32) return;
    const flicker = local < 0.06 ? 1 : local < 0.12 ? 0.35 : local < 0.18 ? 0.85 : Math.max(0, 1 - (local - 0.18) / 0.14);
    const alpha = a * flicker;
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = `rgba(${rgb},${alpha * 0.1})`;
    ctx.fillRect(0, 0, W, H);
    const x0 = W * (0.45 + hash(strike) * 0.5);
    for (const [lw, al] of [[10, 0.25], [3, 0.9]] as const) {
      ctx.beginPath();
      bolt(strike * 31, x0).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.strokeStyle = `rgba(${lw > 5 ? rgb : "255,255,240"},${alpha * al})`;
      ctx.lineWidth = lw;
      ctx.shadowColor = `rgba(${rgb},${alpha})`;
      ctx.shadowBlur = 24;
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  };

  const drawFlame = (a: number, t: number, dt: number) => {
    if (!ctx) return;
    ctx.globalCompositeOperation = "lighter";
    // a breathing crescent of fire behind the swordsman
    const cx = W * 0.7;
    const cy = H * 0.5;
    const R = Math.min(W, H) * (0.36 + 0.02 * Math.sin(t * 3));
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.arc(cx, cy, R - k * 18, Math.PI * (0.85 + 0.05 * Math.sin(t * 2 + k)), Math.PI * (1.95 + 0.04 * Math.cos(t * 2.4 + k)));
      ctx.strokeStyle = `rgba(255,${120 + k * 40},40,${a * (0.32 - k * 0.08)})`;
      ctx.lineWidth = 16 - k * 5;
      ctx.shadowColor = `rgba(255,110,30,${a})`;
      ctx.shadowBlur = 30;
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    for (const e of embers) {
      e.y -= e.v * dt;
      e.x += Math.sin(t * 1.4 + e.w) * 0.0008;
      if (e.y < -0.05) {
        e.y = 1.05;
        e.x = hash(e.w * 1000 + t);
      }
      const x = e.x * W;
      const y = e.y * H;
      const g = ctx.createRadialGradient(x, y, 0, x, y, e.r * 5);
      g.addColorStop(0, `rgba(255,220,160,${a * 0.9})`);
      g.addColorStop(0.3, `rgba(255,110,30,${a * 0.5})`);
      g.addColorStop(1, "rgba(255,80,20,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, e.r * 5, 0, 6.283);
      ctx.fill();
    }
  };

  const drawSound = (a: number, t: number, rgb: string) => {
    if (!ctx) return;
    ctx.globalCompositeOperation = "lighter";
    const cx = W * 0.72;
    const cy = H * 0.38;
    const maxR = Math.hypot(W, H) * 0.6;
    const beat = 0.8;
    for (let k = 0; k < 5; k++) {
      const life = ((t + k * beat) % (beat * 5)) / (beat * 5);
      ctx.beginPath();
      ctx.arc(cx, cy, life * maxR, 0, 6.283);
      ctx.strokeStyle = `rgba(${rgb},${a * (1 - life) * 0.55})`;
      ctx.lineWidth = 2 + (1 - life) * 6;
      ctx.stroke();
    }
    const pulse = Math.pow(Math.max(0, Math.cos(((t % beat) / beat) * Math.PI)), 6);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR * 0.5);
    g.addColorStop(0, `rgba(${rgb},${a * pulse * 0.25})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  };

  // ---------- scroll-driven render ----------
  let mistAlpha = 0;
  const weights = new Array<number>(N).fill(0);
  const render = (p: number) => {
    const v = p * N; // position in "technique units"
    for (let j = 0; j < N; j++) {
      const inA = j === 0 ? 1 : seg(v, j - 0.12, j + 0.1);
      const outA = j === N - 1 ? 0 : seg(v, j + 1 - 0.12, j + 1 + 0.1);
      const alpha = reduce ? (Math.min(N - 1, Math.floor(v)) === j ? 1 : 0) : inA * (1 - outA);
      weights[j] = alpha;
      const q = v - j;
      bgs[j].style.opacity = String(alpha);
      bgs[j].style.transform = reduce ? "" : `scale(${lerp(1.16, 1.04, easeOut(seg(q, -0.1, 0.4))) + seg(q, 0.4, 1.1) * 0.04})`;

      const { kanji, name, style, line, forms } = parts[j];
      const enter = j === 0 ? seg(q, 0.02, 0.2) : seg(q, 0.04, 0.2);
      const exit = j === N - 1 ? 0 : seg(q, 0.84, 0.98);
      const show = reduce ? alpha : 1 - exit;
      techs[j].style.visibility = alpha > 0.001 || (q > -0.1 && q < 1.1) ? "visible" : "hidden";
      techs[j].style.opacity = String(reduce ? alpha : show);
      techs[j].style.transform = reduce ? "" : `translate3d(${lerp(0, -40, exit)}px, 0, 0)`;
      const k = reduce ? 1 : easeOut(enter);
      kanji.style.opacity = String(k * 0.9);
      kanji.style.transform = `translate3d(0, ${lerp(30, -30, seg(q, 0, 1))}px, 0) scale(${lerp(1.25, 1, k)})`;
      name.style.clipPath = `inset(0 ${100 - k * 100}% 0 0)`;
      if (style) style.style.opacity = String(k);
      if (line) line.style.opacity = String(reduce ? 1 : easeOut(seg(q, 0.18, 0.3)));
      forms.forEach((f, i) => {
        const fk = reduce ? 1 : easeOut(seg(q, 0.26 + i * 0.07, 0.36 + i * 0.07));
        f.style.opacity = String(fk);
        f.style.transform = `translate3d(${lerp(-24, 0, fk)}px, 0, 0)`;
      });
    }

    // the slash that opens each technique
    const active = Math.min(N - 1, Math.max(0, Math.floor(v + 0.06)));
    const c = reduce ? 0 : seg(v - active, active === 0 ? 0.02 : -0.06, active === 0 ? 0.16 : 0.1);
    slash.style.setProperty("--br-slash", meta[active].color);
    for (const q of [glow, core]) {
      q.style.opacity = c > 0 && c < 1 ? "1" : "0";
      q.style.strokeDashoffset = `${lerp(len * 0.3, -len, easeInOut(c))}`;
    }
    scar.style.strokeDashoffset = `${lerp(len, 0, easeInOut(c))}`;
    scar.style.opacity = String(c > 0 ? 1 - seg(v - active, 0.12, 0.3) : 0);

    counter.textContent = String(Math.min(N, Math.floor(v) + 1)).padStart(2, "0");
    head.style.opacity = String(1 - seg(p, 0.96, 1));
    fade.style.opacity = String(easeInOut(seg(p, 0.95, 1)));
    mistAlpha = meta.reduce((m, t, j) => (t.effect === "mist" ? Math.max(m, weights[j]) : m), 0);
    fogA.style.opacity = String(mistAlpha * 0.85);
    fogB.style.opacity = String(mistAlpha * 0.65);
  };

  const drawFx = (t: number, dt: number) => {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    if (reduce) return;
    meta.forEach((m, j) => {
      const a = weights[j];
      if (a < 0.01) return;
      if (m.effect === "water") drawWater(a, t, m.rgb);
      else if (m.effect === "thunder") drawThunder(a, t, m.rgb);
      else if (m.effect === "flame") drawFlame(a, t, dt);
      else if (m.effect === "sound") drawSound(a, t, m.rgb);
    });
    ctx.globalCompositeOperation = "source-over";
    fogA.style.backgroundPosition = `${-t * 26}px 0`;
    fogB.style.backgroundPosition = `${t * 15}px 0`;
  };

  // ---------- loop: runs only while the scene is on screen ----------
  let target = 0;
  let shown = 0;
  let raf = 0;
  let visible = false;
  const t0 = performance.now();
  let last = t0;
  const read = () => {
    const r = root.getBoundingClientRect();
    const travel = r.height - win.innerHeight;
    target = travel > 0 ? clamp01(-r.top / travel) : 0;
  };
  const loop = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    shown += (target - shown) * (reduce ? 1 : 0.14);
    if (Math.abs(target - shown) < 0.0005) shown = target;
    render(shown);
    drawFx((now - t0) / 1000, dt);
    raf = visible ? win.requestAnimationFrame(loop) : 0;
  };
  const start = () => {
    if (!raf) {
      last = performance.now();
      raf = win.requestAnimationFrame(loop);
    }
  };
  const onScroll = () => {
    read();
    if (visible) start();
  };
  const io = new IntersectionObserver(([entry]) => {
    visible = !!entry?.isIntersecting;
    if (visible) start();
  });
  io.observe(root);
  read();
  shown = target;
  render(shown);
  win.addEventListener("scroll", onScroll, { passive: true });
  const onResize = () => {
    resize();
    onScroll();
  };
  win.addEventListener("resize", onResize);

  return () => {
    win.cancelAnimationFrame(raf);
    raf = 0;
    io.disconnect();
    win.removeEventListener("scroll", onScroll);
    win.removeEventListener("resize", onResize);
  };
}
