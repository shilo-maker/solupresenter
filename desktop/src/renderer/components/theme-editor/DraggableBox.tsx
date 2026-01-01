import React, { useCallback } from 'react';
import { Rnd } from 'react-rnd';

export interface BackgroundBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  opacity: number;
  borderRadius: number;
}

interface DraggableBoxProps {
  box: BackgroundBox;
  canvasWidth: number;
  canvasHeight: number;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (box: BackgroundBox) => void;
  onDelete: () => void;
}

const DraggableBox: React.FC<DraggableBoxProps> = ({
  box,
  canvasWidth,
  canvasHeight,
  isSelected,
  onSelect,
  onUpdate,
  onDelete
}) => {
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
    const newX = clamp(toPercent(d.x, canvasWidth), 0, 100 - box.width);
    const newY = clamp(toPercent(d.y, canvasHeight), 0, 100 - box.height);
    onUpdate({
      ...box,
      x: newX,
      y: newY
    });
  }, [canvasWidth, canvasHeight, box, onUpdate, toPercent]);

  const handleResizeStop = useCallback((
    e: any,
    direction: string,
    ref: HTMLElement,
    delta: { width: number; height: number },
    pos: { x: number; y: number }
  ) => {
    const newWidth = clamp(toPercent(ref.offsetWidth, canvasWidth), 5, 100);
    const newHeight = clamp(toPercent(ref.offsetHeight, canvasHeight), 5, 100);
    const newX = clamp(toPercent(pos.x, canvasWidth), 0, 100 - newWidth);
    const newY = clamp(toPercent(pos.y, canvasHeight), 0, 100 - newHeight);

    onUpdate({
      ...box,
      x: newX,
      y: newY,
      width: newWidth,
      height: newHeight
    });
  }, [canvasWidth, canvasHeight, box, onUpdate, toPercent]);

  const pixelX = toPixels(box.x, canvasWidth);
  const pixelY = toPixels(box.y, canvasHeight);
  const pixelWidth = toPixels(box.width, canvasWidth);
  const pixelHeight = toPixels(box.height, canvasHeight);

  return (
    <Rnd
      position={{ x: pixelX, y: pixelY }}
      size={{ width: pixelWidth, height: pixelHeight }}
      onDragStop={handleDragStop}
      onResizeStop={handleResizeStop}
      onMouseDown={onSelect}
      bounds="parent"
      minWidth={toPixels(5, canvasWidth)}
      minHeight={toPixels(5, canvasHeight)}
      style={{
        zIndex: 1,
        cursor: 'move'
      }}
      enableResizing={{
        top: true,
        right: true,
        bottom: true,
        left: true,
        topRight: true,
        bottomRight: true,
        bottomLeft: true,
        topLeft: true
      }}
    >
      <div
        onClick={onSelect}
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: box.color,
          opacity: box.opacity,
          borderRadius: `${box.borderRadius}px`,
          border: isSelected
            ? '2px solid #00d4ff'
            : '1px dashed rgba(255,255,255,0.2)',
          boxSizing: 'border-box',
          transition: 'border-color 0.15s'
        }}
      />

      {/* Delete button */}
      {isSelected && (
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
            background: '#dc3545',
            border: 'none',
            color: 'white',
            fontSize: '12px',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100
          }}
        >
          ×
        </button>
      )}

      {/* Label */}
      {isSelected && (
        <div
          style={{
            position: 'absolute',
            top: '-20px',
            left: '0',
            background: '#00d4ff',
            color: 'black',
            fontSize: '10px',
            fontWeight: 600,
            padding: '2px 6px',
            borderRadius: '3px'
          }}
        >
          Box
        </div>
      )}
    </Rnd>
  );
};

export default DraggableBox;
