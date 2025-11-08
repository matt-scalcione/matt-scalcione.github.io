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
      keyframes: {
        'fade-in': {
          '0%': { opacity: 0, transform: 'translateY(0.5rem)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        'fade-scale': {
          '0%': { opacity: 0, transform: 'translateY(0.25rem) scale(0.99)' },
          '100%': { opacity: 1, transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 280ms ease-out',
        'fade-scale': 'fade-scale 200ms ease-out',
      },
      boxShadow: {
        subtle: '0 10px 35px -18px rgba(15, 23, 42, 0.25)',
      },
      borderRadius: {
        '3xl': '1.75rem',
      },
    },
  },
  plugins: [],
}
