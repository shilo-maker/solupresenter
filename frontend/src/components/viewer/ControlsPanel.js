import React, { useState } from 'react';
import { Button } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';

const ControlsPanel = React.memo(function ControlsPanel({
  showControls,
  fontSize,
  setFontSize,
  textColor,
  setTextColor,
  showOriginal,
  setShowOriginal,
  showTransliteration,
  setShowTransliteration,
  showTranslation,
  setShowTranslation,
  controlsRef
}) {
  const { t } = useTranslation();
  const [showColorPicker, setShowColorPicker] = useState(false);

  return (
    <div
      ref={controlsRef}
      style={{
        position: 'fixed',
        bottom: '80px',
        left: showControls ? '20px' : '-400px',
        width: '340px',
        maxHeight: '70vh',
        overflowY: 'auto',
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        borderRadius: '16px',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        padding: '20px',
        zIndex: 1000,
        transition: 'left 0.3s ease',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
      }}
    >
      <h6 style={{
        color: 'white',
        marginBottom: '20px',
        fontSize: '1.1rem',
        fontWeight: '600',
        borderBottom: '1px solid rgba(255,255,255,0.2)',
        paddingBottom: '10px'
      }}>
        {t('viewer.displaySettings')}
      </h6>

      {/* Font Size Controls */}
      <div style={{ marginBottom: '25px' }}>
        <label style={{
          color: 'white',
          fontSize: '0.9rem',
          marginBottom: '10px',
          display: 'block',
          fontWeight: '500'
        }}>
          {t('viewer.fontSize')}
        </label>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <Button
            size="sm"
            variant="light"
            onClick={() => setFontSize(Math.max(50, fontSize - 10))}
            style={{
              borderRadius: '8px',
              width: '36px',
              height: '36px',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: '1.2rem'
            }}
          >
            −
          </Button>
          <div style={{
            flex: 1,
            textAlign: 'center',
            color: 'white',
            fontSize: '1.1rem',
            fontWeight: '600',
            backgroundColor: 'rgba(255,255,255,0.1)',
            padding: '8px',
            borderRadius: '8px'
          }}>
            {fontSize}%
          </div>
          <Button
            size="sm"
            variant="light"
            onClick={() => setFontSize(Math.min(200, fontSize + 10))}
            style={{
              borderRadius: '8px',
              width: '36px',
              height: '36px',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: '1.2rem'
            }}
          >
            +
          </Button>
        </div>
        {fontSize !== 100 && (
          <Button
            size="sm"
            variant="outline-light"
            onClick={() => setFontSize(100)}
            style={{
              fontSize: '0.85rem',
              padding: '6px 12px',
              borderRadius: '8px',
              marginTop: '10px',
              width: '100%'
            }}
          >
            {t('viewer.resetTo100')}
          </Button>
        )}
      </div>

      {/* Text Color Controls */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{
          color: 'white',
          fontSize: '0.9rem',
          marginBottom: '10px',
          display: 'block',
          fontWeight: '500'
        }}>
          {t('viewer.textColor')}
        </label>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: '10px',
          marginBottom: '12px'
        }}>
          {['white', '#FFD700', '#87CEEB', '#98FB98', '#FFB6C1', '#DDA0DD'].map((color) => (
            <button
              key={color}
              onClick={() => setTextColor(color)}
              title={color === 'white' ? 'White' : color}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                backgroundColor: color,
                border: textColor === color ? '3px solid white' : '2px solid rgba(255,255,255,0.3)',
                cursor: 'pointer',
                boxShadow: textColor === color ? '0 0 15px rgba(255,255,255,0.6)' : 'none',
                transition: 'all 0.2s ease'
              }}
            />
          ))}
        </div>

        <Button
          size="sm"
          variant="outline-light"
          onClick={() => setShowColorPicker(!showColorPicker)}
          style={{
            fontSize: '0.85rem',
            padding: '6px 12px',
            borderRadius: '8px',
            width: '100%'
          }}
        >
          {showColorPicker ? t('viewer.hide') : t('viewer.customColor')}
        </Button>

        {/* Custom Color Picker */}
        {showColorPicker && (
          <div style={{
            marginTop: '12px',
            padding: '12px',
            backgroundColor: 'rgba(255,255,255,0.1)',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <input
              type="color"
              value={textColor}
              onChange={(e) => setTextColor(e.target.value)}
              style={{
                width: '50px',
                height: '40px',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            />
            <span style={{
              color: 'white',
              fontSize: '0.85rem',
              fontFamily: 'monospace',
              flex: 1,
              textAlign: 'center',
              fontWeight: '600'
            }}>
              {textColor.toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* Display Toggles */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{
          color: 'white',
          fontSize: '0.9rem',
          marginBottom: '10px',
          display: 'block',
          fontWeight: '500'
        }}>
          {t('viewer.showHideLines')}
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div
            onClick={() => setShowOriginal(!showOriginal)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              backgroundColor: showOriginal ? 'rgba(40, 167, 69, 0.3)' : 'rgba(255,255,255,0.1)',
              borderRadius: '8px',
              cursor: 'pointer',
              border: showOriginal ? '1px solid rgba(40, 167, 69, 0.5)' : '1px solid rgba(255,255,255,0.2)',
              transition: 'all 0.2s ease'
            }}
          >
            <span style={{ color: 'white', fontSize: '0.9rem' }}>{t('viewer.originalText')}</span>
            <span style={{ color: showOriginal ? '#10b981' : '#71717a', fontSize: '1.2rem' }}>
              {showOriginal ? '✓' : '○'}
            </span>
          </div>
          <div
            onClick={() => setShowTransliteration(!showTransliteration)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              backgroundColor: showTransliteration ? 'rgba(40, 167, 69, 0.3)' : 'rgba(255,255,255,0.1)',
              borderRadius: '8px',
              cursor: 'pointer',
              border: showTransliteration ? '1px solid rgba(40, 167, 69, 0.5)' : '1px solid rgba(255,255,255,0.2)',
              transition: 'all 0.2s ease'
            }}
          >
            <span style={{ color: 'white', fontSize: '0.9rem' }}>{t('viewer.transliteration')}</span>
            <span style={{ color: showTransliteration ? '#10b981' : '#71717a', fontSize: '1.2rem' }}>
              {showTransliteration ? '✓' : '○'}
            </span>
          </div>
          <div
            onClick={() => setShowTranslation(!showTranslation)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              backgroundColor: showTranslation ? 'rgba(40, 167, 69, 0.3)' : 'rgba(255,255,255,0.1)',
              borderRadius: '8px',
              cursor: 'pointer',
              border: showTranslation ? '1px solid rgba(40, 167, 69, 0.5)' : '1px solid rgba(255,255,255,0.2)',
              transition: 'all 0.2s ease'
            }}
          >
            <span style={{ color: 'white', fontSize: '0.9rem' }}>{t('viewer.translation')}</span>
            <span style={{ color: showTranslation ? '#10b981' : '#71717a', fontSize: '1.2rem' }}>
              {showTranslation ? '✓' : '○'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});

export default ControlsPanel;
