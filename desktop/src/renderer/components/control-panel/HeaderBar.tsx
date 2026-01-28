import React, { memo, useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { colors } from '../../styles/controlPanelStyles';
import BroadcastSelector from '../BroadcastSelector';
import DisplayThemeOverrideModal from './modals/DisplayThemeOverrideModal';
import { DisplaySettingsModal, OBSSettingsModal } from './modals';
import DisplayItem from './DisplayItem';
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

  // Theme state (for per-display override modal)
  themes: Theme[];
  stageMonitorThemes: Theme[];
  bibleThemes: Theme[];
  prayerThemes: Theme[];
  obsThemes?: Theme[];
  selectedOBSSongsTheme?: Theme | null;
  selectedOBSBibleTheme?: Theme | null;
  selectedOBSPrayerTheme?: Theme | null;
  onApplyOBSTheme?: (theme: Theme) => void;

  // Theme menu state
  showThemePanel: boolean;
  selectedTheme: Theme | null;
  selectedBibleTheme: Theme | null;
  selectedPrayerTheme: Theme | null;
  selectedStageTheme: Theme | null;
  onShowThemePanelChange: (show: boolean) => void;
  onApplyViewerTheme: (theme: Theme) => void;
  onApplyBibleTheme: (theme: Theme) => void;
  onApplyPrayerTheme: (theme: Theme) => void;
  onApplyStageTheme: (theme: Theme) => void;
  onCreateTheme: (themeType: 'songs' | 'bible' | 'prayer' | 'stage' | 'obs-songs' | 'obs-bible' | 'obs-prayer') => void;
  onEditTheme: (themeType: 'songs' | 'bible' | 'prayer' | 'stage' | 'obs-songs' | 'obs-bible' | 'obs-prayer', themeId: string) => void;

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
  onCloseDisplayPanel: () => void;

  // OBS callbacks
  onToggleOBSServer: () => Promise<void>;

  // Auth callbacks
  onConnectOnline: () => void;
  onLogout: () => void;

  // Theme override callback
  onThemeOverrideChanged?: () => void;
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
  selectedOBSSongsTheme,
  selectedOBSBibleTheme,
  selectedOBSPrayerTheme,
  onApplyOBSTheme,
  showThemePanel,
  selectedTheme,
  selectedBibleTheme,
  selectedPrayerTheme,
  selectedStageTheme,
  onShowThemePanelChange,
  onApplyViewerTheme,
  onApplyBibleTheme,
  onApplyPrayerTheme,
  onApplyStageTheme,
  onCreateTheme,
  onEditTheme,
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
  onCloseDisplayPanel,
  onToggleOBSServer,
  onConnectOnline,
  onLogout,
  onThemeOverrideChanged
}) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he';
  const [obsUrlCopied, setObsUrlCopied] = useState(false);
  const [showThemeOverrideModal, setShowThemeOverrideModal] = useState(false);
  const [selectedDisplayForSettings, setSelectedDisplayForSettings] = useState<number | 'obs' | null>(null);
  const [obsHovered, setObsHovered] = useState(false);
  const [showDisplaySettingsModal, setShowDisplaySettingsModal] = useState(false);
  const [displayForSettings, setDisplayForSettings] = useState<Display | null>(null);
  const [showOBSSettingsModal, setShowOBSSettingsModal] = useState(false);
  const obsUrlCopyTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (obsUrlCopyTimeoutRef.current) {
        clearTimeout(obsUrlCopyTimeoutRef.current);
      }
    };
  }, []);

  // Memoized callback for sending stage messages (passed to DisplayItem)
  const handleSendStageMessage = useCallback(async (displayId: number, message: string) => {
    await window.electronAPI.sendStageMessage(displayId, message);
  }, []);

  // Memoized callback for opening display settings
  const handleOpenDisplaySettings = useCallback((display: Display) => {
    setDisplayForSettings(display);
    setShowDisplaySettingsModal(true);
  }, []);

  // Memoized callbacks for OBS row
  const handleObsMouseEnter = useCallback(() => setObsHovered(true), []);
  const handleObsMouseLeave = useCallback(() => setObsHovered(false), []);

  const handleCopyObsUrl = useCallback(() => {
    if (obsServerUrl) {
      navigator.clipboard.writeText(obsServerUrl);
      setObsUrlCopied(true);
      if (obsUrlCopyTimeoutRef.current) {
        clearTimeout(obsUrlCopyTimeoutRef.current);
      }
      obsUrlCopyTimeoutRef.current = setTimeout(() => setObsUrlCopied(false), 2000);
    }
  }, [obsServerUrl]);

  const handleOpenOBSSettings = useCallback(() => {
    setShowOBSSettingsModal(true);
  }, []);

  const handleCloseOBSSettingsModal = useCallback(() => {
    setShowOBSSettingsModal(false);
  }, []);

  const handleOBSApplyTheme = useCallback((themeType: 'songs' | 'bible' | 'prayer', theme: Theme | null) => {
    if (onApplyOBSTheme && theme) {
      onApplyOBSTheme(theme);
    }
  }, [onApplyOBSTheme]);

  // Memoized modal callbacks
  const handleCloseThemeOverrideModal = useCallback(() => {
    setShowThemeOverrideModal(false);
    setSelectedDisplayForSettings(null);
  }, []);

  const handleCloseDisplaySettingsModal = useCallback(() => {
    setShowDisplaySettingsModal(false);
    setDisplayForSettings(null);
  }, []);

  const handleDisplaySettingsStart = useCallback((displayId: number, type: 'viewer' | 'stage') => {
    onOpenDisplay(displayId, type);
    setShowDisplaySettingsModal(false);
    setDisplayForSettings(null);
  }, [onOpenDisplay]);

  const handleThemeOverrideChanged = useCallback(() => {
    if (onThemeOverrideChanged) {
      onThemeOverrideChanged();
    }
  }, [onThemeOverrideChanged]);

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

            {/* Display List - Using memoized DisplayItem component */}
            {displays.map((display, index) => (
              <DisplayItem
                key={display.id}
                display={display}
                index={index}
                controlDisplayId={controlDisplayId}
                onIdentifyDisplay={onIdentifyDisplay}
                onCloseDisplay={onCloseDisplay}
                onOpenSettings={handleOpenDisplaySettings}
                onSendStageMessage={handleSendStageMessage}
              />
            ))}

            {/* OBS Virtual Display */}
            <div
              className="display-row"
              onMouseEnter={handleObsMouseEnter}
              onMouseLeave={handleObsMouseLeave}
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
                {/* Settings icon - only visible on hover when OBS is running */}
                {obsServerRunning && (
                  <button
                    onClick={handleOpenOBSSettings}
                    title={t('displayThemeOverrides.configureOBSTheme', 'Configure OBS themes')}
                    style={{
                      background: 'rgba(255,255,255,0.1)',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '6px',
                      color: 'white',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s',
                      opacity: obsHovered ? 1 : 0,
                      pointerEvents: obsHovered ? 'auto' : 'none'
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                  </button>
                )}
                {obsServerRunning ? (
                  <button
                    onClick={onToggleOBSServer}
                    style={{
                      background: colors.button.danger,
                      border: 'none',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      color: 'white',
                      fontSize: '0.75rem',
                      cursor: 'pointer'
                    }}
                  >
                    {t('common.stop', 'Stop')}
                  </button>
                ) : (
                  <button
                    onClick={handleOpenOBSSettings}
                    style={{
                      background: '#17a2b8',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      color: 'white',
                      fontSize: '0.75rem',
                      cursor: 'pointer'
                    }}
                  >
                    {t('common.start', 'Start')}
                  </button>
                )}
              </div>
            </div>

            {/* Online Broadcast Section - Hidden for now
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
            */}
          </div>
        )}
      </div>

      {/* Theme Menu Button */}
      <div data-panel="theme" style={{ position: 'relative', marginLeft: '12px' }}>
        <button
          onClick={() => onShowThemePanelChange(!showThemePanel)}
          style={{
            background: 'rgba(255,255,255,0.1)',
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
          title={t('controlPanel.themes', 'Themes')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 2a10 10 0 0 0-6.88 17.23l3.12-3.12a5 5 0 1 1 7.52 0l3.12 3.12A10 10 0 0 0 12 2z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          <span style={{ fontWeight: 500 }}>
            {t('controlPanel.themes', 'Themes')}
          </span>
        </button>

        {/* Theme Panel Dropdown */}
        {showThemePanel && (
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
            minWidth: '300px',
            maxHeight: 'calc(100vh - 120px)',
            overflowY: 'auto',
            zIndex: 1000,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
          }}>
            <h4 style={{ margin: '0 0 12px 0', color: 'white', fontSize: '0.9rem' }}>
              {t('controlPanel.globalThemes', 'Global Themes')}
            </h4>

            {/* Songs Theme */}
            <div style={{
              padding: '10px',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '8px',
              marginBottom: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '6px',
                    background: 'rgba(33, 150, 243, 0.2)',
                    border: '1px solid rgba(33, 150, 243, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2196F3" strokeWidth="2">
                      <path d="M9 18V5l12-2v13"/>
                      <circle cx="6" cy="18" r="3"/>
                      <circle cx="18" cy="16" r="3"/>
                    </svg>
                  </div>
                  <span style={{ color: 'white', fontWeight: 500, fontSize: '0.85rem' }}>
                    {t('displayThemeOverrides.songsTheme', 'Songs Theme')}
                  </span>
                </div>
                <button
                  onClick={() => onCreateTheme('songs')}
                  title={t('common.new', 'New')}
                  style={{
                    background: 'rgba(33, 150, 243, 0.2)',
                    border: '1px solid rgba(33, 150, 243, 0.4)',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    color: '#2196F3',
                    cursor: 'pointer',
                    fontSize: '0.7rem'
                  }}
                >
                  + {t('common.new', 'New')}
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '120px', overflowY: 'auto' }}>
                {themes.map(theme => (
                  <div
                    key={theme.id}
                    onClick={() => onApplyViewerTheme(theme)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 8px',
                      borderRadius: '4px',
                      background: selectedTheme?.id === theme.id ? 'rgba(33, 150, 243, 0.3)' : 'rgba(255,255,255,0.05)',
                      border: selectedTheme?.id === theme.id ? '1px solid rgba(33, 150, 243, 0.5)' : '1px solid transparent',
                      cursor: 'pointer'
                    }}
                  >
                    <span style={{ color: 'white', fontSize: '0.8rem' }}>{theme.name}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); onEditTheme('songs', theme.id); }}
                      title={t('common.edit', 'Edit')}
                      style={{
                        background: 'rgba(255,255,255,0.1)',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '2px 6px',
                        color: 'rgba(255,255,255,0.6)',
                        cursor: 'pointer',
                        fontSize: '0.65rem'
                      }}
                    >
                      {t('common.edit', 'Edit')}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Bible Theme */}
            <div style={{
              padding: '10px',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '8px',
              marginBottom: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '6px',
                    background: 'rgba(156, 39, 176, 0.2)',
                    border: '1px solid rgba(156, 39, 176, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9c27b0" strokeWidth="2">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                    </svg>
                  </div>
                  <span style={{ color: 'white', fontWeight: 500, fontSize: '0.85rem' }}>
                    {t('displayThemeOverrides.bibleTheme', 'Bible Theme')}
                  </span>
                </div>
                <button
                  onClick={() => onCreateTheme('bible')}
                  title={t('common.new', 'New')}
                  style={{
                    background: 'rgba(156, 39, 176, 0.2)',
                    border: '1px solid rgba(156, 39, 176, 0.4)',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    color: '#9c27b0',
                    cursor: 'pointer',
                    fontSize: '0.7rem'
                  }}
                >
                  + {t('common.new', 'New')}
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '120px', overflowY: 'auto' }}>
                {bibleThemes.map(theme => (
                  <div
                    key={theme.id}
                    onClick={() => onApplyBibleTheme(theme)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 8px',
                      borderRadius: '4px',
                      background: selectedBibleTheme?.id === theme.id ? 'rgba(156, 39, 176, 0.3)' : 'rgba(255,255,255,0.05)',
                      border: selectedBibleTheme?.id === theme.id ? '1px solid rgba(156, 39, 176, 0.5)' : '1px solid transparent',
                      cursor: 'pointer'
                    }}
                  >
                    <span style={{ color: 'white', fontSize: '0.8rem' }}>{theme.name}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); onEditTheme('bible', theme.id); }}
                      title={t('common.edit', 'Edit')}
                      style={{
                        background: 'rgba(255,255,255,0.1)',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '2px 6px',
                        color: 'rgba(255,255,255,0.6)',
                        cursor: 'pointer',
                        fontSize: '0.65rem'
                      }}
                    >
                      {t('common.edit', 'Edit')}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Prayer Theme */}
            <div style={{
              padding: '10px',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '8px',
              marginBottom: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '6px',
                    background: 'rgba(255, 152, 0, 0.2)',
                    border: '1px solid rgba(255, 152, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FF9800" strokeWidth="2">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                    </svg>
                  </div>
                  <span style={{ color: 'white', fontWeight: 500, fontSize: '0.85rem' }}>
                    {t('displayThemeOverrides.prayerTheme', 'Prayer Theme')}
                  </span>
                </div>
                <button
                  onClick={() => onCreateTheme('prayer')}
                  title={t('common.new', 'New')}
                  style={{
                    background: 'rgba(255, 152, 0, 0.2)',
                    border: '1px solid rgba(255, 152, 0, 0.4)',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    color: '#FF9800',
                    cursor: 'pointer',
                    fontSize: '0.7rem'
                  }}
                >
                  + {t('common.new', 'New')}
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '120px', overflowY: 'auto' }}>
                {prayerThemes.map(theme => (
                  <div
                    key={theme.id}
                    onClick={() => onApplyPrayerTheme(theme)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 8px',
                      borderRadius: '4px',
                      background: selectedPrayerTheme?.id === theme.id ? 'rgba(255, 152, 0, 0.3)' : 'rgba(255,255,255,0.05)',
                      border: selectedPrayerTheme?.id === theme.id ? '1px solid rgba(255, 152, 0, 0.5)' : '1px solid transparent',
                      cursor: 'pointer'
                    }}
                  >
                    <span style={{ color: 'white', fontSize: '0.8rem' }}>{theme.name}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); onEditTheme('prayer', theme.id); }}
                      title={t('common.edit', 'Edit')}
                      style={{
                        background: 'rgba(255,255,255,0.1)',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '2px 6px',
                        color: 'rgba(255,255,255,0.6)',
                        cursor: 'pointer',
                        fontSize: '0.65rem'
                      }}
                    >
                      {t('common.edit', 'Edit')}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Stage Theme */}
            <div style={{
              padding: '10px',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '8px',
              marginBottom: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '6px',
                    background: 'rgba(76, 175, 80, 0.2)',
                    border: '1px solid rgba(76, 175, 80, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4caf50" strokeWidth="2">
                      <rect x="2" y="7" width="20" height="15" rx="2" ry="2"/>
                      <polyline points="17 2 12 7 7 2"/>
                    </svg>
                  </div>
                  <span style={{ color: 'white', fontWeight: 500, fontSize: '0.85rem' }}>
                    {t('displayThemeOverrides.stageTheme', 'Stage Theme')}
                  </span>
                </div>
                <button
                  onClick={() => onCreateTheme('stage')}
                  title={t('common.new', 'New')}
                  style={{
                    background: 'rgba(76, 175, 80, 0.2)',
                    border: '1px solid rgba(76, 175, 80, 0.4)',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    color: '#4caf50',
                    cursor: 'pointer',
                    fontSize: '0.7rem'
                  }}
                >
                  + {t('common.new', 'New')}
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '120px', overflowY: 'auto' }}>
                {stageMonitorThemes.map(theme => (
                  <div
                    key={theme.id}
                    onClick={() => onApplyStageTheme(theme)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 8px',
                      borderRadius: '4px',
                      background: selectedStageTheme?.id === theme.id ? 'rgba(76, 175, 80, 0.3)' : 'rgba(255,255,255,0.05)',
                      border: selectedStageTheme?.id === theme.id ? '1px solid rgba(76, 175, 80, 0.5)' : '1px solid transparent',
                      cursor: 'pointer'
                    }}
                  >
                    <span style={{ color: 'white', fontSize: '0.8rem' }}>{theme.name}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); onEditTheme('stage', theme.id); }}
                      title={t('common.edit', 'Edit')}
                      style={{
                        background: 'rgba(255,255,255,0.1)',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '2px 6px',
                        color: 'rgba(255,255,255,0.6)',
                        cursor: 'pointer',
                        fontSize: '0.65rem'
                      }}
                    >
                      {t('common.edit', 'Edit')}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* OBS Themes */}
            {(() => {
              // Filter OBS themes by type, falling back to regular themes if no OBS-specific themes exist
              const obsSongsThemeList = obsThemes?.filter(t => t.type === 'songs') || [];
              const obsBibleThemeList = obsThemes?.filter(t => t.type === 'bible') || [];
              const obsPrayerThemeList = obsThemes?.filter(t => t.type === 'prayer') || [];

              // Use OBS themes if available, otherwise fall back to regular themes
              const songsThemesForOBS = obsSongsThemeList.length > 0 ? obsSongsThemeList : themes;
              const bibleThemesForOBS = obsBibleThemeList.length > 0 ? obsBibleThemeList : bibleThemes;
              const prayerThemesForOBS = obsPrayerThemeList.length > 0 ? obsPrayerThemeList : prayerThemes;

              return (
            <div style={{
              padding: '10px',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '6px',
                  background: 'rgba(23, 162, 184, 0.2)',
                  border: '1px solid rgba(23, 162, 184, 0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#17a2b8" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                </div>
                <span style={{ color: 'white', fontWeight: 500, fontSize: '0.85rem' }}>
                  OBS
                </span>
              </div>

              {/* OBS Songs Theme */}
              <div style={{ marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.7rem' }}>
                    {t('displayThemeOverrides.songsTheme', 'Songs Theme')}
                  </div>
                  <button
                    onClick={() => onCreateTheme('obs-songs')}
                    title={t('common.new', 'New')}
                    style={{
                      background: 'rgba(23, 162, 184, 0.2)',
                      border: '1px solid rgba(23, 162, 184, 0.4)',
                      borderRadius: '4px',
                      padding: '2px 6px',
                      color: '#17a2b8',
                      cursor: 'pointer',
                      fontSize: '0.6rem'
                    }}
                  >
                    + {t('common.new', 'New')}
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '80px', overflowY: 'auto' }}>
                  {songsThemesForOBS.map(theme => (
                    <div
                      key={theme.id}
                      onClick={() => onApplyOBSTheme && onApplyOBSTheme({ ...theme, type: theme.type || 'songs' })}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        background: selectedOBSSongsTheme?.id === theme.id ? 'rgba(23, 162, 184, 0.3)' : 'rgba(255,255,255,0.03)',
                        border: selectedOBSSongsTheme?.id === theme.id ? '1px solid rgba(23, 162, 184, 0.5)' : '1px solid transparent',
                        cursor: 'pointer'
                      }}
                    >
                      <span style={{ color: 'white', fontSize: '0.75rem' }}>{theme.name}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); onEditTheme('obs-songs', theme.id); }}
                        title={t('common.edit', 'Edit')}
                        style={{
                          background: 'rgba(255,255,255,0.1)',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '2px 6px',
                          color: 'rgba(255,255,255,0.6)',
                          cursor: 'pointer',
                          fontSize: '0.6rem'
                        }}
                      >
                        {t('common.edit', 'Edit')}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* OBS Bible Theme */}
              <div style={{ marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.7rem' }}>
                    {t('displayThemeOverrides.bibleTheme', 'Bible Theme')}
                  </div>
                  <button
                    onClick={() => onCreateTheme('obs-bible')}
                    title={t('common.new', 'New')}
                    style={{
                      background: 'rgba(23, 162, 184, 0.2)',
                      border: '1px solid rgba(23, 162, 184, 0.4)',
                      borderRadius: '4px',
                      padding: '2px 6px',
                      color: '#17a2b8',
                      cursor: 'pointer',
                      fontSize: '0.6rem'
                    }}
                  >
                    + {t('common.new', 'New')}
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '80px', overflowY: 'auto' }}>
                  {bibleThemesForOBS.map(theme => (
                    <div
                      key={theme.id}
                      onClick={() => onApplyOBSTheme && onApplyOBSTheme({ ...theme, type: theme.type || 'bible' })}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        background: selectedOBSBibleTheme?.id === theme.id ? 'rgba(23, 162, 184, 0.3)' : 'rgba(255,255,255,0.03)',
                        border: selectedOBSBibleTheme?.id === theme.id ? '1px solid rgba(23, 162, 184, 0.5)' : '1px solid transparent',
                        cursor: 'pointer'
                      }}
                    >
                      <span style={{ color: 'white', fontSize: '0.75rem' }}>{theme.name}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); onEditTheme('obs-bible', theme.id); }}
                        title={t('common.edit', 'Edit')}
                        style={{
                          background: 'rgba(255,255,255,0.1)',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '2px 6px',
                          color: 'rgba(255,255,255,0.6)',
                          cursor: 'pointer',
                          fontSize: '0.6rem'
                        }}
                      >
                        {t('common.edit', 'Edit')}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* OBS Prayer Theme */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.7rem' }}>
                    {t('displayThemeOverrides.prayerTheme', 'Prayer Theme')}
                  </div>
                  <button
                    onClick={() => onCreateTheme('obs-prayer')}
                    title={t('common.new', 'New')}
                    style={{
                      background: 'rgba(23, 162, 184, 0.2)',
                      border: '1px solid rgba(23, 162, 184, 0.4)',
                      borderRadius: '4px',
                      padding: '2px 6px',
                      color: '#17a2b8',
                      cursor: 'pointer',
                      fontSize: '0.6rem'
                    }}
                  >
                    + {t('common.new', 'New')}
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '80px', overflowY: 'auto' }}>
                  {prayerThemesForOBS.map(theme => (
                    <div
                      key={theme.id}
                      onClick={() => onApplyOBSTheme && onApplyOBSTheme({ ...theme, type: theme.type || 'prayer' })}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        background: selectedOBSPrayerTheme?.id === theme.id ? 'rgba(23, 162, 184, 0.3)' : 'rgba(255,255,255,0.03)',
                        border: selectedOBSPrayerTheme?.id === theme.id ? '1px solid rgba(23, 162, 184, 0.5)' : '1px solid transparent',
                        cursor: 'pointer'
                      }}
                    >
                      <span style={{ color: 'white', fontSize: '0.75rem' }}>{theme.name}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); onEditTheme('obs-prayer', theme.id); }}
                        title={t('common.edit', 'Edit')}
                        style={{
                          background: 'rgba(255,255,255,0.1)',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '2px 6px',
                          color: 'rgba(255,255,255,0.6)',
                          cursor: 'pointer',
                          fontSize: '0.6rem'
                        }}
                      >
                        {t('common.edit', 'Edit')}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
              );
            })()}
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

      {/* Per-Display Theme Override Modal */}
      <DisplayThemeOverrideModal
        isOpen={showThemeOverrideModal}
        onClose={handleCloseThemeOverrideModal}
        displays={displays}
        themes={themes}
        stageThemes={stageMonitorThemes}
        bibleThemes={bibleThemes}
        prayerThemes={prayerThemes}
        onOverrideChanged={handleThemeOverrideChanged}
        selectedDisplayId={selectedDisplayForSettings}
        obsThemes={obsThemes}
        selectedOBSSongsTheme={selectedOBSSongsTheme}
        selectedOBSBibleTheme={selectedOBSBibleTheme}
        selectedOBSPrayerTheme={selectedOBSPrayerTheme}
        onApplyOBSTheme={onApplyOBSTheme}
      />

      {/* Display Settings Modal - for unassigned displays */}
      <DisplaySettingsModal
        isOpen={showDisplaySettingsModal}
        onClose={handleCloseDisplaySettingsModal}
        display={displayForSettings}
        themes={themes}
        stageThemes={stageMonitorThemes}
        bibleThemes={bibleThemes}
        prayerThemes={prayerThemes}
        onStart={handleDisplaySettingsStart}
        onThemeOverrideChanged={handleThemeOverrideChanged}
      />

      {/* OBS Settings Modal */}
      <OBSSettingsModal
        isOpen={showOBSSettingsModal}
        onClose={handleCloseOBSSettingsModal}
        isRunning={obsServerRunning}
        obsUrl={obsServerUrl}
        themes={obsThemes || themes}
        bibleThemes={bibleThemes}
        prayerThemes={prayerThemes}
        selectedSongsTheme={selectedOBSSongsTheme}
        selectedBibleTheme={selectedOBSBibleTheme}
        selectedPrayerTheme={selectedOBSPrayerTheme}
        onApplyTheme={handleOBSApplyTheme}
        onStart={onToggleOBSServer}
      />
    </header>
  );
});

HeaderBar.displayName = 'HeaderBar';

export default HeaderBar;
