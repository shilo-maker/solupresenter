import React, { useRef, useEffect, useState } from 'react';
import DraggableStageElement, { StageElementPosition } from './DraggableStageElement';

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
}

export interface StageTextStyle {
  visible: boolean;
  color: string;
  fontSize: number;
  fontWeight: string;
  opacity: number;
}

export interface StageCurrentSlideText {
  original: StageTextStyle;
  transliteration: StageTextStyle;
  translation: StageTextStyle;
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
  selectedElement: 'header' | 'clock' | 'songTitle' | 'currentSlide' | 'nextSlide' | null;
  onSelectElement: (element: 'header' | 'clock' | 'songTitle' | 'currentSlide' | 'nextSlide' | null) => void;
  onElementChange: (elementType: string, updates: Partial<StageElementConfig>) => void;
  disabled?: boolean;
}

const SAMPLE_TEXTS = {
  original: 'הללויה',
  transliteration: 'Hallelujah',
  translation: 'Praise the Lord'
};

const StageMonitorCanvas: React.FC<StageMonitorCanvasProps> = ({
  canvasDimensions,
  colors,
  header,
  clock,
  songTitle,
  currentSlideArea,
  currentSlideText,
  nextSlideArea,
  selectedElement,
  onSelectElement,
  onElementChange,
  disabled = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 450 });

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
        onClick={() => onSelectElement(null)}
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
          >
            <div
              style={{
                fontSize: `${Math.min(canvasSize.height * 0.04, 24)}px`,
                fontWeight: (clock?.fontWeight || 'bold') as any,
                color: clock?.color || colors?.text || '#ffffff',
                fontFamily: clock?.fontFamily || 'monospace'
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
          >
            <div
              style={{
                fontSize: `${Math.min(canvasSize.height * 0.03, 18)}px`,
                fontWeight: (songTitle?.fontWeight || '600') as any,
                color: songTitle?.color || colors?.accent || '#4a90d9',
                width: '100%',
                textAlign: 'left',
                paddingLeft: '8px'
              }}
            >
              Song Title Here
            </div>
          </DraggableStageElement>
        )}

        {/* Current Slide Area */}
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
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              padding: '16px'
            }}
          >
            {currentSlideText?.original?.visible !== false && (
              <div
                style={{
                  fontSize: `${Math.min(canvasSize.height * 0.04, 28)}px`,
                  fontWeight: (currentSlideText?.original?.fontWeight || 'bold') as any,
                  color: currentSlideText?.original?.color || colors?.text || '#ffffff',
                  opacity: currentSlideText?.original?.opacity ?? 1,
                  direction: 'rtl'
                }}
              >
                {SAMPLE_TEXTS.original}
              </div>
            )}
            {currentSlideText?.transliteration?.visible !== false && (
              <div
                style={{
                  fontSize: `${Math.min(canvasSize.height * 0.025, 18)}px`,
                  fontWeight: (currentSlideText?.transliteration?.fontWeight || '400') as any,
                  color: currentSlideText?.transliteration?.color || colors?.secondary || '#888',
                  opacity: currentSlideText?.transliteration?.opacity ?? 1
                }}
              >
                {SAMPLE_TEXTS.transliteration}
              </div>
            )}
            {currentSlideText?.translation?.visible !== false && (
              <div
                style={{
                  fontSize: `${Math.min(canvasSize.height * 0.025, 18)}px`,
                  fontWeight: (currentSlideText?.translation?.fontWeight || '400') as any,
                  color: currentSlideText?.translation?.color || colors?.text || '#ffffff',
                  opacity: currentSlideText?.translation?.opacity ?? 0.9
                }}
              >
                {SAMPLE_TEXTS.translation}
              </div>
            )}
          </div>
        </DraggableStageElement>

        {/* Next Slide Preview Area */}
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
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                opacity: nextSlideArea?.opacity ?? 0.8,
                padding: '8px'
              }}
            >
              <div
                style={{
                  fontSize: '10px',
                  color: nextSlideArea?.labelColor || colors?.secondary || '#888',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  marginBottom: '8px'
                }}
              >
                {nextSlideArea?.labelText || 'Next'}
              </div>
              <div
                style={{
                  fontSize: `${Math.min(canvasSize.height * 0.025, 16)}px`,
                  color: colors?.text || '#ffffff',
                  opacity: 0.7,
                  direction: 'rtl'
                }}
              >
                הללו את ה׳
              </div>
            </div>
          </DraggableStageElement>
        )}
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
