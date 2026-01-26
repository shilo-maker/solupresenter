import React, { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { colors } from '../../styles/controlPanelStyles';
import ThemeSelectionPanel from './ThemeSelectionPanel';
import BroadcastSelector from '../BroadcastSelector';
import logoImage from '../../assets/logo.png';

interface Display {
  id: number;
  label: string;
  bounds: { x: number; y: number; width: number; height: number };
  isAssigned?: boolean;
  assignedType?: 'viewer' | 'stage';
}

interface Theme {
  id: string;
  name: string;
  [key: string]: any;
}

interface AuthState {
  isAuthenticated: boolean;
  user: { email?: string } | null;
  serverUrl: string;
}

export interface HeaderBarProps {
  // Display state
  showDisplayPanel: boolean;
  displays: Display[];
  assignedDisplays: Display[];
  controlDisplayId: number | null;

  // Online state
  onlineConnected: boolean;
  viewerCount: number;
  roomPin: string;

  // Auth state
  authState: AuthState;
  showUserMenu: boolean;

  // Theme state
  themes: Theme[];
  stageMonitorThemes: Theme[];
  bibleThemes: Theme[];
  prayerThemes: Theme[];
  obsThemes: Theme[];
  selectedTheme: string | Theme | null;
  selectedStageTheme: string | Theme | null;
  selectedBibleTheme: string | Theme | null;
  selectedPrayerTheme: string | Theme | null;
  selectedOBSTheme: string | Theme | null;
  selectedOBSSongsTheme: string | Theme | null;
  selectedOBSBibleTheme: string | Theme | null;
  selectedOBSPrayerTheme: string | Theme | null;

  // OBS state
  obsServerRunning: boolean;
  obsServerUrl: string | null;

  // UI callbacks
  onShowDisplayPanelChange: (show: boolean) => void;
  onShowUserMenuChange: (show: boolean) => void;
  onShowAuthModal: () => void;
  onShowKeyboardHelp: () => void;
  onNavigateToSettings: () => void;

  // Display callbacks
  onControlDisplayChange: (displayId: number) => Promise<void>;
  onOpenDisplay: (displayId: number, type: 'viewer' | 'stage') => void;
  onCloseDisplay: (displayId: number) => void;
  onIdentifyDisplay: (displayId: number) => Promise<void>;

  // Theme callbacks
  onApplyViewerTheme: (theme: Theme) => void;
  onApplyStageTheme: (theme: Theme) => void;
  onApplyBibleTheme: (theme: Theme) => void;
  onApplyPrayerTheme: (theme: Theme) => void;
  onApplyOBSTheme: (theme: Theme) => void;
  onCreateNewTheme: (type: string) => void;
  onCloseDisplayPanel: () => void;

  // OBS callbacks
  onToggleOBSServer: () => Promise<void>;

  // Auth callbacks
  onConnectOnline: () => void;
  onLogout: () => void;
}

const HeaderBar = memo<HeaderBarProps>(({
  showDisplayPanel,
  displays,
  assignedDisplays,
  controlDisplayId,
  onlineConnected,
  viewerCount,
  roomPin,
  authState,
  showUserMenu,
  themes,
  stageMonitorThemes,
  bibleThemes,
  prayerThemes,
  obsThemes,
  selectedTheme,
  selectedStageTheme,
  selectedBibleTheme,
  selectedPrayerTheme,
  selectedOBSTheme,
  selectedOBSSongsTheme,
  selectedOBSBibleTheme,
  selectedOBSPrayerTheme,
  obsServerRunning,
  obsServerUrl,
  onShowDisplayPanelChange,
  onShowUserMenuChange,
  onShowAuthModal,
  onShowKeyboardHelp,
  onNavigateToSettings,
  onControlDisplayChange,
  onOpenDisplay,
  onCloseDisplay,
  onIdentifyDisplay,
  onApplyViewerTheme,
  onApplyStageTheme,
  onApplyBibleTheme,
  onApplyPrayerTheme,
  onApplyOBSTheme,
  onCreateNewTheme,
  onCloseDisplayPanel,
  onToggleOBSServer,
  onConnectOnline,
  onLogout
}) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he';
  const [obsUrlCopied, setObsUrlCopied] = useState(false);

  // Convert theme IDs to theme objects for ThemeSelectionPanel
  // Note: selectedTheme may already be a theme object (from useThemeState) or a string ID
  const selectedThemeObj = useMemo(() => {
    if (!selectedTheme) return null;
    // If it's already a theme object with an id, return it directly
    if (typeof selectedTheme === 'object' && selectedTheme.id) return selectedTheme;
    // Otherwise look it up by ID
    return themes.find(t => t.id === selectedTheme) || null;
  }, [themes, selectedTheme]);
  const selectedStageThemeObj = useMemo(() => {
    if (!selectedStageTheme) return null;
    if (typeof selectedStageTheme === 'object' && selectedStageTheme.id) return selectedStageTheme;
    return stageMonitorThemes.find(t => t.id === selectedStageTheme) || null;
  }, [stageMonitorThemes, selectedStageTheme]);
  const selectedBibleThemeObj = useMemo(() => {
    if (!selectedBibleTheme) return null;
    if (typeof selectedBibleTheme === 'object' && selectedBibleTheme.id) return selectedBibleTheme;
    return bibleThemes.find(t => t.id === selectedBibleTheme) || null;
  }, [bibleThemes, selectedBibleTheme]);
  const selectedPrayerThemeObj = useMemo(() => {
    if (!selectedPrayerTheme) return null;
    if (typeof selectedPrayerTheme === 'object' && selectedPrayerTheme.id) return selectedPrayerTheme;
    return prayerThemes.find(t => t.id === selectedPrayerTheme) || null;
  }, [prayerThemes, selectedPrayerTheme]);
  const selectedOBSThemeObj = useMemo(() => {
    if (!selectedOBSTheme) return null;
    if (typeof selectedOBSTheme === 'object' && selectedOBSTheme.id) return selectedOBSTheme;
    return obsThemes.find(t => t.id === selectedOBSTheme) || null;
  }, [obsThemes, selectedOBSTheme]);
  const selectedOBSSongsThemeObj = useMemo(() => {
    if (!selectedOBSSongsTheme) return null;
    if (typeof selectedOBSSongsTheme === 'object' && selectedOBSSongsTheme.id) return selectedOBSSongsTheme;
    return obsThemes.find(t => t.id === selectedOBSSongsTheme) || null;
  }, [obsThemes, selectedOBSSongsTheme]);
  const selectedOBSBibleThemeObj = useMemo(() => {
    if (!selectedOBSBibleTheme) return null;
    if (typeof selectedOBSBibleTheme === 'object' && selectedOBSBibleTheme.id) return selectedOBSBibleTheme;
    return obsThemes.find(t => t.id === selectedOBSBibleTheme) || null;
  }, [obsThemes, selectedOBSBibleTheme]);
  const selectedOBSPrayerThemeObj = useMemo(() => {
    if (!selectedOBSPrayerTheme) return null;
    if (typeof selectedOBSPrayerTheme === 'object' && selectedOBSPrayerTheme.id) return selectedOBSPrayerTheme;
    return obsThemes.find(t => t.id === selectedOBSPrayerTheme) || null;
  }, [obsThemes, selectedOBSPrayerTheme]);

  return (
    <header style={{
      padding: '12px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottom: '1px solid rgba(255,255,255,0.1)'
    }}>
      {/* Left - Display Button with Online Status */}
      <div data-panel="display" style={{ position: 'relative' }}>
        <button
          onClick={() => onShowDisplayPanelChange(!showDisplayPanel)}
          style={{
            background: assignedDisplays.length > 0 || onlineConnected ? colors.button.success : 'rgba(255,255,255,0.1)',
            border: 'none',
            borderRadius: '10px',
            padding: '10px 16px',
            color: 'white',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: '10px'
          }}
          title={onlineConnected ? `${t('controlPanel.online', 'Online')} (${viewerCount})` : t('controlPanel.offline', 'Offline')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" fill="none" stroke="white" strokeWidth="2"/>
            <line x1="8" y1="21" x2="16" y2="21" stroke="white" strokeWidth="2"/>
            <line x1="12" y1="17" x2="12" y2="21" stroke="white" strokeWidth="2"/>
          </svg>
          <span style={{ fontWeight: 500 }}>
            {assignedDisplays.length > 0 ? `${assignedDisplays.length} ${assignedDisplays.length > 1 ? t('controlPanel.displays') : t('controlPanel.display')}` : t('controlPanel.displays')}
          </span>
          {/* Online Status Dot */}
          <div style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: onlineConnected ? '#fff' : 'rgba(255,255,255,0.3)',
            boxShadow: onlineConnected ? '0 0 8px rgba(255,255,255,0.9)' : 'none',
            marginLeft: isRTL ? 0 : '4px',
            marginRight: isRTL ? '4px' : 0
          }} />
        </button>

        {/* Display Panel Dropdown */}
        {showDisplayPanel && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: isRTL ? 'auto' : 0,
            right: isRTL ? 0 : 'auto',
            marginTop: '8px',
            background: 'rgba(30, 30, 50, 0.98)',
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.2)',
            padding: '12px',
            minWidth: '280px',
            maxHeight: 'calc(100vh - 120px)',
            overflowY: 'auto',
            zIndex: 1000,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
          }}>
            <h4 style={{ margin: '0 0 12px 0', color: 'white', fontSize: '0.9rem' }}>{t('controlPanel.connectedDisplays')}</h4>

            {/* Control Screen Selector */}
            <div style={{
              padding: '10px',
              background: 'rgba(33, 150, 243, 0.1)',
              borderRadius: '8px',
              marginBottom: '12px',
              border: '1px solid rgba(33, 150, 243, 0.3)'
            }}>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', marginBottom: '6px' }}>
                {t('controlPanel.controlScreen', 'Control Screen')}
              </div>
              <select
                value={controlDisplayId ?? ''}
                onChange={async (e) => {
                  const displayId = parseInt(e.target.value);
                  if (!isNaN(displayId)) {
                    await onControlDisplayChange(displayId);
                  }
                }}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '6px',
                  padding: '8px',
                  color: 'white',
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                {displays.map((display, index) => (
                  <option key={display.id} value={display.id} style={{ background: '#1e1e32', color: 'white' }}>
                    {index + 1}. {display.label} - {display.bounds.width}x{display.bounds.height}
                  </option>
                ))}
              </select>
            </div>

            {/* Display List */}
            {displays.map((display, index) => (
              <div
                key={display.id}
                className="display-row"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px',
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: '8px',
                  marginBottom: '8px',
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {/* Display Number - Click to Identify */}
                  <button
                    onClick={async () => {
                      try {
                        await onIdentifyDisplay(display.id);
                      } catch (err) {
                        console.error('Failed to identify display:', err);
                      }
                    }}
                    title={t('controlPanel.identifyDisplays', 'Click to identify this display')}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '6px',
                      background: 'rgba(255, 152, 0, 0.2)',
                      border: '1px solid rgba(255, 152, 0, 0.5)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#FF9800',
                      fontWeight: 'bold',
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 152, 0, 0.4)';
                      e.currentTarget.style.transform = 'scale(1.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 152, 0, 0.2)';
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                  >
                    {index + 1}
                  </button>
                  <div>
                    <div style={{ color: 'white', fontWeight: 500 }}>
                      {display.label}
                      {display.isAssigned && <span style={{ marginLeft: '8px', fontSize: '0.7rem', background: '#28a745', padding: '2px 6px', borderRadius: '4px' }}>{display.assignedType}</span>}
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>{display.bounds.width}x{display.bounds.height}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  {display.id === controlDisplayId ? (
                    <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>
                      {t('controlPanel.controlScreen', 'Control Screen')}
                    </span>
                  ) : display.isAssigned ? (
                    <button onClick={() => onCloseDisplay(display.id)} style={{ background: colors.button.danger, border: 'none', borderRadius: '6px', padding: '6px 12px', color: 'white', fontSize: '0.75rem', cursor: 'pointer' }}>{t('common.close')}</button>
                  ) : (
                    <>
                      <button onClick={() => onOpenDisplay(display.id, 'viewer')} style={{ background: colors.button.info, border: 'none', borderRadius: '6px', padding: '6px 12px', color: 'white', fontSize: '0.75rem', cursor: 'pointer' }}>{t('controlPanel.viewer')}</button>
                      <button onClick={() => onOpenDisplay(display.id, 'stage')} style={{ background: colors.button.secondary, border: 'none', borderRadius: '6px', padding: '6px 12px', color: 'white', fontSize: '0.75rem', cursor: 'pointer' }}>{t('controlPanel.stage')}</button>
                    </>
                  )}
                </div>
              </div>
            ))}

            {/* OBS Virtual Display */}
            <div
              className="display-row"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px',
                background: obsServerRunning ? 'rgba(23, 162, 184, 0.15)' : 'rgba(255,255,255,0.05)',
                borderRadius: '8px',
                marginBottom: '8px',
                border: obsServerRunning ? '1px solid rgba(23, 162, 184, 0.4)' : '1px solid transparent'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    background: 'rgba(23, 162, 184, 0.2)',
                    border: '1px solid rgba(23, 162, 184, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#17a2b8" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ color: 'white', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    OBS
                    {obsServerRunning && (
                      <span style={{ fontSize: '0.7rem', background: '#17a2b8', padding: '2px 6px', borderRadius: '4px' }}>
                        {t('controlPanel.running', 'Running')}
                      </span>
                    )}
                  </div>
                  <div style={{
                    color: 'rgba(255,255,255,0.5)',
                    fontSize: '0.75rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {obsServerRunning && obsServerUrl ? obsServerUrl : t('controlPanel.browserSource', 'Browser Source')}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
                {obsServerRunning && obsServerUrl && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(obsServerUrl);
                      setObsUrlCopied(true);
                      setTimeout(() => setObsUrlCopied(false), 2000);
                    }}
                    style={{
                      background: obsUrlCopied ? '#28a745' : 'rgba(255,255,255,0.1)',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      color: 'white',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      transition: 'background 0.2s',
                      minWidth: '55px'
                    }}
                  >
                    {obsUrlCopied ? t('common.copied', 'Copied!') : t('common.copy', 'Copy')}
                  </button>
                )}
                <button
                  onClick={onToggleOBSServer}
                  style={{
                    background: obsServerRunning ? colors.button.danger : '#17a2b8',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    color: 'white',
                    fontSize: '0.75rem',
                    cursor: 'pointer'
                  }}
                >
                  {obsServerRunning ? t('common.stop', 'Stop') : t('common.start', 'Start')}
                </button>
              </div>
            </div>

            {/* Themes Section */}
            <ThemeSelectionPanel
              themes={themes}
              stageMonitorThemes={stageMonitorThemes}
              bibleThemes={bibleThemes}
              prayerThemes={prayerThemes}
              obsThemes={obsThemes}
              selectedTheme={selectedThemeObj}
              selectedStageTheme={selectedStageThemeObj}
              selectedBibleTheme={selectedBibleThemeObj}
              selectedPrayerTheme={selectedPrayerThemeObj}
              selectedOBSTheme={selectedOBSThemeObj}
              selectedOBSSongsTheme={selectedOBSSongsThemeObj}
              selectedOBSBibleTheme={selectedOBSBibleThemeObj}
              selectedOBSPrayerTheme={selectedOBSPrayerThemeObj}
              isRTL={isRTL}
              onApplyViewerTheme={onApplyViewerTheme}
              onApplyStageTheme={onApplyStageTheme}
              onApplyBibleTheme={onApplyBibleTheme}
              onApplyPrayerTheme={onApplyPrayerTheme}
              onApplyOBSTheme={onApplyOBSTheme}
              onCreateNewTheme={() => onCreateNewTheme('songs')}
              onCloseDisplayPanel={onCloseDisplayPanel}
            />

            {/* Online Broadcast Section */}
            <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <h4 style={{ margin: '0 0 12px 0', color: 'white', fontSize: '0.9rem' }}>{t('controlPanel.onlineBroadcast', 'Online Broadcast')}</h4>
              <BroadcastSelector
                roomPin={roomPin}
                viewerCount={viewerCount}
                onlineConnected={onlineConnected}
                serverUrl={authState.serverUrl}
                onConnectClick={authState.isAuthenticated ? onConnectOnline : onShowAuthModal}
                embedded={true}
              />
            </div>
          </div>
        )}
      </div>

      {/* Center spacer */}
      <div style={{ flex: 1 }} />

      {/* Right - User, Help & Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* User Button */}
        {authState.isAuthenticated ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => onShowUserMenuChange(!showUserMenu)}
                style={{
                  background: colors.button.primary,
                  border: 'none',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="white">
                  <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10z"/>
                </svg>
                <span style={{ color: 'white', fontSize: '0.8rem', fontWeight: 500 }}>
                  {authState.user?.email?.split('@')[0]}
                </span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" style={{ marginLeft: '2px' }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {showUserMenu && (
                <>
                  <div
                    style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                    onClick={() => onShowUserMenuChange(false)}
                  />
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: isRTL ? 'auto' : 0,
                    left: isRTL ? 0 : 'auto',
                    marginTop: '4px',
                    background: 'rgba(30,30,50,0.98)',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    padding: '4px',
                    minWidth: '150px',
                    zIndex: 100,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                  }}>
                    <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '4px' }}>
                      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem' }}>{t('settings.loggedInAs')}</div>
                      <div style={{ color: 'white', fontSize: '0.85rem', fontWeight: 500 }}>{authState.user?.email}</div>
                    </div>
                    <button
                      onClick={() => { onNavigateToSettings(); onShowUserMenuChange(false); }}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', borderRadius: '6px', padding: '8px 12px', color: 'white', cursor: 'pointer', fontSize: '0.85rem', textAlign: isRTL ? 'right' : 'left' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                      </svg>
                      {t('nav.settings')}
                    </button>
                    <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />
                    <button
                      onClick={() => { onLogout(); onShowUserMenuChange(false); }}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', borderRadius: '6px', padding: '8px 12px', color: '#dc3545', cursor: 'pointer', fontSize: '0.85rem', textAlign: isRTL ? 'right' : 'left' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                      </svg>
                      {t('nav.logout')}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <button
            onClick={onShowAuthModal}
            style={{
              background: colors.button.primary,
              border: 'none',
              borderRadius: '8px',
              padding: '6px 14px',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.85rem',
              fontWeight: 500
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="white">
              <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10z"/>
            </svg>
            {t('nav.login')}
          </button>
        )}

        {/* Settings Button - always visible */}
        <button
          onClick={onNavigateToSettings}
          title={t('nav.settings')}
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: 'none',
            borderRadius: '6px',
            padding: '6px 10px',
            color: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>

        <button
          onClick={onShowKeyboardHelp}
          title="Keyboard Shortcuts (? or F1)"
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: 'none',
            borderRadius: '6px',
            padding: '6px 10px',
            color: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '0.8rem'
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
            <path d="M5.255 5.786a.237.237 0 0 0 .241.247h.825c.138 0 .248-.113.266-.25.09-.656.54-1.134 1.342-1.134.686 0 1.314.343 1.314 1.168 0 .635-.374.927-.965 1.371-.673.489-1.206 1.06-1.168 1.987l.003.217a.25.25 0 0 0 .25.246h.811a.25.25 0 0 0 .25-.25v-.105c0-.718.273-.927 1.01-1.486.609-.463 1.244-.977 1.244-2.056 0-1.511-1.276-2.241-2.673-2.241-1.267 0-2.655.59-2.75 2.286zm1.557 5.763c0 .533.425.927 1.01.927.609 0 1.028-.394 1.028-.927 0-.552-.42-.94-1.029-.94-.584 0-1.009.388-1.009.94z"/>
          </svg>
          ?
        </button>
        <img src={logoImage} alt="SoluCast" style={{ height: '32px', objectFit: 'contain' }} />
      </div>
    </header>
  );
});

HeaderBar.displayName = 'HeaderBar';

export default HeaderBar;
