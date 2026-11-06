import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#F4F3F0",
        "surface-alt": "#EAE8E4",
        "surface-deep": "#DDDAD4",
        ink: "#242424",
        "ink-muted": "#6E6A64",
        "ink-faint": "#A8A29B",
        accent: "#E8B24A",
        "accent-deep": "#D19A2E",
        dark: {
          surface: "#1F1F1F",
          card: "#2A2A2A",
          ink: "#EDEBE7",
          muted: "#A8A29B",
        },
        paper: {
          cream: "#FFF4B8",
          "cream-deep": "#F2E39A",
          mint: "#D9F0CF",
          "mint-deep": "#C4E1B6",
          sakura: "#FFD9E1",
          "sakura-deep": "#F6C4CF",
          lilac: "#E6DBF8",
          "lilac-deep": "#D6C7F1",
          sky: "#CDE8FB",
          "sky-deep": "#B4D8F2",
          stone: "#ECECEC",
          "stone-deep": "#DCDCDC",
        },
      },
      fontFamily: {
        sans: [
          "Segoe UI Variable Display",
          "Segoe UI",
          "PingFang SC",
          "Microsoft YaHei",
          "system-ui",
          "sans-serif",
        ],
        mono: ["ui-monospace", "Cascadia Mono", "Consolas", "monospace"],
      },
      fontSize: {
        "note-title": ["20px", { lineHeight: "1.35", letterSpacing: "-0.01em", fontWeight: "600" }],
        "note-body": ["15px", { lineHeight: "1.65" }],
        "list-title": ["13.5px", { lineHeight: "1.4", fontWeight: "500" }],
        "list-summary": ["12.5px", { lineHeight: "1.5" }],
        micro: ["11.5px", { lineHeight: "1.4", letterSpacing: "0.02em" }],
      },
      borderRadius: {
        window: "12px",
        card: "10px",
        btn: "8px",
        check: "4px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,.05), 0 6px 20px rgba(0,0,0,.07)",
        "card-hover": "0 2px 4px rgba(0,0,0,.06), 0 12px 28px rgba(0,0,0,.10)",
        pop: "0 8px 32px rgba(0,0,0,.12), 0 1px 2px rgba(0,0,0,.06)",
        inset: "inset 0 0 0 1px rgba(255,255,255,.35)",
      },
      transitionTimingFunction: {
        paper: "cubic-bezier(.22,1,.36,1)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(2px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "pop-in": {
          from: { opacity: "0", transform: "scale(.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "dot-in": {
          "0%": { opacity: "0", transform: "scale(.4)" },
          "70%": { opacity: "1", transform: "scale(1.15)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "fade-in": "fade-in 120ms cubic-bezier(.22,1,.36,1) both",
        "pop-in": "pop-in 160ms cubic-bezier(.22,1,.36,1) both",
        "dot-in": "dot-in 180ms cubic-bezier(.22,1,.36,1) both",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
