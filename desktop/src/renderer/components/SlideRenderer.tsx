import React, { useRef, useEffect, useState } from 'react';

/**
 * SlideRenderer - Unified rendering component for slides
 *
 * This component renders slide content at a fixed reference resolution
 * and scales to fit any container using CSS transform. This ensures
 * pixel-perfect consistency across:
 * - Theme Editor canvas
 * - Live Preview
 * - Connected Display (viewer window)
 *
 * Key principle: Render at reference resolution, scale to fit.
 */

interface SlideData {
  originalText?: string;
  transliteration?: string;
  translation?: string;
}

interface PresentationTextBox {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  color: string;
  backgroundColor: string;
  textAlign: 'left' | 'center' | 'right';
  verticalAlign: 'top' | 'center' | 'bottom';
  bold: boolean;
  italic: boolean;
  underline: boolean;
  opacity: number;
  zIndex?: number;
  textDirection?: 'ltr' | 'rtl';
}

interface PresentationImageBox {
  id: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  objectFit: 'contain' | 'cover' | 'fill';
  borderRadius: number;
  zIndex?: number;
}

interface PresentationSlide {
  id: string;
  order: number;
  textBoxes: PresentationTextBox[];
  imageBoxes?: PresentationImageBox[];
  backgroundColor?: string;
}

interface LinePosition {
  x: number;      // percentage
  y: number;      // percentage
  width: number;  // percentage
  height: number; // percentage
  paddingTop: number;
  paddingBottom: number;
  alignH: 'left' | 'center' | 'right';
  alignV: 'top' | 'center' | 'bottom';
}

interface LineStyle {
  fontSize: number;   // 100 = base size
  fontWeight: string;
  color: string;
  opacity: number;
  visible: boolean;
}

interface BackgroundBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  opacity: number;
  borderRadius: number;
}

interface CanvasDimensions {
  width: number;
  height: number;
}

interface Theme {
  lineOrder?: string[];
  lineStyles?: Record<string, LineStyle>;
  linePositions?: Record<string, LinePosition> | null;
  backgroundBoxes?: BackgroundBox[] | null;
  canvasDimensions?: CanvasDimensions;
  viewerBackground?: { type?: string; color?: string };
}

interface SlideRendererProps {
  slideData: SlideData | null;
  displayMode: string;
  theme: Theme | null;
  backgroundImage?: string;
  isBlank?: boolean;

  // Container behavior
  containerWidth?: number;   // If provided, scale to fit this width
  containerHeight?: number;  // If provided, scale to fit this height
  fillContainer?: boolean;   // If true, fill the entire container (for viewer windows)

  // Editor mode (show placeholder text even without slideData)
  editorMode?: boolean;

  // Optional: custom sample text for editor
  sampleText?: Record<string, string>;

  // Presentation mode (renders textboxes with embedded styling instead of theme)
  presentationSlide?: PresentationSlide | null;
}

const DEFAULT_SAMPLE_TEXT: Record<string, string> = {
  original: 'שִׁירוּ לַיהוָה שִׁיר חָדָשׁ',
  transliteration: 'Shiru lAdonai shir chadash',
  translation: 'Sing to the Lord a new song'
};

// Default line positions - matches Classic theme (NewDefault values)
const DEFAULT_LINE_POSITIONS: Record<string, LinePosition> = {
  original: {
    x: 0, y: 27.897104546981193, width: 100, height: 11.379800853485063,
    paddingTop: 2, paddingBottom: 2,
    alignH: 'center', alignV: 'center'
  },
  transliteration: {
    x: 0, y: 38.96539940433855, width: 100, height: 12.138454243717401,
    paddingTop: 1, paddingBottom: 1,
    alignH: 'center', alignV: 'center'
  },
  translation: {
    x: 0, y: 50.838474679449185, width: 100, height: 27.311522048364157,
    paddingTop: 1, paddingBottom: 1,
    alignH: 'center', alignV: 'top'
  }
};

// Default line styles - matches Classic theme (NewDefault values)
const DEFAULT_LINE_STYLES: Record<string, LineStyle> = {
  original: {
    fontSize: 187, fontWeight: '700', color: '#ffffff', opacity: 1, visible: true
  },
  transliteration: {
    fontSize: 136, fontWeight: '400', color: '#e0e0e0', opacity: 0.9, visible: true
  },
  translation: {
    fontSize: 146, fontWeight: '400', color: '#b0b0b0', opacity: 0.85, visible: true
  }
};

const SlideRenderer: React.FC<SlideRendererProps> = ({
  slideData,
  displayMode,
  theme,
  backgroundImage,
  isBlank = false,
  containerWidth,
  containerHeight,
  fillContainer = false,
  editorMode = false,
  sampleText = DEFAULT_SAMPLE_TEXT,
  presentationSlide
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  // Reference dimensions from theme or default to 1920x1080
  const refWidth = theme?.canvasDimensions?.width || 1920;
  const refHeight = theme?.canvasDimensions?.height || 1080;
  const aspectRatio = refHeight / refWidth;

  // Calculate scale factor to fit container
  useEffect(() => {
    const calculateScale = () => {
      if (fillContainer) {
        // For viewer windows, fill the entire viewport
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const scaleX = viewportWidth / refWidth;
        const scaleY = viewportHeight / refHeight;
        setScale(Math.min(scaleX, scaleY));
      } else if (containerWidth && containerHeight) {
        // Fit within provided dimensions
        const scaleX = containerWidth / refWidth;
        const scaleY = containerHeight / refHeight;
        setScale(Math.min(scaleX, scaleY));
      } else if (containerRef.current) {
        // Auto-detect container size
        const rect = containerRef.current.parentElement?.getBoundingClientRect();
        if (rect) {
          const scaleX = rect.width / refWidth;
          const scaleY = rect.height / refHeight;
          setScale(Math.min(scaleX, scaleY));
        }
      }
    };

    calculateScale();
    window.addEventListener('resize', calculateScale);
    return () => window.removeEventListener('resize', calculateScale);
  }, [refWidth, refHeight, containerWidth, containerHeight, fillContainer]);

  // Get line order from theme
  const lineOrder = theme?.lineOrder || ['original', 'transliteration', 'translation'];

  // Always use absolute positioning with defaults if theme doesn't have positions
  // This ensures Theme Editor, Preview, and Display all match
  const effectiveLinePositions = theme?.linePositions || DEFAULT_LINE_POSITIONS;
  const effectiveLineStyles = theme?.lineStyles || DEFAULT_LINE_STYLES;

  // Calculate base font size in pixels at reference resolution
  // Base: 5% of reference height at fontSize=100
  const getBaseFontSize = () => {
    return refHeight * 0.05; // 54px at 1080p
  };

  // Get font size for a line type in pixels
  const getFontSize = (lineType: string): number => {
    const style = effectiveLineStyles[lineType] || DEFAULT_LINE_STYLES[lineType];
    const baseFontSize = getBaseFontSize();
    const fontSizeMultiplier = (style?.fontSize || 100) / 100;
    return baseFontSize * fontSizeMultiplier;
  };

  // Get text content for a line
  const getLineContent = (lineType: string): string | null => {
    if (editorMode && !slideData) {
      return sampleText[lineType] || '';
    }

    if (!slideData) return null;

    switch (lineType) {
      case 'original':
        return slideData.originalText || null;
      case 'transliteration':
        return slideData.transliteration || null;
      case 'translation':
        return slideData.translation || null;
      default:
        return null;
    }
  };

  // Check if line should be visible based on display mode
  const shouldShowLine = (lineType: string): boolean => {
    switch (lineType) {
      case 'original':
        return displayMode === 'bilingual' || displayMode === 'original';
      case 'transliteration':
        return displayMode === 'bilingual';
      case 'translation':
        return displayMode === 'bilingual' || displayMode === 'translation';
      default:
        return false;
    }
  };

  // Render background boxes
  const renderBackgroundBoxes = () => {
    if (!theme?.backgroundBoxes || theme.backgroundBoxes.length === 0) return null;

    return theme.backgroundBoxes.map((box) => (
      <div
        key={box.id}
        style={{
          position: 'absolute',
          left: `${box.x}%`,
          top: `${box.y}%`,
          width: `${box.width}%`,
          height: `${box.height}%`,
          backgroundColor: box.color,
          opacity: box.opacity,
          borderRadius: box.borderRadius,
          zIndex: 1
        }}
      />
    ));
  };

  // Render lines with absolute positioning (always used - with defaults if no theme positions)
  const renderAbsoluteLines = () => {
    return lineOrder.map((lineType) => {
      const position = effectiveLinePositions[lineType];
      const style = effectiveLineStyles[lineType];

      if (!position) return null;
      if (style?.visible === false) return null;
      if (!shouldShowLine(lineType)) return null;

      const content = getLineContent(lineType);
      if (!content && !editorMode) return null;

      const fontSize = getFontSize(lineType);
      const isRtl = lineType === 'original';

      // Map alignment to CSS
      const justifyContent = position.alignH === 'left' ? 'flex-start' :
                            position.alignH === 'right' ? 'flex-end' : 'center';
      const alignItems = position.alignV === 'top' ? 'flex-start' :
                        position.alignV === 'bottom' ? 'flex-end' : 'center';

      return (
        <div
          key={lineType}
          style={{
            position: 'absolute',
            left: `${position.x}%`,
            top: `${position.y}%`,
            width: `${position.width}%`,
            height: `${position.height}%`,
            display: 'flex',
            justifyContent,
            alignItems,
            paddingTop: `${position.paddingTop}%`,
            paddingBottom: `${position.paddingBottom}%`,
            boxSizing: 'border-box',
            zIndex: 2
          }}
        >
          <div
            style={{
              fontSize: `${fontSize}px`,
              fontWeight: style?.fontWeight || '500',
              color: style?.color || '#FFFFFF',
              opacity: style?.opacity ?? 1,
              direction: isRtl ? 'rtl' : 'ltr',
              textAlign: position.alignH,
              lineHeight: 1.4,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}
          >
            {content}
          </div>
        </div>
      );
    });
  };

  // Render lines with flow layout (legacy mode)
  const renderFlowLines = () => {
    return lineOrder.map((lineType) => {
      const style = theme?.lineStyles?.[lineType];

      if (style?.visible === false) return null;
      if (!shouldShowLine(lineType)) return null;

      const content = getLineContent(lineType);
      if (!content && !editorMode) return null;

      const fontSize = getFontSize(lineType);
      const isRtl = lineType === 'original';

      return (
        <div
          key={lineType}
          style={{
            fontSize: `${fontSize}px`,
            fontWeight: style?.fontWeight || '500',
            color: style?.color || '#FFFFFF',
            opacity: style?.opacity ?? 1,
            direction: isRtl ? 'rtl' : 'ltr',
            marginBottom: refHeight * 0.02, // 2% of height
            lineHeight: 1.4
          }}
        >
          {content}
        </div>
      );
    });
  };

  // Render presentation image boxes
  const renderPresentationImageBoxes = () => {
    if (!presentationSlide?.imageBoxes) return null;

    return presentationSlide.imageBoxes.map((imageBox) => (
      <div
        key={imageBox.id}
        style={{
          position: 'absolute',
          left: `${imageBox.x}%`,
          top: `${imageBox.y}%`,
          width: `${imageBox.width}%`,
          height: `${imageBox.height}%`,
          zIndex: imageBox.zIndex ?? 0
        }}
      >
        <img
          src={imageBox.src}
          alt=""
          style={{
            width: '100%',
            height: '100%',
            objectFit: imageBox.objectFit,
            opacity: imageBox.opacity,
            borderRadius: `${imageBox.borderRadius}px`
          }}
        />
      </div>
    ));
  };

  // Render presentation textboxes with embedded styling
  const renderPresentationTextBoxes = () => {
    if (!presentationSlide?.textBoxes) return null;

    return presentationSlide.textBoxes.map((textBox) => {
      // Calculate font size in pixels based on percentage (100 = 5% of height = 54px at 1080p)
      const baseFontSize = refHeight * 0.05;
      const fontSize = baseFontSize * (textBox.fontSize / 100);

      // Map alignment to CSS flexbox
      const justifyContent = textBox.textAlign === 'left' ? 'flex-start' :
                            textBox.textAlign === 'right' ? 'flex-end' : 'center';
      const alignItems = textBox.verticalAlign === 'top' ? 'flex-start' :
                        textBox.verticalAlign === 'bottom' ? 'flex-end' : 'center';

      return (
        <div
          key={textBox.id}
          style={{
            position: 'absolute',
            left: `${textBox.x}%`,
            top: `${textBox.y}%`,
            width: `${textBox.width}%`,
            height: `${textBox.height}%`,
            display: 'flex',
            justifyContent,
            alignItems,
            backgroundColor: textBox.backgroundColor || 'transparent',
            opacity: textBox.opacity ?? 1,
            boxSizing: 'border-box',
            padding: '8px',
            zIndex: textBox.zIndex ?? 0
          }}
        >
          <div
            dir={textBox.textDirection || 'ltr'}
            style={{
              fontSize: `${fontSize}px`,
              fontWeight: textBox.bold ? '700' : '400',
              fontStyle: textBox.italic ? 'italic' : 'normal',
              textDecoration: textBox.underline ? 'underline' : 'none',
              color: textBox.color || '#FFFFFF',
              textAlign: textBox.textAlign,
              direction: textBox.textDirection || 'ltr',
              lineHeight: 1.4,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              width: '100%'
            }}
          >
            {textBox.text}
          </div>
        </div>
      );
    });
  };

  // Get presentation slide background (if any)
  const getPresentationBackgroundStyle = (): React.CSSProperties => {
    const style: React.CSSProperties = {
      backgroundColor: presentationSlide?.backgroundColor || '#000000'
    };
    return style;
  };

  // Build background style
  const getBackgroundStyle = (): React.CSSProperties => {
    const style: React.CSSProperties = {
      backgroundColor: '#000000'
    };

    if (backgroundImage) {
      if (backgroundImage.startsWith('linear-gradient') || backgroundImage.startsWith('radial-gradient')) {
        style.background = backgroundImage;
      } else if (backgroundImage.startsWith('#') || backgroundImage.startsWith('rgb')) {
        style.backgroundColor = backgroundImage;
      } else {
        style.backgroundImage = `url(${backgroundImage})`;
        style.backgroundSize = 'cover';
        style.backgroundPosition = 'center';
      }
    } else if (theme?.viewerBackground?.type === 'color' && theme.viewerBackground.color) {
      const color = theme.viewerBackground.color;
      if (color.startsWith('linear-gradient') || color.startsWith('radial-gradient')) {
        style.background = color;
      } else {
        style.backgroundColor = color;
      }
    }

    return style;
  };

  // Get positioning style for flow layout
  const getFlowPositioningStyle = (): React.CSSProperties => {
    return {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      textAlign: 'center',
      width: '100%',
      height: '100%',
      padding: `${refHeight * 0.05}px ${refWidth * 0.1}px`,
      boxSizing: 'border-box'
    };
  };

  // Calculate the scaled dimensions for the outer wrapper
  const scaledWidth = refWidth * scale;
  const scaledHeight = refHeight * scale;

  // Render blank screen
  if (isBlank) {
    return (
      <div
        ref={containerRef}
        style={{
          width: fillContainer ? '100vw' : scaledWidth,
          height: fillContainer ? '100vh' : scaledHeight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden'
        }}
      >
        {/* Wrapper that's the scaled size, containing the full-size content */}
        <div style={{
          width: scaledWidth,
          height: scaledHeight,
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Full-size content, scaled down with transform */}
          <div
            style={{
              width: refWidth,
              height: refHeight,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              position: 'absolute',
              top: 0,
              left: 0,
              ...getBackgroundStyle()
            }}
          />
        </div>
      </div>
    );
  }

  // Check if we're rendering a presentation slide
  const isPresentation = !!presentationSlide;

  return (
    <div
      ref={containerRef}
      style={{
        width: fillContainer ? '100vw' : scaledWidth,
        height: fillContainer ? '100vh' : scaledHeight,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden'
      }}
    >
      {/* Wrapper that's the scaled size, containing the full-size content */}
      <div style={{
        width: scaledWidth,
        height: scaledHeight,
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Full-size content (1920x1080), scaled down with transform */}
        <div
          style={{
            width: refWidth,
            height: refHeight,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            position: 'absolute',
            top: 0,
            left: 0,
            ...(isPresentation ? getPresentationBackgroundStyle() : getBackgroundStyle())
          }}
        >
          {isPresentation ? (
            /* Presentation mode - render image boxes and textboxes with embedded styling */
            <>
              {renderPresentationImageBoxes()}
              {renderPresentationTextBoxes()}
            </>
          ) : (
            <>
              {/* Background boxes */}
              {renderBackgroundBoxes()}

              {/* Content - always use absolute positioning with defaults if needed */}
              {renderAbsoluteLines()}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SlideRenderer;
