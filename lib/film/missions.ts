/**
 * Scene "Projects" (The Missions), framework-free and scroll-driven.
 *
 * Pinned; each project owns one slice of the scroll. A katana slash in the
 * project's colour opens its slice, its painting crossfades in with a slow
 * camera push, the title is cut in, then the story, tags and links arrive.
 * Scrolling back up reverses it. Only the visible project's links can be
 * clicked.
 *
 * `root` is the scene section. Returns a cleanup function.
 */
import { filmAudio, crossingUp } from "./audio";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const seg = (v: number, a: number, b: number) => clamp01((v - a) / (b - a));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function must<T extends Element>(root: ParentNode, sel: string): T {
  const el = root.querySelector<T>(sel);
  if (!el) throw new Error(`missions: missing ${sel}`);
  return el;
}

export function initMissions(root: HTMLElement): () => void {
  const win = root.ownerDocument.defaultView ?? window;
  const reduce = win.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const bgs = [...root.querySelectorAll<HTMLElement>(".pr-bg")];
  const cards = [...root.querySelectorAll<HTMLElement>(".pr-card")];
  const N = cards.length;
  const parts = cards.map((c) => ({
    num: c.querySelector<HTMLElement>(".pr-num"),
    title: must<HTMLElement>(c, ".pr-title"),
    later: [...c.querySelectorAll<HTMLElement>(".pr-reveal")],
  }));
  const colors = cards.map((c) => c.dataset.color ?? "#ffffff");
  const counter = must<HTMLElement>(root, ".pr-count-now");
  const head = must<HTMLElement>(root, ".pr-head");
  const fade = must<HTMLElement>(root, ".pr-fade");
  const slash = must<SVGSVGElement>(root, ".pr-slash");
  const [scar, glow, core] = [...slash.querySelectorAll<SVGPathElement>("path")];
  const len = scar.getTotalLength();
  for (const p of [glow, core]) p.style.strokeDasharray = `${len * 0.3} ${len * 2}`;
  scar.style.strokeDasharray = `${len} ${len}`;
  const cues = cards.map(() => crossingUp());

  const render = (p: number) => {
    const v = p * N;
    for (let j = 0; j < N; j++) {
      const q = v - j;
      const inA = j === 0 ? 1 : seg(v, j - 0.12, j + 0.1);
      const outA = j === N - 1 ? 0 : seg(v, j + 1 - 0.12, j + 1 + 0.1);
      const alpha = reduce ? (Math.min(N - 1, Math.floor(v)) === j ? 1 : 0) : inA * (1 - outA);
      bgs[j].style.opacity = String(alpha);
      bgs[j].style.transform = reduce ? "" : `scale(${lerp(1.14, 1.03, easeOut(seg(q, -0.1, 0.5))) + seg(q, 0.5, 1.1) * 0.03})`;

      const enter = reduce ? 1 : easeOut(seg(q, j === 0 ? 0.02 : 0.04, 0.2));
      const exit = reduce || j === N - 1 ? 0 : seg(q, 0.84, 0.98);
      const shown = reduce ? alpha : (1 - exit) * Math.min(1, enter * 4);
      cards[j].style.opacity = String(shown);
      cards[j].style.visibility = shown > 0.01 ? "visible" : "hidden";
      cards[j].style.transform = reduce ? "" : `translate3d(${lerp(0, -40, exit)}px, 0, 0)`;
      const { num, title, later } = parts[j];
      title.style.clipPath = `inset(0 ${100 - enter * 100}% 0 0)`;
      if (num) num.style.transform = `translate3d(0, ${lerp(24, -24, seg(q, 0, 1))}px, 0)`;
      later.forEach((el, i) => {
        const k = reduce ? 1 : easeOut(seg(q, 0.18 + i * 0.06, 0.3 + i * 0.06));
        el.style.opacity = String(k);
        el.style.transform = `translate3d(0, ${lerp(16, 0, k)}px, 0)`;
      });
    }

    // the slash that opens each project
    const active = Math.min(N - 1, Math.max(0, Math.floor(v + 0.06)));
    const c = reduce ? 0 : seg(v - active, active === 0 ? 0.02 : -0.06, active === 0 ? 0.16 : 0.1);
    slash.style.setProperty("--pr-slash", colors[active]);
    cues[active](c, 0.05, () => filmAudio.slash());
    for (const q of [glow, core]) {
      q.style.opacity = c > 0 && c < 1 ? "1" : "0";
      q.style.strokeDashoffset = `${lerp(len * 0.3, -len, easeInOut(c))}`;
    }
    scar.style.strokeDashoffset = `${lerp(len, 0, easeInOut(c))}`;
    scar.style.opacity = String(c > 0 ? 1 - seg(v - active, 0.12, 0.3) : 0);

    counter.textContent = String(Math.min(N, Math.floor(v) + 1)).padStart(2, "0");
    head.style.opacity = String(1 - seg(p, 0.96, 1));
    fade.style.opacity = String(reduce ? 0 : easeInOut(seg(p, 0.95, 1)));
  };

  let target = 0;
  let shown = 0;
  let raf = 0;
  const read = () => {
    const r = root.getBoundingClientRect();
    const travel = r.height - win.innerHeight;
    target = travel > 0 ? clamp01(-r.top / travel) : 0;
  };
  const loop = () => {
    shown += (target - shown) * (reduce ? 1 : 0.14);
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
    win.removeEventListener("scroll", onScroll);
    win.removeEventListener("resize", onScroll);
  };
}
