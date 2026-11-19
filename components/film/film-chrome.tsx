"use client";

import { useEffect, useRef, useState } from "react";
import { site } from "@/lib/site";
import { filmAudio } from "@/lib/film/audio";
import { ASK_ANCHOR, openChat } from "@/lib/film/ask";

/**
 * The film's fixed chrome: top nav and the side progress rail. The rail fills
 * with page scroll, and its chapter label follows whichever scene
 * (`[data-chapter]` section) is in the middle of the viewport.
 * The hero's intro fades both in (they start hidden).
 */
export function FilmChrome() {
  const fillRef = useRef<HTMLDivElement>(null);
  const chapRef = useRef<HTMLSpanElement>(null);
  const { hero, filmNav } = site;
  const [soundOn, setSoundOn] = useState(false);
  const [soundWaiting, setSoundWaiting] = useState(false);

  // Sound is off until asked for. A returning visitor who turned it on gets it back
  // on their first click or key press (browsers need one before any audio plays).
  useEffect(() => {
    filmAudio.setVolume(site.sound.volume);
    const unsubscribe = filmAudio.subscribe((on) => {
      setSoundOn(on);
      setSoundWaiting(false);
    });
    if (!filmAudio.preferred) return unsubscribe;
    setSoundWaiting(true);
    const resume = () => void filmAudio.enable();
    window.addEventListener("pointerdown", resume, { once: true });
    window.addEventListener("keydown", resume, { once: true });
    return () => {
      unsubscribe();
      window.removeEventListener("pointerdown", resume);
      window.removeEventListener("keydown", resume);
    };
  }, []);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (fillRef.current) fillRef.current.style.transform = `scaleY(${max > 0 ? window.scrollY / max : 0})`;
      const mid = window.innerHeight / 2;
      const current = [...document.querySelectorAll<HTMLElement>("[data-chapter]")].find((s) => {
        const r = s.getBoundingClientRect();
        return r.top <= mid && r.bottom >= mid;
      });
      if (current && chapRef.current) chapRef.current.textContent = current.dataset.chapter ?? "";
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <>
      <nav className="ch-nav" aria-label="Main">
        <a className="ch-mark" href="#home">
          {hero.mark && <i aria-hidden>{hero.mark}</i>}
          {hero.markText}
        </a>
        <ul className="ch-links">
          {filmNav.map((item) => (
            <li key={item.href}>
              <a
                href={item.href}
                onClick={(e) => {
                  // the ask link opens the chat panel rather than scrolling away
                  if (item.href !== ASK_ANCHOR) return;
                  e.preventDefault();
                  openChat();
                }}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="ch-sound"
          aria-pressed={soundOn}
          aria-label={soundOn ? "Turn sound off" : "Turn sound on"}
          onClick={(e) => {
            e.stopPropagation();
            if (soundOn) filmAudio.disable();
            else void filmAudio.enable();
          }}
        >
          <span className="ch-sound-bars" aria-hidden>
            <i />
            <i />
            <i />
          </span>
          {site.sound.label}
          {soundWaiting && !soundOn ? " · TAP" : soundOn ? " ON" : " OFF"}
        </button>
      </nav>

      <aside className="ch-progress" aria-hidden>
        <span ref={chapRef} className="ch-progress-chap">
          {hero.chapterLabel}
        </span>
        <div className="ch-progress-rail">
          <div ref={fillRef} className="ch-progress-fill" />
        </div>
      </aside>
    </>
  );
}
