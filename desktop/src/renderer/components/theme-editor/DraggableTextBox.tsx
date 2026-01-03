import React, { useCallback, useState, useRef, useEffect } from 'react';
import { Rnd } from 'react-rnd';

export interface LinePosition {
  x: number;
  y: number;
  width: number;
  height: number;
  paddingTop: number;
  paddingBottom: number;
  alignH: 'left' | 'center' | 'right';
  alignV: 'top' | 'center' | 'bottom';
}

export interface LineStyle {
  fontSize: number;
  fontWeight: string;
  color: string;
  opacity: number;
  visible: boolean;
}

interface DraggableTextBoxProps {
  lineType: string;  // Flexible to support song, bible, and prayer line types
  position: LinePosition;
  style: LineStyle;
  canvasWidth: number;
  canvasHeight: number;
  // Reference dimensions for consistent font sizing
  refWidth: number;
  refHeight: number;
  isSelected: boolean;
  onSelect: () => void;
  onPositionChange: (position: LinePosition) => void;
  // Custom preview text (not saved with theme)
  previewText?: string;
  onPreviewTextChange?: (lineType: string, text: string) => void;
}

const DEFAULT_SAMPLE_TEXT: Record<string, string> = {
  original: 'שִׁירוּ לַיהוָה שִׁיר חָדָשׁ',
  transliteration: 'Shiru lAdonai shir chadash',
  translation: 'Sing to the Lord a new song'
};

const LINE_COLORS: Record<string, string> = {
  original: '#FF8C42',
  transliteration: '#667eea',
  translation: '#28a745'
};

const DraggableTextBox: React.FC<DraggableTextBoxProps> = ({
  lineType,
  position,
  style,
  canvasWidth,
  canvasHeight,
  refWidth,
  refHeight,
  isSelected,
  onSelect,
  onPositionChange,
  previewText,
  onPreviewTextChange
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  // Get display text
  const displayText = previewText || DEFAULT_SAMPLE_TEXT[lineType];

  // Handle double-click to enter edit mode
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditText(displayText);
    setIsEditing(true);
  };

  // Handle blur to exit edit mode
  const handleBlur = () => {
    setIsEditing(false);
    if (onPreviewTextChange && editText !== DEFAULT_SAMPLE_TEXT[lineType]) {
      onPreviewTextChange(lineType, editText);
    }
  };

  // Handle key press in textarea
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsEditing(false);
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleBlur();
    }
  };

  // Convert percentage to pixels
  const toPixels = useCallback((percent: number, dimension: number) => {
    return (percent / 100) * dimension;
  }, []);

  // Convert pixels to percentage
  const toPercent = useCallback((pixels: number, dimension: number) => {
    return (pixels / dimension) * 100;
  }, []);

  // Clamp value between min and max
  const clamp = (value: number, min: number, max: number) => {
    return Math.max(min, Math.min(max, value));
  };

  const handleDragStop = useCallback((e: any, d: { x: number; y: number }) => {
    const newX = clamp(toPercent(d.x, canvasWidth), 0, 100 - position.width);
    const newY = clamp(toPercent(d.y, canvasHeight), 0, 100 - position.height);
    onPositionChange({
      ...position,
      x: newX,
      y: newY
    });
  }, [canvasWidth, canvasHeight, position, onPositionChange, toPercent]);

  const handleResizeStop = useCallback((
    e: any,
    direction: string,
    ref: HTMLElement,
    delta: { width: number; height: number },
    pos: { x: number; y: number }
  ) => {
    const newWidth = clamp(toPercent(ref.offsetWidth, canvasWidth), 10, 100);
    const newHeight = clamp(toPercent(ref.offsetHeight, canvasHeight), 5, 100);
    const newX = clamp(toPercent(pos.x, canvasWidth), 0, 100 - newWidth);
    const newY = clamp(toPercent(pos.y, canvasHeight), 0, 100 - newHeight);

    onPositionChange({
      ...position,
      x: newX,
      y: newY,
      width: newWidth,
      height: newHeight
    });
  }, [canvasWidth, canvasHeight, position, onPositionChange, toPercent]);

  if (!style.visible) {
    return null;
  }

  const pixelX = toPixels(position.x, canvasWidth);
  const pixelY = toPixels(position.y, canvasHeight);
  const pixelWidth = toPixels(position.width, canvasWidth);
  const pixelHeight = toPixels(position.height, canvasHeight);

  // Calculate font size: same formula as SlideRenderer, then scale to canvas
  // SlideRenderer: baseFontSize = refHeight * 0.05, then multiplied by style.fontSize/100
  // We apply the same calculation, then scale by the ratio of canvas to reference
  const scale = canvasWidth / refWidth;
  const baseFontSizeAtRef = refHeight * 0.05; // 5% of reference height (54px at 1080p)
  const fontSizeAtRef = baseFontSizeAtRef * (style.fontSize / 100);
  const fontSize = fontSizeAtRef * scale;

  // Get text alignment style
  const getJustifyContent = () => {
    switch (position.alignH) {
      case 'left': return 'flex-start';
      case 'right': return 'flex-end';
      default: return 'center';
    }
  };

  const getAlignItems = () => {
    switch (position.alignV) {
      case 'top': return 'flex-start';
      case 'bottom': return 'flex-end';
      default: return 'center';
    }
  };

  return (
    <Rnd
      position={{ x: pixelX, y: pixelY }}
      size={{ width: pixelWidth, height: pixelHeight }}
      onDragStop={handleDragStop}
      onResizeStop={handleResizeStop}
      onMouseDown={onSelect}
      bounds="parent"
      minWidth={toPixels(10, canvasWidth)}
      minHeight={toPixels(5, canvasHeight)}
      disableDragging={isEditing}
      enableResizing={isEditing ? false : {
        top: true,
        right: true,
        bottom: true,
        left: true,
        topRight: true,
        bottomRight: true,
        bottomLeft: true,
        topLeft: true
      }}
      style={{
        zIndex: isSelected ? 10 : 2,
        cursor: isEditing ? 'text' : 'move'
      }}
    >
      <div
        onClick={onSelect}
        onDoubleClick={handleDoubleClick}
        style={{
          width: '100%',
          height: '100%',
          border: isSelected
            ? `2px solid ${LINE_COLORS[lineType]}`
            : '1px dashed rgba(255,255,255,0.3)',
          borderRadius: '4px',
          backgroundColor: isSelected
            ? `${LINE_COLORS[lineType]}15`
            : 'transparent',
          display: 'flex',
          justifyContent: getJustifyContent(),
          alignItems: getAlignItems(),
          padding: `${position.paddingTop}% 2% ${position.paddingBottom}%`,
          boxSizing: 'border-box',
          overflow: 'hidden',
          transition: 'border-color 0.15s, background-color 0.15s',
          cursor: isEditing ? 'text' : 'move'
        }}
      >
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            style={{
              fontSize: `${fontSize}px`,
              fontWeight: style.fontWeight,
              color: style.color,
              opacity: style.opacity,
              textAlign: position.alignH,
              direction: ['original', 'hebrew', 'subtitle', 'description', 'title'].includes(lineType) ? 'rtl' : 'ltr',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              resize: 'none',
              width: '100%',
              height: '100%',
              padding: 0,
              margin: 0,
              fontFamily: 'inherit',
              lineHeight: 1.4
            }}
          />
        ) : (
          <span
            style={{
              fontSize: `${fontSize}px`,
              fontWeight: style.fontWeight,
              color: style.color,
              opacity: style.opacity,
              textAlign: position.alignH,
              direction: ['original', 'hebrew', 'subtitle', 'description', 'title'].includes(lineType) ? 'rtl' : 'ltr',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              overflow: 'hidden',
              width: '100%',
              lineHeight: 1.4
            }}
          >
            {displayText}
          </span>
        )}
      </div>

      {/* Label */}
      {isSelected && (
        <div
          style={{
            position: 'absolute',
            top: '-20px',
            left: '0',
            background: LINE_COLORS[lineType],
            color: 'white',
            fontSize: '10px',
            fontWeight: 600,
            padding: '2px 6px',
            borderRadius: '3px',
            textTransform: 'capitalize'
          }}
        >
          {lineType}
        </div>
      )}
    </Rnd>
  );
};

export default DraggableTextBox;
