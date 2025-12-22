import React from 'react';
import { Container, Row, Col, Card, Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';

function Dashboard() {
  const navigate = useNavigate();
  const { user, logout, isAdmin } = useAuth();
  const { t } = useTranslation();

  return (
    <Container className="py-5">
      <div className="text-center mb-4">
        <img src="/new_cast_logo.png" alt="SoluCast Logo" style={{ maxWidth: '250px', height: 'auto' }} />
      </div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>{t('dashboard.title')}</h2>
        <div>
          <span className="me-3">{t('dashboard.welcome')}, {user?.email}</span>
          <Button variant="outline-danger" size="sm" onClick={logout}>
            {t('nav.logout')}
          </Button>
        </div>
      </div>

      <Row className="g-4">
        <Col md={6}>
          <Card className="h-100">
            <Card.Body>
              <Card.Title>{t('dashboard.operator')}</Card.Title>
              <Card.Text>
                {t('dashboard.operatorDesc')}
              </Card.Text>
              <Button variant="primary" onClick={() => navigate('/operator')}>
                {t('dashboard.startNow')}
              </Button>
            </Card.Body>
          </Card>
        </Col>

        <Col md={6}>
          <Card className="h-100">
            <Card.Body>
              <Card.Title>{t('dashboard.songLibrary')}</Card.Title>
              <Card.Text>
                {t('dashboard.songLibraryDesc')}
              </Card.Text>
              <Button variant="primary" onClick={() => navigate('/songs')}>
                {t('dashboard.viewSongs')}
              </Button>
            </Card.Body>
          </Card>
        </Col>

        {isAdmin && (
          <Col md={6}>
            <Card className="h-100">
              <Card.Body>
                <Card.Title>{t('setlists.title')}</Card.Title>
                <Card.Text>
                  {t('dashboard.setlistsDesc')}
                </Card.Text>
                <Button variant="primary" onClick={() => navigate('/setlists')}>
                  {t('dashboard.manageSetlists')}
                </Button>
              </Card.Body>
            </Card>
          </Col>
        )}

        {isAdmin && (
          <Col md={6}>
            <Card className="h-100">
              <Card.Body>
                <Card.Title>{t('media.title')}</Card.Title>
                <Card.Text>
                  {t('dashboard.mediaDesc')}
                </Card.Text>
                <Button variant="primary" onClick={() => navigate('/media')}>
                  {t('dashboard.viewMedia')}
                </Button>
              </Card.Body>
            </Card>
          </Col>
        )}

        {isAdmin && (
          <Col md={6}>
            <Card className="h-100 border-warning">
              <Card.Body>
                <Card.Title>{t('admin.title')}</Card.Title>
                <Card.Text>
                  {t('dashboard.adminDesc')}
                </Card.Text>
                <Button variant="warning" onClick={() => navigate('/admin')}>
                  {t('admin.title')}
                </Button>
              </Card.Body>
            </Card>
          </Col>
        )}

        <Col md={6}>
          <Card className="h-100">
            <Card.Body>
              <Card.Title>{t('settings.title')}</Card.Title>
              <Card.Text>
                {t('dashboard.settingsDesc')}
              </Card.Text>
              <Button variant="secondary" onClick={() => navigate('/settings')}>
                {t('settings.title')}
              </Button>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default Dashboard;
