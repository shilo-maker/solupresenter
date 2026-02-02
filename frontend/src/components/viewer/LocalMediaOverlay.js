import React from 'react';
import { useTranslation } from 'react-i18next';

const LocalMediaOverlay = React.memo(function LocalMediaOverlay({ visible, isLocalViewer }) {
  const { t } = useTranslation();

  if (!visible || isLocalViewer) {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      color: 'white',
      textAlign: 'center',
      padding: '20px'
    }}>
      <svg width="80" height="80" viewBox="0 0 16 16" fill="currentColor" style={{ marginBottom: '20px', opacity: 0.7 }}>
        <path d="M0 5a2 2 0 0 1 2-2h7.5a2 2 0 0 1 1.983 1.738l3.11-1.382A1 1 0 0 1 16 4.269v7.462a1 1 0 0 1-1.406.913l-3.111-1.382A2 2 0 0 1 9.5 13H2a2 2 0 0 1-2-2V5z"/>
      </svg>
      <div style={{ fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', fontWeight: '300', marginBottom: '10px' }}>
        {t('viewer.localMediaShowing', 'Local media is being displayed')}
      </div>
      <div style={{ fontSize: 'clamp(1rem, 2.5vw, 1.5rem)', opacity: 0.7 }}>
        {t('viewer.resumingSoon', 'Resuming shortly...')}
      </div>
    </div>
  );
});

export default LocalMediaOverlay;
