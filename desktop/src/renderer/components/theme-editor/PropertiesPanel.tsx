import React, { memo } from 'react';
import { LinePosition, LineStyle } from './DraggableTextBox';

interface PropertiesPanelProps {
  lineType: string;  // Flexible to support song, bible, and prayer line types
  position: LinePosition;
  style: LineStyle;
  onPositionChange: (position: LinePosition) => void;
  onStyleChange: (style: LineStyle) => void;
  // Available line types for flow anchor selection
  availableLineTypes?: string[];
}

const LINE_LABELS: Record<string, string> = {
  // Song lines
  original: 'Original (Hebrew)',
  transliteration: 'Transliteration',
  translation: 'Translation',
  // Bible lines
  hebrew: 'Hebrew',
  english: 'English',
  reference: 'Reference (Hebrew)',
  referenceEnglish: 'Reference (English)',
  // Prayer lines
  title: 'Title (Hebrew)',
  titleTranslation: 'Title (English)',
  subtitle: 'Subtitle (Hebrew)',
  subtitleTranslation: 'Subtitle (English)',
  description: 'Description (Hebrew)',
  descriptionTranslation: 'Description (English)',
  referenceTranslation: 'Reference (English)'
};

const LINE_COLORS: Record<string, string> = {
  // Song lines
  original: '#06b6d4',
  transliteration: '#06b6d4',
  translation: '#28a745',
  // Bible lines
  hebrew: '#06b6d4',
  english: '#28a745',
  reference: '#f59e0b',
  referenceEnglish: '#f59e0b',
  // Prayer lines
  title: '#06b6d4',
  titleTranslation: '#28a745',
  subtitle: '#06b6d4',
  subtitleTranslation: '#28a745',
  description: '#06b6d4',
  descriptionTranslation: '#28a745',
  referenceTranslation: '#f59e0b'
};

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  lineType,
  position,
  style,
  onPositionChange,
  onStyleChange,
  availableLineTypes = []
}) => {
  // Determine if flow mode is enabled
  const isFlowMode = position.positionMode === 'flow';

  // Get available anchors (line types that come before this one, excluding self)
  const getAvailableAnchors = () => {
    const currentIndex = availableLineTypes.indexOf(lineType);
    if (currentIndex <= 0) return []; // First item can't have anchors
    return availableLineTypes.slice(0, currentIndex);
  };
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
    border: isActive ? '2px solid #00d4ff' : '1px solid rgba(255,255,255,0.1)',
    background: isActive ? 'transparent' : 'rgba(0,0,0,0.3)',
    color: isActive ? '#00d4ff' : 'rgba(255,255,255,0.6)',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: isActive ? 600 : 400
  });

  const lineColor = LINE_COLORS[lineType] || '#888888';
  const lineLabel = LINE_LABELS[lineType] || lineType;

  return (
    <div style={{
      background: 'rgba(0,0,0,0.3)',
      borderRadius: '8px',
      padding: '16px',
      border: `2px solid ${lineColor}`
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
          color: lineColor
        }}>
          {lineLabel}
        </span>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={style.visible}
            onChange={(e) => onStyleChange({ ...style, visible: e.target.checked })}
            style={{ accentColor: lineColor }}
          />
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>Visible</span>
        </label>
      </div>

      {/* Position Mode (Flow Positioning) */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Position Mode</label>
        <div style={{ ...buttonGroupStyle, direction: 'ltr' }}>
          <button
            style={alignButtonStyle(position.positionMode !== 'flow')}
            onClick={() => onPositionChange({ ...position, positionMode: 'absolute' })}
          >
            Absolute
          </button>
          <button
            style={alignButtonStyle(position.positionMode === 'flow')}
            onClick={() => onPositionChange({ ...position, positionMode: 'flow', flowGap: position.flowGap ?? 1 })}
          >
            Flow
          </button>
        </div>
        {isFlowMode && (
          <>
            {/* Flow Direction - Below or Beside */}
            <div style={{ marginTop: '12px' }}>
              <label style={labelStyle}>Flow Direction</label>
              <div style={{ ...buttonGroupStyle, direction: 'ltr' }}>
                <button
                  style={alignButtonStyle(!position.flowBeside)}
                  onClick={() => onPositionChange({ ...position, flowBeside: false })}
                >
                  Below
                </button>
                <button
                  style={alignButtonStyle(position.flowBeside === true)}
                  onClick={() => onPositionChange({ ...position, flowBeside: true })}
                >
                  Beside
                </button>
              </div>
            </div>

            {/* Flow Anchor Selection */}
            <div style={{ marginTop: '12px' }}>
              <label style={labelStyle}>{position.flowBeside ? 'Same Height As' : 'Position After'}</label>
              <select
                value={position.flowAnchor || ''}
                onChange={(e) => onPositionChange({ ...position, flowAnchor: e.target.value || undefined })}
                style={inputStyle}
              >
                <option value="">{position.flowBeside ? 'None' : 'Top of Canvas'}</option>
                {getAvailableAnchors().map((anchor) => (
                  <option key={anchor} value={anchor}>
                    {LINE_LABELS[anchor] || anchor}
                  </option>
                ))}
              </select>
            </div>

            {/* Flow Gap - only show for "Below" mode */}
            {!position.flowBeside && (
              <div style={{ marginTop: '12px' }}>
                <label style={labelStyle}>Gap Below: {position.flowGap ?? 1}%</label>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.5"
                  value={position.flowGap ?? 1}
                  onChange={(e) => onPositionChange({ ...position, flowGap: parseFloat(e.target.value) })}
                  style={{ width: '100%', accentColor: lineColor }}
                />
              </div>
            )}

            {/* Info about flow mode */}
            <div style={{
              marginTop: '8px',
              fontSize: '10px',
              color: 'rgba(255,255,255,0.5)',
              fontStyle: 'italic'
            }}>
              {position.flowBeside
                ? 'Beside mode: Y position matches the anchor element. X and width can be adjusted.'
                : 'Below mode: Y position is calculated based on anchor. X and width can still be adjusted.'}
            </div>
          </>
        )}
      </div>

      {/* Auto Height Toggle */}
      <div style={sectionStyle}>
        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer'
        }}>
          <input
            type="checkbox"
            checked={position.autoHeight === true}
            onChange={(e) => onPositionChange({ ...position, autoHeight: e.target.checked })}
            style={{ accentColor: lineColor }}
          />
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>Auto Height</span>
        </label>
        {position.autoHeight && (
          <>
            <div style={{
              marginTop: '6px',
              fontSize: '10px',
              color: 'rgba(255,255,255,0.5)',
              fontStyle: 'italic'
            }}>
              Height automatically adjusts to fit content. Useful for variable-length text.
            </div>
            {/* Grow Direction */}
            <div style={{ marginTop: '12px' }}>
              <label style={labelStyle}>Grow Direction</label>
              <div style={{ ...buttonGroupStyle, direction: 'ltr' }}>
                <button
                  style={alignButtonStyle(position.growDirection !== 'up')}
                  onClick={() => onPositionChange({ ...position, growDirection: 'down' })}
                >
                  ↓ Down
                </button>
                <button
                  style={alignButtonStyle(position.growDirection === 'up')}
                  onClick={() => onPositionChange({ ...position, growDirection: 'up' })}
                >
                  ↑ Up
                </button>
              </div>
              <div style={{
                marginTop: '6px',
                fontSize: '10px',
                color: 'rgba(255,255,255,0.5)',
                fontStyle: 'italic'
              }}>
                {position.growDirection === 'up'
                  ? 'Content grows upward from the bottom edge.'
                  : 'Content grows downward from the top edge.'}
              </div>
            </div>
          </>
        )}
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
          style={{ width: '100%', accentColor: lineColor }}
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

      {/* Background Color */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Text Background</label>
        <div style={rowStyle}>
          <input
            type="color"
            value={style.backgroundColor || '#000000'}
            onChange={(e) => onStyleChange({ ...style, backgroundColor: e.target.value })}
            style={{ width: '50px', height: '36px', padding: '2px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          />
          <input
            type="text"
            value={style.backgroundColor || ''}
            onChange={(e) => onStyleChange({ ...style, backgroundColor: e.target.value || undefined })}
            placeholder="none"
            style={{ ...inputStyle, flex: 1 }}
          />
          {style.backgroundColor && (
            <button
              onClick={() => onStyleChange({ ...style, backgroundColor: undefined, backgroundOpacity: undefined })}
              style={{ padding: '4px 8px', background: 'rgba(255,0,0,0.3)', border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer', fontSize: '12px' }}
              title="Remove background"
            >
              ✕
            </button>
          )}
        </div>
        {style.backgroundColor && (
          <div style={{ marginTop: '8px' }}>
            <label style={{ ...labelStyle, fontSize: '11px' }}>Background Opacity: {Math.round((style.backgroundOpacity ?? 1) * 100)}%</label>
            <input
              type="range"
              min="0"
              max="100"
              value={(style.backgroundOpacity ?? 1) * 100}
              onChange={(e) => onStyleChange({ ...style, backgroundOpacity: parseInt(e.target.value) / 100 })}
              style={{ width: '100%', accentColor: lineColor }}
            />
          </div>
        )}
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
          style={{ width: '100%', accentColor: lineColor }}
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
              style={{ width: '100%', accentColor: lineColor }}
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
              style={{ width: '100%', accentColor: lineColor }}
            />
          </div>
        </div>
        {/* Left/Right padding for reference lines (in pixels) */}
        {lineType.toLowerCase().includes('reference') && (
          <div style={{ ...rowStyle, marginTop: '8px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ ...labelStyle, fontSize: '10px' }}>Left: {position.paddingLeft ?? 0}px</label>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={position.paddingLeft ?? 0}
                onChange={(e) => onPositionChange({ ...position, paddingLeft: parseInt(e.target.value) })}
                style={{ width: '100%', accentColor: lineColor }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ ...labelStyle, fontSize: '10px' }}>Right: {position.paddingRight ?? 0}px</label>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={position.paddingRight ?? 0}
                onChange={(e) => onPositionChange({ ...position, paddingRight: parseInt(e.target.value) })}
                style={{ width: '100%', accentColor: lineColor }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Borders (only for reference lines) */}
      {lineType.toLowerCase().includes('reference') && (
        <div style={sectionStyle}>
          <label style={labelStyle}>Borders</label>
          <div style={rowStyle}>
            <div style={{ flex: 1 }}>
              <label style={{ ...labelStyle, fontSize: '10px' }}>Color</label>
              <input
                type="color"
                value={style.borderColor || '#ffffff'}
                onChange={(e) => onStyleChange({ ...style, borderColor: e.target.value })}
                style={{ width: '100%', height: '30px', padding: '2px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              />
            </div>
          </div>
          <div style={{ ...rowStyle, marginTop: '8px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ ...labelStyle, fontSize: '10px' }}>Top: {style.borderTop || 0}px</label>
              <input
                type="range"
                min="0"
                max="10"
                step="1"
                value={style.borderTop || 0}
                onChange={(e) => onStyleChange({ ...style, borderTop: parseInt(e.target.value) })}
                style={{ width: '100%', accentColor: lineColor }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ ...labelStyle, fontSize: '10px' }}>Right: {style.borderRight || 0}px</label>
              <input
                type="range"
                min="0"
                max="10"
                step="1"
                value={style.borderRight || 0}
                onChange={(e) => onStyleChange({ ...style, borderRight: parseInt(e.target.value) })}
                style={{ width: '100%', accentColor: lineColor }}
              />
            </div>
          </div>
          <div style={rowStyle}>
            <div style={{ flex: 1 }}>
              <label style={{ ...labelStyle, fontSize: '10px' }}>Bottom: {style.borderBottom || 0}px</label>
              <input
                type="range"
                min="0"
                max="10"
                step="1"
                value={style.borderBottom || 0}
                onChange={(e) => onStyleChange({ ...style, borderBottom: parseInt(e.target.value) })}
                style={{ width: '100%', accentColor: lineColor }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ ...labelStyle, fontSize: '10px' }}>Left: {style.borderLeft || 0}px</label>
              <input
                type="range"
                min="0"
                max="10"
                step="1"
                value={style.borderLeft || 0}
                onChange={(e) => onStyleChange({ ...style, borderLeft: parseInt(e.target.value) })}
                style={{ width: '100%', accentColor: lineColor }}
              />
            </div>
          </div>
          <div style={{ marginTop: '8px' }}>
            <label style={labelStyle}>Corner Radius</label>
            <div style={rowStyle}>
              <div style={{ flex: 1 }}>
                <label style={{ ...labelStyle, fontSize: '10px' }}>Top-Left: {style.borderRadiusTopLeft ?? 0}px</label>
                <input
                  type="range"
                  min="0"
                  max="30"
                  step="1"
                  value={style.borderRadiusTopLeft ?? 0}
                  onChange={(e) => onStyleChange({ ...style, borderRadiusTopLeft: parseInt(e.target.value) })}
                  style={{ width: '100%', accentColor: lineColor }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ ...labelStyle, fontSize: '10px' }}>Top-Right: {style.borderRadiusTopRight ?? 0}px</label>
                <input
                  type="range"
                  min="0"
                  max="30"
                  step="1"
                  value={style.borderRadiusTopRight ?? 0}
                  onChange={(e) => onStyleChange({ ...style, borderRadiusTopRight: parseInt(e.target.value) })}
                  style={{ width: '100%', accentColor: lineColor }}
                />
              </div>
            </div>
            <div style={rowStyle}>
              <div style={{ flex: 1 }}>
                <label style={{ ...labelStyle, fontSize: '10px' }}>Bottom-Left: {style.borderRadiusBottomLeft ?? 0}px</label>
                <input
                  type="range"
                  min="0"
                  max="30"
                  step="1"
                  value={style.borderRadiusBottomLeft ?? 0}
                  onChange={(e) => onStyleChange({ ...style, borderRadiusBottomLeft: parseInt(e.target.value) })}
                  style={{ width: '100%', accentColor: lineColor }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ ...labelStyle, fontSize: '10px' }}>Bottom-Right: {style.borderRadiusBottomRight ?? 0}px</label>
                <input
                  type="range"
                  min="0"
                  max="30"
                  step="1"
                  value={style.borderRadiusBottomRight ?? 0}
                  onChange={(e) => onStyleChange({ ...style, borderRadiusBottomRight: parseInt(e.target.value) })}
                  style={{ width: '100%', accentColor: lineColor }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

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

export default memo(PropertiesPanel);
