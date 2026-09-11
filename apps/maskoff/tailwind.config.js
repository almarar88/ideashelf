/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Base — OLED-friendly black page, charcoal-violet raised surfaces
        // (design reference: dark purple-tinted cards on a near-black canvas).
        void: "#000000",
        ink: { 900: "#0B0910", 800: "#17131F", 700: "#221B2D", 600: "#2E2639", 500: "#3A3147" },
        // Pastel accent tiles — dark ink sits on top of these
        ice: "#B9C9F2",
        coral: "#F08D7C",
        pistachio: "#C7E89C",
        butter: "#F2D06B",
        // Vivid accents — white sits on top of these
        grape: "#B429E0",
        neon: "#8B5CF6",
        toxic: "#22C55E",
        alert: "#EF4444",
        cyber: "#EAB308",
        muted: "#9A93A8",
      },
      borderRadius: { card: "32px", tile: "28px", chip: "18px", pill: "999px" },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', '"IBM Plex Sans Arabic"', "system-ui", "sans-serif"],
        body: ['"IBM Plex Sans Arabic"', '"Plus Jakarta Sans"', "system-ui", "sans-serif"],
      },
      boxShadow: {
        tile: "0 18px 40px -18px rgba(0,0,0,.85)",
        neon: "0 0 0 1px rgba(139,92,246,.30), 0 0 34px -8px rgba(139,92,246,.70)",
        grape: "0 0 0 1px rgba(180,41,224,.30), 0 0 34px -8px rgba(180,41,224,.75)",
        lift: "0 24px 60px -28px rgba(0,0,0,.95)",
      },
      keyframes: {
        "pulse-ring": {
          "0%,100%": { opacity: ".35", transform: "scale(1)" },
          "50%": { opacity: ".9", transform: "scale(1.045)" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shock: {
          "0%": { transform: "scale(.86)", opacity: "0" },
          "60%": { transform: "scale(1.05)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "chev": {
          "0%,100%": { opacity: ".25" },
          "50%": { opacity: "1" },
        },
        "sheet-in": {
          from: { opacity: "0", transform: "translateY(40px) scale(.97)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "spark": {
          "0%": { transform: "scale(.4) rotate(-18deg)", opacity: "0" },
          "70%": { transform: "scale(1.12) rotate(4deg)", opacity: "1" },
          "100%": { transform: "scale(1) rotate(0)", opacity: "1" },
        },
      },
      animation: {
        "pulse-ring": "pulse-ring 2.4s ease-in-out infinite",
        "slide-up": "slide-up .4s cubic-bezier(.16,1,.3,1) both",
        shock: "shock .5s cubic-bezier(.16,1,.3,1) both",
        chev: "chev 1.2s ease-in-out infinite",
        "sheet-in": "sheet-in .34s cubic-bezier(.16,1,.3,1) both",
        spark: "spark .6s cubic-bezier(.16,1,.3,1) both",
      },
    },
  },
  plugins: [],
};
