import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // DevOps Agent Theme (matching ProGear color scheme)
        'primary': '#1a1a2e',        // Deep dark
        'primary-light': '#16213e',  // Dark shadow
        'accent': '#6366f1',         // Indigo (DevOps primary accent)
        'accent-light': '#818cf8',   // Light indigo
        'accent-dark': '#4f46e5',    // Darker indigo
        'devops-purple': '#8b5cf6',  // GitHub/DevOps purple
        'devops-green': '#10b981',   // Success green
        'devops-blue': '#3b82f6',    // Blue
        'github-dark': '#24292e',    // GitHub dark
        'github-green': '#238636',   // GitHub green
        'github-orange': '#f97316',  // GitHub actions orange
        'code-green': '#10b981',     // Terminal green
        'tech-purple': '#8b5cf6',    // AI/technology purple
        'tech-purple-light': '#a78bfa',
        'okta-blue': '#007dc1',      // Okta brand blue
        'okta-blue-light': '#0ea5e9',
        'success-green': '#22c55e',  // Success states
        'error-red': '#ef4444',      // Error states
        'neutral-bg': '#0d0d14',     // Dark background
        'neutral-border': '#2a2a3e', // Dark borders

        // Agent color (single agent)
        'agent-github': '#6366f1',   // Indigo for GitHub MCP
      },
      fontFamily: {
        'display': ['Inter', 'system-ui', 'sans-serif'],
        'mono': ['JetBrains Mono', 'Courier New', 'monospace'],
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};

export default config;
