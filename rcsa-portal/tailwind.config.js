/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Futuristic light cyber theme tokens (mirrors :root in the prototype)
        cyber: {
          bg: '#F5FBFF',
          card: '#FFFFFF',
          surface: '#EEF7FF',
          surface2: '#EAF0FF',
          border: '#C7D7EA',
          borderStrong: '#9DB4D0',
          accent: '#00B8D9',
          accentSoft: '#D7F8FF',
          accent2: '#8B5CF6',
          accent2Soft: '#EFE7FF',
          success: '#16A34A',
          successSoft: '#DCFCE7',
          warning: '#D97706',
          warningSoft: '#FEF3C7',
          critical: '#DC2626',
          criticalSoft: '#FEE2E2',
          text: '#0F172A',
          muted: '#64748B',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
