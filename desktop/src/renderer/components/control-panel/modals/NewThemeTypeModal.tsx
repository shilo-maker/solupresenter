import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { colors } from '../../../styles/controlPanelStyles';

interface NewThemeTypeModalProps {
  onClose: () => void;
}

const NewThemeTypeModal = memo<NewThemeTypeModalProps>(({ onClose }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleNavigate = (path: string) => {
    onClose();
    navigate(path);
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
          background: 'rgba(24, 24, 27, 0.98)',
          borderRadius: '16px',
          padding: '24px',
          minWidth: '500px',
          maxWidth: '700px',
          border: '1px solid rgba(255,255,255,0.2)'
        }}
      >
        <h3 style={{ color: 'white', marginBottom: '20px', textAlign: 'center' }}>
          {t('controlPanel.createNewTheme')}
        </h3>
        <p style={{ color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginBottom: '24px', fontSize: '0.9rem' }}>
          {t('controlPanel.whatTypeOfTheme', 'What type of theme would you like to create?')}
        </p>

        {/* Main Themes Row */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          {/* Songs Theme */}
          <button
            onClick={() => handleNavigate('/theme-editor')}
            style={{
              background: colors.button.primary,
              border: 'none',
              borderRadius: '12px',
              padding: '16px 20px',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px',
              minWidth: '120px',
              transition: 'transform 0.2s, box-shadow 0.2s'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(102, 126, 234, 0.4)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8M12 17v4" />
            </svg>
            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{t('controlPanel.songsTheme', 'Songs')}</span>
            <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>{t('controlPanel.forSongLyrics', 'Song lyrics')}</span>
          </button>

          {/* Stage Monitor Theme */}
          <button
            onClick={() => handleNavigate('/stage-monitor-editor')}
            style={{
              background: 'linear-gradient(135deg, #f093fb, #f5576c)',
              border: 'none',
              borderRadius: '12px',
              padding: '16px 20px',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px',
              minWidth: '120px',
              transition: 'transform 0.2s, box-shadow 0.2s'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(245, 87, 108, 0.4)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <circle cx="12" cy="10" r="3" />
              <path d="M12 17v4M8 21h8" />
            </svg>
            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{t('controlPanel.stageMonitor')}</span>
            <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>{t('controlPanel.forPerformersOnStage', 'Stage view')}</span>
          </button>

          {/* Bible Theme */}
          <button
            onClick={() => handleNavigate('/bible-theme-editor')}
            style={{
              background: 'linear-gradient(135deg, #4CAF50, #2E7D32)',
              border: 'none',
              borderRadius: '12px',
              padding: '16px 20px',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px',
              minWidth: '120px',
              transition: 'transform 0.2s, box-shadow 0.2s'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(76, 175, 80, 0.4)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{t('controlPanel.bibleTheme', 'Bible')}</span>
            <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>{t('controlPanel.forBibleVerses', 'Bible verses')}</span>
          </button>

          {/* Prayer Theme */}
          <button
            onClick={() => handleNavigate('/prayer-theme-editor')}
            style={{
              background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
              border: 'none',
              borderRadius: '12px',
              padding: '16px 20px',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px',
              minWidth: '120px',
              transition: 'transform 0.2s, box-shadow 0.2s'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(6, 182, 212, 0.4)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L12 6M12 18L12 22M4.93 4.93L7.76 7.76M16.24 16.24L19.07 19.07M2 12L6 12M18 12L22 12M4.93 19.07L7.76 16.24M16.24 7.76L19.07 4.93" />
              <circle cx="12" cy="12" r="4" />
            </svg>
            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{t('controlPanel.prayerTheme', 'Prayer')}</span>
            <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>{t('controlPanel.forPrayerPoints', 'Prayer points')}</span>
          </button>
        </div>

        {/* OBS Themes Row */}
        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <p style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: '12px', fontSize: '0.8rem' }}>
            {t('controlPanel.obsOverlayThemes', 'OBS Overlay Themes')}
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            {/* OBS Songs */}
            <button
              onClick={() => handleNavigate('/obs-songs-theme-editor')}
              style={{
                background: 'linear-gradient(135deg, #17a2b8, #138496)',
                border: 'none',
                borderRadius: '12px',
                padding: '14px 18px',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                minWidth: '110px',
                transition: 'transform 0.2s, box-shadow 0.2s'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(23, 162, 184, 0.4)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polygon points="10 8 16 12 10 16 10 8" />
              </svg>
              <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>{t('controlPanel.obsSongs', 'OBS Songs')}</span>
            </button>

            {/* OBS Bible */}
            <button
              onClick={() => handleNavigate('/obs-bible-theme-editor')}
              style={{
                background: 'linear-gradient(135deg, #17a2b8, #138496)',
                border: 'none',
                borderRadius: '12px',
                padding: '14px 18px',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                minWidth: '110px',
                transition: 'transform 0.2s, box-shadow 0.2s'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(23, 162, 184, 0.4)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 12h8M12 8v8" />
              </svg>
              <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>{t('controlPanel.obsBible', 'OBS Bible')}</span>
            </button>

            {/* OBS Prayer */}
            <button
              onClick={() => handleNavigate('/obs-prayer-theme-editor')}
              style={{
                background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
                border: 'none',
                borderRadius: '12px',
                padding: '14px 18px',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                minWidth: '110px',
                transition: 'transform 0.2s, box-shadow 0.2s'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(6, 182, 212, 0.4)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6M12 14v.01" />
              </svg>
              <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>{t('controlPanel.obsPrayer', 'OBS Prayer')}</span>
            </button>
          </div>
        </div>

        {/* Cancel Button */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 24px',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
});

NewThemeTypeModal.displayName = 'NewThemeTypeModal';

export default NewThemeTypeModal;
