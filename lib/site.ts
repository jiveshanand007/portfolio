import { z } from "zod";
import raw from "@/content/site.json";

/**
 * Everything personal about the site lives in content/site.json: name,
 * contact details, links, hero copy and nav. Components and the chat backend
 * read it from here, so updating the site means editing that one file.
 */

const Href = z.string().regex(/^(https?:\/\/|mailto:|\/|#)/, "must be a URL, mailto:, site path or #anchor");

export const SiteLink = z.object({
  /** stable id, used for palette commands (`connect.<id>`) */
  id: z.string().regex(/^[a-z0-9-]+$/),
  label: z.string().min(1).max(40),
  href: Href,
  /** an icon name from components/ui/icon.tsx; links without one show as text */
  icon: z.enum(["github", "linkedin", "gitlab", "mail"]).optional(),
});

export const NavItem = z.object({ href: Href, label: z.string().min(1).max(24) });

export const SiteConfig = z.object({
  name: z.string().min(1).max(80),
  firstName: z.string().min(1).max(40),
  role: z.string().min(1).max(80),
  employer: z.string().min(1).max(80),
  location: z.string().min(1).max(80),
  email: z.string().email(),
  resumeUrl: Href,
  links: z.array(SiteLink).min(1).max(8),
  seo: z.object({ title: z.string().min(1).max(120), description: z.string().min(1).max(300) }),
  hero: z.object({
    kicker: z.string().min(1).max(60),
    nameLines: z.array(z.string().min(1).max(20)).min(1).max(3),
    subtitle: z.string().min(1).max(80),
    subtitleAccent: z.string().max(80).default(""),
    verticalLabel: z.string().max(20).default(""),
    chapterLabel: z.string().max(30).default(""),
    mark: z.string().max(4).default(""),
    markText: z.string().min(1).max(12),
    scrollCue: z.string().min(1).max(60),
    image: z.string().regex(/^\//),
    imageAlt: z.string().min(1).max(200),
  }),
  filmNav: z.array(NavItem).min(1).max(8),
  contact: z.object({ heading: z.string().min(1).max(80), text: z.string().min(1).max(200) }),
  footerNote: z.string().max(160).default(""),
});

export type SiteConfigT = z.infer<typeof SiteConfig>;
export type SiteLinkT = z.infer<typeof SiteLink>;

export const site: SiteConfigT = SiteConfig.parse(raw);

/** Every way to reach the owner, email first: the profile links plus a mailto. */
export function contactLinks(s: SiteConfigT = site): SiteLinkT[] {
  return [{ id: "email", label: "Email", href: `mailto:${s.email}`, icon: "mail" }, ...s.links];
}
