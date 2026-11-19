import matter from "gray-matter";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SuggestionChipsByAudience } from "@/components/chat-shell";
import { ProjectsSection } from "@/components/projects/projects-section";
import { StageReveal } from "@/components/ui/stage-reveal";
import { Icon } from "@/components/ui/icon";
import { Footer } from "@/components/footer";
import { CinematicHero } from "@/components/film/cinematic-hero";
import { FilmChrome } from "@/components/film/film-chrome";
import { AwakeningScene } from "@/components/film/awakening-scene";
import { BreathingScene } from "@/components/film/breathing-scene";
import { ExperienceScene } from "@/components/film/experience-scene";
import { FilmChat } from "@/components/film/film-chat";
import { loadAbout } from "@/lib/content/about";
import { site, contactLinks } from "@/lib/site";

interface LandingFront {
  headline: string;
  subheadline: string;
  suggestionChips: SuggestionChipsByAudience;
}

function loadLanding(): LandingFront {
  const raw = readFileSync(join(process.cwd(), "content/landing.mdx"), "utf-8");
  return matter(raw).data as LandingFront;
}

function CloseStage() {
  const profiles = site.links.filter((l) => l.icon);
  return (
    <section id="contact" aria-labelledby="close-heading" className="scroll-mt-20 px-5 pb-28 sm:px-8 sm:pb-40">
      <StageReveal className="mx-auto max-w-[1120px] text-center">
        <h2
          id="close-heading"
          className="text-[clamp(44px,7.4vw,84px)] font-bold leading-[1] tracking-[-0.04em] text-fg [font-stretch:104%]"
        >
          {site.contact.heading}
        </h2>
        <p className="mx-auto mt-6 max-w-[36ch] text-[clamp(19px,2vw,23px)] font-medium leading-[1.35] tracking-[-0.018em] text-muted">
          {site.contact.text}
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <a
            href={`mailto:${site.email}`}
            className="inline-flex h-12 items-center gap-2 rounded-pill bg-fg px-6 text-[16px] font-medium text-bg transition-transform duration-300 ease-stage hover:scale-[1.02]"
          >
            <Icon name="mail" className="h-[18px] w-[18px]" />
            Email me
          </a>
          <a
            href={site.resumeUrl}
            download
            className="inline-flex h-12 items-center gap-2 rounded-pill px-6 text-[16px] font-medium text-fg ring-1 ring-inset ring-border-strong transition-colors hover:ring-fg"
          >
            <Icon name="download" className="h-[18px] w-[18px]" />
            Résumé (PDF)
          </a>
        </div>
        <ul className="mt-8 flex justify-center gap-2" aria-label="Profiles">
          {profiles.map((l) => (
            <li key={l.id}>
              <a
                href={l.href}
                target="_blank"
                rel="noreferrer"
                aria-label={l.label}
                className="inline-flex h-11 w-11 items-center justify-center rounded-pill text-fg-soft transition-colors hover:bg-bg-elev hover:text-fg"
              >
                {l.icon && <Icon name={l.icon} className="h-5 w-5" />}
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[14px] text-muted">
          {contactLinks()
            .filter((l) => !l.icon)
            .map((l, i) => (
              <span key={l.id}>
                {i > 0 && " · "}
                <a href={l.href} target="_blank" rel="noreferrer" className="hover:text-fg">
                  {l.label}
                </a>
              </span>
            ))}
        </p>
      </StageReveal>
    </section>
  );
}

export default function Home() {
  const landing = loadLanding();
  const about = loadAbout().data;
  return (
    <>
      <FilmChrome />
      <main>
        <CinematicHero askHeadline={landing.headline} askSubheadline={landing.subheadline} />
        <AwakeningScene lede={about.lede} stats={about.stats} />
        <BreathingScene />
        <ExperienceScene />
        <ProjectsSection />
        <CloseStage />
      </main>
      <Footer />
      <FilmChat subheadline={landing.subheadline} suggestionChips={landing.suggestionChips} />
    </>
  );
}
