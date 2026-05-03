import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        // Light Minimal
        bg:           'rgb(var(--bg) / <alpha-value>)',
        surface:      'rgb(var(--surface) / <alpha-value>)',
        'surface-muted': 'rgb(var(--surface-muted) / <alpha-value>)',
        ink:          'rgb(var(--ink) / <alpha-value>)',
        'ink-muted':  'rgb(var(--ink-muted) / <alpha-value>)',
        'ink-subtle': 'rgb(var(--ink-subtle) / <alpha-value>)',
        accent:       'rgb(var(--accent) / <alpha-value>)',
        'accent-ink': 'rgb(var(--accent-ink) / <alpha-value>)',
        success:      'rgb(var(--success) / <alpha-value>)',
        'success-bg': 'rgb(var(--success-bg) / <alpha-value>)',
        'success-ink':'rgb(var(--success-ink) / <alpha-value>)',
        warn:         'rgb(var(--warn) / <alpha-value>)',
        'warn-bg':    'rgb(var(--warn-bg) / <alpha-value>)',
        pr:           'rgb(var(--pr) / <alpha-value>)',
        'pr-bg':      'rgb(var(--pr-bg) / <alpha-value>)',
        danger:       'rgb(var(--danger) / <alpha-value>)',
        'danger-bg':  'rgb(var(--danger-bg) / <alpha-value>)',
        border:       'rgb(var(--border) / <alpha-value>)',
        'border-strong': 'rgb(var(--border-strong) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SF Mono', 'Menlo', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '16px',
        sm: '10px',
        lg: '22px',
      },
      boxShadow: {
        card:     '0 1px 0 rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)',
        'card-dark': '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px rgba(0,0,0,0.35)',
      },
      keyframes: {
        'ws-pulse': {
          '0%':   { transform: 'scale(1)',   opacity: '0.35' },
          '100%': { transform: 'scale(2.2)', opacity: '0' },
        },
        'ws-blink': {
          '50%': { opacity: '0' },
        },
      },
      animation: {
        'ws-pulse': 'ws-pulse 1.6s ease-out infinite',
        'ws-blink': 'ws-blink 1s steps(2, start) infinite',
      },
    },
  },
  plugins: [animate],
} satisfies Config;
