import { CSSProperties } from 'react';

// Modern Cyan/Teal Design System
// Matching the updated index.css theme

// Color palette
export const colors = {
  // Primary Accent - Cyan/Teal
  primary: {
    main: '#06b6d4',
    light: '#22d3ee',
    dark: '#0891b2',
    glow: 'rgba(6, 182, 212, 0.4)',
  },

  // Secondary Accent - Violet
  secondary: {
    main: '#8b5cf6',
    light: '#a78bfa',
  },

  // Semantic Colors
  success: {
    main: '#10b981',
    light: '#34d399',
  },
  danger: {
    main: '#ef4444',
    light: '#f87171',
  },
  warning: {
    main: '#f59e0b',
    light: '#fbbf24',
  },
  info: {
    main: '#3b82f6',
    light: '#60a5fa',
  },

  // Backgrounds - Zinc-based neutral palette
  background: {
    base: '#09090b',
    elevated: '#18181b',
    surface: '#27272a',
    hover: '#3f3f46',
    active: '#52525b',
    card: 'rgba(39, 39, 42, 0.8)',
    cardHover: 'rgba(63, 63, 70, 0.9)',
    dropdown: 'rgba(24, 24, 27, 0.98)',
    input: '#27272a',
  },

  // Glass effects
  glass: {
    bg: 'rgba(24, 24, 27, 0.8)',
    bgLight: 'rgba(39, 39, 42, 0.6)',
    border: 'rgba(255, 255, 255, 0.06)',
    borderHover: 'rgba(255, 255, 255, 0.1)',
    hover: 'rgba(255, 255, 255, 0.04)',
  },

  // Button gradients
  button: {
    primary: 'linear-gradient(135deg, #06b6d4, #0891b2)',
    primaryHover: 'linear-gradient(135deg, #22d3ee, #06b6d4)',
    success: 'linear-gradient(135deg, #10b981, #34d399)',
    danger: 'linear-gradient(135deg, #ef4444, #f87171)',
    secondary: '#27272a',
    ghost: 'transparent',
    info: 'linear-gradient(135deg, #3b82f6, #60a5fa)',
    accent: '#06b6d4',
  },

  // Borders
  border: {
    light: 'rgba(255, 255, 255, 0.06)',
    medium: 'rgba(255, 255, 255, 0.1)',
    accent: 'rgba(6, 182, 212, 0.3)',
    accentStrong: 'rgba(6, 182, 212, 0.5)',
  },

  // Text
  text: {
    primary: '#fafafa',
    secondary: '#a1a1aa',
    muted: '#71717a',
    disabled: '#52525b',
  },

  // Item type colors (for setlist items)
  itemTypes: {
    song: { bg: 'rgba(6, 182, 212, 0.12)', border: 'rgba(6, 182, 212, 0.25)', text: '#22d3ee' },
    media: { bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.25)', text: '#34d399' },
    youtube: { bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.25)', text: '#f87171' },
    bible: { bg: 'rgba(139, 92, 246, 0.12)', border: 'rgba(139, 92, 246, 0.25)', text: '#a78bfa' },
    presentation: { bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.25)', text: '#fbbf24' },
    tool: { bg: 'rgba(63, 63, 70, 0.5)', border: 'rgba(255, 255, 255, 0.1)', text: '#a1a1aa' },
  },
};

// Shadows
export const shadows = {
  xs: '0 1px 2px rgba(0, 0, 0, 0.3)',
  sm: '0 2px 4px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2)',
  md: '0 4px 12px rgba(0, 0, 0, 0.4), 0 2px 4px rgba(0, 0, 0, 0.2)',
  lg: '0 8px 24px rgba(0, 0, 0, 0.5), 0 4px 8px rgba(0, 0, 0, 0.3)',
  xl: '0 16px 48px rgba(0, 0, 0, 0.6), 0 8px 16px rgba(0, 0, 0, 0.4)',
  glow: '0 0 20px rgba(6, 182, 212, 0.4), 0 0 40px rgba(6, 182, 212, 0.2)',
  glowSm: '0 0 10px rgba(6, 182, 212, 0.4)',
};

// Border radius
export const radius = {
  xs: '4px',
  sm: '6px',
  md: '10px',
  lg: '14px',
  xl: '20px',
  '2xl': '24px',
  full: '9999px',
};

// Spacing
export const spacing = {
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
};

// Transitions
export const transitions = {
  fast: '0.1s cubic-bezier(0.4, 0, 0.2, 1)',
  base: '0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  slow: '0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  spring: '0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
};

// Common button styles
export const buttonStyles = {
  base: {
    border: 'none',
    borderRadius: radius.md,
    padding: `${spacing[2]} ${spacing[4]}`,
    color: colors.text.primary,
    cursor: 'pointer',
    fontSize: '0.8125rem',
    fontWeight: 600,
    fontFamily: 'inherit',
    transition: `all ${transitions.base}`,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    whiteSpace: 'nowrap' as const,
  } as CSSProperties,

  primary: {
    background: colors.button.primary,
    color: colors.background.base,
    boxShadow: `${shadows.sm}, inset 0 1px 0 rgba(255, 255, 255, 0.1)`,
  } as CSSProperties,

  primaryHover: {
    background: colors.button.primaryHover,
    boxShadow: `${shadows.md}, ${shadows.glowSm}`,
    transform: 'translateY(-1px)',
  } as CSSProperties,

  secondary: {
    background: colors.background.surface,
    border: `1px solid ${colors.glass.border}`,
  } as CSSProperties,

  secondaryHover: {
    background: colors.background.hover,
    borderColor: colors.glass.borderHover,
    transform: 'translateY(-1px)',
  } as CSSProperties,

  ghost: {
    background: 'transparent',
    color: colors.text.secondary,
  } as CSSProperties,

  ghostHover: {
    background: colors.glass.hover,
    color: colors.text.primary,
  } as CSSProperties,

  success: {
    background: colors.button.success,
    color: 'white',
    boxShadow: shadows.sm,
  } as CSSProperties,

  danger: {
    background: colors.button.danger,
    color: 'white',
    boxShadow: shadows.sm,
  } as CSSProperties,

  icon: {
    width: '36px',
    height: '36px',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  } as CSSProperties,

  iconSm: {
    width: '28px',
    height: '28px',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  } as CSSProperties,

  small: {
    padding: `${spacing[1]} ${spacing[3]}`,
    fontSize: '0.75rem',
    borderRadius: radius.sm,
  } as CSSProperties,

  large: {
    padding: `${spacing[3]} ${spacing[6]}`,
    fontSize: '0.9375rem',
  } as CSSProperties,
};

// Common input styles
export const inputStyles = {
  base: {
    width: '100%',
    background: colors.background.surface,
    border: `1px solid ${colors.glass.border}`,
    borderRadius: radius.md,
    padding: `${spacing[3]} ${spacing[4]}`,
    color: colors.text.primary,
    fontSize: '0.875rem',
    fontFamily: 'inherit',
    outline: 'none',
    transition: `all ${transitions.base}`,
  } as CSSProperties,

  hover: {
    borderColor: colors.glass.borderHover,
  } as CSSProperties,

  focus: {
    borderColor: colors.primary.main,
    background: colors.background.hover,
    boxShadow: '0 0 0 3px rgba(6, 182, 212, 0.1)',
  } as CSSProperties,

  withIcon: (isRTL: boolean) => ({
    paddingLeft: isRTL ? spacing[4] : spacing[10],
    paddingRight: isRTL ? spacing[10] : spacing[4],
  }) as CSSProperties,
};

// Card styles
export const cardStyles = {
  base: {
    background: colors.background.surface,
    borderRadius: radius.md,
    padding: `${spacing[3]} ${spacing[4]}`,
    border: '1px solid transparent',
    cursor: 'pointer',
    transition: `all ${transitions.base}`,
  } as CSSProperties,

  hover: {
    background: colors.background.hover,
    borderColor: colors.glass.borderHover,
    transform: 'translateX(4px)',
  } as CSSProperties,

  selected: {
    background: 'rgba(6, 182, 212, 0.1)',
    border: `1px solid ${colors.border.accent}`,
    borderLeft: `3px solid ${colors.primary.main}`,
  } as CSSProperties,

  active: {
    background: 'rgba(6, 182, 212, 0.12)',
    borderLeft: `3px solid ${colors.primary.main}`,
    borderColor: 'rgba(6, 182, 212, 0.2)',
  } as CSSProperties,
};

// Dropdown styles
export const dropdownStyles = {
  container: {
    position: 'absolute' as const,
    background: colors.background.dropdown,
    borderRadius: radius.lg,
    border: `1px solid ${colors.glass.borderHover}`,
    boxShadow: shadows.xl,
    zIndex: 1000,
    backdropFilter: 'blur(20px)',
    overflow: 'hidden',
  } as CSSProperties,

  item: {
    padding: `${spacing[3]} ${spacing[4]}`,
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: `1px solid ${colors.glass.border}`,
    transition: `all ${transitions.fast}`,
    color: colors.text.primary,
    fontSize: '0.8125rem',
  } as CSSProperties,

  itemHover: {
    background: colors.glass.hover,
  } as CSSProperties,

  itemActive: {
    background: 'rgba(6, 182, 212, 0.1)',
    color: colors.primary.light,
  } as CSSProperties,
};

// Panel styles
export const panelStyles = {
  header: {
    padding: `${spacing[4]} ${spacing[5]}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: `1px solid ${colors.glass.border}`,
    background: 'rgba(0, 0, 0, 0.2)',
  } as CSSProperties,

  section: {
    padding: spacing[4],
    display: 'flex',
    flexDirection: 'column' as const,
    gap: spacing[3],
  } as CSSProperties,

  sectionTitle: {
    margin: 0,
    color: colors.text.muted,
    fontSize: '0.6875rem',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  } as CSSProperties,

  title: {
    margin: 0,
    color: colors.text.primary,
    fontSize: '0.9375rem',
    fontWeight: 600,
    letterSpacing: '-0.01em',
  } as CSSProperties,
};

// Resource tab styles
export const tabStyles = {
  container: {
    display: 'flex',
    gap: spacing[1],
    padding: spacing[2],
    background: 'rgba(0, 0, 0, 0.4)',
    borderBottom: `1px solid ${colors.glass.border}`,
  } as CSSProperties,

  tab: (isActive: boolean) => ({
    padding: `${spacing[2]} ${spacing[4]}`,
    background: isActive ? 'rgba(6, 182, 212, 0.1)' : 'transparent',
    border: 'none',
    borderRadius: radius.md,
    color: isActive ? colors.primary.light : colors.text.muted,
    cursor: 'pointer',
    fontSize: '0.8125rem',
    fontWeight: isActive ? 600 : 500,
    fontFamily: 'inherit',
    transition: `all ${transitions.base}`,
    position: 'relative' as const,
    whiteSpace: 'nowrap' as const,
  }) as CSSProperties,

  tabHover: {
    color: colors.text.secondary,
    background: colors.glass.hover,
  } as CSSProperties,

  tabIndicator: {
    position: 'absolute' as const,
    bottom: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    width: '24px',
    height: '2px',
    background: colors.primary.main,
    borderRadius: radius.full,
  } as CSSProperties,
};

// Empty state styles
export const emptyStateStyles = {
  container: {
    textAlign: 'center' as const,
    padding: `${spacing[10]} ${spacing[6]}`,
    color: colors.text.muted,
    fontSize: '0.875rem',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
  } as CSSProperties,

  icon: {
    fontSize: '2.5rem',
    marginBottom: spacing[3],
    opacity: 0.4,
  } as CSSProperties,

  text: {
    fontSize: '0.875rem',
    lineHeight: 1.6,
    maxWidth: '280px',
  } as CSSProperties,

  subtitle: {
    fontSize: '0.75rem',
    marginTop: spacing[1],
    color: colors.text.disabled,
  } as CSSProperties,
};

// Badge styles
export const badgeStyles = {
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: `2px ${spacing[2]}`,
    fontSize: '0.625rem',
    fontWeight: 600,
    borderRadius: radius.full,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.03em',
  } as CSSProperties,

  primary: {
    background: 'rgba(6, 182, 212, 0.15)',
    color: colors.primary.light,
  } as CSSProperties,

  success: {
    background: 'rgba(16, 185, 129, 0.15)',
    color: colors.success.light,
  } as CSSProperties,

  danger: {
    background: 'rgba(239, 68, 68, 0.15)',
    color: colors.danger.light,
  } as CSSProperties,

  warning: {
    background: 'rgba(245, 158, 11, 0.15)',
    color: colors.warning.light,
  } as CSSProperties,
};

// Flex utilities
export const flexStyles = {
  row: {
    display: 'flex',
    alignItems: 'center',
  } as CSSProperties,

  rowBetween: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  } as CSSProperties,

  rowCenter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as CSSProperties,

  column: {
    display: 'flex',
    flexDirection: 'column' as const,
  } as CSSProperties,

  columnCenter: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
  } as CSSProperties,

  gap: (size: keyof typeof spacing) => ({
    gap: spacing[size],
  }) as CSSProperties,
};

// Setlist item type styles helper
export const getItemTypeStyles = (type: string): CSSProperties => {
  const typeColors = colors.itemTypes[type as keyof typeof colors.itemTypes] || colors.itemTypes.tool;
  return {
    background: typeColors.bg,
    borderColor: typeColors.border,
  };
};

export const getItemTypeTextColor = (type: string): string => {
  const typeColors = colors.itemTypes[type as keyof typeof colors.itemTypes] || colors.itemTypes.tool;
  return typeColors.text;
};
