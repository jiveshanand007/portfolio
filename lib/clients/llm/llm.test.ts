// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readLlmConfig, llmCostCents } from "./index";
import { openAiCompatibleAdapter, type OpenAiCompatibleOptions } from "./openai-compatible";
import type { LlmRequest } from "./types";

const req: LlmRequest = {
  tier: "main",
  maxTokens: 100,
  system: [{ text: "Be brief." }, { text: "Cite sources.", cache: true }],
  messages: [{ role: "user", content: "Hi" }],
};

function sse(lines: string[]): Response {
  const enc = new TextEncoder();
  const body = new ReadableStream({
    start(c) {
      // split across chunk boundaries on purpose
      const all = lines.map((l) => `data: ${l}\n\n`).join("");
      c.enqueue(enc.encode(all.slice(0, 37)));
      c.enqueue(enc.encode(all.slice(37)));
      c.close();
    },
  });
  return new Response(body, { status: 200 });
}

describe("readLlmConfig", () => {
  it("reads an OpenAI-compatible provider with a fast model and prices", () => {
    const c = readLlmConfig({
      LLM_PROVIDER: "openai",
      LLM_BASE_URL: "https://example.test/v1",
      LLM_API_KEY: "k",
      LLM_MODEL: "big",
      LLM_FAST_MODEL: "small",
      LLM_PRICE_IN_PER_1M: "1",
      LLM_PRICE_OUT_PER_1M: "2",
    });
    expect(c.provider).toBe("openai");
    expect(c.timeoutMs).toBe(60_000);
    expect(c.tiers.main).toEqual({ model: "big", inPer1M: 1, outPer1M: 2 });
    expect(c.tiers.fast).toEqual({ model: "small", inPer1M: 1, outPer1M: 2 });
  });

  it("uses the main model for fast work when no fast model is set, free by default", () => {
    const c = readLlmConfig({ LLM_BASE_URL: "https://example.test/v1", LLM_API_KEY: "k", LLM_MODEL: "m" });
    expect(c.provider).toBe("openai");
    expect(c.tiers.fast).toEqual({ model: "m", inPer1M: 0, outPer1M: 0 });
  });

  it("falls back to Anthropic with its default models when only ANTHROPIC_API_KEY is set", () => {
    const c = readLlmConfig({ ANTHROPIC_API_KEY: "sk-ant" });
    expect(c.provider).toBe("anthropic");
    expect(c.apiKey).toBe("sk-ant");
    expect(c.tiers.main.model).toMatch(/^claude-sonnet/);
    expect(c.tiers.fast.model).toMatch(/^claude-haiku/);
  });

  it("treats blank values as unset and explains what is missing", () => {
    expect(() => readLlmConfig({ LLM_API_KEY: "  " })).toThrow(/LLM_API_KEY is required/);
    expect(() => readLlmConfig({ LLM_API_KEY: "k", LLM_MODEL: "m" })).toThrow(/LLM_BASE_URL/);
    expect(() => readLlmConfig({ LLM_API_KEY: "k", LLM_BASE_URL: "https://x.test" })).toThrow(/LLM_MODEL/);
  });
});

describe("llmCostCents", () => {
  it("is zero on a free tier", () => {
    expect(llmCostCents({ model: "m", inPer1M: 0, outPer1M: 0 }, { inputTokens: 5000, outputTokens: 900 })).toBe(0);
  });

  it("matches Anthropic's cache pricing (reads 10%, writes 125%)", () => {
    // Sonnet: $3 in, $15 out → 1M each of input, cache read, cache write, output = 3 + 0.3 + 3.75 + 15 = $22.05
    const cents = llmCostCents(
      { model: "s", inPer1M: 3, outPer1M: 15 },
      { inputTokens: 1e6, outputTokens: 1e6, cacheReadInputTokens: 1e6, cacheCreationInputTokens: 1e6 }
    );
    expect(cents).toBe(Math.ceil(22.05 * 84 * 100));
  });
});

const adapter = (extra: Partial<OpenAiCompatibleOptions> = {}) =>
  openAiCompatibleAdapter({ baseUrl: "https://example.test/v1", apiKey: "key", retryDelayMs: 1, ...extra });

describe("openAiCompatibleAdapter", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("complete() posts one system message plus the turns and returns text and usage", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "Hello there" } }],
          usage: { prompt_tokens: 12, completion_tokens: 3 },
        }),
        { status: 200 }
      )
    );
    const out = await adapter({ baseUrl: "https://example.test/v1/" }).complete("m", req);

    expect(out).toEqual({ text: "Hello there", usage: { inputTokens: 12, outputTokens: 3 } });
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://example.test/v1/chat/completions");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer key");
    const sent = JSON.parse(String(init?.body));
    expect(sent.model).toBe("m");
    expect(sent.max_tokens).toBe(100);
    expect(sent.messages).toEqual([
      { role: "system", content: "Be brief.\n\nCite sources." },
      { role: "user", content: "Hi" },
    ]);
    expect(sent).not.toHaveProperty("reasoning_effort");
  });

  it("sends reasoning_effort only when configured", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] })));
    await adapter({ reasoningEffort: "none" }).complete("m", req);
    expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body)).reasoning_effort).toBe("none");
  });

  it("retries once when the provider is busy", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("high demand", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: "made it" } }] })));
    const out = await adapter().complete("m", req);
    expect(out.text).toBe("made it");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("does not retry a request the provider rejects", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("bad key", { status: 401 }));
    await expect(adapter().complete("m", req)).rejects.toThrow(/\(401\)/);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("stream() yields text pieces and ends with the reported usage", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      sse([
        JSON.stringify({ choices: [{ delta: { role: "assistant" } }] }),
        JSON.stringify({ choices: [{ delta: { content: "Hel" } }] }),
        JSON.stringify({ choices: [{ delta: { content: "lo" } }] }),
        JSON.stringify({ choices: [], usage: { prompt_tokens: 7, completion_tokens: 2 } }),
        "[DONE]",
      ])
    );
    const events = [];
    for await (const ev of adapter().stream("m", req)) {
      events.push(ev);
    }
    expect(events).toEqual([
      { type: "text", text: "Hel" },
      { type: "text", text: "lo" },
      { type: "end", usage: { inputTokens: 7, outputTokens: 2 } },
    ]);
  });

  it("estimates usage when the server reports none, so the spend cap still counts it", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      sse([JSON.stringify({ choices: [{ delta: { content: "12345678" } }] }), "[DONE]"])
    );
    const events = [];
    for await (const ev of adapter().stream("m", req)) {
      events.push(ev);
    }
    expect(events.at(-1)).toEqual({ type: "end", usage: { inputTokens: 6, outputTokens: 2 } });
  });

  it("gives up on a provider that never answers", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) =>
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason))
        )
    );
    await expect(adapter({ timeoutMs: 50 }).complete("m", req)).rejects.toThrow(/timed out|aborted/i);
  });

  it("surfaces the provider's error status", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("model not found", { status: 404 }));
    await expect(adapter().complete("m", req)).rejects.toThrow(/LLM request failed \(404\): model not found/);
  });
});
