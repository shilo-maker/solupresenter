import React from 'react';
import { Rnd } from 'react-rnd';

const DraggableTextBox = ({
  lineType,
  position, // { x, y, width, height } in percentages
  style, // { fontSize, fontWeight, color, opacity, visible }
  isSelected,
  canvasSize, // { width, height } in pixels
  onPositionChange,
  onSelect,
  sampleText,
  disabled
}) => {
  // Convert percentage to pixels
  const toPixels = (percent, dimension) => (percent / 100) * dimension;

  // Convert pixels to percentage
  const toPercent = (pixels, dimension) => (pixels / dimension) * 100;

  // Calculate pixel position and size from percentage
  const pixelPosition = {
    x: toPixels(position.x, canvasSize.width),
    y: toPixels(position.y, canvasSize.height),
    width: toPixels(position.width, canvasSize.width),
    height: toPixels(position.height, canvasSize.height)
  };

  // Handle drag end - convert back to percentages
  const handleDragStop = (e, d) => {
    onPositionChange({
      ...position,
      x: Math.max(0, Math.min(100 - position.width, toPercent(d.x, canvasSize.width))),
      y: Math.max(0, Math.min(100 - position.height, toPercent(d.y, canvasSize.height)))
    });
  };

  // Handle resize end - convert back to percentages
  const handleResizeStop = (e, direction, ref, delta, pos) => {
    const newWidth = toPercent(ref.offsetWidth, canvasSize.width);
    const newHeight = toPercent(ref.offsetHeight, canvasSize.height);
    const newX = toPercent(pos.x, canvasSize.width);
    const newY = toPercent(pos.y, canvasSize.height);

    onPositionChange({
      x: Math.max(0, Math.min(100 - newWidth, newX)),
      y: Math.max(0, Math.min(100 - newHeight, newY)),
      width: Math.max(10, Math.min(100, newWidth)),
      height: Math.max(5, Math.min(100, newHeight))
    });
  };

  // Line type display names
  const lineTypeNames = {
    original: 'Original',
    transliteration: 'Transliteration',
    translation: 'Translation'
  };

  // Calculate font size based on box height and theme fontSize
  const getFontSize = () => {
    const baseSize = Math.min(pixelPosition.height * 0.4, 32);
    const scale = style?.fontSize ? style.fontSize / 100 : 1;
    return Math.max(12, baseSize * scale);
  };

  if (style?.visible === false) {
    return null;
  }

  return (
    <Rnd
      size={{ width: pixelPosition.width, height: pixelPosition.height }}
      position={{ x: pixelPosition.x, y: pixelPosition.y }}
      onDragStop={handleDragStop}
      onResizeStop={handleResizeStop}
      onClick={() => onSelect()}
      bounds="parent"
      minWidth={canvasSize.width * 0.1}
      minHeight={canvasSize.height * 0.05}
      disableDragging={disabled}
      enableResizing={!disabled}
      style={{
        cursor: disabled ? 'default' : 'move'
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px',
          boxSizing: 'border-box',
          backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.05)',
          border: isSelected ? '2px solid #6366f1' : '1px dashed rgba(255, 255, 255, 0.3)',
          borderRadius: '4px',
          transition: 'background-color 0.2s, border-color 0.2s',
          overflow: 'hidden'
        }}
      >
        {/* Line type label */}
        <div
          style={{
            position: 'absolute',
            top: '4px',
            left: '8px',
            fontSize: '10px',
            fontWeight: '600',
            color: isSelected ? '#a5b4fc' : 'rgba(255, 255, 255, 0.5)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            pointerEvents: 'none'
          }}
        >
          {lineTypeNames[lineType]}
        </div>

        {/* Sample text preview */}
        <div
          style={{
            fontSize: `${getFontSize()}px`,
            fontWeight: style?.fontWeight || '400',
            color: style?.color || '#FFFFFF',
            opacity: style?.opacity !== undefined ? style.opacity : 1,
            textAlign: 'center',
            textShadow: '2px 2px 4px rgba(0, 0, 0, 0.5)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '100%',
            pointerEvents: 'none',
            direction: lineType === 'original' ? 'rtl' : 'ltr'
          }}
        >
          {sampleText}
        </div>
      </div>
    </Rnd>
  );
};

export default DraggableTextBox;
