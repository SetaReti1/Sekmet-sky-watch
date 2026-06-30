/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Bebas Neue"', 'sans-serif'],
        oswald: ['Oswald', 'sans-serif'],
        mono: ['"Share Tech Mono"', 'monospace'],
      },
      colors: {
        space: {
          black: '#070505',
          card: '#0d0a09',
          accent: '#10f3a5',
          orange: '#facc15',
          yellow: '#facc15',
          muted: '#8e7a72',
        }
      }
    },
  },
  plugins: [],
}