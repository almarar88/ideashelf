import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// `base` is overridable so the same build can ship to GitHub Pages
// (/ideashelf/maskoff/) or to a dedicated host (/).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Prompts are owned by the Edge Functions; the client re-exports them.
      "@shared": path.resolve(__dirname, "./supabase/functions/_shared"),
    },
  },
  base: process.env.MASKOFF_BASE ?? "/",
  build: { target: "es2022", sourcemap: false },
});
