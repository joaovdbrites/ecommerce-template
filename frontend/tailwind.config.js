/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#2a0f3d',
        gold: '#d89a28',
        trust: {
          DEFAULT: '#5b247f',
          dark: '#3a164f',
          soft: '#eadcf0',
          line: '#5b247f',
        },
      },
    },
  },
  plugins: [],
}
