// Offline self-test: pricing math and SSE metering. Run: npm test
import assert from "node:assert/strict";
import { costUSD, emptyUsage } from "./pricing.js";
import { makeMeter } from "./meter.js";

// pricing
const u = { input: 1000, output: 500, cacheRead: 9000, cacheWrite: 0, webSearches: 2 };
const sonnet = costUSD("claude-sonnet-5", u);
assert.ok(Math.abs(sonnet - (1000 * 2 + 500 * 10 + 9000 * 0.2) / 1e6 - 0.02) < 1e-9, "sonnet cost " + sonnet);

// metering a fake stream
const sse = [
  'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":1200,"cache_read_input_tokens":800,"output_tokens":1}}}\n\n',
  'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"hi"}}\n\n',
  'event: message_delta\ndata: {"type":"message_delta","usage":{"output_tokens":345,"server_tool_use":{"web_search_requests":1}}}\n\n',
  "event: message_stop\ndata: {\"type\":\"message_stop\"}\n\n",
];
const totals = emptyUsage();
let flushed = false;
const src = new ReadableStream<Uint8Array>({ start(c) { for (const s of sse) c.enqueue(new TextEncoder().encode(s)); c.close(); } });
const out = src.pipeThrough(makeMeter(totals, () => { flushed = true; }));
let passthrough = "";
const reader = out.getReader();
for (;;) { const { value, done } = await reader.read(); if (done) break; passthrough += new TextDecoder().decode(value); }
assert.equal(passthrough, sse.join(""), "bytes must pass through untouched");
assert.ok(flushed);
assert.deepEqual(totals, { input: 1200, output: 345, cacheRead: 800, cacheWrite: 0, webSearches: 1 });
console.log("selftest ok — cost of sample stream on sonnet:", costUSD("claude-sonnet-5", totals).toFixed(5), "USD");
