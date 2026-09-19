import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * The app works without a backend: a reader can still import their own PDFs and keep
 * everything on the device. Cloud features (accounts, store, subscriptions) only light
 * up once a project is configured, so one build serves both.
 */
export const cloudEnabled = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = cloudEnabled
  ? createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false, // Capacitor has no URL bar to read a callback from
      },
    })
  : null;

export function requireSupabase(): SupabaseClient {
  if (!supabase) throw new Error("لم يتم إعداد الخادم بعد. راجع ملف .env");
  return supabase;
}
