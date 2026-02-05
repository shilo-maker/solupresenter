import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';

interface KeyboardHelpModalProps {
  onClose: () => void;
}

const KeyboardHelpModal = memo<KeyboardHelpModalProps>(({ onClose }) => {
  const { t } = useTranslation();

  const shortcuts = [
    { keys: ['→', '↓'], action: 'Next slide' },
    { keys: ['←', '↑'], action: 'Previous slide' },
    { keys: ['Space'], action: 'Toggle Bilingual/Original mode' },
    { keys: ['B'], action: 'Toggle blank screen' },
    { keys: ['Q'], action: 'Open Quick Slide' },
    { keys: ['?', 'F1'], action: 'Show this help' },
    { keys: ['Esc'], action: 'Close modals' }
  ];

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onMouseDown={() => window.focus()}
        style={{
          background: 'linear-gradient(135deg, rgba(24, 24, 27, 0.98), rgba(18, 18, 21, 0.98))',
          borderRadius: '16px',
          padding: '24px',
          minWidth: '400px',
          maxWidth: '500px',
          border: '1px solid rgba(255,255,255,0.2)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ color: 'white', margin: 0, fontSize: '1.2rem' }}>{t('controlPanel.keyboardShortcuts')}</h3>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '6px',
              padding: '4px 8px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {shortcuts.map((shortcut, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 12px',
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '8px'
              }}
            >
              <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.9rem' }}>{shortcut.action}</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                {shortcut.keys.map((key, kidx) => (
                  <kbd
                    key={kidx}
                    style={{
                      background: 'rgba(255,255,255,0.15)',
                      border: '1px solid rgba(255,255,255,0.3)',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      color: 'white',
                      fontSize: '0.8rem',
                      fontFamily: 'monospace',
                      minWidth: '28px',
                      textAlign: 'center'
                    }}
                  >
                    {key}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '16px', textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>
          Press <kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '3px' }}>Esc</kbd> to close
        </div>
      </div>
    </div>
  );
});

KeyboardHelpModal.displayName = 'KeyboardHelpModal';

export default KeyboardHelpModal;
