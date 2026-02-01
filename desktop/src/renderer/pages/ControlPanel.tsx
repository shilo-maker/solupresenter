import React, { useState, useEffect, useCallback, useRef, useMemo, memo, startTransition } from 'react';
import { createLogger } from '../utils/debug';

// Create logger for this module
const log = createLogger('ControlPanel');

import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../contexts/SettingsContext';
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
import { useRemoteControl } from '../hooks/useRemoteControl';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
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
const QuickModeWizard = React.lazy(() => import('../components/control-panel/quick-mode/QuickModeWizard'));
import { SongItem, PresentationItem, ThemeItem } from '../components/control-panel/list-items';
import SlideCodeIndicator from '../components/control-panel/SlideCodeIndicator';
import { useSlideKeyboardNav } from '../hooks/useSlideKeyboardNav';
import { SlideCodeMap } from '../utils/slideCodeUtils';
import { useArrangementState } from '../hooks/useArrangementState';
import { SongArrangement } from '../utils/arrangementUtils';
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
  assignedType?: 'viewer' | 'stage';
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
}

interface SavedSetlist {
  id: string;
  name: string;
  venue?: string;
  items: SetlistItem[];
  createdAt: string;  // ISO timestamp string
  updatedAt?: string;
}

type DisplayMode = 'bilingual' | 'original' | 'translation';
type ResourcePanel = 'songs' | 'media' | 'tools' | 'bible' | 'presentations';

interface QuickModeMetadata {
  type: 'sermon' | 'prayer' | 'announcements';
  title: string;
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
  const { t, i18n } = useTranslation();
  const { settings } = useSettings();
  const isRTL = i18n.language === 'he';

  // Setlist context (persists across navigation)
  const {
    setlist,
    setSetlist,
    currentSetlistId,
    setCurrentSetlistId,
    currentSetlistName,
    setCurrentSetlistName,
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
  const { slideData: liveSlideData, contentType: liveContentType, songId: liveSongId, slideIndex: liveSlideIndex } = liveState;
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
  const [obsServerRunning, setObsServerRunning] = useState(false);
  const [obsServerUrl, setObsServerUrl] = useState<string | null>(null);

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

  // Slide code navigation state
  const [slideCodeMap, setSlideCodeMap] = useState<SlideCodeMap | null>(null);

  // Theme state (extracted to hook)
  const {
    themes,
    stageMonitorThemes,
    bibleThemes,
    prayerThemes,
    obsThemes,
    selectedTheme,
    selectedStageTheme,
    selectedBibleTheme,
    selectedPrayerTheme,
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
    slides: Array<{ originalText: string; transliteration: string; translation: string; translationOverflow: string; verseType: string }>;
  } | null>(null);

  // Prayer/Sermon express editor state
  const [showPrayerEditor, setShowPrayerEditor] = useState(false);
  const [editingPrayerPresentation, setEditingPrayerPresentation] = useState<Presentation | null>(null);

  // Single slide editor state
  const [showSlideEditor, setShowSlideEditor] = useState(false);
  const [editingSlideIndex, setEditingSlideIndex] = useState<number | null>(null);
  const [isAddingNewSlide, setIsAddingNewSlide] = useState(false);

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
  const quickSlideTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Fullscreen media state (takes over from slides when active)
  const [activeMedia, setActiveMedia] = useState<{ type: 'image' | 'video'; url: string } | null>(null);
  const [hoveredMediaStopId, setHoveredMediaStopId] = useState<string | null>(null);
  const [selectedSetlistMediaId, setSelectedSetlistMediaId] = useState<string | null>(null);
  const [hoveredSetlistItemId, setHoveredSetlistItemId] = useState<string | null>(null);
  const [setlistMenuOpen, setSetlistMenuOpen] = useState<string | null>(null);
  const [setlistContextMenu, setSetlistContextMenu] = useState<{ x: number; y: number; item: SetlistItem } | null>(null);
  const [selectedYoutubeItemId, setSelectedYoutubeItemId] = useState<string | null>(null);
  const [visibleSongsCount, setVisibleSongsCount] = useState(50); // Limit initial render for performance

  // Video playback control state
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
    });

    const viewerCleanup = window.electronAPI.onViewerCountChanged((count) => {
      setViewerCount(count);
    });

    return () => {
      cleanup();
      onlineCleanup();
      viewerCleanup();
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

  // Video status listener
  useEffect(() => {
    const statusCleanup = window.electronAPI.onVideoStatus((status) => {
      setVideoStatus(prev => ({
        ...prev,
        currentTime: status.currentTime,
        duration: status.duration
      }));
    });

    const playingCleanup = window.electronAPI.onVideoPlaying((playing) => {
      setVideoStatus(prev => ({ ...prev, isPlaying: playing }));
    });

    const endedCleanup = window.electronAPI.onVideoEnded(() => {
      setVideoStatus(prev => ({ ...prev, isPlaying: false, currentTime: 0 }));
    });

    // Listen for synchronized video start (when display is ready)
    const syncStartCleanup = window.electronAPI.onVideoSyncStart(() => {
      console.log('[ControlPanel] Video sync start received');
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
            presentationSlide: slide
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
    // Check OBS server state
    const isRunning = await window.electronAPI.isOBSServerRunning();
    setObsServerRunning(isRunning);
    if (isRunning) {
      const url = await window.electronAPI.getOBSServerUrl();
      setObsServerUrl(url);
    }
  };

  const loadSongs = useCallback(async () => {
    try {
      const songList = await window.electronAPI.getSongs();
      setSongs(songList || []);
    } catch (error) {
      console.error('Failed to load songs:', error);
      setSongs([]);
    }
  }, []);

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
          verseType: s.verseType || 'Verse'
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
          verseType: 'Verse'
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

  // Single slide editor functions
  const handleEditSlide = useCallback((slideIndex: number) => {
    if (!selectedSong) return;
    setEditingSlideIndex(slideIndex);
    setIsAddingNewSlide(false);
    setShowSlideEditor(true);
  }, [selectedSong]);

  const handleAddSlide = useCallback(() => {
    if (!selectedSong) return;
    setEditingSlideIndex(selectedSong.slides.length); // Index for new slide
    setIsAddingNewSlide(true);
    setShowSlideEditor(true);
  }, [selectedSong]);

  const handleSaveSlide = useCallback(async (slideIndex: number, updatedSlide: { originalText?: string; transliteration?: string; translation?: string; translationOverflow?: string; verseType?: string }) => {
    if (!selectedSong) return;

    // Create new slides array
    const newSlides = [...selectedSong.slides];

    if (isAddingNewSlide) {
      // Adding a new slide at the end
      newSlides.push(updatedSlide);
    } else {
      // Editing an existing slide
      newSlides[slideIndex] = { ...newSlides[slideIndex], ...updatedSlide };
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
        window.electronAPI.sendSlide({
          songId: selectedSong.id,
          slideIndex: slideIndex,
          displayMode: displayMode,
          isBlank: false,
          songTitle: selectedSong.title,
          contentType: 'song',
          backgroundImage: selectedBackground || undefined,
          slideData: {
            originalText: slide.originalText,
            transliteration: slide.transliteration,
            translation: slide.translation,
            translationOverflow: slide.translationOverflow,
            verseType: slide.verseType,
            originalLanguage: selectedSong.originalLanguage || 'he'
          }
        });
      }

      // Close modal
      setShowSlideEditor(false);
      setEditingSlideIndex(null);
      setIsAddingNewSlide(false);
    } catch (error) {
      console.error('Failed to save slide:', error);
    }
  }, [selectedSong, liveSongId, liveSlideIndex, displayMode, setSetlist, isAddingNewSlide, loadSongs, selectedBackground]);

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

  const sendCurrentSlide = useCallback((song: Song | null, slideIndex: number, mode: DisplayMode, combinedIndices?: number[], contentType: 'song' | 'bible' | 'prayer' | 'presentation' = 'song') => {
    if (!song || !song.slides[slideIndex]) {
      window.electronAPI.sendBlank();
      return;
    }

    const slide = song.slides[slideIndex];
    const nextSlide = song.slides[slideIndex + 1] || null;

    // If in original mode with combined slides, include both slides' data
    // Check length AFTER filtering to ensure we actually have multiple valid slides
    const combinedSlidesRaw = mode === 'original' && combinedIndices && combinedIndices.length > 1
      ? combinedIndices.map(i => song.slides[i]).filter(Boolean)
      : null;
    const combinedSlides = combinedSlidesRaw && combinedSlidesRaw.length > 1 ? combinedSlidesRaw : null;

    window.electronAPI.sendSlide({
      songId: song.id,
      slideIndex,
      displayMode: mode,
      isBlank: false,
      songTitle: song.title,
      contentType, // 'song', 'bible', or 'prayer' - determines which theme to apply
      backgroundImage: selectedBackground || undefined, // Include current background (omit if empty to preserve viewer state)
      slideData: (() => {
        const refHebrew = contentType === 'bible' ? (slide as any).hebrewReference : (slide as any).reference;
        const refEnglish = contentType === 'bible' ? (slide as any).reference : undefined;
        return {
          originalText: slide.originalText,
          transliteration: slide.transliteration,
          translation: slide.translation,
          translationOverflow: slide.translationOverflow,
          verseType: slide.verseType,
          originalLanguage: song.originalLanguage || 'he', // Pass language for single-language song handling
          // Prayer/Sermon theme fields (mapped from slide structure when available)
          title: (slide as any).title,
          titleTranslation: (slide as any).titleTranslation,
          subtitle: (slide as any).subtitle || slide.originalText,
          subtitleTranslation: (slide as any).subtitleTranslation || slide.translation,
          description: (slide as any).description,
          descriptionTranslation: (slide as any).descriptionTranslation,
          // Reference fields - for Bible content: hebrewReference goes to 'reference', English to 'referenceEnglish'
          reference: refHebrew,
          referenceTranslation: (slide as any).referenceTranslation,
          referenceEnglish: refEnglish
        };
      })(),
      nextSlideData: nextSlide ? {
        originalText: nextSlide.originalText,
        transliteration: nextSlide.transliteration,
        translation: nextSlide.translation,
        translationOverflow: nextSlide.translationOverflow,
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
      } : null,
      combinedSlides: combinedSlides?.map(s => ({
        originalText: s.originalText,
        transliteration: s.transliteration,
        translation: s.translation,
        translationOverflow: s.translationOverflow,
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
      })) || null
    });
  }, [selectedBackground, selectedBibleTheme, selectedPrayerTheme]);

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
      titleTranslation: (qmd as any).titleTranslation,
      subtitle: subtitle.subtitle,
      subtitleTranslation: subtitle.subtitleTranslation,
      description: subtitle.description,
      descriptionTranslation: subtitle.descriptionTranslation,
      reference: hebrewRef || englishRef,
      referenceTranslation: englishRef
    };

    // Update live preview state FIRST for immediate UI response (atomic update)
    setLiveState({ slideData, contentType: 'prayer', songId: presentation.id, slideIndex });

    // Send to display (fire and forget)
    window.electronAPI.sendSlide({
      songId: presentation.id,
      slideIndex,
      displayMode: mode,
      isBlank: false,
      songTitle: presentation.title,
      contentType: 'prayer',
      backgroundImage: selectedBackground || undefined,
      activeTheme: selectedPrayerTheme,
      slideData
    });
  }, [selectedBackground, selectedPrayerTheme]);

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

    // Pause both first for sync
    const video = previewVideoRef.current;
    const wasPlaying = videoStatus.isPlaying;

    // Pause preview
    if (video) {
      video.pause();
    }
    // Pause display
    window.electronAPI.pauseVideo();
    setVideoStatus(prev => ({ ...prev, isPlaying: false }));

    // Small delay to ensure pause takes effect
    setTimeout(() => {
      // Seek preview
      if (video) {
        video.currentTime = time;
      }
      // Seek display
      window.electronAPI.seekVideo(time);

      // Resume after another small delay if was playing
      if (wasPlaying) {
        setTimeout(() => {
          if (video) {
            video.play().catch(() => {});
          }
          window.electronAPI.resumeVideo();
          setVideoStatus(prev => ({ ...prev, isPlaying: true }));
        }, 150);
      }
    }, 50);
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

  const openDisplay = async (displayId: number, type: 'viewer' | 'stage') => {
    await window.electronAPI.openDisplayWindow(displayId, type);
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

  // Memoized nextSlide - uses selectedSongRef to avoid dependency on selectedSong
  const nextSlide = useCallback(() => {
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
  }, [displayMode, combinedSlidesData, selectedCombinedIndex, selectCombinedSlide, currentSlideIndex, goToSlide, arrangementState]);

  // Memoized prevSlide - uses selectedSongRef to avoid dependency on selectedSong
  const prevSlide = useCallback(() => {
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
  }, [displayMode, combinedSlidesData, selectedCombinedIndex, selectCombinedSlide, currentSlideIndex, goToSlide, arrangementState]);

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
      } else if (song) {
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

  // Keyboard shortcuts hook
  useKeyboardShortcuts(
    {
      nextSlide,
      prevSlide,
      toggleBlank,
      setShowKeyboardHelp,
      setShowQuickSlideModal,
      setDisplayMode,
      setIsBlank,
      setLiveState
    },
    { displayMode, isRTL, disabled: showSettings }
  );

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
      songs
    },
    {
      nextSlide,
      prevSlide,
      goToSlide,
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
      setYoutubeDuration
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
    setSetlist(prev => [...prev, { id: crypto.randomUUID(), type: 'presentation', presentation }]);
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

      const url = type === 'viewer'
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
          items: setlist
        });
      } else {
        // Create new setlist
        savedSetlist = await window.electronAPI.createSetlist({
          name,
          venue: venue || undefined,
          items: setlist
        });
      }

      if (savedSetlist) {
        setCurrentSetlistId(savedSetlist.id);
        setCurrentSetlistName(name);
        // Reload all setlists to get updated list
        await loadSavedSetlists();
      }

      updateSavedSnapshot(setlist);
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
    setShowUnsavedWarning(false);
    setPendingAction(null);
  }, [clearSetlistFromContext]);

  const loadSetlistDirect = useCallback((saved: SavedSetlist) => {
    setSetlist(saved.items);
    setCurrentSetlistName(saved.name);
    setCurrentSetlistId(saved.id);
    updateSavedSnapshot(saved.items);
    setShowLoadModal(false);
    setShowUnsavedWarning(false);
    setPendingAction(null);
  }, [updateSavedSnapshot]);

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
    enabled: !!selectedSong && !showQuickSlideModal && !showSongEditor && !showPrayerEditor && !showSlideEditor
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
  const handleCreateTheme = useCallback((themeType: 'songs' | 'bible' | 'prayer' | 'stage' | 'obs-songs' | 'obs-bible' | 'obs-prayer') => {
    setShowThemePanel(false);
    const routes: Record<string, string> = {
      'songs': '/theme-editor?new=true',
      'bible': '/bible-theme-editor?new=true',
      'prayer': '/prayer-theme-editor?new=true',
      'stage': '/stage-monitor-editor?new=true',
      'obs-songs': '/obs-songs-theme-editor?new=true',
      'obs-bible': '/obs-bible-theme-editor?new=true',
      'obs-prayer': '/obs-prayer-theme-editor?new=true',
    };
    if (routes[themeType]) navigate(routes[themeType]);
  }, [navigate]);

  const handleEditTheme = useCallback((themeType: 'songs' | 'bible' | 'prayer' | 'stage' | 'obs-songs' | 'obs-bible' | 'obs-prayer', themeId: string) => {
    setShowThemePanel(false);
    const routes: Record<string, string> = {
      'songs': `/theme-editor?id=${themeId}`,
      'bible': `/bible-theme-editor?id=${themeId}`,
      'prayer': `/prayer-theme-editor?id=${themeId}`,
      'stage': `/stage-monitor-editor?id=${themeId}`,
      'obs-songs': `/obs-songs-theme-editor?id=${themeId}`,
      'obs-bible': `/obs-bible-theme-editor?id=${themeId}`,
      'obs-prayer': `/obs-prayer-theme-editor?id=${themeId}`,
    };
    if (routes[themeType]) navigate(routes[themeType]);
  }, [navigate]);

  const handleShowAuthModal = useCallback(() => setShowAuthModal(true), []);
  const handleNavigateToSettings = useCallback(() => setShowSettings(true), []);
  const handleCloseSettings = useCallback(() => setShowSettings(false), []);
  const handleControlDisplayChange = useCallback(async (displayId: number) => {
    const success = await window.electronAPI.moveControlWindow(displayId);
    if (success) setControlDisplayId(displayId);
  }, []);
  const handleIdentifyDisplay = useCallback((displayId: number) => window.electronAPI.identifyDisplays(displayId), []);
  const handleToggleOBSServer = useCallback(async () => {
    try {
      if (obsServerRunning) {
        await window.electronAPI.stopOBSServer();
        setObsServerRunning(false);
        setObsServerUrl(null);
      } else {
        const result = await window.electronAPI.startOBSServer();
        if (result.success) {
          setObsServerRunning(true);
          setObsServerUrl(result.url ?? null);
        }
      }
    } catch (err) {
      console.error('[OBS Server] Error:', err);
    }
  }, [obsServerRunning]);

  // SongsPanel callback
  const handleSelectSongForPanel = useCallback((s: any) => selectSong(s, 'song', false), [selectSong]);

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
    setActiveYoutubeVideo({ videoId, title, thumbnail: thumbnail || '' });
    setYoutubeOnDisplay(true);
    window.electronAPI.youtubeLoad(videoId, title);
  }, []);
  const handleStopYoutubeVideo = useCallback(() => {
    setYoutubeOnDisplay(false);
    setActiveYoutubeVideo(null);
    window.electronAPI.youtubeStop();
  }, []);

  // LivePreviewPanel callbacks
  const handleVideoTimeUpdate = useCallback((currentTime: number, duration: number) => {
    setVideoStatus(prev => ({ ...prev, currentTime, duration }));
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

  // BottomRowPanel callbacks
  const handleQuickModeClick = useCallback(() => {
    const isQuickModeActive = selectedSong?.id === 'quick-slide';
    if (isQuickModeActive) {
      setShowQuickSlideModal(true);
      setQuickSlideBroadcastIndex(-1);
      updateQuickSlideCount(quickSlideText);
    } else if (quickSlideText.trim()) {
      parseAndBroadcastQuickSlide(0);
    } else {
      setShowQuickSlideModal(true);
      setQuickSlideBroadcastIndex(-1);
    }
  }, [selectedSong?.id, quickSlideText, updateQuickSlideCount, parseAndBroadcastQuickSlide]);

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
          presentationSlide: firstSlide
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

  // Compute prayer slide data for live preview
  const currentPrayerSlideData = useMemo(() => {
    if (!selectedPresentation?.quickModeData) return null;
    const qmd = selectedPresentation.quickModeData;
    if (qmd.type !== 'prayer' && qmd.type !== 'sermon') return null;
    const subtitle = qmd.subtitles?.[currentPresentationSlideIndex];
    if (!subtitle) return null;
    return {
      title: qmd.title,
      titleTranslation: (qmd as any).titleTranslation,
      subtitle: subtitle.subtitle,
      subtitleTranslation: subtitle.subtitleTranslation,
      description: subtitle.description,
      descriptionTranslation: subtitle.descriptionTranslation,
      reference: subtitle.bibleRef?.hebrewReference || subtitle.bibleRef?.reference,
      referenceTranslation: subtitle.bibleRef?.reference
    };
  }, [selectedPresentation, currentPresentationSlideIndex]);

  // Memoize slideData for SlidePreview to prevent unnecessary re-renders
  const memoizedSlideData = useMemo(() => {
    if (currentContentType === 'prayer') {
      return currentPrayerSlideData;
    }
    if (!currentSlide) return null;
    if (currentContentType === 'bible') {
      // For Bible content: reference = Hebrew reference, referenceEnglish = English reference
      return {
        ...currentSlide,
        reference: (currentSlide as any).hebrewReference || selectedSong?.title,
        referenceEnglish: (currentSlide as any).reference
      };
    }
    return currentSlide;
  }, [currentContentType, currentPrayerSlideData, currentSlide, selectedSong?.title]);

  // Memoize theme for SlidePreview based on content type (for staged/selected content)
  const memoizedPreviewTheme = useMemo(() => {
    if (currentContentType === 'bible') return selectedBibleTheme;
    if (currentContentType === 'prayer') return selectedPrayerTheme;
    return selectedTheme;
  }, [currentContentType, selectedBibleTheme, selectedPrayerTheme, selectedTheme]);

  // Memoize theme for live preview based on what's actually on air
  const memoizedLivePreviewTheme = useMemo(() => {
    if (liveContentType === 'bible') return selectedBibleTheme;
    if (liveContentType === 'prayer') return selectedPrayerTheme;
    return selectedTheme;
  }, [liveContentType, selectedBibleTheme, selectedPrayerTheme, selectedTheme]);

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

  return (
    <div className="control-panel" style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: colors.background.base }}>
      {/* Header */}
      <HeaderBar
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
        onShowThemePanelChange={setShowThemePanel}
        onApplyViewerTheme={applyViewerTheme}
        onApplyBibleTheme={applyBibleThemeCallback}
        onApplyPrayerTheme={applyPrayerThemeCallback}
        onApplyStageTheme={applyStageTheme}
        onCreateTheme={handleCreateTheme}
        onEditTheme={handleEditTheme}
        obsServerRunning={obsServerRunning}
        obsServerUrl={obsServerUrl}
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
        onToggleOBSServer={handleToggleOBSServer}
        onConnectOnline={connectOnline}
        onLogout={handleLogout}
        virtualDisplays={virtualDisplays}
        onAddVirtualDisplay={() => setShowVirtualDisplayModal(true)}
        onRemoveVirtualDisplay={handleRemoveVirtualDisplay}
        onCopyVirtualDisplayUrl={handleCopyVirtualDisplayUrl}
      />

      {/* Main Content - Two Row Layout with resizable panels */}
      <main ref={mainContentRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '12px', gap: '0' }}>
        {/* Top Row - Three Column Layout with resizable widths */}
        <div style={{ display: 'flex', height: `${topRowHeight}%`, overflow: 'hidden', minHeight: 0 }}>
          {/* Left Column - Resource Panel (Songs/Media/Tools) */}
          <div style={{ width: `${leftPanelWidth}%`, flexShrink: 0, display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', overflow: 'hidden' }}>
            {/* Resource Tabs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderBottom: activeResourcePanel === 'songs' ? 'none' : '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ display: 'flex', gap: '4px' }}>
                {resourceTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => handleResourcePanelChange(tab.id as ResourcePanel)}
                    style={{
                      background: activeResourcePanel === tab.id ? '#06b6d4' : 'rgba(255,255,255,0.1)',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      color: 'white',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (activeResourcePanel !== tab.id) {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.18)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (activeResourcePanel !== tab.id) {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                      }
                    }}
                    title={tab.label}
                  >
                    {tab.icon}
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

            {/* Resource Content — panels stay mounted, hidden via display:none for instant switching */}
            <div style={{ flex: 1, overflow: 'auto' }}>
              {/* Songs Panel */}
              <div style={{ display: activeResourcePanel === 'songs' ? 'contents' : 'none' }}>
                <React.Suspense fallback={null}>
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
                </React.Suspense>
              </div>

              {/* Media Panel */}
              <div style={{ display: activeResourcePanel === 'media' ? 'contents' : 'none' }}>
                <React.Suspense fallback={null}>
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
                  onPlayAudio={handlePlayAudio}
                  onAddMediaToSetlist={handleAddMediaToSetlist}
                  onAddPlaylistToSetlist={handleAddPlaylistToSetlist}
                  onAddYoutubeToSetlist={handleAddYoutubeToSetlist}
                  isYouTubeUrl={isYouTubeUrl}
                />
                </React.Suspense>
              </div>

              {/* Tools Panel */}
              <div style={{ display: activeResourcePanel === 'tools' ? 'contents' : 'none' }}>
                <React.Suspense fallback={null}>
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
              </div>

              {/* Bible Panel */}
              <div style={{ display: activeResourcePanel === 'bible' ? 'contents' : 'none' }}>
                <React.Suspense fallback={null}>
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
                </React.Suspense>
              </div>

              {/* Presentations Panel */}
              <div style={{ display: activeResourcePanel === 'presentations' ? 'contents' : 'none' }}>
                <React.Suspense fallback={null}>
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
                </React.Suspense>
              </div>
            </div>
          </div>

          {/* Resize Handle - Left/Setlist */}
          <ResizeHandle
            direction="vertical"
            isResizing={isResizing === 'left'}
            onMouseDown={(e) => startResize('left', e)}
          />

          {/* Middle Column - Setlist */}
          <div style={{ width: `${setlistPanelWidth}%`, flexShrink: 0, display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', overflow: 'hidden' }}>
            <React.Suspense fallback={null}>
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
              onHandlePlayAudio={handlePlayAudio}
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
            />
            </React.Suspense>
          </div>


          {/* Resize Handle - Setlist/Preview */}
          <ResizeHandle
            direction="vertical"
            isResizing={isResizing === 'setlist'}
            onMouseDown={(e) => startResize('setlist', e)}
          />

          {/* Right Column - Live Preview (remaining space) */}
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
            selectedBackground={selectedBackground}
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
            onVideoTimeUpdate={handleVideoTimeUpdate}
            onVideoPlay={handleVideoPlay}
            onVideoPause={handleVideoPause}
            onVideoSeeked={handleVideoSeeked}
          />
        </div>{/* End of Top Row */}

        {/* Horizontal Resize Handle - Top/Bottom Rows */}
        <ResizeHandle
          direction="horizontal"
          isResizing={isResizing === 'row'}
          onMouseDown={(e) => startResize('row', e)}
        />

        {/* Bottom Row - Slides Grid */}
        <BottomRowPanel
          selectedSong={selectedSong}
          selectedPresentation={selectedPresentation}
          displayMode={displayMode}
          currentSlideIndex={currentSlideIndex}
          liveSongId={liveSongId}
          liveSlideIndex={liveSlideIndex}
          isBlank={isBlank}
          isRTL={isRTL}
          autoPlayActive={autoPlayActive}
          autoPlayInterval={autoPlayInterval}
          currentPresentationSlideIndex={currentPresentationSlideIndex}
          showBackgroundDropdown={showBackgroundDropdown}
          selectedBackground={selectedBackground}
          combinedSlidesData={combinedSlidesData}
          selectedCombinedIndex={selectedCombinedIndex}
          quickSlideText={quickSlideText}
          getVerseTypeColor={getVerseTypeColor}
          selectSlide={selectSlide}
          toggleBlank={toggleBlank}
          goToSlide={goToSlide}
          selectCombinedSlide={selectCombinedSlide}
          sendPrayerPresentationSlide={sendPrayerPresentationSlide}
          updateQuickSlideCount={updateQuickSlideCount}
          handleSetBackground={handleSetBackground}
          isQuickModeActive={selectedSong?.id === 'quick-slide'}
          onQuickModeClick={handleQuickModeClick}
          onSetDisplayMode={setDisplayMode}
          onSetIsBlank={setIsBlank}
          onSetLiveState={setLiveState}
          onSetShowBackgroundDropdown={setShowBackgroundDropdown}
          onSetSelectedBackground={setSelectedBackground}
          onSetAutoPlayActive={handleSetAutoPlayActive}
          onSetAutoPlayInterval={setAutoPlayInterval}
          onSetCurrentPresentationSlideIndex={setCurrentPresentationSlideIndex}
          onSlideCodeMapChange={setSlideCodeMap}
          onEditSlide={handleEditSlide}
          onAddSlide={handleAddSlide}
          arrangementState={arrangementState}
        />
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

      {/* CSS for animations */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes quickModePulse {
          0%, 100% { box-shadow: 0 0 10px #6f42c1, 0 0 20px rgba(111, 66, 193, 0.5); }
          50% { box-shadow: 0 0 15px #6f42c1, 0 0 30px rgba(111, 66, 193, 0.7); }
        }
      `}</style>

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
