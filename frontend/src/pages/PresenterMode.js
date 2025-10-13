import React, { useState, useEffect, useCallback } from 'react';
import { Form, Button, InputGroup, Modal, Row, Col } from 'react-bootstrap';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api, { getFullImageUrl } from '../services/api';
import socketService from '../services/socket';

function PresenterMode() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading } = useAuth();

  // Room state
  const [room, setRoom] = useState(null);
  const [roomPin, setRoomPin] = useState('');
  const [roomCreated, setRoomCreated] = useState(false);

  // Song search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [allSongs, setAllSongs] = useState([]);

  // Image search state
  const [imageSearchResults, setImageSearchResults] = useState([]);

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

  // Collapsible sections
  const [activeResourcePanel, setActiveResourcePanel] = useState('songs'); // 'songs' or 'images'
  const [setlistSectionOpen, setSetlistSectionOpen] = useState(true);
  const [slideSectionOpen, setSlideSectionOpen] = useState(true);

  // Switch resource panel and apply search
  const switchResourcePanel = (panel) => {
    setActiveResourcePanel(panel);
    // Re-apply current search query to new panel
    handleSearch(searchQuery);
  };

  // Responsive layout
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Keyboard shortcuts help
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);

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

        // Join as operator
        socketService.operatorJoinRoom(user._id, response.data.room._id);
      } catch (error) {
        console.error('❌ Error creating room:', error);
        console.error('Error details:', error.response?.data);
        alert('Failed to create room: ' + (error.response?.data?.error || error.message));
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
  }, [location.state, location.search]);

  const loadSetlist = async (setlistId) => {
    try {
      const response = await api.get(`/api/setlists/${setlistId}`);
      const loadedSetlist = response.data.setlist;

      // Keep all items (songs, blanks, and images) with their type info
      const items = loadedSetlist.items.map(item => {
        if (item.type === 'song') {
          return { type: 'song', data: item.song };
        } else if (item.type === 'image') {
          return { type: 'image', data: item.image };
        } else if (item.type === 'blank') {
          return { type: 'blank', data: null };
        }
        return null;
      }).filter(Boolean);

      setSetlist(items);
      console.log('✅ Setlist loaded:', items.length, 'items');
    } catch (error) {
      console.error('Error loading setlist:', error);
      alert('Failed to load setlist');
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
      alert('Failed to load song');
    }
  };

  const fetchSongs = async () => {
    try {
      const response = await api.get('/api/songs');
      setAllSongs(response.data.songs);
      setSearchResults(response.data.songs);
    } catch (error) {
      console.error('Error fetching songs:', error);
    }
  };

  const fetchMedia = async () => {
    try {
      const response = await api.get('/api/media');
      setMedia(response.data.media);
      setImageSearchResults(response.data.media); // Initialize with all images
    } catch (error) {
      console.error('Error fetching media:', error);
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

    if (item.type === 'song') {
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

  const selectSong = (song) => {
    selectItem({ type: 'song', data: song });
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
    socketService.operatorUpdateSlide({
      roomId: room._id,
      songId: song?._id || null,
      slideIndex,
      displayMode: mode,
      isBlank
    });
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

  const toggleBlankSlide = () => {
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
        return item.data?._id === currentItem.data?._id;
      }
      return item === currentItem;
    });

    if (currentItemIndex !== -1 && currentItemIndex < setlist.length - 1) {
      const nextItem = setlist[currentItemIndex + 1];
      selectItem(nextItem);
    }
  }, [currentSong, currentItem, currentSlideIndex, displayMode, isBlankActive, setlist]);

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
  }, [currentSong, currentItem, currentSlideIndex, displayMode, isBlankActive, setlist]);

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
  }, [currentItem, setlist]);

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
  }, [currentItem, setlist]);

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
      paddingBottom: '100px',
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
          <img src="/logo.png" alt="SoluCast Logo" style={{ maxWidth: '120px', height: 'auto' }} />
        </div>
        <div style={{
          fontSize: '3rem',
          fontWeight: 'bold',
          letterSpacing: '0.5rem',
          color: '#333',
          marginTop: '40px'
        }}>
          {roomPin || 'Loading...'}
        </div>
        <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '5px' }}>
          Share this Room PIN with viewers
        </div>

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

      {/* Songs/Images and Setlist Side-by-Side */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
        gap: '20px',
        marginBottom: '20px'
      }}>
        {/* Song Search Section */}
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
              gap: '15px',
              flexWrap: 'wrap'
            }}
          >
            {/* Title with collapse toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '0 0 auto' }}>
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
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  style={{ fontSize: '0.95rem' }}
                />
              </InputGroup>
            </div>
          </div>

          <div style={{ padding: '20px' }}>
            {activeResourcePanel === 'songs' ? (
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {searchResults.map((song) => (
                  <div
                    key={song._id}
                    style={{
                      padding: '15px',
                      backgroundColor: currentSong?._id === song._id ? '#007bff' : 'white',
                      color: currentSong?._id === song._id ? 'white' : '#000',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      borderRadius: '5px',
                      marginBottom: '5px',
                      border: currentSong?._id === song._id ? '2px solid #0056b3' : '1px solid #ddd'
                    }}
                    onClick={() => selectSong(song)}
                  >
                    <span style={{ fontSize: '1.1rem' }}>{song.title}</span>
                    <Button
                      variant="dark"
                      size="sm"
                      style={{
                        borderRadius: '50%',
                        width: '35px',
                        height: '35px',
                        padding: '0',
                        fontSize: '1.5rem',
                        backgroundColor: currentSong?._id === song._id ? 'white' : '#000',
                        color: currentSong?._id === song._id ? '#007bff' : 'white',
                        border: 'none'
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        addToSetlist(song);
                      }}
                    >
                      +
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {imageSearchResults.length === 0 ? (
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
                          padding: '12px',
                          backgroundColor: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          cursor: 'pointer',
                          borderRadius: '5px',
                          marginBottom: '5px',
                          border: '1px solid #ddd'
                        }}
                      >
                        <div
                          style={{
                            width: '50px',
                            height: '50px',
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
                          variant="dark"
                          size="sm"
                          style={{
                            borderRadius: '50%',
                            width: '35px',
                            height: '35px',
                            padding: '0',
                            fontSize: '1.5rem',
                            backgroundColor: '#000',
                            color: 'white',
                            border: 'none'
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            addImageToSetlist(image);
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
            onClick={() => setSetlistSectionOpen(!setlistSectionOpen)}
            style={{
              padding: '15px 20px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#f8f9fa'
            }}
          >
            <span style={{ fontSize: '1.5rem', marginRight: '10px' }}>
              {setlistSectionOpen ? '▼' : '▶'}
            </span>
            <span style={{ fontSize: '1.2rem', fontWeight: '500' }}>Setlist</span>
          </div>

          {setlistSectionOpen && (
            <div style={{ padding: '20px' }}>
              {setlist.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#666' }}>
                  No songs in setlist. Add songs from above.
                </p>
              ) : (
                <div>
                  {setlist.map((item, index) => {
                    const getItemDisplay = () => {
                      if (item.type === 'song') {
                        return {
                          icon: '🎵',
                          title: item.data?.title || 'Unknown Song',
                          bgColor: '#f8f9fa'
                        };
                      } else if (item.type === 'image') {
                        return {
                          icon: '🖼️',
                          title: item.data?.name || 'Image Slide',
                          bgColor: '#e7f3ff'
                        };
                      } else if (item.type === 'blank') {
                        return {
                          icon: '⬛',
                          title: 'Blank Slide',
                          bgColor: '#fff3e0'
                        };
                      }
                      return { icon: '?', title: 'Unknown', bgColor: '#f8f9fa' };
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
                          padding: '15px',
                          backgroundColor: display.bgColor,
                          borderRadius: '5px',
                          marginBottom: '10px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          cursor: 'grab'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', flex: 1, gap: '10px' }}>
                          <span style={{ fontSize: '1.2rem', color: '#666', cursor: 'grab' }}>
                            ⋮⋮
                          </span>
                          <span style={{ fontSize: '1.3rem' }}>{display.icon}</span>
                          <span
                            style={{ fontSize: '1.1rem', cursor: 'pointer', flex: 1 }}
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
            gap: '15px',
            flexWrap: 'wrap'
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
              minWidth: '200px'
            }}
          >
            <span style={{ fontSize: '1.5rem', marginRight: '10px' }}>
              {slideSectionOpen ? '▼' : '▶'}
            </span>
            <span style={{ fontSize: '1.2rem', fontWeight: '500' }}>
              {currentItem
                ? currentItem.type === 'song'
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
            gap: '10px',
            flexWrap: 'wrap'
          }}>
            <Button
              variant={isBlankActive ? 'warning' : 'dark'}
              onClick={toggleBlankSlide}
              size="sm"
              style={{ fontSize: '0.9rem', padding: '6px 16px' }}
            >
              {isBlankActive ? 'Blank ON' : 'Blank'}
            </Button>

            <Button
              variant="info"
              onClick={() => setShowBackgroundModal(true)}
              size="sm"
              style={{ fontSize: '0.9rem', padding: '6px 16px' }}
            >
              Background
            </Button>

            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <Button
                variant={displayMode === 'original' ? 'primary' : 'outline-secondary'}
                onClick={toggleDisplayMode}
                size="sm"
                style={{ minWidth: '80px', fontSize: '0.85rem' }}
              >
                Original
              </Button>
              <Button
                variant={displayMode === 'bilingual' ? 'primary' : 'outline-secondary'}
                onClick={toggleDisplayMode}
                size="sm"
                style={{ minWidth: '80px', fontSize: '0.85rem' }}
              >
                Bilingual
              </Button>
            </div>
          </div>
        </div>

        {slideSectionOpen && currentSong && (
          <div>
            {/* Next Slide Preview Banner */}
            {currentSlideIndex < currentSong.slides.length - 1 && (
              <div style={{
                padding: '12px 20px',
                backgroundColor: '#e7f3ff',
                borderBottom: '2px solid #007bff',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  color: '#007bff',
                  minWidth: '80px'
                }}>
                  NEXT SLIDE:
                </div>
                <div style={{
                  fontSize: '0.9rem',
                  color: '#333',
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {currentSong.slides[currentSlideIndex + 1].verseType && (
                    <strong style={{ color: '#007bff', marginRight: '8px' }}>
                      {currentSong.slides[currentSlideIndex + 1].verseType}:
                    </strong>
                  )}
                  {currentSong.slides[currentSlideIndex + 1].originalText}
                </div>
              </div>
            )}

            <div style={{
              padding: '20px',
              maxHeight: '500px',
              overflowY: 'auto',
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
              gap: '15px'
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
                  border: currentSlideIndex === index ? '3px solid #007bff' : '1px solid #ddd',
                  borderRadius: '10px',
                  padding: '20px',
                  cursor: 'pointer',
                  backgroundColor: getBackgroundColor(slide.verseType, currentSlideIndex === index)
                }}
              >
                <div style={{
                  color: '#007bff',
                  fontWeight: 'bold',
                  marginBottom: '10px',
                  fontSize: '1rem'
                }}>
                  {slide.verseType ? `${slide.verseType} - ` : ''}Slide {index + 1}
                </div>
                <div style={{ fontSize: '1.1rem', lineHeight: '1.6' }}>
                  <div style={{ marginBottom: '5px' }}>
                    {slide.originalText}
                  </div>
                  {slide.transliteration && (
                    <div style={{ marginBottom: '5px' }}>
                      {slide.transliteration}
                    </div>
                  )}
                  {slide.translation && (
                    <div style={{ marginBottom: '5px' }}>
                      {slide.translation}
                    </div>
                  )}
                  {slide.translationOverflow && (
                    <div style={{ marginBottom: '5px' }}>
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

      </div>
    </div>
  );
}

export default PresenterMode;
