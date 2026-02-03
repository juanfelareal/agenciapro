/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ===== NEW DESIGN SYSTEM - Lime/Dark =====
        // Surface colors
        surface: '#F8F9FA',
        card: '#FFFFFF',
        dark: '#1A1A2E',

        // Lime accent
        lime: {
          400: '#BFFF00',
          500: '#A3E635',
          600: '#65A30D',
        },

        // Semantic colors for financials
        income: '#10B981',
        expense: '#F97316',

        // Text colors
        'text-primary': '#1A1A2E',
        'text-secondary': '#6B7280',

        // ===== LEGACY (to be removed in FASE 9) =====
        // Primary color (dark ink for buttons)
        primary: {
          50: '#F5F5F5',
          100: '#E8E8E8',
          200: '#D4D4D4',
          300: '#B3B3B3',
          400: '#8A8A8A',
          500: '#1A1A1A',
          600: '#141414',
          700: '#0D0D0D',
          800: '#080808',
          900: '#000000',
        },
        // Warm cream base (Granola-inspired) - DEPRECATED
        cream: {
          50: '#FFFDF9',
          100: '#FBF8F3',
          200: '#F5F0E8',
          300: '#EDE5D8',
        },
        // Rich ink for text - DEPRECATED
        ink: {
          900: '#1A1A1A',
          800: '#2D2D2D',
          700: '#404040',
          600: '#525252',
          500: '#6B6B6B',
          400: '#8A8A8A',
          300: '#B3B3B3',
          200: '#D4D4D4',
          100: '#E8E8E8',
        },
        // Accent green (Granola signature)
        accent: {
          DEFAULT: '#22C55E',
          50: '#F0FDF4',
          100: '#DCFCE7',
          200: '#BBF7D0',
          300: '#86EFAC',
          400: '#4ADE80',
          500: '#22C55E',
          600: '#16A34A',
          700: '#15803D',
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
          500: '#22C55E',
          600: '#16A34A',
          700: '#15803D',
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
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      fontSize: {
        // Granola-inspired typography with tight tracking
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
        '3xl': '20px',
        '4xl': '24px',
      },
      boxShadow: {
        // New design system shadows
        'elevated': '0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.05)',
        'bento': '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)',
        'glow-lime': '0 0 20px rgba(191, 255, 0, 0.3)',
        // Legacy shadows (kept for compatibility)
        'soft': '0 2px 8px -2px rgba(0, 0, 0, 0.04), 0 4px 12px -4px rgba(0, 0, 0, 0.03)',
        'medium': '0 4px 12px -2px rgba(0, 0, 0, 0.06), 0 8px 24px -4px rgba(0, 0, 0, 0.04)',
        'large': '0 8px 24px -4px rgba(0, 0, 0, 0.08), 0 16px 48px -8px rgba(0, 0, 0, 0.06)',
        'card': '0 1px 3px rgba(0, 0, 0, 0.02), 0 4px 16px rgba(0, 0, 0, 0.03)',
        'card-hover': '0 4px 12px rgba(0, 0, 0, 0.06), 0 12px 32px rgba(0, 0, 0, 0.04)',
        'glow': '0 0 40px rgba(34, 197, 94, 0.15)',
        'button': '0 2px 8px rgba(26, 26, 26, 0.15)',
        'sidebar': '4px 0 24px -4px rgba(0, 0, 0, 0.04)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'hero-gradient': 'radial-gradient(at 50% 0%, rgba(253, 251, 246, 0.8) 0%, transparent 50%), radial-gradient(at 80% 50%, rgba(220, 252, 231, 0.4) 0%, transparent 40%), radial-gradient(at 20% 80%, rgba(254, 243, 199, 0.3) 0%, transparent 50%)',
        'card-glow': 'radial-gradient(ellipse at center, rgba(34, 197, 94, 0.08) 0%, transparent 70%)',
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
          '0%, 100%': { boxShadow: '0 0 20px rgba(34, 197, 94, 0.1)' },
          '50%': { boxShadow: '0 0 40px rgba(34, 197, 94, 0.2)' },
        },
      },
    },
  },
  plugins: [],
}
