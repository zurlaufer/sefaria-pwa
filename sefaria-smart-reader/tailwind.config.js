import typography from '@tailwindcss/typography'

/**
 * Tailwind CSS configuration.
 *
 * Tailwind v4 is CSS-first: `@tailwindcss/vite` drives the build, and this file
 * is pulled in from `src/index.css` via `@config` so the design tokens below stay
 * in one familiar place and can be extended later without touching components.
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        hebrew: ['"Frank Ruhl Libre"', '"Noto Serif Hebrew"', 'serif'],
        hebrewAlt: ['"Noto Serif Hebrew"', 'serif'],
        ui: ['Spectral', 'ui-serif', 'Georgia', 'serif'],
      },
      colors: {
        parchment: {
          50: '#fdfbf7',
          100: '#faf7f2',
          200: '#f2ece1',
          300: '#e6dbc9',
        },
        ink: {
          50: '#f5f6f8',
          100: '#e4e7ec',
          200: '#c8cfd8',
          300: '#9aa5b4',
          400: '#6b7688',
          500: '#4a5464',
          600: '#333b47',
          700: '#222933',
          800: '#151a22',
          900: '#0b0f14',
          950: '#060809',
        },
        brand: {
          50: '#eefbf7',
          100: '#d4f5eb',
          200: '#aeeadb',
          300: '#7bd8c7',
          400: '#45bfae',
          500: '#26a495',
          600: '#0f766e',
          700: '#0c5f5a',
          800: '#0d4b48',
          900: '#0d3f3d',
          950: '#032523',
        },
        gold: {
          300: '#e8c877',
          400: '#d8ad4c',
          500: '#c2912f',
          600: '#a3731f',
        },
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(11 15 20 / 0.04), 0 8px 24px -12px rgb(11 15 20 / 0.18)',
        drawer: '0 -8px 40px -12px rgb(11 15 20 / 0.35)',
      },
      keyframes: {
        'slide-up': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'slide-up': 'slide-up 260ms cubic-bezier(0.32, 0.72, 0, 1)',
        'fade-in': 'fade-in 180ms ease-out',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [typography],
}
