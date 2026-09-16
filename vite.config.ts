import fs from "node:fs";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

/**
 * pdf.js needs its CMap and standard-font data files at runtime for PDFs that use CID fonts
 * or non-embedded standard fonts. Copy them out of node_modules into public/ so they ship
 * with both the web build and the Android bundle (and work offline).
 */
function pdfjsAssets(): Plugin {
  return {
    name: "copy-pdfjs-assets",
    buildStart() {
      const from = path.resolve(__dirname, "node_modules/pdfjs-dist");
      const to = path.resolve(__dirname, "public/pdfjs");
      for (const dir of ["cmaps", "standard_fonts"]) {
        const src = path.join(from, dir);
        const dest = path.join(to, dir);
        if (fs.existsSync(src) && !fs.existsSync(dest)) fs.cpSync(src, dest, { recursive: true });
      }
    },
  };
}

// VITE_BASE=/ideashelf/ for GitHub Pages; default "./" works for Capacitor (Android) and local preview.
export default defineConfig({
  plugins: [react(), pdfjsAssets()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  base: process.env.VITE_BASE ?? "./",
  build: {
    target: "es2020",
    chunkSizeWarningLimit: 1500,
  },
});
