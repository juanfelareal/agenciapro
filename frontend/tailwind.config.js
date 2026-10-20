/** @type {import('tailwindcss').Config} */

// ===== DESIGN SYSTEM 2026 — Papel + Tinta · acento verde =====
// Tokens de landing.larealmarketing.com (fuente de verdad), expuestos como
// variables CSS (src/index.css) para que cada organización pueda personalizar
// acento, tema, radios y fuente en vivo (src/branding/applyBranding.js).
// Los nombres anteriores (surface/dark/carbon/lime/ink/cream…) se conservan.

const rgb = (name) => `rgb(var(--${name}-rgb) / <alpha-value>)`;
const gray = (n) => rgb(`gray-${n}`);
// Tintes del acento sobre la superficie (en tema oscuro salen oscuros solos)
const tint = (pct) => `color-mix(in srgb, var(--accent) ${pct}%, var(--surface))`;

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // `white` = texto/anillos claros sobre oscuro en todos los temas. Los fondos
        // `bg-white` se reescribieron a `bg-[var(--surface)]` para que el tema oscuro funcione.
        white: rgb('white'),

        // Neutros cálidos derivados de la tinta (se invierten en tema oscuro)
        gray: {
          50: gray(50), 100: gray(100), 200: gray(200), 300: gray(300), 400: gray(400),
          500: gray(500), 600: gray(600), 700: gray(700), 800: gray(800), 900: gray(900), 950: gray(950),
        },

        // Superficies
        surface: rgb('bg'),       // fondo papel de la app
        card: rgb('surface'),     // superficie de tarjetas
        dark: rgb('dark'),        // tinta (sidebar activo, botones primarios, tarjetas dark)
        carbon: {
          DEFAULT: rgb('dark'),
          hover: 'var(--dark-hover)',
        },

        // Acento (el nombre `lime` se conserva por compatibilidad de clases)
        lime: {
          400: rgb('accent'),        // acento: fondos, iconos sobre oscuro
          500: rgb('accent-deep'),   // verde profundo para texto sobre claro
          600: rgb('accent-deep'),
        },

        // Semantic colors for financials
        income: '#10B981',
        expense: '#F97316',

        // Text colors
        'text-primary': 'var(--text)',
        'text-secondary': 'var(--text-muted)',

        // Primary (tinta para botones) — escala heredada
        primary: {
          50: gray(50), 100: gray(100), 200: gray(200), 300: gray(300), 400: gray(400),
          500: rgb('dark'),
          600: 'var(--dark-hover)',
          700: '#0D0D0D',
          800: '#080808',
          900: '#000000',
        },
        // Papel
        cream: {
          50: rgb('surface'),
          100: gray(50),
          200: rgb('bg'),
          300: gray(200),
        },
        // Tinta
        ink: {
          900: gray(900), 800: gray(800), 700: gray(700), 600: gray(600), 500: gray(500),
          400: gray(400), 300: gray(300), 200: gray(200), 100: gray(100), 50: gray(50),
        },
        // Acento de marca
        accent: {
          DEFAULT: rgb('accent'),
          50: tint(8),
          100: tint(15),
          200: tint(30),
          300: tint(50),
          400: rgb('accent'),
          500: rgb('accent'),
          600: rgb('accent-deep'),
          700: rgb('accent-deep'),
        },
        // `green` semántico alineado al acento
        green: {
          500: rgb('accent'),
          600: rgb('accent-deep'),
          700: rgb('accent-deep'),
        },
        // Secondary accents
        amber: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          500: '#F59E0B',
          600: '#D97706',
        },
        rose: {
          50: '#FFF1F2',
          100: '#FFE4E6',
          500: '#F43F5E',
          600: '#E11D48',
        },
        violet: {
          50: '#F5F3FF',
          100: '#EDE9FE',
          500: '#8B5CF6',
          600: '#7C3AED',
        },
        // Keep semantic colors
        success: {
          50: '#F0FDF4',
          100: '#DCFCE7',
          500: rgb('accent'),
          600: rgb('accent-deep'),
          700: rgb('accent-deep'),
        },
        warning: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          500: '#F59E0B',
          600: '#D97706',
        },
        error: {
          50: '#FEF2F2',
          100: '#FEE2E2',
          500: '#EF4444',
          600: '#DC2626',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Inter Tight', 'Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      fontSize: {
        // Editorial typography with tight tracking
        'display': ['3.5rem', { lineHeight: '1.0', fontWeight: '600', letterSpacing: '-0.03em' }],
        'h1': ['2.25rem', { lineHeight: '1.1', fontWeight: '600', letterSpacing: '-0.025em' }],
        'h2': ['1.5rem', { lineHeight: '1.2', fontWeight: '600', letterSpacing: '-0.02em' }],
        'h3': ['1.125rem', { lineHeight: '1.3', fontWeight: '500', letterSpacing: '-0.015em' }],
        'body': ['0.9375rem', { lineHeight: '1.6', fontWeight: '400' }],
        'small': ['0.8125rem', { lineHeight: '1.5', fontWeight: '400' }],
        'tiny': ['0.75rem', { lineHeight: '1.4', fontWeight: '400' }],
      },
      letterSpacing: {
        'tighter': '-0.03em',
        'tight': '-0.02em',
        'snug': '-0.01em',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      borderRadius: {
        // Preset "soft" (12/16/20/24) o "round" (16/22/28/32) según la marca
        'xl': 'var(--radius-md)',
        '2xl': 'var(--radius-lg)',
        '3xl': 'var(--radius-xl)',
        '4xl': 'var(--radius-2xl)',
      },
      boxShadow: {
        // Superficies papel: sombra casi inexistente, la línea hairline hace el trabajo
        'glass': '0 1px 2px rgba(18, 18, 18, 0.03), 0 1px 0 rgba(18, 18, 18, 0.02)',
        'glass-lg': '0 4px 12px rgba(18, 18, 18, 0.05), 0 12px 32px rgba(18, 18, 18, 0.04)',
        'elevated': '0 1px 2px rgba(18, 18, 18, 0.04), 0 4px 12px rgba(18, 18, 18, 0.04)',
        'bento': '0 2px 8px rgba(18, 18, 18, 0.04), 0 8px 24px rgba(18, 18, 18, 0.05)',
        'glow-lime': '0 0 0 3px rgb(var(--accent-rgb) / 0.18)',
        // Legacy shadows (kept for compatibility)
        'soft': '0 1px 2px rgba(18, 18, 18, 0.03), 0 4px 12px rgba(18, 18, 18, 0.03)',
        'medium': '0 4px 12px -2px rgba(18, 18, 18, 0.06), 0 8px 24px -4px rgba(18, 18, 18, 0.04)',
        'large': '0 8px 24px -4px rgba(18, 18, 18, 0.10), 0 16px 48px -8px rgba(18, 18, 18, 0.08)',
        'card': '0 1px 2px rgba(18, 18, 18, 0.03), 0 1px 0 rgba(18, 18, 18, 0.02)',
        'card-hover': '0 4px 12px rgba(18, 18, 18, 0.06), 0 12px 32px rgba(18, 18, 18, 0.04)',
        'glow': '0 0 40px rgb(var(--accent-rgb) / 0.15)',
        'button': '0 1px 2px rgba(18, 19, 20, 0.18)',
        'sidebar': '4px 0 24px -4px rgba(18, 18, 18, 0.04)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        // Sin degradados: los nombres se conservan pero resuelven a papel plano
        'hero-gradient': 'linear-gradient(var(--bg), var(--bg))',
        'card-glow': 'linear-gradient(var(--surface), var(--surface))',
      },
      backdropBlur: {
        'xs': '2px',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 20px rgb(var(--accent-rgb) / 0.1)' },
          '50%': { boxShadow: '0 0 40px rgb(var(--accent-rgb) / 0.2)' },
        },
      },
    },
  },
  plugins: [],
}
