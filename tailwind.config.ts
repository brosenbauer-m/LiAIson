import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#FAFAFA",
        surface: "#FFFFFF",
        card: "#FFFFFF",
        accent: "#111111",
        "accent-light": "#333333",
        "accent-subtle": "#F2F2F2",
        "accent-tint": "#F7F7F7",
        "text-primary": "#111111",
        "text-secondary": "#555555",
        "text-muted": "#999999",
        border: "#E5E5E5",
        "border-light": "#F0F0F0",
        success: "#111111",
        warning: "#111111",
        error: "#111111",
        "badge-public": "#111111",
        "badge-discoverable": "#555555",
        "badge-private": "#999999",
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)',
        'card': '0 2px 8px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.04)',
      },
    },
  },
  plugins: [],
};
export default config;
