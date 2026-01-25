import React, { memo } from 'react';
import { BackgroundBox, TextureType, texturePatterns, textureLabels } from './DraggableBox';

interface BoxPropertiesPanelProps {
  box: BackgroundBox;
  onUpdate: (box: BackgroundBox) => void;
  onDelete: () => void;
}

const BoxPropertiesPanel: React.FC<BoxPropertiesPanelProps> = ({
  box,
  onUpdate,
  onDelete
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

  return (
    <div style={{
      background: 'rgba(0,0,0,0.3)',
      borderRadius: '8px',
      padding: '16px',
      border: '2px solid #00d4ff'
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
          color: '#00d4ff'
        }}>
          Background Box
        </span>
        <button
          onClick={onDelete}
          style={{
            padding: '4px 12px',
            borderRadius: '4px',
            border: 'none',
            background: '#dc3545',
            color: 'white',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          Delete
        </button>
      </div>

      {/* Color */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Background Color</label>
        <div style={rowStyle}>
          <input
            type="color"
            value={box.color}
            onChange={(e) => onUpdate({ ...box, color: e.target.value })}
            style={{ width: '50px', height: '36px', padding: '2px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          />
          <input
            type="text"
            value={box.color}
            onChange={(e) => onUpdate({ ...box, color: e.target.value })}
            style={{ ...inputStyle, flex: 1 }}
          />
        </div>
      </div>

      {/* Color Presets */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Color Presets</label>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {[
            // Dark colors
            '#000000', '#1a1a2e', '#16213e', '#1f1f1f',
            '#2d2d44', '#1e3a5f', '#0a3d62', '#1b4f72',
            // Paper/beige/warm tones
            '#f5f0e6', '#e8dcc8', '#d4c4a8', '#c9b896',
            '#b8a07a', '#a08060', '#8b7355', '#f5f5dc'
          ].map(color => (
            <button
              key={color}
              onClick={() => onUpdate({ ...box, color })}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '4px',
                border: box.color === color ? '2px solid #00d4ff' : '1px solid rgba(255,255,255,0.2)',
                background: color,
                cursor: 'pointer'
              }}
            />
          ))}
        </div>
      </div>

      {/* Opacity */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Opacity: {Math.round(box.opacity * 100)}%</label>
        <input
          type="range"
          min="0"
          max="100"
          value={box.opacity * 100}
          onChange={(e) => onUpdate({ ...box, opacity: parseInt(e.target.value) / 100 })}
          style={{ width: '100%', accentColor: '#00d4ff' }}
        />
      </div>

      {/* Texture */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Texture</label>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
          {(Object.keys(textureLabels) as TextureType[]).map(texture => (
            <button
              key={texture}
              onClick={() => onUpdate({ ...box, texture, textureOpacity: box.textureOpacity ?? 0.3 })}
              style={{
                padding: '6px 10px',
                borderRadius: '4px',
                border: (box.texture || 'none') === texture ? '2px solid #00d4ff' : '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(0,0,0,0.3)',
                color: (box.texture || 'none') === texture ? '#00d4ff' : 'white',
                cursor: 'pointer',
                fontSize: '11px'
              }}
            >
              {textureLabels[texture]}
            </button>
          ))}
        </div>
        {box.texture && box.texture !== 'none' && (
          <>
            <label style={{ ...labelStyle, marginTop: '8px' }}>Texture Intensity: {Math.round((box.textureOpacity ?? 0.3) * 100)}%</label>
            <input
              type="range"
              min="10"
              max="100"
              value={(box.textureOpacity ?? 0.3) * 100}
              onChange={(e) => onUpdate({ ...box, textureOpacity: parseInt(e.target.value) / 100 })}
              style={{ width: '100%', accentColor: '#00d4ff' }}
            />
          </>
        )}
      </div>

      {/* Border Radius */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Border Radius: {box.borderRadius}px</label>
        <input
          type="range"
          min="0"
          max="50"
          value={box.borderRadius}
          onChange={(e) => onUpdate({ ...box, borderRadius: parseInt(e.target.value) })}
          style={{ width: '100%', accentColor: '#00d4ff' }}
        />
      </div>

      {/* Size Controls */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Size</label>
        <div style={rowStyle}>
          <div style={{ flex: 1 }}>
            <label style={{ ...labelStyle, fontSize: '10px' }}>Width: {box.width.toFixed(1)}%</label>
            <input
              type="range"
              min="5"
              max="100"
              step="0.5"
              value={box.width}
              onChange={(e) => onUpdate({ ...box, width: parseFloat(e.target.value) })}
              style={{ width: '100%', accentColor: '#00d4ff' }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ ...labelStyle, fontSize: '10px' }}>Height: {box.height.toFixed(1)}%</label>
            <input
              type="range"
              min="5"
              max="100"
              step="0.5"
              value={box.height}
              onChange={(e) => onUpdate({ ...box, height: parseFloat(e.target.value) })}
              style={{ width: '100%', accentColor: '#00d4ff' }}
            />
          </div>
        </div>
      </div>

      {/* Position Controls */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Position</label>
        <div style={rowStyle}>
          <div style={{ flex: 1 }}>
            <label style={{ ...labelStyle, fontSize: '10px' }}>X: {box.x.toFixed(1)}%</label>
            <input
              type="range"
              min="0"
              max="95"
              step="0.5"
              value={box.x}
              onChange={(e) => onUpdate({ ...box, x: parseFloat(e.target.value) })}
              style={{ width: '100%', accentColor: '#00d4ff' }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ ...labelStyle, fontSize: '10px' }}>Y: {box.y.toFixed(1)}%</label>
            <input
              type="range"
              min="0"
              max="95"
              step="0.5"
              value={box.y}
              onChange={(e) => onUpdate({ ...box, y: parseFloat(e.target.value) })}
              style={{ width: '100%', accentColor: '#00d4ff' }}
            />
          </div>
        </div>
      </div>

      {/* Quick Presets */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Quick Presets</label>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          <button
            onClick={() => onUpdate({ ...box, x: 0, y: 0, width: 100, height: 100 })}
            style={{
              padding: '6px 10px',
              borderRadius: '4px',
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(0,0,0,0.3)',
              color: 'white',
              cursor: 'pointer',
              fontSize: '11px'
            }}
          >
            Full Screen
          </button>
          <button
            onClick={() => onUpdate({ ...box, x: 0, y: 70, width: 100, height: 30 })}
            style={{
              padding: '6px 10px',
              borderRadius: '4px',
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(0,0,0,0.3)',
              color: 'white',
              cursor: 'pointer',
              fontSize: '11px'
            }}
          >
            Bottom Bar
          </button>
          <button
            onClick={() => onUpdate({ ...box, x: 0, y: 0, width: 100, height: 30 })}
            style={{
              padding: '6px 10px',
              borderRadius: '4px',
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(0,0,0,0.3)',
              color: 'white',
              cursor: 'pointer',
              fontSize: '11px'
            }}
          >
            Top Bar
          </button>
          <button
            onClick={() => onUpdate({ ...box, x: 10, y: 10, width: 80, height: 80, borderRadius: 20 })}
            style={{
              padding: '6px 10px',
              borderRadius: '4px',
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(0,0,0,0.3)',
              color: 'white',
              cursor: 'pointer',
              fontSize: '11px'
            }}
          >
            Centered Box
          </button>
        </div>
      </div>
    </div>
  );
};

export default memo(BoxPropertiesPanel);
