/**
 * Scene "The Awakening" (About), framework-free and fully scroll-driven, so
 * scrolling back up plays it in reverse.
 *
 * Arrive in fog from the hero → the camera eases back → the temple's lanterns
 * ignite one by one (a lit copy of the painting is revealed through a pool of
 * light at each lantern) → a katana sweeps across the frame → the chapter
 * title rises → the intro writes itself in, word by word → role and stats
 * count up → the frame darkens into the next section.
 *
 * `root` is the scene section. Returns a cleanup function.
 */

import { filmAudio, crossingUp } from "./audio";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

interface Stat {
  el: HTMLElement;
  prefix: string;
  target: number;
  suffix: string;
}

/** "5→45" → { prefix: "5→", target: 45, suffix: "" }; "800+" → { "", 800, "+" } */
function parseStat(el: HTMLElement): Stat {
  const text = el.dataset.value ?? el.textContent ?? "";
  const m = text.match(/^(.*?)(\d+)(\D*)$/);
  return m ? { el, prefix: m[1], target: Number(m[2]), suffix: m[3] } : { el, prefix: text, target: 0, suffix: "" };
}

function must<T extends Element>(root: ParentNode, sel: string): T {
  const el = root.querySelector<T>(sel);
  if (!el) throw new Error(`awakening: missing ${sel}`);
  return el;
}

export function initAwakening(root: HTMLElement): () => void {
  const win = root.ownerDocument.defaultView ?? window;
  const reduce = win.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const el = {
    camera: must<HTMLElement>(root, ".aw-camera"),
    dark: must<HTMLElement>(root, ".aw-dark"),
    lit: must<HTMLElement>(root, ".aw-lit"),
    fog: must<HTMLElement>(root, ".aw-fog"),
    fade: must<HTMLElement>(root, ".aw-fade"),
    kicker: must<HTMLElement>(root, ".aw-kicker"),
    title: must<HTMLElement>(root, ".aw-title"),
    identity: must<HTMLElement>(root, ".aw-identity"),
    stats: must<HTMLElement>(root, ".aw-stats"),
    slash: must<SVGSVGElement>(root, ".aw-slash"),
  };
  const glows = [...root.querySelectorAll<HTMLElement>(".aw-glow")];
  const lanterns = glows.map((g) => [Number(g.dataset.x), Number(g.dataset.y)] as const);
  const words = [...root.querySelectorAll<HTMLElement>(".aw-word")];
  const stats = [...root.querySelectorAll<HTMLElement>(".aw-num")].map(parseStat);

  const [scar, glow, core] = [...el.slash.querySelectorAll<SVGPathElement>("path")];
  const len = scar.getTotalLength();
  for (const p of [glow, core]) p.style.strokeDasharray = `${len * 0.32} ${len * 2}`;
  scar.style.strokeDasharray = `${len} ${len}`;

  const n = lanterns.length;
  // sounds fire when the matching visual crosses its threshold while scrolling down
  const slashCue = crossingUp();
  const lanternCues = lanterns.map(() => crossingUp());
  let inView = false;
  const render = (p: number) => {
    // arrival: fog clears, the camera eases back, then drifts slowly in
    el.fog.style.opacity = String(1 - easeInOut(seg(p, 0, 0.1)));
    const settle = easeOut(seg(p, 0, 0.35));
    const drift = seg(p, 0.35, 1);
    el.camera.style.transform = `scale(${lerp(1.18, 1.04, settle) + drift * 0.05}) translate3d(${lerp(0, -1.2, drift)}%, 0, 0)`;

    // the temple wakes: base painting brightens, lanterns ignite one by one, then full light
    el.dark.style.filter = `brightness(${lerp(0.22, 0.5, seg(p, 0.1, 0.6))}) saturate(${lerp(0.45, 0.8, seg(p, 0.1, 0.6))})`;
    const dawn = easeInOut(seg(p, 0.5, 0.7));
    const coverW = el.lit.clientWidth;
    const pools = lanterns.map(([x, y], i) => {
      const start = 0.12 + (i * 0.36) / Math.max(1, n);
      const k = easeOut(seg(p, start, start + 0.08));
      lanternCues[i](k, 0.15, () => filmAudio.ignite(0.6 + (i % 3) * 0.15));
      glows[i].style.opacity = String(k * (1 - 0.55 * dawn));
      glows[i].style.transform = `translate(-50%, -50%) scale(${lerp(0.4, 1, k)})`;
      const r = Math.max(1, k * coverW * 0.075);
      return `radial-gradient(circle at ${x}% ${y}%, #000 ${r * 0.3}px, transparent ${r}px)`;
    });
    pools.push(`linear-gradient(rgba(0,0,0,${dawn}), rgba(0,0,0,${dawn}))`);
    const mask = pools.join(", ");
    el.lit.style.maskImage = mask;
    el.lit.style.webkitMaskImage = mask;

    // the katana pass: a blade streak follows the scroll, leaving a fading scar
    const cut = seg(p, 0.22, 0.34);
    slashCue(cut, 0.05, () => filmAudio.slash());
    for (const q of [glow, core]) {
      q.style.opacity = cut > 0 && cut < 1 ? "1" : "0";
      q.style.strokeDashoffset = `${lerp(len * 0.32, -len, easeInOut(cut))}`;
    }
    scar.style.strokeDashoffset = `${lerp(len, 0, easeInOut(cut))}`;
    scar.style.opacity = String(cut > 0 ? 1 - seg(p, 0.36, 0.5) : 0);

    // the chapter title rises, then the intro inks in word by word
    const t = easeOut(seg(p, 0.3, 0.4));
    el.kicker.style.opacity = String(t);
    el.kicker.style.letterSpacing = `${lerp(0.9, 0.5, t)}em`;
    el.title.style.opacity = String(t);
    el.title.style.transform = `translate3d(0, ${lerp(40, 0, t)}px, 0)`;
    words.forEach((w, i) => {
      const s = 0.36 + (i / Math.max(1, words.length)) * 0.24;
      const k = seg(p, s, s + 0.04);
      w.style.opacity = String(lerp(0.1, 1, k));
      w.style.filter = k < 1 ? `blur(${lerp(6, 0, k)}px)` : "none";
    });

    // identity and numbers
    const id = easeOut(seg(p, 0.6, 0.66));
    el.identity.style.opacity = String(id);
    el.identity.style.transform = `translate3d(0, ${lerp(16, 0, id)}px, 0)`;
    const st = seg(p, 0.64, 0.8);
    el.stats.style.opacity = String(easeOut(seg(p, 0.62, 0.68)));
    for (const s of stats) s.el.textContent = `${s.prefix}${Math.round(s.target * easeOut(st))}${s.suffix}`;

    // exit into the next section
    el.fade.style.opacity = String(easeInOut(seg(p, 0.9, 1)));
    filmAudio.setLayer("wind", "awakening", inView ? 0.4 * (1 - seg(p, 0.85, 1)) : 0);
  };

  if (reduce) {
    // no pinning (see CSS): show the settled scene once
    render(0.88);
    return () => {};
  }

  let target = 0;
  let shown = 0;
  let raf = 0;
  const read = () => {
    const r = root.getBoundingClientRect();
    const travel = r.height - win.innerHeight;
    target = travel > 0 ? clamp01(-r.top / travel) : 0;
    inView = r.top < win.innerHeight && r.bottom > 0;
  };
  const loop = () => {
    shown += (target - shown) * 0.14;
    if (Math.abs(target - shown) < 0.0005) shown = target;
    render(shown);
    raf = shown === target ? 0 : win.requestAnimationFrame(loop);
  };
  const onScroll = () => {
    read();
    if (!raf) raf = win.requestAnimationFrame(loop);
  };
  read();
  shown = target;
  render(shown);
  win.addEventListener("scroll", onScroll, { passive: true });
  win.addEventListener("resize", onScroll);

  return () => {
    win.cancelAnimationFrame(raf);
    filmAudio.setLayer("wind", "awakening", 0);
    win.removeEventListener("scroll", onScroll);
    win.removeEventListener("resize", onScroll);
  };
}
