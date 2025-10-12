import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Form, ListGroup, InputGroup, Alert, Spinner } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';

function SetlistEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [items, setItems] = useState([]);
  const [allSongs, setAllSongs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSetlist();
    fetchSongs();
  }, [id]);

  const fetchSetlist = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/setlists/${id}`);
      const setlist = response.data.setlist;

      setName(setlist.name);
      // Map items to include songData for display
      const mappedItems = setlist.items.map(item => ({
        ...item,
        songData: item.song
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
        order: item.order
      }));

      await api.put(`/api/setlists/${id}`, {
        name: name.trim(),
        items: formattedItems
      });

      alert('Setlist updated successfully!');
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
        <h2>Edit Setlist</h2>
        <Button variant="outline-secondary" onClick={() => navigate(`/setlists/${id}`)}>
          Cancel
        </Button>
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
                      <ListGroup.Item key={index} className="d-flex justify-content-between align-items-center">
                        <div className="d-flex align-items-center flex-grow-1">
                          <span className="me-3 text-muted">#{index + 1}</span>
                          <span>
                            {item.type === 'song' ? (item.songData?.title || 'Unknown Song') : 'Blank Slide'}
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

            {/* Submit Button */}
            <div className="d-grid gap-2">
              <Button
                variant="success"
                type="submit"
                size="lg"
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button
                variant="outline-secondary"
                onClick={() => navigate(`/setlists/${id}`)}
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

export default SetlistEdit;
