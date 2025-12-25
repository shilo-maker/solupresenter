import React from 'react';
import { Rnd } from 'react-rnd';

const DraggableBox = ({
  box, // { id, x, y, width, height, color, opacity, borderRadius }
  isSelected,
  canvasSize, // { width, height } in pixels
  onPositionChange,
  onSelect,
  onDelete,
  disabled,
  index
}) => {
  // Convert percentage to pixels
  const toPixels = (percent, dimension) => (percent / 100) * dimension;

  // Convert pixels to percentage
  const toPercent = (pixels, dimension) => (pixels / dimension) * 100;

  // Calculate pixel position and size from percentage
  const pixelPosition = {
    x: toPixels(box.x, canvasSize.width),
    y: toPixels(box.y, canvasSize.height),
    width: toPixels(box.width, canvasSize.width),
    height: toPixels(box.height, canvasSize.height)
  };

  // Handle drag end - convert back to percentages
  const handleDragStop = (e, d) => {
    onPositionChange({
      ...box,
      x: Math.max(0, Math.min(100 - box.width, toPercent(d.x, canvasSize.width))),
      y: Math.max(0, Math.min(100 - box.height, toPercent(d.y, canvasSize.height)))
    });
  };

  // Handle resize end - convert back to percentages
  const handleResizeStop = (e, direction, ref, delta, pos) => {
    const newWidth = toPercent(ref.offsetWidth, canvasSize.width);
    const newHeight = toPercent(ref.offsetHeight, canvasSize.height);
    const newX = toPercent(pos.x, canvasSize.width);
    const newY = toPercent(pos.y, canvasSize.height);

    onPositionChange({
      ...box,
      x: Math.max(0, Math.min(100 - newWidth, newX)),
      y: Math.max(0, Math.min(100 - newHeight, newY)),
      width: Math.max(5, Math.min(100, newWidth)),
      height: Math.max(5, Math.min(100, newHeight))
    });
  };

  return (
    <Rnd
      size={{ width: pixelPosition.width, height: pixelPosition.height }}
      position={{ x: pixelPosition.x, y: pixelPosition.y }}
      onDragStop={handleDragStop}
      onResizeStop={handleResizeStop}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      bounds="parent"
      minWidth={20}
      minHeight={20}
      disableDragging={disabled}
      enableResizing={!disabled}
      style={{
        cursor: disabled ? 'default' : 'move',
        zIndex: 1 // Behind text boxes which have higher z-index
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: box.color || '#000000',
          opacity: box.opacity !== undefined ? box.opacity : 0.5,
          borderRadius: box.borderRadius ? `${box.borderRadius}px` : '0px',
          border: isSelected ? '2px solid #10b981' : '1px dashed rgba(255, 255, 255, 0.3)',
          boxSizing: 'border-box',
          position: 'relative'
        }}
      >
        {/* Box label */}
        <div
          style={{
            position: 'absolute',
            top: '4px',
            left: '8px',
            fontSize: '10px',
            fontWeight: '600',
            color: isSelected ? '#10b981' : 'rgba(255, 255, 255, 0.7)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            pointerEvents: 'none',
            textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
          }}
        >
          Box {index + 1}
        </div>

        {/* Delete button when selected */}
        {isSelected && !disabled && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            style={{
              position: 'absolute',
              top: '-10px',
              right: '-10px',
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              backgroundColor: '#ef4444',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              fontWeight: 'bold',
              zIndex: 100
            }}
            title="Delete box"
          >
            ×
          </button>
        )}
      </div>
    </Rnd>
  );
};

export default DraggableBox;
