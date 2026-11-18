"use client";

import { useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";

/**
 * A scroll-driven story: a seed falls, sprouts, blooms into a flower, and keeps
 * growing into a blossoming tree while petals drift down. The scene is pinned
 * (position: sticky) inside a tall track; scroll progress through the track
 * drives every part. Under prefers-reduced-motion it shows the finished tree.
 */

const GROUND = 560;
const STEM = "M200 560 C 197 480, 206 400, 200 300";
const BRANCHES = [
  "M200 400 C 172 372, 140 352, 104 330",
  "M200 380 C 232 352, 268 336, 302 312",
  "M200 340 C 182 300, 158 270, 132 240",
  "M200 330 C 222 292, 248 262, 276 234",
  "M200 300 C 199 262, 203 222, 200 184",
];
// Blossom clusters, roughly at the branch tips and filling the crown.
const CANOPY = [
  { cx: 104, cy: 326, r: 40 }, { cx: 302, cy: 308, r: 42 }, { cx: 132, cy: 236, r: 46 },
  { cx: 276, cy: 230, r: 46 }, { cx: 200, cy: 180, r: 54 }, { cx: 160, cy: 286, r: 40 },
  { cx: 244, cy: 280, r: 40 }, { cx: 200, cy: 240, r: 50 }, { cx: 236, cy: 196, r: 38 },
  { cx: 164, cy: 196, r: 38 },
];
const PETAL_COLORS = ["#f9a8d4", "#f472b6", "#fbcfe8", "#fda4af"];
// Falling petals: [left %, delay s, duration s, size px, sway px]
const FALLING: [number, number, number, number, number][] = [
  [8, 0, 9, 12, 40], [18, 2.5, 11, 10, -30], [27, 5, 10, 14, 50], [36, 1, 12, 9, -40],
  [45, 3.5, 9.5, 13, 35], [54, 6, 11, 11, -45], [63, 0.5, 10.5, 12, 30], [72, 4, 12, 10, -35],
  [81, 2, 9, 14, 45], [90, 5.5, 11.5, 9, -30], [14, 7, 10, 11, 38], [68, 7.5, 9.5, 13, -42],
];

function Caption({ progress, range, children }: { progress: MotionValue<number>; range: [number, number, number, number]; children: string }) {
  const opacity = useTransform(progress, range, [0, 1, 1, 0]);
  const y = useTransform(progress, [range[0], range[1]], [24, 0]);
  return (
    <motion.p
      style={{ opacity, y }}
      className="absolute inset-x-0 top-[12vh] text-center text-[clamp(28px,4.6vw,56px)] font-bold tracking-[-0.035em] text-fg"
    >
      {children}
    </motion.p>
  );
}

export function GrowScene() {
  const track = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: track, offset: ["start start", "end end"] });
  const smooth = useSpring(scrollYProgress, { stiffness: 90, damping: 24, mass: 0.4 });
  const fixed = useTransform(smooth, () => 1);
  const p = reduce ? fixed : smooth;

  // Seed falls and settles, then disappears into the ground as the sprout appears.
  const seedY = useTransform(p, [0, 0.08], [-260, 0]);
  const seedOpacity = useTransform(p, [0, 0.02, 0.12, 0.16], [0, 1, 1, 0]);
  const stemLength = useTransform(p, [0.1, 0.42], [0, 1]);
  const trunkWidth = useTransform(p, [0.1, 0.42, 0.6, 0.85], [3, 5, 6, 20]);
  const stemColor = useTransform(p, [0.55, 0.8], ["#22c55e", "#7c4a2d"]);
  const leafScale = useTransform(p, [0.25, 0.38], [0, 1]);
  const leafOpacity = useTransform(p, [0.25, 0.3, 0.62, 0.72], [0, 1, 1, 0]);
  const bloom = useTransform(p, [0.4, 0.55], [0, 1]);
  const flowerOpacity = useTransform(p, [0.4, 0.45, 0.66, 0.74], [0, 1, 1, 0]);
  const flowerSpin = useTransform(p, [0.4, 0.6], [-60, 0]);
  const branch = BRANCHES.map((_, i) => {
    const start = 0.6 + i * 0.03;
    return useTransform(p, [start, start + 0.15], [0, 1]); // eslint-disable-line react-hooks/rules-of-hooks
  });
  const canopy = CANOPY.map((_, i) => {
    const start = 0.72 + (i % 5) * 0.025;
    return useTransform(p, [start, start + 0.12], [0, 1]); // eslint-disable-line react-hooks/rules-of-hooks
  });
  const fallOpacity = useTransform(p, [0.5, 0.6], [0, 1]);
  const glow = useTransform(p, [0.8, 1], [0, 0.55]);

  return (
    <div ref={track} className="relative h-[520vh]">
      <style>{`
        @keyframes petalFall {
          0%   { transform: translate3d(0, -10vh, 0) rotate(0deg); opacity: 0; }
          10%  { opacity: 1; }
          50%  { transform: translate3d(var(--sway), 50vh, 0) rotate(200deg); }
          90%  { opacity: 1; }
          100% { transform: translate3d(calc(var(--sway) * -0.4), 110vh, 0) rotate(400deg); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) { .petal-fall { animation: none !important; opacity: 0 !important; } }
      `}</style>
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        <Caption progress={p} range={[0, 0.03, 0.1, 0.14]}>A seed.</Caption>
        <Caption progress={p} range={[0.14, 0.2, 0.32, 0.38]}>It takes root.</Caption>
        <Caption progress={p} range={[0.38, 0.44, 0.56, 0.62]}>It blooms.</Caption>
        <Caption progress={p} range={[0.62, 0.68, 0.82, 0.88]}>And keeps growing.</Caption>
        <Caption progress={p} range={[0.88, 0.94, 1, 1.01]}>Into something bigger.</Caption>

        <motion.div aria-hidden style={{ opacity: fallOpacity }} className="pointer-events-none absolute inset-0">
          {FALLING.map(([left, delay, duration, size, sway], i) => (
            <span
              key={i}
              className="petal-fall absolute top-0 block rounded-[60%_0_60%_0]"
              style={{
                left: `${left}%`,
                width: size,
                height: size * 0.75,
                background: PETAL_COLORS[i % PETAL_COLORS.length],
                animation: `petalFall ${duration}s linear ${delay}s infinite`,
                ["--sway" as string]: `${sway}px`,
              }}
            />
          ))}
        </motion.div>

        <svg
          viewBox="0 0 400 600"
          role="img"
          aria-label="A seed growing into a flower, then into a blossoming tree"
          className="absolute bottom-0 left-1/2 h-[82svh] max-h-[760px] w-auto -translate-x-1/2"
        >
          <motion.circle cx={200} cy={170} r={150} fill="#f9a8d4" style={{ opacity: glow }} filter="blur(40px)" />
          <line x1={20} y1={GROUND} x2={380} y2={GROUND} stroke="var(--border-strong, #d2d2d7)" strokeWidth={2} strokeLinecap="round" />

          <motion.ellipse cx={200} cy={GROUND - 6} rx={7} ry={5} fill="#a16207" style={{ y: seedY, opacity: seedOpacity }} />

          <motion.path
            d={STEM}
            fill="none"
            strokeLinecap="round"
            style={{ pathLength: stemLength, strokeWidth: trunkWidth, stroke: stemColor }}
          />
          {BRANCHES.map((d, i) => (
            <motion.path
              key={d}
              d={d}
              fill="none"
              stroke="#7c4a2d"
              strokeWidth={i === 4 ? 7 : 6}
              strokeLinecap="round"
              style={{ pathLength: branch[i] }}
            />
          ))}

          {[-1, 1].map((side) => (
            <motion.ellipse
              key={side}
              cx={200 + side * 22}
              cy={452}
              rx={22}
              ry={9}
              fill="#22c55e"
              style={{ scale: leafScale, opacity: leafOpacity, rotate: side * -32, originX: side < 0 ? 1 : 0, originY: 0.5 }}
            />
          ))}

          <motion.g style={{ opacity: flowerOpacity, scale: bloom, rotate: flowerSpin, originX: "200px", originY: "300px" }}>
            {Array.from({ length: 6 }, (_, i) => (
              <ellipse
                key={i}
                cx={200}
                cy={278}
                rx={11}
                ry={22}
                fill={PETAL_COLORS[i % 2]}
                transform={`rotate(${i * 60} 200 300)`}
              />
            ))}
            <circle cx={200} cy={300} r={9} fill="#facc15" />
          </motion.g>

          {CANOPY.map((c, i) => (
            <motion.circle
              key={i}
              cx={c.cx}
              cy={c.cy}
              r={c.r}
              fill={PETAL_COLORS[i % PETAL_COLORS.length]}
              fillOpacity={0.82}
              style={{ scale: canopy[i], originX: `${c.cx}px`, originY: `${c.cy}px` }}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}
