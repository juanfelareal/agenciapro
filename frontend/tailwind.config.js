/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ===== DESIGN SYSTEM 2026 — Papel + Tinta · acento verde =====
        // Tokens de landing.larealmarketing.com (fuente de verdad).
        // Los nombres anteriores (surface/dark/carbon/lime/ink/cream…) se conservan
        // para no tocar cientos de archivos; solo cambian los valores.

        // `white` pasa a ser el blanco papel de la landing: superficie de tarjetas
        // (bg-white) y texto sobre oscuro (text-white = --on-dark). El blanco puro
        // sigue disponible como #FFFFFF para inputs/modales si hace falta.
        white: '#FBFAF8',

        // Neutros cálidos derivados de la tinta (reemplazan al gray frío de Tailwind)
        gray: {
          50: '#F6F5F2',
          100: '#F0EEE9',
          200: '#E8E5DF',
          300: '#C9C6C0',
          400: '#9A9792',
          500: '#7A7772',
          600: '#5C5955',
          700: '#4A4844',
          800: '#3A3A3A',
          900: '#121212',
          950: '#0B0B0B',
        },

        // Superficies
        surface: '#F3F1ED',   // fondo papel de la app
        card: '#FBFAF8',      // superficie de tarjetas
        dark: '#121314',      // tinta (sidebar activo, botones primarios, tarjetas dark)
        carbon: {
          DEFAULT: '#121314',
          hover: '#1C1D1F',
        },

        // Acento verde (el nombre `lime` se conserva por compatibilidad de clases)
        lime: {
          400: '#44BF47',   // acento: fondos, iconos sobre oscuro
          500: '#1E7A30',   // verde profundo para texto sobre claro
          600: '#166A28',
        },

        // Semantic colors for financials
        income: '#10B981',
        expense: '#F97316',

        // Text colors
        'text-primary': '#121212',
        'text-secondary': '#7A7772',

        // Primary (tinta para botones) — escala heredada
        primary: {
          50: '#F6F5F2',
          100: '#F0EEE9',
          200: '#E8E5DF',
          300: '#C9C6C0',
          400: '#9A9792',
          500: '#121314',
          600: '#1C1D1F',
          700: '#0D0D0D',
          800: '#080808',
          900: '#000000',
        },
        // Papel
        cream: {
          50: '#FBFAF8',
          100: '#F6F5F2',
          200: '#F3F1ED',
          300: '#ECEAE5',
        },
        // Tinta
        ink: {
          900: '#121212',
          800: '#3A3A3A',
          700: '#4A4844',
          600: '#5C5955',
          500: '#7A7772',
          400: '#9A9792',
          300: '#C9C6C0',
          200: '#E8E5DF',
          100: '#F0EEE9',
          50: '#F6F5F2',
        },
        // Verde de marca (acento)
        accent: {
          DEFAULT: '#44BF47',
          50: '#EEF8EE',
          100: '#DCF1DD',
          200: '#B9E3BA',
          300: '#8ED492',
          400: '#44BF47',
          500: '#44BF47',
          600: '#1E7A30',
          700: '#166A28',
        },
        // `green` semántico alineado al acento (green-600 era exactamente #16a34a)
        green: {
          500: '#44BF47',
          600: '#1E7A30',
          700: '#166A28',
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
          500: '#44BF47',
          600: '#1E7A30',
          700: '#166A28',
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
        sans: ['Inter Tight', 'Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
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
        'xl': '12px',
        '2xl': '16px',
        '3xl': '22px',   // lg de la landing
        '4xl': '32px',   // xl de la landing
      },
      boxShadow: {
        // Superficies papel: sombra casi inexistente, la línea hairline hace el trabajo
        'glass': '0 1px 2px rgba(18, 18, 18, 0.03), 0 1px 0 rgba(18, 18, 18, 0.02)',
        'glass-lg': '0 4px 12px rgba(18, 18, 18, 0.05), 0 12px 32px rgba(18, 18, 18, 0.04)',
        'elevated': '0 1px 2px rgba(18, 18, 18, 0.04), 0 4px 12px rgba(18, 18, 18, 0.04)',
        'bento': '0 2px 8px rgba(18, 18, 18, 0.04), 0 8px 24px rgba(18, 18, 18, 0.05)',
        'glow-lime': '0 0 0 3px rgba(68, 191, 71, 0.18)',
        // Legacy shadows (kept for compatibility)
        'soft': '0 1px 2px rgba(18, 18, 18, 0.03), 0 4px 12px rgba(18, 18, 18, 0.03)',
        'medium': '0 4px 12px -2px rgba(18, 18, 18, 0.06), 0 8px 24px -4px rgba(18, 18, 18, 0.04)',
        'large': '0 8px 24px -4px rgba(18, 18, 18, 0.10), 0 16px 48px -8px rgba(18, 18, 18, 0.08)',
        'card': '0 1px 2px rgba(18, 18, 18, 0.03), 0 1px 0 rgba(18, 18, 18, 0.02)',
        'card-hover': '0 4px 12px rgba(18, 18, 18, 0.06), 0 12px 32px rgba(18, 18, 18, 0.04)',
        'glow': '0 0 40px rgba(68, 191, 71, 0.15)',
        'button': '0 1px 2px rgba(18, 19, 20, 0.18)',
        'sidebar': '4px 0 24px -4px rgba(18, 18, 18, 0.04)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        // Sin degradados: los nombres se conservan pero resuelven a papel plano
        'hero-gradient': 'linear-gradient(#F3F1ED, #F3F1ED)',
        'card-glow': 'linear-gradient(#FBFAF8, #FBFAF8)',
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
          '0%, 100%': { boxShadow: '0 0 20px rgba(68, 191, 71, 0.1)' },
          '50%': { boxShadow: '0 0 40px rgba(68, 191, 71, 0.2)' },
        },
      },
    },
  },
  plugins: [],
}
