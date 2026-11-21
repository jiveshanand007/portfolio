// Anthropic adapter (Claude). Uses prompt caching for system blocks marked `cache`.
import Anthropic from "@anthropic-ai/sdk";
import { systemBlocks, type LlmAdapter, type LlmRequest, type LlmUsage } from "./types";

function params(model: string, req: LlmRequest) {
  return {
    model,
    max_tokens: req.maxTokens,
    system: systemBlocks(req.system).map((b) =>
      b.cache
        ? { type: "text" as const, text: b.text, cache_control: { type: "ephemeral" as const } }
        : { type: "text" as const, text: b.text }
    ),
    messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
  };
}

function usageOf(u: {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}): LlmUsage {
  return {
    inputTokens: u.input_tokens,
    outputTokens: u.output_tokens,
    cacheReadInputTokens: u.cache_read_input_tokens ?? 0,
    cacheCreationInputTokens: u.cache_creation_input_tokens ?? 0,
  };
}

export function anthropicAdapter(apiKey: string, timeoutMs = 60_000): LlmAdapter {
  const client = new Anthropic({ apiKey, timeout: timeoutMs });
  return {
    async complete(model, req) {
      const res = await client.beta.promptCaching.messages.create(params(model, req), { signal: req.signal });
      const text = res.content
        .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
        .map((b) => b.text)
        .join("");
      return { text, usage: usageOf(res.usage) };
    },
    async *stream(model, req) {
      const stream = client.beta.promptCaching.messages.stream(params(model, req), { signal: req.signal });
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          yield { type: "text", text: event.delta.text };
        }
      }
      const final = await stream.finalMessage();
      yield { type: "end", usage: usageOf(final.usage) };
    },
  };
}
