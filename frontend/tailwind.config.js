/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',          // toggle via class on <html>
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef2ff', 100: '#e0e7ff',
          500: '#6366f1', 600: '#4f46e5', 700: '#4338ca',
        },
      },
      keyframes: {
        pagein:   { from: { opacity: '0', transform: 'translateY(5px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slidein:  { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
        fadein:   { from: { opacity: '0' }, to: { opacity: '1' } },
      },
      animation: {
        pagein:  'pagein 0.18s ease',
        slidein: 'slidein 0.2s ease',
        fadein:  'fadein 0.15s ease',
      },
    },
  },
  plugins: [],
};
