import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../contexts/SettingsContext';

interface AuthState {
  isAuthenticated: boolean;
  user: { id: string; email: string; role: string } | null;
  token: string | null;
  serverUrl: string;
}

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { settings, updateSetting, resetSettings, isSyncing } = useSettings();
  const [authState, setAuthState] = useState<AuthState | null>(null);
  const [appVersion, setAppVersion] = useState('');

  useEffect(() => {
    // Load auth state
    window.electronAPI.getAuthState().then(setAuthState);
    window.electronAPI.getAppVersion().then(setAppVersion);
  }, []);

  const handleLanguageChange = async (lang: 'en' | 'he') => {
    await updateSetting('language', lang);
  };

  const handleLogout = async () => {
    await window.electronAPI.logout();
    setAuthState(await window.electronAPI.getAuthState());
  };

  const isRTL = i18n.language === 'he';

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        color: 'white',
        direction: isRTL ? 'rtl' : 'ltr'
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}
      >
        <button
          onClick={() => navigate('/')}
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: 'none',
            borderRadius: '8px',
            padding: '8px 16px',
            color: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d={isRTL ? "M9 18l6-6-6-6" : "M15 18l-6-6 6-6"} />
          </svg>
          {t('common.back')}
        </button>
        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>{t('settings.title')}</h1>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px' }}>
        {/* Language Section */}
        <section
          style={{
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '20px'
          }}
        >
          <h2 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: '#FF8C42' }}>
            {t('settings.language')}
          </h2>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => handleLanguageChange('en')}
              style={{
                flex: 1,
                padding: '16px',
                borderRadius: '8px',
                border: settings.language === 'en' ? '2px solid #FF8C42' : '2px solid rgba(255,255,255,0.2)',
                background: settings.language === 'en' ? 'rgba(255, 140, 66, 0.2)' : 'rgba(255,255,255,0.05)',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
            >
              <span style={{ fontSize: '1.5rem' }}>🇺🇸</span>
              <span style={{ fontWeight: settings.language === 'en' ? 600 : 400 }}>English</span>
            </button>

            <button
              onClick={() => handleLanguageChange('he')}
              style={{
                flex: 1,
                padding: '16px',
                borderRadius: '8px',
                border: settings.language === 'he' ? '2px solid #FF8C42' : '2px solid rgba(255,255,255,0.2)',
                background: settings.language === 'he' ? 'rgba(255, 140, 66, 0.2)' : 'rgba(255,255,255,0.05)',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
            >
              <span style={{ fontSize: '1.5rem' }}>🇮🇱</span>
              <span style={{ fontWeight: settings.language === 'he' ? 600 : 400 }}>עברית</span>
            </button>
          </div>

          {isSyncing && (
            <div style={{ marginTop: '12px', fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>
              {t('common.loading')}
            </div>
          )}
        </section>

        {/* Display Section */}
        <section
          style={{
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '20px'
          }}
        >
          <h2 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: '#FF8C42' }}>
            {t('settings.display')}
          </h2>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>
              {t('settings.defaultDisplayMode')}
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => updateSetting('displayMode', 'bilingual')}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '8px',
                  border: settings.displayMode === 'bilingual' ? '2px solid #667eea' : '2px solid rgba(255,255,255,0.2)',
                  background: settings.displayMode === 'bilingual' ? 'rgba(102, 126, 234, 0.2)' : 'transparent',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                {t('settings.bilingual')}
              </button>
              <button
                onClick={() => updateSetting('displayMode', 'original')}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '8px',
                  border: settings.displayMode === 'original' ? '2px solid #667eea' : '2px solid rgba(255,255,255,0.2)',
                  background: settings.displayMode === 'original' ? 'rgba(102, 126, 234, 0.2)' : 'transparent',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                {t('settings.originalOnly')}
              </button>
            </div>
          </div>
        </section>

        {/* Account Section */}
        <section
          style={{
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '20px'
          }}
        >
          <h2 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: '#FF8C42' }}>
            {t('settings.account')}
          </h2>

          {authState?.isAuthenticated ? (
            <div>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>
                  {t('settings.loggedInAs')}
                </div>
                <div style={{ fontSize: '1rem' }}>{authState.user?.email}</div>
              </div>

              {/* Sync toggle */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 0',
                  borderTop: '1px solid rgba(255,255,255,0.1)'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.9rem' }}>{t('settings.syncSettings')}</div>
                  <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>
                    {settings.syncEnabled ? t('settings.syncEnabled') : t('settings.localOnly')}
                  </div>
                </div>
                <button
                  onClick={() => updateSetting('syncEnabled', !settings.syncEnabled)}
                  style={{
                    width: '50px',
                    height: '28px',
                    borderRadius: '14px',
                    border: 'none',
                    background: settings.syncEnabled ? '#FF8C42' : 'rgba(255,255,255,0.2)',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'background 0.2s'
                  }}
                >
                  <div
                    style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      background: 'white',
                      position: 'absolute',
                      top: '3px',
                      left: isRTL ? (settings.syncEnabled ? '3px' : '25px') : (settings.syncEnabled ? '25px' : '3px'),
                      transition: 'left 0.2s'
                    }}
                  />
                </button>
              </div>

              <button
                onClick={handleLogout}
                style={{
                  marginTop: '12px',
                  padding: '12px 24px',
                  background: 'rgba(255, 100, 100, 0.2)',
                  border: '1px solid rgba(255, 100, 100, 0.4)',
                  borderRadius: '8px',
                  color: '#ff6b6b',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                {t('auth.logout')}
              </button>
            </div>
          ) : (
            <div>
              <div style={{ marginBottom: '16px', color: 'rgba(255,255,255,0.6)' }}>
                {t('settings.notLoggedIn')}
              </div>
              <button
                onClick={() => navigate('/')}
                style={{
                  padding: '12px 24px',
                  background: 'rgba(255, 140, 66, 0.2)',
                  border: '1px solid rgba(255, 140, 66, 0.4)',
                  borderRadius: '8px',
                  color: '#FF8C42',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                {t('auth.login')}
              </button>
            </div>
          )}
        </section>

        {/* General Section */}
        <section
          style={{
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '20px'
          }}
        >
          <h2 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: '#FF8C42' }}>
            {t('settings.general')}
          </h2>

          {/* Auto-connect toggle */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 0',
              borderBottom: '1px solid rgba(255,255,255,0.1)'
            }}
          >
            <div style={{ fontSize: '0.9rem' }}>{t('settings.autoConnect')}</div>
            <button
              onClick={() => updateSetting('autoConnect', !settings.autoConnect)}
              style={{
                width: '50px',
                height: '28px',
                borderRadius: '14px',
                border: 'none',
                background: settings.autoConnect ? '#FF8C42' : 'rgba(255,255,255,0.2)',
                cursor: 'pointer',
                position: 'relative',
                transition: 'background 0.2s'
              }}
            >
              <div
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  background: 'white',
                  position: 'absolute',
                  top: '3px',
                  left: isRTL ? (settings.autoConnect ? '3px' : '25px') : (settings.autoConnect ? '25px' : '3px'),
                  transition: 'left 0.2s'
                }}
              />
            </button>
          </div>

          {/* Show tutorial toggle */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 0'
            }}
          >
            <div style={{ fontSize: '0.9rem' }}>{t('settings.showTutorial')}</div>
            <button
              onClick={() => updateSetting('showTutorial', !settings.showTutorial)}
              style={{
                width: '50px',
                height: '28px',
                borderRadius: '14px',
                border: 'none',
                background: settings.showTutorial ? '#FF8C42' : 'rgba(255,255,255,0.2)',
                cursor: 'pointer',
                position: 'relative',
                transition: 'background 0.2s'
              }}
            >
              <div
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  background: 'white',
                  position: 'absolute',
                  top: '3px',
                  left: isRTL ? (settings.showTutorial ? '3px' : '25px') : (settings.showTutorial ? '25px' : '3px'),
                  transition: 'left 0.2s'
                }}
              />
            </button>
          </div>
        </section>

        {/* About Section */}
        <section
          style={{
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '20px'
          }}
        >
          <h2 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: '#FF8C42' }}>
            {t('settings.about')}
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'rgba(255,255,255,0.6)' }}>{t('settings.version')}</span>
              <span>{appVersion || '1.0.0'}</span>
            </div>
          </div>

          <button
            onClick={resetSettings}
            style={{
              marginTop: '20px',
              padding: '12px 24px',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '8px',
              color: 'rgba(255,255,255,0.6)',
              cursor: 'pointer',
              fontSize: '0.85rem',
              width: '100%'
            }}
          >
            {t('settings.resetSettings')}
          </button>
        </section>
      </div>
    </div>
  );
}
