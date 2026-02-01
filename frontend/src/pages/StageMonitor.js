import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import socketService from '../services/socket';
import { stageMonitorThemeAPI } from '../services/api';

// CSS for stage monitor
const stageMonitorStyles = document.createElement('style');
stageMonitorStyles.textContent = `
  html, body, #root {
    margin: 0;
    padding: 0;
    overflow: hidden;
    background: #000 !important;
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .stage-slide-enter {
    animation: fadeIn 0.3s ease-out forwards;
  }
`;
if (!document.getElementById('stage-monitor-styles')) {
  stageMonitorStyles.id = 'stage-monitor-styles';
  document.head.appendChild(stageMonitorStyles);
}

function StageMonitor({ remotePin, remoteConfig }) {
  const location = useLocation();

  // State
  const [joined, setJoined] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(null);
  const [nextSlide, setNextSlide] = useState(null);
  const [displayMode, setDisplayMode] = useState('bilingual');
  const [songTitle, setSongTitle] = useState('');
  const [error, setError] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isBlank, setIsBlank] = useState(false);
  const [customTheme, setCustomTheme] = useState(null);

  // Parse query parameters
  const params = new URLSearchParams(location.search);
  // Use remotePin prop if provided (from RemoteScreen), otherwise use URL params
  const pin = remotePin || params.get('pin');
  const roomSlug = params.get('room');
  // Allow remoteConfig to override URL params
  const showClock = remoteConfig?.showClock ?? (params.get('clock') !== 'false');
  const showNext = remoteConfig?.showNext ?? (params.get('next') !== 'false');
  const showTitle = remoteConfig?.showTitle ?? (params.get('title') !== 'false');
  const fontSize = remoteConfig?.fontSize ?? parseInt(params.get('fontSize') || '100', 10);
  const theme = remoteConfig?.theme ?? (params.get('theme') || 'dark'); // dark, light, or theme ID
  const themeId = remoteConfig?.stageThemeId ?? params.get('themeId'); // custom theme ID

  // Clock update
  useEffect(() => {
    if (!showClock) return;
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [showClock]);

  // Fetch custom theme by themeId if explicitly provided (overrides operator's default)
  useEffect(() => {
    const fetchTheme = async () => {
      if (!themeId) return;
      try {
        // Use public endpoint to avoid auth requirement for remote screens
        const response = await stageMonitorThemeAPI.getPublic(themeId);
        if (response.data.theme) {
          setCustomTheme(response.data.theme);
        }
      } catch (error) {
        console.log('Using operator default stage monitor theme');
      }
    };
    fetchTheme();
  }, [themeId]);

  // Detect Hebrew/RTL text
  const isHebrew = (text) => {
    if (!text) return false;
    const hebrewPattern = /[\u0590-\u05FF\u0600-\u06FF]/;
    return hebrewPattern.test(text);
  };

  const getTextDirection = (text) => isHebrew(text) ? 'rtl' : 'ltr';

  // Connect to room
  useEffect(() => {
    const connectToRoom = async () => {
      if (!roomSlug && !pin) {
        setError('No room PIN provided. Use ?pin=XXXX or ?room=name');
        return;
      }

      socketService.connect();

      socketService.onConnectionStatusChange((status) => {
        console.log('Stage Monitor: Connection status:', status);
        if (status === 'connected') {
          if (roomSlug) {
            socketService.viewerJoinRoomBySlug(roomSlug.toLowerCase());
          } else if (pin) {
            socketService.viewerJoinRoom(pin.toUpperCase());
          }
        }
      });

      socketService.onViewerJoined((data) => {
        console.log('Stage Monitor: Joined room', data);
        setJoined(true);
        setError('');

        // Apply stage monitor theme from join data (like viewer theme)
        if (data.stageMonitorTheme) {
          setCustomTheme(data.stageMonitorTheme);
        }

        if (data.isBlank) {
          setIsBlank(true);
          setCurrentSlide(null);
        } else if (data.slideData) {
          setCurrentSlide(data.slideData);
          setIsBlank(false);
          if (data.slideData.songTitle) {
            setSongTitle(data.slideData.songTitle);
          }
        }
        if (data.displayMode) {
          setDisplayMode(data.displayMode);
        }
        // Get next slide if available
        if (data.nextSlideData) {
          setNextSlide(data.nextSlideData);
        }
      });

      socketService.onSlideUpdate((data) => {
        console.log('Stage Monitor: Slide update', data);

        if (data.isBlank) {
          setIsBlank(true);
          setCurrentSlide(null);
          setNextSlide(null);
          return;
        }

        // Handle tools - show blank
        if (data.toolsData && data.toolsData.type !== 'announcement') {
          setIsBlank(true);
          setCurrentSlide(null);
          return;
        }

        if (data.slideData) {
          setCurrentSlide(data.slideData);
          setIsBlank(false);
          if (data.slideData.songTitle) {
            setSongTitle(data.slideData.songTitle);
          }
        }

        // Get next slide if available
        if (data.nextSlideData) {
          setNextSlide(data.nextSlideData);
        } else {
          setNextSlide(null);
        }

        if (data.displayMode) {
          setDisplayMode(data.displayMode);
        }
      });

      socketService.onRoomClosed(() => {
        setJoined(false);
        setCurrentSlide(null);
        setNextSlide(null);
        setError('Session ended');
      });

      socketService.onError((err) => {
        setError(err.message || 'Connection error');
      });
    };

    connectToRoom();
    return () => socketService.disconnect();
  }, [pin, roomSlug]);

  // Theme colors - use custom theme if available, otherwise use preset
  const colors = customTheme ? {
    bg: customTheme.colors?.background || '#0a0a0a',
    text: customTheme.colors?.text || '#ffffff',
    accent: customTheme.colors?.accent || '#4a90d9',
    secondary: customTheme.colors?.secondary || '#888',
    nextBg: customTheme.nextSlideArea?.backgroundColor || '#1a1a1a',
    border: customTheme.colors?.border || '#333'
  } : (theme === 'light' ? {
    bg: '#f5f5f5',
    text: '#1a1a1a',
    accent: '#0066cc',
    secondary: '#666',
    nextBg: '#e0e0e0',
    border: '#ccc'
  } : {
    bg: '#0a0a0a',
    text: '#ffffff',
    accent: '#4a90d9',
    secondary: '#888',
    nextBg: '#1a1a1a',
    border: '#333'
  });

  // Get layout from custom theme or use defaults
  const headerLayout = customTheme?.header || { visible: true };
  const clockLayout = customTheme?.clock || { visible: showClock };
  const songTitleLayout = customTheme?.songTitle || { visible: showTitle };
  const currentSlideLayout = customTheme?.currentSlideArea || {};
  const currentSlideTextLayout = customTheme?.currentSlideText || {};
  const nextSlideLayout = customTheme?.nextSlideArea || { visible: showNext };

  const baseFontSize = fontSize / 100;
  const slide = currentSlide?.slide;
  const next = nextSlide?.slide;

  // Render slide content
  const renderSlideContent = (slideData, isPreview = false) => {
    if (!slideData) return null;

    const sizeMultiplier = isPreview ? 0.75 : 1;
    const mainFontSize = `calc(clamp(1.5rem, 4vw, 4rem) * ${baseFontSize * sizeMultiplier})`;
    const subFontSize = `calc(clamp(1rem, 2.5vw, 2.5rem) * ${baseFontSize * sizeMultiplier})`;

    // Get text styles from custom theme if available
    const originalStyle = currentSlideTextLayout?.original || {};
    const transliterationStyle = currentSlideTextLayout?.transliteration || {};
    const translationStyle = currentSlideTextLayout?.translation || {};

    const showOriginal = originalStyle.visible !== false;
    const showTransliteration = transliterationStyle.visible !== false && displayMode === 'bilingual';
    const showTranslation = translationStyle.visible !== false && displayMode === 'bilingual';

    // Build text shadow/stroke from theme style
    const getTextShadow = (s) => {
      if (!s?.textShadowColor && s?.textShadowBlur === undefined
          && s?.textShadowOffsetX === undefined && s?.textShadowOffsetY === undefined) {
        return theme === 'dark' && !customTheme ? '2px 2px 4px rgba(0,0,0,0.5)' : 'none';
      }
      const c = s.textShadowColor || 'rgba(0,0,0,0.8)';
      const b = s.textShadowBlur ?? 4;
      const ox = s.textShadowOffsetX ?? 2;
      const oy = s.textShadowOffsetY ?? 2;
      return `${ox}px ${oy}px ${b}px ${c}`;
    };
    const getTextStroke = (s) => {
      if (!s?.textStrokeWidth) return undefined;
      return `${s.textStrokeWidth}px ${s.textStrokeColor || '#000000'}`;
    };

    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: isPreview ? '0.3em' : '0.5em',
        width: '100%'
      }}>
        {/* Original Text */}
        {showOriginal && slideData.originalText && (
          <div style={{
            fontSize: mainFontSize,
            fontWeight: originalStyle.fontWeight || 'bold',
            color: originalStyle.color || colors.text,
            opacity: originalStyle.opacity ?? 1,
            direction: getTextDirection(slideData.originalText),
            unicodeBidi: 'plaintext',
            textAlign: 'center',
            lineHeight: 1.3,
            textShadow: getTextShadow(originalStyle),
            WebkitTextStroke: getTextStroke(originalStyle),
            paintOrder: 'stroke fill'
          }}>
            {slideData.originalText}
          </div>
        )}

        {/* Transliteration */}
        {showTransliteration && slideData.transliteration && (
          <div style={{
            fontSize: subFontSize,
            fontWeight: transliterationStyle.fontWeight || '400',
            color: transliterationStyle.color || colors.secondary,
            opacity: transliterationStyle.opacity ?? 1,
            direction: getTextDirection(slideData.transliteration),
            unicodeBidi: 'plaintext',
            textAlign: 'center',
            lineHeight: 1.3,
            textShadow: getTextShadow(transliterationStyle),
            WebkitTextStroke: getTextStroke(transliterationStyle),
            paintOrder: 'stroke fill'
          }}>
            {slideData.transliteration}
          </div>
        )}

        {/* Translation */}
        {showTranslation && slideData.translation && (
          <div style={{
            fontSize: subFontSize,
            fontWeight: translationStyle.fontWeight || '400',
            color: translationStyle.color || colors.text,
            opacity: translationStyle.opacity ?? 0.9,
            direction: getTextDirection(slideData.translation),
            unicodeBidi: 'plaintext',
            textAlign: 'center',
            lineHeight: 1.3,
            textShadow: getTextShadow(translationStyle),
            WebkitTextStroke: getTextStroke(translationStyle),
            paintOrder: 'stroke fill'
          }}>
            {slideData.translation}
            {slideData.translationOverflow && (
              <span> {slideData.translationOverflow}</span>
            )}
          </div>
        )}
      </div>
    );
  };

  // Error state
  if (error && !joined) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: colors.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#ff6b6b',
        fontSize: '24px',
        fontFamily: 'system-ui, sans-serif'
      }}>
        {error}
      </div>
    );
  }

  // Connecting state
  if (!joined) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: colors.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: colors.secondary,
        fontSize: '24px',
        fontFamily: 'system-ui, sans-serif'
      }}>
        Connecting to {roomSlug || pin}...
      </div>
    );
  }

  // Determine visibility settings (custom theme overrides URL params)
  const showClockResolved = customTheme ? (clockLayout.visible !== false) : showClock;
  const showTitleResolved = customTheme ? (songTitleLayout.visible !== false) : showTitle;
  const showNextResolved = customTheme ? (nextSlideLayout.visible !== false) : showNext;
  const showHeader = headerLayout.visible !== false;

  // Check if we should use absolute positioning (custom theme with position data)
  const useAbsoluteLayout = customTheme &&
    (currentSlideLayout.x !== undefined || currentSlideLayout.y !== undefined);

  // For absolute layout, render with percentage-based positioning
  if (useAbsoluteLayout) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: colors.bg,
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        overflow: 'hidden'
      }}>
        {/* Header - absolute positioned */}
        {showHeader && (
          <div style={{
            position: 'absolute',
            left: `${headerLayout.x ?? 0}%`,
            top: `${headerLayout.y ?? 0}%`,
            width: `${headerLayout.width ?? 100}%`,
            height: `${headerLayout.height ?? 8}%`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0 2%',
            boxSizing: 'border-box',
            borderBottom: `${headerLayout.borderWidth || 1}px solid ${headerLayout.borderColor || colors.border}`,
            backgroundColor: headerLayout.backgroundColor || 'transparent'
          }}>
            {/* Song Title */}
            {showTitleResolved && (
              <div style={{
                fontSize: 'clamp(1rem, 2vw, 1.5rem)',
                color: songTitleLayout.color || colors.accent,
                fontWeight: songTitleLayout.fontWeight || '600',
                flex: 1
              }}>
                {songTitle || ''}
              </div>
            )}

            {/* Clock */}
            {showClockResolved && (
              <div style={{
                fontSize: 'clamp(1.5rem, 3vw, 2.5rem)',
                fontWeight: clockLayout.fontWeight || 'bold',
                color: clockLayout.color || colors.text,
                fontFamily: clockLayout.fontFamily || 'monospace'
              }}>
                {currentTime.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
          </div>
        )}

        {/* Current Slide - absolute positioned */}
        <div style={{
          position: 'absolute',
          left: `${currentSlideLayout.x ?? 1}%`,
          top: `${currentSlideLayout.y ?? 10}%`,
          width: `${currentSlideLayout.width ?? 65}%`,
          height: `${currentSlideLayout.height ?? 85}%`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: typeof currentSlideLayout.padding === 'number' ? `${currentSlideLayout.padding}%` : (currentSlideLayout.padding || '2%'),
          boxSizing: 'border-box',
          backgroundColor: currentSlideLayout.backgroundColor || 'rgba(255,255,255,0.03)',
          borderRadius: typeof currentSlideLayout.borderRadius === 'number' ? `${currentSlideLayout.borderRadius}px` : (currentSlideLayout.borderRadius || '12px'),
          border: `${currentSlideLayout.borderWidth || 1}px solid ${currentSlideLayout.borderColor || colors.border}`,
          overflow: 'hidden'
        }}>
          {isBlank ? (
            <div style={{ color: colors.secondary, fontSize: '1.5rem' }}>
            </div>
          ) : slide ? (
            <div className="stage-slide-enter" style={{ width: '100%' }}>
              {renderSlideContent(slide)}
            </div>
          ) : (
            <div style={{ color: colors.secondary, fontSize: '1.5rem' }}>
              Waiting for content...
            </div>
          )}
        </div>

        {/* Next Slide Preview - absolute positioned */}
        {showNextResolved && (
          <div style={{
            position: 'absolute',
            left: `${nextSlideLayout.x ?? 68}%`,
            top: `${nextSlideLayout.y ?? 10}%`,
            width: `${nextSlideLayout.width ?? 30}%`,
            height: `${nextSlideLayout.height ?? 85}%`,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            boxSizing: 'border-box'
          }}>
            <div style={{
              fontSize: '0.9rem',
              color: nextSlideLayout.labelColor || colors.secondary,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              fontWeight: '600'
            }}>
              {nextSlideLayout.labelText || 'Next'}
            </div>
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: typeof nextSlideLayout.padding === 'number' ? `${nextSlideLayout.padding}%` : (nextSlideLayout.padding || '1rem'),
              backgroundColor: nextSlideLayout.backgroundColor || colors.nextBg,
              borderRadius: typeof nextSlideLayout.borderRadius === 'number' ? `${nextSlideLayout.borderRadius}px` : (nextSlideLayout.borderRadius || '8px'),
              border: `${nextSlideLayout.borderWidth || 1}px solid ${nextSlideLayout.borderColor || colors.border}`,
              opacity: nextSlideLayout.opacity ?? 0.8,
              overflow: 'hidden',
              position: 'relative'
            }}>
              {next ? (
                <div style={{
                  width: '100%',
                  overflow: 'hidden',
                  maskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)',
                  WebkitMaskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)'
                }}>
                  {renderSlideContent(next, true)}
                </div>
              ) : (
                <div style={{ color: colors.secondary, fontSize: '1rem' }}>
                  {isBlank ? '' : 'End of song'}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Fallback: Default flexbox layout (no custom theme or legacy theme without positions)
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: colors.bg,
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      overflow: 'hidden'
    }}>
      {/* Header - Clock and Song Title */}
      {showHeader && (
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1rem 2rem',
        borderBottom: `1px solid ${colors.border}`,
        minHeight: '60px',
        backgroundColor: headerLayout.backgroundColor || 'transparent'
      }}>
        {/* Song Title */}
        {showTitleResolved && (
          <div style={{
            fontSize: 'clamp(1rem, 2vw, 1.5rem)',
            color: songTitleLayout.color || colors.accent,
            fontWeight: songTitleLayout.fontWeight || '600',
            flex: 1
          }}>
            {songTitle || ''}
          </div>
        )}

        {/* Clock */}
        {showClockResolved && (
          <div style={{
            fontSize: 'clamp(1.5rem, 3vw, 2.5rem)',
            fontWeight: clockLayout.fontWeight || 'bold',
            color: clockLayout.color || colors.text,
            fontFamily: clockLayout.fontFamily || 'monospace'
          }}>
            {currentTime.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </div>
      )}

      {/* Main Content Area */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: showNextResolved ? 'row' : 'column',
        gap: '1rem',
        padding: '2rem',
        minHeight: 0
      }}>
        {/* Current Slide - Main Area */}
        <div style={{
          flex: showNextResolved ? 2 : 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: currentSlideLayout.padding || '2rem',
          backgroundColor: currentSlideLayout.backgroundColor || (theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'),
          borderRadius: currentSlideLayout.borderRadius || '12px',
          border: `1px solid ${colors.border}`,
          minHeight: 0,
          overflow: 'hidden'
        }}>
          {isBlank ? (
            <div style={{ color: colors.secondary, fontSize: '1.5rem' }}>

            </div>
          ) : slide ? (
            <div className="stage-slide-enter" style={{ width: '100%' }}>
              {renderSlideContent(slide)}
            </div>
          ) : (
            <div style={{ color: colors.secondary, fontSize: '1.5rem' }}>
              Waiting for content...
            </div>
          )}
        </div>

        {/* Next Slide Preview */}
        {showNextResolved && (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            minHeight: 0
          }}>
            <div style={{
              fontSize: '0.9rem',
              color: nextSlideLayout.labelColor || colors.secondary,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              fontWeight: '600'
            }}>
              {nextSlideLayout.labelText || 'Next'}
            </div>
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem',
              backgroundColor: colors.nextBg,
              borderRadius: nextSlideLayout.borderRadius || '8px',
              border: `1px solid ${colors.border}`,
              opacity: nextSlideLayout.opacity ?? 0.8,
              minHeight: 0,
              overflow: 'hidden',
              position: 'relative'
            }}>
              {next ? (
                <div style={{
                  width: '100%',
                  overflow: 'hidden',
                  maskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)',
                  WebkitMaskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)'
                }}>
                  {renderSlideContent(next, true)}
                </div>
              ) : (
                <div style={{ color: colors.secondary, fontSize: '1rem' }}>
                  {isBlank ? '' : 'End of song'}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default StageMonitor;
