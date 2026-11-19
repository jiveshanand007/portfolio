"use client";

import Image from "next/image";
import { useEffect, useRef, type CSSProperties } from "react";
import { initExperience } from "@/lib/film/experience";
import { site } from "@/lib/site";

export function ExperienceScene() {
  const ref = useRef<HTMLElement>(null);
  const scene = site.scenes.experience;
  const achievements = scene.achievements;

  useEffect(() => {
    if (!ref.current) return;
    return initExperience(ref.current);
  }, []);

  return (
    <section
      ref={ref}
      id="experience"
      className="ex-scene"
      data-chapter={scene.chapter}
      aria-labelledby="ex-heading"
      style={{ "--ex-count": achievements.length } as CSSProperties}
    >
      <div className="ex-stage">
        <div className="ex-bg">
          <Image src={scene.image} alt={scene.imageAlt} fill sizes="100vw" priority />
        </div>
        <div className="ex-shade" />
        <div className="ex-grain" aria-hidden />

        <svg className="ex-slash" viewBox="0 0 1600 900" preserveAspectRatio="none" aria-hidden>
          <path className="scar" d="M -80 780 Q 720 430 1680 120" />
          <path className="glow" d="M -80 780 Q 720 430 1680 120" />
          <path className="core" d="M -80 780 Q 720 430 1680 120" />
        </svg>

        <header className="ex-head">
          {scene.kicker && <span className="ex-kicker">{scene.kicker}</span>}
          <h2 id="ex-heading" className="ex-heading">{scene.title}</h2>
          <span className="ex-count"><span className="ex-count-now">01</span> / {String(achievements.length).padStart(2, "0")}</span>
        </header>

        {achievements.map((achievement) => (
          <article
            className="ex-card"
            key={achievement.id}
            data-role={achievement.role}
            data-value={achievement.value}
            data-from={achievement.from}
            data-suffix={achievement.suffix}
          >
            <p className="ex-meta">{achievement.role}<span aria-hidden="true"> · </span>{achievement.dates}</p>
            <h3 className="ex-title">{achievement.heading}</h3>
            <p className="ex-description">{achievement.description}</p>
            <p className="ex-figure" aria-label={achievement.value === undefined ? achievement.figure : undefined}>
              {achievement.figure}
            </p>
          </article>
        ))}
        <div className="ex-endfade" aria-hidden />
      </div>
    </section>
  );
}
