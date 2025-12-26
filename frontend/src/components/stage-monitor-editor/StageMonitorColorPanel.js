import React from 'react';
import { Card, Form } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';

const StageMonitorColorPanel = ({
  colors, // { background, text, accent, secondary, border }
  onColorsChange,
  disabled
}) => {
  const { t } = useTranslation();

  const handleColorChange = (field, value) => {
    onColorsChange({
      ...colors,
      [field]: value
    });
  };

  const colorFields = [
    { key: 'background', label: t('stageMonitorThemes.colors.background', 'Background'), default: '#0a0a0a' },
    { key: 'text', label: t('stageMonitorThemes.colors.text', 'Text'), default: '#ffffff' },
    { key: 'accent', label: t('stageMonitorThemes.colors.accent', 'Accent'), default: '#4a90d9' },
    { key: 'secondary', label: t('stageMonitorThemes.colors.secondary', 'Secondary'), default: '#888888' },
    { key: 'border', label: t('stageMonitorThemes.colors.border', 'Border'), default: '#333333' }
  ];

  return (
    <Card style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
      <Card.Header style={{ backgroundColor: 'transparent', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="d-flex align-items-center gap-2">
          <i className="bi bi-palette" style={{ color: '#a5b4fc' }}></i>
          <span style={{ color: '#e2e8f0', fontWeight: '500' }}>
            {t('stageMonitorThemes.themeColors', 'Theme Colors')}
          </span>
        </div>
      </Card.Header>
      <Card.Body>
        {colorFields.map(({ key, label, default: defaultValue }) => (
          <Form.Group key={key} className="mb-3">
            <div className="d-flex justify-content-between align-items-center">
              <Form.Label style={{ color: '#a0aec0', marginBottom: 0 }}>{label}</Form.Label>
              <div className="d-flex align-items-center gap-2">
                <Form.Control
                  type="color"
                  value={colors?.[key] || defaultValue}
                  onChange={(e) => handleColorChange(key, e.target.value)}
                  disabled={disabled}
                  style={{ width: '40px', height: '30px', padding: '2px' }}
                />
                <Form.Control
                  type="text"
                  value={colors?.[key] || defaultValue}
                  onChange={(e) => handleColorChange(key, e.target.value)}
                  disabled={disabled}
                  style={{
                    width: '80px',
                    backgroundColor: '#2d3748',
                    color: '#e2e8f0',
                    border: '1px solid rgba(255,255,255,0.1)',
                    fontSize: '0.85rem'
                  }}
                />
              </div>
            </div>
          </Form.Group>
        ))}
      </Card.Body>
    </Card>
  );
};

export default StageMonitorColorPanel;
