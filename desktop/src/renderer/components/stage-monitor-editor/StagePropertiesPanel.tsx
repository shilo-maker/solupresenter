import React from 'react';
import { StageElementConfig, StageTextStyle } from './StageMonitorCanvas';

interface StagePropertiesPanelProps {
  elementType: 'header' | 'clock' | 'songTitle' | 'currentSlide' | 'nextSlide' | 'original' | 'transliteration' | 'translation' | 'nextOriginal' | 'nextTransliteration' | 'nextTranslation';
  element?: StageElementConfig;
  textStyle?: StageTextStyle;
  onElementChange?: (updates: Partial<StageElementConfig>) => void;
  onTextStyleChange?: (updates: Partial<StageTextStyle>) => void;
  previewText?: string;
  onPreviewTextChange?: (text: string) => void;
}

const ELEMENT_LABELS: Record<string, { label: string; color: string }> = {
  header: { label: 'Header Bar', color: '#f59e0b' },
  clock: { label: 'Clock', color: '#10b981' },
  songTitle: { label: 'Song Title', color: '#3b82f6' },
  currentSlide: { label: 'Current Slide Area', color: '#8b5cf6' },
  nextSlide: { label: 'Next Preview', color: '#ec4899' },
  original: { label: 'Original Text', color: '#06b6d4' },
  transliteration: { label: 'Transliteration', color: '#f59e0b' },
  translation: { label: 'Translation', color: '#28a745' },
  nextOriginal: { label: 'Next Original', color: '#06b6d4' },
  nextTransliteration: { label: 'Next Transliteration', color: '#f59e0b' },
  nextTranslation: { label: 'Next Translation', color: '#28a745' }
};

const TEXT_LINE_ORDER = ['original', 'transliteration', 'translation'];
const NEXT_TEXT_LINE_ORDER = ['nextOriginal', 'nextTransliteration', 'nextTranslation'];

const StagePropertiesPanel: React.FC<StagePropertiesPanelProps> = ({
  elementType,
  element,
  textStyle,
  onElementChange,
  onTextStyleChange,
  previewText,
  onPreviewTextChange
}) => {
  const config = ELEMENT_LABELS[elementType];
  const isTextLine = ['original', 'transliteration', 'translation', 'nextOriginal', 'nextTransliteration', 'nextTranslation'].includes(elementType);
  const isNextTextLine = ['nextOriginal', 'nextTransliteration', 'nextTranslation'].includes(elementType);

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
    border: isActive ? `2px solid ${config.color}` : '1px solid rgba(255,255,255,0.1)',
    background: isActive ? 'transparent' : 'rgba(0,0,0,0.3)',
    color: isActive ? config.color : 'rgba(255,255,255,0.6)',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: isActive ? 600 : 400
  });

  // Get available anchors for flow positioning (elements that come before this one)
  const getAvailableAnchors = () => {
    const order = isNextTextLine ? NEXT_TEXT_LINE_ORDER : TEXT_LINE_ORDER;
    const currentIndex = order.indexOf(elementType);
    if (currentIndex <= 0) return [];
    return order.slice(0, currentIndex);
  };

  // Render Text Line Properties Panel
  if (isTextLine && textStyle && onTextStyleChange) {
    const isFlowMode = textStyle.positionMode === 'flow';

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
              checked={textStyle.visible}
              onChange={(e) => onTextStyleChange({ visible: e.target.checked })}
              style={{ accentColor: config.color }}
            />
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>Visible</span>
          </label>
        </div>

        {/* Preview Text Input */}
        {onPreviewTextChange && (
          <div style={sectionStyle}>
            <label style={labelStyle}>Preview Text</label>
            <input
              type="text"
              value={previewText || ''}
              onChange={(e) => onPreviewTextChange(e.target.value)}
              style={{
                ...inputStyle,
                direction: elementType === 'original' || elementType === 'nextOriginal' ? 'rtl' : 'ltr'
              }}
              placeholder={`Enter ${config.label.toLowerCase()} preview...`}
            />
          </div>
        )}

        {/* Position Mode */}
        <div style={sectionStyle}>
          <label style={labelStyle}>Position Mode</label>
          <div style={{ ...buttonGroupStyle, direction: 'ltr' }}>
            <button
              type="button"
              style={alignButtonStyle(textStyle.positionMode !== 'flow')}
              onClick={() => onTextStyleChange({ positionMode: 'absolute' })}
            >
              Absolute
            </button>
            <button
              type="button"
              style={alignButtonStyle(textStyle.positionMode === 'flow')}
              onClick={() => onTextStyleChange({ positionMode: 'flow', flowGap: textStyle.flowGap ?? 1 })}
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
                    type="button"
                    style={alignButtonStyle(!textStyle.flowBeside)}
                    onClick={() => onTextStyleChange({ flowBeside: false })}
                  >
                    Below
                  </button>
                  <button
                    type="button"
                    style={alignButtonStyle(textStyle.flowBeside === true)}
                    onClick={() => onTextStyleChange({ flowBeside: true })}
                  >
                    Beside
                  </button>
                </div>
              </div>

              {/* Flow Anchor Selection */}
              <div style={{ marginTop: '12px' }}>
                <label style={labelStyle}>{textStyle.flowBeside ? 'Same Height As' : 'Position After'}</label>
                <select
                  value={textStyle.flowAnchor || ''}
                  onChange={(e) => onTextStyleChange({ flowAnchor: e.target.value || undefined })}
                  style={inputStyle}
                >
                  <option value="">{textStyle.flowBeside ? 'None' : 'Top of Canvas'}</option>
                  {getAvailableAnchors().map((anchor) => (
                    <option key={anchor} value={anchor}>
                      {ELEMENT_LABELS[anchor]?.label || anchor}
                    </option>
                  ))}
                </select>
              </div>

              {/* Flow Gap - only show for "Below" mode */}
              {!textStyle.flowBeside && (
                <div style={{ marginTop: '12px' }}>
                  <label style={labelStyle}>Gap Below: {textStyle.flowGap ?? 1}%</label>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.5"
                    value={textStyle.flowGap ?? 1}
                    onChange={(e) => onTextStyleChange({ flowGap: parseFloat(e.target.value) })}
                    style={{ width: '100%', accentColor: config.color }}
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
                {textStyle.flowBeside
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
              checked={textStyle.autoHeight === true}
              onChange={(e) => onTextStyleChange({ autoHeight: e.target.checked })}
              style={{ accentColor: config.color }}
            />
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>Auto Height</span>
          </label>
          {textStyle.autoHeight && (
            <>
              <div style={{
                marginTop: '6px',
                fontSize: '10px',
                color: 'rgba(255,255,255,0.5)',
                fontStyle: 'italic'
              }}>
                Box height shrinks to fit text content exactly (no extra margin/padding).
              </div>
              {/* Grow Direction */}
              <div style={{ marginTop: '12px' }}>
                <label style={labelStyle}>Grow Direction</label>
                <div style={{ ...buttonGroupStyle, direction: 'ltr' }}>
                  <button
                    type="button"
                    style={alignButtonStyle(textStyle.growDirection !== 'up')}
                    onClick={() => onTextStyleChange({ growDirection: 'down' })}
                  >
                    ↓ Down
                  </button>
                  <button
                    type="button"
                    style={alignButtonStyle(textStyle.growDirection === 'up')}
                    onClick={() => onTextStyleChange({ growDirection: 'up' })}
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
                  {textStyle.growDirection === 'up'
                    ? 'Content grows upward from the bottom edge.'
                    : 'Content grows downward from the top edge.'}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Font Size - increased max to 500% */}
        <div style={sectionStyle}>
          <label style={labelStyle}>Font Size: {textStyle.fontSize}%</label>
          <input
            type="range"
            min="20"
            max="500"
            value={textStyle.fontSize}
            onChange={(e) => onTextStyleChange({ fontSize: parseInt(e.target.value) })}
            style={{ width: '100%', accentColor: config.color }}
          />
        </div>

        {/* Font Weight */}
        <div style={sectionStyle}>
          <label style={labelStyle}>Font Weight</label>
          <select
            value={textStyle.fontWeight}
            onChange={(e) => onTextStyleChange({ fontWeight: e.target.value })}
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

        {/* Text Color */}
        <div style={sectionStyle}>
          <label style={labelStyle}>Text Color</label>
          <div style={rowStyle}>
            <input
              type="color"
              value={textStyle.color}
              onChange={(e) => onTextStyleChange({ color: e.target.value })}
              style={{ width: '50px', height: '36px', padding: '2px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            />
            <input
              type="text"
              value={textStyle.color}
              onChange={(e) => onTextStyleChange({ color: e.target.value })}
              style={{ ...inputStyle, flex: 1 }}
            />
          </div>
        </div>

        {/* Opacity */}
        <div style={sectionStyle}>
          <label style={labelStyle}>Opacity: {Math.round(textStyle.opacity * 100)}%</label>
          <input
            type="range"
            min="0"
            max="100"
            value={textStyle.opacity * 100}
            onChange={(e) => onTextStyleChange({ opacity: parseInt(e.target.value) / 100 })}
            style={{ width: '100%', accentColor: config.color }}
          />
        </div>

        {/* Horizontal Alignment */}
        <div style={sectionStyle}>
          <label style={labelStyle}>Horizontal Alignment</label>
          <div style={{ ...buttonGroupStyle, direction: 'ltr' }}>
            <button
              type="button"
              style={alignButtonStyle(textStyle.alignH === 'left')}
              onClick={() => onTextStyleChange({ alignH: 'left' })}
            >
              Left
            </button>
            <button
              type="button"
              style={alignButtonStyle(textStyle.alignH === 'center' || !textStyle.alignH)}
              onClick={() => onTextStyleChange({ alignH: 'center' })}
            >
              Center
            </button>
            <button
              type="button"
              style={alignButtonStyle(textStyle.alignH === 'right')}
              onClick={() => onTextStyleChange({ alignH: 'right' })}
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
              type="button"
              style={alignButtonStyle(textStyle.alignV === 'top')}
              onClick={() => onTextStyleChange({ alignV: 'top' })}
            >
              Top
            </button>
            <button
              type="button"
              style={alignButtonStyle(textStyle.alignV === 'center' || !textStyle.alignV)}
              onClick={() => onTextStyleChange({ alignV: 'center' })}
            >
              Center
            </button>
            <button
              type="button"
              style={alignButtonStyle(textStyle.alignV === 'bottom')}
              onClick={() => onTextStyleChange({ alignV: 'bottom' })}
            >
              Bottom
            </button>
          </div>
        </div>

        {/* Position Info */}
        <div style={{
          fontSize: '10px',
          color: 'rgba(255,255,255,0.4)',
          marginTop: '12px',
          padding: '8px',
          background: 'rgba(0,0,0,0.2)',
          borderRadius: '4px'
        }}>
          Position: x={textStyle.x?.toFixed(1)}%, y={textStyle.y?.toFixed(1)}%
          <br />
          Size: {textStyle.width?.toFixed(1)}% × {textStyle.height?.toFixed(1)}%
          <br />
          <span style={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.3)' }}>
            Drag the element on canvas to reposition
          </span>
        </div>
      </div>
    );
  }

  // Render Stage Element Properties Panel
  if (!element || !onElementChange) return null;

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

      {/* Font Size for clock and songTitle - increased max to 500% */}
      {['clock', 'songTitle'].includes(elementType) && (
        <div style={sectionStyle}>
          <label style={labelStyle}>Font Size: {element.fontSize || 100}%</label>
          <input
            type="range"
            min="50"
            max="500"
            value={element.fontSize || 100}
            onChange={(e) => onElementChange({ fontSize: parseInt(e.target.value) })}
            style={{ width: '100%', accentColor: config.color }}
          />
        </div>
      )}

      {/* Font Weight for clock and songTitle */}
      {['clock', 'songTitle'].includes(elementType) && (
        <div style={sectionStyle}>
          <label style={labelStyle}>Font Weight</label>
          <select
            value={element.fontWeight || '600'}
            onChange={(e) => onElementChange({ fontWeight: e.target.value })}
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
      )}

      {/* Horizontal Alignment for clock and songTitle */}
      {['clock', 'songTitle'].includes(elementType) && (
        <div style={sectionStyle}>
          <label style={labelStyle}>Horizontal Alignment</label>
          <div style={{ ...buttonGroupStyle, direction: 'ltr' }}>
            <button
              type="button"
              style={alignButtonStyle(element.alignH === 'left')}
              onClick={() => onElementChange({ alignH: 'left' })}
            >
              Left
            </button>
            <button
              type="button"
              style={alignButtonStyle(element.alignH === 'center' || !element.alignH)}
              onClick={() => onElementChange({ alignH: 'center' })}
            >
              Center
            </button>
            <button
              type="button"
              style={alignButtonStyle(element.alignH === 'right')}
              onClick={() => onElementChange({ alignH: 'right' })}
            >
              Right
            </button>
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
            <label style={labelStyle}>Label Color</label>
            <div style={rowStyle}>
              <input
                type="color"
                value={element.labelColor || '#888888'}
                onChange={(e) => onElementChange({ labelColor: e.target.value })}
                style={{ width: '50px', height: '36px', padding: '2px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              />
              <input
                type="text"
                value={element.labelColor || '#888888'}
                onChange={(e) => onElementChange({ labelColor: e.target.value })}
                style={{ ...inputStyle, flex: 1 }}
              />
            </div>
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
