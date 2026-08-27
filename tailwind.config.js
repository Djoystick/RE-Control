/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/renderer/index.html",
    "./src/renderer/overlay.html",
    "./src/renderer/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        pixel: ['"Silkscreen"', '"DotGothic16"', '"Press Start 2P"', 'cursive'],
      },
            animation: {
        'crt-flicker': 'crt-flicker 0.15s infinite',
        'arcade-blink': 'arcade-blink 1s step-end infinite',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        'crt-flicker': {
          '0%': { opacity: '0.95' },
          '50%': { opacity: '1' },
          '100%': { opacity: '0.98' },
        },
        'arcade-blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        }
      },
      colors: {
        pixel: {
          dark: '#1a1c2c',
          purple: '#5d275d',
          red: '#b13e53',
          orange: '#ef7d57',
          yellow: '#ffcd75',
          green: '#a7f070',
          darkgreen: '#38b764',
          blue: '#41a6f6',
          darkblue: '#29366f',
          light: '#f4f4f4',
          panel: 'rgba(26, 28, 44, 0.85)',
          
          // Маппинг новых переменных на старые цвета, чтобы не сломать классы, добавленные Клодом
          void: '#1a1c2c',
          surface: 'rgba(26, 28, 44, 0.95)',
          border: '#29366f',
          muted: '#29366f',
          cyan: '#41a6f6',
          amber: '#ffcd75',
          danger: '#b13e53',
          'light-dim': '#f4f4f4',
        }
      },
      boxShadow: {
        'pixel': '4px 4px 0px 0px rgba(0, 0, 0, 0.5)',
        'pixel-hover': '2px 2px 0px 0px rgba(0, 0, 0, 0.5)',
        'pixel-inner': 'inset 2px 2px 0px 0px rgba(0, 0, 0, 0.3)',
      }
    },
  },
  plugins: [],
}
