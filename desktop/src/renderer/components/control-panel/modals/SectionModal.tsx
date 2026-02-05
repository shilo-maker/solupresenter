import React, { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface SectionModalProps {
  onClose: () => void;
  onConfirm: (title: string) => void;
}

const SectionModal: React.FC<SectionModalProps> = ({
  onClose,
  onConfirm
}) => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus input on mount
    inputRef.current?.focus();
  }, []);

  const handleConfirm = () => {
    const title = inputRef.current?.value.trim();
    if (title) {
      onConfirm(title);
    }
  };

  const quickSections = [
    { key: 'Worship', label: t('controlPanel.sectionWorship') },
    { key: 'Sermon', label: t('controlPanel.sectionSermon') },
    { key: 'Prayer', label: t('controlPanel.sectionPrayer') },
    { key: 'Announcements', label: t('controlPanel.sectionAnnouncements') },
    { key: 'Reading', label: t('controlPanel.sectionReading') },
    { key: 'Offering', label: t('controlPanel.sectionOffering') },
    { key: 'Closing', label: t('controlPanel.sectionClosing') }
  ];

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
          background: 'rgba(24, 24, 27, 0.98)',
          borderRadius: '16px',
          padding: '24px',
          minWidth: '350px',
          border: '1px solid rgba(255,255,255,0.2)'
        }}
      >
        <h3 style={{ color: 'white', marginBottom: '16px' }}>
          {t('controlPanel.addSection')}
        </h3>

        {/* Quick section buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
          {quickSections.map((section) => (
            <button
              key={section.key}
              onClick={() => {
                if (inputRef.current) {
                  inputRef.current.value = section.label;
                  inputRef.current.focus();
                }
              }}
              style={{
                background: 'rgba(6,182,212,0.2)',
                border: '1px solid rgba(6,182,212,0.4)',
                borderRadius: '6px',
                padding: '6px 12px',
                color: '#06b6d4',
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
            >
              {section.label}
            </button>
          ))}
        </div>

        <input
          ref={inputRef}
          type="text"
          placeholder={t('controlPanel.orTypeCustomSection')}
          defaultValue=""
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleConfirm();
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
            onClick={handleConfirm}
            style={{
              background: 'linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%)',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 20px',
              color: '#000',
              cursor: 'pointer',
              fontWeight: 600,
              boxShadow: '0 2px 8px rgba(6, 182, 212, 0.4)',
              transition: 'transform 0.15s, box-shadow 0.15s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(6, 182, 212, 0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(6, 182, 212, 0.4)';
            }}
          >
            {t('common.add')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SectionModal;
