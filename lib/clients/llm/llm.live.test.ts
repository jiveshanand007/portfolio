// @vitest-environment node
// Live check of the configured chat model with the real key from .env.local.
// Opt-in so ordinary test runs never spend quota: `pnpm test:llm` (sets LLM_LIVE=1).
import { describe, it, expect } from "vitest";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const live = process.env.LLM_LIVE === "1";

describe.skipIf(!live)("chat model (live)", { timeout: 90_000 }, () => {
  it("answers a prompt in one reply", async () => {
    const { llmComplete } = await import("./index");
    const { text, costCents } = await llmComplete({
      tier: "fast",
      maxTokens: 20,
      system: "Reply with exactly the word the user asks for and nothing else.",
      messages: [{ role: "user", content: "Say the word: katana" }],
    });
    expect(text.toLowerCase()).toContain("katana");
    expect(costCents).toBeGreaterThanOrEqual(0);
  });

  it("streams a reply in pieces and reports its cost at the end", async () => {
    const { llmStream } = await import("./index");
    let text = "";
    let ended = false;
    for await (const ev of llmStream({
      tier: "main",
      maxTokens: 200,
      system: [{ text: "You are concise." }, { text: "Answer in one short sentence.", cache: true }],
      messages: [{ role: "user", content: "What does a payment gateway do?" }],
    })) {
      if (ev.type === "text") text += ev.text;
      else ended = true;
    }
    expect(text.trim().length).toBeGreaterThan(10);
    expect(ended).toBe(true);
  });
});
