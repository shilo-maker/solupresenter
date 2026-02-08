import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  Slide,
  SongArrangement,
  getSectionRanges,
  createDefaultArrangement,
  getSectionAbbreviation,
} from '../utils/arrangementUtils';
import { getVerseTypeColor } from '../utils/slideUtils';
import { generateMidiFile, MidiNoteEntry, songIdToMidiHash, encodeSongHash } from '../utils/midiWriter';

export interface ArrangedSlide {
  slide: Slide;
  originalIndex: number;
  verseType: string;
  sectionAbbr: string;
  color: string;
}

export function useMidiBuilderState() {
  // Song state
  const [songs, setSongs] = useState<any[]>([]);
  const [selectedSong, setSelectedSong] = useState<any | null>(null);
  const [arrangements, setArrangements] = useState<SongArrangement[]>([]);
  const [activeArrangementId, setActiveArrangementId] = useState<string | null>(null);
  const [arrangedSlides, setArrangedSlides] = useState<ArrangedSlide[]>([]);
  const [songSearchQuery, setSongSearchQuery] = useState('');
  const [showSongDropdown, setShowSongDropdown] = useState(false);

  // Audio state
  const [audioFilePath, setAudioFilePath] = useState<string | null>(null);
  const [audioFileName, setAudioFileName] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioLoadError, setAudioLoadError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timeUpdateRef = useRef<number>(0);
  // Track whether audio listeners are attached to avoid re-binding
  const audioListenersAttached = useRef(false);
  // Store listener references for cleanup
  const audioListenersRef = useRef<{ event: string; handler: EventListener }[]>([]);

  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const isExportingRef = useRef(false);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(-1);
  const currentSlideIndexRef = useRef(-1);
  // Each slide can have multiple timestamps (same slide triggered at different points)
  const [slideTimestamps, setSlideTimestamps] = useState<number[][]>([]);

  // Track pending song selection to handle race conditions
  const pendingSongIdRef = useRef<string | null>(null);

  // BPM
  const [bpm, setBpm] = useState(120);

  // Load songs on mount
  useEffect(() => {
    window.electronAPI.getSongs().then(setSongs).catch(console.error);
  }, []);

  // Resolve arranged slides when song or arrangement changes
  useEffect(() => {
    if (!selectedSong?.slides?.length) {
      setArrangedSlides([]);
      return;
    }

    const slides: Slide[] = selectedSong.slides;
    const activeArrangement = arrangements.find(a => a.id === activeArrangementId) || null;

    if (!activeArrangement) {
      const result: ArrangedSlide[] = slides.map((slide, i) => ({
        slide,
        originalIndex: i,
        verseType: slide.verseType || '',
        sectionAbbr: getSectionAbbreviation(slide.verseType || ''),
        color: getVerseTypeColor(slide.verseType),
      }));
      setArrangedSlides(result);
      return;
    }

    const ranges = getSectionRanges(slides);
    const result: ArrangedSlide[] = [];

    for (const section of activeArrangement.sections) {
      const range = ranges.get(section.verseType);
      if (range) {
        for (let i = range.start; i <= range.end; i++) {
          result.push({
            slide: slides[i],
            originalIndex: i,
            verseType: section.verseType,
            sectionAbbr: getSectionAbbreviation(section.verseType),
            color: getVerseTypeColor(section.verseType),
          });
        }
      }
    }

    setArrangedSlides(result);
  }, [selectedSong, arrangements, activeArrangementId]);

  // Reset timestamps when arrangement identity or slide count changes
  // Using activeArrangementId + selectedSong?.id + length to catch all cases
  useEffect(() => {
    setSlideTimestamps(Array.from({ length: arrangedSlides.length }, () => []));
    currentSlideIndexRef.current = -1;
    setCurrentSlideIndex(-1);
    setIsRecording(false);
    // Pause audio if it's playing during arrangement change
    const audio = audioRef.current;
    if (audio && !audio.paused) {
      audio.pause();
    }
  }, [arrangedSlides.length, activeArrangementId, selectedSong?.id]);

  // Attach audio event listeners via callback ref pattern
  // This runs once after mount when the <audio> element exists
  const setupAudioListeners = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || audioListenersAttached.current) return;
    audioListenersAttached.current = true;

    const onTimeUpdate = () => {
      const now = performance.now();
      // Throttled to 500ms — rAF in the page handles smooth visual updates
      if (now - timeUpdateRef.current < 500) return;
      timeUpdateRef.current = now;
      setAudioCurrentTime(audio.currentTime);
    };

    const onLoadedMetadata = () => {
      const dur = audio.duration;
      setAudioDuration(isFinite(dur) && dur > 0 ? dur : 0);
      setAudioLoadError(null);
    };

    const onPlay = () => setIsAudioPlaying(true);
    const onPause = () => {
      setIsAudioPlaying(false);
      setAudioCurrentTime(audio.currentTime);
    };
    const onEnded = () => {
      setIsAudioPlaying(false);
      setIsRecording(false);
      setAudioCurrentTime(audio.currentTime);
    };
    const onError = () => {
      setAudioLoadError('Failed to load audio file. Check the format is supported.');
      setAudioFileName(null);
      setAudioFilePath(null);
      setAudioDuration(0);
      setAudioCurrentTime(0);
      setIsRecording(false);
      setIsAudioPlaying(false);
      // Clear the DOM source to prevent further error events
      audio.src = '';
    };

    const listeners: { event: string; handler: EventListener }[] = [
      { event: 'timeupdate', handler: onTimeUpdate as EventListener },
      { event: 'loadedmetadata', handler: onLoadedMetadata as EventListener },
      { event: 'play', handler: onPlay as EventListener },
      { event: 'pause', handler: onPause as EventListener },
      { event: 'ended', handler: onEnded as EventListener },
      { event: 'error', handler: onError as EventListener },
    ];

    listeners.forEach(({ event, handler }) => audio.addEventListener(event, handler));
    audioListenersRef.current = listeners;
  }, []);

  // Setup listeners after first render (audio element exists by then)
  useEffect(() => {
    setupAudioListeners();
  }, [setupAudioListeners]);

  // Cleanup audio on unmount -- capture ref at setup time so it's valid in cleanup
  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      if (audio) {
        // Remove all event listeners
        audioListenersRef.current.forEach(({ event, handler }) =>
          audio.removeEventListener(event, handler)
        );
        audioListenersRef.current = [];
        audioListenersAttached.current = false;
        audio.pause();
        audio.src = '';
      }
    };
  }, []);

  // Select song (guards against re-selecting same song and race conditions)
  const selectSong = useCallback(async (song: any) => {
    // Close dropdown immediately regardless
    setShowSongDropdown(false);
    setSongSearchQuery('');

    // Guard against re-selecting the same song (prevents data loss)
    if (selectedSong?.id === song.id) return;

    // Track this request to handle rapid selection race condition
    pendingSongIdRef.current = song.id;

    try {
      const fullSong = await window.electronAPI.getSong(song.id);
      if (!fullSong) {
        console.error('Song not found:', song.id);
        return;
      }

      // Discard stale response if user selected a different song while loading
      if (pendingSongIdRef.current !== song.id) return;

      // Stop any active playback/recording when switching songs
      const audio = audioRef.current;
      if (audio) {
        if (!audio.paused) audio.pause();
        audio.currentTime = 0;
      }
      setAudioCurrentTime(0);
      setIsRecording(false);

      setSelectedSong(fullSong);

      // Set up arrangements - copy array to avoid mutating cached data
      const songArrangements: SongArrangement[] = [...(fullSong.arrangements || [])];
      if (songArrangements.length === 0 && fullSong.slides?.length) {
        const defaultArr = createDefaultArrangement(fullSong.slides);
        songArrangements.push(defaultArr);
      }
      setArrangements(songArrangements);
      setActiveArrangementId(songArrangements.length > 0 ? songArrangements[0].id : null);
    } catch (error) {
      console.error('Failed to load song:', error);
    }
  }, [selectedSong?.id]);

  // Load audio file
  const loadAudioFile = useCallback(async () => {
    const result = await window.electronAPI.showOpenDialog({
      filters: [
        { name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'] }
      ]
    });
    if (result.canceled || !result.filePaths.length) return;

    const filePath = result.filePaths[0];
    const fileName = filePath.split(/[\\/]/).pop() || 'audio';

    const encodedPath = filePath
      .replace(/\\/g, '/')
      .split('/')
      .map((segment: string) => encodeURIComponent(segment))
      .join('/');
    const audioUrl = `media://file/${encodedPath}`;

    // Reset recording state when loading new audio
    setIsRecording(false);
    currentSlideIndexRef.current = -1;
    setCurrentSlideIndex(-1);
    setAudioLoadError(null);
    setAudioCurrentTime(0);
    setSlideTimestamps(prev => Array.from({ length: prev.length }, () => []));
    setAudioFilePath(filePath);
    setAudioFileName(fileName);

    const audio = audioRef.current;
    if (audio) {
      audio.src = audioUrl;
      audio.load();
      // Ensure listeners are attached (in case ref wasn't ready at mount)
      setupAudioListeners();
    }
  }, [setupAudioListeners]);

  // Start recording from current audio position and current slide
  // User can seek + click a slide first, then hit record to start mid-song
  const startRecording = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audio.src || arrangedSlides.length === 0) return;

    // If no slide is selected yet, default to slide 0
    if (currentSlideIndexRef.current < 0) {
      currentSlideIndexRef.current = 0;
      setCurrentSlideIndex(0);
    }

    setIsRecording(true);
    audio.play().catch(() => {
      setIsRecording(false);
    });
  }, [arrangedSlides.length]);

  // Advance slide (called during recording)
  // Uses ref for current index to avoid nested setState
  const advanceSlide = useCallback(() => {
    if (!audioRef.current) return;
    const currentTime = audioRef.current.currentTime;
    if (!isFinite(currentTime)) return;

    const prevIndex = currentSlideIndexRef.current;
    const nextIndex = prevIndex + 1;

    if (nextIndex >= arrangedSlides.length) {
      setIsRecording(false);
      audioRef.current.pause();
      return;
    }

    currentSlideIndexRef.current = nextIndex;
    setCurrentSlideIndex(nextIndex);
    setSlideTimestamps(prev => {
      const next = [...prev];
      next[nextIndex] = [...next[nextIndex], currentTime];
      return next;
    });
  }, [arrangedSlides.length]);

  // Select a slide without changing its timestamp (for navigation / pre-record positioning)
  const selectSlide = useCallback((index: number) => {
    if (index < 0 || index >= arrangedSlides.length) return;
    currentSlideIndexRef.current = index;
    setCurrentSlideIndex(index);
  }, [arrangedSlides.length]);

  // Mark a specific slide's timestamp at the current audio time (appends — supports multiple)
  const markSlideTimestamp = useCallback((index: number) => {
    const audio = audioRef.current;
    if (!audio || !audio.src || index < 0 || index >= arrangedSlides.length) return;

    const currentTime = audio.currentTime;
    if (!isFinite(currentTime)) return;

    currentSlideIndexRef.current = index;
    setCurrentSlideIndex(index);
    setSlideTimestamps(prev => {
      const next = [...prev];
      next[index] = [...next[index], currentTime];
      return next;
    });
  }, [arrangedSlides.length]);

  // Clear a specific timestamp from a slide (by slide index and timestamp index within that slide)
  const clearSlideTimestamp = useCallback((slideIndex: number, timestampIndex: number) => {
    if (slideIndex < 0 || slideIndex >= arrangedSlides.length) return;
    setSlideTimestamps(prev => {
      if (timestampIndex < 0 || timestampIndex >= prev[slideIndex].length) return prev;
      const next = [...prev];
      next[slideIndex] = prev[slideIndex].filter((_, i) => i !== timestampIndex);
      return next;
    });
  }, [arrangedSlides.length]);

  // Play/Pause toggle
  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;

    if (audio.paused) {
      audio.play();
    } else {
      audio.pause();
    }
  }, []);

  // Stop — pauses audio and stops recording, but preserves timestamps and position
  const stopPlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    setIsRecording(false);
  }, []);

  // Seek audio to a specific time
  const seekTo = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;
    const dur = audio.duration;
    if (!isFinite(dur) || dur <= 0) return;
    const clamped = Math.max(0, Math.min(time, dur));
    audio.currentTime = clamped;
    setAudioCurrentTime(clamped);
  }, []);

  // Update a single timestamp by slide index + timestamp index (for timeline drag)
  const updateSlideTimestamp = useCallback((slideIndex: number, timestampIndex: number, newTime: number) => {
    if (!isFinite(newTime) || isNaN(newTime) || slideIndex < 0) return;
    const clamped = Math.max(0, Math.min(newTime, audioDuration || 0));

    setSlideTimestamps(prev => {
      if (slideIndex >= prev.length) return prev;
      if (timestampIndex < 0 || timestampIndex >= prev[slideIndex].length) return prev;
      const next = [...prev];
      const updated = [...prev[slideIndex]];
      updated[timestampIndex] = clamped;
      next[slideIndex] = updated;
      return next;
    });
  }, [audioDuration]);

  // Export MIDI
  const exportMidi = useCallback(async () => {
    if (isExportingRef.current) return;

    // Flatten all slide timestamps into MIDI note entries
    const recordedEntries: MidiNoteEntry[] = [];
    for (let i = 0; i < slideTimestamps.length; i++) {
      for (const time of slideTimestamps[i]) {
        recordedEntries.push({ noteNumber: i, time });
      }
    }
    if (recordedEntries.length === 0) {
      alert('No slide timings recorded yet.');
      return;
    }

    // Sort by time to ensure correct MIDI event ordering
    recordedEntries.sort((a, b) => a.time - b.time);

    // Clamp to MIDI note limit
    const midiNotes = recordedEntries.filter(e => e.noteNumber <= 127);
    if (midiNotes.length === 0) {
      alert('No valid MIDI notes to export.');
      return;
    }

    const songTitle = selectedSong?.title || 'arrangement';
    const safeName = songTitle.replace(/[^a-zA-Z0-9_\-\u0590-\u05FF ]/g, '_');

    // Set exporting early to prevent double-click opening two save dialogs
    isExportingRef.current = true;
    setIsExporting(true);

    const result = await window.electronAPI.showSaveDialog({
      defaultPath: `${safeName}_midi_arrangement.mid`,
      filters: [{ name: 'MIDI File', extensions: ['mid'] }]
    });

    if (result.canceled || !result.filePath) {
      isExportingRef.current = false;
      setIsExporting(false);
      return;
    }
    try {
      const duration = audioDuration || (midiNotes[midiNotes.length - 1].time + 5);

      // Encode song identity as 2 header notes in the C7+ range
      let songIdNotes: Array<{ noteNumber: number; velocity: number }> | undefined;
      if (selectedSong?.id) {
        const songHash = songIdToMidiHash(selectedSong.id);
        const { note1, note2 } = encodeSongHash(songHash);
        songIdNotes = [
          { noteNumber: note1.pitch, velocity: note1.velocity },
          { noteNumber: note2.pitch, velocity: note2.velocity },
        ];
      }

      const midiData = generateMidiFile(midiNotes, duration, bpm, songIdNotes);

      // Convert Uint8Array to base64 (chunked to avoid O(n²) string concat)
      const CHUNK = 8192;
      const chunks: string[] = [];
      for (let i = 0; i < midiData.length; i += CHUNK) {
        chunks.push(String.fromCharCode(...midiData.subarray(i, i + CHUNK)));
      }
      const base64 = btoa(chunks.join(''));

      await window.electronAPI.writeBinaryFile(result.filePath, base64);
      alert(`MIDI file exported successfully!\n${result.filePath}`);
    } catch (error) {
      console.error('Failed to export MIDI:', error);
      alert(`Failed to export MIDI file: ${error}`);
    } finally {
      isExportingRef.current = false;
      setIsExporting(false);
    }
  }, [slideTimestamps, selectedSong, audioDuration, bpm]);

  // Filtered songs for search (memoized)
  const filteredSongs = useMemo(() => {
    const query = songSearchQuery.trim().toLowerCase();
    if (!query) return songs;
    return songs.filter(s =>
      s.title?.toLowerCase().includes(query) ||
      s.artist?.toLowerCase().includes(query)
    );
  }, [songs, songSearchQuery]);

  // Check if at least one slide has a timestamp (memoized)
  const hasRecordedSlides = useMemo(
    () => slideTimestamps.some(arr => arr.length > 0),
    [slideTimestamps]
  );

  return {
    // Song
    songs: filteredSongs,
    selectedSong,
    arrangements,
    activeArrangementId,
    setActiveArrangementId,
    arrangedSlides,
    songSearchQuery,
    setSongSearchQuery,
    showSongDropdown,
    setShowSongDropdown,
    selectSong,

    // Audio
    audioRef,
    audioFilePath,
    audioFileName,
    audioDuration,
    audioCurrentTime,
    isAudioPlaying,
    audioLoadError,
    loadAudioFile,

    // Recording
    isRecording,
    currentSlideIndex,
    slideTimestamps,
    startRecording,
    advanceSlide,
    selectSlide,
    markSlideTimestamp,
    clearSlideTimestamp,
    togglePlayPause,
    stopPlayback,

    // Timeline
    seekTo,
    updateSlideTimestamp,

    // BPM
    bpm,
    setBpm,

    // Export
    exportMidi,
    isExporting,
    hasRecordedSlides,
  };
}
