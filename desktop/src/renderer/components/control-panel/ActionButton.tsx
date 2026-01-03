import React, { memo, useMemo, useCallback, CSSProperties, MouseEvent } from 'react';
import { buttonStyles, colors } from '../../styles/controlPanelStyles';

type ButtonVariant = 'primary' | 'success' | 'danger' | 'secondary' | 'info' | 'orange' | 'ghost';
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
  primary: { background: colors.button.primary },
  success: { background: colors.button.success },
  danger: { background: colors.button.danger },
  secondary: { background: colors.button.secondary },
  info: { background: colors.button.info },
  orange: { background: colors.button.orange },
  ghost: { background: 'transparent', border: '1px solid rgba(255,255,255,0.2)' },
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
    ...(disabled && { opacity: 0.5, cursor: 'not-allowed' }),
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
