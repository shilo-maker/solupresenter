import React from 'react';
import { StageElementConfig, StageTextStyle } from './StageMonitorCanvas';

interface StagePropertiesPanelProps {
  elementType: 'header' | 'clock' | 'songTitle' | 'currentSlide' | 'nextSlide';
  element: StageElementConfig;
  textStyles?: {
    original: StageTextStyle;
    transliteration: StageTextStyle;
    translation: StageTextStyle;
  };
  onElementChange: (updates: Partial<StageElementConfig>) => void;
  onTextStyleChange?: (lineType: string, updates: Partial<StageTextStyle>) => void;
}

const ELEMENT_LABELS: Record<string, { label: string; color: string }> = {
  header: { label: 'Header Bar', color: '#f59e0b' },
  clock: { label: 'Clock', color: '#10b981' },
  songTitle: { label: 'Song Title', color: '#3b82f6' },
  currentSlide: { label: 'Current Slide', color: '#8b5cf6' },
  nextSlide: { label: 'Next Preview', color: '#ec4899' }
};

const StagePropertiesPanel: React.FC<StagePropertiesPanelProps> = ({
  elementType,
  element,
  textStyles,
  onElementChange,
  onTextStyleChange
}) => {
  const config = ELEMENT_LABELS[elementType];

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
      border: `2px solid ${config.color}`
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
        <span style={{ fontWeight: 600, color: config.color }}>
          {config.label}
        </span>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={element.visible}
            onChange={(e) => onElementChange({ visible: e.target.checked })}
            style={{ accentColor: config.color }}
          />
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>Visible</span>
        </label>
      </div>

      {/* Background Color (for header, currentSlide, nextSlide) */}
      {['header', 'currentSlide', 'nextSlide'].includes(elementType) && (
        <div style={sectionStyle}>
          <label style={labelStyle}>Background Color</label>
          <div style={rowStyle}>
            <input
              type="color"
              value={element.backgroundColor || '#1a1a1a'}
              onChange={(e) => onElementChange({ backgroundColor: e.target.value })}
              style={{ width: '50px', height: '36px', padding: '2px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            />
            <input
              type="text"
              value={element.backgroundColor || '#1a1a1a'}
              onChange={(e) => onElementChange({ backgroundColor: e.target.value })}
              style={{ ...inputStyle, flex: 1 }}
            />
          </div>
        </div>
      )}

      {/* Border Radius */}
      {['currentSlide', 'nextSlide'].includes(elementType) && (
        <div style={sectionStyle}>
          <label style={labelStyle}>Border Radius: {element.borderRadius || 0}px</label>
          <input
            type="range"
            min="0"
            max="30"
            value={element.borderRadius || 0}
            onChange={(e) => onElementChange({ borderRadius: parseInt(e.target.value) })}
            style={{ width: '100%', accentColor: config.color }}
          />
        </div>
      )}

      {/* Text Color (for clock, songTitle) */}
      {['clock', 'songTitle'].includes(elementType) && (
        <div style={sectionStyle}>
          <label style={labelStyle}>Text Color</label>
          <div style={rowStyle}>
            <input
              type="color"
              value={element.color || '#ffffff'}
              onChange={(e) => onElementChange({ color: e.target.value })}
              style={{ width: '50px', height: '36px', padding: '2px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            />
            <input
              type="text"
              value={element.color || '#ffffff'}
              onChange={(e) => onElementChange({ color: e.target.value })}
              style={{ ...inputStyle, flex: 1 }}
            />
          </div>
        </div>
      )}

      {/* Clock-specific settings */}
      {elementType === 'clock' && (
        <>
          <div style={sectionStyle}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={element.showSeconds || false}
                onChange={(e) => onElementChange({ showSeconds: e.target.checked })}
                style={{ accentColor: config.color }}
              />
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>Show Seconds</span>
            </label>
          </div>
          <div style={sectionStyle}>
            <label style={labelStyle}>Font Family</label>
            <select
              value={element.fontFamily || 'monospace'}
              onChange={(e) => onElementChange({ fontFamily: e.target.value })}
              style={inputStyle}
            >
              <option value="monospace">Monospace</option>
              <option value="sans-serif">Sans-serif</option>
              <option value="serif">Serif</option>
            </select>
          </div>
        </>
      )}

      {/* Next Slide specific settings */}
      {elementType === 'nextSlide' && (
        <>
          <div style={sectionStyle}>
            <label style={labelStyle}>Label Text</label>
            <input
              type="text"
              value={element.labelText || 'Next'}
              onChange={(e) => onElementChange({ labelText: e.target.value })}
              style={inputStyle}
              placeholder="Next"
            />
          </div>
          <div style={sectionStyle}>
            <label style={labelStyle}>Opacity: {Math.round((element.opacity || 0.8) * 100)}%</label>
            <input
              type="range"
              min="0"
              max="100"
              value={(element.opacity || 0.8) * 100}
              onChange={(e) => onElementChange({ opacity: parseInt(e.target.value) / 100 })}
              style={{ width: '100%', accentColor: config.color }}
            />
          </div>
        </>
      )}

      {/* Current Slide Text Styles */}
      {elementType === 'currentSlide' && textStyles && onTextStyleChange && (
        <div style={sectionStyle}>
          <label style={{ ...labelStyle, marginBottom: '12px' }}>Text Lines</label>
          {(['original', 'transliteration', 'translation'] as const).map(lineType => (
            <div key={lineType} style={{
              padding: '12px',
              background: 'rgba(0,0,0,0.2)',
              borderRadius: '6px',
              marginBottom: '8px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px'
              }}>
                <span style={{ fontSize: '12px', color: 'white', textTransform: 'capitalize' }}>
                  {lineType}
                </span>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={textStyles[lineType].visible}
                    onChange={(e) => onTextStyleChange(lineType, { visible: e.target.checked })}
                    style={{ accentColor: config.color }}
                  />
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>Show</span>
                </label>
              </div>
              {textStyles[lineType].visible && (
                <>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                    <input
                      type="color"
                      value={textStyles[lineType].color}
                      onChange={(e) => onTextStyleChange(lineType, { color: e.target.value })}
                      style={{ width: '32px', height: '28px', padding: '2px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    />
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)' }}>
                        Opacity: {Math.round(textStyles[lineType].opacity * 100)}%
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={textStyles[lineType].opacity * 100}
                        onChange={(e) => onTextStyleChange(lineType, { opacity: parseInt(e.target.value) / 100 })}
                        style={{ width: '100%', accentColor: config.color }}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Position Info */}
      <div style={{
        fontSize: '10px',
        color: 'rgba(255,255,255,0.4)',
        marginTop: '12px',
        padding: '8px',
        background: 'rgba(0,0,0,0.2)',
        borderRadius: '4px'
      }}>
        Position: x={element.x?.toFixed(1)}%, y={element.y?.toFixed(1)}%
        <br />
        Size: {element.width?.toFixed(1)}% × {element.height?.toFixed(1)}%
      </div>
    </div>
  );
};

export default StagePropertiesPanel;
