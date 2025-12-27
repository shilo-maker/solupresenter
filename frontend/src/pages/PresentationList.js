import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Card, Button, Spinner, Alert, Badge, InputGroup, Form } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

// Simple thumbnail component for presentation preview - memoized for performance
const PresentationThumbnail = React.memo(({ slide, canvasDimensions, backgroundSettings }) => {
  const aspectRatio = canvasDimensions?.height / canvasDimensions?.width || 9/16;

  const getBackgroundStyle = () => {
    if (slide?.backgroundColor) {
      return { background: slide.backgroundColor };
    }
    if (backgroundSettings?.type === 'color' && backgroundSettings?.value) {
      return { background: backgroundSettings.value };
    }
    return {
      background: 'linear-gradient(-45deg, #0a0a0a, #1a1a2e, #16161d, #1f1f1f)'
    };
  };

  return (
    <div
      style={{
        width: '100%',
        paddingBottom: `${aspectRatio * 100}%`,
        position: 'relative',
        borderRadius: '4px',
        overflow: 'hidden',
        ...getBackgroundStyle()
      }}
    >
      {slide?.textBoxes?.map((textBox, idx) => (
        <div
          key={idx}
          style={{
            position: 'absolute',
            left: `${textBox.x}%`,
            top: `${textBox.y}%`,
            width: `${textBox.width}%`,
            height: `${textBox.height}%`,
            fontSize: `${(textBox.fontSize || 100) * 0.06}px`,
            fontWeight: textBox.fontWeight || textBox.bold ? 'bold' : 'normal',
            fontStyle: textBox.italic ? 'italic' : 'normal',
            color: textBox.color || '#ffffff',
            textAlign: textBox.textAlign || 'center',
            display: 'flex',
            alignItems: textBox.verticalAlign === 'top' ? 'flex-start' : textBox.verticalAlign === 'bottom' ? 'flex-end' : 'center',
            justifyContent: textBox.textAlign === 'left' ? 'flex-start' : textBox.textAlign === 'right' ? 'flex-end' : 'center',
            overflow: 'hidden',
            padding: '2px',
            backgroundColor: textBox.backgroundColor || 'transparent',
            opacity: textBox.opacity ?? 1
          }}
        >
          <span style={{
            whiteSpace: 'pre-wrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxHeight: '100%'
          }}>
            {textBox.text?.substring(0, 50) || ''}
          </span>
        </div>
      ))}
    </div>
  );
});

function PresentationList() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, isAdmin } = useAuth();
  const [presentations, setPresentations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchPresentations = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/presentations');
      setPresentations(response.data.presentations);
    } catch (err) {
      console.error('Error fetching presentations:', err);
      setError(err.response?.data?.error || t('presentations.failedToLoad'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const searchPresentations = useCallback(async (query) => {
    try {
      setLoading(true);
      const response = await api.get('/api/presentations/search', {
        params: { query }
      });
      setPresentations(response.data.presentations);
    } catch (err) {
      console.error('Error searching presentations:', err);
      setError(err.response?.data?.error || t('presentations.failedToLoad'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (searchQuery) {
        searchPresentations(searchQuery);
      } else {
        fetchPresentations();
      }
    }, 300);
    return () => clearTimeout(delayDebounce);
  }, [searchQuery, fetchPresentations, searchPresentations]);

  const deletePresentation = async (id) => {
    if (!window.confirm(t('presentations.deleteConfirm'))) {
      return;
    }

    try {
      await api.delete(`/api/presentations/${id}`);
      setPresentations(presentations.filter(p => p.id !== id));
    } catch (error) {
      console.error('Error deleting presentation:', error);
      alert(error.response?.data?.error || t('presentations.failedToDelete'));
    }
  };

  const isOwner = (presentation) => {
    const userId = user?.id || user?._id;
    return presentation.createdById === userId;
  };

  const canEdit = (presentation) => {
    return isOwner(presentation) || isAdmin;
  };

  if (loading && presentations.length === 0) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </Container>
    );
  }

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>{t('presentations.title')}</h2>
        <div>
          <Button variant="primary" className="me-2" onClick={() => navigate('/operator')}>
            {t('dashboard.operator')}
          </Button>
          <Button variant="outline-secondary" className="me-2" onClick={() => navigate('/dashboard')}>
            {t('dashboard.backToDashboard')}
          </Button>
          <Button variant="success" onClick={() => navigate('/presentations/new')}>
            {t('presentations.createNew')}
          </Button>
        </div>
      </div>

      {/* Search bar */}
      <Card className="mb-4">
        <Card.Body>
          <InputGroup>
            <Form.Control
              type="text"
              placeholder={t('presentations.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <Button variant="outline-secondary" onClick={() => setSearchQuery('')}>
                {t('common.clear')}
              </Button>
            )}
          </InputGroup>
        </Card.Body>
      </Card>

      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}

      {presentations.length === 0 ? (
        <Card>
          <Card.Body className="text-center py-5">
            <p className="text-muted mb-3">
              {searchQuery ? t('presentations.noSearchResults') : t('presentations.noPresentationsYet')}
            </p>
            {!searchQuery && (
              <Button variant="primary" onClick={() => navigate('/presentations/new')}>
                {t('presentations.createFirst')}
              </Button>
            )}
          </Card.Body>
        </Card>
      ) : (
        <Row>
          {presentations.map((presentation) => (
            <Col md={6} lg={4} key={presentation.id} className="mb-4">
              <Card className="h-100">
                {/* Thumbnail preview */}
                <div style={{ padding: '12px 12px 0 12px' }}>
                  <PresentationThumbnail
                    slide={presentation.slides?.[0]}
                    canvasDimensions={presentation.canvasDimensions}
                    backgroundSettings={presentation.backgroundSettings}
                  />
                </div>

                <Card.Body>
                  <Card.Title className="text-truncate" title={presentation.title}>
                    {presentation.title}
                  </Card.Title>
                  <div className="mb-3">
                    <Badge bg="secondary" className="me-2">
                      {presentation.slides?.length || 0} {(presentation.slides?.length || 0) === 1 ? t('presentations.slide') : t('presentations.slides')}
                    </Badge>
                    {presentation.isPublic && (
                      <Badge bg="success" className="me-2">
                        {t('common.public')}
                      </Badge>
                    )}
                    <Badge bg="info">
                      {presentation.usageCount || 0} {t('presentations.uses')}
                    </Badge>
                  </div>

                  <div className="d-grid gap-2">
                    <Button variant="primary" size="sm" onClick={() => navigate(`/presentations/${presentation.id}`)}>
                      {t('common.view')}
                    </Button>
                    {canEdit(presentation) && (
                      <Button variant="outline-primary" size="sm" onClick={() => navigate(`/presentations/${presentation.id}/edit`)}>
                        {t('common.edit')}
                      </Button>
                    )}
                    {canEdit(presentation) && (
                      <Button variant="outline-danger" size="sm" onClick={() => deletePresentation(presentation.id)}>
                        {t('common.delete')}
                      </Button>
                    )}
                  </div>
                </Card.Body>
                <Card.Footer className="text-muted">
                  <small>{t('presentations.updated')} {new Date(presentation.updatedAt).toLocaleDateString()}</small>
                </Card.Footer>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </Container>
  );
}

export default PresentationList;
