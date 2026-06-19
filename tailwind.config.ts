import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        honey: "#C5A36A",
        marigold: "#B08D57",
        rose: "#5A3825",
        mint: "#6B6A4D",
        ink: "#1B1A17",
        paper: "#F5F0E6",
        robin: "#2F3A2F",
        ivory: "#F5F0E6",
        gold: "#B08D57",
        forest: "#2F3A2F",
        brass: "#6B6A4D",
        leather: "#5A3825"
      },
      boxShadow: {
        soft: "0 14px 30px rgba(10, 9, 7, 0.22)"
      }
    }
  },
  plugins: []
};

export default config;
