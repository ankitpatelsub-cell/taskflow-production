/** @type {import('tailwindcss').Config} */

// Warm neutral scale — replaces Tailwind's cold gray/slate ramps everywhere in
// the app (both keys are used interchangeably across ~90 files for light/dark
// surfaces), so overriding both here repaints the whole app with zero other edits.
const warmNeutral = {
  25:  '#FBF8F4',
  50:  '#F6F1EA',
  100: '#EDE5DA',
  200: '#E1D5C6',
  300: '#CBB9A3',
  400: '#A5917A',
  500: '#8A7660',
  600: '#6B5A48',
  700: '#4F4133',
  800: '#3A2F24',
  900: '#241C15',
  950: '#17110C',
};

export default {
  darkMode: 'class',          // toggle via class on <html>
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#F1EEFE', 100: '#E4DEFC',
          500: '#7C6AE8', 600: '#6952D9', 700: '#5640B3',
        },
        gray: warmNeutral,
        slate: warmNeutral,
        // Soft periwinkle-violet — pastel-shifted primary accent (was saturated indigo)
        indigo: {
          50:  '#F1EEFE',
          100: '#E4DEFC',
          200: '#CCC0F9',
          300: '#AC9AF3',
          400: '#9080EC',
          500: '#7C6AE8',
          600: '#6952D9',
          700: '#5640B3',
          800: '#40308A',
          900: '#2C2160',
          950: '#1C1540',
        },
        // Soft coral — secondary accent, used sparingly for gradients/glows
        coral: {
          50:  '#FDF1EC',
          100: '#FBE1D5',
          200: '#F6C4AC',
          300: '#F0A585',
          400: '#EA9270',
          500: '#E88865',
          600: '#D66E4B',
          700: '#B3573A',
          800: '#7A3B28',
          900: '#4A2318',
          950: '#2A140C',
        },
        // Soft sage — success
        emerald: {
          50:  '#E9F6EE',
          100: '#D3EEDC',
          200: '#BEE3CC',
          300: '#94D2AE',
          400: '#6FBE8D',
          500: '#4FAE79',
          600: '#3D9564',
          700: '#2E7850',
          800: '#255F41',
          900: '#1C4A32',
        },
        green: {
          50:  '#EDF7F0',
          100: '#DCF0E3',
          200: '#C3E6D0',
          400: '#7BC79A',
          500: '#56B67E',
          600: '#3F9C67',
          700: '#2E7850',
        },
        // Soft coral-red — danger (not fire-engine red)
        red: {
          50:  '#FCEEEC',
          100: '#F8DBD5',
          200: '#F3C7BE',
          300: '#EBA695',
          400: '#E68B78',
          500: '#DC7259',
          600: '#C85C43',
          700: '#A44833',
          800: '#7D3626',
          900: '#4A2015',
        },
        // Soft apricot/amber — warning
        amber: {
          50:  '#FBF2E3',
          100: '#F6E4C4',
          200: '#EFD49E',
          300: '#E7C071',
          400: '#E0AC55',
          500: '#D3953A',
          600: '#B87C2A',
          700: '#92621F',
          800: '#6E4A18',
          900: '#4F3411',
        },
        orange: {
          50:  '#FBEEE3',
          100: '#F6DCC5',
          200: '#EFCBA8',
          400: '#E0985A',
          500: '#D37F3F',
          600: '#B8672E',
          700: '#8F5324',
          800: '#6B3E1B',
          900: '#4A2A12',
        },
        // Soft sky — info
        blue: {
          50:  '#EAF2FB',
          100: '#D5E5F6',
          200: '#B4D2EF',
          300: '#8FBBE4',
          400: '#6FA3D9',
          500: '#4E8AC9',
          600: '#3C71AE',
          700: '#2F5A8B',
          800: '#24466B',
          900: '#1C3550',
        },
        // Pastel-shifted — used by Avatar.jsx's hash-based color rotation
        violet: { 500: '#9A7FE0' },
        purple: {
          50:  '#F5F0FC',
          100: '#EAE0FA',
          200: '#D6C4F2',
          300: '#BFA3E8',
          400: '#AD8ADF',
          500: '#A97FD1',
          600: '#8F68B8',
          700: '#715296',
          900: '#3D2B54',
        },
        pink: {
          400: '#EC9DB6',
          500: '#E387A6',
          600: '#D06F8F',
        },
        teal: {
          50:  '#E9F7F5',
          500: '#55B3A8',
          700: '#357168',
        },
        // Light/dark-swapped app surfaces with no existing Tailwind-key home
        surface: {
          app:    'rgb(var(--surface-app) / <alpha-value>)',
          card:   'rgb(var(--surface-card) / <alpha-value>)',
          sunken: 'rgb(var(--surface-sunken) / <alpha-value>)',
        },
      },
      borderRadius: {
        sm:      '8px',
        DEFAULT: '10px',
        md:      '12px',
        lg:      '16px',
        xl:      '20px',
        '2xl':   '28px',
        '3xl':   '32px',
      },
      boxShadow: {
        sm:      '0 1px 2px 0 rgba(58,47,36,0.05)',
        DEFAULT: '0 2px 8px -2px rgba(58,47,36,0.07), 0 1px 3px -1px rgba(58,47,36,0.04)',
        md:      '0 6px 20px -4px rgba(58,47,36,0.10), 0 2px 6px -2px rgba(58,47,36,0.05)',
        lg:      '0 14px 36px -8px rgba(58,47,36,0.14), 0 4px 12px -4px rgba(58,47,36,0.06)',
        xl:      '0 24px 56px -12px rgba(58,47,36,0.18)',
        '2xl':   '0 32px 72px -16px rgba(58,47,36,0.22)',
      },
      keyframes: {
        pagein:   { from: { opacity: '0', transform: 'translateY(5px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slidein:  { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
        fadein:   { from: { opacity: '0' }, to: { opacity: '1' } },
        fadeout:  { from: { opacity: '1' }, to: { opacity: '0' } },
      },
      animation: {
        pagein:  'pagein 0.18s ease',
        slidein: 'slidein 0.2s ease',
        fadein:  'fadein 0.15s ease',
        fadeout: 'fadeout 0.2s ease',
      },
    },
  },
  plugins: [],
};
