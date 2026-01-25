import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Spinner, Alert, Badge } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

function SetlistList() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [setlists, setSetlists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchSetlists = async () => {
      try {
        setLoading(true);
        const response = await api.get('/api/setlists');
        setSetlists(response.data.setlists);
      } catch (err) {
        console.error('Error fetching setlists:', err);
        setError(err.response?.data?.error || t('setlists.failedToLoad'));
      } finally {
        setLoading(false);
      }
    };

    fetchSetlists();
  }, [t]);

  const deleteSetlist = async (id) => {
    if (!window.confirm(t('setlists.deleteSetlistConfirm'))) {
      return;
    }

    try {
      await api.delete(`/api/setlists/${id}`);
      setSetlists(setlists.filter(s => s.id !== id));
    } catch (err) {
      console.error('Error deleting setlist:', err);
      alert(err.response?.data?.error || t('setlists.failedToDelete'));
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
          <Button variant="primary" className="me-2" onClick={() => navigate('/operator')}>
            {t('dashboard.operator')}
          </Button>
          <Button variant="outline-secondary" className="me-2" onClick={() => navigate('/dashboard')}>
            {t('dashboard.backToDashboard')}
          </Button>
          <Button variant="success" onClick={() => navigate('/setlists/new')}>
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
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style={{ verticalAlign: 'middle' }}>
                                  <path d="M1 2.828c.885-.37 2.154-.769 3.388-.893 1.33-.134 2.458.063 3.112.752v9.746c-.935-.53-2.12-.603-3.213-.493-1.18.12-2.37.461-3.287.811zm7.5-.141c.654-.689 1.782-.886 3.112-.752 1.234.124 2.503.523 3.388.893v9.923c-.918-.35-2.107-.692-3.287-.81-1.094-.111-2.278-.039-3.213.492zM8 1.783C7.015.936 5.587.81 4.287.94c-1.514.153-3.042.672-3.994 1.105A.5.5 0 0 0 0 2.5v11a.5.5 0 0 0 .707.455c.882-.4 2.303-.881 3.68-1.02 1.409-.142 2.59.087 3.223.877a.5.5 0 0 0 .78 0c.633-.79 1.814-1.019 3.222-.877 1.378.139 2.8.62 3.681 1.02A.5.5 0 0 0 16 13.5v-11a.5.5 0 0 0-.293-.455c-.952-.433-2.48-.952-3.994-1.105C10.413.809 8.985.936 8 1.783"/>
                                </svg>
                                {item.bibleData.title}
                              </span>
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
