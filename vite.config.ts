import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  // GitHub Pages serves this repo at /ideashelf/. The Capacitor Android build
  // overrides it with `--base=./` (see npm run android:sync).
  base: process.env.APP_BASE ?? "/ideashelf/",
  build: { outDir: "dist" },
});
