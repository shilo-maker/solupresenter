import React, { useState, useEffect } from 'react';
import { Container, Card, Button, Badge, Row, Col, Spinner, Alert } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

function SongView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [song, setSong] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const languages = {
    he: 'Hebrew (עברית)',
    en: 'English',
    es: 'Spanish (Español)',
    fr: 'French (Français)',
    de: 'German (Deutsch)',
    ru: 'Russian (Русский)',
    ar: 'Arabic (العربية)',
    other: 'Other'
  };

  useEffect(() => {
    fetchSong();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchSong = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/songs/${id}`);
      setSong(response.data.song);
    } catch (error) {
      console.error('Error fetching song:', error);
      setError(error.response?.data?.error || 'Failed to load song');
    } finally {
      setLoading(false);
    }
  };

  const deleteSong = async () => {
    if (!window.confirm(t('songs.deleteSongConfirm'))) {
      return;
    }

    try {
      await api.delete(`/api/songs/${id}`);
      alert(t('songs.songDeleted'));
      navigate('/songs');
    } catch (error) {
      console.error('Error deleting song:', error);
      alert(error.response?.data?.error || t('songs.failedToLoad'));
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

  if (error || !song) {
    return (
      <Container className="py-5">
        <Alert variant="danger">{error || 'Song not found'}</Alert>
        <Button onClick={() => navigate('/songs')}>Back to Songs</Button>
      </Container>
    );
  }

  const userId = user?.id || user?._id;
  const createdById = song.createdById || song.createdBy?.id || song.createdBy?._id;
  const isOwner = createdById === userId;

  // Check if language needs transliteration/translation structure (Hebrew, Arabic)
  const isTransliterationLanguage = song.originalLanguage === 'he' || song.originalLanguage === 'ar';

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2>{song.title}</h2>
          <div className="mt-2">
            {song.isPublic && <Badge bg="success" className="me-2">Public</Badge>}
            {song.isPendingApproval && <Badge bg="warning" className="me-2">Pending Approval</Badge>}
            {!song.isPublic && !song.isPendingApproval && <Badge bg="secondary" className="me-2">Private</Badge>}
            {isOwner && <Badge bg="info">My Song</Badge>}
          </div>
        </div>
        <div>
          <Button variant="primary" className="me-2" onClick={() => navigate('/operator')}>
            {t('dashboard.operator')}
          </Button>
          <Button variant="outline-secondary" className="me-2" onClick={() => navigate('/songs')}>
            {t('songs.backToSongs')}
          </Button>
          <Button variant="info" className="me-2" onClick={() => navigate(`/songs/${id}/edit`)}>
            {t('common.edit')}
          </Button>
          {isOwner && (
            <Button variant="outline-danger" onClick={deleteSong}>
              Delete
            </Button>
          )}
        </div>
      </div>

      <Row>
        <Col lg={8}>
          {/* Slides */}
          <h4 className="mb-3">Slides ({song.slides.length})</h4>
          {song.slides.map((slide, index) => (
            <Card key={index} className="mb-3">
              <Card.Header>
                <strong>Slide {index + 1}</strong>
              </Card.Header>
              <Card.Body>
                {slide.originalText && (
                  <div className="mb-3">
                    <small className="text-muted">{isTransliterationLanguage ? 'Original Text:' : 'Lyrics:'}</small>
                    <div
                      style={{ fontSize: '1.1rem', whiteSpace: 'pre-wrap' }}
                      dir={isTransliterationLanguage ? 'rtl' : 'ltr'}
                    >
                      {slide.originalText}
                    </div>
                  </div>
                )}

                {slide.transliteration && (
                  <div className="mb-3">
                    <small className="text-muted">{isTransliterationLanguage ? 'Transliteration:' : ''}</small>
                    <div style={{ fontSize: '1rem', whiteSpace: 'pre-wrap' }}>
                      {slide.transliteration}
                    </div>
                  </div>
                )}

                {slide.translation && (
                  <div className="mb-3">
                    <small className="text-muted">{isTransliterationLanguage ? 'Translation:' : ''}</small>
                    <div style={{ fontSize: '1rem', whiteSpace: 'pre-wrap' }}>
                      {slide.translation}
                    </div>
                  </div>
                )}

                {slide.translationOverflow && (
                  <div>
                    <small className="text-muted">{isTransliterationLanguage ? 'Translation (continued):' : ''}</small>
                    <div style={{ fontSize: '1rem', whiteSpace: 'pre-wrap' }}>
                      {slide.translationOverflow}
                    </div>
                  </div>
                )}
              </Card.Body>
            </Card>
          ))}
        </Col>

        <Col lg={4}>
          {/* Song Details */}
          <Card className="mb-3">
            <Card.Header>
              <h5 className="mb-0">Details</h5>
            </Card.Header>
            <Card.Body>
              <div className="mb-3">
                <small className="text-muted">Language:</small>
                <div>{song.originalLanguage ? languages[song.originalLanguage] : 'Unknown'}</div>
              </div>

              {song.author && (
                <div className="mb-3">
                  <small className="text-muted">Author / Artist:</small>
                  <div>{song.author}</div>
                </div>
              )}

              <div className="mb-3">
                <small className="text-muted">Created By:</small>
                <div>{song.createdBy ? song.createdBy.email : 'Unknown (Migrated Song)'}</div>
              </div>

              <div className="mb-3">
                <small className="text-muted">Usage Count:</small>
                <div>{song.usageCount}</div>
              </div>

              <div className="mb-3">
                <small className="text-muted">Created:</small>
                <div>{new Date(song.createdAt).toLocaleDateString()}</div>
              </div>

              {song.tags && song.tags.length > 0 && (
                <div>
                  <small className="text-muted">Tags:</small>
                  <div className="mt-1">
                    {song.tags.map(tag => (
                      <Badge key={tag} bg="secondary" className="me-1 mb-1">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </Card.Body>
          </Card>

          {/* Actions */}
          <Card>
            <Card.Header>
              <h5 className="mb-0">Actions</h5>
            </Card.Header>
            <Card.Body>
              <div className="d-grid gap-2">
                <Button variant="primary" onClick={() => navigate('/operator', { state: { songId: id } })}>
                  Present This Song
                </Button>
                <Button variant="outline-primary" onClick={() => navigate('/setlists/new', { state: { songId: id } })}>
                  Add to Setlist
                </Button>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default SongView;
