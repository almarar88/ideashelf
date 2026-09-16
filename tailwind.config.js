/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#2b2826",
          soft: "#3a3634",
          muted: "#6b6461",
        },
        cream: {
          DEFAULT: "#f3efe9",
          soft: "#e9e4dc",
          deep: "#ddd6cc",
        },
        accent: {
          DEFAULT: "#ee7a4b",
          soft: "#f7b899",
          deep: "#d9663a",
        },
      },
      borderRadius: {
        "3xl": "1.75rem",
        "4xl": "2.25rem",
      },
      fontFamily: {
        sans: ["'IBM Plex Sans Arabic'", "'Tajawal'", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 10px 30px -12px rgba(43,40,38,0.25)",
        lift: "0 20px 40px -16px rgba(43,40,38,0.35)",
      },
    },
  },
  plugins: [],
};
