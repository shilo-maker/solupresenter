import React, { useState, useRef, useEffect } from 'react';
import { Rnd } from 'react-rnd';

const PresentationTextBox = ({
  textBox, // { id, text, x, y, width, height, fontSize, fontWeight, color, textAlign, verticalAlign, bold, italic, underline, backgroundColor, opacity }
  isSelected,
  canvasSize, // { width, height } in pixels
  onPositionChange,
  onTextChange,
  onSelect,
  onDelete,
  disabled
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const textareaRef = useRef(null);

  // Focus and select text when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      // Select all text
      const range = document.createRange();
      range.selectNodeContents(textareaRef.current);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }, [isEditing]);

  const handleDoubleClick = (e) => {
    if (!disabled) {
      e.stopPropagation();
      setIsEditing(true);
    }
  };
  // Convert percentage to pixels
  const toPixels = (percent, dimension) => (percent / 100) * dimension;

  // Convert pixels to percentage
  const toPercent = (pixels, dimension) => (pixels / dimension) * 100;

  // Calculate pixel position and size from percentage
  const pixelPosition = {
    x: toPixels(textBox.x, canvasSize.width),
    y: toPixels(textBox.y, canvasSize.height),
    width: toPixels(textBox.width, canvasSize.width),
    height: toPixels(textBox.height, canvasSize.height)
  };

  // Map alignment to CSS values
  const getAlignItems = () => {
    switch (textBox.textAlign || 'center') {
      case 'left': return 'flex-start';
      case 'right': return 'flex-end';
      default: return 'center';
    }
  };

  const getJustifyContent = () => {
    switch (textBox.verticalAlign || 'center') {
      case 'top': return 'flex-start';
      case 'bottom': return 'flex-end';
      default: return 'center';
    }
  };

  // Handle drag end - convert back to percentages
  const handleDragStop = (e, d) => {
    const newX = Math.max(0, Math.min(100 - textBox.width, toPercent(d.x, canvasSize.width)));
    const newY = Math.max(0, Math.min(100 - textBox.height, toPercent(d.y, canvasSize.height)));
    onPositionChange({
      ...textBox,
      x: newX,
      y: newY
    });
  };

  // Handle resize end - convert back to percentages
  const handleResizeStop = (e, direction, ref, delta, pos) => {
    const newWidth = toPercent(ref.offsetWidth, canvasSize.width);
    const newHeight = toPercent(ref.offsetHeight, canvasSize.height);
    const newX = toPercent(pos.x, canvasSize.width);
    const newY = toPercent(pos.y, canvasSize.height);

    onPositionChange({
      ...textBox,
      x: Math.max(0, Math.min(100 - newWidth, newX)),
      y: Math.max(0, Math.min(100 - newHeight, newY)),
      width: Math.max(5, Math.min(100, newWidth)),
      height: Math.max(3, Math.min(100, newHeight))
    });
  };

  // Calculate font size based on box height and fontSize setting
  const getFontSize = () => {
    const baseSize = Math.min(pixelPosition.height * 0.6, 48);
    const scale = textBox.fontSize ? textBox.fontSize / 100 : 1;
    return Math.max(10, baseSize * scale);
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
      onDoubleClick={handleDoubleClick}
      bounds="parent"
      minWidth={canvasSize.width * 0.05}
      minHeight={canvasSize.height * 0.03}
      disableDragging={disabled || isEditing}
      enableResizing={!disabled && !isEditing}
      style={{
        cursor: isEditing ? 'text' : (disabled ? 'default' : 'move'),
        zIndex: isSelected ? 10 : 2
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
          padding: '8px',
          boxSizing: 'border-box',
          backgroundColor: textBox.backgroundColor || 'transparent',
          border: isSelected ? '2px solid #6366f1' : '1px dashed rgba(255, 255, 255, 0.3)',
          borderRadius: '4px',
          transition: 'border-color 0.2s',
          overflow: 'hidden',
          position: 'relative'
        }}
      >
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
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              backgroundColor: '#ef4444',
              border: 'none',
              color: 'white',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 20
            }}
            title="Delete text box"
          >
            ×
          </button>
        )}

        {/* Text content */}
        <div
          ref={textareaRef}
          contentEditable={isEditing}
          suppressContentEditableWarning={true}
          onBlur={(e) => {
            if (isEditing) {
              const newText = e.target.innerText;
              setIsEditing(false);
              if (onTextChange && newText !== textBox.text) {
                onTextChange({ ...textBox, text: newText });
              }
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.target.innerText = textBox.text || '';
              setIsEditing(false);
            }
          }}
          style={{
            fontSize: `${getFontSize()}px`,
            fontWeight: textBox.bold ? 'bold' : (textBox.fontWeight || '400'),
            fontStyle: textBox.italic ? 'italic' : 'normal',
            textDecoration: textBox.underline ? 'underline' : 'none',
            color: textBox.color || '#FFFFFF',
            opacity: textBox.opacity !== undefined ? textBox.opacity : 1,
            textAlign: textBox.textAlign || 'center',
            textShadow: '2px 2px 4px rgba(0, 0, 0, 0.5)',
            overflow: 'hidden',
            width: '100%',
            pointerEvents: isEditing ? 'auto' : 'none',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            outline: 'none',
            cursor: isEditing ? 'text' : 'inherit'
          }}
        >
          {textBox.text || 'Text'}
        </div>
      </div>
    </Rnd>
  );
};

export default PresentationTextBox;
