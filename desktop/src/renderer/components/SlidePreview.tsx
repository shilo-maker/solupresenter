import React, { useRef, useEffect, useState } from 'react';
import SlideRenderer from './SlideRenderer';

/**
 * SlidePreview - Live preview component for the control panel
 *
 * This is a thin wrapper around SlideRenderer that handles:
 * - Auto-sizing to fit its container
 * - Maintaining aspect ratio
 * - Optional "PREVIEW" badge
 */

interface SlideData {
  originalText?: string;
  transliteration?: string;
  translation?: string;
  reference?: string;  // Bible verse reference or Hebrew reference for prayer
  referenceTranslation?: string;  // English reference for prayer
  // Prayer/Sermon content fields
  title?: string;
  titleTranslation?: string;
  subtitle?: string;
  subtitleTranslation?: string;
  description?: string;
  descriptionTranslation?: string;
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
  x: number;
  y: number;
  width: number;
  height: number;
  paddingTop: number;
  paddingBottom: number;
  alignH: 'left' | 'center' | 'right';
  alignV: 'top' | 'center' | 'bottom';
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

interface Theme {
  lineOrder?: string[];
  lineStyles?: Record<string, any>;
  positioning?: { vertical?: string; horizontal?: string };
  container?: Record<string, any>;
  viewerBackground?: { type?: string; color?: string };
  linePositions?: Record<string, LinePosition> | null;
  backgroundBoxes?: BackgroundBox[] | null;
  canvasDimensions?: { width: number; height: number };
  // Bible/Prayer reference lines
  referenceStyle?: any;
  referencePosition?: LinePosition;
  referenceTranslationStyle?: any;
  referenceTranslationPosition?: LinePosition;
}

interface ToolsState {
  countdown?: { active: boolean; remaining: string; message: string };
  announcement?: { active: boolean; text: string };
  rotatingMessages?: { active: boolean; messages: string[]; currentIndex: number };
  clock?: { active: boolean; time: string; date: string };
  stopwatch?: { active: boolean; time: string; running: boolean };
}

interface SlidePreviewProps {
  slideData: SlideData | null;
  displayMode: string;
  isBlank: boolean;
  backgroundImage: string;
  theme: Theme | null;
  tools?: ToolsState;
  activeMedia?: { type: 'image' | 'video'; url: string } | null;
  showBadge?: boolean;
  presentationSlide?: PresentationSlide | null;
}

const SlidePreview: React.FC<SlidePreviewProps> = ({
  slideData,
  displayMode,
  isBlank,
  backgroundImage,
  theme,
  tools,
  activeMedia,
  showBadge = true,
  presentationSlide
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Get reference dimensions from theme
  const refWidth = theme?.canvasDimensions?.width || 1920;
  const refHeight = theme?.canvasDimensions?.height || 1080;
  const aspectRatio = refHeight / refWidth;

  // Measure container and calculate display size
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };

    updateSize();
    const resizeObserver = new ResizeObserver(updateSize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  // Calculate the size that fits within the container while maintaining aspect ratio
  const calculateFitSize = () => {
    if (containerSize.width === 0 || containerSize.height === 0) {
      return { width: 0, height: 0 };
    }

    const containerAspect = containerSize.height / containerSize.width;

    if (containerAspect > aspectRatio) {
      // Container is taller - fit to width
      return {
        width: containerSize.width,
        height: containerSize.width * aspectRatio
      };
    } else {
      // Container is wider - fit to height
      return {
        width: containerSize.height / aspectRatio,
        height: containerSize.height
      };
    }
  };

  const fitSize = calculateFitSize();

  // Render tool overlays (countdown, clock, etc.)
  const renderToolOverlays = () => {
    if (!tools) return null;

    const overlayStyle: React.CSSProperties = {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0, 0, 0, 0.9)',
      zIndex: 100
    };

    if (tools.countdown?.active) {
      return (
        <div style={overlayStyle}>
          <div style={{
            fontSize: '15%',
            fontWeight: 700,
            color: '#FF8C42'
          }}>
            {tools.countdown.remaining}
          </div>
          {tools.countdown.message && (
            <div style={{
              fontSize: '5%',
              color: 'rgba(255, 255, 255, 0.8)',
              marginTop: '2%'
            }}>
              {tools.countdown.message}
            </div>
          )}
        </div>
      );
    }

    if (tools.clock?.active) {
      return (
        <div style={overlayStyle}>
          <div style={{
            fontSize: '12%',
            fontWeight: 700,
            color: '#00d4ff',
            fontFamily: 'monospace'
          }}>
            {tools.clock.time}
          </div>
          {tools.clock.date && (
            <div style={{
              fontSize: '4%',
              color: 'rgba(255, 255, 255, 0.7)',
              marginTop: '2%'
            }}>
              {tools.clock.date}
            </div>
          )}
        </div>
      );
    }

    if (tools.stopwatch?.active) {
      return (
        <div style={overlayStyle}>
          <div style={{
            fontSize: '15%',
            fontWeight: 700,
            color: tools.stopwatch.running ? '#00d4ff' : '#ffc107',
            fontFamily: 'monospace'
          }}>
            {tools.stopwatch.time}
          </div>
          <div style={{
            fontSize: '3%',
            color: 'rgba(255, 255, 255, 0.5)',
            marginTop: '2%'
          }}>
            {tools.stopwatch.running ? 'RUNNING' : 'PAUSED'}
          </div>
        </div>
      );
    }

    return null;
  };

  // Render media (video/image)
  const renderMedia = () => {
    if (!activeMedia) return null;

    if (activeMedia.type === 'video') {
      return (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#000',
          zIndex: 50
        }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="rgba(255,255,255,0.5)">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', marginTop: '8px' }}>
            Video Playing
          </div>
        </div>
      );
    }

    if (activeMedia.type === 'image') {
      return (
        <img
          src={activeMedia.url}
          alt="Media"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            zIndex: 50
          }}
        />
      );
    }

    return null;
  };

  // Check if a tool that takes over the screen is active
  const hasFullScreenTool = tools?.countdown?.active || tools?.clock?.active || tools?.stopwatch?.active;

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative'
      }}
    >
      {/* The preview container with correct aspect ratio */}
      <div style={{
        width: fitSize.width,
        height: fitSize.height,
        position: 'relative',
        borderRadius: '4px',
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
      }}>
        {/* Main slide content */}
        {!hasFullScreenTool && !activeMedia && (
          <SlideRenderer
            slideData={slideData}
            displayMode={displayMode}
            theme={theme}
            backgroundImage={backgroundImage}
            isBlank={isBlank}
            containerWidth={fitSize.width}
            containerHeight={fitSize.height}
            presentationSlide={presentationSlide}
          />
        )}

        {/* Media overlay */}
        {activeMedia && !hasFullScreenTool && renderMedia()}

        {/* Tool overlays */}
        {renderToolOverlays()}

        {/* Preview badge */}
        {showBadge && (
          <div style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            background: 'rgba(0, 212, 255, 0.9)',
            color: 'white',
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '10px',
            fontWeight: 600,
            zIndex: 200
          }}>
            PREVIEW
          </div>
        )}
      </div>
    </div>
  );
};

export default SlidePreview;
