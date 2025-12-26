import React from 'react';
import { useTranslation } from 'react-i18next';

function WaitingForPresentation({ screenName }) {
  const { t } = useTranslation();

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: '#1a202c',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#e2e8f0',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{
        fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
        marginBottom: '1rem',
        fontWeight: 500
      }}>
        {screenName || t('remoteScreen.defaultName', 'Remote Screen')}
      </div>
      <div style={{
        fontSize: 'clamp(1rem, 2.5vw, 1.5rem)',
        opacity: 0.7,
        marginBottom: '2rem'
      }}>
        {t('remoteScreen.waiting', 'Waiting for presentation...')}
      </div>
      <div style={{
        width: '50px',
        height: '50px',
        border: '3px solid rgba(255, 255, 255, 0.1)',
        borderTopColor: '#4299e1',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />
      <style>
        {`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
}

export default WaitingForPresentation;
