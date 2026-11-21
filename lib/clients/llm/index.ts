// One entry point for every chat model call, whichever provider is configured.
//
// Environment (server only; see .env.example):
//   LLM_PROVIDER    "openai" (any OpenAI-compatible API: Gemini, Groq, OpenRouter, OpenAI,
//                   Ollama, vLLM on Modal…) or "anthropic". Defaults to "anthropic" when only
//                   ANTHROPIC_API_KEY is set, else "openai".
//   LLM_API_KEY     the provider's key (ANTHROPIC_API_KEY also works for "anthropic")
//   LLM_BASE_URL    "openai" only, e.g. https://generativelanguage.googleapis.com/v1beta/openai
//   LLM_MODEL       model that writes answers; LLM_FAST_MODEL for helper calls (defaults to LLM_MODEL)
//   LLM_PRICE_IN_PER_1M / LLM_PRICE_OUT_PER_1M            USD per 1M tokens for LLM_MODEL (default 0)
//   LLM_FAST_PRICE_IN_PER_1M / LLM_FAST_PRICE_OUT_PER_1M  same for LLM_FAST_MODEL (default: main's)
//   LLM_TIMEOUT_SECONDS  give up on a request after this long (default 60)
//   LLM_REASONING_EFFORT "openai" only: sent as reasoning_effort to thinking models (e.g. none, low)
// Prices feed the daily spend cap; a free tier can leave them at 0.
import { z } from "zod";
import { anthropicAdapter } from "./anthropic";
import { openAiCompatibleAdapter } from "./openai-compatible";
import type { LlmAdapter, LlmRequest, LlmStreamEvent, LlmTier, LlmUsage } from "./types";

export type { LlmMessage, LlmRequest, LlmSystemBlock, LlmTier, LlmUsage } from "./types";

// Defaults when the provider is Anthropic and no model is named.
const ANTHROPIC_DEFAULTS = {
  main: { model: "claude-sonnet-4-6", inPer1M: 3, outPer1M: 15 },
  fast: { model: "claude-haiku-4-5-20251001", inPer1M: 0.8, outPer1M: 4 },
};
const USD_TO_INR = 84;

const num = z.coerce.number().min(0).optional();
const Env = z.object({
  LLM_PROVIDER: z.enum(["openai", "anthropic"]).optional(),
  LLM_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  LLM_BASE_URL: z.string().url().optional(),
  LLM_MODEL: z.string().optional(),
  LLM_FAST_MODEL: z.string().optional(),
  LLM_PRICE_IN_PER_1M: num,
  LLM_PRICE_OUT_PER_1M: num,
  LLM_FAST_PRICE_IN_PER_1M: num,
  LLM_FAST_PRICE_OUT_PER_1M: num,
  LLM_TIMEOUT_SECONDS: z.coerce.number().positive().default(60),
  LLM_REASONING_EFFORT: z.string().optional(),
});

interface TierConfig {
  model: string;
  inPer1M: number;
  outPer1M: number;
}

export interface LlmConfig {
  provider: "openai" | "anthropic";
  apiKey: string;
  baseUrl?: string;
  timeoutMs: number;
  reasoningEffort?: string;
  tiers: Record<LlmTier, TierConfig>;
}

const blank = (v: string | undefined) => (v && v.trim() ? v.trim() : undefined);

export function readLlmConfig(env: Record<string, string | undefined> = process.env): LlmConfig {
  const cleaned = Object.fromEntries(Object.entries(env).map(([k, v]) => [k, blank(v)]));
  const e = Env.parse(cleaned);
  const provider = e.LLM_PROVIDER ?? (e.ANTHROPIC_API_KEY && !e.LLM_API_KEY ? "anthropic" : "openai");
  const apiKey = e.LLM_API_KEY ?? (provider === "anthropic" ? e.ANTHROPIC_API_KEY : undefined);
  if (!apiKey) throw new Error("LLM_API_KEY is required for the chat");
  const timeoutMs = e.LLM_TIMEOUT_SECONDS * 1000;

  if (provider === "anthropic") {
    const main = e.LLM_MODEL
      ? { model: e.LLM_MODEL, inPer1M: e.LLM_PRICE_IN_PER_1M ?? 0, outPer1M: e.LLM_PRICE_OUT_PER_1M ?? 0 }
      : ANTHROPIC_DEFAULTS.main;
    const fast = e.LLM_FAST_MODEL
      ? {
          model: e.LLM_FAST_MODEL,
          inPer1M: e.LLM_FAST_PRICE_IN_PER_1M ?? main.inPer1M,
          outPer1M: e.LLM_FAST_PRICE_OUT_PER_1M ?? main.outPer1M,
        }
      : e.LLM_MODEL
        ? main
        : ANTHROPIC_DEFAULTS.fast;
    return { provider, apiKey, timeoutMs, tiers: { main, fast } };
  }

  if (!e.LLM_BASE_URL) throw new Error("LLM_BASE_URL is required when LLM_PROVIDER is openai");
  if (!e.LLM_MODEL) throw new Error("LLM_MODEL is required when LLM_PROVIDER is openai");
  const main = { model: e.LLM_MODEL, inPer1M: e.LLM_PRICE_IN_PER_1M ?? 0, outPer1M: e.LLM_PRICE_OUT_PER_1M ?? 0 };
  const fast = {
    model: e.LLM_FAST_MODEL ?? main.model,
    inPer1M: e.LLM_FAST_PRICE_IN_PER_1M ?? main.inPer1M,
    outPer1M: e.LLM_FAST_PRICE_OUT_PER_1M ?? main.outPer1M,
  };
  return {
    provider,
    apiKey,
    baseUrl: e.LLM_BASE_URL,
    timeoutMs,
    reasoningEffort: e.LLM_REASONING_EFFORT,
    tiers: { main, fast },
  };
}

/** Cost in INR paise × 100 ("cents"), the unit the daily spend cap counts in. */
export function llmCostCents(tier: TierConfig, usage: LlmUsage): number {
  // Cache reads cost about a tenth of input and cache writes a quarter more, on providers that report them.
  const cached = usage.cacheReadInputTokens ?? 0;
  const written = usage.cacheCreationInputTokens ?? 0;
  const usd =
    (usage.inputTokens * tier.inPer1M +
      cached * tier.inPer1M * 0.1 +
      written * tier.inPer1M * 1.25 +
      usage.outputTokens * tier.outPer1M) /
    1_000_000;
  return Math.ceil(usd * USD_TO_INR * 100);
}

let cached: { config: LlmConfig; adapter: LlmAdapter } | undefined;

function client() {
  if (!cached) {
    const config = readLlmConfig();
    const adapter =
      config.provider === "anthropic"
        ? anthropicAdapter(config.apiKey, config.timeoutMs)
        : openAiCompatibleAdapter({
            baseUrl: config.baseUrl!,
            apiKey: config.apiKey,
            timeoutMs: config.timeoutMs,
            reasoningEffort: config.reasoningEffort,
          });
    cached = { config, adapter };
  }
  return cached;
}

/** One full reply. */
export async function llmComplete(req: LlmRequest): Promise<{ text: string; costCents: number }> {
  const { config, adapter } = client();
  const tier = config.tiers[req.tier];
  const { text, usage } = await adapter.complete(tier.model, req);
  return { text, costCents: llmCostCents(tier, usage) };
}

/** A streamed reply: text pieces, then one `end` event with the cost. */
export async function* llmStream(
  req: LlmRequest
): AsyncGenerator<{ type: "text"; text: string } | { type: "end"; costCents: number }> {
  const { config, adapter } = client();
  const tier = config.tiers[req.tier];
  for await (const ev of adapter.stream(tier.model, req) as AsyncGenerator<LlmStreamEvent>) {
    if (ev.type === "text") yield ev;
    else yield { type: "end", costCents: llmCostCents(tier, ev.usage) };
  }
}
