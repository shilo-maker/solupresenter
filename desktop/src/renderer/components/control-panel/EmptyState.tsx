import React, { memo, useMemo } from 'react';
import { emptyStateStyles } from '../../styles/controlPanelStyles';

interface EmptyStateProps {
  icon: string;
  message: string;
  subtitle?: string;
}

const EmptyState: React.FC<EmptyStateProps> = memo(({
  icon,
  message,
  subtitle,
}) => {
  return (
    <div style={emptyStateStyles.container}>
      <div style={emptyStateStyles.icon}>{icon}</div>
      <div>{message}</div>
      {subtitle && (
        <div style={emptyStateStyles.subtitle}>{subtitle}</div>
      )}
    </div>
  );
});

EmptyState.displayName = 'EmptyState';

export default EmptyState;
