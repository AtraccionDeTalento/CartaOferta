/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        usil: {
          // Azul marino institucional
          blue: {
            50:  '#eef4ff',
            100: '#daeaff',
            200: '#b8d6ff',
            300: '#87bcff',
            400: '#4d96ff',
            500: '#1a6fd4',   // Azul USIL principal
            600: '#0055b3',
            700: '#003a7a',   // Azul profundo
            800: '#002559',
            900: '#001433',
            950: '#000c1f',
          },
          // Celeste / Sky
          sky: {
            50:  '#f0faff',
            100: '#d9f2fe',
            200: '#ace8fd',
            300: '#70d7fb',
            400: '#2ac4f5',
            500: '#07abe0',   // Celeste vibrante
            600: '#0284ad',
            700: '#02608a',
            800: '#0a4f73',
            900: '#0e3f5d',
          },
          // Blanco puro y gris neutro claro
          white: '#ffffff',
          // Escala de negros
          black: {
            DEFAULT: '#0a0a0a',
            soft:    '#1c1c1e',
            muted:   '#3a3a3c',
          },
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
