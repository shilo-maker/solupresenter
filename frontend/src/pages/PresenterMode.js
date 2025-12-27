import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Form, Button, InputGroup, Modal, Row, Col, Alert, Badge, Dropdown, Toast, ToastContainer } from 'react-bootstrap';
import { useNavigate, useLocation } from 'react-router-dom';
import { FixedSizeList } from 'react-window';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import api, { getFullImageUrl, publicRoomAPI, roomAPI, presentationAPI } from '../services/api';
import socketService from '../services/socket';
import { createCombinedSlides, getCombinedSlideLabel } from '../utils/slideCombining';
import ThemeSelector from '../components/ThemeSelector';
import { PresentationEditor } from '../components/presentation-editor';

function PresenterMode() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, isAdmin } = useAuth();
  const { t, i18n } = useTranslation();

  // Add pulse animation keyframes and custom scrollbar styles
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.15); }
        100% { transform: scale(1); }
      }

      /* Custom scrollbar for dark theme */
      .dark-scrollbar::-webkit-scrollbar,
      .dark-scrollbar *::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }
      .dark-scrollbar::-webkit-scrollbar-track,
      .dark-scrollbar *::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 4px;
      }
      .dark-scrollbar::-webkit-scrollbar-thumb,
      .dark-scrollbar *::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.3);
        border-radius: 4px;
      }
      .dark-scrollbar::-webkit-scrollbar-thumb:hover,
      .dark-scrollbar *::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.5);
      }
      /* Firefox scrollbar */
      .dark-scrollbar, .dark-scrollbar * {
        scrollbar-width: thin;
        scrollbar-color: rgba(255, 255, 255, 0.3) rgba(255, 255, 255, 0.1);
      }

      /* Hide scrollbar for scroll wheel picker */
      .hide-scrollbar::-webkit-scrollbar {
        display: none;
      }
      .hide-scrollbar {
        -ms-overflow-style: none;
        scrollbar-width: none;
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  // Error state
  const [error, setError] = useState('');

  // Room state
  const [room, setRoom] = useState(null);
  const [roomPin, setRoomPin] = useState('');
  const [roomCreated, setRoomCreated] = useState(false);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

  // Public room state
  const [publicRooms, setPublicRooms] = useState([]);
  const [selectedPublicRoom, setSelectedPublicRoom] = useState(null);
  const [linkedPublicRoomName, setLinkedPublicRoomName] = useState('');
  const [showRoomSelector, setShowRoomSelector] = useState(false);
  const [showGearMenu, setShowGearMenu] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', variant: 'success' });
  const roomSelectorRef = useRef(null);
  const gearMenuRef = useRef(null);

  // Close room selector and gear menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (roomSelectorRef.current && !roomSelectorRef.current.contains(event.target)) {
        setShowRoomSelector(false);
      }
      if (gearMenuRef.current && !gearMenuRef.current.contains(event.target)) {
        setShowGearMenu(false);
      }
    };

    if (showRoomSelector || showGearMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showRoomSelector, showGearMenu]);

  // Song search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const searchInputRef = useRef(null);
  const lastTapRef = useRef({ time: 0, songId: null }); // For double-tap detection on database
  const lastSetlistTapRef = useRef({ time: 0, index: null }); // For double-tap detection on setlist
  const lastMessageTapRef = useRef({ time: 0, msgId: null }); // For double-tap detection on messages
  const messageTapTimeoutRef = useRef(null); // Timeout for delayed single-tap action
  const [allSongs, setAllSongs] = useState([]);
  const [songsLoading, setSongsLoading] = useState(true);

  // Presentations state
  const [allPresentations, setAllPresentations] = useState([]);
  const [presentationSearchQuery, setPresentationSearchQuery] = useState('');
  const [presentationsLoading, setPresentationsLoading] = useState(true);
  const [showPresentationEditor, setShowPresentationEditor] = useState(false);
  const [editingPresentation, setEditingPresentation] = useState(null);
  const [selectedPresentation, setSelectedPresentation] = useState(null);
  const [selectedPresentationSlideIndex, setSelectedPresentationSlideIndex] = useState(0);

  // Image search state
  const [imageSearchResults, setImageSearchResults] = useState([]);
  const [mediaLoading, setMediaLoading] = useState(true);

  // Setlist state (contains items with type: 'song', 'blank', or 'image')
  const [setlist, setSetlist] = useState([]);
  const [currentItem, setCurrentItem] = useState(null); // Current setlist item (song or image)
  const [selectedFromSetlist, setSelectedFromSetlist] = useState(false); // Track if selection came from setlist
  const [selectedSetlistIndex, setSelectedSetlistIndex] = useState(null); // Track which setlist index is selected

  // Current song and slides
  const [currentSong, setCurrentSong] = useState(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [displayMode, setDisplayMode] = useState('bilingual');
  const [isBlankActive, setIsBlankActive] = useState(false);
  const [selectedCombinedIndex, setSelectedCombinedIndex] = useState(0); // Track selected combined slide in original mode

  // Background state
  const [media, setMedia] = useState([]);
  const [selectedBackground, setSelectedBackground] = useState('');
  const [showBackgroundModal, setShowBackgroundModal] = useState(false);

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createModalView, setCreateModalView] = useState('choice'); // 'choice', 'create-song', 'upload-image'

  // Song creation state
  const [newSongTitle, setNewSongTitle] = useState('');
  const [newSongLanguage, setNewSongLanguage] = useState('he');
  const [newSongExpressText, setNewSongExpressText] = useState('');
  const [createSongLoading, setCreateSongLoading] = useState(false);

  // Get default date (today) and time (next round hour)
  const getDefaultDateTime = () => {
    const now = new Date();

    // Format date as YYYY-MM-DD
    const dateStr = now.toISOString().split('T')[0];

    // Get next round hour
    const nextHour = now.getHours() + 1;
    const hours = String(nextHour).padStart(2, '0');
    const timeStr = `${hours}:00`;

    return { dateStr, timeStr };
  };

  // Save setlist state
  const [showSaveSetlistModal, setShowSaveSetlistModal] = useState(false);
  const [setlistName, setSetlistName] = useState('');
  const [setlistDate, setSetlistDate] = useState('');
  const [setlistTime, setSetlistTime] = useState('');
  const [setlistVenue, setSetlistVenue] = useState('');
  const [saveSetlistLoading, setSaveSetlistLoading] = useState(false);
  const [linkedSetlistName, setLinkedSetlistName] = useState('');

  // Load setlist state
  const [showLoadSetlistModal, setShowLoadSetlistModal] = useState(false);
  const [availableSetlists, setAvailableSetlists] = useState([]);
  const [loadSetlistLoading, setLoadSetlistLoading] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedChangesModal, setShowUnsavedChangesModal] = useState(false);
  const [pendingLoadAction, setPendingLoadAction] = useState(null);

  // Section header state
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [sectionTitleInput, setSectionTitleInput] = useState('');

  // Bible state
  const [bibleBooks, setBibleBooks] = useState([]);
  const [selectedBibleBook, setSelectedBibleBook] = useState('');
  const [selectedBibleChapter, setSelectedBibleChapter] = useState('');
  const [bibleVerses, setBibleVerses] = useState([]);
  const [bibleLoading, setBibleLoading] = useState(false);

  // Collapsible sections
  const [activeResourcePanel, setActiveResourcePanel] = useState('songs'); // 'songs', 'bible', 'tools', 'media', or 'presentations'
  const [setlistSectionOpen, setSetlistSectionOpen] = useState(true);
  const [slideSectionOpen, setSlideSectionOpen] = useState(true);
  const [mediaLocalExpanded, setMediaLocalExpanded] = useState(false);
  const [mediaCloudExpanded, setMediaCloudExpanded] = useState(false);
  const [mediaYouTubeExpanded, setMediaYouTubeExpanded] = useState(false);

  // YouTube state
  const [youtubeVideos, setYoutubeVideos] = useState([]);
  const [youtubeUrlInput, setYoutubeUrlInput] = useState('');
  const [youtubeLoading, setYoutubeLoading] = useState(false);
  const [youtubeOnDisplay, setYoutubeOnDisplay] = useState(false);
  const [youtubePlaying, setYoutubePlaying] = useState(false);
  const [youtubeCurrentTime, setYoutubeCurrentTime] = useState(0);
  const [youtubeDuration, setYoutubeDuration] = useState(0);
  const youtubePlayerRef = useRef(null);
  const youtubeSyncIntervalRef = useRef(null);
  const youtubeTimeIntervalRef = useRef(null);

  // Chromecast state
  const [castAvailable, setCastAvailable] = useState(false);
  const [castConnected, setCastConnected] = useState(false);
  const castSessionRef = useRef(null); // Store active cast session
  const reconnectAttempts = useRef(0); // Track reconnection attempts
  const maxReconnectAttempts = 5; // Maximum auto-reconnect attempts

  // Local Display state (Presentation API)
  const [presentationSupported, setPresentationSupported] = useState(false);
  const [presentationConnection, setPresentationConnection] = useState(null);
  const presentationRequestRef = useRef(null);
  const localViewerWindowRef = useRef(null); // Reference to fallback window for postMessage

  // Local Media state (for broadcasting local files without upload)
  const [selectedMediaFile, setSelectedMediaFile] = useState(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState(null);
  const [mediaType, setMediaType] = useState(null); // 'image' or 'video'
  const [videoOnDisplay, setVideoOnDisplay] = useState(false); // Is video currently showing on HDMI
  const [videoPlaying, setVideoPlaying] = useState(true); // Is the displayed video playing or paused
  const [imageOnDisplay, setImageOnDisplay] = useState(false); // Is image currently showing on HDMI
  const localVideoRef = useRef(null); // Reference to local video element for preview

  // Quick Slide state
  const [showQuickSlideModal, setShowQuickSlideModal] = useState(false);
  const [quickSlideText, setQuickSlideText] = useState(''); // Persisted value for restore
  const [broadcastSlideIndex, setBroadcastSlideIndex] = useState(-1); // Which slide is being broadcast (-1 = none)
  const quickSlideTextareaRef = useRef(null); // Ref to textarea for instant typing
  const createSongTextareaRef = useRef(null); // Ref to create song textarea for tag insertion
  const [slideCount, setSlideCount] = useState(0); // Track number of slides for button rendering

  // Tools state
  const [activeToolsTab, setActiveToolsTab] = useState('countdown'); // 'countdown', 'clock', 'stopwatch', 'announce', 'messages'
  // Countdown state
  const [countdownTargetTime, setCountdownTargetTime] = useState(() => {
    // Default to 15 minutes from now
    const now = new Date();
    now.setMinutes(now.getMinutes() + 15);
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  const [countdownMessage, setCountdownMessage] = useState('');
  const [countdownRunning, setCountdownRunning] = useState(false);
  const [countdownRemaining, setCountdownRemaining] = useState(0); // in seconds
  const [countdownBroadcasting, setCountdownBroadcasting] = useState(false);
  // Refs to track current countdown state (for use in timeouts/closures)
  const countdownStateRef = useRef({ running: false, broadcasting: false, remaining: 0, message: '' });
  const [activeSetlistCountdownIndex, setActiveSetlistCountdownIndex] = useState(null); // Track which setlist countdown is broadcasting
  const [focusedCountdownIndex, setFocusedCountdownIndex] = useState(null); // Track which countdown is focused (for selection highlight)
  const [activeSetlistAnnouncementIndex, setActiveSetlistAnnouncementIndex] = useState(null); // Track which setlist announcement is showing
  const [focusedAnnouncementIndex, setFocusedAnnouncementIndex] = useState(null); // Track which announcement is focused (for selection highlight)
  const [activeSetlistMessagesIndex, setActiveSetlistMessagesIndex] = useState(null); // Track which setlist messages is broadcasting
  const [focusedMessagesIndex, setFocusedMessagesIndex] = useState(null); // Track which messages is focused (for selection highlight)
  const countdownIntervalRef = useRef(null);
  const preCountdownStateRef = useRef(null); // Store state before countdown to restore after
  const preMessagesStateRef = useRef(null); // Store state before messages to restore after

  // Calculate remaining seconds from target time
  const getCountdownSeconds = () => {
    const [hours, minutes] = countdownTargetTime.split(':').map(Number);
    const now = new Date();
    const target = new Date();
    target.setHours(hours, minutes, 0, 0);

    // If target time is earlier than now, assume it's for tomorrow
    if (target <= now) {
      target.setDate(target.getDate() + 1);
    }

    return Math.max(0, Math.floor((target - now) / 1000));
  };
  // Clock state
  const [clockFormat, setClockFormat] = useState('24h');
  const [clockShowDate, setClockShowDate] = useState(false);
  const [clockBroadcasting, setClockBroadcasting] = useState(false);
  const clockIntervalRef = useRef(null);
  // Stopwatch state
  const [stopwatchTime, setStopwatchTime] = useState(0); // in seconds
  const [stopwatchRunning, setStopwatchRunning] = useState(false);
  const [stopwatchLabel, setStopwatchLabel] = useState('');
  const stopwatchIntervalRef = useRef(null);
  // Announcement state
  const [announcementText, setAnnouncementText] = useState('');
  const [announcementVisible, setAnnouncementVisible] = useState(false);
  const announcementTimerRef = useRef(null);
  // Rotating messages state
  const [rotatingMessages, setRotatingMessages] = useState([
    { id: 1, text: 'welcomeMsg', enabled: true, isPreset: true },
    { id: 2, text: 'serviceStartingSoon', enabled: true, isPreset: true },
    { id: 3, text: 'prayerTime', enabled: false, isPreset: true },
    { id: 4, text: 'worshipTime', enabled: false, isPreset: true },
    { id: 5, text: 'sermon', enabled: false, isPreset: true },
    { id: 6, text: 'offeringTimeMsg', enabled: false, isPreset: true },
    { id: 7, text: 'seeYouNextWeek', enabled: false, isPreset: true },
  ]);
  const [rotatingInterval, setRotatingInterval] = useState(5); // seconds
  const [rotatingRunning, setRotatingRunning] = useState(false);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [customMessageInput, setCustomMessageInput] = useState('');
  const rotatingIntervalRef = useRef(null);
  const broadcastRotatingMessageRef = useRef(null);

  // Format time in HH:MM:SS or MM:SS
  const formatTime = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Keep countdown state ref in sync (for use in timeouts/closures)
  useEffect(() => {
    countdownStateRef.current = {
      running: countdownRunning,
      broadcasting: countdownBroadcasting,
      remaining: countdownRemaining,
      message: countdownMessage
    };
  }, [countdownRunning, countdownBroadcasting, countdownRemaining, countdownMessage]);

  // Combined slides for original-only mode (pairs consecutive same-verseType slides)
  const combinedSlides = useMemo(() => {
    if (displayMode !== 'original' || !currentSong?.slides) return null;
    return createCombinedSlides(currentSong.slides);
  }, [displayMode, currentSong?.slides]);

  // Sync selectedCombinedIndex when mode changes or song changes
  useEffect(() => {
    if (combinedSlides && currentSlideIndex !== null) {
      const combinedIdx = combinedSlides.originalToCombined.get(currentSlideIndex);
      if (combinedIdx !== undefined) {
        setSelectedCombinedIndex(combinedIdx);
      }
    }
  }, [combinedSlides, currentSlideIndex]);

  // Check if Presentation API is supported
  useEffect(() => {
    if ('PresentationRequest' in window) {
      setPresentationSupported(true);
    }
  }, []);

  // Initialize presentation request when room is available
  useEffect(() => {
    if (room && presentationSupported) {
      const viewerUrl = `${window.location.origin}/viewer?pin=${room.pin}&local=true`;
      presentationRequestRef.current = new PresentationRequest([viewerUrl]);

      // Monitor for available displays
      if (navigator.presentation && navigator.presentation.defaultRequest) {
        navigator.presentation.defaultRequest = presentationRequestRef.current;
      }
    }
  }, [room, presentationSupported]);

  // Clean up presentation connection on unmount
  useEffect(() => {
    return () => {
      if (presentationConnection) {
        try {
          presentationConnection.terminate();
        } catch (err) {
          console.log('Error terminating presentation:', err);
        }
      }
    };
  }, [presentationConnection]);

  // Clear local media overlay when presentation connection is lost
  useEffect(() => {
    if (!presentationConnection && (imageOnDisplay || videoOnDisplay)) {
      setImageOnDisplay(false);
      setVideoOnDisplay(false);
      if (room) {
        socketService.operatorUpdateLocalMediaStatus(room.id, false);
      }
    }
  }, [presentationConnection, imageOnDisplay, videoOnDisplay, room]);

  // Start presentation on external display
  const startPresentation = async () => {
    if (!room) return;

    if (!presentationSupported) {
      // Fallback for browsers without Presentation API
      openLocalViewerFallback();
      return;
    }

    try {
      // Update the URL in case room changed
      const viewerUrl = `${window.location.origin}/viewer?pin=${room.pin}&local=true`;
      const request = new PresentationRequest([viewerUrl]);

      // Start the presentation - browser shows display picker
      const connection = await request.start();

      setPresentationConnection(connection);

      connection.onconnect = () => {
        console.log('✅ Presentation connected');
      };

      connection.onclose = () => {
        console.log('📴 Presentation closed');
        setPresentationConnection(null);
      };

      connection.onterminate = () => {
        console.log('🛑 Presentation terminated');
        setPresentationConnection(null);
      };

    } catch (err) {
      console.error('Presentation error:', err);
      if (err.name === 'NotAllowedError') {
        // User cancelled the display picker
        console.log('User cancelled display selection');
      } else if (err.name === 'NotFoundError') {
        alert(t('presenter.noDisplayFound') || 'No external display found. Please connect a display and try again.');
      } else {
        // Fallback to simple window
        openLocalViewerFallback();
      }
    }
  };

  // Fallback: open viewer in a new window (for browsers without Presentation API)
  const openLocalViewerFallback = () => {
    if (!room) return;

    const viewerUrl = `${window.location.origin}/viewer?pin=${room.pin}&local=true`;
    const newWindow = window.open(viewerUrl, 'localViewer', 'width=1280,height=720');

    if (newWindow) {
      localViewerWindowRef.current = newWindow;
      alert(t('presenter.moveToExternalDisplay') || 'Drag this window to your external display and press F11 for fullscreen.');
    }
  };

  // Store video in IndexedDB (accessible from all same-origin tabs/windows)
  const storeVideoInIndexedDB = (file) => {
    return new Promise((resolve, reject) => {
      // First, read the file as ArrayBuffer (async operation)
      const reader = new FileReader();
      reader.onload = () => {
        const arrayBuffer = reader.result;

        // Now open IndexedDB and store the data
        const request = indexedDB.open('solupresenter-videos', 1);

        request.onerror = () => reject(request.error);

        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains('videos')) {
            db.createObjectStore('videos', { keyPath: 'id' });
          }
        };

        request.onsuccess = (event) => {
          const db = event.target.result;
          const transaction = db.transaction(['videos'], 'readwrite');
          const store = transaction.objectStore('videos');

          const videoRecord = {
            id: 'current-video',
            data: arrayBuffer,
            fileName: file.name,
            mimeType: file.type,
            timestamp: Date.now()
          };

          const putRequest = store.put(videoRecord);
          putRequest.onsuccess = () => {
            db.close();
            resolve();
          };
          putRequest.onerror = () => {
            db.close();
            reject(putRequest.error);
          };
        };
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  };

  // Send video to local HDMI display via Presentation API connection
  const sendVideoToDisplay = async () => {
    if (!selectedMediaFile || mediaType !== 'video' || !room) return;

    console.log('📺 sendVideoToDisplay called:', {
      roomId: room.id,
      fileName: selectedMediaFile.name,
      fileSize: selectedMediaFile.size,
      hasPresentationConnection: !!presentationConnection,
      connectionState: presentationConnection?.state
    });

    if (!presentationConnection || presentationConnection.state !== 'connected') {
      console.error('📺 No active presentation connection');
      alert(t('presenter.noDisplayConnected') || 'No display connected. Click "Present to Display" first.');
      return;
    }

    try {
      // Read file as ArrayBuffer
      const arrayBuffer = await selectedMediaFile.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Convert to Base64 in chunks (to avoid memory issues)
      const CHUNK_SIZE = 512 * 1024; // 512KB chunks
      const totalChunks = Math.ceil(uint8Array.length / CHUNK_SIZE);

      console.log(`📺 Sending video in ${totalChunks} chunks...`);

      // Send start message
      presentationConnection.send(JSON.stringify({
        type: 'videoStart',
        fileName: selectedMediaFile.name,
        mimeType: selectedMediaFile.type,
        totalChunks: totalChunks,
        totalSize: uint8Array.length
      }));

      // Send chunks
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, uint8Array.length);
        const chunk = uint8Array.slice(start, end);

        // Convert chunk to Base64
        let binary = '';
        for (let j = 0; j < chunk.length; j++) {
          binary += String.fromCharCode(chunk[j]);
        }
        const base64Chunk = btoa(binary);

        presentationConnection.send(JSON.stringify({
          type: 'videoChunk',
          chunkIndex: i,
          data: base64Chunk
        }));

        // Log progress every 10 chunks
        if (i % 10 === 0 || i === totalChunks - 1) {
          console.log(`📺 Sent chunk ${i + 1}/${totalChunks}`);
        }
      }

      // Send end message
      presentationConnection.send(JSON.stringify({
        type: 'videoEnd'
      }));

      console.log('📺 Video sent via Presentation API');
      setVideoOnDisplay(true);
      setVideoPlaying(true);
      // Notify online viewers that local media is being shown
      if (room) {
        socketService.operatorUpdateLocalMediaStatus(room.id, true);
      }
    } catch (err) {
      console.error('📺 Failed to send video:', err);
    }
  };

  // Pause/Play video on HDMI display
  const toggleVideoPlayback = () => {
    if (!presentationConnection || presentationConnection.state !== 'connected') return;

    const newState = !videoPlaying;
    presentationConnection.send(JSON.stringify({
      type: newState ? 'videoPlay' : 'videoPause'
    }));
    setVideoPlaying(newState);
    console.log(`📺 Video ${newState ? 'playing' : 'paused'}`);
  };

  // Stop/Hide video on HDMI display
  const hideVideoFromDisplay = () => {
    if (!presentationConnection || presentationConnection.state !== 'connected') return;

    presentationConnection.send(JSON.stringify({
      type: 'stopLocalVideo'
    }));
    setVideoOnDisplay(false);
    setVideoPlaying(true);
    setImageOnDisplay(false);
    console.log('📺 Video hidden from display');
    // Notify online viewers that local media is no longer showing
    if (room) {
      socketService.operatorUpdateLocalMediaStatus(room.id, false);
    }
  };

  // Stop video on local display
  const stopVideoOnDisplay = () => {
    const stopMessage = { type: 'stopLocalVideo' };

    if (presentationConnection && presentationConnection.state === 'connected') {
      try {
        presentationConnection.send(JSON.stringify(stopMessage));
      } catch (err) {
        console.error('Failed to send stop via Presentation API:', err);
      }
    }

    if (localViewerWindowRef.current && !localViewerWindowRef.current.closed) {
      try {
        localViewerWindowRef.current.postMessage(stopMessage, window.location.origin);
      } catch (err) {
        console.error('Failed to send stop via postMessage:', err);
      }
    }
  };

  // Stop/close presentation
  const stopPresentation = () => {
    if (presentationConnection) {
      try {
        presentationConnection.terminate();
      } catch (err) {
        console.log('Error terminating:', err);
      }
      setPresentationConnection(null);
    }
  };

  // Local Media Functions
  // Send image to local HDMI display via Presentation API
  const sendImageToDisplay = async () => {
    if (!selectedMediaFile || mediaType !== 'image') return;

    console.log('🖼️ sendImageToDisplay called:', {
      fileName: selectedMediaFile.name,
      fileSize: selectedMediaFile.size,
      hasPresentationConnection: !!presentationConnection,
      connectionState: presentationConnection?.state
    });

    if (!presentationConnection || presentationConnection.state !== 'connected') {
      console.error('🖼️ No active presentation connection');
      alert(t('presenter.noDisplayConnected') || 'No display connected. Click "Present to Display" first.');
      return;
    }

    try {
      // Read file as Base64
      const reader = new FileReader();
      reader.onload = () => {
        presentationConnection.send(JSON.stringify({
          type: 'showImage',
          data: reader.result, // Base64 encoded image
          fileName: selectedMediaFile.name,
          mimeType: selectedMediaFile.type
        }));
        console.log('🖼️ Image sent via Presentation API');
        setImageOnDisplay(true);
        setVideoOnDisplay(false); // Hide any video
        // Notify online viewers that local media is being shown
        if (room) {
          socketService.operatorUpdateLocalMediaStatus(room.id, true);
        }
      };
      reader.onerror = () => {
        console.error('🖼️ Failed to read image file');
      };
      reader.readAsDataURL(selectedMediaFile);
    } catch (err) {
      console.error('🖼️ Failed to send image:', err);
    }
  };

  // Hide image from HDMI display
  const hideImageFromDisplay = () => {
    if (!presentationConnection || presentationConnection.state !== 'connected') return;

    presentationConnection.send(JSON.stringify({
      type: 'hideImage'
    }));
    setImageOnDisplay(false);
    console.log('🖼️ Image hidden from display');
    // Notify online viewers that local media is no longer showing
    if (room) {
      socketService.operatorUpdateLocalMediaStatus(room.id, false);
    }
  };

  // Countdown functions
  const toggleCountdownBroadcast = () => {
    if (!room) return;

    if (countdownBroadcasting) {
      // Stop broadcasting - clear the countdown from viewer
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      setCountdownRunning(false);
      setCountdownBroadcasting(false);
      setActiveSetlistCountdownIndex(null);
      // Send blank to clear the countdown
      socketService.operatorUpdateSlide({
        roomId: room.id,
        roomPin: room.pin,
        backgroundImage: room.backgroundImage || '',
        songId: null,
        slideIndex: 0,
        displayMode: displayMode,
        isBlank: true,
        toolsData: null
      });
    } else {
      // Start broadcasting - calculate time and start countdown
      const total = getCountdownSeconds();
      if (total <= 0) return;

      setCountdownRemaining(total);
      setCountdownRunning(true);
      setCountdownBroadcasting(true);

      // Broadcast the countdown
      socketService.operatorUpdateSlide({
        roomId: room.id,
        roomPin: room.pin,
        backgroundImage: room.backgroundImage || '',
        songId: null,
        slideIndex: 0,
        displayMode: displayMode,
        isBlank: false,
        toolsData: {
          type: 'countdown',
          countdown: {
            remaining: total,
            message: countdownMessage,
            running: true,
            endTime: Date.now() + (total * 1000)
          }
        }
      });
    }
  };

  // Toggle setlist countdown broadcast (for setlist items)
  const toggleSetlistCountdown = (index, toolData) => {
    if (!room) return;

    if (activeSetlistCountdownIndex === index) {
      // Hide countdown - restore previous state
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      setCountdownRunning(false);
      setCountdownBroadcasting(false);
      setActiveSetlistCountdownIndex(null);
      setFocusedCountdownIndex(null);

      // Restore previous state
      const savedState = preCountdownStateRef.current;
      if (savedState) {
        socketService.operatorUpdateSlide({
          roomId: room.id,
          roomPin: room.pin,
          backgroundImage: room.backgroundImage || '',
          songId: savedState.songId,
          slideIndex: savedState.slideIndex,
          displayMode: savedState.displayMode,
          isBlank: savedState.isBlank,
          imageUrl: savedState.imageUrl,
          toolsData: null
        });
        preCountdownStateRef.current = null;
      } else {
        socketService.operatorUpdateSlide({
          roomId: room.id,
          roomPin: room.pin,
          backgroundImage: room.backgroundImage || '',
          songId: currentSong?.id || null,
          slideIndex: currentSlideIndex,
          displayMode: displayMode,
          isBlank: isBlankActive,
          toolsData: null
        });
      }
    } else {
      // Show - start broadcasting this countdown
      const total = (() => {
        const [hours, minutes] = toolData.targetTime.split(':').map(Number);
        const now = new Date();
        const target = new Date();
        target.setHours(hours, minutes, 0, 0);
        if (target <= now) {
          target.setDate(target.getDate() + 1);
        }
        return Math.max(0, Math.floor((target - now) / 1000));
      })();

      if (total > 0) {
        // Stop any active messages first
        if (activeSetlistMessagesIndex !== null) {
          if (setlistMessagesIntervalRef.current) {
            clearInterval(setlistMessagesIntervalRef.current);
            setlistMessagesIntervalRef.current = null;
          }
          setlistMessagesIndexRef.current = 0;
          setActiveSetlistMessagesIndex(null);
          setFocusedMessagesIndex(null);
          // Transfer saved state from messages to countdown if it exists
          if (preMessagesStateRef.current) {
            preCountdownStateRef.current = preMessagesStateRef.current;
            preMessagesStateRef.current = null;
          }
        }

        // NOTE: Don't stop announcement - it's an overlay that persists on top of countdown

        // Save current state before showing countdown (if not already saved from messages)
        if (!preCountdownStateRef.current) {
          preCountdownStateRef.current = {
            songId: currentSong?.id || null,
            slideIndex: currentSlideIndex,
            displayMode: displayMode,
            isBlank: isBlankActive,
            imageUrl: currentItem?.type === 'image' ? currentItem.data?.url : null
          };
        }

        setCountdownTargetTime(toolData.targetTime);
        setCountdownMessage(toolData.message || '');
        setCountdownRemaining(total);
        setCountdownRunning(true);
        setCountdownBroadcasting(true);
        setActiveSetlistCountdownIndex(index);

        // Build toolsData - include announcement if one is active
        const countdownToolsData = {
          type: 'countdown',
          countdown: {
            remaining: total,
            message: toolData.message || '',
            running: true,
            endTime: Date.now() + (total * 1000)
          }
        };

        // If announcement is active, include it so viewer shows both
        if (announcementVisible && announcementText) {
          countdownToolsData.type = 'announcement';
          countdownToolsData.announcement = {
            text: announcementText,
            visible: true
          };
        }

        socketService.operatorUpdateSlide({
          roomId: room.id,
          roomPin: room.pin,
          backgroundImage: room.backgroundImage || '',
          songId: currentSong?.id || null,
          slideIndex: currentSlideIndex,
          displayMode: displayMode,
          isBlank: isBlankActive,
          toolsData: countdownToolsData
        });
      }
    }
  };

  // Toggle setlist announcement (for setlist items)
  const toggleSetlistAnnouncement = (index, toolData) => {
    if (!room) return;

    // Get current image URL if an image is being displayed
    const currentImageUrl = currentItem?.type === 'image' ? currentItem.data?.url : null;

    if (activeSetlistAnnouncementIndex === index) {
      // Hide - just hide the announcement overlay, keep content underneath
      setAnnouncementVisible(false);
      setActiveSetlistAnnouncementIndex(null);
      setFocusedAnnouncementIndex(null);
      // Clear timer if exists
      if (announcementTimerRef.current) {
        clearTimeout(announcementTimerRef.current);
        announcementTimerRef.current = null;
      }

      // Build slideData including combinedSlides for original mode
      let hideSetlistSlideData = null;
      if (currentSong?.slides?.[currentSlideIndex]) {
        const originalIndices = combinedSlides?.combinedToOriginal?.get(selectedCombinedIndex);
        hideSetlistSlideData = {
          slide: currentSong.slides[currentSlideIndex],
          title: currentSong.title,
          isBible: currentSong.isBible || false,
          isTemporary: currentSong.isTemporary || false,
          originalLanguage: currentSong.originalLanguage || 'en',
          combinedSlides: displayMode === 'original' && originalIndices?.length > 1
            ? originalIndices.map(i => currentSong.slides[i]).filter(Boolean)
            : null
        };
      }

      // Build toolsData - if countdown is running, restore it as the active tool
      // Use ref to get current countdown state (not stale closure values)
      const currentCountdown = countdownStateRef.current;
      let hideToolsData;
      if (currentCountdown.broadcasting && currentCountdown.running) {
        // Countdown was running underneath - restore it as the main tool
        hideToolsData = {
          type: 'countdown',
          countdown: {
            remaining: currentCountdown.remaining,
            endTime: Date.now() + (currentCountdown.remaining * 1000),
            running: true,
            message: currentCountdown.message
          }
        };
      } else {
        // No countdown - just hide the announcement
        hideToolsData = {
          type: 'announcement',
          announcement: {
            text: '',
            visible: false
          }
        };
      }

      // Send update to hide overlay (and restore countdown if active)
      socketService.operatorUpdateSlide({
        roomId: room.id,
        roomPin: room.pin,
        backgroundImage: room.backgroundImage || '',
        songId: currentSong?.id || null,
        slideIndex: currentSlideIndex,
        displayMode: displayMode,
        isBlank: isBlankActive,
        imageUrl: currentImageUrl,
        slideData: hideSetlistSlideData,
        toolsData: hideToolsData
      });
    } else {
      // Show - display this announcement as an overlay
      // Clear any existing timer
      if (announcementTimerRef.current) {
        clearTimeout(announcementTimerRef.current);
      }

      // NOTE: Don't stop countdown - announcements are overlays that can appear on top of countdowns
      // Stop any active messages first (messages and announcements conflict)
      if (activeSetlistMessagesIndex !== null) {
        if (setlistMessagesIntervalRef.current) {
          clearInterval(setlistMessagesIntervalRef.current);
          setlistMessagesIntervalRef.current = null;
        }
        setlistMessagesIndexRef.current = 0;
        setActiveSetlistMessagesIndex(null);
        setFocusedMessagesIndex(null);
        preMessagesStateRef.current = null;
      }

      setAnnouncementText(toolData.text);
      setAnnouncementVisible(true);
      setActiveSetlistAnnouncementIndex(index);

      // Build toolsData - include countdown if one is active
      const announcementToolsData = {
        type: 'announcement',
        announcement: {
          text: toolData.text,
          visible: true
        }
      };

      // If countdown is active, include it so viewer can show both
      if (countdownBroadcasting && countdownRunning) {
        announcementToolsData.countdown = {
          remaining: countdownRemaining,
          message: countdownMessage,
          running: true,
          endTime: Date.now() + (countdownRemaining * 1000)
        };
      }

      // Build slideData including combinedSlides for original mode
      let announcementSlideData = null;
      if (currentSong?.slides?.[currentSlideIndex]) {
        const originalIndices = combinedSlides?.combinedToOriginal?.get(selectedCombinedIndex);
        announcementSlideData = {
          slide: currentSong.slides[currentSlideIndex],
          title: currentSong.title,
          isBible: currentSong.isBible || false,
          isTemporary: currentSong.isTemporary || false,
          originalLanguage: currentSong.originalLanguage || 'en',
          combinedSlides: displayMode === 'original' && originalIndices?.length > 1
            ? originalIndices.map(i => currentSong.slides[i]).filter(Boolean)
            : null
        };
      }

      socketService.operatorUpdateSlide({
        roomId: room.id,
        roomPin: room.pin,
        backgroundImage: room.backgroundImage || '',
        songId: currentSong?.id || null,
        slideIndex: currentSlideIndex,
        displayMode: displayMode,
        isBlank: isBlankActive,
        imageUrl: currentImageUrl,
        slideData: announcementSlideData,
        toolsData: announcementToolsData
      });

      // Auto-hide after 15 seconds
      announcementTimerRef.current = setTimeout(() => {
        setAnnouncementVisible(false);
        // Get current image URL at the time of auto-hide
        const imageUrlAtHide = currentItem?.type === 'image' ? currentItem.data?.url : null;

        // Build toolsData for hide - restore countdown if still active
        // Use ref to get current countdown state (not stale closure values)
        const currentCountdown = countdownStateRef.current;
        let hideToolsData = {
          type: 'announcement',
          announcement: {
            text: '',
            visible: false
          }
        };

        // If countdown is still running, switch back to showing it
        if (currentCountdown.broadcasting && currentCountdown.running) {
          hideToolsData = {
            type: 'countdown',
            countdown: {
              remaining: currentCountdown.remaining,
              message: currentCountdown.message,
              running: true,
              endTime: Date.now() + (currentCountdown.remaining * 1000)
            }
          };
        }

        // Build slideData including combinedSlides for original mode
        let autoHideSlideData = null;
        if (currentSong?.slides?.[currentSlideIndex]) {
          const originalIndices = combinedSlides?.combinedToOriginal?.get(selectedCombinedIndex);
          autoHideSlideData = {
            slide: currentSong.slides[currentSlideIndex],
            title: currentSong.title,
            isBible: currentSong.isBible || false,
            isTemporary: currentSong.isTemporary || false,
            originalLanguage: currentSong.originalLanguage || 'en',
            combinedSlides: displayMode === 'original' && originalIndices?.length > 1
              ? originalIndices.map(i => currentSong.slides[i]).filter(Boolean)
              : null
          };
        }

        socketService.operatorUpdateSlide({
          roomId: room.id,
          roomPin: room.pin,
          backgroundImage: room.backgroundImage || '',
          songId: currentSong?.id || null,
          slideIndex: currentSlideIndex,
          displayMode: displayMode,
          isBlank: isBlankActive,
          imageUrl: imageUrlAtHide,
          slideData: autoHideSlideData,
          toolsData: hideToolsData
        });
        // Delay clearing the selection until after the banner animation completes on viewer
        setTimeout(() => {
          setActiveSetlistAnnouncementIndex(null);
          setFocusedAnnouncementIndex(null);
        }, 2000);
      }, 15000);
    }
  };

  // Toggle setlist messages (for setlist items)
  const setlistMessagesIntervalRef = useRef(null);
  const setlistMessagesIndexRef = useRef(0);
  const toggleSetlistMessages = (index, toolData) => {
    if (!room) return;

    if (activeSetlistMessagesIndex === index) {
      // Hide messages - restore previous state
      if (setlistMessagesIntervalRef.current) {
        clearInterval(setlistMessagesIntervalRef.current);
        setlistMessagesIntervalRef.current = null;
      }
      setlistMessagesIndexRef.current = 0;
      setActiveSetlistMessagesIndex(null);
      setFocusedMessagesIndex(null);

      // Restore previous state
      const savedState = preMessagesStateRef.current;
      if (savedState) {
        socketService.operatorUpdateSlide({
          roomId: room.id,
          roomPin: room.pin,
          backgroundImage: room.backgroundImage || '',
          songId: savedState.songId,
          slideIndex: savedState.slideIndex,
          displayMode: savedState.displayMode,
          isBlank: savedState.isBlank,
          imageUrl: savedState.imageUrl,
          toolsData: null
        });
        preMessagesStateRef.current = null;
      } else {
        socketService.operatorUpdateSlide({
          roomId: room.id,
          roomPin: room.pin,
          backgroundImage: room.backgroundImage || '',
          songId: currentSong?.id || null,
          slideIndex: currentSlideIndex,
          displayMode: displayMode,
          isBlank: isBlankActive,
          toolsData: null
        });
      }
    } else {
      // Show - start broadcasting these messages
      const messages = toolData.messages || [];
      const interval = toolData.interval || 5;
      if (messages.length === 0) return;

      // Stop any currently active messages first
      if (setlistMessagesIntervalRef.current) {
        clearInterval(setlistMessagesIntervalRef.current);
        setlistMessagesIntervalRef.current = null;
      }
      setlistMessagesIndexRef.current = 0;

      // Stop any active countdown first
      if (activeSetlistCountdownIndex !== null) {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
        setCountdownRunning(false);
        setCountdownBroadcasting(false);
        setActiveSetlistCountdownIndex(null);
        setFocusedCountdownIndex(null);
        // Transfer saved state from countdown to messages if it exists
        if (preCountdownStateRef.current) {
          preMessagesStateRef.current = preCountdownStateRef.current;
          preCountdownStateRef.current = null;
        }
      }

      // Stop any active announcement first
      if (activeSetlistAnnouncementIndex !== null) {
        setAnnouncementVisible(false);
        setActiveSetlistAnnouncementIndex(null);
        setFocusedAnnouncementIndex(null);
        if (announcementTimerRef.current) {
          clearTimeout(announcementTimerRef.current);
          announcementTimerRef.current = null;
        }
      }

      // Only save state if no other tool was previously active (preserve original state)
      if (activeSetlistMessagesIndex === null && !preMessagesStateRef.current) {
        preMessagesStateRef.current = {
          songId: currentSong?.id || null,
          slideIndex: currentSlideIndex,
          displayMode: displayMode,
          isBlank: isBlankActive,
          imageUrl: currentItem?.type === 'image' ? currentItem.data?.url : null
        };
      }

      setActiveSetlistMessagesIndex(index);

      // Broadcast first message immediately
      socketService.operatorUpdateSlide({
        roomId: room.id,
        roomPin: room.pin,
        backgroundImage: room.backgroundImage || '',
        songId: null,
        slideIndex: 0,
        displayMode: displayMode,
        isBlank: false,
        toolsData: {
          type: 'rotatingMessage',
          rotatingMessage: {
            text: messages[0],
            interval: interval
          }
        }
      });

      // Start interval for rotation
      setlistMessagesIntervalRef.current = setInterval(() => {
        setlistMessagesIndexRef.current = (setlistMessagesIndexRef.current + 1) % messages.length;
        socketService.operatorUpdateSlide({
          roomId: room.id,
          roomPin: room.pin,
          backgroundImage: room.backgroundImage || '',
          songId: null,
          slideIndex: 0,
          displayMode: displayMode,
          isBlank: false,
          toolsData: {
            type: 'rotatingMessage',
            rotatingMessage: {
              text: messages[setlistMessagesIndexRef.current],
              interval: interval
            }
          }
        });
      }, interval * 1000);
    }
  };

  // Clock functions
  const toggleClockBroadcast = () => {
    if (clockBroadcasting) {
      // Stop broadcasting
      if (clockIntervalRef.current) {
        clearInterval(clockIntervalRef.current);
        clockIntervalRef.current = null;
      }
      setClockBroadcasting(false);
      // Clear the tools display
      if (room) {
        socketService.operatorUpdateSlide({
          roomId: room.id,
          roomPin: room.pin,
          backgroundImage: room.backgroundImage || '',
          songId: null,
          slideIndex: 0,
          displayMode: displayMode,
          isBlank: true,
          toolsData: null
        });
      }
    } else {
      // Start broadcasting clock
      setClockBroadcasting(true);
      broadcastClock();
    }
  };

  const broadcastClock = () => {
    if (!room) return;
    socketService.operatorUpdateSlide({
      roomId: room.id,
      roomPin: room.pin,
      backgroundImage: room.backgroundImage || '',
      songId: null,
      slideIndex: 0,
      displayMode: displayMode,
      isBlank: false,
      toolsData: {
        type: 'clock',
        clock: {
          format: clockFormat,
          showDate: clockShowDate
        }
      }
    });
  };

  // Stopwatch functions
  const toggleStopwatch = () => {
    if (stopwatchRunning) {
      // Pause
      if (stopwatchIntervalRef.current) {
        clearInterval(stopwatchIntervalRef.current);
        stopwatchIntervalRef.current = null;
      }
      setStopwatchRunning(false);
    } else {
      // Start
      setStopwatchRunning(true);
    }
  };

  const resetStopwatch = () => {
    if (stopwatchIntervalRef.current) {
      clearInterval(stopwatchIntervalRef.current);
      stopwatchIntervalRef.current = null;
    }
    setStopwatchRunning(false);
    setStopwatchTime(0);
  };

  const broadcastStopwatch = () => {
    if (!room) return;
    socketService.operatorUpdateSlide({
      roomId: room.id,
      roomPin: room.pin,
      backgroundImage: room.backgroundImage || '',
      songId: null,
      slideIndex: 0,
      displayMode: displayMode,
      isBlank: false,
      toolsData: {
        type: 'stopwatch',
        stopwatch: {
          elapsed: stopwatchTime,
          label: stopwatchLabel,
          running: stopwatchRunning,
          startTime: stopwatchRunning ? Date.now() - (stopwatchTime * 1000) : null
        }
      }
    });
  };

  // Announcement functions
  const hideAnnouncement = () => {
    // Clear any existing timer
    if (announcementTimerRef.current) {
      clearTimeout(announcementTimerRef.current);
      announcementTimerRef.current = null;
    }
    setAnnouncementVisible(false);
    setActiveSetlistAnnouncementIndex(null);

    if (!room) return;

    // Build slideData including combinedSlides for original mode
    let hideSlideData = null;
    if (currentSong?.slides?.[currentSlideIndex]) {
      const originalIndices = combinedSlides?.combinedToOriginal?.get(selectedCombinedIndex);
      hideSlideData = {
        slide: currentSong.slides[currentSlideIndex],
        title: currentSong.title,
        isBible: currentSong.isBible || false,
        isTemporary: currentSong.isTemporary || false,
        originalLanguage: currentSong.originalLanguage || 'en',
        combinedSlides: displayMode === 'original' && originalIndices?.length > 1
          ? originalIndices.map(i => currentSong.slides[i]).filter(Boolean)
          : null
      };
    }

    // Build toolsData - if countdown is running, restore it as the active tool
    // Use ref to get current countdown state (not stale closure values)
    const currentCountdown = countdownStateRef.current;
    let hideToolsData;
    console.log('🔧 hideAnnouncement - checking countdown state:', currentCountdown);
    if (currentCountdown.broadcasting && currentCountdown.running) {
      // Countdown was running underneath - restore it as the main tool
      console.log('🔧 hideAnnouncement - restoring countdown');
      hideToolsData = {
        type: 'countdown',
        countdown: {
          remaining: currentCountdown.remaining,
          endTime: Date.now() + (currentCountdown.remaining * 1000),
          running: true,
          message: currentCountdown.message
        }
      };
    } else {
      // No countdown - just hide the announcement
      hideToolsData = {
        type: 'announcement',
        announcement: {
          text: announcementText,
          visible: false
        }
      };
    }

    socketService.operatorUpdateSlide({
      roomId: room.id,
      roomPin: room.pin,
      backgroundImage: room.backgroundImage || '',
      songId: currentSong?.id || null,
      slideIndex: currentSlideIndex,
      displayMode: displayMode,
      isBlank: isBlankActive,
      slideData: hideSlideData,
      toolsData: hideToolsData
    });
  };

  const showAnnouncement = (text) => {
    // Clear any existing timer
    if (announcementTimerRef.current) {
      clearTimeout(announcementTimerRef.current);
    }

    setAnnouncementVisible(true);

    if (!room) return;

    // Build slideData including combinedSlides for original mode
    let showSlideData = null;
    if (currentSong?.slides?.[currentSlideIndex]) {
      const originalIndices = combinedSlides?.combinedToOriginal?.get(selectedCombinedIndex);
      showSlideData = {
        slide: currentSong.slides[currentSlideIndex],
        title: currentSong.title,
        isBible: currentSong.isBible || false,
        isTemporary: currentSong.isTemporary || false,
        originalLanguage: currentSong.originalLanguage || 'en',
        combinedSlides: displayMode === 'original' && originalIndices?.length > 1
          ? originalIndices.map(i => currentSong.slides[i]).filter(Boolean)
          : null
      };
    }

    socketService.operatorUpdateSlide({
      roomId: room.id,
      roomPin: room.pin,
      backgroundImage: room.backgroundImage || '',
      songId: currentSong?.id || null,
      slideIndex: currentSlideIndex,
      displayMode: displayMode,
      isBlank: isBlankActive,
      slideData: showSlideData,
      toolsData: {
        type: 'announcement',
        announcement: {
          text: text || announcementText,
          visible: true
        }
      }
    });

    // Auto-hide after 15 seconds
    announcementTimerRef.current = setTimeout(() => {
      hideAnnouncement();
    }, 15000);
  };

  const toggleAnnouncement = () => {
    if (announcementVisible) {
      hideAnnouncement();
    } else {
      showAnnouncement(announcementText);
    }
  };

  // Update announcement text and broadcast if banner is visible
  const updateAnnouncementText = (text) => {
    setAnnouncementText(text);

    // If banner is already visible, broadcast the new text and reset timer
    if (announcementVisible && room) {
      // Clear existing timer and restart
      if (announcementTimerRef.current) {
        clearTimeout(announcementTimerRef.current);
      }

      // Build slideData including combinedSlides for original mode
      let updateSlideData = null;
      if (currentSong?.slides?.[currentSlideIndex]) {
        const originalIndices = combinedSlides?.combinedToOriginal?.get(selectedCombinedIndex);
        updateSlideData = {
          slide: currentSong.slides[currentSlideIndex],
          title: currentSong.title,
          isBible: currentSong.isBible || false,
          isTemporary: currentSong.isTemporary || false,
          originalLanguage: currentSong.originalLanguage || 'en',
          combinedSlides: displayMode === 'original' && originalIndices?.length > 1
            ? originalIndices.map(i => currentSong.slides[i]).filter(Boolean)
            : null
        };
      }

      socketService.operatorUpdateSlide({
        roomId: room.id,
        roomPin: room.pin,
        backgroundImage: room.backgroundImage || '',
        songId: currentSong?.id || null,
        slideIndex: currentSlideIndex,
        displayMode: displayMode,
        isBlank: isBlankActive,
        slideData: updateSlideData,
        toolsData: {
          type: 'announcement',
          announcement: {
            text: text,
            visible: true
          }
        }
      });

      // Reset auto-hide timer
      announcementTimerRef.current = setTimeout(() => {
        hideAnnouncement();
      }, 15000);
    }
  };

  // Rotating messages functions
  const toggleMessageEnabled = (id) => {
    setRotatingMessages(msgs =>
      msgs.map(msg => msg.id === id ? { ...msg, enabled: !msg.enabled } : msg)
    );
  };

  const addCustomMessage = () => {
    if (!customMessageInput.trim()) return;
    const newId = Math.max(...rotatingMessages.map(m => m.id)) + 1;
    setRotatingMessages([...rotatingMessages, {
      id: newId,
      text: customMessageInput.trim(),
      enabled: true,
      isPreset: false
    }]);
    setCustomMessageInput('');
  };

  const removeCustomMessage = (id) => {
    setRotatingMessages(msgs => msgs.filter(msg => msg.id !== id));
  };

  const toggleRotatingMessages = () => {
    if (rotatingRunning) {
      // Stop
      if (rotatingIntervalRef.current) {
        clearInterval(rotatingIntervalRef.current);
        rotatingIntervalRef.current = null;
      }
      setRotatingRunning(false);
      // Clear display
      if (room) {
        socketService.operatorUpdateSlide({
          roomId: room.id,
          roomPin: room.pin,
          backgroundImage: room.backgroundImage || '',
          songId: null,
          slideIndex: 0,
          displayMode: displayMode,
          isBlank: true,
          toolsData: null
        });
      }
    } else {
      // Start
      const enabledMessages = rotatingMessages.filter(m => m.enabled);
      if (enabledMessages.length === 0) return;
      setCurrentMessageIndex(0);
      setRotatingRunning(true);
      // Broadcast first message immediately
      broadcastRotatingMessage(0);
    }
  };

  const broadcastRotatingMessage = (index) => {
    if (!room) return;
    const enabledMessages = rotatingMessages.filter(m => m.enabled);
    if (enabledMessages.length === 0) return;

    const msg = enabledMessages[index % enabledMessages.length];
    const displayText = msg.isPreset ? t(`presenter.${msg.text}`) : msg.text;

    socketService.operatorUpdateSlide({
      roomId: room.id,
      roomPin: room.pin,
      backgroundImage: room.backgroundImage || '',
      songId: null,
      slideIndex: 0,
      displayMode: displayMode,
      isBlank: false,
      toolsData: {
        type: 'rotatingMessage',
        rotatingMessage: {
          text: displayText,
          interval: rotatingInterval
        }
      }
    });
  };

  // Keep ref updated for use in effects (avoids stale closures)
  broadcastRotatingMessageRef.current = broadcastRotatingMessage;

  // Stop all running tools (called when broadcasting non-tool content)
  const stopAllTools = () => {
    // Stop rotating messages
    if (rotatingRunning) {
      if (rotatingIntervalRef.current) {
        clearInterval(rotatingIntervalRef.current);
        rotatingIntervalRef.current = null;
      }
      setRotatingRunning(false);
    }
    // Stop clock broadcast
    if (clockBroadcasting) {
      if (clockIntervalRef.current) {
        clearInterval(clockIntervalRef.current);
        clockIntervalRef.current = null;
      }
      setClockBroadcasting(false);
    }
    // Stop countdown broadcast
    if (countdownBroadcasting) {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      setCountdownRunning(false);
      setCountdownBroadcasting(false);
      setActiveSetlistCountdownIndex(null);
      setFocusedCountdownIndex(null);
    }
    // Stop announcement
    if (announcementVisible) {
      setAnnouncementVisible(false);
      setActiveSetlistAnnouncementIndex(null);
      setFocusedAnnouncementIndex(null);
    }
  };

  // Stop tools except overlays (announcements) - used when switching slides
  const stopNonOverlayTools = () => {
    // Stop rotating messages
    if (rotatingRunning) {
      if (rotatingIntervalRef.current) {
        clearInterval(rotatingIntervalRef.current);
        rotatingIntervalRef.current = null;
      }
      setRotatingRunning(false);
    }
    // Stop clock broadcast
    if (clockBroadcasting) {
      if (clockIntervalRef.current) {
        clearInterval(clockIntervalRef.current);
        clockIntervalRef.current = null;
      }
      setClockBroadcasting(false);
    }
    // Stop countdown broadcast
    if (countdownBroadcasting) {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      setCountdownRunning(false);
      setCountdownBroadcasting(false);
      setActiveSetlistCountdownIndex(null);
      setFocusedCountdownIndex(null);
    }
    // NOTE: Announcements are overlays - they persist when switching slides
    // Clear local media overlay for online viewers (if local media was showing on HDMI)
    if (imageOnDisplay || videoOnDisplay) {
      setImageOnDisplay(false);
      setVideoOnDisplay(false);
      if (room) {
        socketService.operatorUpdateLocalMediaStatus(room.id, false);
      }
    }
  };

  // Switch resource panel and apply search
  const switchResourcePanel = (panel) => {
    setActiveResourcePanel(panel);
    // Reset search query when switching tabs
    setSearchQuery('');
    handleSearch('');

    // If switching to Bible panel, load books data if needed
    if (panel === 'bible' && bibleBooks.length === 0) {
      fetchBibleBooks();
    }
  };

  // English to Hebrew book name mapping for display
  const englishToHebrewBooks = {
    'Genesis': 'בראשית', 'Exodus': 'שמות', 'Leviticus': 'ויקרא',
    'Numbers': 'במדבר', 'Deuteronomy': 'דברים', 'Joshua': 'יהושע',
    'Judges': 'שופטים', 'I Samuel': 'שמואל א', 'II Samuel': 'שמואל ב',
    'I Kings': 'מלכים א', 'II Kings': 'מלכים ב', 'Isaiah': 'ישעיהו',
    'Jeremiah': 'ירמיהו', 'Ezekiel': 'יחזקאל', 'Hosea': 'הושע',
    'Joel': 'יואל', 'Amos': 'עמוס', 'Obadiah': 'עובדיה', 'Jonah': 'יונה',
    'Micah': 'מיכה', 'Nahum': 'נחום', 'Habakkuk': 'חבקוק', 'Zephaniah': 'צפניה',
    'Haggai': 'חגי', 'Zechariah': 'זכריה', 'Malachi': 'מלאכי',
    'Psalms': 'תהילים', 'Proverbs': 'משלי', 'Job': 'איוב',
    'Song of Songs': 'שיר השירים', 'Ruth': 'רות', 'Lamentations': 'איכה',
    'Ecclesiastes': 'קהלת', 'Esther': 'אסתר', 'Daniel': 'דניאל',
    'Ezra': 'עזרא', 'Nehemiah': 'נחמיה', 'I Chronicles': 'דברי הימים א',
    'II Chronicles': 'דברי הימים ב',
    // New Testament
    'Matthew': 'מתי', 'Mark': 'מרקוס', 'Luke': 'לוקס', 'John': 'יוחנן',
    'Acts': 'מעשי השליחים', 'Romans': 'רומים',
    '1 Corinthians': 'קורינתים א', '2 Corinthians': 'קורינתים ב',
    'Galatians': 'גלטים', 'Ephesians': 'אפסים', 'Philippians': 'פיליפים',
    'Colossians': 'קולוסים', '1 Thessalonians': 'תסלוניקים א',
    '2 Thessalonians': 'תסלוניקים ב', '1 Timothy': 'טימותיאוס א',
    '2 Timothy': 'טימותיאוס ב', 'Titus': 'טיטוס', 'Philemon': 'פילימון',
    'Hebrews': 'עברים', 'James': 'יעקב', '1 Peter': 'פטרוס א',
    '2 Peter': 'פטרוס ב', '1 John': 'יוחנן א', '2 John': 'יוחנן ב',
    '3 John': 'יוחנן ג', 'Jude': 'יהודה', 'Revelation': 'התגלות'
  };

  // Convert Arabic number to Hebrew numeral
  const numberToHebrew = (num) => {
    const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
    const tens = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
    const hundreds = ['', 'ק', 'ר', 'ש', 'ת'];

    const n = parseInt(num);
    if (n <= 0 || n > 499) return num.toString();

    let result = '';

    // Hundreds
    if (n >= 100) {
      result += hundreds[Math.floor(n / 100)];
    }

    // Handle 15 and 16 specially (ט״ו and ט״ז instead of י״ה and י״ו)
    const remainder = n % 100;
    if (remainder === 15) {
      result += 'ט״ו';
    } else if (remainder === 16) {
      result += 'ט״ז';
    } else {
      // Tens
      if (remainder >= 10) {
        result += tens[Math.floor(remainder / 10)];
      }
      // Ones
      if (remainder % 10 > 0) {
        result += ones[remainder % 10];
      }
    }

    // Add gershayim before last letter if more than one letter
    if (result.length > 1 && !result.includes('״')) {
      result = result.slice(0, -1) + '״' + result.slice(-1);
    } else if (result.length === 1) {
      result += '׳';
    }

    return result;
  };

  // Get display name for book (Hebrew if in Hebrew mode)
  const getDisplayBookName = (englishName) => {
    if (i18n.language === 'he' && englishToHebrewBooks[englishName]) {
      return englishToHebrewBooks[englishName];
    }
    return englishName;
  };

  // Get display chapter (Hebrew numeral if in Hebrew mode)
  const getDisplayChapter = (chapter) => {
    if (i18n.language === 'he') {
      return numberToHebrew(chapter);
    }
    return chapter;
  };

  // Fetch Bible books
  const fetchBibleBooks = async () => {
    try {
      const response = await api.get('/api/bible/books');
      setBibleBooks(response.data.books);
    } catch (error) {
      console.error('Error fetching Bible books:', error);
    }
  };

  // Fetch Bible verses for selected book and chapter
  const fetchBibleVerses = useCallback(async (book, chapter) => {
    if (!book || !chapter) return;

    setBibleLoading(true);
    try {
      const response = await api.get(`/api/bible/verses/${encodeURIComponent(book)}/${chapter}`);
      const verses = response.data.verses;

      // Convert verses to slides format
      const bibleSlides = verses.map(verse => ({
        originalText: verse.hebrew,
        translation: verse.english,
        verseNumber: verse.verseNumber,
        reference: verse.reference,
        hebrewReference: verse.hebrewReference
      }));

      setBibleVerses(bibleSlides);

      // Create a Bible passage object that acts like a song
      const biblePassage = {
        _id: `bible-${book}-${chapter}`,
        title: `${getDisplayBookName(book)} ${getDisplayChapter(chapter)}`,
        slides: bibleSlides,
        isBible: true,
        book: book,
        chapter: chapter
      };

      // Select this passage to show in preview
      selectBiblePassage(biblePassage);

    } catch (error) {
      console.error('Error fetching Bible verses:', error);
      setError('Failed to load Bible verses. Please try again.');
    } finally {
      setBibleLoading(false);
    }
  }, [displayMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Select Bible passage (similar to selecting a song)
  const selectBiblePassage = (passage) => {
    setCurrentSong(passage);
    setCurrentItem({ type: 'bible', data: passage });
    setCurrentSlideIndex(0);
    setIsBlankActive(false);
    setSelectedPresentation(null); // Clear presentation when selecting Bible
    updateSlide(passage, 0, displayMode, false);
  };

  // Add Bible passage to setlist
  const addBibleToSetlist = (passage) => {
    setSetlist([...setlist, { type: 'bible', data: passage }]);
    setHasUnsavedChanges(true);
  };

  // When Bible book or chapter changes, fetch verses
  useEffect(() => {
    if (selectedBibleBook && selectedBibleChapter) {
      fetchBibleVerses(selectedBibleBook, selectedBibleChapter);
    }
  }, [selectedBibleBook, selectedBibleChapter]);

  // Responsive layout
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Keyboard shortcuts help
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);

  // Auto-dismiss errors after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Manual save function for setlist
  const handleManualSaveSetlist = async () => {
    if (!room || !room.id || !room.temporarySetlist) {
      setError('No active setlist to save');
      return;
    }

    try {
      // Convert setlist to backend format
      const items = setlist.map((item, index) => {
        if (item.type === 'song') {
          return {
            type: 'song',
            song: item.data.id,
            order: index
          };
        } else if (item.type === 'image') {
          return {
            type: 'image',
            image: item.data.id,
            order: index
          };
        } else if (item.type === 'bible') {
          // Extract Bible data from the item
          const bibleId = item.data.id; // e.g., "bible-Genesis-1"
          const parts = bibleId.replace('bible-', '').split('-');
          const book = parts.slice(0, -1).join('-'); // Book name might have hyphens
          const chapter = parseInt(parts[parts.length - 1]);

          return {
            type: 'bible',
            bibleData: {
              book: book,
              chapter: chapter,
              title: item.data.title,
              slides: item.data.slides
            },
            order: index
          };
        } else if (item.type === 'blank') {
          return {
            type: 'blank',
            order: index
          };
                      } else if (item.type === 'youtube') {
                        return {
                          title: (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <svg width="14" height="14" viewBox="0 0 16 16" fill="white">
                                <path d="M8.051 1.999h.089c.822.003 4.987.033 6.11.335a2.01 2.01 0 0 1 1.415 1.42c.101.38.172.883.22 1.402l.01.104.022.26.008.104c.065.914.073 1.77.074 1.957v.075c-.001.194-.01 1.108-.082 2.06l-.008.105-.009.104c-.05.572-.124 1.14-.235 1.558a2.007 2.007 0 0 1-1.415 1.42c-1.16.312-5.569.334-6.18.335h-.142c-.309 0-1.587-.006-2.927-.052l-.17-.006-.087-.004-.171-.007-.171-.007c-1.11-.049-2.167-.128-2.654-.26a2.007 2.007 0 0 1-1.415-1.419c-.111-.417-.185-.986-.235-1.558L.09 9.82l-.008-.104A31.4 31.4 0 0 1 0 7.68v-.123c.002-.215.01-.958.064-1.778l.007-.103.003-.052.008-.104.022-.26.01-.104c.048-.519.119-1.023.22-1.402a2.007 2.007 0 0 1 1.415-1.42c.487-.13 1.544-.21 2.654-.26l.17-.007.172-.006.086-.003.171-.007A99.788 99.788 0 0 1 7.858 2h.193zM6.4 5.209v4.818l4.157-2.408L6.4 5.209z"/>
                              </svg>
                              {item.youtubeData?.title || t('presenter.youtubeVideo', 'YouTube Video')}
                            </span>
                          ),
                          bgColor: 'transparent',
                          borderLeft: '4px solid #FF0000'
                        };
        } else if (item.type === 'section') {
          return {
            type: 'section',
            sectionTitle: item.data.title,
            order: index
          };
        }
        return null;
      }).filter(Boolean);

      await api.put(`/api/rooms/${room.id}/setlist`, { items });
      console.log('✅ Setlist saved to backend');
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('❌ Error saving setlist:', error);
      setError('Failed to save setlist: ' + (error.response?.data?.error || error.message));
    }
  };

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Countdown timer effect
  useEffect(() => {
    if (countdownRunning && countdownRemaining > 0) {
      countdownIntervalRef.current = setInterval(() => {
        setCountdownRemaining(prev => {
          if (prev <= 1) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
            setCountdownRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [countdownRunning]);

  // Stopwatch timer effect
  useEffect(() => {
    if (stopwatchRunning) {
      stopwatchIntervalRef.current = setInterval(() => {
        setStopwatchTime(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (stopwatchIntervalRef.current) {
        clearInterval(stopwatchIntervalRef.current);
      }
    };
  }, [stopwatchRunning]);

  // Rotating messages effect
  useEffect(() => {
    if (rotatingRunning) {
      rotatingIntervalRef.current = setInterval(() => {
        setCurrentMessageIndex(prev => {
          const enabledMessages = rotatingMessages.filter(m => m.enabled);
          if (enabledMessages.length === 0) return prev;
          const nextIndex = (prev + 1) % enabledMessages.length;
          // Use ref to avoid stale closure issues
          if (broadcastRotatingMessageRef.current) {
            broadcastRotatingMessageRef.current(nextIndex);
          }
          return nextIndex;
        });
      }, rotatingInterval * 1000);
    }
    return () => {
      if (rotatingIntervalRef.current) {
        clearInterval(rotatingIntervalRef.current);
        rotatingIntervalRef.current = null;
      }
    };
  }, [rotatingRunning, rotatingInterval, rotatingMessages]);

  useEffect(() => {
    console.log('🔄 PresenterMode useEffect triggered', {
      loading,
      hasUser: !!user,
      userId: user?.id,
      roomCreated
    });

    // Wait for auth to finish loading
    if (loading) {
      console.log('⏳ Auth still loading...');
      return;
    }

    // Only create room once user is loaded and room hasn't been created yet
    if (!user || !user.id) {
      console.log('❌ No user found after auth loaded');
      return;
    }

    // Connect socket regardless of roomCreated status
    socketService.connect();

    // Only create room if it hasn't been created yet
    if (roomCreated) {
      console.log('✅ Room already created, skipping room creation');
      return;
    }

    const createOrGetRoom = async () => {
      try {
        setIsCreatingRoom(true);
        console.log('🏠 Creating room for user:', user.id);
        const response = await api.post('/api/rooms/create');
        console.log('✅ Room created successfully:', response.data);
        setRoom(response.data.room);
        setRoomPin(response.data.room.pin);
        setSelectedBackground(response.data.room.backgroundImage || '');
        setRoomCreated(true);
        setIsCreatingRoom(false);

        // Load setlist from room - prioritize permanent over temporary
        const setlistToLoad = response.data.room.linkedPermanentSetlist || response.data.room.temporarySetlist;

        if (setlistToLoad && setlistToLoad.items) {
          const setlistType = response.data.room.linkedPermanentSetlist ? 'permanent' : 'temporary';
          console.log(`📋 Loading ${setlistType} setlist from room:`, setlistToLoad);
          console.log('📋 First item:', setlistToLoad.items[0]);

          // Store the linked setlist name if it's a permanent setlist
          if (response.data.room.linkedPermanentSetlist && setlistToLoad.name) {
            setLinkedSetlistName(setlistToLoad.name);
          }

          const loadedItems = setlistToLoad.items.map(item => {
            if (item.type === 'song' && item.song) {
              return { type: 'song', data: item.song };
            } else if (item.type === 'image' && item.image) {
              return { type: 'image', data: item.image };
            } else if (item.type === 'bible' && item.bibleData) {
              // Reconstruct Bible passage object
              return {
                type: 'bible',
                data: {
                  _id: `bible-${item.bibleData.book}-${item.bibleData.chapter}`,
                  title: item.bibleData.title,
                  slides: item.bibleData.slides,
                  isBible: true
                }
              };
            } else if (item.type === 'blank') {
              return { type: 'blank', data: null };
            } else if (item.type === 'youtube' && item.youtubeData) {
              return {
                type: 'youtube',
                youtubeData: item.youtubeData
              };
            } else if (item.type === 'section') {
              return { type: 'section', data: { title: item.sectionTitle } };
            }
            return null;
          }).filter(Boolean);
          setSetlist(loadedItems);
          console.log(`✅ Loaded ${loadedItems.length} items from ${setlistType} setlist`);
        }

        // Join as operator and listen for join confirmation with quickSlideText
        socketService.operatorJoinRoom(user.id, response.data.room.id);

        // Listen for operator:joined event to restore quickSlideText
        socketService.onOperatorJoined((data) => {
          console.log('✅ Operator joined, restoring state:', data);
          if (data.quickSlideText) {
            setQuickSlideText(data.quickSlideText);
            console.log('⚡ Restored quick slide text from room');
          }
        });
      } catch (error) {
        console.error('❌ Error creating room:', error);
        console.error('Error details:', error.response?.data);
        setError('Failed to create room: ' + (error.response?.data?.error || error.message));
        setIsCreatingRoom(false);
      }
    };

    createOrGetRoom();
    fetchSongs();
    fetchMedia();
    fetchPresentations();

    return () => {
      console.log('🧹 Cleaning up socketService');
      socketService.disconnect();
    };
  }, [user, loading, roomCreated]);

  // Fetch public rooms when room is created
  useEffect(() => {
    if (room?.id) {
      fetchPublicRooms();
    }
  }, [room?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load setlist or song if passed via location state or URL params
  useEffect(() => {
    // Wait for room to be ready before loading setlist
    if (!room?.id) {
      console.log('⏳ Waiting for room to be ready before loading setlist...');
      return;
    }

    // Check URL query params first
    const params = new URLSearchParams(location.search);
    const urlSetlistId = params.get('setlistId');
    const urlSongId = params.get('songId');

    if (urlSetlistId) {
      loadSetlist(urlSetlistId);
    } else if (location.state?.setlistId) {
      loadSetlist(location.state.setlistId);
    } else if (urlSongId) {
      loadSong(urlSongId);
    } else if (location.state?.songId) {
      loadSong(location.state.songId);
    }
  }, [location.state, location.search, room?.id]);

  const loadSetlist = async (setlistId) => {
    try {
      if (!room?.id) {
        console.error('❌ Cannot load setlist: room not ready');
        setError('Room not ready. Please wait a moment and try again.');
        return;
      }

      // Link this setlist to the room (replaces any previous link)
      try {
        await api.post(`/api/rooms/${room.id}/link-setlist`, { setlistId });
        console.log('✅ Linked setlist to room');

        // Update local room state
        setRoom(prevRoom => ({
          ...prevRoom,
          linkedPermanentSetlist: setlistId
        }));
      } catch (linkError) {
        console.error('Error linking setlist:', linkError);
        setError('Failed to link setlist to room. Please try again.');
        return;
      }

      const response = await api.get(`/api/setlists/${setlistId}`);
      const loadedSetlist = response.data.setlist;

      // Store the linked setlist name
      setLinkedSetlistName(loadedSetlist.name);

      // Keep all items (songs, blanks, and images) with their type info
      const items = loadedSetlist.items.map(item => {
        if (item.type === 'song') {
          return { type: 'song', data: item.song };
        } else if (item.type === 'image') {
          return { type: 'image', data: item.image };
        } else if (item.type === 'blank') {
          return { type: 'blank', data: null };
        } else if (item.type === 'bible' && item.bibleData) {
          // Reconstruct Bible passage object
          return {
            type: 'bible',
            data: {
              _id: `bible-${item.bibleData.book}-${item.bibleData.chapter}`,
              title: item.bibleData.title,
              slides: item.bibleData.slides,
              isBible: true
            }
          };
        } else if (item.type === 'section') {
          return { type: 'section', data: { title: item.sectionTitle } };
        }
        return null;
      }).filter(Boolean);

      setSetlist(items);
      console.log('✅ Setlist loaded:', items.length, 'items');
    } catch (error) {
      console.error('Error loading setlist:', error);
      setError('Failed to load setlist. Please check your connection and try again.');
    }
  };

  const loadSong = async (songId) => {
    try {
      const response = await api.get(`/api/songs/${songId}`);
      const song = response.data.song;

      // Add the song to the setlist and select it
      setSetlist([{ type: 'song', data: song }]);
      setCurrentSong(song);
      setCurrentItem({ type: 'song', data: song });
      setCurrentSlideIndex(0);
      setSelectedPresentation(null); // Clear presentation when loading a song
      console.log('✅ Song loaded:', song.title);
    } catch (error) {
      console.error('Error loading song:', error);
      setError('Failed to load song. Please check your connection and try again.');
    }
  };

  // Sort songs: Hebrew first, then other languages, alphabetically within each group
  const sortSongsByLanguage = (songs) => {
    return [...songs].sort((a, b) => {
      const langA = a.originalLanguage || 'en';
      const langB = b.originalLanguage || 'en';

      // Hebrew and Arabic come first
      const isHebrewA = langA === 'he' || langA === 'ar';
      const isHebrewB = langB === 'he' || langB === 'ar';

      if (isHebrewA && !isHebrewB) return -1;
      if (!isHebrewA && isHebrewB) return 1;

      // Within same language group, sort alphabetically by title
      return a.title.localeCompare(b.title);
    });
  };

  const fetchSongs = async () => {
    setSongsLoading(true);
    try {
      const response = await api.get('/api/songs');
      const sortedSongs = sortSongsByLanguage(response.data.songs);
      setAllSongs(sortedSongs);
      setSearchResults(sortedSongs);
    } catch (error) {
      console.error('Error fetching songs:', error);
      setError('Failed to load songs. Please refresh the page.');
    } finally {
      setSongsLoading(false);
    }
  };

  const fetchPresentations = async () => {
    setPresentationsLoading(true);
    try {
      const response = await presentationAPI.getAll();
      const presentations = response.data.presentations || [];
      setAllPresentations(presentations);
    } catch (error) {
      console.error('Error fetching presentations:', error);
    } finally {
      setPresentationsLoading(false);
    }
  };

  const fetchMedia = async () => {
    setMediaLoading(true);
    try {
      const response = await api.get('/api/media');
      setMedia(response.data.media);
      setImageSearchResults(response.data.media); // Initialize with all images
    } catch (error) {
      console.error('Error fetching media:', error);
      setError('Failed to load media library. Please refresh the page.');
    } finally {
      setMediaLoading(false);
    }
  };

  const handleBackgroundChange = (backgroundUrl) => {
    setSelectedBackground(backgroundUrl);
    setShowBackgroundModal(false);

    if (room) {
      // Update room state with new background so slide changes use the correct background
      setRoom(prevRoom => ({ ...prevRoom, backgroundImage: backgroundUrl }));
      socketService.operatorUpdateBackground(room.id, backgroundUrl);
    }
  };

  const fetchPublicRooms = async () => {
    try {
      const response = await publicRoomAPI.getMyRooms();
      const rooms = response.data.publicRooms || [];
      setPublicRooms(rooms);

      // Check if any public room is linked to the current active room
      if (room?.id) {
        const linkedRoom = rooms.find(pr => pr.activeRoomId === room.id);
        if (linkedRoom) {
          setSelectedPublicRoom(linkedRoom);
          setLinkedPublicRoomName(linkedRoom.name);
        }
      }
    } catch (error) {
      console.error('Error fetching public rooms:', error);
    }
  };

  const handlePublicRoomChange = async (publicRoomId) => {
    if (!room) return;

    try {
      const response = await roomAPI.linkPublicRoom(room.id, publicRoomId || null);
      if (publicRoomId && response.data.publicRoom) {
        setSelectedPublicRoom(response.data.publicRoom);
        setLinkedPublicRoomName(response.data.publicRoom.name);
      } else {
        setSelectedPublicRoom(null);
        setLinkedPublicRoomName('');
      }

      // Clear selected song and broadcast blank when changing rooms
      setCurrentSong(null);
      setCurrentSlideIndex(0);
      setIsBlankActive(true);
      updateSlide(null, 0, displayMode, true);

      // Refresh public rooms to update their status
      fetchPublicRooms();
    } catch (error) {
      console.error('Error linking public room:', error);
      setError('Failed to link public room');
    }
  };


  // YouTube helper functions
  const extractYouTubeVideoId = useCallback((url) => {
    if (!url) return null;
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
      /^([a-zA-Z0-9_-]{11})$/
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  }, []);

  const fetchYouTubeMetadata = useCallback(async (videoId) => {
    try {
      const response = await fetch(`https://www.youtube.com/oembed?url=https://youtube.com/watch?v=${videoId}&format=json`);
      if (!response.ok) throw new Error('Video not found');
      const data = await response.json();
      return {
        videoId,
        title: data.title,
        thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
      };
    } catch (error) {
      console.error('Error fetching YouTube metadata:', error);
      return null;
    }
  }, []);

  const handleAddYoutubeVideo = useCallback(async () => {
    const videoId = extractYouTubeVideoId(youtubeUrlInput);
    if (!videoId) {
      setError(t('invalidYoutubeUrl') || 'Invalid YouTube URL');
      return;
    }
    if (youtubeVideos.some(v => v.videoId === videoId)) {
      setYoutubeUrlInput('');
      return;
    }
    setYoutubeLoading(true);
    try {
      const metadata = await fetchYouTubeMetadata(videoId);
      if (metadata) {
        setYoutubeVideos(prev => [...prev, metadata]);
        setYoutubeUrlInput('');
      } else {
        setError(t('invalidYoutubeUrl') || 'Could not load video');
      }
    } finally {
      setYoutubeLoading(false);
    }
  }, [youtubeUrlInput, youtubeVideos, extractYouTubeVideoId, fetchYouTubeMetadata, t]);

  const handleRemoveYoutubeVideo = useCallback((videoId) => {
    setYoutubeVideos(prev => prev.filter(v => v.videoId !== videoId));
  }, []);

  const handleYoutubePresent = useCallback(() => {
    if (!currentItem || currentItem.type !== 'youtube' || !room) return;
    socketService.operatorYoutubeLoad(room.id, currentItem.youtubeData.videoId, currentItem.youtubeData.title);
    setYoutubeOnDisplay(true);
    setYoutubePlaying(false);
    setYoutubeCurrentTime(0);
  }, [currentItem, room]);

  const handleYoutubePlay = useCallback(() => {
    if (!room) return;
    socketService.operatorYoutubePlay(room.id, youtubeCurrentTime);
    setYoutubePlaying(true);
  }, [room, youtubeCurrentTime]);

  const handleYoutubePause = useCallback(() => {
    if (!room) return;
    socketService.operatorYoutubePause(room.id, youtubeCurrentTime);
    setYoutubePlaying(false);
  }, [room, youtubeCurrentTime]);

  const handleYoutubeSeek = useCallback((time) => {
    if (!room) return;
    socketService.operatorYoutubeSeek(room.id, time);
    setYoutubeCurrentTime(time);
  }, [room]);

  const handleYoutubeStop = useCallback(() => {
    if (!room) return;
    socketService.operatorYoutubeStop(room.id);
    setYoutubeOnDisplay(false);
    setYoutubePlaying(false);
    setYoutubeCurrentTime(0);
  }, [room]);

  // YouTube time tracking - increment time every second while playing
  useEffect(() => {
    if (youtubePlaying && youtubeOnDisplay) {
      youtubeTimeIntervalRef.current = setInterval(() => {
        setYoutubeCurrentTime(prev => {
          const newTime = prev + 1;
          // Cap at duration if we have it
          return youtubeDuration > 0 ? Math.min(newTime, youtubeDuration) : newTime;
        });
      }, 1000);
    } else {
      if (youtubeTimeIntervalRef.current) {
        clearInterval(youtubeTimeIntervalRef.current);
        youtubeTimeIntervalRef.current = null;
      }
    }
    return () => {
      if (youtubeTimeIntervalRef.current) {
        clearInterval(youtubeTimeIntervalRef.current);
      }
    };
  }, [youtubePlaying, youtubeOnDisplay, youtubeDuration]);

  // YouTube sync interval - send current time to viewers periodically
  useEffect(() => {
    if (youtubePlaying && youtubeOnDisplay && room) {
      youtubeSyncIntervalRef.current = setInterval(() => {
        setYoutubeCurrentTime(currentTime => {
          socketService.operatorYoutubeSync(room.id, currentTime, true);
          return currentTime; // Return unchanged to avoid state mutation
        });
      }, 5000);
    } else {
      if (youtubeSyncIntervalRef.current) {
        clearInterval(youtubeSyncIntervalRef.current);
        youtubeSyncIntervalRef.current = null;
      }
    }
    return () => {
      if (youtubeSyncIntervalRef.current) {
        clearInterval(youtubeSyncIntervalRef.current);
      }
    };
  }, [youtubePlaying, youtubeOnDisplay, room]);

  const handleSearch = (query) => {
    setSearchQuery(query);

    if (activeResourcePanel === 'songs') {
      // Search songs
      if (query.trim() === '') {
        setSearchResults(allSongs); // allSongs is already sorted
      } else {
        const filtered = allSongs.filter(song => {
          const searchTerm = query.toLowerCase();

          // Check if title matches
          if (song.title.toLowerCase().includes(searchTerm)) {
            return true;
          }

          // Check if any slide content matches
          if (song.slides && Array.isArray(song.slides)) {
            return song.slides.some(slide =>
              (slide.originalText && slide.originalText.toLowerCase().includes(searchTerm)) ||
              (slide.transliteration && slide.transliteration.toLowerCase().includes(searchTerm)) ||
              (slide.translation && slide.translation.toLowerCase().includes(searchTerm)) ||
              (slide.translationOverflow && slide.translationOverflow.toLowerCase().includes(searchTerm))
            );
          }

          return false;
        });
        setSearchResults(sortSongsByLanguage(filtered));
      }
    } else if (activeResourcePanel === 'bible') {
      // Parse Bible reference (e.g., "John 3", "Genesis 12", "1 Corinthians 13", "יוחנן י״ג")
      const trimmed = query.trim();
      if (trimmed === '') {
        setSelectedBibleBook('');
        setSelectedBibleChapter('');
        return;
      }

      // Helper function to convert Hebrew numerals to Arabic numbers
      const hebrewToNumber = (hebrewStr) => {
        // Remove quotation marks used in Hebrew numerals (like י"ג or י״ג)
        const cleaned = hebrewStr.replace(/[""״׳']/g, '');

        const hebrewValues = {
          'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9,
          'י': 10, 'כ': 20, 'ך': 20, 'ל': 30, 'מ': 40, 'ם': 40, 'נ': 50, 'ן': 50,
          'ס': 60, 'ע': 70, 'פ': 80, 'ף': 80, 'צ': 90, 'ץ': 90,
          'ק': 100, 'ר': 200, 'ש': 300, 'ת': 400
        };

        let total = 0;
        for (const char of cleaned) {
          if (hebrewValues[char]) {
            total += hebrewValues[char];
          }
        }
        return total > 0 ? total : null;
      };

      // Try to match pattern: "BookName Chapter" (Arabic or Hebrew numerals)
      // Match book name and chapter number (digits or Hebrew letters)
      const matchArabic = trimmed.match(/^(.+?)\s+(\d+)$/);
      const matchHebrew = trimmed.match(/^(.+?)\s+([א-ת""״׳']+)$/);

      let bookName = null;
      let chapterNum = null;

      if (matchArabic) {
        bookName = matchArabic[1].trim().toLowerCase();
        chapterNum = matchArabic[2];
      } else if (matchHebrew) {
        bookName = matchHebrew[1].trim().toLowerCase();
        const hebrewNum = hebrewToNumber(matchHebrew[2]);
        if (hebrewNum) {
          chapterNum = hebrewNum.toString();
        }
      }

      if (bookName && chapterNum) {
        // Hebrew to English book name mapping
        const hebrewBookNames = {
          'בראשית': 'Genesis', 'שמות': 'Exodus', 'ויקרא': 'Leviticus',
          'במדבר': 'Numbers', 'דברים': 'Deuteronomy', 'יהושע': 'Joshua',
          'שופטים': 'Judges', 'שמואל א': 'I Samuel', 'שמואל ב': 'II Samuel',
          'מלכים א': 'I Kings', 'מלכים ב': 'II Kings', 'ישעיהו': 'Isaiah',
          'ישעיה': 'Isaiah', 'ירמיהו': 'Jeremiah', 'ירמיה': 'Jeremiah',
          'יחזקאל': 'Ezekiel', 'הושע': 'Hosea', 'יואל': 'Joel', 'עמוס': 'Amos',
          'עובדיה': 'Obadiah', 'יונה': 'Jonah', 'מיכה': 'Micah', 'נחום': 'Nahum',
          'חבקוק': 'Habakkuk', 'צפניה': 'Zephaniah', 'חגי': 'Haggai',
          'זכריה': 'Zechariah', 'מלאכי': 'Malachi', 'תהילים': 'Psalms',
          'תהלים': 'Psalms', 'משלי': 'Proverbs', 'איוב': 'Job',
          'שיר השירים': 'Song of Songs', 'רות': 'Ruth', 'איכה': 'Lamentations',
          'קהלת': 'Ecclesiastes', 'אסתר': 'Esther', 'דניאל': 'Daniel',
          'עזרא': 'Ezra', 'נחמיה': 'Nehemiah', 'דברי הימים א': 'I Chronicles',
          'דברי הימים ב': 'II Chronicles',
          // New Testament
          'מתי': 'Matthew', 'מרקוס': 'Mark', 'לוקס': 'Luke', 'יוחנן': 'John',
          'מעשי השליחים': 'Acts', 'מעשים': 'Acts', 'רומים': 'Romans',
          'קורינתים א': '1 Corinthians', 'קורינתים ב': '2 Corinthians',
          'גלטים': 'Galatians', 'אפסים': 'Ephesians', 'פיליפים': 'Philippians',
          'קולוסים': 'Colossians', 'תסלוניקים א': '1 Thessalonians',
          'תסלוניקים ב': '2 Thessalonians', 'טימותיאוס א': '1 Timothy',
          'טימותיאוס ב': '2 Timothy', 'טיטוס': 'Titus', 'פילימון': 'Philemon',
          'עברים': 'Hebrews', 'יעקב': 'James', 'פטרוס א': '1 Peter',
          'פטרוס ב': '2 Peter', 'יוחנן א': '1 John', 'יוחנן ב': '2 John',
          'יוחנן ג': '3 John', 'יהודה': 'Jude', 'התגלות': 'Revelation', 'חזון': 'Revelation'
        };

        // Check if bookName is Hebrew and convert to English
        let searchName = bookName;
        const hebrewMatch = Object.keys(hebrewBookNames).find(heb =>
          heb === bookName || heb.startsWith(bookName) || bookName.startsWith(heb)
        );
        if (hebrewMatch) {
          searchName = hebrewBookNames[hebrewMatch].toLowerCase();
        }

        // Find matching book with fuzzy matching
        // Try exact match first, then prefix match, then contains match
        let matchedBook = bibleBooks.find(b =>
          b.name.toLowerCase() === searchName
        );

        if (!matchedBook) {
          // Try prefix match (e.g., "gen" matches "Genesis")
          matchedBook = bibleBooks.find(b =>
            b.name.toLowerCase().startsWith(searchName)
          );
        }

        if (!matchedBook) {
          // Try contains match (e.g., "corin" matches "1 Corinthians")
          matchedBook = bibleBooks.find(b =>
            b.name.toLowerCase().includes(searchName)
          );
        }

        if (matchedBook) {
          setSelectedBibleBook(matchedBook.name);
          setSelectedBibleChapter(chapterNum);
        }
      }
    } else if (activeResourcePanel === 'presentations') {
      // Search presentations
      setPresentationSearchQuery(query);
    } else {
      // Search images
      if (query.trim() === '') {
        setImageSearchResults(media);
      } else {
        const filtered = media.filter(image =>
          image.name.toLowerCase().includes(query.toLowerCase())
        );
        setImageSearchResults(filtered);
      }
    }
  };

  const addToSetlist = (song) => {
    setSetlist([...setlist, { type: 'song', data: song }]);
    setHasUnsavedChanges(true);
    handleSearch('');
    // Keep focus on search input for quick successive additions (desktop only)
    if (!isMobile) {
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  };

  // Parse express text into slides
  const parseExpressText = (text) => {
    // Regex to match verse type tags like [Verse 1], [Chorus], [Bridge], etc.
    const verseTypePattern = /^\[(verse\s*\d*|chorus|bridge|intro|outro|pre-?chorus|hook|tag|interlude|instrumental|ending)\]$/i;

    const slideBlocks = text.split(/\n\s*\n/); // Split by blank lines

    // Use reduce to track currentVerseType across slides
    const parsedSlides = slideBlocks.reduce((acc, block) => {
      const lines = block.split('\n').map(line => line.trim()).filter(line => line);
      if (lines.length === 0) return acc;

      let contentLines = lines;

      // Check if first line is a verse type tag
      if (lines[0] && verseTypePattern.test(lines[0])) {
        // Extract verse type without brackets and update current
        acc.currentVerseType = lines[0].slice(1, -1).trim();
        // Remove the tag line from content
        contentLines = lines.slice(1);
      }

      // If no content lines after removing tag, skip this block
      if (contentLines.length === 0) return acc;

      acc.slides.push({
        originalText: contentLines[0] || '',
        transliteration: contentLines[1] || '',
        translation: contentLines[2] || '',
        translationOverflow: contentLines[3] || '',
        verseType: acc.currentVerseType // Use current (persisted) verse type
      });

      return acc;
    }, { slides: [], currentVerseType: '' }).slides;

    return parsedSlides.length > 0 ? parsedSlides : [{
      originalText: '',
      transliteration: '',
      translation: '',
      translationOverflow: '',
      verseType: ''
    }];
  };

  // Insert verse type tag at cursor position in create song textarea
  const insertVerseTag = (tag) => {
    const textarea = createSongTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = newSongExpressText;

    // Add newlines before tag if not at start and previous char isn't newline
    let prefix = '';
    if (start > 0 && text[start - 1] !== '\n') {
      prefix = '\n\n';
    } else if (start > 0 && text[start - 1] === '\n' && text[start - 2] !== '\n') {
      prefix = '\n';
    }

    const newText = text.substring(0, start) + prefix + `[${tag}]` + '\n' + text.substring(end);
    setNewSongExpressText(newText);

    // Set cursor position after the inserted tag
    setTimeout(() => {
      const newPos = start + prefix.length + tag.length + 3; // +3 for [] and \n
      textarea.focus();
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const handleCreateSong = async () => {
    if (!newSongTitle.trim()) {
      setError('Please enter a song title');
      return;
    }

    if (!newSongExpressText.trim()) {
      setError('Please enter song content');
      return;
    }

    setCreateSongLoading(true);
    setError('');

    try {
      // Parse the express text into slides
      const parsedSlides = parseExpressText(newSongExpressText);

      const response = await api.post('/api/songs', {
        title: newSongTitle,
        originalLanguage: newSongLanguage,
        slides: parsedSlides,
        tags: []
      });

      // Add the new song to the setlist
      addToSetlist(response.data.song);

      // Reset form and close modal
      setNewSongTitle('');
      setNewSongLanguage('he');
      setNewSongExpressText('');
      setShowCreateModal(false);
      setCreateModalView('choice');
    } catch (error) {
      console.error('Error creating song:', error);
      setError(error.response?.data?.error || 'Failed to create song');
    } finally {
      setCreateSongLoading(false);
    }
  };

  const addImageToSetlist = (image) => {
    setSetlist([...setlist, { type: 'image', data: image }]);
    setHasUnsavedChanges(true);
  };

  const addBlankToSetlist = () => {
    setSetlist([...setlist, { type: 'blank', data: null }]);
    setHasUnsavedChanges(true);
  };

  // Add tool items to setlist
  const addCountdownToSetlist = () => {
    setSetlist([...setlist, {
      type: 'tool',
      data: {
        toolType: 'countdown',
        targetTime: countdownTargetTime,
        message: countdownMessage
      }
    }]);
    setHasUnsavedChanges(true);
  };

  // Update countdown message in focused setlist item
  const updateFocusedCountdownMessage = () => {
    if (focusedCountdownIndex === null) return;

    // Update the setlist item with both message and target time
    setSetlist(prevSetlist => {
      const newSetlist = [...prevSetlist];
      if (newSetlist[focusedCountdownIndex]?.type === 'tool' &&
          newSetlist[focusedCountdownIndex]?.data?.toolType === 'countdown') {
        newSetlist[focusedCountdownIndex] = {
          ...newSetlist[focusedCountdownIndex],
          data: {
            ...newSetlist[focusedCountdownIndex].data,
            message: countdownMessage,
            targetTime: countdownTargetTime
          }
        };
      }
      return newSetlist;
    });
    setHasUnsavedChanges(true);

    // If this countdown is currently broadcasting, update the viewer too
    if (activeSetlistCountdownIndex === focusedCountdownIndex && room) {
      // Build toolsData - include announcement if one is active
      const updateToolsData = {
        type: 'countdown',
        countdown: {
          remaining: countdownRemaining,
          message: countdownMessage,
          running: true,
          endTime: Date.now() + (countdownRemaining * 1000)
        }
      };

      // If announcement is active, include it so viewer shows both
      if (announcementVisible && announcementText) {
        updateToolsData.type = 'announcement';
        updateToolsData.announcement = {
          text: announcementText,
          visible: true
        };
      }

      socketService.operatorUpdateSlide({
        roomId: room.id,
        roomPin: room.pin,
        backgroundImage: room.backgroundImage || '',
        songId: currentSong?.id || null,
        slideIndex: currentSlideIndex,
        displayMode: displayMode,
        isBlank: isBlankActive,
        toolsData: updateToolsData
      });
    }
  };

  const addMessagesToSetlist = () => {
    const enabledMessages = rotatingMessages
      .filter(m => m.enabled)
      .map(m => m.isPreset ? t(`presenter.${m.text}`) : m.text);
    if (enabledMessages.length === 0) return;
    setSetlist([...setlist, {
      type: 'tool',
      data: {
        toolType: 'messages',
        messages: enabledMessages,
        interval: rotatingInterval
      }
    }]);
    setHasUnsavedChanges(true);
  };

  const addSingleMessageToSetlist = (msg) => {
    const messageText = msg.isPreset ? t(`presenter.${msg.text}`) : msg.text;
    setSetlist([...setlist, {
      type: 'tool',
      data: {
        toolType: 'messages',
        messages: [messageText],
        interval: rotatingInterval
      }
    }]);
    setHasUnsavedChanges(true);
  };

  const addAnnouncementToSetlist = () => {
    if (!announcementText.trim()) return;
    setSetlist([...setlist, {
      type: 'tool',
      data: {
        toolType: 'announcement',
        text: announcementText
      }
    }]);
    setHasUnsavedChanges(true);
  };

  const removeFromSetlist = (index) => {
    const item = setlist[index];

    // If removing an active countdown, hide it and restore previous state
    if (item?.type === 'tool' && item?.data?.toolType === 'countdown' && activeSetlistCountdownIndex === index) {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      setCountdownRunning(false);
      setCountdownBroadcasting(false);
      setActiveSetlistCountdownIndex(null);
      setFocusedCountdownIndex(null);
      // Restore previous state
      if (room) {
        const savedState = preCountdownStateRef.current;
        if (savedState) {
          socketService.operatorUpdateSlide({
            roomId: room.id,
            roomPin: room.pin,
            backgroundImage: room.backgroundImage || '',
            songId: savedState.songId,
            slideIndex: savedState.slideIndex,
            displayMode: savedState.displayMode,
            isBlank: savedState.isBlank,
            imageUrl: savedState.imageUrl,
            toolsData: null
          });
          preCountdownStateRef.current = null;
        } else {
          socketService.operatorUpdateSlide({
            roomId: room.id,
            roomPin: room.pin,
            backgroundImage: room.backgroundImage || '',
            songId: currentSong?.id || null,
            slideIndex: currentSlideIndex,
            displayMode: displayMode,
            isBlank: isBlankActive,
            toolsData: null
          });
        }
      }
    }

    // If removing an active announcement, hide it first
    if (item?.type === 'tool' && item?.data?.toolType === 'announcement' && activeSetlistAnnouncementIndex === index) {
      setAnnouncementVisible(false);
      setActiveSetlistAnnouncementIndex(null);
      setFocusedAnnouncementIndex(null);
      if (announcementTimerRef.current) {
        clearTimeout(announcementTimerRef.current);
        announcementTimerRef.current = null;
      }
      // Send update to hide announcement
      if (room) {
        // Build slideData including combinedSlides for original mode
        let removeSlideData = null;
        if (currentSong?.slides?.[currentSlideIndex]) {
          const originalIndices = combinedSlides?.combinedToOriginal?.get(selectedCombinedIndex);
          removeSlideData = {
            slide: currentSong.slides[currentSlideIndex],
            title: currentSong.title,
            isBible: currentSong.isBible || false,
            isTemporary: currentSong.isTemporary || false,
            originalLanguage: currentSong.originalLanguage || 'en',
            combinedSlides: displayMode === 'original' && originalIndices?.length > 1
              ? originalIndices.map(i => currentSong.slides[i]).filter(Boolean)
              : null
          };
        }

        socketService.operatorUpdateSlide({
          roomId: room.id,
          roomPin: room.pin,
          backgroundImage: room.backgroundImage || '',
          songId: currentSong?.id || null,
          slideIndex: currentSlideIndex,
          displayMode: displayMode,
          isBlank: isBlankActive,
          slideData: removeSlideData,
          toolsData: {
            type: 'announcement',
            announcement: {
              text: '',
              visible: false
            }
          }
        });
      }
    }

    // If removing active messages, hide and restore previous state
    if (item?.type === 'tool' && item?.data?.toolType === 'messages' && activeSetlistMessagesIndex === index) {
      if (setlistMessagesIntervalRef.current) {
        clearInterval(setlistMessagesIntervalRef.current);
        setlistMessagesIntervalRef.current = null;
      }
      setlistMessagesIndexRef.current = 0;
      setActiveSetlistMessagesIndex(null);
      setFocusedMessagesIndex(null);
      // Restore previous state
      if (room) {
        const savedState = preMessagesStateRef.current;
        if (savedState) {
          socketService.operatorUpdateSlide({
            roomId: room.id,
            roomPin: room.pin,
            backgroundImage: room.backgroundImage || '',
            songId: savedState.songId,
            slideIndex: savedState.slideIndex,
            displayMode: savedState.displayMode,
            isBlank: savedState.isBlank,
            imageUrl: savedState.imageUrl,
            toolsData: null
          });
          preMessagesStateRef.current = null;
        } else {
          socketService.operatorUpdateSlide({
            roomId: room.id,
            roomPin: room.pin,
            backgroundImage: room.backgroundImage || '',
            songId: currentSong?.id || null,
            slideIndex: currentSlideIndex,
            displayMode: displayMode,
            isBlank: isBlankActive,
            toolsData: null
          });
        }
      }
    }

    // Clear focus if removing a focused item
    if (focusedCountdownIndex === index) {
      setFocusedCountdownIndex(null);
    }
    if (focusedAnnouncementIndex === index) {
      setFocusedAnnouncementIndex(null);
    }
    if (focusedMessagesIndex === index) {
      setFocusedMessagesIndex(null);
    }

    setSetlist(setlist.filter((_, i) => i !== index));
    setHasUnsavedChanges(true);
  };

  const moveSetlistItem = (fromIndex, toIndex) => {
    const newSetlist = [...setlist];
    const [movedItem] = newSetlist.splice(fromIndex, 1);
    newSetlist.splice(toIndex, 0, movedItem);
    setSetlist(newSetlist);
    setHasUnsavedChanges(true);
  };

  const handleOpenSaveModal = () => {
    const { dateStr, timeStr } = getDefaultDateTime();
    setSetlistDate(dateStr);
    setSetlistTime(timeStr);
    setShowSaveSetlistModal(true);
  };

  const handleSaveSetlist = async () => {
    if (!setlistDate.trim()) {
      setError('Please select a date');
      return;
    }
    if (!setlistTime.trim()) {
      setError('Please select a time');
      return;
    }
    if (!setlistVenue.trim()) {
      setError('Please enter a venue');
      return;
    }

    // Convert date from YYYY-MM-DD to DD/MM
    const [year, month, day] = setlistDate.split('-');
    const formattedDate = `${day}/${month}`;

    // Generate setlist name: Date(DD/MM) Time(HH:MM) Venue
    const generatedName = `${formattedDate} ${setlistTime} ${setlistVenue}`;

    setSaveSetlistLoading(true);
    try {
      const response = await api.post(`/api/rooms/${room.id}/save-setlist`, {
        name: generatedName
      });

      // Update room with linked permanent setlist
      setRoom(prevRoom => ({
        ...prevRoom,
        linkedPermanentSetlist: response.data.room.linkedPermanentSetlist
      }));

      setShowSaveSetlistModal(false);
      setSetlistDate('');
      setSetlistTime('');
      setSetlistVenue('');
      setError('');
      setHasUnsavedChanges(false);
      setLinkedSetlistName(response.data.setlist.name);
      alert(`Setlist "${response.data.setlist.name}" saved! All changes will now auto-save to this setlist.`);
    } catch (error) {
      console.error('Error saving setlist:', error);
      setError('Failed to save setlist: ' + (error.response?.data?.error || error.message));
    } finally {
      setSaveSetlistLoading(false);
    }
  };

  const handleOpenLoadModal = async () => {
    // Check for unsaved changes
    if (hasUnsavedChanges) {
      setShowUnsavedChangesModal(true);
      setPendingLoadAction(() => async () => {
        await continueLoadModal();
      });
      return;
    }

    await continueLoadModal();
  };

  const continueLoadModal = async () => {
    setShowLoadSetlistModal(true);
    setLoadSetlistLoading(true);
    try {
      const response = await api.get('/api/setlists');
      setAvailableSetlists(response.data.setlists || []);
    } catch (error) {
      console.error('Error fetching setlists:', error);
      setError('Failed to load setlists: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoadSetlistLoading(false);
    }
  };

  const handleUnsavedChangesSave = async () => {
    await handleManualSaveSetlist();
    setShowUnsavedChangesModal(false);
    if (pendingLoadAction) {
      await pendingLoadAction();
      setPendingLoadAction(null);
    }
  };

  const handleUnsavedChangesDontSave = async () => {
    setShowUnsavedChangesModal(false);
    setHasUnsavedChanges(false);
    if (pendingLoadAction) {
      await pendingLoadAction();
      setPendingLoadAction(null);
    }
  };

  const handleUnsavedChangesCancel = () => {
    setShowUnsavedChangesModal(false);
    setPendingLoadAction(null);
  };

  // Auto-reconnect to Chromecast after unexpected disconnect
  const attemptReconnect = useCallback(() => {
    if (reconnectAttempts.current >= maxReconnectAttempts) {
      console.log('❌ Max reconnection attempts reached');
      setError('Chromecast disconnected. Please reconnect manually.');
      reconnectAttempts.current = 0;
      return;
    }

    reconnectAttempts.current += 1;
    const delay = Math.min(1000 * reconnectAttempts.current, 5000); // Exponential backoff up to 5s

    console.log(`🔄 Attempting to reconnect to Chromecast (attempt ${reconnectAttempts.current}/${maxReconnectAttempts}) in ${delay}ms...`);

    setTimeout(() => {
      if (!window.chrome?.cast || !roomPin) {
        console.error('Cast SDK not available for reconnection');
        return;
      }

      const cast = window.chrome.cast;
      cast.requestSession((session) => {
        console.log('✅ Reconnected to Chromecast successfully');
        reconnectAttempts.current = 0; // Reset counter on successful reconnect
        if (setupCastSessionRef.current) {
          setupCastSessionRef.current(session);
        }
      }, (error) => {
        console.error('❌ Reconnection failed:', error);
        if (error.code !== 'cancel') {
          attemptReconnect(); // Try again
        }
      });
    }, delay);
  }, [roomPin]);

  const setupCastSessionRef = useRef(null);

  // Setup cast session with listeners
  const setupCastSession = useCallback((session) => {
    console.log('✅ Setting up cast session with listeners');
    castSessionRef.current = session;
    setCastConnected(true);
    reconnectAttempts.current = 0; // Reset reconnection counter

    // Listen for session updates (disconnection, etc.)
    session.addUpdateListener((isAlive) => {
      console.log('📡 Cast session update - isAlive:', isAlive);

      if (!isAlive) {
        console.log('⚠️ Cast session disconnected unexpectedly');
        castSessionRef.current = null;
        setCastConnected(false);

        // Attempt automatic reconnection
        attemptReconnect();
      }
    });

    // Construct the viewer URL with the room PIN
    const hostname = window.location.hostname;

    // Check if accessing via localhost - Chromecast can't access localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      console.error('❌ Cannot cast from localhost');
      setError('To use Chromecast, please access this page using your computer\'s IP address (e.g., http://192.168.1.x:3000) instead of localhost.');
      session.stop();
      return;
    }

    // Use Render.com URL for Chromecast to avoid X-Frame-Options issues
    // Render adds X-Frame-Options: SAMEORIGIN which blocks cross-origin iframe loading
    const origin = window.location.origin.includes('solucast.app')
      ? 'https://solupresenter-frontend-4rn5.onrender.com'
      : window.location.origin;
    const viewerUrl = `${origin}/viewer?pin=${roomPin}`;

    // Send custom message to receiver to load the viewer page
    const namespace = 'urn:x-cast:com.solucast.viewer';
    const message = {
      type: 'LOAD_VIEWER',
      url: viewerUrl
    };

    session.sendMessage(
      namespace,
      message,
      () => {
        console.log('✅ Successfully sent viewer URL to Chromecast');
      },
      (error) => {
        console.error('❌ Error sending message to Chromecast:', error);
        setError('Failed to load viewer on Chromecast');
      }
    );
  }, [roomPin, attemptReconnect]);

  // Store the function in ref to avoid circular dependency
  setupCastSessionRef.current = setupCastSession;

  // Show warning to operator every 9 minutes about Chromecast screensaver
  useEffect(() => {
    if (!castConnected) {
      return; // Only run when connected
    }

    console.log('⏰ Setting up 9-minute screensaver warning timer');

    const warningInterval = setInterval(() => {
      if (castConnected) {
        console.log('⚠️ Showing screensaver warning (9min)');
        setError('Chromecast screensaver may appear soon. Press any button on the Chromecast remote to keep it active.');

        // Auto-dismiss after 10 seconds
        setTimeout(() => {
          setError(null);
        }, 10000);
      }
    }, 540000); // 9 minutes (540,000ms)

    // Cleanup interval on unmount or disconnect
    return () => {
      console.log('🧹 Cleaning up screensaver warning timer');
      clearInterval(warningInterval);
    };
  }, [castConnected]);

  // Copy to clipboard helper with toast notification
  const copyToClipboard = (text, successMessage) => {
    const showSuccess = () => {
      setToast({ show: true, message: successMessage, variant: 'success' });
    };
    const showError = () => {
      setToast({ show: true, message: t('common.failedToCopy') || 'Failed to copy', variant: 'danger' });
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(showSuccess)
        .catch(() => fallbackCopy(text, showSuccess, showError));
    } else {
      fallbackCopy(text, showSuccess, showError);
    }

    function fallbackCopy(text, onSuccess, onError) {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.cssText = 'position:fixed;top:0;left:0;width:2em;height:2em;padding:0;border:none;outline:none;boxShadow:none;background:transparent';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        onSuccess();
      } catch (err) {
        onError();
      }
      document.body.removeChild(textArea);
    }
  };

  // Handle Chromecast
  const handleCast = () => {
    if (!window.chrome || !window.chrome.cast || !roomPin) {
      console.error('Cast not available or no room PIN');
      return;
    }

    const cast = window.chrome.cast;
    cast.requestSession((session) => {
      console.log('✅ Cast session established:', session);
      setupCastSession(session);
    }, (error) => {
      console.error('❌ Error launching cast:', error);
      if (error.code !== 'cancel') {
        setError('Failed to connect to Chromecast');
      }
    });
  };

  // Initialize Chromecast SDK
  useEffect(() => {
    console.log('🎬 Setting up Chromecast...');

    // Define the callback that Cast SDK will call when ready
    window['__onGCastApiAvailable'] = (isAvailable) => {
      console.log('📡 Cast API available callback fired:', isAvailable);

      if (isAvailable) {
        const cast = window.chrome.cast;

        // SoluCast Custom Receiver Application ID from Google Cast Console
        const applicationID = 'A91753A6';

        const sessionRequest = new cast.SessionRequest(applicationID);
        const apiConfig = new cast.ApiConfig(
          sessionRequest,
          (session) => {
            console.log('✅ Existing cast session found:', session);
            setupCastSession(session);
          },
          (status) => {
            console.log('📺 Cast receiver status:', status);
            if (status === cast.ReceiverAvailability.AVAILABLE) {
              console.log('✅ Chromecast device found!');
              setCastAvailable(true);
            } else {
              console.log('❌ No Chromecast device available');
              setCastAvailable(false);
            }
          }
        );

        cast.initialize(apiConfig, () => {
          console.log('✅ Cast SDK initialized successfully');
        }, (error) => {
          console.error('❌ Cast initialization error:', error);
        });
      }
    };

    // If Cast SDK is already loaded, trigger the callback manually
    if (window.chrome && window.chrome.cast && window.chrome.cast.isAvailable) {
      console.log('✅ Cast SDK already loaded, initializing now...');
      window['__onGCastApiAvailable'](true);
    } else {
      console.log('⏳ Waiting for Cast SDK to load...');
    }
  }, [setupCastSession]);

  const handleLoadSetlist = async (setlistId) => {
    setLoadSetlistLoading(true);
    try {
      const response = await api.post(`/api/rooms/${room.id}/link-setlist`, {
        setlistId
      });

      console.log('Load setlist response:', response.data);

      // Update room with linked setlist and load the setlist content
      if (response.data && response.data.room) {
        setRoom(prevRoom => ({
          ...prevRoom,
          linkedPermanentSetlist: response.data.room.linkedPermanentSetlist
        }));
      }

      if (response.data && response.data.setlist) {
        setSetlist(response.data.setlist.songs || []);
        setLinkedSetlistName(response.data.setlist.name);
        setHasUnsavedChanges(false);
      }

      setShowLoadSetlistModal(false);
      setError('');
    } catch (error) {
      console.error('Error loading setlist:', error);
      console.error('Error response:', error.response);
      setError('Failed to load setlist: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoadSetlistLoading(false);
    }
  };

  const handleDragStart = (e, index) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', index);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    const dragIndex = parseInt(e.dataTransfer.getData('text/html'));
    if (dragIndex !== dropIndex) {
      moveSetlistItem(dragIndex, dropIndex);
    }
  };

  // Touch-based drag and drop for mobile
  const [touchDragIndex, setTouchDragIndex] = useState(null);
  const [touchDragReady, setTouchDragReady] = useState(false);
  const [touchHoldingIndex, setTouchHoldingIndex] = useState(null);
  const touchStartPos = useRef(null);
  const touchHoldTimer = useRef(null);
  const setlistContainerRef = useRef(null);
  const TOUCH_HOLD_DELAY = 500; // ms to hold before drag is enabled
  const TOUCH_MOVE_THRESHOLD = 10; // pixels of movement allowed during hold

  const handleTouchStart = (e, index) => {
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    setTouchHoldingIndex(index);

    // Start hold timer
    touchHoldTimer.current = setTimeout(() => {
      setTouchDragIndex(index);
      setTouchDragReady(true);
      setTouchHoldingIndex(null);
      // Vibrate if supported to indicate drag mode activated
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, TOUCH_HOLD_DELAY);
  };

  const handleTouchMove = (e, index) => {
    const touch = e.touches[0];
    const currentY = touch.clientY;

    // If still in hold phase, check if moved too much
    if (touchHoldingIndex !== null && touchStartPos.current) {
      const dx = Math.abs(touch.clientX - touchStartPos.current.x);
      const dy = Math.abs(touch.clientY - touchStartPos.current.y);
      if (dx > TOUCH_MOVE_THRESHOLD || dy > TOUCH_MOVE_THRESHOLD) {
        // Moved too much, cancel hold
        clearTimeout(touchHoldTimer.current);
        setTouchHoldingIndex(null);
        return;
      }
    }

    // If drag not ready, allow normal scrolling
    if (!touchDragReady || touchDragIndex === null) return;

    e.preventDefault();

    const container = setlistContainerRef.current;
    if (!container) return;

    const items = container.querySelectorAll('[data-setlist-item]');
    let targetIndex = touchDragIndex;

    items.forEach((item, idx) => {
      const rect = item.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      if (currentY < midY && idx < touchDragIndex) {
        targetIndex = idx;
      } else if (currentY > midY && idx > touchDragIndex) {
        targetIndex = idx;
      }
    });

    if (targetIndex !== touchDragIndex) {
      moveSetlistItem(touchDragIndex, targetIndex);
      setTouchDragIndex(targetIndex);
    }
  };

  const handleTouchEnd = () => {
    clearTimeout(touchHoldTimer.current);
    setTouchDragIndex(null);
    setTouchDragReady(false);
    setTouchHoldingIndex(null);
    touchStartPos.current = null;
  };

  const selectItem = (item, setlistIndex = null) => {
    setCurrentItem(item);
    setIsBlankActive(false);
    setSelectedFromSetlist(true); // Mark as selected from setlist
    setSelectedSetlistIndex(setlistIndex); // Track which setlist index is selected

    if (item.type === 'song' || item.type === 'bible') {
      setCurrentSong(item.data);
      setCurrentSlideIndex(null); // Don't highlight any slide until user clicks
      setSelectedPresentation(null); // Clear presentation when selecting a song
      // Don't auto-transmit - wait for user to click on a slide
      // updateSlide will be called when user clicks selectSlide()
    } else if (item.type === 'image') {
      setCurrentSong(null);
      setCurrentSlideIndex(null); // Don't highlight until user clicks
      // Don't auto-transmit - wait for user to click on the image in preview
    } else if (item.type === 'presentation') {
      setCurrentSong(null);
      setSelectedPresentation(item.data);
      setSelectedPresentationSlideIndex(0);
      setActiveResourcePanel('presentations');
    } else if (item.type === 'blank') {
      setCurrentSong(null);
      setIsBlankActive(true);
      updateSlide(null, 0, displayMode, true);
    } else if (item.type === 'tool') {
      const toolData = item.data;
      if (toolData.toolType === 'countdown') {
        // Don't change selection - countdown is an overlay
        // Just set the values and switch to tools tab
        setCountdownTargetTime(toolData.targetTime);
        setCountdownMessage(toolData.message || '');
        setActiveResourcePanel('tools');
        setActiveToolsTab('countdown');
        // Return early - don't change currentItem or selectedSetlistIndex
        return 'countdown';
      } else if (toolData.toolType === 'messages') {
        setCurrentSong(null);
        // Set up and start rotating messages
        // This would need the actual message objects, for now just switch to tab
        setActiveResourcePanel('tools');
        setActiveToolsTab('messages');
      } else if (toolData.toolType === 'announcement') {
        // Don't change selection - announcement is an overlay
        // Just focus the announcement item and switch to tools tab
        setAnnouncementText(toolData.text);
        setActiveResourcePanel('tools');
        setActiveToolsTab('announce');
        // Return early - don't change currentItem or selectedSetlistIndex
        return 'announcement';
      }
    } else if (item.type === 'youtube') {
      setCurrentSong(null);
      setSelectedPresentation(null);
      // YouTube item selected
    }
  };

  const selectSong = async (song) => {
    // Song data now includes slides from initial fetch - no API call needed!
    // Check if song has slides (new optimized path)
    if (song.slides && song.slides.length > 0) {
      selectItem({ type: 'song', data: song });
      setSelectedFromSetlist(false); // Override - selected from database
      setSelectedSetlistIndex(null);
    } else {
      // Fallback: fetch full song details if slides are missing (backward compatibility)
      try {
        const response = await api.get(`/api/songs/${song.id}`);
        const fullSong = response.data.song;
        selectItem({ type: 'song', data: fullSong });
        setSelectedFromSetlist(false); // Override - selected from database
        setSelectedSetlistIndex(null);
      } catch (error) {
        console.error('Error fetching song details:', error);
        setError('Failed to load song details');
      }
    }
  };

  const selectSlide = (index) => {
    // Use startTransition for non-urgent state updates to keep UI responsive
    setCurrentSlideIndex(index);
    setIsBlankActive(false); // Turn off blank when selecting a slide

    // Defer socket call to not block UI render (optimistic update)
    if (currentSong) {
      setTimeout(() => {
        updateSlide(currentSong, index, displayMode, false);
      }, 0);
    }
  };

  const updateSlide = (song, slideIndex, mode, isBlank, combinedIndices = null) => {
    if (!room) {
      console.error('❌ Cannot update slide: room is null');
      return;
    }

    // Stop non-overlay tools when broadcasting a slide (keep announcements as they're overlays)
    stopNonOverlayTools();

    // Send slide data directly to avoid backend DB queries
    const payload = {
      roomId: room.id,
      roomPin: room.pin,  // Send PIN to avoid DB lookup
      backgroundImage: room.backgroundImage || '',  // Send background to avoid DB lookup
      songId: (song?.isTemporary || song?.isBible) ? null : (song?.id || null),
      slideIndex,
      displayMode: mode,
      isBlank
    };

    // Send slide data for all types to avoid backend DB query
    if (song && song.slides && song.slides[slideIndex]) {
      payload.slideData = {
        slide: song.slides[slideIndex],
        title: song.title,
        isBible: song.isBible || false,
        isTemporary: song.isTemporary || false,
        originalLanguage: song.originalLanguage || 'en',
        // Include combined slides if provided (for original-only mode with paired slides)
        combinedSlides: combinedIndices && combinedIndices.length > 1
          ? combinedIndices.map(i => song.slides[i]).filter(Boolean)
          : null
      };

      // Include next slide data for stage monitors
      const nextIndex = slideIndex + 1;
      if (song.slides[nextIndex]) {
        payload.nextSlideData = {
          slide: song.slides[nextIndex],
          title: song.title,
          originalLanguage: song.originalLanguage || 'en'
        };
      }
    }

    // Include announcement overlay if one is active (announcements persist across slide changes)
    if (announcementVisible && announcementText) {
      payload.toolsData = {
        type: 'announcement',
        announcement: {
          text: announcementText,
          visible: true
        }
      };
    }

    socketService.operatorUpdateSlide(payload);
  };

  const updateImageSlide = (imageData) => {
    if (!room) {
      console.error('❌ Cannot update image slide: room is null');
      return;
    }

    // Stop non-overlay tools when broadcasting an image (keep announcements as they're overlays)
    stopNonOverlayTools();

    const payload = {
      roomId: room.id,
      roomPin: room.pin,
      backgroundImage: room.backgroundImage || '',
      songId: null,
      slideIndex: 0,
      displayMode: displayMode,
      isBlank: false,
      imageUrl: imageData?.url || null
    };

    // Include announcement overlay if one is active (announcements persist across slide changes)
    if (announcementVisible && announcementText) {
      payload.toolsData = {
        type: 'announcement',
        announcement: {
          text: announcementText,
          visible: true
        }
      };
    }

    socketService.operatorUpdateSlide(payload);
  };

  const toggleDisplayMode = () => {
    const newMode = displayMode === 'bilingual' ? 'original' : 'bilingual';
    setDisplayMode(newMode);
    if (currentSong) {
      updateSlide(currentSong, currentSlideIndex, newMode, false);
    }
  };

  // Helper function to get border color based on verse type (for slide previews)
  const getSlidePreviewBorderColor = (verseType, isSelected) => {
    if (isSelected) return '#00d4ff';
    switch(verseType) {
      case 'Intro': return 'rgba(255,255,255,0.4)';
      case 'Verse1': return 'rgba(255,193,7,0.6)';
      case 'Verse2': return 'rgba(255,167,38,0.6)';
      case 'Verse3': return 'rgba(255,213,79,0.6)';
      case 'Verse4': return 'rgba(251,192,45,0.6)';
      case 'PreChorus': return 'rgba(233,30,99,0.5)';
      case 'Chorus': return 'rgba(3,169,244,0.6)';
      case 'Bridge': return 'rgba(156,39,176,0.5)';
      case 'Instrumental': return 'rgba(76,175,80,0.5)';
      case 'Outro': return 'rgba(255,152,0,0.6)';
      case 'Tag': return 'rgba(103,58,183,0.5)';
      default: return 'rgba(255,255,255,0.3)';
    }
  };

  const getSlidePreviewBackgroundColor = (verseType, isSelected) => {
    if (isSelected) return 'rgba(0,212,255,0.15)';
    switch(verseType) {
      case 'Intro': return 'rgba(255,255,255,0.08)';
      case 'Verse1': return 'rgba(255,193,7,0.15)';
      case 'Verse2': return 'rgba(255,167,38,0.15)';
      case 'Verse3': return 'rgba(255,213,79,0.15)';
      case 'Verse4': return 'rgba(251,192,45,0.15)';
      case 'PreChorus': return 'rgba(233,30,99,0.12)';
      case 'Chorus': return 'rgba(3,169,244,0.15)';
      case 'Bridge': return 'rgba(156,39,176,0.12)';
      case 'Instrumental': return 'rgba(76,175,80,0.12)';
      case 'Outro': return 'rgba(255,152,0,0.15)';
      case 'Tag': return 'rgba(103,58,183,0.12)';
      default: return 'transparent';
    }
  };

  // Select a combined slide (for original-only mode)
  const selectCombinedSlide = (combinedIndex) => {
    if (!combinedSlides || !currentSong) return;

    setSelectedCombinedIndex(combinedIndex);
    setIsBlankActive(false);

    const originalIndices = combinedSlides.combinedToOriginal.get(combinedIndex);
    const firstOriginalIndex = originalIndices[0];

    // Update currentSlideIndex to the first slide of the pair
    setCurrentSlideIndex(firstOriginalIndex);

    // Broadcast with combined slide data
    setTimeout(() => {
      updateSlide(currentSong, firstOriginalIndex, displayMode, false, originalIndices);
    }, 0);
  };

  const toggleBlankSlide = useCallback(() => {
    const newBlankState = !isBlankActive;
    setIsBlankActive(newBlankState);

    if (newBlankState) {
      // Turn blank on
      updateSlide(null, 0, displayMode, true);
    } else {
      // Turn blank off - show current slide if there's a song
      if (currentSong) {
        updateSlide(currentSong, currentSlideIndex, displayMode, false);
      }
    }
  }, [isBlankActive, currentSong, currentSlideIndex, displayMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Parse quick slide text and create/update slide
  const parseAndBroadcastQuickSlide = useCallback((slideIndexToBroadcast) => {
    const currentText = getCurrentQuickSlideText();
    if (!currentText.trim()) {
      console.log('⚡ Quick Slide: Empty text, skipping');
      return;
    }

    // Split text into blocks (slides) separated by empty lines
    // Filter out empty blocks (e.g., when text ends with \n\n)
    const blocks = currentText.split(/\n\s*\n/).filter(block => block.trim());

    console.log('⚡ Quick Slide: Found', blocks.length, 'slides');

    // Create slides array from all blocks for navigation
    const allSlides = blocks.map(block => {
      const blockLines = block.split('\n');
      return {
        originalText: blockLines[0] || '',
        transliteration: blockLines[1] || '',
        translation: blockLines[2] || '',
        translationOverflow: blockLines[3] || '',
        verseType: 'chorus'
      };
    });

    // Create a temporary song with all slides (not added to setlist)
    const quickSong = {
      _id: 'quick-live',
      title: 'Quick Slide',
      isTemporary: true,
      slides: allSlides
    };

    // Broadcast directly without adding to setlist
    if (slideIndexToBroadcast !== undefined) {
      const indexToBroadcast = Math.min(slideIndexToBroadcast, allSlides.length - 1);
      console.log('⚡ Quick Slide: Broadcasting slide', indexToBroadcast + 1, 'to viewers!');
      setCurrentSong(quickSong);
      setCurrentItem({ type: 'song', data: quickSong });
      setCurrentSlideIndex(indexToBroadcast);
      setIsBlankActive(false);
      setSelectedPresentation(null); // Clear presentation when broadcasting quick slide
      updateSlide(quickSong, indexToBroadcast, displayMode, false);
      setBroadcastSlideIndex(indexToBroadcast);
    }
  }, [displayMode, room]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize textarea when modal opens
  useEffect(() => {
    if (showQuickSlideModal && quickSlideTextareaRef.current) {
      quickSlideTextareaRef.current.value = quickSlideText;
      // Initialize slide count based on persisted text
      if (!quickSlideText.trim()) {
        setSlideCount(0);
      } else {
        // Filter out empty blocks (e.g., when text ends with \n\n)
        const blocks = quickSlideText.split(/\n\s*\n/).filter(block => block.trim());
        setSlideCount(blocks.length);
      }
    }
  }, [showQuickSlideModal, quickSlideText]);

  // No auto-broadcast - user must click slide buttons to broadcast
  // Get current text from textarea ref
  const getCurrentQuickSlideText = () => {
    return quickSlideTextareaRef.current?.value || '';
  };

  // Open Quick Slide modal and load existing slides into preview
  const openQuickSlideModal = () => {
    setShowQuickSlideModal(true);

    // If there's existing quick slide text, load it into the slide preview
    if (quickSlideText.trim()) {
      const blocks = quickSlideText.split(/\n\s*\n/).filter(block => block.trim());
      if (blocks.length > 0) {
        const allSlides = blocks.map(block => {
          const blockLines = block.split('\n');
          return {
            originalText: blockLines[0] || '',
            transliteration: blockLines[1] || '',
            translation: blockLines[2] || '',
            translationOverflow: blockLines[3] || '',
            verseType: 'chorus'
          };
        });

        const quickSong = {
          _id: 'quick-live',
          title: 'Quick Slide',
          isTemporary: true,
          slides: allSlides
        };

        // Load into preview without selecting any slide (no highlight until user clicks)
        setCurrentSong(quickSong);
        setCurrentItem({ type: 'song', data: quickSong });
        setCurrentSlideIndex(-1); // -1 means no slide selected
        setSelectedPresentation(null); // Clear presentation when loading quick slide
      }
    }
  };

  // Navigate to next slide
  const nextSlide = useCallback(() => {
    if (isBlankActive) return;

    // If in original mode with combined slides, navigate by combined index
    if (displayMode === 'original' && combinedSlides && currentSong) {
      if (selectedCombinedIndex < combinedSlides.combinedSlides.length - 1) {
        selectCombinedSlide(selectedCombinedIndex + 1);
        return;
      }
      // Fall through to next item in setlist
    } else if (currentSong && currentSlideIndex < currentSong.slides.length - 1) {
      // Normal single-slide navigation
      const newIndex = currentSlideIndex + 1;
      setCurrentSlideIndex(newIndex);
      updateSlide(currentSong, newIndex, displayMode, false);
      return;
    }

    // Move to next item in setlist
    if (!currentItem) return;

    const currentItemIndex = setlist.findIndex(item => {
      if (item.type === 'song' && currentItem.type === 'song') {
        return item.data?.id === currentItem.data?.id;
      }
      return item === currentItem;
    });

    if (currentItemIndex !== -1 && currentItemIndex < setlist.length - 1) {
      const nextItem = setlist[currentItemIndex + 1];
      selectItem(nextItem);
    }
  }, [currentSong, currentItem, currentSlideIndex, displayMode, isBlankActive, setlist, combinedSlides, selectedCombinedIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Navigate to previous slide
  const previousSlide = useCallback(() => {
    if (isBlankActive) return;

    // If in original mode with combined slides, navigate by combined index
    if (displayMode === 'original' && combinedSlides && currentSong) {
      if (selectedCombinedIndex > 0) {
        selectCombinedSlide(selectedCombinedIndex - 1);
        return;
      }
      // Fall through to previous item in setlist
    } else if (currentSong && currentSlideIndex > 0) {
      // Normal single-slide navigation
      const newIndex = currentSlideIndex - 1;
      setCurrentSlideIndex(newIndex);
      updateSlide(currentSong, newIndex, displayMode, false);
      return;
    }

    // Move to previous item in setlist
    if (!currentItem) return;

    const currentItemIndex = setlist.findIndex(item => {
      if (item.type === 'song' && currentItem.type === 'song') {
        return item.data?.id === currentItem.data?.id;
      }
      return item === currentItem;
    });

    if (currentItemIndex > 0) {
      const prevItem = setlist[currentItemIndex - 1];
      selectItem(prevItem);

      // If previous item is a song, go to its last slide
      if (prevItem.type === 'song' && prevItem.data?.slides) {
        const lastSlideIndex = prevItem.data.slides.length - 1;
        setCurrentSlideIndex(lastSlideIndex);
      }
    }
  }, [currentSong, currentItem, currentSlideIndex, displayMode, isBlankActive, setlist, combinedSlides, selectedCombinedIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Navigate to next song/item
  const nextSong = useCallback(() => {
    if (!currentItem) return;

    const currentItemIndex = setlist.findIndex(item => {
      if (item.type === 'song' && currentItem.type === 'song') {
        return item.data?.id === currentItem.data?.id;
      }
      return item === currentItem;
    });

    if (currentItemIndex !== -1 && currentItemIndex < setlist.length - 1) {
      const nextItem = setlist[currentItemIndex + 1];
      selectItem(nextItem);
    }
  }, [currentItem, setlist]); // eslint-disable-line react-hooks/exhaustive-deps

  // Navigate to previous song/item
  const previousSong = useCallback(() => {
    if (!currentItem) return;

    const currentItemIndex = setlist.findIndex(item => {
      if (item.type === 'song' && currentItem.type === 'song') {
        return item.data?.id === currentItem.data?.id;
      }
      return item === currentItem;
    });

    if (currentItemIndex > 0) {
      const prevItem = setlist[currentItemIndex - 1];
      selectItem(prevItem);
    }
  }, [currentItem, setlist]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Ignore if user is typing in an input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      switch(e.key) {
        case 'ArrowRight':
          e.preventDefault();
          nextSlide();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          previousSlide();
          break;
        case 'ArrowDown':
          e.preventDefault();
          nextSong();
          break;
        case 'ArrowUp':
          e.preventDefault();
          previousSong();
          break;
        case ' ': // Spacebar
        case 'b':
        case 'B':
          e.preventDefault();
          toggleBlankSlide();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [nextSlide, previousSlide, nextSong, previousSong, toggleBlankSlide]);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(-45deg, #0a0a0a, #1a1a2e, #2d2d2d, #404040, #2a2a3e, #1a1a1a)',
      backgroundSize: '400% 400%',
      animation: 'gradientShift 15s ease infinite',
      padding: '20px',
      paddingBottom: '20px',
      display: 'flex',
      justifyContent: 'center'
    }}>
      <style>{`
        @keyframes gradientShift {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
      `}</style>
      <div style={{
        width: '100%',
        maxWidth: '900px',
        overflow: 'visible'
      }}>
      {/* Back Button and Room PIN Display at Top */}
      <div style={{
        backgroundColor: 'transparent',
        borderRadius: '15px',
        marginBottom: '20px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'visible'
      }}>
        {/* Header Row: Gear - Broadcast Dropdown - Logo */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          maxWidth: '100%',
          overflow: 'visible'
        }}>
          <div ref={gearMenuRef} style={{ position: 'relative', width: '50px', flexShrink: 0, overflow: 'visible' }}>
            <Button
              variant="link"
              onClick={() => setShowGearMenu(!showGearMenu)}
              style={{
                padding: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white'
              }}
              title="Menu"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z"/>
              </svg>
            </Button>

            {/* Gear Dropdown Menu */}
            {showGearMenu && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: i18n.language === 'he' ? 'auto' : '0',
                right: i18n.language === 'he' ? '0' : 'auto',
                marginTop: '8px',
                backgroundColor: 'rgba(30, 30, 40, 0.95)',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                backdropFilter: 'blur(10px)',
                overflow: 'hidden',
                zIndex: 1000,
                minWidth: '160px'
              }}>
                <div
                  onClick={() => { navigate('/dashboard'); setShowGearMenu(false); }}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    color: 'white',
                    transition: 'background-color 0.2s',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                    <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
                  </svg>
                  <span style={{ fontWeight: '500' }}>{t('presenter.dashboard')}</span>
                </div>
                <div
                  onClick={() => { navigate('/'); setShowGearMenu(false); }}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    color: 'white',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
                  </svg>
                  <span style={{ fontWeight: '500' }}>{t('presenter.home')}</span>
                </div>
              </div>
            )}
          </div>

          {/* Room Selection Dropdown - Center */}
          {roomPin ? (
            <div ref={roomSelectorRef} style={{ position: 'relative', flex: '1 1 auto', maxWidth: '240px', margin: '0 10px' }}>
              <div
                onClick={() => setShowRoomSelector(!showRoomSelector)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  background: 'transparent',
                  border: selectedPublicRoom ? '2px solid #28a745' : '2px solid #0d6efd',
                }}
              >
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: selectedPublicRoom ? '#28a745' : '#0d6efd',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                    {selectedPublicRoom ? (
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                    ) : (
                      <path d="M12 2C9.24 2 7 4.24 7 7v5H6c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-8c0-1.1-.9-2-2-2h-1V7c0-2.76-2.24-5-5-5zm0 2c1.66 0 3 1.34 3 3v5H9V7c0-1.66 1.34-3 3-3z"/>
                    )}
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.75rem', color: 'white' }}>{t('presenter.broadcastingTo')}</div>
                  <div style={{ fontWeight: '600', color: selectedPublicRoom ? '#28a745' : '#0d6efd', fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {selectedPublicRoom ? selectedPublicRoom.name : `${t('presenter.privateRoom')} (${roomPin})`}
                  </div>
                </div>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white" style={{ transform: showRoomSelector ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                  <path d="M7 10l5 5 5-5z"/>
                </svg>
              </div>

              {/* Dropdown Menu */}
              {showRoomSelector && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: '4px',
                  background: 'white',
                  borderRadius: '10px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                  zIndex: 1000,
                  overflow: 'hidden'
                }}>
                  {/* Private Room Option */}
                  <div
                    onClick={() => { handlePublicRoomChange(null); setShowRoomSelector(false); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '12px 16px',
                      cursor: 'pointer',
                      background: !selectedPublicRoom ? '#f0f7ff' : 'white',
                      borderLeft: !selectedPublicRoom ? '3px solid #0d6efd' : '3px solid transparent'
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill={!selectedPublicRoom ? '#0d6efd' : '#666'}>
                      <path d="M12 2C9.24 2 7 4.24 7 7v5H6c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-8c0-1.1-.9-2-2-2h-1V7c0-2.76-2.24-5-5-5zm0 2c1.66 0 3 1.34 3 3v5H9V7c0-1.66 1.34-3 3-3z"/>
                    </svg>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '500', color: !selectedPublicRoom ? '#0d6efd' : '#333' }}>{t('presenter.privateRoom')}</div>
                      <div style={{ fontSize: '0.8rem', color: '#666' }}>{t('presenter.pin')}: {roomPin}</div>
                    </div>
                    {!selectedPublicRoom && <Badge bg="primary" style={{ fontSize: '0.65rem' }}>{t('presenter.active')}</Badge>}
                  </div>

                  {/* Public Room Options */}
                  {publicRooms.map((pr) => (
                    <div
                      key={pr.id}
                      onClick={() => { handlePublicRoomChange(pr.id); setShowRoomSelector(false); }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '12px 16px',
                        cursor: 'pointer',
                        background: selectedPublicRoom?.id === pr.id ? '#f0fff4' : 'white',
                        borderLeft: selectedPublicRoom?.id === pr.id ? '3px solid #28a745' : '3px solid transparent'
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill={selectedPublicRoom?.id === pr.id ? '#28a745' : '#666'}>
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                      </svg>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '500', color: selectedPublicRoom?.id === pr.id ? '#28a745' : '#333' }}>{pr.name}</div>
                        <div style={{ fontSize: '0.8rem', color: '#666' }}>{t('presenter.publicRoom')}</div>
                      </div>
                      {selectedPublicRoom?.id === pr.id && <Badge bg="success" style={{ fontSize: '0.65rem' }}>{t('presenter.active')}</Badge>}
                    </div>
                  ))}

                  {/* Add more rooms link */}
                  <div
                    onClick={() => { navigate('/settings'); setShowRoomSelector(false); }}
                    style={{
                      padding: '10px 16px',
                      borderTop: '1px solid #eee',
                      textAlign: 'center',
                      cursor: 'pointer',
                      color: '#0d6efd',
                      fontSize: '0.85rem'
                    }}
                  >
                    {t('presenter.manageRooms')}
                  </div>
                </div>
              )}
            </div>
          ) : isCreatingRoom ? (
            <div style={{ flex: '1 1 auto', maxWidth: '240px', margin: '0 10px', textAlign: 'center' }}>
              <div className="spinner-border spinner-border-sm text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : (
            <div style={{ flex: '1 1 auto', maxWidth: '240px', margin: '0 10px' }}></div>
          )}

          <div style={{ width: '50px', flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
            <img src="/new_cast_logo.png" alt="SoluCast Logo" style={{ maxWidth: '40px', height: 'auto' }} />
          </div>
        </div>

        {isCreatingRoom && !roomPin && (
          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.9rem', color: 'white' }}>
              {t('presenter.creatingRoom')}
            </div>
          </div>
        )}

        {roomPin && (
          <div style={{ marginTop: '20px' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'center' }}>
              <Dropdown>
                <Dropdown.Toggle
                  variant="primary"
                  style={{
                    padding: '0.375rem 0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                  title={t('presenter.share')}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/>
                  </svg>
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  <Dropdown.Item onClick={() => {
                    const viewerUrl = selectedPublicRoom?.slug
                      ? `${window.location.origin}/viewer?room=${selectedPublicRoom.slug}`
                      : `${window.location.origin}/viewer?pin=${roomPin}`;
                    copyToClipboard(viewerUrl, t('presenter.viewerUrlCopied') || 'Viewer URL copied!');
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                        <line x1="8" y1="21" x2="16" y2="21"/>
                        <line x1="12" y1="17" x2="12" y2="21"/>
                      </svg>
                      {t('presenter.copyViewerUrl') || 'Copy Viewer URL'}
                    </div>
                  </Dropdown.Item>
                  <Dropdown.Item onClick={() => {
                    const obsUrl = selectedPublicRoom?.slug
                      ? `${window.location.origin}/obs-overlay?room=${selectedPublicRoom.slug}`
                      : `${window.location.origin}/obs-overlay?pin=${roomPin}`;
                    copyToClipboard(obsUrl, t('presenter.obsUrlCopied') || 'OBS Overlay URL copied!');
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                        <path d="M2 17l10 5 10-5"/>
                        <path d="M2 12l10 5 10-5"/>
                      </svg>
                      {t('presenter.copyObsUrl') || 'Copy OBS Lower-Thirds URL'}
                    </div>
                  </Dropdown.Item>
                  <Dropdown.Divider />
                  <Dropdown.Item onClick={() => {
                    const shareUrl = selectedPublicRoom?.slug
                      ? `${window.location.origin}/viewer?room=${selectedPublicRoom.slug}`
                      : `${window.location.origin}/viewer?pin=${roomPin}`;
                    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareUrl)}`;
                    window.open(whatsappUrl, '_blank');
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="#25D366">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                      {t('presenter.shareOnWhatsApp') || 'Share on WhatsApp'}
                    </div>
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
              {/* Present to Display Button - only show if Presentation API is supported */}
              {/* Note: Chromecast also appears in the Presentation API picker when available */}
              {presentationSupported && (
                <Button
                  variant={presentationConnection ? "danger" : "info"}
                  onClick={() => {
                    if (presentationConnection) {
                      stopPresentation();
                    } else {
                      startPresentation();
                    }
                  }}
                  title={presentationConnection
                    ? (t('presenter.stopPresentation') || 'Stop presentation')
                    : (t('presenter.presentToDisplay') || 'Present to connected display')}
                  style={{
                    padding: '0.375rem 0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                    <line x1="8" y1="21" x2="16" y2="21"/>
                    <line x1="12" y1="17" x2="12" y2="21"/>
                  </svg>
                  {presentationConnection && (
                    <span style={{ fontSize: '0.7rem', fontWeight: 'bold' }}>LIVE</span>
                  )}
                </Button>
              )}
              {/* Viewer Theme Selector */}
              <ThemeSelector roomId={room?.id || room?._id} />
            </div>
          </div>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <Alert
          variant="danger"
          dismissible
          onClose={() => setError('')}
          style={{
            marginBottom: '20px',
            borderRadius: '10px'
          }}
        >
          {error}
        </Alert>
      )}

      {/* Songs/Images and Setlist Side-by-Side */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
        gap: '12px',
        marginBottom: '12px'
      }}>
        {/* Song Search Section */}
        <div style={{
          backgroundColor: 'transparent',
          borderRadius: '15px',
          overflow: 'hidden',
          paddingRight: isMobile ? '0' : '12px'
        }}>
          <div
            style={{
              padding: '8px 12px',
              backgroundColor: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              flexWrap: 'wrap'
            }}
          >
            {/* Resource panel tabs with icons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: '0 0 auto' }}>
              <Button
                variant={activeResourcePanel === 'songs' ? 'primary' : 'outline-light'}
                size="sm"
                onClick={() => switchResourcePanel('songs')}
                title={t('presenter.songs')}
                style={{ padding: '6px 10px' }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M9 13c0 1.105-1.12 2-2.5 2S4 14.105 4 13s1.12-2 2.5-2 2.5.895 2.5 2z"/>
                  <path fillRule="evenodd" d="M9 3v10H8V3h1z"/>
                  <path d="M8 2.82a1 1 0 0 1 .804-.98l3-.6A1 1 0 0 1 13 2.22V4L8 5V2.82z"/>
                </svg>
              </Button>
              <Button
                variant={activeResourcePanel === 'media' ? 'primary' : 'outline-light'}
                size="sm"
                onClick={() => switchResourcePanel('media')}
                title={t('presenter.media', 'Media')}
                style={{ padding: '6px 10px' }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M0 1a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H1a1 1 0 0 1-1-1V1zm4 0v6h8V1H4zm8 8H4v6h8V9zM1 1v2h2V1H1zm2 3H1v2h2V4zM1 7v2h2V7H1zm2 3H1v2h2v-2zm-2 3v2h2v-2H1zM15 1h-2v2h2V1zm-2 3v2h2V4h-2zm2 3h-2v2h2V7zm-2 3v2h2v-2h-2zm2 3h-2v2h2v-2z"/>
                </svg>
              </Button>
              <Button
                variant={activeResourcePanel === 'bible' ? 'primary' : 'outline-light'}
                size="sm"
                onClick={() => switchResourcePanel('bible')}
                title={t('presenter.bible')}
                style={{ padding: '6px 10px' }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M1 2.828c.885-.37 2.154-.769 3.388-.893 1.33-.134 2.458.063 3.112.752v9.746c-.935-.53-2.12-.603-3.213-.493-1.18.12-2.37.461-3.287.811zm7.5-.141c.654-.689 1.782-.886 3.112-.752 1.234.124 2.503.523 3.388.893v9.923c-.918-.35-2.107-.692-3.287-.81-1.094-.111-2.278-.039-3.213.492zM8 1.783C7.015.936 5.587.81 4.287.94c-1.514.153-3.042.672-3.994 1.105A.5.5 0 0 0 0 2.5v11a.5.5 0 0 0 .707.455c.882-.4 2.303-.881 3.68-1.02 1.409-.142 2.59.087 3.223.877a.5.5 0 0 0 .78 0c.633-.79 1.814-1.019 3.222-.877 1.378.139 2.8.62 3.681 1.02A.5.5 0 0 0 16 13.5v-11a.5.5 0 0 0-.293-.455c-.952-.433-2.48-.952-3.994-1.105C10.413.809 8.985.936 8 1.783"/>
                </svg>
              </Button>
              <Button
                variant={activeResourcePanel === 'presentations' ? 'primary' : 'outline-light'}
                size="sm"
                onClick={() => switchResourcePanel('presentations')}
                title={t('presenter.presentations', 'Presentations')}
                style={{ padding: '6px 10px' }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 0a.5.5 0 0 1 .473.337L9.046 2H14a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-1.85l1.323 3.837a.5.5 0 1 1-.946.326L11.092 11H8.5v3a.5.5 0 0 1-1 0v-3H4.908l-1.435 4.163a.5.5 0 1 1-.946-.326L3.85 11H2a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h4.954L7.527.337A.5.5 0 0 1 8 0M2 3v7h12V3z"/>
                </svg>
              </Button>
              <Button
                variant={activeResourcePanel === 'tools' ? 'primary' : 'outline-light'}
                size="sm"
                onClick={() => switchResourcePanel('tools')}
                title={t('presenter.tools')}
                style={{ padding: '6px 10px' }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M1 0 0 1l2.2 3.081a1 1 0 0 0 .815.419h.07a1 1 0 0 1 .708.293l2.675 2.675-2.617 2.654A3.003 3.003 0 0 0 0 13a3 3 0 1 0 5.878-.851l2.654-2.617.968.968-.305.914a1 1 0 0 0 .242 1.023l3.27 3.27a.997.997 0 0 0 1.414 0l1.586-1.586a.997.997 0 0 0 0-1.414l-3.27-3.27a1 1 0 0 0-1.023-.242L10.5 9.5l-.96-.96 2.68-2.643A3.005 3.005 0 0 0 16 3q0-.405-.102-.777l-2.14 2.141L12 4l-.364-1.757L13.777.102a3 3 0 0 0-3.675 3.68L7.462 6.46 4.793 3.793a1 1 0 0 1-.293-.707v-.071a1 1 0 0 0-.419-.814z"/>
                  <path d="M9.646 10.646a.5.5 0 0 1 .708 0l2.914 2.915a.5.5 0 0 1-.707.707l-2.915-2.914a.5.5 0 0 1 0-.708M3 11l.471.242.529.026.287.445.445.287.026.529L5 13l-.242.471-.026.529-.445.287-.287.445-.529.026L3 15l-.471-.242L2 14.732l-.287-.445L1.268 14l-.026-.529L1 13l.242-.471.026-.529.445-.287.287-.445.529-.026z"/>
                </svg>
              </Button>
            </div>

            {/* Search bar - Glassmorphic style (hidden when Tools tab is active) */}
            {activeResourcePanel !== 'tools' && (
            <div style={{ flex: '1 1 200px', minWidth: '200px', position: 'relative' }}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                fill="rgba(255,255,255,0.6)"
                viewBox="0 0 16 16"
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none'
                }}
              >
                <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                placeholder={
                  activeResourcePanel === 'bible'
                    ? t('presenter.searchBiblePlaceholder')
                    : activeResourcePanel === 'presentations'
                    ? t('presenter.searchPresentations', 'Search presentations...')
                    : t('presenter.searchPlaceholder')
                }
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.08)',
                  backdropFilter: 'blur(10px)',
                  border: '2px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '10px',
                  padding: '10px 36px 10px 36px',
                  color: 'white',
                  fontSize: '0.95rem',
                  fontWeight: '400',
                  outline: 'none',
                  transition: 'all 0.3s ease'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                  e.target.style.boxShadow = '0 0 15px rgba(255, 255, 255, 0.15)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                  e.target.style.boxShadow = 'none';
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    handleSearch('');
                    searchInputRef.current?.focus();
                  }}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'rgba(255, 255, 255, 0.2)',
                    border: 'none',
                    borderRadius: '50%',
                    width: '20px',
                    height: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    padding: 0,
                    transition: 'background 0.2s ease'
                  }}
                  onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.3)'}
                  onMouseLeave={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.2)'}
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="white">
                    <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
                  </svg>
                </button>
              )}
            </div>
            )}

            {/* New button */}
            {(activeResourcePanel === 'songs' || activeResourcePanel === 'images' || activeResourcePanel === 'presentations') && (
              <Button
                variant="success"
                size="sm"
                onClick={() => {
                  if (activeResourcePanel === 'presentations') {
                    setEditingPresentation(null);
                    setShowPresentationEditor(true);
                  } else {
                    setShowCreateModal(true);
                  }
                }}
                style={{
                  fontWeight: '600',
                  fontSize: '0.75rem'
                }}
                title={activeResourcePanel === 'presentations' ? t('presenter.createNewPresentation', 'Create new presentation') : (activeResourcePanel === 'songs' ? t('presenter.createNewSong') : t('presenter.uploadNewImage'))}
              >
                {t('presenter.new')}
              </Button>
            )}
          </div>

          <div style={{ padding: '10px', backgroundColor: 'transparent' }}>
            {activeResourcePanel === 'songs' ? (
              <div className="dark-scrollbar" style={{ height: '220px', backgroundColor: 'transparent' }}>
                {songsLoading ? (
                  <div style={{ textAlign: 'center', color: 'white', padding: '40px' }}>
                    <div className="spinner-border text-light" role="status" style={{ marginBottom: '10px' }}>
                      <span className="visually-hidden">Loading...</span>
                    </div>
                    <div>{t('presenter.loadingSongs')}</div>
                  </div>
                ) : searchResults.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'white', fontSize: '0.9rem' }}>
                    {searchQuery ? t('presenter.noSongsMatch') : t('presenter.noSongsAvailable')}
                  </p>
                ) : (
                  <FixedSizeList
                    height={220}
                    itemCount={searchResults.length}
                    itemSize={42}
                    width="100%"
                    className="dark-scrollbar"
                  >
                    {({ index, style }) => {
                      const song = searchResults[index];
                      const isSelected = !selectedFromSetlist && currentSong && currentSong.id && currentSong.id === song.id;
                      return (
                        <div
                          style={{
                            ...(style || {}),
                            padding: '3px 8px',
                            display: 'flex',
                            flexDirection: i18n.language === 'he' ? 'row-reverse' : 'row',
                            gap: '8px',
                            alignItems: 'center',
                            boxSizing: 'border-box'
                          }}
                        >
                          <div
                            onClick={() => {
                              const now = Date.now();
                              const DOUBLE_TAP_DELAY = 300;
                              if (lastTapRef.current.songId === song._id && now - lastTapRef.current.time < DOUBLE_TAP_DELAY) {
                                // Double tap detected
                                addToSetlist(song);
                                lastTapRef.current = { time: 0, songId: null };
                              } else {
                                // Single tap - select song
                                selectSong(song);
                                lastTapRef.current = { time: now, songId: song._id };
                              }
                            }}
                            style={{
                              flex: 1,
                              padding: '5px 7px',
                              background: isSelected ? 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)' : 'transparent',
                              color: 'white',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontSize: '0.95rem',
                              fontWeight: isSelected ? '500' : '400',
                              border: isSelected ? '2px solid var(--color-primary)' : '1px solid rgba(255,255,255,0.3)',
                              transition: 'all 0.2s ease',
                              boxShadow: isSelected ? '0 2px 8px rgba(0,123,255,0.25)' : 'none',
                              direction: 'ltr',
                              textAlign: i18n.language === 'he' ? 'right' : 'left'
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) {
                                e.currentTarget.style.borderColor = '#FF8C42';
                                e.currentTarget.style.background = 'rgba(255,140,66,0.2)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) {
                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
                                e.currentTarget.style.background = 'transparent';
                              }
                            }}
                          >
                            {song.title}
                          </div>
                          <Button
                            variant="outline-success"
                            onClick={(e) => {
                              e.stopPropagation();
                              addToSetlist(song);
                            }}
                            style={{
                              width: '24px',
                              height: '34px',
                              minHeight: '34px',
                              fontSize: '1rem',
                              fontWeight: '600',
                              flexShrink: 0,
                              padding: '0',
                              lineHeight: '1',
                              background: 'transparent',
                              borderColor: '#198754',
                              color: '#198754'
                            }}
                          >
                            +
                          </Button>
                        </div>
                      );
                    }}
                  </FixedSizeList>
                )}
              </div>
            ) : activeResourcePanel === 'bible' ? (
              <div className="dark-scrollbar" style={{ maxHeight: '220px', overflowY: 'auto' }}>
                <div style={{ marginBottom: '15px' }}>
                  {/* Side-by-side Book and Chapter selectors (stacks on mobile) */}
                  <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '10px', marginBottom: '15px' }}>
                    <div style={{ flex: isMobile ? '1' : '2' }}>
                      <Form.Label className="text-white" style={{ fontSize: '0.85rem', fontWeight: '500', marginBottom: '6px', display: 'block' }}>
                        {t('bible.book')}
                      </Form.Label>
                      <Form.Select
                        size="sm"
                        value={selectedBibleBook}
                        onChange={(e) => setSelectedBibleBook(e.target.value)}
                        style={{
                          fontSize: '0.9rem',
                          background: 'rgba(255, 255, 255, 0.08)',
                          backdropFilter: 'blur(10px)',
                          border: '2px solid rgba(255, 255, 255, 0.2)',
                          borderRadius: '10px',
                          color: 'white',
                          padding: '8px 12px',
                          outline: 'none',
                          transition: 'all 0.3s ease'
                        }}
                      >
                        <option value="">{t('common.select')}...</option>
                        <optgroup label={i18n.language === 'he' ? 'תורה' : 'Torah (Pentateuch)'}>
                          <option value="Genesis">{i18n.language === 'he' ? 'בראשית' : 'Genesis (בראשית)'}</option>
                          <option value="Exodus">{i18n.language === 'he' ? 'שמות' : 'Exodus (שמות)'}</option>
                          <option value="Leviticus">{i18n.language === 'he' ? 'ויקרא' : 'Leviticus (ויקרא)'}</option>
                          <option value="Numbers">{i18n.language === 'he' ? 'במדבר' : 'Numbers (במדבר)'}</option>
                          <option value="Deuteronomy">{i18n.language === 'he' ? 'דברים' : 'Deuteronomy (דברים)'}</option>
                        </optgroup>
                        <optgroup label={i18n.language === 'he' ? 'נביאים' : "Nevi'im (Prophets)"}>
                          <option value="Joshua">{i18n.language === 'he' ? 'יהושע' : 'Joshua (יהושע)'}</option>
                          <option value="Judges">{i18n.language === 'he' ? 'שופטים' : 'Judges (שופטים)'}</option>
                          <option value="I Samuel">{i18n.language === 'he' ? 'שמואל א׳' : '1 Samuel (שמואל א)'}</option>
                          <option value="II Samuel">{i18n.language === 'he' ? 'שמואל ב׳' : '2 Samuel (שמואל ב)'}</option>
                          <option value="I Kings">{i18n.language === 'he' ? 'מלכים א׳' : '1 Kings (מלכים א)'}</option>
                          <option value="II Kings">{i18n.language === 'he' ? 'מלכים ב׳' : '2 Kings (מלכים ב)'}</option>
                          <option value="Isaiah">{i18n.language === 'he' ? 'ישעיהו' : 'Isaiah (ישעיהו)'}</option>
                          <option value="Jeremiah">{i18n.language === 'he' ? 'ירמיהו' : 'Jeremiah (ירמיהו)'}</option>
                          <option value="Ezekiel">{i18n.language === 'he' ? 'יחזקאל' : 'Ezekiel (יחזקאל)'}</option>
                          <option value="Hosea">{i18n.language === 'he' ? 'הושע' : 'Hosea (הושע)'}</option>
                          <option value="Joel">{i18n.language === 'he' ? 'יואל' : 'Joel (יואל)'}</option>
                          <option value="Amos">{i18n.language === 'he' ? 'עמוס' : 'Amos (עמוס)'}</option>
                          <option value="Obadiah">{i18n.language === 'he' ? 'עובדיה' : 'Obadiah (עובדיה)'}</option>
                          <option value="Jonah">{i18n.language === 'he' ? 'יונה' : 'Jonah (יונה)'}</option>
                          <option value="Micah">{i18n.language === 'he' ? 'מיכה' : 'Micah (מיכה)'}</option>
                          <option value="Nahum">{i18n.language === 'he' ? 'נחום' : 'Nahum (נחום)'}</option>
                          <option value="Habakkuk">{i18n.language === 'he' ? 'חבקוק' : 'Habakkuk (חבקוק)'}</option>
                          <option value="Zephaniah">{i18n.language === 'he' ? 'צפניה' : 'Zephaniah (צפניה)'}</option>
                          <option value="Haggai">{i18n.language === 'he' ? 'חגי' : 'Haggai (חגי)'}</option>
                          <option value="Zechariah">{i18n.language === 'he' ? 'זכריה' : 'Zechariah (זכריה)'}</option>
                          <option value="Malachi">{i18n.language === 'he' ? 'מלאכי' : 'Malachi (מלאכי)'}</option>
                        </optgroup>
                        <optgroup label={i18n.language === 'he' ? 'כתובים' : 'Ketuvim (Writings)'}>
                          <option value="Psalms">{i18n.language === 'he' ? 'תהילים' : 'Psalms (תהילים)'}</option>
                          <option value="Proverbs">{i18n.language === 'he' ? 'משלי' : 'Proverbs (משלי)'}</option>
                          <option value="Job">{i18n.language === 'he' ? 'איוב' : 'Job (איוב)'}</option>
                          <option value="Song of Songs">{i18n.language === 'he' ? 'שיר השירים' : 'Song of Songs (שיר השירים)'}</option>
                          <option value="Ruth">{i18n.language === 'he' ? 'רות' : 'Ruth (רות)'}</option>
                          <option value="Lamentations">{i18n.language === 'he' ? 'איכה' : 'Lamentations (איכה)'}</option>
                          <option value="Ecclesiastes">{i18n.language === 'he' ? 'קהלת' : 'Ecclesiastes (קהלת)'}</option>
                          <option value="Esther">{i18n.language === 'he' ? 'אסתר' : 'Esther (אסתר)'}</option>
                          <option value="Daniel">{i18n.language === 'he' ? 'דניאל' : 'Daniel (דניאל)'}</option>
                          <option value="Ezra">{i18n.language === 'he' ? 'עזרא' : 'Ezra (עזרא)'}</option>
                          <option value="Nehemiah">{i18n.language === 'he' ? 'נחמיה' : 'Nehemiah (נחמיה)'}</option>
                          <option value="I Chronicles">{i18n.language === 'he' ? 'דברי הימים א׳' : '1 Chronicles (דברי הימים א)'}</option>
                          <option value="II Chronicles">{i18n.language === 'he' ? 'דברי הימים ב׳' : '2 Chronicles (דברי הימים ב)'}</option>
                        </optgroup>
                        <optgroup label={i18n.language === 'he' ? 'ברית חדשה - בשורות' : 'New Testament - Gospels'}>
                          <option value="Matthew">{i18n.language === 'he' ? 'מתי' : 'Matthew (מתי)'}</option>
                          <option value="Mark">{i18n.language === 'he' ? 'מרקוס' : 'Mark (מרקוס)'}</option>
                          <option value="Luke">{i18n.language === 'he' ? 'לוקס' : 'Luke (לוקס)'}</option>
                          <option value="John">{i18n.language === 'he' ? 'יוחנן' : 'John (יוחנן)'}</option>
                        </optgroup>
                        <optgroup label={i18n.language === 'he' ? 'ברית חדשה - היסטוריה' : 'New Testament - History'}>
                          <option value="Acts">{i18n.language === 'he' ? 'מעשי השליחים' : 'Acts (מעשי השליחים)'}</option>
                        </optgroup>
                        <optgroup label={i18n.language === 'he' ? 'ברית חדשה - אגרות פאולוס' : "New Testament - Paul's Letters"}>
                          <option value="Romans">{i18n.language === 'he' ? 'רומים' : 'Romans (רומים)'}</option>
                          <option value="1 Corinthians">{i18n.language === 'he' ? 'קורינתים א׳' : '1 Corinthians (קורינתים א׳)'}</option>
                          <option value="2 Corinthians">{i18n.language === 'he' ? 'קורינתים ב׳' : '2 Corinthians (קורינתים ב׳)'}</option>
                          <option value="Galatians">{i18n.language === 'he' ? 'גלטים' : 'Galatians (גלטים)'}</option>
                          <option value="Ephesians">{i18n.language === 'he' ? 'אפסים' : 'Ephesians (אפסים)'}</option>
                          <option value="Philippians">{i18n.language === 'he' ? 'פיליפים' : 'Philippians (פיליפים)'}</option>
                          <option value="Colossians">{i18n.language === 'he' ? 'קולוסים' : 'Colossians (קולוסים)'}</option>
                          <option value="1 Thessalonians">{i18n.language === 'he' ? 'תסלוניקים א׳' : '1 Thessalonians (תסלוניקים א׳)'}</option>
                          <option value="2 Thessalonians">{i18n.language === 'he' ? 'תסלוניקים ב׳' : '2 Thessalonians (תסלוניקים ב׳)'}</option>
                          <option value="1 Timothy">{i18n.language === 'he' ? 'טימותיאוס א׳' : '1 Timothy (טימותיאוס א׳)'}</option>
                          <option value="2 Timothy">{i18n.language === 'he' ? 'טימותיאוס ב׳' : '2 Timothy (טימותיאוס ב׳)'}</option>
                          <option value="Titus">{i18n.language === 'he' ? 'טיטוס' : 'Titus (טיטוס)'}</option>
                          <option value="Philemon">{i18n.language === 'he' ? 'פילימון' : 'Philemon (פילימון)'}</option>
                        </optgroup>
                        <optgroup label={i18n.language === 'he' ? 'ברית חדשה - אגרות כלליות' : 'New Testament - General Letters'}>
                          <option value="Hebrews">{i18n.language === 'he' ? 'עברים' : 'Hebrews (עברים)'}</option>
                          <option value="James">{i18n.language === 'he' ? 'יעקב' : 'James (יעקב)'}</option>
                          <option value="1 Peter">{i18n.language === 'he' ? 'פטרוס א׳' : '1 Peter (פטרוס א׳)'}</option>
                          <option value="2 Peter">{i18n.language === 'he' ? 'פטרוס ב׳' : '2 Peter (פטרוס ב׳)'}</option>
                          <option value="1 John">{i18n.language === 'he' ? 'יוחנן א׳' : '1 John (יוחנן א׳)'}</option>
                          <option value="2 John">{i18n.language === 'he' ? 'יוחנן ב׳' : '2 John (יוחנן ב׳)'}</option>
                          <option value="3 John">{i18n.language === 'he' ? 'יוחנן ג׳' : '3 John (יוחנן ג׳)'}</option>
                          <option value="Jude">{i18n.language === 'he' ? 'יהודה' : 'Jude (יהודה)'}</option>
                        </optgroup>
                        <optgroup label={i18n.language === 'he' ? 'ברית חדשה - נבואה' : 'New Testament - Prophecy'}>
                          <option value="Revelation">{i18n.language === 'he' ? 'התגלות' : 'Revelation (התגלות)'}</option>
                        </optgroup>
                      </Form.Select>
                    </div>

                    <div style={{ flex: isMobile ? '1' : '1' }}>
                      <Form.Label className="text-white" style={{ fontSize: '0.85rem', fontWeight: '500', marginBottom: '6px', display: 'block' }}>
                        {t('bible.chapter')}
                      </Form.Label>
                      <Form.Select
                        size="sm"
                        value={selectedBibleChapter}
                        onChange={(e) => setSelectedBibleChapter(e.target.value)}
                        disabled={!selectedBibleBook}
                        style={{
                          fontSize: '0.9rem',
                          background: 'rgba(255, 255, 255, 0.08)',
                          backdropFilter: 'blur(10px)',
                          border: '2px solid rgba(255, 255, 255, 0.2)',
                          borderRadius: '10px',
                          color: 'white',
                          padding: '8px 12px',
                          outline: 'none',
                          transition: 'all 0.3s ease'
                        }}
                      >
                        <option value="">{t('common.select')}...</option>
                        {selectedBibleBook && (() => {
                          const bookData = bibleBooks.find(b => b.name === selectedBibleBook);
                          const chapterCount = bookData?.chapters || 50;
                          return Array.from({ length: chapterCount }, (_, i) => (
                            <option key={i + 1} value={i + 1}>
                              {getDisplayChapter(i + 1)}
                            </option>
                          ));
                        })()}
                      </Form.Select>
                    </div>
                  </div>

                  {selectedBibleBook && selectedBibleChapter && !bibleLoading && bibleVerses.length > 0 && (
                    <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid rgba(255,255,255,0.3)' }}>
                      <Button
                        variant="primary"
                        size="sm"
                        style={{ width: '100%' }}
                        onClick={() => {
                          const biblePassage = {
                            _id: `bible-${selectedBibleBook}-${selectedBibleChapter}`,
                            title: `${getDisplayBookName(selectedBibleBook)} ${getDisplayChapter(selectedBibleChapter)}`,
                            slides: bibleVerses,
                            isBible: true,
                            book: selectedBibleBook,
                            chapter: selectedBibleChapter
                          };
                          addBibleToSetlist(biblePassage);
                        }}
                      >
                        {t('bible.addPassageToSetlist', { book: getDisplayBookName(selectedBibleBook), chapter: getDisplayChapter(selectedBibleChapter) })}
                      </Button>
                    </div>
                  )}
                </div>

                {bibleLoading && (
                  <div style={{ textAlign: 'center', color: 'white', padding: '20px' }}>
                    {t('presenter.loadingVerses')}
                  </div>
                )}

                {!bibleLoading && bibleVerses.length === 0 && selectedBibleBook && selectedBibleChapter && (
                  <div style={{ textAlign: 'center', color: 'white', padding: '20px' }}>
                    {t('presenter.selectBookAndChapter')}
                  </div>
                )}
              </div>
            ) : activeResourcePanel === 'tools' ? (
              <div className="dark-scrollbar" style={{ maxHeight: activeToolsTab === 'countdown' ? '220px' : 'none', overflowY: activeToolsTab === 'countdown' ? 'auto' : 'visible' }}>
                {/* Tools Selector - Modern Card Style */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '6px',
                  marginBottom: '14px'
                }}>
                  {[
                    { key: 'countdown', icon: (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="13" r="8"/>
                        <path d="M12 9v4l2 2"/>
                        <path d="M5 3L2 6"/>
                        <path d="M22 6l-3-3"/>
                        <path d="M12 2v2"/>
                      </svg>
                    ), label: t('presenter.toolsCountdown') },
                    { key: 'announce', icon: (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                      </svg>
                    ), label: t('presenter.toolsAnnounce') },
                    { key: 'messages', icon: (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                      </svg>
                    ), label: t('presenter.toolsMessages') }
                  ].map((tool) => (
                    <div
                      key={tool.key}
                      onClick={() => setActiveToolsTab(tool.key)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '8px 4px',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        background: activeToolsTab === tool.key
                          ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                          : 'rgba(255, 255, 255, 0.08)',
                        border: activeToolsTab === tool.key
                          ? '1px solid rgba(255, 255, 255, 0.3)'
                          : '1px solid rgba(255, 255, 255, 0.1)',
                        boxShadow: activeToolsTab === tool.key
                          ? '0 4px 15px rgba(102, 126, 234, 0.4)'
                          : 'none',
                        transform: activeToolsTab === tool.key ? 'scale(1.02)' : 'scale(1)'
                      }}
                      onMouseEnter={(e) => {
                        if (activeToolsTab !== tool.key) {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                          e.currentTarget.style.transform = 'scale(1.02)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (activeToolsTab !== tool.key) {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                          e.currentTarget.style.transform = 'scale(1)';
                        }
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2px' }}>{tool.icon}</span>
                      <span style={{
                        fontSize: '0.65rem',
                        color: 'white',
                        fontWeight: activeToolsTab === tool.key ? '600' : '400',
                        textAlign: 'center',
                        lineHeight: 1.1,
                        opacity: activeToolsTab === tool.key ? 1 : 0.8
                      }}>
                        {tool.label}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Countdown Timer Tab */}
                {activeToolsTab === 'countdown' && (
                  <div style={{ color: 'white' }}>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}>
                      <Form.Control
                        type="time"
                        value={countdownTargetTime}
                        onChange={(e) => {
                          setCountdownTargetTime(e.target.value);
                          // If editing a setlist countdown, don't stop broadcasting - changes apply on Update
                          // Only stop broadcasting if NOT editing a focused setlist countdown
                          if (countdownBroadcasting && focusedCountdownIndex === null) {
                            if (countdownIntervalRef.current) {
                              clearInterval(countdownIntervalRef.current);
                              countdownIntervalRef.current = null;
                            }
                            setCountdownRunning(false);
                            setCountdownBroadcasting(false);
                            setActiveSetlistCountdownIndex(null);
                            // Clear from viewer
                            if (room) {
                              socketService.operatorUpdateSlide({
                                roomId: room.id,
                                roomPin: room.pin,
                                backgroundImage: room.backgroundImage || '',
                                songId: null,
                                slideIndex: 0,
                                displayMode: displayMode,
                                isBlank: true,
                                toolsData: null
                              });
                            }
                          }
                        }}
                        style={{ width: '140px', flexShrink: 0 }}
                        size="sm"
                      />
                      <Form.Control
                        type="text"
                        value={countdownMessage}
                        onChange={(e) => setCountdownMessage(e.target.value)}
                        onBlur={() => updateFocusedCountdownMessage()}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.target.blur();
                          }
                        }}
                        placeholder={t('presenter.countdownPlaceholder')}
                        size="sm"
                        style={{ flex: 1 }}
                      />
                    </div>

                    {/* Show Update button when editing a broadcasting countdown, otherwise show Add to Setlist */}
                    {focusedCountdownIndex !== null && activeSetlistCountdownIndex === focusedCountdownIndex ? (
                      <Button
                        variant="warning"
                        onClick={updateFocusedCountdownMessage}
                        style={{ width: '100%', padding: '10px 20px', fontSize: '1rem' }}
                      >
                        {t('presenter.updateCountdown', 'Update Countdown')}
                      </Button>
                    ) : focusedCountdownIndex !== null ? (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <Button
                          variant="outline-warning"
                          onClick={updateFocusedCountdownMessage}
                          style={{ flex: 1, padding: '10px 20px', fontSize: '1rem' }}
                        >
                          {t('presenter.saveChanges', 'Save Changes')}
                        </Button>
                        <Button
                          variant="outline-secondary"
                          onClick={() => setFocusedCountdownIndex(null)}
                          style={{ padding: '10px 15px', fontSize: '1rem' }}
                        >
                          ✕
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline-success"
                        onClick={addCountdownToSetlist}
                        style={{ width: '100%', padding: '10px 20px', fontSize: '1rem', borderColor: '#198754', color: '#198754' }}
                      >
                        {t('presenter.addToSetlist')}
                      </Button>
                    )}
                  </div>
                )}

                {/* Announcement Tab */}
                {activeToolsTab === 'announce' && (
                  <div style={{ color: 'white' }}>
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        {[
                          { key: 'welcome', en: 'Welcome', he: 'ברוכים הבאים' },
                          { key: 'silencePhones', en: 'Silence phones', he: 'השתיקו טלפונים' },
                          { key: 'pleaseBeSeated', en: 'Please be seated', he: 'נא לשבת' },
                          { key: 'registerNow', en: 'Register now!', he: 'הרשמו עכשיו!' }
                        ].map((item) => (
                          <Button
                            key={item.key}
                            variant="outline-light"
                            size="sm"
                            onClick={() => updateAnnouncementText(i18n.language === 'he' ? item.he : item.en)}
                            style={{ textAlign: 'center', fontSize: '0.75rem', padding: '4px 6px' }}
                          >
                            {i18n.language === 'he' ? item.he : item.en}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                      <Form.Control
                        type="text"
                        value={announcementText}
                        onChange={(e) => updateAnnouncementText(e.target.value)}
                        placeholder={t('presenter.announcementPlaceholder')}
                        size="sm"
                      />
                    </div>

                    <Button
                      variant="outline-success"
                      onClick={addAnnouncementToSetlist}
                      disabled={!announcementText.trim()}
                      style={{ width: '100%', padding: '10px 20px', fontSize: '1rem', borderColor: '#198754', color: '#198754' }}
                    >
                      {t('presenter.addToSetlist')}
                    </Button>
                  </div>
                )}

                {/* Rotating Messages Tab */}
                {activeToolsTab === 'messages' && (
                  <div style={{ color: 'white' }}>
                    <div style={{ marginBottom: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', maxHeight: '100px', overflowY: 'auto' }}>
                      {rotatingMessages.map((msg, index) => (
                        <div
                          key={msg.id}
                          onClick={() => {
                            const now = Date.now();
                            const DOUBLE_TAP_DELAY = 300;
                            if (lastMessageTapRef.current.msgId === msg.id && now - lastMessageTapRef.current.time < DOUBLE_TAP_DELAY) {
                              // Double tap detected - cancel pending single tap and add to setlist
                              if (messageTapTimeoutRef.current) {
                                clearTimeout(messageTapTimeoutRef.current);
                                messageTapTimeoutRef.current = null;
                              }
                              addSingleMessageToSetlist(msg);
                              lastMessageTapRef.current = { time: 0, msgId: null };
                            } else {
                              // First tap - wait to see if second tap comes
                              lastMessageTapRef.current = { time: now, msgId: msg.id };
                              if (messageTapTimeoutRef.current) {
                                clearTimeout(messageTapTimeoutRef.current);
                              }
                              messageTapTimeoutRef.current = setTimeout(() => {
                                // No second tap came - toggle enabled state
                                toggleMessageEnabled(msg.id);
                                messageTapTimeoutRef.current = null;
                              }, DOUBLE_TAP_DELAY);
                            }
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 4px',
                            backgroundColor: msg.enabled ? 'rgba(255,255,255,0.1)' : 'transparent',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          <Form.Check
                            type="checkbox"
                            checked={msg.enabled}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleMessageEnabled(msg.id);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            style={{ margin: 0 }}
                          />
                          <span style={{ flex: 1, fontSize: '0.7rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {msg.isPreset ? t(`presenter.${msg.text}`) : msg.text}
                          </span>
                          {!msg.isPreset && (
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeCustomMessage(msg.id);
                              }}
                              style={{ padding: '0 4px', fontSize: '0.6rem' }}
                            >
                              X
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <Form.Control
                          type="text"
                          value={customMessageInput}
                          onChange={(e) => setCustomMessageInput(e.target.value)}
                          placeholder={t('presenter.addCustomMessage')}
                          size="sm"
                          style={{ flex: 1 }}
                        />
                        <Button
                          variant="outline-success"
                          size="sm"
                          onClick={addCustomMessage}
                          disabled={!customMessageInput.trim()}
                        >
                          +
                        </Button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.75rem' }}>{t('presenter.rotationInterval')}:</span>
                      <Button
                        variant="outline-light"
                        size="sm"
                        onClick={() => setRotatingInterval(rotatingInterval === 5 ? 10 : 5)}
                        style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                      >
                        {rotatingInterval}s
                      </Button>
                    </div>
                    <Button
                      variant="outline-success"
                      size="sm"
                      onClick={addMessagesToSetlist}
                      disabled={rotatingMessages.filter(m => m.enabled).length === 0}
                      style={{ width: '100%' }}
                    >
                      {t('presenter.addToSetlist')}
                    </Button>
                  </div>
                )}
              </div>
            ) : activeResourcePanel === 'presentations' ? (
              /* Presentations Panel */
              <div className="dark-scrollbar" style={{ maxHeight: '220px', overflowY: 'auto' }}>
                {presentationsLoading ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
                    {t('presenter.loading', 'Loading...')}
                  </div>
                ) : allPresentations.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
                    {t('presenter.noPresentations', 'No presentations yet. Click "New" to create one.')}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '4px' }}>
                    {allPresentations
                      .filter(p => !presentationSearchQuery || p.title.toLowerCase().includes(presentationSearchQuery.toLowerCase()))
                      .map((presentation) => {
                      const isSelected = selectedPresentation?.id === presentation.id;
                      return (
                      <div
                        key={presentation.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                          borderRadius: '6px',
                          border: isSelected ? '1px solid rgba(99, 102, 241, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                            e.currentTarget.style.borderColor = 'rgba(255, 140, 66, 0.5)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                          }
                        }}
                        onClick={() => {
                          setSelectedPresentation(presentation);
                          setSelectedPresentationSlideIndex(0);
                          setCurrentItem(null); // Clear song/bible item when selecting a presentation
                          setCurrentSong(null); // Clear song slides preview
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            color: '#fff',
                            fontSize: '14px',
                            fontWeight: '500',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {presentation.title}
                          </div>
                          <div style={{
                            color: 'rgba(255, 255, 255, 0.5)',
                            fontSize: '11px'
                          }}>
                            {presentation.slides?.length || 0} {t('presenter.slides', 'slides')}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <Button
                            variant="outline-light"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingPresentation(presentation);
                              setShowPresentationEditor(true);
                            }}
                            style={{ fontSize: '12px', padding: '2px 8px' }}
                            title={t('presenter.edit', 'Edit')}
                          >
                            ✎
                          </Button>
                          <Button
                            variant="outline-success"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              // Add presentation to setlist
                              setSetlist([...setlist, {
                                type: 'presentation',
                                data: { ...presentation, currentSlide: 0 }
                              }]);
                              setHasUnsavedChanges(true);
                            }}
                            style={{ fontSize: '12px', padding: '2px 8px' }}
                            title={t('presenter.addToSetlist', 'Add to setlist')}
                          >
                            +
                          </Button>
                        </div>
                      </div>
                    );
                    })}
                    {allPresentations.filter(p => !presentationSearchQuery || p.title.toLowerCase().includes(presentationSearchQuery.toLowerCase())).length === 0 && presentationSearchQuery && (
                      <div style={{ padding: '20px', textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
                        {t('presenter.noPresentationsMatch', 'No presentations match your search')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : activeResourcePanel === 'media' ? (
              /* Media Panel with Local and Cloud sections */
              <div className="dark-scrollbar" style={{ padding: '10px', color: 'white', maxHeight: '300px', overflowY: 'auto' }}>
                {/* Local Section - Collapsible (disabled if no presentation connection) */}
                <div style={{ marginBottom: '10px', opacity: presentationConnection ? 1 : 0.5 }}>
                  <div
                    onClick={() => presentationConnection && setMediaLocalExpanded(!mediaLocalExpanded)}
                    title={!presentationSupported
                      ? (t('presenter.localMediaNotSupported') || 'Local media requires a browser with Presentation API support')
                      : !presentationConnection
                        ? (t('presenter.localMediaRequiresDisplay') || 'Click "Present to connected display" first to use local media')
                        : ''
                    }
                    style={{
                      cursor: presentationConnection ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 10px',
                      backgroundColor: 'rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      marginBottom: mediaLocalExpanded && presentationConnection ? '10px' : '0'
                    }}
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                      style={{
                        transform: mediaLocalExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease'
                      }}
                    >
                      <path d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/>
                    </svg>
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M4.5 11a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1M3 10.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0"/>
                      <path d="M16 11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V9.51c0-.418.105-.83.305-1.197l2.472-4.531A1.5 1.5 0 0 1 4.094 3h7.812a1.5 1.5 0 0 1 1.317.782l2.472 4.53c.2.368.305.78.305 1.198zM3.655 4.26 1.592 8.043Q1.79 8 1.592 8h12q.21 0 .408.042L12.345 4.26a.5.5 0 0 0-.439-.26H4.094a.5.5 0 0 0-.44.26zM1 10v1a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1"/>
                    </svg>
                    <span style={{ fontWeight: '500' }}>{t('presenter.localMedia', 'Local Media')}</span>
                    {!presentationConnection && (
                      <span style={{ fontSize: '0.75rem', opacity: 0.7, marginLeft: 'auto' }}>
                        ({t('presenter.requiresDisplay', 'requires display')})
                      </span>
                    )}
                  </div>
                  {mediaLocalExpanded && presentationConnection && (
                    <div style={{ paddingLeft: '10px' }}>
                      {/* File Input */}
                      <div style={{ marginBottom: '15px' }}>
                        <input
                          type="file"
                          accept="image/*,video/*"
                          id="local-media-input"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) {
                              setSelectedMediaFile(file);
                              setMediaType(file.type.startsWith('image/') ? 'image' : 'video');
                              // Create preview URL
                              const url = URL.createObjectURL(file);
                              setMediaPreviewUrl(url);
                            }
                          }}
                        />
                        <Button
                          variant="outline-light"
                          onClick={() => document.getElementById('local-media-input').click()}
                          style={{ width: '100%', marginBottom: '10px' }}
                        >
                          <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style={{ marginRight: '8px' }}>
                            <path d="M4.5 11a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1M3 10.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0"/>
                            <path d="M16 11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V9.51c0-.418.105-.83.305-1.197l2.472-4.531A1.5 1.5 0 0 1 4.094 3h7.812a1.5 1.5 0 0 1 1.317.782l2.472 4.53c.2.368.305.78.305 1.198zM3.655 4.26 1.592 8.043Q1.79 8 1.592 8h12q.21 0 .408.042L12.345 4.26a.5.5 0 0 0-.439-.26H4.094a.5.5 0 0 0-.44.26zM1 10v1a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1"/>
                          </svg>
                          {t('presenter.selectMediaFile')}
                        </Button>
                      </div>

                      {/* Preview Area */}
                      <div style={{
                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                        borderRadius: '10px',
                        padding: '10px',
                        marginBottom: '15px',
                        minHeight: '100px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {!mediaPreviewUrl ? (
                          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>
                            {t('presenter.noMediaSelected')}
                          </span>
                        ) : mediaType === 'image' ? (
                          <img
                            src={mediaPreviewUrl}
                            alt="Preview"
                            style={{
                              maxWidth: '100%',
                              maxHeight: '120px',
                              borderRadius: '8px',
                              objectFit: 'contain'
                            }}
                          />
                        ) : (
                          <video
                            ref={localVideoRef}
                            src={mediaPreviewUrl}
                            controls
                            autoPlay
                            loop
                            muted
                            playsInline
                            style={{
                              maxWidth: '100%',
                              maxHeight: '120px',
                              borderRadius: '8px'
                            }}
                            onLoadedData={() => console.log('Video loaded and ready')}
                            onError={(e) => console.error('Video error:', e)}
                          />
                        )}
                      </div>

                      {/* Broadcast/Stream Buttons */}
                      {selectedMediaFile && (
                        <div style={{ display: 'flex', gap: '10px' }}>
                          {mediaType === 'image' ? (
                            imageOnDisplay ? (
                              <Button
                                variant="danger"
                                onClick={hideImageFromDisplay}
                                style={{ flex: 1 }}
                              >
                                <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style={{ marginRight: '8px' }}>
                                  <path d="M5 3.5h6A1.5 1.5 0 0 1 12.5 5v6a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 11V5A1.5 1.5 0 0 1 5 3.5z"/>
                                </svg>
                                {t('presenter.hideImage') || 'Hide'}
                              </Button>
                            ) : (
                              <Button
                                variant="info"
                                onClick={sendImageToDisplay}
                                style={{ flex: 1 }}
                                disabled={!presentationConnection}
                              >
                                <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style={{ marginRight: '8px' }}>
                                  <path d="M6.002 5.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/>
                                  <path d="M2.002 1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2h-12zm12 1a1 1 0 0 1 1 1v6.5l-3.777-1.947a.5.5 0 0 0-.577.093l-3.71 3.71-2.66-1.772a.5.5 0 0 0-.63.062L1.002 12V3a1 1 0 0 1 1-1h12z"/>
                                </svg>
                                {t('presenter.showOnDisplay')}
                              </Button>
                            )
                          ) : videoOnDisplay ? (
                            <>
                              <Button
                                variant={videoPlaying ? "warning" : "success"}
                                onClick={toggleVideoPlayback}
                                style={{ flex: 1 }}
                              >
                                {videoPlaying ? (
                                  <>
                                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style={{ marginRight: '8px' }}>
                                      <path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5zm5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5z"/>
                                    </svg>
                                    {t('presenter.pauseVideo') || 'Pause'}
                                  </>
                                ) : (
                                  <>
                                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style={{ marginRight: '8px' }}>
                                      <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/>
                                    </svg>
                                    {t('presenter.playVideo') || 'Play'}
                                  </>
                                )}
                              </Button>
                              <Button
                                variant="danger"
                                onClick={hideVideoFromDisplay}
                                style={{ flex: 1 }}
                              >
                                <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style={{ marginRight: '8px' }}>
                                  <path d="M5 3.5h6A1.5 1.5 0 0 1 12.5 5v6a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 11V5A1.5 1.5 0 0 1 5 3.5z"/>
                                </svg>
                                {t('presenter.hideVideo') || 'Hide'}
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="info"
                              onClick={sendVideoToDisplay}
                              style={{ flex: 1 }}
                              disabled={!room || !presentationConnection}
                            >
                              <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style={{ marginRight: '8px' }}>
                                <path d="M0 5a2 2 0 0 1 2-2h7.5a2 2 0 0 1 1.983 1.738l3.11-1.382A1 1 0 0 1 16 4.269v7.462a1 1 0 0 1-1.406.913l-3.111-1.382A2 2 0 0 1 9.5 13H2a2 2 0 0 1-2-2V5z"/>
                              </svg>
                              {t('presenter.showOnDisplay')}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Cloud Section - Collapsible */}
                <div>
                  <div
                    onClick={() => setMediaCloudExpanded(!mediaCloudExpanded)}
                    style={{
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 10px',
                      backgroundColor: 'rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      marginBottom: mediaCloudExpanded ? '10px' : '0'
                    }}
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                      style={{
                        transform: mediaCloudExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease'
                      }}
                    >
                      <path d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/>
                    </svg>
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M4.406 3.342A5.53 5.53 0 0 1 8 2c2.69 0 4.923 2 5.166 4.579C14.758 6.804 16 8.137 16 9.773 16 11.569 14.502 13 12.687 13H3.781C1.708 13 0 11.366 0 9.318c0-1.763 1.266-3.223 2.942-3.593.143-.863.698-1.723 1.464-2.383z"/>
                    </svg>
                    <span style={{ fontWeight: '500' }}>{t('presenter.cloudMedia', 'Cloud')}</span>
                  </div>
                  {mediaCloudExpanded && (
                    <div style={{ paddingLeft: '10px' }}>
                      {mediaLoading ? (
                        <div style={{ textAlign: 'center', color: 'white', padding: '20px' }}>
                          <div className="spinner-border text-light" role="status" style={{ marginBottom: '10px' }}>
                            <span className="visually-hidden">Loading...</span>
                          </div>
                          <div>{t('presenter.loadingMedia')}</div>
                        </div>
                      ) : imageSearchResults.length === 0 ? (
                        <p style={{ textAlign: 'center', color: 'white', fontSize: '0.9rem' }}>
                          {searchQuery ? t('presenter.noImagesMatch') : t('presenter.noImagesAvailable')}
                        </p>
                      ) : (
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))',
                          gap: '8px'
                        }}>
                          {imageSearchResults.map((image) => {
                            const isGradient = image.url.startsWith('linear-gradient');
                            return (
                              <div
                                key={image.id}
                                style={{
                                  position: 'relative',
                                  aspectRatio: '1',
                                  borderRadius: '8px',
                                  overflow: 'hidden',
                                  cursor: 'pointer',
                                  border: '2px solid rgba(255,255,255,0.2)',
                                  transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.border = '2px solid rgba(102, 126, 234, 0.8)';
                                  e.currentTarget.style.transform = 'scale(1.05)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.border = '2px solid rgba(255,255,255,0.2)';
                                  e.currentTarget.style.transform = 'scale(1)';
                                }}
                                onClick={() => selectItem({ type: 'image', data: image })}
                              >
                                {/* Image thumbnail */}
                                <div
                                  style={{
                                    width: '100%',
                                    height: '100%',
                                    background: isGradient ? image.url : `url(${getFullImageUrl(image.url)})`,
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center'
                                  }}
                                />
                                {/* Add button overlay */}
                                <Button
                                  variant="primary"
                                  size="sm"
                                  style={{
                                    position: 'absolute',
                                    top: '4px',
                                    right: '4px',
                                    zIndex: 10,
                                    borderRadius: '50%',
                                    width: '24px',
                                    height: '24px',
                                    padding: '0',
                                    fontSize: '1rem',
                                    fontWeight: '600',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    border: 'none',
                                    boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                                    transition: 'all 0.2s ease'
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    addImageToSetlist(image);
                                  }}
                                >
                                  +
                                </Button>
                                {/* Image name tooltip on hover */}
                                <div
                                  style={{
                                    position: 'absolute',
                                    bottom: 0,
                                    left: 0,
                                    right: 0,
                                    background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                                    padding: '20px 4px 4px 4px',
                                    fontSize: '0.7rem',
                                    color: 'white',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                  }}
                                  title={image.name}
                                >
                                  {image.name}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* YouTube Section */}
                <div style={{ marginTop: '12px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(255, 0, 0, 0.1)',
                      transition: 'background-color 0.2s ease',
                      color: 'white',
                      marginBottom: mediaYouTubeExpanded ? '10px' : '0'
                    }}
                    onClick={() => setMediaYouTubeExpanded(!mediaYouTubeExpanded)}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 0, 0, 0.2)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 0, 0, 0.1)'}
                  >
                    <svg width="12" height="12" fill="currentColor" viewBox="0 0 16 16" style={{ transform: mediaYouTubeExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}>
                      <path d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/>
                    </svg>
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M8.051 1.999h.089c.822.003 4.987.033 6.11.335a2.01 2.01 0 0 1 1.415 1.42c.101.38.172.883.22 1.402l.01.104.022.26.008.104c.065.914.073 1.77.074 1.957v.075c-.001.194-.01 1.108-.082 2.06l-.008.105-.009.104c-.05.572-.124 1.14-.235 1.558a2.007 2.007 0 0 1-1.415 1.42c-1.16.312-5.569.334-6.18.335h-.142c-.309 0-1.587-.006-2.927-.052l-.17-.006-.087-.004-.171-.007-.171-.007c-1.11-.049-2.167-.128-2.654-.26a2.007 2.007 0 0 1-1.415-1.419c-.111-.417-.185-.986-.235-1.558L.09 9.82l-.008-.104A31.4 31.4 0 0 1 0 7.68v-.123c.002-.215.01-.958.064-1.778l.007-.103.003-.052.008-.104.022-.26.01-.104c.048-.519.119-1.023.22-1.402a2.007 2.007 0 0 1 1.415-1.42c.487-.13 1.544-.21 2.654-.26l.17-.007.172-.006.086-.003.171-.007A99.788 99.788 0 0 1 7.858 2h.193zM6.4 5.209v4.818l4.157-2.408L6.4 5.209z"/>
                    </svg>
                    <span style={{ fontWeight: '500' }}>{t('presenter.youtube', 'YouTube')}</span>
                  </div>
                  {mediaYouTubeExpanded && (
                    <div style={{ paddingLeft: '10px' }}>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                        <Form.Control type="text" placeholder={t('presenter.enterYoutubeUrl', 'Enter YouTube URL...')} value={youtubeUrlInput} onChange={(e) => setYoutubeUrlInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleAddYoutubeVideo()} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '8px', fontSize: '0.85rem' }} />
                        <Button variant="danger" onClick={handleAddYoutubeVideo} disabled={youtubeLoading || !youtubeUrlInput.trim()} style={{ borderRadius: '8px', padding: '0 16px', fontWeight: '500' }}>{youtubeLoading ? '...' : t('add', 'Add')}</Button>
                      </div>
                      {youtubeVideos.length === 0 ? (
                        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>{t('presenter.noYoutubeVideos', 'No YouTube videos added')}</p>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '10px' }}>
                          {youtubeVideos.map((video) => (
                            <div key={video.videoId} style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', border: '2px solid rgba(255,0,0,0.3)', transition: 'all 0.2s ease', aspectRatio: '16/9' }} onClick={() => selectItem({ type: 'youtube', youtubeData: video })}>
                              <img src={video.thumbnail} alt={video.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              <Button variant="danger" size="sm" style={{ position: 'absolute', top: '4px', right: '4px', zIndex: 10, borderRadius: '50%', width: '24px', height: '24px', padding: '0', fontSize: '1rem', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={(e) => { e.stopPropagation(); setSetlist(prev => [...prev, { type: 'youtube', youtubeData: video, order: prev.length }]); }}>+</Button>
                              <Button variant="dark" size="sm" style={{ position: 'absolute', top: '4px', left: '4px', zIndex: 10, borderRadius: '50%', width: '20px', height: '20px', padding: '0', fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.8 }} onClick={(e) => { e.stopPropagation(); handleRemoveYoutubeVideo(video.videoId); }}>×</Button>
                              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.9))', padding: '16px 6px 6px 6px', fontSize: '0.7rem', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={video.title}>{video.title}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Setlist Section */}
        <div style={{
          backgroundColor: 'transparent',
          borderRadius: '15px',
          overflow: 'visible',
          borderTop: isMobile ? '1px solid rgba(255,255,255,0.6)' : 'none',
          borderLeft: isMobile ? 'none' : '1px solid rgba(255,255,255,0.6)',
          boxShadow: isMobile ? '0 -1px 8px rgba(255,255,255,0.15)' : '-1px 0 8px rgba(255,255,255,0.15)',
          paddingTop: isMobile ? '12px' : '0',
          paddingLeft: isMobile ? '0' : '12px'
        }}>
          <div
            style={{
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'transparent',
              flexWrap: 'wrap',
              gap: '6px'
            }}
          >
            <div
              onClick={(e) => {
                e.stopPropagation();
                handleOpenLoadModal();
              }}
              style={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                flex: 1,
                minWidth: '150px',
                gap: '10px'
              }}
            >
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  setSetlistSectionOpen(!setlistSectionOpen);
                }}
                style={{
                  fontSize: '1.1rem',
                  color: 'white',
                  transition: 'transform 0.2s ease',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                {setlistSectionOpen ? '▼' : '▶'}
              </span>
              {room?.linkedPermanentSetlist && linkedSetlistName ? (
                <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                  <span style={{
                    fontSize: '1.05rem',
                    fontWeight: '600',
                    color: '#2D3748',
                    background: 'linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%)',
                    padding: '6px 14px',
                    borderRadius: '8px',
                    border: '1px solid #FED7AA',
                    boxShadow: '0 1px 3px rgba(255, 140, 66, 0.1)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '250px'
                  }}>
                    {linkedSetlistName}
                  </span>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{
                    fontSize: '1.05rem',
                    fontWeight: '600',
                    color: 'white',
                    letterSpacing: '0.3px'
                  }}>
                    {t('presenter.setlist')}
                  </span>
                </div>
              )}
            </div>
            <Dropdown onClick={(e) => e.stopPropagation()}>
              <Dropdown.Toggle
                variant="link"
                id="setlist-dropdown"
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'white',
                  padding: '6px 10px',
                  fontSize: '1.4rem',
                  lineHeight: '1',
                  textDecoration: 'none',
                  boxShadow: 'none',
                  borderRadius: '8px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
                  e.currentTarget.style.color = '#FF8C42';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'white';
                }}
              >
                ⋮
              </Dropdown.Toggle>

              <Dropdown.Menu
                style={{
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
                  padding: '8px',
                  minWidth: '180px',
                  marginTop: '8px',
                  zIndex: 1050
                }}
              >
                <Dropdown.Item
                  onClick={(e) => {
                    e.stopPropagation();
                    handleManualSaveSetlist();
                  }}
                  disabled={setlist.length === 0}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '8px',
                    fontSize: '0.95rem',
                    fontWeight: '500',
                    color: setlist.length === 0 ? '#A0AEC0' : '#2D3748',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}
                  onMouseEnter={(e) => {
                    if (setlist.length > 0) {
                      e.currentTarget.style.background = '#F0FDF4';
                      e.currentTarget.style.color = '#16A34A';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = setlist.length === 0 ? '#A0AEC0' : '#2D3748';
                  }}
                >
                  <span style={{ fontSize: '1.1rem' }}>💾</span> {t('presenter.save')}
                </Dropdown.Item>

                {room?.linkedPermanentSetlist && (
                  <Dropdown.Item
                    onClick={async (e) => {
                      e.stopPropagation();
                      const confirmNew = window.confirm(
                        'Are you sure you want to create a new empty setlist?\n\n' +
                        'This will unlink "' + linkedSetlistName + '" from this room and start fresh.'
                      );
                      if (confirmNew) {
                        try {
                          // Unlink the setlist
                          await api.post(`/api/rooms/${room.id}/unlink-setlist`);

                          // Clear the local state
                          setRoom(prevRoom => ({
                            ...prevRoom,
                            linkedPermanentSetlist: null
                          }));
                          setLinkedSetlistName('');
                          setSetlist([]);
                          setCurrentSong(null);
                          setCurrentItem(null);
                          setHasUnsavedChanges(false);

                          console.log('✅ Created new empty setlist');
                        } catch (error) {
                          console.error('Error creating new setlist:', error);
                          setError('Failed to create new setlist. Please try again.');
                        }
                      }
                    }}
                    style={{
                      padding: '10px 16px',
                      borderRadius: '8px',
                      fontSize: '0.95rem',
                      fontWeight: '500',
                      color: '#2D3748',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#F0F9FF';
                      e.currentTarget.style.color = '#0284C7';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#2D3748';
                    }}
                  >
                    <span style={{ fontSize: '1.1rem' }}>✨</span> {t('presenter.new')}
                  </Dropdown.Item>
                )}

                <Dropdown.Item
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenLoadModal();
                  }}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '8px',
                    fontSize: '0.95rem',
                    fontWeight: '500',
                    color: '#2D3748',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#FEF3C7';
                    e.currentTarget.style.color = '#D97706';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#2D3748';
                  }}
                >
                  <span style={{ fontSize: '1.1rem' }}>📂</span> {t('presenter.load')}
                </Dropdown.Item>

                {!room?.linkedPermanentSetlist && (
                  <Dropdown.Item
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenSaveModal();
                    }}
                    disabled={setlist.length === 0}
                    style={{
                      padding: '10px 16px',
                      borderRadius: '8px',
                      fontSize: '0.95rem',
                      fontWeight: '500',
                      color: setlist.length === 0 ? '#A0AEC0' : '#2D3748',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}
                    onMouseEnter={(e) => {
                      if (setlist.length > 0) {
                        e.currentTarget.style.background = '#FFF7ED';
                        e.currentTarget.style.color = '#FF8C42';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = setlist.length === 0 ? '#A0AEC0' : '#2D3748';
                    }}
                  >
                    <span style={{ fontSize: '1.1rem' }}>📝</span> {t('presenter.saveAs')}
                  </Dropdown.Item>
                )}

                <Dropdown.Item
                  onClick={(e) => {
                    e.stopPropagation();
                    setSectionTitleInput('');
                    setShowSectionModal(true);
                  }}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '8px',
                    fontSize: '0.95rem',
                    fontWeight: '500',
                    color: '#2D3748',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#EDE9FE';
                    e.currentTarget.style.color = '#7C3AED';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#2D3748';
                  }}
                >
                  <span style={{ fontSize: '1.1rem' }}>📑</span> {t('presenter.addSection')}
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </div>

          {setlistSectionOpen && (
            <div style={{ padding: '10px' }}>
              {setlist.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'white' }}>
                  {t('presenter.noSongsInSetlist')}
                </p>
              ) : (
                <div
                  ref={setlistContainerRef}
                  className="dark-scrollbar"
                  style={{
                    maxHeight: isMobile ? 'none' : '280px',
                    overflowY: isMobile ? 'visible' : 'auto',
                    paddingRight: isMobile ? '0' : '5px'
                  }}
                >
                  {(() => {
                    let itemNumber = 0;
                    return setlist.map((item, index) => {
                    // Track item number (excluding sections)
                    if (item.type !== 'section') {
                      itemNumber++;
                    }
                    const currentItemNumber = itemNumber;

                    // Check if this item is selected (only show as selected if selection came from setlist)
                    // For tool items, use the exact index since multiple tools of the same type can exist
                    const isItemSelected = selectedFromSetlist && currentItem && (
                      (item.type === 'song' && currentItem.type === 'song' && item.data?.id === currentItem.data?.id) ||
                      (item.type === 'bible' && currentItem.type === 'bible' && item.data?.id === currentItem.data?.id) ||
                      (item.type === 'image' && currentItem.type === 'image' && item.data?.id === currentItem.data?.id) ||
                      (item.type === 'presentation' && currentItem.type === 'presentation' && item.data?.id === currentItem.data?.id) ||
                      (item.type === 'blank' && currentItem.type === 'blank') ||
                      (item.type === 'tool' && selectedSetlistIndex === index)
                    );

                    const getItemDisplay = () => {
                      if (item.type === 'song') {
                        return {
                          title: (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <svg width="14" height="14" viewBox="0 0 16 16" fill="white">
                                <path d="M9 13c0 1.105-1.12 2-2.5 2S4 14.105 4 13s1.12-2 2.5-2 2.5.895 2.5 2z"/>
                                <path fillRule="evenodd" d="M9 3v10H8V3h1z"/>
                                <path d="M8 2.82a1 1 0 0 1 .804-.98l3-.6A1 1 0 0 1 13 2.22V4L8 5V2.82z"/>
                              </svg>
                              {item.data?.title || t('presenter.unknownSong')}
                            </span>
                          ),
                          bgColor: 'transparent',
                          borderLeft: '4px solid #667eea'
                        };
                      } else if (item.type === 'bible') {
                        return {
                          title: (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <svg width="14" height="14" viewBox="0 0 16 16" fill="white">
                                <path d="M1 2.828c.885-.37 2.154-.769 3.388-.893 1.33-.134 2.458.063 3.112.752v9.746c-.935-.53-2.12-.603-3.213-.493-1.18.12-2.37.461-3.287.811zm7.5-.141c.654-.689 1.782-.886 3.112-.752 1.234.124 2.503.523 3.388.893v9.923c-.918-.35-2.107-.692-3.287-.81-1.094-.111-2.278-.039-3.213.492zM8 1.783C7.015.936 5.587.81 4.287.94c-1.514.153-3.042.672-3.994 1.105A.5.5 0 0 0 0 2.5v11a.5.5 0 0 0 .707.455c.882-.4 2.303-.881 3.68-1.02 1.409-.142 2.59.087 3.223.877a.5.5 0 0 0 .78 0c.633-.79 1.814-1.019 3.222-.877 1.378.139 2.8.62 3.681 1.02A.5.5 0 0 0 16 13.5v-11a.5.5 0 0 0-.293-.455c-.952-.433-2.48-.952-3.994-1.105C10.413.809 8.985.936 8 1.783"/>
                              </svg>
                              {item.data?.title || t('presenter.biblePassage')}
                            </span>
                          ),
                          bgColor: 'transparent',
                          borderLeft: '4px solid #764ba2'
                        };
                      } else if (item.type === 'image') {
                        return {
                          title: (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <svg width="14" height="14" viewBox="0 0 16 16" fill="white">
                                <path d="M6.002 5.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/>
                                <path d="M2.002 1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2h-12zm12 1a1 1 0 0 1 1 1v6.5l-3.777-1.947a.5.5 0 0 0-.577.093l-3.71 3.71-2.66-1.772a.5.5 0 0 0-.63.062L1.002 12V3a1 1 0 0 1 1-1h12z"/>
                              </svg>
                              {item.data?.name || t('presenter.imageSlide')}
                            </span>
                          ),
                          bgColor: 'transparent',
                          borderLeft: '4px solid #4facfe'
                        };
                      } else if (item.type === 'presentation') {
                        return {
                          title: (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <svg width="14" height="14" viewBox="0 0 16 16" fill="white">
                                <path d="M8 0a.5.5 0 0 1 .473.337L9.046 2H14a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-1.85l1.323 3.837a.5.5 0 1 1-.946.326L11.092 11H8.5v3a.5.5 0 0 1-1 0v-3H4.908l-1.435 4.163a.5.5 0 1 1-.946-.326L3.85 11H2a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h4.954L7.527.337A.5.5 0 0 1 8 0M2 3v7h12V3z"/>
                              </svg>
                              {item.data?.title || t('presenter.presentation', 'Presentation')}
                            </span>
                          ),
                          bgColor: 'transparent',
                          borderLeft: '4px solid #10b981'
                        };
                      } else if (item.type === 'blank') {
                        return {
                          title: t('presenter.blankSlide'),
                          bgColor: 'transparent',
                          borderLeft: '4px solid #f093fb'
                        };
                      } else if (item.type === 'youtube') {
                        return {
                          title: (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <svg width="14" height="14" viewBox="0 0 16 16" fill="#FF0000">
                                <path d="M8.051 1.999h.089c.822.003 4.987.033 6.11.335a2.01 2.01 0 0 1 1.415 1.42c.101.38.172.883.22 1.402l.01.104.022.26.008.104c.065.914.073 1.77.074 1.957v.075c-.001.194-.01 1.108-.082 2.06l-.008.105-.009.104c-.05.572-.124 1.14-.235 1.558a2.007 2.007 0 0 1-1.415 1.42c-1.16.312-5.569.334-6.18.335h-.142c-.309 0-1.587-.006-2.927-.052l-.17-.006-.087-.004-.171-.007-.171-.007c-1.11-.049-2.167-.128-2.654-.26a2.007 2.007 0 0 1-1.415-1.419c-.111-.417-.185-.986-.235-1.558L.09 9.82l-.008-.104A31.4 31.4 0 0 1 0 7.68v-.123c.002-.215.01-.958.064-1.778l.007-.103.003-.052.008-.104.022-.26.01-.104c.048-.519.119-1.023.22-1.402a2.007 2.007 0 0 1 1.415-1.42c.487-.13 1.544-.21 2.654-.26l.17-.007.172-.006.086-.003.171-.007A99.788 99.788 0 0 1 7.858 2h.193zM6.4 5.209v4.818l4.157-2.408L6.4 5.209z"/>
                              </svg>
                              {item.youtubeData?.title || t('presenter.youtubeVideo', 'YouTube Video')}
                            </span>
                          ),
                          bgColor: 'transparent',
                          borderLeft: '4px solid #FF0000'
                        };
                      } else if (item.type === 'section') {
                        return {
                          title: item.data?.title || t('presenter.section'),
                          bgColor: 'rgba(255, 255, 255, 0.1)',
                          borderLeft: 'none',
                          isSection: true
                        };
                      } else if (item.type === 'tool') {
                        const toolData = item.data;
                        let title = '';
                        if (toolData.toolType === 'countdown') {
                          // Build message preview: first word + first letter of second word
                          let messagePreview = '';
                          if (toolData.message) {
                            const words = toolData.message.trim().split(' ');
                            messagePreview = words[0] || '';
                            if (words[1]) {
                              messagePreview += ' ' + words[1].charAt(0) + '...';
                            }
                          }
                          title = (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="13" r="8"/>
                                <path d="M12 9v4l2 2"/>
                                <path d="M5 3L2 6"/>
                                <path d="M22 6l-3-3"/>
                                <path d="M12 2v2"/>
                              </svg>
                              {toolData.targetTime}{messagePreview && ` "${messagePreview}"`}
                            </span>
                          );
                        } else if (toolData.toolType === 'messages') {
                          // Build preview: first word of each message followed by ..
                          let messagePreview = '';
                          if (toolData.messages && toolData.messages.length > 0) {
                            messagePreview = toolData.messages
                              .map(msg => {
                                const firstWord = msg.trim().split(' ')[0] || '';
                                return firstWord + '..';
                              })
                              .join(' ');
                          }
                          title = (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <svg width="14" height="14" viewBox="0 0 16 16" fill="white">
                                <path d="M14 1a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4.414A2 2 0 0 0 3 11.586l-2 2V2a1 1 0 0 1 1-1h12zM2 0a2 2 0 0 0-2 2v12.793a.5.5 0 0 0 .854.353l2.853-2.853A1 1 0 0 1 4.414 12H14a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2z"/>
                                <path d="M3 3.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zM3 6a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9A.5.5 0 0 1 3 6zm0 2.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5z"/>
                              </svg>
                              "{messagePreview}"
                            </span>
                          );
                        } else if (toolData.toolType === 'announcement') {
                          // Build text preview: first word + first letter of second word
                          const words = toolData.text.split(' ');
                          let preview = words[0] || '';
                          if (words[1]) {
                            preview += ' ' + words[1].charAt(0) + '...';
                          }
                          title = (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <svg width="14" height="14" viewBox="0 0 16 16" fill="white">
                                <path d="M8 16a2 2 0 0 0 2-2H6a2 2 0 0 0 2 2zm.995-14.901a1 1 0 1 0-1.99 0A5.002 5.002 0 0 0 3 6c0 1.098-.5 6-2 7h14c-1.5-1-2-5.902-2-7 0-2.42-1.72-4.44-4.005-4.901z"/>
                              </svg>
                              "{preview}"
                            </span>
                          );
                        }
                        return {
                          title,
                          bgColor: 'transparent',
                          borderLeft: '4px solid #f59e0b'
                        };
                      }
                      return { title: t('presenter.unknown'), bgColor: 'transparent', borderLeft: '4px solid #718096' };
                    };

                    const display = getItemDisplay();

                    // Render section headers differently - smaller than song items
                    if (display.isSection) {
                      return (
                        <div
                          key={index}
                          data-setlist-item
                          draggable={!isMobile}
                          onDragStart={(e) => handleDragStart(e, index)}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, index)}
                          onTouchStart={(e) => handleTouchStart(e, index)}
                          onTouchMove={(e) => handleTouchMove(e, index)}
                          onTouchEnd={handleTouchEnd}
                          style={{
                            padding: '3px 8px',
                            backgroundColor: touchDragIndex === index
                              ? 'rgba(102, 126, 234, 0.4)'
                              : touchHoldingIndex === index
                                ? 'rgba(102, 126, 234, 0.25)'
                                : 'rgba(139, 92, 246, 0.3)',
                            borderRadius: '3px',
                            marginBottom: '2px',
                            marginTop: index === 0 ? '0' : '6px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            cursor: 'grab',
                            transition: 'all 0.2s ease',
                            touchAction: 'none'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', flex: 1, gap: '5px' }}>
                            <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)', cursor: 'grab' }}>
                              ⋮⋮
                            </span>
                            <span style={{
                              fontSize: '0.65rem',
                              fontWeight: '600',
                              color: 'rgba(255,255,255,0.85)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              {display.title}
                            </span>
                          </div>
                          <span
                            onClick={() => removeFromSetlist(index)}
                            style={{
                              cursor: 'pointer',
                              opacity: 0.5,
                              fontSize: '0.6rem',
                              color: 'white',
                              padding: '1px 3px'
                            }}
                          >
                            ✕
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={index}
                        data-setlist-item
                        draggable={!isMobile}
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, index)}
                        onTouchStart={(e) => handleTouchStart(e, index)}
                        onTouchMove={(e) => handleTouchMove(e, index)}
                        onTouchEnd={handleTouchEnd}
                        style={{
                          padding: '5px 7px',
                          backgroundColor: touchDragIndex === index
                            ? 'rgba(102, 126, 234, 0.3)'
                            : touchHoldingIndex === index
                              ? 'rgba(102, 126, 234, 0.15)'
                              : (focusedAnnouncementIndex === index || activeSetlistAnnouncementIndex === index || focusedCountdownIndex === index || activeSetlistCountdownIndex === index || focusedMessagesIndex === index || activeSetlistMessagesIndex === index)
                                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                                : isItemSelected
                                  ? 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)'
                                  : display.bgColor,
                          background: (focusedAnnouncementIndex === index || activeSetlistAnnouncementIndex === index || focusedCountdownIndex === index || activeSetlistCountdownIndex === index || focusedMessagesIndex === index || activeSetlistMessagesIndex === index) && touchDragIndex !== index && touchHoldingIndex !== index
                            ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                            : isItemSelected && touchDragIndex !== index && touchHoldingIndex !== index
                              ? 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)'
                              : undefined,
                          borderRadius: '8px',
                          borderLeft: display.borderLeft,
                          marginBottom: '6px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          cursor: 'grab',
                          transition: 'all 0.2s ease',
                          border: (focusedAnnouncementIndex === index || activeSetlistAnnouncementIndex === index || focusedCountdownIndex === index || activeSetlistCountdownIndex === index || focusedMessagesIndex === index || activeSetlistMessagesIndex === index)
                            ? '2px solid #764ba2'
                            : isItemSelected
                              ? '2px solid var(--color-primary)'
                              : '1px solid rgba(255,255,255,0.3)',
                          boxShadow: touchDragIndex === index
                            ? '0 4px 12px rgba(0, 0, 0, 0.3)'
                            : touchHoldingIndex === index
                              ? '0 2px 8px rgba(102, 126, 234, 0.3)'
                              : (focusedAnnouncementIndex === index || activeSetlistAnnouncementIndex === index || focusedCountdownIndex === index || activeSetlistCountdownIndex === index || focusedMessagesIndex === index || activeSetlistMessagesIndex === index)
                                ? '0 2px 8px rgba(118, 75, 162, 0.4)'
                                : isItemSelected
                                  ? '0 2px 8px rgba(0,123,255,0.25)'
                                  : 'none',
                          transform: touchDragIndex === index ? 'scale(1.02)' : 'none',
                          touchAction: 'none'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateX(2px)';
                          e.currentTarget.style.borderColor = '#FF8C42';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateX(0)';
                          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', flex: 1, gap: '8px' }}>
                          <span style={{ fontSize: '0.95rem', color: 'rgba(255,255,255,0.7)', cursor: 'grab' }}>
                            ⋮⋮
                          </span>
                          <span
                            style={{ fontSize: '0.95rem', cursor: 'pointer', flex: 1, fontWeight: '400', color: 'white' }}
                            onClick={() => {
                              const now = Date.now();
                              const DOUBLE_TAP_DELAY = 300;
                              if (lastSetlistTapRef.current.index === index && now - lastSetlistTapRef.current.time < DOUBLE_TAP_DELAY) {
                                // Double tap detected - remove from setlist
                                removeFromSetlist(index);
                                lastSetlistTapRef.current = { time: 0, index: null };
                              } else {
                                // Single tap - select item
                                if (item.type === 'tool' && item.data?.toolType === 'announcement') {
                                  // For announcements, just focus it without changing current selection
                                  setFocusedAnnouncementIndex(index);
                                  setFocusedCountdownIndex(null);
                                  setFocusedMessagesIndex(null);
                                  setAnnouncementText(item.data.text);
                                  setActiveResourcePanel('tools');
                                  setActiveToolsTab('announce');
                                } else if (item.type === 'tool' && item.data?.toolType === 'countdown') {
                                  // For countdowns, just focus it without changing current selection
                                  setFocusedCountdownIndex(index);
                                  setFocusedAnnouncementIndex(null);
                                  setFocusedMessagesIndex(null);
                                  setCountdownTargetTime(item.data.targetTime);
                                  setCountdownMessage(item.data.message || '');
                                  setActiveResourcePanel('tools');
                                  setActiveToolsTab('countdown');
                                } else if (item.type === 'tool' && item.data?.toolType === 'messages') {
                                  // For messages, just focus it without changing current selection
                                  setFocusedMessagesIndex(index);
                                  setFocusedAnnouncementIndex(null);
                                  setFocusedCountdownIndex(null);
                                  setActiveResourcePanel('tools');
                                  setActiveToolsTab('messages');
                                } else {
                                  // For other items, clear tool focus and select normally
                                  setFocusedAnnouncementIndex(null);
                                  setFocusedCountdownIndex(null);
                                  setFocusedMessagesIndex(null);
                                  selectItem(item, index);
                                }
                                lastSetlistTapRef.current = { time: now, index: index };
                              }
                            }}
                          >
                            {display.title}
                          </span>
                        </div>
                        {/* Show/Hide button for countdown tools - visible when focused or active */}
                        {item.type === 'tool' && item.data?.toolType === 'countdown' && (focusedCountdownIndex === index || activeSetlistCountdownIndex === index) && (
                          <Button
                            variant={activeSetlistCountdownIndex === index ? 'danger' : 'success'}
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSetlistCountdown(index, item.data);
                            }}
                            style={{
                              fontSize: '0.7rem',
                              padding: '2px 8px',
                              marginRight: '8px'
                            }}
                          >
                            {activeSetlistCountdownIndex === index ? t('presenter.hide') : t('presenter.show')}
                          </Button>
                        )}
                        {/* Show/Hide button for announcement tools - visible when focused or active */}
                        {item.type === 'tool' && item.data?.toolType === 'announcement' && (focusedAnnouncementIndex === index || activeSetlistAnnouncementIndex === index) && (
                          <Button
                            variant={activeSetlistAnnouncementIndex === index ? 'danger' : 'success'}
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSetlistAnnouncement(index, item.data);
                            }}
                            style={{
                              fontSize: '0.7rem',
                              padding: '2px 8px',
                              marginRight: '8px'
                            }}
                          >
                            {activeSetlistAnnouncementIndex === index ? t('presenter.hide') : t('presenter.show')}
                          </Button>
                        )}
                        {/* Show/Hide button for messages tools - visible when focused or active */}
                        {item.type === 'tool' && item.data?.toolType === 'messages' && (focusedMessagesIndex === index || activeSetlistMessagesIndex === index) && (
                          <Button
                            variant={activeSetlistMessagesIndex === index ? 'danger' : 'success'}
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSetlistMessages(index, item.data);
                            }}
                            style={{
                              fontSize: '0.7rem',
                              padding: '2px 8px',
                              marginRight: '8px'
                            }}
                          >
                            {activeSetlistMessagesIndex === index ? t('presenter.hide') : t('presenter.show')}
                          </Button>
                        )}
                        <span
                          onClick={() => removeFromSetlist(index)}
                          style={{
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            color: (isItemSelected || focusedAnnouncementIndex === index || activeSetlistAnnouncementIndex === index || focusedCountdownIndex === index || activeSetlistCountdownIndex === index || focusedMessagesIndex === index || activeSetlistMessagesIndex === index) ? '#ffffff' : '#ff6b6b',
                            padding: '4px 8px'
                          }}
                        >
                          ✕
                        </span>
                      </div>
                    );
                  });
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Slide Preview Section */}
      <div style={{
        backgroundColor: 'transparent',
        borderRadius: '15px',
        overflow: 'hidden',
        borderTop: '1px solid rgba(255,255,255,0.6)',
        boxShadow: '0 -1px 8px rgba(255,255,255,0.15)',
        paddingTop: '12px'
      }}>
        <div
          style={{
            padding: '15px 20px',
            backgroundColor: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            flexWrap: 'nowrap'
          }}
        >
          {/* Title with collapse toggle */}
          <div
            onClick={() => setSlideSectionOpen(!slideSectionOpen)}
            style={{
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              flex: '0 1 auto',
              minWidth: '0',
              overflow: 'hidden'
            }}
          >
            <span style={{ fontSize: '1.5rem', marginRight: '10px', flexShrink: 0, color: 'white' }}>
              {slideSectionOpen ? '▼' : '▶'}
            </span>
            <span style={{
              fontSize: '1.2rem',
              fontWeight: '500',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: 'white'
            }}>
              {selectedPresentation && activeResourcePanel === 'presentations'
                ? selectedPresentation.title
                : currentItem
                  ? currentItem.type === 'song'
                    ? currentItem.data?.title
                    : currentItem.type === 'bible'
                    ? currentItem.data?.title
                    : currentItem.type === 'presentation'
                    ? currentItem.data?.title
                    : currentItem.type === 'image'
                    ? `${t('presenter.image')}: ${currentItem.data?.name}`
                    : t('presenter.blankSlide')
                  : t('presenter.noItemSelected')}
            </span>
          </div>

          {/* Verse/Section Navigation Buttons */}
          {currentSong && currentSong.slides && (() => {
            // Get unique verse sections with their first occurrence index
            const verseSections = [];
            const seenTypes = new Set();
            currentSong.slides.forEach((slide, index) => {
              if (slide.verseType && !seenTypes.has(slide.verseType)) {
                seenTypes.add(slide.verseType);
                verseSections.push({ type: slide.verseType, index });
              }
            });

            // Helper to abbreviate verse types
            const getAbbreviation = (verseType) => {
              switch(verseType) {
                case 'Intro': return 'In';
                case 'Verse1': return 'V1';
                case 'Verse2': return 'V2';
                case 'Verse3': return 'V3';
                case 'Verse4': return 'V4';
                case 'PreChorus': return 'PC';
                case 'Chorus': return 'Ch';
                case 'Bridge': return 'Br';
                case 'Instrumental': return '🎸';
                case 'Outro': return 'Out';
                case 'Tag': return 'Tag';
                default: return verseType?.substring(0, 2) || '?';
              }
            };

            // Helper to get button color based on verse type
            const getButtonColor = (verseType) => {
              switch(verseType) {
                case 'Intro': return 'rgba(255,255,255,0.3)';
                case 'Verse1': return 'rgba(255,193,7,0.8)';   // Bright yellow
                case 'Verse2': return 'rgba(255,167,38,0.8)';  // Orange-yellow
                case 'Verse3': return 'rgba(255,213,79,0.8)';  // Light yellow
                case 'Verse4': return 'rgba(251,192,45,0.8)';  // Golden yellow
                case 'PreChorus': return 'rgba(233,30,99,0.6)';
                case 'Chorus': return 'rgba(3,169,244,0.7)';
                case 'Bridge': return 'rgba(156,39,176,0.6)';
                case 'Instrumental': return 'rgba(76,175,80,0.6)';
                case 'Outro': return 'rgba(255,152,0,0.7)';
                case 'Tag': return 'rgba(103,58,183,0.6)';
                default: return 'rgba(255,255,255,0.3)';
              }
            };

            if (verseSections.length <= 1) return null;

            return (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                flexWrap: 'wrap',
                flex: '1 1 auto',
                justifyContent: 'center'
              }}>
                {verseSections.map((section, idx) => (
                  <button
                    key={idx}
                    onClick={(e) => {
                      e.stopPropagation();
                      selectSlide(section.index);
                    }}
                    title={section.type}
                    style={{
                      padding: '2px 6px',
                      fontSize: '0.7rem',
                      fontWeight: 'bold',
                      border: currentSlideIndex === section.index ? '2px solid white' : '1px solid rgba(255,255,255,0.4)',
                      borderRadius: '4px',
                      backgroundColor: getButtonColor(section.type),
                      color: 'white',
                      cursor: 'pointer',
                      minWidth: '28px',
                      textAlign: 'center'
                    }}
                  >
                    {getAbbreviation(section.type)}
                  </button>
                ))}
              </div>
            );
          })()}

          {/* Controls */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            flexShrink: 0
          }}>
            {isMobile ? (
              // Mobile: 3-dot menu
              <Dropdown align="end" drop="down">
                <Dropdown.Toggle
                  variant="outline-light"
                  size="sm"
                  style={{
                    fontSize: '1.2rem',
                    padding: '2px 8px',
                    lineHeight: '1'
                  }}
                >
                  ⋮
                </Dropdown.Toggle>

                <Dropdown.Menu style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  <Dropdown.Item onClick={toggleBlankSlide}>
                    {isBlankActive ? `⚫ ${t('presenter.blankOn')}` : `⚪ ${t('presenter.blankOff')}`}
                  </Dropdown.Item>
                  <Dropdown.Item onClick={openQuickSlideModal}>
                    ⚡ {t('presenter.quickSlide')}
                  </Dropdown.Item>
                  <Dropdown.Item onClick={() => setShowBackgroundModal(true)}>
                    🖼️ {t('presenter.background')}
                  </Dropdown.Item>
                  <Dropdown.Divider />
                  <Dropdown.Item onClick={toggleDisplayMode}>
                    {displayMode === 'original' ? `🔤 ${t('presenter.switchToBilingual')}` : `🔤 ${t('presenter.switchToOriginal')}`}
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            ) : (
              // Desktop: Regular buttons
              <>
                <Button
                  variant={isBlankActive ? 'warning' : 'dark'}
                  onClick={toggleBlankSlide}
                  size="sm"
                  style={{ fontSize: '0.8rem', padding: '4px 10px', whiteSpace: 'nowrap' }}
                >
                  {isBlankActive ? t('presenter.blankOn') : t('presenter.blank')}
                </Button>

                <Button
                  variant="success"
                  onClick={openQuickSlideModal}
                  size="sm"
                  style={{ fontSize: '0.8rem', padding: '4px 10px', whiteSpace: 'nowrap' }}
                  title={t('presenter.quickSlideTitle')}
                >
                  ⚡ {t('presenter.quick')}
                </Button>

                <Button
                  variant="info"
                  onClick={() => setShowBackgroundModal(true)}
                  size="sm"
                  style={{ fontSize: '0.8rem', padding: '4px 10px', whiteSpace: 'nowrap' }}
                >
                  {t('presenter.background')}
                </Button>

                <Button
                  variant="primary"
                  onClick={toggleDisplayMode}
                  size="sm"
                  style={{ fontSize: '0.8rem', padding: '4px 10px', whiteSpace: 'nowrap' }}
                >
                  {displayMode === 'original' ? t('presenter.original') : t('presenter.bilingual')}
                </Button>
              </>
            )}
          </div>
        </div>

        {slideSectionOpen && currentSong && (
          <div>
            <div style={{
              padding: '8px',
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
              gap: '6px',
              alignContent: 'start'
            }}>
            {/* Combined slides view for original-only mode */}
            {displayMode === 'original' && combinedSlides ? (
              combinedSlides.combinedSlides.map((item, combinedIndex) => {
                const isSelected = selectedCombinedIndex === combinedIndex;
                const verseType = item.verseType || '';

                return (
                  <div
                    key={combinedIndex}
                    onClick={() => selectCombinedSlide(combinedIndex)}
                    style={{
                      position: 'relative',
                      border: isSelected ? '2px solid #00d4ff' : `1px solid ${getSlidePreviewBorderColor(verseType, false)}`,
                      borderRadius: '6px',
                      padding: '6px 8px',
                      paddingLeft: isSelected ? '14px' : '8px',
                      cursor: 'pointer',
                      backgroundColor: getSlidePreviewBackgroundColor(verseType, false),
                      boxShadow: isSelected ? '0 0 12px rgba(0, 212, 255, 0.5), inset 0 0 20px rgba(0, 212, 255, 0.1)' : 'none',
                      transition: 'all 0.15s ease',
                      userSelect: 'none',
                      transform: isSelected ? 'scale(1.02)' : 'scale(1)'
                    }}
                    onMouseDown={(e) => {
                      if (!isSelected) e.currentTarget.style.transform = 'scale(0.98)';
                    }}
                    onMouseUp={(e) => {
                      e.currentTarget.style.transform = isSelected ? 'scale(1.02)' : 'scale(1)';
                    }}
                  >
                    {/* Left accent bar for selected slide */}
                    {isSelected && (
                      <div style={{
                        position: 'absolute',
                        left: '0',
                        top: '0',
                        bottom: '0',
                        width: '4px',
                        background: 'linear-gradient(180deg, #00d4ff 0%, #0099ff 100%)',
                        borderRadius: '6px 0 0 6px'
                      }} />
                    )}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: isSelected ? '#00d4ff' : 'rgba(255,255,255,0.7)',
                      fontWeight: 'bold',
                      marginBottom: '4px',
                      fontSize: '0.75rem'
                    }}>
                      {isSelected && <span style={{ fontSize: '0.7rem' }}>▶</span>}
                      {/* Show label like "Verse 1-2" or "3-4" */}
                      {item.type === 'combined' ? (
                        <span>
                          {verseType ? `${verseType} ` : ''}{item.label}
                          <span style={{ marginLeft: '4px', fontSize: '0.65rem', opacity: 0.7 }}>●●</span>
                        </span>
                      ) : (
                        <span>{verseType ? `${verseType} ` : ''}{item.label}</span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.85rem', lineHeight: '1.3', color: 'white' }}>
                      {item.type === 'combined' ? (
                        <>
                          <div style={{ marginBottom: '4px', textAlign: currentSong.isBible ? 'right' : 'inherit', direction: currentSong.isBible ? 'rtl' : 'inherit' }}>
                            {item.slides[0].originalText}
                          </div>
                          <div style={{
                            paddingTop: '4px',
                            borderTop: '1px dashed rgba(255,255,255,0.3)',
                            textAlign: currentSong.isBible ? 'right' : 'inherit',
                            direction: currentSong.isBible ? 'rtl' : 'inherit'
                          }}>
                            {item.slides[1].originalText}
                          </div>
                        </>
                      ) : (
                        <div style={{ textAlign: currentSong.isBible ? 'right' : 'inherit', direction: currentSong.isBible ? 'rtl' : 'inherit' }}>
                          {item.slide.originalText}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              /* Regular single-slide view for bilingual mode */
              currentSong.slides.map((slide, index) => {
                const isSelected = currentSlideIndex === index;

                return (
                  <div
                    key={index}
                    onClick={() => selectSlide(index)}
                    style={{
                      position: 'relative',
                      border: isSelected ? '2px solid #00d4ff' : `1px solid ${getSlidePreviewBorderColor(slide.verseType, false)}`,
                      borderRadius: '6px',
                      padding: '6px 8px',
                      paddingLeft: isSelected ? '14px' : '8px',
                      cursor: 'pointer',
                      backgroundColor: getSlidePreviewBackgroundColor(slide.verseType, false),
                      boxShadow: isSelected ? '0 0 12px rgba(0, 212, 255, 0.5), inset 0 0 20px rgba(0, 212, 255, 0.1)' : 'none',
                      transition: 'all 0.15s ease',
                      userSelect: 'none',
                      transform: isSelected ? 'scale(1.02)' : 'scale(1)'
                    }}
                    onMouseDown={(e) => {
                      if (!isSelected) e.currentTarget.style.transform = 'scale(0.98)';
                    }}
                    onMouseUp={(e) => {
                      e.currentTarget.style.transform = isSelected ? 'scale(1.02)' : 'scale(1)';
                    }}
                  >
                    {/* Left accent bar for selected slide */}
                    {isSelected && (
                      <div style={{
                        position: 'absolute',
                        left: '0',
                        top: '0',
                        bottom: '0',
                        width: '4px',
                        background: 'linear-gradient(180deg, #00d4ff 0%, #0099ff 100%)',
                        borderRadius: '6px 0 0 6px'
                      }} />
                    )}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: isSelected ? '#00d4ff' : 'rgba(255,255,255,0.7)',
                      fontWeight: 'bold',
                      marginBottom: '4px',
                      fontSize: '0.75rem'
                    }}>
                      {isSelected && <span style={{ fontSize: '0.7rem' }}>▶</span>}
                      {currentSong.isBible
                        ? `${t('presenter.verse')} ${slide.verseNumber || index + 1}`
                        : slide.verseType
                        ? (index === 0 || currentSong.slides[index - 1]?.verseType !== slide.verseType)
                          ? `${slide.verseType}`
                          : `${index + 1}`
                        : `${index + 1}`}
                    </div>
                    <div style={{ fontSize: '0.85rem', lineHeight: '1.3', color: 'white' }}>
                      <div style={{ marginBottom: '2px', textAlign: currentSong.isBible ? 'right' : 'inherit', direction: currentSong.isBible ? 'rtl' : 'inherit' }}>
                        {slide.originalText}
                      </div>
                      {displayMode === 'bilingual' && slide.transliteration && (
                        <div style={{ marginBottom: '2px', color: 'rgba(255,255,255,0.85)' }}>
                          {slide.transliteration}
                        </div>
                      )}
                      {displayMode === 'bilingual' && slide.translation && (
                        <div style={{ marginBottom: '2px', color: 'rgba(255,255,255,0.85)', textAlign: currentSong.isBible ? 'left' : 'inherit', direction: currentSong.isBible ? 'ltr' : 'inherit' }}>
                          {slide.translation}
                        </div>
                      )}
                      {displayMode === 'bilingual' && slide.translationOverflow && (
                        <div style={{ marginBottom: '2px', color: 'rgba(255,255,255,0.85)', textAlign: currentSong.isBible ? 'left' : 'inherit', direction: currentSong.isBible ? 'ltr' : 'inherit' }}>
                          {slide.translationOverflow}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          </div>
        )}

        {slideSectionOpen && currentItem && currentItem.type === 'image' && (
          <div style={{ padding: '20px' }}>
            <div
              onClick={() => {
                setCurrentSlideIndex(0);
                updateImageSlide(currentItem.data);
              }}
              style={{
                width: '100%',
                height: '400px',
                background: currentItem.data?.url.startsWith('linear-gradient')
                  ? currentItem.data.url
                  : `url(${getFullImageUrl(currentItem.data?.url)})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                borderRadius: '10px',
                border: currentSlideIndex === 0 ? '4px solid #28a745' : '2px solid rgba(255,255,255,0.3)',
                boxShadow: currentSlideIndex === 0 ? '0 0 20px rgba(40, 167, 69, 0.5)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                position: 'relative'
              }}
            >
              {currentSlideIndex === 0 && (
                <div style={{
                  position: 'absolute',
                  top: '10px',
                  right: '10px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '0.8rem',
                  fontWeight: '600'
                }}>
                  LIVE
                </div>
              )}
            </div>
            <div style={{
              marginTop: '15px',
              textAlign: 'center',
              fontSize: '1.1rem',
              color: 'white'
            }}>
              {currentItem.data?.name}
            </div>
          </div>
        )}

        {/* Presentation slides preview when a presentation is selected from list */}
        {slideSectionOpen && selectedPresentation && activeResourcePanel === 'presentations' && (
          <div style={{ padding: '8px' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: '8px'
            }}>
              {selectedPresentation.slides?.map((slide, index) => (
                <div
                  key={slide.id || index}
                  onClick={() => {
                    setSelectedPresentationSlideIndex(index);
                    // Clear tools and local media overlay before broadcasting
                    stopNonOverlayTools();
                    // Project the presentation slide to viewers
                    socketService.operatorUpdateSlide({
                      roomId: room.id,
                      roomPin: room.pin,
                      backgroundImage: room.backgroundImage || '',
                      songId: null,
                      slideIndex: index,
                      displayMode: displayMode,
                      isBlank: false,
                      presentationData: {
                        presentationId: selectedPresentation.id,
                        slide: slide,
                        canvasDimensions: selectedPresentation.canvasDimensions || { width: 1920, height: 1080 },
                        bypassTheme: true
                      }
                    });
                  }}
                  style={{
                    aspectRatio: '16/9',
                    borderRadius: '6px',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    border: selectedPresentationSlideIndex === index
                      ? '2px solid #6366f1'
                      : '1px solid rgba(255,255,255,0.2)',
                    background: slide.backgroundColor || 'linear-gradient(-45deg, #0a0a0a, #1a1a2e)',
                    position: 'relative',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {/* Slide number */}
                  <div style={{
                    position: 'absolute',
                    top: '4px',
                    left: '4px',
                    fontSize: '10px',
                    color: 'rgba(255,255,255,0.8)',
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    padding: '2px 6px',
                    borderRadius: '3px',
                    zIndex: 2
                  }}>
                    {index + 1}
                  </div>
                  {/* Text boxes preview */}
                  {slide.textBoxes?.map((tb) => (
                    <div
                      key={tb.id}
                      style={{
                        position: 'absolute',
                        left: `${tb.x}%`,
                        top: `${tb.y}%`,
                        width: `${tb.width}%`,
                        height: `${tb.height}%`,
                        backgroundColor: tb.backgroundColor || 'transparent',
                        overflow: 'hidden'
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          left: 0,
                          right: 0,
                          top: tb.verticalAlign === 'top' ? 0 : 'auto',
                          bottom: tb.verticalAlign === 'bottom' ? 0 : 'auto',
                          ...((!tb.verticalAlign || tb.verticalAlign === 'center') && {
                            top: '50%',
                            transform: 'translateY(-50%)'
                          }),
                          fontSize: '8px',
                          fontWeight: tb.bold ? 'bold' : 'normal',
                          fontStyle: tb.italic ? 'italic' : 'normal',
                          color: tb.color || '#fff',
                          textAlign: tb.textAlign || 'center',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          padding: '2px',
                          boxSizing: 'border-box'
                        }}
                      >
                        {tb.text?.substring(0, 50) || ''}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}


        {/* YouTube Preview Section */}
        {slideSectionOpen && currentItem && currentItem.type === 'youtube' && (
          <div style={{ padding: '16px' }}>
            <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px', backgroundColor: '#000' }}>
              <img src={currentItem.youtubeData?.thumbnail} alt={currentItem.youtubeData?.title} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: youtubeOnDisplay ? 0.7 : 1 }} />
              {youtubeOnDisplay && (<div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', backgroundColor: 'rgba(0,0,0,0.7)', padding: '8px 16px', borderRadius: '8px', color: '#FF0000', fontWeight: 'bold', fontSize: '0.9rem' }}>{youtubePlaying ? 'PLAYING' : 'ON DISPLAY'}</div>)}
              {!youtubeOnDisplay && (<div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '60px', height: '60px', backgroundColor: 'rgba(255,0,0,0.9)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} onClick={handleYoutubePresent}><svg width="24" height="24" fill="white" viewBox="0 0 16 16"><path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/></svg></div>)}
            </div>
            <div style={{ color: 'white', fontSize: '1rem', fontWeight: '500', marginBottom: '12px', textAlign: 'center' }}>{currentItem.youtubeData?.title}</div>
            {youtubeOnDisplay && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <span style={{ color: 'white', fontSize: '0.8rem', minWidth: '45px' }}>{Math.floor(youtubeCurrentTime / 60)}:{String(Math.floor(youtubeCurrentTime % 60)).padStart(2, '0')}</span>
                  <input type="range" min="0" max={youtubeDuration || 100} value={youtubeCurrentTime} onChange={(e) => handleYoutubeSeek(parseFloat(e.target.value))} style={{ flex: 1, height: '6px', cursor: 'pointer', accentColor: '#FF0000' }} />
                  <span style={{ color: 'white', fontSize: '0.8rem', minWidth: '45px', textAlign: 'right' }}>{youtubeDuration ? `${Math.floor(youtubeDuration / 60)}:${String(Math.floor(youtubeDuration % 60)).padStart(2, '0')}` : '--:--'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                  <Button variant={youtubePlaying ? 'warning' : 'success'} onClick={youtubePlaying ? handleYoutubePause : handleYoutubePlay} style={{ borderRadius: '50%', width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                    {youtubePlaying ? (<svg width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5zm5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5z"/></svg>) : (<svg width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/></svg>)}
                  </Button>
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              {!youtubeOnDisplay ? (<Button variant="danger" onClick={handleYoutubePresent} style={{ padding: '10px 24px', borderRadius: '8px', fontWeight: '500' }}>{t('presenter.present', 'Present')}</Button>) : (<Button variant="secondary" onClick={handleYoutubeStop} style={{ padding: '10px 24px', borderRadius: '8px', fontWeight: '500' }}>{t('presenter.stop', 'Stop')}</Button>)}
            </div>
          </div>
        )}

        {slideSectionOpen && !currentItem && !(selectedPresentation && activeResourcePanel === 'presentations') && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'white' }}>
            {t('presenter.selectSongOrItem')}
          </div>
        )}
      </div>

      {/* Keyboard Shortcuts Help Button - Fixed Bottom Right */}
      <button
        onClick={() => setShowKeyboardHelp(!showKeyboardHelp)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          width: '50px',
          height: '50px',
          borderRadius: '50%',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          fontSize: '1.3rem',
          fontWeight: 'bold',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        title={t('presenter.keyboardShortcuts')}
      >
        ?
      </button>

      {/* Keyboard Shortcuts Help Modal */}
      <Modal show={showKeyboardHelp} onHide={() => setShowKeyboardHelp(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>{t('presenter.keyboardShortcuts')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div style={{ fontSize: '0.95rem' }}>
            <div style={{ marginBottom: '20px' }}>
              <h6 style={{ fontWeight: 'bold', marginBottom: '12px' }}>{t('presenter.navigation')}</h6>
              <div style={{ display: 'grid', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span><kbd style={{ padding: '2px 8px', backgroundColor: '#f0f0f0', borderRadius: '4px', border: '1px solid #ccc' }}>→</kbd> {t('presenter.rightArrow')}</span>
                  <span style={{ color: '#666' }}>{t('presenter.nextSlide')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span><kbd style={{ padding: '2px 8px', backgroundColor: '#f0f0f0', borderRadius: '4px', border: '1px solid #ccc' }}>←</kbd> {t('presenter.leftArrow')}</span>
                  <span style={{ color: '#666' }}>{t('presenter.previousSlide')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span><kbd style={{ padding: '2px 8px', backgroundColor: '#f0f0f0', borderRadius: '4px', border: '1px solid #ccc' }}>↓</kbd> {t('presenter.downArrow')}</span>
                  <span style={{ color: '#666' }}>{t('presenter.nextSong')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span><kbd style={{ padding: '2px 8px', backgroundColor: '#f0f0f0', borderRadius: '4px', border: '1px solid #ccc' }}>↑</kbd> {t('presenter.upArrow')}</span>
                  <span style={{ color: '#666' }}>{t('presenter.previousSong')}</span>
                </div>
              </div>
            </div>

            <div>
              <h6 style={{ fontWeight: 'bold', marginBottom: '12px' }}>{t('presenter.displayControl')}</h6>
              <div style={{ display: 'grid', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span><kbd style={{ padding: '2px 8px', backgroundColor: '#f0f0f0', borderRadius: '4px', border: '1px solid #ccc' }}>Space</kbd> or <kbd style={{ padding: '2px 8px', backgroundColor: '#f0f0f0', borderRadius: '4px', border: '1px solid #ccc' }}>B</kbd></span>
                  <span style={{ color: '#666' }}>{t('presenter.toggleBlankScreen')}</span>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '20px', padding: '12px', backgroundColor: '#f8f9fa', borderRadius: '8px', fontSize: '0.85rem', color: '#666' }}>
              <strong>{t('presenter.tip')}:</strong> {t('presenter.keyboardTip')}
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowKeyboardHelp(false)}>
            {t('common.close')}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Background Selection Modal */}
      {/* Quick Slide Modal */}
      <Modal
        show={showQuickSlideModal}
        onHide={() => {
          // Save current text from textarea to state and server
          const currentText = getCurrentQuickSlideText();
          setQuickSlideText(currentText);
          if (room?.id) {
            socketService.operatorUpdateQuickSlideText(room.id, currentText);
          }
          setShowQuickSlideModal(false);
          setSlideCount(0); // Reset slide count
        }}
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>⚡ {t('presenter.quickSlide')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div style={{ marginBottom: '15px', padding: '12px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
            <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '8px' }}>
              <strong>{t('presenter.howToUse')}</strong>
            </p>
            <ul style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0', paddingLeft: '20px' }}>
              <li>{t('presenter.quickSlideInstructions1')}</li>
              <li>{t('presenter.quickSlideInstructions2')}</li>
              <li>{t('presenter.quickSlideInstructions3')}</li>
            </ul>
          </div>

          <Form>
            <Form.Group className="mb-3">
              <Form.Label>{t('presenter.slideText')}</Form.Label>
              <Form.Control
                as="textarea"
                rows={12}
                ref={quickSlideTextareaRef}
                defaultValue={quickSlideText}
                onChange={(e) => {
                  // Update slide count for button rendering (lightweight state update)
                  const text = e.target.value;
                  if (!text.trim()) {
                    setSlideCount(0);
                  } else {
                    // Filter out empty blocks (e.g., when text ends with \n\n)
                    const blocks = text.split(/\n\s*\n/).filter(block => block.trim());
                    setSlideCount(blocks.length);
                  }
                }}
                placeholder={"Slide 1:\nLine 1: הללויה\nLine 2: Hallelujah\nLine 3: Praise the Lord\nLine 4: (optional overflow)\n\nSlide 2:\nLine 1: שלום\nLine 2: Shalom\nLine 3: Peace"}
                style={{
                  fontSize: '1.1rem',
                  fontFamily: 'monospace',
                  lineHeight: '1.8'
                }}
              />
              <Form.Text className="text-muted">
                {t('presenter.clickSlideToBroadcast')}
              </Form.Text>
              {slideCount > 0 && (
                <div style={{ marginTop: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <small style={{ color: '#666' }}>{t('presenter.clickToBroadcast')}</small>
                    {Array.from({ length: slideCount }, (_, index) => (
                      <div
                        key={index}
                        onClick={() => parseAndBroadcastQuickSlide(index)}
                        style={{
                          width: '35px',
                          height: '35px',
                          borderRadius: '4px',
                          backgroundColor: index === broadcastSlideIndex ? '#28a745' : '#dee2e6',
                          color: index === broadcastSlideIndex ? 'white' : '#666',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.9rem',
                          fontWeight: index === broadcastSlideIndex ? 'bold' : 'normal',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          border: index === broadcastSlideIndex ? '2px solid #1e7e34' : '1px solid #ccc'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'scale(1.1)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'scale(1)';
                        }}
                      >
                        {index + 1}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => {
              // Save current text from textarea to state and server
              const currentText = getCurrentQuickSlideText();
              setQuickSlideText(currentText);
              if (room?.id) {
                socketService.operatorUpdateQuickSlideText(room.id, currentText);
              }
              setShowQuickSlideModal(false);
              setSlideCount(0); // Reset slide count
            }}
          >
            {t('common.close')}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showBackgroundModal} onHide={() => setShowBackgroundModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{t('presenter.selectBackground')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Row className="g-3">
            {/* No Background Option */}
            <Col xs={6} md={4} lg={3}>
              <div
                onClick={() => handleBackgroundChange('')}
                style={{
                  height: '120px',
                  backgroundColor: '#000',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  border: selectedBackground === '' ? '3px solid #0d6efd' : '2px solid #dee2e6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 'bold',
                  transition: 'all 0.2s'
                }}
              >
                {t('presenter.noBackground')}
              </div>
            </Col>

            {/* Media from library */}
            {media.map((item) => {
              const isGradient = item.url.startsWith('linear-gradient');
              return (
                <Col key={item.id} xs={6} md={4} lg={3}>
                  <div
                    onClick={() => handleBackgroundChange(item.url)}
                    style={{
                      height: '120px',
                      background: isGradient ? item.url : `url(${getFullImageUrl(item.url)})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      border: selectedBackground === item.url ? '3px solid #0d6efd' : '2px solid #dee2e6',
                      display: 'flex',
                      alignItems: 'flex-end',
                      padding: '8px',
                      transition: 'all 0.2s'
                    }}
                  >
                    <small style={{
                      color: 'white',
                      fontWeight: 'bold',
                      textShadow: '1px 1px 2px rgba(0,0,0,0.7)',
                      backgroundColor: 'rgba(0,0,0,0.5)',
                      padding: '2px 6px',
                      borderRadius: '4px'
                    }}>
                      {item.name}
                    </small>
                  </div>
                </Col>
              );
            })}
          </Row>

          {media.length === 0 && (
            <div style={{ textAlign: 'center', color: '#666', padding: '40px' }}>
              {t('presenter.noBackgroundsAvailable')}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowBackgroundModal(false)}>
            {t('common.close')}
          </Button>
          <Button variant="primary" onClick={() => navigate('/media')}>
            {t('presenter.manageBackgrounds')}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Create Modal */}
      <Modal
        show={showCreateModal}
        onHide={() => {
          setShowCreateModal(false);
          setCreateModalView('choice');
          setNewSongTitle('');
          setNewSongExpressText('');
        }}
        size={createModalView === 'create-song' ? 'lg' : undefined}
      >
        <Modal.Header closeButton>
          <Modal.Title>
            {createModalView === 'choice' && t('presenter.createNew')}
            {createModalView === 'create-song' && t('presenter.createSong')}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {createModalView === 'choice' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', padding: '10px' }}>
              <div
                onClick={() => setCreateModalView('create-song')}
                style={{
                  padding: '20px',
                  border: '2px solid #dee2e6',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textAlign: 'center'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#0d6efd';
                  e.currentTarget.style.backgroundColor = '#f8f9fa';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#dee2e6';
                  e.currentTarget.style.backgroundColor = 'white';
                }}
              >
                <h5 style={{ marginBottom: '10px', color: '#0d6efd' }}>{t('presenter.createSong')}</h5>
                <p style={{ marginBottom: '0', color: '#666', fontSize: '0.9rem' }}>
                  {t('presenter.createSongDesc')}
                </p>
              </div>

              {isAdmin && (
                <div
                  onClick={() => {
                    setShowCreateModal(false);
                    navigate('/media');
                  }}
                  style={{
                    padding: '20px',
                    border: '2px solid #dee2e6',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textAlign: 'center'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#0d6efd';
                    e.currentTarget.style.backgroundColor = '#f8f9fa';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#dee2e6';
                    e.currentTarget.style.backgroundColor = 'white';
                  }}
                >
                  <h5 style={{ marginBottom: '10px', color: '#0d6efd' }}>{t('presenter.uploadImage')}</h5>
                  <p style={{ marginBottom: '0', color: '#666', fontSize: '0.9rem' }}>
                    {t('presenter.uploadImageDesc')}
                  </p>
                </div>
              )}
            </div>
          )}

          {createModalView === 'create-song' && (
            <div>
              <Form.Group className="mb-3">
                <Form.Label>{t('presenter.songTitle')}</Form.Label>
                <Form.Control
                  type="text"
                  placeholder={t('presenter.enterSongTitle')}
                  value={newSongTitle}
                  onChange={(e) => setNewSongTitle(e.target.value)}
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>{t('presenter.language')}</Form.Label>
                <Form.Select
                  value={newSongLanguage}
                  onChange={(e) => setNewSongLanguage(e.target.value)}
                >
                  <option value="he">Hebrew (עברית)</option>
                  <option value="en">English</option>
                  <option value="es">Spanish (Español)</option>
                  <option value="fr">French (Français)</option>
                  <option value="de">German (Deutsch)</option>
                  <option value="ru">Russian (Русский)</option>
                  <option value="ar">Arabic (العربية)</option>
                  <option value="other">Other</option>
                </Form.Select>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>{t('presenter.songContent')}</Form.Label>
                <div style={{ marginBottom: '8px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {['Verse1', 'Verse2', 'Verse3', 'Chorus', 'PreChorus', 'Bridge'].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => insertVerseTag(tag)}
                      style={{
                        padding: '4px 8px',
                        fontSize: '0.75rem',
                        border: '1px solid #dee2e6',
                        borderRadius: '4px',
                        backgroundColor: '#f8f9fa',
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#e9ecef';
                        e.currentTarget.style.borderColor = '#0d6efd';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#f8f9fa';
                        e.currentTarget.style.borderColor = '#dee2e6';
                      }}
                    >
                      [{tag}]
                    </button>
                  ))}
                </div>
                <Form.Control
                  as="textarea"
                  rows={15}
                  ref={createSongTextareaRef}
                  placeholder={t('presenter.songContentPlaceholder')}
                  value={newSongExpressText}
                  onChange={(e) => setNewSongExpressText(e.target.value)}
                  style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}
                />
              </Form.Group>

              <div style={{ fontSize: '0.85rem', color: '#666', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                <strong>{t('presenter.tip')}:</strong> {t('presenter.songContentTip')}
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          {createModalView === 'create-song' && (
            <Button
              variant="secondary"
              onClick={() => setCreateModalView('choice')}
            >
              {t('presenter.back')}
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={() => {
              setShowCreateModal(false);
              setCreateModalView('choice');
              setNewSongTitle('');
              setNewSongLanguage('he');
              setNewSongExpressText('');
            }}
          >
            {t('common.cancel')}
          </Button>
          {createModalView === 'create-song' && (
            <Button
              variant="primary"
              onClick={handleCreateSong}
              disabled={createSongLoading}
            >
              {createSongLoading ? t('presenter.creating') : t('presenter.createAndAddToSetlist')}
            </Button>
          )}
        </Modal.Footer>
      </Modal>

      {/* Save Setlist Modal */}
      <Modal show={showSaveSetlistModal} onHide={() => {
        setShowSaveSetlistModal(false);
        setSetlistDate('');
        setSetlistTime('');
        setSetlistVenue('');
      }}>
        <Modal.Header closeButton>
          <Modal.Title>{t('presenter.saveSetlistAsPermanent')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>{t('presenter.date')}</Form.Label>
              <Form.Control
                type="date"
                value={setlistDate}
                onChange={(e) => setSetlistDate(e.target.value)}
                autoFocus
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>{t('presenter.time')}</Form.Label>
              <Form.Control
                type="time"
                value={setlistTime}
                onChange={(e) => setSetlistTime(e.target.value)}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>{t('presenter.venue')}</Form.Label>
              <Form.Control
                type="text"
                placeholder={t('presenter.venuePlaceholder')}
                value={setlistVenue}
                onChange={(e) => setSetlistVenue(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSaveSetlist();
                  }
                }}
              />
            </Form.Group>
            {setlistDate && setlistTime && setlistVenue && (() => {
              // Format date for preview
              const [year, month, day] = setlistDate.split('-');
              const formattedDate = `${day}/${month}`;
              return (
                <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
                  <small style={{ color: '#666' }}>
                    <strong>{t('presenter.setlistName')}</strong> {formattedDate} {setlistTime} {setlistVenue}
                  </small>
                </div>
              );
            })()}
            <div style={{ marginTop: '15px', color: '#666' }}>
              <small>
                {t('presenter.saveSetlistInfo', { count: setlist.length })}
              </small>
            </div>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => {
            setShowSaveSetlistModal(false);
            setSetlistDate('');
            setSetlistTime('');
            setSetlistVenue('');
          }}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="success"
            onClick={handleSaveSetlist}
            disabled={saveSetlistLoading || !setlistDate.trim() || !setlistTime.trim() || !setlistVenue.trim()}
          >
            {saveSetlistLoading ? t('presenter.saving') : t('presenter.saveSetlist')}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Load Setlist Modal */}
      <Modal show={showLoadSetlistModal} onHide={() => setShowLoadSetlistModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>{t('presenter.loadSetlist')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {loadSetlistLoading ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <div style={{ marginTop: '10px' }}>{t('presenter.loadingSetlists')}</div>
            </div>
          ) : availableSetlists.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
              {t('presenter.noSavedSetlists')}
            </p>
          ) : (
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {availableSetlists.map((setlist) => (
                <div
                  key={setlist.id}
                  style={{
                    padding: '12px',
                    marginBottom: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    backgroundColor: 'white'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f8f9fa';
                    e.currentTarget.style.borderColor = '#007bff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'white';
                    e.currentTarget.style.borderColor = '#ddd';
                  }}
                  onClick={() => handleLoadSetlist(setlist.id)}
                >
                  <div style={{ fontWeight: '500', marginBottom: '4px' }}>
                    {setlist.name}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#666' }}>
                    {setlist.items?.length || 0} {(setlist.items?.length || 0) !== 1 ? t('presenter.items') : t('presenter.item')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowLoadSetlistModal(false)}>
            {t('common.close')}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Add Section Modal */}
      <Modal
        show={showSectionModal}
        onHide={() => setShowSectionModal(false)}
        centered
        size="sm"
      >
        <Modal.Header closeButton>
          <Modal.Title style={{ fontSize: '1.1rem' }}>{t('presenter.addSection')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group>
            <Form.Label>{t('presenter.sectionTitle')}</Form.Label>
            <Form.Control
              type="text"
              placeholder={t('presenter.sectionTitlePlaceholder')}
              value={sectionTitleInput}
              onChange={(e) => setSectionTitleInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && sectionTitleInput.trim()) {
                  e.preventDefault();
                  setSetlist([...setlist, { type: 'section', data: { title: sectionTitleInput.trim() } }]);
                  setHasUnsavedChanges(true);
                  setShowSectionModal(false);
                  setSectionTitleInput('');
                }
              }}
              autoFocus
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowSectionModal(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              if (sectionTitleInput.trim()) {
                setSetlist([...setlist, { type: 'section', data: { title: sectionTitleInput.trim() } }]);
                setHasUnsavedChanges(true);
                setShowSectionModal(false);
                setSectionTitleInput('');
              }
            }}
            disabled={!sectionTitleInput.trim()}
          >
            {t('presenter.addSectionToSetlist')}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Unsaved Changes Warning Modal */}
      <Modal
        show={showUnsavedChangesModal}
        onHide={handleUnsavedChangesCancel}
        centered
        backdrop="static"
      >
        <Modal.Header closeButton style={{
          borderBottom: '1px solid #E2E8F0',
          padding: '20px 24px'
        }}>
          <Modal.Title style={{
            fontSize: '1.25rem',
            fontWeight: '600',
            color: '#2D3748'
          }}>
            ⚠️ Unsaved Changes
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{
          padding: '24px',
          fontSize: '1rem',
          color: '#4A5568',
          lineHeight: '1.6'
        }}>
          <p style={{ marginBottom: '16px' }}>
            You have unsaved changes in your current setlist.
          </p>
          <p style={{ marginBottom: '0', fontWeight: '500' }}>
            What would you like to do?
          </p>
        </Modal.Body>
        <Modal.Footer style={{
          borderTop: '1px solid #E2E8F0',
          padding: '16px 24px',
          gap: '12px',
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <Button
            variant="outline-secondary"
            onClick={handleUnsavedChangesCancel}
            style={{
              padding: '8px 16px',
              fontSize: '0.95rem',
              fontWeight: '500',
              borderRadius: '8px'
            }}
          >
            Cancel
          </Button>
          <Button
            variant="warning"
            onClick={handleUnsavedChangesDontSave}
            style={{
              padding: '8px 16px',
              fontSize: '0.95rem',
              fontWeight: '500',
              borderRadius: '8px',
              background: '#F59E0B',
              border: 'none'
            }}
          >
            Don't Save
          </Button>
          <Button
            variant="success"
            onClick={handleUnsavedChangesSave}
            style={{
              padding: '8px 16px',
              fontSize: '0.95rem',
              fontWeight: '500',
              borderRadius: '8px',
              background: '#10B981',
              border: 'none'
            }}
          >
            Save Changes
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Presentation Editor Modal */}
      <PresentationEditor
        show={showPresentationEditor}
        onHide={() => {
          setShowPresentationEditor(false);
          setEditingPresentation(null);
        }}
        presentation={editingPresentation}
        onSave={(savedPresentation) => {
          // Refresh presentations list
          fetchPresentations();
          // Update selectedPresentation if it's the same one being edited
          if (selectedPresentation && savedPresentation && selectedPresentation.id === savedPresentation.id) {
            setSelectedPresentation(savedPresentation);
          }
        }}
      />

      {/* Toast Notification */}
      <ToastContainer position="top-center" style={{ zIndex: 9999, marginTop: '20px' }}>
        <Toast
          show={toast.show}
          onClose={() => setToast({ ...toast, show: false })}
          delay={3000}
          autohide
          bg={toast.variant}
        >
          <Toast.Body style={{ color: 'white', textAlign: 'center', fontWeight: '500' }}>
            {toast.message}
          </Toast.Body>
        </Toast>
      </ToastContainer>

      </div>
    </div>
  );
}

export default PresenterMode;
