import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: {
          50: "#FDFAF5",
          100: "#F7F2E8",
          200: "#EDE5D4",
          300: "#DDD3BC",
          400: "#C9BC9E",
        },
        ink: {
          900: "#1A1612",
          700: "#3D3529",
          500: "#6B5E4A",
          300: "#A89880",
        },
        amber: {
          accent: "#C8873A",
          light: "#F5E6D0",
        },
        "red-soft": "#C0593A",
        "green-soft": "#4A7C59",
      },
      fontFamily: {
        sans: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
        serif: ["var(--font-lora)", "Georgia", "serif"],
        mono: ["var(--font-dm-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        DEFAULT: "6px",
        panel: "10px",
        modal: "16px",
      },
      boxShadow: {
        paper: "0 2px 24px rgba(26,22,18,0.08)",
        toast: "0 4px 20px rgba(26,22,18,0.12)",
      },
      transitionDuration: {
        DEFAULT: "150ms",
      },
      keyframes: {
        breath: {
          "0%, 100%": { opacity: "0.4", transform: "scale(0.9)" },
          "50%": { opacity: "1", transform: "scale(1)" },
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(200, 135, 58, 0.4)" },
          "50%": { boxShadow: "0 0 0 6px rgba(200, 135, 58, 0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        fadeBorder: {
          "0%": { borderLeftColor: "#C8873A" },
          "100%": { borderLeftColor: "transparent" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        breath: "breath 2s ease-in-out infinite",
        pulseGlow: "pulseGlow 1.8s ease-in-out infinite",
        shimmer: "shimmer 2s linear infinite",
        fadeBorder: "fadeBorder 3s ease-out forwards",
        slideUp: "slideUp 200ms ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
