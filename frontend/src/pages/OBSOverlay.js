import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import socketService from '../services/socket';

// CSS animations for smooth transitions and transparent background
const animationStyles = document.createElement('style');
animationStyles.textContent = `
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
if (!document.getElementById('obs-overlay-animations')) {
  animationStyles.id = 'obs-overlay-animations';
  document.head.appendChild(animationStyles);
}

function OBSOverlay({ remotePin, remoteConfig }) {
  const location = useLocation();

  // State
  const [joined, setJoined] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(null);
  const [displayMode, setDisplayMode] = useState('bilingual');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [error, setError] = useState('');

  // Refs
  const pendingSlideRef = useRef(null);
  const transitionTimeoutRef = useRef(null);

  // Parse query parameters for customization
  const params = new URLSearchParams(location.search);
  // Use remotePin prop if provided (from RemoteScreen), otherwise use URL params
  const pin = remotePin || params.get('pin');
  const roomSlug = params.get('room');
  // Allow remoteConfig to override URL params
  const position = remoteConfig?.position ?? (params.get('position') || 'bottom'); // bottom, top, center
  const fontSize = remoteConfig?.fontSize ?? parseInt(params.get('fontSize') || '100', 10); // percentage
  const textColor = remoteConfig?.textColor ?? (params.get('color') || 'white');
  const showOriginal = remoteConfig?.showOriginal ?? (params.get('original') !== 'false');
  const showTransliteration = remoteConfig?.showTransliteration ?? (params.get('transliteration') !== 'false');
  const showTranslation = remoteConfig?.showTranslation ?? (params.get('translation') !== 'false');
  const paddingBottom = remoteConfig?.paddingBottom ?? parseInt(params.get('paddingBottom') || '3', 10); // vh units
  const paddingTop = remoteConfig?.paddingTop ?? parseInt(params.get('paddingTop') || '5', 10); // vh units
  const maxWidth = remoteConfig?.maxWidth ?? parseInt(params.get('maxWidth') || '90', 10); // percentage

  // Detect Hebrew/RTL text
  const isHebrew = (text) => {
    if (!text) return false;
    const hebrewPattern = /[\u0590-\u05FF\u0600-\u06FF]/;
    return hebrewPattern.test(text);
  };

  // Smooth slide transition
  const updateSlide = (newSlide) => {
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }

    if (currentSlide) {
      // Start exit animation
      setIsTransitioning(true);
      pendingSlideRef.current = newSlide;

      transitionTimeoutRef.current = setTimeout(() => {
        setCurrentSlide(newSlide);
        setIsTransitioning(false);
        pendingSlideRef.current = null;
      }, 300); // Match exit animation duration
    } else {
      setCurrentSlide(newSlide);
    }
  };

  // Connect to room on mount
  useEffect(() => {
    const connectToRoom = async () => {
      if (!roomSlug && !pin) {
        setError('No room PIN provided. Use ?pin=XXXX or ?room=name');
        return;
      }

      // Connect socket
      socketService.connect();

      // Set up event handlers
      socketService.onConnectionStatusChange((status) => {
        console.log('OBS Overlay: Connection status:', status);
        if (status === 'connected') {
          // Join room once connected - use slug or PIN
          if (roomSlug) {
            console.log('OBS Overlay: Joining by slug:', roomSlug);
            socketService.viewerJoinRoomBySlug(roomSlug.toLowerCase());
          } else if (pin) {
            console.log('OBS Overlay: Joining by PIN:', pin);
            socketService.viewerJoinRoom(pin.toUpperCase());
          }
        }
      });

      socketService.onViewerJoined((data) => {
        console.log('OBS Overlay: Joined room', data);
        setJoined(true);
        setError('');

        // Set initial slide if provided (matches ViewerPage structure)
        if (data.isBlank) {
          setCurrentSlide({ isBlank: true });
        } else if (data.slideData) {
          setCurrentSlide(data.slideData);
        }
        if (data.displayMode) {
          setDisplayMode(data.displayMode);
        }
      });

      socketService.onSlideUpdate((data) => {
        console.log('OBS Overlay: Slide update', data);

        // Handle blank slides
        if (data.isBlank) {
          updateSlide({ isBlank: true });
          return;
        }

        // Handle tools (countdown, clock, etc.) - show as blank for now
        if (data.toolsData && data.toolsData.type !== 'announcement') {
          updateSlide({ isBlank: true });
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

      socketService.onRoomClosed(() => {
        console.log('OBS Overlay: Room closed');
        setJoined(false);
        setCurrentSlide(null);
        setError('Session ended');
      });

      socketService.onError((err) => {
        console.error('OBS Overlay: Error', err);
        setError(err.message || 'Connection error');
      });
    };

    connectToRoom();

    // Cleanup
    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
      socketService.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, roomSlug]);

  // Calculate position styles for the wrapper
  const getWrapperStyles = () => {
    const base = {
      position: 'fixed',
      left: 0,
      right: 0,
      display: 'flex',
      justifyContent: 'center',
      pointerEvents: 'none'
    };

    switch (position) {
      case 'top':
        return {
          ...base,
          top: `${paddingTop}vh`,
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
          bottom: `${paddingBottom}vh`,
          alignItems: 'flex-end'
        };
    }
  };

  // Get text direction
  const getTextDirection = (text) => {
    return isHebrew(text) ? 'rtl' : 'ltr';
  };

  // Get the actual slide data (nested under .slide property)
  const slide = currentSlide?.slide;

  // Calculate font size (same for all lines)
  const baseFontSize = fontSize / 100;
  const lineFontSize = `calc(clamp(1rem, 2.7vw, 2.7rem) * ${baseFontSize})`;

  // Render nothing if blank or no slide
  const shouldHide = !currentSlide || !slide || currentSlide.isBlank;

  // Error display (visible for debugging)
  if (error && !joined) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0,0,0,0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#ff6b6b',
        fontSize: '18px',
        fontFamily: 'system-ui, sans-serif',
        padding: '20px',
        textAlign: 'center'
      }}>
        {error}
      </div>
    );
  }

  // Connecting state (before joined)
  if (!joined) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'rgba(255,255,255,0.7)',
        fontSize: '16px',
        fontFamily: 'system-ui, sans-serif'
      }}>
        Connecting to {roomSlug || pin}...
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'transparent',
      overflow: 'hidden',
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
    }}>
      {/* Lower Third Container */}
      <div
        className={shouldHide ? '' : (isTransitioning ? 'obs-slide-exit' : 'obs-slide-enter')}
        style={{
          ...getWrapperStyles(),
          opacity: shouldHide ? 0 : 1,
          transition: 'opacity 0.3s ease'
        }}
      >
        <div style={{
          width: `${maxWidth}%`,
          maxWidth: '1600px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          padding: '1.5rem 2rem'
        }}>
        {slide && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 0,
            width: '100%'
          }}>
            {/* Original Text */}
            {showOriginal && slide.originalText && (
              <div style={{
                display: 'inline-block',
                fontSize: lineFontSize,
                lineHeight: 1.0,
                fontWeight: 'bold',
                color: textColor,
                background: 'rgba(0,0,0,1)',
                padding: '0.15em 0.6em',
                borderRadius: '6px',
                direction: getTextDirection(slide.originalText),
                unicodeBidi: 'plaintext'
              }}>
                {slide.originalText}
              </div>
            )}

            {/* Transliteration */}
            {displayMode === 'bilingual' && showTransliteration && slide.transliteration && (
              <div style={{
                display: 'inline-block',
                fontSize: lineFontSize,
                lineHeight: 1.0,
                color: textColor,
                background: 'rgba(0,0,0,1)',
                padding: '0.15em 0.6em',
                borderRadius: '6px',
                direction: getTextDirection(slide.transliteration),
                unicodeBidi: 'plaintext'
              }}>
                {slide.transliteration}
              </div>
            )}

            {/* Translation */}
            {displayMode === 'bilingual' && showTranslation && slide.translation && (
              <div style={{
                display: 'inline-block',
                fontSize: lineFontSize,
                lineHeight: 1.0,
                color: textColor,
                background: 'rgba(0,0,0,1)',
                padding: '0.15em 0.6em',
                borderRadius: '6px',
                direction: getTextDirection(slide.translation),
                unicodeBidi: 'plaintext'
              }}>
                {slide.translation}
                {slide.translationOverflow && (
                  <span> {slide.translationOverflow}</span>
                )}
              </div>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

export default OBSOverlay;
