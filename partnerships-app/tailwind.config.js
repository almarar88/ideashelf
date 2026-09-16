/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        olive: { 50: "#EEF0E9", 100: "#D9DCD1", 200: "#B9BCB1", 300: "#8E9484", 400: "#6B7361", 500: "#4B5343", 600: "#3F4739", 700: "#343B30", 800: "#2B3128", 900: "#20251E" },
        ink: "#1E2419",
        muted: "#7A7F73",
        urgent: "#F26B2B",
        medium: "#C4901D",
        ok: "#5E9C5A",
        info: "#4F86C6",
      },
      borderRadius: { xl2: "22px", xl3: "28px" },
      fontFamily: { sans: ["Manrope", "IBM Plex Sans Arabic", "Tajawal", "system-ui", "sans-serif"] },
      boxShadow: { card: "0 6px 20px rgba(20,25,18,0.18)" },
    },
  },
  plugins: [],
};
