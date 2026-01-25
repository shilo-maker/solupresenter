import React, { memo, useMemo, useCallback, CSSProperties, MouseEvent } from 'react';
import { buttonStyles } from '../../styles/controlPanelStyles';
import { theme, gradients } from '../../styles/theme';

type ButtonVariant = 'primary' | 'success' | 'danger' | 'secondary' | 'info' | 'ghost';
type ButtonSize = 'small' | 'medium' | 'icon';

interface ActionButtonProps {
  children: React.ReactNode;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  title?: string;
  style?: CSSProperties;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, CSSProperties> = {
  primary: {
    background: theme.gradients.primary,
    color: theme.colors.background.base,
    boxShadow: theme.shadows.sm,
  },
  success: {
    background: theme.gradients.success,
    color: 'white',
    boxShadow: theme.shadows.sm,
  },
  danger: {
    background: theme.gradients.danger,
    color: 'white',
    boxShadow: theme.shadows.sm,
  },
  secondary: {
    background: theme.colors.background.surface,
    color: theme.colors.text.primary,
    border: `1px solid ${theme.colors.glass.border}`,
  },
  info: {
    background: `linear-gradient(135deg, ${theme.colors.info.main}, ${theme.colors.info.light})`,
    color: 'white',
    boxShadow: theme.shadows.sm,
  },
  ghost: {
    background: 'transparent',
    color: theme.colors.text.secondary,
    border: `1px solid ${theme.colors.glass.borderHover}`,
  },
};

const sizeStyles: Record<ButtonSize, CSSProperties> = {
  small: buttonStyles.small,
  medium: {},
  icon: buttonStyles.icon,
};

const ActionButton: React.FC<ActionButtonProps> = memo(({
  children,
  onClick,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  title,
  style,
  fullWidth = false,
}) => {
  const buttonStyle = useMemo((): CSSProperties => ({
    ...buttonStyles.base,
    ...variantStyles[variant],
    ...sizeStyles[size],
    ...(fullWidth && { width: '100%' }),
    ...(disabled && { opacity: 0.4, cursor: 'not-allowed' }),
    ...style,
  }), [variant, size, fullWidth, disabled, style]);

  const handleClick = useCallback((e: MouseEvent<HTMLButtonElement>) => {
    if (!disabled && onClick) {
      onClick(e);
    }
  }, [disabled, onClick]);

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      title={title}
      style={buttonStyle}
    >
      {children}
    </button>
  );
});

ActionButton.displayName = 'ActionButton';

export default ActionButton;
