import type { Metadata } from "next";
import { GrowScene } from "@/components/motion/grow-scene";

export const metadata: Metadata = {
  title: "Grow — motion lab",
  description: "A scroll-driven animation: a seed grows into a flower, then a tree.",
  robots: { index: false },
};

export default function GrowLabPage() {
  return (
    <main>
      <section className="flex h-[70svh] flex-col items-center justify-center px-5 text-center">
        <p className="font-mono text-[13px] uppercase tracking-[0.14em] text-muted">Motion lab</p>
        <h1 className="mt-4 text-[clamp(44px,8vw,88px)] font-bold leading-[1] tracking-[-0.04em] text-fg">
          Keep scrolling.
        </h1>
        <p className="mt-5 text-[19px] text-muted">Something is about to grow.</p>
      </section>
      <GrowScene />
      <section className="flex h-[60svh] items-center justify-center px-5 text-center">
        <p className="text-[clamp(24px,3vw,36px)] font-semibold tracking-[-0.03em] text-fg">Fully grown.</p>
      </section>
    </main>
  );
}
