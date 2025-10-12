import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Form, Tab, Tabs, Alert, Modal } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { gradientPresets } from '../utils/gradients';

function MediaLibrary() {
  const navigate = useNavigate();
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalTab, setModalTab] = useState('gradient');

  // Form states
  const [newMediaName, setNewMediaName] = useState('');
  const [newMediaUrl, setNewMediaUrl] = useState('');
  const [selectedGradient, setSelectedGradient] = useState('');

  useEffect(() => {
    fetchMedia();
  }, []);

  const fetchMedia = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/media');
      setMedia(response.data.media);
    } catch (error) {
      console.error('Error fetching media:', error);
      setError(error.response?.data?.error || 'Failed to load media');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMedia = async () => {
    setError('');

    let url = '';
    let name = '';

    if (modalTab === 'gradient') {
      if (!selectedGradient) {
        setError('Please select a gradient');
        return;
      }
      const gradient = gradientPresets.find(g => g.value === selectedGradient);
      url = selectedGradient;
      name = newMediaName || gradient.name;
    } else {
      if (!newMediaUrl || !newMediaName) {
        setError('Please provide both name and URL');
        return;
      }
      url = newMediaUrl;
      name = newMediaName;
    }

    try {
      await api.post('/api/media', {
        name,
        type: modalTab === 'gradient' ? 'image' : 'image',
        url
      });

      setShowAddModal(false);
      setNewMediaName('');
      setNewMediaUrl('');
      setSelectedGradient('');
      fetchMedia();
    } catch (error) {
      console.error('Error adding media:', error);
      setError(error.response?.data?.error || 'Failed to add media');
    }
  };

  const handleDeleteMedia = async (id) => {
    if (!window.confirm('Are you sure you want to delete this background?')) {
      return;
    }

    try {
      await api.delete(`/api/media/${id}`);
      fetchMedia();
    } catch (error) {
      console.error('Error deleting media:', error);
      alert(error.response?.data?.error || 'Failed to delete media');
    }
  };

  const isGradient = (url) => url.startsWith('linear-gradient');

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2>Media Library</h2>
          <p className="text-muted">Manage background images and gradients</p>
        </div>
        <div>
          <Button variant="primary" className="me-2" onClick={() => setShowAddModal(true)}>
            + Add Background
          </Button>
          <Button variant="outline-secondary" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </Button>
        </div>
      </div>

      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : (
        <Row className="g-3">
          {media.length === 0 ? (
            <Col>
              <Card>
                <Card.Body className="text-center py-5">
                  <p className="text-muted">No backgrounds yet. Click "Add Background" to get started!</p>
                </Card.Body>
              </Card>
            </Col>
          ) : (
            media.map((item) => (
              <Col key={item._id} md={6} lg={4} xl={3}>
                <Card>
                  <div
                    style={{
                      height: '150px',
                      background: isGradient(item.url) ? item.url : `url(${item.url})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      borderTopLeftRadius: '0.25rem',
                      borderTopRightRadius: '0.25rem'
                    }}
                  />
                  <Card.Body>
                    <Card.Title style={{ fontSize: '0.9rem' }}>{item.name}</Card.Title>
                    <div className="d-flex justify-content-between align-items-center">
                      <small className="text-muted">
                        {isGradient(item.url) ? 'Gradient' : 'Image'}
                      </small>
                      <Button
                        size="sm"
                        variant="outline-danger"
                        onClick={() => handleDeleteMedia(item._id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            ))
          )}
        </Row>
      )}

      {/* Add Media Modal */}
      <Modal show={showAddModal} onHide={() => setShowAddModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Add Background</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}

          <Tabs activeKey={modalTab} onSelect={(k) => setModalTab(k)} className="mb-3">
            <Tab eventKey="gradient" title="Gradient">
              <Form.Group className="mb-3">
                <Form.Label>Background Name (optional)</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Enter a custom name"
                  value={newMediaName}
                  onChange={(e) => setNewMediaName(e.target.value)}
                />
              </Form.Group>

              <Form.Label>Select a Gradient</Form.Label>
              <Row className="g-2">
                {gradientPresets.map((gradient) => (
                  <Col key={gradient.value} xs={6} md={4}>
                    <div
                      onClick={() => setSelectedGradient(gradient.value)}
                      style={{
                        height: '80px',
                        background: gradient.value,
                        borderRadius: '8px',
                        cursor: 'pointer',
                        border: selectedGradient === gradient.value ? '3px solid #0d6efd' : '2px solid #dee2e6',
                        display: 'flex',
                        alignItems: 'flex-end',
                        padding: '8px',
                        transition: 'all 0.2s'
                      }}
                    >
                      <small style={{ color: 'white', fontWeight: 'bold', textShadow: '1px 1px 2px rgba(0,0,0,0.5)' }}>
                        {gradient.name}
                      </small>
                    </div>
                  </Col>
                ))}
              </Row>
            </Tab>

            <Tab eventKey="image" title="Image URL">
              <Form.Group className="mb-3">
                <Form.Label>Background Name *</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Enter background name"
                  value={newMediaName}
                  onChange={(e) => setNewMediaName(e.target.value)}
                  required
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Image URL *</Form.Label>
                <Form.Control
                  type="url"
                  placeholder="https://example.com/image.jpg"
                  value={newMediaUrl}
                  onChange={(e) => setNewMediaUrl(e.target.value)}
                  required
                />
                <Form.Text className="text-muted">
                  Enter a direct URL to an image (JPG, PNG, etc.)
                </Form.Text>
              </Form.Group>

              {newMediaUrl && (
                <div className="mb-3">
                  <Form.Label>Preview</Form.Label>
                  <div
                    style={{
                      height: '200px',
                      backgroundImage: `url(${newMediaUrl})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      borderRadius: '8px',
                      border: '1px solid #dee2e6'
                    }}
                  />
                </div>
              )}
            </Tab>
          </Tabs>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowAddModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleAddMedia}>
            Add Background
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}

export default MediaLibrary;
