"use client";

import { useEffect, useState } from "react";

export type SiteTheme = "light" | "dark";

/** The theme on <html data-theme>, kept in sync when the visitor flips the toggle. */
export function useSiteTheme(): SiteTheme {
  const [theme, setTheme] = useState<SiteTheme>("light");
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setTheme(root.getAttribute("data-theme") === "dark" ? "dark" : "light");
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);
  return theme;
}
