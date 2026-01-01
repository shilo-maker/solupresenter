import React, { useState, useEffect } from 'react';

interface SlideData {
  originalText?: string;
  transliteration?: string;
  translation?: string;
}

interface StageColors {
  background: string;
  text: string;
  accent: string;
  secondary: string;
  border: string;
}

interface StageElementConfig {
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

interface StageTextStyle {
  visible: boolean;
  color: string;
  fontSize: number;
  fontWeight: string;
  opacity: number;
}

interface StageTheme {
  colors: StageColors;
  elements: {
    header: StageElementConfig;
    clock: StageElementConfig;
    songTitle: StageElementConfig;
    currentSlideArea: StageElementConfig;
    nextSlideArea: StageElementConfig;
  };
  currentSlideText: {
    original: StageTextStyle;
    transliteration: StageTextStyle;
    translation: StageTextStyle;
  };
}

const DEFAULT_THEME: StageTheme = {
  colors: {
    background: '#1a1a2e',
    text: '#ffffff',
    accent: '#FF8C42',
    secondary: '#888888',
    border: '#333333'
  },
  elements: {
    header: { visible: true, x: 0, y: 0, width: 100, height: 8, backgroundColor: 'rgba(0,0,0,0.3)' },
    clock: { visible: true, x: 85, y: 1, width: 13, height: 6, color: '#ffffff', showSeconds: true },
    songTitle: { visible: true, x: 2, y: 1, width: 60, height: 6, color: '#FF8C42' },
    currentSlideArea: { visible: true, x: 2, y: 12, width: 64, height: 84, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 8 },
    nextSlideArea: { visible: true, x: 68, y: 12, width: 30, height: 84, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 8, labelText: 'Next' }
  },
  currentSlideText: {
    original: { visible: true, color: '#ffffff', fontSize: 100, fontWeight: '500', opacity: 1 },
    transliteration: { visible: true, color: 'rgba(255,255,255,0.9)', fontSize: 70, fontWeight: '400', opacity: 1 },
    translation: { visible: true, color: 'rgba(255,255,255,0.7)', fontSize: 60, fontWeight: '400', opacity: 1 }
  }
};

const DisplayStage: React.FC = () => {
  const [currentSlide, setCurrentSlide] = useState<SlideData | null>(null);
  const [nextSlide, setNextSlide] = useState<SlideData | null>(null);
  const [songTitle, setSongTitle] = useState<string>('');
  const [isBlank, setIsBlank] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [theme, setTheme] = useState<StageTheme>(DEFAULT_THEME);

  useEffect(() => {
    // Report ready
    window.displayAPI.reportReady();

    // Listen for slide updates
    const slideCleanup = window.displayAPI.onSlideUpdate((data) => {
      if (data.isBlank) {
        setIsBlank(true);
      } else {
        setIsBlank(false);
        if (data.slideData) {
          setCurrentSlide(data.slideData);
        }
        if (data.nextSlideData) {
          setNextSlide(data.nextSlideData);
        } else {
          setNextSlide(null);
        }
        if (data.songTitle) {
          setSongTitle(data.songTitle);
        }
      }
    });

    // Listen for stage theme updates
    const stageThemeCleanup = window.displayAPI.onStageThemeUpdate((newTheme) => {
      console.log('Stage theme update received:', newTheme);
      if (newTheme) {
        setTheme({
          colors: newTheme.colors || DEFAULT_THEME.colors,
          elements: newTheme.elements || DEFAULT_THEME.elements,
          currentSlideText: newTheme.currentSlideText || DEFAULT_THEME.currentSlideText
        });
      }
    });

    // Update clock
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      slideCleanup();
      stageThemeCleanup();
      clearInterval(clockInterval);
    };
  }, []);

  // Format time
  const formatTime = (date: Date): string => {
    const opts: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    };
    if (theme.elements.clock?.showSeconds) {
      opts.second = '2-digit';
    }
    return date.toLocaleTimeString('en-US', opts);
  };

  // Get element styles
  const { colors, elements, currentSlideText } = theme;

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: colors.background,
        position: 'relative',
        color: colors.text,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}
    >
      {/* Header - positioned absolutely */}
      {elements.header.visible && (
        <div
          style={{
            position: 'absolute',
            left: `${elements.header.x}%`,
            top: `${elements.header.y}%`,
            width: `${elements.header.width}%`,
            height: `${elements.header.height}%`,
            background: elements.header.backgroundColor || 'rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 2%',
            boxSizing: 'border-box'
          }}
        />
      )}

      {/* Song Title */}
      {elements.songTitle.visible && (
        <div
          style={{
            position: 'absolute',
            left: `${elements.songTitle.x}%`,
            top: `${elements.songTitle.y}%`,
            width: `${elements.songTitle.width}%`,
            height: `${elements.songTitle.height}%`,
            display: 'flex',
            alignItems: 'center',
            paddingLeft: '1%',
            fontSize: '2vw',
            fontWeight: 600,
            color: elements.songTitle.color || colors.accent
          }}
        >
          {songTitle || 'SoluPresenter'}
        </div>
      )}

      {/* Clock */}
      {elements.clock.visible && (
        <div
          style={{
            position: 'absolute',
            left: `${elements.clock.x}%`,
            top: `${elements.clock.y}%`,
            width: `${elements.clock.width}%`,
            height: `${elements.clock.height}%`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingRight: '1%',
            fontSize: '2.5vw',
            fontWeight: 700,
            fontFamily: elements.clock.fontFamily || 'monospace',
            color: elements.clock.color || colors.text
          }}
        >
          {formatTime(currentTime)}
        </div>
      )}

      {/* Current Slide Area */}
      <div
        style={{
          position: 'absolute',
          left: `${elements.currentSlideArea.x}%`,
          top: `${elements.currentSlideArea.y}%`,
          width: `${elements.currentSlideArea.width}%`,
          height: `${elements.currentSlideArea.height}%`,
          background: elements.currentSlideArea.backgroundColor || 'rgba(0,0,0,0.5)',
          borderRadius: `${elements.currentSlideArea.borderRadius || 8}px`,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center',
          padding: '2%',
          boxSizing: 'border-box'
        }}
      >
        <div
          style={{
            fontSize: '1vw',
            color: colors.secondary,
            marginBottom: '1vh',
            textTransform: 'uppercase',
            letterSpacing: '0.2em'
          }}
        >
          Current
        </div>

        {isBlank ? (
          <div style={{ fontSize: '3vw', color: 'rgba(255,255,255,0.3)' }}>BLANK</div>
        ) : currentSlide ? (
          <>
            {currentSlideText.original.visible && currentSlide.originalText && (
              <div
                style={{
                  fontSize: `${currentSlideText.original.fontSize / 25}vw`,
                  fontWeight: currentSlideText.original.fontWeight as any,
                  color: currentSlideText.original.color,
                  opacity: currentSlideText.original.opacity,
                  marginBottom: '2vh',
                  direction: 'rtl',
                  lineHeight: 1.3
                }}
              >
                {currentSlide.originalText}
              </div>
            )}
            {currentSlideText.transliteration.visible && currentSlide.transliteration && (
              <div
                style={{
                  fontSize: `${currentSlideText.transliteration.fontSize / 30}vw`,
                  fontWeight: currentSlideText.transliteration.fontWeight as any,
                  color: currentSlideText.transliteration.color,
                  opacity: currentSlideText.transliteration.opacity,
                  marginBottom: '1vh'
                }}
              >
                {currentSlide.transliteration}
              </div>
            )}
            {currentSlideText.translation.visible && currentSlide.translation && (
              <div
                style={{
                  fontSize: `${currentSlideText.translation.fontSize / 35}vw`,
                  fontWeight: currentSlideText.translation.fontWeight as any,
                  color: currentSlideText.translation.color,
                  opacity: currentSlideText.translation.opacity
                }}
              >
                {currentSlide.translation}
              </div>
            )}
          </>
        ) : (
          <div style={{ fontSize: '2vw', color: 'rgba(255,255,255,0.3)' }}>
            Waiting for content...
          </div>
        )}
      </div>

      {/* Next Slide Preview */}
      {elements.nextSlideArea.visible && (
        <div
          style={{
            position: 'absolute',
            left: `${elements.nextSlideArea.x}%`,
            top: `${elements.nextSlideArea.y}%`,
            width: `${elements.nextSlideArea.width}%`,
            height: `${elements.nextSlideArea.height}%`,
            background: elements.nextSlideArea.backgroundColor || 'rgba(0,0,0,0.3)',
            borderRadius: `${elements.nextSlideArea.borderRadius || 8}px`,
            display: 'flex',
            flexDirection: 'column',
            padding: '2%',
            boxSizing: 'border-box',
            opacity: elements.nextSlideArea.opacity ?? 1
          }}
        >
          <div
            style={{
              fontSize: '1vw',
              color: elements.nextSlideArea.labelColor || colors.secondary,
              marginBottom: '1vh',
              textTransform: 'uppercase',
              letterSpacing: '0.2em'
            }}
          >
            {elements.nextSlideArea.labelText || 'Next'}
          </div>

          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              textAlign: 'center'
            }}
          >
            {nextSlide ? (
              <>
                {nextSlide.originalText && (
                  <div
                    style={{
                      fontSize: '2vw',
                      fontWeight: 500,
                      marginBottom: '1vh',
                      direction: 'rtl',
                      color: 'rgba(255,255,255,0.8)',
                      lineHeight: 1.3
                    }}
                  >
                    {nextSlide.originalText}
                  </div>
                )}
                {nextSlide.transliteration && (
                  <div
                    style={{
                      fontSize: '1.2vw',
                      color: 'rgba(255,255,255,0.5)'
                    }}
                  >
                    {nextSlide.transliteration}
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontSize: '1.5vw', color: 'rgba(255,255,255,0.2)' }}>
                End of song
              </div>
            )}
          </div>
        </div>
      )}

      {/* Status indicator */}
      <div
        style={{
          position: 'absolute',
          bottom: '2%',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '0.5vh 2vw',
          background: isBlank ? '#dc3545' : '#28a745',
          borderRadius: '0.5vh',
          fontSize: '1.2vw',
          fontWeight: 600
        }}
      >
        {isBlank ? 'BLANK' : 'LIVE'}
      </div>
    </div>
  );
};

export default DisplayStage;
