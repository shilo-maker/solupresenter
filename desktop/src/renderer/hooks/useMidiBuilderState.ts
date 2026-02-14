import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  Slide,
  SongArrangement,
  getSectionRanges,
  createDefaultArrangement,
  getSectionAbbreviation,
} from '../utils/arrangementUtils';
import { getVerseTypeColor } from '../utils/slideUtils';
import {
  generateMidiFile, MidiNoteEntry, MidiItemPayload, songIdToMidiHash,
  getItemHashInput, encodeSongHash, BLANK_NOTE, ACTIVATE_NOTE, PAUSE_NOTE,
  STOP_NOTE, LOOP_ON_NOTE, LOOP_OFF_NOTE, ITEM_TYPE_MAP,
} from '../utils/midiWriter';
import { toHebrewNumerals } from '../utils/hebrewUtils';

export type MidiItemType = 'song' | 'presentation' | 'bible' | 'media' |
  'countdown' | 'youtube' | 'stopwatch' | 'clock' | 'announcement' | 'messages' | 'audioPlaylist';

export type MidiItemCategory = 'slide-based' | 'action-based';

export function getItemCategory(type: MidiItemType): MidiItemCategory {
  switch (type) {
    case 'song':
    case 'presentation':
    case 'bible':
      return 'slide-based';
    default:
      return 'action-based';
  }
}

/** Action card definition for action-based items */
export interface ActionCard {
  label: string;
  noteNumber: number;
  icon: string;
  color: string;
}

/** Get available action cards for a given item type */
export function getActionCards(type: MidiItemType): ActionCard[] {
  switch (type) {
    case 'media':
      return [
        { label: 'Play', noteNumber: ACTIVATE_NOTE, icon: '\u25B6', color: '#22c55e' },
        { label: 'Pause', noteNumber: PAUSE_NOTE, icon: '\u23F8', color: '#eab308' },
        { label: 'Stop', noteNumber: STOP_NOTE, icon: '\u23F9', color: '#ef4444' },
        { label: 'Clear', noteNumber: BLANK_NOTE, icon: '\u2715', color: '#a855f7' },
        { label: 'Loop ON', noteNumber: LOOP_ON_NOTE, icon: '\u21BB', color: '#3b82f6' },
        { label: 'Loop OFF', noteNumber: LOOP_OFF_NOTE, icon: '\u21BB', color: '#6b7280' },
      ];
    case 'youtube':
      return [
        { label: 'Play', noteNumber: ACTIVATE_NOTE, icon: '\u25B6', color: '#22c55e' },
        { label: 'Pause', noteNumber: PAUSE_NOTE, icon: '\u23F8', color: '#eab308' },
        { label: 'Stop', noteNumber: STOP_NOTE, icon: '\u23F9', color: '#ef4444' },
      ];
    case 'audioPlaylist':
      return [
        { label: 'Play', noteNumber: ACTIVATE_NOTE, icon: '\u25B6', color: '#22c55e' },
        { label: 'Pause', noteNumber: PAUSE_NOTE, icon: '\u23F8', color: '#eab308' },
        { label: 'Stop', noteNumber: STOP_NOTE, icon: '\u23F9', color: '#ef4444' },
      ];
    case 'countdown':
    case 'stopwatch':
      return [
        { label: 'Start', noteNumber: ACTIVATE_NOTE, icon: '\u25B6', color: '#22c55e' },
        { label: 'Stop', noteNumber: STOP_NOTE, icon: '\u23F9', color: '#ef4444' },
      ];
    case 'clock':
    case 'announcement':
    case 'messages':
      return [
        { label: 'Show', noteNumber: ACTIVATE_NOTE, icon: '\u25B6', color: '#22c55e' },
        { label: 'Clear', noteNumber: STOP_NOTE, icon: '\u23F9', color: '#ef4444' },
      ];
    default:
      return [];
  }
}

/** Extra action cards for slide-based items (e.g. presentation cycling) */
export function getExtraActionCards(type: MidiItemType): ActionCard[] {
  if (type === 'presentation') {
    return [
      { label: 'Cycle ON', noteNumber: LOOP_ON_NOTE, icon: '\u21BB', color: '#3b82f6' },
      { label: 'Cycle OFF', noteNumber: LOOP_OFF_NOTE, icon: '\u21BB', color: '#6b7280' },
    ];
  }
  return [];
}

export interface ArrangedSlide {
  slide: Slide;
  originalIndex: number;
  verseType: string;
  sectionAbbr: string;
  color: string;
  isBlank?: boolean;
  /** True for action pseudo-slides (activate/pause/stop) */
  isAction?: boolean;
  /** Label for action cards */
  actionLabel?: string;
  /** Icon for action cards */
  actionIcon?: string;
  /** Raw presentation slide data for thumbnail rendering (free-form presentations) */
  presentationSlide?: any;
  /** Prayer/sermon subtitle data for card rendering */
  prayerSubtitle?: any;
}

// Module-level constant — avoids re-creating the blank slide object on every render
const BLANK_ARRANGED_SLIDE: ArrangedSlide = {
  slide: { originalText: '', transliteration: '', translation: '', verseType: '' },
  originalIndex: -1,
  verseType: 'Blank',
  sectionAbbr: 'BLK',
  color: '#374151',
  isBlank: true,
};

export function useMidiBuilderState() {
  // Item type state
  const [selectedItemType, setSelectedItemType] = useState<MidiItemType>('song');
  const itemCategory = useMemo(() => getItemCategory(selectedItemType), [selectedItemType]);

  // Song state
  const [songs, setSongs] = useState<any[]>([]);
  const [selectedSong, setSelectedSong] = useState<any | null>(null);
  const [arrangements, setArrangements] = useState<SongArrangement[]>([]);
  const [activeArrangementId, setActiveArrangementId] = useState<string | null>(null);
  const [arrangedSlides, setArrangedSlides] = useState<ArrangedSlide[]>([]);
  const [songSearchQuery, setSongSearchQuery] = useState('');
  const [showSongDropdown, setShowSongDropdown] = useState(false);

  // Presentation state
  const [presentations, setPresentations] = useState<any[]>([]);
  const [selectedPresentation, setSelectedPresentation] = useState<any | null>(null);

  // Bible state
  const [bibleBooks, setBibleBooks] = useState<any[]>([]);
  const [selectedBibleBook, setSelectedBibleBook] = useState('');
  const [selectedBibleChapter, setSelectedBibleChapter] = useState<number | ''>('');
  const [bibleLoading, setBibleLoading] = useState(false);

  // Media state
  const [mediaLibrary, setMediaLibrary] = useState<any[]>([]);
  const [selectedMediaType, setSelectedMediaType] = useState<'video' | 'image' | 'audio'>('video');

  // Audio playlist state
  const [audioPlaylists, setAudioPlaylists] = useState<any[]>([]);

  // Generic item state (for action-based items picked from setlist or manual entry)
  const [selectedItem, setSelectedItem] = useState<any | null>(null);

  // Per-item background
  const [selectedBackground, setSelectedBackground] = useState<string>('');

  // Audio state
  const [audioFilePath, setAudioFilePath] = useState<string | null>(null);
  const [audioFileName, setAudioFileName] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioLoadError, setAudioLoadError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioFilePathRef = useRef<string | null>(null);
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

  // Load songs, presentations, bible books, and media on mount
  useEffect(() => {
    window.electronAPI.getSongs().then(setSongs).catch(console.error);
    window.electronAPI.getPresentations().then(setPresentations).catch(console.error);
    window.electronAPI.getBibleBooks().then((books: any) => setBibleBooks(books || [])).catch(console.error);
    window.electronAPI.getMediaLibrary().then((items: any) => setMediaLibrary(items || [])).catch(console.error);
    window.electronAPI.getAudioPlaylists().then((lists: any) => setAudioPlaylists(lists || [])).catch(console.error);
  }, []);

  // Resolve arranged slides when song/presentation/item or arrangement changes
  useEffect(() => {
    // Action-based items: build pseudo-slides from action cards
    if (itemCategory === 'action-based') {
      const cards = getActionCards(selectedItemType);
      if (!selectedItem && !selectedSong) {
        setArrangedSlides([]);
        return;
      }
      const result: ArrangedSlide[] = [
        BLANK_ARRANGED_SLIDE,
        ...cards.map(card => ({
          slide: { originalText: card.label, transliteration: '', translation: '', verseType: '' },
          originalIndex: card.noteNumber,
          verseType: card.label,
          sectionAbbr: card.label.slice(0, 3).toUpperCase(),
          color: card.color,
          isAction: true,
          actionLabel: card.label,
          actionIcon: card.icon,
        })),
      ];
      setArrangedSlides(result);
      return;
    }

    // Presentation slides
    if (selectedItemType === 'presentation' && selectedPresentation) {
      const isPrayerOrSermon = selectedPresentation.quickModeData?.type === 'prayer' ||
                                selectedPresentation.quickModeData?.type === 'sermon';
      const extraCards = getExtraActionCards('presentation');

      if (isPrayerOrSermon) {
        // Prayer/sermon: use subtitles as slides (cards)
        const subtitles = selectedPresentation.quickModeData?.subtitles || [];
        const result: ArrangedSlide[] = [
          BLANK_ARRANGED_SLIDE,
          ...subtitles.map((subtitle: any, i: number) => ({
            slide: { originalText: subtitle.subtitle || `Point ${i + 1}`, transliteration: '', translation: '', verseType: '' },
            originalIndex: i,
            verseType: `Point ${i + 1}`,
            sectionAbbr: `P${i + 1}`,
            color: '#8b5cf6',
            prayerSubtitle: subtitle,
          })),
          ...extraCards.map(card => ({
            slide: { originalText: card.label, transliteration: '', translation: '', verseType: '' },
            originalIndex: card.noteNumber,
            verseType: card.label,
            sectionAbbr: card.label.slice(0, 3).toUpperCase(),
            color: card.color,
            isAction: true,
            actionLabel: card.label,
            actionIcon: card.icon,
          })),
        ];
        setArrangedSlides(result);
      } else {
        // Free-form: use presentation slides with thumbnail data
        const presSlides = selectedPresentation.slides || [];
        const result: ArrangedSlide[] = [
          BLANK_ARRANGED_SLIDE,
          ...presSlides.map((slide: any, i: number) => {
            const textBoxes = slide.textBoxes || [];
            const previewText = textBoxes.map((tb: any) => tb.text || '').filter(Boolean).join(' ').slice(0, 80);
            return {
              slide: { originalText: previewText || `Slide ${i + 1}`, transliteration: '', translation: '', verseType: '' },
              originalIndex: i,
              verseType: `Slide ${i + 1}`,
              sectionAbbr: `S${i + 1}`,
              color: '#8b5cf6',
              presentationSlide: slide,
            };
          }),
          ...extraCards.map(card => ({
            slide: { originalText: card.label, transliteration: '', translation: '', verseType: '' },
            originalIndex: card.noteNumber,
            verseType: card.label,
            sectionAbbr: card.label.slice(0, 3).toUpperCase(),
            color: card.color,
            isAction: true,
            actionLabel: card.label,
            actionIcon: card.icon,
          })),
        ];
        setArrangedSlides(result);
      }
      return;
    }

    // Song/bible slides (existing logic)
    if (!selectedSong?.slides?.length) {
      setArrangedSlides([]);
      return;
    }

    const slides: Slide[] = selectedSong.slides;
    const activeArrangement = arrangements.find(a => a.id === activeArrangementId) || null;

    if (!activeArrangement) {
      const result: ArrangedSlide[] = [BLANK_ARRANGED_SLIDE, ...slides.map((slide, i) => ({
        slide,
        originalIndex: i,
        verseType: slide.verseType || '',
        sectionAbbr: getSectionAbbreviation(slide.verseType || ''),
        color: getVerseTypeColor(slide.verseType),
      }))];
      setArrangedSlides(result);
      return;
    }

    const ranges = getSectionRanges(slides);
    const result: ArrangedSlide[] = [BLANK_ARRANGED_SLIDE];

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
  }, [selectedSong, selectedPresentation, selectedItem, selectedItemType, itemCategory, arrangements, activeArrangementId]);

  // Reset timestamps when arrangement identity or slide count changes
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
  }, [arrangedSlides.length, activeArrangementId, selectedSong?.id, selectedPresentation?.id, selectedItem?.id, selectedItemType]);

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
      // Ignore errors when no file has been loaded by the user
      if (!audioFilePathRef.current) return;
      setAudioLoadError('Failed to load audio file. Check the format is supported.');
      setAudioFileName(null);
      setAudioFilePath(null);
      audioFilePathRef.current = null;
      setAudioDuration(0);
      setAudioCurrentTime(0);
      setIsRecording(false);
      setIsAudioPlaying(false);
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
      setSelectedPresentation(null);
      setSelectedItem(null);

      // Set up arrangements - copy array to avoid mutating cached data
      const songArrangements: SongArrangement[] = [...(fullSong.arrangements || [])];
      if (songArrangements.length === 0 && fullSong.slides?.length) {
        const defaultArr = createDefaultArrangement(fullSong.slides);
        // Only use default arrangement if it has sections (i.e. slides have verseType labels)
        if (defaultArr.sections.length > 0) {
          songArrangements.push(defaultArr);
        }
      }
      setArrangements(songArrangements);
      setActiveArrangementId(songArrangements.length > 0 ? songArrangements[0].id : null);
    } catch (error) {
      console.error('Failed to load song:', error);
    }
  }, [selectedSong?.id]);

  // Select presentation
  const selectPresentation = useCallback(async (pres: any) => {
    setShowSongDropdown(false);
    setSongSearchQuery('');
    if (selectedPresentation?.id === pres.id) return;

    try {
      const fullPres = await window.electronAPI.getPresentation(pres.id);
      if (!fullPres) return;

      const audio = audioRef.current;
      if (audio) {
        if (!audio.paused) audio.pause();
        audio.currentTime = 0;
      }
      setAudioCurrentTime(0);
      setIsRecording(false);

      setSelectedPresentation(fullPres);
      setSelectedSong(null);
      setSelectedItem(null);
      setArrangements([]);
      setActiveArrangementId(null);
    } catch (error) {
      console.error('Failed to load presentation:', error);
    }
  }, [selectedPresentation?.id]);

  // Select a generic action-based item (from manual entry / setlist)
  const selectActionItem = useCallback((item: any) => {
    setShowSongDropdown(false);
    setSongSearchQuery('');

    const audio = audioRef.current;
    if (audio) {
      if (!audio.paused) audio.pause();
      audio.currentTime = 0;
    }
    setAudioCurrentTime(0);
    setIsRecording(false);

    setSelectedItem(item);
    setSelectedSong(null);
    setSelectedPresentation(null);
    setArrangements([]);
    setActiveArrangementId(null);
  }, []);

  // Select a media item from the library
  const selectMediaItem = useCallback((mediaId: string) => {
    const item = mediaLibrary.find((m: any) => m.id === mediaId);
    if (!item) return;

    const audio = audioRef.current;
    if (audio) {
      if (!audio.paused) audio.pause();
      audio.currentTime = 0;
    }
    setAudioCurrentTime(0);
    setIsRecording(false);

    setSelectedItem({
      id: item.id,
      title: item.name,
      name: item.name,
      mediaType: item.type,
      mediaPath: item.processedPath,
      mediaDuration: item.duration,
      thumbnailPath: item.thumbnailPath,
    });
    setSelectedSong(null);
    setSelectedPresentation(null);
    setArrangements([]);
    setActiveArrangementId(null);
  }, [mediaLibrary]);

  // Handle media sub-type change — clear selected media item
  const handleMediaTypeChange = useCallback((type: 'video' | 'image' | 'audio') => {
    setSelectedMediaType(type);
    setSelectedItem(null);
  }, []);

  // Filtered media by selected sub-type
  const filteredMedia = useMemo(() => {
    return mediaLibrary.filter((m: any) => m.type === selectedMediaType);
  }, [mediaLibrary, selectedMediaType]);

  // Select an audio playlist
  const selectAudioPlaylist = useCallback((playlistId: string) => {
    const pl = audioPlaylists.find((p: any) => p.id === playlistId);
    if (!pl) return;

    const audio = audioRef.current;
    if (audio) {
      if (!audio.paused) audio.pause();
      audio.currentTime = 0;
    }
    setAudioCurrentTime(0);
    setIsRecording(false);

    setSelectedItem({
      id: pl.id,
      title: pl.name,
      name: pl.name,
      audioPlaylist: { name: pl.name, tracks: pl.tracks, shuffle: pl.shuffle },
    });
    setSelectedSong(null);
    setSelectedPresentation(null);
    setArrangements([]);
    setActiveArrangementId(null);
  }, [audioPlaylists]);

  // Bible book change — reset chapter
  const handleBibleBookChange = useCallback((book: string) => {
    setSelectedBibleBook(book);
    setSelectedBibleChapter('');
  }, []);

  // Fetch bible verses when book + chapter are both selected
  useEffect(() => {
    if (selectedItemType !== 'bible' || !selectedBibleBook || selectedBibleChapter === '') return;
    let cancelled = false;
    setBibleLoading(true);

    (async () => {
      try {
        const response = await window.electronAPI.getBibleVerses(selectedBibleBook, selectedBibleChapter as number);
        if (cancelled) return;

        const bookData = bibleBooks.find((b: any) => b.name === selectedBibleBook);
        const passage: any = {
          id: `bible-${selectedBibleBook}-${selectedBibleChapter}`,
          title: `${bookData?.hebrewName || selectedBibleBook} ${toHebrewNumerals(selectedBibleChapter as number)} (${selectedBibleChapter})`,
          slides: response.slides.map((slide: any, idx: number) => ({
            originalText: slide.originalText,
            transliteration: '',
            translation: slide.translation,
            verseType: `${idx + 1}`,
            reference: slide.reference,
            hebrewReference: slide.hebrewReference,
          })),
        };

        // Stop any active playback/recording
        const audio = audioRef.current;
        if (audio) {
          if (!audio.paused) audio.pause();
          audio.currentTime = 0;
        }
        setAudioCurrentTime(0);
        setIsRecording(false);

        setSelectedSong(passage);
        setSelectedPresentation(null);
        setSelectedItem(null);
        setArrangements([]);
        setActiveArrangementId(null);
      } catch (error) {
        console.error('Failed to fetch bible verses:', error);
      } finally {
        if (!cancelled) setBibleLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [selectedItemType, selectedBibleBook, selectedBibleChapter, bibleBooks]);

  // Handle item type change — clear selection
  const changeItemType = useCallback((type: MidiItemType) => {
    setSelectedItemType(type);
    setSelectedSong(null);
    setSelectedPresentation(null);
    setSelectedItem(null);
    setArrangements([]);
    setActiveArrangementId(null);
    setSelectedBackground('');
    setSongSearchQuery('');
    setShowSongDropdown(false);
    setSelectedBibleBook('');
    setSelectedBibleChapter('');
    setSelectedMediaType('video');
  }, []);

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
    audioFilePathRef.current = filePath;
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

    // Auto-timestamp the blank slide when recording starts at the beginning
    // (advanceSlide only marks the *next* slide, so slide 0 would never get a timestamp)
    const startIndex = currentSlideIndexRef.current;
    if (startIndex === 0 && arrangedSlides[0]?.isBlank) {
      const currentTime = audio.currentTime;
      setSlideTimestamps(prev => {
        const next = [...prev];
        if (next[0] && next[0].length === 0) {
          next[0] = [currentTime];
        }
        return next;
      });
    }

    setIsRecording(true);
    audio.play().catch(() => {
      setIsRecording(false);
    });
  }, [arrangedSlides]);

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

  // Add instant timestamp for non-song items (auto-assigns at 1-second intervals)
  const addInstantTimestamp = useCallback((index: number) => {
    if (index < 0 || index >= arrangedSlides.length) return;

    currentSlideIndexRef.current = index;
    setCurrentSlideIndex(index);
    setSlideTimestamps(prev => {
      let maxTime = -1;
      for (const ts of prev) {
        for (const t of ts) {
          if (t > maxTime) maxTime = t;
        }
      }
      const next = [...prev];
      next[index] = [...next[index], maxTime + 1];
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

  // Export MIDI (generalized for all item types)
  const exportMidi = useCallback(async () => {
    if (isExportingRef.current) return;

    // Flatten all slide/action timestamps into MIDI note entries
    // Blank slides use note 60, action pseudo-slides use their noteNumber directly,
    // real slides use their original song/presentation slide index
    const recordedEntries: MidiNoteEntry[] = [];
    for (let i = 0; i < slideTimestamps.length; i++) {
      const as = arrangedSlides[i];
      for (const time of slideTimestamps[i]) {
        let noteNumber: number;
        if (as?.isBlank) noteNumber = BLANK_NOTE;
        else if (as?.isAction) noteNumber = as.originalIndex; // action notes (61-65)
        else noteNumber = as?.originalIndex ?? i;
        recordedEntries.push({ noteNumber, time });
      }
    }
    if (recordedEntries.length === 0) {
      alert('No timings recorded yet.');
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

    // Determine title for file naming
    const itemTitle = selectedSong?.title || selectedPresentation?.title || selectedItem?.title || selectedItem?.name || selectedItemType;
    const safeName = itemTitle.replace(/[^a-zA-Z0-9_\-\u0590-\u05FF ]/g, '_');

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
      const duration = selectedItemType === 'song'
        ? (audioDuration || (midiNotes[midiNotes.length - 1].time + 5))
        : (midiNotes[midiNotes.length - 1].time + 2);

      // Compute item hash for identity header
      const activeItem = selectedSong || selectedPresentation || selectedItem;
      let songIdNotes: Array<{ noteNumber: number; velocity: number }> | undefined;
      if (activeItem) {
        const hashInput = getItemHashInput(selectedItemType, activeItem);
        const itemHash = songIdToMidiHash(hashInput);
        const { note1, note2 } = encodeSongHash(itemHash);
        songIdNotes = [
          { noteNumber: note1.pitch, velocity: note1.velocity },
          { noteNumber: note2.pitch, velocity: note2.velocity },
        ];
      }

      // Compute CC 3 value (omit for song for backward compat)
      const itemTypeCC = ITEM_TYPE_MAP[selectedItemType] ?? 0;

      // Build payload for embedding in the MIDI file
      const payload: MidiItemPayload = {
        title: itemTitle,
        slides: [],
        ...(selectedItemType !== 'song' && { itemType: selectedItemType }),
        ...(selectedBackground && { background: selectedBackground }),
      };

      // Type-specific payload data
      if (selectedItemType === 'song' && selectedSong) {
        payload.slides = (selectedSong.slides || []).map((s: any) => ({
          ...(s.originalText !== undefined && { originalText: s.originalText }),
          ...(s.transliteration !== undefined && { transliteration: s.transliteration }),
          ...(s.translation !== undefined && { translation: s.translation }),
          ...(s.translationOverflow !== undefined && { translationOverflow: s.translationOverflow }),
          ...(s.translations && { translations: s.translations }),
          ...(s.verseType !== undefined && { verseType: s.verseType }),
        }));
        if (selectedSong.author) payload.author = selectedSong.author;
        if (selectedSong.originalLanguage) payload.originalLanguage = selectedSong.originalLanguage;
        if (selectedSong.tags?.length) payload.tags = selectedSong.tags;
      } else if (selectedItemType === 'bible' && selectedSong) {
        payload.slides = (selectedSong.slides || []).map((s: any) => ({
          ...(s.originalText !== undefined && { originalText: s.originalText }),
          ...(s.transliteration !== undefined && { transliteration: s.transliteration }),
          ...(s.translation !== undefined && { translation: s.translation }),
          ...(s.verseType !== undefined && { verseType: s.verseType }),
        }));
      } else if (selectedItemType === 'presentation' && selectedPresentation) {
        payload.presentationSlides = selectedPresentation.slides;
        if (selectedPresentation.quickModeData) {
          payload.quickModeData = selectedPresentation.quickModeData;
          // For prayer/sermon: MIDI notes index into subtitles, not slides
          payload.slideCount = selectedPresentation.quickModeData.subtitles?.length || 0;
        }
      } else if (selectedItemType === 'media' && selectedItem) {
        payload.mediaType = selectedItem.mediaType;
        payload.mediaPath = selectedItem.mediaPath;
        payload.mediaDuration = selectedItem.mediaDuration;
        payload.mediaName = selectedItem.mediaName || selectedItem.name;
      } else if (selectedItemType === 'countdown' && selectedItem) {
        payload.countdownTime = selectedItem.countdownTime || selectedItem.time;
        payload.countdownMessage = selectedItem.countdownMessage || selectedItem.message;
      } else if (selectedItemType === 'youtube' && selectedItem) {
        payload.youtubeVideoId = selectedItem.youtubeVideoId || selectedItem.videoId;
        payload.youtubeTitle = selectedItem.youtubeTitle || selectedItem.title;
      } else if (selectedItemType === 'announcement' && selectedItem) {
        payload.announcementText = selectedItem.announcementText || selectedItem.text;
      } else if (selectedItemType === 'messages' && selectedItem) {
        payload.messages = selectedItem.messages;
        payload.messagesInterval = selectedItem.messagesInterval || selectedItem.interval;
      } else if (selectedItemType === 'audioPlaylist' && selectedItem) {
        payload.audioPlaylist = selectedItem.audioPlaylist;
      }

      const midiData = generateMidiFile(midiNotes, duration, bpm, songIdNotes, payload, itemTypeCC);

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
  }, [slideTimestamps, arrangedSlides, selectedSong, selectedPresentation, selectedItem, selectedItemType, selectedBackground, audioDuration, bpm]);

  // Filtered songs for search (memoized)
  const filteredSongs = useMemo(() => {
    const query = songSearchQuery.trim().toLowerCase();
    if (!query) return songs;
    return songs.filter(s =>
      s.title?.toLowerCase().includes(query) ||
      s.artist?.toLowerCase().includes(query)
    );
  }, [songs, songSearchQuery]);

  // Filtered presentations for search (memoized)
  const filteredPresentations = useMemo(() => {
    const query = songSearchQuery.trim().toLowerCase();
    if (!query) return presentations;
    return presentations.filter(p => p.title?.toLowerCase().includes(query));
  }, [presentations, songSearchQuery]);

  // Check if at least one slide has a timestamp (memoized)
  const hasRecordedSlides = useMemo(
    () => slideTimestamps.some(arr => arr.length > 0),
    [slideTimestamps]
  );

  // Current active item (regardless of type) for display
  const activeItemForDisplay = selectedSong || selectedPresentation || selectedItem;

  return {
    // Item type
    selectedItemType,
    itemCategory,
    changeItemType,

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

    // Presentation
    presentations: filteredPresentations,
    selectedPresentation,
    selectPresentation,

    // Bible
    bibleBooks,
    selectedBibleBook,
    selectedBibleChapter,
    bibleLoading,
    handleBibleBookChange,
    setSelectedBibleChapter,

    // Media
    selectedMediaType,
    handleMediaTypeChange,
    filteredMedia,
    selectMediaItem,

    // Audio playlists
    audioPlaylists,
    selectAudioPlaylist,

    // Generic item (action-based)
    selectedItem,
    selectActionItem,
    activeItemForDisplay,

    // Background
    selectedBackground,
    setSelectedBackground,

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
    addInstantTimestamp,
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
