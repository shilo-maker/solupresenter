import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface TemplateSelectionModalProps {
  onClose: () => void;
  onSelectQuickMode: (type: 'sermon' | 'prayer' | 'announcements') => void;
}

const TemplateSelectionModal: React.FC<TemplateSelectionModalProps> = ({
  onClose,
  onSelectQuickMode
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const templateCardStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.05)',
    border: '2px solid rgba(255,255,255,0.1)',
    borderRadius: '12px',
    padding: '20px',
    cursor: 'pointer',
    transition: 'all 0.2s'
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
    e.currentTarget.style.borderColor = 'rgba(6,182,212,0.5)';
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
  };

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
          background: '#1a1a2e',
          borderRadius: '16px',
          padding: '24px',
          maxWidth: '600px',
          width: '90%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
        }}
      >
        <h2 style={{ margin: '0 0 8px 0', color: 'white', fontSize: '1.4rem' }}>
          New Presentation
        </h2>
        <p style={{ margin: '0 0 20px 0', color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>
          Choose a template to get started
        </p>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '12px'
        }}>
          {/* Blank Template */}
          <div
            onClick={() => {
              onClose();
              navigate('/presentation-editor', { state: { template: 'blank' } });
            }}
            style={templateCardStyle}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>📄</div>
            <div style={{ color: 'white', fontWeight: 600, marginBottom: '4px' }}>{t('controlPanel.blank')}</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>{t('controlPanel.startFromScratch')}</div>
          </div>

          {/* Sermon Points */}
          <div
            onClick={() => {
              onClose();
              setTimeout(() => onSelectQuickMode('sermon'), 50);
            }}
            style={templateCardStyle}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>📋</div>
            <div style={{ color: 'white', fontWeight: 600, marginBottom: '4px' }}>{t('controlPanel.sermonPoints')}</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>{t('controlPanel.titleWithNumberedPoints')}</div>
          </div>

          {/* Prayer Points */}
          <div
            onClick={() => {
              onClose();
              setTimeout(() => onSelectQuickMode('prayer'), 50);
            }}
            style={templateCardStyle}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>🙏</div>
            <div style={{ color: 'white', fontWeight: 600, marginBottom: '4px' }}>{t('controlPanel.prayerPoints')}</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>{t('controlPanel.bulletPointsForPrayer')}</div>
          </div>

          {/* Announcements */}
          <div
            onClick={() => {
              onClose();
              setTimeout(() => onSelectQuickMode('announcements'), 50);
            }}
            style={templateCardStyle}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>📢</div>
            <div style={{ color: 'white', fontWeight: 600, marginBottom: '4px' }}>{t('controlPanel.announcements')}</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>{t('controlPanel.titleWithDetails')}</div>
          </div>
        </div>

        <button
          onClick={onClose}
          style={{
            marginTop: '20px',
            width: '100%',
            padding: '12px',
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '8px',
            color: 'rgba(255,255,255,0.7)',
            cursor: 'pointer',
            fontSize: '0.9rem'
          }}
        >
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
};

export default TemplateSelectionModal;
