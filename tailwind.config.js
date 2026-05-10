/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0f1117',
          secondary: '#141720',
          tertiary: '#1C2030',
        },
        border: {
          primary: '#2A2F3D',
          hover: '#484f58',
        },
        text: {
          primary: '#E8E9ED',
          secondary: '#9CA3AF',
          muted: '#6B7280',
        },
        accent: {
          primary: '#4A9EFF',
          hover: '#79B8FF',
          success: '#3DD68C',
          warning: '#FFB547',
          danger: '#FF6B6B',
          gold: '#FFD700',
          purple: '#A78BFA',
        },
      },
    },
  },
  plugins: [],
};