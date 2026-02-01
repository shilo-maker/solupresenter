import React, { useCallback, useState, useRef, useEffect, memo } from 'react';
import { Rnd } from 'react-rnd';

// Snap guide types (must be defined before DragSnap/ResizeSnap which reference them)
export interface SnapGuide {
  type: 'vertical' | 'horizontal';
  position: number; // percentage
  label?: string;
}

export interface ElementBounds {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

// Internal types for snap calculations
interface DragSnap {
  value: number;
  distance: number;
  guide: SnapGuide;
}

interface ResizeSnap {
  x: number;
  y: number;
  width: number;
  height: number;
  distance: number;
  guide: SnapGuide;
}

export interface LinePosition {
  x: number;
  y: number;
  width: number;
  height: number;
  paddingTop: number;
  paddingBottom: number;
  paddingLeft?: number;
  paddingRight?: number;
  alignH: 'left' | 'center' | 'right';
  alignV: 'top' | 'center' | 'bottom';
  // Flow positioning properties
  positionMode?: 'absolute' | 'flow';  // Default: 'absolute'
  flowGap?: number;                     // Gap below/beside box (percentage)
  flowAnchor?: string;                  // Line type to position relative to (null = top of canvas)
  flowBeside?: boolean;                 // If true, position at same Y as anchor (beside). If false, position below anchor.
  // Auto-height properties
  autoHeight?: boolean;                 // Height determined by content (default: false)
  growDirection?: 'up' | 'down';        // Direction to grow when content expands (default: 'down')
}

export interface LineStyle {
  fontSize: number;
  fontWeight: string;
  color: string;
  opacity: number;
  visible: boolean;
  // Background properties (optional) - for per-line backgrounds like OBS overlay
  backgroundColor?: string;
  backgroundOpacity?: number;
  backgroundPadding?: string;  // CSS padding, e.g. "0.15em 0.6em"
  // Border properties (optional)
  borderTop?: number;
  borderRight?: number;
  borderBottom?: number;
  borderLeft?: number;
  borderColor?: string;
  borderRadius?: number;
  // Individual corner radii (optional)
  borderRadiusTopLeft?: number;
  borderRadiusTopRight?: number;
  borderRadiusBottomRight?: number;
  borderRadiusBottomLeft?: number;
  // Text shadow properties
  textShadowColor?: string;
  textShadowBlur?: number;
  textShadowOffsetX?: number;
  textShadowOffsetY?: number;
  // Text stroke/outline properties
  textStrokeWidth?: number;
  textStrokeColor?: string;
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
  // Flow positioning: calculated Y position override from parent
  calculatedY?: number;
  // Auto-height: callback to report measured height to parent
  onHeightMeasured?: (lineType: string, height: number) => void;
  // Auto-height: measured height from parent (percentage)
  measuredHeight?: number;
  // Snap guides
  otherElements?: ElementBounds[];
  onSnapGuidesChange?: (guides: SnapGuide[]) => void;
  snapThreshold?: number; // in percentage, default 1
}

const DEFAULT_SAMPLE_TEXT: Record<string, string> = {
  // Song lines
  original: 'שִׁירוּ לַיהוָה שִׁיר חָדָשׁ',
  transliteration: 'Shiru lAdonai shir chadash',
  translation: 'Sing to the Lord a new song',
  // Bible lines
  hebrew: 'בְּרֵאשִׁית בָּרָא אֱלֹהִים',
  english: 'In the beginning God created',
  reference: 'בראשית א:א',
  referenceEnglish: 'Genesis 1:1',
  // Prayer lines
  title: 'נושאי תפילה',
  titleTranslation: 'Prayer Requests',
  subtitle: 'רפואה לחולים',
  subtitleTranslation: 'Healing for the sick',
  description: 'נא להתפלל עבור...',
  descriptionTranslation: 'Please pray for...',
  referenceTranslation: 'James 5:16'
};

const LINE_COLORS: Record<string, string> = {
  // Song lines
  original: '#06b6d4',
  transliteration: '#06b6d4',
  translation: '#28a745',
  // Bible lines
  hebrew: '#06b6d4',
  english: '#28a745',
  reference: '#f59e0b',
  referenceEnglish: '#f59e0b',
  // Prayer lines
  title: '#06b6d4',
  titleTranslation: '#28a745',
  subtitle: '#06b6d4',
  subtitleTranslation: '#28a745',
  description: '#06b6d4',
  descriptionTranslation: '#28a745',
  referenceTranslation: '#f59e0b'
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
  onPreviewTextChange,
  calculatedY,
  onHeightMeasured,
  measuredHeight,
  otherElements = [],
  onSnapGuidesChange,
  snapThreshold = 1
}) => {
  // Validate snapThreshold to prevent negative values
  const validSnapThreshold = Math.max(0, snapThreshold);

  // Determine if this box is in flow mode or auto-height mode
  const isFlowMode = position.positionMode === 'flow';
  const isAutoHeight = position.autoHeight === true;
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const lastDragCallRef = useRef<number>(0);
  const lastResizeCallRef = useRef<number>(0);
  const THROTTLE_MS = 16; // ~60fps throttle for drag/resize handlers

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  // Get display text
  const displayText = previewText || DEFAULT_SAMPLE_TEXT[lineType];

  // Measure content height for auto-height mode
  useEffect(() => {
    if (isAutoHeight && contentRef.current && onHeightMeasured) {
      // Use requestAnimationFrame to ensure DOM is fully rendered
      requestAnimationFrame(() => {
        if (contentRef.current) {
          const heightPx = contentRef.current.scrollHeight;
          // Convert to percentage of canvas height
          const heightPercent = (heightPx / canvasHeight) * 100;
          onHeightMeasured(lineType, heightPercent);
        }
      });
    }
  }, [isAutoHeight, displayText, style.fontSize, canvasHeight, lineType, onHeightMeasured]);

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

  // Calculate snap guides and return snapped position
  // Priority: canvas center > canvas edges > element alignment
  const calculateSnap = useCallback((
    currentX: number,
    currentY: number,
    currentWidth: number,
    currentHeight: number
  ): { x: number; y: number; guides: SnapGuide[] } => {
    const guides: SnapGuide[] = [];

    // Skip snap calculation for invalid dimensions
    if (currentWidth <= 0 || currentHeight <= 0) {
      return { x: currentX, y: currentY, guides };
    }

    // Track best snap for each axis (only one snap per axis)
    let bestSnapX: DragSnap | null = null;
    let bestSnapY: DragSnap | null = null;

    const trySnapX = (snappedValue: number, distance: number, guide: SnapGuide, priority: number) => {
      // Priority boost: center=0, edge=1, align=2 (lower is better)
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

    // Canvas center points
    const canvasCenterX = 50;
    const canvasCenterY = 50;

    // Current element edges and center
    const myLeft = currentX;
    const myRight = currentX + currentWidth;
    const myCenterX = currentX + currentWidth / 2;
    const myTop = currentY;
    const myBottom = currentY + currentHeight;
    const myCenterY = currentY + currentHeight / 2;

    // Priority 0: Canvas center (highest priority)
    const centerXDist = Math.abs(myCenterX - canvasCenterX);
    if (centerXDist < validSnapThreshold) {
      const snappedValue = canvasCenterX - currentWidth / 2;
      if (snappedValue >= 0 && snappedValue + currentWidth <= 100) {
        trySnapX(snappedValue, centerXDist, { type: 'vertical', position: canvasCenterX, label: 'center' }, 0);
      }
    }

    if (!isFlowMode) {
      const centerYDist = Math.abs(myCenterY - canvasCenterY);
      if (centerYDist < validSnapThreshold) {
        const snappedValue = canvasCenterY - currentHeight / 2;
        if (snappedValue >= 0 && snappedValue + currentHeight <= 100) {
          trySnapY(snappedValue, centerYDist, { type: 'horizontal', position: canvasCenterY, label: 'center' }, 0);
        }
      }
    }

    // Priority 1: Canvas edges
    const leftEdgeDist = Math.abs(myLeft);
    if (leftEdgeDist < validSnapThreshold) {
      trySnapX(0, leftEdgeDist, { type: 'vertical', position: 0, label: 'edge' }, 1);
    }

    const rightEdgeDist = Math.abs(myRight - 100);
    if (rightEdgeDist < validSnapThreshold && currentWidth <= 100) {
      trySnapX(100 - currentWidth, rightEdgeDist, { type: 'vertical', position: 100, label: 'edge' }, 1);
    }

    if (!isFlowMode) {
      const topEdgeDist = Math.abs(myTop);
      if (topEdgeDist < validSnapThreshold) {
        trySnapY(0, topEdgeDist, { type: 'horizontal', position: 0, label: 'edge' }, 1);
      }

      const bottomEdgeDist = Math.abs(myBottom - 100);
      if (bottomEdgeDist < validSnapThreshold && currentHeight <= 100) {
        trySnapY(100 - currentHeight, bottomEdgeDist, { type: 'horizontal', position: 100, label: 'edge' }, 1);
      }
    }

    // Priority 2: Element alignment
    for (const other of otherElements) {
      if (other.id === lineType) continue; // Skip self
      if (other.width <= 0 || other.height <= 0) continue; // Skip invalid elements

      const otherLeft = other.x;
      const otherRight = other.x + other.width;
      const otherCenterX = other.x + other.width / 2;
      const otherTop = other.y;
      const otherBottom = other.y + other.height;
      const otherCenterY = other.y + other.height / 2;

      // Vertical alignment checks (X axis)
      const leftToLeftDist = Math.abs(myLeft - otherLeft);
      if (leftToLeftDist < validSnapThreshold) {
        trySnapX(otherLeft, leftToLeftDist, { type: 'vertical', position: otherLeft, label: 'align' }, 2);
      }

      const rightToRightDist = Math.abs(myRight - otherRight);
      if (rightToRightDist < validSnapThreshold) {
        const snappedValue = otherRight - currentWidth;
        if (snappedValue >= 0) {
          trySnapX(snappedValue, rightToRightDist, { type: 'vertical', position: otherRight, label: 'align' }, 2);
        }
      }

      const centerToCenterXDist = Math.abs(myCenterX - otherCenterX);
      if (centerToCenterXDist < validSnapThreshold) {
        const snappedValue = otherCenterX - currentWidth / 2;
        if (snappedValue >= 0 && snappedValue + currentWidth <= 100) {
          trySnapX(snappedValue, centerToCenterXDist, { type: 'vertical', position: otherCenterX, label: 'align' }, 2);
        }
      }

      const leftToRightDist = Math.abs(myLeft - otherRight);
      if (leftToRightDist < validSnapThreshold) {
        trySnapX(otherRight, leftToRightDist, { type: 'vertical', position: otherRight, label: 'align' }, 2);
      }

      const rightToLeftDist = Math.abs(myRight - otherLeft);
      if (rightToLeftDist < validSnapThreshold) {
        const snappedValue = otherLeft - currentWidth;
        if (snappedValue >= 0) {
          trySnapX(snappedValue, rightToLeftDist, { type: 'vertical', position: otherLeft, label: 'align' }, 2);
        }
      }

      // Horizontal alignment checks (Y axis) - only in absolute mode
      if (!isFlowMode) {
        const topToTopDist = Math.abs(myTop - otherTop);
        if (topToTopDist < validSnapThreshold) {
          trySnapY(otherTop, topToTopDist, { type: 'horizontal', position: otherTop, label: 'align' }, 2);
        }

        const bottomToBottomDist = Math.abs(myBottom - otherBottom);
        if (bottomToBottomDist < validSnapThreshold) {
          const snappedValue = otherBottom - currentHeight;
          if (snappedValue >= 0) {
            trySnapY(snappedValue, bottomToBottomDist, { type: 'horizontal', position: otherBottom, label: 'align' }, 2);
          }
        }

        const centerToCenterYDist = Math.abs(myCenterY - otherCenterY);
        if (centerToCenterYDist < validSnapThreshold) {
          const snappedValue = otherCenterY - currentHeight / 2;
          if (snappedValue >= 0 && snappedValue + currentHeight <= 100) {
            trySnapY(snappedValue, centerToCenterYDist, { type: 'horizontal', position: otherCenterY, label: 'align' }, 2);
          }
        }

        const topToBottomDist = Math.abs(myTop - otherBottom);
        if (topToBottomDist < validSnapThreshold) {
          trySnapY(otherBottom, topToBottomDist, { type: 'horizontal', position: otherBottom, label: 'align' }, 2);
        }

        const bottomToTopDist = Math.abs(myBottom - otherTop);
        if (bottomToTopDist < validSnapThreshold) {
          const snappedValue = otherTop - currentHeight;
          if (snappedValue >= 0) {
            trySnapY(snappedValue, bottomToTopDist, { type: 'horizontal', position: otherTop, label: 'align' }, 2);
          }
        }
      }
    }

    // Apply best snaps (type assertions needed because TypeScript doesn't track mutations through nested functions)
    const finalSnapX = bestSnapX as DragSnap | null;
    const finalSnapY = bestSnapY as DragSnap | null;
    const snappedX = finalSnapX ? finalSnapX.value : currentX;
    const snappedY = finalSnapY ? finalSnapY.value : currentY;

    if (finalSnapX) guides.push(finalSnapX.guide);
    if (finalSnapY) guides.push(finalSnapY.guide);

    return { x: snappedX, y: snappedY, guides };
  }, [otherElements, validSnapThreshold, lineType, isFlowMode]);

  // Handle drag with snapping (throttled for performance)
  const handleDrag = useCallback((e: any, d: { x: number; y: number }) => {
    if (!onSnapGuidesChange) return;

    // Throttle to ~60fps to prevent excessive re-renders
    const now = Date.now();
    if (now - lastDragCallRef.current < THROTTLE_MS) return;
    lastDragCallRef.current = now;

    const currentX = toPercent(d.x, canvasWidth);
    const currentY = toPercent(d.y, canvasHeight);
    const { guides } = calculateSnap(currentX, currentY, position.width, position.height);
    onSnapGuidesChange(guides);
  }, [canvasWidth, canvasHeight, position.width, position.height, calculateSnap, toPercent, onSnapGuidesChange]);

  const handleDragStop = useCallback((e: any, d: { x: number; y: number }) => {
    // Clear snap guides
    if (onSnapGuidesChange) {
      onSnapGuidesChange([]);
    }

    const currentX = toPercent(d.x, canvasWidth);
    const currentY = toPercent(d.y, canvasHeight);

    // Apply snapping
    const { x: snappedX, y: snappedY } = calculateSnap(currentX, currentY, position.width, position.height);

    // Handle case where position.width/height > 100 by ensuring max is at least 0
    const newX = clamp(snappedX, 0, Math.max(0, 100 - position.width));
    // In flow mode, don't update Y position - it's calculated based on anchor
    if (isFlowMode) {
      onPositionChange({
        ...position,
        x: newX
      });
    } else {
      const newY = clamp(snappedY, 0, Math.max(0, 100 - position.height));
      onPositionChange({
        ...position,
        x: newX,
        y: newY
      });
    }
  }, [canvasWidth, canvasHeight, position, onPositionChange, toPercent, isFlowMode, calculateSnap, onSnapGuidesChange]);

  // Calculate snap guides for resizing
  // Priority: canvas center > canvas edges > element alignment
  // Includes validation to prevent negative dimensions
  const calculateResizeSnap = useCallback((
    currentX: number,
    currentY: number,
    currentWidth: number,
    currentHeight: number,
    direction: string
  ): { x: number; y: number; width: number; height: number; guides: SnapGuide[] } => {
    const guides: SnapGuide[] = [];
    const MIN_SIZE = 5; // Minimum size in percentage

    // Skip if dimensions are invalid
    if (currentWidth <= 0 || currentHeight <= 0) {
      return { x: currentX, y: currentY, width: Math.max(currentWidth, MIN_SIZE), height: Math.max(currentHeight, MIN_SIZE), guides };
    }

    // Track best snap for width and height separately
    let bestSnapWidth: ResizeSnap | null = null;
    let bestSnapHeight: ResizeSnap | null = null;

    const trySnapWidth = (newX: number, newWidth: number, distance: number, guide: SnapGuide, priority: number) => {
      // Validate: width must be positive and x must be valid
      if (newWidth < MIN_SIZE || newX < 0 || newX + newWidth > 100) return;
      const adjustedDistance = distance + priority * 0.001;
      if (!bestSnapWidth || adjustedDistance < bestSnapWidth.distance) {
        bestSnapWidth = { x: newX, y: currentY, width: newWidth, height: currentHeight, distance: adjustedDistance, guide };
      }
    };

    const trySnapHeight = (newY: number, newHeight: number, distance: number, guide: SnapGuide, priority: number) => {
      if (newHeight < MIN_SIZE || newY < 0 || newY + newHeight > 100) return;
      const adjustedDistance = distance + priority * 0.001;
      if (!bestSnapHeight || adjustedDistance < bestSnapHeight.distance) {
        bestSnapHeight = { x: currentX, y: newY, width: currentWidth, height: newHeight, distance: adjustedDistance, guide };
      }
    };

    // Canvas center
    const canvasCenterX = 50;
    const canvasCenterY = 50;

    // Current element edges after resize
    const myLeft = currentX;
    const myRight = currentX + currentWidth;
    const myCenterX = currentX + currentWidth / 2;
    const myTop = currentY;
    const myBottom = currentY + currentHeight;
    const myCenterY = currentY + currentHeight / 2;

    // Determine which edges are being resized
    const resizingRight = direction.includes('right') || direction.includes('Right');
    const resizingLeft = direction.includes('left') || direction.includes('Left');
    const resizingBottom = direction.includes('bottom') || direction.includes('Bottom');
    const resizingTop = direction.includes('top') || direction.includes('Top');

    // Priority 0: Canvas center X snap
    const centerXDist = Math.abs(myCenterX - canvasCenterX);
    if (centerXDist < validSnapThreshold) {
      if (resizingRight) {
        const newWidth = (canvasCenterX - currentX) * 2;
        trySnapWidth(currentX, newWidth, centerXDist, { type: 'vertical', position: canvasCenterX, label: 'center' }, 0);
      } else if (resizingLeft) {
        const newLeft = canvasCenterX - (myRight - canvasCenterX);
        const newWidth = myRight - newLeft;
        trySnapWidth(newLeft, newWidth, centerXDist, { type: 'vertical', position: canvasCenterX, label: 'center' }, 0);
      }
    }

    // Priority 1: Canvas edge snaps
    if (resizingRight) {
      const rightEdgeDist = Math.abs(myRight - 100);
      if (rightEdgeDist < validSnapThreshold) {
        trySnapWidth(currentX, 100 - currentX, rightEdgeDist, { type: 'vertical', position: 100, label: 'edge' }, 1);
      }
    }
    if (resizingLeft) {
      const leftEdgeDist = Math.abs(myLeft);
      if (leftEdgeDist < validSnapThreshold) {
        trySnapWidth(0, myRight, leftEdgeDist, { type: 'vertical', position: 0, label: 'edge' }, 1);
      }
    }
    if (!isFlowMode && resizingBottom) {
      const bottomEdgeDist = Math.abs(myBottom - 100);
      if (bottomEdgeDist < validSnapThreshold) {
        trySnapHeight(currentY, 100 - currentY, bottomEdgeDist, { type: 'horizontal', position: 100, label: 'edge' }, 1);
      }
    }
    if (!isFlowMode && resizingTop) {
      const topEdgeDist = Math.abs(myTop);
      if (topEdgeDist < validSnapThreshold) {
        trySnapHeight(0, myBottom, topEdgeDist, { type: 'horizontal', position: 0, label: 'edge' }, 1);
      }
    }

    // Priority 2: Element alignment
    for (const other of otherElements) {
      if (other.id === lineType) continue;
      if (other.width <= 0 || other.height <= 0) continue;

      const otherLeft = other.x;
      const otherRight = other.x + other.width;
      const otherTop = other.y;
      const otherBottom = other.y + other.height;

      // Width matching
      const widthMatchDist = Math.abs(currentWidth - other.width);
      if (widthMatchDist < validSnapThreshold) {
        if (resizingRight) {
          trySnapWidth(currentX, other.width, widthMatchDist, { type: 'vertical', position: currentX + other.width, label: 'width' }, 2);
        } else if (resizingLeft) {
          trySnapWidth(myRight - other.width, other.width, widthMatchDist, { type: 'vertical', position: myRight - other.width, label: 'width' }, 2);
        }
      }

      // Edge alignment during resize
      if (resizingRight) {
        const rightToRightDist = Math.abs(myRight - otherRight);
        if (rightToRightDist < validSnapThreshold) {
          trySnapWidth(currentX, otherRight - currentX, rightToRightDist, { type: 'vertical', position: otherRight, label: 'align' }, 2);
        }
        const rightToLeftDist = Math.abs(myRight - otherLeft);
        if (rightToLeftDist < validSnapThreshold) {
          trySnapWidth(currentX, otherLeft - currentX, rightToLeftDist, { type: 'vertical', position: otherLeft, label: 'align' }, 2);
        }
      }
      if (resizingLeft) {
        const leftToLeftDist = Math.abs(myLeft - otherLeft);
        if (leftToLeftDist < validSnapThreshold) {
          trySnapWidth(otherLeft, myRight - otherLeft, leftToLeftDist, { type: 'vertical', position: otherLeft, label: 'align' }, 2);
        }
        const leftToRightDist = Math.abs(myLeft - otherRight);
        if (leftToRightDist < validSnapThreshold) {
          trySnapWidth(otherRight, myRight - otherRight, leftToRightDist, { type: 'vertical', position: otherRight, label: 'align' }, 2);
        }
      }

      // Height matching (only in absolute mode)
      if (!isFlowMode) {
        const heightMatchDist = Math.abs(currentHeight - other.height);
        if (heightMatchDist < validSnapThreshold) {
          if (resizingBottom) {
            trySnapHeight(currentY, other.height, heightMatchDist, { type: 'horizontal', position: currentY + other.height, label: 'height' }, 2);
          } else if (resizingTop) {
            trySnapHeight(myBottom - other.height, other.height, heightMatchDist, { type: 'horizontal', position: myBottom - other.height, label: 'height' }, 2);
          }
        }

        // Vertical edge alignment during resize
        if (resizingBottom) {
          const bottomToBottomDist = Math.abs(myBottom - otherBottom);
          if (bottomToBottomDist < validSnapThreshold) {
            trySnapHeight(currentY, otherBottom - currentY, bottomToBottomDist, { type: 'horizontal', position: otherBottom, label: 'align' }, 2);
          }
          const bottomToTopDist = Math.abs(myBottom - otherTop);
          if (bottomToTopDist < validSnapThreshold) {
            trySnapHeight(currentY, otherTop - currentY, bottomToTopDist, { type: 'horizontal', position: otherTop, label: 'align' }, 2);
          }
        }
        if (resizingTop) {
          const topToTopDist = Math.abs(myTop - otherTop);
          if (topToTopDist < validSnapThreshold) {
            trySnapHeight(otherTop, myBottom - otherTop, topToTopDist, { type: 'horizontal', position: otherTop, label: 'align' }, 2);
          }
          const topToBottomDist = Math.abs(myTop - otherBottom);
          if (topToBottomDist < validSnapThreshold) {
            trySnapHeight(otherBottom, myBottom - otherBottom, topToBottomDist, { type: 'horizontal', position: otherBottom, label: 'align' }, 2);
          }
        }
      }
    }

    // Apply best snaps (type assertions needed because TypeScript doesn't track mutations through nested functions)
    const finalSnapWidth = bestSnapWidth as ResizeSnap | null;
    const finalSnapHeight = bestSnapHeight as ResizeSnap | null;
    let finalX = currentX;
    let finalY = currentY;
    let finalWidth = currentWidth;
    let finalHeight = currentHeight;

    if (finalSnapWidth) {
      finalX = finalSnapWidth.x;
      finalWidth = finalSnapWidth.width;
      guides.push(finalSnapWidth.guide);
    }
    if (finalSnapHeight) {
      finalY = finalSnapHeight.y;
      finalHeight = finalSnapHeight.height;
      guides.push(finalSnapHeight.guide);
    }

    return { x: finalX, y: finalY, width: finalWidth, height: finalHeight, guides };
  }, [otherElements, validSnapThreshold, lineType, isFlowMode]);

  // Handle resize with snapping (throttled for performance)
  const handleResize = useCallback((
    e: any,
    direction: string,
    ref: HTMLElement,
    delta: { width: number; height: number },
    pos: { x: number; y: number }
  ) => {
    if (!onSnapGuidesChange) return;

    // Throttle to ~60fps to prevent excessive re-renders
    const now = Date.now();
    if (now - lastResizeCallRef.current < THROTTLE_MS) return;
    lastResizeCallRef.current = now;

    const currentWidth = toPercent(ref.offsetWidth, canvasWidth);
    const currentHeight = toPercent(ref.offsetHeight, canvasHeight);
    const currentX = toPercent(pos.x, canvasWidth);
    const currentY = toPercent(pos.y, canvasHeight);

    const { guides } = calculateResizeSnap(currentX, currentY, currentWidth, currentHeight, direction);
    onSnapGuidesChange(guides);
  }, [canvasWidth, canvasHeight, calculateResizeSnap, toPercent, onSnapGuidesChange]);

  const handleResizeStop = useCallback((
    e: any,
    direction: string,
    ref: HTMLElement,
    delta: { width: number; height: number },
    pos: { x: number; y: number }
  ) => {
    // Clear snap guides
    if (onSnapGuidesChange) {
      onSnapGuidesChange([]);
    }

    const currentWidth = toPercent(ref.offsetWidth, canvasWidth);
    const currentHeight = toPercent(ref.offsetHeight, canvasHeight);
    const currentX = toPercent(pos.x, canvasWidth);
    const currentY = toPercent(pos.y, canvasHeight);

    // Apply snapping
    const { x: snappedX, y: snappedY, width: snappedWidth, height: snappedHeight } = calculateResizeSnap(
      currentX, currentY, currentWidth, currentHeight, direction
    );

    // Use consistent MIN_SIZE of 5% for both dimensions (matching calculateResizeSnap)
    const MIN_SIZE = 5;
    const newWidth = clamp(snappedWidth, MIN_SIZE, 100);
    const newHeight = clamp(snappedHeight, MIN_SIZE, 100);
    const newX = clamp(snappedX, 0, Math.max(0, 100 - newWidth));
    const newY = clamp(snappedY, 0, Math.max(0, 100 - newHeight));

    // In flow mode, only update X and width (Y is calculated, height can still be set as min-height)
    if (isFlowMode) {
      onPositionChange({
        ...position,
        x: newX,
        width: newWidth,
        height: newHeight
      });
    } else {
      onPositionChange({
        ...position,
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight
      });
    }
  }, [canvasWidth, canvasHeight, position, onPositionChange, toPercent, isFlowMode, calculateResizeSnap, onSnapGuidesChange]);

  // Only hide if visible is explicitly set to false (not undefined)
  if (style.visible === false) {
    return null;
  }

  const pixelX = toPixels(position.x, canvasWidth);
  // Use calculated Y for flow mode, otherwise use stored position
  const effectiveY = isFlowMode && calculatedY !== undefined ? calculatedY : position.y;
  const pixelY = toPixels(effectiveY, canvasHeight);
  const pixelWidth = toPixels(position.width, canvasWidth);
  // Use measured height for auto-height mode, otherwise use stored height
  const effectiveHeight = isAutoHeight && measuredHeight !== undefined ? measuredHeight : position.height;
  const pixelHeight = toPixels(effectiveHeight, canvasHeight);

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
      onDrag={handleDrag}
      onDragStop={handleDragStop}
      onResize={handleResize}
      onResizeStop={handleResizeStop}
      onMouseDown={onSelect}
      bounds="parent"
      minWidth={toPixels(10, canvasWidth)}
      minHeight={toPixels(5, canvasHeight)}
      disableDragging={isEditing}
      // In flow mode, restrict dragging to X-axis only
      dragAxis={isFlowMode ? 'x' : 'both'}
      enableResizing={isEditing ? false : {
        // In flow mode or auto-height mode, disable top/bottom resizing
        top: !isFlowMode && !isAutoHeight,
        right: true,
        bottom: !isFlowMode && !isAutoHeight,
        left: true,
        topRight: !isFlowMode && !isAutoHeight,
        bottomRight: !isFlowMode && !isAutoHeight,
        bottomLeft: !isFlowMode && !isAutoHeight,
        topLeft: !isFlowMode && !isAutoHeight
      }}
      style={{
        zIndex: isSelected ? 10 : 2,
        cursor: isEditing ? 'text' : (isFlowMode ? 'ew-resize' : 'move')
      }}
    >
      <div
        onClick={onSelect}
        onDoubleClick={handleDoubleClick}
        style={{
          width: '100%',
          height: '100%',
          // Check if custom borders are set for reference lines
          ...(() => {
            const isReference = lineType.toLowerCase().includes('reference');
            const hasCustomBorders = isReference && (style.borderTop || style.borderRight || style.borderBottom || style.borderLeft);

            if (hasCustomBorders) {
              // Use custom borders
              const borderColor = style.borderColor || '#ffffff';
              return {
                borderTop: style.borderTop ? `${style.borderTop}px solid ${borderColor}` : 'none',
                borderRight: style.borderRight ? `${style.borderRight}px solid ${borderColor}` : 'none',
                borderBottom: style.borderBottom ? `${style.borderBottom}px solid ${borderColor}` : 'none',
                borderLeft: style.borderLeft ? `${style.borderLeft}px solid ${borderColor}` : 'none',
              };
            } else {
              // Use default selection/deselected border
              return {
                border: isSelected
                  ? `2px solid ${LINE_COLORS[lineType] || '#888888'}`
                  : '1px dashed rgba(255,255,255,0.3)',
              };
            }
          })(),
          borderRadius: (() => {
            const isReference = lineType.toLowerCase().includes('reference');
            if (!isReference) return '4px';
            // Check for individual corner radii first
            const hasCornerRadii = style.borderRadiusTopLeft || style.borderRadiusTopRight || style.borderRadiusBottomRight || style.borderRadiusBottomLeft;
            if (hasCornerRadii) {
              return `${style.borderRadiusTopLeft ?? 0}px ${style.borderRadiusTopRight ?? 0}px ${style.borderRadiusBottomRight ?? 0}px ${style.borderRadiusBottomLeft ?? 0}px`;
            }
            // Fallback to single borderRadius
            if (style.borderRadius) {
              return `${style.borderRadius}px`;
            }
            return '4px';
          })(),
          backgroundColor: isSelected
            ? `${LINE_COLORS[lineType] || '#888888'}15`
            : 'transparent',
          display: 'flex',
          justifyContent: getJustifyContent(),
          alignItems: getAlignItems(),
          paddingTop: `${position.paddingTop}%`,
          paddingBottom: `${position.paddingBottom}%`,
          paddingLeft: `${position.paddingLeft ?? 0}px`,
          paddingRight: `${position.paddingRight ?? 0}px`,
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
              lineHeight: 1.4,
              textShadow: (style.textShadowColor || style.textShadowBlur !== undefined || style.textShadowOffsetX !== undefined || style.textShadowOffsetY !== undefined)
                ? `${style.textShadowOffsetX ?? 2}px ${style.textShadowOffsetY ?? 2}px ${style.textShadowBlur ?? 4}px ${style.textShadowColor || 'rgba(0,0,0,0.8)'}`
                : '2px 2px 4px rgba(0, 0, 0, 0.8), 0 0 8px rgba(0, 0, 0, 0.5)',
              WebkitTextStroke: style.textStrokeWidth ? `${style.textStrokeWidth}px ${style.textStrokeColor || '#000000'}` : undefined,
              paintOrder: 'stroke fill'
            }}
          />
        ) : (
          <div
            ref={contentRef}
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
              width: style.backgroundColor ? 'auto' : '100%',
              display: style.backgroundColor ? 'inline-block' : 'block',
              lineHeight: 1.4,
              textShadow: (style.textShadowColor || style.textShadowBlur !== undefined || style.textShadowOffsetX !== undefined || style.textShadowOffsetY !== undefined)
                ? `${style.textShadowOffsetX ?? 2}px ${style.textShadowOffsetY ?? 2}px ${style.textShadowBlur ?? 4}px ${style.textShadowColor || 'rgba(0,0,0,0.8)'}`
                : '2px 2px 4px rgba(0, 0, 0, 0.8), 0 0 8px rgba(0, 0, 0, 0.5)',
              WebkitTextStroke: style.textStrokeWidth ? `${style.textStrokeWidth}px ${style.textStrokeColor || '#000000'}` : undefined,
              paintOrder: 'stroke fill',
              // Per-line background support
              backgroundColor: style.backgroundColor || 'transparent',
              ...(style.backgroundOpacity !== undefined && style.backgroundColor
                ? { opacity: style.backgroundOpacity }
                : {}),
              padding: style.backgroundPadding || (style.backgroundColor ? '0.15em 0.6em' : undefined),
              borderRadius: style.backgroundColor ? `${style.borderRadius ?? 6}px` : undefined
            }}
          >
            {displayText}
          </div>
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
            textTransform: 'capitalize',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          {lineType}
          {isFlowMode && (
            <span style={{
              background: 'rgba(255,255,255,0.3)',
              padding: '1px 4px',
              borderRadius: '2px',
              fontSize: '9px'
            }}>
              ↓ Flow
            </span>
          )}
          {isAutoHeight && (
            <span style={{
              background: 'rgba(100,200,255,0.4)',
              padding: '1px 4px',
              borderRadius: '2px',
              fontSize: '9px'
            }}>
              ↕ Auto
            </span>
          )}
        </div>
      )}
    </Rnd>
  );
};

export default memo(DraggableTextBox);
