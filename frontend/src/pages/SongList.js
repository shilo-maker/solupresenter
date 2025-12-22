import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Form, InputGroup, Badge, Table, Spinner, Modal, Alert, ProgressBar, Toast, ToastContainer } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

function SongList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResults, setUploadResults] = useState(null);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', variant: 'success' });

  const languages = [
    { code: 'he', name: t('songs.hebrew') },
    { code: 'en', name: t('songs.english') },
    { code: 'es', name: t('songs.spanish') },
    { code: 'fr', name: t('songs.french') },
    { code: 'de', name: t('songs.german') },
    { code: 'ru', name: t('songs.russian') },
    { code: 'ar', name: t('songs.arabic') },
    { code: 'other', name: t('songs.other') }
  ];

  useEffect(() => {
    fetchSongs();
    fetchTags();
  }, []);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (searchQuery || selectedLanguage || selectedTags.length > 0) {
        searchSongs();
      } else {
        fetchSongs();
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery, selectedLanguage, selectedTags]);

  const fetchSongs = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/api/songs');
      console.log('Fetched songs:', response.data.songs.length);
      console.log('Sample song:', response.data.songs[0]);
      setSongs(response.data.songs);
    } catch (error) {
      console.error('Error fetching songs:', error);
      setError('Failed to load songs: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const fetchTags = async () => {
    try {
      const response = await api.get('/api/songs/meta/tags');
      setAvailableTags(response.data.tags);
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  };

  const searchSongs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.append('query', searchQuery);
      if (selectedLanguage) params.append('language', selectedLanguage);
      if (selectedTags.length > 0) params.append('tags', selectedTags.join(','));

      const response = await api.get(`/api/songs/search?${params.toString()}`);
      setSongs(response.data.songs);
    } catch (error) {
      console.error('Error searching songs:', error);
      alert(t('common.failedToSearch'));
    } finally {
      setLoading(false);
    }
  };

  const deleteSong = async (songId) => {
    if (!window.confirm(t('songs.deleteSongConfirm'))) {
      return;
    }

    try {
      await api.delete(`/api/songs/${songId}`);
      setSongs(songs.filter(song => song._id !== songId));
      alert(t('songs.songDeleted'));
    } catch (error) {
      console.error('Error deleting song:', error);
      alert(t('songs.failedToLoad'));
    }
  };

  const getLanguageName = (code) => {
    const lang = languages.find(l => l.code === code);
    return lang ? lang.name : code;
  };

  const toggleTag = (tag) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setSelectedFiles(files);
    setUploadResults(null);
  };

  const handleBulkImport = async () => {
    if (selectedFiles.length === 0) {
      alert(t('songs.selectAtLeastOneFile'));
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);
      setUploadResults(null);

      const formData = new FormData();
      selectedFiles.forEach(file => {
        formData.append('songFiles', file);
      });

      // Simulate progress (since we can't track actual upload progress easily with fetch)
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      // Don't set Content-Type manually - axios will set it with proper boundary for FormData
      const response = await api.post('/api/songs/bulk-import', formData);

      clearInterval(progressInterval);
      setUploadProgress(100);

      setUploadResults(response.data);

      // Refresh song list
      if (response.data.results.successful.length > 0) {
        fetchSongs();
      }

      // Clear selected files
      setSelectedFiles([]);
    } catch (error) {
      console.error('Error uploading files:', error);
      alert(t('songs.failedToUpload') + ': ' + (error.response?.data?.error || error.message));
    } finally {
      setUploading(false);
    }
  };

  const closeBulkImportModal = () => {
    setShowBulkImportModal(false);
    setSelectedFiles([]);
    setUploadResults(null);
    setUploadProgress(0);
  };

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>{t('songs.songLibrary')}</h2>
        <div>
          <Button variant="primary" onClick={() => navigate('/operator')} className="me-2">
            {t('dashboard.operator')}
          </Button>
          <Button variant="outline-secondary" onClick={() => navigate('/dashboard')} className="me-2">
            {t('songs.backToDashboard')}
          </Button>
          <Button variant="success" onClick={() => setShowBulkImportModal(true)} className="me-2">
            {t('songs.bulkImport')}
          </Button>
          <Button variant="primary" onClick={() => navigate('/songs/new')}>
            {t('songs.createNewSong')}
          </Button>
        </div>
      </div>

      {/* Search and Filter Section */}
      <Card className="mb-4">
        <Card.Body>
          <Row className="g-3">
            <Col md={6}>
              <Form.Label>{t('common.search')}</Form.Label>
              <InputGroup>
                <Form.Control
                  type="text"
                  placeholder={t('songs.searchByTitleOrLyrics')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <Button variant="outline-secondary" onClick={() => setSearchQuery('')}>
                    {t('songs.clear')}
                  </Button>
                )}
              </InputGroup>
            </Col>

            <Col md={6}>
              <Form.Label>{t('songs.language')}</Form.Label>
              <Form.Select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
              >
                <option value="">{t('songs.allLanguages')}</option>
                {languages.map(lang => (
                  <option key={lang.code} value={lang.code}>{lang.name}</option>
                ))}
              </Form.Select>
            </Col>

            {availableTags.length > 0 && (
              <Col xs={12}>
                <Form.Label>{t('songs.filterByTags')}</Form.Label>
                <div>
                  {availableTags.map(tag => (
                    <Badge
                      key={tag}
                      bg={selectedTags.includes(tag) ? 'primary' : 'secondary'}
                      className="me-2 mb-2"
                      style={{ cursor: 'pointer', fontSize: '0.9rem' }}
                      onClick={() => toggleTag(tag)}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </Col>
            )}
          </Row>
        </Card.Body>
      </Card>

      {/* Error Display */}
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          <Alert.Heading>Error Loading Songs</Alert.Heading>
          <p>{error}</p>
        </Alert>
      )}

      {/* Songs List */}
      {loading ? (
        <Card className="text-center py-5">
          <Card.Body>
            <Spinner
              animation="border"
              role="status"
              style={{ width: '3rem', height: '3rem' }}
            >
              <span className="visually-hidden">{t('common.loading')}</span>
            </Spinner>
            <h4 className="mt-4">{t('songs.loadingSongs')}</h4>
            <p className="text-muted">{t('songs.loadingSongsDesc')}</p>
          </Card.Body>
        </Card>
      ) : error ? (
        <Card className="text-center py-5">
          <Card.Body>
            <h4 className="text-danger">{t('songs.failedToLoad')}</h4>
            <p>{error}</p>
            <Button variant="primary" onClick={fetchSongs}>
              {t('songs.retry')}
            </Button>
          </Card.Body>
        </Card>
      ) : songs.length === 0 ? (
        <Card className="text-center py-5">
          <Card.Body>
            <h4>{t('songs.noSongs')}</h4>
            <p className="text-muted">{t('songs.noSongsDesc')}</p>
            <Button variant="primary" onClick={() => navigate('/songs/new')}>
              {t('songs.createNewSong')}
            </Button>
          </Card.Body>
        </Card>
      ) : (
        <Card>
          <Card.Header>
            <strong>{songs.length}</strong> {songs.length === 1 ? t('songs.songFound') : t('songs.songsFound')}
          </Card.Header>
          <Table responsive hover>
            <thead>
              <tr>
                <th>{t('songs.songTitle')}</th>
                <th>{t('songs.language')}</th>
                <th>{t('songs.slides')}</th>
                <th>{t('songs.tags')}</th>
                <th>{t('songs.usage')}</th>
                <th>{t('songs.type')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {songs.map(song => (
                <tr key={song._id}>
                  <td>
                    <strong>{song.title}</strong>
                    {song.createdBy && song.createdBy._id === user._id && (
                      <Badge bg="info" className="ms-2">{t('songs.mine')}</Badge>
                    )}
                  </td>
                  <td>{getLanguageName(song.originalLanguage)}</td>
                  <td>{song.slides ? song.slides.length : 0}</td>
                  <td>
                    {song.tags && song.tags.map(tag => (
                      <Badge key={tag} bg="secondary" className="me-1">{tag}</Badge>
                    ))}
                  </td>
                  <td>{song.usageCount || 0}</td>
                  <td>
                    {song.isPublic ? (
                      <Badge bg="success">{t('songs.public')}</Badge>
                    ) : song.isPendingApproval ? (
                      <Badge bg="warning">{t('songs.pending')}</Badge>
                    ) : (
                      <Badge bg="secondary">{t('songs.private')}</Badge>
                    )}
                  </td>
                  <td>
                    <Button
                      size="sm"
                      variant="outline-primary"
                      className="me-2"
                      onClick={() => navigate(`/songs/${song._id}`)}
                    >
                      {t('common.view')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline-secondary"
                      className="me-2"
                      onClick={() => navigate(`/songs/${song._id}/edit`)}
                    >
                      {t('common.edit')}
                    </Button>
                    {song.createdBy && song.createdBy._id === user._id && (
                      <Button
                        size="sm"
                        variant="outline-danger"
                        onClick={() => deleteSong(song._id)}
                      >
                        {t('common.delete')}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {/* Bulk Import Modal */}
      <Modal show={showBulkImportModal} onHide={closeBulkImportModal} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{t('songs.bulkImportSongs')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="info">
            <strong>{t('songs.fileFormat')}:</strong> {t('songs.fileFormatDesc')}:
            <ul className="mb-0 mt-2">
              <li>Line 1: Song title</li>
              <li>Lines 2-5: First slide (Hebrew, transliteration, translation, overflow)</li>
              <li>Lines 6-9: Second slide (same format)</li>
              <li>And so on...</li>
            </ul>
          </Alert>

          <Form.Group className="mb-3">
            <Form.Label>{t('songs.selectFiles')}</Form.Label>
            <Form.Control
              type="file"
              multiple
              accept=".txt"
              onChange={handleFileChange}
              disabled={uploading}
            />
            {selectedFiles.length > 0 && (
              <Form.Text className="text-muted">
                {selectedFiles.length} {t('songs.filesSelected')}
              </Form.Text>
            )}
          </Form.Group>

          {uploading && (
            <div className="mb-3">
              <ProgressBar animated now={uploadProgress} label={`${uploadProgress}%`} />
              <p className="text-center mt-2">{t('songs.uploadingFiles')}</p>
            </div>
          )}

          {uploadResults && (
            <div>
              <Alert variant={uploadResults.results.failed.length === 0 ? 'success' : 'warning'}>
                <strong>{t('songs.importComplete')}</strong>
                <ul className="mb-0 mt-2">
                  <li>{t('songs.totalFiles')}: {uploadResults.summary.total}</li>
                  <li>{t('songs.successful')}: {uploadResults.summary.successful}</li>
                  <li>{t('songs.failed')}: {uploadResults.summary.failed}</li>
                </ul>
              </Alert>

              {uploadResults.results.successful.length > 0 && (
                <div className="mb-3">
                  <h6>{t('songs.successfullyImported')}:</h6>
                  <ul>
                    {uploadResults.results.successful.map((result, idx) => (
                      <li key={idx}>
                        <strong>{result.title}</strong> ({result.slideCount} {t('songs.slides')}) - {result.filename}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {uploadResults.results.failed.length > 0 && (
                <div>
                  <h6 className="text-danger">{t('songs.failedImports')}:</h6>
                  <ul>
                    {uploadResults.results.failed.map((result, idx) => (
                      <li key={idx} className="text-danger">
                        <strong>{result.filename}</strong>: {result.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeBulkImportModal} disabled={uploading}>
            {t('common.close')}
          </Button>
          <Button
            variant="primary"
            onClick={handleBulkImport}
            disabled={uploading || selectedFiles.length === 0}
          >
            {uploading ? t('songs.uploading') : t('songs.uploadAndImport')}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}

export default SongList;
