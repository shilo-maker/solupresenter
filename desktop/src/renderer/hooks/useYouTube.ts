import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../contexts/SettingsContext';

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

interface UseYouTubeCallbacks {
  setYoutubeVideos: React.Dispatch<React.SetStateAction<YouTubeVideo[]>>;
  setYoutubeUrlInput: React.Dispatch<React.SetStateAction<string>>;
  setYoutubeLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setYoutubeSearchLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setYoutubeSearchResults: React.Dispatch<React.SetStateAction<YouTubeSearchResult[]>>;
  setShowYoutubeSearchResults: React.Dispatch<React.SetStateAction<boolean>>;
  setActiveYoutubeVideo: React.Dispatch<React.SetStateAction<YouTubeVideo | null>>;
  setYoutubeOnDisplay: React.Dispatch<React.SetStateAction<boolean>>;
  setYoutubePlaying: React.Dispatch<React.SetStateAction<boolean>>;
  setYoutubeCurrentTime: React.Dispatch<React.SetStateAction<number>>;
  setYoutubeDuration: React.Dispatch<React.SetStateAction<number>>;
  setActiveMedia: React.Dispatch<React.SetStateAction<{ type: 'image' | 'video'; url: string } | null>>;
  setSetlist: React.Dispatch<React.SetStateAction<SetlistItem[]>>;
}

interface UseYouTubeState {
  youtubeVideos: YouTubeVideo[];
  youtubeUrlInput: string;
  activeYoutubeVideo: YouTubeVideo | null;
}

export function useYouTube(
  state: UseYouTubeState,
  callbacks: UseYouTubeCallbacks
) {
  const { t } = useTranslation();
  const { settings } = useSettings();

  const {
    youtubeVideos,
    youtubeUrlInput,
    activeYoutubeVideo
  } = state;

  const {
    setYoutubeVideos,
    setYoutubeUrlInput,
    setYoutubeLoading,
    setYoutubeSearchLoading,
    setYoutubeSearchResults,
    setShowYoutubeSearchResults,
    setActiveYoutubeVideo,
    setYoutubeOnDisplay,
    setYoutubePlaying,
    setYoutubeCurrentTime,
    setYoutubeDuration,
    setActiveMedia,
    setSetlist
  } = callbacks;

  // Extract YouTube video ID from various URL formats
  const extractYouTubeVideoId = useCallback((url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      /^([a-zA-Z0-9_-]{11})$/ // Direct video ID
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
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

      let data: any;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error('Failed to parse YouTube metadata response:', parseError);
        return fallback;
      }

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

    // Check if already added
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
  }, [youtubeUrlInput, youtubeVideos, extractYouTubeVideoId, fetchYouTubeMetadata, setYoutubeVideos, setYoutubeUrlInput, setYoutubeLoading]);

  // Remove a YouTube video from the list
  const handleRemoveYoutubeVideo = useCallback((videoId: string) => {
    setYoutubeVideos(prev => prev.filter(v => v.videoId !== videoId));
    if (activeYoutubeVideo?.videoId === videoId) {
      setActiveYoutubeVideo(null);
      setYoutubeOnDisplay(false);
    }
  }, [activeYoutubeVideo, setYoutubeVideos, setActiveYoutubeVideo, setYoutubeOnDisplay]);

  // Display a YouTube video on the viewer
  const handleYoutubeDisplay = useCallback(async (video: YouTubeVideo) => {
    setActiveYoutubeVideo(video);
    setYoutubeOnDisplay(true);
    // Clear any other active media
    setActiveMedia(null);

    // Broadcast to online viewers via socket
    window.electronAPI.youtubeLoad(video.videoId, video.title);
  }, [setActiveYoutubeVideo, setYoutubeOnDisplay, setActiveMedia]);

  // Stop YouTube playback
  const handleYoutubeStop = useCallback(() => {
    setActiveYoutubeVideo(null);
    setYoutubeOnDisplay(false);
    setYoutubePlaying(false);
    setYoutubeCurrentTime(0);
    setYoutubeDuration(0);

    // Broadcast stop to online viewers
    window.electronAPI.youtubeStop();
  }, [setActiveYoutubeVideo, setYoutubeOnDisplay, setYoutubePlaying, setYoutubeCurrentTime, setYoutubeDuration]);

  // Check if input looks like a YouTube URL
  const isYouTubeUrl = useCallback((input: string): boolean => {
    const urlPatterns = [
      /youtube\.com\/watch/,
      /youtu\.be\//,
      /youtube\.com\/embed\//,
      /^[a-zA-Z0-9_-]{11}$/ // Direct video ID
    ];
    return urlPatterns.some(pattern => pattern.test(input));
  }, []);

  // Search YouTube videos via IPC (main process handles the API call)
  const searchYouTube = useCallback(async (query: string) => {
    if (!query.trim()) return;

    setYoutubeSearchLoading(true);
    setShowYoutubeSearchResults(true);

    try {
      // Pass configurable timeout from settings (converted to milliseconds)
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
  }, [t, settings.youtubeSearchTimeout, setYoutubeSearchLoading, setShowYoutubeSearchResults, setYoutubeSearchResults]);

  // Add video from search results
  const addVideoFromSearch = useCallback((result: YouTubeSearchResult) => {
    // Check if already added
    if (youtubeVideos.some(v => v.videoId === result.videoId)) {
      return;
    }

    const video: YouTubeVideo = {
      videoId: result.videoId,
      title: result.title,
      thumbnail: result.thumbnail
    };

    setYoutubeVideos(prev => [...prev, video]);
  }, [youtubeVideos, setYoutubeVideos]);

  // Handle input submission - either add URL or search
  const handleYoutubeInputSubmit = useCallback(async () => {
    if (!youtubeUrlInput.trim()) return;

    if (isYouTubeUrl(youtubeUrlInput.trim())) {
      // It's a URL - add it directly to setlist
      const videoId = extractYouTubeVideoId(youtubeUrlInput.trim());
      if (!videoId) {
        alert(t('media.invalidYoutubeUrl') || 'Invalid YouTube URL');
        return;
      }

      setYoutubeLoading(true);
      const metadata = await fetchYouTubeMetadata(videoId);
      if (metadata) {
        // Add directly to setlist (like search results do)
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
      // It's a search query
      await searchYouTube(youtubeUrlInput.trim());
    }
  }, [youtubeUrlInput, isYouTubeUrl, extractYouTubeVideoId, fetchYouTubeMetadata, searchYouTube, t, setYoutubeLoading, setYoutubeUrlInput, setShowYoutubeSearchResults, setSetlist]);

  // Close search results
  const closeYoutubeSearchResults = useCallback(() => {
    setShowYoutubeSearchResults(false);
    setYoutubeSearchResults([]);
  }, [setShowYoutubeSearchResults, setYoutubeSearchResults]);

  return {
    extractYouTubeVideoId,
    fetchYouTubeMetadata,
    handleAddYoutubeVideo,
    handleRemoveYoutubeVideo,
    handleYoutubeDisplay,
    handleYoutubeStop,
    isYouTubeUrl,
    searchYouTube,
    addVideoFromSearch,
    handleYoutubeInputSubmit,
    closeYoutubeSearchResults
  };
}
