import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import DraggableStageElement, { StageElementPosition, SnapGuide, ElementBounds } from './DraggableStageElement';

export interface StageColors {
  background: string;
  text: string;
  accent: string;
  secondary: string;
  border: string;
}

export interface StageElementConfig {
  visible: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  backgroundColor?: string;
  borderRadius?: number;
  color?: string;
  fontSize?: number;
  fontWeight?: string;
  fontFamily?: string;
  labelText?: string;
  labelColor?: string;
  opacity?: number;
  showSeconds?: boolean;
  alignH?: 'left' | 'center' | 'right';
}

export interface StageTextStyle {
  visible: boolean;
  color: string;
  fontSize: number;
  fontWeight: string;
  opacity: number;
  // Position properties (percentage-based)
  x: number;
  y: number;
  width: number;
  height: number;
  alignH?: 'left' | 'center' | 'right';
  alignV?: 'top' | 'center' | 'bottom';
  // Flow positioning
  positionMode?: 'absolute' | 'flow';
  flowAnchor?: string; // Which element to flow after
  flowGap?: number; // Gap in percentage
  flowBeside?: boolean; // If true, position beside instead of below
  // Auto height
  autoHeight?: boolean;
  growDirection?: 'up' | 'down';
  // Text shadow properties
  textShadowColor?: string;
  textShadowBlur?: number;
  textShadowOffsetX?: number;
  textShadowOffsetY?: number;
  // Text stroke/outline properties
  textStrokeWidth?: number;
  textStrokeColor?: string;
}

export interface StageCurrentSlideText {
  original: StageTextStyle;
  transliteration: StageTextStyle;
  translation: StageTextStyle;
}

export interface StageNextSlideText {
  original: StageTextStyle;
  transliteration: StageTextStyle;
  translation: StageTextStyle;
}

export type StageSelectedElement = 'header' | 'clock' | 'songTitle' | 'currentSlide' | 'nextSlide' | 'original' | 'transliteration' | 'translation' | 'nextOriginal' | 'nextTransliteration' | 'nextTranslation' | null;

export interface PreviewTexts {
  original: string;
  transliteration: string;
  translation: string;
}

interface StageMonitorCanvasProps {
  canvasDimensions: { width: number; height: number };
  colors: StageColors;
  header: StageElementConfig;
  clock: StageElementConfig;
  songTitle: StageElementConfig;
  currentSlideArea: StageElementConfig;
  currentSlideText: StageCurrentSlideText;
  nextSlideArea: StageElementConfig;
  nextSlideText: StageNextSlideText;
  selectedElement: StageSelectedElement;
  onSelectElement: (element: StageSelectedElement) => void;
  onElementChange: (elementType: string, updates: Partial<StageElementConfig>) => void;
  onTextStyleChange?: (lineType: 'original' | 'transliteration' | 'translation', updates: Partial<StageTextStyle>) => void;
  onNextTextStyleChange?: (lineType: 'original' | 'transliteration' | 'translation', updates: Partial<StageTextStyle>) => void;
  disabled?: boolean;
  previewTexts?: PreviewTexts;
}

const SAMPLE_TEXTS = {
  original: 'הללויה',
  transliteration: 'Hallelujah',
  translation: 'Praise the Lord'
};

const TEXT_LINE_COLORS: Record<string, string> = {
  original: '#06b6d4',
  transliteration: '#f59e0b',
  translation: '#28a745',
  nextOriginal: '#06b6d4',
  nextTransliteration: '#f59e0b',
  nextTranslation: '#28a745'
};

function buildStageTextShadow(style?: StageTextStyle): string {
  if (!style?.textShadowColor && style?.textShadowBlur === undefined
      && style?.textShadowOffsetX === undefined && style?.textShadowOffsetY === undefined) {
    return '2px 2px 4px rgba(0, 0, 0, 0.8), 0 0 8px rgba(0, 0, 0, 0.5)';
  }
  const color = style.textShadowColor || 'rgba(0,0,0,0.8)';
  const blur = style.textShadowBlur ?? 4;
  const ox = style.textShadowOffsetX ?? 2;
  const oy = style.textShadowOffsetY ?? 2;
  return `${ox}px ${oy}px ${blur}px ${color}`;
}

function buildStageTextStroke(style?: StageTextStyle): string | undefined {
  if (!style?.textStrokeWidth) return undefined;
  return `${style.textStrokeWidth}px ${style.textStrokeColor || '#000000'}`;
}

const StageMonitorCanvas: React.FC<StageMonitorCanvasProps> = ({
  canvasDimensions,
  colors,
  header,
  clock,
  songTitle,
  currentSlideArea,
  currentSlideText,
  nextSlideArea,
  nextSlideText,
  selectedElement,
  onSelectElement,
  onElementChange,
  onTextStyleChange,
  onNextTextStyleChange,
  disabled = false,
  previewTexts
}) => {
  // Use custom preview texts or fall back to defaults
  const displayTexts = {
    original: previewTexts?.original || SAMPLE_TEXTS.original,
    transliteration: previewTexts?.transliteration || SAMPLE_TEXTS.transliteration,
    translation: previewTexts?.translation || SAMPLE_TEXTS.translation
  };
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 450 });
  const [activeSnapGuides, setActiveSnapGuides] = useState<SnapGuide[]>([]);
  const [measuredHeights, setMeasuredHeights] = useState<Record<string, number>>({});

  // Callback for snap guides
  const handleSnapGuidesChange = useCallback((guides: SnapGuide[]) => {
    setActiveSnapGuides(guides);
  }, []);

  // Callback for measured heights (auto-height mode)
  const handleHeightMeasured = useCallback((elementType: string, heightPercent: number) => {
    setMeasuredHeights(prev => {
      if (prev[elementType] === heightPercent) return prev;
      return { ...prev, [elementType]: heightPercent };
    });
  }, []);

  // Calculate canvas size to maintain aspect ratio
  useEffect(() => {
    const updateSize = () => {
      if (!containerRef.current) return;

      const containerWidth = containerRef.current.offsetWidth;
      const aspectRatio = canvasDimensions.width / canvasDimensions.height;

      const width = Math.min(containerWidth, 900);
      const height = width / aspectRatio;

      setCanvasSize({ width, height });
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [canvasDimensions]);

  // Handle element position change
  const handlePositionChange = (elementType: string, newPosition: StageElementPosition) => {
    onElementChange(elementType, newPosition);
  };

  // Handle text line position change
  const handleTextPositionChange = (lineType: 'original' | 'transliteration' | 'translation', newPosition: StageElementPosition) => {
    if (onTextStyleChange) {
      onTextStyleChange(lineType, newPosition);
    }
  };

  // Handle next slide text line position change
  const handleNextTextPositionChange = (lineType: 'original' | 'transliteration' | 'translation', newPosition: StageElementPosition) => {
    if (onNextTextStyleChange) {
      onNextTextStyleChange(lineType, newPosition);
    }
  };

  // Get alignment style for container
  const getAlignmentStyle = (alignH?: string, alignV?: string): React.CSSProperties => ({
    display: 'flex',
    justifyContent: alignH === 'left' ? 'flex-start' : alignH === 'right' ? 'flex-end' : 'center',
    alignItems: alignV === 'top' ? 'flex-start' : alignV === 'bottom' ? 'flex-end' : 'center',
    width: '100%',
    height: '100%',
    padding: 0,
    margin: 0,
    boxSizing: 'border-box',
    textAlign: alignH === 'left' ? 'left' : alignH === 'right' ? 'right' : 'center'
  });

  // Get text alignment
  const getTextAlign = (alignH?: string): 'left' | 'right' | 'center' => {
    return alignH === 'left' ? 'left' : alignH === 'right' ? 'right' : 'center';
  };

  // Calculate effective position for a text line based on flow mode
  const getEffectivePosition = (
    textStyle: StageTextStyle,
    allTextStyles: StageCurrentSlideText | StageNextSlideText,
    lineType: 'original' | 'transliteration' | 'translation',
    isNext: boolean = false,
    visited: Set<string> = new Set()
  ): { x: number; y: number; width: number; height: number } => {
    const defaultPos = getDefaultPosition(lineType, isNext);

    // Get the element key for measured heights lookup
    const elementKey = isNext
      ? `next${lineType.charAt(0).toUpperCase()}${lineType.slice(1)}`
      : lineType;

    // Cycle detection - prevent infinite recursion
    const visitKey = `${isNext ? 'next-' : ''}${lineType}`;
    if (visited.has(visitKey)) {
      console.warn(`[StageMonitorCanvas] Circular flow dependency detected at: ${visitKey}`);
      return {
        x: textStyle.x ?? defaultPos.x,
        y: textStyle.y ?? defaultPos.y,
        width: textStyle.width ?? defaultPos.width,
        height: textStyle.autoHeight && measuredHeights[elementKey] !== undefined
          ? measuredHeights[elementKey]
          : (textStyle.height ?? defaultPos.height)
      };
    }
    visited.add(visitKey);

    // Determine the effective height (use measured height if autoHeight is enabled)
    const effectiveHeight = textStyle.autoHeight && measuredHeights[elementKey] !== undefined
      ? measuredHeights[elementKey]
      : (textStyle.height ?? defaultPos.height);

    // If not in flow mode, use absolute position
    if (textStyle.positionMode !== 'flow') {
      return {
        x: textStyle.x ?? defaultPos.x,
        y: textStyle.y ?? defaultPos.y,
        width: textStyle.width ?? defaultPos.width,
        height: effectiveHeight
      };
    }

    // Flow mode - calculate position based on anchor
    let rawAnchor = textStyle.flowAnchor;
    // Strip 'next' prefix if present (e.g., 'nextOriginal' -> 'original')
    if (rawAnchor && rawAnchor.startsWith('next')) {
      rawAnchor = rawAnchor.charAt(4).toLowerCase() + rawAnchor.slice(5);
    }
    const anchor = rawAnchor as 'original' | 'transliteration' | 'translation' | undefined;
    const gap = textStyle.flowGap ?? 1;

    let y = textStyle.y ?? defaultPos.y;

    if (anchor && allTextStyles[anchor]) {
      const anchorStyle = allTextStyles[anchor];
      const anchorPos = getEffectivePosition(
        anchorStyle,
        allTextStyles,
        anchor,
        isNext,
        new Set(visited) // Pass a copy to preserve visited set for other branches
      );

      if (textStyle.flowBeside) {
        // Position beside - same Y as anchor
        y = anchorPos.y;
      } else {
        // Position below - Y = anchor's Y + anchor's height + gap
        y = anchorPos.y + anchorPos.height + gap;
      }
    }

    return {
      x: textStyle.x ?? defaultPos.x,
      y,
      width: textStyle.width ?? defaultPos.width,
      height: effectiveHeight
    };
  };

  // Get default position for a line type
  const getDefaultPosition = (lineType: 'original' | 'transliteration' | 'translation', isNext: boolean) => {
    if (isNext) {
      switch (lineType) {
        case 'original': return { x: 70, y: 25, width: 26, height: 12 };
        case 'transliteration': return { x: 70, y: 40, width: 26, height: 10 };
        case 'translation': return { x: 70, y: 52, width: 26, height: 10 };
      }
    } else {
      switch (lineType) {
        case 'original': return { x: 5, y: 20, width: 58, height: 15 };
        case 'transliteration': return { x: 5, y: 40, width: 58, height: 12 };
        case 'translation': return { x: 5, y: 55, width: 58, height: 12 };
      }
    }
  };

  // Calculate positions for current slide text lines
  const currentOriginalPos = currentSlideText?.original
    ? getEffectivePosition(currentSlideText.original, currentSlideText, 'original', false)
    : getDefaultPosition('original', false);
  const currentTranslitPos = currentSlideText?.transliteration
    ? getEffectivePosition(currentSlideText.transliteration, currentSlideText, 'transliteration', false)
    : getDefaultPosition('transliteration', false);
  const currentTranslationPos = currentSlideText?.translation
    ? getEffectivePosition(currentSlideText.translation, currentSlideText, 'translation', false)
    : getDefaultPosition('translation', false);

  // Calculate positions for next slide text lines
  const nextOriginalPos = nextSlideText?.original
    ? getEffectivePosition(nextSlideText.original, nextSlideText, 'original', true)
    : getDefaultPosition('original', true);
  const nextTranslitPos = nextSlideText?.transliteration
    ? getEffectivePosition(nextSlideText.transliteration, nextSlideText, 'transliteration', true)
    : getDefaultPosition('transliteration', true);
  const nextTranslationPos = nextSlideText?.translation
    ? getEffectivePosition(nextSlideText.translation, nextSlideText, 'translation', true)
    : getDefaultPosition('translation', true);

  // Build element bounds for snap detection
  const otherElements = useMemo((): ElementBounds[] => {
    const elements: ElementBounds[] = [];

    // Add stage elements (with fallback values for safety)
    if (header?.visible !== false && header?.x !== undefined) {
      elements.push({ id: 'header', x: header.x, y: header.y ?? 0, width: header.width ?? 100, height: header.height ?? 8 });
    }
    if (clock?.visible !== false && clock?.x !== undefined) {
      elements.push({ id: 'clock', x: clock.x, y: clock.y ?? 1, width: clock.width ?? 13, height: clock.height ?? 6 });
    }
    if (songTitle?.visible !== false && songTitle?.x !== undefined) {
      elements.push({ id: 'songTitle', x: songTitle.x, y: songTitle.y ?? 1, width: songTitle.width ?? 60, height: songTitle.height ?? 6 });
    }
    if (currentSlideArea?.visible !== false && currentSlideArea?.x !== undefined) {
      elements.push({ id: 'currentSlide', x: currentSlideArea.x, y: currentSlideArea.y ?? 12, width: currentSlideArea.width ?? 64, height: currentSlideArea.height ?? 84 });
    }
    if (nextSlideArea?.visible !== false && nextSlideArea?.x !== undefined) {
      elements.push({ id: 'nextSlide', x: nextSlideArea.x, y: nextSlideArea.y ?? 12, width: nextSlideArea.width ?? 30, height: nextSlideArea.height ?? 84 });
    }

    // Add current text lines
    if (currentSlideText?.original?.visible !== false) {
      elements.push({ id: 'original', ...currentOriginalPos });
    }
    if (currentSlideText?.transliteration?.visible !== false) {
      elements.push({ id: 'transliteration', ...currentTranslitPos });
    }
    if (currentSlideText?.translation?.visible !== false) {
      elements.push({ id: 'translation', ...currentTranslationPos });
    }

    // Add next text lines
    if (nextSlideText?.original?.visible !== false) {
      elements.push({ id: 'nextOriginal', ...nextOriginalPos });
    }
    if (nextSlideText?.transliteration?.visible !== false) {
      elements.push({ id: 'nextTransliteration', ...nextTranslitPos });
    }
    if (nextSlideText?.translation?.visible !== false) {
      elements.push({ id: 'nextTranslation', ...nextTranslationPos });
    }

    return elements;
  }, [
    header, clock, songTitle, currentSlideArea, nextSlideArea,
    currentSlideText, nextSlideText,
    currentOriginalPos, currentTranslitPos, currentTranslationPos,
    nextOriginalPos, nextTranslitPos, nextTranslationPos
  ]);

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

      <div
        style={{
          width: canvasSize.width,
          height: canvasSize.height,
          backgroundColor: colors?.background || '#0a0a0a',
          position: 'relative',
          overflow: 'hidden',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)'
        }}
        onMouseDown={() => onSelectElement(null)}
      >
        {/* Header element */}
        {header?.visible !== false && (
          <DraggableStageElement
            elementType="header"
            position={{
              x: header?.x ?? 0,
              y: header?.y ?? 0,
              width: header?.width ?? 100,
              height: header?.height ?? 8
            }}
            style={{
              backgroundColor: header?.backgroundColor || 'transparent',
              borderRadius: 0
            }}
            isSelected={selectedElement === 'header'}
            canvasSize={canvasSize}
            onPositionChange={(pos) => handlePositionChange('header', pos)}
            onSelect={() => onSelectElement('header')}
            disabled={disabled}
            otherElements={otherElements}
            onSnapGuidesChange={handleSnapGuidesChange}
            snapThreshold={1.5}
          />
        )}

        {/* Clock element */}
        {clock?.visible !== false && (
          <DraggableStageElement
            elementType="clock"
            position={{
              x: clock?.x ?? 85,
              y: clock?.y ?? 1,
              width: clock?.width ?? 13,
              height: clock?.height ?? 6
            }}
            style={{
              color: clock?.color || colors?.text || '#ffffff',
              fontSize: clock?.fontSize
            }}
            isSelected={selectedElement === 'clock'}
            canvasSize={canvasSize}
            onPositionChange={(pos) => handlePositionChange('clock', pos)}
            onSelect={() => onSelectElement('clock')}
            disabled={disabled}
            otherElements={otherElements}
            onSnapGuidesChange={handleSnapGuidesChange}
            snapThreshold={1.5}
          >
            <div
              style={{
                fontSize: `${2.5 * ((clock?.fontSize || 100) / 100) * canvasSize.width / 100}px`,
                fontWeight: (clock?.fontWeight || 'bold') as any,
                color: clock?.color || colors?.text || '#ffffff',
                fontFamily: clock?.fontFamily || 'monospace',
                width: '100%',
                textAlign: clock?.alignH === 'left' ? 'left' : clock?.alignH === 'right' ? 'right' : 'center'
              }}
            >
              12:34{clock?.showSeconds ? ':56' : ''}
            </div>
          </DraggableStageElement>
        )}

        {/* Song Title element */}
        {songTitle?.visible !== false && (
          <DraggableStageElement
            elementType="songTitle"
            position={{
              x: songTitle?.x ?? 2,
              y: songTitle?.y ?? 1,
              width: songTitle?.width ?? 60,
              height: songTitle?.height ?? 6
            }}
            style={{
              color: songTitle?.color || colors?.accent || '#4a90d9',
              fontSize: songTitle?.fontSize
            }}
            isSelected={selectedElement === 'songTitle'}
            canvasSize={canvasSize}
            onPositionChange={(pos) => handlePositionChange('songTitle', pos)}
            onSelect={() => onSelectElement('songTitle')}
            disabled={disabled}
            otherElements={otherElements}
            onSnapGuidesChange={handleSnapGuidesChange}
            snapThreshold={1.5}
          >
            <div
              style={{
                fontSize: `${2 * ((songTitle?.fontSize || 100) / 100) * canvasSize.width / 100}px`,
                fontWeight: (songTitle?.fontWeight || '600') as any,
                color: songTitle?.color || colors?.accent || '#4a90d9',
                width: '100%',
                textAlign: songTitle?.alignH === 'left' ? 'left' : songTitle?.alignH === 'right' ? 'right' : 'center',
                paddingLeft: songTitle?.alignH === 'left' ? '8px' : '0',
                paddingRight: songTitle?.alignH === 'right' ? '8px' : '0'
              }}
            >
              Song Title Here
            </div>
          </DraggableStageElement>
        )}

        {/* Current Slide Area (background only) */}
        <DraggableStageElement
          elementType="currentSlide"
          position={{
            x: currentSlideArea?.x ?? 2,
            y: currentSlideArea?.y ?? 12,
            width: currentSlideArea?.width ?? 64,
            height: currentSlideArea?.height ?? 84
          }}
          style={{
            backgroundColor: currentSlideArea?.backgroundColor || 'rgba(255,255,255,0.03)',
            borderRadius: currentSlideArea?.borderRadius || 12
          }}
          isSelected={selectedElement === 'currentSlide'}
          canvasSize={canvasSize}
          onPositionChange={(pos) => handlePositionChange('currentSlideArea', pos)}
          onSelect={() => onSelectElement('currentSlide')}
          disabled={disabled}
          otherElements={otherElements}
          onSnapGuidesChange={handleSnapGuidesChange}
          snapThreshold={1.5}
        />

        {/* Original Text Line - Draggable */}
        {currentSlideText?.original?.visible !== false && (
          <DraggableStageElement
            elementType="original"
            position={currentOriginalPos}
            style={{
              backgroundColor: 'transparent',
              borderRadius: 4
            }}
            customColor={TEXT_LINE_COLORS.original}
            isSelected={selectedElement === 'original'}
            canvasSize={canvasSize}
            onPositionChange={(pos) => handleTextPositionChange('original', pos)}
            onSelect={() => onSelectElement('original')}
            disabled={disabled}
            otherElements={otherElements}
            onSnapGuidesChange={handleSnapGuidesChange}
            snapThreshold={1.5}
            autoHeight={currentSlideText?.original?.autoHeight}
            measuredHeight={measuredHeights['original']}
            onHeightMeasured={handleHeightMeasured}
          >
            <div style={getAlignmentStyle(currentSlideText?.original?.alignH, currentSlideText?.original?.alignV)}>
              <div
                style={{
                  width: '100%',
                  fontSize: `${(currentSlideText?.original?.fontSize || 100) / 25 * canvasSize.width / 100}px`,
                  fontWeight: (currentSlideText?.original?.fontWeight || 'bold') as any,
                  color: currentSlideText?.original?.color || colors?.text || '#ffffff',
                  opacity: currentSlideText?.original?.opacity ?? 1,
                  direction: 'rtl',
                  textAlign: getTextAlign(currentSlideText?.original?.alignH),
                  lineHeight: 1.3,
                  textShadow: buildStageTextShadow(currentSlideText?.original),
                  WebkitTextStroke: buildStageTextStroke(currentSlideText?.original),
                  paintOrder: 'stroke fill'
                }}
              >
                {displayTexts.original}
              </div>
            </div>
          </DraggableStageElement>
        )}

        {/* Transliteration Text Line - Draggable */}
        {currentSlideText?.transliteration?.visible !== false && (
          <DraggableStageElement
            elementType="transliteration"
            position={currentTranslitPos}
            style={{
              backgroundColor: 'transparent',
              borderRadius: 4
            }}
            customColor={TEXT_LINE_COLORS.transliteration}
            isSelected={selectedElement === 'transliteration'}
            canvasSize={canvasSize}
            onPositionChange={(pos) => handleTextPositionChange('transliteration', pos)}
            onSelect={() => onSelectElement('transliteration')}
            disabled={disabled}
            otherElements={otherElements}
            onSnapGuidesChange={handleSnapGuidesChange}
            snapThreshold={1.5}
            autoHeight={currentSlideText?.transliteration?.autoHeight}
            measuredHeight={measuredHeights['transliteration']}
            onHeightMeasured={handleHeightMeasured}
          >
            <div style={getAlignmentStyle(currentSlideText?.transliteration?.alignH, currentSlideText?.transliteration?.alignV)}>
              <div
                style={{
                  width: '100%',
                  fontSize: `${(currentSlideText?.transliteration?.fontSize || 100) / 30 * canvasSize.width / 100}px`,
                  fontWeight: (currentSlideText?.transliteration?.fontWeight || '400') as any,
                  color: currentSlideText?.transliteration?.color || colors?.secondary || '#888',
                  opacity: currentSlideText?.transliteration?.opacity ?? 1,
                  textAlign: getTextAlign(currentSlideText?.transliteration?.alignH),
                  lineHeight: 1.3,
                  textShadow: buildStageTextShadow(currentSlideText?.transliteration),
                  WebkitTextStroke: buildStageTextStroke(currentSlideText?.transliteration),
                  paintOrder: 'stroke fill'
                }}
              >
                {displayTexts.transliteration}
              </div>
            </div>
          </DraggableStageElement>
        )}

        {/* Translation Text Line - Draggable */}
        {currentSlideText?.translation?.visible !== false && (
          <DraggableStageElement
            elementType="translation"
            position={currentTranslationPos}
            style={{
              backgroundColor: 'transparent',
              borderRadius: 4
            }}
            customColor={TEXT_LINE_COLORS.translation}
            isSelected={selectedElement === 'translation'}
            canvasSize={canvasSize}
            onPositionChange={(pos) => handleTextPositionChange('translation', pos)}
            onSelect={() => onSelectElement('translation')}
            disabled={disabled}
            otherElements={otherElements}
            onSnapGuidesChange={handleSnapGuidesChange}
            snapThreshold={1.5}
            autoHeight={currentSlideText?.translation?.autoHeight}
            measuredHeight={measuredHeights['translation']}
            onHeightMeasured={handleHeightMeasured}
          >
            <div style={getAlignmentStyle(currentSlideText?.translation?.alignH, currentSlideText?.translation?.alignV)}>
              <div
                style={{
                  width: '100%',
                  fontSize: `${(currentSlideText?.translation?.fontSize || 100) / 35 * canvasSize.width / 100}px`,
                  fontWeight: (currentSlideText?.translation?.fontWeight || '400') as any,
                  color: currentSlideText?.translation?.color || colors?.text || '#ffffff',
                  opacity: currentSlideText?.translation?.opacity ?? 0.9,
                  textAlign: getTextAlign(currentSlideText?.translation?.alignH),
                  lineHeight: 1.3,
                  textShadow: buildStageTextShadow(currentSlideText?.translation),
                  WebkitTextStroke: buildStageTextStroke(currentSlideText?.translation),
                  paintOrder: 'stroke fill'
                }}
              >
                {displayTexts.translation}
              </div>
            </div>
          </DraggableStageElement>
        )}

        {/* Next Slide Preview Area (background only) */}
        {nextSlideArea?.visible !== false && (
          <DraggableStageElement
            elementType="nextSlide"
            position={{
              x: nextSlideArea?.x ?? 68,
              y: nextSlideArea?.y ?? 12,
              width: nextSlideArea?.width ?? 30,
              height: nextSlideArea?.height ?? 84
            }}
            style={{
              backgroundColor: nextSlideArea?.backgroundColor || '#1a1a1a',
              borderRadius: nextSlideArea?.borderRadius || 8
            }}
            isSelected={selectedElement === 'nextSlide'}
            canvasSize={canvasSize}
            onPositionChange={(pos) => handlePositionChange('nextSlideArea', pos)}
            onSelect={() => onSelectElement('nextSlide')}
            disabled={disabled}
            otherElements={otherElements}
            onSnapGuidesChange={handleSnapGuidesChange}
            snapThreshold={1.5}
          >
            <div
              style={{
                position: 'absolute',
                top: '4px',
                left: '0',
                right: '0',
                fontSize: '10px',
                color: nextSlideArea?.labelColor || colors?.secondary || '#888',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                textAlign: 'center',
                opacity: nextSlideArea?.opacity ?? 0.8
              }}
            >
              {nextSlideArea?.labelText || 'Next'}
            </div>
          </DraggableStageElement>
        )}

        {/* Next Slide Original Text Line - Draggable */}
        {nextSlideArea?.visible !== false && nextSlideText?.original?.visible !== false && (
          <DraggableStageElement
            elementType="nextOriginal"
            position={nextOriginalPos}
            style={{
              backgroundColor: 'transparent',
              borderRadius: 4
            }}
            customColor={TEXT_LINE_COLORS.nextOriginal}
            isSelected={selectedElement === 'nextOriginal'}
            canvasSize={canvasSize}
            onPositionChange={(pos) => handleNextTextPositionChange('original', pos)}
            onSelect={() => onSelectElement('nextOriginal')}
            disabled={disabled}
            otherElements={otherElements}
            onSnapGuidesChange={handleSnapGuidesChange}
            snapThreshold={1.5}
            autoHeight={nextSlideText?.original?.autoHeight}
            measuredHeight={measuredHeights['nextOriginal']}
            onHeightMeasured={handleHeightMeasured}
          >
            <div style={getAlignmentStyle(nextSlideText?.original?.alignH, nextSlideText?.original?.alignV)}>
              <div
                style={{
                  width: '100%',
                  fontSize: `${(nextSlideText?.original?.fontSize || 100) / 40 * canvasSize.width / 100}px`,
                  fontWeight: (nextSlideText?.original?.fontWeight || 'bold') as any,
                  color: nextSlideText?.original?.color || colors?.text || '#ffffff',
                  opacity: nextSlideText?.original?.opacity ?? 0.8,
                  direction: 'rtl',
                  textAlign: getTextAlign(nextSlideText?.original?.alignH),
                  lineHeight: 1.3,
                  textShadow: buildStageTextShadow(nextSlideText?.original),
                  WebkitTextStroke: buildStageTextStroke(nextSlideText?.original),
                  paintOrder: 'stroke fill'
                }}
              >
                {displayTexts.original}
              </div>
            </div>
          </DraggableStageElement>
        )}

        {/* Next Slide Transliteration Text Line - Draggable */}
        {nextSlideArea?.visible !== false && nextSlideText?.transliteration?.visible !== false && (
          <DraggableStageElement
            elementType="nextTransliteration"
            position={nextTranslitPos}
            style={{
              backgroundColor: 'transparent',
              borderRadius: 4
            }}
            customColor={TEXT_LINE_COLORS.nextTransliteration}
            isSelected={selectedElement === 'nextTransliteration'}
            canvasSize={canvasSize}
            onPositionChange={(pos) => handleNextTextPositionChange('transliteration', pos)}
            onSelect={() => onSelectElement('nextTransliteration')}
            disabled={disabled}
            otherElements={otherElements}
            onSnapGuidesChange={handleSnapGuidesChange}
            snapThreshold={1.5}
            autoHeight={nextSlideText?.transliteration?.autoHeight}
            measuredHeight={measuredHeights['nextTransliteration']}
            onHeightMeasured={handleHeightMeasured}
          >
            <div style={getAlignmentStyle(nextSlideText?.transliteration?.alignH, nextSlideText?.transliteration?.alignV)}>
              <div
                style={{
                  width: '100%',
                  fontSize: `${(nextSlideText?.transliteration?.fontSize || 100) / 50 * canvasSize.width / 100}px`,
                  fontWeight: (nextSlideText?.transliteration?.fontWeight || '400') as any,
                  color: nextSlideText?.transliteration?.color || colors?.secondary || '#888',
                  opacity: nextSlideText?.transliteration?.opacity ?? 0.7,
                  textAlign: getTextAlign(nextSlideText?.transliteration?.alignH),
                  lineHeight: 1.3,
                  textShadow: buildStageTextShadow(nextSlideText?.transliteration),
                  WebkitTextStroke: buildStageTextStroke(nextSlideText?.transliteration),
                  paintOrder: 'stroke fill'
                }}
              >
                {displayTexts.transliteration}
              </div>
            </div>
          </DraggableStageElement>
        )}

        {/* Next Slide Translation Text Line - Draggable */}
        {nextSlideArea?.visible !== false && nextSlideText?.translation?.visible !== false && (
          <DraggableStageElement
            elementType="nextTranslation"
            position={nextTranslationPos}
            style={{
              backgroundColor: 'transparent',
              borderRadius: 4
            }}
            customColor={TEXT_LINE_COLORS.nextTranslation}
            isSelected={selectedElement === 'nextTranslation'}
            canvasSize={canvasSize}
            onPositionChange={(pos) => handleNextTextPositionChange('translation', pos)}
            onSelect={() => onSelectElement('nextTranslation')}
            disabled={disabled}
            otherElements={otherElements}
            onSnapGuidesChange={handleSnapGuidesChange}
            snapThreshold={1.5}
            autoHeight={nextSlideText?.translation?.autoHeight}
            measuredHeight={measuredHeights['nextTranslation']}
            onHeightMeasured={handleHeightMeasured}
          >
            <div style={getAlignmentStyle(nextSlideText?.translation?.alignH, nextSlideText?.translation?.alignV)}>
              <div
                style={{
                  width: '100%',
                  fontSize: `${(nextSlideText?.translation?.fontSize || 100) / 50 * canvasSize.width / 100}px`,
                  fontWeight: (nextSlideText?.translation?.fontWeight || '400') as any,
                  color: nextSlideText?.translation?.color || colors?.text || '#ffffff',
                  opacity: nextSlideText?.translation?.opacity ?? 0.7,
                  textAlign: getTextAlign(nextSlideText?.translation?.alignH),
                  lineHeight: 1.3,
                  textShadow: buildStageTextShadow(nextSlideText?.translation),
                  WebkitTextStroke: buildStageTextStroke(nextSlideText?.translation),
                  paintOrder: 'stroke fill'
                }}
              >
                {displayTexts.translation}
              </div>
            </div>
          </DraggableStageElement>
        )}

        {/* Snap guide lines */}
        {activeSnapGuides.map((guide, index) => (
          <div
            key={`guide-${guide.type}-${guide.position.toFixed(2)}-${index}`}
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
        Drag elements to reposition • Resize from edges • Click to select
      </div>
    </div>
  );
};

export default StageMonitorCanvas;
