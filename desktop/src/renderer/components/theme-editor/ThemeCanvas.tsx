import React, { useRef, useState, useEffect, useLayoutEffect, useCallback, useMemo, memo } from 'react';
import DraggableTextBox, { LinePosition, LineStyle, SnapGuide, ElementBounds } from './DraggableTextBox';
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
  selectedElement: { type: 'line' | 'box' | 'reference' | 'referenceTranslation' | 'referenceEnglish'; id: string } | null;
  onSelectElement: (element: { type: 'line' | 'box' | 'reference' | 'referenceTranslation' | 'referenceEnglish'; id: string } | null) => void;
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

  // For flow positioning: track measured heights and calculated positions
  const [flowCalculatedY, setFlowCalculatedY] = useState<Record<string, number>>({});
  // For auto-height: track measured heights from DraggableTextBox
  const [measuredHeights, setMeasuredHeights] = useState<Record<string, number>>({});
  // For snap guides
  const [activeSnapGuides, setActiveSnapGuides] = useState<SnapGuide[]>([]);

  // Callback for DraggableTextBox to report measured height
  const handleHeightMeasured = useCallback((lineType: string, height: number) => {
    setMeasuredHeights(prev => {
      // Only update if height actually changed (prevent infinite loops)
      if (prev[lineType] === height) return prev;
      return { ...prev, [lineType]: height };
    });
  }, []);

  // Callback for snap guides
  const handleSnapGuidesChange = useCallback((guides: SnapGuide[]) => {
    setActiveSnapGuides(guides);
  }, []);

  // Build element bounds for snap detection
  const otherElements = useMemo((): ElementBounds[] => {
    const elements: ElementBounds[] = [];

    // Add text boxes
    lineOrder.forEach(lineType => {
      const position = linePositions[lineType];
      const style = lineStyles[lineType];
      if (!position || !style || style.visible === false) return;

      // Use calculated Y for flow mode, otherwise use stored position
      const effectiveY = position.positionMode === 'flow' && flowCalculatedY[lineType] !== undefined
        ? flowCalculatedY[lineType]
        : position.y;

      // Use measured height for auto-height mode, otherwise use stored height
      const effectiveHeight = position.autoHeight && measuredHeights[lineType] !== undefined
        ? measuredHeights[lineType]
        : position.height;

      elements.push({
        id: lineType,
        x: position.x,
        y: effectiveY,
        width: position.width,
        height: effectiveHeight
      });
    });

    // Add background boxes
    backgroundBoxes.forEach(box => {
      if (box.visible === false) return;
      elements.push({
        id: box.id,
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height
      });
    });

    return elements;
  }, [lineOrder, linePositions, lineStyles, flowCalculatedY, measuredHeights, backgroundBoxes]);

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

  // Calculate flow positions for editor preview
  useLayoutEffect(() => {
    const newFlowPositions: Record<string, number> = {};

    // Process line order to calculate flow positions
    lineOrder.forEach((lineType) => {
      const position = linePositions[lineType];
      if (!position || position.positionMode !== 'flow') return;

      let calculatedY: number;

      if (!position.flowAnchor) {
        // No anchor - use stored Y as starting position
        calculatedY = position.y || 0;
      } else {
        const anchorPosition = linePositions[position.flowAnchor];
        if (anchorPosition) {
          // Get anchor's Y position (calculated if it's also flow, or stored)
          const anchorY = newFlowPositions[position.flowAnchor] ?? anchorPosition.y;

          if (position.flowBeside) {
            // Beside mode: use same Y position as anchor
            calculatedY = anchorY;
          } else {
            // Below mode: position below the anchor
            // Get anchor's height - use measured height if autoHeight, otherwise stored height
            // If autoHeight is enabled but no measured height, content is empty - treat as 0 height
            const hasMeasuredHeight = measuredHeights[position.flowAnchor] !== undefined;
            let anchorHeight: number;
            if (anchorPosition.autoHeight) {
              anchorHeight = hasMeasuredHeight ? measuredHeights[position.flowAnchor] : 0;
            } else {
              anchorHeight = anchorPosition.height;
            }
            // Calculate Y = anchor Y + anchor height + gap
            const gap = position.flowGap ?? 0;
            calculatedY = anchorY + anchorHeight + gap;
          }
        } else {
          // Anchor not found, use stored position
          calculatedY = position.y;
        }
      }

      newFlowPositions[lineType] = calculatedY;
    });

    setFlowCalculatedY(newFlowPositions);
  }, [lineOrder, linePositions, measuredHeights]);

  // Get background style
  const getBackgroundStyle = useCallback((): React.CSSProperties => {
    if (viewerBackground.type === 'transparent') {
      return {
        background: 'repeating-conic-gradient(#2a2a2a 0% 25%, #1a1a1a 0% 50%) 50% / 16px 16px'
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
            otherElements={otherElements}
            onSnapGuidesChange={handleSnapGuidesChange}
            snapThreshold={1.5}
          />
        ))}

        {/* Text boxes (z-index: 2) */}
        {lineOrder.map(lineType => {
          const position = linePositions[lineType];
          const style = lineStyles[lineType];
          if (!position || !style) {
            return null;
          }
          // Skip rendering if not visible (but still show in layers panel)
          if (style.visible === false) return null;

          // Determine element type for selection
          // 'reference' → type 'reference', 'referenceTranslation' → type 'referenceTranslation', 'referenceEnglish' → type 'referenceEnglish'
          const elementType = lineType === 'reference' ? 'reference' :
                              lineType === 'referenceTranslation' ? 'referenceTranslation' :
                              lineType === 'referenceEnglish' ? 'referenceEnglish' : 'line';
          const isSelected = selectedElement?.id === lineType &&
            (selectedElement?.type === elementType || selectedElement?.type === 'line');

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
              isSelected={isSelected}
              onSelect={() => onSelectElement({ type: elementType, id: lineType })}
              onPositionChange={(newPosition) => onLinePositionChange(lineType, newPosition)}
              previewText={previewTexts?.[lineType]}
              onPreviewTextChange={onPreviewTextChange}
              calculatedY={flowCalculatedY[lineType]}
              onHeightMeasured={handleHeightMeasured}
              measuredHeight={measuredHeights[lineType]}
              otherElements={otherElements}
              onSnapGuidesChange={handleSnapGuidesChange}
              snapThreshold={1.5}
            />
          );
        })}

        {/* Snap guide lines (z-index: 100) */}
        {activeSnapGuides.map((guide) => (
          <div
            key={`guide-${guide.type}-${guide.position.toFixed(2)}-${guide.label || 'none'}`}
            style={{
              position: 'absolute',
              zIndex: 100,
              pointerEvents: 'none',
              ...(guide.type === 'vertical' ? {
                left: `${guide.position}%`,
                top: 0,
                width: '1px',
                height: '100%',
                background: guide.label === 'center'
                  ? 'rgba(255, 100, 100, 0.8)'
                  : guide.label === 'edge'
                    ? 'rgba(100, 200, 255, 0.8)'
                    : 'rgba(100, 255, 100, 0.8)',
                boxShadow: guide.label === 'center'
                  ? '0 0 4px rgba(255, 100, 100, 0.5)'
                  : guide.label === 'edge'
                    ? '0 0 4px rgba(100, 200, 255, 0.5)'
                    : '0 0 4px rgba(100, 255, 100, 0.5)'
              } : {
                top: `${guide.position}%`,
                left: 0,
                height: '1px',
                width: '100%',
                background: guide.label === 'center'
                  ? 'rgba(255, 100, 100, 0.8)'
                  : guide.label === 'edge'
                    ? 'rgba(100, 200, 255, 0.8)'
                    : 'rgba(100, 255, 100, 0.8)',
                boxShadow: guide.label === 'center'
                  ? '0 0 4px rgba(255, 100, 100, 0.5)'
                  : guide.label === 'edge'
                    ? '0 0 4px rgba(100, 200, 255, 0.5)'
                    : '0 0 4px rgba(100, 255, 100, 0.5)'
              })
            }}
          />
        ))}
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

export default memo(ThemeCanvas);
