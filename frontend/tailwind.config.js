/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts,css,scss}'],
  theme: {
    extend: {
      colors: {
        'cdp-red': '#E81647',
        'cdp-dark': '#1B232C',
        'cdp-gray': '#D9D9D9',
        'cdp-border': '#1E1E1E',
        'cdp-bg': '#F2F2F2',
        'cdp-neutral-09': '#303030',
        'cdp-neutral-08': '#333333',
        'cdp-neutral-05': '#999999',
        'cdp-neutral-04': '#AFAFAF',
        'cdp-neutral-02': '#D4D4D4',
        'cdp-neutral-01': '#E8E8E8',
        'cdp-peach': '#FFAD8F',
        'cdp-text-secondary': '#595959',
        'cdp-green': '#5FE992',
        'cdp-text-tertiary': '#757575',
        'cdp-dark-accent': '#3a3a3a',
        'cdp-light-text': '#E7E9E8',
        'cdp-blue': '#00A6FF',
        'cdp-violet': '#8B5CF6',
        'cdp-green-implementation': '#4CAF50',
      },
      fontFamily: {
        'roboto-mono': ['Roboto Mono', 'monospace'],
        inter: ['Inter', 'sans-serif'],
        roboto: ['Roboto', 'sans-serif'],
      },
      boxShadow: {
        'cdp-card': '0px 1px 3px 1px rgba(0,0,0,0.15), 0px 1px 2px 0px rgba(0,0,0,0.30)',
      },
      spacing: {
        100: '25rem', // 400px
        120: '30rem', // 480px
        200: '50rem', // 800px
        300: '75rem', // 1200px
      },
      fontSize: {
        xxs: '0.625rem', // 10px
      },
      letterSpacing: {
        'cdp-tight': '0.1px',
        'cdp-medium': '0.15px',
        'cdp-wide': '0.25px',
        'cdp-wider': '0.4px',
        'cdp-widest': '0.5px',
        'cdp-eyebrow': '0.28em',
      },
      zIndex: {
        2000: '2000',
      },
    },
  },
  plugins: [],
};
