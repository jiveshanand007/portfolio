"use client";

import { useEffect, useRef, useState } from "react";
import { ChatShell, type SuggestionChipsByAudience } from "@/components/chat-shell";
import { ASK_EVENT, OPEN_CHAT_EVENT, openChat } from "@/lib/film/ask";
import { site } from "@/lib/site";

/**
 * The site's one chat, in a panel that slides in over whatever scene is on
 * screen, so asking never pulls the visitor out of the film. Opened by the
 * hero's ask box, the nav's ask link, the ask section and the floating button
 * (all via lib/film/ask.ts). Escape, the close button or the dimmed backdrop
 * closes it, leaving the visitor exactly where they were.
 */
export function FilmChat({
  subheadline,
  suggestionChips,
}: {
  subheadline: string;
  suggestionChips: SuggestionChipsByAudience;
}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const show = () => {
      returnFocus.current = document.activeElement as HTMLElement | null;
      setOpen(true);
    };
    window.addEventListener(ASK_EVENT, show);
    window.addEventListener(OPEN_CHAT_EVENT, show);
    return () => {
      window.removeEventListener(ASK_EVENT, show);
      window.removeEventListener(OPEN_CHAT_EVENT, show);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.documentElement.classList.add("fc-locked");
    // focus the chat's input once the panel has slid in
    const t = window.setTimeout(() => panelRef.current?.querySelector<HTMLElement>("textarea, input")?.focus(), 320);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
      document.documentElement.classList.remove("fc-locked");
      returnFocus.current?.focus?.();
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="fc-fab"
        data-hidden={open || undefined}
        onClick={() => openChat()}
        aria-label={site.ask.buttonLabel}
        aria-expanded={open}
        aria-controls="film-chat"
      >
        <span className="fc-fab-dot" aria-hidden />
        {site.ask.buttonLabel}
      </button>

      <div className="fc-backdrop" data-open={open || undefined} onClick={() => setOpen(false)} aria-hidden />
      <div
        ref={panelRef}
        id="film-chat"
        className="fc-panel"
        data-open={open || undefined}
        role="dialog"
        aria-modal="true"
        aria-label={site.ask.panelLabel}
        inert={!open}
      >
        <button type="button" className="fc-close" onClick={() => setOpen(false)} aria-label="Close the chat">
          ✕
        </button>
        <div className="fc-scroll">
          <ChatShell variant="panel" subheadline={subheadline} suggestionChips={suggestionChips} />
        </div>
      </div>
    </>
  );
}
