import type { Config } from "tailwindcss";
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: { base: "#0b0d12", surface: "#141821", edge: "#1e2430", accent: "#38bdf8" },
      fontFamily: { sans: ["Inter", "system-ui", "sans-serif"], mono: ["JetBrains Mono", "monospace"] },
    },
  },
  plugins: [],
} satisfies Config;
