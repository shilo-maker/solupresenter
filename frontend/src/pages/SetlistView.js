import React, { useState, useEffect } from 'react';
import { Container, Card, Button, Badge, ListGroup, Row, Col, Spinner, Alert, Toast, ToastContainer } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

function SetlistView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [setlist, setSetlist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState({ show: false, message: '', variant: 'success' });

  useEffect(() => {
    fetchSetlist();
  }, [id]);

  const fetchSetlist = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/setlists/${id}`);
      setSetlist(response.data.setlist);
    } catch (error) {
      console.error('Error fetching setlist:', error);
      setError(error.response?.data?.error || t('setlists.failedToLoadSetlist'));
    } finally {
      setLoading(false);
    }
  };

  const deleteSetlist = async () => {
    if (!window.confirm(t('setlists.deleteSetlistConfirm'))) {
      return;
    }

    try {
      await api.delete(`/api/setlists/${id}`);
      alert(t('setlists.setlistDeleted'));
      navigate('/setlists');
    } catch (error) {
      console.error('Error deleting setlist:', error);
      alert(error.response?.data?.error || t('setlists.failedToDelete'));
    }
  };

  const useSetlist = async () => {
    try {
      await api.post(`/api/setlists/${id}/use`);
      // Navigate to operator mode with this setlist
      navigate('/operator', { state: { setlistId: id } });
    } catch (error) {
      console.error('Error using setlist:', error);
      alert(t('setlists.failedToUse'));
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

  if (error || !setlist) {
    return (
      <Container className="py-5">
        <Alert variant="danger">{error || t('setlists.setlistNotFound')}</Alert>
        <Button onClick={() => navigate('/setlists')}>{t('setlists.backToList')}</Button>
      </Container>
    );
  }

  const userId = user?.id || user?._id;
  const createdById = setlist.createdById || setlist.createdBy?.id || setlist.createdBy?._id || setlist.createdBy;
  const isOwner = createdById === userId;

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2>{setlist.name}</h2>
          <div className="mt-2">
            <Badge bg="secondary" className="me-2">
              {setlist.items.length} {setlist.items.length === 1 ? t('setlists.item') : t('setlists.itemPlural')}
            </Badge>
            <Badge bg="info">
              {setlist.usageCount === 1
                ? t('setlists.usedTime', { count: setlist.usageCount })
                : t('setlists.usedTimes', { count: setlist.usageCount })}
            </Badge>
          </div>
        </div>
        <div>
          <Button variant="primary" className="me-2" onClick={() => navigate('/operator')}>
            {t('dashboard.operator')}
          </Button>
          <Button variant="outline-secondary" className="me-2" onClick={() => navigate('/setlists')}>
            {t('setlists.backToList')}
          </Button>
          {isOwner && (
            <>
              <Button variant="info" className="me-2" onClick={() => navigate(`/setlists/${id}/edit`)}>
                {t('common.edit')}
              </Button>
              <Button variant="outline-danger" onClick={deleteSetlist}>
                {t('common.delete')}
              </Button>
            </>
          )}
        </div>
      </div>

      <Row>
        <Col lg={8}>
          {/* Setlist Items */}
          <Card className="mb-4">
            <Card.Header>
              <h5 className="mb-0">{t('setlists.itemsInSetlist')}</h5>
            </Card.Header>
            <Card.Body>
              {setlist.items.length === 0 ? (
                <p className="text-muted text-center py-3">
                  {t('setlists.setlistEmpty')}
                </p>
              ) : (
                <ListGroup variant="flush">
                  {setlist.items.map((item, index) => (
                    <ListGroup.Item key={index} className="d-flex justify-content-between align-items-center">
                      <div className="d-flex align-items-center">
                        <Badge bg="secondary" className="me-3">
                          {index + 1}
                        </Badge>
                        <div>
                          {item.type === 'song' && item.song ? (
                            <>
                              <div style={{ fontSize: '1.1rem' }}>{item.song.title}</div>
                              <small className="text-muted">
                                {item.song.slides?.length || 0} {t('setlists.slides')}
                              </small>
                            </>
                          ) : item.type === 'bible' && item.bibleData ? (
                            <>
                              <div style={{ fontSize: '1.1rem' }}>
                                📖 {item.bibleData.title}
                              </div>
                              <small className="text-muted">
                                {item.bibleData.slides?.length || 0} {t('setlists.verses')}
                              </small>
                            </>
                          ) : item.type === 'image' && item.image ? (
                            <>
                              <div style={{ fontSize: '1.1rem' }}>
                                🖼️ {item.image.title || t('media.image')}
                              </div>
                              <small className="text-muted">
                                {t('setlists.imageSlide')}
                              </small>
                            </>
                          ) : item.type === 'blank' ? (
                            <div style={{ fontSize: '1.1rem', fontStyle: 'italic' }}>
                              ⬜ {t('setlists.blankSlide')}
                            </div>
                          ) : (
                            <div style={{ fontSize: '1.1rem', fontStyle: 'italic' }}>
                              {t('setlists.unknownItem')}
                            </div>
                          )}
                        </div>
                      </div>
                      {item.type === 'song' && item.song && (
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={() => navigate(`/songs/${item.song.id || item.song._id}`)}
                        >
                          {t('setlists.viewSong')}
                        </Button>
                      )}
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col lg={4}>
          {/* Details */}
          <Card className="mb-3">
            <Card.Header>
              <h5 className="mb-0">{t('setlists.details')}</h5>
            </Card.Header>
            <Card.Body>
              <div className="mb-3">
                <small className="text-muted">{t('setlists.created')}:</small>
                <div>{new Date(setlist.createdAt).toLocaleDateString()}</div>
              </div>

              <div className="mb-3">
                <small className="text-muted">{t('setlists.lastUpdated')}:</small>
                <div>{new Date(setlist.updatedAt).toLocaleDateString()}</div>
              </div>

              <div className="mb-3">
                <small className="text-muted">{t('setlists.totalItems')}:</small>
                <div>{setlist.items.length}</div>
              </div>

              <div>
                <small className="text-muted">{t('setlists.usageCount')}:</small>
                <div>{setlist.usageCount}</div>
              </div>
            </Card.Body>
          </Card>

          {/* Actions */}
          <Card className="mb-3">
            <Card.Header>
              <h5 className="mb-0">{t('setlists.actions')}</h5>
            </Card.Header>
            <Card.Body>
              <div className="d-grid gap-2">
                <Button variant="success" onClick={useSetlist}>
                  {t('setlists.presentSetlist')}
                </Button>
                {isOwner && (
                  <Button variant="outline-primary" onClick={() => navigate(`/setlists/${id}/edit`)}>
                    {t('setlists.editSetlist')}
                  </Button>
                )}
              </div>
            </Card.Body>
          </Card>

          {/* Share Link */}
          <Card>
            <Card.Header>
              <h5 className="mb-0">{t('setlists.shareSetlist')}</h5>
            </Card.Header>
            <Card.Body>
              <p className="text-muted small mb-2">
                {t('setlists.shareSetlistDesc')}
              </p>
              <Button
                variant="primary"
                className="w-100 mb-2"
                onClick={() => {
                  const shareUrl = `${window.location.origin}/operator?setlistId=${id}`;
                  navigator.clipboard.writeText(shareUrl);
                  alert(t('common.copiedToClipboard'));
                }}
              >
                {t('setlists.copyShareLink')}
              </Button>
              <div style={{
                fontSize: '0.75rem',
                color: '#666',
                wordBreak: 'break-all',
                padding: '8px',
                backgroundColor: '#f8f9fa',
                borderRadius: '4px'
              }}>
                {`${window.location.origin}/operator?setlistId=${id}`}
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default SetlistView;
