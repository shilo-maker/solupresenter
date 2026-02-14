import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { DisplayAssignedType } from '../panels/types';

interface Theme {
  id: string;
  name: string;
}

interface Display {
  id: number;
  label: string;
  bounds: { width: number; height: number };
  isAssigned?: boolean;
  assignedType?: DisplayAssignedType;
}

interface DisplaySettings {
  displayType: DisplayAssignedType;
  useGlobalTheme: boolean;
  customThemeId?: string;
}

interface OBSTheme {
  id: string;
  name: string;
  type?: 'songs' | 'bible' | 'prayer';
}

interface DisplaySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  display: Display | null;
  themes: Theme[];
  stageThemes: Theme[];
  bibleThemes: Theme[];
  prayerThemes: Theme[];
  obsThemes?: OBSTheme[];
  onStart: (displayId: number, type: DisplayAssignedType, deviceId?: string, audioDeviceId?: string) => void;
  onThemeOverrideChanged: () => void;
}

const DisplaySettingsModal = memo<DisplaySettingsModalProps>(({
  isOpen,
  onClose,
  display,
  themes,
  stageThemes,
  bibleThemes,
  prayerThemes,
  obsThemes = [],
  onStart,
  onThemeOverrideChanged
}) => {
  const { t } = useTranslation();
  const [displayType, setDisplayType] = useState<DisplayAssignedType>('viewer');
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState<string>('');
  const [cameraError, setCameraError] = useState<string>('');
  const [enumerating, setEnumerating] = useState(false);
  // Track whether we already obtained getUserMedia permission this session
  const hasMediaPermission = useRef(false);

  // Load overrides for specific display (optimized - uses getForDisplay instead of getAll)
  const loadOverrides = useCallback(async (displayId: number) => {
    try {
      const data = await window.electronAPI.displayThemeOverrides.getForDisplay(displayId);
      const displayOverrides: Record<string, string> = {};
      data.forEach((o: any) => {
        displayOverrides[o.themeType] = o.themeId;
      });
      setOverrides(displayOverrides);
    } catch (err) {
      console.error('Failed to load display theme overrides:', err);
    }
  }, []);

  // Load existing overrides when modal opens
  useEffect(() => {
    if (isOpen && display) {
      loadOverrides(display.id);
      // If display is already assigned, use its type, otherwise default to viewer
      setDisplayType(display.assignedType || 'viewer');
    }
  }, [isOpen, display, loadOverrides]);

  // Core device enumeration logic - extracted so it can be called by both
  // the initial mount effect and the devicechange listener
  const refreshCameraDevices = useCallback(async () => {
    setEnumerating(true);
    setCameraError('');
    try {
      // Try enumerateDevices first without getUserMedia.
      // In Electron with proper permissions, labels are often already available.
      let devices = await navigator.mediaDevices.enumerateDevices();
      let videoDevices = devices.filter(d => d.kind === 'videoinput');

      // If we got devices but labels are empty, we need getUserMedia to unlock labels
      const needsPermission = videoDevices.length > 0 && !videoDevices[0].label;
      if (needsPermission && !hasMediaPermission.current) {
        let tempStream: MediaStream | null = null;
        try {
          tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          // Stop the stream immediately - we only needed it for the permission grant
          tempStream.getTracks().forEach(t => t.stop());
          hasMediaPermission.current = true;
        } catch (err: any) {
          // Permission denied or no camera available
          if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
            setCameraError('permission_denied');
          } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
            setCameraError('no_devices');
          } else {
            setCameraError('unknown');
          }
          // Still set whatever devices we found (they'll lack labels but have deviceIds)
          setCameraDevices(videoDevices);
          setAudioDevices([]);
          setEnumerating(false);
          return;
        }
        // Re-enumerate now that permission is granted to get labels
        devices = await navigator.mediaDevices.enumerateDevices();
        videoDevices = devices.filter(d => d.kind === 'videoinput');
      } else if (needsPermission) {
        // We already have permission from a previous call, re-enumerate should have labels
        devices = await navigator.mediaDevices.enumerateDevices();
        videoDevices = devices.filter(d => d.kind === 'videoinput');
      }

      setCameraDevices(videoDevices);
      // Also collect audio input devices from the same enumeration
      const audioInputDevices = devices.filter(d => d.kind === 'audioinput');
      setAudioDevices(audioInputDevices);
      // Preserve existing selection if the device still exists, otherwise pick first
      setSelectedDeviceId(prev => {
        if (prev && videoDevices.some(d => d.deviceId === prev)) return prev;
        return videoDevices.length > 0 ? videoDevices[0].deviceId : '';
      });
      setSelectedAudioDeviceId(prev => {
        if (prev && audioInputDevices.some(d => d.deviceId === prev)) return prev;
        return ''; // Default to no audio
      });
    } catch (err) {
      console.error('Failed to enumerate camera devices:', err);
      setCameraDevices([]);
      setAudioDevices([]);
      setCameraError('unknown');
    } finally {
      setEnumerating(false);
    }
  }, []);

  // Enumerate camera devices when modal opens AND listen for devicechange
  useEffect(() => {
    if (!isOpen) return;

    refreshCameraDevices();

    // Listen for device changes (plug/unplug) while modal is open
    const handleDeviceChange = () => {
      refreshCameraDevices();
    };
    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);

    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [isOpen, refreshCameraDevices]);

  // Reset non-persistent state when modal closes
  // Note: selectedDeviceId is intentionally NOT reset so the user's choice
  // persists across open/close cycles while the component is mounted
  useEffect(() => {
    if (!isOpen) {
      setDisplayType('viewer');
      setOverrides({});
      setLoading(false);
      setCameraError('');
      setCameraDevices([]);
      setAudioDevices([]);
    }
  }, [isOpen]);

  const handleThemeChange = useCallback(async (
    themeType: 'viewer' | 'stage' | 'bible' | 'prayer',
    themeId: string
  ) => {
    if (!display) return;
    setLoading(true);
    try {
      if (themeId === '') {
        await window.electronAPI.displayThemeOverrides.remove(display.id, themeType);
        setOverrides(prev => {
          const next = { ...prev };
          delete next[themeType];
          return next;
        });
      } else {
        await window.electronAPI.displayThemeOverrides.set(display.id, themeType, themeId);
        setOverrides(prev => ({ ...prev, [themeType]: themeId }));
      }
      onThemeOverrideChanged();
    } catch (err) {
      console.error('Failed to update theme override:', err);
    } finally {
      setLoading(false);
    }
  }, [display, onThemeOverrideChanged]);

  const handleStart = useCallback(async () => {
    if (!display) return;

    // If display is already assigned with the same type, just close the modal
    // Theme changes are already saved via handleThemeChange
    if (display.isAssigned && display.assignedType === displayType) {
      onClose();
      return;
    }

    // For camera type, validate that the selected device still exists before starting
    if (displayType === 'camera') {
      if (!selectedDeviceId) return;
      try {
        const currentDevices = await navigator.mediaDevices.enumerateDevices();
        const stillExists = currentDevices.some(
          d => d.kind === 'videoinput' && d.deviceId === selectedDeviceId
        );
        if (!stillExists) {
          // Device was unplugged between selection and clicking Start
          setCameraError('device_lost');
          refreshCameraDevices();
          return;
        }
      } catch {
        // Enumeration failed, proceed anyway and let DisplayViewer handle it
      }
      onStart(display.id, 'camera', selectedDeviceId, selectedAudioDeviceId || undefined);
    } else {
      onStart(display.id, displayType);
    }
    onClose();
  }, [display, displayType, selectedDeviceId, selectedAudioDeviceId, onStart, onClose, refreshCameraDevices]);

  // Memoized handlers for display type selection
  const handleSetViewer = useCallback(() => setDisplayType('viewer'), []);
  const handleSetStage = useCallback(() => setDisplayType('stage'), []);
  const handleSetCamera = useCallback(() => setDisplayType('camera'), []);

  // Memoized OBS themes filtered by type
  const obsThemesFiltered = useMemo(() => ({
    viewer: obsThemes.filter(t => t.type === 'songs'),
    bible: obsThemes.filter(t => t.type === 'bible'),
    prayer: obsThemes.filter(t => t.type === 'prayer')
  }), [obsThemes]);

  // Memoized theme types array with OBS themes support
  const themeTypes = useMemo(() => displayType === 'stage'
    ? [{ key: 'stage', label: t('displayThemeOverrides.stageTheme', 'Stage Theme'), themes: stageThemes, obsThemes: [] as OBSTheme[] }]
    : [
        { key: 'viewer', label: t('displayThemeOverrides.songsTheme', 'Songs Theme'), themes, obsThemes: obsThemesFiltered.viewer },
        { key: 'bible', label: t('displayThemeOverrides.bibleTheme', 'Bible Theme'), themes: bibleThemes, obsThemes: obsThemesFiltered.bible },
        { key: 'prayer', label: t('displayThemeOverrides.prayerTheme', 'Prayer Theme'), themes: prayerThemes, obsThemes: obsThemesFiltered.prayer }
      ], [displayType, t, stageThemes, themes, bibleThemes, prayerThemes, obsThemesFiltered]);

  // Memoized handler for stopPropagation
  const handleContentClick = useCallback((e: React.MouseEvent) => e.stopPropagation(), []);

  if (!isOpen || !display) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'rgba(24, 24, 27, 0.98)',
          borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.2)',
          padding: '24px',
          minWidth: '400px',
          maxWidth: '500px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
        }}
        onClick={handleContentClick}
        onMouseDown={() => window.focus()}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h2 style={{ margin: 0, color: 'white', fontSize: '1.15rem' }}>
            {t('displaySettings.title', 'Display Settings')} - {display.label}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '8px',
              padding: '8px',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Display Info */}
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '20px',
          fontSize: '0.85rem',
          color: 'rgba(255,255,255,0.7)'
        }}>
          {display.bounds.width} x {display.bounds.height}
        </div>

        {/* Display Type Selection */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', color: 'white', fontSize: '0.9rem', fontWeight: 500 }}>
            {t('displaySettings.displayType', 'Display Type')}
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleSetViewer}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '8px',
                border: displayType === 'viewer' ? '2px solid #2196F3' : '2px solid rgba(255,255,255,0.2)',
                background: displayType === 'viewer' ? 'rgba(33, 150, 243, 0.2)' : 'rgba(255,255,255,0.05)',
                color: 'white',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: displayType === 'viewer' ? 600 : 400
              }}
            >
              {t('controlPanel.viewer', 'Viewers')}
            </button>
            <button
              onClick={handleSetStage}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '8px',
                border: displayType === 'stage' ? '2px solid #9c27b0' : '2px solid rgba(255,255,255,0.2)',
                background: displayType === 'stage' ? 'rgba(156, 39, 176, 0.2)' : 'rgba(255,255,255,0.05)',
                color: 'white',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: displayType === 'stage' ? 600 : 400
              }}
            >
              {t('controlPanel.stage', 'Stage')}
            </button>
            <button
              onClick={handleSetCamera}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '8px',
                border: displayType === 'camera' ? '2px solid #00897b' : '2px solid rgba(255,255,255,0.2)',
                background: displayType === 'camera' ? 'rgba(0, 137, 123, 0.2)' : 'rgba(255,255,255,0.05)',
                color: 'white',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: displayType === 'camera' ? 600 : 400
              }}
            >
              {t('controlPanel.camera', 'Camera')}
            </button>
          </div>
        </div>

        {/* Camera Device Selection */}
        {displayType === 'camera' && (
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ color: 'white', fontSize: '0.9rem', fontWeight: 500 }}>
                {t('displaySettings.cameraDevice', 'Camera Device')}
              </label>
              <button
                onClick={refreshCameraDevices}
                disabled={enumerating}
                title={t('displaySettings.refreshDevices', 'Refresh device list')}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  color: 'rgba(255,255,255,0.7)',
                  cursor: enumerating ? 'wait' : 'pointer',
                  fontSize: '0.75rem'
                }}
              >
                {enumerating ? t('displaySettings.scanning', 'Scanning...') : t('displaySettings.refresh', 'Refresh')}
              </button>
            </div>
            {cameraError === 'permission_denied' ? (
              <p style={{ fontSize: '0.85rem', color: '#ef5350' }}>
                {t('displaySettings.cameraPermissionDenied', 'Camera access was denied. Please allow camera permissions in your system settings and try again.')}
              </p>
            ) : cameraError === 'device_lost' ? (
              <p style={{ fontSize: '0.85rem', color: '#ffa726' }}>
                {t('displaySettings.cameraDeviceLost', 'The selected camera was disconnected. Please select another device.')}
              </p>
            ) : cameraDevices.length === 0 && !enumerating ? (
              <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>
                {t('displaySettings.noCameras', 'No camera devices found. Connect a webcam or capture card.')}
              </p>
            ) : cameraDevices.length > 0 ? (
              <select
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '6px',
                  padding: '10px 12px',
                  color: 'white',
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                {cameraDevices.map(device => (
                  <option key={device.deviceId} value={device.deviceId} style={{ background: '#18181b' }}>
                    {device.label || `Camera ${device.deviceId.substring(0, 8)}`}
                  </option>
                ))}
              </select>
            ) : null}
            <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', marginTop: '8px' }}>
              {t('displaySettings.cameraDescription', 'Live camera feed as background with all presentation overlays on top.')}
            </p>

            {/* Audio Source Selection - only show when camera devices are available and no error */}
            {cameraDevices.length > 0 && !cameraError && (
              <>
                <label style={{ display: 'block', color: 'white', fontSize: '0.9rem', fontWeight: 500, marginTop: '16px', marginBottom: '8px' }}>
                  {t('displaySettings.audioSource', 'Audio Source')}
                </label>
                <select
                  value={selectedAudioDeviceId}
                  onChange={(e) => setSelectedAudioDeviceId(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '6px',
                    padding: '10px 12px',
                    color: 'white',
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  <option value="" style={{ background: '#18181b' }}>
                    {t('displaySettings.noAudio', '-- No Audio --')}
                  </option>
                  {audioDevices.map(device => (
                    <option key={device.deviceId} value={device.deviceId} style={{ background: '#18181b' }}>
                      {device.label || `Audio ${device.deviceId.substring(0, 8)}`}
                    </option>
                  ))}
                </select>
                <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', marginTop: '6px' }}>
                  {t('displaySettings.audioDescription', 'Send audio from a microphone or sound card to the camera display.')}
                </p>
              </>
            )}
          </div>
        )}

        {/* Theme Overrides */}
        {(
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', marginBottom: '12px', color: 'white', fontSize: '0.9rem', fontWeight: 500 }}>
            {t('displaySettings.themeSettings', 'Theme Settings')}
          </label>
          <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginBottom: '12px' }}>
            {t('displaySettings.themeDescription', 'Leave as "Use Global" to use the theme from Settings, or choose a custom theme for this display.')}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '120px' }}>
            {themeTypes.map(({ key, label, themes: themeList, obsThemes: obsThemeList }) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', minWidth: '100px' }}>
                  {label}:
                </label>
                <select
                  value={overrides[key] || ''}
                  onChange={(e) => handleThemeChange(key as any, e.target.value)}
                  disabled={loading}
                  style={{
                    flex: 1,
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    color: 'white',
                    fontSize: '0.85rem',
                    cursor: loading ? 'wait' : 'pointer'
                  }}
                >
                  <option value="" style={{ background: '#18181b' }}>
                    {t('displayThemeOverrides.useGlobal', '-- Use Global --')}
                  </option>
                  {themeList.length > 0 && (
                    <optgroup label={t('displayThemeOverrides.regularThemes', 'Regular Themes')} style={{ background: '#18181b' }}>
                      {themeList.map(theme => (
                        <option key={theme.id} value={theme.id} style={{ background: '#18181b' }}>
                          {theme.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {obsThemeList.length > 0 && (
                    <optgroup label={t('displayThemeOverrides.obsThemes', 'OBS Themes')} style={{ background: '#18181b' }}>
                      {obsThemeList.map(theme => (
                        <option key={theme.id} value={theme.id} style={{ background: '#18181b' }}>
                          {theme.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
            ))}
          </div>
        </div>
        )}

        {/* Footer Buttons */}
        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end',
          paddingTop: '16px',
          borderTop: '1px solid rgba(255,255,255,0.1)'
        }}>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 20px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            onClick={handleStart}
            disabled={displayType === 'camera' && (!selectedDeviceId || cameraDevices.length === 0 || !!cameraError)}
            style={{
              background: (displayType === 'camera' && (!selectedDeviceId || cameraDevices.length === 0 || !!cameraError))
                ? 'rgba(255,255,255,0.1)'
                : 'linear-gradient(135deg, #28a745, #20c997)',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 24px',
              color: 'white',
              cursor: (displayType === 'camera' && (!selectedDeviceId || cameraDevices.length === 0 || !!cameraError)) ? 'not-allowed' : 'pointer',
              fontSize: '0.9rem',
              fontWeight: 600,
              opacity: (displayType === 'camera' && (!selectedDeviceId || cameraDevices.length === 0 || !!cameraError)) ? 0.5 : 1
            }}
          >
            {display.isAssigned
              ? t('displaySettings.applyChanges', 'Apply Changes')
              : t('displaySettings.startDisplay', 'Start Display')}
          </button>
        </div>
      </div>
    </div>
  );
});

DisplaySettingsModal.displayName = 'DisplaySettingsModal';

export default DisplaySettingsModal;
