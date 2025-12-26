import React, { useRef, useEffect, useState } from 'react';
import PresentationTextBox from './PresentationTextBox';

const PresentationCanvas = ({
  canvasDimensions, // { width, height } - reference resolution
  textBoxes, // Array of text box objects
  backgroundColor, // Background color for the slide
  selectedTextBoxId,
  onTextBoxChange, // (updatedTextBox) => void
  onSelectTextBox, // (textBoxId) => void
  onDeleteTextBox, // (textBoxId) => void
  disabled
}) => {
  const containerRef = useRef(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 450 });

  // Calculate scaled canvas size maintaining aspect ratio
  useEffect(() => {
    const updateCanvasSize = () => {
      if (!containerRef.current) return;

      const containerWidth = containerRef.current.offsetWidth;
      const maxWidth = Math.min(containerWidth - 40, 900);
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

  // Get background style
  const getBackgroundStyle = () => {
    if (backgroundColor) {
      return { background: backgroundColor };
    }
    // Default dark background
    return {
      background: 'linear-gradient(-45deg, #0a0a0a, #1a1a2e, #16161d, #1f1f1f)',
      backgroundSize: '400% 400%'
    };
  };

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
            onSelectTextBox(null);
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
            zIndex: 1
          }}
        >
          {canvasDimensions.width} x {canvasDimensions.height}
        </div>

        {/* Empty state hint */}
        {textBoxes.length === 0 && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              color: 'rgba(255, 255, 255, 0.3)',
              fontSize: '14px',
              textAlign: 'center',
              pointerEvents: 'none'
            }}
          >
            Click "Add Text" to add a text box
          </div>
        )}

        {/* Text boxes */}
        {textBoxes.map((textBox) => (
          <PresentationTextBox
            key={textBox.id}
            textBox={textBox}
            isSelected={selectedTextBoxId === textBox.id}
            canvasSize={canvasSize}
            onPositionChange={(updatedTextBox) => onTextBoxChange(updatedTextBox)}
            onTextChange={(updatedTextBox) => onTextBoxChange(updatedTextBox)}
            onSelect={() => onSelectTextBox(textBox.id)}
            onDelete={() => onDeleteTextBox(textBox.id)}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
};

export default PresentationCanvas;
