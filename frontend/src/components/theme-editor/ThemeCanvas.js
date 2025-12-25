import React, { useRef, useEffect, useState } from 'react';
import DraggableTextBox from './DraggableTextBox';

const SAMPLE_TEXTS = {
  original: 'שיר השירים אשר לשלמה',
  transliteration: "Shir hashirim asher l'Shlomo",
  translation: "The Song of Songs, which is Solomon's"
};

const ThemeCanvas = ({
  canvasDimensions, // { width, height } - reference resolution
  linePositions, // { original: { x, y, width, height }, ... }
  lineStyles, // { original: { fontSize, fontWeight, color, opacity, visible }, ... }
  lineOrder, // ['original', 'transliteration', 'translation']
  selectedLine,
  onPositionChange, // (lineType, position) => void
  onSelectLine, // (lineType) => void
  viewerBackground, // { type, color }
  disabled
}) => {
  const containerRef = useRef(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 450 });

  // Calculate scaled canvas size maintaining aspect ratio
  useEffect(() => {
    const updateCanvasSize = () => {
      if (!containerRef.current) return;

      const containerWidth = containerRef.current.offsetWidth;
      const maxWidth = Math.min(containerWidth - 40, 900); // Leave some padding
      const aspectRatio = canvasDimensions.height / canvasDimensions.width;
      const height = maxWidth * aspectRatio;

      setCanvasSize({
        width: maxWidth,
        height: height
      });
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, [canvasDimensions]);

  // Get background style based on viewerBackground settings
  const getBackgroundStyle = () => {
    if (viewerBackground?.type === 'transparent') {
      // Checkerboard pattern for transparent
      return {
        background: `
          linear-gradient(45deg, #2a2a2a 25%, transparent 25%),
          linear-gradient(-45deg, #2a2a2a 25%, transparent 25%),
          linear-gradient(45deg, transparent 75%, #2a2a2a 75%),
          linear-gradient(-45deg, transparent 75%, #2a2a2a 75%)
        `,
        backgroundSize: '20px 20px',
        backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
        backgroundColor: '#1a1a1a'
      };
    }

    if (viewerBackground?.type === 'color' && viewerBackground?.color) {
      return {
        background: viewerBackground.color
      };
    }

    // Default - dark gradient (mimics default viewer background)
    return {
      background: 'linear-gradient(-45deg, #0a0a0a, #1a1a2e, #16161d, #1f1f1f)',
      backgroundSize: '400% 400%'
    };
  };

  // Default positions if not provided
  const defaultPositions = {
    original: { x: 10, y: 15, width: 80, height: 22 },
    transliteration: { x: 10, y: 40, width: 80, height: 18 },
    translation: { x: 10, y: 62, width: 80, height: 18 }
  };

  const positions = linePositions || defaultPositions;
  const order = lineOrder || ['original', 'transliteration', 'translation'];

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      {/* Canvas container with aspect ratio */}
      <div
        style={{
          width: canvasSize.width,
          height: canvasSize.height,
          margin: '0 auto',
          position: 'relative',
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          ...getBackgroundStyle()
        }}
        onClick={(e) => {
          // Deselect when clicking canvas background
          if (e.target === e.currentTarget) {
            onSelectLine(null);
          }
        }}
      >
        {/* Resolution indicator */}
        <div
          style={{
            position: 'absolute',
            bottom: '8px',
            right: '8px',
            fontSize: '11px',
            color: 'rgba(255, 255, 255, 0.4)',
            fontFamily: 'monospace',
            pointerEvents: 'none',
            zIndex: 10
          }}
        >
          {canvasDimensions.width} x {canvasDimensions.height}
        </div>

        {/* Draggable text boxes */}
        {order.map((lineType) => {
          const position = positions[lineType];
          const style = lineStyles?.[lineType];

          if (!position) return null;

          return (
            <DraggableTextBox
              key={lineType}
              lineType={lineType}
              position={position}
              style={style}
              isSelected={selectedLine === lineType}
              canvasSize={canvasSize}
              onPositionChange={(newPosition) => onPositionChange(lineType, newPosition)}
              onSelect={() => onSelectLine(lineType)}
              sampleText={SAMPLE_TEXTS[lineType]}
              disabled={disabled}
            />
          );
        })}
      </div>

      {/* Instructions */}
      {!disabled && (
        <div
          style={{
            textAlign: 'center',
            marginTop: '12px',
            fontSize: '0.85rem',
            color: 'rgba(255, 255, 255, 0.5)'
          }}
        >
          Drag boxes to reposition • Drag edges to resize • Click to select and edit style
        </div>
      )}
    </div>
  );
};

export default ThemeCanvas;
