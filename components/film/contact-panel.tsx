"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { OPEN_CONTACT_EVENT } from "@/lib/film/contact";
import { site } from "@/lib/site";

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent" }
  | { kind: "error"; message: string; notConfigured?: boolean };

/**
 * A slide-in panel with a contact form. Messages are sent to the owner's
 * inbox by app/api/contact (no mail app needed on the visitor's side).
 * Wording comes from site.json `contactForm`.
 */
export function ContactPanel() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [copied, setCopied] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const t = site.contactForm;

  useEffect(() => {
    const show = () => {
      returnFocus.current = document.activeElement as HTMLElement | null;
      setOpen(true);
    };
    window.addEventListener(OPEN_CONTACT_EVENT, show);
    return () => window.removeEventListener(OPEN_CONTACT_EVENT, show);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.documentElement.classList.add("fc-locked");
    const timer = window.setTimeout(() => panelRef.current?.querySelector<HTMLElement>("input[name=name]")?.focus(), 320);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(timer);
      document.documentElement.classList.remove("fc-locked");
      returnFocus.current?.focus?.();
    };
  }, [open]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    setStatus({ kind: "sending" });
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; notConfigured?: boolean };
      if (res.ok && body.ok) {
        setStatus({ kind: "sent" });
        form.reset();
      } else {
        setStatus({ kind: "error", message: body.error ?? "Something went wrong.", notConfigured: body.notConfigured });
      }
    } catch {
      setStatus({ kind: "error", message: "You seem to be offline. Please try again." });
    }
  }

  const copyEmail = () =>
    navigator.clipboard?.writeText(site.email).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 3000);
      },
      () => {},
    );

  return (
    <>
      <div className="fc-backdrop" data-open={open || undefined} onClick={() => setOpen(false)} aria-hidden />
      <div
        ref={panelRef}
        className="fc-panel cp-panel"
        data-open={open || undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cp-title"
        inert={!open}
      >
        <button type="button" className="fc-close" onClick={() => setOpen(false)} aria-label="Close">
          ✕
        </button>
        <div className="fc-scroll cp-body">
          {status.kind === "sent" ? (
            <div className="cp-done" role="status">
              <p className="cp-mark" aria-hidden>
                ✓
              </p>
              <h2 id="cp-title" className="cp-title">
                {t.successTitle}
              </h2>
              {t.successText && <p className="cp-intro">{t.successText}</p>}
              <button type="button" className="cp-send" onClick={() => setStatus({ kind: "idle" })}>
                Send another
              </button>
            </div>
          ) : (
            <form className="cp-form" onSubmit={onSubmit} noValidate={false}>
              <h2 id="cp-title" className="cp-title">
                {t.title}
              </h2>
              {t.intro && <p className="cp-intro">{t.intro}</p>}
              <label className="cp-field">
                <span>Your name</span>
                <input name="name" type="text" required maxLength={80} autoComplete="name" />
              </label>
              <label className="cp-field">
                <span>Your email</span>
                <input name="email" type="email" required maxLength={120} autoComplete="email" />
              </label>
              <label className="cp-field">
                <span>Message</span>
                <textarea name="message" required maxLength={4000} rows={7} />
              </label>
              {/* hidden from people; bots fill it in */}
              <input className="cp-trap" name="website" type="text" tabIndex={-1} autoComplete="off" aria-hidden />
              {status.kind === "error" && (
                <div className="cp-error" role="alert">
                  <p>{status.message}</p>
                  {status.notConfigured && (
                    <p>
                      Meanwhile, write to <strong>{site.email}</strong>{" "}
                      <button type="button" className="cp-copy" onClick={copyEmail}>
                        {copied ? "Copied ✓" : "Copy address"}
                      </button>
                    </p>
                  )}
                </div>
              )}
              <button type="submit" className="cp-send" disabled={status.kind === "sending"}>
                {status.kind === "sending" ? "Sending…" : t.sendLabel}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
