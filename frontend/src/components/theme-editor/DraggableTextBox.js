import React, { useState } from 'react';
import { Rnd } from 'react-rnd';

const DraggableTextBox = ({
  lineType,
  position, // { x, y, width, height, paddingTop, paddingBottom, alignH, alignV } in percentages
  style, // { fontSize, fontWeight, color, opacity, visible }
  isSelected,
  canvasSize, // { width, height } in pixels
  onPositionChange,
  onSelect,
  sampleText,
  disabled
}) => {
  const [isDraggingPadding, setIsDraggingPadding] = useState(null); // 'top' or 'bottom'

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

  // Padding in pixels (percentage of box height)
  const paddingTop = position.paddingTop || 0;
  const paddingBottom = position.paddingBottom || 0;
  const paddingTopPx = (paddingTop / 100) * pixelPosition.height;
  const paddingBottomPx = (paddingBottom / 100) * pixelPosition.height;

  // Alignment (default to center)
  const alignH = position.alignH || 'center';
  const alignV = position.alignV || 'center';

  // Map alignment to CSS values
  const getAlignItems = () => {
    switch (alignH) {
      case 'left': return 'flex-start';
      case 'right': return 'flex-end';
      default: return 'center';
    }
  };

  const getJustifyContent = () => {
    switch (alignV) {
      case 'top': return 'flex-start';
      case 'bottom': return 'flex-end';
      default: return 'center';
    }
  };

  const getTextAlign = () => alignH;

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
      ...position,
      x: Math.max(0, Math.min(100 - newWidth, newX)),
      y: Math.max(0, Math.min(100 - newHeight, newY)),
      width: Math.max(10, Math.min(100, newWidth)),
      height: Math.max(5, Math.min(100, newHeight))
    });
  };

  // Handle padding drag
  const handlePaddingDrag = (e, edge) => {
    if (disabled) return;
    e.stopPropagation();
    e.preventDefault();

    setIsDraggingPadding(edge);

    const startY = e.clientY;
    const startPadding = edge === 'top' ? paddingTop : paddingBottom;
    const boxHeight = pixelPosition.height;

    const handleMouseMove = (moveEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const deltaPct = (deltaY / boxHeight) * 100;

      let newPadding;
      if (edge === 'top') {
        newPadding = Math.max(0, Math.min(45, startPadding + deltaPct));
      } else {
        newPadding = Math.max(0, Math.min(45, startPadding - deltaPct));
      }

      onPositionChange({
        ...position,
        [edge === 'top' ? 'paddingTop' : 'paddingBottom']: Math.round(newPadding)
      });
    };

    const handleMouseUp = () => {
      setIsDraggingPadding(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Line type display names
  const lineTypeNames = {
    original: 'Original',
    transliteration: 'Transliteration',
    translation: 'Translation'
  };

  // Calculate font size based on box height and theme fontSize
  const getFontSize = () => {
    const availableHeight = pixelPosition.height - paddingTopPx - paddingBottomPx;
    const baseSize = Math.min(availableHeight * 0.5, 32);
    const scale = style?.fontSize ? style.fontSize / 100 : 1;
    return Math.max(12, baseSize * scale);
  };

  if (style?.visible === false) {
    return null;
  }

  const handleStyle = {
    position: 'absolute',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '40px',
    height: '8px',
    backgroundColor: isSelected ? '#6366f1' : 'rgba(255, 255, 255, 0.4)',
    borderRadius: '4px',
    cursor: 'ns-resize',
    zIndex: 10,
    transition: 'background-color 0.2s',
    display: disabled ? 'none' : 'block'
  };

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
      disableDragging={disabled || isDraggingPadding}
      enableResizing={!disabled && !isDraggingPadding}
      style={{
        cursor: disabled ? 'default' : 'move',
        zIndex: 2 // Above background boxes which have z-index: 1
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: getAlignItems(),
          justifyContent: getJustifyContent(),
          paddingTop: `${paddingTopPx}px`,
          paddingBottom: `${paddingBottomPx}px`,
          paddingLeft: '8px',
          paddingRight: '8px',
          boxSizing: 'border-box',
          backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.05)',
          border: isSelected ? '2px solid #6366f1' : '1px dashed rgba(255, 255, 255, 0.3)',
          borderRadius: '4px',
          transition: 'background-color 0.2s, border-color 0.2s',
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        {/* Top padding handle */}
        {isSelected && !disabled && (
          <div
            style={{
              ...handleStyle,
              top: `${paddingTopPx + 2}px`
            }}
            onMouseDown={(e) => handlePaddingDrag(e, 'top')}
            title="Drag to adjust top padding"
          />
        )}

        {/* Bottom padding handle */}
        {isSelected && !disabled && (
          <div
            style={{
              ...handleStyle,
              bottom: `${paddingBottomPx + 2}px`
            }}
            onMouseDown={(e) => handlePaddingDrag(e, 'bottom')}
            title="Drag to adjust bottom padding"
          />
        )}

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

        {/* Padding indicators when selected */}
        {isSelected && (paddingTop > 0 || paddingBottom > 0) && (
          <div
            style={{
              position: 'absolute',
              top: '4px',
              right: '8px',
              fontSize: '9px',
              color: 'rgba(255, 255, 255, 0.5)',
              pointerEvents: 'none'
            }}
          >
            {paddingTop > 0 && `↑${paddingTop}%`} {paddingBottom > 0 && `↓${paddingBottom}%`}
          </div>
        )}

        {/* Sample text preview */}
        <div
          style={{
            fontSize: `${getFontSize()}px`,
            fontWeight: style?.fontWeight || '400',
            color: style?.color || '#FFFFFF',
            opacity: style?.opacity !== undefined ? style.opacity : 1,
            textAlign: getTextAlign(),
            textShadow: '2px 2px 4px rgba(0, 0, 0, 0.5)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            width: '100%',
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
