import type { Backend } from "./types";
import { LocalBackend } from "./local";

let instance: Backend | null = null;

/**
 * Resolve the backend once, at boot.
 *
 * The Supabase adapter is imported dynamically so the default (local) build
 * never ships the Supabase SDK — it is roughly two thirds of the bundle and
 * an offline game has no use for it.
 */
export async function initBackend(): Promise<Backend> {
  if (instance) return instance;

  const env = import.meta.env;
  if (env.VITE_BACKEND === "supabase") {
    const url = env.VITE_SUPABASE_URL;
    const key = env.VITE_SUPABASE_ANON_KEY;
    if (url && key) {
      const { SupabaseBackend } = await import("./supabase");
      instance = new SupabaseBackend(url, key);
      return instance;
    }
    console.error("[MaskOff] VITE_BACKEND=supabase but URL/anon key are missing; using local backend.");
  }

  instance = new LocalBackend();
  return instance;
}

/** The initialized backend. Call initBackend() before the app renders. */
export function getBackend(): Backend {
  if (!instance) throw new Error("backend not initialized — call initBackend() first");
  return instance;
}

export type { Backend, LiveEvent, Unsubscribe } from "./types";
