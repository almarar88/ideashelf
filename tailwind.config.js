/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '"Cairo"', "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      colors: {
        ink: { DEFAULT: "#12122B", soft: "#4A4A68", muted: "#8B8BA7", faint: "#AFAFC4" },
        canvas: { DEFAULT: "#EFF1F8", deep: "#E6E9F4" },
        brand: { 50: "#F1EFFE", 100: "#E4E0FD", 200: "#CDC6FB", 400: "#9A8CF4", DEFAULT: "#6C5CE7", 600: "#5B4BD6", 900: "#2C2277" },
        mint: { 100: "#DFF4F2", 200: "#C3EAE7", 300: "#9BDEDA", DEFAULT: "#5FC9C4", 600: "#3AA9A4" },
        coral: { 100: "#FFE3D8", 200: "#FFCDBB", DEFAULT: "#FF8A5B", 600: "#F36C36" },
        sun: { 100: "#FFEFD6", DEFAULT: "#FF8A29" },
        rose: { 100: "#FFE1EA", DEFAULT: "#FF4D6D" },
      },
      borderRadius: { xl2: "20px", "3xl": "24px", "4xl": "30px", "5xl": "38px" },
      boxShadow: {
        card: "0 10px 30px -12px rgba(28, 28, 74, 0.14)",
        soft: "0 6px 20px -10px rgba(28, 28, 74, 0.16)",
        pill: "0 10px 24px -10px rgba(17, 17, 17, 0.55)",
        float: "0 24px 60px -24px rgba(28, 28, 74, 0.35)",
      },
      keyframes: {
        "fade-up": { "0%": { opacity: "0", transform: "translateY(14px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        "scale-in": { "0%": { opacity: "0", transform: "scale(.94)" }, "100%": { opacity: "1", transform: "scale(1)" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
      },
      animation: {
        "fade-up": "fade-up .45s cubic-bezier(.22,1,.36,1) both",
        "scale-in": "scale-in .3s cubic-bezier(.22,1,.36,1) both",
      },
    },
  },
  plugins: [],
};
