import React from 'react';
import { Container, Row, Col, Card, Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function Dashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  return (
    <Container className="py-5">
      <div className="text-center mb-4">
        <img src="/logo.png" alt="SoluCast Logo" style={{ maxWidth: '250px', height: 'auto' }} />
      </div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Dashboard</h2>
        <div>
          <span className="me-3">Welcome, {user?.email}</span>
          <Button variant="outline-danger" size="sm" onClick={logout}>
            Logout
          </Button>
        </div>
      </div>

      <Row className="g-4">
        <Col md={6}>
          <Card className="h-100">
            <Card.Body>
              <Card.Title>Start Presentation</Card.Title>
              <Card.Text>
                Create a room and start presenting immediately. Share the PIN with viewers to join.
              </Card.Text>
              <Button variant="primary" onClick={() => navigate('/operator')}>
                Start Now
              </Button>
            </Card.Body>
          </Card>
        </Col>

        <Col md={6}>
          <Card className="h-100">
            <Card.Body>
              <Card.Title>Song Library</Card.Title>
              <Card.Text>
                Browse, search, and manage your song collection. Create new songs or edit existing ones.
              </Card.Text>
              <Button variant="primary" onClick={() => navigate('/songs')}>
                View Songs
              </Button>
            </Card.Body>
          </Card>
        </Col>

        <Col md={6}>
          <Card className="h-100">
            <Card.Body>
              <Card.Title>Setlists</Card.Title>
              <Card.Text>
                Create and manage setlists for your services. Organize songs in the order you need.
              </Card.Text>
              <Button variant="primary" onClick={() => navigate('/setlists')}>
                Manage Setlists
              </Button>
            </Card.Body>
          </Card>
        </Col>

        <Col md={6}>
          <Card className="h-100">
            <Card.Body>
              <Card.Title>Media Library</Card.Title>
              <Card.Text>
                Manage background images and gradients for your presentations.
              </Card.Text>
              <Button variant="primary" onClick={() => navigate('/media')}>
                View Media
              </Button>
            </Card.Body>
          </Card>
        </Col>

        {user?.role === 'admin' && (
          <Col md={6}>
            <Card className="h-100 border-warning">
              <Card.Body>
                <Card.Title>Admin Panel</Card.Title>
                <Card.Text>
                  Review and approve song submissions. Manage users and the public song database.
                </Card.Text>
                <Button variant="warning" onClick={() => navigate('/admin')}>
                  Admin Panel
                </Button>
              </Card.Body>
            </Card>
          </Col>
        )}
      </Row>
    </Container>
  );
}

export default Dashboard;
