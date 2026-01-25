import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Form, Tab, Tabs, Alert, Modal } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api, { getFullImageUrl } from '../services/api';
import { gradientPresets } from '../utils/gradients';

function MediaLibrary() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalTab, setModalTab] = useState('gradient');

  // Form states
  const [newMediaName, setNewMediaName] = useState('');
  const [newMediaUrl, setNewMediaUrl] = useState('');
  const [selectedGradient, setSelectedGradient] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadPreview, setUploadPreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [usage, setUsage] = useState(null);

  useEffect(() => {
    fetchMedia();
    fetchUsage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchUsage = async () => {
    try {
      const response = await api.get('/api/media/usage');
      setUsage(response.data);
    } catch (error) {
      console.error('Error fetching usage:', error);
    }
  };

  const fetchMedia = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/media');
      setMedia(response.data.media);
    } catch (error) {
      console.error('Error fetching media:', error);
      setError(error.response?.data?.error || t('media.failedToLoad'));
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddMedia = async () => {
    setError('');

    if (modalTab === 'upload') {
      // Handle file upload
      if (!selectedFile) {
        setError(t('media.pleaseSelectFile'));
        return;
      }

      setUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('name', newMediaName || selectedFile.name);

        await api.post('/api/media/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });

        setShowAddModal(false);
        setNewMediaName('');
        setSelectedFile(null);
        setUploadPreview('');
        fetchMedia();
        fetchUsage();
      } catch (error) {
        console.error('Error uploading media:', error);
        setError(error.response?.data?.error || t('media.failedToUpload'));
      } finally {
        setUploading(false);
      }
      return;
    }

    let url = '';
    let name = '';

    if (modalTab === 'gradient') {
      if (!selectedGradient) {
        setError(t('media.pleaseSelectGradient'));
        return;
      }
      const gradient = gradientPresets.find(g => g.value === selectedGradient);
      url = selectedGradient;
      name = newMediaName || gradient.name;
    } else {
      if (!newMediaUrl || !newMediaName) {
        setError(t('media.pleaseProvideNameAndUrl'));
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
      setError(error.response?.data?.error || t('media.failedToAdd'));
    }
  };

  const handleDeleteMedia = async (id) => {
    if (!window.confirm(t('media.deleteBackgroundConfirm'))) {
      return;
    }

    try {
      await api.delete(`/api/media/${id}`);
      fetchMedia();
      fetchUsage();
    } catch (error) {
      console.error('Error deleting media:', error);
      alert(error.response?.data?.error || t('media.failedToDelete'));
    }
  };

  const isGradient = (url) => url.startsWith('linear-gradient');

  const formatFileSize = (bytes) => {
    if (!bytes) return null;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2>{t('media.title')}</h2>
          <p className="text-muted">{t('media.subtitle')}</p>
        </div>
        <div>
          <Button variant="primary" className="me-2" onClick={() => navigate('/operator')}>
            {t('dashboard.operator')}
          </Button>
          <Button variant="success" className="me-2" onClick={() => setShowAddModal(true)}>
            + {t('media.addBackground')}
          </Button>
          <Button variant="outline-secondary" onClick={() => navigate('/dashboard')}>
            {t('media.backToDashboard')}
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
                  <p className="text-muted">{t('media.noBackgrounds')}</p>
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
                      background: isGradient(item.url) ? item.url : `url(${getFullImageUrl(item.url)})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      borderTopLeftRadius: '0.25rem',
                      borderTopRightRadius: '0.25rem'
                    }}
                  />
                  <Card.Body>
                    <Card.Title style={{ fontSize: '0.9rem' }}>{item.name}</Card.Title>
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <small className="text-muted">
                          {isGradient(item.url) ? t('media.gradient') : t('media.image')}
                        </small>
                        {item.fileSize && (
                          <small className="text-muted ms-2">
                            ({formatFileSize(item.fileSize)})
                          </small>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline-danger"
                        onClick={() => handleDeleteMedia(item._id)}
                      >
                        {t('common.delete')}
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
          <Modal.Title>{t('media.addBackground')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}

          <Tabs activeKey={modalTab} onSelect={(k) => setModalTab(k)} className="mb-3">
            <Tab eventKey="upload" title={t('media.uploadFile')}>
              {usage && (
                <Alert variant={usage.remaining.images <= 1 || usage.remaining.bytes < 500000 ? 'warning' : 'info'} className="mb-3">
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <strong>{t('media.storage')}:</strong> {formatFileSize(usage.usage.totalBytes)} / {formatFileSize(usage.limits.maxBytes)}
                    </div>
                    <div>
                      <strong>{t('media.images')}:</strong> {usage.usage.imageCount} / {usage.limits.maxImages}
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className="progress" style={{ height: '8px' }}>
                      <div
                        className={`progress-bar ${usage.usage.totalBytes / usage.limits.maxBytes > 0.8 ? 'bg-warning' : 'bg-primary'}`}
                        style={{ width: `${Math.min(100, (usage.usage.totalBytes / usage.limits.maxBytes) * 100)}%` }}
                      />
                    </div>
                  </div>
                </Alert>
              )}

              <Form.Group className="mb-3">
                <Form.Label>{t('media.backgroundNameOptional')}</Form.Label>
                <Form.Control
                  type="text"
                  placeholder={t('media.enterCustomName')}
                  value={newMediaName}
                  onChange={(e) => setNewMediaName(e.target.value)}
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>{t('media.selectImageFile')} *</Form.Label>
                <Form.Control
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  required
                  disabled={usage && usage.remaining.images <= 0}
                />
                <Form.Text className="text-muted">
                  {t('media.uploadHelp')}
                </Form.Text>
              </Form.Group>

              {uploadPreview && (
                <div className="mb-3">
                  <Form.Label>{t('media.preview')}</Form.Label>
                  <div
                    style={{
                      height: '200px',
                      backgroundImage: `url(${uploadPreview})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      borderRadius: '8px',
                      border: '1px solid #dee2e6'
                    }}
                  />
                </div>
              )}
            </Tab>

            <Tab eventKey="gradient" title={t('media.gradient')}>
              <Form.Group className="mb-3">
                <Form.Label>{t('media.backgroundNameOptional')}</Form.Label>
                <Form.Control
                  type="text"
                  placeholder={t('media.enterCustomName')}
                  value={newMediaName}
                  onChange={(e) => setNewMediaName(e.target.value)}
                />
              </Form.Group>

              <Form.Label>{t('media.selectGradient')}</Form.Label>
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

            <Tab eventKey="image" title={t('media.imageUrl')}>
              <Form.Group className="mb-3">
                <Form.Label>{t('media.backgroundNameRequired')} *</Form.Label>
                <Form.Control
                  type="text"
                  placeholder={t('media.enterBackgroundName')}
                  value={newMediaName}
                  onChange={(e) => setNewMediaName(e.target.value)}
                  required
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>{t('media.imageUrlRequired')} *</Form.Label>
                <Form.Control
                  type="url"
                  placeholder="https://example.com/image.jpg"
                  value={newMediaUrl}
                  onChange={(e) => setNewMediaUrl(e.target.value)}
                  required
                />
                <Form.Text className="text-muted">
                  {t('media.urlHelp')}
                </Form.Text>
              </Form.Group>

              {newMediaUrl && (
                <div className="mb-3">
                  <Form.Label>{t('media.preview')}</Form.Label>
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
          <Button variant="secondary" onClick={() => setShowAddModal(false)} disabled={uploading}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={handleAddMedia}
            disabled={uploading || (modalTab === 'upload' && usage && usage.remaining.images <= 0)}
          >
            {uploading ? t('media.uploading') : (modalTab === 'upload' && usage && usage.remaining.images <= 0) ? t('media.limitReached') : t('media.addBackground')}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}

export default MediaLibrary;
