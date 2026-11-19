"use client";

import { askChat } from "@/lib/film/ask";
import { site } from "@/lib/site";

/**
 * "Ask my work anything" with an ask box (and optional suggestion chips).
 * Submitting opens the chat panel with the question already asked.
 * Used in the hero and in the ask section.
 */
export function AskPrompt({
  headline,
  subheadline,
  chips = [],
  className = "",
  id,
}: {
  headline: string;
  subheadline: string;
  chips?: string[];
  className?: string;
  id: string;
}) {
  return (
    <form
      className={`ch-ask ${className}`}
      aria-labelledby={`${id}-title`}
      onSubmit={(e) => {
        e.preventDefault();
        const input = e.currentTarget.elements.namedItem("q") as HTMLInputElement;
        askChat(input.value);
        input.value = "";
      }}
    >
      <p id={`${id}-title`} className="ch-ask-title">
        {headline}
      </p>
      <p className="ch-ask-sub">{subheadline}</p>
      <div className="ch-ask-row">
        <input
          name="q"
          type="text"
          autoComplete="off"
          aria-label={`Ask a question about ${site.firstName}'s work`}
          placeholder={`Ask about ${site.firstName}'s work…`}
        />
        <button type="submit" aria-label="Ask">
          ↑
        </button>
      </div>
      {chips.length > 0 && (
        <ul className="ch-ask-chips">
          {chips.map((c) => (
            <li key={c}>
              <button type="button" onClick={() => askChat(c)}>
                {c}
              </button>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
