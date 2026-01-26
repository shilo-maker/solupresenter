import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { gradientPresets } from '../../utils/gradients';

interface BackgroundSelectorProps {
  isOpen: boolean;
  selectedBackground: string;
  isRTL: boolean;
  onToggle: () => void;
  onSelectBackground: (value: string) => void;
  onClearBackground: () => void;
}

const BackgroundSelector = memo<BackgroundSelectorProps>(({
  isOpen,
  selectedBackground,
  isRTL,
  onToggle,
  onSelectBackground,
  onClearBackground
}) => {
  const { t } = useTranslation();

  return (
    <div data-panel="background" style={{ position: 'relative' }}>
      <button
        onClick={onToggle}
        style={{
          background: selectedBackground ? 'linear-gradient(135deg, #667eea, #764ba2)' : 'rgba(255,255,255,0.1)',
          border: 'none',
          borderRadius: '6px',
          padding: '5px 10px',
          color: 'white',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: '0.75rem'
        }}
      >
        {String.fromCodePoint(0x1F5BC)} {t('controlPanel.bg')}
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: isRTL ? 'auto' : 0,
          left: isRTL ? 0 : 'auto',
          marginTop: '8px',
          background: 'rgba(30, 30, 50, 0.98)',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.2)',
          padding: '12px',
          width: '280px',
          maxHeight: '400px',
          overflowY: 'auto',
          zIndex: 1000,
          boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h4 style={{ margin: 0, color: 'white', fontSize: '0.9rem' }}>{t('controlPanel.backgrounds')}</h4>
            {selectedBackground && (
              <button
                onClick={onClearBackground}
                style={{
                  background: 'rgba(220, 53, 69, 0.2)',
                  border: '1px solid rgba(220, 53, 69, 0.4)',
                  borderRadius: '4px',
                  padding: '2px 8px',
                  color: '#dc3545',
                  fontSize: '0.7rem',
                  cursor: 'pointer'
                }}
              >
                {t('common.clear')}
              </button>
            )}
          </div>

          {/* Gradients Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '6px'
          }}>
            {gradientPresets.map(gradient => (
              <div
                key={gradient.id}
                onClick={() => onSelectBackground(gradient.value)}
                title={gradient.name}
                style={{
                  aspectRatio: '16/9',
                  background: gradient.value,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  border: selectedBackground === gradient.value
                    ? '2px solid #06b6d4'
                    : '2px solid transparent',
                  transition: 'all 0.15s ease',
                  boxShadow: selectedBackground === gradient.value
                    ? '0 0 8px rgba(6, 182, 212, 0.4)'
                    : 'none'
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

BackgroundSelector.displayName = 'BackgroundSelector';

export default BackgroundSelector;
