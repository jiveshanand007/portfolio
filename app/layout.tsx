import type { Metadata, Viewport } from "next";
import { Mona_Sans, Geist_Mono, Cinzel, Shippori_Mincho_B1, Zen_Kaku_Gothic_New } from "next/font/google";
import { Header } from "@/components/header";
import { Chrome } from "@/components/chrome";
import { SiteSparks } from "@/components/motion/site-sparks";
import { HeaderGate } from "@/components/film/header-gate";
import "./globals.css";
import "./film.css";
import { site } from "@/lib/site";

const mona = Mona_Sans({
  subsets: ["latin"],
  weight: "variable",
  axes: ["wdth"],
  display: "swap",
  variable: "--font-mona",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-geist-mono",
});

// Film typefaces: Cinzel for the title, Shippori Mincho for Japanese labels, Zen Kaku for UI text.
const cinzel = Cinzel({ subsets: ["latin"], weight: ["700", "800"], display: "swap", variable: "--font-cinzel" });
const shippori = Shippori_Mincho_B1({
  subsets: ["latin"],
  weight: ["500", "700", "800"],
  display: "swap",
  preload: false,
  variable: "--font-shippori",
});
const zenKaku = Zen_Kaku_Gothic_New({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
  preload: false,
  variable: "--font-zen-kaku",
});

export const metadata: Metadata = {
  title: site.seo.title,
  description: site.seo.description,
  icons: {
    icon: [
      { url: site.logo, type: "image/svg+xml" },
      { url: site.icons.png32, sizes: "32x32", type: "image/png" },
      { url: site.icons.png192, sizes: "192x192", type: "image/png" },
    ],
    apple: { url: site.icons.apple, sizes: "180x180" },
  },
};

export const viewport: Viewport = {
  themeColor: "#08090d",
};

const NO_FLASH_SCRIPT = `(function () {
  try {
    var t = localStorage.getItem("rr_theme");
    // Dark unless the visitor has chosen light with the toggle (the film is a night scene).
    var theme = t === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", theme);
  } catch (_) {}
})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${mona.variable} ${geistMono.variable} ${cinzel.variable} ${shippori.variable} ${zenKaku.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
      </head>
      <body className="bg-bg text-fg">
        <Chrome>
          <SiteSparks>
            <HeaderGate>
              <Header />
            </HeaderGate>
            {children}
          </SiteSparks>
        </Chrome>
      </body>
    </html>
  );
}
