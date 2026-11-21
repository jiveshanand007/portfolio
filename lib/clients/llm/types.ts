// The provider-neutral shape every chat model call goes through.

/** "main" writes the answers; "fast" does cheap helper work like query rewriting. */
export type LlmTier = "main" | "fast";

export interface LlmMessage {
  role: "user" | "assistant";
  content: string;
}

/** A piece of the system prompt. `cache` marks a long, stable block a provider may cache. */
export interface LlmSystemBlock {
  text: string;
  cache?: boolean;
}

export interface LlmRequest {
  tier: LlmTier;
  system: string | LlmSystemBlock[];
  messages: LlmMessage[];
  maxTokens: number;
  signal?: AbortSignal;
}

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens?: number;
  cacheCreationInputTokens?: number;
}

export type LlmStreamEvent =
  | { type: "text"; text: string }
  | { type: "end"; usage: LlmUsage };

/** What a provider adapter implements. */
export interface LlmAdapter {
  complete(model: string, req: LlmRequest): Promise<{ text: string; usage: LlmUsage }>;
  stream(model: string, req: LlmRequest): AsyncGenerator<LlmStreamEvent>;
}

export function systemBlocks(system: LlmRequest["system"]): LlmSystemBlock[] {
  return typeof system === "string" ? [{ text: system }] : system;
}
