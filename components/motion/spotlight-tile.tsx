"use client";

import type { ReactNode } from "react";
import SpotlightCard from "@/components/bits/SpotlightCard";
import { useSiteTheme } from "@/components/bits/use-site-theme";

/** A card whose surface lights up under the cursor and whose border glows as it nears. */
export function SpotlightTile({ children, className = "" }: { children: ReactNode; className?: string }) {
  const theme = useSiteTheme();
  return (
    <SpotlightCard
      theme={theme}
      spotlightColor={theme === "dark" ? "#8b8cff" : "#3d3af2"}
      intensity={theme === "dark" ? 0.22 : 0.5}
      spotlightSize={320}
      borderGlow={0.9}
      proximity={120}
      className={className}
    >
      {children}
    </SpotlightCard>
  );
}
