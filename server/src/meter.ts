import { addUsage, type UsageTotals } from "./pricing.js";

/** TransformStream that passes SSE bytes through untouched while collecting usage from message_start / message_delta. */
export function makeMeter(totals: UsageTotals, onDone: () => void): TransformStream<Uint8Array, Uint8Array> {
  let buf = "";
  const dec = new TextDecoder();
  return new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, ctrl) {
      ctrl.enqueue(chunk);
      buf += dec.decode(chunk, { stream: true });
      let i;
      while ((i = buf.indexOf("\n\n")) >= 0) {
        const evt = buf.slice(0, i); buf = buf.slice(i + 2);
        const dataLine = evt.split("\n").find((l) => l.startsWith("data:"));
        if (!dataLine) continue;
        try {
          const j = JSON.parse(dataLine.slice(5).trim()) as { type?: string; message?: { usage?: Record<string, unknown> }; usage?: Record<string, unknown> };
          if (j.type === "message_start") addUsage(totals, j.message?.usage);
          else if (j.type === "message_delta") addUsage(totals, j.usage);
        } catch { /* partial or non-JSON line */ }
      }
    },
    flush() { onDone(); },
  });
}
