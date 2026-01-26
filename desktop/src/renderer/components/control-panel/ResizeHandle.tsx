import React, { memo } from 'react';

interface ResizeHandleProps {
  direction: 'vertical' | 'horizontal';
  isResizing: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
}

const ResizeHandle = memo<ResizeHandleProps>(({
  direction,
  isResizing,
  onMouseDown
}) => {
  const isVertical = direction === 'vertical';

  return (
    <div
      onMouseDown={onMouseDown}
      className={`resize-handle-${direction}`}
      style={{
        width: isVertical ? '12px' : undefined,
        height: isVertical ? undefined : '12px',
        cursor: isVertical ? 'col-resize' : 'row-resize',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}
    >
      <div
        style={{
          width: isVertical ? '3px' : '40px',
          height: isVertical ? '40px' : '3px',
          background: isResizing ? '#06b6d4' : 'rgba(255,255,255,0.15)',
          borderRadius: '2px',
          transition: 'background 0.15s, width 0.15s, height 0.15s'
        }}
      />
    </div>
  );
});

ResizeHandle.displayName = 'ResizeHandle';

export default ResizeHandle;
