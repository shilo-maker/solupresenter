import React, { useRef, useState, useEffect, useCallback } from 'react';
import DraggableTextBox, { LinePosition, LineStyle } from './DraggableTextBox';
import DraggableBox, { BackgroundBox } from './DraggableBox';

export interface CanvasDimensions {
  width: number;
  height: number;
}

export interface ViewerBackground {
  type: 'inherit' | 'color' | 'transparent';
  color: string | null;
}

interface ThemeCanvasProps {
  canvasDimensions: CanvasDimensions;
  viewerBackground: ViewerBackground;
  lineOrder: string[];  // Flexible to support song, bible, and prayer line types
  linePositions: Record<string, LinePosition>;
  lineStyles: Record<string, LineStyle>;
  backgroundBoxes: BackgroundBox[];
  selectedElement: { type: 'line' | 'box' | 'reference'; id: string } | null;
  onSelectElement: (element: { type: 'line' | 'box' | 'reference'; id: string } | null) => void;
  onLinePositionChange: (lineType: string, position: LinePosition) => void;
  onBoxUpdate: (box: BackgroundBox) => void;
  onBoxDelete: (boxId: string) => void;
  // Custom preview text (not saved with theme)
  previewTexts?: Record<string, string>;
  onPreviewTextChange?: (lineType: string, text: string) => void;
}

const ThemeCanvas: React.FC<ThemeCanvasProps> = ({
  canvasDimensions,
  viewerBackground,
  lineOrder,
  linePositions,
  lineStyles,
  backgroundBoxes,
  selectedElement,
  onSelectElement,
  onLinePositionChange,
  onBoxUpdate,
  onBoxDelete,
  previewTexts,
  onPreviewTextChange
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 640, height: 360 });

  // Update canvas size to maintain aspect ratio
  useEffect(() => {
    const updateCanvasSize = () => {
      if (!containerRef.current) return;

      const containerWidth = containerRef.current.offsetWidth;
      const maxWidth = Math.min(containerWidth - 40, 800);
      const aspectRatio = canvasDimensions.height / canvasDimensions.width;
      const height = maxWidth * aspectRatio;

      setCanvasSize({ width: maxWidth, height });
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, [canvasDimensions]);

  // Get background style
  const getBackgroundStyle = useCallback((): React.CSSProperties => {
    if (viewerBackground.type === 'transparent') {
      return {
        background: 'repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%) 50% / 20px 20px'
      };
    }
    if (viewerBackground.type === 'color' && viewerBackground.color) {
      // Check if it's a gradient
      if (viewerBackground.color.startsWith('linear-gradient') ||
          viewerBackground.color.startsWith('radial-gradient')) {
        return { background: viewerBackground.color };
      }
      return { backgroundColor: viewerBackground.color };
    }
    // Default/inherit - show black
    return { backgroundColor: '#000000' };
  }, [viewerBackground]);

  // Handle clicking on canvas background to deselect
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onSelectElement(null);
    }
  };

  return (
    <div ref={containerRef} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Resolution indicator */}
      <div style={{
        marginBottom: '8px',
        fontSize: '11px',
        color: 'rgba(255,255,255,0.5)'
      }}>
        {canvasDimensions.width} × {canvasDimensions.height}
      </div>

      {/* Canvas */}
      <div
        onClick={handleCanvasClick}
        style={{
          width: canvasSize.width,
          height: canvasSize.height,
          position: 'relative',
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          border: '1px solid rgba(255,255,255,0.1)',
          ...getBackgroundStyle()
        }}
      >
        {/* Background boxes (z-index: 1) */}
        {backgroundBoxes.map(box => (
          <DraggableBox
            key={box.id}
            box={box}
            canvasWidth={canvasSize.width}
            canvasHeight={canvasSize.height}
            isSelected={selectedElement?.type === 'box' && selectedElement?.id === box.id}
            onSelect={() => onSelectElement({ type: 'box', id: box.id })}
            onUpdate={onBoxUpdate}
            onDelete={() => onBoxDelete(box.id)}
          />
        ))}

        {/* Text boxes (z-index: 2) */}
        {lineOrder.map(lineType => {
          const position = linePositions[lineType];
          const style = lineStyles[lineType];
          if (!position || !style) return null;
          // Skip rendering if not visible (but still show in layers panel)
          if (style.visible === false) return null;

          return (
            <DraggableTextBox
              key={lineType}
              lineType={lineType}
              position={position}
              style={style}
              canvasWidth={canvasSize.width}
              canvasHeight={canvasSize.height}
              refWidth={canvasDimensions.width}
              refHeight={canvasDimensions.height}
              isSelected={selectedElement?.type === 'line' && selectedElement?.id === lineType}
              onSelect={() => onSelectElement({ type: 'line', id: lineType })}
              onPositionChange={(newPosition) => onLinePositionChange(lineType, newPosition)}
              previewText={previewTexts?.[lineType]}
              onPreviewTextChange={onPreviewTextChange}
            />
          );
        })}
      </div>

      {/* Instructions */}
      <div style={{
        marginTop: '12px',
        fontSize: '11px',
        color: 'rgba(255,255,255,0.4)',
        textAlign: 'center'
      }}>
        Drag to reposition • Resize from edges • Click to select • Double-click to edit text
      </div>
    </div>
  );
};

export default ThemeCanvas;
