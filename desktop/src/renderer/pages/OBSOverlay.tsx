import React, { useState, useEffect, useRef, memo } from 'react';
import { useSearchParams } from 'react-router-dom';

interface SlideData {
  originalText?: string;
  transliteration?: string;
  translation?: string;
  translationOverflow?: string;
  reference?: string;
  referenceTranslation?: string;
  // Prayer/Sermon content fields
  title?: string;
  titleTranslation?: string;
  subtitle?: string;
  subtitleTranslation?: string;
  description?: string;
  descriptionTranslation?: string;
}

// Presentation slide types for free-form presentations
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
  fontWeight?: string;
  backgroundOpacity?: number;
  visible?: boolean;
  borderTop?: number;
  borderRight?: number;
  borderBottom?: number;
  borderLeft?: number;
  borderColor?: string;
  borderRadiusTopLeft?: number;
  borderRadiusTopRight?: number;
  borderRadiusBottomRight?: number;
  borderRadiusBottomLeft?: number;
  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;
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
  visible?: boolean;
}

interface PresentationBackgroundBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  opacity: number;
  borderRadius: number;
  texture?: string;
  textureOpacity?: number;
  zIndex?: number;
  visible?: boolean;
}

interface PresentationSlide {
  id: string;
  order: number;
  textBoxes: PresentationTextBox[];
  imageBoxes?: PresentationImageBox[];
  backgroundBoxes?: PresentationBackgroundBox[];
  backgroundColor?: string;
  backgroundGradient?: string;
  backgroundType?: 'color' | 'gradient' | 'transparent';
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
    animation: fadeInUp 0.15s ease-out forwards;
  }
  .obs-slide-exit {
    animation: fadeOut 0.1s ease-in forwards;
  }
`;

const OBSOverlay: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [slideData, setSlideData] = useState<SlideData | null>(null);
  const [combinedSlides, setCombinedSlides] = useState<SlideData[] | null>(null);
  const [presentationSlide, setPresentationSlide] = useState<PresentationSlide | null>(null);
  const [displayMode, setDisplayMode] = useState<string>('bilingual');
  const [isBlank, setIsBlank] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [contentType, setContentType] = useState<string>('song');

  // Refs for smooth transitions
  const pendingSlideRef = useRef<SlideData | null>(null);
  const pendingCombinedRef = useRef<SlideData[] | null>(null);
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
  const updateSlide = (newSlide: SlideData | null, newCombined: SlideData[] | null = null) => {
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }

    // Use ref to check current slide data (avoids stale closure)
    if (slideDataRef.current) {
      // Start exit animation
      setIsTransitioning(true);
      pendingSlideRef.current = newSlide;
      pendingCombinedRef.current = newCombined;

      transitionTimeoutRef.current = setTimeout(() => {
        setSlideData(newSlide);
        setCombinedSlides(newCombined);
        setIsTransitioning(false);
        pendingSlideRef.current = null;
        pendingCombinedRef.current = null;
      }, 100); // Fast transition for snappy slide changes
    } else {
      setSlideData(newSlide);
      setCombinedSlides(newCombined);
    }
  };

  // Listen for IPC events from main process
  useEffect(() => {
    // Signal that we're ready
    window.displayAPI.reportReady();

    // Listen for slide updates
    const cleanup = window.displayAPI.onSlideUpdate((data: any) => {
      if (data.isBlank) {
        setIsBlank(true);
        setPresentationSlide(null);
        updateSlide(null);
        setContentType('song');
        return;
      }

      setIsBlank(false);

      // Handle tools (countdown, clock, etc.) - show as blank for OBS overlay
      if (data.toolsData && data.toolsData.type !== 'announcement') {
        setPresentationSlide(null);
        updateSlide(null);
        return;
      }

      // Handle free-form presentations (render directly without theme manipulation)
      if (data.presentationSlide) {
        setPresentationSlide(data.presentationSlide);
        updateSlide(null); // Clear regular slide data
        setContentType('presentation');
        return;
      }

      // Handle regular slides (songs, bible, prayers with themes)
      setPresentationSlide(null);
      if (data.slideData) {
        updateSlide(data.slideData, data.combinedSlides || null);
      }

      if (data.displayMode) {
        setDisplayMode(data.displayMode);
      }

      if (data.contentType) {
        setContentType(data.contentType);
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

  // Should hide if blank or no slide and no presentation
  const shouldHide = isBlank || (!slideData && !presentationSlide);

  // Helper function to get slide background style
  const getSlideBackgroundStyle = (): React.CSSProperties => {
    if (!presentationSlide) return { background: 'transparent' };

    const { backgroundType, backgroundColor, backgroundGradient } = presentationSlide;

    if (backgroundType === 'gradient' && backgroundGradient) {
      return { background: backgroundGradient };
    } else if (backgroundType === 'color' && backgroundColor) {
      return { background: backgroundColor };
    }
    return { background: 'transparent' };
  };

  // Render a presentation text box
  const renderPresentationTextBox = (textBox: PresentationTextBox) => {
    if (textBox.visible === false) return null;

    const bgOpacity = textBox.backgroundOpacity ?? 1;
    let bgColor = textBox.backgroundColor || 'transparent';
    if (bgColor && bgColor.startsWith('#') && bgOpacity < 1) {
      const r = parseInt(bgColor.slice(1, 3), 16);
      const g = parseInt(bgColor.slice(3, 5), 16);
      const b = parseInt(bgColor.slice(5, 7), 16);
      bgColor = `rgba(${r},${g},${b},${bgOpacity})`;
    }

    const textDirection = textBox.textDirection || (isHebrew(textBox.text) ? 'rtl' : 'ltr');

    const boxStyle: React.CSSProperties = {
      position: 'absolute',
      left: `${textBox.x}%`,
      top: `${textBox.y}%`,
      width: `${textBox.width}%`,
      height: `${textBox.height}%`,
      fontSize: `${textBox.fontSize * 0.05}vh`,
      color: textBox.color || 'white',
      backgroundColor: bgColor,
      textAlign: textBox.textAlign || 'center',
      display: 'flex',
      justifyContent: textBox.textAlign === 'left' ? 'flex-start' : textBox.textAlign === 'right' ? 'flex-end' : 'center',
      alignItems: textBox.verticalAlign === 'top' ? 'flex-start' : textBox.verticalAlign === 'bottom' ? 'flex-end' : 'center',
      fontWeight: textBox.fontWeight || (textBox.bold ? '700' : '400'),
      fontStyle: textBox.italic ? 'italic' : 'normal',
      textDecoration: textBox.underline ? 'underline' : 'none',
      opacity: textBox.opacity ?? 1,
      zIndex: textBox.zIndex ?? 1,
      direction: textDirection,
      unicodeBidi: 'plaintext',
      // Border properties
      borderTop: textBox.borderTop ? `${textBox.borderTop}px solid ${textBox.borderColor || 'white'}` : undefined,
      borderRight: textBox.borderRight ? `${textBox.borderRight}px solid ${textBox.borderColor || 'white'}` : undefined,
      borderBottom: textBox.borderBottom ? `${textBox.borderBottom}px solid ${textBox.borderColor || 'white'}` : undefined,
      borderLeft: textBox.borderLeft ? `${textBox.borderLeft}px solid ${textBox.borderColor || 'white'}` : undefined,
      borderTopLeftRadius: textBox.borderRadiusTopLeft ?? 0,
      borderTopRightRadius: textBox.borderRadiusTopRight ?? 0,
      borderBottomRightRadius: textBox.borderRadiusBottomRight ?? 0,
      borderBottomLeftRadius: textBox.borderRadiusBottomLeft ?? 0,
      // Padding properties
      paddingTop: textBox.paddingTop ?? 0,
      paddingRight: textBox.paddingRight ?? 0,
      paddingBottom: textBox.paddingBottom ?? 0,
      paddingLeft: textBox.paddingLeft ?? 0,
      boxSizing: 'border-box',
      overflow: 'hidden',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word'
    };

    return (
      <div key={textBox.id} style={boxStyle}>
        {textBox.text}
      </div>
    );
  };

  // Render a presentation image box
  const renderPresentationImageBox = (imageBox: PresentationImageBox) => {
    if (imageBox.visible === false) return null;

    const boxStyle: React.CSSProperties = {
      position: 'absolute',
      left: `${imageBox.x}%`,
      top: `${imageBox.y}%`,
      width: `${imageBox.width}%`,
      height: `${imageBox.height}%`,
      opacity: imageBox.opacity ?? 1,
      zIndex: imageBox.zIndex ?? 0,
      borderRadius: imageBox.borderRadius ?? 0,
      overflow: 'hidden'
    };

    return (
      <div key={imageBox.id} style={boxStyle}>
        <img
          src={imageBox.src}
          alt=""
          style={{
            width: '100%',
            height: '100%',
            objectFit: imageBox.objectFit || 'contain'
          }}
        />
      </div>
    );
  };

  // Render a presentation background box
  const renderPresentationBackgroundBox = (bgBox: PresentationBackgroundBox) => {
    if (bgBox.visible === false) return null;

    const boxStyle: React.CSSProperties = {
      position: 'absolute',
      left: `${bgBox.x}%`,
      top: `${bgBox.y}%`,
      width: `${bgBox.width}%`,
      height: `${bgBox.height}%`,
      backgroundColor: bgBox.color || 'transparent',
      opacity: bgBox.opacity ?? 1,
      zIndex: bgBox.zIndex ?? 0,
      borderRadius: bgBox.borderRadius ?? 0,
      overflow: 'hidden'
    };

    return <div key={bgBox.id} style={boxStyle} />;
  };

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
      {/* Free-form Presentation Container - full screen rendering */}
      {presentationSlide && (
        <div
          className={isTransitioning ? 'obs-slide-exit' : 'obs-slide-enter'}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            ...getSlideBackgroundStyle(),
            overflow: 'hidden'
          }}
        >
          {/* Background boxes (lowest z-index) */}
          {presentationSlide.backgroundBoxes?.map(renderPresentationBackgroundBox)}

          {/* Image boxes */}
          {presentationSlide.imageBoxes?.map(renderPresentationImageBox)}

          {/* Text boxes (highest z-index) */}
          {presentationSlide.textBoxes?.map(renderPresentationTextBox)}
        </div>
      )}

      {/* Lower Third Container - for themed content (songs, bible, prayers) */}
      {!presentationSlide && (
        <div
          className={shouldHide ? '' : (isTransitioning ? 'obs-slide-exit' : 'obs-slide-enter')}
          style={{
            ...getWrapperStyles(),
            opacity: shouldHide ? 0 : 1,
            transition: 'opacity 0.1s ease'
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
              {/* Check if this is prayer/sermon content (has title field) */}
              {slideData.title ? (
                <>
                  {/* Prayer/Sermon: Title (main title - often Hebrew) */}
                  {config.showOriginal && slideData.title && (
                    <div
                      style={{
                        display: 'inline-block',
                        fontSize: `calc(${lineFontSize} * 1.1)`,
                        lineHeight: 1.0,
                        fontWeight: 'bold',
                        color: config.textColor,
                        background: 'rgba(0,0,0,1)',
                        padding: '0.15em 0.6em',
                        borderRadius: '6px',
                        direction: getTextDirection(slideData.title),
                        unicodeBidi: 'plaintext'
                      }}
                    >
                      {slideData.title}
                    </div>
                  )}

                  {/* Prayer/Sermon: Title Translation */}
                  {displayMode === 'bilingual' && config.showTranslation && slideData.titleTranslation && (
                    <div
                      style={{
                        display: 'inline-block',
                        fontSize: lineFontSize,
                        lineHeight: 1.0,
                        color: config.textColor,
                        background: 'rgba(0,0,0,1)',
                        padding: '0.15em 0.6em',
                        borderRadius: '6px',
                        direction: getTextDirection(slideData.titleTranslation),
                        unicodeBidi: 'plaintext'
                      }}
                    >
                      {slideData.titleTranslation}
                    </div>
                  )}

                  {/* Prayer/Sermon: Subtitle */}
                  {config.showOriginal && slideData.subtitle && (
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
                        direction: getTextDirection(slideData.subtitle),
                        unicodeBidi: 'plaintext'
                      }}
                    >
                      {slideData.subtitle}
                    </div>
                  )}

                  {/* Prayer/Sermon: Subtitle Translation */}
                  {displayMode === 'bilingual' && config.showTranslation && slideData.subtitleTranslation && (
                    <div
                      style={{
                        display: 'inline-block',
                        fontSize: lineFontSize,
                        lineHeight: 1.0,
                        color: config.textColor,
                        background: 'rgba(0,0,0,1)',
                        padding: '0.15em 0.6em',
                        borderRadius: '6px',
                        direction: getTextDirection(slideData.subtitleTranslation),
                        unicodeBidi: 'plaintext'
                      }}
                    >
                      {slideData.subtitleTranslation}
                    </div>
                  )}

                  {/* Prayer/Sermon: Description (if different from subtitle) */}
                  {config.showOriginal && slideData.description && slideData.description !== slideData.subtitle && (
                    <div
                      style={{
                        display: 'inline-block',
                        fontSize: lineFontSize,
                        lineHeight: 1.0,
                        color: config.textColor,
                        background: 'rgba(0,0,0,1)',
                        padding: '0.15em 0.6em',
                        borderRadius: '6px',
                        direction: getTextDirection(slideData.description),
                        unicodeBidi: 'plaintext'
                      }}
                    >
                      {slideData.description}
                    </div>
                  )}

                  {/* Prayer/Sermon: Description Translation (if different from subtitle translation) */}
                  {displayMode === 'bilingual' && config.showTranslation && slideData.descriptionTranslation && slideData.descriptionTranslation !== slideData.subtitleTranslation && (
                    <div
                      style={{
                        display: 'inline-block',
                        fontSize: lineFontSize,
                        lineHeight: 1.0,
                        color: config.textColor,
                        background: 'rgba(0,0,0,1)',
                        padding: '0.15em 0.6em',
                        borderRadius: '6px',
                        direction: getTextDirection(slideData.descriptionTranslation),
                        unicodeBidi: 'plaintext'
                      }}
                    >
                      {slideData.descriptionTranslation}
                    </div>
                  )}

                  {/* Prayer/Sermon: Bible Reference */}
                  {(slideData.reference || slideData.referenceTranslation) && (
                    <div
                      style={{
                        display: 'inline-block',
                        fontSize: `calc(${lineFontSize} * 0.85)`,
                        lineHeight: 1.0,
                        fontStyle: 'italic',
                        color: config.textColor,
                        background: 'rgba(0,0,0,1)',
                        padding: '0.15em 0.6em',
                        borderRadius: '6px',
                        unicodeBidi: 'plaintext'
                      }}
                    >
                      {slideData.reference && <span style={{ direction: getTextDirection(slideData.reference) }}>{slideData.reference}</span>}
                      {slideData.reference && slideData.referenceTranslation && ' | '}
                      {slideData.referenceTranslation && <span style={{ direction: getTextDirection(slideData.referenceTranslation) }}>{slideData.referenceTranslation}</span>}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Song content: Original Text (with combined slides support) */}
                  {config.showOriginal && slideData.originalText && (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.2em'
                      }}
                    >
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
                      {/* Combined slides (second line in original mode) */}
                      {displayMode === 'original' && combinedSlides && combinedSlides.map((combined, idx) => (
                        combined.originalText && (
                          <div
                            key={`combined-${idx}-${(combined.originalText || '').substring(0, 15)}`}
                            style={{
                              display: 'inline-block',
                              fontSize: lineFontSize,
                              lineHeight: 1.0,
                              fontWeight: 'bold',
                              color: config.textColor,
                              background: 'rgba(0,0,0,1)',
                              padding: '0.15em 0.6em',
                              borderRadius: '6px',
                              direction: getTextDirection(combined.originalText),
                              unicodeBidi: 'plaintext'
                            }}
                          >
                            {combined.originalText}
                          </div>
                        )
                      ))}
                    </div>
                  )}

                  {/* Song content: Transliteration */}
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

                  {/* Song content: Translation */}
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
                </>
              )}
            </div>
          )}
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(OBSOverlay);
