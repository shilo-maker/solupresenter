import React, { useState, useEffect, useRef } from 'react';
import { Form, Button, Alert } from 'react-bootstrap';
import { useLocation } from 'react-router-dom';
import socketService from '../services/socket';
import ConnectionStatus from '../components/ConnectionStatus';
import { getFullImageUrl } from '../services/api';

function ViewerPage() {
  const location = useLocation();
  const [pin, setPin] = useState('');
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState('');
  const [currentSlide, setCurrentSlide] = useState(null);
  const [displayMode, setDisplayMode] = useState('bilingual');
  const [backgroundImage, setBackgroundImage] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [latency, setLatency] = useState(null);
  const [fontSize, setFontSize] = useState(100); // Percentage: 100 = normal
  const [textColor, setTextColor] = useState('white');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [imageUrl, setImageUrl] = useState(null); // For image-only slides
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Refs for click outside detection
  const controlsRef = useRef(null);
  const settingsButtonRef = useRef(null);

  // Handle click outside to close controls panel
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        showControls &&
        controlsRef.current &&
        settingsButtonRef.current &&
        !controlsRef.current.contains(event.target) &&
        !settingsButtonRef.current.contains(event.target)
      ) {
        setShowControls(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showControls]);

  // Handle fullscreen change events (e.g., when user presses ESC)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    // Send status to parent (for Chromecast receiver debugging)
    const sendStatusToParent = (message) => {
      if (window.parent !== window) {
        window.parent.postMessage({ type: 'viewer-status', message }, '*');
      }
      console.log('📱 Viewer status:', message);
    };

    sendStatusToParent('Viewer page loaded');

    socketService.connect();
    sendStatusToParent('Socket connecting...');

    // Subscribe to connection status changes
    const unsubscribe = socketService.onConnectionStatusChange((status, currentLatency) => {
      setConnectionStatus(status);
      setLatency(currentLatency);
      sendStatusToParent(`Socket ${status}, latency: ${currentLatency}ms`);
    });

    // Set up event listeners first
    socketService.onViewerJoined(async (data) => {
      console.log('Viewer joined, received data:', data);
      sendStatusToParent('Viewer joined room successfully!');
      setJoined(true);

      // Set the room background
      setBackgroundImage(data.backgroundImage || '');

      // Handle all possible current slide states
      if (data.isBlank) {
        // Blank slide
        setCurrentSlide({ isBlank: true });
        setImageUrl(null);
      } else if (data.imageUrl) {
        // Image-only slide
        setImageUrl(data.imageUrl);
        setCurrentSlide(null);
      } else if (data.slideData) {
        // Regular text slide
        setCurrentSlide(data.slideData);
        setImageUrl(null);
      } else {
        // No active slide yet
        setCurrentSlide(null);
        setImageUrl(null);
      }

      // Set display mode if available
      if (data.currentSlide?.displayMode) {
        setDisplayMode(data.currentSlide.displayMode);
      }

      setError('');
    });

    socketService.onSlideUpdate((data) => {
      console.log('Slide update received:', data);
      // If it's a blank slide, set currentSlide with isBlank flag
      if (data.isBlank) {
        setCurrentSlide({ isBlank: true });
        setImageUrl(null);
      } else if (data.imageUrl) {
        // Image-only slide
        setImageUrl(data.imageUrl);
        setCurrentSlide(null);
      } else {
        setCurrentSlide(data.slideData);
        setImageUrl(null);
      }
      // Update background from the data (room background)
      if (data.backgroundImage !== undefined) {
        setBackgroundImage(data.backgroundImage || '');
      }
      setDisplayMode(data.currentSlide?.displayMode || 'bilingual');
    });

    socketService.onBackgroundUpdate((data) => {
      console.log('Background update received:', data);
      setBackgroundImage(data.backgroundImage || '');
    });

    socketService.onError((error) => {
      setError(error.message);
    });

    // Check if PIN is in URL query params and auto-join
    const params = new URLSearchParams(location.search);
    const urlPin = params.get('pin');
    if (urlPin) {
      setPin(urlPin.toUpperCase());
      sendStatusToParent(`Auto-joining with PIN: ${urlPin.toUpperCase()}`);
      // Auto-join with the PIN from URL after a short delay to ensure socket is connected
      setTimeout(() => {
        sendStatusToParent('Attempting to join room...');
        socketService.viewerJoinRoom(urlPin.toUpperCase());
      }, 500);
    } else {
      sendStatusToParent('No PIN in URL, waiting for manual input');
    }

    return () => {
      unsubscribe(); // Unsubscribe from connection status changes
      socketService.removeAllListeners();
      socketService.disconnect();
    };
  }, [location.search]);

  const handleJoin = (e) => {
    e.preventDefault();
    setError('');
    if (pin.trim().length === 4) {
      socketService.viewerJoinRoom(pin.trim().toUpperCase());
    } else {
      setError('PIN must be 4 characters');
    }
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        // Enter fullscreen
        await document.documentElement.requestFullscreen();
      } else {
        // Exit fullscreen
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error('Error toggling fullscreen:', error);
    }
  };

  const renderSlide = () => {
    // Handle image-only slide
    if (imageUrl) {
      const isGradient = imageUrl.startsWith('linear-gradient');
      return (
        <div style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            width: '100%',
            height: '100%',
            background: isGradient ? imageUrl : `url(${getFullImageUrl(imageUrl)})`,
            backgroundSize: 'contain',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          }} />
        </div>
      );
    }

    if (!currentSlide || !currentSlide.slide || currentSlide.isBlank) {
      // Check if it's a blank slide or just waiting
      const isBlank = currentSlide?.isBlank === true;

      return (
        <div style={{
          width: '100%',
          height: '100%',
          position: 'relative'
        }}>
          {isBlank ? (
            // Show "Blank" in top left corner
            <div style={{
              position: 'absolute',
              top: '20px',
              left: '20px',
              color: 'white',
              fontSize: 'clamp(1rem, 2vw, 1.5rem)',
              opacity: 0.7
            }}>
              Blank
            </div>
          ) : (
            // Show modern waiting state
            <div style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '2rem'
            }}>
              {/* Logo */}
              <img
                src="/new_cast_logo.png"
                alt="SoluCast"
                style={{
                  maxWidth: '150px',
                  height: 'auto',
                  opacity: 0.9,
                  animation: 'fadeIn 1s ease-in'
                }}
              />

              {/* Animated dots */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                color: 'white',
                fontSize: 'clamp(1.2rem, 3vw, 2rem)',
                fontWeight: '300',
                letterSpacing: '0.05em'
              }}>
                <span style={{ opacity: 0.7 }}>Waiting for presentation</span>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: 'white',
                    opacity: 0.7,
                    animation: 'pulse 1.5s ease-in-out infinite'
                  }} />
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: 'white',
                    opacity: 0.7,
                    animation: 'pulse 1.5s ease-in-out 0.5s infinite'
                  }} />
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: 'white',
                    opacity: 0.7,
                    animation: 'pulse 1.5s ease-in-out 1s infinite'
                  }} />
                </div>
              </div>

              {/* CSS animations */}
              <style>{`
                @keyframes pulse {
                  0%, 100% { opacity: 0.3; transform: scale(1); }
                  50% { opacity: 1; transform: scale(1.2); }
                }
                @keyframes fadeIn {
                  from { opacity: 0; transform: translateY(-10px); }
                  to { opacity: 0.9; transform: translateY(0); }
                }
              `}</style>
            </div>
          )}
        </div>
      );
    }

    const { slide } = currentSlide;

    // Detect if text contains Hebrew characters
    const isHebrew = (text) => {
      if (!text) return false;
      return /[\u0590-\u05FF]/.test(text);
    };

    // Determine text direction based on content
    const getTextDirection = (text) => {
      return isHebrew(text) ? 'rtl' : 'ltr';
    };

    return (
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2vh 6vw',
        color: textColor,
        textAlign: 'center',
        boxSizing: 'border-box',
        position: 'relative'
      }}>
        {/* Verse Type/Reference Label - Top Left */}
        {(slide.verseType || slide.reference) && (
          <div style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '12px',
            fontSize: 'clamp(0.9rem, 1.5vw, 1.2rem)',
            fontWeight: '600',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: '4px'
          }}>
            {slide.hebrewReference && (
              <div style={{ direction: 'rtl', width: '100%' }}>
                {slide.hebrewReference}
              </div>
            )}
            <div>
              {slide.reference || slide.verseType}
            </div>
          </div>
        )}

        {displayMode === 'original' ? (
          // Original language only - single line display
          <div style={{
            fontSize: `calc(clamp(2.5rem, 8vw, 8rem) * ${fontSize / 100})`,
            lineHeight: 1.4,
            fontWeight: '400',
            width: '100%',
            maxWidth: '100%',
            wordWrap: 'break-word',
            overflowWrap: 'break-word',
            color: textColor,
            textShadow: '3px 3px 8px rgba(0, 0, 0, 0.9), -2px -2px 4px rgba(0, 0, 0, 0.7), 0 0 20px rgba(0, 0, 0, 0.5)',
            direction: getTextDirection(slide.originalText),
            unicodeBidi: 'plaintext'
          }}>
            {slide.originalText}
          </div>
        ) : (
          // Bilingual mode - all 4 lines
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'clamp(1rem, 3vh, 3rem)',
            width: '100%',
            maxWidth: '100%'
          }}>
            {/* Line 1 - Original Text */}
            <div style={{
              fontSize: `calc(clamp(2rem, 6vw, 6rem) * ${fontSize / 100})`,
              lineHeight: 1.4,
              fontWeight: '500',
              width: '100%',
              wordWrap: 'break-word',
              overflowWrap: 'break-word',
              color: textColor,
              textShadow: '3px 3px 8px rgba(0, 0, 0, 0.9), -2px -2px 4px rgba(0, 0, 0, 0.7), 0 0 20px rgba(0, 0, 0, 0.5)',
              direction: getTextDirection(slide.originalText),
              unicodeBidi: 'plaintext'
            }}>
              {slide.originalText}
            </div>

            {/* Line 2 - Transliteration */}
            {slide.transliteration && (
              <div style={{
                fontSize: `calc(clamp(1.5rem, 4.5vw, 4.5rem) * ${fontSize / 100})`,
                lineHeight: 1.4,
                opacity: 0.95,
                width: '100%',
                wordWrap: 'break-word',
                overflowWrap: 'break-word',
                color: textColor,
                textShadow: '3px 3px 8px rgba(0, 0, 0, 0.9), -2px -2px 4px rgba(0, 0, 0, 0.7), 0 0 20px rgba(0, 0, 0, 0.5)',
                direction: getTextDirection(slide.transliteration),
                unicodeBidi: 'plaintext'
              }}>
                {slide.transliteration}
              </div>
            )}

            {/* Lines 3 & 4 - Translation (with tight spacing between overflow lines) */}
            {slide.translation && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: slide.translationOverflow ? 'clamp(0.1rem, 0.3vh, 0.3rem)' : '0',
                width: '100%'
              }}>
                {/* Line 3 - Translation */}
                <div style={{
                  fontSize: `calc(clamp(1.5rem, 4.5vw, 4.5rem) * ${fontSize / 100})`,
                  lineHeight: 1.4,
                  opacity: 0.95,
                  width: '100%',
                  wordWrap: 'break-word',
                  overflowWrap: 'break-word',
                  color: textColor,
                  textShadow: '3px 3px 8px rgba(0, 0, 0, 0.9), -2px -2px 4px rgba(0, 0, 0, 0.7), 0 0 20px rgba(0, 0, 0, 0.5)',
                  direction: getTextDirection(slide.translation),
                  unicodeBidi: 'plaintext'
                }}>
                  {slide.translation}
                </div>

                {/* Line 4 - Translation Overflow */}
                {slide.translationOverflow && (
                  <div style={{
                    fontSize: `calc(clamp(1.5rem, 4.5vw, 4.5rem) * ${fontSize / 100})`,
                    lineHeight: 1.4,
                    opacity: 0.95,
                    width: '100%',
                    wordWrap: 'break-word',
                    overflowWrap: 'break-word',
                    color: textColor,
                    textShadow: '3px 3px 8px rgba(0, 0, 0, 0.9), -2px -2px 4px rgba(0, 0, 0, 0.7), 0 0 20px rgba(0, 0, 0, 0.5)',
                    direction: getTextDirection(slide.translationOverflow),
                    unicodeBidi: 'plaintext'
                  }}>
                    {slide.translationOverflow}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (!joined) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(-45deg, #0a0a0a, #1a1a2e, #2d2d2d, #404040, #2a2a3e, #1a1a1a)',
        backgroundSize: '400% 400%',
        animation: 'gradientShift 15s ease infinite',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <style>{`
          @keyframes gradientShift {
            0% {
              background-position: 0% 50%;
            }
            50% {
              background-position: 100% 50%;
            }
            100% {
              background-position: 0% 50%;
            }
          }
        `}</style>
        {/* Login Button - Top Right */}
        <Button
          variant="light"
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            borderRadius: '6px',
            padding: '8px 20px',
            fontSize: '1rem',
            fontWeight: '500'
          }}
          onClick={() => window.location.href = '/login'}
        >
          LOGIN
        </Button>

        {/* Centered Content */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '20px'
        }}>
          {/* SoluCast Logo */}
          <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
            <img
              src="/new_cast_logo.png"
              alt="SoluCast Logo"
              style={{
                maxWidth: 'clamp(125px, 20vw, 200px)',
                height: 'auto',
                width: '100%',
                marginBottom: '1rem'
              }}
            />
            <div style={{
              color: 'white',
              fontWeight: '600',
              fontSize: '1.8rem',
              letterSpacing: '1px',
              marginBottom: '0.3rem'
            }}>
              SoluCast
            </div>
            <div style={{
              color: 'rgba(255, 255, 255, 0.7)',
              fontWeight: '300',
              fontSize: '0.9rem',
              letterSpacing: '2px',
              textTransform: 'uppercase'
            }}>
              WORSHIP AS ONE
            </div>
          </div>

          {error && (
            <Alert variant="danger" style={{ marginBottom: '15px', width: '100%', maxWidth: '250px' }}>
              {error}
            </Alert>
          )}

          {/* PIN Input Form */}
          <Form onSubmit={handleJoin} style={{ width: '100%', maxWidth: '320px' }}>
            <div style={{
              marginBottom: '20px',
              textAlign: 'center'
            }}>
              <h3 style={{
                color: 'white',
                fontSize: '1.1rem',
                fontWeight: '300',
                marginBottom: '20px',
                letterSpacing: '0.5px'
              }}>
                Enter Room Code
              </h3>

              {/* PIN Input - Individual Boxes */}
              <div
                onClick={() => {
                  const input = document.querySelector('input[type="text"]');
                  if (input) input.focus();
                }}
                style={{
                  display: 'flex',
                  gap: '12px',
                  justifyContent: 'center',
                  marginBottom: '24px',
                  cursor: 'text'
                }}
              >
                {[0, 1, 2, 3].map((index) => (
                  <div
                    key={index}
                    style={{
                      width: '60px',
                      height: '70px',
                      background: 'rgba(255, 255, 255, 0.08)',
                      backdropFilter: 'blur(10px)',
                      border: '2px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '2rem',
                      fontWeight: '600',
                      color: 'white',
                      letterSpacing: '0',
                      transition: 'all 0.3s ease',
                      boxShadow: pin[index] ? '0 0 20px rgba(255, 255, 255, 0.2)' : 'none',
                      transform: pin[index] ? 'scale(1.05)' : 'scale(1)',
                      cursor: 'text'
                    }}
                  >
                    {pin[index] || ''}
                  </div>
                ))}
              </div>

              {/* Hidden actual input */}
              <Form.Control
                type="text"
                value={pin}
                onChange={(e) => {
                  const newValue = e.target.value.toUpperCase();
                  setPin(newValue);
                  // Keep cursor at end
                  setTimeout(() => {
                    if (e.target) {
                      e.target.setSelectionRange(newValue.length, newValue.length);
                    }
                  }, 0);
                }}
                maxLength={4}
                style={{
                  position: 'absolute',
                  opacity: 0,
                  pointerEvents: 'auto',
                  width: '1px',
                  height: '1px',
                  left: '-9999px'
                }}
                autoFocus
                required
              />
            </div>

            {/* Join Button */}
            <Button
              type="submit"
              style={{
                width: '100%',
                borderRadius: '12px',
                padding: '14px',
                fontSize: '1rem',
                fontWeight: '600',
                backgroundColor: 'white',
                color: '#2d2d2d',
                border: 'none',
                letterSpacing: '1px',
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 15px rgba(255, 255, 255, 0.2)'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 6px 20px rgba(255, 255, 255, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 15px rgba(255, 255, 255, 0.2)';
              }}
            >
              JOIN ROOM
            </Button>
          </Form>
        </div>
      </div>
    );
  }

  // Determine if backgroundImage is a gradient or URL
  const isGradient = backgroundImage && backgroundImage.startsWith('linear-gradient');

  return (
    <>
      <style>{`
        @keyframes gradientShift {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
      `}</style>
      <div
        style={{
          background: backgroundImage
            ? (isGradient ? backgroundImage : `url(${getFullImageUrl(backgroundImage)})`)
            : 'linear-gradient(-45deg, #0a0a0a, #1a1a2e, #16161d, #1f1f1f, #1a1a2e, #0a0a0a)',
          backgroundSize: backgroundImage ? 'cover' : '400% 400%',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          animation: backgroundImage ? 'none' : 'gradientShift 20s ease infinite',
          width: '100vw',
          height: '100vh',
          position: 'fixed',
          top: 0,
          left: 0,
          overflow: 'hidden'
        }}
      >
        <ConnectionStatus status={connectionStatus} latency={latency} />

      {/* Settings Button - Bottom Left */}
      <button
        ref={settingsButtonRef}
        onClick={() => setShowControls(!showControls)}
        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
        onMouseLeave={(e) => e.currentTarget.style.opacity = showControls ? '1' : '0.4'}
        style={{
          position: 'fixed',
          bottom: '20px',
          left: '20px',
          width: '40px',
          height: '40px',
          borderRadius: '10px',
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          color: 'white',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(10px)',
          zIndex: 1001,
          transition: 'all 0.3s ease',
          opacity: showControls ? '1' : '0.4',
          boxShadow: showControls ? '0 4px 12px rgba(255,255,255,0.15)' : 'none'
        }}
        title="Display Settings"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="7" x2="20" y2="7"/>
          <line x1="4" y1="12" x2="20" y2="12"/>
          <line x1="4" y1="17" x2="20" y2="17"/>
          <circle cx="8" cy="7" r="2" fill="currentColor"/>
          <circle cx="16" cy="12" r="2" fill="currentColor"/>
          <circle cx="10" cy="17" r="2" fill="currentColor"/>
        </svg>
      </button>

      {/* Fullscreen Button - Bottom Right */}
      <button
        onClick={toggleFullscreen}
        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
        onMouseLeave={(e) => e.currentTarget.style.opacity = isFullscreen ? '1' : '0.4'}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          width: '40px',
          height: '40px',
          borderRadius: '10px',
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          color: 'white',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(10px)',
          zIndex: 1001,
          transition: 'all 0.3s ease',
          opacity: isFullscreen ? '1' : '0.4',
          boxShadow: isFullscreen ? '0 4px 12px rgba(255,255,255,0.15)' : 'none'
        }}
        title={isFullscreen ? 'Exit Fullscreen (ESC)' : 'Enter Fullscreen (F11)'}
      >
        {isFullscreen ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
          </svg>
        )}
      </button>

      {/* Controls Panel - Slide out from left */}
      <div
        ref={controlsRef}
        style={{
          position: 'fixed',
          bottom: '80px',
          left: showControls ? '20px' : '-400px',
          width: '340px',
          maxHeight: '70vh',
          overflowY: 'auto',
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          borderRadius: '16px',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          padding: '20px',
          zIndex: 1000,
          transition: 'left 0.3s ease',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
        }}
      >
        <h6 style={{
          color: 'white',
          marginBottom: '20px',
          fontSize: '1.1rem',
          fontWeight: '600',
          borderBottom: '1px solid rgba(255,255,255,0.2)',
          paddingBottom: '10px'
        }}>
          Display Settings
        </h6>

        {/* Font Size Controls */}
        <div style={{ marginBottom: '25px' }}>
          <label style={{
            color: 'white',
            fontSize: '0.9rem',
            marginBottom: '10px',
            display: 'block',
            fontWeight: '500'
          }}>
            Font Size
          </label>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <Button
              size="sm"
              variant="light"
              onClick={() => setFontSize(Math.max(50, fontSize - 10))}
              style={{
                borderRadius: '8px',
                width: '36px',
                height: '36px',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '1.2rem'
              }}
            >
              −
            </Button>
            <div style={{
              flex: 1,
              textAlign: 'center',
              color: 'white',
              fontSize: '1.1rem',
              fontWeight: '600',
              backgroundColor: 'rgba(255,255,255,0.1)',
              padding: '8px',
              borderRadius: '8px'
            }}>
              {fontSize}%
            </div>
            <Button
              size="sm"
              variant="light"
              onClick={() => setFontSize(Math.min(200, fontSize + 10))}
              style={{
                borderRadius: '8px',
                width: '36px',
                height: '36px',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '1.2rem'
              }}
            >
              +
            </Button>
          </div>
          {fontSize !== 100 && (
            <Button
              size="sm"
              variant="outline-light"
              onClick={() => setFontSize(100)}
              style={{
                fontSize: '0.85rem',
                padding: '6px 12px',
                borderRadius: '8px',
                marginTop: '10px',
                width: '100%'
              }}
            >
              Reset to 100%
            </Button>
          )}
        </div>

        {/* Text Color Controls */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{
            color: 'white',
            fontSize: '0.9rem',
            marginBottom: '10px',
            display: 'block',
            fontWeight: '500'
          }}>
            Text Color
          </label>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 1fr)',
            gap: '10px',
            marginBottom: '12px'
          }}>
            {['white', '#FFD700', '#87CEEB', '#98FB98', '#FFB6C1', '#DDA0DD'].map((color) => (
              <button
                key={color}
                onClick={() => setTextColor(color)}
                title={color === 'white' ? 'White' : color}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '8px',
                  backgroundColor: color,
                  border: textColor === color ? '3px solid white' : '2px solid rgba(255,255,255,0.3)',
                  cursor: 'pointer',
                  boxShadow: textColor === color ? '0 0 15px rgba(255,255,255,0.6)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              />
            ))}
          </div>

          <Button
            size="sm"
            variant="outline-light"
            onClick={() => setShowColorPicker(!showColorPicker)}
            style={{
              fontSize: '0.85rem',
              padding: '6px 12px',
              borderRadius: '8px',
              width: '100%'
            }}
          >
            {showColorPicker ? 'Hide' : 'Custom Color'}
          </Button>

          {/* Custom Color Picker */}
          {showColorPicker && (
            <div style={{
              marginTop: '12px',
              padding: '12px',
              backgroundColor: 'rgba(255,255,255,0.1)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <input
                type="color"
                value={textColor}
                onChange={(e) => setTextColor(e.target.value)}
                style={{
                  width: '50px',
                  height: '40px',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              />
              <span style={{
                color: 'white',
                fontSize: '0.85rem',
                fontFamily: 'monospace',
                flex: 1,
                textAlign: 'center',
                fontWeight: '600'
              }}>
                {textColor.toUpperCase()}
              </span>
            </div>
          )}
        </div>
      </div>

      {renderSlide()}
      </div>
    </>
  );
}

export default ViewerPage;
