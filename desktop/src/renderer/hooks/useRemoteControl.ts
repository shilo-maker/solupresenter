import { useEffect, useRef } from 'react';
import { CombinedSlidesResult } from '../utils/slideUtils';
import { songIdToMidiHash, getSongHashInput, getItemHashInput, ITEM_TYPE_REVERSE_MAP } from '../utils/midiWriter';
import { useToast } from '../contexts/ToastContext';

interface Song {
  id: string;
  title: string;
  slides: Array<{
    originalText?: string;
    transliteration?: string;
    translation?: string;
    verseType?: string;
    [key: string]: any;
  }>;
}

interface Presentation {
  id: string;
  title: string;
  slides: any[];
  createdAt: string;
  updatedAt: string;
  quickModeData?: {
    type: string;
    subtitles?: any[];
    [key: string]: any;
  };
}

interface SetlistItem {
  id: string;
  type: 'song' | 'blank' | 'section' | 'countdown' | 'announcement' | 'messages' | 'media' | 'bible' | 'presentation' | 'youtube' | 'clock' | 'stopwatch' | 'audioPlaylist';
  song?: Song;
  presentation?: Presentation;
  title?: string;
  mediaPath?: string;
  mediaType?: 'image' | 'video' | 'audio';
  mediaName?: string;
  [key: string]: any;
}

type DisplayMode = 'bilingual' | 'original' | 'translation';

interface RemoteControlState {
  selectedSong: Song | null;
  selectedPresentation: Presentation | null;
  currentSlideIndex: number;
  currentPresentationSlideIndex: number;
  displayMode: DisplayMode;
  isBlank: boolean;
  setlist: SetlistItem[];
  currentContentType: 'song' | 'bible' | 'prayer' | 'presentation';
  viewerCount: number;
  combinedSlidesData: CombinedSlidesResult | null;
  selectedCombinedIndex: number;
  activeMedia: { type: 'image' | 'video'; url: string } | null;
  activeAudio: { url: string; name: string } | null;
  audioStatus: { isPlaying: boolean; currentTime: number; duration: number };
  audioTargetVolume: number;
  videoStatus: { isPlaying: boolean; currentTime: number; duration: number };
  videoVolume: number;
  youtubeOnDisplay: boolean;
  activeYoutubeVideo: { videoId: string; title: string; thumbnail: string } | null;
  youtubePlaying: boolean;
  youtubeCurrentTime: number;
  youtubeDuration: number;
  songs: Song[];
  translationLanguage: string;
}

interface RemoteControlCallbacks {
  nextSlide: () => void;
  prevSlide: () => void;
  goToSlide: (index: number, combinedIndices?: number[]) => void;
  goToPresentationSlide: (index: number, presOverride?: any) => void;
  toggleBlank: () => void;
  selectCombinedSlide: (index: number) => void;
  sendCurrentSlide: (song: Song, slideIndex: number, mode: DisplayMode, combinedIndices?: number[], contentType?: 'song' | 'bible' | 'prayer' | 'presentation') => void;
  handlePlayAudio: (path: string, name: string) => void;
  setSelectedSong: (song: Song | null) => void;
  setSelectedPresentation: (pres: Presentation | null) => void;
  setCurrentSlideIndex: (index: number) => void;
  setCurrentPresentationSlideIndex: (index: number) => void;
  setCurrentContentType: (type: 'song' | 'bible' | 'prayer' | 'presentation') => void;
  setIsBlank: (blank: boolean) => void;
  setLiveState: (state: { slideData: any; contentType: any; songId: string | null; slideIndex: number }) => void;
  setDisplayMode: (mode: DisplayMode) => void;
  setSetlist: (updater: (prev: SetlistItem[]) => SetlistItem[]) => void;
  setActiveMedia: (media: { type: 'image' | 'video'; url: string } | null) => void;
  setActiveAudio: (audio: { url: string; name: string } | null) => void;
  setActiveAudioSetlistId: (id: string | null) => void;
  setAudioStatus: (status: { currentTime: number; duration: number; isPlaying: boolean }) => void;
  setAudioTargetVolume: (volume: number) => void;
  setVideoStatus: (updater: (prev: { currentTime: number; duration: number; isPlaying: boolean }) => { currentTime: number; duration: number; isPlaying: boolean }) => void;
  setVideoVolume: (volume: number) => void;
  setYoutubePlaying: (playing: boolean) => void;
  setYoutubeOnDisplay: (on: boolean) => void;
  setActiveYoutubeVideo: (video: { videoId: string; title: string; thumbnail: string } | null) => void;
  setYoutubeCurrentTime: (time: number) => void;
  setYoutubeDuration: (duration: number) => void;
  setAutoPlayActive: (active: boolean) => void;
  setAutoPlayPresentation: (pres: any) => void;
  stopAutoPlay: () => void;
  setVideoLoop: (loop: boolean) => void;
  videoLoopRef: React.RefObject<boolean>;
  setActivePlaylistId: (id: string | null) => void;
  setActivePlaylistIndex: (index: number) => void;
  setActivePlaylistOrder: (order: number[]) => void;
}

interface RemoteControlRefs {
  audioRef: React.RefObject<HTMLAudioElement>;
  previewVideoRef: React.RefObject<HTMLVideoElement>;
}

export function useRemoteControl(
  state: RemoteControlState,
  callbacks: RemoteControlCallbacks,
  refs: RemoteControlRefs
) {
  const {
    selectedSong,
    selectedPresentation,
    currentSlideIndex,
    currentPresentationSlideIndex,
    displayMode,
    isBlank,
    setlist,
    currentContentType,
    viewerCount,
    combinedSlidesData,
    selectedCombinedIndex,
    activeMedia,
    activeAudio,
    audioStatus,
    audioTargetVolume,
    videoStatus,
    videoVolume,
    youtubeOnDisplay,
    activeYoutubeVideo,
    youtubePlaying,
    youtubeCurrentTime,
    youtubeDuration,
    songs,
    translationLanguage
  } = state;

  const {
    nextSlide,
    prevSlide,
    goToSlide,
    goToPresentationSlide,
    toggleBlank,
    selectCombinedSlide,
    sendCurrentSlide,
    handlePlayAudio,
    setSelectedSong,
    setSelectedPresentation,
    setCurrentSlideIndex,
    setCurrentPresentationSlideIndex,
    setCurrentContentType,
    setIsBlank,
    setLiveState,
    setDisplayMode,
    setSetlist,
    setActiveMedia,
    setActiveAudio,
    setActiveAudioSetlistId,
    setAudioStatus,
    setAudioTargetVolume,
    setVideoStatus,
    setVideoVolume,
    setYoutubePlaying,
    setYoutubeOnDisplay,
    setActiveYoutubeVideo,
    setYoutubeCurrentTime,
    setYoutubeDuration,
    setAutoPlayActive,
    setAutoPlayPresentation,
    stopAutoPlay,
    setVideoLoop,
    videoLoopRef,
    setActivePlaylistId,
    setActivePlaylistIndex,
    setActivePlaylistOrder
  } = callbacks;

  const { audioRef, previewVideoRef } = refs;
  const { showWarning } = useToast();
  const showWarningRef = useRef(showWarning);
  showWarningRef.current = showWarning;
  // Throttle: only show one "unknown song" warning per 10 seconds
  const lastUnknownSongWarning = useRef(0);
  // Generation counter: incremented on slide:blank/clear so async media lookups can cancel
  const mediaClearGen = useRef(0);
  // Timestamp of last media clear — suppress media re-activation for 3s after clear
  const lastMediaClearTime = useRef(0);
  // Ref for MIDI-identified presentation (bridges async identity → slide:goto race)
  const midiPresentationRef = useRef<any>(null);
  // Generation counter for identity lookups — prevents duplicate setlist adds from parallel async
  const identityGen = useRef(0);

  // ── Helper functions ──────────────────────────────────────────────────────

  function clearActiveVideo() {
    window.electronAPI.stopVideo();
    window.electronAPI.displayMedia({ type: 'video', url: '' });
    setVideoStatus(() => ({ currentTime: 0, duration: 0, isPlaying: false }));
    if (previewVideoRef.current) {
      previewVideoRef.current.pause();
      previewVideoRef.current.currentTime = 0;
    }
  }

  function clearActiveMediaOnDisplay() {
    if (activeMedia?.type === 'video') {
      clearActiveVideo();
    } else if (activeMedia?.type === 'image') {
      window.electronAPI.displayMedia({ type: 'image', url: '' });
    }
  }

  function resetPlaybackState() {
    stopAutoPlay();
    setVideoLoop(false);
    videoLoopRef.current = false;
  }

  function cleanupYoutube() {
    window.electronAPI.youtubeStop();
    setYoutubePlaying(false);
    setYoutubeOnDisplay(false);
    setActiveYoutubeVideo(null);
    setYoutubeCurrentTime(0);
    setYoutubeDuration(0);
  }

  function encodeMediaPath(filePath: string): string {
    const encoded = filePath
      .replace(/\\/g, '/')
      .split('/')
      .map(segment => encodeURIComponent(segment))
      .join('/');
    return `media://file/${encoded}`;
  }

  function selectPresentation(pres: any) {
    midiPresentationRef.current = pres;
    setActiveMedia(null);
    resetPlaybackState();
    setSelectedSong(null);
    setSelectedPresentation(pres);
    setCurrentPresentationSlideIndex(0);
    if (pres.quickModeData?.type === 'prayer' || pres.quickModeData?.type === 'sermon') {
      setCurrentContentType('prayer');
    } else {
      setCurrentContentType('presentation');
    }
    if (pres.slides.length === 0) {
      setIsBlank(true);
      window.electronAPI.sendSlide({ isBlank: true, displayMode });
    } else {
      setIsBlank(false);
      goToPresentationSlide(0, pres);
    }
  }

  function selectSongOrBible(song: Song, type: 'song' | 'bible', sendSlide: boolean = true) {
    midiPresentationRef.current = null;
    setSelectedPresentation(null);
    setActiveMedia(null);
    resetPlaybackState();
    setSelectedSong(song);
    setCurrentSlideIndex(0);
    setCurrentContentType(type);
    setIsBlank(false);
    if (sendSlide) {
      const slide = song.slides?.[0];
      if (slide) {
        setLiveState({
          slideData: { ...slide, originalLanguage: song.originalLanguage },
          contentType: type,
          songId: song.id,
          slideIndex: 0
        });
      }
      sendCurrentSlide(song, 0, displayMode, undefined, type);
    }
  }

  function showThrottledWarning(message: string) {
    const now = Date.now();
    if (now - lastUnknownSongWarning.current > 10_000) {
      lastUnknownSongWarning.current = now;
      showWarningRef.current(message);
    }
  }

  // ── End helper functions ──────────────────────────────────────────────────

  // Remote Control: Sync state to remote control server
  useEffect(() => {
    // Get current item info
    let currentItem = null;
    let totalSlides = 0;
    let slideIndex = currentSlideIndex;
    let slides: Array<{ index: number; preview: string; verseType?: string; isCombined?: boolean }> = [];

    if (selectedPresentation) {
      currentItem = {
        id: selectedPresentation.id,
        type: 'presentation',
        title: selectedPresentation.title || 'Untitled',
        slideCount: selectedPresentation.slides?.length || 0
      };
      totalSlides = selectedPresentation.slides?.length || 0;
      slideIndex = currentPresentationSlideIndex;
      // Build slides preview for presentations
      slides = (selectedPresentation.slides || []).map((slide, idx) => {
        // Get preview text from text boxes
        const textBoxes = slide.textBoxes || [];
        const previewText = textBoxes.map((tb: any) => tb.text || '').filter(Boolean).join(' ').slice(0, 60);
        return {
          index: idx,
          preview: previewText || `Slide ${idx + 1}`,
          verseType: `Slide ${idx + 1}`
        };
      });
    } else if (selectedSong) {
      currentItem = {
        id: selectedSong.id,
        type: currentContentType,
        title: selectedSong.title || 'Untitled',
        slideCount: selectedSong.slides?.length || 0
      };

      // Use combined slides when in original mode
      if (displayMode === 'original' && combinedSlidesData) {
        totalSlides = combinedSlidesData.combinedSlides.length;
        slideIndex = selectedCombinedIndex;
        slides = combinedSlidesData.combinedSlides.map((item, idx) => {
          if (item.type === 'combined' && item.slides) {
            // Combined slide - show both slides' text
            const preview = item.slides.map(s => s.originalText || '').join(' / ').slice(0, 80);
            return {
              index: idx,
              preview: preview,
              verseType: item.verseType || item.label,
              isCombined: true
            };
          } else {
            // Single slide
            const slide = item.slide;
            return {
              index: idx,
              preview: (slide?.originalText || '').slice(0, 60),
              verseType: item.verseType || item.label
            };
          }
        });
      } else {
        totalSlides = selectedSong.slides?.length || 0;
        // Build slides preview for songs/bible (bilingual/translation mode)
        slides = (selectedSong.slides || []).map((slide, idx) => ({
          index: idx,
          preview: (slide.originalText || slide.translation || '').slice(0, 60),
          verseType: slide.verseType || `Slide ${idx + 1}`
        }));
      }
    }

    // Build setlist summary for remote
    const setlistSummary = setlist.map(item => ({
      id: item.id,
      type: item.type,
      title: item.song?.title || item.presentation?.title || item.title || item.type
    }));

    // Collect active tools
    const activeTools: string[] = [];
    setlist.forEach(item => {
      if (item.type === 'countdown' || item.type === 'announcement' || item.type === 'clock' || item.type === 'stopwatch') {
        activeTools.push(item.type);
      }
    });

    // Build full slide data for direct broadcasting by main process
    // This allows remote control to work even when ControlPanel is not mounted
    let fullSlides: any[] = [];
    let songTitle = '';

    if (selectedPresentation) {
      fullSlides = selectedPresentation.slides || [];
      songTitle = selectedPresentation.title || '';
    } else if (selectedSong) {
      fullSlides = selectedSong.slides || [];
      songTitle = selectedSong.title || '';
    }

    // Update remote control state
    window.electronAPI.remoteControl.updateState({
      currentItem,
      currentSlideIndex: slideIndex,
      totalSlides,
      currentContentType,
      displayMode,
      isBlank,
      setlist: setlistSummary,
      slides,
      fullSlides,
      fullSetlist: setlist,  // Full setlist with song/presentation data for direct handling
      songTitle,
      activeTools,
      onlineViewerCount: viewerCount,
      activeMedia: activeMedia ? { type: activeMedia.type, name: activeMedia.url.split('/').pop() || 'Media' } : null,
      activeAudio: activeAudio ? {
        name: activeAudio.name,
        isPlaying: audioStatus.isPlaying,
        currentTime: audioStatus.currentTime,
        duration: audioStatus.duration,
        volume: audioTargetVolume
      } : null,
      activeVideo: (activeMedia && activeMedia.type === 'video') ? {
        name: decodeURIComponent(activeMedia.url.split('/').pop() || 'Video'),
        isPlaying: videoStatus.isPlaying,
        currentTime: videoStatus.currentTime,
        duration: videoStatus.duration,
        volume: videoVolume
      } : null,
      activeYoutube: (youtubeOnDisplay && activeYoutubeVideo) ? {
        videoId: activeYoutubeVideo.videoId,
        title: activeYoutubeVideo.title || 'YouTube Video',
        isPlaying: youtubePlaying,
        currentTime: youtubeCurrentTime,
        duration: youtubeDuration
      } : null,
      translationLanguage
    });
  }, [selectedSong, selectedPresentation, currentSlideIndex, currentPresentationSlideIndex, displayMode, isBlank, setlist, currentContentType, viewerCount, combinedSlidesData, selectedCombinedIndex, activeMedia, activeAudio, audioStatus, audioTargetVolume, videoStatus, videoVolume, youtubeOnDisplay, activeYoutubeVideo, youtubePlaying, youtubeCurrentTime, youtubeDuration, translationLanguage]);

  // Tell main process when ControlPanel mounts/unmounts for command handling
  useEffect(() => {
    window.electronAPI.remoteControl.setCommandHandlerActive(true);
    console.log('[useRemoteControl] Command handler registered');
    return () => {
      window.electronAPI.remoteControl.setCommandHandlerActive(false);
      console.log('[useRemoteControl] Command handler unregistered');
    };
  }, []); // Only run on mount/unmount

  // Remote Control: Listen for commands from mobile remote
  useEffect(() => {
    const unsubscribe = window.electronAPI.remoteControl.onCommand((command) => {
      switch (command.type) {
        case 'slide:next':
          nextSlide();
          break;
        case 'slide:prev':
          prevSlide();
          break;
        case 'slide:goto':
          if (command.payload?.index !== undefined) {
            const midiPres = midiPresentationRef.current;
            if (midiPres || ((currentContentType === 'presentation' || currentContentType === 'prayer') && selectedPresentation)) {
              goToPresentationSlide(command.payload.index, midiPres || undefined);
            } else if (displayMode === 'original' && combinedSlidesData) {
              selectCombinedSlide(command.payload.index);
            } else {
              goToSlide(command.payload.index);
            }
          }
          break;
        case 'slide:blank':
          if (activeMedia) {
            // Clear active media entirely (used as "Clear Media" from MIDI builder)
            mediaClearGen.current++;
            lastMediaClearTime.current = Date.now();
            if (activeMedia.type === 'video') {
              clearActiveVideo();
            }
            window.electronAPI.displayMedia({ type: activeMedia.type, url: '' });
            setActiveMedia(null);
          }
          if (youtubeOnDisplay) {
            cleanupYoutube();
          }
          // Stop auto-play and video loop when blanking
          resetPlaybackState();
          setIsBlank(true);
          window.electronAPI.sendBlank();
          break;
        case 'setlist:select':
          if (command.payload?.id) {
            // Find the item in the setlist and select it
            const item = setlist.find(s => s.id === command.payload.id);
            if (item) {
              // Clean up active video/image on display before switching items
              // Skip for audio items — handlePlayAudioWithMediaStop handles video muting
              const isAudioItem = item.type === 'media' && item.mediaType === 'audio';
              if (!isAudioItem) {
                clearActiveMediaOnDisplay();
              }
              if (item.type === 'song' && item.song) {
                selectSongOrBible(item.song, 'song');
              } else if (item.type === 'bible' && item.song) {
                selectSongOrBible(item.song, 'bible');
              } else if (item.type === 'presentation' && item.presentation) {
                selectPresentation(item.presentation);
              } else if (item.type === 'media' && item.mediaPath && item.mediaType) {
                if (item.mediaType === 'audio') {
                  // Audio: play in background audio player (not on display)
                  handlePlayAudio(item.mediaPath, item.mediaName || item.title || 'Audio');
                  setActiveAudioSetlistId(item.id);
                } else {
                  // Image/Video: display on screen
                  const mediaUrl = encodeMediaPath(item.mediaPath);
                  midiPresentationRef.current = null;
                  resetPlaybackState();
                  setSelectedSong(null);
                  setSelectedPresentation(null);
                  setActiveMedia({ type: item.mediaType as 'image' | 'video', url: mediaUrl });
                  setIsBlank(false);
                  window.electronAPI.displayMedia({ type: item.mediaType, url: mediaUrl });
                }
              }
            }
          }
          break;
        case 'song:identify':
          midiPresentationRef.current = null; // Clear presentation ref for song identity
          identityGen.current++; // Cancel any pending async identity lookups
          // Explicitly stop active media on display so displayManager.currentMedia is cleared
          clearActiveMediaOnDisplay();
          if (command.payload?.songHash !== undefined) {
            const targetHash = command.payload.songHash;
            const mediaClearActive = Date.now() - lastMediaClearTime.current < 3000;
            // 1. Search setlist for a matching song hash
            let found = false;
            for (const item of setlist) {
              const itemSong = item.type === 'song' ? item.song : item.type === 'bible' ? item.song : null;
              if (itemSong && songIdToMidiHash(getSongHashInput(itemSong.title, itemSong.slides)) === targetHash) {
                if (item.type === 'song' && item.song) {
                  selectSongOrBible(item.song, 'song', false);
                } else if (item.type === 'bible' && item.song) {
                  selectSongOrBible(item.song, 'bible', false);
                }
                found = true;
                break;
              }
            }
            // 2. Not in setlist — search all songs
            if (!found) {
              const matchedSong = songs.find(s => songIdToMidiHash(getSongHashInput(s.title, s.slides)) === targetHash);
              if (matchedSong) {
                setSetlist(prev => [...prev, { id: crypto.randomUUID(), type: 'song' as const, song: matchedSong }]);
                selectSongOrBible(matchedSong, 'song', false);
              } else if (!mediaClearActive) {
                // 3. Fallback: search all setlist items by hash (covers MIDI files without CC 3)
                // Skipped for 3s after media clear to prevent re-activation
                let fallbackFound = false;
                for (const item of setlist) {
                  if (item.type === 'song' || item.type === 'bible') continue; // already checked
                  const hashInput = getItemHashInput(item.type, item);
                  if (songIdToMidiHash(hashInput) === targetHash) {
                    if (item.type === 'presentation' && item.presentation) {
                      selectPresentation(item.presentation);
                    } else if (item.type === 'media' && item.mediaPath && item.mediaType) {
                      if (item.mediaType === 'audio') {
                        handlePlayAudio(item.mediaPath, item.mediaName || item.title || 'Audio');
                        setActiveAudioSetlistId(item.id);
                      } else {
                        const mediaUrl = encodeMediaPath(item.mediaPath);
                        // Don't clear selectedSong — MIDI media is an overlay, song resumes after clear
                        setActiveMedia({ type: item.mediaType as 'image' | 'video', url: mediaUrl });
                        setIsBlank(false);
                        window.electronAPI.displayMedia({ type: item.mediaType, url: mediaUrl });
                      }
                    }
                    fallbackFound = true;
                    break;
                  }
                }
                // 4. Not in setlist — search media library + presentations DB and auto-add if found
                if (!fallbackFound) {
                  const gen = mediaClearGen.current;
                  const idGen = identityGen.current;
                  Promise.all([
                    window.electronAPI.getMediaLibrary().catch(() => []),
                    window.electronAPI.getPresentations().catch(() => []),
                  ]).then(([mediaItems, presentations]) => {
                    if (mediaClearGen.current !== gen) return; // cancelled by slide:blank
                    if (identityGen.current !== idGen) return; // superseded by newer identity
                    // Search media library
                    for (const m of (mediaItems || [])) {
                      const hashInput = getItemHashInput('media', { mediaName: m.name, mediaPath: m.processedPath });
                      if (songIdToMidiHash(hashInput) === targetHash) {
                        const newItem = {
                          id: crypto.randomUUID(),
                          type: 'media' as const,
                          mediaType: m.type as 'video' | 'image' | 'audio',
                          mediaPath: m.processedPath,
                          mediaName: m.name,
                          mediaDuration: m.duration,
                          thumbnailPath: m.thumbnailPath,
                          title: m.name
                        };
                        setSetlist(prev => [...prev, newItem]);
                        if (m.type === 'audio') {
                          handlePlayAudio(m.processedPath, m.name || 'Audio');
                          setActiveAudioSetlistId(newItem.id);
                        } else {
                          const mediaUrl = encodeMediaPath(m.processedPath);
                          // Don't clear selectedSong — MIDI media is an overlay
                          setActiveMedia({ type: m.type as 'image' | 'video', url: mediaUrl });
                          setIsBlank(false);
                          window.electronAPI.displayMedia({ type: m.type, url: mediaUrl });
                        }
                        return; // found
                      }
                    }
                    // Search presentations DB
                    for (const p of (presentations || [])) {
                      const hashInput = getItemHashInput('presentation', { title: p.title });
                      if (songIdToMidiHash(hashInput) === targetHash) {
                        const newItem = {
                          id: crypto.randomUUID(),
                          type: 'presentation' as const,
                          presentation: p,
                          title: p.title
                        };
                        setSetlist(prev => [...prev, newItem]);
                        selectPresentation(p);
                        return; // found
                      }
                    }
                    // Still not found — show warning
                    showThrottledWarning('Unknown item from MIDI. Use "Import MIDI" in the setlist menu to add it first.');
                  });
                }
              }
            }
          }
          break;
        case 'item:identify':
          midiPresentationRef.current = null; // Clear stale ref for any item type
          identityGen.current++; // Cancel any pending async identity lookups
          // Explicitly stop active media on display so displayManager.currentMedia is cleared
          clearActiveMediaOnDisplay();
          if (command.payload?.itemHash !== undefined && command.payload?.itemType !== undefined) {
            const targetHash = command.payload.itemHash;
            const itemTypeName = ITEM_TYPE_REVERSE_MAP[command.payload.itemType];
            if (!itemTypeName) break;

            // For song/bible: fall through to existing song:identify logic
            if (itemTypeName === 'song' || itemTypeName === 'bible') {
              midiPresentationRef.current = null;
              let found = false;
              for (const item of setlist) {
                const itemSong = item.type === 'song' ? item.song : item.type === 'bible' ? item.song : null;
                if (itemSong && songIdToMidiHash(getSongHashInput(itemSong.title, itemSong.slides)) === targetHash) {
                  if (item.type === 'song' && item.song) {
                    selectSongOrBible(item.song, 'song', false);
                  } else if (item.type === 'bible' && item.song) {
                    selectSongOrBible(item.song, 'bible', false);
                  }
                  found = true;
                  break;
                }
              }
              if (!found) {
                showThrottledWarning('Unknown item from MIDI. Use "Import MIDI" to add it first.');
              }
              break;
            }

            // For other types: search setlist for matching type + hash
            // Skip media re-activation for 3s after clear
            if (itemTypeName === 'media' && Date.now() - lastMediaClearTime.current < 3000) break;
            let found = false;
            for (const item of setlist) {
              if (item.type !== itemTypeName) continue;
              const hashInput = getItemHashInput(itemTypeName, item);
              if (songIdToMidiHash(hashInput) === targetHash) {
                // Found matching item — select it via setlist:select logic
                if (item.type === 'presentation' && item.presentation) {
                  selectPresentation(item.presentation);
                } else if (item.type === 'media' && item.mediaPath && item.mediaType) {
                  if (item.mediaType === 'audio') {
                    handlePlayAudio(item.mediaPath, item.mediaName || item.title || 'Audio');
                    setActiveAudioSetlistId(item.id);
                  } else {
                    const mediaUrl = encodeMediaPath(item.mediaPath);
                    // Don't clear selectedSong — MIDI media is an overlay
                    setActiveMedia({ type: item.mediaType as 'image' | 'video', url: mediaUrl });
                    setIsBlank(false);
                    window.electronAPI.displayMedia({ type: item.mediaType, url: mediaUrl });
                  }
                }
                // For other action-based types (countdown, youtube, etc.)
                // just selecting the item is enough — the subsequent activate/pause/stop
                // commands will act on whatever is currently active
                found = true;
                break;
              }
            }
            if (!found && (itemTypeName === 'media' || itemTypeName === 'presentation')) {
              // Search media library / presentations DB and auto-add if found
              if (itemTypeName === 'media') {
                const gen = mediaClearGen.current;
                const idGen = identityGen.current;
                window.electronAPI.getMediaLibrary().then((mediaItems: any[]) => {
                  if (mediaClearGen.current !== gen) return; // cancelled by slide:blank
                  if (identityGen.current !== idGen) return; // superseded by newer identity
                  for (const m of (mediaItems || [])) {
                    const hashInput = getItemHashInput('media', { mediaName: m.name, mediaPath: m.processedPath });
                    if (songIdToMidiHash(hashInput) === targetHash) {
                      const newItem = {
                        id: crypto.randomUUID(),
                        type: 'media' as const,
                        mediaType: m.type as 'video' | 'image' | 'audio',
                        mediaPath: m.processedPath,
                        mediaName: m.name,
                        mediaDuration: m.duration,
                        thumbnailPath: m.thumbnailPath,
                        title: m.name
                      };
                      setSetlist(prev => [...prev, newItem]);
                      if (m.type === 'audio') {
                        handlePlayAudio(m.processedPath, m.name || 'Audio');
                        setActiveAudioSetlistId(newItem.id);
                      } else {
                        const mediaUrl = encodeMediaPath(m.processedPath);
                        // Don't clear selectedSong — MIDI media is an overlay
                        setActiveMedia({ type: m.type as 'image' | 'video', url: mediaUrl });
                        setIsBlank(false);
                        window.electronAPI.displayMedia({ type: m.type, url: mediaUrl });
                      }
                      return;
                    }
                  }
                  showThrottledWarning(`Unknown ${itemTypeName} from MIDI. Use "Import MIDI" to add it first.`);
                }).catch(() => {});
              } else if (itemTypeName === 'presentation') {
                const idGen = identityGen.current;
                window.electronAPI.getPresentations().then((presentations: any[]) => {
                  if (identityGen.current !== idGen) return; // superseded by newer identity
                  for (const p of (presentations || [])) {
                    const hashInput = getItemHashInput('presentation', { title: p.title });
                    if (songIdToMidiHash(hashInput) === targetHash) {
                      const newItem = {
                        id: crypto.randomUUID(),
                        type: 'presentation' as const,
                        presentation: p,
                        title: p.title
                      };
                      setSetlist(prev => [...prev, newItem]);
                      selectPresentation(p);
                      return;
                    }
                  }
                  showThrottledWarning(`Unknown presentation from MIDI. Use "Import MIDI" to add it first.`);
                }).catch(() => {});
              } else {
                showThrottledWarning(`Unknown ${itemTypeName} from MIDI. Add it to the setlist first.`);
              }
            } else if (!found) {
              showThrottledWarning(`Unknown ${itemTypeName} from MIDI. Add it to the setlist first.`);
            }
          }
          break;
        case 'item:activate':
          // Map to existing play/start commands based on current active item type
          if (activeMedia && activeMedia.type === 'video') {
            setVideoStatus(prev => ({ ...prev, isPlaying: true }));
            window.electronAPI.resumeVideo();
            if (previewVideoRef.current) previewVideoRef.current.play().catch(() => {});
          } else if (activeMedia && activeMedia.type === 'image') {
            // Images are static — no play/resume semantics (intentional no-op)
          } else if (youtubeOnDisplay) {
            setYoutubePlaying(true);
            window.electronAPI.youtubePlay(youtubeCurrentTime);
          } else if (audioRef.current && activeAudio) {
            audioRef.current.volume = audioTargetVolume;
            audioRef.current.play().catch(err => console.error('Failed to play audio:', err));
          } else if (selectedPresentation && !selectedPresentation.quickModeData && selectedPresentation.slides.length > 1) {
            setAutoPlayPresentation(selectedPresentation);
            setAutoPlayActive(true);
          } else if (midiPresentationRef.current && !midiPresentationRef.current.quickModeData && midiPresentationRef.current.slides.length > 1) {
            setAutoPlayPresentation(midiPresentationRef.current);
            setAutoPlayActive(true);
          }
          break;
        case 'item:pause':
          if (activeMedia && activeMedia.type === 'video') {
            setVideoStatus(prev => ({ ...prev, isPlaying: false }));
            window.electronAPI.pauseVideo();
            if (previewVideoRef.current) previewVideoRef.current.pause();
          } else if (activeMedia && activeMedia.type === 'image') {
            // Images are static — no pause semantics (intentional no-op)
          } else if (youtubeOnDisplay) {
            setYoutubePlaying(false);
            window.electronAPI.youtubePause(youtubeCurrentTime);
          } else if (audioRef.current) {
            audioRef.current.pause();
          }
          // Also stop presentation auto-play cycling if active
          stopAutoPlay();
          break;
        case 'item:stop':
          if (activeMedia && activeMedia.type === 'video') {
            clearActiveVideo();
            setActiveMedia(null);
            // If a song/presentation is underneath, re-send it; otherwise blank
            if (selectedSong || selectedPresentation) {
              setIsBlank(false);
            } else {
              setIsBlank(true);
              setLiveState({ slideData: null, contentType: null, songId: null, slideIndex: 0 });
              window.electronAPI.sendBlank();
            }
          } else if (activeMedia && activeMedia.type === 'image') {
            window.electronAPI.displayMedia({ type: 'image', url: '' });
            setActiveMedia(null);
            if (selectedSong || selectedPresentation) {
              setIsBlank(false);
            } else {
              setIsBlank(true);
              setLiveState({ slideData: null, contentType: null, songId: null, slideIndex: 0 });
              window.electronAPI.sendBlank();
            }
          } else if (youtubeOnDisplay) {
            cleanupYoutube();
          } else if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            setActiveAudio(null);
            setActiveAudioSetlistId(null);
            setActivePlaylistId(null);
            setActivePlaylistIndex(0);
            setActivePlaylistOrder([]);
            setAudioStatus({ currentTime: 0, duration: 0, isPlaying: false });
          } else if (selectedPresentation || midiPresentationRef.current) {
            // Presentation stop: blank the display
            setIsBlank(true);
            setLiveState({ slideData: null, contentType: null, songId: null, slideIndex: 0 });
            window.electronAPI.sendBlank();
          }
          // Reset loop and auto-play state when stopping any item
          resetPlaybackState();
          break;
        case 'item:loopOn':
          // Video loop and presentation auto-advance are mutually exclusive
          if (activeMedia && activeMedia.type === 'video') {
            setVideoLoop(true);
            videoLoopRef.current = true;
            window.electronAPI.setVideoLoop(true);
          } else if (selectedPresentation && !selectedPresentation.quickModeData && selectedPresentation.slides.length > 1) {
            // Presentation auto-advance — set presentation BEFORE activating to avoid race
            setAutoPlayPresentation(selectedPresentation);
            setAutoPlayActive(true);
          } else if (midiPresentationRef.current && !midiPresentationRef.current.quickModeData && midiPresentationRef.current.slides.length > 1) {
            setAutoPlayPresentation(midiPresentationRef.current);
            setAutoPlayActive(true);
          }
          break;
        case 'item:loopOff':
          setVideoLoop(false);
          videoLoopRef.current = false;
          window.electronAPI.setVideoLoop(false);
          stopAutoPlay();
          break;
        case 'mode:set':
          if (command.payload?.mode) {
            const newMode = command.payload.mode as DisplayMode;
            setDisplayMode(newMode);
            // Clear the screen and stop all active media when switching display modes
            if (activeMedia && activeMedia.type === 'video') {
              clearActiveVideo();
            }
            if (activeMedia) {
              window.electronAPI.displayMedia({ type: activeMedia.type, url: '' });
            }
            setActiveMedia(null);
            if (youtubeOnDisplay) {
              cleanupYoutube();
            }
            // Stop auto-play and video loop when switching modes
            resetPlaybackState();
            // Re-send current content with new display mode instead of blanking
            const activePres = selectedPresentation || midiPresentationRef.current;
            if (activePres && activePres.slides.length > 0) {
              goToPresentationSlide(currentPresentationSlideIndex, activePres);
            } else if (selectedSong) {
              // Song re-send is handled by existing useEffect in ControlPanel
              setIsBlank(false);
            } else {
              setIsBlank(true);
              setLiveState({ slideData: null, contentType: null, songId: null, slideIndex: 0 });
              window.electronAPI.sendBlank();
            }
          }
          break;
        case 'library:addSong':
          if (command.payload?.songId) {
            const song = songs.find(s => s.id === command.payload.songId);
            if (song) {
              setSetlist(prev => [...prev, { id: crypto.randomUUID(), type: 'song', song }]);
            }
          }
          break;
        case 'library:selectSong':
          if (command.payload?.songId) {
            const song = songs.find(s => s.id === command.payload.songId);
            if (song) {
              // Clean up active video/image on display before switching
              clearActiveMediaOnDisplay();
              selectSongOrBible(song, 'song');
            }
          }
          break;
        case 'library:addBible':
          if (command.payload?.book && command.payload?.chapter) {
            // Fetch Bible chapter and add to setlist
            window.electronAPI.getBibleVerses(command.payload.book, command.payload.chapter).then((result: any) => {
              if (result && result.slides && result.slides.length > 0) {
                // Filter slides if verse range is specified
                let filteredSlides = result.slides;
                const verseStart = command.payload.verseStart;
                const verseEnd = command.payload.verseEnd || verseStart;
                if (verseStart) {
                  filteredSlides = result.slides.filter((s: any) => {
                    // Extract verse number from verseType like "Genesis 1:5"
                    const verseMatch = s.verseType?.match(/:(\d+)$/);
                    const verseNum = verseMatch ? parseInt(verseMatch[1]) : 0;
                    return verseNum >= verseStart && verseNum <= (verseEnd || verseStart);
                  });
                }

                // Build title with verse range if specified
                let title = `${command.payload.book} ${command.payload.chapter}`;
                if (verseStart) {
                  title += `:${verseStart}`;
                  if (verseEnd && verseEnd > verseStart) {
                    title += `-${verseEnd}`;
                  }
                }

                const biblePassage: Song = {
                  id: crypto.randomUUID(),
                  title: title,
                  slides: filteredSlides
                };
                setSetlist(prev => [...prev, { id: crypto.randomUUID(), type: 'bible', song: biblePassage, title: biblePassage.title }]);
              }
            }).catch((err: any) => {
              console.error('[useRemoteControl] Error adding Bible from remote:', err);
            });
          }
          break;
        case 'library:selectBible':
          if (command.payload?.book && command.payload?.chapter) {
            window.electronAPI.getBibleVerses(command.payload.book, command.payload.chapter).then((result: any) => {
              if (result && result.slides && result.slides.length > 0) {
                const biblePassage: Song = {
                  id: crypto.randomUUID(),
                  title: `${command.payload.book} ${command.payload.chapter}`,
                  slides: result.slides
                };
                // Clean up active video/image on display before switching
                clearActiveMediaOnDisplay();
                selectSongOrBible(biblePassage, 'bible');
              }
            }).catch((err: any) => {
              console.error('[useRemoteControl] Error selecting Bible from remote:', err);
            });
          }
          break;
        case 'library:addMedia':
          if (command.payload?.mediaId) {
            window.electronAPI.getMediaLibraryItem(command.payload.mediaId).then((media: any) => {
              if (media) {
                setSetlist(prev => [...prev, {
                  id: crypto.randomUUID(),
                  type: 'media',
                  mediaType: media.type,
                  mediaPath: media.processedPath || media.originalPath,
                  mediaDuration: media.duration,
                  mediaName: media.name,
                  thumbnailPath: media.thumbnailPath,
                  title: media.name
                }]);
              }
            }).catch((err: any) => {
              console.error('[useRemoteControl] Error adding media from remote:', err);
            });
          }
          break;
        case 'library:selectMedia':
          if (command.payload?.mediaId) {
            window.electronAPI.getMediaLibraryItem(command.payload.mediaId).then((media: any) => {
              if (media) {
                // Display the media directly - convert to media:// protocol
                const filePath = media.processedPath || media.originalPath;
                const mediaUrl = encodeMediaPath(filePath);

                // Clean up active video/image on display before switching
                clearActiveMediaOnDisplay();
                midiPresentationRef.current = null;
                resetPlaybackState();
                setSelectedSong(null);
                setSelectedPresentation(null);
                setActiveMedia({ type: media.type as 'image' | 'video', url: mediaUrl });
                setIsBlank(false);
                window.electronAPI.displayMedia({ type: media.type, url: mediaUrl });
              }
            }).catch((err: any) => {
              console.error('[useRemoteControl] Error selecting media from remote:', err);
            });
          }
          break;
        case 'media:stop':
          // Stop displaying media and clear the active media state
          if (activeMedia?.type === 'video') {
            clearActiveVideo();
          }
          if (activeMedia) {
            window.electronAPI.displayMedia({ type: activeMedia.type, url: '' });
          }
          setActiveMedia(null);
          resetPlaybackState();
          setIsBlank(true);
          setLiveState({ slideData: null, contentType: null, songId: null, slideIndex: 0 });
          window.electronAPI.sendBlank();
          break;
        case 'audio:play':
          if (audioRef.current && activeAudio) {
            audioRef.current.volume = audioTargetVolume;
            audioRef.current.play().catch(err => console.error('Failed to play audio:', err));
          }
          break;
        case 'audio:pause':
          if (audioRef.current) {
            audioRef.current.pause();
          }
          break;
        case 'audio:stop':
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
          }
          setActiveAudio(null);
          setActiveAudioSetlistId(null);
          setActivePlaylistId(null);
          setActivePlaylistIndex(0);
          setActivePlaylistOrder([]);
          setAudioStatus({ currentTime: 0, duration: 0, isPlaying: false });
          break;
        case 'audio:volume':
          if (command.payload?.volume !== undefined) {
            const newVolume = Math.max(0, Math.min(1, command.payload.volume));
            setAudioTargetVolume(newVolume);
            if (audioRef.current) {
              audioRef.current.volume = newVolume;
            }
          }
          break;
        case 'audio:seek':
          if (command.payload?.time !== undefined && audioRef.current) {
            audioRef.current.currentTime = command.payload.time;
          }
          break;
        case 'video:play':
          setVideoStatus(prev => ({ ...prev, isPlaying: true }));
          window.electronAPI.resumeVideo();
          if (previewVideoRef.current) {
            previewVideoRef.current.play().catch(() => {});
          }
          break;
        case 'video:pause':
          setVideoStatus(prev => ({ ...prev, isPlaying: false }));
          window.electronAPI.pauseVideo();
          if (previewVideoRef.current) {
            previewVideoRef.current.pause();
          }
          break;
        case 'video:stop':
          clearActiveVideo();
          setActiveMedia(null);
          resetPlaybackState();
          setIsBlank(true);
          setLiveState({ slideData: null, contentType: null, songId: null, slideIndex: 0 });
          window.electronAPI.sendBlank();
          break;
        case 'video:seek':
          if (command.payload?.time !== undefined) {
            window.electronAPI.seekVideo(command.payload.time);
            if (previewVideoRef.current) {
              previewVideoRef.current.currentTime = command.payload.time;
            }
          }
          break;
        case 'video:volume':
          if (command.payload?.volume !== undefined) {
            const vol = Math.max(0, Math.min(1, command.payload.volume));
            setVideoVolume(vol);
            window.electronAPI.setVideoVolume(vol);
            // Also set preview video volume if exists
            if (previewVideoRef.current) {
              previewVideoRef.current.volume = vol;
            }
          }
          break;
        case 'video:mute':
          if (command.payload?.muted !== undefined) {
            window.electronAPI.muteVideo(!!command.payload.muted);
          }
          break;
        // YouTube controls
        case 'youtube:play':
          if (youtubeOnDisplay) {
            setYoutubePlaying(true);
            window.electronAPI.youtubePlay(youtubeCurrentTime);
          }
          break;
        case 'youtube:pause':
          if (youtubeOnDisplay) {
            setYoutubePlaying(false);
            window.electronAPI.youtubePause(youtubeCurrentTime);
          }
          break;
        case 'youtube:stop':
          if (youtubeOnDisplay) {
            cleanupYoutube();
          }
          break;
        case 'youtube:seek':
          if (youtubeOnDisplay && command.payload?.time !== undefined) {
            const seekTime = command.payload.time;
            setYoutubeCurrentTime(seekTime);
            window.electronAPI.youtubeSync(seekTime, youtubePlaying);
          }
          break;
        default:
          console.log('[useRemoteControl] Unknown remote command:', command.type);
      }
    });

    return unsubscribe;
  }, [nextSlide, prevSlide, goToSlide, goToPresentationSlide, toggleBlank, setlist, songs, selectedSong, selectedPresentation, currentSlideIndex, currentPresentationSlideIndex, displayMode, currentContentType, sendCurrentSlide, selectCombinedSlide, combinedSlidesData, handlePlayAudio, activeAudio, audioTargetVolume, activeMedia, youtubeOnDisplay, youtubeCurrentTime, youtubePlaying, activeYoutubeVideo, setSelectedSong, setSelectedPresentation, setCurrentSlideIndex, setCurrentPresentationSlideIndex, setCurrentContentType, setIsBlank, setLiveState, setDisplayMode, setSetlist, setActiveMedia, setActiveAudio, setActiveAudioSetlistId, setAudioStatus, setAudioTargetVolume, setVideoStatus, setVideoVolume, setYoutubePlaying, setYoutubeOnDisplay, setActiveYoutubeVideo, setYoutubeCurrentTime, setYoutubeDuration, setAutoPlayActive, setAutoPlayPresentation, setVideoLoop, videoLoopRef, setActivePlaylistId, setActivePlaylistIndex, setActivePlaylistOrder, audioRef, previewVideoRef]);

  // Remote Control: Listen for direct setlist additions from remote
  useEffect(() => {
    console.log('[useRemoteControl] Setting up onAddToSetlist listener');
    const unsubscribe = window.electronAPI.remoteControl.onAddToSetlist((item) => {
      console.log('[useRemoteControl] Received addToSetlist:', item.type, item.title);
      setSetlist(prev => {
        // Check if item already exists (by id) to avoid duplicates
        if (prev.some(existing => existing.id === item.id)) {
          console.log('[useRemoteControl] Item already exists, skipping');
          return prev;
        }
        console.log('[useRemoteControl] Adding item to setlist, new length:', prev.length + 1);
        return [...prev, item];
      });
    });
    return () => {
      console.log('[useRemoteControl] Cleaning up onAddToSetlist listener');
      unsubscribe();
    };
  }, [setSetlist]);

  // Remote Control: Sync setlist from server on mount (in case items were added while on different page)
  useEffect(() => {
    const syncSetlist = async () => {
      try {
        const serverSetlist = await window.electronAPI.remoteControl.getServerSetlist();
        if (serverSetlist && serverSetlist.length > 0) {
          console.log('[useRemoteControl] Syncing setlist from server:', serverSetlist.length, 'items');
          setSetlist(prev => {
            // Merge server items that we don't have
            const existingIds = new Set(prev.map(item => item.id));
            const newItems = serverSetlist.filter((item: any) => !existingIds.has(item.id));
            if (newItems.length > 0) {
              console.log('[useRemoteControl] Adding', newItems.length, 'items from server');
              return [...prev, ...newItems];
            }
            return prev;
          });
        }
      } catch (err) {
        console.error('[useRemoteControl] Error syncing setlist from server:', err);
      }
    };
    syncSetlist();
  }, [setSetlist]);
}
