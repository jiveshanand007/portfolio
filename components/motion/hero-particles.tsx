"use client";

import Particles from "@/components/bits/Particles";
import { useSiteTheme } from "@/components/bits/use-site-theme";

// Accent, a violet and a cyan: the site's indigo plus two neighbours so the field has depth.
const LIGHT = ["#3d3af2", "#7c5cff", "#0ea5e9"];
const DARK = ["#8b8cff", "#c4b5fd", "#67e8f9"];

/**
 * Floating particle field behind the first viewport. Particles drift upward, link up
 * when they pass close to each other, lean away from the cursor and ripple on click.
 * It sits behind the content (pointer-events: none) and the component itself stops
 * moving under prefers-reduced-motion and pauses while it is off screen.
 */
export function HeroParticles() {
  const theme = useSiteTheme();
  const dark = theme === "dark";
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <Particles
        particleColors={dark ? DARK : LIGHT}
        lightMode={!dark}
        particleCount={180}
        particleSpread={11}
        speed={0.12}
        particleBaseSize={90}
        sizeRandomness={1}
        shape="circle"
        glow={dark ? 0.6 : 0.25}
        twinkle={0.35}
        connections
        connectionDistance={120}
        hoverEffect="repel"
        hoverRadius={150}
        drift="up"
        driftSpeed={0.35}
        opacity={dark ? 0.9 : 0.75}
      />
    </div>
  );
}
