import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Form, ListGroup, InputGroup, Alert, Spinner } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api, { getFullImageUrl } from '../services/api';

function SetlistEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [items, setItems] = useState([]);
  const [allSongs, setAllSongs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [media, setMedia] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Bible state
  const [bibleBooks, setBibleBooks] = useState([]);
  const [selectedBibleBook, setSelectedBibleBook] = useState('');
  const [selectedBibleChapter, setSelectedBibleChapter] = useState('');
  const [bibleVerses, setBibleVerses] = useState([]);
  const [bibleLoading, setBibleLoading] = useState(false);

  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState(null);

  useEffect(() => {
    fetchSetlist();
    fetchSongs();
    fetchMedia();
    fetchBibleBooks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchSetlist = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/setlists/${id}`);
      const setlist = response.data.setlist;

      setName(setlist.name);
      // Map items to include songData, imageData, or bibleData for display
      const mappedItems = setlist.items.map(item => ({
        ...item,
        songData: item.song,
        imageData: item.image,
        bibleData: item.bibleData
      }));
      setItems(mappedItems);
    } catch (error) {
      console.error('Error fetching setlist:', error);
      setError(error.response?.data?.error || 'Failed to load setlist');
    } finally {
      setLoading(false);
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
    } catch (error) {
      console.error('Error fetching media:', error);
    }
  };

  const fetchBibleBooks = async () => {
    try {
      const response = await api.get('/api/bible/books');
      setBibleBooks(response.data.books);
    } catch (error) {
      console.error('Error fetching Bible books:', error);
    }
  };

  const fetchBibleVerses = async (book, chapter) => {
    if (!book || !chapter) return;

    setBibleLoading(true);
    try {
      const response = await api.get(`/api/bible/verses/${encodeURIComponent(book)}/${chapter}`);
      const verses = response.data.verses;

      // Convert verses to slides format
      const bibleSlides = verses.map(verse => ({
        originalText: verse.hebrew,
        translation: verse.text,
        verseNumber: verse.verse
      }));

      setBibleVerses(bibleSlides);
    } catch (error) {
      console.error('Error fetching Bible verses:', error);
      setBibleVerses([]);
    } finally {
      setBibleLoading(false);
    }
  };

  useEffect(() => {
    if (selectedBibleBook && selectedBibleChapter) {
      fetchBibleVerses(selectedBibleBook, selectedBibleChapter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBibleBook, selectedBibleChapter]);

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (query.trim() === '') {
      setSearchResults(allSongs);
    } else {
      const filtered = allSongs.filter(song =>
        song.title.toLowerCase().includes(query.toLowerCase())
      );
      setSearchResults(filtered);
    }
  };

  const addSongToSetlist = (song) => {
    setItems([...items, {
      type: 'song',
      song: song._id,
      songData: song,
      order: items.length
    }]);
  };

  const addBlankSlide = () => {
    setItems([...items, {
      type: 'blank',
      order: items.length
    }]);
  };

  const addImageToSetlist = (image) => {
    setItems([...items, {
      type: 'image',
      image: image._id,
      imageData: image,
      order: items.length
    }]);
  };

  const addBibleToSetlist = (passage) => {
    setItems([...items, {
      type: 'bible',
      bibleData: {
        book: passage.book,
        chapter: passage.chapter,
        title: passage.title,
        slides: passage.slides
      },
      order: items.length
    }]);
  };

  const removeItem = (index) => {
    const newItems = items.filter((_, i) => i !== index);
    // Reorder items
    newItems.forEach((item, idx) => {
      item.order = idx;
    });
    setItems(newItems);
  };

  // Drag and drop handlers
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newItems = [...items];
    const draggedItem = newItems[draggedIndex];

    // Remove dragged item
    newItems.splice(draggedIndex, 1);
    // Insert at new position
    newItems.splice(index, 0, draggedItem);

    // Update order
    newItems.forEach((item, idx) => {
      item.order = idx;
    });

    setItems(newItems);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please enter a setlist name');
      return;
    }

    if (items.length === 0) {
      setError('Please add at least one item to the setlist');
      return;
    }

    setSaving(true);

    try {
      // Format items for backend
      const formattedItems = items.map(item => ({
        type: item.type,
        song: item.type === 'song' ? (item.song._id || item.song) : undefined,
        image: item.type === 'image' ? (item.image._id || item.image) : undefined,
        bibleData: item.type === 'bible' ? item.bibleData : undefined,
        order: item.order
      }));

      await api.put(`/api/setlists/${id}`, {
        name: name.trim(),
        items: formattedItems
      });

      alert(t('setlists.setlistUpdated'));
      navigate(`/setlists/${id}`);
    } catch (error) {
      console.error('Error updating setlist:', error);
      setError(error.response?.data?.error || 'Failed to update setlist');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </Container>
    );
  }

  if (error && !name) {
    return (
      <Container className="py-5">
        <Alert variant="danger">{error}</Alert>
        <Button onClick={() => navigate('/setlists')}>Back to Setlists</Button>
      </Container>
    );
  }

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>{t('setlists.editSetlist')}</h2>
        <div className="d-flex gap-2">
          <Button variant="primary" onClick={() => navigate('/operator')}>
            {t('dashboard.operator')}
          </Button>
          <Button
            variant="success"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? t('songs.saving') : t('songs.saveChanges')}
          </Button>
          <Button variant="outline-secondary" onClick={() => navigate(`/setlists/${id}`)}>
            {t('common.cancel')}
          </Button>
        </div>
      </div>

      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}

      <Form onSubmit={handleSubmit}>
        <Row>
          <Col lg={8}>
            {/* Setlist Name */}
            <Card className="mb-4">
              <Card.Header>
                <h5 className="mb-0">Setlist Details</h5>
              </Card.Header>
              <Card.Body>
                <Form.Group>
                  <Form.Label>Setlist Name *</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Enter setlist name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </Form.Group>
              </Card.Body>
            </Card>

            {/* Setlist Items */}
            <Card className="mb-4">
              <Card.Header>
                <h5 className="mb-0">Setlist Items ({items.length})</h5>
              </Card.Header>
              <Card.Body>
                {items.length === 0 ? (
                  <p className="text-muted text-center py-3">
                    No items added yet. Add songs from the right panel or add blank slides.
                  </p>
                ) : (
                  <ListGroup>
                    {items.map((item, index) => (
                      <ListGroup.Item
                        key={index}
                        className="d-flex justify-content-between align-items-center"
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragEnd={handleDragEnd}
                        style={{
                          cursor: 'grab',
                          opacity: draggedIndex === index ? 0.5 : 1,
                          transition: 'opacity 0.2s',
                          backgroundColor: draggedIndex === index ? '#27272a' : 'transparent'
                        }}
                      >
                        <div className="d-flex align-items-center flex-grow-1">
                          <span className="me-2" style={{ fontSize: '1.2rem', cursor: 'grab' }}>
                            ⋮⋮
                          </span>
                          <span className="me-2" style={{ fontSize: '1.2rem' }}>
                            {item.type === 'song' ? '🎵' : item.type === 'image' ? '🖼️' : item.type === 'bible' ? (
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style={{ verticalAlign: 'middle' }}>
                                <path d="M1 2.828c.885-.37 2.154-.769 3.388-.893 1.33-.134 2.458.063 3.112.752v9.746c-.935-.53-2.12-.603-3.213-.493-1.18.12-2.37.461-3.287.811zm7.5-.141c.654-.689 1.782-.886 3.112-.752 1.234.124 2.503.523 3.388.893v9.923c-.918-.35-2.107-.692-3.287-.81-1.094-.111-2.278-.039-3.213.492zM8 1.783C7.015.936 5.587.81 4.287.94c-1.514.153-3.042.672-3.994 1.105A.5.5 0 0 0 0 2.5v11a.5.5 0 0 0 .707.455c.882-.4 2.303-.881 3.68-1.02 1.409-.142 2.59.087 3.223.877a.5.5 0 0 0 .78 0c.633-.79 1.814-1.019 3.222-.877 1.378.139 2.8.62 3.681 1.02A.5.5 0 0 0 16 13.5v-11a.5.5 0 0 0-.293-.455c-.952-.433-2.48-.952-3.994-1.105C10.413.809 8.985.936 8 1.783"/>
                              </svg>
                            ) : '⬛'}
                          </span>
                          <span className="me-3 text-muted">#{index + 1}</span>
                          <span>
                            {item.type === 'song'
                              ? (item.songData?.title || 'Unknown Song')
                              : item.type === 'image'
                              ? (item.imageData?.name || 'Image Slide')
                              : item.type === 'bible'
                              ? (item.bibleData?.title || 'Bible Passage')
                              : 'Blank Slide'}
                          </span>
                        </div>
                        <div className="d-flex gap-2">
                          <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={() => removeItem(index)}
                          >
                            Remove
                          </Button>
                        </div>
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                )}
              </Card.Body>
            </Card>
          </Col>

          <Col lg={4}>
            {/* Add Songs */}
            <Card className="mb-3">
              <Card.Header>
                <h5 className="mb-0">Add Songs</h5>
              </Card.Header>
              <Card.Body>
                <InputGroup className="mb-3">
                  <InputGroup.Text>🔍</InputGroup.Text>
                  <Form.Control
                    type="text"
                    placeholder="Search songs..."
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                  />
                </InputGroup>

                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {searchResults.map((song) => (
                    <div
                      key={song._id}
                      className="d-flex justify-content-between align-items-center mb-2 p-2 border rounded"
                      style={{ cursor: 'pointer' }}
                    >
                      <span style={{ fontSize: '0.9rem' }}>{song.title}</span>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => addSongToSetlist(song)}
                      >
                        Add
                      </Button>
                    </div>
                  ))}
                </div>
              </Card.Body>
            </Card>

            {/* Add Images */}
            <Card className="mb-3">
              <Card.Header>
                <h5 className="mb-0">Add Images</h5>
              </Card.Header>
              <Card.Body>
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {media.length === 0 ? (
                    <p className="text-muted text-center py-3" style={{ fontSize: '0.85rem' }}>
                      No images available. Visit Media Library to add backgrounds.
                    </p>
                  ) : (
                    <div className="d-grid gap-2">
                      {media.map((image) => {
                        const isGradient = image.url.startsWith('linear-gradient');
                        return (
                          <div
                            key={image._id}
                            className="d-flex align-items-center gap-2 p-2 border rounded"
                            style={{ cursor: 'pointer' }}
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
                            <span className="flex-grow-1" style={{ fontSize: '0.85rem' }}>
                              {image.name}
                            </span>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => addImageToSetlist(image)}
                            >
                              Add
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  className="w-100 mt-2"
                  onClick={() => window.open('/media', '_blank')}
                >
                  Manage Images
                </Button>
              </Card.Body>
            </Card>

            {/* Add Bible Reading */}
            <Card className="mb-3">
              <Card.Header>
                <h5 className="mb-0">Add Bible Reading</h5>
              </Card.Header>
              <Card.Body>
                <div className="mb-2">
                  <Form.Label style={{ fontSize: '0.85rem', marginBottom: '5px' }}>
                    Book
                  </Form.Label>
                  <Form.Select
                    size="sm"
                    value={selectedBibleBook}
                    onChange={(e) => setSelectedBibleBook(e.target.value)}
                    style={{ fontSize: '0.85rem' }}
                  >
                    <option value="">Select book...</option>
                    {bibleBooks.map((book) => (
                      <option key={book.name} value={book.name}>
                        {book.name}
                      </option>
                    ))}
                  </Form.Select>
                </div>

                <div className="mb-2">
                  <Form.Label style={{ fontSize: '0.85rem', marginBottom: '5px' }}>
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
                          Chapter {i + 1}
                        </option>
                      ));
                    })()}
                  </Form.Select>
                </div>

                {bibleLoading && (
                  <div style={{ textAlign: 'center', padding: '10px', color: '#a1a1aa' }}>
                    Loading verses...
                  </div>
                )}

                {selectedBibleBook && selectedBibleChapter && !bibleLoading && bibleVerses.length > 0 && (
                  <Button
                    variant="primary"
                    size="sm"
                    className="w-100 mt-2"
                    onClick={() => {
                      const biblePassage = {
                        book: selectedBibleBook,
                        chapter: parseInt(selectedBibleChapter),
                        title: `${selectedBibleBook} ${selectedBibleChapter}`,
                        slides: bibleVerses
                      };
                      addBibleToSetlist(biblePassage);
                      setSelectedBibleBook('');
                      setSelectedBibleChapter('');
                      setBibleVerses([]);
                    }}
                  >
                    + Add {selectedBibleBook} {selectedBibleChapter}
                  </Button>
                )}
              </Card.Body>
            </Card>

            {/* Add Blank Slide */}
            <Card className="mb-3">
              <Card.Header>
                <h5 className="mb-0">Add Blank Slide</h5>
              </Card.Header>
              <Card.Body>
                <Button
                  variant="outline-secondary"
                  className="w-100"
                  onClick={addBlankSlide}
                >
                  + Add Blank Slide
                </Button>
              </Card.Body>
            </Card>

          </Col>
        </Row>
      </Form>
    </Container>
  );
}

export default SetlistEdit;
