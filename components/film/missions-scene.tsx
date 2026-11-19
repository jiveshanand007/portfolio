"use client";

import Image from "next/image";
import { useEffect, useRef, type CSSProperties } from "react";
import { initMissions } from "@/lib/film/missions";
import { openChat } from "@/lib/film/ask";
import { site } from "@/lib/site";

/** The parts of a project (content/projects/*.mdx) this scene shows. */
export interface MissionProject {
  slug: string;
  title: string;
  kind: string;
  year: string;
  status: string;
  description: string;
  tags: string[];
  url?: string;
  urlLabel?: string;
  altUrl?: string;
  altUrlLabel?: string;
  thisSite: boolean;
}

/**
 * Scene "Projects" (The Missions). Projects come from content/projects/*.mdx;
 * each one's painting, colour and grading from site.json (`scenes.projects`).
 * Motion lives in `lib/film/missions.ts`.
 */
export function MissionsScene({ projects }: { projects: MissionProject[] }) {
  const ref = useRef<HTMLElement>(null);
  const scene = site.scenes.projects;
  const n = projects.length;

  useEffect(() => {
    if (!ref.current || n === 0) return;
    return initMissions(ref.current);
  }, [n]);

  if (n === 0) return null;
  const artFor = (slug: string) => scene.art[slug] ?? scene.defaultArt;

  return (
    <section
      ref={ref}
      id="work"
      className="pr-scene"
      data-chapter={scene.chapter}
      aria-labelledby="pr-title"
      style={{ "--pr-n": n } as CSSProperties}
    >
      <div className="pr-stage">
        {projects.map((p) => {
          const art = artFor(p.slug);
          return (
            <div key={p.slug} className={`pr-bg pr-grade-${art.grade}`}>
              <Image src={art.image} alt={art.imageAlt} fill sizes="100vw" />
            </div>
          );
        })}
        <div className="pr-shade" />

        <svg className="pr-slash" viewBox="0 0 1600 900" preserveAspectRatio="none" aria-hidden>
          <path className="scar" d="M 1680 760 Q 820 420 -80 140" />
          <path className="glow" d="M 1680 760 Q 820 420 -80 140" />
          <path className="core" d="M 1680 760 Q 820 420 -80 140" />
        </svg>

        <header className="pr-head">
          {scene.kicker && <span className="pr-kicker">{scene.kicker}</span>}
          <h2 id="pr-title" className="pr-heading">
            {scene.title}
          </h2>
          <span className="pr-count" aria-hidden>
            <span className="pr-count-now">01</span> / {String(n).padStart(2, "0")}
          </span>
        </header>

        {projects.map((p, i) => {
          const art = artFor(p.slug);
          return (
            <article
              key={p.slug}
              className="pr-card"
              data-color={art.color}
              style={{ "--pr-color": art.color } as CSSProperties}
              aria-labelledby={`pr-${p.slug}`}
            >
              <span className="pr-num" aria-hidden>
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="pr-copy">
                <p className="pr-label pr-reveal">
                  {scene.missionLabel} {String(i + 1).padStart(2, "0")} · {p.kind} · {p.year}
                  {p.status === "archived" ? " · Archived" : ""}
                </p>
                <h3 id={`pr-${p.slug}`} className="pr-title">
                  {p.title}
                </h3>
                <p className="pr-desc pr-reveal">{p.description}</p>
                {p.tags.length > 0 && (
                  <ul className="pr-tags pr-reveal" aria-label="Built with">
                    {p.tags.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                )}
                <div className="pr-links pr-reveal">
                  {p.thisSite && (
                    <button type="button" className="pr-btn pr-btn-main" onClick={() => openChat()}>
                      You&apos;re inside it. Ask it something ↗
                    </button>
                  )}
                  {p.url && (
                    <a className={p.thisSite ? "pr-btn" : "pr-btn pr-btn-main"} href={p.url} target="_blank" rel="noreferrer">
                      {p.urlLabel ?? "View source"} ↗
                    </a>
                  )}
                  {p.altUrl && (
                    <a className="pr-btn" href={p.altUrl} target="_blank" rel="noreferrer">
                      {p.altUrlLabel ?? "Live demo"} ↗
                    </a>
                  )}
                </div>
              </div>
            </article>
          );
        })}

        <div className="pr-fade" />
      </div>
    </section>
  );
}
