/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BACKEND?: "local" | "supabase";
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_AI_TRANSPORT?: "edge" | "direct" | "off";
  readonly VITE_GEMINI_MODEL?: string;
  readonly VITE_DEV_GEMINI_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
