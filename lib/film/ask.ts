/**
 * The site's chat lives in one slide-in panel (components/film/film-chat.tsx).
 * Anything on the page can open it, or open it with a question already asked:
 * the hero's ask box, the nav's ask link, the ask section, the floating button.
 */
export const ASK_EVENT = "film:ask";
export const OPEN_CHAT_EVENT = "film:open-chat";
/** The nav anchor that opens the chat panel instead of scrolling. */
export const ASK_ANCHOR = "#ask";

/** The panel only exists on the home page; elsewhere, go home and open it there. */
function panelHere(): boolean {
  if (document.getElementById("film-chat")) return true;
  window.location.href = `/${ASK_ANCHOR}`;
  return false;
}

/** Open the chat panel and ask `question` there. */
export function askChat(question: string) {
  if (!panelHere()) return;
  const q = question.trim();
  if (!q) return openChat();
  window.dispatchEvent(new CustomEvent<string>(ASK_EVENT, { detail: q }));
}

/** Open the chat panel without asking anything. */
export function openChat() {
  if (!panelHere()) return;
  window.dispatchEvent(new Event(OPEN_CHAT_EVENT));
}
