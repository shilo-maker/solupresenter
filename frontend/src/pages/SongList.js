import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Form, InputGroup, Badge, Table, Spinner, Modal, Alert, ProgressBar } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

function SongList() {
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

  const languages = [
    { code: 'he', name: 'Hebrew' },
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'ru', name: 'Russian' },
    { code: 'ar', name: 'Arabic' },
    { code: 'other', name: 'Other' }
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
      const response = await api.get('/api/songs');
      setSongs(response.data.songs);
    } catch (error) {
      console.error('Error fetching songs:', error);
      alert('Failed to load songs');
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
      alert('Failed to search songs');
    } finally {
      setLoading(false);
    }
  };

  const deleteSong = async (songId) => {
    if (!window.confirm('Are you sure you want to delete this song?')) {
      return;
    }

    try {
      await api.delete(`/api/songs/${songId}`);
      setSongs(songs.filter(song => song._id !== songId));
      alert('Song deleted successfully');
    } catch (error) {
      console.error('Error deleting song:', error);
      alert('Failed to delete song');
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
      alert('Please select at least one file');
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
      alert('Failed to upload files: ' + (error.response?.data?.error || error.message));
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
        <h2>Song Library</h2>
        <div>
          <Button variant="outline-secondary" onClick={() => navigate('/dashboard')} className="me-2">
            Back to Dashboard
          </Button>
          <Button variant="success" onClick={() => setShowBulkImportModal(true)} className="me-2">
            Bulk Import
          </Button>
          <Button variant="primary" onClick={() => navigate('/songs/new')}>
            Create New Song
          </Button>
        </div>
      </div>

      {/* Search and Filter Section */}
      <Card className="mb-4">
        <Card.Body>
          <Row className="g-3">
            <Col md={6}>
              <Form.Label>Search</Form.Label>
              <InputGroup>
                <Form.Control
                  type="text"
                  placeholder="Search by title or lyrics..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <Button variant="outline-secondary" onClick={() => setSearchQuery('')}>
                    Clear
                  </Button>
                )}
              </InputGroup>
            </Col>

            <Col md={6}>
              <Form.Label>Language</Form.Label>
              <Form.Select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
              >
                <option value="">All Languages</option>
                {languages.map(lang => (
                  <option key={lang.code} value={lang.code}>{lang.name}</option>
                ))}
              </Form.Select>
            </Col>

            {availableTags.length > 0 && (
              <Col xs={12}>
                <Form.Label>Filter by Tags</Form.Label>
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

      {/* Songs List */}
      {loading ? (
        <Card className="text-center py-5">
          <Card.Body>
            <Spinner
              animation="border"
              role="status"
              style={{ width: '3rem', height: '3rem' }}
            >
              <span className="visually-hidden">Loading...</span>
            </Spinner>
            <h4 className="mt-4">Loading songs...</h4>
            <p className="text-muted">Please wait while we fetch all songs from the database</p>
          </Card.Body>
        </Card>
      ) : songs.length === 0 ? (
        <Card className="text-center py-5">
          <Card.Body>
            <h4>No songs found</h4>
            <p className="text-muted">Create your first song to get started!</p>
            <Button variant="primary" onClick={() => navigate('/songs/new')}>
              Create New Song
            </Button>
          </Card.Body>
        </Card>
      ) : (
        <Card>
          <Card.Header>
            <strong>{songs.length}</strong> {songs.length === 1 ? 'song' : 'songs'} found
          </Card.Header>
          <Table responsive hover>
            <thead>
              <tr>
                <th>Title</th>
                <th>Language</th>
                <th>Slides</th>
                <th>Tags</th>
                <th>Usage</th>
                <th>Type</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {songs.map(song => (
                <tr key={song._id}>
                  <td>
                    <strong>{song.title}</strong>
                    {song.createdBy._id === user._id && (
                      <Badge bg="info" className="ms-2">Mine</Badge>
                    )}
                  </td>
                  <td>{getLanguageName(song.originalLanguage)}</td>
                  <td>{song.slides.length}</td>
                  <td>
                    {song.tags.map(tag => (
                      <Badge key={tag} bg="secondary" className="me-1">{tag}</Badge>
                    ))}
                  </td>
                  <td>{song.usageCount}</td>
                  <td>
                    {song.isPublic ? (
                      <Badge bg="success">Public</Badge>
                    ) : song.isPendingApproval ? (
                      <Badge bg="warning">Pending</Badge>
                    ) : (
                      <Badge bg="secondary">Private</Badge>
                    )}
                  </td>
                  <td>
                    <Button
                      size="sm"
                      variant="outline-primary"
                      className="me-2"
                      onClick={() => navigate(`/songs/${song._id}`)}
                    >
                      View
                    </Button>
                    <Button
                      size="sm"
                      variant="outline-secondary"
                      className="me-2"
                      onClick={() => navigate(`/songs/${song._id}/edit`)}
                    >
                      Edit
                    </Button>
                    {song.createdBy._id === user._id && (
                      <Button
                        size="sm"
                        variant="outline-danger"
                        onClick={() => deleteSong(song._id)}
                      >
                        Delete
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
          <Modal.Title>Bulk Import Songs</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="info">
            <strong>File Format:</strong> Each .txt file should contain:
            <ul className="mb-0 mt-2">
              <li>Line 1: Song title</li>
              <li>Lines 2-5: First slide (Hebrew, transliteration, translation, overflow)</li>
              <li>Lines 6-9: Second slide (same format)</li>
              <li>And so on...</li>
            </ul>
          </Alert>

          <Form.Group className="mb-3">
            <Form.Label>Select .txt Files (Max 50 files)</Form.Label>
            <Form.Control
              type="file"
              multiple
              accept=".txt"
              onChange={handleFileChange}
              disabled={uploading}
            />
            {selectedFiles.length > 0 && (
              <Form.Text className="text-muted">
                {selectedFiles.length} file(s) selected
              </Form.Text>
            )}
          </Form.Group>

          {uploading && (
            <div className="mb-3">
              <ProgressBar animated now={uploadProgress} label={`${uploadProgress}%`} />
              <p className="text-center mt-2">Uploading and processing files...</p>
            </div>
          )}

          {uploadResults && (
            <div>
              <Alert variant={uploadResults.results.failed.length === 0 ? 'success' : 'warning'}>
                <strong>Import Complete!</strong>
                <ul className="mb-0 mt-2">
                  <li>Total files: {uploadResults.summary.total}</li>
                  <li>Successful: {uploadResults.summary.successful}</li>
                  <li>Failed: {uploadResults.summary.failed}</li>
                </ul>
              </Alert>

              {uploadResults.results.successful.length > 0 && (
                <div className="mb-3">
                  <h6>Successfully Imported:</h6>
                  <ul>
                    {uploadResults.results.successful.map((result, idx) => (
                      <li key={idx}>
                        <strong>{result.title}</strong> ({result.slideCount} slides) - {result.filename}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {uploadResults.results.failed.length > 0 && (
                <div>
                  <h6 className="text-danger">Failed Imports:</h6>
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
            Close
          </Button>
          <Button
            variant="primary"
            onClick={handleBulkImport}
            disabled={uploading || selectedFiles.length === 0}
          >
            {uploading ? 'Uploading...' : 'Upload and Import'}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}

export default SongList;
