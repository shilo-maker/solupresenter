import React, { useState, useEffect, useCallback } from 'react';
import { Form, Button, InputGroup, Modal, Row, Col, Alert, Badge, Dropdown } from 'react-bootstrap';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api, { getFullImageUrl } from '../services/api';
import socketService from '../services/socket';

function PresenterMode() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading } = useAuth();

  // Add pulse animation keyframes
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.15); }
        100% { transform: scale(1); }
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

  // Song search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [allSongs, setAllSongs] = useState([]);
  const [songsLoading, setSongsLoading] = useState(false);

  // Image search state
  const [imageSearchResults, setImageSearchResults] = useState([]);
  const [mediaLoading, setMediaLoading] = useState(false);

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
    if (!room || !room._id || !room.temporarySetlist) {
      setError('No active setlist to save');
      return;
    }

    try {
      // Convert setlist to backend format
      const items = setlist.map((item, index) => {
        if (item.type === 'song') {
          return {
            type: 'song',
            song: item.data._id,
            order: index
          };
        } else if (item.type === 'image') {
          return {
            type: 'image',
            image: item.data._id,
            order: index
          };
        } else if (item.type === 'bible') {
          // Extract Bible data from the item
          const bibleId = item.data._id; // e.g., "bible-Genesis-1"
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
        }
        return null;
      }).filter(Boolean);

      await api.put(`/api/rooms/${room._id}/setlist`, { items });
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

  // Track setlist changes to detect unsaved changes
  useEffect(() => {
    // Skip marking as unsaved on initial load or when setlist is empty
    if (setlist.length > 0 && room && room._id) {
      setHasUnsavedChanges(true);
    }
  }, [setlist]);

  useEffect(() => {
    console.log('🔄 PresenterMode useEffect triggered', {
      loading,
      hasUser: !!user,
      userId: user?._id,
      roomCreated
    });

    // Wait for auth to finish loading
    if (loading) {
      console.log('⏳ Auth still loading...');
      return;
    }

    // Only create room once user is loaded and room hasn't been created yet
    if (!user || !user._id) {
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
        console.log('🏠 Creating room for user:', user._id);
        const response = await api.post('/api/rooms/create');
        console.log('✅ Room created successfully:', response.data);
        setRoom(response.data.room);
        setRoomPin(response.data.room.pin);
        setRoomCreated(true);

        // Load setlist from room - prioritize permanent over temporary
        const setlistToLoad = response.data.room.linkedPermanentSetlist || response.data.room.temporarySetlist;

        if (setlistToLoad && setlistToLoad.items) {
          const setlistType = response.data.room.linkedPermanentSetlist ? 'permanent' : 'temporary';
          console.log(`📋 Loading ${setlistType} setlist from room:`, setlistToLoad);

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
            }
            return null;
          }).filter(Boolean);
          setSetlist(loadedItems);
          console.log(`✅ Loaded ${loadedItems.length} items from ${setlistType} setlist`);
        }

        // Join as operator
        socketService.operatorJoinRoom(user._id, response.data.room._id);
      } catch (error) {
        console.error('❌ Error creating room:', error);
        console.error('Error details:', error.response?.data);
        setError('Failed to create room: ' + (error.response?.data?.error || error.message));
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

  // Load setlist or song if passed via location state or URL params
  useEffect(() => {
    // Wait for room to be ready before loading setlist
    if (!room?._id) {
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
  }, [location.state, location.search, room?._id]);

  // Initialize Chromecast
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
            console.log('✅ Cast session started:', session);
            setCastConnected(true);
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
  }, []);

  const loadSetlist = async (setlistId) => {
    try {
      if (!room?._id) {
        console.error('❌ Cannot load setlist: room not ready');
        setError('Room not ready. Please wait a moment and try again.');
        return;
      }

      // Link this setlist to the room (replaces any previous link)
      try {
        await api.post(`/api/rooms/${room._id}/link-setlist`, { setlistId });
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
      socketService.operatorUpdateBackground(room._id, backgroundUrl);
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
          return song.slides.some(slide =>
            (slide.originalText && slide.originalText.toLowerCase().includes(searchTerm)) ||
            (slide.transliteration && slide.transliteration.toLowerCase().includes(searchTerm)) ||
            (slide.translation && slide.translation.toLowerCase().includes(searchTerm)) ||
            (slide.translationOverflow && slide.translationOverflow.toLowerCase().includes(searchTerm))
          );
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
  };

  const addImageToSetlist = (image) => {
    setSetlist([...setlist, { type: 'image', data: image }]);
  };

  const addBlankToSetlist = () => {
    setSetlist([...setlist, { type: 'blank', data: null }]);
  };

  const removeFromSetlist = (index) => {
    setSetlist(setlist.filter((_, i) => i !== index));
  };

  const moveSetlistItem = (fromIndex, toIndex) => {
    const newSetlist = [...setlist];
    const [movedItem] = newSetlist.splice(fromIndex, 1);
    newSetlist.splice(toIndex, 0, movedItem);
    setSetlist(newSetlist);
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
      const response = await api.post(`/api/rooms/${room._id}/save-setlist`, {
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

  // Handle Chromecast
  const handleCast = () => {
    if (!window.chrome || !window.chrome.cast || !roomPin) {
      console.error('Cast not available or no room PIN');
      return;
    }

    const cast = window.chrome.cast;
    cast.requestSession((session) => {
      console.log('✅ Cast session established:', session);
      setCastConnected(true);

      // Construct the viewer URL with the room PIN
      const viewerUrl = `${window.location.origin}/viewer?pin=${roomPin}`;

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
    }, (error) => {
      console.error('❌ Error launching cast:', error);
      if (error.code !== 'cancel') {
        setError('Failed to connect to Chromecast');
      }
    });
  };

  const handleLoadSetlist = async (setlistId) => {
    setLoadSetlistLoading(true);
    try {
      const response = await api.post(`/api/rooms/${room._id}/link-setlist`, {
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

  const selectItem = (item) => {
    setCurrentItem(item);
    setIsBlankActive(false);

    if (item.type === 'song' || item.type === 'bible') {
      setCurrentSong(item.data);
      setCurrentSlideIndex(0);
      updateSlide(item.data, 0, displayMode, false);
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
    try {
      // Fetch full song details including slides
      const response = await api.get(`/songs/${song._id}`);
      const fullSong = response.data.song;
      selectItem({ type: 'song', data: fullSong });
    } catch (error) {
      console.error('Error fetching song details:', error);
      setError('Failed to load song details');
    }
  };

  const selectSlide = (index) => {
    setCurrentSlideIndex(index);
    setIsBlankActive(false); // Turn off blank when selecting a slide
    if (currentSong) {
      updateSlide(currentSong, index, displayMode, false);
    }
  };

  const updateSlide = (song, slideIndex, mode, isBlank) => {
    console.log('🎬 updateSlide called:', { room, song: song?.title, slideIndex, mode, isBlank });

    if (!room) {
      console.error('❌ Cannot update slide: room is null');
      return;
    }

    console.log('📤 Sending slide update to backend');

    // For Bible passages, send the slide data directly
    const payload = {
      roomId: room._id,
      songId: song?._id || null,
      slideIndex,
      displayMode: mode,
      isBlank
    };

    // If it's a Bible passage, include the slide data and metadata
    if (song?.isBible && song.slides && song.slides[slideIndex]) {
      payload.bibleData = {
        slide: song.slides[slideIndex],
        title: song.title,
        isBible: true
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
      roomId: room._id,
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
        return item.data?._id === currentItem.data?._id;
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
        return item.data?._id === currentItem.data?._id;
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
        return item.data?._id === currentItem.data?._id;
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
        return item.data?._id === currentItem.data?._id;
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
      backgroundColor: '#2d2d2d',
      padding: '20px',
      paddingBottom: '20px',
      display: 'flex',
      justifyContent: 'center'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '900px'
      }}>
      {/* Back Button and Room PIN Display at Top */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '15px',
        padding: '20px',
        marginBottom: '20px',
        textAlign: 'center',
        position: 'relative'
      }}>
        <Button
          variant="outline-secondary"
          onClick={() => navigate('/dashboard')}
          style={{
            position: 'absolute',
            left: '20px',
            top: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}
        >
          <span>←</span>
          <span>Back to Dashboard</span>
        </Button>
        <div style={{
          position: 'absolute',
          right: '20px',
          top: '20px'
        }}>
          <img src="/cast_logo.png" alt="SoluCast Logo" style={{ maxWidth: '40px', height: 'auto' }} />
        </div>
        {roomPin ? (
          <>
            <div style={{
              fontSize: '3rem',
              fontWeight: 'bold',
              letterSpacing: '0.5rem',
              color: '#333',
              marginTop: '40px'
            }}>
              {roomPin}
            </div>
            <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '5px' }}>
              Share this Room PIN with viewers
            </div>
          </>
        ) : (
          <div style={{ marginTop: '40px', textAlign: 'center' }}>
            <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem', marginBottom: '15px' }}>
              <span className="visually-hidden">Loading...</span>
            </div>
            <div style={{ fontSize: '0.9rem', color: '#666' }}>
              Creating your presentation room...
            </div>
          </div>
        )}

        {roomPin && (
          <div style={{ marginTop: '20px' }}>
            <Button
              variant="primary"
              onClick={() => {
                const shareUrl = `${window.location.origin}/viewer?pin=${roomPin}`;
                navigator.clipboard.writeText(shareUrl);
                alert('Share link copied to clipboard!');
              }}
              style={{ marginRight: '10px' }}
            >
              Copy Share Link
            </Button>

            {castAvailable && (
              <Button
                variant={castConnected ? "success" : "outline-primary"}
                onClick={handleCast}
                style={{ marginRight: '10px' }}
                title="Cast to Chromecast"
              >
                {castConnected ? '📡 Casting' : '📺 Cast'}
              </Button>
            )}
            <div style={{
              fontSize: '0.85rem',
              color: '#666',
              marginTop: '10px',
              wordBreak: 'break-all'
            }}>
              {`${window.location.origin}/viewer?pin=${roomPin}`}
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
          backgroundColor: 'white',
          borderRadius: '15px',
          overflow: 'hidden'
        }}>
          <div
            style={{
              padding: '8px 12px',
              backgroundColor: '#f8f9fa',
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
                variant={activeResourcePanel === 'songs' ? 'primary' : 'outline-secondary'}
                size="sm"
                onClick={() => switchResourcePanel('songs')}
                style={{ fontWeight: '500' }}
              >
                Songs
              </Button>
              <Button
                variant={activeResourcePanel === 'images' ? 'primary' : 'outline-secondary'}
                size="sm"
                onClick={() => switchResourcePanel('images')}
                style={{ fontWeight: '500' }}
              >
                Images
              </Button>
              <Button
                variant={activeResourcePanel === 'bible' ? 'primary' : 'outline-secondary'}
                size="sm"
                onClick={() => switchResourcePanel('bible')}
                style={{ fontWeight: '500' }}
              >
                Bible
              </Button>
            </div>

            {/* Search bar */}
            <div style={{ flex: '1 1 200px', minWidth: '200px' }}>
              <InputGroup size="sm">
                <InputGroup.Text>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
                  </svg>
                </InputGroup.Text>
                <Form.Control
                  type="text"
                  placeholder={
                    activeResourcePanel === 'bible'
                      ? "e.g. John 3"
                      : "Search..."
                  }
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  style={{ fontSize: '0.95rem' }}
                />
              </InputGroup>
            </div>
          </div>

          <div style={{ padding: '10px' }}>
            {activeResourcePanel === 'songs' ? (
              <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                {songsLoading ? (
                  <div style={{ textAlign: 'center', color: '#666', padding: '40px' }}>
                    <div className="spinner-border text-primary" role="status" style={{ marginBottom: '10px' }}>
                      <span className="visually-hidden">Loading...</span>
                    </div>
                    <div>Loading songs...</div>
                  </div>
                ) : searchResults.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#666', fontSize: '0.9rem' }}>
                    {searchQuery ? 'No songs match your search' : 'No songs available'}
                  </p>
                ) : (
                  searchResults.map((song) => (
                  <div
                    key={song._id}
                    style={{
                      padding: '8px 10px',
                      backgroundColor: currentSong?._id === song._id ? '#007bff' : 'white',
                      color: currentSong?._id === song._id ? 'white' : '#000',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      borderRadius: '4px',
                      marginBottom: '4px',
                      border: currentSong?._id === song._id ? '2px solid #0056b3' : '1px solid #ddd'
                    }}
                    onClick={() => selectSong(song)}
                  >
                    <span style={{ fontSize: '0.95rem' }}>{song.title}</span>
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
                        background: currentSong?._id === song._id ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
                        addToSetlist(song);

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
                  ))
                )}
              </div>
            ) : activeResourcePanel === 'bible' ? (
              <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                <div style={{ marginBottom: '15px' }}>
                  {/* Side-by-side Book and Chapter selectors (stacks on mobile) */}
                  <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '10px', marginBottom: '15px' }}>
                    <div style={{ flex: isMobile ? '1' : '2' }}>
                      <Form.Label style={{ fontSize: '0.85rem', fontWeight: '500', marginBottom: '6px', display: 'block' }}>
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
                      <Form.Label style={{ fontSize: '0.85rem', fontWeight: '500', marginBottom: '6px', display: 'block' }}>
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
                    <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #ddd' }}>
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
                  <div style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
                    Loading verses...
                  </div>
                )}

                {!bibleLoading && bibleVerses.length === 0 && selectedBibleBook && selectedBibleChapter && (
                  <div style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
                    Select a book and chapter to load verses
                  </div>
                )}
              </div>
            ) : (
              <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                {mediaLoading ? (
                  <div style={{ textAlign: 'center', color: '#666', padding: '40px' }}>
                    <div className="spinner-border text-primary" role="status" style={{ marginBottom: '10px' }}>
                      <span className="visually-hidden">Loading...</span>
                    </div>
                    <div>Loading media library...</div>
                  </div>
                ) : imageSearchResults.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#666', fontSize: '0.9rem' }}>
                    {searchQuery ? 'No images match your search' : 'No images available'}
                  </p>
                ) : (
                  imageSearchResults.map((image) => {
                    const isGradient = image.url.startsWith('linear-gradient');
                    return (
                      <div
                        key={image._id}
                        style={{
                          padding: '8px 10px',
                          backgroundColor: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          cursor: 'pointer',
                          borderRadius: '4px',
                          marginBottom: '4px',
                          border: '1px solid #ddd'
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
                          style={{ fontSize: '0.95rem', flex: 1 }}
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
          backgroundColor: 'white',
          borderRadius: '15px',
          overflow: 'hidden'
        }}>
          <div
            style={{
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#f8f9fa',
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
                  color: '#718096',
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
                    color: '#4A5568',
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
                  color: '#4A5568',
                  padding: '6px 10px',
                  fontSize: '1.4rem',
                  lineHeight: '1',
                  textDecoration: 'none',
                  boxShadow: 'none',
                  borderRadius: '8px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#F7FAFC';
                  e.currentTarget.style.color = '#FF8C42';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#4A5568';
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
                  marginTop: '8px'
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
                          await api.post(`/api/rooms/${room._id}/unlink-setlist`);

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
              </Dropdown.Menu>
            </Dropdown>
          </div>

          {setlistSectionOpen && (
            <div style={{ padding: '10px' }}>
              {setlist.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#666' }}>
                  No songs in setlist. Add songs from above.
                </p>
              ) : (
                <div style={{
                  maxHeight: '220px',
                  overflowY: 'auto',
                  paddingRight: '5px'
                }}>
                  {setlist.map((item, index) => {
                    const getItemDisplay = () => {
                      if (item.type === 'song') {
                        return {
                          title: item.data?.title || 'Unknown Song',
                          bgColor: '#f8f9fa',
                          borderLeft: '4px solid #667eea'
                        };
                      } else if (item.type === 'bible') {
                        return {
                          title: item.data?.title || 'Bible Passage',
                          bgColor: '#f3e5f5',
                          borderLeft: '4px solid #764ba2'
                        };
                      } else if (item.type === 'image') {
                        return {
                          title: item.data?.name || 'Image Slide',
                          bgColor: '#e7f3ff',
                          borderLeft: '4px solid #4facfe'
                        };
                      } else if (item.type === 'blank') {
                        return {
                          title: 'Blank Slide',
                          bgColor: '#fff3e0',
                          borderLeft: '4px solid #f093fb'
                        };
                      }
                      return { title: 'Unknown', bgColor: '#f8f9fa', borderLeft: '4px solid #718096' };
                    };

                    const display = getItemDisplay();

                    return (
                      <div
                        key={index}
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, index)}
                        style={{
                          padding: '8px 10px',
                          backgroundColor: display.bgColor,
                          borderRadius: '6px',
                          borderLeft: display.borderLeft,
                          marginBottom: '6px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          cursor: 'grab',
                          transition: 'all 0.2s ease',
                          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateX(4px)';
                          e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.15)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateX(0)';
                          e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', flex: 1, gap: '6px' }}>
                          <span style={{ fontSize: '1rem', color: '#718096', cursor: 'grab', fontWeight: '600' }}>
                            ⋮⋮
                          </span>
                          <span
                            style={{ fontSize: '0.9rem', cursor: 'pointer', flex: 1, fontWeight: '500', color: '#2d3748' }}
                            onClick={() => selectItem(item)}
                          >
                            {index + 1}. {display.title}
                          </span>
                        </div>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => removeFromSetlist(index)}
                        >
                          Remove
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Slide Preview Section */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '15px',
        overflow: 'hidden'
      }}>
        <div
          style={{
            padding: '15px 20px',
            backgroundColor: '#f8f9fa',
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
              flex: '1 1 auto',
              minWidth: '0',
              overflow: 'hidden'
            }}
          >
            <span style={{ fontSize: '1.5rem', marginRight: '10px', flexShrink: 0 }}>
              {slideSectionOpen ? '▼' : '▶'}
            </span>
            <span style={{
              fontSize: '1.2rem',
              fontWeight: '500',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
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

          {/* Controls */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            flexShrink: 0
          }}>
            <Button
              variant={isBlankActive ? 'warning' : 'dark'}
              onClick={toggleBlankSlide}
              size="sm"
              style={{ fontSize: '0.8rem', padding: '4px 10px', whiteSpace: 'nowrap' }}
            >
              {isBlankActive ? 'Blank ON' : 'Blank'}
            </Button>

            <Button
              variant="info"
              onClick={() => setShowBackgroundModal(true)}
              size="sm"
              style={{ fontSize: '0.8rem', padding: '4px 10px', whiteSpace: 'nowrap' }}
            >
              {isMobile ? 'BG' : 'Background'}
            </Button>

            <Button
              variant="primary"
              onClick={toggleDisplayMode}
              size="sm"
              style={{ fontSize: '0.8rem', padding: '4px 10px', whiteSpace: 'nowrap' }}
            >
              {displayMode === 'original' ? 'Original' : 'Bilingual'}
            </Button>
          </div>
        </div>

        {slideSectionOpen && currentSong && (
          <div>
            <div style={{
              padding: '8px',
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
              gap: '6px',
              maxHeight: 'calc(100vh - 200px)',
              minHeight: 'calc(100vh - 100px)',
              overflowY: 'auto'
            }}>
            {currentSong.slides.map((slide, index) => {
              // Function to get background color based on verse type
              const getBackgroundColor = (verseType, isSelected) => {
                if (isSelected) return '#f0f8ff'; // Light blue for selected

                switch(verseType) {
                  case 'Intro':
                    return '#f0f0f0'; // Light gray
                  case 'Verse1':
                  case 'Verse2':
                  case 'Verse3':
                  case 'Verse4':
                    return '#fff8e1'; // Light yellow
                  case 'PreChorus':
                    return '#fce4ec'; // Light pink
                  case 'Chorus':
                    return '#e1f5fe'; // Light cyan
                  case 'Bridge':
                    return '#f3e5f5'; // Light purple
                  case 'Instrumental':
                    return '#e8f5e9'; // Light green
                  case 'Outro':
                    return '#fff3e0'; // Light orange
                  case 'Tag':
                    return '#ede7f6'; // Light indigo
                  default:
                    return 'white'; // Default white
                }
              };

              return (
              <div
                key={index}
                onClick={() => selectSlide(index)}
                style={{
                  border: currentSlideIndex === index ? '2px solid #007bff' : '1px solid #ddd',
                  borderRadius: '6px',
                  padding: '6px 8px',
                  cursor: 'pointer',
                  backgroundColor: getBackgroundColor(slide.verseType, currentSlideIndex === index)
                }}
              >
                <div style={{
                  color: '#007bff',
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
                <div style={{ fontSize: '0.85rem', lineHeight: '1.3' }}>
                  <div style={{ marginBottom: '2px' }}>
                    {slide.originalText}
                  </div>
                  {slide.transliteration && (
                    <div style={{ marginBottom: '2px' }}>
                      {slide.transliteration}
                    </div>
                  )}
                  {slide.translation && (
                    <div style={{ marginBottom: '2px' }}>
                      {slide.translation}
                    </div>
                  )}
                  {slide.translationOverflow && (
                    <div style={{ marginBottom: '2px' }}>
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
              color: '#666'
            }}>
              {currentItem.data?.name}
            </div>
          </div>
        )}

        {slideSectionOpen && !currentItem && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
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
                <Col key={item._id} xs={6} md={4} lg={3}>
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
                  key={setlist._id}
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
                  onClick={() => handleLoadSetlist(setlist._id)}
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
