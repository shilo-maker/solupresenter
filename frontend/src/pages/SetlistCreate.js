import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Form, ListGroup, InputGroup, Alert } from 'react-bootstrap';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api, { getFullImageUrl } from '../services/api';

function SetlistCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

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

  const { dateStr, timeStr } = getDefaultDateTime();

  const [setlistDate, setSetlistDate] = useState(dateStr);
  const [setlistTime, setSetlistTime] = useState(timeStr);
  const [setlistVenue, setSetlistVenue] = useState('');
  const [items, setItems] = useState([]);
  const [allSongs, setAllSongs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [media, setMedia] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Fetch songs and media on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [songsResponse, mediaResponse] = await Promise.all([
          api.get('/api/songs'),
          api.get('/api/media')
        ]);

        const songs = songsResponse.data.songs;
        setAllSongs(songs);
        setSearchResults(songs);
        setMedia(mediaResponse.data.media);

        // If a songId was passed from navigation state, add it
        if (location.state?.songId) {
          const song = songs.find(s => s._id === location.state.songId);
          if (song) {
            setItems(prevItems => [...prevItems, {
              type: 'song',
              song: song._id,
              songData: song,
              order: prevItems.length
            }]);
          }
        }
      } catch (error) {
        console.error('Error loading data:', error);
        setError('Failed to load songs');
      }
    };

    loadData();
  }, [location.state?.songId]);

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

  const removeItem = (index) => {
    const newItems = items.filter((_, i) => i !== index);
    // Reorder items
    newItems.forEach((item, idx) => {
      item.order = idx;
    });
    setItems(newItems);
  };

  const moveItemUp = (index) => {
    if (index === 0) return;
    const newItems = [...items];
    [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
    // Update order
    newItems.forEach((item, idx) => {
      item.order = idx;
    });
    setItems(newItems);
  };

  const moveItemDown = (index) => {
    if (index === items.length - 1) return;
    const newItems = [...items];
    [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
    // Update order
    newItems.forEach((item, idx) => {
      item.order = idx;
    });
    setItems(newItems);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

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

    if (items.length === 0) {
      setError('Please add at least one item to the setlist');
      return;
    }

    // Convert date from YYYY-MM-DD to DD/MM
    const [, month, day] = setlistDate.split('-');
    const formattedDate = `${day}/${month}`;

    // Generate setlist name: Date(DD/MM) Time(HH:MM) Venue
    const generatedName = `${formattedDate} ${setlistTime} ${setlistVenue}`;

    setSaving(true);

    try {
      // Format items for backend
      const formattedItems = items.map(item => ({
        type: item.type,
        song: item.type === 'song' ? item.song : undefined,
        image: item.type === 'image' ? item.image : undefined,
        order: item.order
      }));

      const response = await api.post('/api/setlists', {
        name: generatedName,
        items: formattedItems
      });

      navigate(`/setlists/${response.data.setlist._id}`);
    } catch (error) {
      console.error('Error creating setlist:', error);
      setError(error.response?.data?.error || 'Failed to create setlist');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>{t('setlists.createNewSetlist')}</h2>
        <div>
          <Button variant="primary" className="me-2" onClick={() => navigate('/operator')}>
            {t('dashboard.operator')}
          </Button>
          <Button variant="outline-secondary" onClick={() => navigate('/setlists')}>
            {t('common.cancel')}
          </Button>
        </div>
      </div>

      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}

      <Form onSubmit={handleSubmit}>
        <Row>
          <Col lg={8}>
            {/* Setlist Details */}
            <Card className="mb-4">
              <Card.Header>
                <h5 className="mb-0">Setlist Details</h5>
              </Card.Header>
              <Card.Body>
                <Row>
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label>Date *</Form.Label>
                      <Form.Control
                        type="date"
                        value={setlistDate}
                        onChange={(e) => setSetlistDate(e.target.value)}
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label>Time *</Form.Label>
                      <Form.Control
                        type="time"
                        value={setlistTime}
                        onChange={(e) => setSetlistTime(e.target.value)}
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label>Venue *</Form.Label>
                      <Form.Control
                        type="text"
                        placeholder="Main Hall"
                        value={setlistVenue}
                        onChange={(e) => setSetlistVenue(e.target.value)}
                        required
                      />
                    </Form.Group>
                  </Col>
                </Row>
                {setlistDate && setlistTime && setlistVenue && (() => {
                  // Format date for preview
                  const [, month, day] = setlistDate.split('-');
                  const formattedDate = `${day}/${month}`;
                  return (
                    <div style={{ padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
                      <small style={{ color: '#666' }}>
                        <strong>Setlist name:</strong> {formattedDate} {setlistTime} {setlistVenue}
                      </small>
                    </div>
                  );
                })()}
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
                      <ListGroup.Item key={index} className="d-flex justify-content-between align-items-center">
                        <div className="d-flex align-items-center flex-grow-1">
                          <span className="me-2" style={{ fontSize: '1.2rem' }}>
                            {item.type === 'song' ? '🎵' : item.type === 'image' ? '🖼️' : '⬛'}
                          </span>
                          <span className="me-3 text-muted">#{index + 1}</span>
                          <span>
                            {item.type === 'song'
                              ? item.songData?.title
                              : item.type === 'image'
                              ? (item.imageData?.name || 'Image Slide')
                              : 'Blank Slide'}
                          </span>
                        </div>
                        <div className="d-flex gap-2">
                          <Button
                            variant="outline-secondary"
                            size="sm"
                            onClick={() => moveItemUp(index)}
                            disabled={index === 0}
                          >
                            ↑
                          </Button>
                          <Button
                            variant="outline-secondary"
                            size="sm"
                            onClick={() => moveItemDown(index)}
                            disabled={index === items.length - 1}
                          >
                            ↓
                          </Button>
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

            {/* Submit Button */}
            <div className="d-grid gap-2">
              <Button
                variant="success"
                type="submit"
                size="lg"
                disabled={saving}
              >
                {saving ? 'Creating...' : 'Create Setlist'}
              </Button>
              <Button
                variant="outline-secondary"
                onClick={() => navigate('/setlists')}
              >
                Cancel
              </Button>
            </div>
          </Col>
        </Row>
      </Form>
    </Container>
  );
}

export default SetlistCreate;
