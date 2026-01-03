import React, { memo, useMemo, CSSProperties } from 'react';
import { cardStyles, colors } from '../../styles/controlPanelStyles';

interface ToolCardProps {
  icon: string;
  title: string;
  description: string;
  onClick: () => void;
  isActive?: boolean;
}

const ToolCard: React.FC<ToolCardProps> = memo(({
  icon,
  title,
  description,
  onClick,
  isActive = false,
}) => {
  const containerStyle = useMemo((): CSSProperties => ({
    ...cardStyles.base,
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    background: isActive ? 'rgba(102, 126, 234, 0.2)' : cardStyles.base.background,
    border: isActive ? '1px solid rgba(102, 126, 234, 0.5)' : '1px solid transparent',
  }), [isActive]);

  const iconStyle = useMemo((): CSSProperties => ({
    fontSize: '1.5rem',
    width: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255,255,255,0.1)',
    borderRadius: '8px',
  }), []);

  return (
    <div
      onClick={onClick}
      style={containerStyle}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = cardStyles.base.background as string;
        }
      }}
    >
      <div style={iconStyle}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{
          color: 'white',
          fontSize: '0.9rem',
          fontWeight: 500,
          marginBottom: '2px',
        }}>
          {title}
        </div>
        <div style={{
          color: colors.text.muted,
          fontSize: '0.75rem',
        }}>
          {description}
        </div>
      </div>
    </div>
  );
});

ToolCard.displayName = 'ToolCard';

export default ToolCard;
