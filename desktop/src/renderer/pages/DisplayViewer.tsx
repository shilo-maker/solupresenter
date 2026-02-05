import React, { useState, useEffect, useRef, memo, useMemo } from 'react';
import SlideRenderer from '../components/SlideRenderer';
import { useSettings } from '../contexts/SettingsContext';
import { createLogger } from '../utils/debug';

// Create logger for this module
const log = createLogger('DisplayViewer');

/**
 * Convert a media:// URL to an HTTP URL for video streaming.
 * The HTTP server handles streaming with proper range request support,
 * which works more reliably than the custom protocol for large videos.
 */
// ============ Constants ============
/** Default media load timeout in seconds (used when settings not available) */
const DEFAULT_MEDIA_LOAD_TIMEOUT_SEC = 15;
/** Threshold in seconds for video position sync (avoids micro-seeks) */
const VIDEO_SYNC_THRESHOLD_SEC = 0.5;
/** Threshold in seconds for YouTube position sync (slightly tighter than video) */
const YOUTUBE_SYNC_THRESHOLD_SEC = 0.3;

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
  originalLanguage?: string; // Song's original language - used for single-language song rendering
  reference?: string;
  referenceTranslation?: string;
  referenceEnglish?: string; // English reference for Bible themes (e.g., "Genesis 1:1")
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

type TextureType = 'none' | 'paper' | 'parchment' | 'linen' | 'canvas' | 'noise';

interface BackgroundBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  opacity: number;
  borderRadius: number;
  texture?: TextureType;
  textureOpacity?: number;
}

// CSS texture patterns (for legacy renderBackgroundBoxes - main rendering uses SlideRenderer)
const texturePatterns: Record<TextureType, { pattern: string; size: string }> = {
  none: { pattern: 'none', size: 'auto' },
  paper: {
    pattern: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='%23888'/%3E%3Ccircle cx='20' cy='30' r='3' fill='%23666'/%3E%3Ccircle cx='70' cy='15' r='2' fill='%23999'/%3E%3Ccircle cx='45' cy='60' r='4' fill='%23777'/%3E%3Ccircle cx='10' cy='80' r='2' fill='%23aaa'/%3E%3Ccircle cx='85' cy='70' r='3' fill='%23666'/%3E%3Ccircle cx='30' cy='90' r='2' fill='%23999'/%3E%3Ccircle cx='60' cy='40' r='2' fill='%23555'/%3E%3Ccircle cx='90' cy='50' r='3' fill='%23888'/%3E%3Ccircle cx='5' cy='45' r='2' fill='%23777'/%3E%3Ccircle cx='55' cy='85' r='3' fill='%23666'/%3E%3Ccircle cx='75' cy='35' r='2' fill='%23aaa'/%3E%3Ccircle cx='35' cy='10' r='2' fill='%23999'/%3E%3C/svg%3E")`,
    size: '100px 100px'
  },
  parchment: {
    pattern: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Crect width='60' height='60' fill='%23888'/%3E%3Cpath d='M0 15 Q15 12 30 15 T60 15' stroke='%23666' stroke-width='1' fill='none'/%3E%3Cpath d='M0 35 Q15 38 30 35 T60 35' stroke='%23999' stroke-width='0.8' fill='none'/%3E%3Cpath d='M0 50 Q15 47 30 50 T60 50' stroke='%23777' stroke-width='0.6' fill='none'/%3E%3Ccircle cx='10' cy='10' r='4' fill='%23777'/%3E%3Ccircle cx='45' cy='25' r='5' fill='%23999'/%3E%3Ccircle cx='25' cy='45' r='3' fill='%23666'/%3E%3C/svg%3E")`,
    size: '60px 60px'
  },
  linen: {
    pattern: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8'%3E%3Crect width='8' height='8' fill='%23888'/%3E%3Cpath d='M0 0L8 8M8 0L0 8' stroke='%23666' stroke-width='1'/%3E%3C/svg%3E")`,
    size: '8px 8px'
  },
  canvas: {
    pattern: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12'%3E%3Crect width='12' height='12' fill='%23888'/%3E%3Crect x='0' y='0' width='6' height='6' fill='%23777'/%3E%3Crect x='6' y='6' width='6' height='6' fill='%23777'/%3E%3C/svg%3E")`,
    size: '12px 12px'
  },
  noise: {
    pattern: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' fill='%23808080'/%3E%3Crect x='2' y='3' width='2' height='2' fill='%23606060'/%3E%3Crect x='12' y='7' width='2' height='2' fill='%23a0a0a0'/%3E%3Crect x='25' y='2' width='2' height='2' fill='%23707070'/%3E%3Crect x='35' y='10' width='2' height='2' fill='%23909090'/%3E%3Crect x='8' y='18' width='2' height='2' fill='%23505050'/%3E%3Crect x='20' y='15' width='2' height='2' fill='%23b0b0b0'/%3E%3Crect x='32' y='22' width='2' height='2' fill='%23656565'/%3E%3Crect x='5' y='30' width='2' height='2' fill='%23959595'/%3E%3Crect x='18' y='28' width='2' height='2' fill='%23757575'/%3E%3Crect x='28' y='35' width='2' height='2' fill='%23858585'/%3E%3Crect x='38' y='32' width='2' height='2' fill='%23555555'/%3E%3Crect x='15' y='38' width='2' height='2' fill='%23a5a5a5'/%3E%3C/svg%3E")`,
    size: '40px 40px'
  }
};

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
  // Bible/Prayer reference line properties
  referenceStyle?: any;
  referencePosition?: LinePosition;
  referenceTranslationStyle?: any;
  referenceTranslationPosition?: LinePosition;
  referenceEnglishStyle?: any;
  referenceEnglishPosition?: LinePosition;
}

interface ToolData {
  type: 'countdown' | 'announcement' | 'rotatingMessages' | 'clock' | 'stopwatch';
  active: boolean;
  remaining?: string;
  message?: string;
  messageTranslation?: string;
  text?: string;
  messages?: string[];
  interval?: number;
  time?: string;
  date?: string;
  format?: '12h' | '24h';
  running?: boolean;
}

const DisplayViewer: React.FC = () => {
  const { settings } = useSettings();
  const [slideData, setSlideData] = useState<SlideData | null>(null);

  // Check if this display window is on the same screen as the control window
  const isSameScreenAsControl = useMemo(() => {
    // Check URL parameter - passed when opening the display window
    // With hash-based routing, query params are in the hash (e.g., #/display/viewer?sameScreen=true)
    const hash = window.location.hash;
    const queryIndex = hash.indexOf('?');
    if (queryIndex !== -1) {
      const queryString = hash.substring(queryIndex);
      const urlParams = new URLSearchParams(queryString);
      return urlParams.get('sameScreen') === 'true';
    }
    return false;
  }, []);
  const [combinedSlides, setCombinedSlides] = useState<SlideData[] | null>(null);
  const [displayMode, setDisplayMode] = useState<string>('bilingual');
  const [isBlank, setIsBlank] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState<string>('');
  const [theme, setTheme] = useState<Theme | null>(null);
  const [presentationSlide, setPresentationSlide] = useState<PresentationSlide | null>(null);

  // Media state
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [mediaPath, setMediaPath] = useState<string>('');
  const [mediaLoadError, setMediaLoadError] = useState<string | null>(null);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaRetryCount, setMediaRetryCount] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaLoadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoReloadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoSyncedRef = useRef(false); // Track if initial video sync has been performed
  const mediaLoadingRef = useRef(false); // Ref to track current loading state for timeout callback

  // Constants for media error recovery
  const MAX_MEDIA_RETRIES = 3;
  const MEDIA_RETRY_DELAY_MS = 2000;

  // Media load timeout duration in milliseconds (from settings, converted to ms)
  const mediaLoadTimeout = (settings.mediaLoadTimeout || DEFAULT_MEDIA_LOAD_TIMEOUT_SEC) * 1000;

  // Tools state
  const [countdown, setCountdown] = useState<{ active: boolean; remaining: string; message: string; messageTranslation?: string }>({
    active: false,
    remaining: '',
    message: '',
    messageTranslation: ''
  });
  const [announcement, setAnnouncement] = useState<{ active: boolean; text: string }>({
    active: false,
    text: ''
  });
  // Announcement auto-fade state
  const [announcementVisible, setAnnouncementVisible] = useState(false);
  const [announcementFading, setAnnouncementFading] = useState(false);
  const announcementTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const announcementFadeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasAnnouncementActive = useRef(false);
  const [rotatingMessages, setRotatingMessages] = useState<{ active: boolean; messages: string[]; interval: number; currentIndex: number }>({
    active: false,
    messages: [],
    interval: 5,
    currentIndex: 0
  });
  const rotatingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clock state
  const [clock, setClock] = useState<{ active: boolean; time: string; date: string; format: '12h' | '24h' }>({
    active: false,
    time: '',
    date: '',
    format: '12h'
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
  const youtubeCreateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Helper function to properly clean up YouTube player and container
  // This must be called BEFORE any state changes that would cause React to unmount the container
  const cleanupYoutubePlayer = () => {
    // Clear pending create timeout
    if (youtubeCreateTimeoutRef.current) {
      clearTimeout(youtubeCreateTimeoutRef.current);
      youtubeCreateTimeoutRef.current = null;
    }
    // Destroy player first
    if (youtubePlayerRef.current) {
      try {
        youtubePlayerRef.current.stopVideo?.();
        youtubePlayerRef.current.destroy();
      } catch (e) {
        // Ignore - player may already be destroyed
      }
      youtubePlayerRef.current = null;
    }
    youtubeReadyRef.current = false;
    // Manually clear the container to remove the iframe before React tries to reconcile
    // This prevents the "removeChild" error when React unmounts the container
    if (youtubeContainerRef.current) {
      youtubeContainerRef.current.innerHTML = '';
    }
  };

  useEffect(() => {
    // Listen for slide updates
    const slideCleanup = window.displayAPI.onSlideUpdate((data) => {
      if (data.isBlank) {
        cleanupYoutubePlayer(); // Clean up YouTube before state changes
        setIsBlank(true);
        setMediaType(null);
        setCombinedSlides(null);
        setPresentationSlide(null);
        setYoutubeVideoId(null); // Clear YouTube when going blank
      } else {
        setIsBlank(false);
        // Handle presentation slides (with textbox styling)
        if (data.presentationSlide) {
          cleanupYoutubePlayer(); // Clean up YouTube before state changes
          setPresentationSlide(data.presentationSlide);
          setSlideData(null); // Clear song slide data
          setMediaType(null);
          setYoutubeVideoId(null); // Clear YouTube when showing presentation
        } else if (data.slideData) {
          cleanupYoutubePlayer(); // Clean up YouTube before state changes
          setSlideData(data.slideData);
          setPresentationSlide(null); // Clear presentation slide
          setMediaType(null);
          setYoutubeVideoId(null); // Clear YouTube when showing slides
        }
        if (data.displayMode) {
          setDisplayMode(data.displayMode);
        }
        // Update background if explicitly provided (including empty string to clear)
        if (data.backgroundImage !== undefined) {
          setBackgroundImage(data.backgroundImage);
        }
        // Apply activeTheme if included (for content-type specific themes like bible)
        if (data.activeTheme) {
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
    const mediaCleanup = window.displayAPI.onMediaUpdate(async (data) => {
      // Clear any pending retry/reload timeouts
      if (mediaRetryTimeoutRef.current) {
        clearTimeout(mediaRetryTimeoutRef.current);
        mediaRetryTimeoutRef.current = null;
      }
      if (videoReloadTimeoutRef.current) {
        clearTimeout(videoReloadTimeoutRef.current);
        videoReloadTimeoutRef.current = null;
      }

      if (!data.path) {
        // Clear media
        setMediaType(null);
        setMediaPath('');
        setMediaLoadError(null);
        setMediaLoading(false);
        setMediaRetryCount(0);
        videoSyncedRef.current = false;
        return;
      }
      // IMPORTANT: Clean up YouTube FIRST before any state changes
      // This prevents React from trying to unmount a container with YouTube's iframe inside
      cleanupYoutubePlayer();

      // Set isBlank before media type to prevent render branch switch
      setIsBlank(false);
      setYoutubeVideoId(null); // Clear YouTube when showing media
      setMediaType(data.type);

      // Use media:// URL directly - the custom protocol should work in display windows
      // since they're Electron windows with the same protocol handler
      console.log('[DisplayViewer] Received media path:', data.path);
      setMediaPath(data.path);
      setMediaLoadError(null);
      setMediaLoading(true);
      setMediaRetryCount(0); // Reset retry count for new media
      videoSyncedRef.current = false; // Reset sync flag for new video
    });

    // Listen for video commands
    const videoCleanup = window.displayAPI.onVideoCommand((command) => {
      const video = videoRef.current;

      switch (command.type) {
        case 'play':
          if (command.path && typeof command.path === 'string' && command.path.trim()) {
            setMediaType('video');
            setMediaPath(command.path.startsWith('media://') ? command.path : `media://${command.path}`);
          }
          if (video && video.src && !video.src.endsWith('/')) {
            video.play().catch((err) => {
              log.error('Video play error:', err);
            });
          }
          break;
        case 'pause':
          if (video) video.pause();
          break;
        case 'resume':
          // Only resume if video has a valid source
          if (video && video.src && !video.src.endsWith('/')) {
            video.play().catch((err) => {
              log.error('Video resume error:', err);
            });
          }
          break;
        case 'seek':
          if (video && typeof command.time === 'number') {
            video.currentTime = command.time;
          }
          break;
        case 'stop':
          if (video) {
            video.pause();
            video.currentTime = 0;
          }
          setMediaType(null);
          setMediaPath('');
          break;
        case 'mute':
          if (video) video.muted = command.muted ?? true;
          break;
        case 'volume':
          if (video && typeof command.volume === 'number') {
            video.volume = Math.max(0, Math.min(1, command.volume));
            if (command.volume > 0) {
              video.muted = false;
            }
          }
          break;
      }
    });

    // Listen for theme updates (songs theme)
    const themeCleanup = window.displayAPI.onThemeUpdate((newTheme) => {
      setTheme(newTheme);
    });

    // Listen for bible theme updates (also applies to current display if showing bible content)
    const bibleThemeCleanup = window.displayAPI.onBibleThemeUpdate((newTheme) => {
      setTheme(newTheme);
    });

    // Listen for prayer theme updates (applies when showing prayer/sermon content)
    const prayerThemeCleanup = window.displayAPI.onPrayerThemeUpdate((newTheme) => {
      setTheme(newTheme);
    });

    // Listen for background updates
    const backgroundCleanup = window.displayAPI.onBackgroundUpdate((background: string) => {
      setBackgroundImage(background);
    });

    // Listen for YouTube commands
    const youtubeCleanup = window.displayAPI.onYoutubeCommand((command) => {
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
          // Clean up YouTube player FIRST before any state changes
          cleanupYoutubePlayer();
          setYoutubeVideoId(null);
          setYoutubeTitle('');
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
            // Only seek if drift exceeds threshold for tighter sync
            if (Math.abs(currentTime - command.currentTime) > YOUTUBE_SYNC_THRESHOLD_SEC) {
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
      if (toolData.type === 'countdown') {
        setCountdown({
          active: toolData.active,
          remaining: toolData.remaining || '',
          message: toolData.message || '',
          messageTranslation: toolData.messageTranslation || ''
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
          date: toolData.date || '',
          format: toolData.format || '12h'
        });
      } else if (toolData.type === 'stopwatch') {
        setStopwatch({
          active: toolData.active,
          time: toolData.time || '00:00.0',
          running: toolData.running || false
        });
      }
    });

    // Report ready AFTER all listeners are registered to avoid race condition
    // where main process sends initial state before listeners are set up
    window.displayAPI.reportReady();

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

  // Handle announcement visibility and auto-dismiss after 10 seconds
  useEffect(() => {
    if (announcement.active && announcement.text) {
      // Clear any existing timer
      if (announcementTimerRef.current) {
        clearTimeout(announcementTimerRef.current);
      }

      // Show announcement with slide-up animation
      setAnnouncementFading(false);
      setAnnouncementVisible(true);
      wasAnnouncementActive.current = true;

      // Start fade-out after 8 seconds, then hide after 10 seconds total
      announcementTimerRef.current = setTimeout(() => {
        setAnnouncementFading(true);
        // Fully hide after fade animation completes (2 seconds)
        announcementFadeRef.current = setTimeout(() => {
          setAnnouncementVisible(false);
          setAnnouncementFading(false);
        }, 2000);
      }, 8000);
    } else if (!announcement.active && wasAnnouncementActive.current) {
      // If announcement is deactivated and was previously active, start fade out immediately
      wasAnnouncementActive.current = false;
      setAnnouncementFading(true);
      announcementFadeRef.current = setTimeout(() => {
        setAnnouncementVisible(false);
        setAnnouncementFading(false);
      }, 500);
      if (announcementTimerRef.current) {
        clearTimeout(announcementTimerRef.current);
      }
    }

    return () => {
      if (announcementTimerRef.current) {
        clearTimeout(announcementTimerRef.current);
      }
      if (announcementFadeRef.current) {
        clearTimeout(announcementFadeRef.current);
      }
    };
  }, [announcement.active, announcement.text]);

  // Load YouTube IFrame API
  useEffect(() => {
    let scriptElement: HTMLScriptElement | null = null;

    if (!window.YT && !document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      scriptElement = document.createElement('script');
      scriptElement.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(scriptElement);
    }

    // Cleanup: Remove script element on unmount (only if we added it)
    return () => {
      if (scriptElement && scriptElement.parentNode) {
        scriptElement.parentNode.removeChild(scriptElement);
      }
    };
  }, []);

  // Create YouTube player when video ID changes
  useEffect(() => {
    if (!youtubeVideoId || !youtubeContainerRef.current) {
      return;
    }

    // Track if this effect is still active (prevents stale callbacks after unmount/re-render)
    let isActive = true;
    let retryCount = 0;
    const MAX_RETRIES = 50; // 5 seconds max wait for YouTube API

    const createPlayer = () => {
      // Check if effect was cleaned up while waiting
      if (!isActive) return;

      if (!window.YT || !window.YT.Player || !youtubeContainerRef.current) {
        if (retryCount++ >= MAX_RETRIES) {
          log.error('YouTube API failed to load after maximum retries');
          return;
        }
        youtubeCreateTimeoutRef.current = setTimeout(createPlayer, 100);
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
            // Check if effect was cleaned up while player was loading
            if (!isActive) return;

            youtubeReadyRef.current = true;
            // Request current position from preview and sync immediately
            try {
              const pos = await window.displayAPI.getYoutubePosition();
              // Check again after async operation
              if (!isActive || !youtubePlayerRef.current) return;

              if (pos) {
                youtubePlayerRef.current.seekTo(pos.time, true);
                if (pos.isPlaying) {
                  youtubePlayerRef.current.playVideo();
                }
              }
            } catch (err) {
              if (!isActive) return;
              log.error('Failed to get YouTube position:', err);
              // Fallback: just start playing
              youtubePlayerRef.current?.playVideo();
            }
          },
          onError: (event: any) => {
            if (!isActive) return;
            const errorCodes: Record<number, string> = {
              2: 'Invalid video ID',
              5: 'Video cannot be played in HTML5 player',
              100: 'Video not found or removed',
              101: 'Video not allowed for embedded playback',
              150: 'Video not allowed for embedded playback'
            };
            const errorMessage = errorCodes[event.data] || `Unknown error (code: ${event.data})`;
            log.error('YouTube player error:', errorMessage);
            window.displayAPI.reportError(`YouTube error: ${errorMessage}`);
          }
        }
      });
    };

    createPlayer();

    return () => {
      // Mark effect as inactive to prevent stale callbacks
      isActive = false;
      // Use the helper function for cleanup
      // Note: For normal state changes, cleanupYoutubePlayer is called BEFORE the state change
      // This cleanup is mainly for when the component unmounts or videoId changes to a new value
      cleanupYoutubePlayer();
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

  // Cleanup video element when media changes or component unmounts
  useEffect(() => {
    const currentMediaPath = mediaPath;

    return () => {
      // Clear any pending video reload timeout
      if (videoReloadTimeoutRef.current) {
        clearTimeout(videoReloadTimeoutRef.current);
        videoReloadTimeoutRef.current = null;
      }

      const video = videoRef.current;
      if (video) {
        // Pause video to stop playback
        video.pause();

        // Revoke blob URL if it was created to prevent memory leaks
        if (currentMediaPath && currentMediaPath.startsWith('blob:')) {
          try {
            URL.revokeObjectURL(currentMediaPath);
          } catch (e) {
            // Ignore - URL may already be revoked
          }
        }

        // Note: Don't set video.src = '' here as it causes issues with the ref
        // pointing to a stale element with the page URL. The video element will
        // be unmounted by React anyway if the key changes.
      }
    };
  }, [mediaPath]);

  // Keep mediaLoadingRef in sync with mediaLoading state for timeout callback
  useEffect(() => {
    mediaLoadingRef.current = mediaLoading;
  }, [mediaLoading]);

  // Media load timeout handling
  useEffect(() => {
    // Clear any existing timeout
    if (mediaLoadTimeoutRef.current) {
      clearTimeout(mediaLoadTimeoutRef.current);
      mediaLoadTimeoutRef.current = null;
    }

    // Only set timeout if we're loading media
    if (mediaLoading && mediaPath) {
      // Capture mediaPath at timeout creation time for the callback
      const currentMediaPath = mediaPath;
      mediaLoadTimeoutRef.current = setTimeout(() => {
        // Use ref to check current loading state (not stale closure)
        if (mediaLoadingRef.current) {
          log.error('Media load timeout:', currentMediaPath);
          setMediaLoadError('Media load timed out');
          setMediaLoading(false);
          window.displayAPI.reportError(`Media load timeout: ${currentMediaPath.substring(0, 50)}`);
        }
      }, mediaLoadTimeout);
    }

    return () => {
      if (mediaLoadTimeoutRef.current) {
        clearTimeout(mediaLoadTimeoutRef.current);
        mediaLoadTimeoutRef.current = null;
      }
    };
  }, [mediaLoading, mediaPath]);

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

  // Get positioning styles from theme (memoized to prevent recalculation on every render)
  const positioningStyle = useMemo((): React.CSSProperties => {
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
  }, [theme?.positioning, theme?.container?.padding]);

  // Memoized line styles map (prevents recalculating all line styles on every render)
  const lineStylesMap = useMemo((): Record<string, React.CSSProperties> => {
    const lineStyles = theme?.lineStyles || {};
    const result: Record<string, React.CSSProperties> = {};

    for (const lineType of ['original', 'transliteration', 'translation']) {
      const style = lineStyles[lineType] || {};
      result[lineType] = {
        fontSize: `${(style.fontSize || 100) / 20}vw`,
        fontWeight: style.fontWeight || '500',
        color: style.color || '#FFFFFF',
        opacity: style.opacity ?? 1,
        display: style.visible === false ? 'none' : 'block',
        marginBottom: '2vh',
        lineHeight: 1.4
      };
    }

    return result;
  }, [theme?.lineStyles]);

  // Get line style from memoized map
  const getLineStyle = (lineType: string): React.CSSProperties => {
    return lineStylesMap[lineType] || {
      fontSize: '5vw',
      fontWeight: '500',
      color: '#FFFFFF',
      opacity: 1,
      display: 'block',
      marginBottom: '2vh',
      lineHeight: 1.4
    };
  };

  // Get line order from theme (memoized)
  const lineOrder = useMemo(
    () => theme?.lineOrder || ['original', 'transliteration', 'translation'],
    [theme?.lineOrder]
  );

  // Render lines based on display mode
  const renderLines = () => {
    if (!slideData) return null;

    // If we have combined slides (original mode with paired slides), render both
    if (combinedSlides && combinedSlides.length > 1 && displayMode === 'original') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2vh' }}>
          {combinedSlides.map((slide, idx) => (
            <div
              key={`combined-${idx}-${(slide.originalText || '').substring(0, 15)}`}
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

  // Render background boxes (legacy - main rendering uses SlideRenderer)
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
          zIndex: 1,
          overflow: 'hidden'
        }}
      >
        {/* Texture overlay */}
        {box.texture && box.texture !== 'none' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: texturePatterns[box.texture].pattern,
              backgroundRepeat: 'repeat',
              backgroundSize: texturePatterns[box.texture].size,
              opacity: box.textureOpacity ?? 0.3,
              pointerEvents: 'none',
              mixBlendMode: 'overlay'
            }}
          />
        )}
      </div>
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
          color: '#06b6d4',
          textShadow: '0 0 50px rgba(6, 182, 212, 0.5)',
          fontFamily: 'Inter, sans-serif'
        }}>
          {countdown.remaining}
        </div>
        {countdown.message && (
          <div style={{
            fontSize: '3vw',
            color: 'rgba(255, 255, 255, 0.9)',
            marginTop: '2vh',
            marginBottom: '0',
            direction: 'rtl',
            lineHeight: 1.2
          }}>
            {countdown.message}
          </div>
        )}
        {countdown.messageTranslation && (
          <div style={{
            fontSize: '2vw',
            color: 'rgba(255, 255, 255, 0.7)',
            marginTop: '0.3vh',
            lineHeight: 1.2
          }}>
            {countdown.messageTranslation}
          </div>
        )}
      </div>
    );
  };

  // Render announcement banner with auto-fade
  const renderAnnouncement = () => {
    if (!announcementVisible || !announcement.text) return null;

    return (
      <div style={{
        position: 'absolute',
        bottom: '5vh',
        left: '5vw',
        right: '5vw',
        padding: '2vh 3vw',
        background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.95), rgba(8, 145, 178, 0.95))',
        borderRadius: '1vw',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
        zIndex: 90,
        animation: announcementFading ? 'slideDown 0.5s ease-out forwards' : 'slideUp 0.5s ease-out forwards'
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
          @keyframes slideDown {
            from {
              opacity: 1;
              transform: translateY(0);
            }
            to {
              opacity: 0;
              transform: translateY(50px);
            }
          }
        `}</style>
      </div>
    );
  };

  // Render rotating messages ticker
  const renderRotatingMessages = () => {
    if (!rotatingMessages.active || rotatingMessages.messages.length === 0) return null;

    // Ensure currentIndex is within bounds
    const safeIndex = Math.min(rotatingMessages.currentIndex, rotatingMessages.messages.length - 1);
    const currentMessage = rotatingMessages.messages[safeIndex];
    if (!currentMessage) return null;

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
        zIndex: 85
      }}>
        {/* Key prop forces re-mount on message change, triggering animation */}
        <div
          key={`msg-${rotatingMessages.currentIndex}`}
          style={{
            fontSize: '2.5vw',
            fontWeight: 600,
            color: 'white',
            textAlign: 'center',
            textShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
            animation: 'messageSlideIn 0.4s ease-out'
          }}
        >
          {currentMessage}
        </div>
        <style>{`
          @keyframes messageSlideIn {
            from {
              opacity: 0;
              transform: translateY(-10px);
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

  // Render close button (only shown when display is on same screen as control)
  const renderCloseButton = () => {
    if (!isSameScreenAsControl) return null;

    return (
      <button
        onClick={() => {
          window.displayAPI.closeDisplay();
        }}
        style={{
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '12px 32px',
          fontSize: '16px',
          fontWeight: 600,
          color: 'white',
          background: 'rgba(220, 38, 38, 0.9)',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          zIndex: 1000,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          transition: 'background 0.2s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(185, 28, 28, 0.95)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(220, 38, 38, 0.9)';
        }}
      >
        ✕ Stop Presenting
      </button>
    );
  };

  // Determine what content to show (for single return with layers)
  const showYoutube = youtubeVideoId && !countdown.active && !clock.active && !stopwatch.active;
  const showVideo = mediaType === 'video' && !countdown.active && !clock.active && !stopwatch.active && !showYoutube;
  const showImage = mediaType === 'image' && !countdown.active && !clock.active && !stopwatch.active && !showYoutube;
  const showSlides = !showYoutube && !showVideo && !showImage && !countdown.active && !clock.active && !stopwatch.active;

  // Single return with all layers - YouTube container is NEVER unmounted
  return (
    <div className="display-window" style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', background: '#000' }}>
      {/* YouTube container - ALWAYS mounted, shown/hidden via zIndex and opacity */}
      <div
        ref={youtubeContainerRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: showYoutube ? 10 : -1,
          opacity: showYoutube ? 1 : 0,
          pointerEvents: showYoutube ? 'auto' : 'none'
        }}
      />

      {/* Video layer */}
      {showVideo && (
        <div style={{ ...backgroundStyle, position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 5 }}>
          {/* Loading overlay */}
          {mediaLoading && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0, 0, 0, 0.7)',
              zIndex: 10
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                border: '3px solid rgba(255, 255, 255, 0.2)',
                borderTopColor: '#06b6d4',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              <style>{`
                @keyframes spin {
                  to { transform: rotate(360deg); }
                }
              `}</style>
            </div>
          )}
          {/* Error overlay */}
          {mediaLoadError && (
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
              zIndex: 10
            }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <div style={{ color: '#ff6b6b', fontSize: '1.5vw', marginTop: '1vh' }}>
                {mediaLoadError}
              </div>
            </div>
          )}
          {mediaPath && (
            <video
              key={`video-${mediaPath}-${mediaRetryCount}`}
              ref={videoRef}
              src={mediaPath}
              className="display-video"
              muted
              playsInline
              onLoadStart={() => {
                console.log('[DisplayViewer] Video load started, src:', mediaPath);
              }}
              onProgress={(e) => {
                const video = e.target as HTMLVideoElement;
                const buffered = video.buffered;
                console.log('[DisplayViewer] Video progress event - buffered ranges:', buffered.length,
                  'networkState:', video.networkState, 'readyState:', video.readyState);
                if (buffered.length > 0) {
                  console.log('[DisplayViewer] Video buffered:', buffered.end(0).toFixed(2), 'sec of', video.duration?.toFixed(2) || 'unknown', 'sec');
                }
              }}
              onLoadedMetadata={(e) => {
                const video = e.target as HTMLVideoElement;
                console.log('[DisplayViewer] Video metadata loaded:', {
                  duration: video.duration,
                  videoWidth: video.videoWidth,
                  videoHeight: video.videoHeight,
                  src: video.src
                });
              }}
              onLoadedData={() => {
                console.log('[DisplayViewer] Video data loaded');
                setMediaLoading(false);
                setMediaLoadError(null);
              }}
              onAbort={() => {
                console.log('[DisplayViewer] Video load aborted');
              }}
              onStalled={() => {
                console.log('[DisplayViewer] Video stalled - waiting for data');
              }}
              onWaiting={() => {
                console.log('[DisplayViewer] Video waiting for data');
              }}
              onCanPlay={async () => {
                console.log('[DisplayViewer] Video can play');
                if (videoSyncedRef.current) return;
                videoSyncedRef.current = true;
                try {
                  const started = await window.displayAPI.signalVideoReady();
                  console.log('[DisplayViewer] Video ready signal sent, playback started:', started);
                  if (!started) {
                    const pos = await window.displayAPI.getVideoPosition();
                    if (pos && videoRef.current) {
                      if (Math.abs(videoRef.current.currentTime - pos.time) > VIDEO_SYNC_THRESHOLD_SEC) {
                        videoRef.current.currentTime = pos.time;
                      }
                      if (pos.isPlaying) {
                        videoRef.current.play().catch(err => log.error('Video play failed:', err));
                      }
                    }
                  }
                } catch (err) {
                  log.error('Failed to signal video ready:', err);
                }
              }}
              onError={(e) => {
                const videoElement = e.target as HTMLVideoElement;
                const videoSrc = videoElement?.src || '';
                if (!videoSrc || videoSrc.endsWith('/') || (!videoSrc.includes('/media/') && !videoSrc.startsWith('media://'))) {
                  console.log('[DisplayViewer] Ignoring stale video error, src:', videoSrc);
                  return;
                }
                const mediaError = videoElement?.error;
                const errorCode = mediaError?.code;
                const errorMessage = mediaError?.message || 'Unknown error';
                const errorCodeNames: Record<number, string> = {
                  1: 'MEDIA_ERR_ABORTED',
                  2: 'MEDIA_ERR_NETWORK',
                  3: 'MEDIA_ERR_DECODE',
                  4: 'MEDIA_ERR_SRC_NOT_SUPPORTED'
                };
                const errorName = errorCode ? errorCodeNames[errorCode] || `Unknown (${errorCode})` : 'No error code';
                log.error(`Video error: ${errorName} - ${errorMessage}`, 'src:', videoSrc, 'retry count:', mediaRetryCount);
                setMediaLoading(false);
                videoSyncedRef.current = false;
                if (mediaRetryCount < MAX_MEDIA_RETRIES) {
                  setMediaLoadError(`Retrying... (${mediaRetryCount + 1}/${MAX_MEDIA_RETRIES})`);
                  mediaRetryTimeoutRef.current = setTimeout(() => {
                    setMediaRetryCount(prev => prev + 1);
                    setMediaLoading(true);
                    setMediaLoadError(null);
                  }, MEDIA_RETRY_DELAY_MS);
                } else {
                  setMediaLoadError('Video playback error - max retries exceeded');
                  window.displayAPI.reportError('Video playback error after max retries');
                }
              }}
            />
          )}
        </div>
      )}

      {/* Image layer */}
      {showImage && (
        <div style={{ ...backgroundStyle, position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 5 }}>
          {mediaLoading && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0, 0, 0, 0.7)',
              zIndex: 10
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                border: '3px solid rgba(255, 255, 255, 0.2)',
                borderTopColor: '#06b6d4',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              <style>{`
                @keyframes spin {
                  to { transform: rotate(360deg); }
                }
              `}</style>
            </div>
          )}
          {mediaLoadError && (
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
              zIndex: 10
            }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              <div style={{ color: '#ff6b6b', fontSize: '1.5vw', marginTop: '1vh' }}>
                {mediaLoadError}
              </div>
            </div>
          )}
          {mediaPath && (
            <img
              key={`image-${mediaPath}-${mediaRetryCount}`}
              src={mediaPath}
              className="display-image"
              alt=""
              onLoad={() => {
                setMediaLoading(false);
                setMediaLoadError(null);
                setMediaRetryCount(0);
              }}
              onError={(e) => {
                log.error('Image load error:', e, 'retry count:', mediaRetryCount);
                setMediaLoading(false);
                if (mediaRetryCount < MAX_MEDIA_RETRIES) {
                  setMediaLoadError(`Retrying... (${mediaRetryCount + 1}/${MAX_MEDIA_RETRIES})`);
                  mediaRetryTimeoutRef.current = setTimeout(() => {
                    setMediaRetryCount(prev => prev + 1);
                    setMediaLoading(true);
                    setMediaLoadError(null);
                  }, MEDIA_RETRY_DELAY_MS);
                } else {
                  setMediaLoadError('Image load error - max retries exceeded');
                  window.displayAPI.reportError('Image load error after max retries');
                }
              }}
            />
          )}
        </div>
      )}

      {/* Slide content layer */}
      {showSlides && !isBlank && (
        <SlideRenderer
          slideData={slideData}
          displayMode={displayMode}
          theme={theme}
          backgroundImage={backgroundImage}
          isBlank={false}
          fillContainer={true}
          presentationSlide={presentationSlide}
          combinedSlides={combinedSlides}
        />
      )}

      {/* Blank screen - just show background */}
      {isBlank && !countdown.active && !clock.active && !stopwatch.active && (
        <SlideRenderer
          slideData={null}
          displayMode={displayMode}
          theme={theme}
          backgroundImage={backgroundImage}
          isBlank={true}
          fillContainer={true}
        />
      )}

      {/* Tool overlays - highest z-index */}
      {countdown.active && renderCountdown()}
      {clock.active && renderClock()}
      {stopwatch.active && renderStopwatch()}

      {/* Always-visible overlays */}
      {renderRotatingMessages()}
      {renderAnnouncement()}
      {renderCloseButton()}
    </div>
  );
};

export default memo(DisplayViewer);
