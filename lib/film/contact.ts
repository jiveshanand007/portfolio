/** Open the contact panel (components/film/contact-panel.tsx) from anywhere on the page. */
export const OPEN_CONTACT_EVENT = "film:open-contact";

export function openContact() {
  window.dispatchEvent(new Event(OPEN_CONTACT_EVENT));
}
