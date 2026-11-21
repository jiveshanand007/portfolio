// OpenAI-compatible adapter: one HTTP shape served by OpenAI, Google Gemini, Groq,
// OpenRouter, Together, Mistral, Ollama, and self-hosted vLLM (e.g. on Modal).
import { systemBlocks, type LlmAdapter, type LlmRequest, type LlmUsage } from "./types";

interface ChatUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
}

// Some servers omit usage; estimate (~4 characters per token) so the spend cap still counts it.
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function usageOf(u: ChatUsage | undefined, req: LlmRequest, output: string): LlmUsage {
  if (u?.prompt_tokens != null && u.completion_tokens != null) {
    return { inputTokens: u.prompt_tokens, outputTokens: u.completion_tokens };
  }
  const input = systemBlocks(req.system).map((b) => b.text).join("") + req.messages.map((m) => m.content).join("");
  return { inputTokens: estimateTokens(input), outputTokens: estimateTokens(output) };
}

export interface OpenAiCompatibleOptions {
  baseUrl: string;
  apiKey: string;
  /** Give up on a request after this long. */
  timeoutMs?: number;
  /** Sent as `reasoning_effort` when set; thinking models otherwise spend the token budget on hidden reasoning. */
  reasoningEffort?: string;
  /** Wait before the one retry of a "busy" answer (429 or 5xx). */
  retryDelayMs?: number;
}

// Free tiers answer "busy" (429/503) in spikes; one short retry usually lands.
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

export function openAiCompatibleAdapter({
  baseUrl,
  apiKey,
  timeoutMs = 60_000,
  reasoningEffort,
  retryDelayMs = 1500,
}: OpenAiCompatibleOptions): LlmAdapter {
  const url = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;

  function body(model: string, req: LlmRequest, stream: boolean) {
    const system = systemBlocks(req.system).map((b) => b.text).join("\n\n");
    return JSON.stringify({
      model,
      max_tokens: req.maxTokens,
      messages: [{ role: "system", content: system }, ...req.messages],
      ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
      ...(stream ? { stream: true, stream_options: { include_usage: true } } : {}),
    });
  }

  async function post(model: string, req: LlmRequest, stream: boolean): Promise<Response> {
    // A provider that never answers must not leave the visitor waiting forever.
    const timeout = AbortSignal.timeout(timeoutMs);
    const signal = req.signal ? AbortSignal.any([req.signal, timeout]) : timeout;
    const send = () =>
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: body(model, req, stream),
        signal,
      });
    let res = await send();
    if (RETRYABLE.has(res.status)) {
      await res.body?.cancel().catch(() => undefined);
      await new Promise((r) => setTimeout(r, retryDelayMs));
      res = await send();
    }
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 300);
      throw new Error(`LLM request failed (${res.status}): ${detail}`);
    }
    return res;
  }

  return {
    async complete(model, req) {
      const res = await post(model, req, false);
      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string | null } }>;
        usage?: ChatUsage;
      };
      const text = json.choices?.[0]?.message?.content ?? "";
      return { text, usage: usageOf(json.usage, req, text) };
    },

    async *stream(model, req) {
      const res = await post(model, req, true);
      if (!res.body) throw new Error("LLM stream has no body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let output = "";
      let usage: ChatUsage | undefined;

      // Server-sent events: one `data: {json}` per line, ending with `data: [DONE]`.
      const handle = function* (line: string) {
        const data = line.replace(/^data:\s*/, "").trim();
        if (!line.startsWith("data:") || !data || data === "[DONE]") return;
        const chunk = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string | null } }>;
          usage?: ChatUsage | null;
        };
        if (chunk.usage) usage = chunk.usage;
        const text = chunk.choices?.[0]?.delta?.content;
        if (text) {
          output += text;
          yield { type: "text" as const, text };
        }
      };

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) yield* handle(line);
      }
      if (buffer) yield* handle(buffer);
      yield { type: "end", usage: usageOf(usage, req, output) };
    },
  };
}
