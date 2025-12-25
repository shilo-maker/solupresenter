import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import socketService from '../services/socket';
import { publicRoomAPI } from '../services/api';

// CSS animations for smooth transitions
const animationStyles = document.createElement('style');
animationStyles.textContent = `
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

function OBSOverlay() {
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
  const pin = params.get('pin');
  const roomSlug = params.get('room');
  const position = params.get('position') || 'bottom'; // bottom, top, center
  const fontSize = parseInt(params.get('fontSize') || '100', 10); // percentage
  const textColor = params.get('color') || 'white';
  const showOriginal = params.get('original') !== 'false';
  const showTransliteration = params.get('transliteration') !== 'false';
  const showTranslation = params.get('translation') !== 'false';
  const paddingBottom = parseInt(params.get('paddingBottom') || '5', 10); // vh units
  const paddingTop = parseInt(params.get('paddingTop') || '5', 10); // vh units
  const maxWidth = parseInt(params.get('maxWidth') || '90', 10); // percentage

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
      let roomPin = pin;

      // If room slug provided, look up the PIN
      if (roomSlug && !roomPin) {
        try {
          const response = await publicRoomAPI.getBySlug(roomSlug);
          if (response.data && response.data.pin) {
            roomPin = response.data.pin;
          } else {
            setError('Room not found or not live');
            return;
          }
        } catch (err) {
          setError('Failed to find room');
          return;
        }
      }

      if (!roomPin) {
        setError('No room PIN provided. Use ?pin=XXXX or ?room=name');
        return;
      }

      // Connect socket
      socketService.connect();

      // Set up event handlers
      socketService.onConnect(() => {
        console.log('OBS Overlay: Connected to server');
        socketService.joinRoom(roomPin);
      });

      socketService.onRoomJoined((data) => {
        console.log('OBS Overlay: Joined room', data);
        setJoined(true);
        setError('');

        // Set initial slide if provided
        if (data.currentSlide?.slideData) {
          setCurrentSlide(data.currentSlide.slideData);
        }
        if (data.currentSlide?.displayMode) {
          setDisplayMode(data.currentSlide.displayMode);
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

        if (data.currentSlide?.displayMode) {
          setDisplayMode(data.currentSlide.displayMode);
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
  }, [pin, roomSlug]);

  // Calculate position styles
  const getPositionStyles = () => {
    switch (position) {
      case 'top':
        return {
          top: `${paddingTop}vh`,
          bottom: 'auto',
          justifyContent: 'flex-start'
        };
      case 'center':
        return {
          top: '50%',
          transform: 'translateY(-50%)',
          justifyContent: 'center'
        };
      case 'bottom':
      default:
        return {
          bottom: `${paddingBottom}vh`,
          top: 'auto',
          justifyContent: 'flex-end'
        };
    }
  };

  // Get text direction
  const getTextDirection = (text) => {
    return isHebrew(text) ? 'rtl' : 'ltr';
  };

  // Check if current song is transliteration language (Hebrew/Arabic)
  const isTransliterationLanguage = currentSlide?.originalText && isHebrew(currentSlide.originalText);

  // Calculate font sizes
  const baseFontSize = fontSize / 100;
  const line1FontSize = isTransliterationLanguage
    ? `calc(clamp(1.5rem, 4vw, 4rem) * ${baseFontSize})`
    : `calc(clamp(1.3rem, 3.5vw, 3.5rem) * ${baseFontSize})`;
  const otherLinesFontSize = isTransliterationLanguage
    ? `calc(clamp(1.1rem, 3vw, 3rem) * ${baseFontSize})`
    : `calc(clamp(1.3rem, 3.5vw, 3.5rem) * ${baseFontSize})`;

  // Render nothing if blank or no slide
  const shouldHide = !currentSlide || currentSlide.isBlank;

  // Error display (minimal, for debugging)
  if (error && !joined) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'rgba(255,255,255,0.5)',
        fontSize: '14px',
        fontFamily: 'system-ui, sans-serif'
      }}>
        {error}
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
          position: 'absolute',
          left: '50%',
          transform: position === 'center' ? 'translate(-50%, -50%)' : 'translateX(-50%)',
          width: `${maxWidth}%`,
          maxWidth: '1600px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          padding: '1.5rem 2rem',
          opacity: shouldHide ? 0 : 1,
          transition: 'opacity 0.3s ease',
          ...getPositionStyles()
        }}
      >
        {currentSlide && !currentSlide.isBlank && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'clamp(0.3rem, 1vh, 1rem)',
            width: '100%',
            background: 'linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.85) 100%)',
            borderRadius: '12px',
            padding: 'clamp(0.8rem, 2vh, 1.5rem) clamp(1rem, 3vw, 2rem)',
            boxShadow: '0 4px 30px rgba(0,0,0,0.5)'
          }}>
            {/* Original Text */}
            {showOriginal && currentSlide.originalText && (
              <div style={{
                fontSize: line1FontSize,
                lineHeight: 1.3,
                fontWeight: isTransliterationLanguage ? '500' : '400',
                color: textColor,
                textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                direction: getTextDirection(currentSlide.originalText),
                unicodeBidi: 'plaintext'
              }}>
                {currentSlide.originalText}
              </div>
            )}

            {/* Transliteration */}
            {showTransliteration && currentSlide.transliteration && displayMode === 'bilingual' && (
              <div style={{
                fontSize: otherLinesFontSize,
                lineHeight: 1.3,
                color: textColor,
                opacity: 0.9,
                textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                direction: getTextDirection(currentSlide.transliteration),
                unicodeBidi: 'plaintext'
              }}>
                {currentSlide.transliteration}
              </div>
            )}

            {/* Translation */}
            {showTranslation && currentSlide.translation && displayMode === 'bilingual' && (
              <div style={{
                fontSize: otherLinesFontSize,
                lineHeight: 1.3,
                color: textColor,
                opacity: 0.9,
                textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                direction: getTextDirection(currentSlide.translation),
                unicodeBidi: 'plaintext'
              }}>
                {currentSlide.translation}
                {currentSlide.translationOverflow && (
                  <span> {currentSlide.translationOverflow}</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default OBSOverlay;
