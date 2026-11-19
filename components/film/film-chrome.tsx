"use client";

import { useEffect, useRef, useState } from "react";
import { site } from "@/lib/site";
import { filmAudio } from "@/lib/film/audio";
import { ASK_ANCHOR, openChat } from "@/lib/film/ask";
import { REPLAY_INTRO_EVENT } from "@/lib/film/cinematic-hero";

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
  // narrow screens fold the links into a menu
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  // Sound is on by default (site.json sound.defaultOn) unless the visitor turned it off.
  // Browsers block audio until the first click, tap or key press, so it starts then.
  useEffect(() => {
    filmAudio.setVolume(site.sound.volume);
    filmAudio.setDefaultOn(site.sound.defaultOn);
    const unsubscribe = filmAudio.subscribe((on) => {
      setSoundOn(on);
      setSoundWaiting(false);
    });
    if (!filmAudio.preferred) return unsubscribe;
    setSoundWaiting(true);
    const events = ["pointerdown", "touchend", "keydown", "click"] as const;
    const resume = (e: Event) => {
      // a first click on the sound toggle is the toggle's own business
      if ((e.target as Element | null)?.closest?.(".ch-sound")) return;
      events.forEach((ev) => window.removeEventListener(ev, resume));
      if (!filmAudio.enabled && filmAudio.preferred) void filmAudio.enable();
    };
    events.forEach((ev) => window.addEventListener(ev, resume, { passive: true }));
    return () => {
      unsubscribe();
      events.forEach((ev) => window.removeEventListener(ev, resume));
    };
  }, []);

  // A pinned scene's first frame is often empty (fog, or text not yet revealed), so
  // "#scene" links glide to the point the scene declares in data-anchor (0..1 through it).
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const link = (e.target as Element | null)?.closest?.("a[href^='#']");
      const href = link?.getAttribute("href");
      if (!href || href === ASK_ANCHOR) return;
      const target = document.getElementById(href.slice(1));
      // HOME (and the logo) go back to the top and replay the opening slash; the click
      // itself lets the browser play its sound
      if (target?.dataset.replay !== undefined) {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
        history.replaceState(null, "", href);
        window.dispatchEvent(new Event(REPLAY_INTRO_EVENT));
        return;
      }
      const at = Number(target?.dataset.anchor);
      if (!target || !Number.isFinite(at)) return;
      e.preventDefault();
      const top = window.scrollY + target.getBoundingClientRect().top;
      const travel = Math.max(0, target.offsetHeight - window.innerHeight);
      window.scrollTo({ top: top + travel * at, behavior: "smooth" });
      history.replaceState(null, "", href);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
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
      <nav className="ch-nav" aria-label="Main" data-menu={menuOpen || undefined}>
        <a className="ch-mark" href="#home" aria-label={`${site.name}, back to the start`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- an animated SVG; next/image would add nothing */}
          <img className="ch-logo" src={site.logo} alt="" width={42} height={42} />
        </a>
        <ul id="ch-links" className="ch-links">
          {filmNav.map((item) => (
            <li key={item.href}>
              <a
                href={item.href}
                onClick={(e) => {
                  setMenuOpen(false);
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
        <button
          type="button"
          className="ch-menu-btn"
          aria-expanded={menuOpen}
          aria-controls="ch-links"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span aria-hidden />
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
