// Full chat path with nothing mocked: the browser, /api/chat, the database, Voyage search
// and the configured chat model. Needs DATABASE_URL, VOYAGE_API_KEY, LLM_* and ingested
// content, so it is opt-in: `pnpm test:e2e:live`.
import { test, expect } from "@playwright/test";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local", quiet: true });

test.skip(process.env.E2E_LIVE !== "1", "live chat test: run with pnpm test:e2e:live");
// Real search and model calls; a free-tier search key can queue requests for a while.
test.setTimeout(180_000);

// The chat allows RATE_LIMIT_MAX questions per visitor per window, and repeated runs from
// one machine use that up ("Slow down — try again…"). Start each test with a fresh allowance
// in the local database this dev server uses.
test.beforeEach(async () => {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  try {
    await sql`DELETE FROM rate_limits`;
  } finally {
    await sql.end();
  }
});

test("a question from the hero is answered with real sources", async ({ page }) => {
  await page.goto("/");

  const init = page.waitForResponse((r) => r.url().endsWith("/api/chat") && r.request().method() === "POST");
  const ask = page.getByRole("textbox", { name: "Ask a question about Jivesh's work" }).first();
  await ask.fill("What does Jivesh work on at Zeta?");
  await ask.press("Enter");

  // The panel opens and the answer streams in
  const panel = page.getByRole("dialog", { name: "Ask my work anything" });
  await expect(panel).toBeVisible();
  const answer = panel.locator('article[aria-label="Assistant answer"]').last();
  await expect(answer).toBeVisible({ timeout: 15_000 });
  await expect(answer).toContainText(/\w{4,}/, { timeout: 90_000 });

  // The server found real documents to ground the answer
  const res = await init;
  expect(res.status()).toBe(200);
  const body = await res.text();
  const initEvent = body
    .split("\n")
    .filter((l) => l.startsWith("data:"))
    .map((l) => JSON.parse(l.slice(5)))
    .find((e) => e.type === "init");
  expect(initEvent?.chunkIds?.length ?? 0).toBeGreaterThan(0);

  // ...and the answer talks about the real work, not filler
  await expect(answer).toContainText(/dispute|refund|chargeback|payment|Zeta/i, { timeout: 90_000 });
});

test("the follow-up box keeps the thread going", async ({ page }) => {
  await page.goto("/");
  const ask = page.getByRole("textbox", { name: "Ask a question about Jivesh's work" }).first();
  await ask.fill("What projects has Jivesh built?");
  await ask.press("Enter");

  const panel = page.getByRole("dialog", { name: "Ask my work anything" });
  await expect(panel.locator('article[aria-label="Assistant answer"]').last()).toContainText(/\w{4,}/, {
    timeout: 90_000,
  });

  const followUp = panel.getByRole("textbox", { name: "Ask a follow-up question" });
  await followUp.fill("Which one is open source?");
  await followUp.press("Enter");
  await expect(panel.locator('article[aria-label="Assistant answer"]')).toHaveCount(2, { timeout: 90_000 });
  await expect(panel.locator('article[aria-label="Assistant answer"]').last()).toContainText(/\w{4,}/, {
    timeout: 90_000,
  });
});
