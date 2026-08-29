/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },

      /* ----------------------------------------------------------
         TYPOGRAPHY — Fixed scale
         Weights: 400 (body), 500 (labels), 600 (headings/values).
         ---------------------------------------------------------- */
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
        xs:    ['0.75rem',   { lineHeight: '1rem' }],
        sm:    ['0.8125rem', { lineHeight: '1.25rem' }],
        base:  ['0.875rem',  { lineHeight: '1.5rem' }],
        lg:    ['1rem',      { lineHeight: '1.5rem' }],
        xl:    ['1.25rem',   { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem',    { lineHeight: '2rem' }],
        '3xl': ['2rem',      { lineHeight: '2.25rem' }],
      },

      /* ----------------------------------------------------------
         COLORS — Semantic tokens via CSS vars
         Light theme (client) in :root, dark theme (admin) in .dark-admin.
         Primary brand scale uses CSS vars for runtime rebranding.
         ---------------------------------------------------------- */
      colors: {
        /* Semantic surface/text tokens — adapt to theme context */
        page:    'var(--c-page)',
        surface: 'var(--c-surface)',
        raised:  'var(--c-raised)',
        line:    'var(--c-line)',
        strong:  'var(--c-strong)',
        mid:     'var(--c-mid)',
        dim:     'var(--c-dim)',
        accent:  'var(--c-accent)',

        /* Brand primary — runtime-replaceable via CSS vars */
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

        /* State colors — identical in light/dark */
        success: {
          50: '#f0fdf4', 100: '#dcfce7', 200: '#bbf7d0',
          300: '#86efac', 400: '#4ade80', 500: '#22c55e',
          600: '#16a34a', 700: '#15803d', 800: '#166534', 900: '#14532d',
        },
        warning: {
          50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a',
          300: '#fcd34d', 400: '#fbbf24', 500: '#f59e0b',
          600: '#d97706', 700: '#b45309', 800: '#92400e', 900: '#78350f',
        },
        error: {
          50: '#fef2f2', 100: '#fee2e2', 200: '#fecaca',
          300: '#fca5a5', 400: '#f87171', 500: '#ef4444',
          600: '#dc2626', 700: '#b91c1c', 800: '#991b1b', 900: '#7f1d1d',
        },
      },

      /* ----------------------------------------------------------
         BORDER RADIUS — 4 levels, max 8px
         sm:   4px  — inputs, small buttons, badges/status
         md:   6px  — cards, standard buttons, dropdowns
         lg:   8px  — modals, drawers (MAXIMUM)
         full: 9999 — avatars/images ONLY
         ---------------------------------------------------------- */
      borderRadius: {
        sm: '4px',
        md: '6px',
        lg: '8px',
        full: '9999px',
      },

      /* ----------------------------------------------------------
         SHADOWS — Minimal. Cards use border only.
         elevated: modals/drawers ONLY.
         ---------------------------------------------------------- */
      boxShadow: {
        elevated: '0 8px 24px -4px rgba(0, 0, 0, 0.12)',
      },

      /* ----------------------------------------------------------
         TRANSITIONS
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
          '0%':   { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'flash': {
          '0%':   { opacity: '1', boxShadow: '0 0 0 0 rgba(59, 130, 246, 0.4)' },
          '70%':  { opacity: '1', boxShadow: '0 0 0 6px rgba(59, 130, 246, 0)' },
          '100%': { opacity: '1', boxShadow: '0 0 0 0 rgba(59, 130, 246, 0)' },
        },
      },

      animation: {
        'fade-in':    'fade-in 150ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        'slide-up':   'slide-up 150ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        'flash':      'flash 2s ease-out forwards',
      },
    },
  },
  plugins: [],
};
