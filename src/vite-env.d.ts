/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PARTNER_ENDPOINT?: string;
  readonly VITE_PARTNER_KEY?: string;
  readonly VITE_AI_ENDPOINT?: string;
  readonly VITE_AI_KEY?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
