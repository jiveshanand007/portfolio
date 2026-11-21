import { llmStream } from "@/lib/clients/llm";
import { recordSpend } from "@/lib/spend-cap/daily-cap";
import { CitationStreamParser, type StreamEvent } from "./citation-parser";
import type { RetrievedChunk } from "./retrieve";
import type { Audience } from "@/lib/sse";
import type { TestDb } from "@/tests/helpers/test-db";
import type { db as dbFn } from "@/lib/db/client";
import { site } from "@/lib/site";

type AnyDb = TestDb | ReturnType<typeof dbFn>;

// VOICE_INSTRUCTIONS — Phase 2 placeholders. Phase 5b (Content authoring)
// will polish the wording with the user. The shapes here are stable; the
// strings are what get tuned.
const VOICE_INSTRUCTIONS: Record<Audience, string> = {
  curious:
    "Audience: a curious reader exploring this portfolio. Use plain English. Avoid jargon when a normal word works. Lead with the story or the human problem, not the implementation. Short paragraphs. It's OK to be a little playful.",
  recruiter:
    "Audience: a technical recruiter or hiring manager. Lead with quantified outcomes, scope, and business impact in the first sentence. State the role and the team size where relevant. Keep code talk minimal — link to the artifact via [n] instead. Bias toward results over process.",
  engineer:
    "Audience: a senior engineer reviewing this work. Lead with the design decision and the tradeoff the context states. Name files, modules or functions only when a numbered source names them. Show code only when a numbered source from a personal project contains it, copied exactly. Be concrete; skip the marketing layer.",
};

const SYSTEM_PROMPT = `You are the chat backend of ${site.name}'s "Reverse Resume" — a portfolio that proves engineering claims with real artifacts. ${site.firstName} is a ${site.role} at ${site.employer}.

Work done for an employer (experience entries) is described in prose only: what was built, how and why, as the context states it.
- Never write code about employer work: not real, not "illustrative", not hypothetical, not pseudo-code, not "how I would build it in a personal project".
- A code block may only be copied exactly from a numbered source of type GITHUB (a personal project). Never write new code.

Style:
- First-person ("I built…", "I shipped…").
- Concise. 2–4 short paragraphs is usually right.
- Cite EVERY factual claim using [n] notation matching the numbered context below. If you can't cite, don't claim.
- Never fabricate file names, function names, numbers, or technical mechanisms (keys, schemas, data structures, tradeoffs) the context does not state.
- If the context doesn't answer the question, say so plainly and suggest what you DO have.

Format your answer in concise GitHub-flavored markdown:
- Bold key terms with **bold**.
- Use fenced code blocks (\`\`\`ts) only for code copied from a GITHUB source.
- Use inline \`code\` for short identifiers, file paths, or SQL fragments.
- Do not use H1/H2 headings; use **bold lead-ins** instead.
- Cite sources with [n] markers inline (you already do this — keep doing it).

Readers want truth they can verify, not marketing.`;

function renderChunksAsContext(chunks: RetrievedChunk[]): string {
  return chunks
    .map((c, i) => {
      const n = i + 1;
      const header = `[${n}] ${c.sourceType.toUpperCase()}${c.sourceProject ? ` — ${c.sourceProject}` : ""}${c.title ? ` — ${c.title}` : ""}${c.filePath ? ` — ${c.filePath}` : ""}`;
      return `${header}\n${c.content}`;
    })
    .join("\n\n---\n\n");
}

export interface GenerateOptions {
  history: Array<{ role: "user" | "assistant"; content: string }>;
  chunks: RetrievedChunk[];
  audience: Audience;
  signal?: AbortSignal;
}

export async function* generate(
  db: AnyDb,
  options: GenerateOptions
): AsyncGenerator<StreamEvent> {
  const { history, chunks, audience, signal } = options;
  const parser = new CitationStreamParser(chunks);

  // The audience voice is its own system block so SYSTEM_PROMPT stays cacheable
  // across audience switches (on providers that cache).
  const stream = llmStream({
    tier: "main",
    maxTokens: 1024,
    system: [
      { text: VOICE_INSTRUCTIONS[audience] },
      { text: SYSTEM_PROMPT, cache: true },
      { text: renderChunksAsContext(chunks) },
    ],
    messages: history.map((t) => ({ role: t.role, content: t.content })),
    signal,
  });

  // Spend is recorded when the stream ends; a stream that throws midway is not
  // billed. This is intentional.
  let costCents = 0;
  for await (const event of stream) {
    if (event.type === "text") {
      for (const ev of parser.feed(event.text)) yield ev;
    } else {
      costCents = event.costCents;
    }
  }
  for (const ev of parser.flush()) yield ev;
  await recordSpend(db, costCents);
}
