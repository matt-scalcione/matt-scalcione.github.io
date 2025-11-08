/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f2f6ff',
          100: '#e2ebff',
          200: '#c4d6ff',
          300: '#9fbbff',
          400: '#769aff',
          500: '#4e79ff',
          600: '#345be6',
          700: '#2746b4',
          800: '#1c3383',
          900: '#121f52',
        },
      },
    },
  },
  plugins: [],
}
