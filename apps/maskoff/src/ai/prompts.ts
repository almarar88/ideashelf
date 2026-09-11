/**
 * The prompts live with the Edge Functions, which are the only component
 * allowed to hold a Gemini key in production. The browser re-exports them so
 * the dev-only "direct" transport runs byte-identical instructions — a prompt
 * can never drift between the two environments.
 */
export * from "@shared/prompts.ts";
