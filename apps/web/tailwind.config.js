/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        gatekeep: {
          bg: '#0b0d12',
          card: '#141822',
          border: '#222734',
          accent: '#7c6cff',
          accentSoft: '#2a2550',
          success: '#22c55e',
          danger: '#ef4444',
          muted: '#8892a6',
        },
      },
    },
  },
  plugins: [],
};
