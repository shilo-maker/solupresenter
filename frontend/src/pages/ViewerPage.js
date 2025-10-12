import React, { useState, useEffect } from 'react';
import { Form, Button, Alert } from 'react-bootstrap';
import { useLocation } from 'react-router-dom';
import socketService from '../services/socket';

function ViewerPage() {
  const location = useLocation();
  const [pin, setPin] = useState('');
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState('');
  const [currentSlide, setCurrentSlide] = useState(null);
  const [displayMode, setDisplayMode] = useState('bilingual');
  const [backgroundImage, setBackgroundImage] = useState('');

  useEffect(() => {
    socketService.connect();

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
      } else {
        setCurrentSlide(data.slideData);
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

  const renderSlide = () => {
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

    return (
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4vh 6vw',
        color: 'white',
        textAlign: 'center',
        boxSizing: 'border-box'
      }}>
        {displayMode === 'original' ? (
          // Original language only - single line display
          <div style={{
            fontSize: 'clamp(2.5rem, 8vw, 8rem)',
            lineHeight: 1.4,
            fontWeight: '400',
            width: '100%',
            maxWidth: '100%',
            wordWrap: 'break-word',
            overflowWrap: 'break-word'
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
              fontSize: 'clamp(2rem, 6vw, 6rem)',
              lineHeight: 1.4,
              fontWeight: '500',
              width: '100%',
              wordWrap: 'break-word',
              overflowWrap: 'break-word'
            }}>
              {slide.originalText}
            </div>

            {/* Line 2 - Transliteration */}
            {slide.transliteration && (
              <div style={{
                fontSize: 'clamp(1.5rem, 4.5vw, 4.5rem)',
                lineHeight: 1.4,
                opacity: 0.95,
                width: '100%',
                wordWrap: 'break-word',
                overflowWrap: 'break-word'
              }}>
                {slide.transliteration}
              </div>
            )}

            {/* Line 3 - Translation */}
            {slide.translation && (
              <div style={{
                fontSize: 'clamp(1.5rem, 4.5vw, 4.5rem)',
                lineHeight: 1.4,
                opacity: 0.95,
                width: '100%',
                wordWrap: 'break-word',
                overflowWrap: 'break-word'
              }}>
                {slide.translation}
              </div>
            )}

            {/* Line 4 - Translation Overflow */}
            {slide.translationOverflow && (
              <div style={{
                fontSize: 'clamp(1.5rem, 4.5vw, 4.5rem)',
                lineHeight: 1.4,
                opacity: 0.95,
                width: '100%',
                wordWrap: 'break-word',
                overflowWrap: 'break-word'
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
        backgroundImage: backgroundImage ? (isGradient ? backgroundImage : `url(${backgroundImage})`) : 'none',
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
      {renderSlide()}
    </div>
  );
}

export default ViewerPage;
