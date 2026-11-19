"use client";

import Image from "next/image";
import { useEffect, useRef, type CSSProperties } from "react";
import { initBreathing } from "@/lib/film/breathing";
import { site } from "@/lib/site";

/** Japanese form numerals: 壱ノ型 (First Form), 弐ノ型 … */
const NUMERALS = ["壱", "弐", "参", "肆", "伍", "陸", "漆", "捌"];

/**
 * Scene "Breathing Techniques" (Skills). Everything shown comes from
 * content/site.json (`scenes.skills`); motion lives in `lib/film/breathing.ts`.
 */
export function BreathingScene() {
  const ref = useRef<HTMLElement>(null);
  const scene = site.scenes.skills;
  const n = scene.techniques.length;

  useEffect(() => {
    if (!ref.current) return;
    return initBreathing(ref.current);
  }, []);

  return (
    <section
      ref={ref}
      id="skills"
      className="br-scene"
      data-chapter={scene.chapter}
      data-anchor="0.11"
      aria-labelledby="br-title"
      style={{ "--br-n": n } as CSSProperties}
    >
      <div className="br-stage">
        {scene.techniques.map((t) => (
          <div key={t.id} className={`br-bg br-grade-${t.grade}`}>
            <Image src={t.image} alt={t.imageAlt} fill sizes="100vw" />
          </div>
        ))}
        <div className="br-shade" />
        <canvas className="br-fx" aria-hidden />
        <div className="br-fog br-fog-b" />
        <div className="br-fog br-fog-a" />

        <svg className="br-slash" viewBox="0 0 1600 900" preserveAspectRatio="none" aria-hidden>
          <path className="scar" d="M -80 780 Q 720 430 1680 120" />
          <path className="glow" d="M -80 780 Q 720 430 1680 120" />
          <path className="core" d="M -80 780 Q 720 430 1680 120" />
        </svg>

        <header className="br-head">
          {scene.kicker && <span className="br-kicker">{scene.kicker}</span>}
          <h2 id="br-title" className="br-title">
            {scene.title}
          </h2>
          <span className="br-count" aria-hidden>
            <span className="br-count-now">01</span> / {String(n).padStart(2, "0")}
          </span>
        </header>

        {scene.techniques.map((t) => (
          <article
            key={t.id}
            className="br-tech"
            data-effect={t.effect}
            data-color={t.color}
            style={{ "--br-color": t.color } as CSSProperties}
            aria-label={`${t.category}: ${t.skills.join(", ")}`}
          >
            <span className="br-kanji" aria-hidden>
              {t.kanji}
            </span>
            <div className="br-copy">
              <p className="br-style" aria-hidden>
                {t.kanji} · {t.name}
              </p>
              <h3 className="br-name">{t.category}</h3>
              {t.line && <p className="br-line">{t.line}</p>}
              <ol className="br-forms">
                {t.skills.map((s, i) => (
                  <li key={s} className="br-form">
                    <span className="br-form-num" aria-hidden>
                      {NUMERALS[i] ?? i + 1}ノ型
                    </span>
                    <span className="br-form-skill">{s}</span>
                  </li>
                ))}
              </ol>
            </div>
          </article>
        ))}

        <div className="br-fade" />
      </div>
    </section>
  );
}
