import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Card, Button, Form, Alert, Modal, Nav } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { themeAPI, stageMonitorThemeAPI } from '../services/api';
import ThemeCanvas from '../components/theme-editor/ThemeCanvas';
import PropertiesPanel from '../components/theme-editor/PropertiesPanel';
import BoxPropertiesPanel from '../components/theme-editor/BoxPropertiesPanel';
import ResolutionSelector from '../components/theme-editor/ResolutionSelector';
import { StageMonitorCanvas, StageMonitorPropertiesPanel, StageMonitorColorPanel } from '../components/stage-monitor-editor';

const DEFAULT_LINE_STYLES = {
  original: { fontSize: 100, fontWeight: '500', color: '#FFFFFF', opacity: 1, visible: true },
  transliteration: { fontSize: 90, fontWeight: '400', color: '#FFFFFF', opacity: 0.95, visible: true },
  translation: { fontSize: 90, fontWeight: '400', color: '#FFFFFF', opacity: 0.95, visible: true }
};

const DEFAULT_LINE_POSITIONS = {
  original: { x: 10, y: 15, width: 80, height: 22 },
  transliteration: { x: 10, y: 40, width: 80, height: 18 },
  translation: { x: 10, y: 62, width: 80, height: 18 }
};

const DEFAULT_CANVAS_DIMENSIONS = { width: 1920, height: 1080 };
const DEFAULT_VIEWER_BACKGROUND = { type: 'inherit', color: null };

function Themes() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Active tab: 'viewer' or 'stage'
  const [activeTab, setActiveTab] = useState('viewer');

  // Viewer theme state
  const [themes, setThemes] = useState([]);
  const [selectedTheme, setSelectedTheme] = useState(null);
  const [editingTheme, setEditingTheme] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedLine, setSelectedLine] = useState(null);
  const [selectedBoxId, setSelectedBoxId] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [defaultThemeId, setDefaultThemeId] = useState(null);

  // Stage monitor theme state
  const [stageThemes, setStageThemes] = useState([]);
  const [selectedStageTheme, setSelectedStageTheme] = useState(null);
  const [editingStageTheme, setEditingStageTheme] = useState(null);
  const [stageLoading, setStageLoading] = useState(true);
  const [defaultStageThemeId, setDefaultStageThemeId] = useState(null);
  const [selectedStageElement, setSelectedStageElement] = useState(null);

  // Name modal state (for create and duplicate)
  const [showNameModal, setShowNameModal] = useState(false);
  const [nameModalMode, setNameModalMode] = useState('create'); // 'create' or 'duplicate'
  const [themeName, setThemeName] = useState('');
  const [duplicateSource, setDuplicateSource] = useState(null);

  // Fetch themes
  const fetchThemes = useCallback(async () => {
    try {
      setLoading(true);
      const response = await themeAPI.getAll();
      setThemes(response.data.themes || []);
    } catch (error) {
      console.error('Error fetching themes:', error);
      setErrorMessage(t('themes.fetchError', 'Failed to load themes'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchThemes();
  }, [fetchThemes]);

  // Fetch default theme
  const fetchDefaultTheme = useCallback(async () => {
    try {
      const response = await themeAPI.getDefault();
      setDefaultThemeId(response.data.defaultThemeId);
    } catch (error) {
      console.error('Error fetching default theme:', error);
    }
  }, []);

  useEffect(() => {
    fetchDefaultTheme();
  }, [fetchDefaultTheme]);

  // Fetch stage monitor themes
  const fetchStageThemes = useCallback(async () => {
    try {
      setStageLoading(true);
      const response = await stageMonitorThemeAPI.getAll();
      setStageThemes(response.data.themes || []);
    } catch (error) {
      console.error('Error fetching stage monitor themes:', error);
      setErrorMessage(t('stageMonitorThemes.fetchError', 'Failed to load stage monitor themes'));
    } finally {
      setStageLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchStageThemes();
  }, [fetchStageThemes]);

  // Fetch default stage theme
  const fetchDefaultStageTheme = useCallback(async () => {
    try {
      const response = await stageMonitorThemeAPI.getDefault();
      setDefaultStageThemeId(response.data.defaultThemeId);
    } catch (error) {
      console.error('Error fetching default stage monitor theme:', error);
    }
  }, []);

  useEffect(() => {
    fetchDefaultStageTheme();
  }, [fetchDefaultStageTheme]);

  // Initialize editing theme with default positions if missing
  const initializeEditingTheme = (theme) => {
    return {
      ...theme,
      linePositions: theme.linePositions || DEFAULT_LINE_POSITIONS,
      canvasDimensions: theme.canvasDimensions || DEFAULT_CANVAS_DIMENSIONS,
      lineStyles: theme.lineStyles || DEFAULT_LINE_STYLES,
      lineOrder: theme.lineOrder || ['original', 'transliteration', 'translation'],
      viewerBackground: theme.viewerBackground || DEFAULT_VIEWER_BACKGROUND,
      backgroundBoxes: theme.backgroundBoxes || []
    };
  };

  // Open create theme modal
  const handleCreateTheme = () => {
    setNameModalMode('create');
    setThemeName('');
    setDuplicateSource(null);
    setShowNameModal(true);
  };

  // Submit create theme
  const handleSubmitCreateTheme = async () => {
    if (!themeName.trim()) return;

    try {
      setSaving(true);
      setShowNameModal(false);
      const response = await themeAPI.create({
        name: themeName.trim(),
        lineOrder: ['original', 'transliteration', 'translation'],
        lineStyles: DEFAULT_LINE_STYLES,
        linePositions: DEFAULT_LINE_POSITIONS,
        canvasDimensions: DEFAULT_CANVAS_DIMENSIONS,
        viewerBackground: DEFAULT_VIEWER_BACKGROUND
      });
      await fetchThemes();
      const newTheme = response.data.theme;
      setSelectedTheme(newTheme);
      setEditingTheme(initializeEditingTheme(newTheme));
      setSelectedLine(null);
      setSuccessMessage(t('themes.created', 'Theme created successfully'));
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error creating theme:', error);
      setErrorMessage(t('themes.createError', 'Failed to create theme'));
    } finally {
      setSaving(false);
      setThemeName('');
    }
  };

  // Open duplicate theme modal
  const handleDuplicateTheme = (theme) => {
    setNameModalMode('duplicate');
    setThemeName(`${theme.name} (Copy)`);
    setDuplicateSource(theme);
    setShowNameModal(true);
  };

  // Submit duplicate theme
  const handleSubmitDuplicateTheme = async () => {
    if (!themeName.trim() || !duplicateSource) return;

    try {
      setSaving(true);
      setShowNameModal(false);
      const response = await themeAPI.duplicate(duplicateSource.id, themeName.trim());
      await fetchThemes();
      const newTheme = response.data.theme;
      setSelectedTheme(newTheme);
      setEditingTheme(initializeEditingTheme(newTheme));
      setSelectedLine(null);
      setSuccessMessage(t('themes.duplicated', 'Theme duplicated successfully'));
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error duplicating theme:', error);
      setErrorMessage(t('themes.duplicateError', 'Failed to duplicate theme'));
    } finally {
      setSaving(false);
      setThemeName('');
      setDuplicateSource(null);
    }
  };

  // Delete theme
  const handleDeleteTheme = async (theme) => {
    if (theme.isBuiltIn) {
      setErrorMessage(t('themes.cannotDeleteBuiltIn', 'Cannot delete built-in themes'));
      return;
    }

    if (!window.confirm(t('themes.confirmDelete', `Delete "${theme.name}"?`))) {
      return;
    }

    try {
      setSaving(true);
      await themeAPI.delete(theme.id);
      await fetchThemes();
      if (selectedTheme?.id === theme.id) {
        setSelectedTheme(null);
        setEditingTheme(null);
        setSelectedLine(null);
      }
      setSuccessMessage(t('themes.deleted', 'Theme deleted successfully'));
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error deleting theme:', error);
      setErrorMessage(t('themes.deleteError', 'Failed to delete theme'));
    } finally {
      setSaving(false);
    }
  };

  // Save theme changes
  const handleSaveTheme = async () => {
    if (!editingTheme || editingTheme.isBuiltIn) return;

    try {
      setSaving(true);
      await themeAPI.update(editingTheme.id, {
        name: editingTheme.name,
        lineOrder: editingTheme.lineOrder,
        lineStyles: editingTheme.lineStyles,
        linePositions: editingTheme.linePositions,
        canvasDimensions: editingTheme.canvasDimensions,
        viewerBackground: editingTheme.viewerBackground,
        backgroundBoxes: editingTheme.backgroundBoxes || []
      });
      await fetchThemes();
      setSuccessMessage(t('themes.saved', 'Theme saved successfully'));
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error saving theme:', error);
      setErrorMessage(t('themes.saveError', 'Failed to save theme'));
    } finally {
      setSaving(false);
    }
  };

  // Update line position
  const handlePositionChange = (lineType, position) => {
    if (!editingTheme || editingTheme.isBuiltIn) return;

    setEditingTheme({
      ...editingTheme,
      linePositions: {
        ...editingTheme.linePositions,
        [lineType]: position
      }
    });
  };

  // Update line style
  const handleStyleChange = (field, value) => {
    if (!editingTheme || editingTheme.isBuiltIn || !selectedLine) return;

    setEditingTheme({
      ...editingTheme,
      lineStyles: {
        ...editingTheme.lineStyles,
        [selectedLine]: {
          ...editingTheme.lineStyles[selectedLine],
          [field]: value
        }
      }
    });
  };

  // Update position field (for padding from PropertiesPanel)
  const handlePositionFieldChange = (field, value) => {
    if (!editingTheme || editingTheme.isBuiltIn || !selectedLine) return;

    setEditingTheme({
      ...editingTheme,
      linePositions: {
        ...editingTheme.linePositions,
        [selectedLine]: {
          ...editingTheme.linePositions[selectedLine],
          [field]: value
        }
      }
    });
  };

  // Add a new background box
  const handleAddBox = () => {
    if (!editingTheme || editingTheme.isBuiltIn) return;
    const boxes = editingTheme.backgroundBoxes || [];
    if (boxes.length >= 3) return;

    const newBox = {
      id: `box-${Date.now()}`,
      x: 20 + (boxes.length * 10),
      y: 20 + (boxes.length * 10),
      width: 60,
      height: 20,
      color: '#000000',
      opacity: 0.5,
      borderRadius: 0
    };

    setEditingTheme({
      ...editingTheme,
      backgroundBoxes: [...boxes, newBox]
    });
    setSelectedBoxId(newBox.id);
    setSelectedLine(null);
  };

  // Update a background box
  const handleBoxChange = (updatedBox) => {
    if (!editingTheme || editingTheme.isBuiltIn) return;

    setEditingTheme({
      ...editingTheme,
      backgroundBoxes: (editingTheme.backgroundBoxes || []).map(box =>
        box.id === updatedBox.id ? updatedBox : box
      )
    });
  };

  // Delete a background box
  const handleDeleteBox = (boxId) => {
    if (!editingTheme || editingTheme.isBuiltIn) return;

    setEditingTheme({
      ...editingTheme,
      backgroundBoxes: (editingTheme.backgroundBoxes || []).filter(box => box.id !== boxId)
    });
    setSelectedBoxId(null);
  };

  // Update canvas dimensions
  const handleDimensionsChange = (dimensions) => {
    if (!editingTheme || editingTheme.isBuiltIn) return;

    setEditingTheme({
      ...editingTheme,
      canvasDimensions: dimensions
    });
  };

  // Reset positions to default
  const handleResetPositions = () => {
    if (!editingTheme || editingTheme.isBuiltIn) return;

    setEditingTheme({
      ...editingTheme,
      linePositions: DEFAULT_LINE_POSITIONS
    });
  };

  // Set or clear default theme
  const handleSetDefault = async (themeId) => {
    try {
      setSaving(true);
      if (defaultThemeId === themeId) {
        // Clear default
        await themeAPI.clearDefault();
        setDefaultThemeId(null);
        setSuccessMessage(t('themes.defaultCleared', 'Default theme cleared'));
      } else {
        // Set as default
        await themeAPI.setDefault(themeId);
        setDefaultThemeId(themeId);
        setSuccessMessage(t('themes.defaultSet', 'Default theme set successfully'));
      }
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error setting default theme:', error);
      setErrorMessage(t('themes.defaultError', 'Failed to set default theme'));
    } finally {
      setSaving(false);
    }
  };

  // ===== STAGE MONITOR THEME HANDLERS =====

  // Initialize editing stage theme
  const initializeEditingStageTheme = (theme) => {
    return { ...theme };
  };

  // Create stage monitor theme
  const handleCreateStageTheme = () => {
    setNameModalMode('create-stage');
    setThemeName('');
    setDuplicateSource(null);
    setShowNameModal(true);
  };

  // Submit create stage monitor theme
  const handleSubmitCreateStageTheme = async () => {
    if (!themeName.trim()) return;

    try {
      setSaving(true);
      setShowNameModal(false);
      const response = await stageMonitorThemeAPI.create({
        name: themeName.trim()
      });
      await fetchStageThemes();
      const newTheme = response.data.theme;
      setSelectedStageTheme(newTheme);
      setEditingStageTheme(initializeEditingStageTheme(newTheme));
      setSelectedStageElement(null);
      setSuccessMessage(t('stageMonitorThemes.created', 'Stage monitor theme created'));
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error creating stage monitor theme:', error);
      setErrorMessage(t('stageMonitorThemes.createError', 'Failed to create stage monitor theme'));
    } finally {
      setSaving(false);
      setThemeName('');
    }
  };

  // Duplicate stage monitor theme
  const handleDuplicateStageTheme = (theme) => {
    setNameModalMode('duplicate-stage');
    setThemeName(`${theme.name} (Copy)`);
    setDuplicateSource(theme);
    setShowNameModal(true);
  };

  // Submit duplicate stage monitor theme
  const handleSubmitDuplicateStageTheme = async () => {
    if (!themeName.trim() || !duplicateSource) return;

    try {
      setSaving(true);
      setShowNameModal(false);
      const response = await stageMonitorThemeAPI.duplicate(duplicateSource.id, themeName.trim());
      await fetchStageThemes();
      const newTheme = response.data.theme;
      setSelectedStageTheme(newTheme);
      setEditingStageTheme(initializeEditingStageTheme(newTheme));
      setSelectedStageElement(null);
      setSuccessMessage(t('stageMonitorThemes.duplicated', 'Stage monitor theme duplicated'));
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error duplicating stage monitor theme:', error);
      setErrorMessage(t('stageMonitorThemes.duplicateError', 'Failed to duplicate stage monitor theme'));
    } finally {
      setSaving(false);
      setThemeName('');
      setDuplicateSource(null);
    }
  };

  // Delete stage monitor theme
  const handleDeleteStageTheme = async (theme) => {
    if (theme.isBuiltIn) {
      setErrorMessage(t('stageMonitorThemes.cannotDeleteBuiltIn', 'Cannot delete built-in themes'));
      return;
    }

    if (!window.confirm(t('stageMonitorThemes.confirmDelete', `Delete "${theme.name}"?`))) {
      return;
    }

    try {
      setSaving(true);
      await stageMonitorThemeAPI.delete(theme.id);
      await fetchStageThemes();
      if (selectedStageTheme?.id === theme.id) {
        setSelectedStageTheme(null);
        setEditingStageTheme(null);
        setSelectedStageElement(null);
      }
      setSuccessMessage(t('stageMonitorThemes.deleted', 'Stage monitor theme deleted'));
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error deleting stage monitor theme:', error);
      setErrorMessage(t('stageMonitorThemes.deleteError', 'Failed to delete stage monitor theme'));
    } finally {
      setSaving(false);
    }
  };

  // Save stage monitor theme
  const handleSaveStageTheme = async () => {
    if (!editingStageTheme || editingStageTheme.isBuiltIn) return;

    try {
      setSaving(true);
      await stageMonitorThemeAPI.update(editingStageTheme.id, {
        name: editingStageTheme.name,
        canvasDimensions: editingStageTheme.canvasDimensions,
        colors: editingStageTheme.colors,
        header: editingStageTheme.header,
        clock: editingStageTheme.clock,
        songTitle: editingStageTheme.songTitle,
        currentSlideArea: editingStageTheme.currentSlideArea,
        currentSlideText: editingStageTheme.currentSlideText,
        nextSlideArea: editingStageTheme.nextSlideArea,
        backgroundBoxes: editingStageTheme.backgroundBoxes || []
      });
      await fetchStageThemes();
      setSuccessMessage(t('stageMonitorThemes.saved', 'Stage monitor theme saved'));
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error saving stage monitor theme:', error);
      setErrorMessage(t('stageMonitorThemes.saveError', 'Failed to save stage monitor theme'));
    } finally {
      setSaving(false);
    }
  };

  // Handle stage element change from canvas
  const handleStageElementChange = (elementType, position) => {
    if (!editingStageTheme || editingStageTheme.isBuiltIn) return;

    setEditingStageTheme({
      ...editingStageTheme,
      [elementType]: {
        ...editingStageTheme[elementType],
        ...position
      }
    });
  };

  // Handle stage colors change
  const handleStageColorsChange = (colors) => {
    if (!editingStageTheme || editingStageTheme.isBuiltIn) return;

    setEditingStageTheme({
      ...editingStageTheme,
      colors
    });
  };

  // Handle stage property change from properties panel
  const handleStagePropertyChange = (elementType, updates) => {
    if (!editingStageTheme || editingStageTheme.isBuiltIn) return;

    setEditingStageTheme({
      ...editingStageTheme,
      [elementType]: {
        ...editingStageTheme[elementType],
        ...updates
      }
    });
  };

  // Set or clear default stage monitor theme
  const handleSetDefaultStageTheme = async (themeId) => {
    try {
      setSaving(true);
      if (defaultStageThemeId === themeId) {
        await stageMonitorThemeAPI.clearDefault();
        setDefaultStageThemeId(null);
        setSuccessMessage(t('stageMonitorThemes.defaultCleared', 'Default stage monitor theme cleared'));
      } else {
        await stageMonitorThemeAPI.setDefault(themeId);
        setDefaultStageThemeId(themeId);
        setSuccessMessage(t('stageMonitorThemes.defaultSet', 'Default stage monitor theme set'));
      }
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error setting default stage monitor theme:', error);
      setErrorMessage(t('stageMonitorThemes.defaultError', 'Failed to set default stage monitor theme'));
    } finally {
      setSaving(false);
    }
  };

  // Handle stage canvas dimensions change
  const handleStageDimensionsChange = (dimensions) => {
    if (!editingStageTheme || editingStageTheme.isBuiltIn) return;

    setEditingStageTheme({
      ...editingStageTheme,
      canvasDimensions: dimensions
    });
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#1a202c',
      color: '#e2e8f0'
    }}>
      <Container fluid className="py-4" style={{ maxWidth: '1600px' }}>
        {/* Header */}
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div className="d-flex align-items-center gap-3">
            <Button
              variant="outline-secondary"
              onClick={() => navigate('/dashboard')}
              className="d-flex align-items-center gap-2"
            >
              <i className="bi bi-arrow-left"></i>
              {t('common.back', 'Back')}
            </Button>
            <h2 className="mb-0">
              <i className="bi bi-palette me-2"></i>
              {t('themes.pageTitle', 'Theme Editor')}
            </h2>
          </div>
          <Button
            variant="primary"
            onClick={activeTab === 'viewer' ? handleCreateTheme : handleCreateStageTheme}
            disabled={saving}
            className="d-flex align-items-center gap-2"
          >
            <i className="bi bi-plus-lg"></i>
            {t('themes.createNew', 'New Theme')}
          </Button>
        </div>

        {/* Tabs */}
        <Nav variant="tabs" className="mb-4" style={{ borderBottomColor: 'rgba(255,255,255,0.2)' }}>
          <Nav.Item>
            <Nav.Link
              active={activeTab === 'viewer'}
              onClick={() => setActiveTab('viewer')}
              style={{
                backgroundColor: activeTab === 'viewer' ? 'rgba(99,102,241,0.2)' : 'transparent',
                color: activeTab === 'viewer' ? '#a5b4fc' : '#a0aec0',
                border: activeTab === 'viewer' ? '1px solid rgba(99,102,241,0.5)' : '1px solid transparent',
                borderBottom: activeTab === 'viewer' ? '1px solid #1a202c' : '1px solid transparent'
              }}
            >
              <i className="bi bi-display me-2"></i>
              {t('themes.viewerThemes', 'Viewer Themes')}
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link
              active={activeTab === 'stage'}
              onClick={() => setActiveTab('stage')}
              style={{
                backgroundColor: activeTab === 'stage' ? 'rgba(99,102,241,0.2)' : 'transparent',
                color: activeTab === 'stage' ? '#a5b4fc' : '#a0aec0',
                border: activeTab === 'stage' ? '1px solid rgba(99,102,241,0.5)' : '1px solid transparent',
                borderBottom: activeTab === 'stage' ? '1px solid #1a202c' : '1px solid transparent'
              }}
            >
              <i className="bi bi-tv me-2"></i>
              {t('themes.stageMonitorThemes', 'Stage Monitor Themes')}
            </Nav.Link>
          </Nav.Item>
        </Nav>

        {/* Messages */}
        {successMessage && (
          <Alert variant="success" onClose={() => setSuccessMessage('')} dismissible>
            {successMessage}
          </Alert>
        )}
        {errorMessage && (
          <Alert variant="danger" onClose={() => setErrorMessage('')} dismissible>
            {errorMessage}
          </Alert>
        )}

        {/* VIEWER THEMES TAB */}
        {activeTab === 'viewer' && (
        <Row>
          {/* Theme List - Left Sidebar */}
          <Col lg={3} md={4}>
            <Card style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <Card.Header style={{ backgroundColor: 'transparent', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <h5 className="mb-0" style={{ color: '#e2e8f0' }}>{t('themes.yourThemes', 'Your Themes')}</h5>
              </Card.Header>
              <Card.Body style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
                {loading ? (
                  <div className="text-center py-4">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                  </div>
                ) : themes.length === 0 ? (
                  <div className="text-center py-4" style={{ color: '#a0aec0' }}>
                    <i className="bi bi-palette" style={{ fontSize: '3rem', opacity: 0.5 }}></i>
                    <p className="mt-2">{t('themes.noThemes', 'No themes yet')}</p>
                  </div>
                ) : (
                  <div className="d-flex flex-column gap-2">
                    {themes.map(theme => (
                      <div
                        key={theme.id}
                        className={`p-3 rounded cursor-pointer ${selectedTheme?.id === theme.id ? 'border-primary' : ''}`}
                        style={{
                          cursor: 'pointer',
                          backgroundColor: selectedTheme?.id === theme.id ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.03)',
                          border: selectedTheme?.id === theme.id ? '2px solid #6366f1' : '1px solid rgba(255,255,255,0.1)',
                          transition: 'all 0.2s'
                        }}
                        onClick={() => {
                          setSelectedTheme(theme);
                          setEditingTheme(initializeEditingTheme(theme));
                          setSelectedLine(null);
                        }}
                      >
                        <div className="d-flex justify-content-between align-items-start">
                          <div>
                            <div className="d-flex align-items-center gap-2 mb-1">
                              {theme.isBuiltIn && (
                                <i className="bi bi-gem" style={{ fontSize: '0.75rem', color: '#a78bfa' }} title={t('themes.builtIn', 'Built-in')}></i>
                              )}
                              {defaultThemeId === theme.id && (
                                <i className="bi bi-star-fill" style={{ fontSize: '0.8rem', color: '#fbbf24' }} title={t('themes.defaultTheme', 'Your Default Theme')}></i>
                              )}
                              <span style={{ fontWeight: '500' }}>{theme.name}</span>
                            </div>
                            {theme.isBuiltIn && (
                              <small style={{ color: '#a0aec0' }}>{t('themes.builtIn', 'Built-in')}</small>
                            )}
                            {defaultThemeId === theme.id && !theme.isBuiltIn && (
                              <small style={{ color: '#fbbf24' }}>{t('themes.default', 'Default')}</small>
                            )}
                            {defaultThemeId === theme.id && theme.isBuiltIn && (
                              <small style={{ color: '#a0aec0' }}> • <span style={{ color: '#fbbf24' }}>{t('themes.default', 'Default')}</span></small>
                            )}
                          </div>
                          <div className="d-flex gap-1">
                            {/* Duplicate button - available for all themes */}
                            <Button
                              variant="link"
                              size="sm"
                              className="p-1"
                              onClick={(e) => { e.stopPropagation(); handleDuplicateTheme(theme); }}
                              title={t('themes.duplicate', 'Duplicate')}
                            >
                              <i className="bi bi-copy" style={{ color: '#a0aec0' }}></i>
                            </Button>
                            {/* Delete button - only for user-created themes */}
                            {!theme.isBuiltIn && (
                              <Button
                                variant="link"
                                size="sm"
                                className="p-1"
                                onClick={(e) => { e.stopPropagation(); handleDeleteTheme(theme); }}
                                title={t('themes.delete', 'Delete')}
                              >
                                <i className="bi bi-trash" style={{ color: '#ef4444' }}></i>
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>

          {/* Visual Editor - Main Area */}
          <Col lg={9} md={8}>
            {!editingTheme ? (
              <Card style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', minHeight: '500px' }}>
                <Card.Body className="d-flex align-items-center justify-content-center">
                  <div className="text-center" style={{ color: '#a0aec0' }}>
                    <i className="bi bi-palette" style={{ fontSize: '4rem', opacity: 0.5 }}></i>
                    <p className="mt-3">{t('themes.selectToEdit', 'Select a theme to edit')}</p>
                  </div>
                </Card.Body>
              </Card>
            ) : (
              <Card style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <Card.Header style={{ backgroundColor: 'transparent', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
                    <div className="d-flex align-items-center gap-3">
                      {editingTheme.isBuiltIn ? (
                        <h4 className="mb-0">{editingTheme.name}</h4>
                      ) : (
                        <Form.Control
                          type="text"
                          value={editingTheme.name}
                          onChange={(e) => setEditingTheme({ ...editingTheme, name: e.target.value })}
                          style={{
                            backgroundColor: 'transparent',
                            border: 'none',
                            borderBottom: '1px solid rgba(255,255,255,0.2)',
                            color: '#e2e8f0',
                            fontSize: '1.5rem',
                            fontWeight: '500',
                            padding: '0 0 4px 0',
                            borderRadius: 0,
                            width: 'auto'
                          }}
                        />
                      )}
                      {editingTheme.isBuiltIn && (
                        <span className="badge bg-warning text-dark">{t('themes.builtIn', 'Built-in')}</span>
                      )}
                    </div>
                    <div className="d-flex gap-2">
                      {/* Set as Default button - available for all themes */}
                      <Button
                        variant={defaultThemeId === editingTheme.id ? 'warning' : 'outline-warning'}
                        size="sm"
                        onClick={() => handleSetDefault(editingTheme.id)}
                        disabled={saving}
                        title={defaultThemeId === editingTheme.id ? t('themes.clearDefault', 'Clear Default') : t('themes.setDefault', 'Set as Default')}
                      >
                        <i className={`bi ${defaultThemeId === editingTheme.id ? 'bi-star-fill' : 'bi-star'} me-1`}></i>
                        {defaultThemeId === editingTheme.id
                          ? t('themes.clearDefault', 'Clear Default')
                          : t('themes.setDefault', 'Set as Default')}
                      </Button>
                      {!editingTheme.isBuiltIn && (
                        <>
                          <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={() => handleDeleteTheme(editingTheme)}
                            disabled={saving}
                          >
                            <i className="bi bi-trash me-1"></i>
                            {t('themes.delete', 'Delete')}
                          </Button>
                          <Button
                            variant="outline-secondary"
                            size="sm"
                            onClick={handleResetPositions}
                            disabled={saving}
                          >
                            <i className="bi bi-arrow-counterclockwise me-1"></i>
                            {t('themes.resetPositions', 'Reset Positions')}
                          </Button>
                          <Button variant="primary" onClick={handleSaveTheme} disabled={saving}>
                            {saving ? (
                              <>
                                <span className="spinner-border spinner-border-sm me-2"></span>
                                {t('common.saving', 'Saving...')}
                              </>
                            ) : (
                              <>
                                <i className="bi bi-check2 me-2"></i>
                                {t('themes.save', 'Save Changes')}
                              </>
                            )}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </Card.Header>
                <Card.Body>
                  {editingTheme.isBuiltIn && (
                    <Alert variant="info" className="mb-4" style={{ backgroundColor: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: '#a5b4fc' }}>
                      <i className="bi bi-info-circle me-2"></i>
                      {t('themes.builtInInfo', 'Built-in themes cannot be edited. Duplicate this theme to customize it.')}
                      <Button
                        variant="outline-primary"
                        size="sm"
                        className="ms-3"
                        onClick={() => handleDuplicateTheme(editingTheme)}
                      >
                        <i className="bi bi-copy me-1"></i>
                        {t('themes.duplicate', 'Duplicate')}
                      </Button>
                    </Alert>
                  )}

                  {/* Resolution Selector */}
                  <div className="mb-4">
                    <Form.Label style={{ color: '#a0aec0', fontSize: '0.9rem', fontWeight: '500' }}>
                      <i className="bi bi-aspect-ratio me-2"></i>
                      {t('themes.resolution', 'Canvas Resolution')}
                    </Form.Label>
                    <ResolutionSelector
                      dimensions={editingTheme.canvasDimensions}
                      onChange={handleDimensionsChange}
                      disabled={editingTheme.isBuiltIn}
                    />
                  </div>

                  <Row>
                    {/* Canvas */}
                    <Col xl={8} lg={7} className="mb-4 mb-lg-0">
                      <ThemeCanvas
                        canvasDimensions={editingTheme.canvasDimensions}
                        linePositions={editingTheme.linePositions}
                        lineStyles={editingTheme.lineStyles}
                        lineOrder={editingTheme.lineOrder}
                        backgroundBoxes={editingTheme.backgroundBoxes}
                        selectedLine={selectedLine}
                        selectedBoxId={selectedBoxId}
                        onPositionChange={handlePositionChange}
                        onSelectLine={(line) => { setSelectedLine(line); if (line) setSelectedBoxId(null); }}
                        onBoxChange={handleBoxChange}
                        onSelectBox={(boxId) => { setSelectedBoxId(boxId); if (boxId) setSelectedLine(null); }}
                        onDeleteBox={handleDeleteBox}
                        viewerBackground={editingTheme.viewerBackground}
                        disabled={editingTheme.isBuiltIn}
                      />
                    </Col>

                    {/* Properties Panel */}
                    <Col xl={4} lg={5}>
                      <PropertiesPanel
                        selectedLine={selectedLine}
                        lineStyle={selectedLine ? editingTheme.lineStyles?.[selectedLine] : null}
                        linePosition={selectedLine ? editingTheme.linePositions?.[selectedLine] : null}
                        onStyleChange={handleStyleChange}
                        onPositionChange={handlePositionFieldChange}
                        disabled={editingTheme.isBuiltIn}
                      />

                      {/* Background Boxes Panel */}
                      <div className="mt-3">
                        <BoxPropertiesPanel
                          box={selectedBoxId ? (editingTheme.backgroundBoxes || []).find(b => b.id === selectedBoxId) : null}
                          boxCount={(editingTheme.backgroundBoxes || []).length}
                          onBoxChange={handleBoxChange}
                          onAddBox={handleAddBox}
                          onDeleteBox={handleDeleteBox}
                          disabled={editingTheme.isBuiltIn}
                        />
                      </div>

                      {/* Background Type Selector */}
                      <Card className="mt-3" style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <Card.Header style={{ backgroundColor: 'transparent', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                          <div className="d-flex align-items-center gap-2">
                            <i className="bi bi-image" style={{ color: '#a5b4fc' }}></i>
                            <span style={{ color: '#e2e8f0', fontWeight: '500' }}>
                              {t('themes.background', 'Viewer Background')}
                            </span>
                          </div>
                        </Card.Header>
                        <Card.Body>
                          <Form.Select
                            value={editingTheme.viewerBackground?.type || 'inherit'}
                            onChange={(e) => setEditingTheme({
                              ...editingTheme,
                              viewerBackground: {
                                ...editingTheme.viewerBackground,
                                type: e.target.value
                              }
                            })}
                            disabled={editingTheme.isBuiltIn}
                            style={{
                              backgroundColor: '#2d3748',
                              color: '#e2e8f0',
                              border: '1px solid rgba(255,255,255,0.1)'
                            }}
                          >
                            <option value="inherit">{t('themes.bgInherit', 'Inherit from Room')}</option>
                            <option value="color">{t('themes.bgColor', 'Solid Color')}</option>
                            <option value="transparent">{t('themes.bgTransparent', 'Transparent (OBS)')}</option>
                          </Form.Select>

                          {editingTheme.viewerBackground?.type === 'color' && (
                            <div className="mt-3 d-flex align-items-center gap-2">
                              <Form.Control
                                type="color"
                                value={editingTheme.viewerBackground?.color || '#000000'}
                                onChange={(e) => setEditingTheme({
                                  ...editingTheme,
                                  viewerBackground: {
                                    ...editingTheme.viewerBackground,
                                    color: e.target.value
                                  }
                                })}
                                disabled={editingTheme.isBuiltIn}
                                style={{ width: '50px', height: '38px' }}
                              />
                              <Form.Control
                                type="text"
                                value={editingTheme.viewerBackground?.color || '#000000'}
                                onChange={(e) => setEditingTheme({
                                  ...editingTheme,
                                  viewerBackground: {
                                    ...editingTheme.viewerBackground,
                                    color: e.target.value
                                  }
                                })}
                                disabled={editingTheme.isBuiltIn}
                                style={{
                                  backgroundColor: '#2d3748',
                                  color: '#e2e8f0',
                                  border: '1px solid rgba(255,255,255,0.1)'
                                }}
                              />
                            </div>
                          )}
                        </Card.Body>
                      </Card>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
            )}
          </Col>
        </Row>
        )}

        {/* STAGE MONITOR THEMES TAB */}
        {activeTab === 'stage' && (
        <Row>
          {/* Stage Theme List - Left Sidebar */}
          <Col lg={3} md={4}>
            <Card style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <Card.Header style={{ backgroundColor: 'transparent', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <h5 className="mb-0" style={{ color: '#e2e8f0' }}>{t('stageMonitorThemes.yourThemes', 'Your Stage Themes')}</h5>
              </Card.Header>
              <Card.Body style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
                {stageLoading ? (
                  <div className="text-center py-4">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                  </div>
                ) : stageThemes.length === 0 ? (
                  <div className="text-center py-4" style={{ color: '#a0aec0' }}>
                    <i className="bi bi-tv" style={{ fontSize: '3rem', opacity: 0.5 }}></i>
                    <p className="mt-2">{t('stageMonitorThemes.noThemes', 'No stage monitor themes yet')}</p>
                  </div>
                ) : (
                  <div className="d-flex flex-column gap-2">
                    {stageThemes.map(theme => (
                      <div
                        key={theme.id}
                        className={`p-3 rounded cursor-pointer ${selectedStageTheme?.id === theme.id ? 'border-primary' : ''}`}
                        style={{
                          cursor: 'pointer',
                          backgroundColor: selectedStageTheme?.id === theme.id ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.03)',
                          border: selectedStageTheme?.id === theme.id ? '2px solid #6366f1' : '1px solid rgba(255,255,255,0.1)',
                          transition: 'all 0.2s'
                        }}
                        onClick={() => {
                          setSelectedStageTheme(theme);
                          setEditingStageTheme(initializeEditingStageTheme(theme));
                          setSelectedStageElement(null);
                        }}
                      >
                        <div className="d-flex justify-content-between align-items-start">
                          <div>
                            <div className="d-flex align-items-center gap-2 mb-1">
                              {theme.isBuiltIn && (
                                <i className="bi bi-gem" style={{ fontSize: '0.75rem', color: '#a78bfa' }} title={t('stageMonitorThemes.builtIn', 'Built-in')}></i>
                              )}
                              {defaultStageThemeId === theme.id && (
                                <i className="bi bi-star-fill" style={{ fontSize: '0.8rem', color: '#fbbf24' }} title={t('stageMonitorThemes.defaultTheme', 'Your Default Theme')}></i>
                              )}
                              <span style={{ fontWeight: '500' }}>{theme.name}</span>
                            </div>
                            {theme.isBuiltIn && (
                              <small style={{ color: '#a0aec0' }}>{t('stageMonitorThemes.builtIn', 'Built-in')}</small>
                            )}
                            {defaultStageThemeId === theme.id && !theme.isBuiltIn && (
                              <small style={{ color: '#fbbf24' }}>{t('stageMonitorThemes.default', 'Default')}</small>
                            )}
                            {defaultStageThemeId === theme.id && theme.isBuiltIn && (
                              <small style={{ color: '#a0aec0' }}> • <span style={{ color: '#fbbf24' }}>{t('stageMonitorThemes.default', 'Default')}</span></small>
                            )}
                          </div>
                          <div className="d-flex gap-1">
                            <Button
                              variant="link"
                              size="sm"
                              className="p-1"
                              onClick={(e) => { e.stopPropagation(); handleDuplicateStageTheme(theme); }}
                              title={t('stageMonitorThemes.duplicate', 'Duplicate')}
                            >
                              <i className="bi bi-copy" style={{ color: '#a0aec0' }}></i>
                            </Button>
                            {!theme.isBuiltIn && (
                              <Button
                                variant="link"
                                size="sm"
                                className="p-1"
                                onClick={(e) => { e.stopPropagation(); handleDeleteStageTheme(theme); }}
                                title={t('stageMonitorThemes.delete', 'Delete')}
                              >
                                <i className="bi bi-trash" style={{ color: '#ef4444' }}></i>
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>

          {/* Stage Monitor Visual Editor - Main Area */}
          <Col lg={9} md={8}>
            {!editingStageTheme ? (
              <Card style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', minHeight: '500px' }}>
                <Card.Body className="d-flex align-items-center justify-content-center">
                  <div className="text-center" style={{ color: '#a0aec0' }}>
                    <i className="bi bi-tv" style={{ fontSize: '4rem', opacity: 0.5 }}></i>
                    <p className="mt-3">{t('stageMonitorThemes.selectToEdit', 'Select a stage monitor theme to edit')}</p>
                  </div>
                </Card.Body>
              </Card>
            ) : (
              <Card style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <Card.Header style={{ backgroundColor: 'transparent', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
                    <div className="d-flex align-items-center gap-3">
                      {editingStageTheme.isBuiltIn ? (
                        <h4 className="mb-0">{editingStageTheme.name}</h4>
                      ) : (
                        <Form.Control
                          type="text"
                          value={editingStageTheme.name}
                          onChange={(e) => setEditingStageTheme({ ...editingStageTheme, name: e.target.value })}
                          style={{
                            backgroundColor: 'transparent',
                            border: 'none',
                            borderBottom: '1px solid rgba(255,255,255,0.2)',
                            color: '#e2e8f0',
                            fontSize: '1.5rem',
                            fontWeight: '500',
                            padding: '0 0 4px 0',
                            borderRadius: 0,
                            width: 'auto'
                          }}
                        />
                      )}
                      {editingStageTheme.isBuiltIn && (
                        <span className="badge bg-warning text-dark">{t('stageMonitorThemes.builtIn', 'Built-in')}</span>
                      )}
                    </div>
                    <div className="d-flex gap-2">
                      <Button
                        variant={defaultStageThemeId === editingStageTheme.id ? 'warning' : 'outline-warning'}
                        size="sm"
                        onClick={() => handleSetDefaultStageTheme(editingStageTheme.id)}
                        disabled={saving}
                        title={defaultStageThemeId === editingStageTheme.id ? t('stageMonitorThemes.clearDefault', 'Clear Default') : t('stageMonitorThemes.setDefault', 'Set as Default')}
                      >
                        <i className={`bi ${defaultStageThemeId === editingStageTheme.id ? 'bi-star-fill' : 'bi-star'} me-1`}></i>
                        {defaultStageThemeId === editingStageTheme.id
                          ? t('stageMonitorThemes.clearDefault', 'Clear Default')
                          : t('stageMonitorThemes.setDefault', 'Set as Default')}
                      </Button>
                      {!editingStageTheme.isBuiltIn && (
                        <>
                          <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={() => handleDeleteStageTheme(editingStageTheme)}
                            disabled={saving}
                          >
                            <i className="bi bi-trash me-1"></i>
                            {t('stageMonitorThemes.delete', 'Delete')}
                          </Button>
                          <Button variant="primary" onClick={handleSaveStageTheme} disabled={saving}>
                            {saving ? (
                              <>
                                <span className="spinner-border spinner-border-sm me-2"></span>
                                {t('common.saving', 'Saving...')}
                              </>
                            ) : (
                              <>
                                <i className="bi bi-check2 me-2"></i>
                                {t('stageMonitorThemes.save', 'Save Changes')}
                              </>
                            )}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </Card.Header>
                <Card.Body>
                  {editingStageTheme.isBuiltIn && (
                    <Alert variant="info" className="mb-4" style={{ backgroundColor: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: '#a5b4fc' }}>
                      <i className="bi bi-info-circle me-2"></i>
                      {t('stageMonitorThemes.builtInInfo', 'Built-in themes cannot be edited. Duplicate this theme to customize it.')}
                      <Button
                        variant="outline-primary"
                        size="sm"
                        className="ms-3"
                        onClick={() => handleDuplicateStageTheme(editingStageTheme)}
                      >
                        <i className="bi bi-copy me-1"></i>
                        {t('stageMonitorThemes.duplicate', 'Duplicate')}
                      </Button>
                    </Alert>
                  )}

                  {/* Resolution Selector */}
                  <div className="mb-4">
                    <Form.Label style={{ color: '#a0aec0', fontSize: '0.9rem', fontWeight: '500' }}>
                      <i className="bi bi-aspect-ratio me-2"></i>
                      {t('stageMonitorThemes.resolution', 'Canvas Resolution')}
                    </Form.Label>
                    <ResolutionSelector
                      dimensions={editingStageTheme.canvasDimensions}
                      onChange={handleStageDimensionsChange}
                      disabled={editingStageTheme.isBuiltIn}
                    />
                  </div>

                  <Row>
                    {/* Stage Monitor Canvas */}
                    <Col xl={8} lg={7} className="mb-4 mb-lg-0">
                      <StageMonitorCanvas
                        canvasDimensions={editingStageTheme.canvasDimensions || { width: 1920, height: 1080 }}
                        colors={editingStageTheme.colors}
                        header={editingStageTheme.header}
                        clock={editingStageTheme.clock}
                        songTitle={editingStageTheme.songTitle}
                        currentSlideArea={editingStageTheme.currentSlideArea}
                        currentSlideText={editingStageTheme.currentSlideText}
                        nextSlideArea={editingStageTheme.nextSlideArea}
                        selectedElement={selectedStageElement}
                        onSelectElement={setSelectedStageElement}
                        onElementChange={handleStageElementChange}
                        disabled={editingStageTheme.isBuiltIn}
                      />
                    </Col>

                    {/* Stage Monitor Properties Panel */}
                    <Col xl={4} lg={5}>
                      <StageMonitorPropertiesPanel
                        selectedElement={selectedStageElement}
                        theme={editingStageTheme}
                        onPropertyChange={handleStagePropertyChange}
                        disabled={editingStageTheme.isBuiltIn}
                      />

                      <div className="mt-3">
                        <StageMonitorColorPanel
                          colors={editingStageTheme.colors}
                          onColorsChange={handleStageColorsChange}
                          disabled={editingStageTheme.isBuiltIn}
                        />
                      </div>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
            )}
          </Col>
        </Row>
        )}
      </Container>

      {/* Theme Name Modal */}
      <Modal show={showNameModal} onHide={() => setShowNameModal(false)} centered>
        <Modal.Header closeButton style={{ backgroundColor: '#2d3748', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <Modal.Title style={{ color: '#e2e8f0' }}>
            {nameModalMode === 'create' && t('themes.createNew', 'New Theme')}
            {nameModalMode === 'duplicate' && t('themes.duplicate', 'Duplicate Theme')}
            {nameModalMode === 'create-stage' && t('stageMonitorThemes.createNew', 'New Stage Monitor Theme')}
            {nameModalMode === 'duplicate-stage' && t('stageMonitorThemes.duplicate', 'Duplicate Stage Monitor Theme')}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ backgroundColor: '#2d3748' }}>
          <Form onSubmit={(e) => {
            e.preventDefault();
            if (nameModalMode === 'create') handleSubmitCreateTheme();
            else if (nameModalMode === 'duplicate') handleSubmitDuplicateTheme();
            else if (nameModalMode === 'create-stage') handleSubmitCreateStageTheme();
            else if (nameModalMode === 'duplicate-stage') handleSubmitDuplicateStageTheme();
          }}>
            <Form.Group>
              <Form.Label style={{ color: '#e2e8f0' }}>
                {t('themes.themeName', 'Theme Name')}
              </Form.Label>
              <Form.Control
                type="text"
                value={themeName}
                onChange={(e) => setThemeName(e.target.value)}
                placeholder={t('themes.enterName', 'Enter theme name')}
                autoFocus
                style={{
                  backgroundColor: '#1a202c',
                  color: '#e2e8f0',
                  border: '1px solid rgba(255,255,255,0.2)'
                }}
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer style={{ backgroundColor: '#2d3748', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <Button variant="secondary" onClick={() => setShowNameModal(false)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              if (nameModalMode === 'create') handleSubmitCreateTheme();
              else if (nameModalMode === 'duplicate') handleSubmitDuplicateTheme();
              else if (nameModalMode === 'create-stage') handleSubmitCreateStageTheme();
              else if (nameModalMode === 'duplicate-stage') handleSubmitDuplicateStageTheme();
            }}
            disabled={!themeName.trim() || saving}
          >
            {saving ? t('common.saving', 'Saving...') : t('common.create', 'Create')}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default Themes;
