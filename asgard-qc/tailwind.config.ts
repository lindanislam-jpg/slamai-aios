import type { Config } from "tailwindcss";

/** ASGARD palette: charcoal/navy surfaces, restrained gold, status colours. */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#070b10",
          900: "#0b1118",
          850: "#0e151e",
          800: "#111a24",
          700: "#16212d",
          600: "#1d2a38",
          500: "#2a3a4c",
          400: "#47596d",
          300: "#7d8fa3",
          200: "#aebccb",
          100: "#dbe3ec",
        },
        gold: { 300: "#e6c77f", 400: "#d6b062", 500: "#c39a45", 600: "#9c7a33" },
        ok: { 400: "#34d3b0", 500: "#1fb894", 600: "#14937a" },
        warn: { 400: "#f6c05a", 500: "#f0a531", 600: "#c98515" },
        bad: { 400: "#f87171", 500: "#e5484d", 600: "#b9353a" },
        info: { 400: "#60a5fa", 500: "#3b82f6" },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "monospace"],
      },
      keyframes: {
        rise: { "0%": { opacity: "0", transform: "translateY(6px)" }, "100%": { opacity: "1", transform: "none" } },
      },
      animation: { rise: "rise .35s ease-out both" },
    },
  },
  plugins: [],
};

export default config;
