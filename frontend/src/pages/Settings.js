import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Form, Alert, Badge, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { publicRoomAPI } from '../services/api';

function Settings() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // Public rooms state
  const [publicRooms, setPublicRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // New public room form
  const [newRoomName, setNewRoomName] = useState('');
  const [creating, setCreating] = useState(false);

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
      setSuccess('Public room created successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error creating public room:', err);
      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError('Failed to create public room');
      }
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteRoom = async (roomId) => {
    if (!window.confirm('Are you sure you want to delete this public room?')) {
      return;
    }

    try {
      setError('');
      await publicRoomAPI.delete(roomId);
      setPublicRooms(publicRooms.filter(r => r.id !== roomId));
      setSuccess('Public room deleted successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error deleting public room:', err);
      setError('Failed to delete public room');
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
        <h2>Settings</h2>
        <div>
          <span className="me-3">Welcome, {user?.email}</span>
          <Button variant="outline-secondary" size="sm" className="me-2" onClick={() => navigate('/dashboard')}>
            Dashboard
          </Button>
          <Button variant="outline-danger" size="sm" onClick={logout}>
            Logout
          </Button>
        </div>
      </div>

      {error && <Alert variant="danger" onClose={() => setError('')} dismissible>{error}</Alert>}
      {success && <Alert variant="success" onClose={() => setSuccess('')} dismissible>{success}</Alert>}

      <Row className="g-4">
        {/* Public Rooms Section */}
        <Col md={12}>
          <Card>
            <Card.Header>
              <h5 className="mb-0">Public Rooms</h5>
              <small className="text-muted">
                Create named rooms that viewers can join by name instead of PIN
              </small>
            </Card.Header>
            <Card.Body>
              {/* Create New Public Room Form */}
              <Form onSubmit={handleCreateRoom} className="mb-4">
                <Row className="g-2 align-items-end">
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Room Name</Form.Label>
                      <Form.Control
                        type="text"
                        placeholder="e.g., Solu Israel"
                        value={newRoomName}
                        onChange={(e) => setNewRoomName(e.target.value)}
                        disabled={creating}
                      />
                      {newRoomName && (
                        <Form.Text className="text-muted">
                          Viewers will search for: <strong>{getSlugPreview(newRoomName)}</strong>
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
                          Creating...
                        </>
                      ) : (
                        'Create Public Room'
                      )}
                    </Button>
                  </Col>
                </Row>
              </Form>

              {/* List of Public Rooms */}
              {loading ? (
                <div className="text-center py-4">
                  <Spinner animation="border" />
                  <p className="mt-2 text-muted">Loading public rooms...</p>
                </div>
              ) : publicRooms.length === 0 ? (
                <div className="text-center py-4 text-muted">
                  <p className="mb-0">You haven't created any public rooms yet.</p>
                  <p className="small">Create one above to let viewers join by name!</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Search Term</th>
                        <th>Status</th>
                        <th>Actions</th>
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
                                Live
                              </Badge>
                            ) : (
                              <Badge bg="secondary">
                                Offline
                              </Badge>
                            )}
                          </td>
                          <td>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={() => handleDeleteRoom(room.id)}
                            >
                              Delete
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <Alert variant="info" className="mt-3 mb-0">
                <strong>How it works:</strong>
                <ul className="mb-0 mt-2">
                  <li>Create a public room name (e.g., "Solu Israel")</li>
                  <li>When you start presenting, select which public room to link</li>
                  <li>Viewers can then search for your room by name and join</li>
                  <li>When you stop presenting, the room goes offline but keeps its name</li>
                </ul>
              </Alert>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default Settings;
