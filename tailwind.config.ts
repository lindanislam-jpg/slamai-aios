import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#f0f4ff",
          100: "#e0e9ff",
          200: "#c7d5fe",
          300: "#a5b8fc",
          400: "#8191f8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
          950: "#1e1b4b",
        },
        slam: {
          purple: "#6366f1",
          blue:   "#3b82f6",
          cyan:   "#06b6d4",
          green:  "#10b981",
          orange: "#f59e0b",
          red:    "#ef4444",
          dark:   "#0f0f23",
          card:   "#1a1a2e",
          border: "#2a2a4a",
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "hero-glow": "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99,102,241,0.3), transparent)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      animation: {
        "fade-in":    "fadeIn 0.5s ease-in-out",
        "slide-up":   "slideUp 0.4s ease-out",
        "pulse-slow": "pulse 3s cubic-bezier(0.4,0,0.6,1) infinite",
        "glow":       "glow 2s ease-in-out infinite alternate",
      },
      keyframes: {
        fadeIn:  { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideUp: { "0%": { opacity: "0", transform: "translateY(20px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        glow:    { "0%": { boxShadow: "0 0 5px rgba(99,102,241,0.2)" }, "100%": { boxShadow: "0 0 20px rgba(99,102,241,0.6)" } },
      },
    },
  },
  plugins: [],
};

export default config;
