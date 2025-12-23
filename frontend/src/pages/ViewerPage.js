import React, { useState, useEffect, useRef } from 'react';
import { Form, Button, Alert, Spinner } from 'react-bootstrap';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { changeLanguage } from '../i18n';
import socketService from '../services/socket';
import ConnectionStatus from '../components/ConnectionStatus';
import { getFullImageUrl, publicRoomAPI } from '../services/api';

// Inject animation keyframes
const animationStyles = document.createElement('style');
animationStyles.textContent = `
  @keyframes breathing {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
  }
  @keyframes messageUpdate {
    0% { transform: scale(1); opacity: 0.5; }
    50% { transform: scale(1.15); opacity: 1; }
    100% { transform: scale(1); opacity: 1; }
  }
`;
if (!document.getElementById('viewer-animations')) {
  animationStyles.id = 'viewer-animations';
  document.head.appendChild(animationStyles);
}

function ViewerPage() {
  const { t, i18n } = useTranslation();
  const location = useLocation();

  const [pin, setPin] = useState('');
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState('');
  const [currentSlide, setCurrentSlide] = useState(null);

  // Room name search state
  const [joinMode, setJoinMode] = useState('name'); // 'pin' or 'name'
  const [roomSearch, setRoomSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const searchTimeoutRef = useRef(null);
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
  const [toolsData, setToolsData] = useState(null); // For tools display (countdown, clock, stopwatch, announcement)
  const [clockTime, setClockTime] = useState(new Date());
  const [countdownRemaining, setCountdownRemaining] = useState(0);
  const [stopwatchElapsed, setStopwatchElapsed] = useState(0);
  const [countdownMessageKey, setCountdownMessageKey] = useState(0); // For triggering message update animation
  const prevCountdownMessageRef = useRef('');
  const clockIntervalRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const stopwatchIntervalRef = useRef(null);
  // Announcement animation state
  const [announcementBanner, setAnnouncementBanner] = useState({ visible: false, text: '', animating: false });

  // Viewer display toggles
  const [showOriginal, setShowOriginal] = useState(true);
  const [showTransliteration, setShowTransliteration] = useState(true);
  const [showTranslation, setShowTranslation] = useState(true);

  // Refs for click outside detection
  const controlsRef = useRef(null);
  const settingsButtonRef = useRef(null);

  // Inactivity tracking - reset view after 1 hour of no activity
  const lastActivityRef = useRef(Date.now());
  const INACTIVITY_TIMEOUT = 60 * 60 * 1000; // 1 hour in milliseconds

  // Ref for translation function to use in socket callbacks without adding to dependencies
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

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

  // Inactivity check - reset view after 1 hour of no slide updates
  useEffect(() => {
    if (!joined) return; // Only check when in a room

    const checkInactivity = () => {
      const timeSinceLastActivity = Date.now() - lastActivityRef.current;
      if (timeSinceLastActivity >= INACTIVITY_TIMEOUT) {
        console.log('⏰ Inactivity timeout reached (1 hour). Resetting view...');
        // Reset to join screen
        setJoined(false);
        setCurrentSlide(null);
        setImageUrl(null);
        setBackgroundImage('');
        setPin('');
        setRoomSearch('');
        setSearchResults([]);
        setSelectedRoom(null);
        setError('');
        // Disconnect and reconnect socket
        socketService.disconnect();
        socketService.connect();
      }
    };

    // Check every minute
    const inactivityInterval = setInterval(checkInactivity, 60 * 1000);

    return () => {
      clearInterval(inactivityInterval);
    };
  }, [joined]);

  // Clock timer effect - updates every second when clock is displayed
  useEffect(() => {
    if (toolsData?.type === 'clock') {
      clockIntervalRef.current = setInterval(() => {
        setClockTime(new Date());
      }, 1000);
    }
    return () => {
      if (clockIntervalRef.current) {
        clearInterval(clockIntervalRef.current);
        clockIntervalRef.current = null;
      }
    };
  }, [toolsData?.type]);

  // Countdown timer effect - decrements every second when running
  // Countdown can be standalone OR underneath an announcement overlay
  useEffect(() => {
    // Start interval if countdown is running (regardless of whether it's standalone or under announcement)
    if (toolsData?.countdown?.running && countdownRemaining > 0) {
      countdownIntervalRef.current = setInterval(() => {
        setCountdownRemaining(prev => {
          const next = Math.max(0, prev - 1);
          // Auto-clear interval when countdown reaches 0
          if (next === 0 && countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
          return next;
        });
      }, 1000);
    }
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
    // Note: countdownRemaining is intentionally excluded to prevent interval restart every second
    // The interval self-clears when countdown reaches 0
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolsData?.countdown?.running]);

  // Detect countdown message changes and trigger animation
  useEffect(() => {
    const currentMessage = toolsData?.countdown?.message || '';
    if (currentMessage && currentMessage !== prevCountdownMessageRef.current) {
      // Message changed - trigger animation by updating key
      setCountdownMessageKey(prev => prev + 1);
    }
    prevCountdownMessageRef.current = currentMessage;
  }, [toolsData?.countdown?.message]);

  // Stopwatch timer effect - increments every second when running
  useEffect(() => {
    if (toolsData?.type === 'stopwatch' && toolsData?.stopwatch?.running) {
      stopwatchIntervalRef.current = setInterval(() => {
        setStopwatchElapsed(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (stopwatchIntervalRef.current) {
        clearInterval(stopwatchIntervalRef.current);
        stopwatchIntervalRef.current = null;
      }
    };
  }, [toolsData?.type, toolsData?.stopwatch?.running]);

  // Announcement banner animation effect
  useEffect(() => {
    if (toolsData?.type === 'announcement') {
      const { visible, text } = toolsData.announcement || {};
      if (visible && text) {
        // Show banner with slide-up animation
        setAnnouncementBanner({ visible: true, text, animating: 'in' });
        // After animation completes, remove animating state
        setTimeout(() => {
          setAnnouncementBanner(prev => ({ ...prev, animating: false }));
        }, 500);
      } else if (!visible && announcementBanner.visible) {
        // Hide banner with slide-down animation
        setAnnouncementBanner(prev => ({ ...prev, animating: 'out' }));
        // After animation completes, hide the banner
        setTimeout(() => {
          setAnnouncementBanner({ visible: false, text: '', animating: false });
        }, 500);
      } else if (visible && text !== announcementBanner.text) {
        // Text changed while visible - update without animation
        setAnnouncementBanner(prev => ({ ...prev, text }));
      }
    } else if (announcementBanner.visible) {
      // Tool type changed away from announcement - hide immediately
      setAnnouncementBanner({ visible: false, text: '', animating: false });
    }
  }, [toolsData?.type, toolsData?.announcement?.visible, toolsData?.announcement?.text, announcementBanner.visible, announcementBanner.text]);

  useEffect(() => {
    console.log('🚀 Component mounted');
    console.log(`📍 URL: ${window.location.href}`);

    socketService.connect();
    console.log('🔌 Connecting to socket...');

    // Subscribe to connection status changes
    const unsubscribe = socketService.onConnectionStatusChange((status, currentLatency) => {
      console.log(`🔌 Connection: ${status} (${currentLatency}ms)`);
      setConnectionStatus(status);
      setLatency(currentLatency);
    });

    // Set up event listeners first
    socketService.onViewerJoined(async (data) => {
      console.log('✅ Joined room successfully!');
      console.log(`📊 Room data received: ${JSON.stringify(data.currentSlide)}`);
      lastActivityRef.current = Date.now(); // Reset inactivity timer
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

      // Handle tools data for new viewers
      if (data.toolsData) {
        console.log('🔧 Initial toolsData for new viewer:', data.toolsData);
        setToolsData(data.toolsData);

        // Handle countdown timing sync
        if (data.toolsData.countdown) {
          const { remaining, endTime, running } = data.toolsData.countdown;
          if (running && endTime) {
            // Calculate remaining based on endTime for sync
            const now = Date.now();
            const remainingSecs = Math.max(0, Math.round((endTime - now) / 1000));
            setCountdownRemaining(remainingSecs);
          } else {
            setCountdownRemaining(remaining || 0);
          }
        }

        // Handle stopwatch timing sync
        if (data.toolsData.type === 'stopwatch' && data.toolsData.stopwatch) {
          const { elapsed, startTime, running } = data.toolsData.stopwatch;
          if (running && startTime) {
            const now = Date.now();
            const elapsedSecs = Math.round((now - startTime) / 1000);
            setStopwatchElapsed(elapsedSecs);
          } else {
            setStopwatchElapsed(elapsed || 0);
          }
        }
      }

      setError('');
    });

    socketService.onSlideUpdate((data) => {
      lastActivityRef.current = Date.now();
      console.log('📡 slide:update received:', { hasToolsData: !!data.toolsData, toolsType: data.toolsData?.type, isBlank: data.isBlank });

      // Handle tools data
      if (data.toolsData) {
        console.log('🔧 Setting toolsData:', data.toolsData);
        setToolsData(data.toolsData);

        // Announcements are overlays - don't clear existing content
        // Other tools (countdown, clock, stopwatch, rotatingMessage) replace content
        if (data.toolsData.type !== 'announcement') {
          setCurrentSlide(null);
          setImageUrl(null);
        } else {
          // For announcements, also update the underlying slide if provided
          if (data.slideData) {
            setCurrentSlide(data.slideData);
          }
          if (data.imageUrl) {
            setImageUrl(data.imageUrl);
          }
        }

        // Handle specific tool types
        // Countdown can be standalone OR included with an announcement overlay
        if (data.toolsData.countdown) {
          const { remaining, endTime, running } = data.toolsData.countdown;
          if (running && endTime) {
            // Calculate remaining based on endTime for sync
            const now = Date.now();
            const remainingSecs = Math.max(0, Math.round((endTime - now) / 1000));
            setCountdownRemaining(remainingSecs);
          } else {
            setCountdownRemaining(remaining || 0);
          }
        }

        if (data.toolsData.type === 'stopwatch' && data.toolsData.stopwatch) {
          const { elapsed, startTime, running } = data.toolsData.stopwatch;
          if (running && startTime) {
            // Calculate elapsed based on startTime for sync
            const now = Date.now();
            const elapsedSecs = Math.round((now - startTime) / 1000);
            setStopwatchElapsed(elapsedSecs);
          } else {
            setStopwatchElapsed(elapsed || 0);
          }
        }
      } else if (data.isBlank) {
        setCurrentSlide({ isBlank: true });
        setImageUrl(null);
        // Preserve announcement overlays when going to blank
        setToolsData(prev => prev?.type === 'announcement' ? prev : null);
      } else if (data.imageUrl) {
        setImageUrl(data.imageUrl);
        setCurrentSlide(null);
        // Preserve announcement overlays when showing images
        setToolsData(prev => prev?.type === 'announcement' ? prev : null);
      } else {
        setCurrentSlide(data.slideData);
        setImageUrl(null);
        // Preserve announcement overlays when switching slides
        setToolsData(prev => prev?.type === 'announcement' ? prev : null);
      }

      if (data.backgroundImage !== undefined) {
        setBackgroundImage(data.backgroundImage || '');
      }
      setDisplayMode(data.currentSlide?.displayMode || 'bilingual');
    });

    socketService.onBackgroundUpdate((data) => {
      lastActivityRef.current = Date.now();
      setBackgroundImage(data.backgroundImage || '');
    });

    socketService.onError((error) => {
      console.error(`❌ Error: ${error.message}`);
      setError(error.message);
    });

    // Handle room closed by presenter
    socketService.onRoomClosed((data) => {
      console.log('🚪 Room closed by presenter:', data.message);
      // Reset to join screen
      setJoined(false);
      setCurrentSlide(null);
      setImageUrl(null);
      setBackgroundImage('');
      setPin('');
      setRoomSearch('');
      setSearchResults([]);
      setSelectedRoom(null);
      setError(tRef.current('viewer.sessionEnded'));
    });

    // Check if PIN or room name is in URL query params and auto-join
    const params = new URLSearchParams(location.search);
    const urlPin = params.get('pin');
    const urlRoom = params.get('room');

    if (urlRoom) {
      // Auto-join by room name (slug)
      console.log(`🏠 Room name found in URL: ${urlRoom}`);
      setJoinMode('name');
      setRoomSearch(urlRoom);
      // Auto-join with the room slug from URL after a short delay to ensure socket is connected
      setTimeout(() => {
        console.log(`🚪 Auto-joining room by name: ${urlRoom}`);
        socketService.viewerJoinRoomBySlug(urlRoom.toLowerCase());
      }, 500);
    } else if (urlPin) {
      console.log(`🔑 PIN found in URL: ${urlPin.toUpperCase()}`);
      setPin(urlPin.toUpperCase());
      // Auto-join with the PIN from URL after a short delay to ensure socket is connected
      setTimeout(() => {
        console.log(`🚪 Auto-joining room: ${urlPin.toUpperCase()}`);
        socketService.viewerJoinRoom(urlPin.toUpperCase());
      }, 500);
    } else {
      console.log('⚠️ No PIN or room name in URL - waiting for manual entry');
    }

    return () => {
      unsubscribe(); // Unsubscribe from connection status changes
      socketService.removeAllListeners();
      socketService.disconnect();
    };
  }, [location.search]);

  // Search for public rooms by name
  const handleRoomSearch = async (query) => {
    setRoomSearch(query);
    setSelectedRoom(null);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const response = await publicRoomAPI.search(query);
        setSearchResults(response.data.publicRooms || []);
      } catch (err) {
        console.error('Error searching rooms:', err);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  };

  // Join room by slug (public room name)
  const handleJoinByName = (e) => {
    e.preventDefault();
    setError('');

    if (!selectedRoom) {
      setError(t('viewer.selectRoomToJoin'));
      return;
    }

    if (!selectedRoom.isLive) {
      setError(`"${selectedRoom.name}" ${t('viewer.roomNotLive')}`);
      return;
    }

    socketService.viewerJoinRoomBySlug(selectedRoom.slug);
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

  // Format time helper for tools display
  const formatTime = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Format clock time
  const formatClockTime = (date, format) => {
    if (format === '12h') {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    }
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  };

  const formatClockDate = (date) => {
    return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  // Helper to render countdown (used standalone or under announcement overlay)
  const renderCountdown = () => {
    const { message } = toolsData?.countdown || {};
    const toolsStyle = {
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: textColor,
      textAlign: 'center'
    };
    return (
      <div style={toolsStyle}>
        {message && (
          <div
            key={countdownMessageKey}
            style={{
              fontSize: 'clamp(2rem, 5vw, 4rem)',
              fontWeight: '300',
              fontFamily: "'Montserrat', sans-serif",
              marginBottom: '0.3em',
              lineHeight: '1',
              textShadow: '2px 2px 8px rgba(0, 0, 0, 0.8)',
              animation: 'messageUpdate 0.5s ease-out, breathing 3s ease-in-out 0.5s infinite'
            }}>
            {message}
          </div>
        )}
        <div style={{
          fontSize: 'clamp(4rem, 15vw, 12rem)',
          fontWeight: '300',
          fontFamily: "'Montserrat', sans-serif",
          letterSpacing: '-0.02em',
          lineHeight: '1',
          fontVariantNumeric: 'tabular-nums',
          textShadow: '3px 3px 10px rgba(0, 0, 0, 0.9)'
        }}>
          {formatTime(countdownRemaining)}
        </div>
      </div>
    );
  };

  const renderSlide = () => {
    // If announcement is active with countdown underneath, show countdown
    if (toolsData?.type === 'announcement' && toolsData?.countdown?.running) {
      return renderCountdown();
    }

    // Handle tools display (except announcements which are overlays)
    if (toolsData && toolsData.type !== 'announcement') {
      console.log('🎨 renderSlide - toolsData:', toolsData.type, toolsData);
      const toolsStyle = {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: textColor,
        textAlign: 'center'
      };

      // Countdown timer display
      if (toolsData.type === 'countdown') {
        return renderCountdown();
      }

      // Clock display
      if (toolsData.type === 'clock') {
        const { format, showDate } = toolsData.clock || {};
        return (
          <div style={toolsStyle}>
            <div style={{
              fontSize: 'clamp(4rem, 15vw, 12rem)',
              fontWeight: '200',
              fontFamily: 'monospace',
              letterSpacing: '0.05em',
              textShadow: '3px 3px 10px rgba(0, 0, 0, 0.9)'
            }}>
              {formatClockTime(clockTime, format)}
            </div>
            {showDate && (
              <div style={{
                fontSize: 'clamp(1.5rem, 3vw, 2.5rem)',
                fontWeight: '300',
                marginTop: '20px',
                textShadow: '2px 2px 6px rgba(0, 0, 0, 0.8)'
              }}>
                {formatClockDate(clockTime)}
              </div>
            )}
          </div>
        );
      }

      // Stopwatch display
      if (toolsData.type === 'stopwatch') {
        const { label } = toolsData.stopwatch || {};
        return (
          <div style={toolsStyle}>
            {label && (
              <div style={{
                fontSize: 'clamp(1.5rem, 3vw, 2.5rem)',
                fontWeight: '300',
                marginBottom: '20px',
                textShadow: '2px 2px 6px rgba(0, 0, 0, 0.8)'
              }}>
                {label}
              </div>
            )}
            <div style={{
              fontSize: 'clamp(4rem, 15vw, 12rem)',
              fontWeight: '200',
              fontFamily: 'monospace',
              letterSpacing: '0.05em',
              textShadow: '3px 3px 10px rgba(0, 0, 0, 0.9)'
            }}>
              {formatTime(stopwatchElapsed)}
            </div>
          </div>
        );
      }

      // Rotating message display
      if (toolsData.type === 'rotatingMessage') {
        const { text } = toolsData.rotatingMessage || {};
        return (
          <div style={{
            ...toolsStyle,
            animation: 'fadeIn 0.5s ease-in-out'
          }}>
            <div style={{
              fontSize: 'clamp(3rem, 10vw, 8rem)',
              fontWeight: '300',
              maxWidth: '90%',
              lineHeight: 1.3,
              textShadow: '3px 3px 10px rgba(0, 0, 0, 0.9)'
            }}>
              {text}
            </div>
          </div>
        );
      }

      // Fallback for unknown tool types - prevents falling through to "Waiting"
      console.warn('⚠️ Unknown toolsData type:', toolsData.type);
      return (
        <div style={toolsStyle}>
          <div style={{ fontSize: '2rem', opacity: 0.7 }}>
            Tool: {toolsData.type || 'unknown'}
          </div>
        </div>
      );
    }

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
              {t('viewer.blank')}
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
                <span style={{ opacity: 0.7 }}>{t('viewer.waitingForPresentation')}</span>
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

    const { slide, originalLanguage, isBible } = currentSlide;

    // Check if language needs transliteration/translation structure (Hebrew, Arabic)
    const isTransliterationLanguage = originalLanguage === 'he' || originalLanguage === 'ar';

    // Detect if text contains Hebrew characters
    const isHebrew = (text) => {
      if (!text) return false;
      return /[\u0590-\u05FF]/.test(text);
    };

    // Determine text direction based on content
    const getTextDirection = (text) => {
      return isHebrew(text) ? 'rtl' : 'ltr';
    };

    // Font size for lines - equal for English songs, bigger first line for Hebrew/Arabic
    const line1FontSize = isTransliterationLanguage
      ? `calc(clamp(2rem, 6vw, 6rem) * ${fontSize / 100})`
      : `calc(clamp(1.8rem, 5vw, 5rem) * ${fontSize / 100})`;
    const otherLinesFontSize = isTransliterationLanguage
      ? `calc(clamp(1.5rem, 4.5vw, 4.5rem) * ${fontSize / 100})`
      : `calc(clamp(1.8rem, 5vw, 5rem) * ${fontSize / 100})`;

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
        {/* Bible Reference Label - Top Left (only for Bible verses) */}
        {slide.reference && (
          <div style={{
            position: 'absolute',
            top: '15px',
            left: '15px',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            color: 'white',
            padding: '6px 12px',
            borderRadius: '8px',
            fontSize: 'clamp(0.85rem, 1.2vw, 1rem)',
            fontWeight: '500',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: '2px',
            textShadow: '1px 1px 2px rgba(0,0,0,0.5)'
          }}>
            {slide.hebrewReference && (
              <div style={{ direction: 'rtl', width: '100%' }}>
                {slide.hebrewReference}
              </div>
            )}
            {displayMode === 'bilingual' && (
              <div>
                {slide.reference}
              </div>
            )}
          </div>
        )}

        {displayMode === 'original' ? (
          // Original language only - check for combined slides
          showOriginal && (
            currentSlide.combinedSlides && currentSlide.combinedSlides.length > 1 ? (
              // Combined slides - show both texts stacked vertically
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'clamp(2rem, 5vh, 5rem)',
                width: '100%',
                maxWidth: '100%'
              }}>
                {currentSlide.combinedSlides.map((combinedSlide, idx) => (
                  <div
                    key={idx}
                    style={{
                      fontSize: `calc(clamp(2.2rem, 7vw, 7rem) * ${fontSize / 100})`,
                      lineHeight: 1.4,
                      fontWeight: '400',
                      width: '100%',
                      maxWidth: '100%',
                      wordWrap: 'break-word',
                      overflowWrap: 'break-word',
                      color: textColor,
                      textShadow: '3px 3px 8px rgba(0, 0, 0, 0.9), -2px -2px 4px rgba(0, 0, 0, 0.7), 0 0 20px rgba(0, 0, 0, 0.5)',
                      direction: getTextDirection(combinedSlide.originalText),
                      unicodeBidi: 'plaintext',
                      textAlign: isBible ? 'right' : 'center'
                    }}
                  >
                    {combinedSlide.originalText}
                  </div>
                ))}
              </div>
            ) : (
              // Single slide - original display
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
                unicodeBidi: 'plaintext',
                textAlign: isBible ? 'right' : 'center'
              }}>
                {slide.originalText}
              </div>
            )
          )
        ) : (
          // Bilingual mode - all 4 lines (respects viewer toggles)
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'clamp(1rem, 3vh, 3rem)',
            width: '100%',
            maxWidth: '100%'
          }}>
            {/* Line 1 - Original Text / Lyrics */}
            {showOriginal && (
              <div style={{
                fontSize: line1FontSize,
                lineHeight: 1.4,
                fontWeight: isTransliterationLanguage ? '500' : '400',
                width: '100%',
                wordWrap: 'break-word',
                overflowWrap: 'break-word',
                color: textColor,
                textShadow: '3px 3px 8px rgba(0, 0, 0, 0.9), -2px -2px 4px rgba(0, 0, 0, 0.7), 0 0 20px rgba(0, 0, 0, 0.5)',
                direction: getTextDirection(slide.originalText),
                unicodeBidi: 'plaintext',
                textAlign: isBible ? 'right' : 'center'
              }}>
                {slide.originalText}
              </div>
            )}

            {/* Line 2 - Transliteration / Lyrics continued */}
            {showTransliteration && slide.transliteration && (
              <div style={{
                fontSize: otherLinesFontSize,
                lineHeight: 1.4,
                opacity: isTransliterationLanguage ? 0.95 : 1,
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

            {/* Lines 3 & 4 - Translation / Lyrics continued */}
            {showTranslation && slide.translation && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: slide.translationOverflow ? 'clamp(0.1rem, 0.3vh, 0.3rem)' : '0',
                width: '100%'
              }}>
                {/* Line 3 */}
                <div style={{
                  fontSize: otherLinesFontSize,
                  lineHeight: 1.4,
                  opacity: isTransliterationLanguage ? 0.95 : 1,
                  width: '100%',
                  wordWrap: 'break-word',
                  overflowWrap: 'break-word',
                  color: isBible ? '#FFD700' : textColor,
                  textShadow: '3px 3px 8px rgba(0, 0, 0, 0.9), -2px -2px 4px rgba(0, 0, 0, 0.7), 0 0 20px rgba(0, 0, 0, 0.5)',
                  direction: getTextDirection(slide.translation),
                  unicodeBidi: 'plaintext',
                  textAlign: isBible ? 'left' : 'center'
                }}>
                  {slide.translation}
                </div>

                {/* Line 4 */}
                {slide.translationOverflow && (
                  <div style={{
                    fontSize: otherLinesFontSize,
                    lineHeight: 1.4,
                    opacity: isTransliterationLanguage ? 0.95 : 1,
                    width: '100%',
                    wordWrap: 'break-word',
                    overflowWrap: 'break-word',
                    color: isBible ? '#FFD700' : textColor,
                    textShadow: '3px 3px 8px rgba(0, 0, 0, 0.9), -2px -2px 4px rgba(0, 0, 0, 0.7), 0 0 20px rgba(0, 0, 0, 0.5)',
                    direction: getTextDirection(slide.translationOverflow),
                    unicodeBidi: 'plaintext',
                    textAlign: isBible ? 'left' : 'center'
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
        {/* Language Toggle Button - Top Left */}
        <Button
          variant="outline-light"
          style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            borderRadius: '6px',
            padding: '8px 16px',
            fontSize: '0.9rem',
            fontWeight: '500'
          }}
          onClick={() => changeLanguage(i18n.language === 'he' ? 'en' : 'he')}
        >
          {i18n.language === 'he' ? 'English' : 'עברית'}
        </Button>

        {/* Login/Operator Button - Top Right */}
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
          onClick={() => window.location.href = localStorage.getItem('token') ? '/operator' : '/login'}
        >
          {localStorage.getItem('token') ? t('viewer.operator') : t('auth.login').toUpperCase()}
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
              {t('viewer.tagline')}
            </div>
          </div>

          {error && (
            <Alert variant="danger" style={{ marginBottom: '15px', width: '100%', maxWidth: '320px' }}>
              {error}
            </Alert>
          )}

          {/* Mode Toggle */}
          <div
            onClick={() => setJoinMode(joinMode === 'name' ? 'pin' : 'name')}
            style={{
              display: 'flex',
              flexDirection: i18n.language === 'he' ? 'row' : 'row-reverse',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '20px',
              cursor: 'pointer',
              padding: '8px 16px',
              borderRadius: '20px',
              background: 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)'
            }}
          >
            <span style={{
              color: joinMode === 'pin' ? 'white' : 'rgba(255, 255, 255, 0.5)',
              fontWeight: joinMode === 'pin' ? '600' : '400',
              fontSize: '0.9rem',
              transition: 'all 0.2s ease'
            }}>
              {t('viewer.code')}
            </span>

            {/* Toggle Switch */}
            <div style={{
              width: '44px',
              height: '24px',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '12px',
              position: 'relative',
              transition: 'all 0.3s ease'
            }}>
              <div style={{
                width: '20px',
                height: '20px',
                backgroundColor: 'white',
                borderRadius: '50%',
                position: 'absolute',
                top: '2px',
                left: joinMode === 'name' ? '2px' : '22px',
                transition: 'left 0.3s ease',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
              }} />
            </div>

            <span style={{
              color: joinMode === 'name' ? 'white' : 'rgba(255, 255, 255, 0.5)',
              fontWeight: joinMode === 'name' ? '600' : '400',
              fontSize: '0.9rem',
              transition: 'all 0.2s ease'
            }}>
              {t('viewer.name')}
            </span>
          </div>

          {/* PIN Input */}
          {joinMode === 'pin' && (
            <div style={{ width: '100%', maxWidth: '320px' }}>
              <div style={{
                textAlign: 'center'
              }}>
                {/* PIN Input - Individual Boxes */}
                <div
                  onClick={() => {
                    const input = document.querySelector('input[name="pin-input"]');
                    if (input) input.focus();
                  }}
                  style={{
                    display: 'flex',
                    gap: '12px',
                    justifyContent: 'center',
                    cursor: 'text',
                    direction: 'ltr'
                  }}
                >
                  {[0, 1, 2, 3].map((index) => {
                    const isActive = index === pin.length && pin.length < 4;
                    const isFilled = !!pin[index];
                    return (
                      <div
                        key={index}
                        style={{
                          width: '60px',
                          height: '70px',
                          background: isActive ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                          backdropFilter: 'blur(10px)',
                          border: isActive ? '2px solid rgba(255, 255, 255, 0.6)' : '2px solid rgba(255, 255, 255, 0.2)',
                          borderRadius: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '2rem',
                          fontWeight: '600',
                          color: 'white',
                          letterSpacing: '0',
                          transition: 'all 0.3s ease',
                          boxShadow: isActive ? '0 0 25px rgba(255, 255, 255, 0.3)' : (isFilled ? '0 0 20px rgba(255, 255, 255, 0.2)' : 'none'),
                          transform: isFilled ? 'scale(1.05)' : 'scale(1)',
                          cursor: 'text'
                        }}
                      >
                        {pin[index] || ''}
                      </div>
                    );
                  })}
                </div>

                {/* Hidden actual input - auto-joins when 4 chars entered */}
                <input
                  type="text"
                  name="pin-input"
                  value={pin}
                  onChange={(e) => {
                    const newValue = e.target.value.toUpperCase();
                    setPin(newValue);
                    // Auto-join when 4 characters are entered
                    if (newValue.length === 4) {
                      setError('');
                      socketService.viewerJoinRoom(newValue);
                    }
                  }}
                  maxLength={4}
                  style={{
                    position: 'absolute',
                    opacity: 0,
                    pointerEvents: 'none',
                    width: '0',
                    height: '0',
                    overflow: 'hidden'
                  }}
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* Room Name Search Form */}
          {joinMode === 'name' && (
            <Form onSubmit={handleJoinByName} style={{ width: '100%', maxWidth: '320px' }}>
              <div style={{
                marginBottom: '20px',
                textAlign: 'center'
              }}>
                {/* Search Input - Glassmorphic style matching code boxes */}
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder={t('viewer.typeRoomName')}
                    value={roomSearch}
                    onChange={(e) => handleRoomSearch(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'rgba(255, 255, 255, 0.08)',
                      backdropFilter: 'blur(10px)',
                      border: '2px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '12px',
                      padding: '18px 20px',
                      color: 'white',
                      fontSize: '1.2rem',
                      fontWeight: '500',
                      textAlign: 'center',
                      letterSpacing: '1px',
                      outline: 'none',
                      transition: 'all 0.3s ease',
                      boxShadow: roomSearch ? '0 0 20px rgba(255, 255, 255, 0.2)' : 'none'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                      e.target.style.boxShadow = '0 0 20px rgba(255, 255, 255, 0.2)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                      if (!roomSearch) e.target.style.boxShadow = 'none';
                    }}
                    autoFocus
                  />
                  {searchLoading && (
                    <div style={{
                      position: 'absolute',
                      right: '16px',
                      top: '50%',
                      transform: 'translateY(-50%)'
                    }}>
                      <Spinner animation="border" size="sm" variant="light" />
                    </div>
                  )}
                </div>

                {/* Search Results - Click to join directly */}
                {searchResults.length > 0 && (
                  <div style={{
                    marginTop: '12px',
                    background: 'rgba(0, 0, 0, 0.5)',
                    borderRadius: '12px',
                    overflow: 'hidden'
                  }}>
                    {searchResults.map((room) => (
                      <div
                        key={room.id}
                        onClick={() => {
                          if (room.isLive) {
                            socketService.viewerJoinRoomBySlug(room.slug);
                          } else {
                            setError(`"${room.name}" ${t('viewer.roomNotLive')}`);
                          }
                        }}
                        style={{
                          padding: '12px 16px',
                          cursor: room.isLive ? 'pointer' : 'not-allowed',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          backgroundColor: 'transparent',
                          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                          transition: 'background-color 0.2s',
                          opacity: room.isLive ? 1 : 0.6
                        }}
                        onMouseEnter={(e) => {
                          if (room.isLive) {
                            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <span style={{ color: 'white', fontWeight: '500' }}>{room.name}</span>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          backgroundColor: room.isLive ? '#28a745' : '#6c757d',
                          color: 'white'
                        }}>
                          {room.isLive ? t('viewer.liveJoin') : t('viewer.offline')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {roomSearch.length >= 2 && !searchLoading && searchResults.length === 0 && (
                  <div style={{
                    marginTop: '12px',
                    color: 'rgba(255, 255, 255, 0.6)',
                    fontSize: '0.9rem'
                  }}>
                    {t('viewer.noRoomsFound')}
                  </div>
                )}
              </div>
            </Form>
          )}
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
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes slideUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @keyframes slideDown {
          from {
            transform: translateY(0);
            opacity: 1;
          }
          to {
            transform: translateY(100%);
            opacity: 0;
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
        title={t('viewer.displaySettings')}
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
        title={isFullscreen ? t('viewer.exitFullscreen') : t('viewer.enterFullscreen')}
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
          {t('viewer.displaySettings')}
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
            {t('viewer.fontSize')}
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
              {t('viewer.resetTo100')}
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
            {t('viewer.textColor')}
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
            {showColorPicker ? t('viewer.hide') : t('viewer.customColor')}
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

        {/* Display Toggles */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{
            color: 'white',
            fontSize: '0.9rem',
            marginBottom: '10px',
            display: 'block',
            fontWeight: '500'
          }}>
            {t('viewer.showHideLines')}
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div
              onClick={() => setShowOriginal(!showOriginal)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                backgroundColor: showOriginal ? 'rgba(40, 167, 69, 0.3)' : 'rgba(255,255,255,0.1)',
                borderRadius: '8px',
                cursor: 'pointer',
                border: showOriginal ? '1px solid rgba(40, 167, 69, 0.5)' : '1px solid rgba(255,255,255,0.2)',
                transition: 'all 0.2s ease'
              }}
            >
              <span style={{ color: 'white', fontSize: '0.9rem' }}>{t('viewer.originalText')}</span>
              <span style={{ color: showOriginal ? '#28a745' : '#999', fontSize: '1.2rem' }}>
                {showOriginal ? '✓' : '○'}
              </span>
            </div>
            <div
              onClick={() => setShowTransliteration(!showTransliteration)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                backgroundColor: showTransliteration ? 'rgba(40, 167, 69, 0.3)' : 'rgba(255,255,255,0.1)',
                borderRadius: '8px',
                cursor: 'pointer',
                border: showTransliteration ? '1px solid rgba(40, 167, 69, 0.5)' : '1px solid rgba(255,255,255,0.2)',
                transition: 'all 0.2s ease'
              }}
            >
              <span style={{ color: 'white', fontSize: '0.9rem' }}>{t('viewer.transliteration')}</span>
              <span style={{ color: showTransliteration ? '#28a745' : '#999', fontSize: '1.2rem' }}>
                {showTransliteration ? '✓' : '○'}
              </span>
            </div>
            <div
              onClick={() => setShowTranslation(!showTranslation)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                backgroundColor: showTranslation ? 'rgba(40, 167, 69, 0.3)' : 'rgba(255,255,255,0.1)',
                borderRadius: '8px',
                cursor: 'pointer',
                border: showTranslation ? '1px solid rgba(40, 167, 69, 0.5)' : '1px solid rgba(255,255,255,0.2)',
                transition: 'all 0.2s ease'
              }}
            >
              <span style={{ color: 'white', fontSize: '0.9rem' }}>{t('viewer.translation')}</span>
              <span style={{ color: showTranslation ? '#28a745' : '#999', fontSize: '1.2rem' }}>
                {showTranslation ? '✓' : '○'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {renderSlide()}

      {/* Announcement Overlay Banner - Bottom */}
      {(announcementBanner.visible || announcementBanner.animating === 'out') && announcementBanner.text && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          color: 'white',
          padding: '20px 40px',
          textAlign: 'center',
          fontSize: 'clamp(1.5rem, 4vw, 3rem)',
          fontWeight: '400',
          zIndex: 1000,
          animation: announcementBanner.animating === 'out'
            ? 'slideDown 0.5s ease-in forwards'
            : announcementBanner.animating === 'in'
              ? 'slideUp 0.5s ease-out'
              : 'none',
          backdropFilter: 'blur(10px)',
          borderTop: '1px solid rgba(255, 255, 255, 0.2)'
        }}>
          {announcementBanner.text}
        </div>
      )}
      </div>
    </>
  );
}

export default ViewerPage;
