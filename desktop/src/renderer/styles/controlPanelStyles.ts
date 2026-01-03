import { CSSProperties } from 'react';

// Common colors used throughout the control panel
export const colors = {
  background: {
    primary: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    card: 'rgba(255,255,255,0.05)',
    cardHover: 'rgba(255,255,255,0.1)',
    dropdown: 'rgba(30, 30, 50, 0.98)',
    input: 'rgba(255,255,255,0.08)',
  },
  button: {
    primary: 'linear-gradient(135deg, #667eea, #764ba2)',
    success: 'linear-gradient(135deg, #28a745, #20c997)',
    danger: '#dc3545',
    info: '#0d6efd',
    secondary: '#6c757d',
    orange: '#FF8C42',
  },
  border: {
    light: 'rgba(255,255,255,0.1)',
    medium: 'rgba(255,255,255,0.15)',
    accent: 'rgba(102, 126, 234, 0.5)',
  },
  text: {
    primary: 'white',
    secondary: 'rgba(255,255,255,0.7)',
    muted: 'rgba(255,255,255,0.5)',
  },
};

// Common button styles
export const buttonStyles = {
  base: {
    border: 'none',
    borderRadius: '8px',
    padding: '8px 16px',
    color: 'white',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 500,
    transition: 'all 0.2s',
  } as CSSProperties,

  primary: {
    background: colors.button.primary,
  } as CSSProperties,

  success: {
    background: colors.button.success,
  } as CSSProperties,

  danger: {
    background: colors.button.danger,
  } as CSSProperties,

  icon: {
    width: '34px',
    height: '34px',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as CSSProperties,

  small: {
    padding: '6px 12px',
    fontSize: '0.75rem',
    borderRadius: '6px',
  } as CSSProperties,
};

// Common input styles
export const inputStyles = {
  base: {
    width: '100%',
    background: colors.background.input,
    border: `2px solid ${colors.border.medium}`,
    borderRadius: '8px',
    padding: '8px 12px',
    color: 'white',
    fontSize: '0.85rem',
    outline: 'none',
  } as CSSProperties,

  withIcon: (isRTL: boolean) => ({
    paddingLeft: isRTL ? '12px' : '32px',
    paddingRight: isRTL ? '32px' : '12px',
  }) as CSSProperties,
};

// Card styles
export const cardStyles = {
  base: {
    background: colors.background.card,
    borderRadius: '8px',
    padding: '10px 12px',
    border: '1px solid transparent',
    cursor: 'pointer',
    transition: 'background 0.15s',
  } as CSSProperties,

  selected: {
    background: 'rgba(102, 126, 234, 0.2)',
    border: '1px solid rgba(102, 126, 234, 0.5)',
  } as CSSProperties,
};

// Dropdown styles
export const dropdownStyles = {
  container: {
    position: 'absolute' as const,
    background: colors.background.dropdown,
    borderRadius: '12px',
    border: `1px solid ${colors.border.medium}`,
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    zIndex: 1000,
  } as CSSProperties,

  item: {
    padding: '10px 12px',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: `1px solid ${colors.border.light}`,
  } as CSSProperties,
};

// Panel styles
export const panelStyles = {
  header: {
    padding: '12px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: `1px solid ${colors.border.light}`,
  } as CSSProperties,

  section: {
    padding: '12px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  } as CSSProperties,

  sectionTitle: {
    margin: 0,
    color: 'white',
    fontSize: '0.9rem',
    fontWeight: 600,
  } as CSSProperties,
};

// Resource tab styles
export const tabStyles = {
  container: {
    display: 'flex',
    gap: '4px',
    padding: '8px 12px',
    background: 'rgba(0,0,0,0.2)',
    borderBottom: `1px solid ${colors.border.light}`,
  } as CSSProperties,

  tab: (isActive: boolean) => ({
    padding: '8px 14px',
    background: isActive ? 'rgba(102, 126, 234, 0.3)' : 'transparent',
    border: 'none',
    borderRadius: '6px',
    color: isActive ? 'white' : 'rgba(255,255,255,0.6)',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: isActive ? 600 : 400,
    transition: 'all 0.2s',
  }) as CSSProperties,
};

// Empty state styles
export const emptyStateStyles = {
  container: {
    textAlign: 'center' as const,
    padding: '40px 20px',
    color: colors.text.muted,
    fontSize: '0.9rem',
  } as CSSProperties,

  icon: {
    fontSize: '32px',
    marginBottom: '12px',
  } as CSSProperties,

  subtitle: {
    fontSize: '0.8rem',
    marginTop: '4px',
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

  column: {
    display: 'flex',
    flexDirection: 'column' as const,
  } as CSSProperties,

  gap: (size: number) => ({
    gap: `${size}px`,
  }) as CSSProperties,
};
