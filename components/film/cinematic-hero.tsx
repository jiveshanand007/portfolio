"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { initCinematicHero } from "@/lib/film/cinematic-hero";

export interface FilmNavItem {
  href: string;
  label: string;
}

/**
 * Opening scene of the site: moonlit forest, lone swordsman, katana slash
 * across the name. Motion lives in `lib/film/cinematic-hero.ts`.
 */
export function CinematicHero({ nav }: { nav: FilmNavItem[] }) {
  const heroRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const progressRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!heroRef.current) return;
    return initCinematicHero(heroRef.current, { nav: navRef.current, progress: progressRef.current });
  }, []);

  return (
    <>
      <nav ref={navRef} className="ch-nav" aria-label="Main">
        <a className="ch-mark" href="#home">
          <i aria-hidden>刃</i>J.A
        </a>
        <ul className="ch-links">
          {nav.map((item, i) => (
            <li key={item.href}>
              <a href={item.href} aria-current={i === 0 ? "true" : undefined}>
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <aside ref={progressRef} className="ch-progress" aria-hidden>
        <span className="ch-progress-chap">第一章 · 序</span>
        <div className="ch-progress-rail">
          <div className="ch-progress-fill" />
        </div>
      </aside>

      <section ref={heroRef} className="ch-hero" id="home">
        <div className="ch-stage">
          <div className="ch-layer ch-bg">
            <Image
              src="/scenes/01-forest-moon.webp"
              alt="A lone swordsman on a rocky ridge in a moonlit forest"
              fill
              priority
              sizes="100vw"
            />
          </div>
          <div className="ch-layer ch-moonglow" />
          <div className="ch-layer ch-fog ch-fog-b" />
          <div className="ch-layer ch-shade" />
          <canvas className="ch-layer ch-particles" aria-hidden />
          <div className="ch-layer ch-fog ch-fog-a" />

          <div className="ch-copy">
            <span className="ch-vlabel" aria-hidden>
              開発者の旅
            </span>
            <p className="ch-kicker" aria-label="The journey of a developer" />
            <h1 className="ch-name" aria-label="Jivesh Anand">
              <span className="ch-name-line" data-text="Jivesh" />
              <span className="ch-name-line" data-text="Anand" />
              <span className="ch-cut ch-cut-top" aria-hidden />
              <span className="ch-cut ch-cut-bot" aria-hidden />
            </h1>
            <p className="ch-sub">
              Forging experiences. <em>Engineering possibilities.</em>
            </p>
          </div>

          <div className="ch-layer ch-fogwall" />
          <div className="ch-layer ch-flash" />
          <svg className="ch-layer ch-slash" viewBox="0 0 1600 900" preserveAspectRatio="none" aria-hidden>
            <defs>
              <filter id="ch-blur" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="9" />
              </filter>
            </defs>
            <path className="scar" d="M -60 790 Q 640 560 1660 90" />
            <path className="glow" d="M -60 790 Q 640 560 1660 90" />
            <path className="core" d="M -60 790 Q 640 560 1660 90" />
          </svg>
          <div className="ch-layer ch-veil" />

          <a className="ch-cue" href={nav[1]?.href ?? "#home"}>
            <span>SCROLL TO BEGIN YOUR JOURNEY</span>
            <i />
          </a>
        </div>
      </section>
    </>
  );
}
