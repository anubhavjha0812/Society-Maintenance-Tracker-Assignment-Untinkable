import type { Config } from "tailwindcss";

/**
 * Design tokens — see documentation.txt Step 0 for the full rationale.
 * Warm editorial palette, serif display + grotesque body, flat hairline
 * surfaces. Deliberately no default Tailwind indigo/violet/blue scales in
 * use anywhere in the app.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F7F4EF",
        "paper-raised": "#FBF9F5",
        ink: "#1B1815",
        "ink-soft": "#5C554C",
        "ink-faint": "#8A8177",
        hairline: "#E4DFD5",
        clay: {
          DEFAULT: "#B5502C",
          dark: "#8F3D20",
          soft: "#EFDCD1",
        },
        moss: {
          DEFAULT: "#4B6350",
          soft: "#DEE6DD",
        },
        amber: {
          DEFAULT: "#A97A1F",
          soft: "#F1E3C4",
        },
        rose: {
          DEFAULT: "#9B3B3B",
          soft: "#EFD8D6",
        },
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "Georgia", "serif"],
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "6px",
        md: "8px",
        lg: "10px",
      },
      boxShadow: {
        overlay: "0 12px 32px -8px rgba(27, 24, 21, 0.22)",
      },
      fontSize: {
        "display-lg": ["3.25rem", { lineHeight: "1.05", letterSpacing: "-0.01em" }],
        "display-md": ["2.25rem", { lineHeight: "1.1", letterSpacing: "-0.01em" }],
        "display-sm": ["1.5rem", { lineHeight: "1.2" }],
      },
    },
  },
  plugins: [],
};

export default config;
