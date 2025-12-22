import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Form, Alert, Badge, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { publicRoomAPI } from '../services/api';
import { useTranslation } from 'react-i18next';
import { changeLanguage } from '../i18n';
import api from '../services/api';

function Settings() {
  const navigate = useNavigate();
  const { user, logout, refreshUser } = useAuth();
  const { t, i18n } = useTranslation();

  // Public rooms state
  const [publicRooms, setPublicRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Language state
  const [currentLanguage, setCurrentLanguage] = useState(i18n.language || 'en');
  const [savingLanguage, setSavingLanguage] = useState(false);

  // New public room form
  const [newRoomName, setNewRoomName] = useState('');
  const [creating, setCreating] = useState(false);

  // Initialize language from user preferences
  useEffect(() => {
    if (user?.preferences?.language) {
      setCurrentLanguage(user.preferences.language);
      changeLanguage(user.preferences.language);
    }
  }, [user]);

  // Load public rooms on mount
  useEffect(() => {
    fetchPublicRooms();
  }, []);

  const fetchPublicRooms = async () => {
    try {
      setLoading(true);
      const response = await publicRoomAPI.getMyRooms();
      setPublicRooms(response.data.publicRooms || []);
      setError(''); // Clear any previous error
    } catch (err) {
      console.error('Error fetching public rooms:', err);
      // Don't show error for 404 or empty results - just show empty state
      if (err.response?.status !== 404) {
        setError('Failed to load public rooms. Please try refreshing the page.');
      }
      setPublicRooms([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;

    try {
      setCreating(true);
      setError('');
      const response = await publicRoomAPI.create(newRoomName.trim());
      setPublicRooms([...publicRooms, response.data.publicRoom]);
      setNewRoomName('');
      setSuccess(t('settings.roomCreated'));
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error creating public room:', err);
      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError(t('errors.generic'));
      }
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteRoom = async (roomId) => {
    if (!window.confirm(t('settings.deleteRoomConfirm'))) {
      return;
    }

    try {
      setError('');
      await publicRoomAPI.delete(roomId);
      setPublicRooms(publicRooms.filter(r => r.id !== roomId));
      setSuccess(t('settings.roomDeleted'));
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error deleting public room:', err);
      setError(t('errors.generic'));
    }
  };

  // Handle language change
  const handleLanguageChange = async (newLang) => {
    try {
      setSavingLanguage(true);
      setError('');

      // Update UI immediately
      setCurrentLanguage(newLang);
      changeLanguage(newLang);

      // Save to backend
      await api.put('/auth/preferences', { language: newLang });

      // Refresh user data to sync preferences
      if (refreshUser) {
        await refreshUser();
      }

      setSuccess(t('settings.languageUpdated'));
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error saving language preference:', err);
      setError(t('settings.languageUpdateError'));
      // Revert on error
      setCurrentLanguage(i18n.language);
      changeLanguage(i18n.language);
    } finally {
      setSavingLanguage(false);
    }
  };

  // Generate slug preview from name (must match backend logic)
  const getSlugPreview = (name) => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters (same as backend)
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .replace(/^-+|-+$/g, ''); // Strip leading/trailing hyphens
  };

  return (
    <Container className="py-5">
      <div className="text-center mb-4">
        <img src="/new_cast_logo.png" alt="SoluCast Logo" style={{ maxWidth: '250px', height: 'auto' }} />
      </div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>{t('settings.title')}</h2>
        <div>
          <span className="me-3">{t('dashboard.welcome')}, {user?.email}</span>
          <Button variant="outline-secondary" size="sm" className="me-2" onClick={() => navigate('/dashboard')}>
            {t('nav.dashboard')}
          </Button>
          <Button variant="outline-danger" size="sm" onClick={logout}>
            {t('nav.logout')}
          </Button>
        </div>
      </div>

      {error && <Alert variant="danger" onClose={() => setError('')} dismissible>{error}</Alert>}
      {success && <Alert variant="success" onClose={() => setSuccess('')} dismissible>{success}</Alert>}

      <Row className="g-4">
        {/* Language Settings Section */}
        <Col md={12}>
          <Card>
            <Card.Header>
              <h5 className="mb-0">{t('settings.language')}</h5>
              <small className="text-muted">
                {t('settings.selectLanguage')}
              </small>
            </Card.Header>
            <Card.Body>
              <div className="d-flex align-items-center gap-3">
                <Button
                  variant="primary"
                  onClick={() => handleLanguageChange(currentLanguage === 'en' ? 'he' : 'en')}
                  disabled={savingLanguage}
                  style={{ minWidth: '120px' }}
                >
                  {currentLanguage === 'en' ? 'עברית' : 'English'}
                </Button>
                {savingLanguage && <Spinner size="sm" animation="border" />}
                <small className="text-muted">
                  {t('settings.currentLanguage')}: {currentLanguage === 'en' ? t('settings.english') : t('settings.hebrew')}
                </small>
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Public Rooms Section */}
        <Col md={12}>
          <Card>
            <Card.Header>
              <h5 className="mb-0">{t('settings.publicRooms')}</h5>
              <small className="text-muted">
                {t('settings.publicRoomsDesc')}
              </small>
            </Card.Header>
            <Card.Body>
              {/* Create New Public Room Form */}
              <Form onSubmit={handleCreateRoom} className="mb-4">
                <Row className="g-2 align-items-end">
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>{t('settings.roomName')}</Form.Label>
                      <Form.Control
                        type="text"
                        placeholder={t('settings.roomNamePlaceholder')}
                        value={newRoomName}
                        onChange={(e) => setNewRoomName(e.target.value)}
                        disabled={creating}
                      />
                      {newRoomName && (
                        <Form.Text className="text-muted">
                          {t('settings.searchSlug')}: <strong>{getSlugPreview(newRoomName)}</strong>
                        </Form.Text>
                      )}
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={creating || !newRoomName.trim()}
                      className="w-100"
                    >
                      {creating ? (
                        <>
                          <Spinner size="sm" animation="border" className="me-2" />
                          {t('common.loading')}
                        </>
                      ) : (
                        t('settings.createRoom')
                      )}
                    </Button>
                  </Col>
                </Row>
              </Form>

              {/* List of Public Rooms */}
              {loading ? (
                <div className="text-center py-4">
                  <Spinner animation="border" />
                  <p className="mt-2 text-muted">{t('common.loading')}</p>
                </div>
              ) : publicRooms.length === 0 ? (
                <div className="text-center py-4 text-muted">
                  <p className="mb-0">{t('settings.noPublicRooms')}</p>
                  <p className="small">{t('settings.createFirstRoom')}</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover">
                    <thead>
                      <tr>
                        <th>{t('viewer.name')}</th>
                        <th>{t('settings.searchSlug')}</th>
                        <th>{t('songs.type')}</th>
                        <th>{t('common.actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {publicRooms.map((room) => (
                        <tr key={room.id}>
                          <td>
                            <strong>{room.name}</strong>
                          </td>
                          <td>
                            <code>{room.slug}</code>
                          </td>
                          <td>
                            {room.activeRoomId ? (
                              <Badge bg="success">
                                {t('settings.live')}
                              </Badge>
                            ) : (
                              <Badge bg="secondary">
                                {t('settings.offline')}
                              </Badge>
                            )}
                          </td>
                          <td>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={() => handleDeleteRoom(room.id)}
                            >
                              {t('common.delete')}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default Settings;
