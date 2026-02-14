import React, { useState, useEffect, useCallback, useRef, useMemo, memo, startTransition } from 'react';
import { createLogger } from '../utils/debug';

// Create logger for this module
const log = createLogger('ControlPanel');

import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSettings, CustomDisplayLines } from '../contexts/SettingsContext';
import { useSetlist, SetlistItem as ContextSetlistItem, SavedSetlist as ContextSavedSetlist } from '../contexts/SetlistContext';
import logoImage from '../assets/logo.png';
import AuthModal from '../components/AuthModal';
import BroadcastSelector from '../components/BroadcastSelector';
import MediaGrid from '../components/MediaGrid';
import SlidePreview from '../components/SlidePreview';
import SlideGridItem from '../components/control-panel/SlideGridItem';
import CombinedSlideGridItem from '../components/control-panel/CombinedSlideGridItem';
import AudioPlayerBar from '../components/control-panel/AudioPlayerBar';
import HeaderBar, { VirtualDisplay } from '../components/control-panel/HeaderBar';
import VerticalSidebar from '../components/control-panel/VerticalSidebar';
import AboutModal from '../components/control-panel/modals/AboutModal';
const VirtualDisplayModal = React.lazy(() => import('../components/control-panel/modals/VirtualDisplayModal'));
import VerseSectionNav from '../components/control-panel/VerseSectionNav';
import SlideControlButtons from '../components/control-panel/SlideControlButtons';
import AutoPlayControls from '../components/control-panel/AutoPlayControls';
import PrayerSlideItem from '../components/control-panel/PrayerSlideItem';
import PresentationSlideItem from '../components/control-panel/PresentationSlideItem';
import LivePreviewPanel from '../components/control-panel/LivePreviewPanel';
import ResizeHandle from '../components/control-panel/ResizeHandle';
import SlidesGrid from '../components/control-panel/SlidesGrid';
import BottomRowPanel from '../components/control-panel/BottomRowPanel';
const SongsPanel = React.lazy(() => import('../components/control-panel/panels/SongsPanel'));
const MediaPanel = React.lazy(() => import('../components/control-panel/panels/MediaPanel'));
const ToolsPanel = React.lazy(() => import('../components/control-panel/panels/ToolsPanel'));
const BiblePanel = React.lazy(() => import('../components/control-panel/panels/BiblePanel'));
const PresentationsPanel = React.lazy(() => import('../components/control-panel/panels/PresentationsPanel'));
const SetlistPanel = React.lazy(() => import('../components/control-panel/panels/SetlistPanel'));
import { createCombinedSlides, formatTime, getVerseTypeColor } from '../utils/slideUtils';
import { resolveTranslation } from '../utils/translationUtils';
import { parseMidiSongPayload, MidiItemPayload } from '../utils/midiWriter';
import { useRemoteControl } from '../hooks/useRemoteControl';
import { useKeyboardShortcuts, SECTION_KEY_MAP } from '../hooks/useKeyboardShortcuts';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
const SettingsPage = React.lazy(() => import('./SettingsPage'));
import { useQuickSlide } from '../hooks/useQuickSlide';
import { useToolsState } from '../hooks/useToolsState';
import { usePanelResize } from '../hooks/usePanelResize';
import { useYouTubeState, YouTubeVideo, YouTubeSearchResult } from '../hooks/useYouTubeState';
import { useThemeState } from '../hooks/useThemeState';
import { useBibleState } from '../hooks/useBibleState';
const KeyboardHelpModal = React.lazy(() => import('../components/control-panel/modals/KeyboardHelpModal'));
const QuickSlideModal = React.lazy(() => import('../components/control-panel/modals/QuickSlideModal'));
const ThemeEditorModal = React.lazy(() => import('../components/control-panel/modals/ThemeEditorModal'));
const NewThemeTypeModal = React.lazy(() => import('../components/control-panel/modals/NewThemeTypeModal'));
const SongEditorModal = React.lazy(() => import('../components/control-panel/modals/SongEditorModal'));
const SlideEditorModal = React.lazy(() => import('../components/control-panel/modals/SlideEditorModal'));
const EditPlaylistModal = React.lazy(() => import('../components/control-panel/modals/EditPlaylistModal'));
const TemplateSelectionModal = React.lazy(() => import('../components/control-panel/modals/TemplateSelectionModal'));
const PrayerEditorModal = React.lazy(() => import('../components/control-panel/modals/PrayerEditorModal'));
const SectionModal = React.lazy(() => import('../components/control-panel/modals/SectionModal'));
const SaveSetlistModal = React.lazy(() => import('../components/control-panel/modals/SaveSetlistModal'));
const LoadSetlistModal = React.lazy(() => import('../components/control-panel/modals/LoadSetlistModal'));
const UnsavedChangesModal = React.lazy(() => import('../components/control-panel/modals/UnsavedChangesModal'));
const SetlistContextMenu = React.lazy(() => import('../components/control-panel/modals/SetlistContextMenu'));
const ItemBackgroundModal = React.lazy(() => import('../components/control-panel/modals/ItemBackgroundModal'));
const CustomDisplayModal = React.lazy(() => import('../components/control-panel/modals/CustomDisplayModal'));
const QuickModeWizard = React.lazy(() => import('../components/control-panel/quick-mode/QuickModeWizard'));
const UpdateModal = React.lazy(() => import('../components/control-panel/modals/UpdateModal'));
import { SongItem, PresentationItem, ThemeItem } from '../components/control-panel/list-items';
import SlideCodeIndicator from '../components/control-panel/SlideCodeIndicator';
import { useSlideKeyboardNav } from '../hooks/useSlideKeyboardNav';
import { SlideCodeMap } from '../utils/slideCodeUtils';
import { useArrangementState } from '../hooks/useArrangementState';
import { SongArrangement, getSectionRanges } from '../utils/arrangementUtils';
import { DisplayAssignedType, isViewerLike } from '../components/control-panel/panels/types';
import {
  colors,
  buttonStyles,
  inputStyles,
  cardStyles,
  dropdownStyles,
  panelStyles,
  tabStyles,
  emptyStateStyles,
  flexStyles,
} from '../styles/controlPanelStyles';

interface Display {
  id: number;
  label: string;
  bounds: { x: number; y: number; width: number; height: number };
  isPrimary: boolean;
  isAssigned: boolean;
  assignedType?: DisplayAssignedType;
}

interface Song {
  id: string;
  title: string;
  originalLanguage?: string;
  tags?: string[];
  slides: Array<{
    originalText?: string;
    transliteration?: string;
    translation?: string;
    translationOverflow?: string;
    translations?: Record<string, string>;
    verseType?: string;
  }>;
  author?: string;
  arrangements?: SongArrangement[];
}

interface AudioPlaylistTrack {
  path: string;
  name: string;
  duration?: number | null;
}

interface SetlistItem {
  id: string;
  type: 'song' | 'blank' | 'section' | 'countdown' | 'announcement' | 'messages' | 'media' | 'bible' | 'presentation' | 'youtube' | 'clock' | 'stopwatch' | 'audioPlaylist';
  song?: Song;
  title?: string;
  // Tool-specific data
  countdownTime?: string;
  countdownMessage?: string;
  announcementText?: string;
  messages?: string[];
  messagesInterval?: number;
  // Media data
  mediaType?: 'video' | 'image' | 'audio';
  mediaPath?: string;
  mediaDuration?: number | null;
  mediaName?: string;
  thumbnailPath?: string | null;
  // Audio playlist data
  audioPlaylist?: {
    tracks: AudioPlaylistTrack[];
    shuffle: boolean;
    name: string;
  };
  // Presentation data
  presentation?: Presentation;
  // Bible data
  bibleData?: {
    book: string;
    chapter: number;
    verses?: any[];
  };
  displayMode?: 'bilingual' | 'original';
  // YouTube data
  youtubeVideoId?: string;
  youtubeTitle?: string;
  youtubeThumbnail?: string;
  // Per-item background override (viewer only)
  background?: string;
}

interface SavedSetlist {
  id: string;
  name: string;
  venue?: string;
  background?: string;
  items: SetlistItem[];
  createdAt: string;  // ISO timestamp string
  updatedAt?: string;
}

type DisplayMode = 'bilingual' | 'original' | 'translation';
type ResourcePanel = 'songs' | 'media' | 'tools' | 'bible' | 'presentations';

interface QuickModeMetadata {
  type: 'sermon' | 'prayer' | 'announcements';
  title: string;
  titleTranslation?: string;
  generateTranslation?: boolean;
  subtitles: Array<{
    subtitle: string;
    subtitleTranslation?: string;
    description?: string;
    descriptionTranslation?: string;
    bibleRef?: { reference: string; hebrewReference?: string };
  }>;
}

interface Presentation {
  id: string;
  title: string;
  slides: Array<{
    id: string;
    order: number;
    textBoxes: any[];
    imageBoxes?: any[];
    backgroundColor?: string;
    backgroundType?: 'color' | 'gradient' | 'transparent';
    backgroundGradient?: string;
  }>;
  canvasDimensions?: { width: number; height: number };
  createdAt: string;
  updatedAt: string;
  quickModeData?: QuickModeMetadata;
}

interface BibleBook {
  name: string;
  chapters: number;
  hebrewName?: string;
  testament?: 'old' | 'new';
}

interface BibleSlide {
  originalText: string;
  transliteration: string;
  translation: string;
  verseType: string;
  reference: string;
  hebrewReference: string;
}




const ControlPanel: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isHidden = location.pathname !== '/';
  const { t, i18n } = useTranslation();
  const { settings, updateSetting } = useSettings();
  const isRTL = i18n.language === 'he';

  // Setlist context (persists across navigation)
  const {
    setlist,
    setSetlist,
    currentSetlistId,
    setCurrentSetlistId,
    currentSetlistName,
    setCurrentSetlistName,
    setlistBackground,
    setSetlistBackground,
    hasUnsavedChanges,
    setHasUnsavedChanges,
    lastSavedSetlistRef,
    updateSavedSnapshot,
    clearSetlist: clearSetlistFromContext
  } = useSetlist();

  // Display state
  const [displays, setDisplays] = useState<Display[]>([]);
  const [controlDisplayId, setControlDisplayId] = useState<number | null>(null);

  // Content state
  const [songs, setSongs] = useState<Song[]>([]);
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [presentationSearchQuery, setPresentationSearchQuery] = useState('');
  const presentationSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const selectedSongRef = useRef<Song | null>(null);
  selectedSongRef.current = selectedSong;
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [selectedPresentation, setSelectedPresentation] = useState<Presentation | null>(null);
  const [currentPresentationSlideIndex, setCurrentPresentationSlideIndex] = useState(0);
  // Track what's actually "on air" for the live preview (separate from selected/staged content)
  // Combined into single object for atomic updates to prevent multiple re-renders
  const [liveState, setLiveState] = useState<{
    slideData: any;
    contentType: 'song' | 'bible' | 'prayer' | 'presentation' | null;
    songId: string | null;
    slideIndex: number;
  }>({ slideData: null, contentType: null, songId: null, slideIndex: 0 });
  // Destructure for easier access (these are derived, not separate state)
  const { slideData: rawLiveSlideData, contentType: liveContentType, songId: liveSongId, slideIndex: liveSlideIndex } = liveState;
  // Custom display mode state (declared before liveSlideData which depends on it)
  const [customModeActive, setCustomModeActive] = useState(false);
  const customModeActiveRef = useRef(false);
  useEffect(() => { customModeActiveRef.current = customModeActive; }, [customModeActive]);
  const [showCustomDisplayModal, setShowCustomDisplayModal] = useState(false);
  // Resolve translation in liveSlideData for control panel previews
  const liveSlideData = useMemo(() => {
    if (!rawLiveSlideData) return rawLiveSlideData;
    let data = rawLiveSlideData;
    if (rawLiveSlideData.translations) {
      const resolved = resolveTranslation(rawLiveSlideData, settings.translationLanguage);
      data = { ...rawLiveSlideData, translation: resolved.translation, translationOverflow: resolved.translationOverflow };
    }
    // Apply custom display mode remapping for preview
    if (customModeActive && data) {
      const config = settings.customDisplayLines;
      const resolveContent = (source: typeof config.line1): string => {
        if (source.type === 'original') return data.originalText || '';
        if (source.type === 'transliteration') return data.transliteration || '';
        if (source.type === 'translation') {
          if (source.lang && data.translations) {
            const r = resolveTranslation(data, source.lang);
            return r.translation || '';
          }
          return data.translation || '';
        }
        return '';
      };
      data = {
        ...data,
        originalText: resolveContent(config.line1),
        transliteration: resolveContent(config.line2),
        translation: resolveContent(config.line3),
        translationB: config.line4.type !== 'none' ? resolveContent(config.line4) : '',
        translationOverflow: ''
      };
    }
    return data;
  }, [rawLiveSlideData, settings.translationLanguage, customModeActive, settings.customDisplayLines]);
  // Auto-play state for presentations
  const [autoPlayActive, setAutoPlayActive] = useState(false);
  const [autoPlayInterval, setAutoPlayInterval] = useState(5); // seconds
  const autoPlayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoPlayActiveRef = useRef(false); // Ref for immediate checking in interval callback
  const [autoPlayPresentation, setAutoPlayPresentation] = useState<Presentation | null>(null); // Track which presentation is auto-playing
  // setlist state is now from SetlistContext
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [displayMode, setDisplayMode] = useState<DisplayMode>('bilingual');

  // Online state
  const [onlineConnected, setOnlineConnected] = useState(false);
  const [roomPin, setRoomPin] = useState<string | null>(null);
  const [viewerCount, setViewerCount] = useState(0);

  // MIDI bridge state
  const [midiBridgeConnected, setMidiBridgeConnected] = useState(false);
  const [midiControlEnabled, setMidiControlEnabled] = useState(true);

  // Streaming state
  const [isStreaming, setIsStreaming] = useState(false);

  // Auth state
  const [authState, setAuthState] = useState<{
    isAuthenticated: boolean;
    user: { id: string; email: string; role: string } | null;
    serverUrl: string;
  }>({ isAuthenticated: false, user: null, serverUrl: 'https://solupresenter.onrender.com' });
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Panel resize state (extracted to hook)
  const mainContentRef = useRef<HTMLDivElement>(null);
  const {
    leftPanelWidth,
    setlistPanelWidth,
    topRowHeight,
    isResizing,
    startResize
  } = usePanelResize(mainContentRef, isRTL);

  // UI state
  const [activeResourcePanel, setActiveResourcePanel] = useState<ResourcePanel>('songs');
  // Search uses debouncing for performance - input is uncontrolled for instant response
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isBlank, setIsBlank] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const importStatusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showDisplayPanel, setShowDisplayPanel] = useState(false);
  const [showThemePanel, setShowThemePanel] = useState(false);


  // Virtual displays state
  const [virtualDisplays, setVirtualDisplays] = useState<VirtualDisplay[]>(() => {
    try {
      const saved = localStorage.getItem('virtualDisplays');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [showVirtualDisplayModal, setShowVirtualDisplayModal] = useState(false);
  const [virtualDisplayLoading, setVirtualDisplayLoading] = useState(false);
  const [virtualDisplayError, setVirtualDisplayError] = useState<string | null>(null);

  // Public room state
  const [activePublicRoom, setActivePublicRoom] = useState<{ id: string; slug: string } | null>(() => {
    try {
      const saved = localStorage.getItem('activePublicRoom');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  // Slide code navigation state
  const [slideCodeMap, setSlideCodeMap] = useState<SlideCodeMap | null>(null);

  // Theme state (extracted to hook)
  const {
    themes,
    stageMonitorThemes,
    bibleThemes,
    prayerThemes,
    dualTranslationThemes,
    obsThemes,
    selectedTheme,
    selectedStageTheme,
    selectedBibleTheme,
    selectedPrayerTheme,
    selectedDualTranslationTheme,
    selectedOBSTheme,
    selectedOBSSongsTheme,
    selectedOBSBibleTheme,
    selectedOBSPrayerTheme,
    showThemeEditor,
    editingTheme,
    showNewThemeModal,
    setShowThemeEditor,
    setEditingTheme,
    setShowNewThemeModal,
    loadThemes,
    applyViewerTheme,
    applyStageTheme,
    applyBibleTheme: applyBibleThemeCallback,
    applyPrayerTheme: applyPrayerThemeCallback,
    applyOBSTheme: applyOBSThemeCallback,
    applyDualTranslationTheme,
    getMemoizedLivePreviewTheme
  } = useThemeState();
  const [currentContentType, setCurrentContentType] = useState<'song' | 'bible' | 'prayer' | 'presentation'>('song');

  // Song editor state
  const [showSongEditor, setShowSongEditor] = useState(false);
  const [editingSong, setEditingSong] = useState<{
    id?: string;
    title: string;
    author: string;
    originalLanguage: string;
    tags: string[];
    slides: Array<{ originalText: string; transliteration: string; translation: string; translationOverflow: string; verseType: string; translations?: Record<string, string> }>;
  } | null>(null);

  // Prayer/Sermon express editor state
  const [showPrayerEditor, setShowPrayerEditor] = useState(false);
  const [editingPrayerPresentation, setEditingPrayerPresentation] = useState<Presentation | null>(null);

  // Single slide editor state
  const [showSlideEditor, setShowSlideEditor] = useState(false);
  const [editingSlideIndex, setEditingSlideIndex] = useState<number | null>(null);
  const [isAddingNewSlide, setIsAddingNewSlide] = useState(false);

  // Inline song slide editor state - tracks which slide index is being edited (null = not editing)
  const [editingSongSlideIndex, setEditingSongSlideIndex] = useState<number | null>(null);

  // Tools state (extracted to hook)
  const {
    countdownTargetTime,
    setCountdownTargetTime,
    countdownRemaining,
    countdownMessage,
    setCountdownMessage,
    countdownMessageTranslation,
    setCountdownMessageTranslation,
    isCountdownActive,
    announcementText,
    setAnnouncementText,
    isAnnouncementActive,
    clockFormat,
    setClockFormat,
    clockShowDate,
    setClockShowDate,
    isClockActive,
    currentTime,
    stopwatchTime,
    isStopwatchRunning,
    isStopwatchActive,
    rotatingMessages,
    customMessageInput,
    setCustomMessageInput,
    rotatingInterval,
    setRotatingInterval,
    isRotatingMessagesActive,
    activeToolId,
    startCountdownFromTime,
    stopCountdown,
    showAnnouncement,
    hideAnnouncement,
    startClock,
    stopClock,
    startStopwatch,
    pauseStopwatch,
    resetStopwatch,
    stopStopwatchBroadcast,
    toggleMessageEnabled,
    addCustomMessage,
    removeCustomMessage,
    broadcastRotatingMessages,
    stopRotatingMessages,
    addCountdownToSetlist,
    addAnnouncementToSetlist,
    addMessagesToSetlist,
    stopAllTools,
    broadcastToolFromSetlist,
    memoizedTools,
    countdownIntervalRef,
    clockIntervalRef,
    stopwatchIntervalRef,
  } = useToolsState(setlist as any, setSetlist as any);

  // Keyboard shortcuts help
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);

  // Quick Slide state
  const [showQuickSlideModal, setShowQuickSlideModal] = useState(false);
  const [quickSlideText, setQuickSlideText] = useState('');
  const [quickSlideCount, setQuickSlideCount] = useState(0);
  const [quickSlideBroadcastIndex, setQuickSlideBroadcastIndex] = useState(-1);
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);

  // Background state
  const [selectedBackground, setSelectedBackground] = useState<string>('');
  const [showBackgroundDropdown, setShowBackgroundDropdown] = useState(false);
  const [activeItemBackground, setActiveItemBackground] = useState<string>('');
  const [itemBackgroundMuted, setItemBackgroundMuted] = useState(false);
  const itemBackgroundMutedRef = useRef(false);
  const pendingItemBackgroundRef = useRef<string>('');
  const selectedBackgroundRef = useRef<string>('');
  selectedBackgroundRef.current = selectedBackground;
  const setlistBackgroundRef = useRef<string>('');
  setlistBackgroundRef.current = setlistBackground;
  const quickSlideTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Fullscreen media state (takes over from slides when active)
  const [activeMedia, setActiveMedia] = useState<{ type: 'image' | 'video'; url: string } | null>(null);
  const [hoveredMediaStopId, setHoveredMediaStopId] = useState<string | null>(null);
  const [selectedSetlistMediaId, setSelectedSetlistMediaId] = useState<string | null>(null);
  const [hoveredSetlistItemId, setHoveredSetlistItemId] = useState<string | null>(null);
  const [setlistMenuOpen, setSetlistMenuOpen] = useState<string | null>(null);
  const [setlistContextMenu, setSetlistContextMenu] = useState<{ x: number; y: number; item: SetlistItem } | null>(null);
  const [contextMenuBackgroundItemId, setContextMenuBackgroundItemId] = useState<string | null>(null);
  const [selectedYoutubeItemId, setSelectedYoutubeItemId] = useState<string | null>(null);
  const [visibleSongsCount, setVisibleSongsCount] = useState(50); // Limit initial render for performance

  // Video playback control state
  const [videoLoop, setVideoLoop] = useState(false);
  const videoLoopRef = useRef(false);
  const [videoStatus, setVideoStatus] = useState<{ currentTime: number; duration: number; isPlaying: boolean }>({
    currentTime: 0,
    duration: 0,
    isPlaying: false
  });
  const [videoVolume, setVideoVolume] = useState(1); // 0-1 range
  const previewVideoRef = useRef<HTMLVideoElement>(null);

  // Audio (background music) state - plays only in control panel, not on displays
  const [activeAudio, setActiveAudio] = useState<{ url: string; name: string } | null>(null);
  const [activeAudioSetlistId, setActiveAudioSetlistId] = useState<string | null>(null); // Track which setlist item is playing
  const [audioStatus, setAudioStatus] = useState<{ currentTime: number; duration: number; isPlaying: boolean }>({
    currentTime: 0,
    duration: 0,
    isPlaying: false
  });
  const audioRef = useRef<HTMLAudioElement>(null);
  // Audio playlist state
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null); // Which playlist setlist item is playing
  const [activePlaylistIndex, setActivePlaylistIndex] = useState<number>(0); // Current track index
  const [activePlaylistOrder, setActivePlaylistOrder] = useState<number[]>([]); // Track order (shuffled or sequential)
  // Playlist editing state
  const [editingPlaylistItemId, setEditingPlaylistItemId] = useState<string | null>(null);
  const [editingPlaylistTracks, setEditingPlaylistTracks] = useState<AudioPlaylistTrack[]>([]);
  const [editingPlaylistName, setEditingPlaylistName] = useState('');
  const [editingPlaylistShuffle, setEditingPlaylistShuffle] = useState(false);
  const [expandedPlaylistIds, setExpandedPlaylistIds] = useState<Set<string>>(new Set()); // Track which playlists are expanded in setlist
  const [audioTargetVolume, setAudioTargetVolume] = useState(1);
  const audioFadeRef = useRef<NodeJS.Timeout | null>(null);
  const audioEndFadingRef = useRef(false); // Track if we're fading out at end
  const audioNeedsInitialPlay = useRef(false); // Track if we need to start playing on canplay
  // Throttle refs for time updates (prevents excessive re-renders)
  const lastAudioTimeUpdateRef = useRef<number>(0);
  const lastVideoTimeUpdateRef = useRef<number>(0);
  const TIME_UPDATE_THROTTLE_MS = 500; // Update UI at most twice per second

  // YouTube state (extracted to hook)
  const {
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
    setYoutubeUrlInput,
    setActiveMediaSubTab,
    setHoveredYoutubeId,
    setShowYoutubeSearchResults,
    setYoutubePlaying,
    setYoutubeOnDisplay,
    setActiveYoutubeVideo,
    setYoutubeCurrentTime,
    setYoutubeDuration,
    handleAddYoutubeVideo,
    handleRemoveYoutubeVideo,
    handleYoutubeDisplay,
    handleYoutubeStop,
    playYoutubeVideo,
    searchYouTube,
    addVideoFromSearch,
    handleYoutubeInputSubmit: youtubeInputSubmit,
    closeYoutubeSearchResults,
    extractYouTubeVideoId,
    isYouTubeUrl
  } = useYouTubeState(setActiveMedia);

  // Bible state (extracted to hook)
  const {
    bibleBooks,
    selectedBibleBook,
    selectedBibleChapter,
    bibleSlides,
    bibleLoading,
    biblePassage,
    bibleSearchQuery,
    setSelectedBibleBook,
    setSelectedBibleChapter,
    setBibleSearchQuery,
    fetchBibleBooks,
    handleBibleSearch
  } = useBibleState({
    setSelectedSong,
    setCurrentSlideIndex,
    setIsBlank,
    setCurrentContentType
  });

  // Arrangement state - callback to save arrangements to database
  const handleArrangementUpdate = useCallback(async (songId: string, arrangements: SongArrangement[]) => {
    try {
      await window.electronAPI.updateSong(songId, { arrangements });

      // Update local songs list
      setSongs(prev => prev.map(s =>
        s.id === songId ? { ...s, arrangements } : s
      ));

      // Update selected song if it's the one being edited
      setSelectedSong(prev => {
        if (prev?.id === songId) {
          return { ...prev, arrangements };
        }
        return prev;
      });

      // Update setlist items containing this song
      setSetlist(prev => prev.map(item => {
        if (item.type === 'song' && item.song?.id === songId) {
          return { ...item, song: { ...item.song, arrangements } };
        }
        return item;
      }));
    } catch (error) {
      console.error('Failed to update song arrangements:', error);
    }
  }, [setSetlist]);

  // Use arrangement state hook
  const arrangementState = useArrangementState(selectedSong, {
    onSongUpdate: handleArrangementUpdate
  });

  // Setlist persistence state
  const [savedSetlists, setSavedSetlists] = useState<SavedSetlist[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showSetlistMenu, setShowSetlistMenu] = useState(false);
  const [setlistMenuHover, setSetlistMenuHover] = useState(false);
  const [showSetlistBackgroundModal, setShowSetlistBackgroundModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  // Quick Mode wizard state
  interface QuickModeSubtitle {
    subtitle: string;
    subtitleTranslation?: string; // English translation of Hebrew subtitle
    description: string;
    descriptionTranslation?: string; // English translation of Hebrew description
    bibleRef?: {
      book: string;
      chapter: number;
      verseStart: number;
      verseEnd?: number;
      hebrewText: string;
      englishText: string;
      reference: string;
      hebrewReference: string; // Hebrew version of the reference (e.g., יוחנן ג:טז)
      useHebrew: boolean; // Whether to display Hebrew text in the presentation
    };
  }
  const [showQuickModeWizard, setShowQuickModeWizard] = useState(false);
  const [quickModeStep, setQuickModeStep] = useState(1);
  const [quickModeType, setQuickModeType] = useState<'sermon' | 'prayer' | 'announcements' | null>(null);
  // currentSetlistId, currentSetlistName, hasUnsavedChanges, lastSavedSetlistRef are now from SetlistContext
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: 'load' | 'clear' | 'new'; setlist?: SavedSetlist } | null>(null);
  const [showSectionModal, setShowSectionModal] = useState(false);

  // Drag and drop state
  const [draggedSong, setDraggedSong] = useState<Song | null>(null);
  const [draggedSetlistIndex, setDraggedSetlistIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [isDraggingMedia, setIsDraggingMedia] = useState(false);

  // Combined slides state (for original mode)
  const [selectedCombinedIndex, setSelectedCombinedIndex] = useState(0);

  // Handle navigation state (e.g., returning from presentation editor)
  useEffect(() => {
    const state = location.state as { activeTab?: ResourcePanel; editedPresentationId?: string } | null;
    if (state?.activeTab) {
      setActiveResourcePanel(state.activeTab);
    }

    // If returning from editing a presentation, refresh and select it
    if (state?.editedPresentationId) {
      const refreshAndSelect = async () => {
        try {
          // Reload presentations to get updated data
          const presentationList = await window.electronAPI.getPresentations();
          setPresentations(presentationList || []);

          // Find the edited presentation
          const editedPresentation = (presentationList || []).find(
            (p: Presentation) => p.id === state.editedPresentationId
          );

          if (editedPresentation) {
            // Select the presentation to show its slides
            setSelectedPresentation(editedPresentation);
            setSelectedSong(null);
            setCurrentContentType('presentation');
            setCurrentPresentationSlideIndex(0);

            // Also update the presentation in any setlist items that reference it
            setSetlist(prev => prev.map(item => {
              if (item.type === 'presentation' && item.presentation?.id === state.editedPresentationId) {
                return { ...item, presentation: editedPresentation };
              }
              return item;
            }));
          }
        } catch (error) {
          console.error('Failed to refresh presentations:', error);
        }
      };
      refreshAndSelect();
    }

    // Clear the state so it doesn't persist on refresh
    if (state?.activeTab || state?.editedPresentationId) {
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Load initial data
  useEffect(() => {
    loadDisplays();
    loadSongs();
    loadPresentations();
    loadSavedSetlists();
    loadThemes();
    initializeAuth();

    const cleanup = window.electronAPI.onDisplaysChanged((newDisplays) => {
      setDisplays(newDisplays);
    });

    const onlineCleanup = window.electronAPI.onOnlineStatusChanged((status) => {
      setOnlineConnected(status.connected);
      setRoomPin(status.roomPin || null);
      if (!status.connected) {
        setMidiBridgeConnected(false);
      }
    });

    const viewerCleanup = window.electronAPI.onViewerCountChanged((count) => {
      setViewerCount(count);
    });

    const midiCleanup = window.electronAPI.onMidiBridgeStatus((connected) => {
      setMidiBridgeConnected(connected);
      if (connected) {
        setMidiControlEnabled(true);
        window.electronAPI.setMidiControlEnabled(true);
      }
    });

    // Check streaming status on mount and listen for changes
    window.electronAPI.streaming?.getStatus().then((status) => {
      setIsStreaming(status?.isStreaming ?? false);
    }).catch(() => {});
    const streamingCleanup = window.electronAPI.streaming?.onStatus((status) => {
      setIsStreaming(prev => prev === status.isStreaming ? prev : status.isStreaming);
    });

    return () => {
      cleanup();
      onlineCleanup();
      viewerCleanup();
      midiCleanup();
      streamingCleanup?.();
      // Centralized interval cleanup - clear ALL interval refs
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      if (clockIntervalRef.current) {
        clearInterval(clockIntervalRef.current);
        clockIntervalRef.current = null;
      }
      if (stopwatchIntervalRef.current) {
        clearInterval(stopwatchIntervalRef.current);
        stopwatchIntervalRef.current = null;
      }
      if (audioFadeRef.current) {
        clearInterval(audioFadeRef.current);
        audioFadeRef.current = null;
      }
      if (importStatusTimeoutRef.current) {
        clearTimeout(importStatusTimeoutRef.current);
        importStatusTimeoutRef.current = null;
      }
      // Cleanup audio element to prevent memory leaks and stop playback
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current.load(); // Reset the audio element
      }
    };
  }, []);

  // Reload themes when returning from a theme editor page
  // ControlPanel stays mounted (hidden via CSS) when editor pages are open,
  // so we detect the transition from hidden->visible to refresh theme lists
  const wasHiddenRef = useRef(false);
  useEffect(() => {
    if (isHidden) {
      wasHiddenRef.current = true;
    } else if (wasHiddenRef.current) {
      wasHiddenRef.current = false;
      loadThemes();
    }
  }, [isHidden, loadThemes]);

  // Video status listener
  useEffect(() => {
    const statusCleanup = window.electronAPI.onVideoStatus((status) => {
      const now = Date.now();
      if (now - lastVideoTimeUpdateRef.current >= TIME_UPDATE_THROTTLE_MS) {
        lastVideoTimeUpdateRef.current = now;
        setVideoStatus(prev => ({
          ...prev,
          currentTime: status.currentTime,
          duration: status.duration
        }));
      }
    });

    const playingCleanup = window.electronAPI.onVideoPlaying((playing) => {
      setVideoStatus(prev => ({ ...prev, isPlaying: playing }));
    });

    const endedCleanup = window.electronAPI.onVideoEnded(() => {
      // Loop logic is handled by the preview video's onEnded event
      // This only handles the non-loop case for display status sync
      if (!videoLoopRef.current) {
        setVideoStatus(prev => ({ ...prev, isPlaying: false, currentTime: 0 }));
      }
    });

    // Listen for synchronized video start (when display is ready)
    const syncStartCleanup = window.electronAPI.onVideoSyncStart(() => {
      log('[ControlPanel] Video sync start received');
      const video = previewVideoRef.current;

      // Use the same sync pattern as seek: pause, seek to 0, then play together
      // This ensures both preview and display start from exact same position
      if (video) {
        video.pause();
      }
      window.electronAPI.pauseVideo();

      // Small delay to ensure pause takes effect
      setTimeout(() => {
        // Seek both to beginning
        if (video) {
          video.currentTime = 0;
        }
        window.electronAPI.seekVideo(0);

        // Play both after another small delay
        setTimeout(() => {
          // Send resume to display FIRST (IPC has latency)
          window.electronAPI.resumeVideo();

          // Small delay to let IPC command reach display, then play preview
          // This compensates for IPC latency so both start at same time
          setTimeout(() => {
            setVideoStatus(prev => ({ ...prev, isPlaying: true, currentTime: 0 }));
            if (video) {
              video.play().catch(err => console.error('Preview video play failed:', err));
            }
          }, 15);
        }, 150);
      }, 50);
    });

    return () => {
      statusCleanup();
      playingCleanup();
      endedCleanup();
      syncStartCleanup();
    };
  }, []);

  // Auto-play effect for presentation slides
  useEffect(() => {
    // Keep ref in sync with state for immediate checking in callbacks
    autoPlayActiveRef.current = autoPlayActive;

    // Clear any existing timer
    if (autoPlayTimerRef.current) {
      clearInterval(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }

    // Only run if auto-play is active and we have a tracked presentation
    if (autoPlayActive && autoPlayPresentation && !autoPlayPresentation.quickModeData && autoPlayPresentation.slides.length > 1) {
      autoPlayTimerRef.current = setInterval(() => {
        // Check ref immediately to prevent race condition when auto-play is stopped
        if (!autoPlayActiveRef.current) return;

        setCurrentPresentationSlideIndex(prevIndex => {
          const nextIndex = (prevIndex + 1) % autoPlayPresentation.slides.length;
          const slide = autoPlayPresentation.slides[nextIndex];

          // Update live preview state for the new slide
          setLiveState({
            slideData: slide,
            contentType: 'presentation',
            songId: autoPlayPresentation.id,
            slideIndex: nextIndex
          });

          // Send the slide to the display
          window.electronAPI.sendSlide({
            songId: autoPlayPresentation.id,
            slideIndex: nextIndex,
            displayMode: 'bilingual',
            isBlank: false,
            songTitle: autoPlayPresentation.title,
            presentationSlide: slide,
            backgroundImage: (!itemBackgroundMutedRef.current && pendingItemBackgroundRef.current) || (!itemBackgroundMutedRef.current && setlistBackgroundRef.current) || selectedBackgroundRef.current || ''
          });

          return nextIndex;
        });
      }, autoPlayInterval * 1000);
    }

    return () => {
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
    };
  }, [autoPlayActive, autoPlayInterval, autoPlayPresentation]);

  // Stop auto-play when YouTube starts playing
  useEffect(() => {
    if (youtubeOnDisplay && autoPlayActive) {
      autoPlayActiveRef.current = false; // Immediate stop for interval callback
      setAutoPlayActive(false);
      setAutoPlayPresentation(null);
    }
  }, [youtubeOnDisplay, autoPlayActive]);

  // Close dropdown panels when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Check if click is outside the panels
      if (showDisplayPanel && !target.closest('[data-panel="display"]')) {
        setShowDisplayPanel(false);
      }
      if (showThemePanel && !target.closest('[data-panel="theme"]')) {
        setShowThemePanel(false);
      }
      if (showBackgroundDropdown && !target.closest('[data-panel="background"]')) {
        setShowBackgroundDropdown(false);
      }
      // Collapse expanded playlists when clicking outside
      if (expandedPlaylistIds.size > 0) {
        const isInsidePlaylistArea = target.closest('[data-playlist-expanded]');
        const isInsideAudioPlayer = target.closest('[data-audio-player]');
        if (!isInsidePlaylistArea && !isInsideAudioPlayer) {
          setExpandedPlaylistIds(new Set());
        }
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showDisplayPanel, showThemePanel, showBackgroundDropdown, expandedPlaylistIds.size]);

  const loadDisplays = async () => {
    const displayList = await window.electronAPI.getDisplays();
    setDisplays(displayList);
    // Get current control window display
    const currentControlDisplay = await window.electronAPI.getControlWindowDisplay();
    setControlDisplayId(currentControlDisplay);
  };

  const loadSongs = useCallback(async () => {
    try {
      const songList = await window.electronAPI.getSongs();
      setSongs(songList || []);

      // Create a Map for O(1) lookups instead of O(n) find() calls
      const songsById = new Map((songList || []).map((s: Song) => [s.id, s]));

      // Update selectedSong with fresh data if it exists in the new list
      setSelectedSong(prev => {
        if (!prev) return null;
        return songsById.get(prev.id) || prev;
      });

      // Update setlist items with fresh song data
      setSetlist(prev => prev.map(item => {
        if (item.type === 'song' && item.song?.id) {
          const freshSong = songsById.get(item.song.id);
          if (freshSong) {
            return { ...item, song: freshSong };
          }
        }
        return item;
      }));
    } catch (error) {
      console.error('Failed to load songs:', error);
      setSongs([]);
    }
  }, [setSetlist]);

  const loadPresentations = useCallback(async () => {
    try {
      const presentationList = await window.electronAPI.getPresentations();
      setPresentations(presentationList || []);
    } catch (error) {
      console.error('Failed to load presentations:', error);
      setPresentations([]);
    }
  }, []);

  const loadSavedSetlists = async () => {
    try {
      const setlists = await window.electronAPI.getSetlists();
      setSavedSetlists(setlists || []);
    } catch (error) {
      console.error('Failed to load setlists:', error);
      setSavedSetlists([]);
    }
  };

  const handleCreateNewTheme = useCallback(() => {
    setShowNewThemeModal(true);
    setShowDisplayPanel(false);
  }, []);

  const handleCloseDisplayPanel = useCallback(() => {
    setShowDisplayPanel(false);
  }, []);

  const startEditingTheme = (theme?: any) => {
    if (theme) {
      // Edit existing theme
      const lineStyles = typeof theme.lineStyles === 'string'
        ? JSON.parse(theme.lineStyles)
        : theme.lineStyles || {};
      const viewerBg = typeof theme.viewerBackground === 'string'
        ? JSON.parse(theme.viewerBackground)
        : theme.viewerBackground || { type: 'color', color: '#000000' };
      setEditingTheme({
        id: theme.id,
        name: theme.name,
        viewerBackground: viewerBg,
        lineStyles: {
          original: { fontSize: lineStyles.original?.fontSize || 100, color: lineStyles.original?.color || '#FFFFFF', fontWeight: lineStyles.original?.fontWeight || '500' },
          transliteration: { fontSize: lineStyles.transliteration?.fontSize || 90, color: lineStyles.transliteration?.color || '#FFFFFF', fontWeight: lineStyles.transliteration?.fontWeight || '400' },
          translation: { fontSize: lineStyles.translation?.fontSize || 90, color: lineStyles.translation?.color || '#FFFFFF', fontWeight: lineStyles.translation?.fontWeight || '400' }
        }
      });
    } else {
      // Create new theme
      setEditingTheme({
        name: 'New Theme',
        viewerBackground: { type: 'color', color: '#1a1a2e' },
        lineStyles: {
          original: { fontSize: 100, color: '#FFFFFF', fontWeight: '500' },
          transliteration: { fontSize: 90, color: '#FFFFFF', fontWeight: '400' },
          translation: { fontSize: 90, color: '#FFFFFF', fontWeight: '400' }
        }
      });
    }
    setShowThemeEditor(true);
  };

  const saveTheme = async () => {
    if (!editingTheme) return;
    try {
      const themeData = {
        name: editingTheme.name,
        viewerBackground: editingTheme.viewerBackground,
        lineStyles: editingTheme.lineStyles
      };
      if (editingTheme.id) {
        await window.electronAPI.updateTheme(editingTheme.id, themeData);
      } else {
        await window.electronAPI.createTheme(themeData);
      }
      await loadThemes();
      setShowThemeEditor(false);
      setEditingTheme(null);
    } catch (error) {
      console.error('Failed to save theme:', error);
    }
  };

  const deleteThemeById = async (themeId: string) => {
    try {
      await window.electronAPI.deleteTheme(themeId);
      await loadThemes();
    } catch (error) {
      console.error('Failed to delete theme:', error);
    }
  };

  const deleteStageThemeById = async (themeId: string) => {
    try {
      await window.electronAPI.deleteStageTheme(themeId);
      await loadThemes();
    } catch (error) {
      console.error('Failed to delete stage theme:', error);
    }
  };

  // Song editor function - now simplified since SongEditorModal manages its own state
  const startEditingSong = useCallback((song?: Song) => {
    if (song) {
      setEditingSong({
        id: song.id,
        title: song.title,
        author: song.author || '',
        originalLanguage: song.originalLanguage || 'he',
        tags: song.tags || [],
        slides: song.slides.map(s => ({
          originalText: s.originalText || '',
          transliteration: s.transliteration || '',
          translation: s.translation || '',
          translationOverflow: s.translationOverflow || '',
          verseType: s.verseType || 'Verse',
          translations: s.translations || {}
        }))
      });
    } else {
      setEditingSong({
        title: 'New Song',
        author: '',
        originalLanguage: 'he',
        tags: [],
        slides: [{
          originalText: '',
          transliteration: '',
          translation: '',
          translationOverflow: '',
          verseType: 'Verse',
          translations: {}
        }]
      });
    }
    setShowSongEditor(true);
  }, []);

  // Prayer/Sermon editor functions
  const closePrayerEditor = useCallback(() => {
    setShowPrayerEditor(false);
    setEditingPrayerPresentation(null);
  }, []);

  const startEditingPrayerPresentation = useCallback((presentation: Presentation) => {
    if (!presentation.quickModeData) return;
    setEditingPrayerPresentation(presentation);
    setShowPrayerEditor(true);
    // Ensure Bible books are loaded for the editor
    if (bibleBooks.length === 0) {
      fetchBibleBooks();
    }
  }, [bibleBooks.length, fetchBibleBooks]);

  // Single slide editor functions - now uses inline card editor
  const handleEditSlide = useCallback((slideIndex: number) => {
    if (!selectedSong) return;
    // Set the specific slide index to edit
    setEditingSongSlideIndex(slideIndex);
  }, [selectedSong]);

  const handleAddSlide = useCallback(() => {
    if (!selectedSong) return;
    // -1 indicates adding a new slide
    setEditingSongSlideIndex(-1);
  }, [selectedSong]);

  // Save all slides from inline editor
  const handleSaveSongSlides = useCallback(async (updatedSlides: Array<{ originalText: string; transliteration: string; translation: string; translationOverflow: string; verseType: string; translations?: Record<string, string> }>) => {
    if (!selectedSong) return;

    try {
      // Save to database
      await window.electronAPI.updateSong(selectedSong.id, { slides: updatedSlides });

      // Refresh songs list from database
      await loadSongs();

      // Update local state
      const updatedSong = { ...selectedSong, slides: updatedSlides };
      setSelectedSong(updatedSong);

      // Update any setlist items containing this song
      setSetlist(prev => prev.map(item => {
        if (item.type === 'song' && item.song?.id === selectedSong.id) {
          return { ...item, song: { ...item.song, slides: updatedSlides } };
        }
        return item;
      }));

      // Re-broadcast if the current slide is live
      if (liveSongId === selectedSong.id && liveSlideIndex < updatedSlides.length) {
        const slide = updatedSlides[liveSlideIndex];
        const resolved = resolveTranslation(slide, settings.translationLanguage);
        const isCustom = customModeActiveRef.current;
        const customConfig = settings.customDisplayLines;
        const resolveCustom = (source: typeof customConfig.line1): string => {
          if (source.type === 'original') return slide.originalText || '';
          if (source.type === 'transliteration') return slide.transliteration || '';
          if (source.type === 'translation') {
            if (source.lang && slide.translations) return resolveTranslation(slide, source.lang).translation || '';
            return resolved.translation || '';
          }
          return '';
        };
        window.electronAPI.sendSlide({
          songId: selectedSong.id,
          slideIndex: liveSlideIndex,
          displayMode: isCustom ? 'bilingual' : displayMode,
          isBlank: false,
          songTitle: selectedSong.title,
          contentType: 'song',
          backgroundImage: (!itemBackgroundMutedRef.current && pendingItemBackgroundRef.current) || (!itemBackgroundMutedRef.current && setlistBackgroundRef.current) || selectedBackgroundRef.current || '',
          slideData: isCustom ? {
            originalText: resolveCustom(customConfig.line1),
            transliteration: resolveCustom(customConfig.line2),
            translation: resolveCustom(customConfig.line3),
            translationB: customConfig.line4.type !== 'none' ? resolveCustom(customConfig.line4) : '',
            translationOverflow: '',
            verseType: slide.verseType,
            originalLanguage: selectedSong.originalLanguage || 'he'
          } : {
            originalText: slide.originalText,
            transliteration: slide.transliteration,
            translation: resolved.translation,
            translationOverflow: resolved.translationOverflow,
            verseType: slide.verseType,
            originalLanguage: selectedSong.originalLanguage || 'he'
          }
        });
        // Update live preview state
        setLiveState({
          slideData: { ...slide, originalLanguage: selectedSong.originalLanguage || 'he' },
          contentType: 'song',
          songId: selectedSong.id,
          slideIndex: liveSlideIndex
        });
      }

      // Exit edit mode
      setEditingSongSlideIndex(null);
    } catch (error) {
      console.error('Failed to save song slides:', error);
      alert('Failed to save slides. Please try again.');
    }
  }, [selectedSong, loadSongs, setSetlist, liveSongId, liveSlideIndex, displayMode, settings.translationLanguage]);

  // Cancel inline song slide editing
  const handleCancelEditSongSlides = useCallback(() => {
    setEditingSongSlideIndex(null);
  }, []);

  const handleSaveSlide = useCallback(async (slideIndex: number, updatedSlide: { originalText?: string; transliteration?: string; translation?: string; translationOverflow?: string; verseType?: string }) => {
    if (!selectedSong) return;

    // Create new slides array
    const newSlides = [...selectedSong.slides];

    if (isAddingNewSlide) {
      // Adding a new slide at the end
      newSlides.push({ ...updatedSlide, translations: {} });
    } else {
      // Editing an existing slide — also update translations map to stay in sync
      const merged = { ...newSlides[slideIndex], ...updatedSlide };
      if (updatedSlide.translation !== undefined || updatedSlide.translationOverflow !== undefined) {
        const translations = { ...(merged.translations || {}) };
        const lang = settings.translationLanguage || 'en';
        const parts = [merged.translation || '', merged.translationOverflow || ''].filter(Boolean);
        if (parts.length > 0) {
          translations[lang] = parts.join('\n');
        } else {
          delete translations[lang];
        }
        merged.translations = translations;
      }
      newSlides[slideIndex] = merged;
    }

    try {
      // Save to database
      await window.electronAPI.updateSong(selectedSong.id, { slides: newSlides });

      // Refresh songs list from database
      await loadSongs();

      // Update local state
      const updatedSong = { ...selectedSong, slides: newSlides };
      setSelectedSong(updatedSong);

      // Update any setlist items containing this song
      setSetlist(prev => prev.map(item => {
        if (item.type === 'song' && item.song?.id === selectedSong.id) {
          return { ...item, song: { ...item.song, slides: newSlides } };
        }
        return item;
      }));

      // If this slide is currently live (only for edits, not new slides), re-broadcast
      if (!isAddingNewSlide && liveSongId === selectedSong.id && liveSlideIndex === slideIndex) {
        const slide = newSlides[slideIndex];
        const resolved = resolveTranslation(slide, settings.translationLanguage);
        const isCustom = customModeActiveRef.current;
        const customConfig = settings.customDisplayLines;
        const resolveCustom = (source: typeof customConfig.line1): string => {
          if (source.type === 'original') return slide.originalText || '';
          if (source.type === 'transliteration') return slide.transliteration || '';
          if (source.type === 'translation') {
            if (source.lang && slide.translations) return resolveTranslation(slide, source.lang).translation || '';
            return resolved.translation || '';
          }
          return '';
        };
        window.electronAPI.sendSlide({
          songId: selectedSong.id,
          slideIndex: slideIndex,
          displayMode: isCustom ? 'bilingual' : displayMode,
          isBlank: false,
          songTitle: selectedSong.title,
          contentType: 'song',
          backgroundImage: (!itemBackgroundMutedRef.current && pendingItemBackgroundRef.current) || (!itemBackgroundMutedRef.current && setlistBackgroundRef.current) || selectedBackgroundRef.current || '',
          slideData: isCustom ? {
            originalText: resolveCustom(customConfig.line1),
            transliteration: resolveCustom(customConfig.line2),
            translation: resolveCustom(customConfig.line3),
            translationB: customConfig.line4.type !== 'none' ? resolveCustom(customConfig.line4) : '',
            translationOverflow: '',
            verseType: slide.verseType,
            originalLanguage: selectedSong.originalLanguage || 'he'
          } : {
            originalText: slide.originalText,
            transliteration: slide.transliteration,
            translation: resolved.translation,
            translationOverflow: resolved.translationOverflow,
            verseType: slide.verseType,
            originalLanguage: selectedSong.originalLanguage || 'he'
          }
        });
        // Update live preview state
        setLiveState({
          slideData: { ...slide, originalLanguage: selectedSong.originalLanguage || 'he' },
          contentType: 'song',
          songId: selectedSong.id,
          slideIndex: slideIndex
        });
      }

      // Close modal
      setShowSlideEditor(false);
      setEditingSlideIndex(null);
      setIsAddingNewSlide(false);
    } catch (error) {
      console.error('Failed to save slide:', error);
    }
  }, [selectedSong, liveSongId, liveSlideIndex, displayMode, setSetlist, isAddingNewSlide, loadSongs, settings.translationLanguage]);

  const handleDeleteSlide = useCallback(async (slideIndex: number) => {
    if (!selectedSong || selectedSong.slides.length <= 1) {
      alert('Cannot delete the last slide. A song must have at least one slide.');
      return;
    }

    // Create new slides array without the deleted slide
    const newSlides = selectedSong.slides.filter((_, idx) => idx !== slideIndex);

    try {
      // Save to database
      await window.electronAPI.updateSong(selectedSong.id, { slides: newSlides });

      // Refresh songs list from database
      await loadSongs();

      // Update local state
      const updatedSong = { ...selectedSong, slides: newSlides };
      setSelectedSong(updatedSong);

      // Update any setlist items containing this song
      setSetlist(prev => prev.map(item => {
        if (item.type === 'song' && item.song?.id === selectedSong.id) {
          return { ...item, song: { ...item.song, slides: newSlides } };
        }
        return item;
      }));

      // Close modal
      setShowSlideEditor(false);
      setEditingSlideIndex(null);
    } catch (error) {
      console.error('Failed to delete slide:', error);
    }
  }, [selectedSong, setSetlist, loadSongs]);

  // Memoized deleteSongById
  const deleteSongById = useCallback(async (songId: string) => {
    if (!confirm('Are you sure you want to delete this song?')) return;
    try {
      await window.electronAPI.deleteSong(songId);
      await loadSongs();
      setSelectedSong(prev => prev?.id === songId ? null : prev);
      // Remove deleted song from current setlist
      setSetlist(prev => prev.filter(item => !(item.type === 'song' && item.song?.id === songId)));
    } catch (error) {
      console.error('Failed to delete song:', error);
    }
  }, [loadSongs]);

  // Set viewer background
  const handleSetBackground = useCallback(async (background: string) => {
    setSelectedBackground(background);
    try {
      await window.electronAPI.setBackground(background);
    } catch (error) {
      console.error('Failed to set background:', error);
    }
  }, []);

  // Wrapper to pass setSetlist to the YouTube hook's input submit handler
  const handleYoutubeInputSubmit = useCallback(() => {
    youtubeInputSubmit(setSetlist);
  }, [youtubeInputSubmit, setSetlist]);

  // Display fullscreen media (takes over from slides)
  const handleDisplayMedia = useCallback(async (type: 'image' | 'video', path: string) => {
    // Stop other media types first
    setYoutubeOnDisplay(false);
    setActiveYoutubeVideo(null);
    window.electronAPI.youtubeStop();
    setActiveAudio(null);
    setActiveAudioSetlistId(null);

    // Encode the path for media:// protocol (for display windows)
    // Use triple-slash format (media://file/path) to avoid hostname issues in child windows
    const encodedPath = path
      .replace(/\\/g, '/')
      .split('/')
      .map(segment => encodeURIComponent(segment))
      .join('/');
    const mediaUrl = `media://file/${encodedPath}`;

    // Reset video status when starting new video (paused until display is ready)
    if (type === 'video') {
      setVideoStatus({ currentTime: 0, duration: 0, isPlaying: false });
    }

    // Use media:// protocol which uses net.fetch for proper range request support
    setActiveMedia({ type, url: mediaUrl });

    // Stop auto-play immediately when displaying media
    if (autoPlayActive) {
      autoPlayActiveRef.current = false; // Immediate stop for interval callback
      setAutoPlayActive(false);
      setAutoPlayPresentation(null);
    }

    try {
      // Send fullscreen media to displays with proper type info (still uses media:// for displays)
      await window.electronAPI.displayMedia({ type, url: mediaUrl });
    } catch (error) {
      console.error('Failed to display media:', error);
    }
  }, [autoPlayActive]);

  // Audio player hook - handles all audio playback functions
  const {
    handlePlayAudio,
    handleClearAudio,
    handleAudioPlayPause,
    handleAudioSeek,
    handleAudioVolumeChange,
    startPlaylist,
    playNextPlaylistTrack,
    openEditPlaylistModal,
    closeEditPlaylistModal,
    fadeInAudio,
    fadeOutAudio
  } = useAudioPlayer(
    {
      audioTargetVolume,
      activePlaylistId,
      activePlaylistIndex,
      activePlaylistOrder,
      setlist
    },
    {
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
    },
    {
      audioRef,
      audioFadeRef,
      audioNeedsInitialPlay
    }
  );

  // Wrapper for handlePlayAudio that stops other media first
  const handlePlayAudioWithMediaStop = useCallback((path: string, name: string) => {
    // Stop YouTube
    setYoutubeOnDisplay(false);
    setActiveYoutubeVideo(null);
    window.electronAPI.youtubeStop();

    // If a video is playing on display, mute it instead of clearing it
    if (activeMedia?.type === 'video') {
      window.electronAPI.muteVideo(true);
      window.electronAPI.setVideoVolume(0);
      // Also mute the preview video in control panel
      if (previewVideoRef.current) {
        previewVideoRef.current.muted = true;
        previewVideoRef.current.volume = 0;
      }
    } else {
      setActiveMedia(null);
      window.electronAPI.clearMedia();
    }

    // Now play audio
    handlePlayAudio(path, name);
  }, [handlePlayAudio, activeMedia]);


  const sendCurrentSlide = useCallback((song: Song | null, slideIndex: number, mode: DisplayMode, combinedIndices?: number[], contentType: 'song' | 'bible' | 'prayer' | 'presentation' = 'song') => {
    if (!song || !song.slides[slideIndex]) {
      window.electronAPI.sendBlank();
      return;
    }

    // Apply pending item background to state now that a slide is actually being sent
    const isMuted = itemBackgroundMutedRef.current;
    const itemBg = isMuted ? '' : pendingItemBackgroundRef.current;
    setActiveItemBackground(itemBg);

    const slide = song.slides[slideIndex];
    const nextSlide = song.slides[slideIndex + 1] || null;

    // Resolve translations from the multi-translation map
    const lang = settings.translationLanguage;
    const resolvedSlide = resolveTranslation(slide, lang);
    const resolvedNext = nextSlide ? resolveTranslation(nextSlide, lang) : null;

    // If in original mode with combined slides, include both slides' data
    // Check length AFTER filtering to ensure we actually have multiple valid slides
    const combinedSlidesRaw = mode === 'original' && combinedIndices && combinedIndices.length > 1
      ? combinedIndices.map(i => song.slides[i]).filter(Boolean)
      : null;
    const combinedSlides = combinedSlidesRaw && combinedSlidesRaw.length > 1 ? combinedSlidesRaw : null;

    // Custom mode remapping helper: resolve content for a custom line source
    const isCustom = customModeActiveRef.current;
    const customConfig = settings.customDisplayLines;
    const resolveCustomContent = (source: typeof customConfig.line1, slideObj: any, resolvedObj: { translation: string; translationOverflow: string }): string => {
      if (source.type === 'original') return slideObj.originalText || '';
      if (source.type === 'transliteration') return slideObj.transliteration || '';
      if (source.type === 'translation') {
        if (source.lang && slideObj.translations) {
          return resolveTranslation(slideObj, source.lang).translation || '';
        }
        return resolvedObj.translation || '';
      }
      return '';
    };

    window.electronAPI.sendSlide({
      songId: song.id,
      slideIndex,
      displayMode: isCustom ? 'bilingual' : mode,
      isBlank: false,
      songTitle: song.title,
      contentType, // 'song', 'bible', or 'prayer' - determines which theme to apply
      backgroundImage: itemBg || (!isMuted && setlistBackgroundRef.current) || selectedBackgroundRef.current || '', // Per-item > setlist > global (mute suppresses both)
      slideData: (() => {
        const refHebrew = contentType === 'bible' ? (slide as any).hebrewReference : (slide as any).reference;
        const refEnglish = contentType === 'bible' ? (slide as any).reference : undefined;
        const base = {
          originalText: slide.originalText,
          transliteration: slide.transliteration,
          translation: resolvedSlide.translation,
          translationOverflow: resolvedSlide.translationOverflow,
          verseType: slide.verseType,
          originalLanguage: song.originalLanguage || 'he', // Pass language for single-language song handling
          // Prayer/Sermon theme fields (mapped from slide structure when available)
          title: (slide as any).title,
          titleTranslation: (slide as any).titleTranslation,
          subtitle: (slide as any).subtitle || slide.originalText,
          subtitleTranslation: (slide as any).subtitleTranslation || resolvedSlide.translation,
          description: (slide as any).description,
          descriptionTranslation: (slide as any).descriptionTranslation,
          // Reference fields - for Bible content: hebrewReference goes to 'reference', English to 'referenceEnglish'
          reference: refHebrew,
          referenceTranslation: (slide as any).referenceTranslation,
          referenceEnglish: refEnglish
        };
        if (isCustom) {
          return {
            ...base,
            originalText: resolveCustomContent(customConfig.line1, slide, resolvedSlide),
            transliteration: resolveCustomContent(customConfig.line2, slide, resolvedSlide),
            translation: resolveCustomContent(customConfig.line3, slide, resolvedSlide),
            translationB: customConfig.line4.type !== 'none' ? resolveCustomContent(customConfig.line4, slide, resolvedSlide) : '',
            translationOverflow: ''
          };
        }
        return base;
      })(),
      nextSlideData: nextSlide ? (() => {
        const nextBase = {
          originalText: nextSlide.originalText,
          transliteration: nextSlide.transliteration,
          translation: resolvedNext!.translation,
          translationOverflow: resolvedNext!.translationOverflow,
          verseType: nextSlide.verseType,
          // Prayer/Sermon content fields
          title: (nextSlide as any).title,
          titleTranslation: (nextSlide as any).titleTranslation,
          subtitle: (nextSlide as any).subtitle,
          subtitleTranslation: (nextSlide as any).subtitleTranslation,
          description: (nextSlide as any).description,
          descriptionTranslation: (nextSlide as any).descriptionTranslation,
          reference: (nextSlide as any).reference,
          referenceTranslation: (nextSlide as any).referenceTranslation
        };
        if (isCustom) {
          return {
            ...nextBase,
            originalText: resolveCustomContent(customConfig.line1, nextSlide, resolvedNext!),
            transliteration: resolveCustomContent(customConfig.line2, nextSlide, resolvedNext!),
            translation: resolveCustomContent(customConfig.line3, nextSlide, resolvedNext!),
            translationB: customConfig.line4.type !== 'none' ? resolveCustomContent(customConfig.line4, nextSlide, resolvedNext!) : '',
            translationOverflow: ''
          };
        }
        return nextBase;
      })() : null,
      combinedSlides: combinedSlides?.map(s => {
        const resolvedS = resolveTranslation(s, lang);
        return {
          originalText: s.originalText,
          transliteration: s.transliteration,
          translation: resolvedS.translation,
          translationOverflow: resolvedS.translationOverflow,
          verseType: s.verseType,
          // Prayer/Sermon content fields
          title: (s as any).title,
          titleTranslation: (s as any).titleTranslation,
          subtitle: (s as any).subtitle,
          subtitleTranslation: (s as any).subtitleTranslation,
          description: (s as any).description,
          descriptionTranslation: (s as any).descriptionTranslation,
          reference: (s as any).reference,
          referenceTranslation: (s as any).referenceTranslation
        };
      }) || null
    });
  }, [selectedBibleTheme, selectedPrayerTheme, settings.translationLanguage, settings.customDisplayLines]);


  // Send prayer/sermon presentation slide using prayer theme instead of textbox rendering
  const sendPrayerPresentationSlide = useCallback((
    presentation: Presentation,
    slideIndex: number,
    mode: DisplayMode
  ) => {
    if (!presentation.quickModeData) {
      return;
    }

    const qmd = presentation.quickModeData;
    const subtitle = qmd.subtitles[slideIndex];
    if (!subtitle) return;

    const hebrewRef = subtitle.bibleRef?.hebrewReference;
    const englishRef = subtitle.bibleRef?.reference;

    const slideData = {
      title: qmd.title,
      titleTranslation: qmd.titleTranslation,
      subtitle: subtitle.subtitle,
      subtitleTranslation: subtitle.subtitleTranslation,
      description: subtitle.description,
      descriptionTranslation: subtitle.descriptionTranslation,
      reference: hebrewRef || englishRef,
      referenceTranslation: englishRef
    };

    // Update live preview state FIRST for immediate UI response (atomic update)
    setLiveState({ slideData, contentType: 'prayer', songId: presentation.id, slideIndex });

    // Apply the appropriate OBS prayer theme
    if (selectedOBSPrayerTheme) {
      window.electronAPI.applyOBSTheme(selectedOBSPrayerTheme);
    }

    // Send to display (fire and forget)
    window.electronAPI.sendSlide({
      songId: presentation.id,
      slideIndex,
      displayMode: mode,
      isBlank: false,
      songTitle: presentation.title,
      contentType: 'prayer',
      backgroundImage: (!itemBackgroundMutedRef.current && pendingItemBackgroundRef.current) || (!itemBackgroundMutedRef.current && setlistBackgroundRef.current) || selectedBackgroundRef.current || '',
      activeTheme: selectedPrayerTheme,
      slideData
    });
  }, [selectedPrayerTheme, selectedOBSPrayerTheme]);

  // Combined slides for original-only mode (pairs consecutive same-verseType slides)
  // NOTE: This must be defined before handleClearMedia which depends on it
  const combinedSlidesData = useMemo(() => {
    if (displayMode !== 'original' || !selectedSong?.slides) return null;
    return createCombinedSlides(selectedSong.slides);
  }, [displayMode, selectedSong?.slides]);

  // Clear fullscreen media and restore slides
  const handleClearMedia = useCallback(async () => {
    setActiveMedia(null);
    setVideoStatus({ currentTime: 0, duration: 0, isPlaying: false });

    try {
      // Clear fullscreen media
      await window.electronAPI.clearMedia();

      // Re-send the current slide to restore display
      const song = selectedSongRef.current;
      if (song && currentSlideIndex >= 0) {
        // If in original mode, get the combined indices for the current slide
        let combinedIndices: number[] | undefined;
        if (displayMode === 'original' && combinedSlidesData) {
          const combinedIdx = combinedSlidesData.originalToCombined.get(currentSlideIndex);
          if (combinedIdx !== undefined) {
            combinedIndices = combinedSlidesData.combinedToOriginal.get(combinedIdx);
          }
        }
        sendCurrentSlide(song, currentSlideIndex, displayMode, combinedIndices, currentContentType);
      }
    } catch (error) {
      console.error('Failed to clear media:', error);
    }
  }, [currentSlideIndex, displayMode, sendCurrentSlide, currentContentType, combinedSlidesData]);

  // Video playback control handlers
  const handleVideoPlayPause = useCallback(async () => {
    // Control preview video
    if (previewVideoRef.current) {
      if (videoStatus.isPlaying) {
        previewVideoRef.current.pause();
      } else {
        previewVideoRef.current.play().catch(console.error);
      }
    }
    // Also send command to display windows
    if (videoStatus.isPlaying) {
      await window.electronAPI.pauseVideo();
    } else {
      await window.electronAPI.resumeVideo();
    }
  }, [videoStatus.isPlaying]);

  const handleVideoSeek = useCallback((time: number) => {
    if (isNaN(time) || time < 0) return;

    const video = previewVideoRef.current;
    const wasPlaying = videoStatus.isPlaying;

    // Pause both first for sync
    if (video) {
      video.pause();
    }
    window.electronAPI.pauseVideo();
    setVideoStatus(prev => ({ ...prev, isPlaying: false }));

    // Seek both videos
    if (video) {
      video.currentTime = time;
    }
    window.electronAPI.seekVideo(time);

    // Use seeked event to know when seek is complete, then resume if was playing
    if (wasPlaying && video) {
      const handleSeeked = () => {
        video.removeEventListener('seeked', handleSeeked);
        // Resume playback after seek completes
        video.play().catch(() => {});
        window.electronAPI.resumeVideo();
        setVideoStatus(prev => ({ ...prev, isPlaying: true }));
      };
      video.addEventListener('seeked', handleSeeked);

      // Fallback timeout in case seeked event doesn't fire (e.g., video not loaded)
      setTimeout(() => {
        video.removeEventListener('seeked', handleSeeked);
      }, 2000);
    }
  }, [videoStatus.isPlaying]);


  // Memoized drag handlers for song list
  const handleSongDragStart = useCallback((song: Song) => {
    setDraggedSong(song);
  }, []);

  const handleSongDragEnd = useCallback(() => {
    setDraggedSong(null);
  }, []);

  // ============ Auth Functions ============

  const initializeAuth = async () => {
    try {
      const state = await window.electronAPI.getAuthState();
      setAuthState({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        serverUrl: state.serverUrl
      });

      // If authenticated, auto-connect to online mode
      if (state.isAuthenticated) {
        const result = await window.electronAPI.connectWithAuth();
        if (result.success) {
          // Create a room automatically
          const room = await window.electronAPI.createOnlineRoom();
          if (room) {
            setRoomPin(room.roomPin);
          }
          // Re-link any saved virtual displays
          relinkVirtualDisplays();
        }
      }
    } catch (error) {
      console.error('Failed to initialize auth:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await window.electronAPI.logout();
      setAuthState({ isAuthenticated: false, user: null, serverUrl: authState.serverUrl });
      setOnlineConnected(false);
      setRoomPin(null);
      setViewerCount(0);
      setMidiBridgeConnected(false);
      setMidiControlEnabled(true);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Note: Unsaved changes tracking is now handled by SetlistContext

  // Sync selectedCombinedIndex when mode changes or song changes
  useEffect(() => {
    if (combinedSlidesData && currentSlideIndex !== null) {
      const combinedIdx = combinedSlidesData.originalToCombined.get(currentSlideIndex);
      if (combinedIdx !== undefined) {
        setSelectedCombinedIndex(combinedIdx);
      }
    }
  }, [combinedSlidesData, currentSlideIndex]);

  // Re-send current slide with combined data when combinedSlidesData becomes available
  // This handles the case where displayMode switches to 'original' while a song is already selected.
  // Note: selectSong already computes combined indices inline, so this only fires for mode changes.
  const prevCombinedSlidesDataRef = useRef<typeof combinedSlidesData>(null);
  const prevSongIdForCombinedRef = useRef<string | null>(null);
  useEffect(() => {
    const wasNull = prevCombinedSlidesDataRef.current === null;
    const isNowAvailable = combinedSlidesData !== null;
    const songChanged = selectedSong?.id !== prevSongIdForCombinedRef.current;
    prevCombinedSlidesDataRef.current = combinedSlidesData;
    prevSongIdForCombinedRef.current = selectedSong?.id ?? null;

    // Skip if the song just changed — selectSong already sent combined data inline
    if (songChanged) return;

    if (wasNull && isNowAvailable && selectedSong && !isBlank && currentSlideIndex !== null) {
      const combinedIdx = combinedSlidesData.originalToCombined.get(currentSlideIndex);
      if (combinedIdx !== undefined) {
        const combinedIndices = combinedSlidesData.combinedToOriginal.get(combinedIdx);
        if (combinedIndices && combinedIndices.length > 1) {
          sendCurrentSlide(selectedSong, currentSlideIndex, displayMode, combinedIndices, currentContentType);
        }
      }
    }
  }, [combinedSlidesData, selectedSong, isBlank, currentSlideIndex, displayMode, currentContentType, sendCurrentSlide]);

  const openDisplay = async (displayId: number, type: DisplayAssignedType, deviceId?: string, audioDeviceId?: string) => {
    // Apply selected themes before opening so DisplayManager has them for sendInitialState
    if (isViewerLike(type)) {
      if (selectedTheme) applyViewerTheme(selectedTheme);
      if (selectedBibleTheme) applyBibleThemeCallback(selectedBibleTheme);
      if (selectedPrayerTheme) applyPrayerThemeCallback(selectedPrayerTheme);
    } else if (type === 'stage') {
      if (selectedStageTheme) applyStageTheme(selectedStageTheme);
    }
    await window.electronAPI.openDisplayWindow(displayId, type, deviceId, audioDeviceId);
    loadDisplays();
  };

  const closeDisplay = async (displayId: number) => {
    await window.electronAPI.closeDisplayWindow(displayId);
    loadDisplays();
  };

  // Memoized selectSong to prevent recreation on every render
  const selectSong = useCallback((song: Song, contentType: 'song' | 'bible' | 'prayer' = 'song', sendToDisplay: boolean = true) => {
    setSelectedSong(song);
    // If selecting the song that's currently live, restore to the live slide index
    // Otherwise reset to 0
    if (song.id === liveSongId) {
      setCurrentSlideIndex(liveSlideIndex);
    } else {
      setCurrentSlideIndex(0);
    }
    setSelectedPresentation(null); // Clear presentation selection
    setCurrentPresentationSlideIndex(0);
    setCurrentContentType(contentType);

    // Only send to display if requested
    if (sendToDisplay) {
      setIsBlank(false);

      // Apply the appropriate OBS theme based on content type
      if (contentType === 'bible' && selectedOBSBibleTheme) {
        window.electronAPI.applyOBSTheme(selectedOBSBibleTheme);
      } else if (contentType === 'prayer' && selectedOBSPrayerTheme) {
        window.electronAPI.applyOBSTheme(selectedOBSPrayerTheme);
      } else if (contentType === 'song' && selectedOBSSongsTheme) {
        window.electronAPI.applyOBSTheme(selectedOBSSongsTheme);
      }

      // Update live preview data (atomic update)
      const slideIdx = song.id === liveSongId ? liveSlideIndex : 0;
      const slide = song.slides[slideIdx];
      const slideData = contentType === 'bible' ? {
        ...slide,
        reference: (slide as any).hebrewReference || song.title,
        referenceEnglish: (slide as any).reference,
        originalLanguage: song.originalLanguage
      } : { ...slide, originalLanguage: song.originalLanguage };
      setLiveState({ slideData, contentType, songId: song.id, slideIndex: slideIdx });

      // Compute combined indices inline to avoid a redundant re-send from the effect
      let combinedIndices: number[] | undefined;
      if (displayMode === 'original' && song.slides.length > 1) {
        const combined = createCombinedSlides(song.slides);
        const combinedIdx = combined.originalToCombined.get(slideIdx);
        if (combinedIdx !== undefined) {
          const indices = combined.combinedToOriginal.get(combinedIdx);
          if (indices && indices.length > 1) {
            combinedIndices = indices;
          }
        }
      }
      sendCurrentSlide(song, slideIdx, displayMode, combinedIndices, contentType);
    }
  }, [sendCurrentSlide, displayMode, selectedOBSBibleTheme, selectedOBSSongsTheme, selectedOBSPrayerTheme, liveSongId, liveSlideIndex]);

  // Memoized goToSlide - always sends to display when clicking on a slide card
  // Uses selectedSongRef to avoid recreating this callback on every song change
  const goToSlide = useCallback((index: number, combinedIndices?: number[]) => {
    const song = selectedSongRef.current;
    if (!song) return;
    const newIndex = Math.max(0, Math.min(index, song.slides.length - 1));
    setCurrentSlideIndex(newIndex);
    setIsBlank(false); // Always show when clicking on a slide

    // Stop auto-play immediately when broadcasting a different content
    if (autoPlayActiveRef.current) {
      autoPlayActiveRef.current = false; // Immediate stop for interval callback
      setAutoPlayActive(false);
      setAutoPlayPresentation(null);
    }

    // Apply the appropriate OBS theme based on content type
    if (currentContentType === 'bible' && selectedOBSBibleTheme) {
      window.electronAPI.applyOBSTheme(selectedOBSBibleTheme);
    } else if (currentContentType === 'prayer' && selectedOBSPrayerTheme) {
      window.electronAPI.applyOBSTheme(selectedOBSPrayerTheme);
    } else if (currentContentType === 'song' && selectedOBSSongsTheme) {
      window.electronAPI.applyOBSTheme(selectedOBSSongsTheme);
    }

    // Update live preview data (atomic update)
    const slide = song.slides[newIndex];
    const slideData = currentContentType === 'bible' ? {
      ...slide,
      reference: (slide as any).hebrewReference || song.title,
      referenceEnglish: (slide as any).reference,
      originalLanguage: song.originalLanguage
    } : { ...slide, originalLanguage: song.originalLanguage };
    setLiveState({ slideData, contentType: currentContentType, songId: song.id, slideIndex: newIndex });

    sendCurrentSlide(song, newIndex, displayMode, combinedIndices, currentContentType);
  }, [sendCurrentSlide, displayMode, currentContentType, selectedOBSBibleTheme, selectedOBSSongsTheme, selectedOBSPrayerTheme]);

  // Track previous arrangement slide index to detect changes from arrangement navigation
  const prevArrangementSlideIndexRef = useRef<number>(-1);

  // Sync arrangement state to display when navigating via arrangement
  useEffect(() => {
    // Only sync when arrangement is active and not in edit mode
    if (!arrangementState.activeArrangement || arrangementState.isArrangementMode) {
      prevArrangementSlideIndexRef.current = -1;
      return;
    }

    const actualIndex = arrangementState.actualSlideIndex;
    const song = selectedSongRef.current;

    // Only sync if the index actually changed (from arrangement navigation)
    if (actualIndex >= 0 && actualIndex !== prevArrangementSlideIndexRef.current && song) {
      prevArrangementSlideIndexRef.current = actualIndex;

      // Update current slide index and send to display
      setCurrentSlideIndex(actualIndex);
      setIsBlank(false);

      // Update live state
      const slide = song.slides[actualIndex];
      if (slide) {
        const slideData = currentContentType === 'bible' ? {
          ...slide,
          reference: (slide as any).hebrewReference || song.title,
          referenceEnglish: (slide as any).reference,
          originalLanguage: song.originalLanguage
        } : { ...slide, originalLanguage: song.originalLanguage };
        setLiveState({ slideData, contentType: currentContentType, songId: song.id, slideIndex: actualIndex });

        sendCurrentSlide(song, actualIndex, displayMode, undefined, currentContentType);
      }
    }
  }, [arrangementState.activeArrangement, arrangementState.isArrangementMode, arrangementState.actualSlideIndex, currentContentType, displayMode, sendCurrentSlide]);

  // Memoized selectCombinedSlide (for original-only mode)
  const selectCombinedSlide = useCallback((combinedIndex: number) => {
    const song = selectedSongRef.current;
    if (!combinedSlidesData || !song) {
      return;
    }

    setSelectedCombinedIndex(combinedIndex);
    setIsBlank(false);

    // Stop auto-play immediately when broadcasting a different content
    if (autoPlayActiveRef.current) {
      autoPlayActiveRef.current = false;
      setAutoPlayActive(false);
      setAutoPlayPresentation(null);
    }

    const originalIndices = combinedSlidesData.combinedToOriginal.get(combinedIndex);
    if (!originalIndices || originalIndices.length === 0) return;

    const firstOriginalIndex = originalIndices[0];
    setCurrentSlideIndex(firstOriginalIndex);

    // Update live state for immediate UI response (sets liveSongId for selection highlighting)
    const slide = song.slides[firstOriginalIndex];
    const slideData = currentContentType === 'bible' ? {
      ...slide,
      reference: (slide as any).hebrewReference || song.title,
      referenceEnglish: (slide as any).reference,
      originalLanguage: song.originalLanguage
    } : { ...slide, originalLanguage: song.originalLanguage };
    setLiveState({ slideData, contentType: currentContentType, songId: song.id, slideIndex: firstOriginalIndex });

    // Send slide with combined indices
    sendCurrentSlide(song, firstOriginalIndex, displayMode, originalIndices, currentContentType);
  }, [combinedSlidesData, sendCurrentSlide, displayMode, currentContentType]);

  // Helper to navigate presentation slides by arrow keys
  const goToPresentationSlide = useCallback((idx: number, presOverride?: Presentation) => {
    const pres = presOverride || selectedPresentation;
    if (!pres || idx < 0 || idx >= pres.slides.length) return;
    const slide = pres.slides[idx];
    // Stop auto-play cycling when user/MIDI manually navigates to a specific slide
    if (autoPlayActiveRef.current) {
      autoPlayActiveRef.current = false;
      setAutoPlayActive(false);
      setAutoPlayPresentation(null);
    }
    setIsBlank(false);
    setCurrentPresentationSlideIndex(idx);

    // Prayer/sermon presentations use the prayer theme renderer
    if (pres.quickModeData) {
      sendPrayerPresentationSlide(pres, idx, displayMode);
      return;
    }

    setLiveState({ slideData: slide, contentType: 'presentation', songId: pres.id, slideIndex: idx });
    window.electronAPI.sendSlide({
      songId: pres.id,
      slideIndex: idx,
      displayMode: 'bilingual',
      isBlank: false,
      songTitle: pres.title,
      presentationSlide: slide,
      backgroundImage: (!itemBackgroundMutedRef.current && pendingItemBackgroundRef.current) || (!itemBackgroundMutedRef.current && setlistBackgroundRef.current) || selectedBackgroundRef.current || ''
    });
  }, [selectedPresentation, displayMode, sendPrayerPresentationSlide]);

  // Memoized nextSlide - uses selectedSongRef to avoid dependency on selectedSong
  const nextSlide = useCallback(() => {
    // Handle presentation navigation (including prayer/sermon quickMode)
    if ((currentContentType === 'presentation' || currentContentType === 'prayer') && selectedPresentation) {
      if (currentPresentationSlideIndex < selectedPresentation.slides.length - 1) {
        goToPresentationSlide(currentPresentationSlideIndex + 1);
      }
      return;
    }

    const song = selectedSongRef.current;
    if (!song) return;

    // If arrangement is active (not in edit mode, but arrangement selected), use arrangement navigation
    if (arrangementState.activeArrangement && !arrangementState.isArrangementMode) {
      arrangementState.goToNextSlide();
      return;
    }

    // If in original mode with combined slides, navigate by combined index
    if (displayMode === 'original' && combinedSlidesData) {
      if (selectedCombinedIndex < combinedSlidesData.combinedSlides.length - 1) {
        selectCombinedSlide(selectedCombinedIndex + 1);
        return;
      }
    } else if (currentSlideIndex < song.slides.length - 1) {
      goToSlide(currentSlideIndex + 1);
    }
  }, [currentContentType, selectedPresentation, currentPresentationSlideIndex, goToPresentationSlide, displayMode, combinedSlidesData, selectedCombinedIndex, selectCombinedSlide, currentSlideIndex, goToSlide, arrangementState]);

  // Memoized prevSlide - uses selectedSongRef to avoid dependency on selectedSong
  const prevSlide = useCallback(() => {
    // Handle presentation navigation (including prayer/sermon quickMode)
    if ((currentContentType === 'presentation' || currentContentType === 'prayer') && selectedPresentation) {
      if (currentPresentationSlideIndex > 0) {
        goToPresentationSlide(currentPresentationSlideIndex - 1);
      }
      return;
    }

    if (!selectedSongRef.current) return;

    // If arrangement is active (not in edit mode, but arrangement selected), use arrangement navigation
    if (arrangementState.activeArrangement && !arrangementState.isArrangementMode) {
      arrangementState.goToPrevSlide();
      return;
    }

    // If in original mode with combined slides, navigate by combined index
    if (displayMode === 'original' && combinedSlidesData) {
      if (selectedCombinedIndex > 0) {
        selectCombinedSlide(selectedCombinedIndex - 1);
        return;
      }
    } else if (currentSlideIndex > 0) {
      goToSlide(currentSlideIndex - 1);
    }
  }, [currentContentType, selectedPresentation, currentPresentationSlideIndex, goToPresentationSlide, displayMode, combinedSlidesData, selectedCombinedIndex, selectCombinedSlide, currentSlideIndex, goToSlide, arrangementState]);

  // Memoized selectSlide - uses selectedSongRef to avoid dependency on selectedSong
  const selectSlide = useCallback((index: number) => {
    if (!selectedSongRef.current) return;
    setIsBlank(false);

    // If in original mode, find the combined index and select it
    if (displayMode === 'original' && combinedSlidesData) {
      const combinedIdx = combinedSlidesData.originalToCombined.get(index);
      if (combinedIdx !== undefined) {
        selectCombinedSlide(combinedIdx);
        return;
      }
    }

    goToSlide(index);
  }, [displayMode, combinedSlidesData, selectCombinedSlide, goToSlide]);

  const toggleBlank = useCallback(() => {
    const song = selectedSongRef.current;
    setIsBlank(prevBlank => {
      const newBlankState = !prevBlank;
      if (newBlankState) {
        window.electronAPI.sendBlank();
        setLiveState({ slideData: null, contentType: null, songId: null, slideIndex: 0 });
      } else if (song && currentSlideIndex < song.slides.length) {
        // Update live preview data (atomic update)
        const slide = song.slides[currentSlideIndex];
        const slideData = currentContentType === 'bible' ? {
          ...slide,
          reference: (slide as any).hebrewReference || song.title,
          referenceEnglish: (slide as any).reference,
          originalLanguage: song.originalLanguage
        } : { ...slide, originalLanguage: song.originalLanguage };
        setLiveState({ slideData, contentType: currentContentType, songId: song.id, slideIndex: currentSlideIndex });
        sendCurrentSlide(song, currentSlideIndex, displayMode, undefined, currentContentType);
      }
      return newBlankState;
    });
  }, [currentSlideIndex, displayMode, currentContentType, sendCurrentSlide]);

  // Jump to a song section by keyboard shortcut key
  const handleJumpToSection = useCallback((key: string) => {
    const song = selectedSongRef.current;
    if (!song?.slides?.length) return;
    const candidates = SECTION_KEY_MAP[key];
    if (!candidates) return;
    const ranges = getSectionRanges(song.slides);
    for (const candidate of candidates) {
      const range = ranges.get(candidate);
      if (range) {
        goToSlide(range.start);
        return;
      }
    }
  }, [goToSlide]);

  // Keyboard shortcuts hook
  // Keyboard shortcut display mode setter also resets custom mode
  const setDisplayModeFromKeyboard = useCallback((mode: DisplayMode) => {
    setDisplayMode(mode);
    setCustomModeActive(false);
  }, []);

  useKeyboardShortcuts(
    {
      nextSlide,
      prevSlide,
      toggleBlank,
      setShowKeyboardHelp,
      setShowQuickSlideModal,
      setDisplayMode: setDisplayModeFromKeyboard,
      setIsBlank,
      setLiveState,
      onJumpToSection: handleJumpToSection
    },
    { displayMode, isRTL, disabled: isHidden || showSettings || showPrayerEditor || showSongEditor || showSlideEditor || showQuickSlideModal, hasSong: !!selectedSong }
  );

  // Immediate auto-play stop: sets ref + state + clears presentation in one call
  const stopAutoPlay = useCallback(() => {
    autoPlayActiveRef.current = false;
    setAutoPlayActive(false);
    setAutoPlayPresentation(null);
  }, []);

  // Remote Control hook - handles state sync and command processing
  useRemoteControl(
    {
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
      translationLanguage: settings.translationLanguage
    },
    {
      nextSlide,
      prevSlide,
      goToSlide,
      goToPresentationSlide,
      toggleBlank,
      selectCombinedSlide,
      sendCurrentSlide,
      handlePlayAudio: handlePlayAudioWithMediaStop,
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
    },
    {
      audioRef,
      previewVideoRef
    }
  );

  // Memoized addToSetlist to prevent unnecessary re-renders
  const addToSetlist = useCallback((song: Song) => {
    setSetlist(prev => [...prev, { id: crypto.randomUUID(), type: 'song', song }]);
  }, []);

  // Add Bible passage to setlist
  const addBibleToSetlist = useCallback((passage: Song) => {
    setSetlist(prev => [...prev, { id: crypto.randomUUID(), type: 'bible', song: passage, title: passage.title }]);
  }, []);

  // Add presentation to setlist
  const addPresentationToSetlist = useCallback((presentation: Presentation) => {
    setSetlist(prev => [...prev, { id: crypto.randomUUID(), type: 'presentation', presentation, title: presentation.title }]);
  }, []);

  // Presentation item callbacks for memoized PresentationItem component
  // Just loads the presentation into preview - doesn't send to display until user clicks a slide
  const handlePresentationSelect = useCallback((pres: any) => {
    setSelectedSong(null);
    setSelectedPresentation(pres);
    setCurrentPresentationSlideIndex(0);
    // Set the content type but don't send to display yet
    if (pres.quickModeData?.type === 'prayer' || pres.quickModeData?.type === 'sermon') {
      setCurrentContentType('prayer');
    } else {
      setCurrentContentType('presentation');
    }
  }, []);

  const handlePresentationEdit = useCallback((pres: any) => {
    if (pres.quickModeData?.type === 'prayer' || pres.quickModeData?.type === 'sermon') {
      startEditingPrayerPresentation(pres);
    } else {
      navigate(`/presentation-editor?id=${pres.id}`);
    }
  }, [navigate, startEditingPrayerPresentation]);

  const handlePresentationDelete = useCallback(async (pres: any) => {
    if (confirm(`Delete "${pres.title}"?`)) {
      await window.electronAPI.deletePresentation(pres.id);
      loadPresentations();
    }
  }, [loadPresentations]);

  const handlePresentationDragStart = useCallback((e: React.DragEvent, pres: any) => {
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'presentation',
      presentation: pres
    }));
  }, []);

  const addSectionHeader = useCallback(() => {
    setShowSectionModal(true);
  }, []);

  const removeFromSetlist = useCallback((itemId: string) => {
    // Check if removing a currently playing audio item
    setSetlist(prev => {
      const itemToRemove = prev.find(item => item.id === itemId);
      if (itemToRemove?.type === 'media' && itemToRemove.mediaType === 'audio' && itemToRemove.mediaPath && activeAudio) {
        const encodedPath = itemToRemove.mediaPath
          .replace(/\\/g, '/')
          .split('/')
          .map(segment => encodeURIComponent(segment))
          .join('/');
        const itemAudioUrl = `media://file/${encodedPath}`;
        if (activeAudio.url === itemAudioUrl) {
          // Stop the audio player
          setActiveAudio(null);
          setActiveAudioSetlistId(null);
          setAudioStatus({ currentTime: 0, duration: 0, isPlaying: false });
        }
      }
      return prev.filter((item) => item.id !== itemId);
    });
  }, [activeAudio]);

  const moveSetlistItem = useCallback((fromIndex: number, toIndex: number) => {
    setSetlist(prev => {
      const newSetlist = [...prev];
      const [removed] = newSetlist.splice(fromIndex, 1);
      newSetlist.splice(toIndex, 0, removed);
      return newSetlist;
    });
  }, []);

  // Re-link all virtual displays when we connect online
  const relinkVirtualDisplays = useCallback(async () => {
    try {
      const saved = localStorage.getItem('virtualDisplays');
      if (!saved) return;
      const displays: VirtualDisplay[] = JSON.parse(saved);
      if (displays.length === 0) return;
      await Promise.allSettled(
        displays.map(vd =>
          window.electronAPI.linkPublicRoom(vd.id).catch(error => {
            console.warn(`Failed to re-link virtual display "${vd.name}":`, error);
          })
        )
      );
    } catch (error) {
      console.error('Failed to re-link virtual displays:', error);
    }
  }, []);

  const connectOnline = useCallback(async () => {
    const connected = await window.electronAPI.connectOnline('https://solucast.app', '');
    if (connected) {
      const result = await window.electronAPI.createOnlineRoom();
      if (result) {
        setRoomPin(result.roomPin);
        relinkVirtualDisplays();
        // Re-link saved public room
        try {
          const savedPublicRoom = localStorage.getItem('activePublicRoom');
          if (savedPublicRoom) {
            const room = JSON.parse(savedPublicRoom);
            const linked = await window.electronAPI.linkPublicRoom(room.id);
            if (!linked) {
              // Room no longer exists on server — clear stale state
              console.warn('Public room no longer valid, clearing saved state');
              setActivePublicRoom(null);
              localStorage.removeItem('activePublicRoom');
            }
          }
        } catch (error) {
          console.warn('Failed to re-link public room, clearing saved state:', error);
          setActivePublicRoom(null);
          localStorage.removeItem('activePublicRoom');
        }
      }
    }
  }, [relinkVirtualDisplays]);

  // ============ Virtual Display Functions ============

  const handleAddVirtualDisplay = useCallback(async (name: string, type: 'viewer' | 'stage') => {
    setVirtualDisplayLoading(true);
    setVirtualDisplayError(null);
    try {
      const userPrefix = authState.user?.email?.split('@')[0]?.toLowerCase().replace(/[^\w-]/g, '') || 'user';
      const slug = `${userPrefix}-virtual-${name.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '')}`;
      const publicRoom = await window.electronAPI.createPublicRoom(slug);
      if (!publicRoom) {
        setVirtualDisplayError('Failed to create public room');
        setVirtualDisplayLoading(false);
        return;
      }

      // Link the public room to the current active room
      const linked = await window.electronAPI.linkPublicRoom(publicRoom.id);
      if (!linked) {
        setVirtualDisplayError('Failed to link virtual display to room');
        setVirtualDisplayLoading(false);
        return;
      }

      const url = isViewerLike(type)
        ? `https://solucast.app/viewer?room=${publicRoom.slug}`
        : `https://solucast.app/stage-monitor?room=${publicRoom.slug}`;

      const newVd: VirtualDisplay = {
        id: publicRoom.id,
        name: name.trim(),
        slug: publicRoom.slug,
        type,
        url
      };

      setVirtualDisplays(prev => {
        const updated = [...prev, newVd];
        localStorage.setItem('virtualDisplays', JSON.stringify(updated));
        return updated;
      });
      setShowVirtualDisplayModal(false);
    } catch (err: any) {
      setVirtualDisplayError(err.message || 'Failed to add virtual display');
    }
    setVirtualDisplayLoading(false);
  }, []);

  const handleRemoveVirtualDisplay = useCallback(async (id: string) => {
    // Unlink from backend
    try {
      await window.electronAPI.unlinkPublicRoom(id);
    } catch (error) {
      console.warn('Failed to unlink public room:', error);
    }
    setVirtualDisplays(prev => {
      const updated = prev.filter(vd => vd.id !== id);
      localStorage.setItem('virtualDisplays', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const handleCopyVirtualDisplayUrl = useCallback((url: string) => {
    window.electronAPI.copyToClipboard(url);
  }, []);

  // ============ Public Room Functions ============

  const handleCreatePublicRoom = useCallback(async (customName: string) => {
    const userPrefix = authState.user?.email?.split('@')[0]?.toLowerCase().replace(/[^\w-]/g, '') || 'user';
    const slug = `${userPrefix}-${customName}`;
    const publicRoom = await window.electronAPI.createPublicRoom(slug);
    if (!publicRoom) throw new Error('Failed to create public room');

    const linked = await window.electronAPI.linkPublicRoom(publicRoom.id);
    if (!linked) throw new Error('Failed to link public room');

    const room = { id: publicRoom.id, slug: publicRoom.slug };
    setActivePublicRoom(room);
    localStorage.setItem('activePublicRoom', JSON.stringify(room));
  }, [authState.user?.email]);

  const handleUnlinkPublicRoom = useCallback(async () => {
    if (!activePublicRoom) return;
    try {
      await window.electronAPI.unlinkPublicRoom(activePublicRoom.id);
    } catch (error) {
      console.warn('Failed to unlink public room:', error);
    }
    setActivePublicRoom(null);
    localStorage.removeItem('activePublicRoom');
  }, [activePublicRoom]);

  const importSongsFromServer = async () => {
    // Clear any existing timeout
    if (importStatusTimeoutRef.current) {
      clearTimeout(importStatusTimeoutRef.current);
      importStatusTimeoutRef.current = null;
    }
    setIsImporting(true);
    setImportStatus('Connecting to server...');
    try {
      const result = await window.electronAPI.importSongs('https://solupresenter-backend-4rn5.onrender.com');
      setImportStatus(`Imported ${result.imported}, Updated ${result.updated}${result.errors > 0 ? `, Errors: ${result.errors}` : ''}`);
      await loadSongs();
      importStatusTimeoutRef.current = setTimeout(() => setImportStatus(null), 5000);
    } catch (err: any) {
      setImportStatus(`Error: ${err.message || 'Failed to import'}`);
      importStatusTimeoutRef.current = setTimeout(() => setImportStatus(null), 5000);
    }
    setIsImporting(false);
  };

  // Setlist save/load functions - updateSavedSnapshot is now from SetlistContext

  const saveSetlist = async (name: string, venue: string) => {
    if (!name) return;

    try {
      let savedSetlist: SavedSetlist | null;

      if (currentSetlistId) {
        // Update existing setlist
        savedSetlist = await window.electronAPI.updateSetlist(currentSetlistId, {
          name,
          venue: venue || undefined,
          background: setlistBackground || undefined,
          items: setlist
        });
      } else {
        // Create new setlist
        savedSetlist = await window.electronAPI.createSetlist({
          name,
          venue: venue || undefined,
          background: setlistBackground || undefined,
          items: setlist
        });
      }

      if (savedSetlist) {
        setCurrentSetlistId(savedSetlist.id);
        setCurrentSetlistName(name);
        // Reload all setlists to get updated list
        await loadSavedSetlists();
      }

      updateSavedSnapshot(setlist, setlistBackground);
      setShowSaveModal(false);

      // If there was a pending action (load/clear), proceed with it now that we've saved
      if (pendingAction) {
        if (pendingAction.type === 'load' && pendingAction.setlist) {
          loadSetlistDirect(pendingAction.setlist);
        } else if (pendingAction.type === 'clear') {
          clearSetlistDirect();
        }
      }
      setShowUnsavedWarning(false);
      setPendingAction(null);
    } catch (error) {
      console.error('Failed to save setlist:', error);
    }
  };

  // Quick save for existing setlists (no modal needed)
  const quickSaveSetlist = async () => {
    if (!currentSetlistId || !currentSetlistName) return;

    try {
      const savedSetlist = await window.electronAPI.updateSetlist(currentSetlistId, {
        name: currentSetlistName,
        background: setlistBackground || undefined,
        items: setlist
      });

      if (savedSetlist) {
        await loadSavedSetlists();
      }

      updateSavedSnapshot(setlist, setlistBackground);
    } catch (error) {
      console.error('Failed to quick save setlist:', error);
    }
  };

  const tryLoadSetlist = (saved: SavedSetlist) => {
    if (hasUnsavedChanges && setlist.length > 0) {
      setPendingAction({ type: 'load', setlist: saved });
      setShowUnsavedWarning(true);
    } else {
      loadSetlistDirect(saved);
    }
  };

  // clearSetlistDirect must be defined first as other functions depend on it
  const clearSetlistDirect = useCallback(() => {
    clearSetlistFromContext();
    itemBackgroundMutedRef.current = false;
    setItemBackgroundMuted(false);
    pendingItemBackgroundRef.current = '';
    setActiveItemBackground('');
    setShowUnsavedWarning(false);
    setPendingAction(null);
  }, [clearSetlistFromContext]);

  const loadSetlistDirect = useCallback((saved: SavedSetlist) => {
    // Validate items - filter out songs that no longer exist in the library
    // Create a Map for O(1) lookups instead of O(n) some()/find() calls
    const songsById = new Map(songs.map(s => [s.id, s]));

    const validatedItems = saved.items
      .filter(item => {
        if (item.type === 'song' && item.song?.id) {
          if (!songsById.has(item.song.id)) {
            console.warn(`[Setlist] Song "${item.song?.title}" (${item.song?.id}) no longer exists, removing from setlist`);
            return false;
          }
        }
        return true;
      })
      .map(item => {
        // Update song data with latest from library (immutable update)
        if (item.type === 'song' && item.song?.id) {
          const latestSong = songsById.get(item.song.id);
          if (latestSong) {
            return { ...item, song: latestSong };
          }
        }
        return item;
      });

    setSetlist(validatedItems);
    setCurrentSetlistName(saved.name);
    setCurrentSetlistId(saved.id);
    setSetlistBackground(saved.background || '');
    itemBackgroundMutedRef.current = false;
    setItemBackgroundMuted(false);
    pendingItemBackgroundRef.current = '';
    setActiveItemBackground('');
    updateSavedSnapshot(validatedItems, saved.background);
    setShowLoadModal(false);
    setShowUnsavedWarning(false);
    setPendingAction(null);
  }, [updateSavedSnapshot, songs]);

  const deleteSetlistById = useCallback(async (id: string) => {
    try {
      await window.electronAPI.deleteSetlist(id);
      // Reload all setlists to get updated list
      await loadSavedSetlists();
      // Clear current if we deleted the active one
      if (currentSetlistId === id) {
        clearSetlistDirect();
      }
    } catch (error) {
      console.error('Failed to delete setlist:', error);
    }
  }, [currentSetlistId, clearSetlistDirect]);

  const tryClearSetlist = useCallback(() => {
    if (hasUnsavedChanges && setlist.length > 0) {
      setPendingAction({ type: 'clear' });
      setShowUnsavedWarning(true);
    } else {
      clearSetlistDirect();
    }
  }, [hasUnsavedChanges, setlist.length, clearSetlistDirect]);

  const importMidi = useCallback(async () => {
    try {
      const result = await window.electronAPI.showOpenDialog({
        filters: [{ name: 'MIDI Files', extensions: ['mid', 'midi'] }]
      });
      if (result.canceled || !result.filePaths.length) return;

      const bytes = await window.electronAPI.readBinaryFile(result.filePaths[0]);
      const payload = parseMidiSongPayload(bytes) as MidiItemPayload | null;
      if (!payload) {
        alert('No data found in this MIDI file.\nOnly MIDI files exported from SoluCast contain embedded data.');
        return;
      }

      const itemType = payload.itemType || 'song';

      if (itemType === 'song' || itemType === 'bible') {
        // Song/Bible import — existing logic
        const existingSong = await window.electronAPI.getSongByTitle(payload.title);
        let song: any;

        const songData = {
          title: payload.title,
          slides: payload.slides,
          ...(payload.author && { author: payload.author }),
          ...(payload.originalLanguage && { originalLanguage: payload.originalLanguage }),
          ...(payload.tags?.length && { tags: payload.tags }),
        };

        if (existingSong) {
          song = await window.electronAPI.updateSong(existingSong.id, songData);
        } else {
          song = await window.electronAPI.createSong(songData);
        }

        await loadSongs();

        const setlistType = itemType === 'bible' ? 'bible' : 'song';
        setSetlist(prev => {
          const existingIndex = prev.findIndex(
            item => item.type === setlistType && item.song?.id === song.id
          );
          if (existingIndex >= 0) {
            return prev.map((item, i) =>
              i === existingIndex && item.type === setlistType
                ? { ...item, song, ...(payload.background && { background: payload.background }) }
                : item
            );
          } else {
            return [...prev, {
              id: crypto.randomUUID(),
              type: setlistType,
              song,
              ...(itemType === 'bible' && { title: payload.title }),
              ...(payload.background && { background: payload.background }),
            }];
          }
        });

        alert(`${itemType === 'bible' ? 'Bible passage' : 'Song'} "${payload.title}" ${existingSong ? 'updated' : 'imported'} successfully!`);
      } else if (itemType === 'presentation') {
        // Presentation import
        const presData = {
          title: payload.title,
          slides: payload.presentationSlides || [],
          ...(payload.quickModeData && { quickModeData: payload.quickModeData }),
        };

        // Check if presentation exists by title
        const allPres = await window.electronAPI.getPresentations();
        const existingPres = allPres.find((p: any) => p.title === payload.title);
        let pres: any;

        if (existingPres) {
          pres = await window.electronAPI.updatePresentation(existingPres.id, presData);
        } else {
          pres = await window.electronAPI.createPresentation(presData);
        }

        setSetlist(prev => {
          const existingIndex = prev.findIndex(
            item => item.type === 'presentation' && item.presentation?.id === pres.id
          );
          if (existingIndex >= 0) {
            return prev.map((item, i) =>
              i === existingIndex
                ? { ...item, presentation: pres, ...(payload.background && { background: payload.background }) }
                : item
            );
          } else {
            return [...prev, {
              id: crypto.randomUUID(),
              type: 'presentation',
              presentation: pres,
              title: pres.title,
              ...(payload.background && { background: payload.background }),
            }];
          }
        });

        loadPresentations();
        alert(`Presentation "${payload.title}" ${existingPres ? 'updated' : 'imported'} successfully!`);
      } else {
        // Other item types (media, countdown, youtube, etc.)
        // Build a setlist item from payload data
        const newItem: any = {
          id: crypto.randomUUID(),
          type: itemType,
          title: payload.title,
          ...(payload.background && { background: payload.background }),
        };

        if (itemType === 'media') {
          newItem.mediaType = payload.mediaType;
          newItem.mediaPath = payload.mediaPath;
          newItem.mediaDuration = payload.mediaDuration;
          newItem.mediaName = payload.mediaName;
        } else if (itemType === 'countdown') {
          newItem.countdownTime = payload.countdownTime;
          newItem.countdownMessage = payload.countdownMessage;
        } else if (itemType === 'youtube') {
          newItem.videoId = payload.youtubeVideoId;
          newItem.youtubeTitle = payload.youtubeTitle;
        } else if (itemType === 'announcement') {
          newItem.text = payload.announcementText;
        } else if (itemType === 'messages') {
          newItem.messages = payload.messages;
          newItem.interval = payload.messagesInterval;
        } else if (itemType === 'audioPlaylist') {
          newItem.audioPlaylist = payload.audioPlaylist;
        }

        setSetlist(prev => [...prev, newItem]);
        alert(`${itemType} "${payload.title}" imported to setlist!`);
      }
    } catch (error) {
      console.error('Failed to import MIDI:', error);
      alert(`Failed to import MIDI file: ${error}`);
    }
  }, [loadSongs, loadPresentations]);

  const confirmUnsavedAction = useCallback(() => {
    if (!pendingAction) return;
    if (pendingAction.type === 'load' && pendingAction.setlist) {
      loadSetlistDirect(pendingAction.setlist);
    } else if (pendingAction.type === 'clear') {
      clearSetlistDirect();
    }
  }, [pendingAction, loadSetlistDirect, clearSetlistDirect]);

  const cancelUnsavedAction = useCallback(() => {
    setShowUnsavedWarning(false);
    setPendingAction(null);
  }, []);

  // Quick Slide hook
  const {
    updateQuickSlideCount,
    autoGenerateQuickSlide,
    parseAndBroadcastQuickSlide
  } = useQuickSlide(
    { displayMode, quickSlideText },
    {
      setQuickSlideCount,
      setQuickSlideText,
      setIsAutoGenerating,
      setSelectedSong,
      setCurrentSlideIndex,
      setIsBlank,
      setQuickSlideBroadcastIndex,
      setCurrentContentType,
      setLiveState,
      sendCurrentSlide
    },
    { quickSlideTextareaRef }
  );

  // Slide code keyboard navigation
  const { currentInput: slideCodeInput, isTyping: isTypingSlideCode } = useSlideKeyboardNav({
    codeMap: slideCodeMap,
    onNavigate: useCallback((slideIndex: number) => {
      if (selectedSongRef.current) {
        goToSlide(slideIndex);
      }
    }, [goToSlide]),
    enabled: !isHidden && !!selectedSong && !showQuickSlideModal && !showSongEditor && !showPrayerEditor && !showSlideEditor
  });

  // Load Bible books when switching to Bible panel
  const handleResourcePanelChange = useCallback((panel: ResourcePanel) => {
    // Direct state update for instant tab switch
    setActiveResourcePanel(panel);
  }, []);

  // Side effects after tab change - runs after render, doesn't block tab switch
  useEffect(() => {
    if (activeResourcePanel === 'bible' && bibleBooks.length === 0) {
      fetchBibleBooks();
    }
  }, [activeResourcePanel, bibleBooks.length, fetchBibleBooks]);

  // Memoized callbacks for MediaPanel (avoid inline arrows in JSX)
  const handleAddMediaToSetlist = useCallback((media: { type: 'image' | 'video' | 'audio'; path: string; name: string; duration?: number | null; thumbnailPath?: string | null }) => {
    const newItem = {
      id: crypto.randomUUID(),
      type: 'media' as const,
      mediaType: media.type,
      mediaPath: media.path,
      mediaName: media.name,
      mediaDuration: media.duration,
      thumbnailPath: media.thumbnailPath,
      title: media.name
    };
    setSetlist(prev => [...prev, newItem]);
  }, []);

  const handleAddPlaylistToSetlist = useCallback((playlist: { name: string; tracks: Array<{ path: string; name: string; duration?: number | null }>; shuffle: boolean }) => {
    const newItem = {
      id: crypto.randomUUID(),
      type: 'audioPlaylist' as const,
      title: playlist.name,
      audioPlaylist: playlist
    };
    setSetlist(prev => [...prev, newItem]);
  }, []);

  const handleAddYoutubeToSetlist = useCallback((videoId: string, title: string, thumbnail: string) => {
    const newItem = {
      id: crypto.randomUUID(),
      type: 'youtube' as const,
      youtubeVideoId: videoId,
      youtubeTitle: title,
      youtubeThumbnail: thumbnail,
      title: title
    };
    setSetlist(prev => [...prev, newItem]);
  }, []);

  // --- Hoisted callbacks for always-visible components (prevents memo-busting inline arrows) ---

  // HeaderBar callbacks
  const handleCreateTheme = useCallback((themeType: 'songs' | 'bible' | 'prayer' | 'stage' | 'obs-songs' | 'obs-bible' | 'obs-prayer' | 'dual-translation') => {
    setShowThemePanel(false);
    const routes: Record<string, string> = {
      'songs': '/theme-editor?new=true',
      'bible': '/bible-theme-editor?new=true',
      'prayer': '/prayer-theme-editor?new=true',
      'stage': '/stage-monitor-editor?new=true',
      'obs-songs': '/obs-songs-theme-editor?new=true',
      'obs-bible': '/obs-bible-theme-editor?new=true',
      'obs-prayer': '/obs-prayer-theme-editor?new=true',
      'dual-translation': '/dual-translation-theme-editor?new=true',
    };
    if (routes[themeType]) navigate(routes[themeType]);
  }, [navigate]);

  const handleEditTheme = useCallback((themeType: 'songs' | 'bible' | 'prayer' | 'stage' | 'obs-songs' | 'obs-bible' | 'obs-prayer' | 'dual-translation', themeId: string) => {
    setShowThemePanel(false);
    const routes: Record<string, string> = {
      'songs': `/theme-editor?id=${themeId}`,
      'bible': `/bible-theme-editor?id=${themeId}`,
      'prayer': `/prayer-theme-editor?id=${themeId}`,
      'stage': `/stage-monitor-editor?id=${themeId}`,
      'obs-songs': `/obs-songs-theme-editor?id=${themeId}`,
      'obs-bible': `/obs-bible-theme-editor?id=${themeId}`,
      'obs-prayer': `/obs-prayer-theme-editor?id=${themeId}`,
      'dual-translation': `/dual-translation-theme-editor?id=${themeId}`,
    };
    if (routes[themeType]) navigate(routes[themeType]);
  }, [navigate]);

  const handleShowAuthModal = useCallback(() => setShowAuthModal(true), []);
  const handleToggleMidiControl = useCallback(() => {
    setMidiControlEnabled(prev => {
      const next = !prev;
      window.electronAPI.setMidiControlEnabled(next);
      return next;
    });
  }, []);
  const handleNavigateToSettings = useCallback(() => setShowSettings(true), []);
  const handleCloseSettings = useCallback(() => setShowSettings(false), []);
  const handleControlDisplayChange = useCallback(async (displayId: number) => {
    const success = await window.electronAPI.moveControlWindow(displayId);
    if (success) setControlDisplayId(displayId);
  }, []);
  const handleIdentifyDisplay = useCallback((displayId: number) => window.electronAPI.identifyDisplays(displayId), []);
  // SongsPanel callback
  const handleSelectSongForPanel = useCallback((s: any) => {
    pendingItemBackgroundRef.current = '';
    itemBackgroundMutedRef.current = false;
    setItemBackgroundMuted(false);
    setActiveItemBackground('');
    selectSong(s, 'song', false);
  }, [selectSong]);

  // PresentationsPanel callback
  const handleNewPresentation = useCallback(() => setShowTemplateModal(true), []);

  // SetlistPanel callbacks
  const handleShowLoadModal = useCallback(() => setShowLoadModal(true), []);
  const handleShowSaveModal = useCallback(() => setShowSaveModal(true), []);
  const handleSelectPresentationFromSetlist = useCallback((pres: any) => {
    setSelectedPresentation(pres);
    setCurrentPresentationSlideIndex(0);
  }, []);
  const handleSetCurrentContentType = useCallback((type: string) => {
    if (type === 'song' || type === 'bible' || type === 'prayer') {
      setCurrentContentType(type as 'song' | 'bible' | 'prayer');
    }
  }, []);
  const handleSendBlank = useCallback(() => window.electronAPI.sendBlank(), []);
  const handleClearMediaSetlist = useCallback(() => window.electronAPI.clearMedia(), []);
  const handleStartEditingSongFromSetlist = useCallback((song: any) => startEditingSong(song ?? undefined), [startEditingSong]);
  const handlePlayYoutubeVideo = useCallback((videoId: string, title: string, thumbnail?: string) => {
    // Stop other media types first
    setActiveMedia(null);
    setActiveAudio(null);
    setActiveAudioSetlistId(null);
    window.electronAPI.clearMedia();

    setActiveYoutubeVideo({ videoId, title, thumbnail: thumbnail || '' });
    setYoutubeOnDisplay(true);
    window.electronAPI.youtubeLoad(videoId, title);
  }, []);
  const handleStopYoutubeVideo = useCallback(() => {
    setYoutubeOnDisplay(false);
    setActiveYoutubeVideo(null);
    window.electronAPI.youtubeStop();
  }, []);

  // Item background handlers
  const handleSetItemBackground = useCallback((itemId: string, background: string) => {
    setSetlist(prev => prev.map(item =>
      item.id === itemId ? { ...item, background: background || undefined } : item
    ));
    // If setting background for the currently selected song, update the pending ref
    // so the next sendSlide uses it without needing to re-click the song
    const currentSong = selectedSongRef.current;
    const matchingItem = setlist.find(i =>
      (i.type === 'song' || i.type === 'bible') && i.song?.id === currentSong?.id && i.id === itemId
    );
    if (matchingItem) {
      pendingItemBackgroundRef.current = background || '';
      if (background) {
        itemBackgroundMutedRef.current = false;
        setItemBackgroundMuted(false);
      }
    }
  }, [setlist]);

  const handleApplyItemBackground = useCallback((item: ContextSetlistItem) => {
    // Store in ref only — don't update state yet so live preview doesn't change.
    // The state (and live preview) will update when a slide is actually sent to display.
    pendingItemBackgroundRef.current = item.background || '';
    // Preserve the mute state across item switches — the user must explicitly
    // click the toggle to unmute. This way muting on Song1 stays muted on Song3.
  }, []);

  const handleToggleItemBackground = useCallback(() => {
    const newMuted = !itemBackgroundMutedRef.current;
    itemBackgroundMutedRef.current = newMuted;
    setItemBackgroundMuted(newMuted);
    // Immediately update the viewer display
    // Muting suppresses both per-item AND setlist backgrounds, falling back to global only
    const bg = newMuted ? selectedBackgroundRef.current : (pendingItemBackgroundRef.current || setlistBackgroundRef.current || selectedBackgroundRef.current);
    setActiveItemBackground(newMuted ? '' : pendingItemBackgroundRef.current);
    window.electronAPI.setBackground(bg);
  }, []);

  // LivePreviewPanel callbacks
  const handleVideoTimeUpdate = useCallback((currentTime: number, duration: number) => {
    const now = Date.now();
    if (now - lastVideoTimeUpdateRef.current >= TIME_UPDATE_THROTTLE_MS) {
      lastVideoTimeUpdateRef.current = now;
      setVideoStatus(prev => ({ ...prev, currentTime, duration }));
    }
  }, []);
  const handleVideoPlay = useCallback(() => {
    setVideoStatus(prev => ({ ...prev, isPlaying: true }));
    window.electronAPI.resumeVideo();
  }, []);
  const handleVideoPause = useCallback(() => {
    setVideoStatus(prev => ({ ...prev, isPlaying: false }));
    window.electronAPI.pauseVideo();
  }, []);
  const handleVideoSeeked = useCallback((currentTime: number) => {
    window.electronAPI.seekVideo(currentTime);
  }, []);
  const handlePreviewVideoEnded = useCallback(() => {
    if (videoLoopRef.current) {
      const video = previewVideoRef.current;
      if (video) {
        video.currentTime = 0;
        video.play().catch(console.error);
      }
      window.electronAPI.seekVideo(0);
      window.electronAPI.resumeVideo();
      setVideoStatus(prev => ({ ...prev, currentTime: 0, isPlaying: true }));
    } else {
      setVideoStatus(prev => ({ ...prev, isPlaying: false, currentTime: 0 }));
    }
  }, []);

  const handleToggleVideoLoop = useCallback(() => {
    setVideoLoop(prev => {
      const newLoop = !prev;
      videoLoopRef.current = newLoop;
      window.electronAPI.setVideoLoop(newLoop);
      return newLoop;
    });
  }, []);

  // SlideControlButtons callbacks (for LivePreviewPanel)
  const handleSetDisplayMode = useCallback((mode: 'bilingual' | 'original' | 'custom') => {
    let newMode: DisplayMode;
    let newCustom: boolean;
    if (mode === 'custom') {
      newMode = 'bilingual';
      newCustom = true;
    } else {
      newMode = mode;
      newCustom = false;
    }
    setDisplayMode(newMode);
    setCustomModeActive(newCustom);

    // Re-send current slide with new display mode after a brief delay to ensure state is updated
    const song = selectedSongRef.current;
    if (song && !isBlank && currentSlideIndex !== null && currentSlideIndex < song.slides.length) {
      // Use setTimeout to ensure displayMode state has been updated before re-sending
      setTimeout(() => {
        // Re-check bounds inside setTimeout since state may have changed
        if (currentSlideIndex >= song.slides.length) return;

        let combinedIndices: number[] | undefined;
        if (newMode === 'original' && combinedSlidesData) {
          const combinedIdx = combinedSlidesData.originalToCombined.get(currentSlideIndex);
          if (combinedIdx !== undefined) {
            combinedIndices = combinedSlidesData.combinedToOriginal.get(combinedIdx);
          }
        }

        // Update live state with refreshed slide data
        const slide = song.slides[currentSlideIndex];
        const slideData = currentContentType === 'bible' ? {
          ...slide,
          reference: (slide as any).hebrewReference || song.title,
          referenceEnglish: (slide as any).reference,
          originalLanguage: song.originalLanguage
        } : { ...slide, originalLanguage: song.originalLanguage };
        setLiveState({ slideData, contentType: currentContentType, songId: song.id, slideIndex: currentSlideIndex });

        sendCurrentSlide(song, currentSlideIndex, newMode, combinedIndices, currentContentType);
      }, 0);
    }
  }, [isBlank, currentSlideIndex, combinedSlidesData, currentContentType, sendCurrentSlide]);

  const handleOpenCustomConfig = useCallback(() => {
    setShowCustomDisplayModal(true);
  }, []);

  // Re-send current slide when translation language changes
  const translationLanguageRef = useRef(settings.translationLanguage);
  useEffect(() => {
    if (translationLanguageRef.current === settings.translationLanguage) return;
    translationLanguageRef.current = settings.translationLanguage;
    const song = selectedSongRef.current;
    if (song && !isBlank && currentSlideIndex < song.slides.length) {
      let combinedIndices: number[] | undefined;
      if (displayMode === 'original' && combinedSlidesData) {
        const combinedIdx = combinedSlidesData.originalToCombined.get(currentSlideIndex);
        if (combinedIdx !== undefined) {
          combinedIndices = combinedSlidesData.combinedToOriginal.get(combinedIdx);
        }
      }
      sendCurrentSlide(song, currentSlideIndex, displayMode, combinedIndices, currentContentType);
    }
  }, [settings.translationLanguage, isBlank, currentSlideIndex, displayMode, currentContentType, combinedSlidesData, sendCurrentSlide]);

  // Re-send current slide when custom display config changes (while custom mode is active)
  const customDisplayLinesRef = useRef(settings.customDisplayLines);
  useEffect(() => {
    if (customDisplayLinesRef.current === settings.customDisplayLines) return;
    customDisplayLinesRef.current = settings.customDisplayLines;
    if (!customModeActive) return;
    const song = selectedSongRef.current;
    if (song && !isBlank && currentSlideIndex < song.slides.length) {
      let combinedIndices: number[] | undefined;
      if (displayMode === 'original' && combinedSlidesData) {
        const combinedIdx = combinedSlidesData.originalToCombined.get(currentSlideIndex);
        if (combinedIdx !== undefined) {
          combinedIndices = combinedSlidesData.combinedToOriginal.get(combinedIdx);
        }
      }
      sendCurrentSlide(song, currentSlideIndex, displayMode, combinedIndices, currentContentType);
    }
  }, [settings.customDisplayLines, customModeActive, isBlank, currentSlideIndex, displayMode, currentContentType, combinedSlidesData, sendCurrentSlide]);

  const handleSetSetlistBackground = useCallback((background: string) => {
    setSetlistBackground(background || '');
    // Immediately push to display if no per-item bg is taking priority
    if (!itemBackgroundMutedRef.current && !pendingItemBackgroundRef.current) {
      window.electronAPI.setBackground(background || selectedBackgroundRef.current);
    }
  }, [setSetlistBackground]);

  const handleToggleBackgroundDropdown = useCallback(() => {
    setShowBackgroundDropdown(prev => !prev);
  }, []);

  const handleSelectBackground = useCallback((value: string) => {
    setSelectedBackground(value);
    pendingItemBackgroundRef.current = '';
    itemBackgroundMutedRef.current = false;
    setItemBackgroundMuted(false);
    setActiveItemBackground('');
    handleSetBackground(value);
    setShowBackgroundDropdown(false);
  }, [handleSetBackground]);

  const handleClearBackground = useCallback(() => {
    setSelectedBackground('');
    pendingItemBackgroundRef.current = '';
    itemBackgroundMutedRef.current = false;
    setItemBackgroundMuted(false);
    setActiveItemBackground('');
    handleSetBackground('');
  }, [handleSetBackground]);

  // BottomRowPanel callbacks
  const handleQuickModeClick = useCallback(() => {
    const isQuickModeActive = selectedSong?.id === 'quick-slide';
    if (isQuickModeActive) {
      // Turn off Quick Mode - clear the selected song
      setSelectedSong(null);
      setQuickSlideBroadcastIndex(-1);
    } else {
      // Turn on Quick Mode - create a quick-slide song placeholder
      const quickSong = {
        id: 'quick-slide',
        title: 'Quick Slide',
        slides: []
      };
      setSelectedSong(quickSong);
      setSelectedPresentation(null);
      updateQuickSlideCount(quickSlideText);
    }
  }, [selectedSong?.id, quickSlideText, updateQuickSlideCount, setSelectedSong, setSelectedPresentation]);

  // Handler for Quick Slide text changes from inline editor
  const handleQuickSlideTextChange = useCallback((text: string) => {
    setQuickSlideText(text);
  }, []);

  const handleSetAutoPlayActive = useCallback((active: boolean, presentation: any) => {
    setAutoPlayActive(active);
    if (active && presentation) {
      setAutoPlayPresentation(presentation);
      autoPlayActiveRef.current = true;
      const firstSlide = presentation.slides[0];
      if (firstSlide) {
        setCurrentPresentationSlideIndex(0);
        setIsBlank(false);
        setLiveState({
          slideData: firstSlide,
          contentType: 'presentation',
          songId: presentation.id,
          slideIndex: 0
        });
        window.electronAPI.sendSlide({
          songId: presentation.id,
          slideIndex: 0,
          displayMode: 'bilingual',
          isBlank: false,
          songTitle: presentation.title,
          presentationSlide: firstSlide,
          backgroundImage: (!itemBackgroundMutedRef.current && pendingItemBackgroundRef.current) || (!itemBackgroundMutedRef.current && setlistBackgroundRef.current) || selectedBackgroundRef.current || ''
        });
      }
    } else if (!active) {
      autoPlayActiveRef.current = false;
      setAutoPlayPresentation(null);
    }
  }, []);

  // Fetch Bible books when QuickModeWizard opens and books aren't loaded
  useEffect(() => {
    if (showQuickModeWizard && bibleBooks.length === 0) {
      fetchBibleBooks();
    }
  }, [showQuickModeWizard, bibleBooks.length, fetchBibleBooks]);

  // Reset Quick Mode wizard state (used before opening wizard with preset values)
  const resetQuickModeWizard = (showAfterReset = false) => {
    setQuickModeStep(1);
    setQuickModeType(null);
    setShowQuickModeWizard(showAfterReset);
    if (showAfterReset) {
      window.focus();
    }
  };


  const currentSlide = selectedSong?.slides[currentSlideIndex];

  // Memoize to avoid recalculating on every render
  const currentPresentationSlide = useMemo(() => {
    return selectedPresentation?.slides[currentPresentationSlideIndex] || null;
  }, [selectedPresentation?.slides, currentPresentationSlideIndex]);

  // Whether line4 is active in custom display mode
  const customLine4Active = customModeActive && settings.customDisplayLines.line4.type !== 'none';
  const wasFourLinePatchedRef = useRef(false);
  // Refs for theme values so the effect doesn't depend on theme objects
  // (applyViewerTheme updates selectedTheme, which would cause an infinite loop)
  const selectedThemeRef = useRef(selectedTheme);
  selectedThemeRef.current = selectedTheme;
  const selectedBibleThemeRef = useRef(selectedBibleTheme);
  selectedBibleThemeRef.current = selectedBibleTheme;
  const selectedPrayerThemeRef = useRef(selectedPrayerTheme);
  selectedPrayerThemeRef.current = selectedPrayerTheme;
  const selectedDualTranslationThemeRef = useRef(selectedDualTranslationTheme);
  selectedDualTranslationThemeRef.current = selectedDualTranslationTheme;

  // Apply dual translation theme to viewer displays when line4 becomes active/inactive
  useEffect(() => {
    if (customLine4Active) {
      // Use the dedicated dual translation theme when 4-line mode is active
      // Important: use applyDualTranslationTheme (not applyViewerTheme) to avoid
      // clobbering selectedTheme state and corrupting the persisted viewer theme ID
      const dualTheme = selectedDualTranslationThemeRef.current;
      if (dualTheme) {
        applyDualTranslationTheme(dualTheme);
      }
      wasFourLinePatchedRef.current = true;
    } else if (wasFourLinePatchedRef.current) {
      // Restore original theme only when transitioning away from 4-line mode
      wasFourLinePatchedRef.current = false;
      let baseTheme = selectedThemeRef.current;
      if (liveContentType === 'bible' && selectedBibleThemeRef.current) baseTheme = selectedBibleThemeRef.current;
      else if (liveContentType === 'prayer' && selectedPrayerThemeRef.current) baseTheme = selectedPrayerThemeRef.current;
      if (baseTheme) applyViewerTheme(baseTheme);
    }
  }, [customLine4Active, liveContentType, applyViewerTheme, applyDualTranslationTheme]);

  // Memoize theme for SlidePreview based on content type (for staged/selected content)
  const memoizedPreviewTheme = useMemo(() => {
    if (currentContentType === 'bible') return selectedBibleTheme;
    if (currentContentType === 'prayer') return selectedPrayerTheme;
    return selectedTheme;
  }, [currentContentType, selectedBibleTheme, selectedPrayerTheme, selectedTheme]);

  // Memoize theme for live preview based on what's actually on air
  const memoizedLivePreviewTheme = useMemo(() => {
    // When 4-line mode is active, use the dedicated dual translation theme
    if (customLine4Active && selectedDualTranslationTheme) return selectedDualTranslationTheme;
    let theme;
    if (liveContentType === 'bible') theme = selectedBibleTheme;
    else if (liveContentType === 'prayer') theme = selectedPrayerTheme;
    else theme = selectedTheme;
    return theme;
  }, [liveContentType, selectedBibleTheme, selectedPrayerTheme, selectedTheme, customLine4Active, selectedDualTranslationTheme]);

  // Memoize presentationSlide for SlidePreview
  // For the live preview, use liveSlideData when content type is 'presentation'
  // Prayer/sermon presentations use theme-based rendering (liveSlideData contains prayer data, not presentationSlide)
  const memoizedPresentationSlide = useMemo(() => {
    if (liveContentType === 'presentation' && liveSlideData) {
      return liveSlideData;
    }
    return null;
  }, [liveContentType, liveSlideData]);

  // Memoize resource panel tabs to prevent recreation of SVG icons on every render
  const resourceTabs = useMemo(() => [
    { id: 'songs', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M9 13c0 1.105-1.12 2-2.5 2S4 14.105 4 13s1.12-2 2.5-2 2.5.895 2.5 2z"/><path fillRule="evenodd" d="M9 3v10H8V3h1z"/><path d="M8 2.82a1 1 0 0 1 .804-.98l3-.6A1 1 0 0 1 13 2.22V4L8 5V2.82z"/></svg>, label: t('nav.songs') },
    { id: 'bible', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M1 2.828c.885-.37 2.154-.769 3.388-.893 1.33-.134 2.458.063 3.112.752v9.746c-.935-.53-2.12-.603-3.213-.493-1.18.12-2.37.461-3.287.811V2.828zm7.5-.141c.654-.689 1.782-.886 3.112-.752 1.234.124 2.503.523 3.388.893v9.923c-.918-.35-2.107-.692-3.287-.81-1.094-.111-2.278-.039-3.213.492V2.687zM8 1.783C7.015.936 5.587.81 4.287.94c-1.514.153-3.042.672-3.994 1.105A.5.5 0 0 0 0 2.5v11a.5.5 0 0 0 .707.455c.882-.4 2.303-.881 3.68-1.02 1.409-.142 2.59.087 3.223.877a.5.5 0 0 0 .78 0c.633-.79 1.814-1.019 3.222-.877 1.378.139 2.8.62 3.681 1.02A.5.5 0 0 0 16 13.5v-11a.5.5 0 0 0-.293-.455c-.952-.433-2.48-.952-3.994-1.105C10.413.809 8.985.936 8 1.783z"/></svg>, label: t('nav.bible') },
    { id: 'media', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M0 1a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H1a1 1 0 0 1-1-1V1zm4 0v6h8V1H4zm8 8H4v6h8V9z"/></svg>, label: t('nav.media') },
    { id: 'presentations', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2zm5 3a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm3 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm3 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/><path d="M2 13h12v1H2v-1z"/></svg>, label: t('nav.presentations') },
    { id: 'tools', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M1 0 0 1l2.2 3.081a1 1 0 0 0 .815.419h.07a1 1 0 0 1 .708.293l2.675 2.675-2.617 2.654A3.003 3.003 0 0 0 0 13a3 3 0 1 0 5.878-.851l2.654-2.617.968.968-.305.914a1 1 0 0 0 .242 1.023l3.27 3.27a.997.997 0 0 0 1.414 0l1.586-1.586a.997.997 0 0 0 0-1.414l-3.27-3.27a1 1 0 0 0-1.023-.242L10.5 9.5l-.96-.96 2.68-2.643A3.005 3.005 0 0 0 16 3q0-.405-.102-.777l-2.14 2.141L12 4l-.364-1.757L13.777.102a3 3 0 0 0-3.675 3.68L7.462 6.46 4.793 3.793a1 1 0 0 1-.293-.707v-.071a1 1 0 0 0-.419-.814z"/></svg>, label: t('nav.tools') }
  ], [t]);

  const assignedDisplays = useMemo(() => displays.filter(d => d.isAssigned), [displays]);

  // State for showing about modal from sidebar
  const [showAboutModal, setShowAboutModal] = useState(false);

  // Auto-update state
  const [updateStatus, setUpdateStatus] = useState<{ status: string; version?: string; releaseNotes?: string; progress?: number; error?: string }>({ status: 'idle' });
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const updateAvailable = updateStatus.status === 'available' || updateStatus.status === 'downloaded' || updateStatus.status === 'downloading';

  useEffect(() => {
    // Fetch initial update status
    window.electronAPI.autoUpdate.getStatus().then(setUpdateStatus).catch(() => {});
    // Subscribe to live status updates
    const unsubscribe = window.electronAPI.autoUpdate.onStatus((status: any) => {
      setUpdateStatus(status);
    });
    return unsubscribe;
  }, []);

  // Memoize major child panels to avoid re-renders from unrelated state changes
  const memoizedSetlistPanel = useMemo(() => (
    <SetlistPanel
      setlist={setlist}
      currentSetlistId={currentSetlistId}
      currentSetlistName={currentSetlistName}
      hasUnsavedChanges={hasUnsavedChanges}
      showSetlistMenu={showSetlistMenu}
      setlistMenuHover={setlistMenuHover}
      draggedSong={draggedSong}
      isDraggingMedia={isDraggingMedia}
      dropTargetIndex={dropTargetIndex}
      draggedSetlistIndex={draggedSetlistIndex}
      collapsedSections={collapsedSections}
      expandedPlaylistIds={expandedPlaylistIds}
      setlistMenuOpen={setlistMenuOpen}
      hoveredMediaStopId={hoveredMediaStopId}
      selectedSetlistMediaId={selectedSetlistMediaId}
      selectedYoutubeItemId={selectedYoutubeItemId}
      selectedSong={selectedSong}
      selectedPresentation={selectedPresentation}
      activeMedia={activeMedia}
      activeAudio={activeAudio}
      audioStatus={audioStatus}
      activeToolId={activeToolId}
      youtubeOnDisplay={youtubeOnDisplay}
      activeYoutubeVideo={activeYoutubeVideo}
      activePlaylistId={activePlaylistId}
      activePlaylistIndex={activePlaylistIndex}
      activePlaylistOrder={activePlaylistOrder}
      autoPlayActive={autoPlayActive}
      autoPlayInterval={autoPlayInterval}
      currentPresentationSlideIndex={currentPresentationSlideIndex}
      onShowSetlistMenuChange={setShowSetlistMenu}
      onSetlistMenuHoverChange={setSetlistMenuHover}
      onDraggedSongChange={setDraggedSong}
      onIsDraggingMediaChange={setIsDraggingMedia}
      onDropTargetIndexChange={setDropTargetIndex}
      onDraggedSetlistIndexChange={setDraggedSetlistIndex}
      onCollapsedSectionsChange={setCollapsedSections}
      onExpandedPlaylistIdsChange={setExpandedPlaylistIds}
      onSetlistMenuOpenChange={setSetlistMenuOpen}
      onHoveredMediaStopIdChange={setHoveredMediaStopId}
      onSelectedSetlistMediaIdChange={setSelectedSetlistMediaId}
      onSelectedYoutubeItemIdChange={setSelectedYoutubeItemId}
      onSetlistContextMenuChange={setSetlistContextMenu}
      onSetlistChange={setSetlist}
      onAddToSetlist={addToSetlist}
      onRemoveFromSetlist={removeFromSetlist}
      onTryClearSetlist={tryClearSetlist}
      onAddSectionHeader={addSectionHeader}
      onShowLoadModal={handleShowLoadModal}
      onShowSaveModal={handleShowSaveModal}
      onQuickSave={quickSaveSetlist}
      onSelectSong={selectSong}
      onSelectPresentation={handleSelectPresentationFromSetlist}
      onSetSelectedSong={setSelectedSong}
      onSetSelectedPresentation={setSelectedPresentation}
      onSetCurrentPresentationSlideIndex={setCurrentPresentationSlideIndex}
      onSetCurrentContentType={handleSetCurrentContentType}
      onSetIsBlank={setIsBlank}
      onSetLiveState={setLiveState}
      onSendBlank={handleSendBlank}
      onStopAllTools={stopAllTools}
      onBroadcastToolFromSetlist={broadcastToolFromSetlist}
      onSetActiveMedia={setActiveMedia}
      onSetActiveAudio={setActiveAudio}
      onSetActiveAudioSetlistId={setActiveAudioSetlistId}
      onHandlePlayAudio={handlePlayAudioWithMediaStop}
      onHandleDisplayMedia={handleDisplayMedia}
      onClearMedia={handleClearMediaSetlist}
      onStartPlaylist={startPlaylist}
      onSetActivePlaylistId={setActivePlaylistId}
      onSetActivePlaylistIndex={setActivePlaylistIndex}
      onSetActivePlaylistOrder={setActivePlaylistOrder}
      onOpenEditPlaylistModal={openEditPlaylistModal}
      onStartEditingSong={handleStartEditingSongFromSetlist}
      onPlayYoutubeVideo={handlePlayYoutubeVideo}
      onStopYoutubeVideo={handleStopYoutubeVideo}
      onSetItemBackground={handleSetItemBackground}
      onApplyItemBackground={handleApplyItemBackground}
      setlistBackground={setlistBackground}
      onOpenSetlistBackgroundModal={() => setShowSetlistBackgroundModal(true)}
      onImportMidi={importMidi}
    />
  ), [setlist, currentSetlistId, currentSetlistName, hasUnsavedChanges, showSetlistMenu, setlistMenuHover, draggedSong, isDraggingMedia, dropTargetIndex, draggedSetlistIndex, collapsedSections, expandedPlaylistIds, setlistMenuOpen, hoveredMediaStopId, selectedSetlistMediaId, selectedYoutubeItemId, selectedSong, selectedPresentation, activeMedia, activeAudio, audioStatus, activeToolId, youtubeOnDisplay, activeYoutubeVideo, activePlaylistId, activePlaylistIndex, activePlaylistOrder, autoPlayActive, autoPlayInterval, currentPresentationSlideIndex, setlistBackground, addToSetlist, removeFromSetlist, tryClearSetlist, addSectionHeader, handleShowLoadModal, handleShowSaveModal, quickSaveSetlist, selectSong, handleSelectPresentationFromSetlist, handleSetCurrentContentType, handleSendBlank, stopAllTools, broadcastToolFromSetlist, handlePlayAudioWithMediaStop, handleDisplayMedia, handleClearMediaSetlist, startPlaylist, openEditPlaylistModal, handleStartEditingSongFromSetlist, handlePlayYoutubeVideo, handleStopYoutubeVideo, handleSetItemBackground, handleApplyItemBackground, importMidi]);

  const memoizedSongsPanel = useMemo(() => (
    <SongsPanel
      songs={songs}
      selectedSong={selectedSong}
      draggedSong={draggedSong}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      onSelectSong={handleSelectSongForPanel}
      onAddToSetlist={addToSetlist}
      onEditSong={startEditingSong}
      onDeleteSong={deleteSongById}
      onDragStart={handleSongDragStart}
      onDragEnd={handleSongDragEnd}
    />
  ), [songs, selectedSong, draggedSong, searchQuery, handleSelectSongForPanel, addToSetlist, startEditingSong, deleteSongById, handleSongDragStart, handleSongDragEnd]);

  const memoizedBiblePanel = useMemo(() => (
    <BiblePanel
      bibleBooks={bibleBooks}
      selectedBibleBook={selectedBibleBook}
      selectedBibleChapter={selectedBibleChapter}
      bibleSlides={bibleSlides}
      bibleLoading={bibleLoading}
      biblePassage={biblePassage}
      bibleSearchQuery={bibleSearchQuery}
      onBibleBookChange={setSelectedBibleBook}
      onBibleChapterChange={setSelectedBibleChapter}
      onBibleSearch={handleBibleSearch}
      onAddBibleToSetlist={addBibleToSetlist}
    />
  ), [bibleBooks, selectedBibleBook, selectedBibleChapter, bibleSlides, bibleLoading, biblePassage, bibleSearchQuery, handleBibleSearch, addBibleToSetlist]);

  const memoizedPresentationsPanel = useMemo(() => (
    <PresentationsPanel
      presentations={presentations}
      selectedPresentation={selectedPresentation}
      presentationSearchQuery={presentationSearchQuery}
      onSearchChange={setPresentationSearchQuery}
      onSelectPresentation={handlePresentationSelect}
      onAddToSetlist={addPresentationToSetlist}
      onEditPresentation={handlePresentationEdit}
      onDeletePresentation={handlePresentationDelete}
      onDragStart={handlePresentationDragStart}
      onNewPresentation={handleNewPresentation}
    />
  ), [presentations, selectedPresentation, presentationSearchQuery, handlePresentationSelect, addPresentationToSetlist, handlePresentationEdit, handlePresentationDelete, handlePresentationDragStart, handleNewPresentation]);

  const memoizedBottomRowPanel = useMemo(() => (
    <BottomRowPanel
      selectedSong={selectedSong}
      selectedPresentation={selectedPresentation}
      displayMode={displayMode}
      currentSlideIndex={currentSlideIndex}
      liveSongId={liveSongId}
      liveSlideIndex={liveSlideIndex}
      isBlank={isBlank}
      isRTL={isRTL}
      contentType={currentContentType}
      isQuickModeActive={selectedSong?.id === 'quick-slide'}
      onQuickModeClick={handleQuickModeClick}
      quickSlideCount={quickSlideCount}
      quickSlideBroadcastIndex={quickSlideBroadcastIndex}
      isAutoGenerating={isAutoGenerating}
      onQuickSlideTextChange={handleQuickSlideTextChange}
      onAutoGenerateQuickSlide={autoGenerateQuickSlide}
      onBroadcastQuickSlide={parseAndBroadcastQuickSlide}
      autoPlayActive={autoPlayActive}
      autoPlayInterval={autoPlayInterval}
      currentPresentationSlideIndex={currentPresentationSlideIndex}
      combinedSlidesData={combinedSlidesData}
      selectedCombinedIndex={selectedCombinedIndex}
      quickSlideText={quickSlideText}
      getVerseTypeColor={getVerseTypeColor}
      selectSlide={selectSlide}
      goToSlide={goToSlide}
      selectCombinedSlide={selectCombinedSlide}
      sendPrayerPresentationSlide={sendPrayerPresentationSlide}
      updateQuickSlideCount={updateQuickSlideCount}
      onSetIsBlank={setIsBlank}
      onSetLiveState={setLiveState}
      onSetAutoPlayActive={handleSetAutoPlayActive}
      onSetAutoPlayInterval={setAutoPlayInterval}
      onSetCurrentPresentationSlideIndex={setCurrentPresentationSlideIndex}
      onSlideCodeMapChange={setSlideCodeMap}
      onEditSlide={handleEditSlide}
      onAddSlide={handleAddSlide}
      arrangementState={arrangementState}
      editingSongSlideIndex={editingSongSlideIndex}
      onSaveSongSlides={handleSaveSongSlides}
      onCancelEditSongSlides={handleCancelEditSongSlides}
    />
  ), [selectedSong, selectedPresentation, displayMode, currentSlideIndex, liveSongId, liveSlideIndex, isBlank, isRTL, currentContentType, quickSlideCount, quickSlideBroadcastIndex, isAutoGenerating, autoPlayActive, autoPlayInterval, currentPresentationSlideIndex, combinedSlidesData, selectedCombinedIndex, quickSlideText, selectSlide, goToSlide, selectCombinedSlide, sendPrayerPresentationSlide, updateQuickSlideCount, handleSetAutoPlayActive, handleEditSlide, handleAddSlide, arrangementState, editingSongSlideIndex, handleSaveSongSlides, handleCancelEditSongSlides, handleQuickModeClick, handleQuickSlideTextChange, autoGenerateQuickSlide, parseAndBroadcastQuickSlide]);

  return (
    <div className="control-panel" style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: colors.background.base }}>
      {/* Header in headless mode - only renders dropdown panels */}
      <HeaderBar
        headless={true}
        showDisplayPanel={showDisplayPanel}
        displays={displays}
        assignedDisplays={assignedDisplays}
        controlDisplayId={controlDisplayId}
        onlineConnected={onlineConnected}
        viewerCount={viewerCount}
        roomPin={roomPin}
        authState={authState}
        showUserMenu={showUserMenu}
        themes={themes}
        stageMonitorThemes={stageMonitorThemes}
        bibleThemes={bibleThemes}
        prayerThemes={prayerThemes}
        dualTranslationThemes={dualTranslationThemes}
        obsThemes={obsThemes}
        selectedOBSSongsTheme={selectedOBSSongsTheme}
        selectedOBSBibleTheme={selectedOBSBibleTheme}
        selectedOBSPrayerTheme={selectedOBSPrayerTheme}
        onApplyOBSTheme={applyOBSThemeCallback}
        showThemePanel={showThemePanel}
        selectedTheme={selectedTheme}
        selectedBibleTheme={selectedBibleTheme}
        selectedPrayerTheme={selectedPrayerTheme}
        selectedStageTheme={selectedStageTheme}
        selectedDualTranslationTheme={selectedDualTranslationTheme}
        onShowThemePanelChange={setShowThemePanel}
        onApplyViewerTheme={applyViewerTheme}
        onApplyBibleTheme={applyBibleThemeCallback}
        onApplyPrayerTheme={applyPrayerThemeCallback}
        onApplyStageTheme={applyStageTheme}
        onApplyDualTranslationTheme={applyDualTranslationTheme}
        onCreateTheme={handleCreateTheme}
        onEditTheme={handleEditTheme}
        onShowDisplayPanelChange={setShowDisplayPanel}
        onShowUserMenuChange={setShowUserMenu}
        onShowAuthModal={handleShowAuthModal}
        onShowKeyboardHelp={handleShowAuthModal} /* button removed but prop kept for interface */
        onNavigateToSettings={handleNavigateToSettings}
        onControlDisplayChange={handleControlDisplayChange}
        onOpenDisplay={openDisplay}
        onCloseDisplay={closeDisplay}
        onIdentifyDisplay={handleIdentifyDisplay}
        onCloseDisplayPanel={handleCloseDisplayPanel}
        onConnectOnline={connectOnline}
        onLogout={handleLogout}
        virtualDisplays={virtualDisplays}
        onAddVirtualDisplay={() => setShowVirtualDisplayModal(true)}
        onRemoveVirtualDisplay={handleRemoveVirtualDisplay}
        onCopyVirtualDisplayUrl={handleCopyVirtualDisplayUrl}
        activePublicRoom={activePublicRoom}
        onCreatePublicRoom={handleCreatePublicRoom}
        onUnlinkPublicRoom={handleUnlinkPublicRoom}
        isStreaming={isStreaming}
      />

      {/* Main Content - Two Row Layout */}
      <main ref={mainContentRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '12px', gap: '0' }}>
        {/* Top Row - Sidebar | Live Preview | Setlist | Tabs (for RTL: Tabs rightmost) */}
        <div style={{ height: `${topRowHeight}%`, display: 'flex', flexDirection: isRTL ? 'row-reverse' : 'row', overflow: 'hidden', minHeight: 0 }}>
          {/* Vertical Sidebar - leftmost (or rightmost in RTL) */}
          <VerticalSidebar
            displays={displays}
            assignedDisplays={assignedDisplays}
            onlineConnected={onlineConnected}
            viewerCount={viewerCount}
            authState={authState}
            themes={themes}
            selectedTheme={selectedTheme}
            updateAvailable={updateAvailable}
            midiBridgeConnected={midiBridgeConnected}
            midiControlEnabled={midiControlEnabled}
            onShowUpdateModal={() => setShowUpdateModal(true)}
            onShowDisplayPanel={() => setShowDisplayPanel(!showDisplayPanel)}
            onShowThemePanel={() => setShowThemePanel(!showThemePanel)}
            onShowAuthModal={handleShowAuthModal}
            onShowUserMenu={() => setShowUserMenu(prev => !prev)}
            onToggleMidiControl={handleToggleMidiControl}
            onNavigateToSettings={handleNavigateToSettings}
            onShowAboutModal={() => setShowAboutModal(true)}
          />

          {/* Live Preview */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
            <LivePreviewPanel
              displays={displays}
              selectedSong={selectedSong}
              currentSlide={currentSlide}
              isBlank={isBlank}
              activeMedia={activeMedia}
              youtubeOnDisplay={youtubeOnDisplay}
              activeYoutubeVideo={activeYoutubeVideo}
              selectedPresentation={selectedPresentation}
              selectedYoutubeItemId={selectedYoutubeItemId}
              currentContentType={currentContentType}
              onlineConnected={onlineConnected}
              displayMode={displayMode}
              selectedBackground={activeItemBackground || (!itemBackgroundMuted && setlistBackground) || selectedBackground}
              liveSlideData={liveSlideData}
              memoizedLivePreviewTheme={memoizedLivePreviewTheme}
              memoizedTools={memoizedTools}
              memoizedPresentationSlide={memoizedPresentationSlide}
              combinedSlidesData={combinedSlidesData}
              selectedCombinedIndex={selectedCombinedIndex}
              youtubeContainerRef={youtubeContainerRef}
              previewVideoRef={previewVideoRef}
              getVerseTypeColor={getVerseTypeColor}
              onYoutubeStop={handleYoutubeStop}
              onClearMedia={handleClearMedia}
              videoLoop={videoLoop}
              onToggleVideoLoop={handleToggleVideoLoop}
              onVideoTimeUpdate={handleVideoTimeUpdate}
              onVideoPlay={handleVideoPlay}
              onVideoPause={handleVideoPause}
              onVideoSeeked={handleVideoSeeked}
              onVideoEnded={handlePreviewVideoEnded}
              showBackgroundDropdown={showBackgroundDropdown}
              isRTL={isRTL}
              customModeActive={customModeActive}
              onToggleBlank={toggleBlank}
              onSetDisplayMode={handleSetDisplayMode}
              onOpenCustomConfig={handleOpenCustomConfig}
              onToggleBackgroundDropdown={handleToggleBackgroundDropdown}
              onSelectBackground={handleSelectBackground}
              onClearBackground={handleClearBackground}
              hasItemBackground={!!activeItemBackground || !!setlistBackground || itemBackgroundMuted}
              itemBackgroundMuted={itemBackgroundMuted}
              onToggleItemBackground={handleToggleItemBackground}
              assignedDisplays={assignedDisplays}
              isStreaming={isStreaming}
              themes={themes}
              bibleThemes={bibleThemes}
              prayerThemes={prayerThemes}
              stageMonitorThemes={stageMonitorThemes}
              liveContentType={liveContentType}
              selectedStageTheme={selectedStageTheme}
              obsThemes={obsThemes}
            />
          </div>

          {/* Resize Handle - Live Preview/Setlist */}
          <ResizeHandle
            direction="vertical"
            isResizing={isResizing === 'row'}
            onMouseDown={(e) => startResize('row', e)}
          />

          {/* Middle - Setlist */}
          <div style={{ width: `${setlistPanelWidth}%`, flexShrink: 0, display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', overflow: 'hidden', minWidth: 0 }}>
            <React.Suspense fallback={null}>
            {memoizedSetlistPanel}
            </React.Suspense>
          </div>

          {/* Resize Handle - Setlist/Tabs */}
          <ResizeHandle
            direction="vertical"
            isResizing={isResizing === 'left'}
            onMouseDown={(e) => startResize('left', e)}
          />

          {/* Right - Resource Panel (Tabs) - rightmost for RTL */}
          <div style={{ width: `${leftPanelWidth}%`, flexShrink: 0, display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', overflow: 'hidden', minWidth: 0 }}>
            {/* Resource Tabs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderBottom: activeResourcePanel === 'songs' ? 'none' : '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ display: 'flex', gap: '4px' }}>
                {resourceTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => handleResourcePanelChange(tab.id as ResourcePanel)}
                    className={`resource-tab-button ${activeResourcePanel === tab.id ? 'active' : ''}`}
                    title={tab.label}
                  >
                    <span className="tab-icon">{tab.icon}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Import Status */}
            {importStatus && (
              <div style={{ padding: '8px 12px', background: importStatus.startsWith('Error') ? 'rgba(220, 53, 69, 0.2)' : 'rgba(40, 167, 69, 0.2)', color: importStatus.startsWith('Error') ? '#ff6b6b' : '#51cf66', fontSize: '0.75rem' }}>
                {importStatus}
              </div>
            )}

            {/* Resource Content - Conditional rendering for performance (unmounts inactive panels) */}
            <div style={{ flex: 1, overflow: 'auto' }}>
              {/* Songs Panel */}
              {activeResourcePanel === 'songs' && (
                <React.Suspense fallback={<div style={{ padding: '20px', color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>Loading...</div>}>
                  {memoizedSongsPanel}
                </React.Suspense>
              )}

              {/* Media Panel - kept mounted with display:none to avoid expensive IPC remounts */}
              <div style={{ display: activeResourcePanel === 'media' ? 'contents' : 'none' }}>
                <React.Suspense fallback={<div style={{ padding: '20px', color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>Loading...</div>}>
                <MediaPanel
                  youtubeUrlInput={youtubeUrlInput}
                  youtubeLoading={youtubeLoading}
                  youtubeSearchLoading={youtubeSearchLoading}
                  youtubeSearchResults={youtubeSearchResults}
                  showYoutubeSearchResults={showYoutubeSearchResults}
                  onYoutubeUrlInputChange={setYoutubeUrlInput}
                  onYoutubeInputSubmit={handleYoutubeInputSubmit}
                  onCloseYoutubeSearchResults={closeYoutubeSearchResults}
                  onDisplayMedia={handleDisplayMedia}
                  onPlayAudio={handlePlayAudioWithMediaStop}
                  onAddMediaToSetlist={handleAddMediaToSetlist}
                  onAddPlaylistToSetlist={handleAddPlaylistToSetlist}
                  onAddYoutubeToSetlist={handleAddYoutubeToSetlist}
                  isYouTubeUrl={isYouTubeUrl}
                />
                </React.Suspense>
              </div>

              {/* Tools Panel */}
              {activeResourcePanel === 'tools' && (
                <React.Suspense fallback={<div style={{ padding: '20px', color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>Loading...</div>}>
                <ToolsPanel
                  countdownTargetTime={countdownTargetTime}
                  countdownRemaining={countdownRemaining}
                  countdownMessage={countdownMessage}
                  countdownMessageTranslation={countdownMessageTranslation}
                  isCountdownActive={isCountdownActive}
                  onCountdownTargetTimeChange={setCountdownTargetTime}
                  onCountdownMessageChange={setCountdownMessage}
                  onCountdownMessageTranslationChange={setCountdownMessageTranslation}
                  onStartCountdown={startCountdownFromTime}
                  onStopCountdown={stopCountdown}
                  onAddCountdownToSetlist={addCountdownToSetlist}
                  announcementText={announcementText}
                  isAnnouncementActive={isAnnouncementActive}
                  onAnnouncementTextChange={setAnnouncementText}
                  onShowAnnouncement={showAnnouncement}
                  onHideAnnouncement={hideAnnouncement}
                  onAddAnnouncementToSetlist={addAnnouncementToSetlist}
                  currentTime={currentTime}
                  clockFormat={clockFormat}
                  clockShowDate={clockShowDate}
                  isClockActive={isClockActive}
                  onClockFormatChange={setClockFormat}
                  onClockShowDateToggle={() => setClockShowDate(!clockShowDate)}
                  onStartClock={startClock}
                  onStopClock={stopClock}
                  stopwatchTime={stopwatchTime}
                  isStopwatchRunning={isStopwatchRunning}
                  isStopwatchActive={isStopwatchActive}
                  onStartStopwatch={startStopwatch}
                  onPauseStopwatch={pauseStopwatch}
                  onResetStopwatch={resetStopwatch}
                  onStopStopwatchBroadcast={stopStopwatchBroadcast}
                />
                </React.Suspense>
              )}

              {/* Bible Panel */}
              {activeResourcePanel === 'bible' && (
                <React.Suspense fallback={<div style={{ padding: '20px', color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>Loading...</div>}>
                {memoizedBiblePanel}
                </React.Suspense>
              )}

              {/* Presentations Panel */}
              {activeResourcePanel === 'presentations' && (
                <React.Suspense fallback={<div style={{ padding: '20px', color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>Loading...</div>}>
                {memoizedPresentationsPanel}
                </React.Suspense>
              )}
            </div>
          </div>
        </div>{/* End of Top Row */}

        {/* Horizontal Resize Handle - Top/Bottom Rows */}
        <ResizeHandle
          direction="horizontal"
          isResizing={isResizing === 'setlist'}
          onMouseDown={(e) => startResize('setlist', e)}
        />

        {/* Bottom Row - Slides Preview */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
          {memoizedBottomRowPanel}
        </div>
      </main>

      {/* Slide Code Keyboard Navigation Indicator */}
      <SlideCodeIndicator currentInput={slideCodeInput} isTyping={isTypingSlideCode} />

      {/* Section Title Modal */}
      {showSectionModal && (
        <React.Suspense fallback={null}>
        <SectionModal
          onClose={() => setShowSectionModal(false)}
          onConfirm={(title) => {
            setSetlist([...setlist, { id: crypto.randomUUID(), type: 'section', title }]);
            setShowSectionModal(false);
          }}
        />
        </React.Suspense>
      )}

      {showSaveModal && (
        <React.Suspense fallback={null}>
        <SaveSetlistModal
          initialName={currentSetlistName}
          onClose={() => setShowSaveModal(false)}
          onSave={saveSetlist}
        />
        </React.Suspense>
      )}

      {/* Load Modal */}
      {showLoadModal && (
        <React.Suspense fallback={null}>
        <LoadSetlistModal
          savedSetlists={savedSetlists}
          onClose={() => setShowLoadModal(false)}
          onLoad={tryLoadSetlist}
          onDelete={deleteSetlistById}
          isLoggedIn={authState.isAuthenticated}
        />
        </React.Suspense>
      )}

      {/* Quick Slide Modal */}
      {showQuickSlideModal && (
        <React.Suspense fallback={null}>
        <QuickSlideModal
          quickSlideText={quickSlideText}
          quickSlideCount={quickSlideCount}
          quickSlideBroadcastIndex={quickSlideBroadcastIndex}
          isAutoGenerating={isAutoGenerating}
          textareaRef={quickSlideTextareaRef}
          onClose={(text) => {
            setQuickSlideText(text);
            setShowQuickSlideModal(false);
          }}
          onUpdateCount={updateQuickSlideCount}
          onAutoGenerate={autoGenerateQuickSlide}
          onBroadcastSlide={parseAndBroadcastQuickSlide}
        />
        </React.Suspense>
      )}

      {/* New Theme Type Selection Modal */}
      {showNewThemeModal && (
        <React.Suspense fallback={null}>
        <NewThemeTypeModal onClose={() => setShowNewThemeModal(false)} />
        </React.Suspense>
      )}

      {/* Template Selection Modal */}
      {showTemplateModal && (
        <React.Suspense fallback={null}>
        <TemplateSelectionModal
          onClose={() => setShowTemplateModal(false)}
          onSelectQuickMode={(type) => {
            resetQuickModeWizard(false);
            setQuickModeType(type);
            setQuickModeStep(2);
            setShowQuickModeWizard(true);
          }}
        />
        </React.Suspense>
      )}

      {/* Quick Mode Wizard Modal */}
      {showQuickModeWizard && (
        <React.Suspense fallback={null}>
        <QuickModeWizard
          bibleBooks={bibleBooks}
          onClose={() => {
            setShowQuickModeWizard(false);
            setQuickModeType(null);
            setQuickModeStep(1);
          }}
          onPresentationCreated={() => loadPresentations()}
          initialType={quickModeType}
          initialStep={quickModeStep}
        />
        </React.Suspense>
      )}

      {/* Theme Editor Modal */}
      {showThemeEditor && editingTheme && (
        <React.Suspense fallback={null}>
        <ThemeEditorModal
          theme={editingTheme}
          onThemeChange={setEditingTheme}
          onSave={saveTheme}
          onClose={() => { setShowThemeEditor(false); setEditingTheme(null); }}
        />
        </React.Suspense>
      )}

      {/* Song Editor Modal */}
      {showSongEditor && editingSong && (
        <React.Suspense fallback={null}>
        <SongEditorModal
          song={editingSong}
          onClose={() => { setShowSongEditor(false); setEditingSong(null); }}
          onSave={async (songData) => {
            try {
              if (songData.id) {
                await window.electronAPI.updateSong(songData.id, {
                  title: songData.title,
                  author: songData.author || undefined,
                  originalLanguage: songData.originalLanguage,
                  tags: songData.tags,
                  slides: songData.slides
                });
                if (selectedSong?.id === songData.id) {
                  setSelectedSong({ ...selectedSong, ...songData, id: songData.id });
                }
                // Update any setlist items that contain this song
                setSetlist(prev => prev.map(item => {
                  if (item.type === 'song' && item.song?.id === songData.id) {
                    return { ...item, song: { ...item.song, ...songData, id: songData.id } };
                  }
                  return item;
                }));
              } else {
                await window.electronAPI.createSong({
                  title: songData.title,
                  author: songData.author || undefined,
                  originalLanguage: songData.originalLanguage,
                  tags: songData.tags,
                  slides: songData.slides
                });
              }
              await loadSongs();
              setShowSongEditor(false);
              setEditingSong(null);
            } catch (error) {
              console.error('Failed to save song:', error);
            }
          }}
        />
        </React.Suspense>
      )}

      {/* Single Slide Editor Modal */}
      {showSlideEditor && selectedSong && editingSlideIndex !== null && (
        <React.Suspense fallback={null}>
        <SlideEditorModal
          slide={isAddingNewSlide ? { originalText: '', transliteration: '', translation: '', verseType: 'Verse' } : selectedSong.slides[editingSlideIndex]}
          slideIndex={editingSlideIndex}
          originalLanguage={selectedSong.originalLanguage || 'he'}
          isNewSlide={isAddingNewSlide}
          onClose={() => {
            setShowSlideEditor(false);
            setEditingSlideIndex(null);
            setIsAddingNewSlide(false);
          }}
          onSave={handleSaveSlide}
          onDelete={handleDeleteSlide}
        />
        </React.Suspense>
      )}

      {/* Prayer/Sermon Editor Modal */}
      {showPrayerEditor && editingPrayerPresentation && (
        <React.Suspense fallback={null}>
        <PrayerEditorModal
          presentation={editingPrayerPresentation}
          bibleBooks={bibleBooks}
          onClose={closePrayerEditor}
          onSave={async (presentationId, subtitles, title, titleTranslation) => {
            try {
              const updatedQuickModeData = {
                ...editingPrayerPresentation.quickModeData!,
                title: title || editingPrayerPresentation.quickModeData!.title,
                titleTranslation: titleTranslation,
                subtitles
              };

              // Update the presentation title if it changed
              const typeLabel = updatedQuickModeData.type === 'sermon' ? 'Sermon' : updatedQuickModeData.type === 'prayer' ? 'Prayer' : 'Announcements';
              const newPresentationTitle = `${typeLabel}: ${updatedQuickModeData.title}`;

              await window.electronAPI.updatePresentation(presentationId, {
                title: newPresentationTitle,
                quickModeData: updatedQuickModeData
              });
              const presentationList = await window.electronAPI.getPresentations();
              setPresentations(presentationList || []);
              if (selectedPresentation?.id === presentationId) {
                const updated = presentationList?.find((p: Presentation) => p.id === presentationId);
                if (updated) setSelectedPresentation(updated);
              }
              closePrayerEditor();
            } catch (error) {
              console.error('Failed to save prayer presentation:', error);
              alert('Failed to save changes. Please try again.');
            }
          }}
        />
        </React.Suspense>
      )}

      {/* Unsaved Changes Warning Modal */}
      {showUnsavedWarning && pendingAction && (
        <React.Suspense fallback={null}>
        <UnsavedChangesModal
          actionType={pendingAction.type}
          onCancel={cancelUnsavedAction}
          onSaveFirst={() => setShowSaveModal(true)}
          onDiscard={confirmUnsavedAction}
        />
        </React.Suspense>
      )}

      {/* Keyboard Shortcuts Help Modal */}
      {showKeyboardHelp && (
        <React.Suspense fallback={null}>
        <KeyboardHelpModal onClose={() => setShowKeyboardHelp(false)} />
        </React.Suspense>
      )}

      {/* Virtual Display Modal */}
      {showVirtualDisplayModal && (
        <React.Suspense fallback={null}>
        <VirtualDisplayModal
          isOpen={showVirtualDisplayModal}
          onClose={() => { setShowVirtualDisplayModal(false); setVirtualDisplayError(null); }}
          onAdd={handleAddVirtualDisplay}
          isLoading={virtualDisplayLoading}
          error={virtualDisplayError}
          userPrefix={authState.user?.email?.split('@')[0]?.toLowerCase().replace(/[^\w-]/g, '') || 'user'}
        />
        </React.Suspense>
      )}

      {/* Auth Modal */}
      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onLoginSuccess={async () => {
            const state = await window.electronAPI.getAuthState();
            setAuthState({
              isAuthenticated: state.isAuthenticated,
              user: state.user,
              serverUrl: state.serverUrl
            });
            // Connect to online mode
            const connectResult = await window.electronAPI.connectWithAuth();
            if (connectResult.success) {
              const room = await window.electronAPI.createOnlineRoom();
              if (room) {
                setRoomPin(room.roomPin);
              }
              // Re-link any saved virtual displays
              relinkVirtualDisplays();
            }
          }}
        />
      )}

      {/* About Modal */}
      {showAboutModal && (
        <AboutModal onClose={() => setShowAboutModal(false)} />
      )}

      {/* Update Modal */}
      {showUpdateModal && (
        <React.Suspense fallback={null}>
          <UpdateModal
            onClose={() => setShowUpdateModal(false)}
            updateStatus={updateStatus}
          />
        </React.Suspense>
      )}

      {/* Hidden audio element for background music */}
      {activeAudio && (
        <audio
          ref={audioRef}
          src={activeAudio.url}
          onCanPlay={() => {
            // Start playing with fade in when audio is ready
            if (audioNeedsInitialPlay.current) {
              audioNeedsInitialPlay.current = false;
              audioEndFadingRef.current = false; // Reset end fade flag
              if (audioRef.current) {
                audioRef.current.volume = 0;
              }
              fadeInAudio();
            }
          }}
          onTimeUpdate={(e) => {
            const audio = e.currentTarget;
            const duration = audio.duration || 0;
            const currentTime = audio.currentTime;

            // Throttle state updates to reduce re-renders (but always check for end fade)
            const now = Date.now();
            if (now - lastAudioTimeUpdateRef.current >= TIME_UPDATE_THROTTLE_MS) {
              lastAudioTimeUpdateRef.current = now;
              setAudioStatus(prev => ({
                ...prev,
                currentTime,
                duration
              }));
            }

            // Fade out when approaching end (last 0.5 seconds) - only trigger once
            if (duration > 0 && currentTime >= duration - 0.5 && !audioEndFadingRef.current) {
              audioEndFadingRef.current = true;
              fadeOutAudio(() => {
                if (audioRef.current) {
                  audioRef.current.pause();
                  audioRef.current.currentTime = 0;
                }

                // Check if there's a playlist playing - play next track
                if (activePlaylistId) {
                  const playedNext = playNextPlaylistTrack();
                  if (playedNext) {
                    audioEndFadingRef.current = false;
                    return; // Continue playlist playback
                  }
                  // Playlist finished, clear playlist state
                  setActivePlaylistId(null);
                  setActivePlaylistIndex(0);
                  setActivePlaylistOrder([]);
                }

                // Check if there's a next audio item in the setlist to auto-play
                if (activeAudioSetlistId) {
                  const currentIndex = setlist.findIndex(item => item.id === activeAudioSetlistId);
                  if (currentIndex !== -1 && currentIndex < setlist.length - 1) {
                    const nextItem = setlist[currentIndex + 1];
                    // Auto-play if next item is also an audio file
                    if (nextItem.type === 'media' && nextItem.mediaType === 'audio' && nextItem.mediaPath) {
                      // Play next audio
                      handlePlayAudio(nextItem.mediaPath, nextItem.mediaName || nextItem.title || 'Audio');
                      setActiveAudioSetlistId(nextItem.id);
                      audioEndFadingRef.current = false;
                      return; // Don't clear audio state, we're continuing playback
                    }
                  }
                }

                // No next audio item, stop playback
                setActiveAudio(null);
                setActiveAudioSetlistId(null);
                setAudioStatus({ currentTime: 0, duration: 0, isPlaying: false });
                audioEndFadingRef.current = false;
              });
            }
          }}
          onPlay={() => setAudioStatus(prev => ({ ...prev, isPlaying: true }))}
          onPause={() => setAudioStatus(prev => ({ ...prev, isPlaying: false }))}
          style={{ display: 'none' }}
        />
      )}

      {/* Audio player bar - memoized component */}
      {activeAudio && (
        <AudioPlayerBar
          name={activeAudio.name}
          isPlaying={audioStatus.isPlaying}
          currentTime={audioStatus.currentTime}
          duration={audioStatus.duration}
          volume={audioTargetVolume}
          onPlayPause={handleAudioPlayPause}
          onSeek={handleAudioSeek}
          onVolumeChange={handleAudioVolumeChange}
          onStop={handleClearAudio}
        />
      )}

      {/* Edit Playlist Modal */}
      {editingPlaylistItemId && (
        <React.Suspense fallback={null}>
        <EditPlaylistModal
          initialTracks={editingPlaylistTracks}
          initialName={editingPlaylistName}
          initialShuffle={editingPlaylistShuffle}
          onClose={closeEditPlaylistModal}
          onSave={(tracks, name, shuffle) => {
            setSetlist(prev => prev.map(item => {
              if (item.id === editingPlaylistItemId && item.audioPlaylist) {
                return {
                  ...item,
                  audioPlaylist: {
                    ...item.audioPlaylist,
                    tracks,
                    name: name || item.audioPlaylist.name,
                    shuffle
                  }
                };
              }
              return item;
            }));
            closeEditPlaylistModal();
          }}
          onSaveAsNew={async (tracks, name, shuffle) => {
            const playlistName = name.trim() || `Playlist (${tracks.length} tracks)`;
            try {
              await window.electronAPI.createAudioPlaylist({
                name: playlistName,
                tracks,
                shuffle
              });
              log.info('Playlist saved to database');
            } catch (error) {
              log.error('Failed to save playlist to database:', error);
            }
          }}
        />
        </React.Suspense>
      )}

      {/* Setlist Item Context Menu */}
      {setlistContextMenu && (
        <React.Suspense fallback={null}>
        <SetlistContextMenu
          contextMenu={setlistContextMenu}
          onClose={() => setSetlistContextMenu(null)}
          onEditSong={startEditingSong}
          onEditPrayerPresentation={startEditingPrayerPresentation}
          onNavigateToPresentation={(id) => navigate(`/presentation-editor?id=${id}`)}
          onEditPlaylist={openEditPlaylistModal}
          onRenameSection={(itemId, newName) => {
            setSetlist(prev => prev.map(item =>
              item.id === itemId ? { ...item, title: newName } : item
            ));
          }}
          onRemoveFromSetlist={removeFromSetlist}
          onSetBackground={(item) => setContextMenuBackgroundItemId(item.id)}
        />
        </React.Suspense>
      )}

      {/* Context menu background modal */}
      {contextMenuBackgroundItemId && (() => {
        const modalItem = setlist.find(i => i.id === contextMenuBackgroundItemId);
        if (!modalItem) return null;
        return (
          <React.Suspense fallback={null}>
            <ItemBackgroundModal
              isOpen={true}
              currentBackground={modalItem.background || ''}
              onSelect={(bg) => {
                handleSetItemBackground(contextMenuBackgroundItemId, bg);
                setContextMenuBackgroundItemId(null);
              }}
              onClose={() => setContextMenuBackgroundItemId(null)}
            />
          </React.Suspense>
        );
      })()}

      {/* Setlist background modal */}
      {showSetlistBackgroundModal && (
        <React.Suspense fallback={null}>
          <ItemBackgroundModal
            isOpen={true}
            currentBackground={setlistBackground}
            onSelect={(bg) => {
              handleSetSetlistBackground(bg);
              setShowSetlistBackgroundModal(false);
            }}
            onClose={() => setShowSetlistBackgroundModal(false)}
          />
        </React.Suspense>
      )}

      {/* Custom Display Config Modal */}
      {showCustomDisplayModal && (
        <React.Suspense fallback={null}>
          <CustomDisplayModal
            currentConfig={settings.customDisplayLines}
            availableTranslationLangs={(() => {
              const langs = new Set<string>();
              // Scan loaded songs for available translation languages
              for (const song of songs) {
                if (song.slides) {
                  for (const slide of song.slides) {
                    if (slide.translations && typeof slide.translations === 'object') {
                      Object.keys(slide.translations).forEach(l => langs.add(l));
                    }
                  }
                }
                // Stop once we've found enough distinct languages (unlikely to find more)
                if (langs.size >= 6) break;
              }
              return Array.from(langs);
            })()}
            onSave={(config) => updateSetting('customDisplayLines', config)}
            onClose={() => setShowCustomDisplayModal(false)}
          />
        </React.Suspense>
      )}

      {/* Settings overlay - rendered on top to keep ControlPanel mounted (preserves audio playback) */}
      {showSettings && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50000 }}>
          <React.Suspense fallback={null}>
            <SettingsPage onBack={handleCloseSettings} />
          </React.Suspense>
        </div>
      )}
    </div>
  );
};

export default ControlPanel;
