import React, { useState } from 'react';
import { CanvasDimensions } from './ThemeCanvas';

interface ResolutionSelectorProps {
  dimensions: CanvasDimensions;
  onChange: (dimensions: CanvasDimensions) => void;
}

interface PresetResolution {
  label: string;
  width: number;
  height: number;
  description: string;
}

const PRESET_RESOLUTIONS: PresetResolution[] = [
  { label: '1080p', width: 1920, height: 1080, description: 'Full HD (16:9)' },
  { label: '720p', width: 1280, height: 720, description: 'HD (16:9)' },
  { label: '4K', width: 3840, height: 2160, description: 'Ultra HD (16:9)' },
  { label: '1080p Vertical', width: 1080, height: 1920, description: 'Full HD Portrait (9:16)' },
  { label: '4:3', width: 1440, height: 1080, description: 'Standard (4:3)' },
  { label: 'Square', width: 1080, height: 1080, description: 'Square (1:1)' }
];

const ResolutionSelector: React.FC<ResolutionSelectorProps> = ({
  dimensions,
  onChange
}) => {
  const [isCustom, setIsCustom] = useState(false);
  const [customWidth, setCustomWidth] = useState(dimensions.width);
  const [customHeight, setCustomHeight] = useState(dimensions.height);

  const isPreset = (preset: PresetResolution) =>
    dimensions.width === preset.width && dimensions.height === preset.height;

  const handlePresetSelect = (preset: PresetResolution) => {
    setIsCustom(false);
    onChange({ width: preset.width, height: preset.height });
  };

  const handleCustomApply = () => {
    onChange({ width: customWidth, height: customHeight });
  };

  const buttonStyle = (isActive: boolean): React.CSSProperties => ({
    padding: '8px 12px',
    borderRadius: '6px',
    border: isActive ? '2px solid #00d4ff' : '1px solid rgba(255,255,255,0.2)',
    background: isActive ? 'transparent' : 'rgba(0,0,0,0.3)',
    color: isActive ? '#00d4ff' : 'rgba(255,255,255,0.8)',
    cursor: 'pointer',
    textAlign: 'left' as const,
    transition: 'all 0.15s'
  });

  const inputStyle: React.CSSProperties = {
    width: '80px',
    padding: '6px 8px',
    borderRadius: '4px',
    border: '1px solid rgba(255,255,255,0.2)',
    background: 'rgba(0,0,0,0.3)',
    color: 'white',
    fontSize: '13px',
    textAlign: 'center'
  };

  return (
    <div style={{
      background: 'rgba(0,0,0,0.3)',
      borderRadius: '8px',
      padding: '16px'
    }}>
      <h3 style={{
        margin: '0 0 12px 0',
        fontSize: '14px',
        color: 'rgba(255,255,255,0.9)',
        fontWeight: 600
      }}>
        Canvas Resolution
      </h3>

      {/* Preset Resolutions */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '8px',
        marginBottom: '16px'
      }}>
        {PRESET_RESOLUTIONS.map(preset => (
          <button
            key={preset.label}
            onClick={() => handlePresetSelect(preset)}
            style={buttonStyle(isPreset(preset))}
          >
            <div style={{ fontWeight: 600, fontSize: '13px' }}>{preset.label}</div>
            <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '2px' }}>
              {preset.width}×{preset.height}
            </div>
          </button>
        ))}
      </div>

      {/* Custom Resolution Toggle */}
      <button
        onClick={() => setIsCustom(!isCustom)}
        style={{
          width: '100%',
          padding: '10px',
          borderRadius: '6px',
          border: isCustom ? '2px solid #06b6d4' : '1px solid rgba(255,255,255,0.2)',
          background: isCustom ? 'transparent' : 'rgba(0,0,0,0.3)',
          color: isCustom ? '#06b6d4' : 'rgba(255,255,255,0.7)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          marginBottom: isCustom ? '12px' : '0'
        }}
      >
        <span style={{ fontSize: '16px' }}>⚙</span>
        Custom Resolution
      </button>

      {/* Custom Resolution Inputs */}
      {isCustom && (
        <div style={{
          padding: '12px',
          background: 'rgba(102,126,234,0.1)',
          borderRadius: '6px',
          border: '1px solid rgba(102,126,234,0.3)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center' }}>
            <div>
              <label style={{
                display: 'block',
                fontSize: '10px',
                color: 'rgba(255,255,255,0.5)',
                marginBottom: '4px',
                textAlign: 'center'
              }}>
                WIDTH
              </label>
              <input
                type="number"
                value={customWidth}
                onChange={(e) => setCustomWidth(parseInt(e.target.value) || 0)}
                min={100}
                max={7680}
                style={inputStyle}
              />
            </div>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '18px', marginTop: '16px' }}>×</span>
            <div>
              <label style={{
                display: 'block',
                fontSize: '10px',
                color: 'rgba(255,255,255,0.5)',
                marginBottom: '4px',
                textAlign: 'center'
              }}>
                HEIGHT
              </label>
              <input
                type="number"
                value={customHeight}
                onChange={(e) => setCustomHeight(parseInt(e.target.value) || 0)}
                min={100}
                max={4320}
                style={inputStyle}
              />
            </div>
            <button
              onClick={handleCustomApply}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                background: '#06b6d4',
                color: 'white',
                cursor: 'pointer',
                fontWeight: 600,
                marginTop: '16px'
              }}
            >
              Apply
            </button>
          </div>

          {/* Aspect Ratio Info */}
          <div style={{
            marginTop: '8px',
            textAlign: 'center',
            fontSize: '11px',
            color: 'rgba(255,255,255,0.5)'
          }}>
            Aspect Ratio: {(customWidth / Math.max(customHeight, 1)).toFixed(2)}:1
          </div>
        </div>
      )}

      {/* Current Resolution Display */}
      <div style={{
        marginTop: '12px',
        padding: '8px',
        background: 'rgba(0,0,0,0.2)',
        borderRadius: '4px',
        textAlign: 'center',
        fontSize: '11px',
        color: 'rgba(255,255,255,0.5)'
      }}>
        Current: {dimensions.width} × {dimensions.height} ({(dimensions.width / Math.max(dimensions.height, 1)).toFixed(2)}:1)
      </div>
    </div>
  );
};

export default ResolutionSelector;
