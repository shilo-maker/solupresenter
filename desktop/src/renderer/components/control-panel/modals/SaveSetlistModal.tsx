import React, { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface SaveSetlistModalProps {
  initialName: string;
  onClose: () => void;
  onSave: (name: string, venue: string) => void;
}

const SaveSetlistModal: React.FC<SaveSetlistModalProps> = ({
  initialName,
  onClose,
  onSave
}) => {
  const { t } = useTranslation();
  const nameRef = useRef<HTMLInputElement>(null);
  const venueRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus name input on mount
    nameRef.current?.focus();
  }, []);

  const handleSave = () => {
    const name = nameRef.current?.value.trim() || '';
    const venue = venueRef.current?.value.trim() || '';
    if (name) {
      onSave(name, venue);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2100
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'rgba(30,30,50,0.98)',
          borderRadius: '16px',
          padding: '24px',
          minWidth: '400px',
          border: '1px solid rgba(255,255,255,0.2)'
        }}
      >
        <h3 style={{ color: 'white', marginBottom: '16px' }}>
          {t('controlPanel.saveSetlist')}
        </h3>

        <input
          ref={nameRef}
          type="text"
          placeholder={t('controlPanel.setlistName')}
          defaultValue={initialName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') onClose();
          }}
          autoFocus
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '8px',
            padding: '12px',
            color: 'white',
            marginBottom: '8px'
          }}
        />

        <input
          ref={venueRef}
          type="text"
          placeholder={t('controlPanel.venueOptional')}
          defaultValue=""
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') onClose();
          }}
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '8px',
            padding: '12px',
            color: 'white',
            marginBottom: '16px'
          }}
        />

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 20px',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            style={{
              background: 'linear-gradient(135deg, #3b82f6, #60a5fa)',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 20px',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SaveSetlistModal;
