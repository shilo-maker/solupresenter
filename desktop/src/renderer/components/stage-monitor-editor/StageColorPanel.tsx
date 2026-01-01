import React from 'react';
import { StageColors } from './StageMonitorCanvas';

interface StageColorPanelProps {
  colors: StageColors;
  onChange: (colors: StageColors) => void;
}

const COLOR_PRESETS = [
  {
    name: 'Classic Dark',
    colors: { background: '#0a0a0a', text: '#ffffff', accent: '#4a90d9', secondary: '#888888', border: '#333333' }
  },
  {
    name: 'Midnight Blue',
    colors: { background: '#0d1b2a', text: '#e0e1dd', accent: '#778da9', secondary: '#415a77', border: '#1b263b' }
  },
  {
    name: 'Deep Purple',
    colors: { background: '#1a1625', text: '#ffffff', accent: '#9d4edd', secondary: '#7b2cbf', border: '#3c096c' }
  },
  {
    name: 'Forest',
    colors: { background: '#0d1f0d', text: '#d4e9d4', accent: '#52b788', secondary: '#40916c', border: '#1b4332' }
  },
  {
    name: 'Warm Amber',
    colors: { background: '#1a1614', text: '#fff8f0', accent: '#f59e0b', secondary: '#d97706', border: '#451a03' }
  }
];

const StageColorPanel: React.FC<StageColorPanelProps> = ({
  colors,
  onChange
}) => {
  const sectionStyle: React.CSSProperties = {
    marginBottom: '16px'
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '11px',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  };

  const colorRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px'
  };

  const inputStyle: React.CSSProperties = {
    flex: 1,
    padding: '8px',
    borderRadius: '4px',
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(0,0,0,0.3)',
    color: 'white',
    fontSize: '13px'
  };

  const colorInputStyle: React.CSSProperties = {
    width: '40px',
    height: '32px',
    padding: '2px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  };

  return (
    <div style={{
      background: 'rgba(0,0,0,0.3)',
      borderRadius: '8px',
      padding: '16px'
    }}>
      <h3 style={{
        margin: '0 0 16px 0',
        fontSize: '14px',
        color: 'rgba(255,255,255,0.9)',
        fontWeight: 600
      }}>
        Color Scheme
      </h3>

      {/* Color Presets */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Presets</label>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {COLOR_PRESETS.map(preset => (
            <button
              key={preset.name}
              onClick={() => onChange(preset.colors)}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: JSON.stringify(colors) === JSON.stringify(preset.colors)
                  ? '2px solid #00d4ff'
                  : '1px solid rgba(255,255,255,0.2)',
                background: preset.colors.background,
                color: preset.colors.text,
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 500
              }}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Individual Colors */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Background</label>
        <div style={colorRowStyle}>
          <input
            type="color"
            value={colors.background}
            onChange={(e) => onChange({ ...colors, background: e.target.value })}
            style={colorInputStyle}
          />
          <input
            type="text"
            value={colors.background}
            onChange={(e) => onChange({ ...colors, background: e.target.value })}
            style={inputStyle}
          />
        </div>
      </div>

      <div style={sectionStyle}>
        <label style={labelStyle}>Primary Text</label>
        <div style={colorRowStyle}>
          <input
            type="color"
            value={colors.text}
            onChange={(e) => onChange({ ...colors, text: e.target.value })}
            style={colorInputStyle}
          />
          <input
            type="text"
            value={colors.text}
            onChange={(e) => onChange({ ...colors, text: e.target.value })}
            style={inputStyle}
          />
        </div>
      </div>

      <div style={sectionStyle}>
        <label style={labelStyle}>Accent (Titles)</label>
        <div style={colorRowStyle}>
          <input
            type="color"
            value={colors.accent}
            onChange={(e) => onChange({ ...colors, accent: e.target.value })}
            style={colorInputStyle}
          />
          <input
            type="text"
            value={colors.accent}
            onChange={(e) => onChange({ ...colors, accent: e.target.value })}
            style={inputStyle}
          />
        </div>
      </div>

      <div style={sectionStyle}>
        <label style={labelStyle}>Secondary Text</label>
        <div style={colorRowStyle}>
          <input
            type="color"
            value={colors.secondary}
            onChange={(e) => onChange({ ...colors, secondary: e.target.value })}
            style={colorInputStyle}
          />
          <input
            type="text"
            value={colors.secondary}
            onChange={(e) => onChange({ ...colors, secondary: e.target.value })}
            style={inputStyle}
          />
        </div>
      </div>

      <div style={sectionStyle}>
        <label style={labelStyle}>Border</label>
        <div style={colorRowStyle}>
          <input
            type="color"
            value={colors.border}
            onChange={(e) => onChange({ ...colors, border: e.target.value })}
            style={colorInputStyle}
          />
          <input
            type="text"
            value={colors.border}
            onChange={(e) => onChange({ ...colors, border: e.target.value })}
            style={inputStyle}
          />
        </div>
      </div>

      {/* Preview */}
      <div style={{
        marginTop: '16px',
        padding: '16px',
        background: colors.background,
        borderRadius: '8px',
        border: `1px solid ${colors.border}`
      }}>
        <div style={{ fontSize: '10px', color: colors.secondary, marginBottom: '4px' }}>Preview</div>
        <div style={{ fontSize: '14px', color: colors.accent, fontWeight: 600, marginBottom: '4px' }}>
          Accent Text
        </div>
        <div style={{ fontSize: '13px', color: colors.text, marginBottom: '2px' }}>
          Primary Text
        </div>
        <div style={{ fontSize: '11px', color: colors.secondary }}>
          Secondary Text
        </div>
      </div>
    </div>
  );
};

export default StageColorPanel;
