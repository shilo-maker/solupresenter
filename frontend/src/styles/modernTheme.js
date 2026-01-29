// Modern Design System for SoluCast - Dark Cyan Theme
export const colors = {
  // Primary gradient (Cyan)
  primary: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
  primarySolid: '#06b6d4',
  primaryDark: '#0891b2',

  // Success gradient (green)
  success: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  successSolid: '#10b981',

  // Danger gradient (red)
  danger: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
  dangerSolid: '#ef4444',

  // Warning gradient (amber)
  warning: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
  warningSolid: '#f59e0b',

  // Info gradient (blue)
  info: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
  infoSolid: '#3b82f6',

  // Neutrals (dark theme)
  dark: '#fafafa',
  gray: '#a1a1aa',
  lightGray: 'rgba(255, 255, 255, 0.06)',
  background: '#09090b',
  white: '#18181b',

  // Surfaces
  surface: '#18181b',
  elevated: '#27272a',
  hoverBg: '#3f3f46',

  // Text colors
  textDark: '#fafafa',
  textMedium: '#a1a1aa',
  textLight: '#71717a',
};

export const typography = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',

  // Font sizes
  xs: '0.75rem',    // 12px
  sm: '0.875rem',   // 14px
  base: '1rem',     // 16px
  lg: '1.125rem',   // 18px
  xl: '1.25rem',    // 20px
  '2xl': '1.5rem',  // 24px
  '3xl': '1.875rem',// 30px
  '4xl': '2.25rem', // 36px

  // Font weights
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
};

export const spacing = {
  xs: '0.25rem',   // 4px
  sm: '0.5rem',    // 8px
  md: '1rem',      // 16px
  lg: '1.5rem',    // 24px
  xl: '2rem',      // 32px
  '2xl': '3rem',   // 48px
  '3xl': '4rem',   // 64px
};

export const borderRadius = {
  sm: '0.25rem',   // 4px
  md: '0.5rem',    // 8px
  lg: '0.75rem',   // 12px
  xl: '1rem',      // 16px
  full: '9999px',  // Full circle
};

export const shadows = {
  sm: '0 1px 3px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2)',
  md: '0 4px 6px rgba(0, 0, 0, 0.25), 0 2px 4px rgba(0, 0, 0, 0.15)',
  lg: '0 10px 15px rgba(0, 0, 0, 0.25), 0 4px 6px rgba(0, 0, 0, 0.12)',
  xl: '0 20px 25px rgba(0, 0, 0, 0.35), 0 10px 10px rgba(0, 0, 0, 0.12)',
  inner: 'inset 0 2px 4px rgba(0, 0, 0, 0.15)',
};

// Modern button styles
export const buttonStyles = {
  primary: {
    background: colors.primary,
    color: colors.white,
    border: 'none',
    borderRadius: borderRadius.md,
    padding: `${spacing.sm} ${spacing.lg}`,
    fontSize: typography.base,
    fontWeight: typography.semibold,
    boxShadow: '0 2px 8px rgba(6, 182, 212, 0.4)',
    transition: 'all 0.2s ease',
    cursor: 'pointer',
    fontFamily: typography.fontFamily,
  },

  success: {
    background: colors.success,
    color: colors.white,
    border: 'none',
    borderRadius: borderRadius.md,
    padding: `${spacing.sm} ${spacing.lg}`,
    fontSize: typography.base,
    fontWeight: typography.semibold,
    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.4)',
    transition: 'all 0.2s ease',
    cursor: 'pointer',
    fontFamily: typography.fontFamily,
  },

  danger: {
    background: colors.danger,
    color: colors.white,
    border: 'none',
    borderRadius: borderRadius.md,
    padding: `${spacing.sm} ${spacing.lg}`,
    fontSize: typography.base,
    fontWeight: typography.semibold,
    boxShadow: '0 2px 8px rgba(239, 68, 68, 0.4)',
    transition: 'all 0.2s ease',
    cursor: 'pointer',
    fontFamily: typography.fontFamily,
  },

  outline: {
    background: 'transparent',
    color: colors.primarySolid,
    border: `2px solid ${colors.primarySolid}`,
    borderRadius: borderRadius.md,
    padding: `${spacing.sm} ${spacing.lg}`,
    fontSize: typography.base,
    fontWeight: typography.semibold,
    transition: 'all 0.2s ease',
    cursor: 'pointer',
    fontFamily: typography.fontFamily,
  },

  ghost: {
    background: 'transparent',
    color: colors.textMedium,
    border: 'none',
    borderRadius: borderRadius.md,
    padding: `${spacing.sm} ${spacing.lg}`,
    fontSize: typography.base,
    fontWeight: typography.medium,
    transition: 'all 0.2s ease',
    cursor: 'pointer',
    fontFamily: typography.fontFamily,
  },
};

// Card styles
export const cardStyles = {
  base: {
    background: colors.surface,
    borderRadius: borderRadius.lg,
    boxShadow: shadows.md,
    border: '1px solid rgba(255, 255, 255, 0.06)',
    padding: spacing.xl,
    transition: 'all 0.2s ease',
    color: colors.textDark,
  },

  hover: {
    background: colors.surface,
    borderRadius: borderRadius.lg,
    boxShadow: shadows.md,
    border: '1px solid rgba(255, 255, 255, 0.06)',
    padding: spacing.xl,
    transition: 'all 0.2s ease',
    cursor: 'pointer',
    color: colors.textDark,
    ':hover': {
      boxShadow: shadows.lg,
      transform: 'translateY(-2px)',
    },
  },
};

// Input styles
export const inputStyles = {
  base: {
    borderRadius: borderRadius.md,
    border: '1px solid rgba(255, 255, 255, 0.06)',
    background: colors.elevated,
    color: colors.textDark,
    padding: `${spacing.sm} ${spacing.md}`,
    fontSize: typography.base,
    fontFamily: typography.fontFamily,
    transition: 'all 0.2s ease',
    ':focus': {
      outline: 'none',
      borderColor: colors.primarySolid,
      boxShadow: '0 0 0 3px rgba(6, 182, 212, 0.2)',
    },
  },
};
