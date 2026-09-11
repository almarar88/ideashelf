/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'IBM Plex Sans Arabic'", "'Segoe UI'", "Tahoma", "sans-serif"],
        serif: ["'Noto Naskh Arabic'", "Georgia", "serif"],
      },
      colors: {
        canvas: "rgb(var(--canvas) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        raised: "rgb(var(--raised) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        rose: "rgb(var(--rose) / <alpha-value>)",
        iris: "rgb(var(--iris) / <alpha-value>)",
        mint: "rgb(var(--mint) / <alpha-value>)",
        amber: "rgb(var(--amber) / <alpha-value>)",
      },
      borderRadius: {
        xl2: "1.5rem",
        xl3: "2rem",
        xl4: "2.75rem",
      },
      boxShadow: {
        float: "var(--shadow-float)",
        lift: "var(--shadow-lift)",
        glow: "0 0 0 1px rgb(var(--rose) / 0.35), 0 12px 40px -12px rgb(var(--rose) / 0.55)",
      },
      keyframes: {
        floaty: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-7px)" },
        },
        pulseRing: {
          "0%": { transform: "scale(.85)", opacity: "0.7" },
          "70%": { transform: "scale(1.6)", opacity: "0" },
          "100%": { opacity: "0" },
        },
        riseIn: {
          from: { opacity: "0", transform: "translateY(14px) scale(.985)" },
          to: { opacity: "1", transform: "none" },
        },
        sweep: {
          from: { transform: "translateX(-120%)" },
          to: { transform: "translateX(120%)" },
        },
        typing: {
          from: { width: "0" },
          to: { width: "100%" },
        },
      },
      animation: {
        floaty: "floaty 7s ease-in-out infinite",
        pulseRing: "pulseRing 2.6s cubic-bezier(.3,.7,.4,1) infinite",
        riseIn: "riseIn .45s cubic-bezier(.22,1,.36,1) both",
        sweep: "sweep 2.2s linear infinite",
      },
    },
  },
  plugins: [],
}
