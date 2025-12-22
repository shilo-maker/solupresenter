import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Badge, ListGroup, Table, Tabs, Tab, Spinner, Alert, Toast, ToastContainer } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

function Admin() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('pending-songs');
  const [pendingSongs, setPendingSongs] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState({ show: false, message: '', variant: 'success' });

  useEffect(() => {
    // Check if user is admin
    if (user?.role !== 'admin') {
      navigate('/dashboard');
      return;
    }

    fetchData();
  }, [user, navigate]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [songsResponse, usersResponse] = await Promise.all([
        api.get('/api/admin/pending-songs'),
        api.get('/api/admin/users')
      ]);
      setPendingSongs(songsResponse.data.songs);
      setUsers(usersResponse.data.users);
    } catch (error) {
      console.error('Error fetching admin data:', error);
      setError(error.response?.data?.error || t('admin.failedToLoad'));
    } finally {
      setLoading(false);
    }
  };

  const approveSong = async (songId) => {
    try {
      await api.post(`/api/admin/approve-song/${songId}`);
      alert(t('admin.songApproved'));
      fetchData();
    } catch (error) {
      console.error('Error approving song:', error);
      alert(error.response?.data?.error || t('admin.failedToApprove'));
    }
  };

  const rejectSong = async (songId) => {
    if (!window.confirm(t('admin.rejectConfirm'))) {
      return;
    }

    try {
      await api.post(`/api/admin/reject-song/${songId}`);
      alert(t('admin.songRejected'));
      fetchData();
    } catch (error) {
      console.error('Error rejecting song:', error);
      alert(error.response?.data?.error || t('admin.failedToReject'));
    }
  };

  const toggleUserAdmin = async (userId) => {
    try {
      const response = await api.post(`/api/admin/users/${userId}/toggle-admin`);
      alert(response.data.message);
      fetchData();
    } catch (error) {
      console.error('Error toggling admin status:', error);
      alert(error.response?.data?.error || t('admin.failedToUpdate'));
    }
  };

  const deleteUser = async (userId) => {
    if (!window.confirm(t('admin.deleteUserConfirm'))) {
      return;
    }

    try {
      await api.delete(`/api/admin/users/${userId}`);
      alert(t('admin.userDeleted'));
      fetchData();
    } catch (error) {
      console.error('Error deleting user:', error);
      alert(error.response?.data?.error || t('admin.failedToDelete'));
    }
  };

  if (loading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">{t('common.loading')}</span>
        </Spinner>
      </Container>
    );
  }

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2>{t('admin.title')}</h2>
          <p className="text-muted">{t('admin.subtitle')}</p>
        </div>
        <div>
          <Button variant="primary" className="me-2" onClick={() => navigate('/operator')}>
            {t('dashboard.operator')}
          </Button>
          <Button variant="outline-secondary" onClick={() => navigate('/dashboard')}>
            {t('songs.backToDashboard')}
          </Button>
        </div>
      </div>

      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}

      <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k)} className="mb-4">
        <Tab eventKey="pending-songs" title={
          <>
            {t('admin.pendingSongs')}
            {pendingSongs.length > 0 && (
              <Badge bg="danger" className="ms-2">{pendingSongs.length}</Badge>
            )}
          </>
        }>
          <Card>
            <Card.Header>
              <h5 className="mb-0">{t('admin.songsAwaitingApproval')}</h5>
            </Card.Header>
            <Card.Body>
              {pendingSongs.length === 0 ? (
                <p className="text-muted text-center py-3">{t('admin.noPendingSongs')}</p>
              ) : (
                <ListGroup variant="flush">
                  {pendingSongs.map((song) => (
                    <ListGroup.Item key={song._id}>
                      <Row className="align-items-center">
                        <Col md={6}>
                          <h6 className="mb-1">{song.title}</h6>
                          <small className="text-muted">
                            {t('admin.submittedBy')}: {song.createdBy?.email || t('admin.unknown')}<br/>
                            {t('songs.slides')}: {song.slides?.length || 0} |
                            {t('songs.language')}: {song.originalLanguage}
                            {song.tags?.length > 0 && (
                              <> | {t('songs.tags')}: {song.tags.join(', ')}</>
                            )}
                          </small>
                        </Col>
                        <Col md={6} className="text-end">
                          <Button
                            size="sm"
                            variant="outline-primary"
                            className="me-2"
                            onClick={() => navigate(`/songs/${song._id}`)}
                          >
                            {t('admin.preview')}
                          </Button>
                          <Button
                            size="sm"
                            variant="success"
                            className="me-2"
                            onClick={() => approveSong(song._id)}
                          >
                            {t('admin.approveSong')}
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => rejectSong(song._id)}
                          >
                            {t('admin.rejectSong')}
                          </Button>
                        </Col>
                      </Row>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              )}
            </Card.Body>
          </Card>
        </Tab>

        <Tab eventKey="users" title={
          <>
            {t('admin.userManagement')}
            <Badge bg="secondary" className="ms-2">{users.length}</Badge>
          </>
        }>
          <Card>
            <Card.Header>
              <h5 className="mb-0">{t('admin.allUsers')}</h5>
            </Card.Header>
            <Card.Body>
              <Table responsive hover>
                <thead>
                  <tr>
                    <th>{t('auth.email')}</th>
                    <th>{t('admin.role')}</th>
                    <th>{t('admin.joined')}</th>
                    <th>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>
                        {u.email}
                        {u.id === user.id && (
                          <Badge bg="info" className="ms-2">{t('admin.you')}</Badge>
                        )}
                      </td>
                      <td>
                        {u.role === 'admin' ? (
                          <Badge bg="success">{t('admin.admin')}</Badge>
                        ) : (
                          <Badge bg="secondary">{t('admin.user')}</Badge>
                        )}
                      </td>
                      <td>
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td>
                        {u.id !== user.id && (
                          <>
                            <Button
                              size="sm"
                              variant={u.role === 'admin' ? "outline-warning" : "outline-success"}
                              className="me-2"
                              onClick={() => toggleUserAdmin(u.id)}
                            >
                              {u.role === 'admin' ? t('admin.removeAdmin') : t('admin.makeAdmin')}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline-danger"
                              onClick={() => deleteUser(u.id)}
                            >
                              {t('common.delete')}
                            </Button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Tab>
      </Tabs>

      {/* Toast notifications */}
      <ToastContainer position="bottom-end" className="p-3">
        <Toast
          show={toast.show}
          onClose={() => setToast({ ...toast, show: false })}
          delay={3000}
          autohide
          bg={toast.variant}
        >
          <Toast.Body className={toast.variant === 'danger' || toast.variant === 'success' ? 'text-white' : ''}>
            {toast.message}
          </Toast.Body>
        </Toast>
      </ToastContainer>
    </Container>
  );
}

export default Admin;
