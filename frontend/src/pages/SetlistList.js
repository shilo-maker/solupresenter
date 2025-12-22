import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Spinner, Alert, Badge, Toast, ToastContainer } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

function SetlistList() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [setlists, setSetlists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState({ show: false, message: '', variant: 'success' });

  useEffect(() => {
    fetchSetlists();
  }, []);

  const fetchSetlists = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/setlists');
      setSetlists(response.data.setlists);
    } catch (error) {
      console.error('Error fetching setlists:', error);
      setError(error.response?.data?.error || t('setlists.failedToLoad'));
    } finally {
      setLoading(false);
    }
  };

  const deleteSetlist = async (id) => {
    if (!window.confirm(t('setlists.deleteSetlistConfirm'))) {
      return;
    }

    try {
      await api.delete(`/api/setlists/${id}`);
      setSetlists(setlists.filter(s => s.id !== id));
    } catch (error) {
      console.error('Error deleting setlist:', error);
      alert(error.response?.data?.error || t('setlists.failedToDelete'));
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

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>{t('setlists.mySetlists')}</h2>
        <div>
          <Button variant="outline-secondary" className="me-2" onClick={() => navigate('/dashboard')}>
            {t('dashboard.backToDashboard')}
          </Button>
          <Button variant="primary" onClick={() => navigate('/setlists/new')}>
            {t('setlists.createNewSetlist')}
          </Button>
        </div>
      </div>

      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}

      {setlists.length === 0 ? (
        <Card>
          <Card.Body className="text-center py-5">
            <p className="text-muted mb-3">{t('setlists.noSetlistsYet')}</p>
            <Button variant="primary" onClick={() => navigate('/setlists/new')}>
              {t('setlists.createFirstSetlist')}
            </Button>
          </Card.Body>
        </Card>
      ) : (
        <Row>
          {setlists.map((setlist) => (
            <Col md={6} lg={4} key={setlist.id} className="mb-4">
              <Card className="h-100">
                <Card.Body>
                  <Card.Title>{setlist.name}</Card.Title>
                  <div className="mb-3">
                    <Badge bg="secondary" className="me-2">
                      {setlist.items.length} {setlist.items.length === 1 ? t('setlists.item') : t('setlists.itemPlural')}
                    </Badge>
                    <Badge bg="info">
                      {setlist.usageCount === 1
                        ? t('setlists.usedTime', { count: setlist.usageCount })
                        : t('setlists.usedTimes', { count: setlist.usageCount })}
                    </Badge>
                  </div>

                  {setlist.items.length > 0 && (
                    <div className="mb-3">
                      <small className="text-muted">{t('setlists.items')}:</small>
                      <ul className="mb-0 mt-1" style={{ fontSize: '0.9rem' }}>
                        {setlist.items.slice(0, 3).map((item, idx) => (
                          <li key={idx}>
                            {item.type === 'song' && item.song ? (
                              item.song.title
                            ) : item.type === 'bible' && item.bibleData ? (
                              `📖 ${item.bibleData.title}`
                            ) : item.type === 'image' && item.image ? (
                              `🖼️ ${item.image.title || t('media.image')}`
                            ) : item.type === 'blank' ? (
                              `⬜ ${t('setlists.blankSlide')}`
                            ) : (
                              t('setlists.unknownItem')
                            )}
                          </li>
                        ))}
                        {setlist.items.length > 3 && (
                          <li className="text-muted">{t('setlists.andMore', { count: setlist.items.length - 3 })}</li>
                        )}
                      </ul>
                    </div>
                  )}

                  <div className="d-grid gap-2">
                    <Button variant="primary" size="sm" onClick={() => navigate(`/setlists/${setlist.id}`)}>
                      {t('setlists.viewDetails')}
                    </Button>
                    <Button variant="outline-primary" size="sm" onClick={() => navigate(`/setlists/${setlist.id}/edit`)}>
                      {t('common.edit')}
                    </Button>
                    <Button variant="outline-danger" size="sm" onClick={() => deleteSetlist(setlist.id)}>
                      {t('common.delete')}
                    </Button>
                  </div>
                </Card.Body>
                <Card.Footer className="text-muted">
                  <small>{t('setlists.updated')} {new Date(setlist.updatedAt).toLocaleDateString()}</small>
                </Card.Footer>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </Container>
  );
}

export default SetlistList;
