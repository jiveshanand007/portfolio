"use client";

import type { ReactNode } from "react";
import ClickSpark from "@/components/bits/ClickSpark";
import { useSiteTheme } from "@/components/bits/use-site-theme";

/** Every click anywhere on the site throws a small burst of sparks. */
export function SiteSparks({ children }: { children: ReactNode }) {
  const theme = useSiteTheme();
  return (
    <ClickSpark
      sparkColor={theme === "dark" ? ["#8b8cff", "#c4b5fd", "#67e8f9"] : ["#3d3af2", "#7c5cff", "#0ea5e9"]}
      sparkSize={10}
      sparkRadius={22}
      sparkCount={9}
      duration={480}
      shape="line"
      randomness={0.4}
      className="!h-auto min-h-screen"
    >
      {children}
    </ClickSpark>
  );
}
