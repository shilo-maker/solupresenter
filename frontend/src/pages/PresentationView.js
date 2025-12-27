import React, { useState, useEffect, useCallback } from 'react';
import { Container, Card, Button, Badge, Row, Col, Spinner, Alert } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

// Slide preview component - memoized for performance
const SlidePreview = React.memo(({ slide, canvasDimensions, backgroundSettings, isSelected, onClick }) => {
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
      onClick={onClick}
      style={{
        width: '100%',
        paddingBottom: `${aspectRatio * 100}%`,
        position: 'relative',
        borderRadius: '8px',
        overflow: 'hidden',
        cursor: 'pointer',
        border: isSelected ? '3px solid #0d6efd' : '2px solid transparent',
        boxShadow: isSelected ? '0 0 10px rgba(13, 110, 253, 0.5)' : '0 2px 8px rgba(0, 0, 0, 0.2)',
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
            fontSize: `${(textBox.fontSize || 100) * 0.08}px`,
            fontWeight: textBox.fontWeight || (textBox.bold ? 'bold' : 'normal'),
            fontStyle: textBox.italic ? 'italic' : 'normal',
            textDecoration: textBox.underline ? 'underline' : 'none',
            color: textBox.color || '#ffffff',
            textAlign: textBox.textAlign || 'center',
            display: 'flex',
            alignItems: textBox.verticalAlign === 'top' ? 'flex-start' : textBox.verticalAlign === 'bottom' ? 'flex-end' : 'center',
            justifyContent: textBox.textAlign === 'left' ? 'flex-start' : textBox.textAlign === 'right' ? 'flex-end' : 'center',
            overflow: 'hidden',
            padding: '4px',
            backgroundColor: textBox.backgroundColor || 'transparent',
            opacity: textBox.opacity ?? 1
          }}
        >
          <span style={{
            whiteSpace: 'pre-wrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {textBox.text || ''}
          </span>
        </div>
      ))}
    </div>
  );
});

// Large slide display component - memoized for performance
const LargeSlideDisplay = React.memo(({ slide, canvasDimensions, backgroundSettings }) => {
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
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
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
            fontSize: `${(textBox.fontSize || 100) * 0.2}px`,
            fontWeight: textBox.fontWeight || (textBox.bold ? 'bold' : 'normal'),
            fontStyle: textBox.italic ? 'italic' : 'normal',
            textDecoration: textBox.underline ? 'underline' : 'none',
            color: textBox.color || '#ffffff',
            textAlign: textBox.textAlign || 'center',
            display: 'flex',
            alignItems: textBox.verticalAlign === 'top' ? 'flex-start' : textBox.verticalAlign === 'bottom' ? 'flex-end' : 'center',
            justifyContent: textBox.textAlign === 'left' ? 'flex-start' : textBox.textAlign === 'right' ? 'flex-end' : 'center',
            overflow: 'hidden',
            padding: '8px',
            backgroundColor: textBox.backgroundColor || 'transparent',
            opacity: textBox.opacity ?? 1
          }}
        >
          <span style={{
            whiteSpace: 'pre-wrap',
            overflow: 'hidden'
          }}>
            {textBox.text || ''}
          </span>
        </div>
      ))}

      {/* Resolution indicator */}
      <div
        style={{
          position: 'absolute',
          bottom: '8px',
          right: '8px',
          fontSize: '12px',
          color: 'rgba(255, 255, 255, 0.4)',
          fontFamily: 'monospace'
        }}
      >
        {canvasDimensions?.width || 1920} x {canvasDimensions?.height || 1080}
      </div>
    </div>
  );
});

function PresentationView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { t } = useTranslation();
  const [presentation, setPresentation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSlideIndex, setSelectedSlideIndex] = useState(0);

  const fetchPresentation = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/presentations/${id}`);
      setPresentation(response.data.presentation);
    } catch (err) {
      console.error('Error fetching presentation:', err);
      setError(err.response?.data?.error || t('presentations.failedToLoad'));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    fetchPresentation();
  }, [fetchPresentation]);

  const deletePresentation = async () => {
    if (!window.confirm(t('presentations.deleteConfirm'))) {
      return;
    }

    try {
      await api.delete(`/api/presentations/${id}`);
      navigate('/presentations');
    } catch (error) {
      console.error('Error deleting presentation:', error);
      alert(error.response?.data?.error || t('presentations.failedToDelete'));
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

  if (error || !presentation) {
    return (
      <Container className="py-5">
        <Alert variant="danger">{error || t('presentations.notFound')}</Alert>
        <Button onClick={() => navigate('/presentations')}>{t('presentations.backToList')}</Button>
      </Container>
    );
  }

  const userId = user?.id || user?._id;
  const createdById = presentation.createdById;
  const isOwner = createdById === userId;
  const canEdit = isOwner || isAdmin;
  const selectedSlide = presentation.slides?.[selectedSlideIndex];

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2>{presentation.title}</h2>
          <div className="mt-2">
            {presentation.isPublic && <Badge bg="success" className="me-2">{t('common.public')}</Badge>}
            {!presentation.isPublic && <Badge bg="secondary" className="me-2">{t('common.private')}</Badge>}
            {isOwner && <Badge bg="info">{t('presentations.myPresentation')}</Badge>}
          </div>
        </div>
        <div>
          <Button variant="primary" className="me-2" onClick={() => navigate('/operator')}>
            {t('dashboard.operator')}
          </Button>
          <Button variant="outline-secondary" className="me-2" onClick={() => navigate('/presentations')}>
            {t('presentations.backToList')}
          </Button>
          {canEdit && (
            <Button variant="info" className="me-2" onClick={() => navigate(`/presentations/${id}/edit`)}>
              {t('common.edit')}
            </Button>
          )}
          {canEdit && (
            <Button variant="outline-danger" onClick={deletePresentation}>
              {t('common.delete')}
            </Button>
          )}
        </div>
      </div>

      <Row>
        <Col lg={8}>
          {/* Main slide display */}
          <Card className="mb-4">
            <Card.Header className="d-flex justify-content-between align-items-center">
              <span>{t('presentations.slide')} {selectedSlideIndex + 1} / {presentation.slides?.length || 0}</span>
              <div>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  className="me-2"
                  disabled={selectedSlideIndex === 0}
                  onClick={() => setSelectedSlideIndex(selectedSlideIndex - 1)}
                >
                  ←
                </Button>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  disabled={selectedSlideIndex >= (presentation.slides?.length || 1) - 1}
                  onClick={() => setSelectedSlideIndex(selectedSlideIndex + 1)}
                >
                  →
                </Button>
              </div>
            </Card.Header>
            <Card.Body>
              {selectedSlide ? (
                <LargeSlideDisplay
                  slide={selectedSlide}
                  canvasDimensions={presentation.canvasDimensions}
                  backgroundSettings={presentation.backgroundSettings}
                />
              ) : (
                <div className="text-center text-muted py-5">
                  {t('presentations.noSlides')}
                </div>
              )}
            </Card.Body>
          </Card>

          {/* Slide thumbnails */}
          {presentation.slides?.length > 1 && (
            <Card>
              <Card.Header>{t('presentations.allSlides')}</Card.Header>
              <Card.Body>
                <Row>
                  {presentation.slides.map((slide, index) => (
                    <Col xs={4} md={3} lg={2} key={index} className="mb-3">
                      <div className="position-relative">
                        <SlidePreview
                          slide={slide}
                          canvasDimensions={presentation.canvasDimensions}
                          backgroundSettings={presentation.backgroundSettings}
                          isSelected={selectedSlideIndex === index}
                          onClick={() => setSelectedSlideIndex(index)}
                        />
                        <Badge
                          bg="dark"
                          style={{
                            position: 'absolute',
                            bottom: '4px',
                            left: '4px',
                            fontSize: '10px'
                          }}
                        >
                          {index + 1}
                        </Badge>
                      </div>
                    </Col>
                  ))}
                </Row>
              </Card.Body>
            </Card>
          )}
        </Col>

        <Col lg={4}>
          {/* Details */}
          <Card className="mb-3">
            <Card.Header>
              <h5 className="mb-0">{t('presentations.details')}</h5>
            </Card.Header>
            <Card.Body>
              <div className="mb-3">
                <small className="text-muted">{t('presentations.resolution')}:</small>
                <div>{presentation.canvasDimensions?.width || 1920} x {presentation.canvasDimensions?.height || 1080}</div>
              </div>

              <div className="mb-3">
                <small className="text-muted">{t('presentations.slideCount')}:</small>
                <div>{presentation.slides?.length || 0}</div>
              </div>

              <div className="mb-3">
                <small className="text-muted">{t('presentations.usageCount')}:</small>
                <div>{presentation.usageCount || 0}</div>
              </div>

              <div className="mb-3">
                <small className="text-muted">{t('presentations.createdAt')}:</small>
                <div>{new Date(presentation.createdAt).toLocaleDateString()}</div>
              </div>

              <div>
                <small className="text-muted">{t('presentations.updatedAt')}:</small>
                <div>{new Date(presentation.updatedAt).toLocaleDateString()}</div>
              </div>
            </Card.Body>
          </Card>

          {/* Actions */}
          <Card>
            <Card.Header>
              <h5 className="mb-0">{t('presentations.actions')}</h5>
            </Card.Header>
            <Card.Body>
              <div className="d-grid gap-2">
                <Button variant="primary" onClick={() => navigate('/operator')}>
                  {t('presentations.presentThis')}
                </Button>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default PresentationView;
