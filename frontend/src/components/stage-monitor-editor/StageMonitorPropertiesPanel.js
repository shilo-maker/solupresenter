import React from 'react';
import { Card, Form, Button } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';

const StageMonitorPropertiesPanel = ({
  selectedElement,
  theme, // Full theme object
  onThemeChange,
  disabled
}) => {
  const { t } = useTranslation();

  if (!selectedElement || !theme) {
    return (
      <Card style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <Card.Body className="text-center py-5" style={{ color: '#a0aec0' }}>
          <i className="bi bi-hand-index" style={{ fontSize: '2rem', opacity: 0.5 }}></i>
          <p className="mt-2 mb-0">{t('stageMonitorThemes.selectElement', 'Click an element to edit')}</p>
        </Card.Body>
      </Card>
    );
  }

  // Helper to update nested properties
  const updateProperty = (section, field, value) => {
    onThemeChange({
      ...theme,
      [section]: {
        ...theme[section],
        [field]: value
      }
    });
  };

  // Render different properties based on selected element
  const renderProperties = () => {
    switch (selectedElement) {
      case 'header':
        return renderHeaderProperties();
      case 'clock':
        return renderClockProperties();
      case 'songTitle':
        return renderSongTitleProperties();
      case 'currentSlide':
        return renderCurrentSlideProperties();
      case 'nextSlide':
        return renderNextSlideProperties();
      default:
        return null;
    }
  };

  const renderHeaderProperties = () => (
    <>
      <Form.Group className="mb-3">
        <Form.Check
          type="switch"
          label={t('common.visible', 'Visible')}
          checked={theme.header?.visible !== false}
          onChange={(e) => updateProperty('header', 'visible', e.target.checked)}
          disabled={disabled}
        />
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label style={{ color: '#a0aec0' }}>{t('stageMonitorThemes.backgroundColor', 'Background Color')}</Form.Label>
        <div className="d-flex gap-2">
          <Form.Control
            type="color"
            value={theme.header?.backgroundColor === 'transparent' ? '#000000' : (theme.header?.backgroundColor || '#000000')}
            onChange={(e) => updateProperty('header', 'backgroundColor', e.target.value)}
            disabled={disabled}
            style={{ width: '50px', height: '38px' }}
          />
          <Button
            variant={theme.header?.backgroundColor === 'transparent' ? 'primary' : 'outline-secondary'}
            size="sm"
            onClick={() => updateProperty('header', 'backgroundColor', 'transparent')}
            disabled={disabled}
          >
            {t('common.transparent', 'Transparent')}
          </Button>
        </div>
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label style={{ color: '#a0aec0' }}>{t('stageMonitorThemes.borderColor', 'Border Color')}</Form.Label>
        <Form.Control
          type="color"
          value={theme.header?.borderColor || '#333333'}
          onChange={(e) => updateProperty('header', 'borderColor', e.target.value)}
          disabled={disabled}
          style={{ width: '50px', height: '38px' }}
        />
      </Form.Group>
    </>
  );

  const renderClockProperties = () => (
    <>
      <Form.Group className="mb-3">
        <Form.Check
          type="switch"
          label={t('common.visible', 'Visible')}
          checked={theme.clock?.visible !== false}
          onChange={(e) => updateProperty('clock', 'visible', e.target.checked)}
          disabled={disabled}
        />
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label style={{ color: '#a0aec0' }}>{t('stageMonitorThemes.textColor', 'Text Color')}</Form.Label>
        <Form.Control
          type="color"
          value={theme.clock?.color || '#ffffff'}
          onChange={(e) => updateProperty('clock', 'color', e.target.value)}
          disabled={disabled}
          style={{ width: '50px', height: '38px' }}
        />
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label style={{ color: '#a0aec0' }}>{t('stageMonitorThemes.fontSize', 'Font Size')} ({theme.clock?.fontSize || 100}%)</Form.Label>
        <Form.Range
          min={50}
          max={150}
          value={theme.clock?.fontSize || 100}
          onChange={(e) => updateProperty('clock', 'fontSize', parseInt(e.target.value))}
          disabled={disabled}
        />
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label style={{ color: '#a0aec0' }}>{t('stageMonitorThemes.fontFamily', 'Font Family')}</Form.Label>
        <Form.Select
          value={theme.clock?.fontFamily || 'monospace'}
          onChange={(e) => updateProperty('clock', 'fontFamily', e.target.value)}
          disabled={disabled}
          style={{ backgroundColor: '#2d3748', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <option value="monospace">Monospace</option>
          <option value="system-ui, sans-serif">System UI</option>
          <option value="serif">Serif</option>
        </Form.Select>
      </Form.Group>
    </>
  );

  const renderSongTitleProperties = () => (
    <>
      <Form.Group className="mb-3">
        <Form.Check
          type="switch"
          label={t('common.visible', 'Visible')}
          checked={theme.songTitle?.visible !== false}
          onChange={(e) => updateProperty('songTitle', 'visible', e.target.checked)}
          disabled={disabled}
        />
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label style={{ color: '#a0aec0' }}>{t('stageMonitorThemes.textColor', 'Text Color')}</Form.Label>
        <Form.Control
          type="color"
          value={theme.songTitle?.color || '#4a90d9'}
          onChange={(e) => updateProperty('songTitle', 'color', e.target.value)}
          disabled={disabled}
          style={{ width: '50px', height: '38px' }}
        />
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label style={{ color: '#a0aec0' }}>{t('stageMonitorThemes.fontSize', 'Font Size')} ({theme.songTitle?.fontSize || 100}%)</Form.Label>
        <Form.Range
          min={50}
          max={150}
          value={theme.songTitle?.fontSize || 100}
          onChange={(e) => updateProperty('songTitle', 'fontSize', parseInt(e.target.value))}
          disabled={disabled}
        />
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label style={{ color: '#a0aec0' }}>{t('stageMonitorThemes.fontWeight', 'Font Weight')}</Form.Label>
        <Form.Select
          value={theme.songTitle?.fontWeight || '600'}
          onChange={(e) => updateProperty('songTitle', 'fontWeight', e.target.value)}
          disabled={disabled}
          style={{ backgroundColor: '#2d3748', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <option value="400">Normal</option>
          <option value="500">Medium</option>
          <option value="600">Semi-Bold</option>
          <option value="700">Bold</option>
        </Form.Select>
      </Form.Group>
    </>
  );

  const renderCurrentSlideProperties = () => (
    <>
      <Form.Group className="mb-3">
        <Form.Label style={{ color: '#a0aec0' }}>{t('stageMonitorThemes.backgroundColor', 'Background Color')}</Form.Label>
        <Form.Control
          type="color"
          value={theme.currentSlideArea?.backgroundColor?.startsWith('rgba') ? '#1a1a1a' : (theme.currentSlideArea?.backgroundColor || '#1a1a1a')}
          onChange={(e) => updateProperty('currentSlideArea', 'backgroundColor', e.target.value)}
          disabled={disabled}
          style={{ width: '50px', height: '38px' }}
        />
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label style={{ color: '#a0aec0' }}>{t('stageMonitorThemes.borderRadius', 'Border Radius')} ({theme.currentSlideArea?.borderRadius || 12}px)</Form.Label>
        <Form.Range
          min={0}
          max={50}
          value={theme.currentSlideArea?.borderRadius || 12}
          onChange={(e) => updateProperty('currentSlideArea', 'borderRadius', parseInt(e.target.value))}
          disabled={disabled}
        />
      </Form.Group>

      <hr style={{ borderColor: 'rgba(255,255,255,0.1)' }} />
      <h6 style={{ color: '#e2e8f0' }}>{t('stageMonitorThemes.textStyles', 'Text Styles')}</h6>

      {/* Original text */}
      <div className="mb-3 p-2" style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '4px' }}>
        <div className="d-flex justify-content-between align-items-center mb-2">
          <span style={{ color: '#a0aec0', fontSize: '0.9rem' }}>{t('stageMonitorThemes.original', 'Original')}</span>
          <Form.Check
            type="switch"
            checked={theme.currentSlideText?.original?.visible !== false}
            onChange={(e) => onThemeChange({
              ...theme,
              currentSlideText: {
                ...theme.currentSlideText,
                original: { ...theme.currentSlideText?.original, visible: e.target.checked }
              }
            })}
            disabled={disabled}
          />
        </div>
        <div className="d-flex gap-2 align-items-center">
          <Form.Control
            type="color"
            value={theme.currentSlideText?.original?.color || '#ffffff'}
            onChange={(e) => onThemeChange({
              ...theme,
              currentSlideText: {
                ...theme.currentSlideText,
                original: { ...theme.currentSlideText?.original, color: e.target.value }
              }
            })}
            disabled={disabled}
            style={{ width: '40px', height: '30px' }}
          />
          <Form.Range
            min={50}
            max={150}
            value={theme.currentSlideText?.original?.fontSize || 100}
            onChange={(e) => onThemeChange({
              ...theme,
              currentSlideText: {
                ...theme.currentSlideText,
                original: { ...theme.currentSlideText?.original, fontSize: parseInt(e.target.value) }
              }
            })}
            disabled={disabled}
            style={{ flex: 1 }}
            title={`${theme.currentSlideText?.original?.fontSize || 100}%`}
          />
        </div>
      </div>

      {/* Transliteration text */}
      <div className="mb-3 p-2" style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '4px' }}>
        <div className="d-flex justify-content-between align-items-center mb-2">
          <span style={{ color: '#a0aec0', fontSize: '0.9rem' }}>{t('stageMonitorThemes.transliteration', 'Transliteration')}</span>
          <Form.Check
            type="switch"
            checked={theme.currentSlideText?.transliteration?.visible !== false}
            onChange={(e) => onThemeChange({
              ...theme,
              currentSlideText: {
                ...theme.currentSlideText,
                transliteration: { ...theme.currentSlideText?.transliteration, visible: e.target.checked }
              }
            })}
            disabled={disabled}
          />
        </div>
        <div className="d-flex gap-2 align-items-center">
          <Form.Control
            type="color"
            value={theme.currentSlideText?.transliteration?.color || '#888888'}
            onChange={(e) => onThemeChange({
              ...theme,
              currentSlideText: {
                ...theme.currentSlideText,
                transliteration: { ...theme.currentSlideText?.transliteration, color: e.target.value }
              }
            })}
            disabled={disabled}
            style={{ width: '40px', height: '30px' }}
          />
          <Form.Range
            min={50}
            max={150}
            value={theme.currentSlideText?.transliteration?.fontSize || 80}
            onChange={(e) => onThemeChange({
              ...theme,
              currentSlideText: {
                ...theme.currentSlideText,
                transliteration: { ...theme.currentSlideText?.transliteration, fontSize: parseInt(e.target.value) }
              }
            })}
            disabled={disabled}
            style={{ flex: 1 }}
            title={`${theme.currentSlideText?.transliteration?.fontSize || 80}%`}
          />
        </div>
      </div>

      {/* Translation text */}
      <div className="mb-3 p-2" style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '4px' }}>
        <div className="d-flex justify-content-between align-items-center mb-2">
          <span style={{ color: '#a0aec0', fontSize: '0.9rem' }}>{t('stageMonitorThemes.translation', 'Translation')}</span>
          <Form.Check
            type="switch"
            checked={theme.currentSlideText?.translation?.visible !== false}
            onChange={(e) => onThemeChange({
              ...theme,
              currentSlideText: {
                ...theme.currentSlideText,
                translation: { ...theme.currentSlideText?.translation, visible: e.target.checked }
              }
            })}
            disabled={disabled}
          />
        </div>
        <div className="d-flex gap-2 align-items-center">
          <Form.Control
            type="color"
            value={theme.currentSlideText?.translation?.color || '#ffffff'}
            onChange={(e) => onThemeChange({
              ...theme,
              currentSlideText: {
                ...theme.currentSlideText,
                translation: { ...theme.currentSlideText?.translation, color: e.target.value }
              }
            })}
            disabled={disabled}
            style={{ width: '40px', height: '30px' }}
          />
          <Form.Range
            min={50}
            max={150}
            value={theme.currentSlideText?.translation?.fontSize || 80}
            onChange={(e) => onThemeChange({
              ...theme,
              currentSlideText: {
                ...theme.currentSlideText,
                translation: { ...theme.currentSlideText?.translation, fontSize: parseInt(e.target.value) }
              }
            })}
            disabled={disabled}
            style={{ flex: 1 }}
            title={`${theme.currentSlideText?.translation?.fontSize || 80}%`}
          />
        </div>
      </div>
    </>
  );

  const renderNextSlideProperties = () => (
    <>
      <Form.Group className="mb-3">
        <Form.Check
          type="switch"
          label={t('common.visible', 'Visible')}
          checked={theme.nextSlideArea?.visible !== false}
          onChange={(e) => updateProperty('nextSlideArea', 'visible', e.target.checked)}
          disabled={disabled}
        />
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label style={{ color: '#a0aec0' }}>{t('stageMonitorThemes.backgroundColor', 'Background Color')}</Form.Label>
        <Form.Control
          type="color"
          value={theme.nextSlideArea?.backgroundColor || '#1a1a1a'}
          onChange={(e) => updateProperty('nextSlideArea', 'backgroundColor', e.target.value)}
          disabled={disabled}
          style={{ width: '50px', height: '38px' }}
        />
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label style={{ color: '#a0aec0' }}>{t('stageMonitorThemes.borderRadius', 'Border Radius')} ({theme.nextSlideArea?.borderRadius || 8}px)</Form.Label>
        <Form.Range
          min={0}
          max={50}
          value={theme.nextSlideArea?.borderRadius || 8}
          onChange={(e) => updateProperty('nextSlideArea', 'borderRadius', parseInt(e.target.value))}
          disabled={disabled}
        />
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label style={{ color: '#a0aec0' }}>{t('stageMonitorThemes.opacity', 'Opacity')} ({Math.round((theme.nextSlideArea?.opacity ?? 0.8) * 100)}%)</Form.Label>
        <Form.Range
          min={0}
          max={100}
          value={(theme.nextSlideArea?.opacity ?? 0.8) * 100}
          onChange={(e) => updateProperty('nextSlideArea', 'opacity', parseInt(e.target.value) / 100)}
          disabled={disabled}
        />
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label style={{ color: '#a0aec0' }}>{t('stageMonitorThemes.labelText', 'Label Text')}</Form.Label>
        <Form.Control
          type="text"
          value={theme.nextSlideArea?.labelText || 'Next'}
          onChange={(e) => updateProperty('nextSlideArea', 'labelText', e.target.value)}
          disabled={disabled}
          style={{ backgroundColor: '#2d3748', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.1)' }}
        />
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label style={{ color: '#a0aec0' }}>{t('stageMonitorThemes.labelColor', 'Label Color')}</Form.Label>
        <Form.Control
          type="color"
          value={theme.nextSlideArea?.labelColor || '#888888'}
          onChange={(e) => updateProperty('nextSlideArea', 'labelColor', e.target.value)}
          disabled={disabled}
          style={{ width: '50px', height: '38px' }}
        />
      </Form.Group>
    </>
  );

  const elementLabels = {
    header: t('stageMonitorThemes.elements.header', 'Header Bar'),
    clock: t('stageMonitorThemes.elements.clock', 'Clock'),
    songTitle: t('stageMonitorThemes.elements.songTitle', 'Song Title'),
    currentSlide: t('stageMonitorThemes.elements.currentSlide', 'Current Slide'),
    nextSlide: t('stageMonitorThemes.elements.nextSlide', 'Next Preview')
  };

  return (
    <Card style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
      <Card.Header style={{ backgroundColor: 'transparent', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="d-flex align-items-center gap-2">
          <i className="bi bi-sliders" style={{ color: '#a5b4fc' }}></i>
          <span style={{ color: '#e2e8f0', fontWeight: '500' }}>
            {elementLabels[selectedElement]}
          </span>
        </div>
      </Card.Header>
      <Card.Body style={{ maxHeight: '400px', overflowY: 'auto' }}>
        {renderProperties()}
      </Card.Body>
    </Card>
  );
};

export default StageMonitorPropertiesPanel;
