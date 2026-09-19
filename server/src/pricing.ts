// USD per million tokens (Claude API list prices). Cache writes cost 1.25x input, cache reads 0.1x.
export const PRICES: Record<string, { input: number; output: number }> = {
  "claude-opus-5": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};
export const WEB_SEARCH_USD = 0.01; // $10 per 1,000 searches

export interface UsageTotals { input: number; output: number; cacheRead: number; cacheWrite: number; webSearches: number; }

export function costUSD(model: string, u: UsageTotals): number {
  const p = PRICES[model] ?? PRICES["claude-sonnet-5"];
  return (
    (u.input * p.input + u.output * p.output + u.cacheWrite * p.input * 1.25 + u.cacheRead * p.input * 0.1) / 1_000_000 +
    u.webSearches * WEB_SEARCH_USD
  );
}

export function emptyUsage(): UsageTotals { return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, webSearches: 0 }; }

/** Merge an Anthropic `usage` object (from message_start / message_delta / a full message) into totals. */
export function addUsage(t: UsageTotals, usage: Record<string, unknown> | undefined | null) {
  if (!usage) return;
  const n = (k: string) => (typeof usage[k] === "number" ? (usage[k] as number) : 0);
  t.input = Math.max(t.input, n("input_tokens"));
  t.output = Math.max(t.output, n("output_tokens"));
  t.cacheRead = Math.max(t.cacheRead, n("cache_read_input_tokens"));
  t.cacheWrite = Math.max(t.cacheWrite, n("cache_creation_input_tokens"));
  const st = usage["server_tool_use"] as Record<string, unknown> | undefined;
  if (st && typeof st["web_search_requests"] === "number") t.webSearches = Math.max(t.webSearches, st["web_search_requests"] as number);
}
