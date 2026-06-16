import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        honey: "#F7C948",
        marigold: "#F59E0B",
        rose: "#F9738D",
        mint: "#78C6A3",
        ink: "#2B2118",
        paper: "#FFF9EC",
        robin: "#65A7C8"
      },
      boxShadow: {
        soft: "0 14px 30px rgba(43, 33, 24, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
