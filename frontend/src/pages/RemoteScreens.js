import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Form, Modal, Badge, Alert, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { remoteScreenAPI, themeAPI } from '../services/api';

const MAX_SCREENS = 5;

const DISPLAY_TYPES = [
  { value: 'viewer', labelKey: 'remoteScreens.types.viewer', descKey: 'remoteScreens.types.viewerDesc' },
  { value: 'stage', labelKey: 'remoteScreens.types.stage', descKey: 'remoteScreens.types.stageDesc' },
  { value: 'obs', labelKey: 'remoteScreens.types.obs', descKey: 'remoteScreens.types.obsDesc' },
  { value: 'custom', labelKey: 'remoteScreens.types.custom', descKey: 'remoteScreens.types.customDesc' }
];

function RemoteScreens() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();

  const [screens, setScreens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newScreen, setNewScreen] = useState({ name: '', displayType: 'viewer', config: {} });
  const [creating, setCreating] = useState(false);

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingScreen, setEditingScreen] = useState(null);
  const [saving, setSaving] = useState(false);

  // Copy feedback
  const [copiedId, setCopiedId] = useState(null);

  // Themes for custom display type
  const [themes, setThemes] = useState([]);

  useEffect(() => {
    loadScreens();
    loadThemes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadThemes = async () => {
    try {
      const response = await themeAPI.getAll();
      setThemes(response.data.themes || []);
    } catch (err) {
      console.error('Error loading themes:', err);
    }
  };

  const loadScreens = async () => {
    try {
      setLoading(true);
      const response = await remoteScreenAPI.getAll();
      setScreens(response.data.screens);
      setError('');
    } catch (err) {
      console.error('Error loading screens:', err);
      setError(t('remoteScreens.loadError', 'Failed to load remote screens'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateScreen = async (e) => {
    e.preventDefault();
    if (!newScreen.name.trim()) return;

    try {
      setCreating(true);
      await remoteScreenAPI.create(newScreen);
      await loadScreens();
      setShowCreateModal(false);
      setNewScreen({ name: '', displayType: 'viewer', config: {} });
    } catch (err) {
      console.error('Error creating screen:', err);
      setError(err.response?.data?.error || t('remoteScreens.createError', 'Failed to create screen'));
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteScreen = async (id) => {
    if (!window.confirm(t('remoteScreens.deleteConfirm', 'Are you sure you want to delete this screen?'))) {
      return;
    }

    try {
      await remoteScreenAPI.delete(id);
      await loadScreens();
    } catch (err) {
      console.error('Error deleting screen:', err);
      setError(t('remoteScreens.deleteError', 'Failed to delete screen'));
    }
  };

  const handleEditScreen = (screen) => {
    setEditingScreen({ ...screen });
    setShowEditModal(true);
  };

  const handleUpdateScreen = async (e) => {
    e.preventDefault();
    if (!editingScreen.name.trim()) return;

    try {
      setSaving(true);
      await remoteScreenAPI.update(editingScreen.id, {
        name: editingScreen.name,
        displayType: editingScreen.displayType,
        config: editingScreen.config || {}
      });
      await loadScreens();
      setShowEditModal(false);
      setEditingScreen(null);
    } catch (err) {
      console.error('Error updating screen:', err);
      setError(err.response?.data?.error || t('remoteScreens.updateError', 'Failed to update screen'));
    } finally {
      setSaving(false);
    }
  };

  const getScreenUrl = (screen) => {
    return `${window.location.origin}/u/${user.id}/screen/${screen.id}`;
  };

  const copyToClipboard = async (screen) => {
    const url = getScreenUrl(screen);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(screen.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const getDisplayTypeBadge = (type) => {
    const colors = {
      viewer: 'primary',
      stage: 'success',
      obs: 'info',
      custom: 'warning'
    };
    const labels = {
      viewer: t('remoteScreens.types.viewer', 'Viewer'),
      stage: t('remoteScreens.types.stage', 'Stage Monitor'),
      obs: t('remoteScreens.types.obs', 'OBS Overlay'),
      custom: t('remoteScreens.types.custom', 'Custom')
    };
    return <Badge bg={colors[type] || 'secondary'}>{labels[type] || type}</Badge>;
  };

  if (loading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" />
      </Container>
    );
  }

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <Button variant="outline-secondary" size="sm" onClick={() => navigate('/dashboard')} className="me-3">
            &larr; {t('common.back', 'Back')}
          </Button>
          <span className="h4 mb-0">{t('remoteScreens.title', 'Remote Screens')}</span>
        </div>
        <Button
          variant="primary"
          onClick={() => setShowCreateModal(true)}
          disabled={screens.length >= MAX_SCREENS}
        >
          {t('remoteScreens.create', 'Create Screen')}
        </Button>
      </div>

      {error && (
        <Alert variant="danger" onClose={() => setError('')} dismissible>
          {error}
        </Alert>
      )}

      <p className="text-muted mb-4">
        {t('remoteScreens.description', 'Create fixed URLs for kiosk displays or Raspberry Pi devices. Each screen automatically shows your active presentation.')}
      </p>

      {screens.length === 0 ? (
        <Card className="text-center py-5">
          <Card.Body>
            <div className="text-muted mb-3">
              {t('remoteScreens.noScreens', 'No remote screens yet')}
            </div>
            <Button variant="primary" onClick={() => setShowCreateModal(true)}>
              {t('remoteScreens.createFirst', 'Create your first screen')}
            </Button>
          </Card.Body>
        </Card>
      ) : (
        <Row className="g-4">
          {screens.map(screen => (
            <Col md={6} lg={4} key={screen.id}>
              <Card className="h-100">
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <Card.Title className="mb-0">{screen.name}</Card.Title>
                    {getDisplayTypeBadge(screen.displayType)}
                  </div>

                  <div className="mt-3 mb-3">
                    <small className="text-muted d-block mb-1">{t('remoteScreens.url', 'Screen URL')}:</small>
                    <code style={{
                      fontSize: '0.75rem',
                      wordBreak: 'break-all',
                      display: 'block',
                      backgroundColor: '#f8f9fa',
                      padding: '0.5rem',
                      borderRadius: '4px'
                    }}>
                      {getScreenUrl(screen)}
                    </code>
                  </div>

                  <div className="d-flex gap-2 flex-wrap">
                    <Button
                      variant={copiedId === screen.id ? 'success' : 'outline-primary'}
                      size="sm"
                      onClick={() => copyToClipboard(screen)}
                    >
                      {copiedId === screen.id
                        ? t('common.copied', 'Copied!')
                        : t('remoteScreens.copyUrl', 'Copy URL')
                      }
                    </Button>
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={() => window.open(getScreenUrl(screen), '_blank')}
                    >
                      {t('remoteScreens.preview', 'Preview')}
                    </Button>
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={() => handleEditScreen(screen)}
                    >
                      {t('common.edit', 'Edit')}
                    </Button>
                    <Button
                      variant="outline-danger"
                      size="sm"
                      onClick={() => handleDeleteScreen(screen.id)}
                    >
                      {t('common.delete', 'Delete')}
                    </Button>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <div className="text-muted mt-4">
        {t('remoteScreens.limit', '{{count}} of {{max}} screens used', { count: screens.length, max: MAX_SCREENS })}
      </div>

      {/* Create Modal */}
      <Modal show={showCreateModal} onHide={() => setShowCreateModal(false)}>
        <Form onSubmit={handleCreateScreen}>
          <Modal.Header closeButton>
            <Modal.Title>{t('remoteScreens.createTitle', 'Create Remote Screen')}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>{t('remoteScreens.name', 'Screen Name')}</Form.Label>
              <Form.Control
                type="text"
                value={newScreen.name}
                onChange={(e) => setNewScreen({ ...newScreen, name: e.target.value })}
                placeholder={t('remoteScreens.namePlaceholder', 'e.g., Main Hall TV, Stage Left Monitor')}
                required
                maxLength={100}
              />
            </Form.Group>

            <Form.Group>
              <Form.Label>{t('remoteScreens.displayType', 'Display Type')}</Form.Label>
              {DISPLAY_TYPES.map(type => (
                <Form.Check
                  key={type.value}
                  type="radio"
                  id={`displayType-${type.value}`}
                  name="displayType"
                  value={type.value}
                  checked={newScreen.displayType === type.value}
                  onChange={(e) => setNewScreen({
                    ...newScreen,
                    displayType: e.target.value,
                    config: e.target.value === 'custom' ? { themeId: themes[0]?.id || '' } : {}
                  })}
                  label={
                    <div>
                      <strong>{t(type.labelKey, type.value)}</strong>
                      <div className="text-muted small">
                        {t(type.descKey, '')}
                      </div>
                    </div>
                  }
                  className="mb-2"
                />
              ))}
            </Form.Group>

            {newScreen.displayType === 'custom' && (
              <Form.Group className="mt-3">
                <Form.Label>{t('remoteScreens.selectTheme', 'Select Theme')}</Form.Label>
                <Form.Select
                  value={newScreen.config?.themeId || ''}
                  onChange={(e) => setNewScreen({
                    ...newScreen,
                    config: { ...newScreen.config, themeId: e.target.value }
                  })}
                >
                  <option value="">{t('remoteScreens.noTheme', '-- Select a theme --')}</option>
                  {themes.map(theme => (
                    <option key={theme.id} value={theme.id}>
                      {theme.name} {theme.isBuiltIn ? `(${t('themes.builtIn', 'Built-in')})` : ''}
                    </option>
                  ))}
                </Form.Select>
                <Form.Text className="text-muted">
                  {t('remoteScreens.themeNote', 'This theme will always be used for this screen, ignoring room settings.')}
                </Form.Text>
              </Form.Group>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button variant="primary" type="submit" disabled={creating || !newScreen.name.trim()}>
              {creating ? t('common.creating', 'Creating...') : t('common.create', 'Create')}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Edit Modal */}
      <Modal show={showEditModal} onHide={() => setShowEditModal(false)}>
        <Form onSubmit={handleUpdateScreen}>
          <Modal.Header closeButton>
            <Modal.Title>{t('remoteScreens.editTitle', 'Edit Remote Screen')}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {editingScreen && (
              <>
                <Form.Group className="mb-3">
                  <Form.Label>{t('remoteScreens.name', 'Screen Name')}</Form.Label>
                  <Form.Control
                    type="text"
                    value={editingScreen.name}
                    onChange={(e) => setEditingScreen({ ...editingScreen, name: e.target.value })}
                    placeholder={t('remoteScreens.namePlaceholder', 'e.g., Main Hall TV, Stage Left Monitor')}
                    required
                    maxLength={100}
                  />
                </Form.Group>

                <Form.Group>
                  <Form.Label>{t('remoteScreens.displayType', 'Display Type')}</Form.Label>
                  {DISPLAY_TYPES.map(type => (
                    <Form.Check
                      key={type.value}
                      type="radio"
                      id={`edit-displayType-${type.value}`}
                      name="editDisplayType"
                      value={type.value}
                      checked={editingScreen.displayType === type.value}
                      onChange={(e) => setEditingScreen({
                        ...editingScreen,
                        displayType: e.target.value,
                        config: e.target.value === 'custom'
                          ? { themeId: editingScreen.config?.themeId || themes[0]?.id || '' }
                          : {}
                      })}
                      label={
                        <div>
                          <strong>{t(type.labelKey, type.value)}</strong>
                          <div className="text-muted small">
                            {t(type.descKey, '')}
                          </div>
                        </div>
                      }
                      className="mb-2"
                    />
                  ))}
                </Form.Group>

                {editingScreen.displayType === 'custom' && (
                  <Form.Group className="mt-3">
                    <Form.Label>{t('remoteScreens.selectTheme', 'Select Theme')}</Form.Label>
                    <Form.Select
                      value={editingScreen.config?.themeId || ''}
                      onChange={(e) => setEditingScreen({
                        ...editingScreen,
                        config: { ...editingScreen.config, themeId: e.target.value }
                      })}
                    >
                      <option value="">{t('remoteScreens.noTheme', '-- Select a theme --')}</option>
                      {themes.map(theme => (
                        <option key={theme.id} value={theme.id}>
                          {theme.name} {theme.isBuiltIn ? `(${t('themes.builtIn', 'Built-in')})` : ''}
                        </option>
                      ))}
                    </Form.Select>
                    <Form.Text className="text-muted">
                      {t('remoteScreens.themeNote', 'This theme will always be used for this screen, ignoring room settings.')}
                    </Form.Text>
                  </Form.Group>
                )}
              </>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button variant="primary" type="submit" disabled={saving || !editingScreen?.name?.trim()}>
              {saving ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Container>
  );
}

export default RemoteScreens;
