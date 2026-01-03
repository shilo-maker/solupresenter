import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

interface SlideData {
  originalText?: string;
  transliteration?: string;
  translation?: string;
  translationOverflow?: string;
  reference?: string;
  // Prayer/Sermon content fields
  title?: string;
  subtitle?: string;
  subtitleTranslation?: string;
  description?: string;
  descriptionTranslation?: string;
}

interface OBSConfig {
  position: 'top' | 'center' | 'bottom';
  fontSize: number;
  textColor: string;
  showOriginal: boolean;
  showTransliteration: boolean;
  showTranslation: boolean;
  paddingBottom: number;
  paddingTop: number;
  maxWidth: number;
}

// CSS animations for smooth transitions
const animationStyles = `
  html, body, #root {
    background: transparent !important;
    margin: 0;
    padding: 0;
    overflow: hidden;
  }
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  @keyframes fadeOut {
    from {
      opacity: 1;
      transform: translateY(0);
    }
    to {
      opacity: 0;
      transform: translateY(-10px);
    }
  }
  .obs-slide-enter {
    animation: fadeInUp 0.4s ease-out forwards;
  }
  .obs-slide-exit {
    animation: fadeOut 0.3s ease-in forwards;
  }
`;

const OBSOverlay: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [slideData, setSlideData] = useState<SlideData | null>(null);
  const [displayMode, setDisplayMode] = useState<string>('bilingual');
  const [isBlank, setIsBlank] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Refs for smooth transitions
  const pendingSlideRef = useRef<SlideData | null>(null);
  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slideDataRef = useRef<SlideData | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    slideDataRef.current = slideData;
  }, [slideData]);

  // Parse config from URL parameters
  const config: OBSConfig = {
    position: (searchParams.get('position') as 'top' | 'center' | 'bottom') || 'bottom',
    fontSize: parseInt(searchParams.get('fontSize') || '100', 10),
    textColor: searchParams.get('color') || 'white',
    showOriginal: searchParams.get('original') !== 'false',
    showTransliteration: searchParams.get('transliteration') !== 'false',
    showTranslation: searchParams.get('translation') !== 'false',
    paddingBottom: parseInt(searchParams.get('paddingBottom') || '3', 10),
    paddingTop: parseInt(searchParams.get('paddingTop') || '5', 10),
    maxWidth: parseInt(searchParams.get('maxWidth') || '90', 10)
  };

  // Inject animation styles on mount
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.id = 'obs-overlay-animations';
    styleElement.textContent = animationStyles;
    if (!document.getElementById('obs-overlay-animations')) {
      document.head.appendChild(styleElement);
    }

    return () => {
      const existing = document.getElementById('obs-overlay-animations');
      if (existing) {
        existing.remove();
      }
    };
  }, []);

  // Smooth slide transition
  const updateSlide = (newSlide: SlideData | null) => {
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }

    // Use ref to check current slide data (avoids stale closure)
    if (slideDataRef.current) {
      // Start exit animation
      setIsTransitioning(true);
      pendingSlideRef.current = newSlide;

      transitionTimeoutRef.current = setTimeout(() => {
        setSlideData(newSlide);
        setIsTransitioning(false);
        pendingSlideRef.current = null;
      }, 300); // Match exit animation duration
    } else {
      setSlideData(newSlide);
    }
  };

  // Listen for IPC events from main process
  useEffect(() => {
    // Signal that we're ready
    window.displayAPI.reportReady();

    // Listen for slide updates
    const cleanup = window.displayAPI.onSlideUpdate((data: any) => {
      console.log('[OBS Overlay] Received slide update:', data);

      if (data.isBlank) {
        setIsBlank(true);
        updateSlide(null);
        return;
      }

      setIsBlank(false);

      // Handle tools (countdown, clock, etc.) - show as blank for OBS overlay
      if (data.toolsData && data.toolsData.type !== 'announcement') {
        updateSlide(null);
        return;
      }

      // Handle regular slides
      if (data.slideData) {
        updateSlide(data.slideData);
      }

      if (data.displayMode) {
        setDisplayMode(data.displayMode);
      }
    });

    return () => {
      if (cleanup) cleanup();
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, []);

  // Detect Hebrew/RTL text
  const isHebrew = (text: string | undefined): boolean => {
    if (!text) return false;
    const hebrewPattern = /[\u0590-\u05FF\u0600-\u06FF]/;
    return hebrewPattern.test(text);
  };

  // Get text direction
  const getTextDirection = (text: string | undefined): 'rtl' | 'ltr' => {
    return isHebrew(text) ? 'rtl' : 'ltr';
  };

  // Calculate position styles for the wrapper
  const getWrapperStyles = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: 'fixed',
      left: 0,
      right: 0,
      display: 'flex',
      justifyContent: 'center',
      pointerEvents: 'none'
    };

    switch (config.position) {
      case 'top':
        return {
          ...base,
          top: `${config.paddingTop}vh`,
          bottom: 'auto',
          alignItems: 'flex-start'
        };
      case 'center':
        return {
          ...base,
          top: 0,
          bottom: 0,
          alignItems: 'center'
        };
      case 'bottom':
      default:
        return {
          ...base,
          top: 'auto',
          bottom: `${config.paddingBottom}vh`,
          alignItems: 'flex-end'
        };
    }
  };

  // Calculate font size
  const baseFontSize = config.fontSize / 100;
  const lineFontSize = `calc(clamp(1rem, 2.7vw, 2.7rem) * ${baseFontSize})`;

  // Should hide if blank or no slide
  const shouldHide = isBlank || !slideData;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'transparent',
        overflow: 'hidden',
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
      }}
    >
      {/* Lower Third Container */}
      <div
        className={shouldHide ? '' : (isTransitioning ? 'obs-slide-exit' : 'obs-slide-enter')}
        style={{
          ...getWrapperStyles(),
          opacity: shouldHide ? 0 : 1,
          transition: 'opacity 0.3s ease'
        }}
      >
        <div
          style={{
            width: `${config.maxWidth}%`,
            maxWidth: '1600px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            padding: '1.5rem 2rem'
          }}
        >
          {slideData && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 0,
                width: '100%'
              }}
            >
              {/* Original Text */}
              {config.showOriginal && slideData.originalText && (
                <div
                  style={{
                    display: 'inline-block',
                    fontSize: lineFontSize,
                    lineHeight: 1.0,
                    fontWeight: 'bold',
                    color: config.textColor,
                    background: 'rgba(0,0,0,1)',
                    padding: '0.15em 0.6em',
                    borderRadius: '6px',
                    direction: getTextDirection(slideData.originalText),
                    unicodeBidi: 'plaintext'
                  }}
                >
                  {slideData.originalText}
                </div>
              )}

              {/* Transliteration */}
              {displayMode === 'bilingual' && config.showTransliteration && slideData.transliteration && (
                <div
                  style={{
                    display: 'inline-block',
                    fontSize: lineFontSize,
                    lineHeight: 1.0,
                    color: config.textColor,
                    background: 'rgba(0,0,0,1)',
                    padding: '0.15em 0.6em',
                    borderRadius: '6px',
                    direction: getTextDirection(slideData.transliteration),
                    unicodeBidi: 'plaintext'
                  }}
                >
                  {slideData.transliteration}
                </div>
              )}

              {/* Translation */}
              {displayMode === 'bilingual' && config.showTranslation && slideData.translation && (
                <div
                  style={{
                    display: 'inline-block',
                    fontSize: lineFontSize,
                    lineHeight: 1.0,
                    color: config.textColor,
                    background: 'rgba(0,0,0,1)',
                    padding: '0.15em 0.6em',
                    borderRadius: '6px',
                    direction: getTextDirection(slideData.translation),
                    unicodeBidi: 'plaintext'
                  }}
                >
                  {slideData.translation}
                  {slideData.translationOverflow && (
                    <span> {slideData.translationOverflow}</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OBSOverlay;
