import React, { useState, useEffect } from 'react';
import { Container, Card, Button, Badge, ListGroup, Row, Col, Spinner, Alert } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

function SetlistView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [setlist, setSetlist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
      setError(error.response?.data?.error || 'Failed to load setlist');
    } finally {
      setLoading(false);
    }
  };

  const deleteSetlist = async () => {
    if (!window.confirm('Are you sure you want to delete this setlist?')) {
      return;
    }

    try {
      await api.delete(`/api/setlists/${id}`);
      alert('Setlist deleted successfully');
      navigate('/setlists');
    } catch (error) {
      console.error('Error deleting setlist:', error);
      alert(error.response?.data?.error || 'Failed to delete setlist');
    }
  };

  const useSetlist = async () => {
    try {
      await api.post(`/api/setlists/${id}/use`);
      // Navigate to operator mode with this setlist
      navigate('/operator', { state: { setlistId: id } });
    } catch (error) {
      console.error('Error using setlist:', error);
      alert('Failed to use setlist');
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
        <Alert variant="danger">{error || 'Setlist not found'}</Alert>
        <Button onClick={() => navigate('/setlists')}>Back to Setlists</Button>
      </Container>
    );
  }

  const isOwner = setlist.createdBy === user._id || setlist.createdBy._id === user._id;

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2>{setlist.name}</h2>
          <div className="mt-2">
            <Badge bg="secondary" className="me-2">
              {setlist.items.length} {setlist.items.length === 1 ? 'item' : 'items'}
            </Badge>
            <Badge bg="info">
              Used {setlist.usageCount} {setlist.usageCount === 1 ? 'time' : 'times'}
            </Badge>
          </div>
        </div>
        <div>
          <Button variant="outline-secondary" className="me-2" onClick={() => navigate('/setlists')}>
            Back to List
          </Button>
          {isOwner && (
            <>
              <Button variant="primary" className="me-2" onClick={() => navigate(`/setlists/${id}/edit`)}>
                Edit
              </Button>
              <Button variant="outline-danger" onClick={deleteSetlist}>
                Delete
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
              <h5 className="mb-0">Songs in this Setlist</h5>
            </Card.Header>
            <Card.Body>
              {setlist.items.length === 0 ? (
                <p className="text-muted text-center py-3">
                  This setlist is empty.
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
                                {item.song.slides?.length || 0} slides
                              </small>
                            </>
                          ) : (
                            <div style={{ fontSize: '1.1rem', fontStyle: 'italic' }}>
                              Blank Slide
                            </div>
                          )}
                        </div>
                      </div>
                      {item.type === 'song' && item.song && (
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={() => navigate(`/songs/${item.song._id}`)}
                        >
                          View Song
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
              <h5 className="mb-0">Details</h5>
            </Card.Header>
            <Card.Body>
              <div className="mb-3">
                <small className="text-muted">Created:</small>
                <div>{new Date(setlist.createdAt).toLocaleDateString()}</div>
              </div>

              <div className="mb-3">
                <small className="text-muted">Last Updated:</small>
                <div>{new Date(setlist.updatedAt).toLocaleDateString()}</div>
              </div>

              <div className="mb-3">
                <small className="text-muted">Total Items:</small>
                <div>{setlist.items.length}</div>
              </div>

              <div>
                <small className="text-muted">Usage Count:</small>
                <div>{setlist.usageCount}</div>
              </div>
            </Card.Body>
          </Card>

          {/* Actions */}
          <Card className="mb-3">
            <Card.Header>
              <h5 className="mb-0">Actions</h5>
            </Card.Header>
            <Card.Body>
              <div className="d-grid gap-2">
                <Button variant="success" onClick={useSetlist}>
                  Present This Setlist
                </Button>
                {isOwner && (
                  <Button variant="outline-primary" onClick={() => navigate(`/setlists/${id}/edit`)}>
                    Edit Setlist
                  </Button>
                )}
              </div>
            </Card.Body>
          </Card>

          {/* Share Link */}
          <Card>
            <Card.Header>
              <h5 className="mb-0">Share Setlist</h5>
            </Card.Header>
            <Card.Body>
              <p className="text-muted small mb-2">
                Share this link with other logged-in users to let them present this setlist
              </p>
              <Button
                variant="primary"
                className="w-100 mb-2"
                onClick={() => {
                  const shareUrl = `${window.location.origin}/operator?setlistId=${id}`;
                  navigator.clipboard.writeText(shareUrl);
                  alert('Share link copied to clipboard!');
                }}
              >
                Copy Share Link
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
