import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "-apple-system", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        canvas: "rgb(var(--bg-canvas) / <alpha-value>)",
        surface: "rgb(var(--bg-surface) / <alpha-value>)",
        card: "rgb(var(--bg-card) / <alpha-value>)",
        nested: "rgb(var(--bg-nested) / <alpha-value>)",
        elevated: "rgb(var(--bg-elevated) / <alpha-value>)",
        highest: "rgb(var(--bg-highest) / <alpha-value>)",
        line: "rgb(var(--border-line) / <alpha-value>)",
        ink: {
          primary: "rgb(var(--ink-primary) / <alpha-value>)",
          body: "rgb(var(--ink-body) / <alpha-value>)",
          secondary: "rgb(var(--ink-secondary) / <alpha-value>)",
          muted: "rgb(var(--ink-muted) / <alpha-value>)",
        },
        cta: {
          bg: "rgb(var(--cta-bg) / <alpha-value>)",
          ink: "rgb(var(--cta-ink) / <alpha-value>)",
        },
        emeraldTech: {
          DEFAULT: "rgb(var(--accent-emerald) / <alpha-value>)",
          fill: "rgb(var(--accent-emerald-bg) / <alpha-value>)",
        },
        amberTech: "rgb(var(--accent-amber) / <alpha-value>)",
        roseTech: "rgb(var(--accent-rose) / <alpha-value>)",
      },
    },
  },
  plugins: [],
};
export default config;
