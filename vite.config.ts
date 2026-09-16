import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// VITE_BASE=/ideashelf/ for GitHub Pages; default "./" works for Capacitor (Android) and local preview.
export default defineConfig({
  plugins: [react()],
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
