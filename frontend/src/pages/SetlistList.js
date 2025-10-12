import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Spinner, Alert, Badge } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

function SetlistList() {
  const navigate = useNavigate();
  const [setlists, setSetlists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
      setError(error.response?.data?.error || 'Failed to load setlists');
    } finally {
      setLoading(false);
    }
  };

  const deleteSetlist = async (id) => {
    if (!window.confirm('Are you sure you want to delete this setlist?')) {
      return;
    }

    try {
      await api.delete(`/api/setlists/${id}`);
      setSetlists(setlists.filter(s => s._id !== id));
    } catch (error) {
      console.error('Error deleting setlist:', error);
      alert(error.response?.data?.error || 'Failed to delete setlist');
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
        <h2>My Setlists</h2>
        <div>
          <Button variant="outline-secondary" className="me-2" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </Button>
          <Button variant="primary" onClick={() => navigate('/setlists/new')}>
            Create New Setlist
          </Button>
        </div>
      </div>

      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}

      {setlists.length === 0 ? (
        <Card>
          <Card.Body className="text-center py-5">
            <p className="text-muted mb-3">You haven't created any setlists yet.</p>
            <Button variant="primary" onClick={() => navigate('/setlists/new')}>
              Create Your First Setlist
            </Button>
          </Card.Body>
        </Card>
      ) : (
        <Row>
          {setlists.map((setlist) => (
            <Col md={6} lg={4} key={setlist._id} className="mb-4">
              <Card className="h-100">
                <Card.Body>
                  <Card.Title>{setlist.name}</Card.Title>
                  <div className="mb-3">
                    <Badge bg="secondary" className="me-2">
                      {setlist.items.length} {setlist.items.length === 1 ? 'song' : 'songs'}
                    </Badge>
                    <Badge bg="info">
                      Used {setlist.usageCount} {setlist.usageCount === 1 ? 'time' : 'times'}
                    </Badge>
                  </div>

                  {setlist.items.length > 0 && (
                    <div className="mb-3">
                      <small className="text-muted">Songs:</small>
                      <ul className="mb-0 mt-1" style={{ fontSize: '0.9rem' }}>
                        {setlist.items.slice(0, 3).map((item, idx) => (
                          <li key={idx}>
                            {item.type === 'song' && item.song ? item.song.title : 'Blank Slide'}
                          </li>
                        ))}
                        {setlist.items.length > 3 && (
                          <li className="text-muted">+ {setlist.items.length - 3} more</li>
                        )}
                      </ul>
                    </div>
                  )}

                  <div className="d-grid gap-2">
                    <Button variant="primary" size="sm" onClick={() => navigate(`/setlists/${setlist._id}`)}>
                      View Details
                    </Button>
                    <Button variant="outline-primary" size="sm" onClick={() => navigate(`/setlists/${setlist._id}/edit`)}>
                      Edit
                    </Button>
                    <Button variant="outline-danger" size="sm" onClick={() => deleteSetlist(setlist._id)}>
                      Delete
                    </Button>
                  </div>
                </Card.Body>
                <Card.Footer className="text-muted">
                  <small>Updated {new Date(setlist.updatedAt).toLocaleDateString()}</small>
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
