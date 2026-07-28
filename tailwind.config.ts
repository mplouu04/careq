import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "DM Sans", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "DM Serif Display", "Georgia", "serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "ui-monospace", "monospace"],
      },
      colors: {
        surface: {
          DEFAULT: "hsl(var(--surface))",
          "container-lowest": "hsl(var(--surface-container-lowest))",
          "container-low": "hsl(var(--surface-container-low))",
          container: "hsl(var(--surface-container))",
          "container-high": "hsl(var(--surface-container-high))",
          variant: "hsl(var(--surface-variant))",
        },
        "on-surface": {
          DEFAULT: "hsl(var(--on-surface))",
          variant: "hsl(var(--on-surface-variant))",
        },
        "outline-variant": "hsl(var(--outline-variant))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        "status-waiting": "hsl(var(--status-waiting))",
        "status-called": "hsl(var(--status-called))",
        "status-completed": "hsl(var(--status-completed))",
        "status-no-show": "hsl(var(--status-no-show))",
        "secondary-container": "hsl(var(--secondary-container))",
        "on-secondary-container": "hsl(var(--on-secondary-container))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontSize: {
        "headline-lg": ["32px", { lineHeight: "1.2", fontWeight: "700", letterSpacing: "-0.02em" }],
        "headline-md": ["24px", { lineHeight: "1.3", fontWeight: "600" }],
        "headline-sm": ["20px", { lineHeight: "1.3", fontWeight: "600" }],
        "body-lg": ["18px", { lineHeight: "1.5", fontWeight: "400" }],
        "body-md": ["16px", { lineHeight: "1.5", fontWeight: "400" }],
        "body-sm": ["14px", { lineHeight: "1.5", fontWeight: "400" }],
        "label-md": ["14px", { lineHeight: "1.2", fontWeight: "600", letterSpacing: "0.05em" }],
        "label-sm": ["12px", { lineHeight: "1.2", fontWeight: "500" }],
      },
      spacing: {
        xs: "4px",
        sm: "8px",
        md: "16px",
        lg: "24px",
        xl: "32px",
        xxl: "48px",
        "margin-mobile": "16px",
        "margin-desktop": "40px",
        gutter: "24px",
      },
      maxWidth: {
        careq: "80rem",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
