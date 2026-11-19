"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { initAwakening } from "@/lib/film/awakening";
import { site } from "@/lib/site";

export interface AwakeningStat {
  num: string;
  unit?: string;
  cap: string;
}

/** "I build *reliable systems* that…" → words, with the *starred* ones marked for accent. */
function toWords(lede: string): { text: string; em: boolean }[] {
  const words: { text: string; em: boolean }[] = [];
  for (const part of lede.split(/(\*[^*]+\*)/).filter(Boolean)) {
    const em = part.startsWith("*") && part.endsWith("*");
    const body = part.replace(/^\*|\*$/g, "");
    const tokens = body.split(/\s+/).filter(Boolean);
    // text glued to the previous part (like the "." after *…*) joins that word
    if (!em && words.length && !/^\s/.test(body) && tokens.length) {
      words[words.length - 1].text += tokens.shift();
    }
    words.push(...tokens.map((text) => ({ text, em })));
  }
  return words;
}

/**
 * Scene "The Awakening" (About). Scene copy and art come from
 * content/site.json (`scenes.about`); the intro and stats from content/about.mdx.
 * Motion lives in `lib/film/awakening.ts`.
 */
export function AwakeningScene({ lede, stats }: { lede: string; stats: AwakeningStat[] }) {
  const ref = useRef<HTMLElement>(null);
  const scene = site.scenes.about;

  useEffect(() => {
    if (!ref.current) return;
    return initAwakening(ref.current);
  }, []);

  const cover = (cls: string, priority = false) => (
    <div className={`aw-cover ${cls}`}>
      <Image src={scene.image} alt={cls === "aw-dark" ? scene.imageAlt : ""} fill sizes="180vw" priority={priority} />
    </div>
  );

  return (
    <section ref={ref} id="about" className="aw-scene" data-chapter={scene.chapter} data-anchor="0.8" aria-labelledby="aw-title">
      <div className="aw-stage">
        <div className="aw-camera">
          {cover("aw-dark")}
          {cover("aw-lit")}
          <div className="aw-cover aw-glows" aria-hidden>
            {scene.lanterns.map(([x, y]) => (
              <span key={`${x}-${y}`} className="aw-glow" data-x={x} data-y={y} style={{ left: `${x}%`, top: `${y}%` }} />
            ))}
          </div>
        </div>
        <div className="aw-shade" />

        <svg className="aw-slash" viewBox="0 0 1600 900" preserveAspectRatio="none" aria-hidden>
          <path className="scar" d="M -120 560 Q 760 360 1720 450" />
          <path className="glow" d="M -120 560 Q 760 360 1720 450" />
          <path className="core" d="M -120 560 Q 760 360 1720 450" />
        </svg>

        <div className="aw-copy">
          {scene.kicker && <p className="aw-kicker">{scene.kicker}</p>}
          <h2 id="aw-title" className="aw-title">
            {scene.title}
          </h2>
          <p className="aw-lede">
            {toWords(lede).map((w, i) => (
              <span key={i} className={w.em ? "aw-word aw-em" : "aw-word"}>
                {w.text}{" "}
              </span>
            ))}
          </p>
          <p className="aw-identity">
            {site.role} <i>·</i> {site.employer}
            {site.location && (
              <>
                {" "}
                <i>·</i> {site.location}
              </>
            )}
          </p>
          <dl className="aw-stats">
            {stats.map((s) => (
              <div key={s.cap} className="aw-stat">
                <dt className="aw-cap">{s.cap}</dt>
                <dd>
                  <span className="aw-num" data-value={s.num}>
                    {s.num}
                  </span>
                  {s.unit && <span className="aw-unit">{s.unit}</span>}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="aw-fog" />
        <div className="aw-fade" />
      </div>
    </section>
  );
}
