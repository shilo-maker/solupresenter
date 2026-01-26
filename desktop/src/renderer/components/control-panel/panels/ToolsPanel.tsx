import React, { useState, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../styles/controlPanelStyles';

type ToolsTab = 'countdown' | 'announce' | 'clock' | 'stopwatch';

export interface ToolsPanelProps {
  // Countdown state
  countdownTargetTime: string;
  countdownRemaining: string;
  countdownMessage: string;
  countdownMessageTranslation: string;
  isCountdownActive: boolean;
  onCountdownTargetTimeChange: (value: string) => void;
  onCountdownMessageChange: (value: string) => void;
  onCountdownMessageTranslationChange: (value: string) => void;
  onStartCountdown: () => void;
  onStopCountdown: () => void;
  onAddCountdownToSetlist: () => void;

  // Announcement state
  announcementText: string;
  isAnnouncementActive: boolean;
  onAnnouncementTextChange: (value: string) => void;
  onShowAnnouncement: () => void;
  onHideAnnouncement: () => void;
  onAddAnnouncementToSetlist: () => void;

  // Clock state
  currentTime: Date;
  clockFormat: '12h' | '24h';
  clockShowDate: boolean;
  isClockActive: boolean;
  onClockFormatChange: (format: '12h' | '24h') => void;
  onClockShowDateToggle: () => void;
  onStartClock: () => void;
  onStopClock: () => void;

  // Stopwatch state
  stopwatchTime: number;
  isStopwatchRunning: boolean;
  isStopwatchActive: boolean;
  onStartStopwatch: () => void;
  onPauseStopwatch: () => void;
  onResetStopwatch: () => void;
  onStopStopwatchBroadcast: () => void;
}

// Format clock time
const formatClockTime = (date: Date, format: '12h' | '24h'): string => {
  if (format === '12h') {
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours}:${minutes}:${seconds} ${ampm}`;
  } else {
    return date.toLocaleTimeString('en-GB', { hour12: false });
  }
};

// Format clock date
const formatClockDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

// Format stopwatch time
const formatStopwatchTime = (totalSeconds: number): string => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const ToolsPanel = memo<ToolsPanelProps>(({
  // Countdown
  countdownTargetTime,
  countdownRemaining,
  countdownMessage,
  countdownMessageTranslation,
  isCountdownActive,
  onCountdownTargetTimeChange,
  onCountdownMessageChange,
  onCountdownMessageTranslationChange,
  onStartCountdown,
  onStopCountdown,
  onAddCountdownToSetlist,
  // Announcement
  announcementText,
  isAnnouncementActive,
  onAnnouncementTextChange,
  onShowAnnouncement,
  onHideAnnouncement,
  onAddAnnouncementToSetlist,
  // Clock
  currentTime,
  clockFormat,
  clockShowDate,
  isClockActive,
  onClockFormatChange,
  onClockShowDateToggle,
  onStartClock,
  onStopClock,
  // Stopwatch
  stopwatchTime,
  isStopwatchRunning,
  isStopwatchActive,
  onStartStopwatch,
  onPauseStopwatch,
  onResetStopwatch,
  onStopStopwatchBroadcast
}) => {
  const { t } = useTranslation();
  const [activeToolsTab, setActiveToolsTab] = useState<ToolsTab>('countdown');

  const toolsTabs = [
    {
      key: 'countdown',
      label: t('tools.countdown'),
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      )
    },
    {
      key: 'announce',
      label: t('tools.announce'),
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      )
    },
    {
      key: 'clock',
      label: t('tools.clock'),
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      )
    },
    {
      key: 'stopwatch',
      label: t('tools.stopwatch'),
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="13" r="8" />
          <path d="M12 9v4l2 2" />
          <path d="M5 3L2 6" />
          <path d="M22 6l-3-3" />
          <path d="M12 5V2" />
        </svg>
      )
    }
  ];

  return (
    <div style={{ display: 'flex', padding: '12px', flexDirection: 'column', gap: '12px' }}>
      {/* Tools Tab Selector */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
        {toolsTabs.map((tab) => (
          <div
            key={tab.key}
            onClick={() => setActiveToolsTab(tab.key as ToolsTab)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '6px 2px',
              borderRadius: '8px',
              cursor: 'pointer',
              background: activeToolsTab === tab.key
                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                : 'rgba(255,255,255,0.08)',
              border: activeToolsTab === tab.key
                ? '1px solid rgba(255,255,255,0.3)'
                : '1px solid rgba(255,255,255,0.1)',
              color: 'white',
              transition: 'all 0.2s ease'
            }}
          >
            {tab.icon}
            <span style={{ fontSize: '0.55rem', marginTop: '2px', fontWeight: activeToolsTab === tab.key ? 600 : 400 }}>{tab.label}</span>
          </div>
        ))}
      </div>

      {/* Countdown Tab */}
      {activeToolsTab === 'countdown' && (
        <div>
          {isCountdownActive ? (
            <div>
              <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: '#06b6d4', marginBottom: '4px' }}>{countdownRemaining}</div>
              </div>
              {/* Editable message fields while countdown is running */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                <input
                  type="text"
                  placeholder="הודעה (עברית)"
                  value={countdownMessage}
                  onChange={(e) => onCountdownMessageChange(e.target.value)}
                  dir="rtl"
                  style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', padding: '8px', color: 'white', fontSize: '0.85rem' }}
                />
                <input
                  type="text"
                  placeholder="Message (English)"
                  value={countdownMessageTranslation}
                  onChange={(e) => onCountdownMessageTranslationChange(e.target.value)}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', padding: '8px', color: 'white', fontSize: '0.85rem' }}
                />
              </div>
              <button onClick={onStopCountdown} style={{ background: colors.button.danger, border: 'none', borderRadius: '8px', padding: '10px 20px', color: 'white', cursor: 'pointer', width: '100%', fontSize: '0.9rem' }}>{t('controlPanel.stopCountdown')}</button>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input
                  type="time"
                  value={countdownTargetTime}
                  onChange={(e) => onCountdownTargetTimeChange(e.target.value)}
                  style={{ flex: '0 0 110px', background: '#2a2a4a', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', padding: '8px', color: 'white', fontSize: '0.85rem' }}
                />
                <input
                  type="text"
                  placeholder="הודעה (עברית)"
                  value={countdownMessage}
                  onChange={(e) => onCountdownMessageChange(e.target.value)}
                  dir="rtl"
                  style={{ flex: 1, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', padding: '8px', color: 'white', fontSize: '0.85rem' }}
                />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <input
                  type="text"
                  placeholder="Message (English)"
                  value={countdownMessageTranslation}
                  onChange={(e) => onCountdownMessageTranslationChange(e.target.value)}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', padding: '8px', color: 'white', fontSize: '0.85rem' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={onStartCountdown}
                  disabled={!countdownTargetTime}
                  style={{
                    flex: 1,
                    background: countdownTargetTime ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'rgba(255,255,255,0.1)',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 20px',
                    color: 'white',
                    cursor: countdownTargetTime ? 'pointer' : 'not-allowed',
                    fontSize: '0.9rem'
                  }}
                >
                  {t('tools.broadcastCountdown')}
                </button>
                <button
                  onClick={onAddCountdownToSetlist}
                  disabled={!countdownTargetTime}
                  style={{
                    flex: 1,
                    background: countdownTargetTime ? '#28a745' : 'rgba(255,255,255,0.1)',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 20px',
                    color: 'white',
                    cursor: countdownTargetTime ? 'pointer' : 'not-allowed',
                    fontSize: '0.9rem'
                  }}
                >
                  {t('tools.addToSetlist')}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Announce Tab */}
      {activeToolsTab === 'announce' && (
        <div>
          {/* Preset buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '12px' }}>
            {[
              { en: 'Welcome!', he: 'ברוכים הבאים!' },
              { en: 'Silence phones', he: 'השתיקו טלפונים' },
              { en: 'Please be seated', he: 'נא לשבת' },
              { en: 'Register now!', he: 'הרשמו עכשיו!' }
            ].map((item, idx) => (
              <button
                key={idx}
                onClick={() => onAnnouncementTextChange(item.he)}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '6px',
                  padding: '6px 8px',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  textAlign: 'center'
                }}
              >
                {item.he}
              </button>
            ))}
          </div>

          <input
            type="text"
            placeholder={t('tools.announcementPlaceholder')}
            value={announcementText}
            onChange={(e) => onAnnouncementTextChange(e.target.value)}
            style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', padding: '10px', color: 'white', fontSize: '0.85rem', marginBottom: '12px' }}
          />

          {isAnnouncementActive ? (
            <button
              onClick={onHideAnnouncement}
              style={{
                width: '100%',
                background: colors.button.danger,
                border: 'none',
                borderRadius: '8px',
                padding: '10px 20px',
                color: 'white',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              {t('controlPanel.stopBroadcasting')}
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={onShowAnnouncement}
                disabled={!announcementText.trim()}
                style={{
                  flex: 1,
                  background: announcementText.trim() ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  color: 'white',
                  cursor: announcementText.trim() ? 'pointer' : 'not-allowed',
                  fontSize: '0.9rem'
                }}
              >
                {t('tools.broadcastAnnouncement')}
              </button>
              <button
                onClick={onAddAnnouncementToSetlist}
                disabled={!announcementText.trim()}
                style={{
                  flex: 1,
                  background: announcementText.trim() ? '#28a745' : 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  color: 'white',
                  cursor: announcementText.trim() ? 'pointer' : 'not-allowed',
                  fontSize: '0.9rem'
                }}
              >
                {t('tools.addToSetlist')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Clock Tab */}
      {activeToolsTab === 'clock' && (
        <div style={{ textAlign: 'center' }}>
          {/* Live Clock Display */}
          <div style={{
            fontSize: '2rem',
            fontWeight: 700,
            color: isClockActive ? '#00d4ff' : 'white',
            marginBottom: '4px',
            fontFamily: 'monospace'
          }}>
            {formatClockTime(currentTime, clockFormat)}
          </div>
          {clockShowDate && (
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', marginBottom: '12px' }}>
              {formatClockDate(currentTime)}
            </div>
          )}

          {/* Format Toggle */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '12px' }}>
            <button
              onClick={() => onClockFormatChange('12h')}
              style={{
                background: clockFormat === '12h' ? '#667eea' : 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 12px',
                color: 'white',
                cursor: 'pointer',
                fontSize: '0.8rem'
              }}
            >
              {t('tools.format12h')}
            </button>
            <button
              onClick={() => onClockFormatChange('24h')}
              style={{
                background: clockFormat === '24h' ? '#667eea' : 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 12px',
                color: 'white',
                cursor: 'pointer',
                fontSize: '0.8rem'
              }}
            >
              {t('tools.format24h')}
            </button>
            <button
              onClick={onClockShowDateToggle}
              style={{
                background: clockShowDate ? '#667eea' : 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 12px',
                color: 'white',
                cursor: 'pointer',
                fontSize: '0.8rem'
              }}
            >
              {t('tools.showDate')}
            </button>
          </div>

          {/* Broadcast Button */}
          {isClockActive ? (
            <button
              onClick={onStopClock}
              style={{
                width: '100%',
                background: colors.button.danger,
                border: 'none',
                borderRadius: '8px',
                padding: '10px 20px',
                color: 'white',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              {t('controlPanel.stopBroadcasting')}
            </button>
          ) : (
            <button
              onClick={onStartClock}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 20px',
                color: 'white',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              {t('tools.broadcastClock')}
            </button>
          )}
        </div>
      )}

      {/* Stopwatch Tab */}
      {activeToolsTab === 'stopwatch' && (
        <div style={{ textAlign: 'center' }}>
          {/* Stopwatch Display */}
          <div style={{
            fontSize: '2.5rem',
            fontWeight: 700,
            color: isStopwatchRunning ? '#00d4ff' : 'white',
            marginBottom: '16px',
            fontFamily: 'monospace'
          }}>
            {formatStopwatchTime(stopwatchTime)}
          </div>

          {/* Control Buttons */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '12px' }}>
            {!isStopwatchRunning ? (
              <button
                onClick={onStartStopwatch}
                style={{
                  flex: 1,
                  background: '#28a745',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 16px',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: 600
                }}
              >
                {stopwatchTime > 0 ? t('tools.resume') : t('tools.start')}
              </button>
            ) : (
              <button
                onClick={onPauseStopwatch}
                style={{
                  flex: 1,
                  background: '#ffc107',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 16px',
                  color: '#000',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: 600
                }}
              >
                {t('tools.pause')}
              </button>
            )}
            <button
              onClick={onResetStopwatch}
              disabled={stopwatchTime === 0}
              style={{
                flex: 1,
                background: stopwatchTime > 0 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 16px',
                color: stopwatchTime > 0 ? 'white' : 'rgba(255,255,255,0.3)',
                cursor: stopwatchTime > 0 ? 'pointer' : 'not-allowed',
                fontSize: '0.9rem'
              }}
            >
              {t('tools.reset')}
            </button>
          </div>

          {/* Broadcast Button */}
          {isStopwatchActive ? (
            <button
              onClick={onStopStopwatchBroadcast}
              style={{
                width: '100%',
                background: colors.button.danger,
                border: 'none',
                borderRadius: '8px',
                padding: '10px 20px',
                color: 'white',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              {t('controlPanel.stopBroadcasting')}
            </button>
          ) : (
            <button
              onClick={onStartStopwatch}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 20px',
                color: 'white',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              {t('tools.broadcastStopwatch')}
            </button>
          )}
        </div>
      )}
    </div>
  );
});

ToolsPanel.displayName = 'ToolsPanel';

export default ToolsPanel;
