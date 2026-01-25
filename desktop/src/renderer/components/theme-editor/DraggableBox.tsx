import React, { useCallback, memo, useRef } from 'react';
import { Rnd } from 'react-rnd';
import { SnapGuide, ElementBounds } from './DraggableTextBox';

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

export type TextureType = 'none' | 'paper' | 'parchment' | 'linen' | 'canvas' | 'noise';

export interface BackgroundBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  opacity: number;
  borderRadius: number;
  texture?: TextureType;
  textureOpacity?: number;
  visible?: boolean;
}

// CSS texture patterns - grayscale patterns that blend with any base color
export const texturePatterns: Record<TextureType, { pattern: string; size: string }> = {
  none: { pattern: 'none', size: 'auto' },
  paper: {
    // Subtle speckled paper texture
    pattern: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='%23888'/%3E%3Ccircle cx='20' cy='30' r='3' fill='%23666'/%3E%3Ccircle cx='70' cy='15' r='2' fill='%23999'/%3E%3Ccircle cx='45' cy='60' r='4' fill='%23777'/%3E%3Ccircle cx='10' cy='80' r='2' fill='%23aaa'/%3E%3Ccircle cx='85' cy='70' r='3' fill='%23666'/%3E%3Ccircle cx='30' cy='90' r='2' fill='%23999'/%3E%3Ccircle cx='60' cy='40' r='2' fill='%23555'/%3E%3Ccircle cx='90' cy='50' r='3' fill='%23888'/%3E%3Ccircle cx='5' cy='45' r='2' fill='%23777'/%3E%3Ccircle cx='55' cy='85' r='3' fill='%23666'/%3E%3Ccircle cx='75' cy='35' r='2' fill='%23aaa'/%3E%3Ccircle cx='35' cy='10' r='2' fill='%23999'/%3E%3C/svg%3E")`,
    size: '100px 100px'
  },
  parchment: {
    // Aged parchment with subtle fiber lines
    pattern: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Crect width='60' height='60' fill='%23888'/%3E%3Cpath d='M0 15 Q15 12 30 15 T60 15' stroke='%23666' stroke-width='1' fill='none'/%3E%3Cpath d='M0 35 Q15 38 30 35 T60 35' stroke='%23999' stroke-width='0.8' fill='none'/%3E%3Cpath d='M0 50 Q15 47 30 50 T60 50' stroke='%23777' stroke-width='0.6' fill='none'/%3E%3Ccircle cx='10' cy='10' r='4' fill='%23777'/%3E%3Ccircle cx='45' cy='25' r='5' fill='%23999'/%3E%3Ccircle cx='25' cy='45' r='3' fill='%23666'/%3E%3C/svg%3E")`,
    size: '60px 60px'
  },
  linen: {
    // Crosshatch linen weave
    pattern: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8'%3E%3Crect width='8' height='8' fill='%23888'/%3E%3Cpath d='M0 0L8 8M8 0L0 8' stroke='%23666' stroke-width='1'/%3E%3C/svg%3E")`,
    size: '8px 8px'
  },
  canvas: {
    // Woven canvas grid
    pattern: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12'%3E%3Crect width='12' height='12' fill='%23888'/%3E%3Crect x='0' y='0' width='6' height='6' fill='%23777'/%3E%3Crect x='6' y='6' width='6' height='6' fill='%23777'/%3E%3C/svg%3E")`,
    size: '12px 12px'
  },
  noise: {
    // Random noise grain
    pattern: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' fill='%23808080'/%3E%3Crect x='2' y='3' width='2' height='2' fill='%23606060'/%3E%3Crect x='12' y='7' width='2' height='2' fill='%23a0a0a0'/%3E%3Crect x='25' y='2' width='2' height='2' fill='%23707070'/%3E%3Crect x='35' y='10' width='2' height='2' fill='%23909090'/%3E%3Crect x='8' y='18' width='2' height='2' fill='%23505050'/%3E%3Crect x='20' y='15' width='2' height='2' fill='%23b0b0b0'/%3E%3Crect x='32' y='22' width='2' height='2' fill='%23656565'/%3E%3Crect x='5' y='30' width='2' height='2' fill='%23959595'/%3E%3Crect x='18' y='28' width='2' height='2' fill='%23757575'/%3E%3Crect x='28' y='35' width='2' height='2' fill='%23858585'/%3E%3Crect x='38' y='32' width='2' height='2' fill='%23555555'/%3E%3Crect x='15' y='38' width='2' height='2' fill='%23a5a5a5'/%3E%3C/svg%3E")`,
    size: '40px 40px'
  }
};

export const textureLabels: Record<TextureType, string> = {
  none: 'None',
  paper: 'Paper',
  parchment: 'Parchment',
  linen: 'Linen',
  canvas: 'Canvas',
  noise: 'Noise'
};

interface DraggableBoxProps {
  box: BackgroundBox;
  canvasWidth: number;
  canvasHeight: number;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (box: BackgroundBox) => void;
  onDelete: () => void;
  // Snap guides
  otherElements?: ElementBounds[];
  onSnapGuidesChange?: (guides: SnapGuide[]) => void;
  snapThreshold?: number;
}

const DraggableBox: React.FC<DraggableBoxProps> = ({
  box,
  canvasWidth,
  canvasHeight,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
  otherElements = [],
  onSnapGuidesChange,
  snapThreshold = 1
}) => {
  // Validate snapThreshold to prevent negative values
  const validSnapThreshold = Math.max(0, snapThreshold);

  // Throttle refs for drag/resize handlers (~60fps)
  const lastDragCallRef = useRef<number>(0);
  const lastResizeCallRef = useRef<number>(0);
  const THROTTLE_MS = 16;

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

    // Track best snap for each axis
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
    if (centerXDist < validSnapThreshold) {
      const snappedValue = canvasCenterX - currentWidth / 2;
      if (snappedValue >= 0 && snappedValue + currentWidth <= 100) {
        trySnapX(snappedValue, centerXDist, { type: 'vertical', position: canvasCenterX, label: 'center' }, 0);
      }
    }

    const centerYDist = Math.abs(myCenterY - canvasCenterY);
    if (centerYDist < validSnapThreshold) {
      const snappedValue = canvasCenterY - currentHeight / 2;
      if (snappedValue >= 0 && snappedValue + currentHeight <= 100) {
        trySnapY(snappedValue, centerYDist, { type: 'horizontal', position: canvasCenterY, label: 'center' }, 0);
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

    const topEdgeDist = Math.abs(myTop);
    if (topEdgeDist < validSnapThreshold) {
      trySnapY(0, topEdgeDist, { type: 'horizontal', position: 0, label: 'edge' }, 1);
    }

    const bottomEdgeDist = Math.abs(myBottom - 100);
    if (bottomEdgeDist < validSnapThreshold && currentHeight <= 100) {
      trySnapY(100 - currentHeight, bottomEdgeDist, { type: 'horizontal', position: 100, label: 'edge' }, 1);
    }

    // Priority 2: Other elements
    for (const other of otherElements) {
      if (other.id === box.id) continue;
      if (other.width <= 0 || other.height <= 0) continue;

      const otherLeft = other.x;
      const otherRight = other.x + other.width;
      const otherCenterX = other.x + other.width / 2;
      const otherTop = other.y;
      const otherBottom = other.y + other.height;
      const otherCenterY = other.y + other.height / 2;

      // Vertical alignment
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

      // Horizontal alignment
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

    // Apply best snaps (type assertions needed because TypeScript doesn't track mutations through nested functions)
    const finalSnapX = bestSnapX as DragSnap | null;
    const finalSnapY = bestSnapY as DragSnap | null;
    const snappedX = finalSnapX ? finalSnapX.value : currentX;
    const snappedY = finalSnapY ? finalSnapY.value : currentY;

    if (finalSnapX) guides.push(finalSnapX.guide);
    if (finalSnapY) guides.push(finalSnapY.guide);

    return { x: snappedX, y: snappedY, guides };
  }, [otherElements, validSnapThreshold, box.id]);

  // Handle drag with snapping (throttled for performance)
  const handleDrag = useCallback((e: any, d: { x: number; y: number }) => {
    if (!onSnapGuidesChange) return;

    // Throttle to ~60fps to prevent excessive re-renders
    const now = Date.now();
    if (now - lastDragCallRef.current < THROTTLE_MS) return;
    lastDragCallRef.current = now;

    const currentX = toPercent(d.x, canvasWidth);
    const currentY = toPercent(d.y, canvasHeight);
    const { guides } = calculateSnap(currentX, currentY, box.width, box.height);
    onSnapGuidesChange(guides);
  }, [canvasWidth, canvasHeight, box.width, box.height, calculateSnap, toPercent, onSnapGuidesChange]);

  const handleDragStop = useCallback((e: any, d: { x: number; y: number }) => {
    // Clear snap guides
    if (onSnapGuidesChange) {
      onSnapGuidesChange([]);
    }

    const currentX = toPercent(d.x, canvasWidth);
    const currentY = toPercent(d.y, canvasHeight);

    // Apply snapping
    const { x: snappedX, y: snappedY } = calculateSnap(currentX, currentY, box.width, box.height);

    const newX = clamp(snappedX, 0, 100 - box.width);
    const newY = clamp(snappedY, 0, 100 - box.height);
    onUpdate({
      ...box,
      x: newX,
      y: newY
    });
  }, [canvasWidth, canvasHeight, box, onUpdate, toPercent, calculateSnap, onSnapGuidesChange]);

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
    const MIN_SIZE = 5;

    // Skip if dimensions are invalid
    if (currentWidth <= 0 || currentHeight <= 0) {
      return { x: currentX, y: currentY, width: Math.max(currentWidth, MIN_SIZE), height: Math.max(currentHeight, MIN_SIZE), guides };
    }

    // Track best snap for width and height separately
    let bestSnapWidth: ResizeSnap | null = null;
    let bestSnapHeight: ResizeSnap | null = null;

    const trySnapWidth = (newX: number, newWidth: number, distance: number, guide: SnapGuide, priority: number) => {
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

    const canvasCenterX = 50;
    const canvasCenterY = 50;

    const myLeft = currentX;
    const myRight = currentX + currentWidth;
    const myCenterX = currentX + currentWidth / 2;
    const myTop = currentY;
    const myBottom = currentY + currentHeight;
    const myCenterY = currentY + currentHeight / 2;

    const resizingRight = direction.includes('right') || direction.includes('Right');
    const resizingLeft = direction.includes('left') || direction.includes('Left');
    const resizingBottom = direction.includes('bottom') || direction.includes('Bottom');
    const resizingTop = direction.includes('top') || direction.includes('Top');

    // Priority 0: Canvas center snaps
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

    const centerYDist = Math.abs(myCenterY - canvasCenterY);
    if (centerYDist < validSnapThreshold) {
      if (resizingBottom) {
        const newHeight = (canvasCenterY - currentY) * 2;
        trySnapHeight(currentY, newHeight, centerYDist, { type: 'horizontal', position: canvasCenterY, label: 'center' }, 0);
      } else if (resizingTop) {
        const newTop = canvasCenterY - (myBottom - canvasCenterY);
        const newHeight = myBottom - newTop;
        trySnapHeight(newTop, newHeight, centerYDist, { type: 'horizontal', position: canvasCenterY, label: 'center' }, 0);
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
    if (resizingBottom) {
      const bottomEdgeDist = Math.abs(myBottom - 100);
      if (bottomEdgeDist < validSnapThreshold) {
        trySnapHeight(currentY, 100 - currentY, bottomEdgeDist, { type: 'horizontal', position: 100, label: 'edge' }, 1);
      }
    }
    if (resizingTop) {
      const topEdgeDist = Math.abs(myTop);
      if (topEdgeDist < validSnapThreshold) {
        trySnapHeight(0, myBottom, topEdgeDist, { type: 'horizontal', position: 0, label: 'edge' }, 1);
      }
    }

    // Priority 2: Other elements - edge and width/height matching
    for (const other of otherElements) {
      if (other.id === box.id) continue;
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

      // Height matching
      const heightMatchDist = Math.abs(currentHeight - other.height);
      if (heightMatchDist < validSnapThreshold) {
        if (resizingBottom) {
          trySnapHeight(currentY, other.height, heightMatchDist, { type: 'horizontal', position: currentY + other.height, label: 'height' }, 2);
        } else if (resizingTop) {
          trySnapHeight(myBottom - other.height, other.height, heightMatchDist, { type: 'horizontal', position: myBottom - other.height, label: 'height' }, 2);
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

      // Vertical edge alignment
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
  }, [otherElements, validSnapThreshold, box.id]);

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

    const newWidth = clamp(snappedWidth, 5, 100);
    const newHeight = clamp(snappedHeight, 5, 100);
    const newX = clamp(snappedX, 0, 100 - newWidth);
    const newY = clamp(snappedY, 0, 100 - newHeight);

    onUpdate({
      ...box,
      x: newX,
      y: newY,
      width: newWidth,
      height: newHeight
    });
  }, [canvasWidth, canvasHeight, box, onUpdate, toPercent, calculateResizeSnap, onSnapGuidesChange]);

  const pixelX = toPixels(box.x, canvasWidth);
  const pixelY = toPixels(box.y, canvasHeight);
  const pixelWidth = toPixels(box.width, canvasWidth);
  const pixelHeight = toPixels(box.height, canvasHeight);

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
          transition: 'border-color 0.15s',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Texture overlay */}
        {box.texture && box.texture !== 'none' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: texturePatterns[box.texture].pattern,
              backgroundRepeat: 'repeat',
              backgroundSize: texturePatterns[box.texture].size,
              opacity: box.textureOpacity ?? 0.3,
              pointerEvents: 'none'
            }}
          />
        )}
      </div>

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

export default memo(DraggableBox);
