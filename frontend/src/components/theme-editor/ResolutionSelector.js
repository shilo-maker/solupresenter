import React, { useState } from 'react';
import { Button, Form, InputGroup } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';

const PRESETS = [
  { label: '1080p', width: 1920, height: 1080 },
  { label: '720p', width: 1280, height: 720 },
  { label: '768p', width: 1024, height: 768 }
];

const ResolutionSelector = ({
  dimensions, // { width, height }
  onChange, // (dimensions) => void
  disabled
}) => {
  const { t } = useTranslation();
  const [showCustom, setShowCustom] = useState(false);
  const [customWidth, setCustomWidth] = useState(dimensions?.width || 1920);
  const [customHeight, setCustomHeight] = useState(dimensions?.height || 1080);

  // Check if current dimensions match a preset
  const currentPreset = PRESETS.find(
    (p) => p.width === dimensions?.width && p.height === dimensions?.height
  );

  const handlePresetClick = (preset) => {
    setShowCustom(false);
    onChange({ width: preset.width, height: preset.height });
  };

  const handleCustomApply = () => {
    const width = Math.max(640, Math.min(3840, parseInt(customWidth) || 1920));
    const height = Math.max(360, Math.min(2160, parseInt(customHeight) || 1080));
    onChange({ width, height });
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}
    >
      {/* Preset buttons */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {PRESETS.map((preset) => (
          <Button
            key={preset.label}
            variant={
              !showCustom && currentPreset?.label === preset.label
                ? 'primary'
                : 'outline-secondary'
            }
            size="sm"
            onClick={() => handlePresetClick(preset)}
            disabled={disabled}
          >
            {preset.label}
            <span
              style={{
                fontSize: '0.75rem',
                opacity: 0.7,
                marginLeft: '4px'
              }}
            >
              ({preset.width}x{preset.height})
            </span>
          </Button>
        ))}
        <Button
          variant={showCustom || !currentPreset ? 'primary' : 'outline-secondary'}
          size="sm"
          onClick={() => setShowCustom(true)}
          disabled={disabled}
        >
          {t('themes.customSize', 'Custom')}
        </Button>
      </div>

      {/* Custom size inputs */}
      {(showCustom || !currentPreset) && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <InputGroup size="sm" style={{ width: '120px' }}>
            <Form.Control
              type="number"
              placeholder="Width"
              value={customWidth}
              onChange={(e) => setCustomWidth(e.target.value)}
              disabled={disabled}
              style={{
                backgroundColor: '#2d3748',
                color: '#e2e8f0',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}
            />
          </InputGroup>
          <span style={{ color: 'rgba(255, 255, 255, 0.5)' }}>×</span>
          <InputGroup size="sm" style={{ width: '120px' }}>
            <Form.Control
              type="number"
              placeholder="Height"
              value={customHeight}
              onChange={(e) => setCustomHeight(e.target.value)}
              disabled={disabled}
              style={{
                backgroundColor: '#2d3748',
                color: '#e2e8f0',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}
            />
          </InputGroup>
          <Button
            variant="outline-primary"
            size="sm"
            onClick={handleCustomApply}
            disabled={disabled}
          >
            {t('common.apply', 'Apply')}
          </Button>
        </div>
      )}
    </div>
  );
};

export default ResolutionSelector;
