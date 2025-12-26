import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import socketService from '../services/socket';

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
  const theme = remoteConfig?.theme ?? (params.get('theme') || 'dark'); // dark, light

  // Clock update
  useEffect(() => {
    if (!showClock) return;
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [showClock]);

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

  // Theme colors
  const colors = theme === 'light' ? {
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
  };

  const baseFontSize = fontSize / 100;
  const slide = currentSlide?.slide;
  const next = nextSlide?.slide;

  // Render slide content
  const renderSlideContent = (slideData, isPreview = false) => {
    if (!slideData) return null;

    const sizeMultiplier = isPreview ? 0.75 : 1;
    const mainFontSize = `calc(clamp(1.5rem, 4vw, 4rem) * ${baseFontSize * sizeMultiplier})`;
    const subFontSize = `calc(clamp(1rem, 2.5vw, 2.5rem) * ${baseFontSize * sizeMultiplier})`;

    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: isPreview ? '0.3em' : '0.5em',
        width: '100%'
      }}>
        {/* Original Text */}
        {slideData.originalText && (
          <div style={{
            fontSize: mainFontSize,
            fontWeight: 'bold',
            color: colors.text,
            direction: getTextDirection(slideData.originalText),
            unicodeBidi: 'plaintext',
            textAlign: 'center',
            lineHeight: 1.3,
            textShadow: theme === 'dark' ? '2px 2px 4px rgba(0,0,0,0.5)' : 'none'
          }}>
            {slideData.originalText}
          </div>
        )}

        {/* Transliteration */}
        {displayMode === 'bilingual' && slideData.transliteration && (
          <div style={{
            fontSize: subFontSize,
            color: colors.secondary,
            direction: getTextDirection(slideData.transliteration),
            unicodeBidi: 'plaintext',
            textAlign: 'center',
            lineHeight: 1.3
          }}>
            {slideData.transliteration}
          </div>
        )}

        {/* Translation */}
        {displayMode === 'bilingual' && slideData.translation && (
          <div style={{
            fontSize: subFontSize,
            color: colors.text,
            opacity: 0.9,
            direction: getTextDirection(slideData.translation),
            unicodeBidi: 'plaintext',
            textAlign: 'center',
            lineHeight: 1.3
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
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1rem 2rem',
        borderBottom: `1px solid ${colors.border}`,
        minHeight: '60px'
      }}>
        {/* Song Title */}
        {showTitle && (
          <div style={{
            fontSize: 'clamp(1rem, 2vw, 1.5rem)',
            color: colors.accent,
            fontWeight: '600',
            flex: 1
          }}>
            {songTitle || ''}
          </div>
        )}

        {/* Clock */}
        {showClock && (
          <div style={{
            fontSize: 'clamp(1.5rem, 3vw, 2.5rem)',
            fontWeight: 'bold',
            color: colors.text,
            fontFamily: 'monospace'
          }}>
            {currentTime.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: showNext ? 'row' : 'column',
        gap: '1rem',
        padding: '2rem',
        minHeight: 0
      }}>
        {/* Current Slide - Main Area */}
        <div style={{
          flex: showNext ? 2 : 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
          borderRadius: '12px',
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
        {showNext && (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            minHeight: 0
          }}>
            <div style={{
              fontSize: '0.9rem',
              color: colors.secondary,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              fontWeight: '600'
            }}>
              Next
            </div>
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem',
              backgroundColor: colors.nextBg,
              borderRadius: '8px',
              border: `1px solid ${colors.border}`,
              opacity: 0.8,
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
