import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Form, Button, InputGroup, Modal, Row, Col, Alert, Badge, Dropdown } from 'react-bootstrap';
import { useNavigate, useLocation } from 'react-router-dom';
import { FixedSizeList } from 'react-window';
import { useAuth } from '../contexts/AuthContext';
import api, { getFullImageUrl, publicRoomAPI, roomAPI } from '../services/api';
import socketService from '../services/socket';

function PresenterMode() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, isAdmin } = useAuth();

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
  const [allSongs, setAllSongs] = useState([]);
  const [songsLoading, setSongsLoading] = useState(true);

  // Image search state
  const [imageSearchResults, setImageSearchResults] = useState([]);
  const [mediaLoading, setMediaLoading] = useState(true);

  // Setlist state (contains items with type: 'song', 'blank', or 'image')
  const [setlist, setSetlist] = useState([]);
  const [currentItem, setCurrentItem] = useState(null); // Current setlist item (song or image)

  // Current song and slides
  const [currentSong, setCurrentSong] = useState(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [displayMode, setDisplayMode] = useState('bilingual');
  const [isBlankActive, setIsBlankActive] = useState(false);

  // Background state
  const [media, setMedia] = useState([]);
  const [selectedBackground, setSelectedBackground] = useState('');
  const [showBackgroundModal, setShowBackgroundModal] = useState(false);

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createModalView, setCreateModalView] = useState('choice'); // 'choice', 'create-song', 'upload-image'

  // Song creation state
  const [newSongTitle, setNewSongTitle] = useState('');
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
  const [activeResourcePanel, setActiveResourcePanel] = useState('songs'); // 'songs', 'images', or 'bible'
  const [setlistSectionOpen, setSetlistSectionOpen] = useState(true);
  const [slideSectionOpen, setSlideSectionOpen] = useState(true);

  // Chromecast state
  const [castAvailable, setCastAvailable] = useState(false);
  const [castConnected, setCastConnected] = useState(false);
  const castSessionRef = useRef(null); // Store active cast session
  const reconnectAttempts = useRef(0); // Track reconnection attempts
  const maxReconnectAttempts = 5; // Maximum auto-reconnect attempts

  // Quick Slide state
  const [showQuickSlideModal, setShowQuickSlideModal] = useState(false);
  const [quickSlideText, setQuickSlideText] = useState(''); // Persisted value for restore
  const [isQuickSlideLive, setIsQuickSlideLive] = useState(false);
  const [broadcastSlideIndex, setBroadcastSlideIndex] = useState(0); // Which slide is being broadcast
  const quickSlideTextareaRef = useRef(null); // Ref to textarea for instant typing
  const [slideCount, setSlideCount] = useState(1); // Track number of slides for button rendering

  // Switch resource panel and apply search
  const switchResourcePanel = (panel) => {
    setActiveResourcePanel(panel);
    // Re-apply current search query to new panel
    handleSearch(searchQuery);

    // If switching to Bible panel, load books data if needed
    if (panel === 'bible' && bibleBooks.length === 0) {
      fetchBibleBooks();
    }
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
        title: `${book} ${chapter}`,
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
      console.log('✅ Song loaded:', song.title);
    } catch (error) {
      console.error('Error loading song:', error);
      setError('Failed to load song. Please check your connection and try again.');
    }
  };

  const fetchSongs = async () => {
    setSongsLoading(true);
    try {
      const response = await api.get('/api/songs');
      setAllSongs(response.data.songs);
      setSearchResults(response.data.songs);
    } catch (error) {
      console.error('Error fetching songs:', error);
      setError('Failed to load songs. Please refresh the page.');
    } finally {
      setSongsLoading(false);
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

  const handleSearch = (query) => {
    setSearchQuery(query);

    if (activeResourcePanel === 'songs') {
      // Search songs
      if (query.trim() === '') {
        setSearchResults(allSongs);
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
        setSearchResults(filtered);
      }
    } else if (activeResourcePanel === 'bible') {
      // Parse Bible reference (e.g., "John 3", "Genesis 12", "1 Corinthians 13")
      const trimmed = query.trim();
      if (trimmed === '') {
        setSelectedBibleBook('');
        setSelectedBibleChapter('');
        return;
      }

      // Try to match pattern: "BookName Chapter"
      // Match book name (can include numbers like "1 Corinthians") and chapter number
      const match = trimmed.match(/^(.+?)\s+(\d+)$/);
      if (match) {
        const bookName = match[1].trim().toLowerCase();
        const chapterNum = match[2];

        // Find matching book with fuzzy matching
        // Try exact match first, then prefix match, then contains match
        let matchedBook = bibleBooks.find(b =>
          b.name.toLowerCase() === bookName
        );

        if (!matchedBook) {
          // Try prefix match (e.g., "gen" matches "Genesis")
          matchedBook = bibleBooks.find(b =>
            b.name.toLowerCase().startsWith(bookName)
          );
        }

        if (!matchedBook) {
          // Try contains match (e.g., "corin" matches "1 Corinthians")
          matchedBook = bibleBooks.find(b =>
            b.name.toLowerCase().includes(bookName)
          );
        }

        if (matchedBook) {
          setSelectedBibleBook(matchedBook.name);
          setSelectedBibleChapter(chapterNum);
        }
      }
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
    const slideBlocks = text.split(/\n\s*\n/); // Split by blank lines

    const parsedSlides = slideBlocks
      .map(block => {
        const lines = block.split('\n').map(line => line.trim()).filter(line => line);
        if (lines.length === 0) return null;

        return {
          originalText: lines[0] || '',
          transliteration: lines[1] || '',
          translation: lines[2] || '',
          translationOverflow: lines[3] || ''
        };
      })
      .filter(slide => slide !== null && slide.originalText);

    return parsedSlides.length > 0 ? parsedSlides : [{
      originalText: '',
      transliteration: '',
      translation: '',
      translationOverflow: ''
    }];
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
        originalLanguage: 'he',
        slides: parsedSlides,
        tags: []
      });

      // Add the new song to the setlist
      addToSetlist(response.data.song);

      // Reset form and close modal
      setNewSongTitle('');
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

  const removeFromSetlist = (index) => {
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

  const selectItem = (item) => {
    setCurrentItem(item);
    setIsBlankActive(false);

    if (item.type === 'song' || item.type === 'bible') {
      setCurrentSong(item.data);
      setCurrentSlideIndex(null); // Don't highlight any slide until user clicks
      // Don't auto-transmit - wait for user to click on a slide
      // updateSlide will be called when user clicks selectSlide()
    } else if (item.type === 'image') {
      setCurrentSong(null);
      setCurrentSlideIndex(0);
      updateImageSlide(item.data);
    } else if (item.type === 'blank') {
      setCurrentSong(null);
      setIsBlankActive(true);
      updateSlide(null, 0, displayMode, true);
    }
  };

  const selectSong = async (song) => {
    // Song data now includes slides from initial fetch - no API call needed!
    // Check if song has slides (new optimized path)
    if (song.slides && song.slides.length > 0) {
      selectItem({ type: 'song', data: song });
    } else {
      // Fallback: fetch full song details if slides are missing (backward compatibility)
      try {
        const response = await api.get(`/api/songs/${song.id}`);
        const fullSong = response.data.song;
        selectItem({ type: 'song', data: fullSong });
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

  const updateSlide = (song, slideIndex, mode, isBlank) => {
    console.log('🎬 updateSlide called:', { room, song: song?.title, slideIndex, mode, isBlank });

    if (!room) {
      console.error('❌ Cannot update slide: room is null');
      return;
    }

    console.log('📤 Sending slide update to backend');

    // Send slide data directly to avoid backend DB queries
    const payload = {
      roomId: room.id,
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
        isTemporary: song.isTemporary || false
      };
    }

    socketService.operatorUpdateSlide(payload);
  };

  const updateImageSlide = (imageData) => {
    console.log('🖼️ updateImageSlide called:', { room, image: imageData?.name });

    if (!room) {
      console.error('❌ Cannot update image slide: room is null');
      return;
    }

    console.log('📤 Sending image slide update to backend');
    socketService.operatorUpdateSlide({
      roomId: room.id,
      songId: null,
      slideIndex: 0,
      displayMode: displayMode,
      isBlank: false,
      imageUrl: imageData?.url || null
    });
  };

  const toggleDisplayMode = () => {
    const newMode = displayMode === 'bilingual' ? 'original' : 'bilingual';
    setDisplayMode(newMode);
    if (currentSong) {
      updateSlide(currentSong, currentSlideIndex, newMode, false);
    }
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

    // Create a temporary song with all slides
    const quickSong = {
      _id: 'quick-live', // Fixed ID so we update the same slide
      title: 'Quick Slide',
      isTemporary: true,
      slides: allSlides
    };

    // Update or add to setlist
    const existingIndex = setlist.findIndex(item => item.data?.id === 'quick-live');
    if (existingIndex >= 0) {
      // Update existing quick slide
      const newSetlist = [...setlist];
      newSetlist[existingIndex] = { type: 'song', data: quickSong };
      setSetlist(newSetlist);
      setHasUnsavedChanges(true);
      console.log('⚡ Quick Slide: Updated existing slide in setlist');
    } else {
      // Add new quick slide to setlist
      setSetlist([...setlist, { type: 'song', data: quickSong }]);
      setHasUnsavedChanges(true);
      console.log('⚡ Quick Slide: Added new slide to setlist');
    }

    // Update current display if live - show the specific slide requested
    if (isQuickSlideLive && slideIndexToBroadcast !== undefined) {
      const indexToBroadcast = Math.min(slideIndexToBroadcast, allSlides.length - 1);
      console.log('⚡ Quick Slide: LIVE mode - Broadcasting slide', indexToBroadcast + 1, 'to viewers!');
      setCurrentSong(quickSong);
      setCurrentItem({ type: 'song', data: quickSong });
      setCurrentSlideIndex(indexToBroadcast);
      setIsBlankActive(false);
      updateSlide(quickSong, indexToBroadcast, displayMode, false);
      setBroadcastSlideIndex(indexToBroadcast);
    } else {
      console.log('⚡ Quick Slide: Live mode OFF - not broadcasting');
    }
  }, [isQuickSlideLive, setlist, displayMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize textarea when modal opens
  useEffect(() => {
    if (showQuickSlideModal && quickSlideTextareaRef.current) {
      quickSlideTextareaRef.current.value = quickSlideText;
      // Initialize slide count based on persisted text
      if (!quickSlideText.trim()) {
        setSlideCount(1);
      } else {
        // Filter out empty blocks (e.g., when text ends with \n\n)
        const blocks = quickSlideText.split(/\n\s*\n/).filter(block => block.trim());
        setSlideCount(Math.max(1, blocks.length));
      }
    }
  }, [showQuickSlideModal, quickSlideText]);

  // No auto-broadcast - user must click slide buttons to broadcast
  // Get current text from textarea ref
  const getCurrentQuickSlideText = () => {
    return quickSlideTextareaRef.current?.value || '';
  };

  // Calculate slide blocks for display
  const getQuickSlideBlocks = () => {
    const text = getCurrentQuickSlideText();
    if (!text.trim()) return [];
    // Filter out empty blocks (e.g., when text ends with \n\n)
    return text.split(/\n\s*\n/).filter(block => block.trim());
  };

  // Navigate to next slide
  const nextSlide = useCallback(() => {
    if (isBlankActive) return;

    // If current item is a song, navigate through its slides
    if (currentSong && currentSlideIndex < currentSong.slides.length - 1) {
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
  }, [currentSong, currentItem, currentSlideIndex, displayMode, isBlankActive, setlist]); // eslint-disable-line react-hooks/exhaustive-deps

  // Navigate to previous slide
  const previousSlide = useCallback(() => {
    if (isBlankActive) return;

    // If current item is a song and not at first slide, go to previous slide
    if (currentSong && currentSlideIndex > 0) {
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
  }, [currentSong, currentItem, currentSlideIndex, displayMode, isBlankActive, setlist]); // eslint-disable-line react-hooks/exhaustive-deps

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
        maxWidth: '900px'
      }}>
      {/* Back Button and Room PIN Display at Top */}
      <div style={{
        backgroundColor: 'transparent',
        borderRadius: '15px',
        padding: '20px',
        marginBottom: '20px',
        textAlign: 'center',
        position: 'relative'
      }}>
        {/* Header Row: Gear - Broadcast Dropdown - Logo */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '15px'
        }}>
          <div ref={gearMenuRef} style={{ position: 'relative' }}>
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
                left: '0',
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
                  <span style={{ fontWeight: '500' }}>Dashboard</span>
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
                  <span style={{ fontWeight: '500' }}>Home</span>
                </div>
              </div>
            )}
          </div>

          {/* Room Selection Dropdown - Center */}
          {roomPin ? (
            <div ref={roomSelectorRef} style={{ position: 'relative', flex: 1, maxWidth: '280px' }}>
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
                  <div style={{ fontSize: '0.75rem', color: 'white' }}>Broadcasting to</div>
                  <div style={{ fontWeight: '600', color: selectedPublicRoom ? '#28a745' : '#0d6efd', fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {selectedPublicRoom ? selectedPublicRoom.name : `Private Room (${roomPin})`}
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
                      <div style={{ fontWeight: '500', color: !selectedPublicRoom ? '#0d6efd' : '#333' }}>Private Room</div>
                      <div style={{ fontSize: '0.8rem', color: '#666' }}>PIN: {roomPin}</div>
                    </div>
                    {!selectedPublicRoom && <Badge bg="primary" style={{ fontSize: '0.65rem' }}>Active</Badge>}
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
                        <div style={{ fontSize: '0.8rem', color: '#666' }}>Public room</div>
                      </div>
                      {selectedPublicRoom?.id === pr.id && <Badge bg="success" style={{ fontSize: '0.65rem' }}>Active</Badge>}
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
                    + Manage rooms
                  </div>
                </div>
              )}
            </div>
          ) : isCreatingRoom ? (
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div className="spinner-border spinner-border-sm text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : (
            <div style={{ flex: 1 }}></div>
          )}

          <img src="/new_cast_logo.png" alt="SoluCast Logo" style={{ maxWidth: '40px', height: 'auto' }} />
        </div>

        {isCreatingRoom && !roomPin && (
          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.9rem', color: 'white' }}>
              Creating your presentation room...
            </div>
          </div>
        )}

        {roomPin && (
          <div style={{ marginTop: '20px' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'center' }}>
              <Button
                variant="primary"
                onClick={() => {
                  const shareUrl = selectedPublicRoom?.slug ? `${window.location.origin}/viewer?room=${selectedPublicRoom.slug}` : `${window.location.origin}/viewer?pin=${roomPin}`;

                  // Try modern clipboard API first, fallback to older method
                  if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(shareUrl)
                      .then(() => alert('Share link copied to clipboard!'))
                      .catch(() => {
                        // Fallback method
                        fallbackCopyTextToClipboard(shareUrl);
                      });
                  } else {
                    // Fallback method for non-secure contexts
                    fallbackCopyTextToClipboard(shareUrl);
                  }

                  function fallbackCopyTextToClipboard(text) {
                    const textArea = document.createElement('textarea');
                    textArea.value = text;
                    textArea.style.position = 'fixed';
                    textArea.style.top = '0';
                    textArea.style.left = '0';
                    textArea.style.width = '2em';
                    textArea.style.height = '2em';
                    textArea.style.padding = '0';
                    textArea.style.border = 'none';
                    textArea.style.outline = 'none';
                    textArea.style.boxShadow = 'none';
                    textArea.style.background = 'transparent';
                    document.body.appendChild(textArea);
                    textArea.focus();
                    textArea.select();
                    try {
                      document.execCommand('copy');
                      alert('Share link copied to clipboard!');
                    } catch (err) {
                      alert('Failed to copy link. Please copy manually: ' + text);
                    }
                    document.body.removeChild(textArea);
                  }
                }}
                style={{
                  padding: '0.375rem 0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Copy Share Link"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/>
                </svg>
              </Button>
              <Button
                variant="success"
                onClick={() => {
                  const shareUrl = selectedPublicRoom?.slug ? `${window.location.origin}/viewer?room=${selectedPublicRoom.slug}` : `${window.location.origin}/viewer?pin=${roomPin}`;
                  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareUrl)}`;
                  window.open(whatsappUrl, '_blank');
                }}
                style={{
                  padding: '0.375rem 0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Share on WhatsApp"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="white"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </Button>
              {castAvailable && (
                <Button
                  variant={castConnected ? "danger" : "outline-secondary"}
                  onClick={handleCast}
                  title="Cast to Chromecast"
                  style={{
                    padding: '0.375rem 0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 16.1A5 5 0 0 1 5.9 20M2 12.05A9 9 0 0 1 9.95 20M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6"/>
                    <line x1="2" y1="20" x2="2.01" y2="20"/>
                  </svg>
                </Button>
              )}
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
            {/* Title with collapse toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: '0 0 auto', flexWrap: 'wrap' }}>
              <Button
                variant={activeResourcePanel === 'songs' ? 'primary' : 'outline-light'}
                size="sm"
                onClick={() => switchResourcePanel('songs')}
                style={{ fontWeight: '500' }}
              >
                Songs
              </Button>
              <Button
                variant={activeResourcePanel === 'images' ? 'primary' : 'outline-light'}
                size="sm"
                onClick={() => switchResourcePanel('images')}
                style={{ fontWeight: '500' }}
              >
                Images
              </Button>
              <Button
                variant={activeResourcePanel === 'bible' ? 'primary' : 'outline-light'}
                size="sm"
                onClick={() => switchResourcePanel('bible')}
                style={{ fontWeight: '500' }}
              >
                Bible
              </Button>
            </div>

            {/* Search bar - Glassmorphic style */}
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
                    ? "e.g. John 3"
                    : "Search..."
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

            {/* New button */}
            {(activeResourcePanel === 'songs' || activeResourcePanel === 'images') && (
              <Button
                variant="success"
                size="sm"
                onClick={() => setShowCreateModal(true)}
                style={{
                  fontWeight: '600',
                  fontSize: '0.75rem'
                }}
                title={activeResourcePanel === 'songs' ? 'Create New Song' : 'Upload New Image'}
              >
                New
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
                    <div>Loading songs...</div>
                  </div>
                ) : searchResults.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'white', fontSize: '0.9rem' }}>
                    {searchQuery ? 'No songs match your search' : 'No songs available'}
                  </p>
                ) : (
                  <FixedSizeList
                    height={220}
                    itemCount={searchResults.length}
                    itemSize={52}
                    width="100%"
                    className="dark-scrollbar"
                  >
                    {({ index, style }) => {
                      const song = searchResults[index];
                      const isSelected = currentSong && currentSong.id && currentSong.id === song.id;
                      return (
                        <div
                          style={{
                            ...(style || {}),
                            padding: '4px 8px',
                            display: 'flex',
                            gap: '8px',
                            alignItems: 'center',
                            boxSizing: 'border-box'
                          }}
                        >
                          <div
                            onClick={() => selectSong(song)}
                            style={{
                              flex: 1,
                              padding: '10px 14px',
                              background: isSelected ? 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)' : 'transparent',
                              color: 'white',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontSize: '0.95rem',
                              fontWeight: isSelected ? '500' : '400',
                              border: isSelected ? '2px solid var(--color-primary)' : '1px solid rgba(255,255,255,0.3)',
                              transition: 'all 0.2s ease',
                              boxShadow: isSelected ? '0 2px 8px rgba(0,123,255,0.25)' : 'none'
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
                            variant="success"
                            onClick={(e) => {
                              e.stopPropagation();
                              addToSetlist(song);
                            }}
                            style={{
                              width: '36px',
                              height: '36px',
                              fontSize: '1.3rem',
                              fontWeight: '600',
                              flexShrink: 0,
                              padding: '0'
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
                      <Form.Label style={{ fontSize: '0.85rem', fontWeight: '500', marginBottom: '6px', display: 'block', color: 'white' }}>
                        Book
                      </Form.Label>
                      <Form.Select
                        size="sm"
                        value={selectedBibleBook}
                        onChange={(e) => setSelectedBibleBook(e.target.value)}
                        style={{ fontSize: '0.85rem' }}
                      >
                        <option value="">Select...</option>
                        <optgroup label="Torah (Pentateuch)">
                          <option value="Genesis">Genesis (בראשית)</option>
                          <option value="Exodus">Exodus (שמות)</option>
                          <option value="Leviticus">Leviticus (ויקרא)</option>
                          <option value="Numbers">Numbers (במדבר)</option>
                          <option value="Deuteronomy">Deuteronomy (דברים)</option>
                        </optgroup>
                        <optgroup label="Nevi'im (Prophets)">
                          <option value="Joshua">Joshua (יהושע)</option>
                          <option value="Judges">Judges (שופטים)</option>
                          <option value="I Samuel">1 Samuel (שמואל א)</option>
                          <option value="II Samuel">2 Samuel (שמואל ב)</option>
                          <option value="I Kings">1 Kings (מלכים א)</option>
                          <option value="II Kings">2 Kings (מלכים ב)</option>
                          <option value="Isaiah">Isaiah (ישעיהו)</option>
                          <option value="Jeremiah">Jeremiah (ירמיהו)</option>
                          <option value="Ezekiel">Ezekiel (יחזקאל)</option>
                          <option value="Hosea">Hosea (הושע)</option>
                          <option value="Joel">Joel (יואל)</option>
                          <option value="Amos">Amos (עמוס)</option>
                          <option value="Obadiah">Obadiah (עובדיה)</option>
                          <option value="Jonah">Jonah (יונה)</option>
                          <option value="Micah">Micah (מיכה)</option>
                          <option value="Nahum">Nahum (נחום)</option>
                          <option value="Habakkuk">Habakkuk (חבקוק)</option>
                          <option value="Zephaniah">Zephaniah (צפניה)</option>
                          <option value="Haggai">Haggai (חגי)</option>
                          <option value="Zechariah">Zechariah (זכריה)</option>
                          <option value="Malachi">Malachi (מלאכי)</option>
                        </optgroup>
                        <optgroup label="Ketuvim (Writings)">
                          <option value="Psalms">Psalms (תהילים)</option>
                          <option value="Proverbs">Proverbs (משלי)</option>
                          <option value="Job">Job (איוב)</option>
                          <option value="Song of Songs">Song of Songs (שיר השירים)</option>
                          <option value="Ruth">Ruth (רות)</option>
                          <option value="Lamentations">Lamentations (איכה)</option>
                          <option value="Ecclesiastes">Ecclesiastes (קהלת)</option>
                          <option value="Esther">Esther (אסתר)</option>
                          <option value="Daniel">Daniel (דניאל)</option>
                          <option value="Ezra">Ezra (עזרא)</option>
                          <option value="Nehemiah">Nehemiah (נחמיה)</option>
                          <option value="I Chronicles">1 Chronicles (דברי הימים א)</option>
                          <option value="II Chronicles">2 Chronicles (דברי הימים ב)</option>
                        </optgroup>
                        <optgroup label="New Testament - Gospels">
                          <option value="Matthew">Matthew</option>
                          <option value="Mark">Mark</option>
                          <option value="Luke">Luke</option>
                          <option value="John">John</option>
                        </optgroup>
                        <optgroup label="New Testament - History">
                          <option value="Acts">Acts</option>
                        </optgroup>
                        <optgroup label="New Testament - Paul's Letters">
                          <option value="Romans">Romans</option>
                          <option value="1 Corinthians">1 Corinthians</option>
                          <option value="2 Corinthians">2 Corinthians</option>
                          <option value="Galatians">Galatians</option>
                          <option value="Ephesians">Ephesians</option>
                          <option value="Philippians">Philippians</option>
                          <option value="Colossians">Colossians</option>
                          <option value="1 Thessalonians">1 Thessalonians</option>
                          <option value="2 Thessalonians">2 Thessalonians</option>
                          <option value="1 Timothy">1 Timothy</option>
                          <option value="2 Timothy">2 Timothy</option>
                          <option value="Titus">Titus</option>
                          <option value="Philemon">Philemon</option>
                        </optgroup>
                        <optgroup label="New Testament - General Letters">
                          <option value="Hebrews">Hebrews</option>
                          <option value="James">James</option>
                          <option value="1 Peter">1 Peter</option>
                          <option value="2 Peter">2 Peter</option>
                          <option value="1 John">1 John</option>
                          <option value="2 John">2 John</option>
                          <option value="3 John">3 John</option>
                          <option value="Jude">Jude</option>
                        </optgroup>
                        <optgroup label="New Testament - Prophecy">
                          <option value="Revelation">Revelation</option>
                        </optgroup>
                      </Form.Select>
                    </div>

                    <div style={{ flex: isMobile ? '1' : '1' }}>
                      <Form.Label style={{ fontSize: '0.85rem', fontWeight: '500', marginBottom: '6px', display: 'block', color: 'white' }}>
                        Chapter
                      </Form.Label>
                      <Form.Select
                        size="sm"
                        value={selectedBibleChapter}
                        onChange={(e) => setSelectedBibleChapter(e.target.value)}
                        disabled={!selectedBibleBook}
                        style={{ fontSize: '0.85rem' }}
                      >
                        <option value="">Select...</option>
                        {selectedBibleBook && (() => {
                          const bookData = bibleBooks.find(b => b.name === selectedBibleBook);
                          const chapterCount = bookData?.chapters || 50;
                          return Array.from({ length: chapterCount }, (_, i) => (
                            <option key={i + 1} value={i + 1}>
                              {i + 1}
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
                            title: `${selectedBibleBook} ${selectedBibleChapter}`,
                            slides: bibleVerses,
                            isBible: true,
                            book: selectedBibleBook,
                            chapter: selectedBibleChapter
                          };
                          addBibleToSetlist(biblePassage);
                        }}
                      >
                        + Add {selectedBibleBook} {selectedBibleChapter} to Setlist
                      </Button>
                    </div>
                  )}
                </div>

                {bibleLoading && (
                  <div style={{ textAlign: 'center', color: 'white', padding: '20px' }}>
                    Loading verses...
                  </div>
                )}

                {!bibleLoading && bibleVerses.length === 0 && selectedBibleBook && selectedBibleChapter && (
                  <div style={{ textAlign: 'center', color: 'white', padding: '20px' }}>
                    Select a book and chapter to load verses
                  </div>
                )}
              </div>
            ) : (
              <div className="dark-scrollbar" style={{ maxHeight: '220px', overflowY: 'auto' }}>
                {mediaLoading ? (
                  <div style={{ textAlign: 'center', color: 'white', padding: '40px' }}>
                    <div className="spinner-border text-light" role="status" style={{ marginBottom: '10px' }}>
                      <span className="visually-hidden">Loading...</span>
                    </div>
                    <div>Loading media library...</div>
                  </div>
                ) : imageSearchResults.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'white', fontSize: '0.9rem' }}>
                    {searchQuery ? 'No images match your search' : 'No images available'}
                  </p>
                ) : (
                  imageSearchResults.map((image) => {
                    const isGradient = image.url.startsWith('linear-gradient');
                    return (
                      <div
                        key={image.id}
                        style={{
                          padding: '8px 10px',
                          backgroundColor: 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          cursor: 'pointer',
                          borderRadius: '4px',
                          marginBottom: '4px',
                          border: '1px solid rgba(255,255,255,0.3)'
                        }}
                      >
                        <div
                          style={{
                            width: '40px',
                            height: '40px',
                            background: isGradient ? image.url : `url(${getFullImageUrl(image.url)})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            borderRadius: '4px',
                            flexShrink: 0
                          }}
                        />
                        <span
                          style={{ fontSize: '0.95rem', flex: 1, color: 'white' }}
                          onClick={() => selectItem({ type: 'image', data: image })}
                        >
                          {image.name}
                        </span>
                        <Button
                          variant="primary"
                          size="sm"
                          style={{
                            borderRadius: '8px',
                            width: '36px',
                            height: '36px',
                            padding: '0',
                            fontSize: '1.3rem',
                            fontWeight: '600',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            border: 'none',
                            boxShadow: '0 2px 8px rgba(102, 126, 234, 0.4)',
                            transition: 'all 0.2s ease',
                            cursor: 'pointer'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.1)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.6)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.4)';
                          }}
                          onMouseDown={(e) => {
                            e.currentTarget.style.transform = 'scale(0.9)';
                            e.currentTarget.style.boxShadow = '0 1px 4px rgba(102, 126, 234, 0.3)';
                          }}
                          onMouseUp={(e) => {
                            e.currentTarget.style.transform = 'scale(1.1)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.6)';
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            addImageToSetlist(image);

                            // Pulse animation on click
                            const button = e.currentTarget;
                            button.style.animation = 'none';
                            setTimeout(() => {
                              if (button && button.style) {
                                button.style.animation = 'pulse 0.4s ease';
                              }
                            }, 10);
                          }}
                        >
                          +
                        </Button>
                      </div>
                    );
                  })
                )}
                {/* Add Blank Slide Button */}
                <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #ddd' }}>
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    style={{ width: '100%' }}
                    onClick={addBlankToSetlist}
                  >
                    + Add Blank Slide
                  </Button>
                </div>
              </div>
            )}
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
                    Setlist
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
                  <span style={{ fontSize: '1.1rem' }}>💾</span> Save
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
                    <span style={{ fontSize: '1.1rem' }}>✨</span> New
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
                  <span style={{ fontSize: '1.1rem' }}>📂</span> Load
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
                    <span style={{ fontSize: '1.1rem' }}>📝</span> Save As...
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
                  <span style={{ fontSize: '1.1rem' }}>📑</span> Add Section
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </div>

          {setlistSectionOpen && (
            <div style={{ padding: '10px' }}>
              {setlist.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'white' }}>
                  No songs in setlist. Add songs from above.
                </p>
              ) : (
                <div
                  ref={setlistContainerRef}
                  className="dark-scrollbar"
                  style={{
                    maxHeight: isMobile ? 'none' : '220px',
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

                    const getItemDisplay = () => {
                      if (item.type === 'song') {
                        return {
                          title: item.data?.title || 'Unknown Song',
                          bgColor: 'transparent',
                          borderLeft: '4px solid #667eea'
                        };
                      } else if (item.type === 'bible') {
                        return {
                          title: item.data?.title || 'Bible Passage',
                          bgColor: 'transparent',
                          borderLeft: '4px solid #764ba2'
                        };
                      } else if (item.type === 'image') {
                        return {
                          title: item.data?.name || 'Image Slide',
                          bgColor: 'transparent',
                          borderLeft: '4px solid #4facfe'
                        };
                      } else if (item.type === 'blank') {
                        return {
                          title: 'Blank Slide',
                          bgColor: 'transparent',
                          borderLeft: '4px solid #f093fb'
                        };
                      } else if (item.type === 'section') {
                        return {
                          title: item.data?.title || 'Section',
                          bgColor: 'rgba(255, 255, 255, 0.1)',
                          borderLeft: 'none',
                          isSection: true
                        };
                      }
                      return { title: 'Unknown', bgColor: 'transparent', borderLeft: '4px solid #718096' };
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
                          padding: '10px 14px',
                          backgroundColor: touchDragIndex === index
                            ? 'rgba(102, 126, 234, 0.3)'
                            : touchHoldingIndex === index
                              ? 'rgba(102, 126, 234, 0.15)'
                              : display.bgColor,
                          borderRadius: '8px',
                          borderLeft: display.borderLeft,
                          marginBottom: '6px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          cursor: 'grab',
                          transition: 'all 0.2s ease',
                          border: '1px solid rgba(255,255,255,0.3)',
                          boxShadow: touchDragIndex === index
                            ? '0 4px 12px rgba(0, 0, 0, 0.3)'
                            : touchHoldingIndex === index
                              ? '0 2px 8px rgba(102, 126, 234, 0.3)'
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
                            onClick={() => selectItem(item)}
                          >
                            {currentItemNumber}. {display.title}
                          </span>
                        </div>
                        <span
                          onClick={() => removeFromSetlist(index)}
                          style={{
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            color: '#ff6b6b',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(255,107,107,0.15)'
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
              {currentItem
                ? currentItem.type === 'song'
                  ? currentItem.data?.title
                  : currentItem.type === 'bible'
                  ? currentItem.data?.title
                  : currentItem.type === 'image'
                  ? `Image: ${currentItem.data?.name}`
                  : 'Blank Slide'
                : 'No Item Selected'}
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
                    {isBlankActive ? '⚫ Blank ON' : '⚪ Blank OFF'}
                  </Dropdown.Item>
                  <Dropdown.Item onClick={() => setShowQuickSlideModal(true)}>
                    ⚡ Quick Slide
                  </Dropdown.Item>
                  <Dropdown.Item onClick={() => setShowBackgroundModal(true)}>
                    🖼️ Background
                  </Dropdown.Item>
                  <Dropdown.Divider />
                  <Dropdown.Item onClick={toggleDisplayMode}>
                    {displayMode === 'original' ? '🔤 Switch to Bilingual' : '🔤 Switch to Original'}
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
                  {isBlankActive ? 'Blank ON' : 'Blank'}
                </Button>

                <Button
                  variant="success"
                  onClick={() => setShowQuickSlideModal(true)}
                  size="sm"
                  style={{ fontSize: '0.8rem', padding: '4px 10px', whiteSpace: 'nowrap' }}
                  title="Create a quick slide on-the-fly"
                >
                  ⚡ Quick
                </Button>

                <Button
                  variant="info"
                  onClick={() => setShowBackgroundModal(true)}
                  size="sm"
                  style={{ fontSize: '0.8rem', padding: '4px 10px', whiteSpace: 'nowrap' }}
                >
                  Background
                </Button>

                <Button
                  variant="primary"
                  onClick={toggleDisplayMode}
                  size="sm"
                  style={{ fontSize: '0.8rem', padding: '4px 10px', whiteSpace: 'nowrap' }}
                >
                  {displayMode === 'original' ? 'Original' : 'Bilingual'}
                </Button>
              </>
            )}
          </div>
        </div>

        {slideSectionOpen && currentSong && (
          <div>
            <div className="dark-scrollbar" style={{
              padding: '8px',
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
              gap: '6px',
              maxHeight: 'calc(100vh - 200px)',
              overflowY: 'auto',
              alignContent: 'start'
            }}>
            {currentSong.slides.map((slide, index) => {
              // Function to get border color based on verse type
              const getBorderColor = (verseType, isSelected) => {
                if (isSelected) return '#007bff'; // Blue for selected

                switch(verseType) {
                  case 'Intro':
                    return 'rgba(255,255,255,0.4)';
                  case 'Verse1':
                    return 'rgba(255,193,7,0.6)'; // Bright yellow
                  case 'Verse2':
                    return 'rgba(255,167,38,0.6)'; // Orange-yellow
                  case 'Verse3':
                    return 'rgba(255,213,79,0.6)'; // Light yellow
                  case 'Verse4':
                    return 'rgba(251,192,45,0.6)'; // Golden yellow
                  case 'PreChorus':
                    return 'rgba(233,30,99,0.5)'; // Pink
                  case 'Chorus':
                    return 'rgba(3,169,244,0.6)'; // Cyan
                  case 'Bridge':
                    return 'rgba(156,39,176,0.5)'; // Purple
                  case 'Instrumental':
                    return 'rgba(76,175,80,0.5)'; // Green
                  case 'Outro':
                    return 'rgba(255,152,0,0.6)'; // Orange
                  case 'Tag':
                    return 'rgba(103,58,183,0.5)'; // Indigo
                  default:
                    return 'rgba(255,255,255,0.3)';
                }
              };

              return (
              <div
                key={index}
                onClick={() => selectSlide(index)}
                style={{
                  border: currentSlideIndex === index ? '2px solid #007bff' : `1px solid ${getBorderColor(slide.verseType, false)}`,
                  borderRadius: '6px',
                  padding: '6px 8px',
                  cursor: 'pointer',
                  backgroundColor: currentSlideIndex === index ? 'rgba(0,123,255,0.2)' : 'transparent',
                  transition: 'border 0.05s ease, background-color 0.05s ease',
                  userSelect: 'none'
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = 'scale(0.98)';
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                <div style={{
                  color: currentSlideIndex === index ? '#4da3ff' : 'rgba(255,255,255,0.7)',
                  fontWeight: 'bold',
                  marginBottom: '4px',
                  fontSize: '0.75rem'
                }}>
                  {currentSong.isBible
                    ? `Verse ${slide.verseNumber || index + 1}`
                    : slide.verseType
                    ? `${slide.verseType} - Slide ${index + 1}`
                    : `Slide ${index + 1}`}
                </div>
                <div style={{ fontSize: '0.85rem', lineHeight: '1.3', color: 'white' }}>
                  <div style={{ marginBottom: '2px' }}>
                    {slide.originalText}
                  </div>
                  {slide.transliteration && (
                    <div style={{ marginBottom: '2px', color: 'rgba(255,255,255,0.85)' }}>
                      {slide.transliteration}
                    </div>
                  )}
                  {slide.translation && (
                    <div style={{ marginBottom: '2px', color: 'rgba(255,255,255,0.85)' }}>
                      {slide.translation}
                    </div>
                  )}
                  {slide.translationOverflow && (
                    <div style={{ marginBottom: '2px', color: 'rgba(255,255,255,0.85)' }}>
                      {slide.translationOverflow}
                    </div>
                  )}
                </div>
              </div>
            );
            })}
          </div>
          </div>
        )}

        {slideSectionOpen && currentItem && currentItem.type === 'image' && (
          <div style={{ padding: '20px' }}>
            <div style={{
              width: '100%',
              height: '400px',
              background: currentItem.data?.url.startsWith('linear-gradient')
                ? currentItem.data.url
                : `url(${getFullImageUrl(currentItem.data?.url)})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              borderRadius: '10px',
              border: '2px solid #007bff'
            }} />
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

        {slideSectionOpen && !currentItem && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'white' }}>
            Select a song or item to view
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
        title="Keyboard Shortcuts"
      >
        ?
      </button>

      {/* Keyboard Shortcuts Help Modal */}
      <Modal show={showKeyboardHelp} onHide={() => setShowKeyboardHelp(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Keyboard Shortcuts</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div style={{ fontSize: '0.95rem' }}>
            <div style={{ marginBottom: '20px' }}>
              <h6 style={{ fontWeight: 'bold', marginBottom: '12px' }}>Navigation</h6>
              <div style={{ display: 'grid', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span><kbd style={{ padding: '2px 8px', backgroundColor: '#f0f0f0', borderRadius: '4px', border: '1px solid #ccc' }}>→</kbd> Right Arrow</span>
                  <span style={{ color: '#666' }}>Next Slide</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span><kbd style={{ padding: '2px 8px', backgroundColor: '#f0f0f0', borderRadius: '4px', border: '1px solid #ccc' }}>←</kbd> Left Arrow</span>
                  <span style={{ color: '#666' }}>Previous Slide</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span><kbd style={{ padding: '2px 8px', backgroundColor: '#f0f0f0', borderRadius: '4px', border: '1px solid #ccc' }}>↓</kbd> Down Arrow</span>
                  <span style={{ color: '#666' }}>Next Song</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span><kbd style={{ padding: '2px 8px', backgroundColor: '#f0f0f0', borderRadius: '4px', border: '1px solid #ccc' }}>↑</kbd> Up Arrow</span>
                  <span style={{ color: '#666' }}>Previous Song</span>
                </div>
              </div>
            </div>

            <div>
              <h6 style={{ fontWeight: 'bold', marginBottom: '12px' }}>Display Control</h6>
              <div style={{ display: 'grid', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span><kbd style={{ padding: '2px 8px', backgroundColor: '#f0f0f0', borderRadius: '4px', border: '1px solid #ccc' }}>Space</kbd> or <kbd style={{ padding: '2px 8px', backgroundColor: '#f0f0f0', borderRadius: '4px', border: '1px solid #ccc' }}>B</kbd></span>
                  <span style={{ color: '#666' }}>Toggle Blank Screen</span>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '20px', padding: '12px', backgroundColor: '#f8f9fa', borderRadius: '8px', fontSize: '0.85rem', color: '#666' }}>
              <strong>Tip:</strong> Keyboard shortcuts won't work while typing in search fields or text inputs.
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowKeyboardHelp(false)}>
            Close
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
          setIsQuickSlideLive(false);
          setSlideCount(1); // Reset slide count
        }}
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>⚡ Quick Slide</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div style={{ marginBottom: '15px', padding: '12px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
            <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '8px' }}>
              <strong>How to use:</strong>
            </p>
            <ul style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0', paddingLeft: '20px' }}>
              <li>Line 1: Hebrew/Original text</li>
              <li>Line 2: Transliteration</li>
              <li>Line 3-4: Translation (can use 2 lines)</li>
            </ul>
          </div>

          <Form>
            <Form.Group className="mb-3">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <Form.Label style={{ marginBottom: 0 }}>Slide Text</Form.Label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{
                    fontSize: '0.9rem',
                    fontWeight: isQuickSlideLive ? 'bold' : 'normal',
                    color: isQuickSlideLive ? '#28a745' : '#666'
                  }}>
                    {isQuickSlideLive ? '🔴 LIVE' : 'Not Live'}
                  </span>
                  <Form.Check
                    type="switch"
                    id="quick-slide-live-toggle"
                    checked={isQuickSlideLive}
                    onChange={(e) => {
                      setIsQuickSlideLive(e.target.checked);
                      if (e.target.checked && getCurrentQuickSlideText().trim()) {
                        // Broadcast the current broadcast slide when turning live on
                        parseAndBroadcastQuickSlide(broadcastSlideIndex);
                      }
                    }}
                    style={{ fontSize: '1.2rem' }}
                  />
                </div>
              </div>
              <Form.Control
                as="textarea"
                rows={12}
                ref={quickSlideTextareaRef}
                defaultValue={quickSlideText}
                onChange={(e) => {
                  // Update slide count for button rendering (lightweight state update)
                  const text = e.target.value;
                  if (!text.trim()) {
                    setSlideCount(1);
                  } else {
                    // Filter out empty blocks (e.g., when text ends with \n\n)
                    const blocks = text.split(/\n\s*\n/).filter(block => block.trim());
                    setSlideCount(Math.max(1, blocks.length));
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
                {isQuickSlideLive ? '✨ LIVE: Click slide buttons below to broadcast!' : 'Toggle "Live" then click slide buttons to broadcast. Separate slides with empty lines.'}
              </Form.Text>
              {(() => {
                const blocks = getQuickSlideBlocks();
                return blocks.length > 1 && (
                  <div style={{ marginTop: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <small style={{ color: '#666' }}>Click to broadcast:</small>
                      {blocks.map((_, index) => (
                        <div
                          key={index}
                          onClick={() => {
                            if (isQuickSlideLive) {
                              parseAndBroadcastQuickSlide(index);
                            }
                          }}
                          style={{
                            width: '35px',
                            height: '35px',
                            borderRadius: '4px',
                            backgroundColor: index === broadcastSlideIndex && isQuickSlideLive ? '#28a745' : '#dee2e6',
                            color: index === broadcastSlideIndex && isQuickSlideLive ? 'white' : '#666',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.9rem',
                            fontWeight: index === broadcastSlideIndex && isQuickSlideLive ? 'bold' : 'normal',
                            cursor: isQuickSlideLive ? 'pointer' : 'not-allowed',
                            transition: 'all 0.2s',
                            border: index === broadcastSlideIndex && isQuickSlideLive ? '2px solid #1e7e34' : '1px solid #ccc',
                            opacity: isQuickSlideLive ? 1 : 0.5
                          }}
                          onMouseEnter={(e) => {
                            if (isQuickSlideLive) {
                              e.currentTarget.style.transform = 'scale(1.1)';
                            }
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
                );
              })()}
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
              setIsQuickSlideLive(false);
              setSlideCount(1); // Reset slide count
            }}
          >
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showBackgroundModal} onHide={() => setShowBackgroundModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Select Background</Modal.Title>
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
                No Background
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
              No backgrounds available. Add some in the Media Library!
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowBackgroundModal(false)}>
            Close
          </Button>
          <Button variant="primary" onClick={() => navigate('/media')}>
            Manage Backgrounds
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
            {createModalView === 'choice' && 'Create New'}
            {createModalView === 'create-song' && 'Create Song'}
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
                <h5 style={{ marginBottom: '10px', color: '#0d6efd' }}>Create Song</h5>
                <p style={{ marginBottom: '0', color: '#666', fontSize: '0.9rem' }}>
                  Create a new song with lyrics in Hebrew and English
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
                  <h5 style={{ marginBottom: '10px', color: '#0d6efd' }}>Upload Image</h5>
                  <p style={{ marginBottom: '0', color: '#666', fontSize: '0.9rem' }}>
                    Upload new images or backgrounds to your media library
                  </p>
                </div>
              )}
            </div>
          )}

          {createModalView === 'create-song' && (
            <div>
              <Form.Group className="mb-3">
                <Form.Label>Song Title</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Enter song title"
                  value={newSongTitle}
                  onChange={(e) => setNewSongTitle(e.target.value)}
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Song Content</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={15}
                  placeholder="Enter your song lyrics here. Separate slides with blank lines.

Format for each slide:
Line 1: Hebrew text (עברית)
Line 2: Transliteration (optional)
Line 3: English translation (optional)
Line 4: Translation overflow (optional)

Example:
ברוך אתה ה׳
Baruch atah Adonai
Blessed are You, LORD

הללויה
Hallelujah
Praise the LORD"
                  value={newSongExpressText}
                  onChange={(e) => setNewSongExpressText(e.target.value)}
                  style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}
                />
              </Form.Group>

              <div style={{ fontSize: '0.85rem', color: '#666', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                <strong>Tip:</strong> Separate each slide with a blank line. Within each slide, add up to 4 lines:
                Hebrew text, transliteration, translation, and translation overflow.
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
              Back
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={() => {
              setShowCreateModal(false);
              setCreateModalView('choice');
              setNewSongTitle('');
              setNewSongExpressText('');
            }}
          >
            Cancel
          </Button>
          {createModalView === 'create-song' && (
            <Button
              variant="primary"
              onClick={handleCreateSong}
              disabled={createSongLoading}
            >
              {createSongLoading ? 'Creating...' : 'Create & Add to Setlist'}
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
          <Modal.Title>Save Setlist as Permanent</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Date</Form.Label>
              <Form.Control
                type="date"
                value={setlistDate}
                onChange={(e) => setSetlistDate(e.target.value)}
                autoFocus
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Time</Form.Label>
              <Form.Control
                type="time"
                value={setlistTime}
                onChange={(e) => setSetlistTime(e.target.value)}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Venue</Form.Label>
              <Form.Control
                type="text"
                placeholder="Main Hall"
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
                    <strong>Setlist name:</strong> {formattedDate} {setlistTime} {setlistVenue}
                  </small>
                </div>
              );
            })()}
            <div style={{ marginTop: '15px', color: '#666' }}>
              <small>
                This will create a permanent copy of your current setlist with {setlist.length} item{setlist.length !== 1 ? 's' : ''}.
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
            Cancel
          </Button>
          <Button
            variant="success"
            onClick={handleSaveSetlist}
            disabled={saveSetlistLoading || !setlistDate.trim() || !setlistTime.trim() || !setlistVenue.trim()}
          >
            {saveSetlistLoading ? 'Saving...' : 'Save Setlist'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Load Setlist Modal */}
      <Modal show={showLoadSetlistModal} onHide={() => setShowLoadSetlistModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Load Setlist</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {loadSetlistLoading ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <div style={{ marginTop: '10px' }}>Loading setlists...</div>
            </div>
          ) : availableSetlists.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
              No saved setlists found. Create a new setlist by adding songs and clicking "Save".
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
                    {setlist.items?.length || 0} item{(setlist.items?.length || 0) !== 1 ? 's' : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowLoadSetlistModal(false)}>
            Close
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
          <Modal.Title style={{ fontSize: '1.1rem' }}>Add Section</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group>
            <Form.Label>Section Title</Form.Label>
            <Form.Control
              type="text"
              placeholder="e.g., Worship, Message, Ministry Time"
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
            Cancel
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
            Add Section
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

      </div>
    </div>
  );
}

export default PresenterMode;
