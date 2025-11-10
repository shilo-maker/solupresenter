import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Badge, ListGroup, Table, Tabs, Tab, Spinner, Alert } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

function Admin() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('pending-songs');
  const [pendingSongs, setPendingSongs] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
      setError(error.response?.data?.error || 'Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const approveSong = async (songId) => {
    try {
      await api.post(`/api/admin/approve-song/${songId}`);
      alert('Song approved successfully!');
      fetchData();
    } catch (error) {
      console.error('Error approving song:', error);
      alert(error.response?.data?.error || 'Failed to approve song');
    }
  };

  const rejectSong = async (songId) => {
    if (!window.confirm('Are you sure you want to reject this song?')) {
      return;
    }

    try {
      await api.post(`/api/admin/reject-song/${songId}`);
      alert('Song rejected');
      fetchData();
    } catch (error) {
      console.error('Error rejecting song:', error);
      alert(error.response?.data?.error || 'Failed to reject song');
    }
  };

  const toggleUserAdmin = async (userId) => {
    try {
      const response = await api.post(`/api/admin/users/${userId}/toggle-admin`);
      alert(response.data.message);
      fetchData();
    } catch (error) {
      console.error('Error toggling admin status:', error);
      alert(error.response?.data?.error || 'Failed to update user');
    }
  };

  const deleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      await api.delete(`/api/admin/users/${userId}`);
      alert('User deleted successfully');
      fetchData();
    } catch (error) {
      console.error('Error deleting user:', error);
      alert(error.response?.data?.error || 'Failed to delete user');
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
        <div>
          <h2>Admin Panel</h2>
          <p className="text-muted">Manage songs and users</p>
        </div>
        <Button variant="outline-secondary" onClick={() => navigate('/dashboard')}>
          Back to Dashboard
        </Button>
      </div>

      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}

      <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k)} className="mb-4">
        <Tab eventKey="pending-songs" title={
          <>
            Pending Songs
            {pendingSongs.length > 0 && (
              <Badge bg="danger" className="ms-2">{pendingSongs.length}</Badge>
            )}
          </>
        }>
          <Card>
            <Card.Header>
              <h5 className="mb-0">Songs Awaiting Approval</h5>
            </Card.Header>
            <Card.Body>
              {pendingSongs.length === 0 ? (
                <p className="text-muted text-center py-3">No pending songs</p>
              ) : (
                <ListGroup variant="flush">
                  {pendingSongs.map((song) => (
                    <ListGroup.Item key={song._id}>
                      <Row className="align-items-center">
                        <Col md={6}>
                          <h6 className="mb-1">{song.title}</h6>
                          <small className="text-muted">
                            Submitted by: {song.createdBy?.email || 'Unknown'}<br/>
                            Slides: {song.slides?.length || 0} |
                            Language: {song.originalLanguage}
                            {song.tags?.length > 0 && (
                              <> | Tags: {song.tags.join(', ')}</>
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
                            Preview
                          </Button>
                          <Button
                            size="sm"
                            variant="success"
                            className="me-2"
                            onClick={() => approveSong(song._id)}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => rejectSong(song._id)}
                          >
                            Reject
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
            User Management
            <Badge bg="secondary" className="ms-2">{users.length}</Badge>
          </>
        }>
          <Card>
            <Card.Header>
              <h5 className="mb-0">All Users</h5>
            </Card.Header>
            <Card.Body>
              <Table responsive hover>
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Joined</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>
                        {u.email}
                        {u.id === user.id && (
                          <Badge bg="info" className="ms-2">You</Badge>
                        )}
                      </td>
                      <td>
                        {u.role === 'admin' ? (
                          <Badge bg="success">Admin</Badge>
                        ) : (
                          <Badge bg="secondary">User</Badge>
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
                              {u.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline-danger"
                              onClick={() => deleteUser(u.id)}
                            >
                              Delete
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
    </Container>
  );
}

export default Admin;
