/**
 * SoluCast Theme Configuration
 *
 * This is the single source of truth for all theme colors and design tokens.
 * To change the app's color scheme, update the values here.
 *
 * These values are synchronized with CSS variables in index.css
 * Components should import from this file rather than hardcoding colors.
 */

export const theme = {
  // Primary Accent Color
  colors: {
    primary: {
      main: '#06b6d4',      // Cyan-500
      light: '#22d3ee',     // Cyan-400
      dark: '#0891b2',      // Cyan-600
      darker: '#0e7490',    // Cyan-700
      glow: 'rgba(6, 182, 212, 0.4)',
      bg: 'rgba(6, 182, 212, 0.1)',
      bgHover: 'rgba(6, 182, 212, 0.15)',
      border: 'rgba(6, 182, 212, 0.3)',
    },

    // Secondary Accent (for variety)
    secondary: {
      main: '#8b5cf6',      // Violet-500
      light: '#a78bfa',     // Violet-400
      dark: '#7c3aed',      // Violet-600
      bg: 'rgba(139, 92, 246, 0.1)',
      border: 'rgba(139, 92, 246, 0.3)',
    },

    // Semantic Colors
    success: {
      main: '#10b981',      // Emerald-500
      light: '#34d399',     // Emerald-400
      bg: 'rgba(16, 185, 129, 0.1)',
      border: 'rgba(16, 185, 129, 0.3)',
    },
    danger: {
      main: '#ef4444',      // Red-500
      light: '#f87171',     // Red-400
      bg: 'rgba(239, 68, 68, 0.1)',
      border: 'rgba(239, 68, 68, 0.3)',
    },
    warning: {
      main: '#f59e0b',      // Amber-500
      light: '#fbbf24',     // Amber-400
      bg: 'rgba(245, 158, 11, 0.1)',
      border: 'rgba(245, 158, 11, 0.3)',
    },
    info: {
      main: '#3b82f6',      // Blue-500
      light: '#60a5fa',     // Blue-400
      bg: 'rgba(59, 130, 246, 0.1)',
      border: 'rgba(59, 130, 246, 0.3)',
    },

    // Background Colors (Zinc palette)
    background: {
      base: '#09090b',      // Zinc-950
      elevated: '#18181b',  // Zinc-900
      surface: '#27272a',   // Zinc-800
      hover: '#3f3f46',     // Zinc-700
      active: '#52525b',    // Zinc-600
    },

    // Text Colors
    text: {
      primary: '#fafafa',   // Zinc-50
      secondary: '#a1a1aa', // Zinc-400
      muted: '#71717a',     // Zinc-500
      disabled: '#52525b',  // Zinc-600
    },

    // Glass/Overlay Effects
    glass: {
      bg: 'rgba(24, 24, 27, 0.8)',
      bgLight: 'rgba(39, 39, 42, 0.6)',
      border: 'rgba(255, 255, 255, 0.06)',
      borderHover: 'rgba(255, 255, 255, 0.1)',
      hover: 'rgba(255, 255, 255, 0.04)',
    },
  },

  // Gradients
  gradients: {
    primary: 'linear-gradient(135deg, #06b6d4, #0891b2)',
    primaryHover: 'linear-gradient(135deg, #22d3ee, #06b6d4)',
    secondary: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
    success: 'linear-gradient(135deg, #10b981, #34d399)',
    danger: 'linear-gradient(135deg, #ef4444, #f87171)',
    surface: 'linear-gradient(135deg, #27272a, #3f3f46)',
  },

  // Shadows
  shadows: {
    xs: '0 1px 2px rgba(0, 0, 0, 0.3)',
    sm: '0 2px 4px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2)',
    md: '0 4px 12px rgba(0, 0, 0, 0.4), 0 2px 4px rgba(0, 0, 0, 0.2)',
    lg: '0 8px 24px rgba(0, 0, 0, 0.5), 0 4px 8px rgba(0, 0, 0, 0.3)',
    xl: '0 16px 48px rgba(0, 0, 0, 0.6), 0 8px 16px rgba(0, 0, 0, 0.4)',
    glow: '0 0 20px rgba(6, 182, 212, 0.4), 0 0 40px rgba(6, 182, 212, 0.2)',
    glowSm: '0 0 10px rgba(6, 182, 212, 0.4)',
  },

  // Border Radius
  radius: {
    xs: '4px',
    sm: '6px',
    md: '10px',
    lg: '14px',
    xl: '20px',
    '2xl': '24px',
    full: '9999px',
  },

  // Spacing
  spacing: {
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    5: '20px',
    6: '24px',
    8: '32px',
    10: '40px',
  },

  // Transitions
  transitions: {
    fast: '0.1s cubic-bezier(0.4, 0, 0.2, 1)',
    base: '0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    slow: '0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    spring: '0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
  },

  // Typography
  fonts: {
    sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
  },
} as const;

// Convenience exports for common use cases
export const { colors, gradients, shadows, radius, spacing, transitions } = theme;

// Item type colors for setlist items, etc.
export const itemTypeColors = {
  song: {
    bg: theme.colors.primary.bg,
    border: theme.colors.primary.border,
    text: theme.colors.primary.light,
  },
  media: {
    bg: theme.colors.success.bg,
    border: theme.colors.success.border,
    text: theme.colors.success.light,
  },
  youtube: {
    bg: theme.colors.danger.bg,
    border: theme.colors.danger.border,
    text: theme.colors.danger.light,
  },
  bible: {
    bg: theme.colors.secondary.bg,
    border: theme.colors.secondary.border,
    text: theme.colors.secondary.light,
  },
  presentation: {
    bg: theme.colors.info.bg,
    border: theme.colors.info.border,
    text: theme.colors.info.light,
  },
  section: {
    bg: theme.colors.secondary.bg,
    border: theme.colors.secondary.border,
    text: theme.colors.secondary.light,
  },
  countdown: {
    bg: theme.colors.warning.bg,
    border: theme.colors.warning.border,
    text: theme.colors.warning.light,
  },
  announcement: {
    bg: theme.colors.warning.bg,
    border: theme.colors.warning.border,
    text: theme.colors.warning.light,
  },
  messages: {
    bg: theme.colors.warning.bg,
    border: theme.colors.warning.border,
    text: theme.colors.warning.light,
  },
  blank: {
    bg: 'rgba(255, 255, 255, 0.05)',
    border: 'rgba(255, 255, 255, 0.1)',
    text: theme.colors.text.muted,
  },
  tool: {
    bg: 'rgba(63, 63, 70, 0.5)',
    border: 'rgba(255, 255, 255, 0.1)',
    text: theme.colors.text.secondary,
  },
} as const;

// Verse type colors for lyrics display
export const verseTypeColors = {
  verse: theme.colors.text.primary,
  chorus: theme.colors.primary.main,
  bridge: theme.colors.secondary.main,
  pre: theme.colors.warning.main,
  tag: theme.colors.success.main,
  intro: theme.colors.info.main,
  outro: theme.colors.info.main,
  default: theme.colors.text.secondary,
} as const;

// Helper function to get item type color
export function getItemTypeColor(type: string): (typeof itemTypeColors)[keyof typeof itemTypeColors] {
  return itemTypeColors[type as keyof typeof itemTypeColors] || itemTypeColors.tool;
}

// Helper function to get verse type color
export function getVerseTypeColor(verseType: string): string {
  return verseTypeColors[verseType as keyof typeof verseTypeColors] || verseTypeColors.default;
}
