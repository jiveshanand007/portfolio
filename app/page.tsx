import matter from "gray-matter";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SuggestionChipsByAudience } from "@/components/chat-shell";
import { MissionsScene } from "@/components/film/missions-scene";
import { FinaleScene } from "@/components/film/finale-scene";
import { loadSelectedProjects } from "@/lib/content/projects";
import { CinematicHero } from "@/components/film/cinematic-hero";
import { FilmChrome } from "@/components/film/film-chrome";
import { AwakeningScene } from "@/components/film/awakening-scene";
import { BreathingScene } from "@/components/film/breathing-scene";
import { ExperienceScene } from "@/components/film/experience-scene";
import { FilmChat } from "@/components/film/film-chat";
import { ContactPanel } from "@/components/film/contact-panel";
import { loadAbout } from "@/lib/content/about";

interface LandingFront {
  headline: string;
  subheadline: string;
  suggestionChips: SuggestionChipsByAudience;
}

function loadLanding(): LandingFront {
  const raw = readFileSync(join(process.cwd(), "content/landing.mdx"), "utf-8");
  return matter(raw).data as LandingFront;
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
        <MissionsScene
          projects={loadSelectedProjects().map((p) => ({
            slug: p.slug,
            title: p.title,
            kind: p.kind,
            year: p.year,
            status: p.status,
            description: p.description,
            tags: p.tags,
            url: p.url,
            urlLabel: p.urlLabel,
            altUrl: p.altUrl,
            altUrlLabel: p.altUrlLabel,
            thisSite: p.thisSite,
          }))}
        />
        <FinaleScene />
      </main>
      <FilmChat subheadline={landing.subheadline} suggestionChips={landing.suggestionChips} />
      <ContactPanel />
    </>
  );
}
