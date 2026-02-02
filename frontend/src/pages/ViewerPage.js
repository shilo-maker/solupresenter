import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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

function ViewerPage({ remotePin, remoteConfig }) {
  const { t, i18n } = useTranslation();
  const location = useLocation();

  // Check if this is a local presentation window (opened via Presentation API)
  const isLocalViewer = new URLSearchParams(location.search).get('local') === 'true';

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
  const [localMedia, setLocalMedia] = useState(null); // For local media (Base64 images)
  const [localVideo, setLocalVideo] = useState(null); // For local video (Base64 from presenter)
  const localVideoRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [toolsData, setToolsData] = useState(null); // For tools display (countdown, clock, stopwatch, announcement)
  const [presentationData, setPresentationData] = useState(null); // For presentation slides
  const [renderedHtml, setRenderedHtml] = useState(null); // Mirrored HTML from desktop SlideRenderer
  const [renderedHtmlDimensions, setRenderedHtmlDimensions] = useState(null);
  const [countdownMessageKey, setCountdownMessageKey] = useState(0); // For triggering message update animation
  const prevCountdownMessageRef = useRef('');
  // Announcement animation state
  const [announcementBanner, setAnnouncementBanner] = useState({ visible: false, text: '', animating: false });
  const [localMediaOverlay, setLocalMediaOverlay] = useState(false);
  // Rotating messages state (for desktop app format: type: 'rotatingMessages' with messages array)
  const [rotatingMessageIndex, setRotatingMessageIndex] = useState(0);
  const rotatingMessagesIntervalRef = useRef(null);
  const announcementHideTimerRef = useRef(null);
  const announcementAnimTimerRef = useRef(null);

  // YouTube state
  const [youtubeVideoId, setYoutubeVideoId] = useState(null);
  const youtubePlayerRef = useRef(null);
  const youtubeReadyRef = useRef(false);
  const [youtubeAPIReady, setYoutubeAPIReady] = useState(false);
  const youtubePlayingRef = useRef(false); // Ref to avoid stale closure in sync handler
  const currentPinRef = useRef(null); // Store current room pin for YouTube ready callback

  // Helper function to properly clean up YouTube player before state change
  const cleanupYoutubePlayer = useCallback(() => {
    if (youtubePlayerRef.current) {
      try {
        if (youtubePlayerRef.current.destroy) {
          youtubePlayerRef.current.destroy();
        }
      } catch (e) {
        // YouTube player cleanup error (safe to ignore)
      }
      youtubePlayerRef.current = null;
      youtubeReadyRef.current = false;
    }
    setYoutubeVideoId(null);
    youtubePlayingRef.current = false;
  }, []);

  // Theme state - use initialTheme from remoteConfig if provided (for custom remote screens)
  const [viewerTheme, setViewerTheme] = useState(remoteConfig?.initialTheme || null);
  const [bibleTheme, setBibleTheme] = useState(null);
  const [prayerTheme, setPrayerTheme] = useState(null);
  const hasFixedTheme = !!remoteConfig?.initialTheme;

  // Update theme when remoteConfig.initialTheme changes (for custom remote screens)
  const initialThemeId = remoteConfig?.initialTheme?.id;
  useEffect(() => {
    if (remoteConfig?.initialTheme) {
      setViewerTheme(remoteConfig.initialTheme);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialThemeId]);

  // Viewport size tracking for scaled rendering (throttled to ~60fps like desktop)
  const [viewportSize, setViewportSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    let resizeTimeout = null;
    const handleResize = () => {
      if (resizeTimeout) return;
      resizeTimeout = setTimeout(() => {
        setViewportSize({ width: window.innerWidth, height: window.innerHeight });
        resizeTimeout = null;
      }, 16);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimeout) clearTimeout(resizeTimeout);
    };
  }, []);

  // Viewer display toggles
  const [showOriginal, setShowOriginal] = useState(true);
  const [showTransliteration, setShowTransliteration] = useState(true);
  const [showTranslation, setShowTranslation] = useState(true);

  // Load YouTube IFrame API
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setYoutubeAPIReady(true);
      return;
    }

    // Define the callback that YouTube API calls when ready
    window.onYouTubeIframeAPIReady = () => {
      setYoutubeAPIReady(true);
    };

    // Load the script if not already present
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }
  }, []);

  // Initialize YouTube player when video loads and API is ready
  useEffect(() => {
    if (youtubeVideoId && youtubeAPIReady) {
      youtubeReadyRef.current = false;
      youtubePlayerRef.current = new window.YT.Player('youtube-player', {
        videoId: youtubeVideoId,
        playerVars: {
          autoplay: 1,  // Autoplay enabled
          mute: 1,      // Muted to allow autoplay
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          iv_load_policy: 3,
          playsinline: 1
        },
        events: {
          onReady: () => {
            youtubeReadyRef.current = true;
            // Signal to operator that viewer's YouTube player is ready
            if (currentPinRef.current) {
              socketService.viewerYoutubeReady(currentPinRef.current);
            }
          }
        }
      });
    }

    return () => {
      if (youtubePlayerRef.current && youtubePlayerRef.current.destroy) {
        youtubePlayerRef.current.destroy();
        youtubePlayerRef.current = null;
      }
    };
  }, [youtubeVideoId, youtubeAPIReady]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- INACTIVITY_TIMEOUT is a constant that never changes
  }, [joined]);

  // Tools: desktop sends pre-formatted strings (remaining, time, date) every second — no local timers needed

  // Detect countdown message changes and trigger animation
  useEffect(() => {
    const currentMessage = (toolsData?.type === 'countdown' ? toolsData?.message : '') || '';
    if (currentMessage && currentMessage !== prevCountdownMessageRef.current) {
      // Message changed - trigger animation by updating key
      setCountdownMessageKey(prev => prev + 1);
    }
    prevCountdownMessageRef.current = currentMessage;
  }, [toolsData?.type, toolsData?.message]);

  // Stopwatch: desktop sends pre-formatted 'time' string every 100ms, no local timer needed

  // Announcement banner animation effect
  // Desktop sends flat: { type: 'announcement', active: true/false, text: '...' }
  useEffect(() => {
    // Clear any pending animation timer on each run
    if (announcementAnimTimerRef.current) {
      clearTimeout(announcementAnimTimerRef.current);
      announcementAnimTimerRef.current = null;
    }

    if (toolsData?.type === 'announcement') {
      const isActive = toolsData.active;
      const text = toolsData.text || '';
      if (isActive && text) {
        // Show banner with slide-up animation
        setAnnouncementBanner({ visible: true, text, animating: 'in' });
        announcementAnimTimerRef.current = setTimeout(() => {
          setAnnouncementBanner(prev => prev.animating === 'in' ? { ...prev, animating: false } : prev);
          announcementAnimTimerRef.current = null;
        }, 500);
      } else if (!isActive) {
        // Hide banner with slide-down animation
        setAnnouncementBanner(prev => {
          if (!prev.visible) return prev;
          return { ...prev, animating: 'out' };
        });
        announcementAnimTimerRef.current = setTimeout(() => {
          setAnnouncementBanner({ visible: false, text: '', animating: false });
          announcementAnimTimerRef.current = null;
        }, 500);
      }
    } else {
      // Tool type changed away from announcement - hide immediately
      setAnnouncementBanner(prev => {
        if (!prev.visible) return prev;
        return { visible: false, text: '', animating: false };
      });
    }

    return () => {
      if (announcementAnimTimerRef.current) {
        clearTimeout(announcementAnimTimerRef.current);
        announcementAnimTimerRef.current = null;
      }
    };
    // Only depend on toolsData changes, not announcementBanner (avoids circular deps)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolsData?.type, toolsData?.active, toolsData?.text]);

  // Handle rotating messages (desktop app format: type: 'rotatingMessages' with messages array)
  useEffect(() => {
    if (toolsData?.type === 'rotatingMessages' && toolsData?.active && toolsData?.messages?.length > 0) {
      // Clear any existing interval
      if (rotatingMessagesIntervalRef.current) {
        clearInterval(rotatingMessagesIntervalRef.current);
      }
      // Reset index when messages change
      setRotatingMessageIndex(0);
      // Set up rotation interval
      const intervalMs = (toolsData.interval || 5) * 1000;
      rotatingMessagesIntervalRef.current = setInterval(() => {
        setRotatingMessageIndex(prev => (prev + 1) % toolsData.messages.length);
      }, intervalMs);
    } else {
      // Clear interval if not active
      if (rotatingMessagesIntervalRef.current) {
        clearInterval(rotatingMessagesIntervalRef.current);
        rotatingMessagesIntervalRef.current = null;
      }
    }
    return () => {
      if (rotatingMessagesIntervalRef.current) {
        clearInterval(rotatingMessagesIntervalRef.current);
      }
    };
  }, [toolsData?.type, toolsData?.active, toolsData?.messages, toolsData?.interval]);

  useEffect(() => {
    socketService.connect();

    // Subscribe to connection status changes
    const unsubscribe = socketService.onConnectionStatusChange((status, currentLatency) => {
      setConnectionStatus(status);
      setLatency(currentLatency);
    });

    // Set up event listeners first
    socketService.onViewerJoined(async (data) => {
      lastActivityRef.current = Date.now(); // Reset inactivity timer
      setJoined(true);
      // Store room pin for YouTube ready callback
      if (data.roomPin) {
        currentPinRef.current = data.roomPin;
      }

      // Set the room background
      setBackgroundImage(data.backgroundImage || '');

      // Capture mirrored HTML from desktop
      setRenderedHtml(data.renderedHtml || null);
      setRenderedHtmlDimensions(data.renderedHtmlDimensions || null);

      // Handle all possible current slide states
      if (data.presentationData) {
        // Presentation slide (bypasses theme)
        setPresentationData(data.presentationData);
        setCurrentSlide(null);
        setImageUrl(null);
      } else if (data.isBlank) {
        // Blank slide
        setPresentationData(null);
        setCurrentSlide({ isBlank: true });
        setImageUrl(null);
      } else if (data.imageUrl) {
        // Image-only slide
        setPresentationData(null);
        setImageUrl(data.imageUrl);
        setCurrentSlide(null);
      } else if (data.slideData) {
        // Regular text slide
        setPresentationData(null);
        setCurrentSlide(data.slideData);
        setImageUrl(null);
      } else {
        // No active slide yet
        setPresentationData(null);
        setCurrentSlide(null);
        setImageUrl(null);
      }

      // Set display mode if available
      if (data.currentSlide?.displayMode) {
        setDisplayMode(data.currentSlide.displayMode);
      }

      // Handle theme data for new viewers (skip if using fixed theme from remote config)
      if (data.theme && !hasFixedTheme) {
        setViewerTheme(data.theme);
      }
      if (data.bibleTheme && !hasFixedTheme) {
        setBibleTheme(data.bibleTheme);
      }
      if (data.prayerTheme && !hasFixedTheme) {
        setPrayerTheme(data.prayerTheme);
      }

      // Handle tools data for new viewers
      // Desktop sends flat tool data: { type, active, remaining/time/text/... }
      if (data.toolsData) {
        setToolsData(data.toolsData);
      }

      // Handle local media active status for new viewers
      if (data.localMediaActive) {
        setLocalMediaOverlay(true);
      }

      setError('');
    });

    socketService.onSlideUpdate((data) => {
      lastActivityRef.current = Date.now();

      // Clear YouTube video when presenting any other content (destroy player first to avoid React DOM errors)
      cleanupYoutubePlayer();

      // Handle tools data
      if (data.toolsData) {
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

        // Tool data is flat from desktop: { type, active, remaining/time/text/... }
        // No additional sync needed — desktop sends updates every second
      } else if (data.presentationData) {
        // Handle presentation slides (bypass theme)
        setPresentationData(data.presentationData);
        setCurrentSlide(null);
        setImageUrl(null);
        setLocalMedia(null);
        // Preserve announcement overlays
        setToolsData(prev => prev?.type === 'announcement' ? prev : null);
      } else if (data.localMedia) {
        // Handle local media (Base64 images from operator)
        setPresentationData(null);
        setLocalMedia(data.localMedia);
        setCurrentSlide(null);
        setImageUrl(null);
        // Preserve announcement overlays
        setToolsData(prev => prev?.type === 'announcement' ? prev : null);
      } else if (data.isBlank) {
        setPresentationData(null);
        setCurrentSlide({ isBlank: true });
        setImageUrl(null);
        setLocalMedia(null);
        // Preserve announcement overlays when going to blank
        setToolsData(prev => prev?.type === 'announcement' ? prev : null);
      } else if (data.imageUrl) {
        setPresentationData(null);
        setImageUrl(data.imageUrl);
        setCurrentSlide(null);
        setLocalMedia(null);
        // Preserve announcement overlays when showing images
        setToolsData(prev => prev?.type === 'announcement' ? prev : null);
      } else {
        setPresentationData(null);
        setCurrentSlide(data.slideData);
        setImageUrl(null);
        setLocalMedia(null);
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
      // Reset to join screen
      setJoined(false);
      setCurrentSlide(null);
      setImageUrl(null);
      setBackgroundImage('');
      setPin('');
      setRoomSearch('');
      setSearchResults([]);
      setSelectedRoom(null);
      setViewerTheme(null);
      setBibleTheme(null);
      setPrayerTheme(null);
      setError(tRef.current('viewer.sessionEnded'));
    });

    // Handle theme updates from operator (skip if using fixed theme from remote config)
    socketService.onThemeUpdate((data) => {
      if (!hasFixedTheme) {
        setViewerTheme(data.theme);
      }
    });

    // Handle Bible theme updates from operator
    socketService.onBibleThemeUpdate((data) => {
      if (!hasFixedTheme) {
        setBibleTheme(data.theme);
      }
    });

    // Handle Prayer theme updates from operator
    socketService.onPrayerThemeUpdate((data) => {
      if (!hasFixedTheme) {
        setPrayerTheme(data.theme);
      }
    });

    // Handle local media status (show overlay when operator displays local media on HDMI)
    socketService.onLocalMediaStatus((data) => {
      setLocalMediaOverlay(data.visible);
    });

    // Handle standalone tool updates from operator (countdown, clock, stopwatch, announcement, rotatingMessages)
    // Desktop sends flat data: { type, active, remaining/time/text/message/... }
    socketService.onToolsUpdate((toolData) => {
      // Cancel any pending announcement hide timer
      if (announcementHideTimerRef.current) {
        clearTimeout(announcementHideTimerRef.current);
        announcementHideTimerRef.current = null;
      }

      if (toolData && toolData.type && toolData.active) {
        setToolsData(toolData);
      } else if (toolData && !toolData.active) {
        if (toolData.type === 'announcement') {
          // Keep data so the announcement effect can trigger the hide animation
          setToolsData(toolData);
          // Clear after animation completes, but only if no new tool replaced it
          announcementHideTimerRef.current = setTimeout(() => {
            setToolsData(prev => {
              // Only clear if still showing the deactivated announcement
              if (prev && prev.type === 'announcement' && !prev.active) return null;
              return prev;
            });
            announcementHideTimerRef.current = null;
          }, 600);
        } else {
          setToolsData(null);
        }
      }
    });

    // Rendered HTML from desktop (arrives separately after display window renders)
    socketService.onRenderedHtmlUpdate((data) => {
      setRenderedHtml(data.renderedHtml || null);
      setRenderedHtmlDimensions(data.renderedHtmlDimensions || null);
    });

    // YouTube socket listeners
    socketService.onYoutubeLoad((data) => {
      setYoutubeVideoId(data.videoId);
      // Clear other content
      setCurrentSlide(null);
      setImageUrl(null);
      setPresentationData(null);
      setToolsData(null);
      setRenderedHtml(null);
      setRenderedHtmlDimensions(null);
    });

    socketService.onYoutubePlay((data) => {
      youtubePlayingRef.current = true;
      if (youtubePlayerRef.current && youtubeReadyRef.current) {
        youtubePlayerRef.current.seekTo(data.currentTime, true);
        youtubePlayerRef.current.playVideo();
      }
    });

    socketService.onYoutubePause(() => {
      youtubePlayingRef.current = false;
      if (youtubePlayerRef.current && youtubeReadyRef.current) {
        youtubePlayerRef.current.pauseVideo();
      }
    });

    socketService.onYoutubeSeek((data) => {
      if (youtubePlayerRef.current && youtubeReadyRef.current) {
        const currentPlayerTime = youtubePlayerRef.current.getCurrentTime();
        // Only seek if more than 1 second off to avoid stuttering
        if (Math.abs(currentPlayerTime - data.currentTime) > 1) {
          youtubePlayerRef.current.seekTo(data.currentTime, true);
        }
      }
    });

    socketService.onYoutubeStop(() => {
      cleanupYoutubePlayer();
    });

    socketService.onYoutubeSync((data) => {
      if (youtubePlayerRef.current && youtubeReadyRef.current) {
        const currentPlayerTime = youtubePlayerRef.current.getCurrentTime();
        // Only sync if more than 2 seconds off
        if (Math.abs(currentPlayerTime - data.currentTime) > 2) {
          youtubePlayerRef.current.seekTo(data.currentTime, true);
        }
        // Use ref instead of state to avoid stale closure
        if (data.isPlaying && !youtubePlayingRef.current) {
          youtubePlayerRef.current.playVideo();
          youtubePlayingRef.current = true;
        } else if (!data.isPlaying && youtubePlayingRef.current) {
          youtubePlayerRef.current.pauseVideo();
          youtubePlayingRef.current = false;
        }
      }
    });

    // Check if PIN or room name is in URL query params and auto-join
    const params = new URLSearchParams(location.search);
    const urlPin = params.get('pin');
    const urlRoom = params.get('room');
    const isLocalViewer = params.get('local') === 'true';

    // Local display mode - Presentation API opens in fullscreen automatically
    if (isLocalViewer) {
      // Set up Presentation API receiver to listen for video data from presenter
      if (navigator.presentation && navigator.presentation.receiver) {
        let videoChunks = [];
        let videoMeta = null;

        navigator.presentation.receiver.connectionList.then((connectionList) => {
          const handleConnection = (connection) => {

            connection.onmessage = (event) => {
              try {
                const data = JSON.parse(event.data);

                if (data.type === 'videoStart') {
                  videoChunks = [];
                  videoMeta = data;
                } else if (data.type === 'videoChunk') {
                  videoChunks[data.chunkIndex] = data.data;
                } else if (data.type === 'videoEnd') {

                  // Convert Base64 chunks back to Uint8Array
                  const allChunks = [];
                  for (let i = 0; i < videoChunks.length; i++) {
                    const binary = atob(videoChunks[i]);
                    const bytes = new Uint8Array(binary.length);
                    for (let j = 0; j < binary.length; j++) {
                      bytes[j] = binary.charCodeAt(j);
                    }
                    allChunks.push(bytes);
                  }

                  // Combine into single Uint8Array
                  const totalLength = allChunks.reduce((sum, arr) => sum + arr.length, 0);
                  const combined = new Uint8Array(totalLength);
                  let offset = 0;
                  for (const chunk of allChunks) {
                    combined.set(chunk, offset);
                    offset += chunk.length;
                  }

                  // Create blob and URL
                  const blob = new Blob([combined], { type: videoMeta?.mimeType || 'video/mp4' });
                  const blobUrl = URL.createObjectURL(blob);

                  setLocalVideo({
                    data: blobUrl,
                    fileName: videoMeta?.fileName || 'video',
                    mimeType: videoMeta?.mimeType || 'video/mp4'
                  });
                  setCurrentSlide(null);
                  setLocalMedia(null);

                  // Clean up
                  videoChunks = [];
                  videoMeta = null;
                } else if (data.type === 'stopLocalVideo') {
                  setLocalVideo(null);
                } else if (data.type === 'videoPause') {
                  if (localVideoRef.current) {
                    localVideoRef.current.pause();
                  }
                } else if (data.type === 'videoPlay') {
                  if (localVideoRef.current) {
                    localVideoRef.current.play().catch(() => {});
                  }
                } else if (data.type === 'videoSeek') {
                  if (localVideoRef.current) {
                    localVideoRef.current.currentTime = data.time;
                  }
                } else if (data.type === 'videoVolume') {
                  if (localVideoRef.current) {
                    localVideoRef.current.volume = data.volume;
                    localVideoRef.current.muted = false;
                  }
                } else if (data.type === 'videoMute') {
                  if (localVideoRef.current) {
                    localVideoRef.current.muted = data.muted;
                  }
                } else if (data.type === 'showImage') {
                  setLocalMedia({
                    type: 'image',
                    data: data.data,
                    fileName: data.fileName
                  });
                  setLocalVideo(null); // Hide any video
                  setCurrentSlide(null);
                } else if (data.type === 'hideImage') {
                  setLocalMedia(null);
                }
              } catch (err) {
                console.error('📺 Failed to parse presentation message:', err);
              }
            };
          };

          // Handle existing connections
          connectionList.connections.forEach(handleConnection);

          // Handle new connections
          connectionList.onconnectionavailable = (event) => {
            handleConnection(event.connection);
          };
        }).catch(() => {
          // Presentation receiver not available
        });
      }
    }

    // Check for remotePin prop first (from RemoteScreen component)
    if (remotePin) {
      setPin(remotePin.toUpperCase());
      setTimeout(() => {
        socketService.viewerJoinRoom(remotePin.toUpperCase());
      }, 500);
    } else if (urlRoom) {
      // Auto-join by room name (slug)
      setJoinMode('name');
      setRoomSearch(urlRoom);
      // Auto-join with the room slug from URL after a short delay to ensure socket is connected
      setTimeout(() => {
        socketService.viewerJoinRoomBySlug(urlRoom.toLowerCase());
      }, 500);
    } else if (urlPin) {
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
      // Clear any pending announcement timers
      if (announcementHideTimerRef.current) {
        clearTimeout(announcementHideTimerRef.current);
        announcementHideTimerRef.current = null;
      }
    };
  }, [location.search, remotePin, hasFixedTheme, cleanupYoutubePlayer]);

  // Read video from IndexedDB and create a local blob URL
  const loadVideoFromIndexedDB = () => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('solupresenter-videos', 1);

      request.onerror = () => reject(request.error);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('videos')) {
          db.createObjectStore('videos', { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction(['videos'], 'readonly');
        const store = transaction.objectStore('videos');
        const getRequest = store.get('current-video');

        getRequest.onsuccess = () => {
          db.close();
          if (getRequest.result) {
            const { data, fileName, mimeType, timestamp } = getRequest.result;
            // Create a blob URL from the ArrayBuffer
            const blob = new Blob([data], { type: mimeType });
            const blobUrl = URL.createObjectURL(blob);
            resolve({ blobUrl, fileName, mimeType, timestamp });
          } else {
            reject(new Error('No video found in IndexedDB'));
          }
        };

        getRequest.onerror = () => {
          db.close();
          reject(getRequest.error);
        };
      };
    });
  };

  // Listen for local video from presenter (via IndexedDB polling - most reliable for Presentation API)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const isLocalViewer = params.get('local') === 'true';

    if (!isLocalViewer) return;

    let lastVideoTimestamp = 0;
    let pollInterval = null;

    const checkForNewVideo = async () => {
      try {
        const videoData = await loadVideoFromIndexedDB();
        // Check if this is a new video (different timestamp)
        if (videoData.timestamp && videoData.timestamp > lastVideoTimestamp) {
          lastVideoTimestamp = videoData.timestamp;
          setLocalVideo({
            data: videoData.blobUrl,
            fileName: videoData.fileName,
            mimeType: videoData.mimeType
          });
          // Clear other content to show video
          setCurrentSlide(null);
          setLocalMedia(null);
        }
      } catch (err) {
        // No video in IndexedDB - this is normal for Presentation API viewers
      }
    };

    // Also listen for localStorage changes as backup (works for separate tabs)
    const handleStorageChange = async (event) => {
      if (event.key !== 'solupresenter-local-video') return;

      if (!event.newValue) {
        setLocalVideo(null);
        return;
      }

      try {
        const data = JSON.parse(event.newValue);
        if (data.type === 'localVideo') {
          await checkForNewVideo();
        } else if (data.type === 'stopLocalVideo') {
          setLocalVideo(null);
        }
      } catch (err) {
        console.error('Failed to parse storage event:', err);
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Check immediately on mount
    checkForNewVideo();

    // Poll every 500ms for new videos (reliable for Presentation API windows)
    pollInterval = setInterval(checkForNewVideo, 500);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      if (pollInterval) clearInterval(pollInterval);
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

  // Helper to render countdown (used standalone or under announcement overlay)
  // Desktop sends flat: { type: 'countdown', active: true, remaining: '04:30', message: '...', messageTranslation: '...' }
  const renderCountdown = () => {
    const message = toolsData?.message || '';
    const messageTranslation = toolsData?.messageTranslation || '';
    const remaining = toolsData?.remaining || '00:00';
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
              animation: 'messageUpdate 0.5s ease-out, breathing 3s ease-in-out 0.5s infinite',
              direction: 'rtl'
            }}>
            {message}
          </div>
        )}
        {messageTranslation && (
          <div style={{
            fontSize: 'clamp(1.5rem, 3.5vw, 3rem)',
            fontWeight: '300',
            fontFamily: "'Montserrat', sans-serif",
            marginBottom: '0.5em',
            lineHeight: '1',
            opacity: 0.8,
            textShadow: '2px 2px 8px rgba(0, 0, 0, 0.8)'
          }}>
            {messageTranslation}
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
          {remaining}
        </div>
      </div>
    );
  };

  // Theme styling helper functions
  const buildThemeTextShadow = (style) => {
    if (!style?.textShadowColor && style?.textShadowBlur === undefined
        && style?.textShadowOffsetX === undefined && style?.textShadowOffsetY === undefined) {
      return undefined; // No theme shadow configured, let caller use its default
    }
    const color = style.textShadowColor || 'rgba(0,0,0,0.8)';
    const blur = style.textShadowBlur ?? 4;
    const ox = style.textShadowOffsetX ?? 2;
    const oy = style.textShadowOffsetY ?? 2;
    return `${ox}px ${oy}px ${blur}px ${color}`;
  };

  const buildThemeTextStroke = (style) => {
    if (!style?.textStrokeWidth) return undefined;
    return `${style.textStrokeWidth}px ${style.textStrokeColor || '#000000'}`;
  };

  // Compute the active theme based on content type (Bible/Prayer themes override viewer theme)
  const activeTheme = useMemo(() => {
    if (currentSlide?.isBible && bibleTheme) return bibleTheme;
    if (currentSlide?.isPrayer && prayerTheme) return prayerTheme;
    return viewerTheme;
  }, [currentSlide?.isBible, currentSlide?.isPrayer, bibleTheme, prayerTheme, viewerTheme]);

  const getThemeLineStyle = (lineType) => {
    if (!activeTheme?.lineStyles?.[lineType]) {
      return {};
    }
    const style = activeTheme.lineStyles[lineType];
    const result = {
      fontSize: style.fontSize ? `${style.fontSize}%` : undefined,
      fontWeight: style.fontWeight || undefined,
      color: style.color || undefined,
      opacity: style.opacity !== undefined ? style.opacity : undefined
    };
    const shadow = buildThemeTextShadow(style);
    if (shadow) result.textShadow = shadow;
    const stroke = buildThemeTextStroke(style);
    if (stroke) {
      result.WebkitTextStroke = stroke;
      result.paintOrder = 'stroke fill';
    }
    return result;
  };

  const isLineVisible = (lineType) => {
    if (!activeTheme?.lineStyles?.[lineType]) {
      return true; // Default visible
    }
    return activeTheme.lineStyles[lineType].visible !== false;
  };

  const getThemePositioningStyle = () => {
    if (!activeTheme?.positioning) {
      return {
        alignItems: 'center',
        justifyContent: 'center'
      };
    }
    const { vertical, horizontal } = activeTheme.positioning;
    return {
      alignItems: horizontal === 'left' ? 'flex-start' : horizontal === 'right' ? 'flex-end' : 'center',
      justifyContent: vertical === 'top' ? 'flex-start' : vertical === 'bottom' ? 'flex-end' : 'center'
    };
  };

  const getThemeContainerStyle = () => {
    if (!activeTheme?.container) {
      return {
        padding: '2vh 6vw'
      };
    }
    const { maxWidth, padding, backgroundColor, borderRadius } = activeTheme.container;
    return {
      maxWidth: maxWidth || '100%',
      padding: padding || '2vh 6vw',
      backgroundColor: backgroundColor || 'transparent',
      borderRadius: borderRadius || '0px'
    };
  };

  // Get background style based on theme viewerBackground settings
  const getViewerBackgroundStyle = () => {
    const themeType = activeTheme?.viewerBackground?.type;
    const themeColor = activeTheme?.viewerBackground?.color;
    const isGradient = backgroundImage && backgroundImage.startsWith('linear-gradient');

    // Default (inherit) - use room's background
    if (!themeType || themeType === 'inherit') {
      return {
        background: backgroundImage
          ? (isGradient ? backgroundImage : `url(${getFullImageUrl(backgroundImage)})`)
          : 'linear-gradient(-45deg, #0a0a0a, #1a1a2e, #16161d, #1f1f1f, #1a1a2e, #0a0a0a)',
        backgroundSize: backgroundImage ? 'cover' : '400% 400%',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        animation: backgroundImage ? 'none' : 'gradientShift 20s ease infinite'
      };
    }

    // Transparent - for OBS overlays
    if (themeType === 'transparent') {
      return {
        background: 'transparent',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        animation: 'none'
      };
    }

    // Solid color from theme
    if (themeType === 'color' && themeColor) {
      return {
        background: themeColor,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        animation: 'none'
      };
    }

    // Fallback to default
    return {
      background: 'linear-gradient(-45deg, #0a0a0a, #1a1a2e, #16161d, #1f1f1f, #1a1a2e, #0a0a0a)',
      backgroundSize: '400% 400%',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      animation: 'gradientShift 20s ease infinite'
    };
  };

  // Render slide content with WYSIWYG absolute positioning (when linePositions is set)
  const renderWithAbsolutePositioning = (slide, isTransliterationLanguage, getTextDirection) => {
    // Reference dimensions from theme (matching desktop SlideRenderer)
    const refWidth = activeTheme?.canvasDimensions?.width || 1920;
    const refHeight = activeTheme?.canvasDimensions?.height || 1080;
    const scale = Math.min(viewportSize.width / refWidth, viewportSize.height / refHeight);
    const scaledWidth = refWidth * scale;
    const scaledHeight = refHeight * scale;

    // Desktop-matching pixel font size: 5% of refHeight at fontSize=100
    const getPixelFontSize = (lineType, themeLineStyle) => {
      const baseFontSize = refHeight * 0.05; // 54px at 1080p
      const themeFontScale = themeLineStyle.fontSize ? parseFloat(themeLineStyle.fontSize) / 100 : 1;
      return baseFontSize * themeFontScale;
    };

    // Get text content for each line type (including reference lines and Bible/Prayer aliases)
    const getTextForLine = (lineType) => {
      if (lineType === 'original' || lineType === 'hebrew') return slide.originalText;
      if (lineType === 'transliteration') return slide.transliteration;
      if (lineType === 'translation' || lineType === 'english') return slide.translation;
      if (lineType === 'reference') return slide.reference;
      if (lineType === 'referenceEnglish') return slide.referenceEnglish;
      if (lineType === 'referenceTranslation') return slide.referenceTranslation;
      return null;
    };

    // Check if line should be shown (viewer toggle + theme visibility + has content)
    const shouldShowLine = (lineType) => {
      const text = getTextForLine(lineType);
      if (!text) return false;
      if (!isLineVisible(lineType)) return false;
      if ((lineType === 'original' || lineType === 'hebrew') && !showOriginal) return false;
      if (lineType === 'transliteration' && !showTransliteration) return false;
      if ((lineType === 'translation' || lineType === 'english') && !showTranslation) return false;
      return true;
    };

    return (
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        position: 'relative'
      }}>
        {/* Scaled wrapper matching desktop SlideRenderer pattern */}
        <div style={{
          width: scaledWidth,
          height: scaledHeight,
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Full-size content at reference resolution, scaled down with transform */}
          <div style={{
            width: refWidth,
            height: refHeight,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            position: 'absolute',
            top: 0,
            left: 0
          }}>
            {/* Render background boxes (behind text) */}
            {(activeTheme?.backgroundBoxes || []).map((box, index) => (
              <div
                key={box.id || `box-${index}`}
                style={{
                  position: 'absolute',
                  left: `${box.x}%`,
                  top: `${box.y}%`,
                  width: `${box.width}%`,
                  height: `${box.height}%`,
                  backgroundColor: box.color || '#000000',
                  opacity: box.opacity !== undefined ? box.opacity : 0.5,
                  borderRadius: box.borderRadius ? `${box.borderRadius}px` : '0px',
                  zIndex: 1
                }}
              />
            ))}

            {/* Render each line with absolute positioning (including reference lines from Bible/Prayer themes) */}
            {(activeTheme?.lineOrder || ['original', 'transliteration', 'translation']).map((lineType) => {
              if (!shouldShowLine(lineType)) return null;

              // Look up position: check linePositions first, then theme's top-level reference positions
              let position = activeTheme.linePositions?.[lineType];
              if (!position && lineType === 'reference') position = activeTheme?.referencePosition;
              if (!position && lineType === 'referenceEnglish') position = activeTheme?.referenceEnglishPosition;
              if (!position && lineType === 'referenceTranslation') position = activeTheme?.referenceTranslationPosition;
              if (!position) return null;

              // Look up style: check lineStyles first, then theme's top-level reference styles
              let themeLineStyle = getThemeLineStyle(lineType);
              if (Object.keys(themeLineStyle).length === 0) {
                let refStyle = null;
                if (lineType === 'reference') refStyle = activeTheme?.referenceStyle;
                if (lineType === 'referenceEnglish') refStyle = activeTheme?.referenceEnglishStyle;
                if (lineType === 'referenceTranslation') refStyle = activeTheme?.referenceTranslationStyle;
                if (refStyle) {
                  const result = {
                    fontSize: refStyle.fontSize ? `${refStyle.fontSize}%` : undefined,
                    fontWeight: refStyle.fontWeight || undefined,
                    color: refStyle.color || undefined,
                    opacity: refStyle.opacity !== undefined ? refStyle.opacity : undefined
                  };
                  const shadow = buildThemeTextShadow(refStyle);
                  if (shadow) result.textShadow = shadow;
                  const stroke = buildThemeTextStroke(refStyle);
                  if (stroke) {
                    result.WebkitTextStroke = stroke;
                    result.paintOrder = 'stroke fill';
                  }
                  themeLineStyle = result;
                  // Check visibility
                  if (refStyle.visible === false) return null;
                }
              }

              const text = getTextForLine(lineType);
              const overflowText = lineType === 'translation' ? slide.translationOverflow : null;

              // Get alignment values (default to center)
              const alignH = position.alignH || 'center';
              const alignV = position.alignV || 'center';
              const alignItemsValue = alignH === 'left' ? 'flex-start' : alignH === 'right' ? 'flex-end' : 'center';
              const justifyContentValue = alignV === 'top' ? 'flex-start' : alignV === 'bottom' ? 'flex-end' : 'center';

              // Support autoHeight and flow mode (matching desktop SlideRenderer)
              const useAutoHeight = position.autoHeight === true || position.positionMode === 'flow';

              // Build border styles for reference lines
              const isReferenceLine = lineType === 'reference' || lineType === 'referenceEnglish' || lineType === 'referenceTranslation';
              const borderStyles = {};
              if (isReferenceLine) {
                const refStyle = lineType === 'reference' ? activeTheme?.referenceStyle
                  : lineType === 'referenceEnglish' ? activeTheme?.referenceEnglishStyle
                  : activeTheme?.referenceTranslationStyle;
                if (refStyle) {
                  const borderColor = refStyle.borderColor || '#ffffff';
                  if (refStyle.borderTop) borderStyles.borderTop = `${refStyle.borderTop}px solid ${borderColor}`;
                  if (refStyle.borderBottom) borderStyles.borderBottom = `${refStyle.borderBottom}px solid ${borderColor}`;
                  if (refStyle.borderLeft) borderStyles.borderLeft = `${refStyle.borderLeft}px solid ${borderColor}`;
                  if (refStyle.borderRight) borderStyles.borderRight = `${refStyle.borderRight}px solid ${borderColor}`;
                  if (refStyle.backgroundColor) borderStyles.backgroundColor = refStyle.backgroundColor;
                  if (refStyle.borderRadius) borderStyles.borderRadius = `${refStyle.borderRadius}px`;
                }
              }

              return (
                <div
                  key={lineType}
                  style={{
                    position: 'absolute',
                    left: `${position.x}%`,
                    top: `${position.y}%`,
                    width: `${position.width}%`,
                    height: useAutoHeight ? 'auto' : `${position.height}%`,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: alignItemsValue,
                    justifyContent: justifyContentValue,
                    paddingTop: position.paddingTop ? `${position.paddingTop}%` : undefined,
                    paddingBottom: position.paddingBottom ? `${position.paddingBottom}%` : undefined,
                    paddingLeft: position.paddingLeft ? `${position.paddingLeft}px` : undefined,
                    paddingRight: position.paddingRight ? `${position.paddingRight}px` : undefined,
                    boxSizing: 'border-box',
                    fontSize: `${getPixelFontSize(lineType, themeLineStyle)}px`,
                    lineHeight: 1.35,
                    fontWeight: themeLineStyle.fontWeight || '400',
                    color: themeLineStyle.color || textColor,
                    opacity: themeLineStyle.opacity !== undefined ? themeLineStyle.opacity : 1,
                    textShadow: themeLineStyle.textShadow || '3px 3px 8px rgba(0, 0, 0, 0.9), -2px -2px 4px rgba(0, 0, 0, 0.7), 0 0 20px rgba(0, 0, 0, 0.5)',
                    WebkitTextStroke: themeLineStyle.WebkitTextStroke,
                    direction: getTextDirection(text),
                    unicodeBidi: 'plaintext',
                    textAlign: alignH,
                    overflow: useAutoHeight ? 'visible' : 'hidden',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    zIndex: isReferenceLine ? 10 : 2,
                    ...borderStyles
                  }}
                >
                  <span style={{ display: 'block', width: '100%' }}>{text}</span>
                  {overflowText && <span style={{ display: 'block', width: '100%', marginTop: '0.2em' }}>{overflowText}</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderSlide = () => {
    // Handle tools display (except announcements which are overlays)
    if (toolsData && toolsData.type !== 'announcement') {
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

      // Clock display — desktop sends { type: 'clock', active: true, time: '10:30:00', date: '...', format: '24h' }
      if (toolsData.type === 'clock') {
        return (
          <div style={toolsStyle}>
            <div style={{
              fontSize: 'clamp(4rem, 15vw, 12rem)',
              fontWeight: '200',
              fontFamily: 'monospace',
              letterSpacing: '0.05em',
              textShadow: '3px 3px 10px rgba(0, 0, 0, 0.9)'
            }}>
              {toolsData.time || '--:--:--'}
            </div>
            {toolsData.date && (
              <div style={{
                fontSize: 'clamp(1.5rem, 3vw, 2.5rem)',
                fontWeight: '300',
                marginTop: '20px',
                textShadow: '2px 2px 6px rgba(0, 0, 0, 0.8)'
              }}>
                {toolsData.date}
              </div>
            )}
          </div>
        );
      }

      // Stopwatch display — desktop sends { type: 'stopwatch', active: true, time: '00:05.3', running: true }
      if (toolsData.type === 'stopwatch') {
        return (
          <div style={toolsStyle}>
            <div style={{
              fontSize: 'clamp(4rem, 15vw, 12rem)',
              fontWeight: '200',
              fontFamily: 'monospace',
              letterSpacing: '0.05em',
              textShadow: '3px 3px 10px rgba(0, 0, 0, 0.9)'
            }}>
              {toolsData.time || '00:00.0'}
            </div>
            {toolsData.running !== undefined && (
              <div style={{
                fontSize: 'clamp(0.8rem, 2vw, 1.2rem)',
                fontWeight: '300',
                marginTop: '10px',
                opacity: 0.6,
                textShadow: '1px 1px 4px rgba(0, 0, 0, 0.8)'
              }}>
                {toolsData.running ? 'RUNNING' : 'PAUSED'}
              </div>
            )}
          </div>
        );
      }

      // Rotating message display (legacy single message format)
      if (toolsData.type === 'rotatingMessage') {
        const text = toolsData.text || '';
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

      // Rotating messages display (desktop app format: array of messages)
      if (toolsData.type === 'rotatingMessages' && toolsData.messages?.length > 0) {
        const currentMessage = toolsData.messages[rotatingMessageIndex % toolsData.messages.length];
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
              textShadow: '3px 3px 10px rgba(0, 0, 0, 0.9)',
              textAlign: 'center'
            }}>
              {currentMessage}
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

    // Handle local video (Base64 video from operator's device via postMessage/Presentation API)
    if (localVideo) {
      return (
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#000'
        }}>
          <video
            ref={localVideoRef}
            src={localVideo.data}
            loop
            playsInline
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain'
            }}
            onLoadedData={() => {}}
            onError={(e) => console.error('🎬 Local video error:', e.target.error)}
          />
        </div>
      );
    }

    // Handle local media (Base64 image from operator's device)
    if (localMedia) {
      if (localMedia.type === 'image') {
        return (
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <img
              src={localMedia.data}
              alt={localMedia.fileName || 'Local image'}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain'
              }}
            />
          </div>
        );
      }
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

    // Render YouTube video
    if (youtubeVideoId) {
      return (
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#000'
        }}>
          <div id="youtube-player" style={{ width: '100%', height: '100%' }} />
        </div>
      );
    }

    // Render mirrored HTML from desktop SlideRenderer (pixel-perfect match)
    if (renderedHtml) {
      const refW = renderedHtmlDimensions?.width || 1920;
      const refH = renderedHtmlDimensions?.height || 1080;
      const scale = Math.min(viewportSize.width / refW, viewportSize.height / refH);
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <div style={{ width: refW * scale, height: refH * scale, position: 'relative', overflow: 'hidden' }}>
            <div
              style={{ width: refW, height: refH, transform: `scale(${scale})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0, fontFamily: "'Heebo', 'Segoe UI', sans-serif" }}
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
          </div>
        </div>
      );
    }

    // Render presentation slide (bypasses theme)
    if (presentationData && presentationData.slide) {
      const { slide, canvasDimensions } = presentationData;
      // Calculate container dimensions to fit 16:9 in viewport
      const vpWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
      const vpHeight = typeof window !== 'undefined' ? window.innerHeight : 1080;
      const targetRatio = (canvasDimensions?.width || 1920) / (canvasDimensions?.height || 1080);
      const vpRatio = vpWidth / vpHeight;

      // If viewport is wider than target ratio, height is the constraint
      // If viewport is narrower, width is the constraint
      const containerWidth = vpRatio > targetRatio ? vpHeight * targetRatio : vpWidth;
      const containerHeight = vpRatio > targetRatio ? vpHeight : vpWidth / targetRatio;

      return (
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#000'
        }}>
          <div style={{
            position: 'relative',
            width: `${containerWidth}px`,
            height: `${containerHeight}px`,
            background: slide.backgroundColor || '#000',
          }}>
            {/* Render text boxes */}
            {slide.textBoxes?.map((tb) => (
              <div
                key={tb.id}
                style={{
                  position: 'absolute',
                  left: `${tb.x}%`,
                  top: `${tb.y}%`,
                  width: `${tb.width}%`,
                  height: `${tb.height}%`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: tb.textAlign === 'left' ? 'flex-start'
                    : tb.textAlign === 'right' ? 'flex-end' : 'center',
                  justifyContent: tb.verticalAlign === 'top' ? 'flex-start'
                    : tb.verticalAlign === 'bottom' ? 'flex-end' : 'center',
                  padding: '0.5%',
                  boxSizing: 'border-box',
                  backgroundColor: tb.backgroundColor || 'transparent',
                  opacity: tb.opacity !== undefined ? tb.opacity : 1,
                  overflow: 'hidden'
                }}
              >
                <div style={{
                  fontSize: `${(tb.fontSize || 100) / 100 * 4}vw`,
                  fontWeight: tb.bold ? 'bold' : (tb.fontWeight || '400'),
                  fontStyle: tb.italic ? 'italic' : 'normal',
                  textDecoration: tb.underline ? 'underline' : 'none',
                  color: tb.color || '#FFFFFF',
                  textAlign: tb.textAlign || 'center',
                  textShadow: '2px 2px 8px rgba(0, 0, 0, 0.8)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  width: '100%'
                }}>
                  {tb.text || ''}
                </div>
              </div>
            ))}
          </div>
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

    // Use WYSIWYG absolute positioning if linePositions is set
    if (activeTheme?.linePositions) {
      return renderWithAbsolutePositioning(slide, isTransliterationLanguage, getTextDirection);
    }

    // Get theme positioning and container styles
    const positioningStyle = getThemePositioningStyle();
    const containerStyle = getThemeContainerStyle();

    return (
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        ...positioningStyle,
        ...containerStyle,
        color: textColor,
        textAlign: activeTheme?.positioning?.horizontal === 'left' ? 'left' :
                   activeTheme?.positioning?.horizontal === 'right' ? 'right' : 'center',
        boxSizing: 'border-box',
        position: 'relative'
      }}>
        {/* Bible Reference Label - Top Left (only for Bible verses, when no theme positioning) */}
        {isBible && slide.reference && !activeTheme?.referencePosition && (
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
            textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
            zIndex: 10
          }}>
            <div style={{ direction: 'rtl', width: '100%' }}>
              {slide.reference}
            </div>
            {displayMode === 'bilingual' && slide.referenceEnglish && (
              <div>
                {slide.referenceEnglish}
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
                gap: 'clamp(0.5rem, 2vh, 1.5rem)',
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
                      textShadow: buildThemeTextShadow(activeTheme?.lineStyles?.original) || '3px 3px 8px rgba(0, 0, 0, 0.9), -2px -2px 4px rgba(0, 0, 0, 0.7), 0 0 20px rgba(0, 0, 0, 0.5)',
                      WebkitTextStroke: buildThemeTextStroke(activeTheme?.lineStyles?.original),
                      paintOrder: 'stroke fill',
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
                textShadow: buildThemeTextShadow(activeTheme?.lineStyles?.original) || '3px 3px 8px rgba(0, 0, 0, 0.9), -2px -2px 4px rgba(0, 0, 0, 0.7), 0 0 20px rgba(0, 0, 0, 0.5)',
                WebkitTextStroke: buildThemeTextStroke(activeTheme?.lineStyles?.original),
                direction: getTextDirection(slide.originalText),
                unicodeBidi: 'plaintext',
                textAlign: isBible ? 'right' : 'center'
              }}>
                {slide.originalText}
              </div>
            )
          )
        ) : (
          // Bilingual mode - render lines according to theme order (respects viewer toggles + theme visibility)
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'clamp(1rem, 3vh, 3rem)',
            width: '100%',
            maxWidth: '100%'
          }}>
            {/* Render lines in theme-specified order */}
            {(activeTheme?.lineOrder || ['original', 'transliteration', 'translation']).map((lineType) => {
              // Get theme styles for this line
              const themeLineStyle = getThemeLineStyle(lineType);
              const themeVisible = isLineVisible(lineType);

              if (lineType === 'original') {
                // Original Text / Lyrics
                if (!showOriginal || !themeVisible) return null;
                const baseFontSize = isTransliterationLanguage
                  ? 'clamp(2rem, 6vw, 6rem)'
                  : 'clamp(1.8rem, 5vw, 5rem)';
                const themeFontScale = themeLineStyle.fontSize ? parseFloat(themeLineStyle.fontSize) / 100 : 1;
                return (
                  <div key="original" style={{
                    fontSize: `calc(${baseFontSize} * ${fontSize / 100} * ${themeFontScale})`,
                    lineHeight: 1.4,
                    fontWeight: themeLineStyle.fontWeight || (isTransliterationLanguage ? '500' : '400'),
                    width: '100%',
                    wordWrap: 'break-word',
                    overflowWrap: 'break-word',
                    color: themeLineStyle.color || textColor,
                    opacity: themeLineStyle.opacity !== undefined ? themeLineStyle.opacity : 1,
                    textShadow: themeLineStyle.textShadow || '3px 3px 8px rgba(0, 0, 0, 0.9), -2px -2px 4px rgba(0, 0, 0, 0.7), 0 0 20px rgba(0, 0, 0, 0.5)',
                    WebkitTextStroke: themeLineStyle.WebkitTextStroke,
                    direction: getTextDirection(slide.originalText),
                    unicodeBidi: 'plaintext',
                    textAlign: isBible ? 'right' : 'center'
                  }}>
                    {slide.originalText}
                  </div>
                );
              }

              if (lineType === 'transliteration') {
                // Transliteration / Lyrics continued
                if (!showTransliteration || !themeVisible || !slide.transliteration) return null;
                const baseFontSize = isTransliterationLanguage
                  ? 'clamp(1.5rem, 4.5vw, 4.5rem)'
                  : 'clamp(1.8rem, 5vw, 5rem)';
                const themeFontScale = themeLineStyle.fontSize ? parseFloat(themeLineStyle.fontSize) / 100 : 1;
                return (
                  <div key="transliteration" style={{
                    fontSize: `calc(${baseFontSize} * ${fontSize / 100} * ${themeFontScale})`,
                    lineHeight: 1.4,
                    fontWeight: themeLineStyle.fontWeight || '400',
                    width: '100%',
                    wordWrap: 'break-word',
                    overflowWrap: 'break-word',
                    color: themeLineStyle.color || textColor,
                    opacity: themeLineStyle.opacity !== undefined ? themeLineStyle.opacity : (isTransliterationLanguage ? 0.95 : 1),
                    textShadow: themeLineStyle.textShadow || '3px 3px 8px rgba(0, 0, 0, 0.9), -2px -2px 4px rgba(0, 0, 0, 0.7), 0 0 20px rgba(0, 0, 0, 0.5)',
                    WebkitTextStroke: themeLineStyle.WebkitTextStroke,
                    direction: getTextDirection(slide.transliteration),
                    unicodeBidi: 'plaintext'
                  }}>
                    {slide.transliteration}
                  </div>
                );
              }

              if (lineType === 'translation') {
                // Translation / Lyrics continued (with overflow line)
                if (!showTranslation || !themeVisible || !slide.translation) return null;
                const baseFontSize = isTransliterationLanguage
                  ? 'clamp(1.5rem, 4.5vw, 4.5rem)'
                  : 'clamp(1.8rem, 5vw, 5rem)';
                const themeFontScale = themeLineStyle.fontSize ? parseFloat(themeLineStyle.fontSize) / 100 : 1;
                return (
                  <div key="translation" style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: slide.translationOverflow ? 'clamp(0.1rem, 0.3vh, 0.3rem)' : '0',
                    width: '100%'
                  }}>
                    <div style={{
                      fontSize: `calc(${baseFontSize} * ${fontSize / 100} * ${themeFontScale})`,
                      lineHeight: 1.4,
                      fontWeight: themeLineStyle.fontWeight || '400',
                      width: '100%',
                      wordWrap: 'break-word',
                      overflowWrap: 'break-word',
                      color: themeLineStyle.color || (isBible ? '#FFD700' : textColor),
                      opacity: themeLineStyle.opacity !== undefined ? themeLineStyle.opacity : (isTransliterationLanguage ? 0.95 : 1),
                      textShadow: themeLineStyle.textShadow || '3px 3px 8px rgba(0, 0, 0, 0.9), -2px -2px 4px rgba(0, 0, 0, 0.7), 0 0 20px rgba(0, 0, 0, 0.5)',
                      WebkitTextStroke: themeLineStyle.WebkitTextStroke,
                      direction: getTextDirection(slide.translation),
                      unicodeBidi: 'plaintext',
                      textAlign: isBible ? 'left' : 'center'
                    }}>
                      {slide.translation}
                    </div>

                    {slide.translationOverflow && (
                      <div style={{
                        fontSize: `calc(${baseFontSize} * ${fontSize / 100} * ${themeFontScale})`,
                        lineHeight: 1.4,
                        fontWeight: themeLineStyle.fontWeight || '400',
                        width: '100%',
                        wordWrap: 'break-word',
                        overflowWrap: 'break-word',
                        color: themeLineStyle.color || (isBible ? '#FFD700' : textColor),
                        opacity: themeLineStyle.opacity !== undefined ? themeLineStyle.opacity : (isTransliterationLanguage ? 0.95 : 1),
                        textShadow: themeLineStyle.textShadow || '3px 3px 8px rgba(0, 0, 0, 0.9), -2px -2px 4px rgba(0, 0, 0, 0.7), 0 0 20px rgba(0, 0, 0, 0.5)',
                        WebkitTextStroke: themeLineStyle.WebkitTextStroke,
                        direction: getTextDirection(slide.translationOverflow),
                        unicodeBidi: 'plaintext',
                        textAlign: isBible ? 'left' : 'center'
                      }}>
                        {slide.translationOverflow}
                      </div>
                    )}
                  </div>
                );
              }

              return null;
            })}
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

  // Get theme-aware background style
  const viewerBackgroundStyle = getViewerBackgroundStyle();

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
          ...viewerBackgroundStyle,
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
              <span style={{ color: showOriginal ? '#10b981' : '#71717a', fontSize: '1.2rem' }}>
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
              <span style={{ color: showTransliteration ? '#10b981' : '#71717a', fontSize: '1.2rem' }}>
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
              <span style={{ color: showTranslation ? '#10b981' : '#71717a', fontSize: '1.2rem' }}>
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

      {/* Local Media Overlay - shown to remote viewers when operator displays local media on HDMI */}
      {/* Don't show on local presentation window since it's actually displaying the media */}
      {localMediaOverlay && !isLocalViewer && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          color: 'white',
          textAlign: 'center',
          padding: '20px'
        }}>
          <svg width="80" height="80" viewBox="0 0 16 16" fill="currentColor" style={{ marginBottom: '20px', opacity: 0.7 }}>
            <path d="M0 5a2 2 0 0 1 2-2h7.5a2 2 0 0 1 1.983 1.738l3.11-1.382A1 1 0 0 1 16 4.269v7.462a1 1 0 0 1-1.406.913l-3.111-1.382A2 2 0 0 1 9.5 13H2a2 2 0 0 1-2-2V5z"/>
          </svg>
          <div style={{ fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', fontWeight: '300', marginBottom: '10px' }}>
            {t('viewer.localMediaShowing', 'Local media is being displayed')}
          </div>
          <div style={{ fontSize: 'clamp(1rem, 2.5vw, 1.5rem)', opacity: 0.7 }}>
            {t('viewer.resumingSoon', 'Resuming shortly...')}
          </div>
        </div>
      )}
      </div>
    </>
  );
}

export default ViewerPage;
