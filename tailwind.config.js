/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },

      /* ----------------------------------------------------------
         TYPOGRAPHY SCALE
         Fixed sizes — use these, not arbitrary values.
         Weights: 400 (body), 500 (labels), 600 (headings/buttons).
         ---------------------------------------------------------- */
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],   // 11px
        xs:    ['0.75rem',   { lineHeight: '1rem' }],    // 12px
        sm:    ['0.8125rem', { lineHeight: '1.25rem' }],  // 13px
        base:  ['0.875rem',  { lineHeight: '1.5rem' }],   // 14px
        lg:    ['1rem',      { lineHeight: '1.5rem' }],   // 16px
        xl:    ['1.25rem',   { lineHeight: '1.75rem' }],  // 20px
        '2xl': ['1.5rem',    { lineHeight: '2rem' }],     // 24px
        '3xl': ['2rem',      { lineHeight: '2.25rem' }],  // 32px
      },

      /* ----------------------------------------------------------
         COLORS — brand ramps + state colors
         Primary/secondary use CSS vars for runtime rebranding.
         ---------------------------------------------------------- */
      colors: {
        primary: {
          50:  'rgb(var(--cor-primaria-50) / <alpha-value>)',
          100: 'rgb(var(--cor-primaria-100) / <alpha-value>)',
          200: 'rgb(var(--cor-primaria-200) / <alpha-value>)',
          300: 'rgb(var(--cor-primaria-300) / <alpha-value>)',
          400: 'rgb(var(--cor-primaria-400) / <alpha-value>)',
          500: 'rgb(var(--cor-primaria-500) / <alpha-value>)',
          600: 'rgb(var(--cor-primaria-600) / <alpha-value>)',
          700: 'rgb(var(--cor-primaria-700) / <alpha-value>)',
          800: 'rgb(var(--cor-primaria-800) / <alpha-value>)',
          900: 'rgb(var(--cor-primaria-900) / <alpha-value>)',
        },
        secondary: {
          50:  'rgb(var(--cor-secundaria-50) / <alpha-value>)',
          100: 'rgb(var(--cor-secundaria-100) / <alpha-value>)',
          200: 'rgb(var(--cor-secundaria-200) / <alpha-value>)',
          300: 'rgb(var(--cor-secundaria-300) / <alpha-value>)',
          400: 'rgb(var(--cor-secundaria-400) / <alpha-value>)',
          500: 'rgb(var(--cor-secundaria-500) / <alpha-value>)',
          600: 'rgb(var(--cor-secundaria-600) / <alpha-value>)',
          700: 'rgb(var(--cor-secundaria-700) / <alpha-value>)',
          800: 'rgb(var(--cor-secundaria-800) / <alpha-value>)',
          900: 'rgb(var(--cor-secundaria-900) / <alpha-value>)',
        },
        success: {
          50:  '#f0fdf4', 100: '#dcfce7', 200: '#bbf7d0',
          300: '#86efac', 400: '#4ade80', 500: '#22c55e',
          600: '#16a34a', 700: '#15803d', 800: '#166534', 900: '#14532d',
        },
        warning: {
          50:  '#fffbeb', 100: '#fef3c7', 200: '#fde68a',
          300: '#fcd34d', 400: '#fbbf24', 500: '#f59e0b',
          600: '#d97706', 700: '#b45309', 800: '#92400e', 900: '#78350f',
        },
        error: {
          50:  '#fef2f2', 100: '#fee2e2', 200: '#fecaca',
          300: '#fca5a5', 400: '#f87171', 500: '#ef4444',
          600: '#dc2626', 700: '#b91c1c', 800: '#991b1b', 900: '#7f1d1d',
        },
      },

      /* ----------------------------------------------------------
         BORDER RADIUS — 3 levels only
         card:   cards, buttons, inputs   (12px)
         modal:  modals, drawers, toasts   (16px)
         pill:   badges, avatars, chips    (9999px)
         ---------------------------------------------------------- */
      borderRadius: {
        card: '12px',
        modal: '16px',
        pill: '9999px',
      },

      /* ----------------------------------------------------------
         SHADOWS — 2 levels only
         card:    subtle lift for cards/lists
         elevated: modals, dropdowns, drawers
         ---------------------------------------------------------- */
      boxShadow: {
        soft:     '0 1px 2px rgb(0 0 0 / 0.04)',
        card:     '0 1px 3px rgb(0 0 0 / 0.06), 0 1px 2px rgb(0 0 0 / 0.04)',
        elevated: '0 8px 24px -4px rgb(0 0 0 / 0.10), 0 4px 8px -2px rgb(0 0 0 / 0.06)',
      },

      /* ----------------------------------------------------------
         TRANSITIONS — consistent easing
         ---------------------------------------------------------- */
      transitionTimingFunction: {
        standard: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      },

      keyframes: {
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'flash': {
          '0%':   { opacity: '1', boxShadow: '0 0 0 0 rgb(var(--cor-primaria-400) / 0.4)' },
          '70%':  { opacity: '1', boxShadow: '0 0 0 8px rgb(var(--cor-primaria-400) / 0)' },
          '100%': { opacity: '1', boxShadow: '0 0 0 0 rgb(var(--cor-primaria-400) / 0)' },
        },
      },

      animation: {
        'fade-in':    'fade-in 150ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        'slide-up':   'slide-up 200ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        'flash':      'flash 2s ease-out forwards',
      },
    },
  },
  plugins: [],
};
