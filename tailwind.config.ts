import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        sakura: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
        },
        pink: {
          pastel: '#d1d5db',
          soft: '#f3f4f6',
        },
        price: '#111827',
        muted: '#9ca3af',
        'muted-dark': '#6b7280',
        'muted-light': '#4b5563',
        body: '#f9fafb',
        'card-border': '#e5e7eb',
        'controls-bg': '#ffffff',
        'controls-border': '#e5e7eb',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'sans-serif',
        ],
      },
      boxShadow: {
        card: '0 2px 8px rgba(0, 0, 0, 0.08)',
        'card-hover': '0 6px 18px rgba(0, 0, 0, 0.15)',
        header: '0 2px 12px rgba(0, 0, 0, 0.15)',
        button: '0 3px 10px rgba(0, 0, 0, 0.20)',
      },
      backgroundImage: {
        'gradient-header': 'linear-gradient(135deg, #3b0764, #5b21b6)',
        'gradient-placeholder': 'linear-gradient(135deg, #f3f4f6, #e5e7eb)',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        fadeSlideIn: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.2s ease-in-out infinite',
        'fade-slide-in': 'fadeSlideIn 0.25s ease both',
      },
    },
  },
  plugins: [],
}

export default config

