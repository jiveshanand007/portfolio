"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { initFinale } from "@/lib/film/finale";
import { site, contactLinks } from "@/lib/site";
import { Icon } from "@/components/ui/icon";
import { FooterCmdKTrigger } from "@/components/palette/footer-cmd-k-trigger";
import { openContact } from "@/lib/film/contact";

/**
 * Scene "Contact" (The Final Chapter). Art and lines come from
 * site.json (`scenes.contact`), the heading and text from `contact`, and the
 * links from the email, résumé and profile links. Motion: `lib/film/finale.ts`.
 */
export function FinaleScene() {
  const ref = useRef<HTMLElement>(null);
  const scene = site.scenes.contact;
  const links = contactLinks().filter((l) => l.id !== "email");

  useEffect(() => {
    if (!ref.current) return;
    return initFinale(ref.current);
  }, []);

  return (
    <section ref={ref} id="contact" className="ct-scene" data-chapter={scene.chapter} data-anchor="0.65" aria-labelledby="ct-heading">
      <div className="ct-stage">
        <div className="ct-bg">
          <Image src={scene.image} alt={scene.imageAlt} fill sizes="100vw" />
        </div>
        <div className="ct-shade" />
        <canvas className="ct-petals" aria-hidden />

        <div className="ct-copy">
          {scene.kicker && <p className="ct-kicker">{scene.kicker}</p>}
          {scene.closing && <p className="ct-closing">{scene.closing}</p>}
          <h2 id="ct-heading" className="ct-heading" aria-label={site.contact.heading}>
            {site.contact.heading.split(/\s+/).map((w, i) => (
              // the space sits between the words: inside an inline-block span it would collapse
              <span key={i}>
                {i > 0 && " "}
                <span className="ct-word" aria-hidden>
                  {w}
                </span>
              </span>
            ))}
          </h2>
          <p className="ct-text">{site.contact.text}</p>
          <div className="ct-actions">
            {/* opens the contact form panel; messages are sent from the site, no mail app needed */}
            <button type="button" className="ct-btn ct-btn-main ct-act" onClick={() => openContact()}>
              <Icon name="mail" className="h-[18px] w-[18px]" />
              Email me
            </button>
            <a className="ct-btn ct-act" href={site.resumeUrl} download>
              <Icon name="download" className="h-[18px] w-[18px]" />
              Résumé (PDF)
            </a>
          </div>
          <ul className="ct-links ct-act" aria-label="Profiles">
            {links.map((l) => (
              <li key={l.id}>
                <a href={l.href} target="_blank" rel="noreferrer">
                  {l.icon && <Icon name={l.icon} className="h-4 w-4" />}
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* the site footer lives inside the final chapter */}
        <footer id="footer" className="ct-foot">
          <p className="ct-foot-note">
            © {new Date().getFullYear()} {site.name}. {site.footerNote} <FooterCmdKTrigger /> for the good stuff.
          </p>
          {scene.extraLinks.length > 0 && (
            <nav aria-label="Site" className="ct-foot-nav">
              {/* only links the top nav doesn't already have */}
              {scene.extraLinks.map((n) => (
                <a key={n.href} href={n.href}>
                  {n.label}
                </a>
              ))}
            </nav>
          )}
        </footer>

        <div className="ct-veil" />
      </div>
    </section>
  );
}
