/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './frontend/pages//*.{js,ts,jsx,tsx}',
    './frontend/components//.{js,ts,jsx,tsx}',
    './frontend/styles/**/.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1B263B',
        secondary: '#003B5C',
        accent: '#2E8B57',
        lightBg: '#F8F9FA',
        darkBg: '#0F1115',
        lightText: '#C3D8E8',
        blueBtn: '#0077B6',
      },
    },
  },
  plugins: [],
}
