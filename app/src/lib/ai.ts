import Anthropic from "@anthropic-ai/sdk";
import type { ModelId, Source, Usage } from "./types";

export function makeClient(apiKey: string): Anthropic {
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 2, timeout: 10 * 60 * 1000 });
}

export function webSearchTool(model: ModelId, maxUses: number): Anthropic.ToolUnion {
  if (model === "claude-haiku-4-5") return { type: "web_search_20250305", name: "web_search", max_uses: maxUses };
  return { type: "web_search_20260209", name: "web_search", max_uses: maxUses };
}

export function supportsEffort(model: ModelId): boolean {
  return model !== "claude-haiku-4-5";
}

export type Phase = "ack" | "working" | "searching" | "writing";

export interface TurnOpts {
  client: Anthropic;
  model: ModelId;
  system: string;
  messages: Anthropic.MessageParam[];
  tools?: Anthropic.ToolUnion[];
  effort?: "low" | "medium" | "high" | "xhigh";
  maxTokens?: number;
  signal?: AbortSignal;
  onText?: (full: string) => void;
  onPhase?: (p: Phase) => void;
  onToolCall?: (name: string, input: Record<string, unknown>) => Promise<string>;
}

export interface TurnResult { text: string; sources: Source[]; searches: number; usage: Usage; stopReason: string; }

/** Streams one agent turn, executing client tools and resuming paused server-tool turns. */
export async function runTurn(o: TurnOpts): Promise<TurnResult> {
  const messages = [...o.messages];
  let text = "";
  const usage: Usage = { input: 0, output: 0 };
  const sources: Source[] = [];
  let searches = 0;
  let stopReason = "end_turn";

  for (let iter = 0; iter < 10; iter++) {
    const params: Anthropic.MessageStreamParams = {
      model: o.model,
      max_tokens: o.maxTokens ?? 16000,
      system: o.system,
      messages,
      ...(o.tools && o.tools.length ? { tools: o.tools } : {}),
      ...(o.effort && supportsEffort(o.model) ? { output_config: { effort: o.effort } } : {}),
    };
    const stream = o.client.messages.stream(params, { signal: o.signal });
    let sawText = false;
    for await (const ev of stream) {
      if (ev.type === "content_block_start") {
        const b = ev.content_block;
        if (b.type === "server_tool_use") { searches++; o.onPhase?.("searching"); }
        else if (b.type === "tool_use") o.onPhase?.("working");
        else if (b.type === "text") { o.onPhase?.("writing"); if (sawText && text && !text.endsWith("\n")) text += "\n\n"; sawText = true; }
      } else if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
        text += ev.delta.text;
        o.onText?.(text);
      }
    }
    const final = await stream.finalMessage();
    usage.input += final.usage.input_tokens + (final.usage.cache_read_input_tokens ?? 0) + (final.usage.cache_creation_input_tokens ?? 0);
    usage.output += final.usage.output_tokens;
    stopReason = final.stop_reason ?? "end_turn";

    for (const b of final.content) {
      if (b.type === "web_search_tool_result" && Array.isArray(b.content)) {
        for (const r of b.content) if (r.type === "web_search_result" && !sources.some((s) => s.url === r.url)) sources.push({ url: r.url, title: r.title });
      }
    }

    if (final.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: final.content });
      continue;
    }
    if (final.stop_reason === "tool_use") {
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const b of final.content) {
        if (b.type !== "tool_use") continue;
        let out = "";
        try { out = o.onToolCall ? await o.onToolCall(b.name, (b.input ?? {}) as Record<string, unknown>) : "Tool not available"; }
        catch (e) { out = "Error: " + (e instanceof Error ? e.message : String(e)); }
        results.push({ type: "tool_result", tool_use_id: b.id, content: out });
      }
      messages.push({ role: "assistant", content: final.content });
      messages.push({ role: "user", content: results });
      o.onPhase?.("writing");
      continue;
    }
    if (final.stop_reason === "refusal") {
      text += (text ? "\n\n" : "") + "⚠️ (refused by safety filter)";
    }
    break;
  }
  o.onText?.(text);
  return { text, sources, searches, usage, stopReason };
}

export function describeError(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return "Invalid API key (401)";
  if (e instanceof Anthropic.RateLimitError) return "Rate limited (429) — try again shortly";
  if (e instanceof Anthropic.BadRequestError) return "Bad request: " + e.message;
  if (e instanceof Anthropic.APIConnectionError) return "Connection error — check your internet";
  if (e instanceof Anthropic.APIError) return `API error ${e.status}: ${e.message}`;
  if (e instanceof Error) return e.name === "AbortError" ? "Stopped" : e.message;
  return String(e);
}
