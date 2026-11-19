"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { initCinematicHero } from "@/lib/film/cinematic-hero";
import { AskPrompt } from "./ask-prompt";
import { site } from "@/lib/site";

/**
 * Opening scene of the site: moonlit forest, lone swordsman, katana slash
 * across the name. Copy and nav come from content/site.json; motion lives in
 * `lib/film/cinematic-hero.ts`.
 */
export function CinematicHero({ askHeadline, askSubheadline }: { askHeadline: string; askSubheadline: string }) {
  const heroRef = useRef<HTMLElement>(null);
  const { hero, filmNav, name } = site;

  useEffect(() => {
    if (!heroRef.current) return;
    // the nav and progress rail belong to <FilmChrome>; the intro fades them in
    return initCinematicHero(heroRef.current, {
      nav: document.querySelector<HTMLElement>(".ch-nav"),
      progress: document.querySelector<HTMLElement>(".ch-progress"),
    });
  }, []);

  return (
    <>
      <section ref={heroRef} className="ch-hero" id="home" data-chapter={hero.chapterLabel} data-replay>
        <div className="ch-stage">
          <div className="ch-layer ch-bg">
            <Image src={hero.image} alt={hero.imageAlt} fill priority sizes="100vw" />
          </div>
          <div className="ch-layer ch-moonglow" />
          <div className="ch-layer ch-fog ch-fog-b" />
          <div className="ch-layer ch-shade" />
          <canvas className="ch-layer ch-particles" aria-hidden />
          <div className="ch-layer ch-fog ch-fog-a" />

          <div className="ch-copy">
            {hero.verticalLabel && (
              <span className="ch-vlabel" aria-hidden>
                {hero.verticalLabel}
              </span>
            )}
            <p className="ch-kicker" data-text={hero.kicker} aria-label={hero.kicker} />
            <h1 className="ch-name" aria-label={name}>
              {hero.nameLines.map((line) => (
                <span key={line} className="ch-name-line" data-text={line} />
              ))}
              <span className="ch-cut ch-cut-top" aria-hidden />
              <span className="ch-cut ch-cut-bot" aria-hidden />
            </h1>
            <p className="ch-sub">
              {hero.subtitle} {hero.subtitleAccent && <em>{hero.subtitleAccent}</em>}
            </p>
            <AskPrompt id="hero-ask" headline={askHeadline} subheadline={askSubheadline} />
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

          <a className="ch-cue" href={filmNav[1]?.href ?? "#home"}>
            <span>{hero.scrollCue}</span>
            <i />
          </a>
        </div>
      </section>
    </>
  );
}
