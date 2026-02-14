import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

/** Streaming display ID — matches STREAMING_DISPLAY_ID in displayManager */
const STREAMING_DISPLAY_ID = -9999;

interface StreamStatus {
  isStreaming: boolean;
  stopping: boolean;
  startedAt: number | null;
  fps: number;
  bitrate: string;
  droppedFrames: number;
  duration: string;
  error: string | null;
}

interface StreamingConfig {
  rtmpUrl: string;
  streamKey: string;
  audioDeviceName: string;
  videoDeviceName: string;
  qualityPreset: 'low' | 'medium' | 'high';
}

interface Theme {
  id: string;
  name: string;
  [key: string]: any;
}

const STORAGE_KEY = 'solucast-streaming-config';

function loadSavedConfig(): Partial<StreamingConfig> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return {};
}

function saveConfig(config: Partial<StreamingConfig>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {}
}

const QUALITY_LABELS: Record<string, string> = {
  low: '720p 30fps (2.5 Mbps)',
  medium: '1080p 30fps (4.5 Mbps)',
  high: '1080p 60fps (6 Mbps)'
};

// --- Static Styles (module-level to avoid re-allocation) ---

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
};

const modalContainerStyle: React.CSSProperties = {
  background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px',
  padding: '24px', width: '460px', maxHeight: '85vh', overflow: 'auto',
  boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
};

const headerRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px'
};

const headerLeftStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '10px'
};

const titleStyle: React.CSSProperties = {
  fontSize: '1.1rem', fontWeight: 600, color: 'white'
};

const liveBadgeStyle: React.CSSProperties = {
  background: '#f44336', color: 'white', fontSize: '0.7rem', fontWeight: 700,
  padding: '2px 8px', borderRadius: '4px', letterSpacing: '0.05em',
  animation: 'streamingPulse 2s ease infinite'
};

const closeButtonStyle: React.CSSProperties = {
  background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '1.2rem'
};

const statsGridStyle: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px'
};

const errorBoxStyle: React.CSSProperties = {
  padding: '10px 12px', background: 'rgba(244,67,54,0.15)', border: '1px solid rgba(244,67,54,0.3)',
  borderRadius: '8px', color: '#ef5350', fontSize: '0.8rem'
};

const errorBoxLiveStyle: React.CSSProperties = {
  ...errorBoxStyle, marginBottom: '16px'
};

const configSectionStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: '14px'
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white',
  fontSize: '0.85rem', outline: 'none', fontFamily: 'inherit'
};

const inputWithPaddingStyle: React.CSSProperties = {
  ...inputStyle, paddingRight: '40px'
};

const showHideBtnStyle: React.CSSProperties = {
  position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
  background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '0.75rem'
};

const emptyMessageStyle: React.CSSProperties = {
  color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', padding: '8px'
};

const qualityRowStyle: React.CSSProperties = {
  display: 'flex', gap: '8px'
};

const qualityBtnBase: React.CSSProperties = {
  flex: 1, padding: '8px 4px', borderRadius: '8px', fontSize: '0.75rem', cursor: 'pointer'
};

const qualityBtnActive: React.CSSProperties = {
  ...qualityBtnBase,
  border: '1px solid rgba(244,67,54,0.5)', background: 'rgba(244,67,54,0.15)',
  color: '#f44336', fontWeight: 600
};

const qualityBtnInactive: React.CSSProperties = {
  ...qualityBtnBase,
  border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)',
  color: 'rgba(255,255,255,0.7)', fontWeight: 400
};

const stopBtnBaseStyle: React.CSSProperties = {
  width: '100%', padding: '12px', background: 'rgba(244,67,54,0.2)', border: '1px solid rgba(244,67,54,0.4)',
  borderRadius: '10px', color: '#f44336', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600
};

const stopBtnActiveStyle: React.CSSProperties = { ...stopBtnBaseStyle, opacity: 1 };
const stopBtnDisabledStyle: React.CSSProperties = { ...stopBtnBaseStyle, opacity: 0.5 };

const relativeWrapperStyle: React.CSSProperties = { position: 'relative' };

const startBtnBaseStyle: React.CSSProperties = {
  width: '100%', padding: '12px', borderRadius: '10px', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', border: 'none'
};

const startBtnEnabledStyle: React.CSSProperties = {
  ...startBtnBaseStyle,
  background: 'linear-gradient(135deg, #f44336, #d32f2f)',
  color: 'white', opacity: 1, boxShadow: '0 2px 8px rgba(244,67,54,0.4)'
};

const startBtnStartingStyle: React.CSSProperties = {
  ...startBtnBaseStyle,
  background: 'linear-gradient(135deg, #f44336, #d32f2f)',
  color: 'white', opacity: 0.5, boxShadow: '0 2px 8px rgba(244,67,54,0.4)'
};

const startBtnDisabledStyle: React.CSSProperties = {
  ...startBtnBaseStyle,
  background: 'rgba(255,255,255,0.05)',
  color: 'rgba(255,255,255,0.3)', opacity: 1, boxShadow: 'none'
};

const statBoxOuterStyle: React.CSSProperties = {
  padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px',
  border: '1px solid rgba(255,255,255,0.06)'
};

const statBoxLabelStyle: React.CSSProperties = {
  fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', marginBottom: '4px',
  textTransform: 'uppercase', letterSpacing: '0.05em'
};

const statBoxValueStyle: React.CSSProperties = {
  fontSize: '1rem', fontWeight: 600, color: 'white', fontVariantNumeric: 'tabular-nums'
};

const statBoxWarnStyle: React.CSSProperties = {
  ...statBoxValueStyle, color: '#ff9800'
};

const fieldGroupHeaderStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px'
};

const fieldGroupLabelStyle: React.CSSProperties = {
  fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', fontWeight: 500
};

const refreshBtnStyle: React.CSSProperties = {
  background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: '0.7rem', padding: '2px 4px'
};

const themeSectionStyle: React.CSSProperties = {
  borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '14px'
};

const themeSectionHeaderStyle: React.CSSProperties = {
  fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', fontWeight: 500, marginBottom: '8px'
};

// --- Helper Components (memoized to prevent unnecessary re-renders) ---

const StatBox = React.memo<{ label: string; value: string; warn?: boolean }>(({ label, value, warn }) => (
  <div style={statBoxOuterStyle}>
    <div style={statBoxLabelStyle}>{label}</div>
    <div style={warn ? statBoxWarnStyle : statBoxValueStyle}>{value}</div>
  </div>
));

const FieldGroup = React.memo<{ label: string; action?: React.ReactNode; children: React.ReactNode }>(({ label, action, children }) => (
  <div>
    <div style={fieldGroupHeaderStyle}>
      <label style={fieldGroupLabelStyle}>{label}</label>
      {action}
    </div>
    {children}
  </div>
));

const RefreshBtn = React.memo<{ onClick: () => void }>(({ onClick }) => (
  <button onClick={onClick} style={refreshBtnStyle}>Refresh</button>
));

// --- Main Component ---

interface LivestreamSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  themes: Theme[];
  bibleThemes: Theme[];
  prayerThemes: Theme[];
  obsThemes?: Theme[];
  onThemeOverrideChanged: () => void;
}

const LivestreamSettingsModal: React.FC<LivestreamSettingsModalProps> = ({
  isOpen,
  onClose,
  themes,
  bibleThemes,
  prayerThemes,
  obsThemes,
  onThemeOverrideChanged
}) => {
  const saved = useMemo(() => loadSavedConfig(), []);

  const [rtmpUrl, setRtmpUrl] = useState(saved.rtmpUrl || 'rtmp://a.rtmp.youtube.com/live2');
  const [streamKey, setStreamKey] = useState(saved.streamKey || '');
  const [showKey, setShowKey] = useState(false);
  const [audioDeviceName, setAudioDeviceName] = useState(saved.audioDeviceName || '');
  const [videoDeviceName, setVideoDeviceName] = useState(saved.videoDeviceName || '');
  const [qualityPreset, setQualityPreset] = useState<'low' | 'medium' | 'high'>(saved.qualityPreset || 'medium');

  const [audioDevices, setAudioDevices] = useState<string[]>([]);
  const [videoDevices, setVideoDevices] = useState<string[]>([]);
  const [status, setStatus] = useState<StreamStatus>({
    isStreaming: false,
    stopping: false,
    startedAt: null,
    fps: 0,
    bitrate: '',
    droppedFrames: 0,
    duration: '00:00:00',
    error: null
  });
  const [starting, setStarting] = useState(false);

  // Theme override state for streaming display
  const [themeOverrides, setThemeOverrides] = useState<Record<string, string>>({});

  // Ref-based elapsed timer to avoid re-renders every second
  const elapsedRef = useRef<HTMLDivElement>(null);

  // Load initial data
  useEffect(() => {
    if (!isOpen) return;

    const api = window.electronAPI?.streaming;
    if (!api) return;

    api.getStatus().then(setStatus);
    api.listAudioDevices().then((devs) => {
      setAudioDevices(devs);
      if (devs.length > 0) {
        setAudioDeviceName(prev => (prev && devs.includes(prev)) ? prev : devs[0]);
      }
    });
    api.listVideoDevices?.()?.then((devs) => {
      setVideoDevices(devs);
    }).catch(() => {});

    // Load theme overrides for streaming display
    window.electronAPI?.displayThemeOverrides?.getForDisplay(STREAMING_DISPLAY_ID).then((data: any[]) => {
      const overrides: Record<string, string> = {};
      data.forEach((o: any) => {
        overrides[o.themeType] = o.themeId;
      });
      setThemeOverrides(overrides);
    }).catch(() => {});

    const unsub = api.onStatus((s) => setStatus(s));
    return unsub;
  }, [isOpen]);

  // Elapsed time ticker — updates DOM directly via ref (no re-renders)
  useEffect(() => {
    if (!status.isStreaming || !status.startedAt) {
      if (elapsedRef.current) elapsedRef.current.textContent = '00:00:00';
      return;
    }
    const startedAt = status.startedAt;
    const tick = () => {
      if (!elapsedRef.current) return;
      const elapsed = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
      const h = String(Math.floor(elapsed / 3600)).padStart(2, '0');
      const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
      const s = String(elapsed % 60).padStart(2, '0');
      elapsedRef.current.textContent = `${h}:${m}:${s}`;
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [status.isStreaming, status.startedAt]);

  const handleStart = useCallback(async () => {
    if (!audioDeviceName || !streamKey || !rtmpUrl) return;
    setStarting(true);

    saveConfig({ rtmpUrl, streamKey, audioDeviceName, videoDeviceName, qualityPreset });

    try {
      const result = await window.electronAPI?.streaming.start({
        rtmpUrl,
        streamKey,
        displayId: STREAMING_DISPLAY_ID,
        audioDeviceName,
        videoDeviceName: videoDeviceName || undefined,
        qualityPreset
      });

      if (result && !result.success) {
        setStatus(prev => ({ ...prev, error: result.error || 'Failed to start' }));
      }
    } catch (err) {
      setStatus(prev => ({ ...prev, error: `Failed to start: ${err}` }));
    } finally {
      setStarting(false);
    }
  }, [rtmpUrl, streamKey, audioDeviceName, videoDeviceName, qualityPreset]);

  const handleStop = useCallback(async () => {
    try {
      await window.electronAPI?.streaming.stop();
    } catch {
      // Stop errors handled by status updates
    }
  }, []);

  const handleRefreshAudio = useCallback(async () => {
    try {
      const devs = await window.electronAPI?.streaming.listAudioDevices();
      if (devs) {
        setAudioDevices(devs);
        setAudioDeviceName(prev => {
          if (!prev || !devs.includes(prev)) {
            return devs.length > 0 ? devs[0] : '';
          }
          return prev;
        });
      }
    } catch {}
  }, []);

  const handleRefreshVideo = useCallback(async () => {
    try {
      const devs = await window.electronAPI?.streaming.listVideoDevices?.();
      if (devs) {
        setVideoDevices(devs);
        setVideoDeviceName(prev => {
          if (prev && !devs.includes(prev)) return '';
          return prev;
        });
      }
    } catch {}
  }, []);

  const handleThemeOverrideChange = useCallback(async (themeType: 'viewer' | 'bible' | 'prayer', themeId: string) => {
    try {
      if (themeId === '') {
        await window.electronAPI?.displayThemeOverrides?.remove(STREAMING_DISPLAY_ID, themeType);
        setThemeOverrides(prev => {
          const next = { ...prev };
          delete next[themeType];
          return next;
        });
      } else {
        await window.electronAPI?.displayThemeOverrides?.set(STREAMING_DISPLAY_ID, themeType, themeId);
        setThemeOverrides(prev => ({ ...prev, [themeType]: themeId }));
      }
      onThemeOverrideChanged();
    } catch {}
  }, [onThemeOverrideChanged]);

  if (!isOpen) return null;

  const isConfigValid = !!audioDeviceName && !!streamKey && !!rtmpUrl;
  const startBtnStyle = !isConfigValid ? startBtnDisabledStyle : starting ? startBtnStartingStyle : startBtnEnabledStyle;

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalContainerStyle} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={headerRowStyle}>
          <div style={headerLeftStyle}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f44336" strokeWidth="2">
              <path d="M4.75 15.75v-8.5a2 2 0 0 1 2-2h10.5a2 2 0 0 1 2 2v8.5" />
              <circle cx="12" cy="11" r="3" />
              <path d="M8.5 8a5 5 0 0 1 7 0" />
              <path d="M6 5.5a8 8 0 0 1 12 0" />
              <line x1="12" y1="19" x2="12" y2="22" />
              <line x1="8" y1="22" x2="16" y2="22" />
            </svg>
            <span style={titleStyle}>Livestream Settings</span>
            {status.isStreaming && (
              <span style={liveBadgeStyle}>LIVE</span>
            )}
          </div>
          <button onClick={onClose} style={closeButtonStyle}>&times;</button>
        </div>

        {status.isStreaming ? (
          /* Live Status Section */
          <div>
            {/* Stats */}
            <div style={statsGridStyle}>
              {/* Elapsed time uses ref-based DOM updates (no re-renders) */}
              <div style={statBoxOuterStyle}>
                <div style={statBoxLabelStyle}>ELAPSED</div>
                <div ref={elapsedRef} style={statBoxValueStyle}>00:00:00</div>
              </div>
              <StatBox label="FPS" value={status.fps > 0 ? status.fps.toFixed(1) : '--'} />
              <StatBox label="Bitrate" value={status.bitrate || '--'} />
              <StatBox label="Dropped Frames" value={String(status.droppedFrames)} warn={status.droppedFrames > 0} />
            </div>

            {/* Error message */}
            {status.error && <div style={errorBoxLiveStyle}>{status.error}</div>}

            {/* Stop button */}
            <button onClick={handleStop} disabled={status.stopping} style={status.stopping ? stopBtnDisabledStyle : stopBtnActiveStyle}>
              {status.stopping ? 'Stopping...' : 'Stop Streaming'}
            </button>
          </div>
        ) : (
          /* Configuration Section */
          <div style={configSectionStyle}>
            {/* RTMP URL */}
            <FieldGroup label="RTMP URL">
              <input type="text" value={rtmpUrl} onChange={e => setRtmpUrl(e.target.value)}
                placeholder="rtmp://a.rtmp.youtube.com/live2" style={inputStyle} />
            </FieldGroup>

            {/* Stream Key */}
            <FieldGroup label="Stream Key">
              <div style={relativeWrapperStyle}>
                <input type={showKey ? 'text' : 'password'} value={streamKey}
                  onChange={e => setStreamKey(e.target.value)} placeholder="Enter your stream key"
                  style={inputWithPaddingStyle} />
                <button onClick={() => setShowKey(!showKey)} style={showHideBtnStyle}>
                  {showKey ? 'Hide' : 'Show'}
                </button>
              </div>
            </FieldGroup>

            {/* Audio Device selector */}
            <FieldGroup label="Audio Device" action={<RefreshBtn onClick={handleRefreshAudio} />}>
              {audioDevices.length === 0 ? (
                <div style={emptyMessageStyle}>No audio devices found.</div>
              ) : (
                <select value={audioDeviceName} onChange={e => setAudioDeviceName(e.target.value)} style={inputStyle}>
                  {audioDevices.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              )}
            </FieldGroup>

            {/* Camera / Video Device selector */}
            <FieldGroup label="Camera (PiP Overlay)" action={<RefreshBtn onClick={handleRefreshVideo} />}>
              <select value={videoDeviceName} onChange={e => setVideoDeviceName(e.target.value)} style={inputStyle}>
                <option value="">None — slides only</option>
                {videoDevices.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </FieldGroup>

            {/* Quality preset */}
            <FieldGroup label="Quality">
              <div style={qualityRowStyle}>
                {(['low', 'medium', 'high'] as const).map(preset => (
                  <button key={preset} onClick={() => setQualityPreset(preset)}
                    style={qualityPreset === preset ? qualityBtnActive : qualityBtnInactive}>
                    {QUALITY_LABELS[preset]}
                  </button>
                ))}
              </div>
            </FieldGroup>

            {/* Error message */}
            {status.error && <div style={errorBoxStyle}>{status.error}</div>}

            {/* Start button */}
            <button onClick={handleStart} disabled={!isConfigValid || starting} style={startBtnStyle}>
              {starting ? 'Starting...' : 'Start Streaming'}
            </button>
          </div>
        )}

        {/* Theme Overrides — always visible (both config and live states) */}
        <div style={themeSectionStyle}>
          <div style={themeSectionHeaderStyle}>Theme Overrides</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <FieldGroup label="Songs Theme">
              <select
                value={themeOverrides['viewer'] || ''}
                onChange={e => handleThemeOverrideChange('viewer', e.target.value)}
                style={inputStyle}
              >
                <option value="">Use Global Theme</option>
                {themes.map(theme => (
                  <option key={theme.id} value={theme.id}>{theme.name}</option>
                ))}
                {obsThemes && obsThemes.filter(t => t.type === 'songs').length > 0 && (
                  <optgroup label="OBS Themes">
                    {obsThemes.filter(t => t.type === 'songs').map(theme => (
                      <option key={theme.id} value={theme.id}>{theme.name}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </FieldGroup>

            <FieldGroup label="Bible Theme">
              <select
                value={themeOverrides['bible'] || ''}
                onChange={e => handleThemeOverrideChange('bible', e.target.value)}
                style={inputStyle}
              >
                <option value="">Use Global Theme</option>
                {bibleThemes.map(theme => (
                  <option key={theme.id} value={theme.id}>{theme.name}</option>
                ))}
                {obsThemes && obsThemes.filter(t => t.type === 'bible').length > 0 && (
                  <optgroup label="OBS Themes">
                    {obsThemes.filter(t => t.type === 'bible').map(theme => (
                      <option key={theme.id} value={theme.id}>{theme.name}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </FieldGroup>

            <FieldGroup label="Prayer Theme">
              <select
                value={themeOverrides['prayer'] || ''}
                onChange={e => handleThemeOverrideChange('prayer', e.target.value)}
                style={inputStyle}
              >
                <option value="">Use Global Theme</option>
                {prayerThemes.map(theme => (
                  <option key={theme.id} value={theme.id}>{theme.name}</option>
                ))}
                {obsThemes && obsThemes.filter(t => t.type === 'prayer').length > 0 && (
                  <optgroup label="OBS Themes">
                    {obsThemes.filter(t => t.type === 'prayer').map(theme => (
                      <option key={theme.id} value={theme.id}>{theme.name}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </FieldGroup>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LivestreamSettingsModal;
