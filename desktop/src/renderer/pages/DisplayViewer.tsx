import React, { useState, useEffect, useRef } from 'react';
import SlideRenderer from '../components/SlideRenderer';

// YouTube IFrame API types
declare global {
  interface Window {
    YT: {
      Player: new (element: HTMLElement | string, options: any) => any;
      PlayerState: {
        UNSTARTED: number;
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady: () => void;
  }
}

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
}

interface PresentationSlide {
  id: string;
  order: number;
  textBoxes: PresentationTextBox[];
  imageBoxes?: PresentationImageBox[];
  backgroundColor?: string;
}

interface LinePosition {
  x: number;
  y: number;
  width: number;
  height: number;
  paddingTop: number;
  paddingBottom: number;
  alignH: 'left' | 'center' | 'right';
  alignV: 'top' | 'center' | 'bottom';
}

interface BackgroundBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  opacity: number;
  borderRadius: number;
}

interface Theme {
  lineOrder?: string[];
  lineStyles?: Record<string, any>;
  positioning?: { vertical?: string; horizontal?: string };
  container?: Record<string, any>;
  viewerBackground?: { type?: string; color?: string };
  // Visual theme editor properties
  linePositions?: Record<string, LinePosition> | null;
  backgroundBoxes?: BackgroundBox[] | null;
  canvasDimensions?: { width: number; height: number };
}

interface ToolData {
  type: 'countdown' | 'announcement' | 'rotatingMessages' | 'clock' | 'stopwatch';
  active: boolean;
  remaining?: string;
  message?: string;
  text?: string;
  messages?: string[];
  interval?: number;
  time?: string;
  date?: string;
  format?: '12h' | '24h';
  running?: boolean;
}

const DisplayViewer: React.FC = () => {
  const [slideData, setSlideData] = useState<SlideData | null>(null);
  const [combinedSlides, setCombinedSlides] = useState<SlideData[] | null>(null);
  const [displayMode, setDisplayMode] = useState<string>('bilingual');
  const [isBlank, setIsBlank] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState<string>('');
  const [theme, setTheme] = useState<Theme | null>(null);
  const [presentationSlide, setPresentationSlide] = useState<PresentationSlide | null>(null);

  // Media state
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [mediaPath, setMediaPath] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement>(null);

  // Tools state
  const [countdown, setCountdown] = useState<{ active: boolean; remaining: string; message: string }>({
    active: false,
    remaining: '',
    message: ''
  });
  const [announcement, setAnnouncement] = useState<{ active: boolean; text: string }>({
    active: false,
    text: ''
  });
  const [rotatingMessages, setRotatingMessages] = useState<{ active: boolean; messages: string[]; interval: number; currentIndex: number }>({
    active: false,
    messages: [],
    interval: 5,
    currentIndex: 0
  });
  const rotatingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clock state
  const [clock, setClock] = useState<{ active: boolean; time: string; date: string }>({
    active: false,
    time: '',
    date: ''
  });

  // Stopwatch state
  const [stopwatch, setStopwatch] = useState<{ active: boolean; time: string; running: boolean }>({
    active: false,
    time: '00:00.0',
    running: false
  });

  // YouTube state
  const [youtubeVideoId, setYoutubeVideoId] = useState<string | null>(null);
  const [youtubeTitle, setYoutubeTitle] = useState<string>('');
  const youtubeContainerRef = useRef<HTMLDivElement>(null);
  const youtubePlayerRef = useRef<any>(null);
  const youtubeReadyRef = useRef(false);

  useEffect(() => {
    // Report ready
    console.log('[DisplayViewer] Component mounted, calling reportReady()');
    window.displayAPI.reportReady();

    // Listen for slide updates
    const slideCleanup = window.displayAPI.onSlideUpdate((data) => {
      console.log('Slide update received:', data);

      if (data.isBlank) {
        setIsBlank(true);
        setMediaType(null);
        setCombinedSlides(null);
        setPresentationSlide(null);
        setYoutubeVideoId(null); // Clear YouTube when going blank
      } else {
        setIsBlank(false);
        // Handle presentation slides (with textbox styling)
        if (data.presentationSlide) {
          setPresentationSlide(data.presentationSlide);
          setSlideData(null); // Clear song slide data
          setMediaType(null);
          setYoutubeVideoId(null); // Clear YouTube when showing presentation
        } else if (data.slideData) {
          setSlideData(data.slideData);
          setPresentationSlide(null); // Clear presentation slide
          setMediaType(null);
          setYoutubeVideoId(null); // Clear YouTube when showing slides
        }
        if (data.displayMode) {
          setDisplayMode(data.displayMode);
        }
        // Update background if explicitly provided (including empty string to clear)
        console.log('[Viewer] backgroundImage in slide data:', data.backgroundImage, 'undefined?', data.backgroundImage === undefined);
        if (data.backgroundImage !== undefined) {
          console.log('[Viewer] Setting background to:', data.backgroundImage?.substring(0, 50));
          setBackgroundImage(data.backgroundImage);
        }
        // Apply activeTheme if included (for content-type specific themes like bible)
        if (data.activeTheme) {
          console.log('[Viewer] Applying active theme from slide:', data.activeTheme?.name, 'contentType:', data.contentType);
          setTheme(data.activeTheme);
        }
        // Handle combined slides for original-only mode
        if (data.combinedSlides && data.combinedSlides.length > 1) {
          setCombinedSlides(data.combinedSlides);
        } else {
          setCombinedSlides(null);
        }
      }
    });

    // Listen for media updates
    const mediaCleanup = window.displayAPI.onMediaUpdate((data) => {
      console.log('Media update received:', data);
      if (!data.path) {
        // Clear media
        setMediaType(null);
        setMediaPath('');
        return;
      }
      setMediaType(data.type);
      // Path already includes protocol (media://...) so use it directly
      setMediaPath(data.path.startsWith('media://') ? data.path : `media://${data.path}`);
      setIsBlank(false);
      setYoutubeVideoId(null); // Clear YouTube when showing media
    });

    // Listen for video commands
    const videoCleanup = window.displayAPI.onVideoCommand((command) => {
      console.log('Video command received:', command);
      const video = videoRef.current;
      if (!video) return;

      switch (command.type) {
        case 'play':
          if (command.path) {
            setMediaType('video');
            setMediaPath(`media://${command.path}`);
          }
          video.play().catch(console.error);
          break;
        case 'pause':
          video.pause();
          break;
        case 'resume':
          video.play().catch(console.error);
          break;
        case 'seek':
          if (typeof command.time === 'number') {
            video.currentTime = command.time;
          }
          break;
        case 'stop':
          video.pause();
          video.currentTime = 0;
          setMediaType(null);
          break;
        case 'mute':
          video.muted = command.muted ?? true;
          break;
        case 'volume':
          if (typeof command.volume === 'number') {
            video.volume = Math.max(0, Math.min(1, command.volume));
          }
          break;
      }
    });

    // Listen for theme updates (songs theme)
    const themeCleanup = window.displayAPI.onThemeUpdate((newTheme) => {
      console.log('Theme update received:', newTheme);
      setTheme(newTheme);
    });

    // Listen for bible theme updates (also applies to current display if showing bible content)
    const bibleThemeCleanup = window.displayAPI.onBibleThemeUpdate((newTheme) => {
      console.log('Bible theme update received:', newTheme);
      // Apply immediately - the viewer will use this theme when showing bible content
      setTheme(newTheme);
    });

    // Listen for prayer theme updates (applies when showing prayer/sermon content)
    const prayerThemeCleanup = window.displayAPI.onPrayerThemeUpdate((newTheme) => {
      console.log('Prayer theme update received:', newTheme);
      // Apply immediately - the viewer will use this theme when showing prayer content
      setTheme(newTheme);
    });

    // Listen for background updates
    const backgroundCleanup = window.displayAPI.onBackgroundUpdate((background: string) => {
      console.log('Background update received:', background);
      console.log('Is gradient:', background?.startsWith('linear-gradient') || background?.startsWith('radial-gradient'));
      setBackgroundImage(background);
    });

    // Listen for YouTube commands
    const youtubeCleanup = window.displayAPI.onYoutubeCommand((command) => {
      console.log('YouTube command received:', command);

      switch (command.type) {
        case 'load':
          setYoutubeVideoId(command.videoId);
          setYoutubeTitle(command.title || 'YouTube Video');
          // Clear other media when YouTube loads
          setMediaType(null);
          setMediaPath('');
          setIsBlank(false);
          youtubeReadyRef.current = false;
          break;
        case 'stop':
          setYoutubeVideoId(null);
          setYoutubeTitle('');
          youtubeReadyRef.current = false;
          if (youtubePlayerRef.current) {
            try {
              youtubePlayerRef.current.destroy();
            } catch (e) {
              // Ignore
            }
            youtubePlayerRef.current = null;
          }
          break;
        case 'play':
          if (youtubePlayerRef.current && youtubeReadyRef.current) {
            youtubePlayerRef.current.seekTo(command.currentTime, true);
            youtubePlayerRef.current.playVideo();
          }
          break;
        case 'pause':
          if (youtubePlayerRef.current && youtubeReadyRef.current) {
            youtubePlayerRef.current.pauseVideo();
          }
          break;
        case 'seek':
          if (youtubePlayerRef.current && youtubeReadyRef.current) {
            youtubePlayerRef.current.seekTo(command.currentTime, true);
          }
          break;
        case 'sync':
          if (youtubePlayerRef.current && youtubeReadyRef.current) {
            const currentTime = youtubePlayerRef.current.getCurrentTime();
            // Only seek if drift is more than 0.3 seconds for tighter sync
            if (Math.abs(currentTime - command.currentTime) > 0.3) {
              youtubePlayerRef.current.seekTo(command.currentTime, true);
            }
            // Sync play/pause state
            const playerState = youtubePlayerRef.current.getPlayerState();
            const isCurrentlyPlaying = playerState === window.YT?.PlayerState?.PLAYING;
            if (command.isPlaying && !isCurrentlyPlaying) {
              youtubePlayerRef.current.playVideo();
            } else if (!command.isPlaying && isCurrentlyPlaying) {
              youtubePlayerRef.current.pauseVideo();
            }
          }
          break;
      }
    });

    // Listen for tool updates
    const toolCleanup = window.displayAPI.onToolUpdate((toolData: ToolData) => {
      console.log('Tool update received:', toolData);

      if (toolData.type === 'countdown') {
        setCountdown({
          active: toolData.active,
          remaining: toolData.remaining || '',
          message: toolData.message || ''
        });
      } else if (toolData.type === 'announcement') {
        setAnnouncement({
          active: toolData.active,
          text: toolData.text || ''
        });
      } else if (toolData.type === 'rotatingMessages') {
        if (toolData.active && toolData.messages && toolData.messages.length > 0) {
          setRotatingMessages({
            active: true,
            messages: toolData.messages,
            interval: toolData.interval || 5,
            currentIndex: 0
          });
        } else {
          setRotatingMessages(prev => ({ ...prev, active: false }));
        }
      } else if (toolData.type === 'clock') {
        setClock({
          active: toolData.active,
          time: toolData.time || '',
          date: toolData.date || ''
        });
      } else if (toolData.type === 'stopwatch') {
        setStopwatch({
          active: toolData.active,
          time: toolData.time || '00:00.0',
          running: toolData.running || false
        });
      }
    });

    return () => {
      slideCleanup();
      mediaCleanup();
      videoCleanup();
      themeCleanup();
      bibleThemeCleanup();
      prayerThemeCleanup();
      backgroundCleanup();
      youtubeCleanup();
      toolCleanup();
    };
  }, []);

  // Load YouTube IFrame API
  useEffect(() => {
    if (!window.YT && !document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }
  }, []);

  // Create YouTube player when video ID changes
  useEffect(() => {
    if (!youtubeVideoId || !youtubeContainerRef.current) {
      return;
    }

    const createPlayer = () => {
      if (!window.YT || !window.YT.Player || !youtubeContainerRef.current) {
        setTimeout(createPlayer, 100);
        return;
      }

      // Destroy existing player
      if (youtubePlayerRef.current) {
        try {
          youtubePlayerRef.current.destroy();
        } catch (e) {
          // Ignore
        }
      }

      // Clear container
      youtubeContainerRef.current.innerHTML = '';

      youtubePlayerRef.current = new window.YT.Player(youtubeContainerRef.current, {
        videoId: youtubeVideoId,
        playerVars: {
          autoplay: 0, // Don't autoplay - wait for sync
          mute: 1, // Muted - audio comes from preview
          rel: 0,
          modestbranding: 1,
          controls: 0,
          showinfo: 0,
          enablejsapi: 1,
          origin: window.location.origin,
          widget_referrer: window.location.href
        },
        events: {
          onReady: async () => {
            console.log('[DisplayViewer] YouTube player ready, requesting position sync');
            youtubeReadyRef.current = true;
            // Request current position from preview and sync immediately
            try {
              const pos = await window.displayAPI.getYoutubePosition();
              if (pos && youtubePlayerRef.current) {
                console.log('[DisplayViewer] Syncing YouTube to position:', pos.time, 'playing:', pos.isPlaying);
                youtubePlayerRef.current.seekTo(pos.time, true);
                if (pos.isPlaying) {
                  youtubePlayerRef.current.playVideo();
                }
              }
            } catch (err) {
              console.error('[DisplayViewer] Failed to get YouTube position:', err);
              // Fallback: just start playing
              youtubePlayerRef.current?.playVideo();
            }
          }
        }
      });
    };

    createPlayer();

    return () => {
      if (youtubePlayerRef.current) {
        try {
          youtubePlayerRef.current.destroy();
        } catch (e) {
          // Ignore
        }
        youtubePlayerRef.current = null;
      }
      youtubeReadyRef.current = false;
    };
  }, [youtubeVideoId]);

  // Report video time updates
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      window.displayAPI.reportVideoTime(video.currentTime, video.duration || 0);
    };

    const handleEnded = () => {
      window.displayAPI.reportVideoEnded();
    };

    const handlePlay = () => {
      window.displayAPI.reportVideoPlaying(true);
    };

    const handlePause = () => {
      window.displayAPI.reportVideoPlaying(false);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, [mediaType]);

  // Handle rotating messages interval
  useEffect(() => {
    if (rotatingMessages.active && rotatingMessages.messages.length > 1) {
      if (rotatingIntervalRef.current) {
        clearInterval(rotatingIntervalRef.current);
      }
      rotatingIntervalRef.current = setInterval(() => {
        setRotatingMessages(prev => ({
          ...prev,
          currentIndex: (prev.currentIndex + 1) % prev.messages.length
        }));
      }, rotatingMessages.interval * 1000);
    } else {
      if (rotatingIntervalRef.current) {
        clearInterval(rotatingIntervalRef.current);
        rotatingIntervalRef.current = null;
      }
    }

    return () => {
      if (rotatingIntervalRef.current) {
        clearInterval(rotatingIntervalRef.current);
      }
    };
  }, [rotatingMessages.active, rotatingMessages.messages.length, rotatingMessages.interval]);

  // Get positioning styles from theme
  const getPositioningStyle = (): React.CSSProperties => {
    const positioning = theme?.positioning || {};
    const style: React.CSSProperties = {
      display: 'flex',
      flexDirection: 'column',
      padding: theme?.container?.padding || '5vh 10vw'
    };

    // Vertical alignment
    switch (positioning.vertical) {
      case 'top':
        style.justifyContent = 'flex-start';
        break;
      case 'bottom':
        style.justifyContent = 'flex-end';
        break;
      default:
        style.justifyContent = 'center';
    }

    // Horizontal alignment
    switch (positioning.horizontal) {
      case 'left':
        style.alignItems = 'flex-start';
        style.textAlign = 'left';
        break;
      case 'right':
        style.alignItems = 'flex-end';
        style.textAlign = 'right';
        break;
      default:
        style.alignItems = 'center';
        style.textAlign = 'center';
    }

    return style;
  };

  // Get line style from theme
  const getLineStyle = (lineType: string): React.CSSProperties => {
    const lineStyles = theme?.lineStyles || {};
    const style = lineStyles[lineType] || {};

    return {
      fontSize: `${(style.fontSize || 100) / 20}vw`,
      fontWeight: style.fontWeight || '500',
      color: style.color || '#FFFFFF',
      opacity: style.opacity ?? 1,
      display: style.visible === false ? 'none' : 'block',
      marginBottom: '2vh',
      lineHeight: 1.4
    };
  };

  // Get line order from theme
  const lineOrder = theme?.lineOrder || ['original', 'transliteration', 'translation'];

  // Render lines based on display mode
  const renderLines = () => {
    if (!slideData) return null;

    // If we have combined slides (original mode with paired slides), render both
    if (combinedSlides && combinedSlides.length > 1 && displayMode === 'original') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2vh' }}>
          {combinedSlides.map((slide, idx) => (
            <div
              key={idx}
              style={{
                ...getLineStyle('original'),
                direction: 'rtl'
              }}
            >
              {slide.originalText}
            </div>
          ))}
        </div>
      );
    }

    return lineOrder.map((lineType) => {
      let content = '';
      let isRtl = false;
      let shouldShow = false;

      switch (lineType) {
        case 'original':
          content = slideData.originalText || '';
          isRtl = true;
          shouldShow = displayMode === 'bilingual' || displayMode === 'original';
          break;
        case 'transliteration':
          content = slideData.transliteration || '';
          shouldShow = displayMode === 'bilingual';
          break;
        case 'translation':
          content = slideData.translation || '';
          shouldShow = displayMode === 'bilingual' || displayMode === 'translation';
          break;
      }

      if (!content || !shouldShow) return null;

      return (
        <div
          key={lineType}
          style={{
            ...getLineStyle(lineType),
            direction: isRtl ? 'rtl' : 'ltr'
          }}
        >
          {content}
        </div>
      );
    });
  };

  // Render background boxes (for visual theme editor)
  const renderBackgroundBoxes = () => {
    if (!theme?.backgroundBoxes || theme.backgroundBoxes.length === 0) return null;

    return theme.backgroundBoxes.map((box) => (
      <div
        key={box.id}
        style={{
          position: 'absolute',
          left: `${box.x}%`,
          top: `${box.y}%`,
          width: `${box.width}%`,
          height: `${box.height}%`,
          backgroundColor: box.color,
          opacity: box.opacity,
          borderRadius: `${box.borderRadius}px`,
          zIndex: 1
        }}
      />
    ));
  };

  // Render lines with absolute positioning (for visual theme editor)
  const renderAbsoluteLines = () => {
    if (!slideData || !theme?.linePositions) return null;

    return lineOrder.map((lineType) => {
      const position = theme.linePositions![lineType];
      const style = theme?.lineStyles?.[lineType] || {};

      if (!position) return null;
      if (style.visible === false) return null;

      let content = '';
      let isRtl = false;
      let shouldShow = false;

      switch (lineType) {
        case 'original':
          content = slideData.originalText || '';
          isRtl = true;
          shouldShow = displayMode === 'bilingual' || displayMode === 'original';
          break;
        case 'transliteration':
          content = slideData.transliteration || '';
          shouldShow = displayMode === 'bilingual';
          break;
        case 'translation':
          content = slideData.translation || '';
          shouldShow = displayMode === 'bilingual' || displayMode === 'translation';
          break;
      }

      if (!content || !shouldShow) return null;

      // Calculate font size based on viewport width for consistent text wrapping
      // Using vw ensures text fits the same regardless of screen aspect ratio
      const baseFontSize = 2.8; // ~5vh equivalent in 16:9, but width-based
      const fontSize = baseFontSize * ((style.fontSize || 100) / 100);

      // Map alignment to CSS
      const justifyContent = position.alignH === 'left' ? 'flex-start' :
                            position.alignH === 'right' ? 'flex-end' : 'center';
      const alignItems = position.alignV === 'top' ? 'flex-start' :
                        position.alignV === 'bottom' ? 'flex-end' : 'center';

      return (
        <div
          key={lineType}
          style={{
            position: 'absolute',
            left: `${position.x}%`,
            top: `${position.y}%`,
            width: `${position.width}%`,
            height: `${position.height}%`,
            display: 'flex',
            justifyContent,
            alignItems,
            paddingTop: `${position.paddingTop}%`,
            paddingBottom: `${position.paddingBottom}%`,
            boxSizing: 'border-box',
            zIndex: 2
          }}
        >
          <div
            style={{
              width: '100%',
              fontSize: `${fontSize}vw`,
              fontWeight: style.fontWeight || '500',
              color: style.color || '#FFFFFF',
              opacity: style.opacity ?? 1,
              direction: isRtl ? 'rtl' : 'ltr',
              textAlign: position.alignH,
              lineHeight: 1.4
            }}
          >
            {content}
          </div>
        </div>
      );
    });
  };

  // Check if we should use absolute positioning
  const useAbsolutePositioning = theme?.linePositions !== null && theme?.linePositions !== undefined;

  // Background style
  const backgroundStyle: React.CSSProperties = {
    width: '100vw',
    height: '100vh',
    background: '#000',
    position: 'relative',
    overflow: 'hidden'
  };

  // Priority: explicit backgroundImage > theme viewerBackground > default black
  // Only use theme background if no explicit background is set
  if (backgroundImage) {
    // Check if it's a gradient (starts with 'linear-gradient' or 'radial-gradient')
    if (backgroundImage.startsWith('linear-gradient') || backgroundImage.startsWith('radial-gradient')) {
      backgroundStyle.background = backgroundImage;
    } else if (backgroundImage.startsWith('#') || backgroundImage.startsWith('rgb')) {
      // Solid color
      backgroundStyle.background = backgroundImage;
    } else {
      // Image URL
      backgroundStyle.backgroundImage = `url(${backgroundImage})`;
      backgroundStyle.backgroundSize = 'cover';
      backgroundStyle.backgroundPosition = 'center';
    }
  } else if (theme?.viewerBackground?.type === 'color' && theme.viewerBackground.color) {
    // Only use theme background when no explicit background is set
    backgroundStyle.background = theme.viewerBackground.color;
  }

  // Render countdown overlay
  const renderCountdown = () => {
    if (!countdown.active) return null;

    return (
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.9)',
        zIndex: 100
      }}>
        <div style={{
          fontSize: '15vw',
          fontWeight: 700,
          color: '#FF8C42',
          textShadow: '0 0 50px rgba(255, 140, 66, 0.5)',
          fontFamily: 'Inter, sans-serif'
        }}>
          {countdown.remaining}
        </div>
        {countdown.message && (
          <div style={{
            fontSize: '3vw',
            color: 'rgba(255, 255, 255, 0.8)',
            marginTop: '2vh'
          }}>
            {countdown.message}
          </div>
        )}
      </div>
    );
  };

  // Render announcement banner
  const renderAnnouncement = () => {
    if (!announcement.active) return null;

    return (
      <div style={{
        position: 'absolute',
        bottom: '5vh',
        left: '5vw',
        right: '5vw',
        padding: '2vh 3vw',
        background: 'linear-gradient(135deg, rgba(255, 140, 66, 0.95), rgba(244, 120, 32, 0.95))',
        borderRadius: '1vw',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
        zIndex: 90,
        animation: 'slideUp 0.5s ease'
      }}>
        <div style={{
          fontSize: '3vw',
          fontWeight: 600,
          color: 'white',
          textAlign: 'center',
          textShadow: '0 2px 10px rgba(0, 0, 0, 0.3)'
        }}>
          {announcement.text}
        </div>
        <style>{`
          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translateY(50px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}</style>
      </div>
    );
  };

  // Render rotating messages ticker
  const renderRotatingMessages = () => {
    if (!rotatingMessages.active || rotatingMessages.messages.length === 0) return null;

    const currentMessage = rotatingMessages.messages[rotatingMessages.currentIndex];

    return (
      <div style={{
        position: 'absolute',
        top: '3vh',
        left: '5vw',
        right: '5vw',
        padding: '1.5vh 3vw',
        background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.95), rgba(118, 75, 162, 0.95))',
        borderRadius: '1vw',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
        zIndex: 85,
        animation: 'fadeIn 0.5s ease'
      }}>
        <div style={{
          fontSize: '2.5vw',
          fontWeight: 600,
          color: 'white',
          textAlign: 'center',
          textShadow: '0 2px 10px rgba(0, 0, 0, 0.3)'
        }}>
          {currentMessage}
        </div>
        <style>{`
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(-20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}</style>
      </div>
    );
  };

  // Render clock overlay
  const renderClock = () => {
    if (!clock.active) return null;

    return (
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.9)',
        zIndex: 100
      }}>
        <div style={{
          fontSize: '12vw',
          fontWeight: 700,
          color: '#00d4ff',
          textShadow: '0 0 50px rgba(0, 212, 255, 0.5)',
          fontFamily: 'monospace'
        }}>
          {clock.time}
        </div>
        {clock.date && (
          <div style={{
            fontSize: '2.5vw',
            color: 'rgba(255, 255, 255, 0.7)',
            marginTop: '2vh'
          }}>
            {clock.date}
          </div>
        )}
      </div>
    );
  };

  // Render stopwatch overlay
  const renderStopwatch = () => {
    if (!stopwatch.active) return null;

    return (
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.9)',
        zIndex: 100
      }}>
        <div style={{
          fontSize: '15vw',
          fontWeight: 700,
          color: stopwatch.running ? '#00d4ff' : '#ffc107',
          textShadow: stopwatch.running ? '0 0 50px rgba(0, 212, 255, 0.5)' : '0 0 50px rgba(255, 193, 7, 0.5)',
          fontFamily: 'monospace',
          animation: stopwatch.running ? 'none' : 'pulse 1s ease-in-out infinite'
        }}>
          {stopwatch.time}
        </div>
        <div style={{
          fontSize: '2vw',
          color: 'rgba(255, 255, 255, 0.5)',
          marginTop: '2vh'
        }}>
          {stopwatch.running ? 'RUNNING' : 'PAUSED'}
        </div>
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.6; }
          }
        `}</style>
      </div>
    );
  };

  // Render blank screen (still show background)
  if (isBlank && !countdown.active && !clock.active && !stopwatch.active) {
    return (
      <div className="display-window" style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
        <SlideRenderer
          slideData={null}
          displayMode={displayMode}
          theme={theme}
          backgroundImage={backgroundImage}
          isBlank={true}
          fillContainer={true}
        />
      </div>
    );
  }

  // Render YouTube video (unless a tool is active that takes over screen)
  if (youtubeVideoId && !countdown.active && !clock.active && !stopwatch.active) {
    return (
      <div className="display-window" style={{ ...backgroundStyle, background: '#000' }}>
        <div
          ref={youtubeContainerRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%'
          }}
        />
        {renderRotatingMessages()}
        {renderAnnouncement()}
      </div>
    );
  }

  // Render video (unless a tool is active that takes over screen)
  if (mediaType === 'video' && !countdown.active && !clock.active && !stopwatch.active) {
    return (
      <div className="display-window" style={backgroundStyle}>
        <video
          ref={videoRef}
          src={mediaPath}
          className="display-video"
          autoPlay
          muted
          onLoadedData={async () => {
            // After video loads, request current position for precise sync
            console.log('[DisplayViewer] Video loaded, requesting position sync');
            try {
              const pos = await window.displayAPI.getVideoPosition();
              if (pos && videoRef.current) {
                console.log('[DisplayViewer] Syncing to position:', pos.time, 'playing:', pos.isPlaying);
                videoRef.current.currentTime = pos.time;
                if (pos.isPlaying) {
                  videoRef.current.play().catch(console.error);
                } else {
                  videoRef.current.pause();
                }
              }
            } catch (err) {
              console.error('[DisplayViewer] Failed to sync video position:', err);
            }
          }}
          onError={(e) => {
            console.error('Video error:', e);
            window.displayAPI.reportError('Video playback error');
          }}
        />
        {renderRotatingMessages()}
        {renderAnnouncement()}
      </div>
    );
  }

  // Render image (unless a tool is active that takes over screen)
  if (mediaType === 'image' && !countdown.active && !clock.active && !stopwatch.active) {
    return (
      <div className="display-window" style={backgroundStyle}>
        <img src={mediaPath} className="display-image" alt="" />
        {renderRotatingMessages()}
        {renderAnnouncement()}
      </div>
    );
  }

  // Render countdown (takes over screen)
  if (countdown.active) {
    return (
      <div className="display-window" style={{ background: '#000' }}>
        {renderCountdown()}
        {renderRotatingMessages()}
        {renderAnnouncement()}
      </div>
    );
  }

  // Render clock (takes over screen)
  if (clock.active) {
    return (
      <div className="display-window" style={{ background: '#000' }}>
        {renderClock()}
        {renderRotatingMessages()}
        {renderAnnouncement()}
      </div>
    );
  }

  // Render stopwatch (takes over screen)
  if (stopwatch.active) {
    return (
      <div className="display-window" style={{ background: '#000' }}>
        {renderStopwatch()}
        {renderRotatingMessages()}
        {renderAnnouncement()}
      </div>
    );
  }

  // Render slide content using unified SlideRenderer
  return (
    <div className="display-window" style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      <SlideRenderer
        slideData={slideData}
        displayMode={displayMode}
        theme={theme}
        backgroundImage={backgroundImage}
        isBlank={false}
        fillContainer={true}
        presentationSlide={presentationSlide}
      />
      {/* Overlay tools on top of the slide content */}
      {renderRotatingMessages()}
      {renderAnnouncement()}
    </div>
  );
};

export default DisplayViewer;
