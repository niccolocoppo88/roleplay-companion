/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0f1117',
          secondary: '#161b22',
          tertiary: '#1c2128',
        },
        border: {
          primary: '#30363d',
          hover: '#484f58',
        },
        text: {
          primary: '#e6edf3',
          secondary: '#8b949e',
          muted: '#6e7681',
        },
        accent: {
          primary: '#58a6ff',
          hover: '#79b8ff',
          success: '#3fb950',
          warning: '#d29922',
          danger: '#f85149',
        },
      },
    },
  },
  plugins: [],
};