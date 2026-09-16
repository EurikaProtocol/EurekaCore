import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        tinan: {
          cyan: "#0DA4AC",
          turquoise: "#15D0C9",
          black: "#0A0A0A",
        },
      },
      boxShadow: {
        glass: "0 24px 60px rgba(0, 0, 0, 0.35)",
      },
    },
  },
  plugins: [],
} satisfies Config;
