// Build-time configuration. Set these as VITE_* variables in CI (GitHub → Settings → Variables)
// or in a local .env file. When API_URL and SUPABASE_URL are present the app runs in
// "hosted" mode (accounts + subscriptions); otherwise it runs in "bring your own key" mode.
export const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";
export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "";
export const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? "";
export const REVENUECAT_ANDROID_KEY = (import.meta.env.VITE_REVENUECAT_ANDROID_KEY as string | undefined) ?? "";
export const REVENUECAT_IOS_KEY = (import.meta.env.VITE_REVENUECAT_IOS_KEY as string | undefined) ?? "";
export const PRIVACY_URL = (import.meta.env.VITE_PRIVACY_URL as string | undefined) ?? "https://almarar88.github.io/ideashelf/legal/privacy.html";
export const TERMS_URL = (import.meta.env.VITE_TERMS_URL as string | undefined) ?? "https://almarar88.github.io/ideashelf/legal/terms.html";
export const HOSTED_ENABLED = Boolean(API_URL && SUPABASE_URL && SUPABASE_ANON_KEY);
