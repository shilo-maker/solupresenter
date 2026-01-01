import React from 'react';
import { Rnd } from 'react-rnd';

export interface StageElementPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface StageElementStyle {
  backgroundColor?: string;
  borderRadius?: number;
  color?: string;
  fontSize?: number;
  fontWeight?: string;
  visible?: boolean;
}

interface DraggableStageElementProps {
  elementType: 'header' | 'clock' | 'songTitle' | 'currentSlide' | 'nextSlide';
  position: StageElementPosition;
  style?: StageElementStyle;
  isSelected: boolean;
  canvasSize: { width: number; height: number };
  onPositionChange: (position: StageElementPosition) => void;
  onSelect: () => void;
  disabled?: boolean;
  children?: React.ReactNode;
}

const ELEMENT_CONFIG: Record<string, { label: string; color: string }> = {
  header: { label: 'Header Bar', color: '#f59e0b' },
  clock: { label: 'Clock', color: '#10b981' },
  songTitle: { label: 'Song Title', color: '#3b82f6' },
  currentSlide: { label: 'Current Slide', color: '#8b5cf6' },
  nextSlide: { label: 'Next Preview', color: '#ec4899' }
};

const DraggableStageElement: React.FC<DraggableStageElementProps> = ({
  elementType,
  position,
  style,
  isSelected,
  canvasSize,
  onPositionChange,
  onSelect,
  disabled = false,
  children
}) => {
  // Convert percentage to pixels
  const toPixels = (percent: number, dimension: number) => (percent / 100) * dimension;

  // Convert pixels to percentage
  const toPercent = (pixels: number, dimension: number) => (pixels / dimension) * 100;

  // Calculate pixel position and size from percentage
  const pixelPosition = {
    x: toPixels(position.x, canvasSize.width),
    y: toPixels(position.y, canvasSize.height),
    width: toPixels(position.width, canvasSize.width),
    height: toPixels(position.height, canvasSize.height)
  };

  // Handle drag end - convert back to percentages
  const handleDragStop = (e: any, d: { x: number; y: number }) => {
    onPositionChange({
      ...position,
      x: Math.max(0, Math.min(100 - position.width, toPercent(d.x, canvasSize.width))),
      y: Math.max(0, Math.min(100 - position.height, toPercent(d.y, canvasSize.height)))
    });
  };

  // Handle resize end - convert back to percentages
  const handleResizeStop = (
    e: any,
    direction: string,
    ref: HTMLElement,
    delta: { width: number; height: number },
    pos: { x: number; y: number }
  ) => {
    const newWidth = toPercent(ref.offsetWidth, canvasSize.width);
    const newHeight = toPercent(ref.offsetHeight, canvasSize.height);
    const newX = toPercent(pos.x, canvasSize.width);
    const newY = toPercent(pos.y, canvasSize.height);

    onPositionChange({
      x: Math.max(0, Math.min(100 - newWidth, newX)),
      y: Math.max(0, Math.min(100 - newHeight, newY)),
      width: Math.max(5, Math.min(100, newWidth)),
      height: Math.max(3, Math.min(100, newHeight))
    });
  };

  const config = ELEMENT_CONFIG[elementType] || { label: elementType, color: '#6366f1' };

  // Get background styling
  const getBackgroundStyle = () => {
    if (style?.backgroundColor) {
      return style.backgroundColor;
    }
    return isSelected ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.05)';
  };

  // Check if element is visible
  if (style?.visible === false) {
    return null;
  }

  return (
    <Rnd
      size={{ width: pixelPosition.width, height: pixelPosition.height }}
      position={{ x: pixelPosition.x, y: pixelPosition.y }}
      onDragStop={handleDragStop}
      onResizeStop={handleResizeStop}
      onMouseDown={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      bounds="parent"
      minWidth={canvasSize.width * 0.05}
      minHeight={canvasSize.height * 0.03}
      disableDragging={disabled}
      enableResizing={!disabled}
      style={{
        cursor: disabled ? 'default' : 'move',
        zIndex: elementType === 'header' ? 1 : 2
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
          boxSizing: 'border-box',
          backgroundColor: getBackgroundStyle(),
          border: isSelected ? `2px solid ${config.color}` : '1px dashed rgba(255, 255, 255, 0.3)',
          borderRadius: style?.borderRadius ? `${style.borderRadius}px` : '4px',
          transition: 'border-color 0.2s',
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        {/* Element type label */}
        <div
          style={{
            position: 'absolute',
            top: '4px',
            left: '8px',
            fontSize: '10px',
            fontWeight: 600,
            color: isSelected ? config.color : 'rgba(255, 255, 255, 0.5)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            pointerEvents: 'none',
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            padding: '2px 6px',
            borderRadius: '3px'
          }}
        >
          {config.label}
        </div>

        {/* Render children or default preview content */}
        {children || (
          <div
            style={{
              fontSize: '14px',
              color: style?.color || 'rgba(255, 255, 255, 0.6)',
              opacity: 0.7,
              pointerEvents: 'none',
              textAlign: 'center',
              padding: '8px'
            }}
          >
            {elementType === 'clock' && '12:34'}
            {elementType === 'songTitle' && 'Song Title'}
            {elementType === 'currentSlide' && 'Current Slide Content'}
            {elementType === 'nextSlide' && 'Next Slide Preview'}
            {elementType === 'header' && ''}
          </div>
        )}
      </div>
    </Rnd>
  );
};

export default DraggableStageElement;
