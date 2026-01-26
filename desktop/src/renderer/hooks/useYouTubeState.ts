import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../contexts/SettingsContext';

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

export interface YouTubeVideo {
  videoId: string;
  title: string;
  thumbnail: string;
}

export interface YouTubeSearchResult {
  videoId: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
  duration?: string;
}

interface SetlistItem {
  id: string;
  type: 'song' | 'blank' | 'section' | 'countdown' | 'announcement' | 'messages' | 'media' | 'bible' | 'presentation' | 'youtube' | 'clock' | 'stopwatch' | 'audioPlaylist';
  youtubeVideoId?: string;
  youtubeTitle?: string;
  youtubeThumbnail?: string;
  title?: string;
  [key: string]: any;
}

interface UseYouTubeStateReturn {
  // State
  youtubeVideos: YouTubeVideo[];
  youtubeUrlInput: string;
  youtubeLoading: boolean;
  youtubeOnDisplay: boolean;
  activeYoutubeVideo: YouTubeVideo | null;
  youtubePlayerRef: any;
  youtubePlaying: boolean;
  youtubeCurrentTime: number;
  youtubeDuration: number;
  youtubeContainerRef: React.RefObject<HTMLDivElement | null>;
  activeMediaSubTab: 'library' | 'links';
  hoveredYoutubeId: string | null;
  youtubeSearchResults: YouTubeSearchResult[];
  youtubeSearchLoading: boolean;
  showYoutubeSearchResults: boolean;

  // Setters
  setYoutubeUrlInput: React.Dispatch<React.SetStateAction<string>>;
  setActiveMediaSubTab: React.Dispatch<React.SetStateAction<'library' | 'links'>>;
  setHoveredYoutubeId: React.Dispatch<React.SetStateAction<string | null>>;
  setShowYoutubeSearchResults: React.Dispatch<React.SetStateAction<boolean>>;
  // Remote control setters
  setYoutubePlaying: React.Dispatch<React.SetStateAction<boolean>>;
  setYoutubeOnDisplay: React.Dispatch<React.SetStateAction<boolean>>;
  setActiveYoutubeVideo: React.Dispatch<React.SetStateAction<YouTubeVideo | null>>;
  setYoutubeCurrentTime: React.Dispatch<React.SetStateAction<number>>;
  setYoutubeDuration: React.Dispatch<React.SetStateAction<number>>;

  // Handlers
  handleAddYoutubeVideo: () => Promise<void>;
  handleRemoveYoutubeVideo: (videoId: string) => void;
  handleYoutubeDisplay: (video: YouTubeVideo) => void;
  handleYoutubeStop: () => void;
  playYoutubeVideo: (videoId: string, title: string, thumbnail?: string) => void;
  searchYouTube: (query: string) => Promise<void>;
  addVideoFromSearch: (result: YouTubeSearchResult) => void;
  handleYoutubeInputSubmit: (setSetlist: React.Dispatch<React.SetStateAction<SetlistItem[]>>) => Promise<void>;
  closeYoutubeSearchResults: () => void;
  extractYouTubeVideoId: (url: string) => string | null;
  isYouTubeUrl: (input: string) => boolean;
}

export function useYouTubeState(
  setActiveMedia: React.Dispatch<React.SetStateAction<{ type: 'image' | 'video'; url: string } | null>>
): UseYouTubeStateReturn {
  const { t } = useTranslation();
  const { settings } = useSettings();

  // Core state
  const [youtubeVideos, setYoutubeVideos] = useState<YouTubeVideo[]>([]);
  const [youtubeUrlInput, setYoutubeUrlInput] = useState('');
  const [youtubeLoading, setYoutubeLoading] = useState(false);
  const [youtubeOnDisplay, setYoutubeOnDisplay] = useState(false);
  const [activeYoutubeVideo, setActiveYoutubeVideo] = useState<YouTubeVideo | null>(null);
  const [youtubePlayerRef, setYoutubePlayerRef] = useState<any>(null);
  const [youtubePlaying, setYoutubePlaying] = useState(false);
  const [youtubeCurrentTime, setYoutubeCurrentTime] = useState(0);
  const [youtubeDuration, setYoutubeDuration] = useState(0);

  // UI state
  const [activeMediaSubTab, setActiveMediaSubTab] = useState<'library' | 'links'>('library');
  const [hoveredYoutubeId, setHoveredYoutubeId] = useState<string | null>(null);

  // Search state
  const [youtubeSearchResults, setYoutubeSearchResults] = useState<YouTubeSearchResult[]>([]);
  const [youtubeSearchLoading, setYoutubeSearchLoading] = useState(false);
  const [showYoutubeSearchResults, setShowYoutubeSearchResults] = useState(false);

  // Refs
  const youtubeContainerRef = useRef<HTMLDivElement>(null);
  const youtubeAPIReady = useRef(false);
  const youtubeSyncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // YouTube IFrame API setup
  useEffect(() => {
    // Load YouTube IFrame API script if not already loaded
    if (!window.YT && !document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }

    // Set up the callback for when API is ready
    const originalCallback = (window as any).onYouTubeIframeAPIReady;
    (window as any).onYouTubeIframeAPIReady = () => {
      youtubeAPIReady.current = true;
      if (originalCallback) originalCallback();
    };

    // If API is already loaded
    if (window.YT && window.YT.Player) {
      youtubeAPIReady.current = true;
    }

    return () => {
      if (youtubeSyncIntervalRef.current) {
        clearInterval(youtubeSyncIntervalRef.current);
      }
      // Restore original callback on cleanup
      if (originalCallback) {
        (window as any).onYouTubeIframeAPIReady = originalCallback;
      } else {
        delete (window as any).onYouTubeIframeAPIReady;
      }
    };
  }, []);

  // Create/destroy YouTube player when video changes
  useEffect(() => {
    let currentPlayer: any = null;
    let createPlayerTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let isCleanedUp = false;
    let retryCount = 0;
    const MAX_RETRIES = 50;

    if (!youtubeOnDisplay || !activeYoutubeVideo || !youtubeContainerRef.current) {
      // Cleanup player when not displaying
      if (youtubePlayerRef) {
        try {
          youtubePlayerRef.destroy();
        } catch (e) {
          // Ignore errors
        }
        setYoutubePlayerRef(null);
      }
      if (youtubeSyncIntervalRef.current) {
        clearInterval(youtubeSyncIntervalRef.current);
        youtubeSyncIntervalRef.current = null;
      }
      return;
    }

    const createPlayer = () => {
      if (isCleanedUp) return;

      if (!window.YT || !window.YT.Player || !youtubeContainerRef.current) {
        if (retryCount++ >= MAX_RETRIES) {
          console.error('YouTube API failed to load after maximum retries');
          return;
        }
        createPlayerTimeoutId = setTimeout(createPlayer, 100);
        return;
      }

      youtubeContainerRef.current.innerHTML = '';

      const player = new window.YT.Player(youtubeContainerRef.current, {
        videoId: activeYoutubeVideo.videoId,
        playerVars: {
          autoplay: 1,
          rel: 0,
          modestbranding: 1,
          enablejsapi: 1,
          origin: window.location.origin,
          widget_referrer: window.location.href
        },
        events: {
          onReady: (event: any) => {
            if (isCleanedUp) return;
            setYoutubeDuration(event.target.getDuration());
            youtubeSyncIntervalRef.current = setInterval(() => {
              if (isCleanedUp) return;
              if (player && player.getCurrentTime) {
                try {
                  const currentTime = player.getCurrentTime();
                  const playerState = player.getPlayerState();
                  const isPlaying = playerState === window.YT.PlayerState.PLAYING;
                  setYoutubeCurrentTime(currentTime);
                  setYoutubePlaying(isPlaying);
                  window.electronAPI.youtubeSync(currentTime, isPlaying);
                } catch (e) {
                  // Player may have been destroyed
                }
              }
            }, 200);
          },
          onStateChange: (event: any) => {
            if (isCleanedUp) return;
            const isPlaying = event.data === window.YT.PlayerState.PLAYING;
            setYoutubePlaying(isPlaying);
            if (event.data === window.YT.PlayerState.PLAYING) {
              const currentTime = player.getCurrentTime();
              window.electronAPI.youtubePlay(currentTime);
            } else if (event.data === window.YT.PlayerState.PAUSED) {
              const currentTime = player.getCurrentTime();
              window.electronAPI.youtubePause(currentTime);
            }
          },
          onError: (event: any) => {
            const errorCodes: Record<number, string> = {
              2: 'Invalid video ID',
              5: 'Video cannot be played in HTML5 player',
              100: 'Video not found or removed',
              101: 'Video not allowed for embedded playback',
              150: 'Video not allowed for embedded playback'
            };
            const errorMessage = errorCodes[event.data] || `Unknown error (code: ${event.data})`;
            console.error('[YouTube] Player error:', errorMessage);
          }
        }
      });

      currentPlayer = player;
      setYoutubePlayerRef(player);
    };

    createPlayer();

    return () => {
      isCleanedUp = true;
      if (createPlayerTimeoutId) {
        clearTimeout(createPlayerTimeoutId);
      }
      if (youtubeSyncIntervalRef.current) {
        clearInterval(youtubeSyncIntervalRef.current);
        youtubeSyncIntervalRef.current = null;
      }
      const playerToDestroy = currentPlayer || youtubePlayerRef;
      if (playerToDestroy) {
        try {
          playerToDestroy.destroy();
        } catch (e) {
          // Ignore
        }
      }
    };
  }, [youtubeOnDisplay, activeYoutubeVideo?.videoId]);

  // Extract YouTube video ID from various URL formats
  const extractYouTubeVideoId = useCallback((url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      /^([a-zA-Z0-9_-]{11})$/
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  }, []);

  // Check if input looks like a YouTube URL
  const isYouTubeUrl = useCallback((input: string): boolean => {
    const urlPatterns = [
      /youtube\.com\/watch/,
      /youtu\.be\//,
      /youtube\.com\/embed\//,
      /^[a-zA-Z0-9_-]{11}$/
    ];
    return urlPatterns.some(pattern => pattern.test(input));
  }, []);

  // Fetch YouTube video metadata via oEmbed
  const fetchYouTubeMetadata = useCallback(async (videoId: string): Promise<YouTubeVideo | null> => {
    const fallback = {
      videoId,
      title: `Video ${videoId}`,
      thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
    };

    try {
      const response = await fetch(`https://www.youtube.com/oembed?url=https://youtube.com/watch?v=${videoId}&format=json`);
      if (!response.ok) return fallback;

      const data = await response.json();
      return {
        videoId,
        title: data.title || `Video ${videoId}`,
        thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
      };
    } catch (error) {
      console.error('Failed to fetch YouTube metadata:', error);
      return fallback;
    }
  }, []);

  // Add a YouTube video by URL
  const handleAddYoutubeVideo = useCallback(async () => {
    if (!youtubeUrlInput.trim()) return;

    const videoId = extractYouTubeVideoId(youtubeUrlInput.trim());
    if (!videoId) {
      alert('Invalid YouTube URL');
      return;
    }

    if (youtubeVideos.some(v => v.videoId === videoId)) {
      setYoutubeUrlInput('');
      return;
    }

    setYoutubeLoading(true);
    const metadata = await fetchYouTubeMetadata(videoId);
    if (metadata) {
      setYoutubeVideos(prev => [...prev, metadata]);
    }
    setYoutubeUrlInput('');
    setYoutubeLoading(false);
  }, [youtubeUrlInput, youtubeVideos, extractYouTubeVideoId, fetchYouTubeMetadata]);

  // Remove a YouTube video from the list
  const handleRemoveYoutubeVideo = useCallback((videoId: string) => {
    setYoutubeVideos(prev => prev.filter(v => v.videoId !== videoId));
    if (activeYoutubeVideo?.videoId === videoId) {
      setActiveYoutubeVideo(null);
      setYoutubeOnDisplay(false);
    }
  }, [activeYoutubeVideo]);

  // Display a YouTube video on the viewer
  const handleYoutubeDisplay = useCallback((video: YouTubeVideo) => {
    setActiveYoutubeVideo(video);
    setYoutubeOnDisplay(true);
    setActiveMedia(null);
    window.electronAPI.youtubeLoad(video.videoId, video.title);
  }, [setActiveMedia]);

  // Stop YouTube playback
  const handleYoutubeStop = useCallback(() => {
    setActiveYoutubeVideo(null);
    setYoutubeOnDisplay(false);
    setYoutubePlaying(false);
    setYoutubeCurrentTime(0);
    setYoutubeDuration(0);
    window.electronAPI.youtubeStop();
  }, []);

  // Play a YouTube video (used from setlist)
  const playYoutubeVideo = useCallback((videoId: string, title: string, thumbnail?: string) => {
    const video: YouTubeVideo = {
      videoId,
      title,
      thumbnail: thumbnail || `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
    };
    setActiveYoutubeVideo(video);
    setYoutubeOnDisplay(true);
    setActiveMedia(null);
    window.electronAPI.youtubeLoad(videoId, title);
  }, [setActiveMedia]);

  // Search YouTube videos
  const searchYouTube = useCallback(async (query: string) => {
    if (!query.trim()) return;

    setYoutubeSearchLoading(true);
    setShowYoutubeSearchResults(true);

    try {
      const searchTimeoutMs = (settings.youtubeSearchTimeout || 15) * 1000;
      const result = await window.electronAPI.youtubeSearch(query, searchTimeoutMs);

      if (result.success && result.results) {
        setYoutubeSearchResults(result.results);
      } else {
        console.error('YouTube search failed:', result.error);
        alert(t('media.youtubeSearchFailed') || 'YouTube search failed. Please try again.');
        setYoutubeSearchResults([]);
      }
    } catch (error) {
      console.error('YouTube search error:', error);
      alert(t('media.youtubeSearchFailed') || 'YouTube search failed. Please try again.');
      setYoutubeSearchResults([]);
    } finally {
      setYoutubeSearchLoading(false);
    }
  }, [t, settings.youtubeSearchTimeout]);

  // Add video from search results
  const addVideoFromSearch = useCallback((result: YouTubeSearchResult) => {
    if (youtubeVideos.some(v => v.videoId === result.videoId)) {
      return;
    }

    const video: YouTubeVideo = {
      videoId: result.videoId,
      title: result.title,
      thumbnail: result.thumbnail
    };

    setYoutubeVideos(prev => [...prev, video]);
  }, [youtubeVideos]);

  // Handle input submission - either add URL or search
  const handleYoutubeInputSubmit = useCallback(async (
    setSetlist: React.Dispatch<React.SetStateAction<SetlistItem[]>>
  ) => {
    if (!youtubeUrlInput.trim()) return;

    if (isYouTubeUrl(youtubeUrlInput.trim())) {
      const videoId = extractYouTubeVideoId(youtubeUrlInput.trim());
      if (!videoId) {
        alert(t('media.invalidYoutubeUrl') || 'Invalid YouTube URL');
        return;
      }

      setYoutubeLoading(true);
      const metadata = await fetchYouTubeMetadata(videoId);
      if (metadata) {
        const newItem: SetlistItem = {
          id: crypto.randomUUID(),
          type: 'youtube',
          youtubeVideoId: metadata.videoId,
          youtubeTitle: metadata.title,
          youtubeThumbnail: metadata.thumbnail,
          title: metadata.title
        };
        setSetlist(prev => [...prev, newItem]);
      }
      setYoutubeUrlInput('');
      setYoutubeLoading(false);
      setShowYoutubeSearchResults(false);
    } else {
      await searchYouTube(youtubeUrlInput.trim());
    }
  }, [youtubeUrlInput, isYouTubeUrl, extractYouTubeVideoId, fetchYouTubeMetadata, searchYouTube, t]);

  // Close search results
  const closeYoutubeSearchResults = useCallback(() => {
    setShowYoutubeSearchResults(false);
    setYoutubeSearchResults([]);
  }, []);

  return {
    // State
    youtubeVideos,
    youtubeUrlInput,
    youtubeLoading,
    youtubeOnDisplay,
    activeYoutubeVideo,
    youtubePlayerRef,
    youtubePlaying,
    youtubeCurrentTime,
    youtubeDuration,
    youtubeContainerRef,
    activeMediaSubTab,
    hoveredYoutubeId,
    youtubeSearchResults,
    youtubeSearchLoading,
    showYoutubeSearchResults,

    // Setters
    setYoutubeUrlInput,
    setActiveMediaSubTab,
    setHoveredYoutubeId,
    setShowYoutubeSearchResults,
    // Remote control setters
    setYoutubePlaying,
    setYoutubeOnDisplay,
    setActiveYoutubeVideo,
    setYoutubeCurrentTime,
    setYoutubeDuration,

    // Handlers
    handleAddYoutubeVideo,
    handleRemoveYoutubeVideo,
    handleYoutubeDisplay,
    handleYoutubeStop,
    playYoutubeVideo,
    searchYouTube,
    addVideoFromSearch,
    handleYoutubeInputSubmit,
    closeYoutubeSearchResults,
    extractYouTubeVideoId,
    isYouTubeUrl
  };
}
