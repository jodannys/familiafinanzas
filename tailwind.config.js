/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'sans-serif'],
      },
      colors: {
        // Base
        obsidian: {
          50:  '#f0f4ff',
          100: '#e0e9ff',
          200: '#c7d5ff',
          300: '#a3b8ff',
          400: '#7a92ff',
          500: '#5468ff',
          900: '#0a0f1e',
          800: '#0d1526',
          700: '#111d33',
          600: '#162040',
        },
        // Primary accent - Emerald
        emerald: {
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
        },
        // Secondary accent - Gold
        gold: {
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
        // Status colors
        rose:   { 400: '#fb7185', 500: '#f43f5e' },
        sky:    { 400: '#38bdf8', 500: '#0ea5e9' },
        violet: { 400: '#a78bfa', 500: '#8b5cf6' },
        // Glass
        glass: {
          white: 'rgba(255,255,255,0.05)',
          border: 'rgba(255,255,255,0.08)',
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-mesh': 'radial-gradient(at 20% 20%, #0d3b2e 0%, transparent 50%), radial-gradient(at 80% 80%, #0a1628 0%, transparent 50%), radial-gradient(at 50% 50%, #0a0f1e 0%, transparent 100%)',
      },
      boxShadow: {
        'glass': '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.08)',
        'glow-emerald': '0 0 30px rgba(16, 185, 129, 0.2)',
        'glow-gold': '0 0 30px rgba(245, 158, 11, 0.2)',
        'card': '0 4px 24px rgba(0,0,0,0.3)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'shimmer': 'shimmer 2s infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { transform: 'translateY(16px)', opacity: 0 }, to: { transform: 'translateY(0)', opacity: 1 } },
        shimmer: { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.5 } },
      },
    },
  },
  plugins: [],
}
