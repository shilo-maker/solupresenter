import React from 'react';
import { useTranslation } from 'react-i18next';

interface UnsavedChangesModalProps {
  actionType: 'load' | 'clear' | 'new';
  onCancel: () => void;
  onSaveFirst: () => void;
  onDiscard: () => void;
}

const UnsavedChangesModal: React.FC<UnsavedChangesModalProps> = ({
  actionType,
  onCancel,
  onSaveFirst,
  onDiscard
}) => {
  const { t } = useTranslation();

  const getActionText = () => {
    switch (actionType) {
      case 'load':
        return 'load a different setlist';
      case 'clear':
        return 'clear the setlist';
      case 'new':
        return 'start a new setlist';
      default:
        return 'continue';
    }
  };

  return (
    <div
      onClick={onCancel}
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
        style={{
          background: 'linear-gradient(135deg, rgba(30,30,50,0.98), rgba(20,20,40,0.98))',
          borderRadius: '16px',
          padding: '24px',
          minWidth: '350px',
          maxWidth: '450px',
          border: '1px solid rgba(255,193,7,0.4)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <span style={{ fontSize: '2rem' }}>&#9888;&#65039;</span>
          <h3 style={{ color: 'white', margin: 0, fontSize: '1.1rem' }}>
            {t('controlPanel.unsavedChanges')}
          </h3>
        </div>

        <p style={{ color: 'rgba(255,255,255,0.8)', marginBottom: '20px', lineHeight: 1.5 }}>
          You have unsaved changes to your setlist. Are you sure you want to {getActionText()}? Your changes will be lost.
        </p>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '8px',
              padding: '10px 20px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            Cancel
          </button>
          <button
            onClick={onSaveFirst}
            style={{
              background: 'linear-gradient(135deg, #3b82f6, #60a5fa)',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 20px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 600
            }}
          >
            Save First
          </button>
          <button
            onClick={onDiscard}
            style={{
              background: 'linear-gradient(135deg, #ef4444, #f87171)',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 20px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 600
            }}
          >
            Discard
          </button>
        </div>
      </div>
    </div>
  );
};

export default UnsavedChangesModal;
