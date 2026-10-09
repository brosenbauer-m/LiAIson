import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // Warm brown palette (redesign 2026-10-09; contrast checked: body text
      // ≥ 6:1, muted ≥ 3.7:1, white on accent ≈ 10:1). Keep in sync with
      // globals.css and the SVG colours in components/similarity/SimilarityMap.tsx.
      colors: {
        background: "#FAF6F0",
        surface: "#FFFDF9",
        card: "#FFFDF9",
        accent: "#5C3B28",
        "accent-light": "#7A5139",
        "accent-subtle": "#EFE6DA",
        "accent-tint": "#F6EFE6",
        "text-primary": "#2B1E16",
        "text-secondary": "#6B584B",
        "text-muted": "#8F7B6C",
        border: "#E7DDD0",
        "border-light": "#F0E8DD",
        success: "#3E6B3A",
        warning: "#8A5A12",
        error: "#A3322A",
        "badge-public": "#5C3B28",
        "badge-discoverable": "#6B584B",
        "badge-private": "#8F7B6C",
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Inter', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
      },
      boxShadow: {
        'soft': '0 1px 3px rgba(43, 30, 22, 0.06), 0 1px 2px rgba(43, 30, 22, 0.04)',
        'card': '0 2px 8px rgba(43, 30, 22, 0.07), 0 1px 3px rgba(43, 30, 22, 0.05)',
      },
    },
  },
  plugins: [],
};
export default config;
