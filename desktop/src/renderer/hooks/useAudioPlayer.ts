import { useCallback, useRef } from 'react';

interface AudioPlaylistTrack {
  path: string;
  name: string;
  duration?: number | null;
}

interface SetlistItem {
  id: string;
  type: string;
  audioPlaylist?: {
    tracks: AudioPlaylistTrack[];
    shuffle: boolean;
    name: string;
  };
  [key: string]: any;
}

interface AudioStatus {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
}

interface UseAudioPlayerCallbacks {
  setActiveAudio: React.Dispatch<React.SetStateAction<{ url: string; name: string } | null>>;
  setActiveAudioSetlistId: React.Dispatch<React.SetStateAction<string | null>>;
  setActivePlaylistId: React.Dispatch<React.SetStateAction<string | null>>;
  setActivePlaylistIndex: React.Dispatch<React.SetStateAction<number>>;
  setActivePlaylistOrder: React.Dispatch<React.SetStateAction<number[]>>;
  setAudioStatus: React.Dispatch<React.SetStateAction<AudioStatus>>;
  setAudioTargetVolume: React.Dispatch<React.SetStateAction<number>>;
  setEditingPlaylistItemId: React.Dispatch<React.SetStateAction<string | null>>;
  setEditingPlaylistTracks: React.Dispatch<React.SetStateAction<AudioPlaylistTrack[]>>;
  setEditingPlaylistName: React.Dispatch<React.SetStateAction<string>>;
  setEditingPlaylistShuffle: React.Dispatch<React.SetStateAction<boolean>>;
}

interface UseAudioPlayerState {
  audioTargetVolume: number;
  activePlaylistId: string | null;
  activePlaylistIndex: number;
  activePlaylistOrder: number[];
  setlist: SetlistItem[];
}

interface UseAudioPlayerRefs {
  audioRef: React.RefObject<HTMLAudioElement>;
  audioFadeRef: React.MutableRefObject<NodeJS.Timeout | null>;
  audioNeedsInitialPlay: React.MutableRefObject<boolean>;
}

// Audio fade constants
const AUDIO_FADE_DURATION = 500;
const AUDIO_FADE_STEPS = 20;

export function useAudioPlayer(
  state: UseAudioPlayerState,
  callbacks: UseAudioPlayerCallbacks,
  refs: UseAudioPlayerRefs
) {
  const {
    audioTargetVolume,
    activePlaylistId,
    activePlaylistIndex,
    activePlaylistOrder,
    setlist
  } = state;

  const {
    setActiveAudio,
    setActiveAudioSetlistId,
    setActivePlaylistId,
    setActivePlaylistIndex,
    setActivePlaylistOrder,
    setAudioStatus,
    setAudioTargetVolume,
    setEditingPlaylistItemId,
    setEditingPlaylistTracks,
    setEditingPlaylistName,
    setEditingPlaylistShuffle
  } = callbacks;

  const { audioRef, audioFadeRef, audioNeedsInitialPlay } = refs;

  // Play background audio (only in control panel, not on displays)
  const handlePlayAudio = useCallback((path: string, name: string) => {
    // Encode the path for media:// protocol
    // Use triple-slash format (media://file/path) for consistency
    const encodedPath = path
      .replace(/\\/g, '/')
      .split('/')
      .map(segment => encodeURIComponent(segment))
      .join('/');
    const audioUrl = `media://file/${encodedPath}`;

    audioNeedsInitialPlay.current = true; // Flag for onCanPlay to start playback
    setActiveAudio({ url: audioUrl, name });
    setAudioStatus({ currentTime: 0, duration: 0, isPlaying: false });
  }, [setActiveAudio, setAudioStatus, audioNeedsInitialPlay]);

  // Clear any ongoing fade
  const clearAudioFade = useCallback(() => {
    if (audioFadeRef.current) {
      clearInterval(audioFadeRef.current);
      audioFadeRef.current = null;
    }
  }, [audioFadeRef]);

  // Fade in audio
  const fadeInAudio = useCallback(() => {
    if (!audioRef.current) return;
    clearAudioFade();

    const stepTime = AUDIO_FADE_DURATION / AUDIO_FADE_STEPS;
    const volumeStep = audioTargetVolume / AUDIO_FADE_STEPS;
    audioRef.current.volume = 0;
    audioRef.current.play().catch(err => {
      console.error('Audio play error:', err);
    });

    let currentStep = 0;
    audioFadeRef.current = setInterval(() => {
      currentStep++;
      if (audioRef.current) {
        audioRef.current.volume = Math.min(volumeStep * currentStep, audioTargetVolume);
      }
      if (currentStep >= AUDIO_FADE_STEPS) {
        clearAudioFade();
      }
    }, stepTime);
  }, [audioTargetVolume, clearAudioFade, audioRef, audioFadeRef]);

  // Fade out audio and then execute callback
  const fadeOutAudio = useCallback((onComplete?: () => void) => {
    if (!audioRef.current) {
      onComplete?.();
      return;
    }
    clearAudioFade();

    const startVolume = audioRef.current.volume;
    if (startVolume === 0) {
      onComplete?.();
      return;
    }

    const stepTime = AUDIO_FADE_DURATION / AUDIO_FADE_STEPS;
    const volumeStep = startVolume / AUDIO_FADE_STEPS;

    let currentStep = 0;
    audioFadeRef.current = setInterval(() => {
      currentStep++;
      if (audioRef.current) {
        audioRef.current.volume = Math.max(startVolume - (volumeStep * currentStep), 0);
      }
      if (currentStep >= AUDIO_FADE_STEPS) {
        clearAudioFade();
        onComplete?.();
      }
    }, stepTime);
  }, [clearAudioFade, audioRef, audioFadeRef]);

  // Clear/stop background audio with fade out
  const handleClearAudio = useCallback(() => {
    fadeOutAudio(() => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setActiveAudio(null);
      setActiveAudioSetlistId(null); // Clear setlist tracking on manual stop
      setActivePlaylistId(null); // Clear playlist tracking
      setActivePlaylistIndex(0);
      setActivePlaylistOrder([]);
      setAudioStatus({ currentTime: 0, duration: 0, isPlaying: false });
    });
  }, [fadeOutAudio, audioRef, setActiveAudio, setActiveAudioSetlistId, setActivePlaylistId, setActivePlaylistIndex, setActivePlaylistOrder, setAudioStatus]);

  // Stable callbacks for memoized AudioPlayerBar
  const handleAudioPlayPause = useCallback(() => {
    if (audioRef.current) {
      if (audioRef.current.paused) {
        // Immediately update UI to show playing state
        setAudioStatus(prev => ({ ...prev, isPlaying: true }));
        fadeInAudio();
      } else {
        // Immediately update UI to show paused state (icon changes instantly)
        setAudioStatus(prev => ({ ...prev, isPlaying: false }));
        fadeOutAudio(() => {
          if (audioRef.current) {
            audioRef.current.pause();
          }
        });
      }
    }
  }, [fadeInAudio, fadeOutAudio, audioRef, setAudioStatus]);

  const handleAudioSeek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  }, [audioRef]);

  const handleAudioVolumeChange = useCallback((newVolume: number) => {
    setAudioTargetVolume(newVolume);
    if (audioRef.current && !audioFadeRef.current) {
      audioRef.current.volume = newVolume;
    }
  }, [setAudioTargetVolume, audioRef, audioFadeRef]);

  // Start playing an audio playlist (optionally from a specific track index)
  const startPlaylist = useCallback((playlistItem: SetlistItem, startFromTrackIndex?: number) => {
    if (!playlistItem.audioPlaylist || playlistItem.audioPlaylist.tracks.length === 0) return;

    const tracks = playlistItem.audioPlaylist.tracks;
    const shuffle = playlistItem.audioPlaylist.shuffle;

    // Create track order (shuffled or sequential)
    let order = tracks.map((_, idx) => idx);
    if (shuffle && startFromTrackIndex === undefined) {
      // Only shuffle if not starting from a specific track
      // Fisher-Yates shuffle
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
    } else if (startFromTrackIndex !== undefined) {
      // If starting from a specific track, reorder to start from that track
      // Put the selected track first, then continue sequentially
      order = [startFromTrackIndex, ...tracks.map((_, idx) => idx).filter(idx => idx !== startFromTrackIndex)];
    }

    setActivePlaylistId(playlistItem.id);
    setActivePlaylistOrder(order);
    setActivePlaylistIndex(0);
    setActiveAudioSetlistId(null); // Clear single-audio setlist tracking

    // Play the first track in order (which is the selected track if specified)
    const firstTrackIdx = order[0];
    const firstTrack = tracks[firstTrackIdx];
    handlePlayAudio(firstTrack.path, firstTrack.name);
  }, [handlePlayAudio, setActivePlaylistId, setActivePlaylistOrder, setActivePlaylistIndex, setActiveAudioSetlistId]);

  // Play next track in playlist (called when current track ends)
  const playNextPlaylistTrack = useCallback(() => {
    if (!activePlaylistId) return false;

    const playlistItem = setlist.find(item => item.id === activePlaylistId);
    if (!playlistItem?.audioPlaylist) return false;

    const tracks = playlistItem.audioPlaylist.tracks;
    const nextIndex = activePlaylistIndex + 1;

    if (nextIndex >= activePlaylistOrder.length) {
      // Playlist finished
      setActivePlaylistId(null);
      setActivePlaylistIndex(0);
      setActivePlaylistOrder([]);
      return false;
    }

    // Play next track
    setActivePlaylistIndex(nextIndex);
    const nextTrackIdx = activePlaylistOrder[nextIndex];
    const nextTrack = tracks[nextTrackIdx];
    handlePlayAudio(nextTrack.path, nextTrack.name);
    return true;
  }, [activePlaylistId, activePlaylistIndex, activePlaylistOrder, setlist, handlePlayAudio, setActivePlaylistId, setActivePlaylistIndex, setActivePlaylistOrder]);

  // Open edit playlist modal
  const openEditPlaylistModal = useCallback((item: SetlistItem) => {
    if (!item.audioPlaylist) return;
    setEditingPlaylistItemId(item.id);
    setEditingPlaylistTracks([...item.audioPlaylist.tracks]);
    setEditingPlaylistName(item.audioPlaylist.name);
    setEditingPlaylistShuffle(item.audioPlaylist.shuffle);
  }, [setEditingPlaylistItemId, setEditingPlaylistTracks, setEditingPlaylistName, setEditingPlaylistShuffle]);

  // Close edit playlist modal
  const closeEditPlaylistModal = useCallback(() => {
    setEditingPlaylistItemId(null);
    setEditingPlaylistTracks([]);
    setEditingPlaylistName('');
    setEditingPlaylistShuffle(false);
  }, [setEditingPlaylistItemId, setEditingPlaylistTracks, setEditingPlaylistName, setEditingPlaylistShuffle]);

  return {
    handlePlayAudio,
    clearAudioFade,
    fadeInAudio,
    fadeOutAudio,
    handleClearAudio,
    handleAudioPlayPause,
    handleAudioSeek,
    handleAudioVolumeChange,
    startPlaylist,
    playNextPlaylistTrack,
    openEditPlaylistModal,
    closeEditPlaylistModal
  };
}
