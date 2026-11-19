/** Scroll driven reveal for the Experience chapter. */
import { filmAudio, crossingUp } from "./audio";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const segment = (v: number, a: number, b: number) => clamp01((v - a) / (b - a));
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

export function initExperience(root: HTMLElement): () => void {
  const win = root.ownerDocument.defaultView ?? window;
  const reduce = win.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const cards = [...root.querySelectorAll<HTMLElement>(".ex-card")];
  const bg = root.querySelector<HTMLElement>(".ex-bg");
  const slash = root.querySelector<SVGSVGElement>(".ex-slash");
  const title = root.querySelector<HTMLElement>(".ex-head");
  const count = root.querySelector<HTMLElement>(".ex-count-now");
  const endFade = root.querySelector<HTMLElement>(".ex-endfade");
  if (!bg || !slash || !title || !count || !endFade || cards.length === 0) {
    throw new Error("experience: scene markup is incomplete");
  }

  const [scar, glow, core] = [...slash.querySelectorAll<SVGPathElement>("path")];
  if (!scar || !glow || !core) throw new Error("experience: slash paths are missing");
  const len = scar.getTotalLength();
  scar.style.strokeDasharray = `${len} ${len}`;
  for (const path of [glow, core]) path.style.strokeDasharray = `${len * 0.3} ${len * 2}`;
  const cues = cards.map(() => crossingUp());

  const render = (p: number) => {
    const v = p * cards.length;
    cards.forEach((card, i) => {
      const q = v - i;
      const active = reduce
        ? Number(i === cards.length - 1 ? q >= 0 : q >= 0 && q < 1)
        : segment(q, -0.02, 0.2) * (1 - segment(q, 0.82, 1.02));
      card.style.visibility = active > 0.001 || (q > -0.1 && q < 1.1) ? "visible" : "hidden";
      card.style.opacity = String(active);
      const enter = reduce ? 1 : ease(segment(q, 0.02, 0.22));
      card.style.transform = reduce ? "" : `translate3d(0, ${lerp(34, 0, enter)}px, 0)`;
      const heading = card.querySelector<HTMLElement>(".ex-title");
      const copy = card.querySelector<HTMLElement>(".ex-description");
      const figure = card.querySelector<HTMLElement>(".ex-figure");
      const from = card.dataset.from;
      const value = card.dataset.value;
      const suffix = card.dataset.suffix ?? "";
      if (heading) heading.style.clipPath = `inset(0 ${100 - enter * 100}% 0 0)`;
      if (copy) copy.style.opacity = String(reduce ? 1 : ease(segment(q, 0.2, 0.38)));
      if (figure) {
        figure.style.opacity = String(reduce ? 1 : ease(segment(q, 0.3, 0.48)));
        if (value !== undefined) {
          const start = from === undefined ? 0 : Number(from);
          const current = Math.round(lerp(start, Number(value), reduce ? 1 : enter));
          figure.textContent = from === undefined ? `${current}${suffix}` : `${start} → ${current}${suffix}`;
        }
      }
    });
    bg.style.transform = reduce ? "" : `scale(${lerp(1.1, 1.02, ease(p))})`;

    const active = Math.min(cards.length - 1, Math.max(0, Math.floor(v)));
    const q = v - active;
    const draw = reduce ? 0 : segment(q, 0.02, 0.16);
    cues[active](draw, 0.04, () => filmAudio.slash());
    for (const path of [glow, core]) {
      path.style.opacity = draw > 0 && draw < 1 ? "1" : "0";
      path.style.strokeDashoffset = `${lerp(len * 0.3, -len, draw)}`;
    }
    scar.style.strokeDashoffset = `${lerp(len, 0, draw)}`;
    scar.style.opacity = String(draw > 0 ? 1 - segment(q, 0.14, 0.28) : 0);
    count.textContent = String(Math.min(cards.length, Math.floor(v) + 1)).padStart(2, "0");
    title.style.opacity = String(1 - segment(p, 0.97, 1));
    endFade.style.opacity = String(reduce ? 0 : ease(segment(p, 0.97, 1)));
  };

  let target = 0;
  let shown = 0;
  let raf = 0;
  let visible = false;
  const read = () => {
    const rect = root.getBoundingClientRect();
    const travel = rect.height - win.innerHeight;
    target = travel > 0 ? clamp01(-rect.top / travel) : 0;
  };
  const loop = () => {
    shown += (target - shown) * (reduce ? 1 : 0.14);
    if (Math.abs(target - shown) < 0.0005) shown = target;
    render(shown);
    // a low battlefield fire under the whole chapter, fading out with the end of the scene
    filmAudio.setLayer("flame", "experience", visible ? 0.22 * (1 - segment(shown, 0.92, 1)) : 0);
    raf = visible ? win.requestAnimationFrame(loop) : 0;
    if (!visible) filmAudio.setLayer("flame", "experience", 0);
  };
  const start = () => {
    if (!raf) raf = win.requestAnimationFrame(loop);
  };
  const onScroll = () => {
    read();
    if (visible) start();
  };
  const observer = new IntersectionObserver(([entry]) => {
    visible = Boolean(entry?.isIntersecting);
    if (visible) start();
    else filmAudio.setLayer("flame", "experience", 0);
  });
  observer.observe(root);
  read();
  shown = target;
  render(shown);
  win.addEventListener("scroll", onScroll, { passive: true });
  win.addEventListener("resize", onScroll);
  return () => {
    win.cancelAnimationFrame(raf);
    observer.disconnect();
    win.removeEventListener("scroll", onScroll);
    win.removeEventListener("resize", onScroll);
    filmAudio.setLayer("flame", "experience", 0);
  };
}
