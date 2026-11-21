/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        slate: {
          850: '#151e2e',
          950: '#070d18'
        }
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'breathe': 'breathe 16s ease-in-out infinite'
      },
      keyframes: {
        breathe: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.85' },
          '25%': { transform: 'scale(1.35)', opacity: '1' },
          '50%': { transform: 'scale(1.35)', opacity: '0.95' },
          '75%': { transform: 'scale(1)', opacity: '0.7' }
        }
      }
    },
  },
  plugins: [],
}
