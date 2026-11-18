"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** The film (home page) brings its own nav, so the classic header shows everywhere else. */
export function HeaderGate({ children }: { children: ReactNode }) {
  return usePathname() === "/" ? null : <>{children}</>;
}
