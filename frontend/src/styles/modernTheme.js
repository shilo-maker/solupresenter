// Modern Design System for SoluCast
export const colors = {
  // Primary gradient (purple-blue)
  primary: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  primarySolid: '#667eea',
  primaryDark: '#764ba2',

  // Success gradient (green)
  success: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
  successSolid: '#11998e',

  // Danger gradient (red)
  danger: 'linear-gradient(135deg, #eb3349 0%, #f45c43 100%)',
  dangerSolid: '#eb3349',

  // Warning gradient (orange)
  warning: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  warningSolid: '#f093fb',

  // Info gradient (blue)
  info: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  infoSolid: '#4facfe',

  // Neutrals
  dark: '#2d3748',
  gray: '#718096',
  lightGray: '#e2e8f0',
  background: '#f7fafc',
  white: '#ffffff',

  // Text colors
  textDark: '#1a202c',
  textMedium: '#4a5568',
  textLight: '#a0aec0',
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
  sm: '0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.08)',
  md: '0 4px 6px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px rgba(0, 0, 0, 0.15), 0 10px 10px rgba(0, 0, 0, 0.04)',
  inner: 'inset 0 2px 4px rgba(0, 0, 0, 0.06)',
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
    boxShadow: '0 2px 8px rgba(102, 126, 234, 0.4)',
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
    boxShadow: '0 2px 8px rgba(17, 153, 142, 0.4)',
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
    boxShadow: '0 2px 8px rgba(235, 51, 73, 0.4)',
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
    background: colors.white,
    borderRadius: borderRadius.lg,
    boxShadow: shadows.md,
    padding: spacing.xl,
    transition: 'all 0.2s ease',
  },

  hover: {
    background: colors.white,
    borderRadius: borderRadius.lg,
    boxShadow: shadows.md,
    padding: spacing.xl,
    transition: 'all 0.2s ease',
    cursor: 'pointer',
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
    border: `2px solid ${colors.lightGray}`,
    padding: `${spacing.sm} ${spacing.md}`,
    fontSize: typography.base,
    fontFamily: typography.fontFamily,
    transition: 'all 0.2s ease',
    ':focus': {
      outline: 'none',
      borderColor: colors.primarySolid,
      boxShadow: `0 0 0 3px rgba(102, 126, 234, 0.1)`,
    },
  },
};
