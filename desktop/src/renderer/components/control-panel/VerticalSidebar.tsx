import React, { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import logoImage from '../../assets/logo.png';
import { DisplayAssignedType } from './panels/types';

// Tooltip component moved outside to prevent recreation on each render
const Tooltip = memo<{ text: string; visible: boolean }>(({ text, visible }) => (
  visible ? (
    <div style={{
      position: 'absolute',
      left: '100%',
      top: '50%',
      transform: 'translateY(-50%)',
      marginLeft: '8px',
      padding: '4px 8px',
      background: 'rgba(0,0,0,0.9)',
      border: '1px solid rgba(255,255,255,0.15)',
      borderRadius: '4px',
      color: 'rgba(255,255,255,0.9)',
      fontSize: '0.75rem',
      whiteSpace: 'nowrap',
      zIndex: 1000,
      pointerEvents: 'none'
    }}>
      {text}
    </div>
  ) : null
));
Tooltip.displayName = 'Tooltip';

interface Display {
  id: number;
  label: string;
  bounds: { x: number; y: number; width: number; height: number };
  isAssigned?: boolean;
  assignedType?: DisplayAssignedType;
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

export interface VirtualDisplay {
  id: string;
  name: string;
  slug: string;
  type: 'viewer' | 'stage';
  url: string;
}

export interface VerticalSidebarProps {
  // Display state
  displays: Display[];
  assignedDisplays: Display[];
  onlineConnected: boolean;
  viewerCount: number;

  // Auth state
  authState: AuthState;

  // Theme state
  themes: Theme[];
  selectedTheme: Theme | null;

  // Update state
  updateAvailable?: boolean;
  onShowUpdateModal?: () => void;

  // MIDI bridge state
  midiBridgeConnected?: boolean;
  midiControlEnabled?: boolean;
  onToggleMidiControl?: () => void;

  // UI callbacks
  onShowDisplayPanel: () => void;
  onShowThemePanel: () => void;
  onShowAuthModal: () => void;
  onShowUserMenu: () => void;
  onNavigateToSettings: () => void;
  onShowAboutModal: () => void;
}

// Style constants defined outside component to prevent recreation
const ICON_BUTTON_BASE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '40px',
  height: '40px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '8px',
  color: 'rgba(255,255,255,0.8)',
  cursor: 'pointer',
  transition: 'all 0.15s',
  position: 'relative' as const
};

const ICON_BUTTON_ACTIVE: React.CSSProperties = {
  ...ICON_BUTTON_BASE,
  background: 'rgba(76, 175, 80, 0.15)',
  borderColor: 'rgba(76, 175, 80, 0.4)',
  color: '#4caf50'
};

const ICON_BUTTON_MIDI_OFF: React.CSSProperties = {
  ...ICON_BUTTON_BASE,
  background: 'rgba(244, 67, 54, 0.15)',
  borderColor: 'rgba(244, 67, 54, 0.4)',
  color: '#f44336'
};

const ICON_BUTTON_UPDATE: React.CSSProperties = {
  ...ICON_BUTTON_BASE,
  background: 'rgba(255, 193, 7, 0.15)',
  borderColor: 'rgba(255, 193, 7, 0.4)',
  color: '#ffc107'
};

// MIDI indicator dot styles (static to avoid allocations per render)
const MIDI_DOT_ON: React.CSSProperties = {
  position: 'absolute',
  top: '4px',
  right: '4px',
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  background: '#4caf50',
  boxShadow: '0 0 6px #4caf50'
};

const MIDI_DOT_OFF: React.CSSProperties = {
  position: 'absolute',
  top: '4px',
  right: '4px',
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  background: '#f44336',
  boxShadow: '0 0 6px #f44336'
};

// Reuse green dot for online indicator (same style as MIDI_DOT_ON)
const ONLINE_INDICATOR_DOT = MIDI_DOT_ON;

const VerticalSidebar = memo<VerticalSidebarProps>(({
  displays,
  assignedDisplays,
  onlineConnected,
  viewerCount,
  authState,
  themes,
  selectedTheme,
  updateAvailable,
  onShowUpdateModal,
  midiBridgeConnected,
  midiControlEnabled,
  onToggleMidiControl,
  onShowDisplayPanel,
  onShowThemePanel,
  onShowAuthModal,
  onShowUserMenu,
  onNavigateToSettings,
  onShowAboutModal
}) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he';
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);

  const displayButtonStyle = assignedDisplays.length > 0 || onlineConnected ? ICON_BUTTON_ACTIVE : ICON_BUTTON_BASE;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '6px',
      padding: '10px 8px',
      background: 'rgba(255,255,255,0.02)',
      borderRadius: '12px',
      flexShrink: 0
    }}>
      {/* Logo - clickable for About */}
      <div style={{ position: 'relative', marginBottom: '6px' }}>
        <button
          onClick={onShowAboutModal}
          onMouseEnter={() => setHoveredButton('logo')}
          onMouseLeave={() => setHoveredButton(null)}
          style={{
            background: 'transparent',
            border: 'none',
            padding: '4px',
            cursor: 'pointer',
            borderRadius: '6px',
            transition: 'all 0.15s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <img src={logoImage} alt="SoluCast" style={{ height: '32px', objectFit: 'contain', display: 'block' }} />
        </button>
        <Tooltip text={t('settings.about', 'About')} visible={hoveredButton === 'logo'} />
      </div>

      {/* Displays Button */}
      <div style={{ position: 'relative' }}>
        <button
          data-panel="display"
          onClick={onShowDisplayPanel}
          onMouseEnter={() => setHoveredButton('displays')}
          onMouseLeave={() => setHoveredButton(null)}
          style={displayButtonStyle}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
          {onlineConnected && <div style={ONLINE_INDICATOR_DOT} />}
        </button>
        <Tooltip text={t('controlPanel.displays', 'Displays')} visible={hoveredButton === 'displays'} />
      </div>

      {/* Themes Button */}
      <div style={{ position: 'relative' }}>
        <button
          data-panel="theme"
          onClick={onShowThemePanel}
          onMouseEnter={() => setHoveredButton('themes')}
          onMouseLeave={() => setHoveredButton(null)}
          style={ICON_BUTTON_BASE}
        >
          <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3m4 3a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3M5.5 7a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m.5 6a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3"/>
            <path d="M16 8c0 3.15-1.866 2.585-3.567 2.07C11.42 9.763 10.465 9.473 10 10c-.603.683-.475 1.819-.351 2.92C9.826 14.495 9.996 16 8 16a8 8 0 1 1 8-8m-8 7c.611 0 .654-.171.655-.176.078-.146.124-.464.07-1.119-.014-.168-.037-.37-.061-.591-.052-.464-.112-1.005-.118-1.462-.01-.707.083-1.61.704-2.314.369-.417.845-.578 1.272-.618.404-.038.812.026 1.16.104.343.077.702.186 1.025.284l.028.008c.346.105.658.199.953.266.653.148.904.083.991.024C14.717 9.38 15 9.161 15 8a7 7 0 1 0-7 7"/>
          </svg>
        </button>
        <Tooltip text={t('controlPanel.themes', 'Themes')} visible={hoveredButton === 'themes'} />
      </div>

      {/* User/Login Button */}
      <div style={{ position: 'relative' }}>
        {authState.isAuthenticated ? (
          <button
            onClick={onShowUserMenu}
            onMouseEnter={() => setHoveredButton('user')}
            onMouseLeave={() => setHoveredButton(null)}
            style={ICON_BUTTON_BASE}
          >
            <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10z"/>
            </svg>
          </button>
        ) : (
          <button
            onClick={onShowAuthModal}
            onMouseEnter={() => setHoveredButton('login')}
            onMouseLeave={() => setHoveredButton(null)}
            style={ICON_BUTTON_BASE}
          >
            <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10z"/>
            </svg>
          </button>
        )}
        <Tooltip
          text={authState.isAuthenticated ? (authState.user?.email?.split('@')[0] || t('nav.user', 'User')) : t('nav.login', 'Login')}
          visible={hoveredButton === 'user' || hoveredButton === 'login'}
        />
      </div>

      {/* Settings Button */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={onNavigateToSettings}
          onMouseEnter={() => setHoveredButton('settings')}
          onMouseLeave={() => setHoveredButton(null)}
          style={ICON_BUTTON_BASE}
        >
          <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z"/>
            <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115l.094-.319z"/>
          </svg>
        </button>
        <Tooltip text={t('nav.settings', 'Settings')} visible={hoveredButton === 'settings'} />
      </div>

      {/* MIDI Bridge Toggle */}
      {midiBridgeConnected && onToggleMidiControl && (
        <div style={{ position: 'relative' }}>
          <button
            onClick={onToggleMidiControl}
            onMouseEnter={() => setHoveredButton('midi')}
            onMouseLeave={() => setHoveredButton(null)}
            style={midiControlEnabled ? ICON_BUTTON_ACTIVE : ICON_BUTTON_MIDI_OFF}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <circle cx="7.5" cy="9.5" r="1.2" fill="currentColor" stroke="none"/>
              <circle cx="9.5" cy="7.5" r="1.2" fill="currentColor" stroke="none"/>
              <circle cx="12" cy="6.5" r="1.2" fill="currentColor" stroke="none"/>
              <circle cx="14.5" cy="7.5" r="1.2" fill="currentColor" stroke="none"/>
              <circle cx="16.5" cy="9.5" r="1.2" fill="currentColor" stroke="none"/>
            </svg>
            <div style={midiControlEnabled ? MIDI_DOT_ON : MIDI_DOT_OFF} />
          </button>
          <Tooltip
            text={midiControlEnabled ? t('nav.midiControlOn', 'MIDI Control: ON') : t('nav.midiControlOff', 'MIDI Control: OFF')}
            visible={hoveredButton === 'midi'}
          />
        </div>
      )}

      {/* Update Available Button */}
      {updateAvailable && onShowUpdateModal && (
        <div style={{ position: 'relative' }}>
          <button
            onClick={onShowUpdateModal}
            onMouseEnter={() => setHoveredButton('update')}
            onMouseLeave={() => setHoveredButton(null)}
            style={ICON_BUTTON_UPDATE}
          >
            <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm.93-9.412-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l-.088.416c-.287.346-.92.598-1.465.598-.703 0-1.002-.422-.808-1.319l.738-3.468c.064-.293.006-.399-.287-.399l-.399.047-.058-.294L8.04 6.146h.892l-.93 4.442zm.053-3.224a.95.95 0 1 1-1.9 0 .95.95 0 0 1 1.9 0z"/>
            </svg>
          </button>
          <Tooltip text={t('nav.updateAvailable', 'Update Available')} visible={hoveredButton === 'update'} />
        </div>
      )}
    </div>
  );
});

VerticalSidebar.displayName = 'VerticalSidebar';

export default VerticalSidebar;
