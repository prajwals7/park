/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        park: {
          50: '#f2f9f5',
          100: '#e1f2e8',
          200: '#c5e4d2',
          300: '#9bcfb3',
          400: '#69b48e',
          500: '#43976f',
          600: '#2f7a56',
          700: '#235f43',
          800: '#1b4a35',
          900: '#0f392b', // Deep Park Green Primary
          950: '#08231a',
        },
        warmAmber: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706', // Warm Amber Accent
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Figtree', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
