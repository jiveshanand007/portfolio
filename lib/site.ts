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

const ProjectArt = z.object({
  image: z.string().regex(/^\//),
  imageAlt: z.string().min(1).max(200),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  grade: z.enum(["none", "dusk", "night"]).default("none"),
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
  /** the slide-in chat panel and its floating button */
  ask: z
    .object({ buttonLabel: z.string().min(1).max(20).default("Ask me"), panelLabel: z.string().min(1).max(60).default("Ask my work anything") })
    .default({ buttonLabel: "Ask me", panelLabel: "Ask my work anything" }),
  /** the synthesized film sound: off until the visitor turns it on */
  sound: z
    .object({ label: z.string().min(1).max(16).default("SOUND"), volume: z.number().min(0).max(1).default(0.6) })
    .default({ label: "SOUND", volume: 0.6 }),
  scenes: z.object({
    about: z.object({
      /** shown on the progress rail while this scene is on screen */
      chapter: z.string().max(30),
      kicker: z.string().max(40).default(""),
      title: z.string().min(1).max(60),
      image: z.string().regex(/^\//),
      imageAlt: z.string().min(1).max(200),
      /** lantern positions in the painting, as [x%, y%]; they light up in this order */
      lanterns: z.array(z.tuple([z.number().min(0).max(100), z.number().min(0).max(100)])).max(24),
    }),
    skills: z.object({
      chapter: z.string().max(30),
      kicker: z.string().max(40).default(""),
      title: z.string().min(1).max(60),
      /** one per scroll slice, in order */
      techniques: z
        .array(
          z.object({
            id: z.string().regex(/^[a-z0-9-]+$/),
            kanji: z.string().max(4),
            /** the plain skill area, shown as the heading (what a recruiter reads) */
            category: z.string().min(1).max(40),
            /** the themed name (e.g. "Water Breathing"), shown as a small label above */
            name: z.string().min(1).max(40),
            /** which element effect plays over the environment */
            effect: z.enum(["water", "thunder", "flame", "mist", "sound"]),
            color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
            image: z.string().regex(/^\//),
            imageAlt: z.string().min(1).max(200),
            /** colour grading for a borrowed painting */
            grade: z.enum(["none", "storm", "mist"]).default("none"),
            line: z.string().max(160).default(""),
            skills: z.array(z.string().min(1).max(40)).min(1).max(6),
          }),
        )
        .min(1)
        .max(8),
    }),
    experience: z.object({
      chapter: z.string().max(30),
      kicker: z.string().max(40).default(""),
      title: z.string().min(1).max(60),
      image: z.string().regex(/^\//),
      imageAlt: z.string().min(1).max(200),
      achievements: z.array(z.object({
        id: z.string().regex(/^[a-z0-9-]+$/),
        role: z.string().min(1).max(50),
        dates: z.string().min(1).max(40),
        heading: z.string().min(1).max(90),
        description: z.string().min(1).max(240),
        figure: z.string().max(32).default(""),
        value: z.number().min(0).optional(),
        from: z.number().min(0).optional(),
        suffix: z.string().max(24).default(""),
      })).min(1).max(12),
    }),
    projects: z.object({
      chapter: z.string().max(30),
      kicker: z.string().max(40).default(""),
      title: z.string().min(1).max(60),
      missionLabel: z.string().max(20).default("MISSION"),
      /** the painting, accent colour and grading for each project, by its slug */
      art: z.record(z.string(), ProjectArt).default({}),
      /** used for any project without its own entry in `art` */
      defaultArt: ProjectArt,
    }),
    contact: z.object({
      chapter: z.string().max(30),
      kicker: z.string().max(40).default(""),
      image: z.string().regex(/^\//),
      imageAlt: z.string().min(1).max(200),
      /** a line above the heading (the heading and text are `contact` at the top level) */
      closing: z.string().max(80).default(""),
      /** the mark shown as the film fades out */
      endMark: z.string().max(8).default(""),
    }),
  }),
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
