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
    socketService.connect();

    // Subscribe to connection status changes
    const unsubscribe = socketService.onConnectionStatusChange((status, currentLatency) => {
      setConnectionStatus(status);
      setLatency(currentLatency);
    });

    // Set up event listeners first
    socketService.onViewerJoined(async (data) => {
      console.log('Viewer joined, received data:', data);
      setJoined(true);

      // Set the room background
      setBackgroundImage(data.backgroundImage || '');

      // Check if we have slideData or need to handle currentSlide structure
      if (data.slideData) {
        setCurrentSlide(data.slideData);
      } else if (data.currentSlide && !data.currentSlide.isBlank && data.currentSlide.songId) {
        // We have a currentSlide from room but need to fetch the song data
        // This will be handled by the initial slide:update event
        setCurrentSlide(null);
      } else {
        setCurrentSlide(null);
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
      // Auto-join with the PIN from URL after a short delay to ensure socket is connected
      setTimeout(() => {
        socketService.viewerJoinRoom(urlPin.toUpperCase());
      }, 500);
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
            // Show "Blank Slide" in top left corner
            <div style={{
              position: 'absolute',
              top: '20px',
              left: '20px',
              color: 'white',
              fontSize: 'clamp(1rem, 2vw, 1.5rem)',
              opacity: 0.7
            }}>
              Blank Slide
            </div>
          ) : (
            // Show "Waiting for presentation..." centered
            <div style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: 'clamp(1.5rem, 4vw, 3rem)'
            }}>
              Waiting for presentation...
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
        padding: '4vh 6vw',
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
            textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8), -1px -1px 2px rgba(0, 0, 0, 0.5)',
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
              textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8), -1px -1px 2px rgba(0, 0, 0, 0.5)',
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
                textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8), -1px -1px 2px rgba(0, 0, 0, 0.5)',
                direction: getTextDirection(slide.transliteration),
                unicodeBidi: 'plaintext'
              }}>
                {slide.transliteration}
              </div>
            )}

            {/* Line 3 - Translation */}
            {slide.translation && (
              <div style={{
                fontSize: `calc(clamp(1.5rem, 4.5vw, 4.5rem) * ${fontSize / 100})`,
                lineHeight: 1.4,
                opacity: 0.95,
                width: '100%',
                wordWrap: 'break-word',
                overflowWrap: 'break-word',
                color: textColor,
                textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8), -1px -1px 2px rgba(0, 0, 0, 0.5)',
                direction: getTextDirection(slide.translation),
                unicodeBidi: 'plaintext'
              }}>
                {slide.translation}
              </div>
            )}

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
                textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8), -1px -1px 2px rgba(0, 0, 0, 0.5)',
                direction: getTextDirection(slide.translationOverflow),
                unicodeBidi: 'plaintext'
              }}>
                {slide.translationOverflow}
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
        backgroundColor: '#2d2d2d',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
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
          <div style={{ marginBottom: '1.5rem' }}>
            <img
              src="/logo.png"
              alt="SoluCast Logo"
              style={{
                maxWidth: 'clamp(250px, 40vw, 400px)',
                height: 'auto',
                width: '100%'
              }}
            />
          </div>

          {error && (
            <Alert variant="danger" style={{ marginBottom: '15px', width: '100%', maxWidth: '250px' }}>
              {error}
            </Alert>
          )}

          {/* PIN Input Form */}
          <Form onSubmit={handleJoin} style={{ width: '100%', maxWidth: '250px' }}>
            {/* PIN Input Box */}
            <div style={{
              border: '2px solid white',
              borderRadius: '6px',
              padding: '8px 12px',
              marginBottom: '12px',
              backgroundColor: 'transparent'
            }}>
              <Form.Control
                type="text"
                value={pin}
                onChange={(e) => setPin(e.target.value.toUpperCase())}
                maxLength={4}
                placeholder="X X X X"
                style={{
                  textTransform: 'uppercase',
                  fontSize: '1.5rem',
                  textAlign: 'center',
                  letterSpacing: '0.6rem',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: 'white',
                  outline: 'none',
                  boxShadow: 'none'
                }}
                autoFocus
                required
              />
            </div>

            {/* Join Button */}
            <Button
              type="submit"
              variant="light"
              style={{
                width: '100%',
                borderRadius: '6px',
                padding: '8px',
                fontSize: '1rem',
                fontWeight: '500'
              }}
            >
              JOIN
            </Button>
          </Form>
        </div>
      </div>
    );
  }

  // Determine if backgroundImage is a gradient or URL
  const isGradient = backgroundImage && backgroundImage.startsWith('linear-gradient');

  return (
    <div
      style={{
        backgroundColor: '#000',
        backgroundImage: backgroundImage ? (isGradient ? backgroundImage : `url(${getFullImageUrl(backgroundImage)})`) : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
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
        style={{
          position: 'fixed',
          bottom: '20px',
          left: '20px',
          width: '50px',
          height: '50px',
          borderRadius: '50%',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          border: '2px solid rgba(255, 255, 255, 0.3)',
          color: 'white',
          fontSize: '1.5rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(10px)',
          zIndex: 1001,
          transition: 'all 0.3s ease',
          boxShadow: showControls ? '0 0 20px rgba(255,255,255,0.3)' : 'none'
        }}
        title="Display Settings"
      >
        ⚙️
      </button>

      {/* Fullscreen Button - Bottom Right */}
      <button
        onClick={toggleFullscreen}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          width: '50px',
          height: '50px',
          borderRadius: '50%',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          border: '2px solid rgba(255, 255, 255, 0.3)',
          color: 'white',
          fontSize: '1.3rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(10px)',
          zIndex: 1001,
          transition: 'all 0.3s ease',
          boxShadow: isFullscreen ? '0 0 20px rgba(255,255,255,0.3)' : 'none'
        }}
        title={isFullscreen ? 'Exit Fullscreen (ESC)' : 'Enter Fullscreen (F11)'}
      >
        {isFullscreen ? '⤡' : '⤢'}
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
  );
}

export default ViewerPage;
