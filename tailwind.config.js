/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#0a0d14',
          darker: '#06080d',
          card: '#101522',
          cardBorder: '#1e293b',
          accent: '#3b82f6',
        },
        highlight: {
          atm: '#f97316',        // Orange for ATM strike
          minAvg: '#86efac',     // Light Green for min AVG
          minPremium: '#7dd3fc', // Light Blue for min Call/Put Premium
          topVolume: '#fde047',  // Light Yellow/Gold for Top 2 Volume
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: 1, transform: 'scale(1)' },
          '50%': { opacity: 0.6, transform: 'scale(1.08)' },
        },
        tickFlashGreen: {
          '0%': { backgroundColor: 'rgba(34, 197, 94, 0.35)' },
          '100%': { backgroundColor: 'transparent' },
        },
        tickFlashRed: {
          '0%': { backgroundColor: 'rgba(239, 68, 68, 0.35)' },
          '100%': { backgroundColor: 'transparent' },
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'tick-green': 'tickFlashGreen 0.7s ease-out',
        'tick-red': 'tickFlashRed 0.7s ease-out',
      }
    },
  },
  plugins: [],
}
