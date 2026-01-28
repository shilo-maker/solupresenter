import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../contexts/SettingsContext';
import { useThemeState, Theme } from '../hooks/useThemeState';

interface AuthState {
  isAuthenticated: boolean;
  user: { id: string; email: string; role: string } | null;
  token: string | null;
  serverUrl: string;
}

interface RemoteControlStatus {
  running: boolean;
  url: string | null;
  pin: string;
  clients: number;
}

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { settings, updateSetting, resetSettings, isSyncing } = useSettings();
  const [authState, setAuthState] = useState<AuthState | null>(null);
  const [appVersion, setAppVersion] = useState('');
  const [remoteControlStatus, setRemoteControlStatus] = useState<RemoteControlStatus | null>(null);
  const [remoteControlLoading, setRemoteControlLoading] = useState(false);
  const [remoteControlQRCode, setRemoteControlQRCode] = useState<string | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);

  // Theme state
  const {
    themes,
    stageMonitorThemes,
    bibleThemes,
    prayerThemes,
    obsThemes,
    selectedTheme,
    selectedStageTheme,
    selectedBibleTheme,
    selectedPrayerTheme,
    selectedOBSSongsTheme,
    selectedOBSBibleTheme,
    selectedOBSPrayerTheme,
    loadThemes,
    applyViewerTheme,
    applyStageTheme,
    applyBibleTheme,
    applyPrayerTheme,
    applyOBSTheme,
  } = useThemeState();

  // Theme dropdown state
  const [openThemeDropdown, setOpenThemeDropdown] = useState<string | null>(null);

  const loadRemoteControlStatus = useCallback(async () => {
    try {
      const status = await window.electronAPI.remoteControl.getStatus();
      setRemoteControlStatus(status);
      // Load QR code if running
      if (status.running) {
        const qrCode = await window.electronAPI.remoteControl.getQRCode();
        setRemoteControlQRCode(qrCode);
      } else {
        setRemoteControlQRCode(null);
      }
    } catch (error) {
      console.error('Failed to load remote control status:', error);
    }
  }, []);

  useEffect(() => {
    // Load auth state
    window.electronAPI.getAuthState()
      .then(setAuthState)
      .catch((error) => console.error('Failed to load auth state:', error));
    window.electronAPI.getAppVersion()
      .then(setAppVersion)
      .catch((error) => console.error('Failed to load app version:', error));

    // Load remote control status
    loadRemoteControlStatus();

    // Load themes
    loadThemes();

    // Poll for status updates while component is mounted
    const interval = setInterval(loadRemoteControlStatus, 5000);
    return () => clearInterval(interval);
  }, [loadRemoteControlStatus, loadThemes]);

  const handleLanguageChange = async (lang: 'en' | 'he') => {
    await updateSetting('language', lang);
  };

  const handleLogout = async () => {
    await window.electronAPI.logout();
    setAuthState(await window.electronAPI.getAuthState());
  };

  const handleStartRemoteControl = async () => {
    setRemoteControlLoading(true);
    try {
      const result = await window.electronAPI.remoteControl.start();
      if (result.success) {
        await loadRemoteControlStatus();
      } else {
        console.error('Failed to start remote control:', result.error);
      }
    } catch (error) {
      console.error('Failed to start remote control:', error);
    } finally {
      setRemoteControlLoading(false);
    }
  };

  const handleStopRemoteControl = async () => {
    setRemoteControlLoading(true);
    try {
      await window.electronAPI.remoteControl.stop();
      await loadRemoteControlStatus();
    } catch (error) {
      console.error('Failed to stop remote control:', error);
    } finally {
      setRemoteControlLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    window.electronAPI.copyToClipboard(text);
  };

  const isRTL = i18n.language === 'he';

  // Memoized OBS theme filters
  const obsSongsThemes = useMemo(() => obsThemes.filter(t => t.type === 'songs'), [obsThemes]);
  const obsBibleThemes = useMemo(() => obsThemes.filter(t => t.type === 'bible'), [obsThemes]);
  const obsPrayerThemes = useMemo(() => obsThemes.filter(t => t.type === 'prayer'), [obsThemes]);

  // Theme dropdown renderer
  const renderThemeDropdown = (
    id: string,
    label: string,
    themeList: Theme[],
    selectedThemeObj: Theme | null,
    onApply: (theme: Theme) => void,
    editRoute: string,
    borderColor: string
  ) => (
    <div style={{ marginBottom: '12px', position: 'relative' }}>
      <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>
        {label}
      </label>
      <button
        onClick={() => setOpenThemeDropdown(openThemeDropdown === id ? null : id)}
        style={{
          width: '100%',
          padding: '10px 14px',
          background: 'rgba(255,255,255,0.1)',
          border: `1px solid ${borderColor}`,
          borderRadius: '8px',
          color: 'white',
          fontSize: '0.9rem',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          textAlign: isRTL ? 'right' : 'left',
        }}
      >
        <span>{selectedThemeObj?.name || t('controlPanel.selectTheme', 'Select...')}</span>
        <span style={{ fontSize: '0.6rem', transform: openThemeDropdown === id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
      </button>
      {openThemeDropdown === id && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          background: '#2a2a3e',
          border: `1px solid ${borderColor}`,
          borderRadius: '8px',
          marginTop: '4px',
          zIndex: 100,
          maxHeight: '200px',
          overflowY: 'auto',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}>
          {themeList.map((theme) => (
            <div
              key={theme.id}
              onClick={() => { onApply(theme); setOpenThemeDropdown(null); }}
              style={{
                padding: '10px 12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                background: selectedThemeObj?.id === theme.id ? `${borderColor}33` : 'transparent',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => { if (selectedThemeObj?.id !== theme.id) e.currentTarget.style.background = `${borderColor}22`; }}
              onMouseLeave={(e) => { if (selectedThemeObj?.id !== theme.id) e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ color: 'white', fontSize: '0.85rem' }}>{theme.name}</span>
              <button
                onClick={(e) => { e.stopPropagation(); navigate(`${editRoute}?id=${theme.id}`); setOpenThemeDropdown(null); }}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '4px 8px',
                  color: 'rgba(255,255,255,0.7)',
                  fontSize: '0.7rem',
                  cursor: 'pointer'
                }}
              >
                {t('common.edit', 'Edit')}
              </button>
            </div>
          ))}
          {themeList.length === 0 && (
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', textAlign: 'center', padding: '12px' }}>
              {t('controlPanel.noThemesAvailable')}
            </p>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div
      style={{
        height: '100vh',
        overflow: 'auto',
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
          <h2 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: '#06b6d4' }}>
            {t('settings.language')}
          </h2>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => handleLanguageChange('en')}
              style={{
                flex: 1,
                padding: '16px',
                borderRadius: '8px',
                border: settings.language === 'en' ? '2px solid #06b6d4' : '2px solid rgba(255,255,255,0.2)',
                background: settings.language === 'en' ? 'rgba(6, 182, 212, 0.2)' : 'rgba(255,255,255,0.05)',
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
                border: settings.language === 'he' ? '2px solid #06b6d4' : '2px solid rgba(255,255,255,0.2)',
                background: settings.language === 'he' ? 'rgba(6, 182, 212, 0.2)' : 'rgba(255,255,255,0.05)',
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
          <h2 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: '#06b6d4' }}>
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
                  border: settings.displayMode === 'bilingual' ? '2px solid #06b6d4' : '2px solid rgba(255,255,255,0.2)',
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
                  border: settings.displayMode === 'original' ? '2px solid #06b6d4' : '2px solid rgba(255,255,255,0.2)',
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

        {/* UI Scale Section */}
        <section
          style={{
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '20px'
          }}
        >
          <h2 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: '#06b6d4' }}>
            {t('settings.uiScale')}
          </h2>

          <div style={{ marginBottom: '8px' }}>
            <label style={{ display: 'block', marginBottom: '12px', fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>
              {t('settings.uiScaleDescription')}
            </label>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <input
                type="range"
                min="0.8"
                max="1.5"
                step="0.05"
                value={settings.uiScale}
                onChange={(e) => updateSetting('uiScale', parseFloat(e.target.value))}
                style={{
                  flex: 1,
                  height: '6px',
                  accentColor: '#06b6d4',
                  cursor: 'pointer'
                }}
              />
              <span style={{
                minWidth: '60px',
                textAlign: 'center',
                padding: '6px 12px',
                background: 'rgba(6, 182, 212, 0.2)',
                borderRadius: '6px',
                fontSize: '0.9rem',
                fontWeight: 600
              }}>
                {Math.round(settings.uiScale * 100)}%
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
              <span>80%</span>
              <span>100%</span>
              <span>150%</span>
            </div>

            {settings.uiScale !== 1.0 && (
              <button
                onClick={() => updateSetting('uiScale', 1.0)}
                style={{
                  marginTop: '12px',
                  padding: '8px 16px',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '6px',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
              >
                {t('settings.resetToDefault')}
              </button>
            )}
          </div>
        </section>

        {/* Global Themes Section */}
        <section
          style={{
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '20px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#06b6d4' }}>
              {t('settings.globalThemes', 'Global Themes')}
            </h2>
            <button
              onClick={() => navigate('/theme-editor')}
              style={{
                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 12px',
                color: 'white',
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <span>+</span> {t('themes.createNew', 'Create New')}
            </button>
          </div>

          <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginBottom: '16px' }}>
            {t('settings.globalThemesDescription', 'Set default themes for all displays. Individual displays can override these in the Display menu.')}
          </p>

          {/* Main Themes */}
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', color: 'rgba(255,255,255,0.8)' }}>
              {t('settings.mainThemes', 'Main Themes')}
            </h3>
            {renderThemeDropdown('songs', t('controlPanel.songsTheme', 'Songs Theme'), themes, selectedTheme, applyViewerTheme, '/theme-editor', 'rgba(102, 126, 234, 0.5)')}
            {renderThemeDropdown('stage', t('controlPanel.stageMonitorTheme', 'Stage Monitor'), stageMonitorThemes, selectedStageTheme, applyStageTheme, '/stage-monitor-editor', 'rgba(240, 147, 251, 0.5)')}
            {renderThemeDropdown('bible', t('controlPanel.bibleTheme', 'Bible'), bibleThemes, selectedBibleTheme, applyBibleTheme, '/bible-theme-editor', 'rgba(76, 175, 80, 0.5)')}
            {renderThemeDropdown('prayer', t('controlPanel.prayerTheme', 'Prayer/Sermon'), prayerThemes, selectedPrayerTheme, applyPrayerTheme, '/prayer-theme-editor', 'rgba(6, 182, 212, 0.5)')}
          </div>

          {/* OBS Themes */}
          <div>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', color: 'rgba(255,255,255,0.8)' }}>
              {t('settings.obsThemes', 'OBS Themes')}
            </h3>
            {renderThemeDropdown('obs-songs', t('controlPanel.obsSongsTheme', 'OBS Songs'), obsSongsThemes, selectedOBSSongsTheme || null, applyOBSTheme, '/obs-songs-theme-editor', 'rgba(102, 126, 234, 0.5)')}
            {renderThemeDropdown('obs-bible', t('controlPanel.obsBibleTheme', 'OBS Bible'), obsBibleThemes, selectedOBSBibleTheme || null, applyOBSTheme, '/obs-bible-theme-editor', 'rgba(76, 175, 80, 0.5)')}
            {renderThemeDropdown('obs-prayer', t('controlPanel.obsPrayerTheme', 'OBS Prayer'), obsPrayerThemes, selectedOBSPrayerTheme || null, applyOBSTheme, '/obs-prayer-theme-editor', 'rgba(6, 182, 212, 0.5)')}
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
          <h2 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: '#06b6d4' }}>
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
                    background: settings.syncEnabled ? '#06b6d4' : 'rgba(255,255,255,0.2)',
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
                  background: 'rgba(6, 182, 212, 0.2)',
                  border: '1px solid rgba(6, 182, 212, 0.4)',
                  borderRadius: '8px',
                  color: '#06b6d4',
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
          <h2 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: '#06b6d4' }}>
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
                background: settings.autoConnect ? '#06b6d4' : 'rgba(255,255,255,0.2)',
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
                background: settings.showTutorial ? '#06b6d4' : 'rgba(255,255,255,0.2)',
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

        {/* Remote Control Section */}
        <section
          style={{
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '20px'
          }}
        >
          <h2 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: '#06b6d4' }}>
            {t('settings.remoteControl', 'Remote Control')}
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginBottom: '16px' }}>
            {t('settings.remoteControlDescription', 'Control SoluPresenter from your mobile device on the local network.')}
          </p>

          {remoteControlStatus?.running ? (
            <div>
              {/* Status display */}
              <div
                style={{
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '8px',
                  padding: '16px',
                  marginBottom: '16px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <div
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: '#10b981',
                      boxShadow: '0 0 8px rgba(16, 185, 129, 0.5)'
                    }}
                  />
                  <span style={{ color: '#10b981', fontWeight: 500 }}>
                    {t('settings.remoteControlRunning', 'Running')}
                  </span>
                  {remoteControlStatus.clients > 0 && (
                    <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>
                      ({remoteControlStatus.clients} {t('settings.connected', 'connected')})
                    </span>
                  )}
                </div>

                {/* URL */}
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>
                    {t('settings.url', 'URL')}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <code
                      style={{
                        flex: 1,
                        background: 'rgba(0,0,0,0.3)',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        fontSize: '0.9rem',
                        fontFamily: 'monospace'
                      }}
                    >
                      {remoteControlStatus.url}
                    </code>
                    <button
                      onClick={() => copyToClipboard(remoteControlStatus.url || '')}
                      style={{
                        padding: '8px 12px',
                        background: 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '6px',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '0.8rem'
                      }}
                    >
                      {t('common.copy', 'Copy')}
                    </button>
                  </div>
                </div>

                {/* PIN */}
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>
                    {t('settings.pin', 'PIN')}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <code
                      style={{
                        background: 'rgba(0,0,0,0.3)',
                        padding: '8px 16px',
                        borderRadius: '6px',
                        fontSize: '1.5rem',
                        fontFamily: 'monospace',
                        letterSpacing: '4px',
                        fontWeight: 'bold'
                      }}
                    >
                      {remoteControlStatus.pin}
                    </code>
                  </div>
                </div>
              </div>

              {/* QR Code */}
              {remoteControlQRCode && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '16px',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '8px',
                    marginBottom: '16px'
                  }}
                >
                  <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginBottom: '12px' }}>
                    {t('settings.scanToConnect', 'Scan to connect instantly')}
                  </div>
                  <div
                    style={{
                      background: 'white',
                      padding: '8px',
                      borderRadius: '8px'
                    }}
                  >
                    <img
                      src={remoteControlQRCode}
                      alt="QR Code"
                      style={{ display: 'block', width: '180px', height: '180px' }}
                    />
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginTop: '8px', textAlign: 'center' }}>
                    {t('settings.qrCodeInstructions', 'Includes URL and PIN for instant access')}
                  </div>
                </div>
              )}

              {/* Stop button */}
              <button
                onClick={handleStopRemoteControl}
                disabled={remoteControlLoading}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  borderRadius: '8px',
                  color: '#ef4444',
                  cursor: remoteControlLoading ? 'not-allowed' : 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  opacity: remoteControlLoading ? 0.5 : 1
                }}
              >
                {remoteControlLoading ? t('common.loading', 'Loading...') : t('settings.stopRemoteControl', 'Stop Remote Control')}
              </button>
            </div>
          ) : (
            <button
              onClick={handleStartRemoteControl}
              disabled={remoteControlLoading}
              style={{
                width: '100%',
                padding: '14px',
                background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                cursor: remoteControlLoading ? 'not-allowed' : 'pointer',
                fontSize: '0.95rem',
                fontWeight: 600,
                opacity: remoteControlLoading ? 0.5 : 1
              }}
            >
              {remoteControlLoading ? t('common.loading', 'Loading...') : t('settings.startRemoteControl', 'Start Remote Control')}
            </button>
          )}
        </section>

        {/* Advanced/Performance Section */}
        <section
          style={{
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '20px'
          }}
        >
          <h2 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: '#06b6d4' }}>
            {t('settings.advanced', 'Advanced')}
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginBottom: '16px' }}>
            {t('settings.advancedDescription', 'Configure timeout values for media operations. Increase these if you experience loading issues on slower connections.')}
          </p>

          {/* Media Load Timeout */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.9rem' }}>{t('settings.mediaLoadTimeout', 'Media Load Timeout')}</span>
              <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>{settings.mediaLoadTimeout}s</span>
            </label>
            <input
              type="range"
              min="5"
              max="60"
              step="5"
              value={settings.mediaLoadTimeout}
              onChange={(e) => updateSetting('mediaLoadTimeout', parseInt(e.target.value))}
              style={{
                width: '100%',
                height: '8px',
                borderRadius: '4px',
                background: 'rgba(255,255,255,0.2)',
                outline: 'none',
                cursor: 'pointer'
              }}
              aria-label={t('settings.mediaLoadTimeout', 'Media Load Timeout')}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
              <span>5s</span>
              <span>60s</span>
            </div>
          </div>

          {/* Thumbnail Generation Timeout */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.9rem' }}>{t('settings.thumbnailTimeout', 'Thumbnail Generation Timeout')}</span>
              <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>{settings.thumbnailGenerationTimeout}s</span>
            </label>
            <input
              type="range"
              min="3"
              max="30"
              step="1"
              value={settings.thumbnailGenerationTimeout}
              onChange={(e) => updateSetting('thumbnailGenerationTimeout', parseInt(e.target.value))}
              style={{
                width: '100%',
                height: '8px',
                borderRadius: '4px',
                background: 'rgba(255,255,255,0.2)',
                outline: 'none',
                cursor: 'pointer'
              }}
              aria-label={t('settings.thumbnailTimeout', 'Thumbnail Generation Timeout')}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
              <span>3s</span>
              <span>30s</span>
            </div>
          </div>

          {/* YouTube Search Timeout */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.9rem' }}>{t('settings.youtubeSearchTimeout', 'YouTube Search Timeout')}</span>
              <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>{settings.youtubeSearchTimeout}s</span>
            </label>
            <input
              type="range"
              min="5"
              max="60"
              step="5"
              value={settings.youtubeSearchTimeout}
              onChange={(e) => updateSetting('youtubeSearchTimeout', parseInt(e.target.value))}
              style={{
                width: '100%',
                height: '8px',
                borderRadius: '4px',
                background: 'rgba(255,255,255,0.2)',
                outline: 'none',
                cursor: 'pointer'
              }}
              aria-label={t('settings.youtubeSearchTimeout', 'YouTube Search Timeout')}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
              <span>5s</span>
              <span>60s</span>
            </div>
          </div>

          {/* Reset to defaults button */}
          <button
            onClick={() => {
              updateSetting('mediaLoadTimeout', 15);
              updateSetting('thumbnailGenerationTimeout', 8);
              updateSetting('youtubeSearchTimeout', 15);
            }}
            style={{
              padding: '8px 16px',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '6px',
              color: 'rgba(255,255,255,0.6)',
              cursor: 'pointer',
              fontSize: '0.85rem'
            }}
          >
            {t('settings.resetToDefaults', 'Reset to Defaults')}
          </button>
        </section>

        {/* Import/Export Section */}
        <section
          style={{
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '20px'
          }}
        >
          <h2 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: '#06b6d4' }}>
            {t('settings.importExport', 'Import / Export')}
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginBottom: '16px' }}>
            {t('settings.importExportDescription', 'Export your songs database to a JSON file for backup, or import songs from a previously exported file.')}
          </p>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {/* Export Button */}
            <button
              onClick={async () => {
                try {
                  const result = await window.electronAPI.showSaveDialog({
                    defaultPath: `solupresenter-songs-${new Date().toISOString().split('T')[0]}.json`,
                    filters: [{ name: 'JSON Files', extensions: ['json'] }]
                  });

                  if (!result.canceled && result.filePath) {
                    const jsonData = await window.electronAPI.exportSongsJSON();
                    await window.electronAPI.writeFile(result.filePath, jsonData);
                    alert(t('settings.exportSuccess', 'Songs exported successfully!'));
                  }
                } catch (error) {
                  console.error('Export failed:', error);
                  alert(t('settings.exportError', 'Failed to export songs. Please try again.'));
                }
              }}
              style={{
                flex: 1,
                minWidth: '150px',
                padding: '14px 20px',
                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {t('settings.exportSongs', 'Export Songs')}
            </button>

            {/* Import Button */}
            <button
              onClick={async () => {
                try {
                  const result = await window.electronAPI.showOpenDialog({
                    filters: [{ name: 'JSON Files', extensions: ['json'] }]
                  });

                  if (!result.canceled && result.filePaths.length > 0) {
                    const jsonData = await window.electronAPI.readFile(result.filePaths[0]);
                    const importResult = await window.electronAPI.importSongsJSON(jsonData);

                    alert(t('settings.importResult', `Import complete!\n\nImported: ${importResult.imported}\nSkipped (duplicates): ${importResult.skipped}\nErrors: ${importResult.errors}`));
                  }
                } catch (error) {
                  console.error('Import failed:', error);
                  alert(t('settings.importError', 'Failed to import songs. Please check that the file is a valid JSON export.'));
                }
              }}
              style={{
                flex: 1,
                minWidth: '150px',
                padding: '14px 20px',
                background: 'rgba(6, 182, 212, 0.2)',
                border: '1px solid rgba(6, 182, 212, 0.4)',
                borderRadius: '8px',
                color: '#06b6d4',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              {t('settings.importSongs', 'Import Songs')}
            </button>
          </div>

          <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginTop: '12px' }}>
            {t('settings.importNote', 'Note: Importing will skip songs that already exist with the same title.')}
          </p>
        </section>

        {/* Theme Import/Export Section */}
        <section
          style={{
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '20px'
          }}
        >
          <h2 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: '#f59e0b' }}>
            {t('settings.themeImportExport', 'Theme Import / Export')}
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginBottom: '16px' }}>
            {t('settings.themeImportExportDescription', 'Export all your custom themes (Songs, Bible, Prayer, Stage, and OBS themes) to a JSON file for backup or transfer to another device.')}
          </p>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {/* Export Themes Button */}
            <button
              onClick={async () => {
                try {
                  const result = await window.electronAPI.showSaveDialog({
                    defaultPath: `solupresenter-themes-${new Date().toISOString().split('T')[0]}.json`,
                    filters: [{ name: 'JSON Files', extensions: ['json'] }]
                  });

                  if (!result.canceled && result.filePath) {
                    const jsonData = await window.electronAPI.exportThemesJSON();
                    await window.electronAPI.writeFile(result.filePath, jsonData);
                    alert(t('settings.themeExportSuccess', 'Themes exported successfully!'));
                  }
                } catch (error) {
                  console.error('Theme export failed:', error);
                  alert(t('settings.themeExportError', 'Failed to export themes. Please try again.'));
                }
              }}
              style={{
                flex: 1,
                minWidth: '150px',
                padding: '14px 20px',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {t('settings.exportThemes', 'Export Themes')}
            </button>

            {/* Import Themes Button */}
            <button
              onClick={async () => {
                try {
                  const result = await window.electronAPI.showOpenDialog({
                    filters: [{ name: 'JSON Files', extensions: ['json'] }]
                  });

                  if (!result.canceled && result.filePaths.length > 0) {
                    const jsonData = await window.electronAPI.readFile(result.filePaths[0]);
                    const importResult = await window.electronAPI.importThemesJSON(jsonData);

                    const message = t('settings.themeImportResult',
                      `Theme import complete!\n\n` +
                      `Songs Themes: ${importResult.viewerThemes.imported} imported, ${importResult.viewerThemes.skipped} skipped\n` +
                      `Bible Themes: ${importResult.bibleThemes.imported} imported, ${importResult.bibleThemes.skipped} skipped\n` +
                      `Prayer Themes: ${importResult.prayerThemes.imported} imported, ${importResult.prayerThemes.skipped} skipped\n` +
                      `Stage Themes: ${importResult.stageThemes.imported} imported, ${importResult.stageThemes.skipped} skipped\n` +
                      `OBS Themes: ${importResult.obsThemes.imported} imported, ${importResult.obsThemes.skipped} skipped\n\n` +
                      `Total: ${importResult.total.imported} imported, ${importResult.total.skipped} skipped, ${importResult.total.errors} errors`
                    );
                    alert(message);
                  }
                } catch (error) {
                  console.error('Theme import failed:', error);
                  alert(t('settings.themeImportError', 'Failed to import themes. Please check that the file is a valid theme export.'));
                }
              }}
              style={{
                flex: 1,
                minWidth: '150px',
                padding: '14px 20px',
                background: 'rgba(245, 158, 11, 0.2)',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                borderRadius: '8px',
                color: '#f59e0b',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              {t('settings.importThemes', 'Import Themes')}
            </button>
          </div>

          <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginTop: '12px' }}>
            {t('settings.themeImportNote', 'Note: Built-in themes are not exported. Importing will skip themes that already exist with the same name.')}
          </p>
        </section>

        {/* Sync Official Database Section */}
        <section
          style={{
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '20px'
          }}
        >
          <h2 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: '#10b981' }}>
            {t('settings.syncOfficialDatabase', 'Sync Official Database')}
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginBottom: '16px' }}>
            {t('settings.syncOfficialDatabaseDescription', 'Download and sync songs from the official SoluCast online database. This will add new songs and update existing songs to match the official versions. Your local-only songs will not be affected.')}
          </p>

          <button
            onClick={async () => {
              if (syncLoading) return;

              const confirmSync = confirm(t('settings.syncConfirm', 'This will sync your song database with the official online database.\n\n• New songs will be added\n• Existing synced songs will be updated\n• Your local-only songs will NOT be changed\n\nContinue?'));
              if (!confirmSync) return;

              setSyncLoading(true);
              try {
                const result = await window.electronAPI.importSongs('https://solupresenter-backend-4rn5.onrender.com');
                alert(t('settings.syncResult', `Sync complete!\n\nNew songs added: ${result.imported}\nSongs updated: ${result.updated}\nErrors: ${result.errors}`));
              } catch (error) {
                console.error('Sync failed:', error);
                alert(t('settings.syncError', 'Failed to sync with the official database. Please check your internet connection and try again.'));
              } finally {
                setSyncLoading(false);
              }
            }}
            disabled={syncLoading}
            style={{
              width: '100%',
              padding: '14px 20px',
              background: syncLoading ? 'rgba(16, 185, 129, 0.5)' : 'linear-gradient(135deg, #10b981, #059669)',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              cursor: syncLoading ? 'not-allowed' : 'pointer',
              fontSize: '0.95rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              opacity: syncLoading ? 0.7 : 1
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
            </svg>
            {syncLoading ? t('settings.syncing', 'Syncing...') : t('settings.syncNow', 'Sync with Official Database')}
          </button>

          <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginTop: '12px' }}>
            {t('settings.syncNote', 'Note: This is a one-way sync. Changes you make locally will not be uploaded to the official database.')}
          </p>
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
          <h2 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: '#06b6d4' }}>
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
