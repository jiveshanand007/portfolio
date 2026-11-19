/**
 * Scene "Contact" (The Final Chapter), framework-free and scroll-driven.
 *
 * Out of the previous scene's black: the sakura sunset fades up as the camera
 * eases back, petals drift across the frame, the closing line and heading
 * rise word by word, then the contact actions arrive and stay on screen
 * through to the footer (the last thing a visitor sees is how to reach you).
 * Scrolling back up reverses everything; the petals animate with time while
 * the scene is on screen.
 *
 * `root` is the scene section. Returns a cleanup function.
 */
import { filmAudio } from "./audio";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const seg = (v: number, a: number, b: number) => clamp01((v - a) / (b - a));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function must<T extends Element>(root: ParentNode, sel: string): T {
  const el = root.querySelector<T>(sel);
  if (!el) throw new Error(`finale: missing ${sel}`);
  return el;
}

export function initFinale(root: HTMLElement): () => void {
  const win = root.ownerDocument.defaultView ?? window;
  const reduce = win.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const lowPower = (navigator.hardwareConcurrency || 8) <= 4 || win.innerWidth < 700;

  const el = {
    bg: must<HTMLElement>(root, ".ct-bg"),
    veil: must<HTMLElement>(root, ".ct-veil"),
    closing: root.querySelector<HTMLElement>(".ct-closing"),
    kicker: root.querySelector<HTMLElement>(".ct-kicker"),
    text: must<HTMLElement>(root, ".ct-text"),
    actions: [...root.querySelectorAll<HTMLElement>(".ct-act")],
    canvas: must<HTMLCanvasElement>(root, ".ct-petals"),
  };
  const words = [...root.querySelectorAll<HTMLElement>(".ct-word")];
  const ctx = el.canvas.getContext("2d");

  // ---------- petals ----------
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
  const n = reduce ? 0 : lowPower ? 18 : 42;
  const petals = Array.from({ length: n }, (_, i) => ({
    x: hash(i), y: hash(i + 50), s: 5 + hash(i + 9) * 7, v: 0.03 + hash(i + 3) * 0.04, w: hash(i + 7) * 6.28,
    rot: hash(i + 11) * 6.28, spin: (hash(i + 13) - 0.5) * 2.4, tint: hash(i + 17),
  }));
  let petalAlpha = 0;
  const drawPetals = (t: number, dt: number) => {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    if (petalAlpha <= 0.01) return;
    for (const p of petals) {
      p.y += p.v * dt;
      p.x += (0.018 + Math.sin(t * 0.8 + p.w) * 0.012) * dt;
      p.rot += p.spin * dt;
      if (p.y > 1.06 || p.x > 1.08) {
        p.y = -0.06;
        p.x = hash(p.w * 100 + Math.floor(t)) * 0.9 - 0.1;
      }
      ctx.save();
      ctx.translate(p.x * W, p.y * H);
      ctx.rotate(p.rot);
      ctx.scale(Math.cos(t * 2 + p.w), 1); // the petal flutters as it turns
      ctx.beginPath();
      ctx.ellipse(0, 0, p.s, p.s * 0.62, 0, 0, Math.PI * 2);
      const light = 82 + p.tint * 10;
      ctx.fillStyle = `hsla(${340 + p.tint * 12}, 85%, ${light}%, ${0.85 * petalAlpha})`;
      ctx.fill();
      ctx.restore();
    }
  };

  // ---------- scroll-driven render ----------
  let inView = false;
  const render = (p: number) => {
    const rise = easeOut(seg(p, 0, 0.3));
    el.veil.style.opacity = String(1 - easeInOut(seg(p, 0, 0.18)));
    el.bg.style.transform = reduce ? "" : `scale(${lerp(1.16, 1.03, rise) + seg(p, 0.3, 1) * 0.04})`;
    el.bg.style.filter = `brightness(${lerp(0.35, 1, rise)}) saturate(${lerp(0.7, 1, rise)})`;
    petalAlpha = seg(p, 0.05, 0.2);

    const show = (node: HTMLElement | null, a: number, b: number) => {
      if (!node) return;
      const k = reduce ? 1 : easeOut(seg(p, a, b));
      node.style.opacity = String(k);
      node.style.transform = `translate3d(0, ${lerp(18, 0, k)}px, 0)`;
    };
    show(el.kicker, 0.12, 0.24);
    show(el.closing, 0.16, 0.28);
    words.forEach((w, i) => {
      const s = 0.22 + (i / Math.max(1, words.length)) * 0.16;
      const k = reduce ? 1 : easeOut(seg(p, s, s + 0.06));
      w.style.opacity = String(k);
      w.style.transform = `translate3d(0, ${lerp(0.5, 0, k)}em, 0)`;
      w.style.filter = k < 1 ? `blur(${lerp(8, 0, k)}px)` : "none";
    });
    show(el.text, 0.38, 0.48);
    el.actions.forEach((a, i) => show(a, 0.44 + i * 0.04, 0.54 + i * 0.04));

    filmAudio.setLayer("wind", "finale", inView ? 0.3 : 0);
  };

  let target = 0;
  let shown = 0;
  let raf = 0;
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
    drawPetals((now - t0) / 1000, dt);
    raf = inView ? win.requestAnimationFrame(loop) : 0;
  };
  const start = () => {
    if (!raf) {
      last = performance.now();
      raf = win.requestAnimationFrame(loop);
    }
  };
  const onScroll = () => {
    read();
    if (inView) start();
  };
  const io = new IntersectionObserver(([entry]) => {
    inView = !!entry?.isIntersecting;
    if (inView) start();
    else filmAudio.setLayer("wind", "finale", 0);
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
    io.disconnect();
    filmAudio.setLayer("wind", "finale", 0);
    win.removeEventListener("scroll", onScroll);
    win.removeEventListener("resize", onResize);
  };
}
