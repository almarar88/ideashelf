import { z } from "zod";

/**
 * Strict-ish JSON extraction for LLM output.
 *
 * Models are instructed to return a bare JSON object, but in practice they
 * still occasionally wrap it in a ```json fence or prepend a sentence. We
 * recover from exactly those two cases and nothing else — anything weirder is
 * a genuine failure and must fall through to the caller's fallback rather
 * than be silently "fixed".
 */
export function extractJsonObject(raw: string): unknown {
  const text = raw.trim();
  if (!text) throw new SyntaxError("empty model response");

  const candidates: string[] = [text];

  // ```json ... ``` or ``` ... ```
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) candidates.push(fenced[1]);

  // First balanced {...} span.
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) candidates.push(text.slice(start, end + 1));

  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new SyntaxError("unparseable model response");
}

export class SchemaViolationError extends Error {
  readonly issues: z.ZodIssue[];
  constructor(message: string, issues: z.ZodIssue[]) {
    super(message);
    this.name = "SchemaViolationError";
    this.issues = issues;
  }
}

/** Parse + validate in one step. Throws on either failure. */
export function parseStrict<T>(raw: string, schema: z.ZodType<T>): T {
  const value = extractJsonObject(raw);
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new SchemaViolationError(
      `model response failed schema validation: ${result.error.issues
        .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
        .join("; ")}`,
      result.error.issues,
    );
  }
  return result.data;
}
