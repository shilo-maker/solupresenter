import React, { useCallback, useRef, useEffect } from 'react';
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

export interface SnapGuide {
  type: 'vertical' | 'horizontal';
  position: number;
  label?: 'center' | 'edge' | 'align';
}

export interface ElementBounds {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DraggableStageElementProps {
  elementType: 'header' | 'clock' | 'songTitle' | 'currentSlide' | 'nextSlide' | 'original' | 'transliteration' | 'translation' | 'nextOriginal' | 'nextTransliteration' | 'nextTranslation';
  position: StageElementPosition;
  style?: StageElementStyle;
  customColor?: string;
  isSelected: boolean;
  canvasSize: { width: number; height: number };
  onPositionChange: (position: StageElementPosition) => void;
  onSelect: () => void;
  disabled?: boolean;
  children?: React.ReactNode;
  // Snap support
  otherElements?: ElementBounds[];
  onSnapGuidesChange?: (guides: SnapGuide[]) => void;
  snapThreshold?: number;
  // Auto height support
  autoHeight?: boolean;
  measuredHeight?: number;
  onHeightMeasured?: (elementType: string, heightPercent: number) => void;
}

const ELEMENT_CONFIG: Record<string, { label: string; color: string }> = {
  header: { label: 'Header Bar', color: '#f59e0b' },
  clock: { label: 'Clock', color: '#10b981' },
  songTitle: { label: 'Song Title', color: '#3b82f6' },
  currentSlide: { label: 'Current Slide', color: '#8b5cf6' },
  nextSlide: { label: 'Next Preview', color: '#ec4899' },
  original: { label: 'Original', color: '#06b6d4' },
  transliteration: { label: 'Transliteration', color: '#f59e0b' },
  translation: { label: 'Translation', color: '#28a745' },
  nextOriginal: { label: 'Next Original', color: '#06b6d4' },
  nextTransliteration: { label: 'Next Translit.', color: '#f59e0b' },
  nextTranslation: { label: 'Next Translation', color: '#28a745' }
};

interface DragSnap {
  value: number;
  distance: number;
  guide: SnapGuide;
}

const DraggableStageElement: React.FC<DraggableStageElementProps> = ({
  elementType,
  position,
  style,
  customColor,
  isSelected,
  canvasSize,
  onPositionChange,
  onSelect,
  disabled = false,
  autoHeight = false,
  measuredHeight,
  onHeightMeasured,
  children,
  otherElements = [],
  onSnapGuidesChange,
  snapThreshold = 1.5
}) => {
  const lastDragCallRef = useRef<number>(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const THROTTLE_MS = 16;

  // Measure content height for auto-height mode
  useEffect(() => {
    if (autoHeight && contentRef.current && onHeightMeasured) {
      requestAnimationFrame(() => {
        if (contentRef.current) {
          const heightPx = contentRef.current.scrollHeight;
          // Convert to percentage of canvas height
          const heightPercent = (heightPx / canvasSize.height) * 100;
          onHeightMeasured(elementType, heightPercent);
        }
      });
    }
  }, [autoHeight, children, canvasSize.height, elementType, onHeightMeasured]);

  // Convert percentage to pixels
  const toPixels = useCallback((percent: number, dimension: number) => (percent / 100) * dimension, []);

  // Convert pixels to percentage
  const toPercent = useCallback((pixels: number, dimension: number) => (pixels / dimension) * 100, []);

  // Clamp value
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

  // Calculate snap position
  const calculateSnap = useCallback((
    currentX: number,
    currentY: number,
    currentWidth: number,
    currentHeight: number
  ): { x: number; y: number; guides: SnapGuide[] } => {
    const guides: SnapGuide[] = [];

    if (currentWidth <= 0 || currentHeight <= 0) {
      return { x: currentX, y: currentY, guides };
    }

    let bestSnapX: DragSnap | null = null;
    let bestSnapY: DragSnap | null = null;

    const trySnapX = (snappedValue: number, distance: number, guide: SnapGuide, priority: number) => {
      const adjustedDistance = distance + priority * 0.001;
      if (!bestSnapX || adjustedDistance < bestSnapX.distance) {
        bestSnapX = { value: snappedValue, distance: adjustedDistance, guide };
      }
    };

    const trySnapY = (snappedValue: number, distance: number, guide: SnapGuide, priority: number) => {
      const adjustedDistance = distance + priority * 0.001;
      if (!bestSnapY || adjustedDistance < bestSnapY.distance) {
        bestSnapY = { value: snappedValue, distance: adjustedDistance, guide };
      }
    };

    const canvasCenterX = 50;
    const canvasCenterY = 50;

    const myLeft = currentX;
    const myRight = currentX + currentWidth;
    const myCenterX = currentX + currentWidth / 2;
    const myTop = currentY;
    const myBottom = currentY + currentHeight;
    const myCenterY = currentY + currentHeight / 2;

    // Priority 0: Canvas center
    const centerXDist = Math.abs(myCenterX - canvasCenterX);
    if (centerXDist < snapThreshold) {
      const snappedValue = canvasCenterX - currentWidth / 2;
      if (snappedValue >= 0 && snappedValue + currentWidth <= 100) {
        trySnapX(snappedValue, centerXDist, { type: 'vertical', position: canvasCenterX, label: 'center' }, 0);
      }
    }

    const centerYDist = Math.abs(myCenterY - canvasCenterY);
    if (centerYDist < snapThreshold) {
      const snappedValue = canvasCenterY - currentHeight / 2;
      if (snappedValue >= 0 && snappedValue + currentHeight <= 100) {
        trySnapY(snappedValue, centerYDist, { type: 'horizontal', position: canvasCenterY, label: 'center' }, 0);
      }
    }

    // Priority 1: Canvas edges
    const leftEdgeDist = Math.abs(myLeft);
    if (leftEdgeDist < snapThreshold) {
      trySnapX(0, leftEdgeDist, { type: 'vertical', position: 0, label: 'edge' }, 1);
    }

    const rightEdgeDist = Math.abs(myRight - 100);
    if (rightEdgeDist < snapThreshold && currentWidth <= 100) {
      trySnapX(100 - currentWidth, rightEdgeDist, { type: 'vertical', position: 100, label: 'edge' }, 1);
    }

    const topEdgeDist = Math.abs(myTop);
    if (topEdgeDist < snapThreshold) {
      trySnapY(0, topEdgeDist, { type: 'horizontal', position: 0, label: 'edge' }, 1);
    }

    const bottomEdgeDist = Math.abs(myBottom - 100);
    if (bottomEdgeDist < snapThreshold && currentHeight <= 100) {
      trySnapY(100 - currentHeight, bottomEdgeDist, { type: 'horizontal', position: 100, label: 'edge' }, 1);
    }

    // Priority 2: Other elements
    for (const other of otherElements) {
      if (other.id === elementType) continue;
      if (other.width <= 0 || other.height <= 0) continue;

      const otherLeft = other.x;
      const otherRight = other.x + other.width;
      const otherCenterX = other.x + other.width / 2;
      const otherTop = other.y;
      const otherBottom = other.y + other.height;
      const otherCenterY = other.y + other.height / 2;

      // Left to left
      const leftToLeftDist = Math.abs(myLeft - otherLeft);
      if (leftToLeftDist < snapThreshold) {
        trySnapX(otherLeft, leftToLeftDist, { type: 'vertical', position: otherLeft, label: 'align' }, 2);
      }

      // Right to right
      const rightToRightDist = Math.abs(myRight - otherRight);
      if (rightToRightDist < snapThreshold) {
        const snappedValue = otherRight - currentWidth;
        if (snappedValue >= 0) {
          trySnapX(snappedValue, rightToRightDist, { type: 'vertical', position: otherRight, label: 'align' }, 2);
        }
      }

      // Center to center X
      const centerToCenterXDist = Math.abs(myCenterX - otherCenterX);
      if (centerToCenterXDist < snapThreshold) {
        const snappedValue = otherCenterX - currentWidth / 2;
        if (snappedValue >= 0 && snappedValue + currentWidth <= 100) {
          trySnapX(snappedValue, centerToCenterXDist, { type: 'vertical', position: otherCenterX, label: 'align' }, 2);
        }
      }

      // Left to right
      const leftToRightDist = Math.abs(myLeft - otherRight);
      if (leftToRightDist < snapThreshold) {
        trySnapX(otherRight, leftToRightDist, { type: 'vertical', position: otherRight, label: 'align' }, 2);
      }

      // Right to left
      const rightToLeftDist = Math.abs(myRight - otherLeft);
      if (rightToLeftDist < snapThreshold) {
        const snappedValue = otherLeft - currentWidth;
        if (snappedValue >= 0) {
          trySnapX(snappedValue, rightToLeftDist, { type: 'vertical', position: otherLeft, label: 'align' }, 2);
        }
      }

      // Top to top
      const topToTopDist = Math.abs(myTop - otherTop);
      if (topToTopDist < snapThreshold) {
        trySnapY(otherTop, topToTopDist, { type: 'horizontal', position: otherTop, label: 'align' }, 2);
      }

      // Bottom to bottom
      const bottomToBottomDist = Math.abs(myBottom - otherBottom);
      if (bottomToBottomDist < snapThreshold) {
        const snappedValue = otherBottom - currentHeight;
        if (snappedValue >= 0) {
          trySnapY(snappedValue, bottomToBottomDist, { type: 'horizontal', position: otherBottom, label: 'align' }, 2);
        }
      }

      // Center to center Y
      const centerToCenterYDist = Math.abs(myCenterY - otherCenterY);
      if (centerToCenterYDist < snapThreshold) {
        const snappedValue = otherCenterY - currentHeight / 2;
        if (snappedValue >= 0 && snappedValue + currentHeight <= 100) {
          trySnapY(snappedValue, centerToCenterYDist, { type: 'horizontal', position: otherCenterY, label: 'align' }, 2);
        }
      }

      // Top to bottom
      const topToBottomDist = Math.abs(myTop - otherBottom);
      if (topToBottomDist < snapThreshold) {
        trySnapY(otherBottom, topToBottomDist, { type: 'horizontal', position: otherBottom, label: 'align' }, 2);
      }

      // Bottom to top
      const bottomToTopDist = Math.abs(myBottom - otherTop);
      if (bottomToTopDist < snapThreshold) {
        const snappedValue = otherTop - currentHeight;
        if (snappedValue >= 0) {
          trySnapY(snappedValue, bottomToTopDist, { type: 'horizontal', position: otherTop, label: 'align' }, 2);
        }
      }
    }

    const snappedX = bestSnapX ? (bestSnapX as DragSnap).value : currentX;
    const snappedY = bestSnapY ? (bestSnapY as DragSnap).value : currentY;

    if (bestSnapX) guides.push((bestSnapX as DragSnap).guide);
    if (bestSnapY) guides.push((bestSnapY as DragSnap).guide);

    return { x: snappedX, y: snappedY, guides };
  }, [otherElements, snapThreshold, elementType]);

  // Calculate pixel position and size from percentage
  // Use measured height for auto-height mode, otherwise use stored height
  const effectiveHeight = autoHeight && measuredHeight !== undefined ? measuredHeight : position.height;
  const pixelPosition = {
    x: toPixels(position.x, canvasSize.width),
    y: toPixels(position.y, canvasSize.height),
    width: toPixels(position.width, canvasSize.width),
    height: toPixels(effectiveHeight, canvasSize.height)
  };

  // Handle drag - show guides
  const handleDrag = useCallback((e: any, d: { x: number; y: number }) => {
    if (!onSnapGuidesChange) return;

    const now = Date.now();
    if (now - lastDragCallRef.current < THROTTLE_MS) return;
    lastDragCallRef.current = now;

    const currentX = toPercent(d.x, canvasSize.width);
    const currentY = toPercent(d.y, canvasSize.height);
    const { guides } = calculateSnap(currentX, currentY, position.width, position.height);
    onSnapGuidesChange(guides);
  }, [canvasSize, position.width, position.height, calculateSnap, toPercent, onSnapGuidesChange]);

  // Handle drag end - apply snap and convert back to percentages
  const handleDragStop = useCallback((e: any, d: { x: number; y: number }) => {
    if (onSnapGuidesChange) {
      onSnapGuidesChange([]);
    }

    const currentX = toPercent(d.x, canvasSize.width);
    const currentY = toPercent(d.y, canvasSize.height);

    const { x: snappedX, y: snappedY } = calculateSnap(currentX, currentY, position.width, position.height);

    onPositionChange({
      ...position,
      x: clamp(snappedX, 0, 100 - position.width),
      y: clamp(snappedY, 0, 100 - position.height)
    });
  }, [canvasSize, position, onPositionChange, toPercent, calculateSnap, onSnapGuidesChange]);

  // Handle resize end - convert back to percentages
  const handleResizeStop = useCallback((
    e: any,
    direction: string,
    ref: HTMLElement,
    delta: { width: number; height: number },
    pos: { x: number; y: number }
  ) => {
    if (onSnapGuidesChange) {
      onSnapGuidesChange([]);
    }

    const newWidth = toPercent(ref.offsetWidth, canvasSize.width);
    const newHeight = toPercent(ref.offsetHeight, canvasSize.height);
    const newX = toPercent(pos.x, canvasSize.width);
    const newY = toPercent(pos.y, canvasSize.height);

    onPositionChange({
      x: clamp(newX, 0, 100 - newWidth),
      y: clamp(newY, 0, 100 - newHeight),
      width: clamp(newWidth, 5, 100),
      height: clamp(newHeight, 3, 100)
    });
  }, [canvasSize, onPositionChange, toPercent, onSnapGuidesChange]);

  const baseConfig = ELEMENT_CONFIG[elementType] || { label: elementType, color: '#6366f1' };
  const config = { ...baseConfig, color: customColor || baseConfig.color };

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
      onDrag={handleDrag}
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
      enableResizing={disabled ? false : {
        top: !autoHeight,
        right: true,
        bottom: !autoHeight,
        left: true,
        topRight: !autoHeight,
        bottomRight: !autoHeight,
        bottomLeft: !autoHeight,
        topLeft: !autoHeight
      }}
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
        <div ref={contentRef} style={{ width: '100%' }}>
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
        {/* Auto height indicator */}
        {autoHeight && isSelected && (
          <span style={{
            position: 'absolute',
            bottom: '4px',
            right: '8px',
            background: 'rgba(100,200,255,0.4)',
            padding: '1px 4px',
            borderRadius: '2px',
            fontSize: '9px',
            color: 'white'
          }}>
            Auto
          </span>
        )}
      </div>
    </Rnd>
  );
};

export default DraggableStageElement;
