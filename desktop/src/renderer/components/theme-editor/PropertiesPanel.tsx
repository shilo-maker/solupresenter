import React from 'react';
import { LinePosition, LineStyle } from './DraggableTextBox';

interface PropertiesPanelProps {
  lineType: string;  // Flexible to support song, bible, and prayer line types
  position: LinePosition;
  style: LineStyle;
  onPositionChange: (position: LinePosition) => void;
  onStyleChange: (style: LineStyle) => void;
}

const LINE_LABELS: Record<string, string> = {
  original: 'Original (Hebrew)',
  transliteration: 'Transliteration',
  translation: 'Translation'
};

const LINE_COLORS: Record<string, string> = {
  original: '#FF8C42',
  transliteration: '#667eea',
  translation: '#28a745'
};

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  lineType,
  position,
  style,
  onPositionChange,
  onStyleChange
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

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px',
    borderRadius: '4px',
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(0,0,0,0.3)',
    color: 'white',
    fontSize: '13px',
    boxSizing: 'border-box'
  };

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
    marginBottom: '8px'
  };

  const buttonGroupStyle: React.CSSProperties = {
    display: 'flex',
    gap: '4px'
  };

  const alignButtonStyle = (isActive: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '6px',
    borderRadius: '4px',
    border: '1px solid rgba(255,255,255,0.1)',
    background: isActive ? 'rgba(0,212,255,0.3)' : 'rgba(0,0,0,0.3)',
    color: isActive ? '#00d4ff' : 'rgba(255,255,255,0.6)',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: isActive ? 600 : 400
  });

  return (
    <div style={{
      background: 'rgba(0,0,0,0.3)',
      borderRadius: '8px',
      padding: '16px',
      border: `2px solid ${LINE_COLORS[lineType]}`
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px',
        paddingBottom: '12px',
        borderBottom: '1px solid rgba(255,255,255,0.1)'
      }}>
        <span style={{
          fontWeight: 600,
          color: LINE_COLORS[lineType]
        }}>
          {LINE_LABELS[lineType]}
        </span>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={style.visible}
            onChange={(e) => onStyleChange({ ...style, visible: e.target.checked })}
            style={{ accentColor: LINE_COLORS[lineType] }}
          />
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>Visible</span>
        </label>
      </div>

      {/* Font Size */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Font Size: {style.fontSize}%</label>
        <input
          type="range"
          min="50"
          max="200"
          value={style.fontSize}
          onChange={(e) => onStyleChange({ ...style, fontSize: parseInt(e.target.value) })}
          style={{ width: '100%', accentColor: LINE_COLORS[lineType] }}
        />
      </div>

      {/* Font Weight */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Font Weight</label>
        <select
          value={style.fontWeight}
          onChange={(e) => onStyleChange({ ...style, fontWeight: e.target.value })}
          style={inputStyle}
        >
          <option value="300">Light (300)</option>
          <option value="400">Normal (400)</option>
          <option value="500">Medium (500)</option>
          <option value="600">Semi-Bold (600)</option>
          <option value="700">Bold (700)</option>
          <option value="800">Extra Bold (800)</option>
        </select>
      </div>

      {/* Color */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Text Color</label>
        <div style={rowStyle}>
          <input
            type="color"
            value={style.color}
            onChange={(e) => onStyleChange({ ...style, color: e.target.value })}
            style={{ width: '50px', height: '36px', padding: '2px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          />
          <input
            type="text"
            value={style.color}
            onChange={(e) => onStyleChange({ ...style, color: e.target.value })}
            style={{ ...inputStyle, flex: 1 }}
          />
        </div>
      </div>

      {/* Opacity */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Opacity: {Math.round(style.opacity * 100)}%</label>
        <input
          type="range"
          min="0"
          max="100"
          value={style.opacity * 100}
          onChange={(e) => onStyleChange({ ...style, opacity: parseInt(e.target.value) / 100 })}
          style={{ width: '100%', accentColor: LINE_COLORS[lineType] }}
        />
      </div>

      {/* Horizontal Alignment */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Horizontal Alignment</label>
        <div style={{ ...buttonGroupStyle, direction: 'ltr' }}>
          <button
            style={alignButtonStyle(position.alignH === 'left')}
            onClick={() => onPositionChange({ ...position, alignH: 'left' })}
          >
            Left
          </button>
          <button
            style={alignButtonStyle(position.alignH === 'center')}
            onClick={() => onPositionChange({ ...position, alignH: 'center' })}
          >
            Center
          </button>
          <button
            style={alignButtonStyle(position.alignH === 'right')}
            onClick={() => onPositionChange({ ...position, alignH: 'right' })}
          >
            Right
          </button>
        </div>
      </div>

      {/* Vertical Alignment */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Vertical Alignment</label>
        <div style={{ ...buttonGroupStyle, direction: 'ltr' }}>
          <button
            style={alignButtonStyle(position.alignV === 'top')}
            onClick={() => onPositionChange({ ...position, alignV: 'top' })}
          >
            Top
          </button>
          <button
            style={alignButtonStyle(position.alignV === 'center')}
            onClick={() => onPositionChange({ ...position, alignV: 'center' })}
          >
            Center
          </button>
          <button
            style={alignButtonStyle(position.alignV === 'bottom')}
            onClick={() => onPositionChange({ ...position, alignV: 'bottom' })}
          >
            Bottom
          </button>
        </div>
      </div>

      {/* Padding */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Padding</label>
        <div style={rowStyle}>
          <div style={{ flex: 1 }}>
            <label style={{ ...labelStyle, fontSize: '10px' }}>Top: {position.paddingTop}%</label>
            <input
              type="range"
              min="0"
              max="20"
              step="0.5"
              value={position.paddingTop}
              onChange={(e) => onPositionChange({ ...position, paddingTop: parseFloat(e.target.value) })}
              style={{ width: '100%', accentColor: LINE_COLORS[lineType] }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ ...labelStyle, fontSize: '10px' }}>Bottom: {position.paddingBottom}%</label>
            <input
              type="range"
              min="0"
              max="20"
              step="0.5"
              value={position.paddingBottom}
              onChange={(e) => onPositionChange({ ...position, paddingBottom: parseFloat(e.target.value) })}
              style={{ width: '100%', accentColor: LINE_COLORS[lineType] }}
            />
          </div>
        </div>
      </div>

      {/* Position Info (read-only) */}
      <div style={{
        fontSize: '10px',
        color: 'rgba(255,255,255,0.4)',
        marginTop: '12px',
        padding: '8px',
        background: 'rgba(0,0,0,0.2)',
        borderRadius: '4px'
      }}>
        Position: x={position.x.toFixed(1)}%, y={position.y.toFixed(1)}%
        <br />
        Size: {position.width.toFixed(1)}% × {position.height.toFixed(1)}%
      </div>
    </div>
  );
};

export default PropertiesPanel;
