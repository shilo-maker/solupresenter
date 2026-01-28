import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useTranslation } from 'react-i18next';

interface Theme {
  id: string;
  name: string;
}

interface Display {
  id: number;
  label: string;
  bounds: { width: number; height: number };
  isAssigned?: boolean;
  assignedType?: 'viewer' | 'stage';
}

interface DisplaySettings {
  displayType: 'viewer' | 'stage';
  useGlobalTheme: boolean;
  customThemeId?: string;
}

interface DisplaySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  display: Display | null;
  themes: Theme[];
  stageThemes: Theme[];
  bibleThemes: Theme[];
  prayerThemes: Theme[];
  onStart: (displayId: number, type: 'viewer' | 'stage') => void;
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
  onStart,
  onThemeOverrideChanged
}) => {
  const { t } = useTranslation();
  const [displayType, setDisplayType] = useState<'viewer' | 'stage'>('viewer');
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

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

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setDisplayType('viewer');
      setOverrides({});
      setLoading(false);
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

  const handleStart = useCallback(() => {
    if (!display) return;
    onStart(display.id, displayType);
    onClose();
  }, [display, displayType, onStart, onClose]);

  // Memoized handlers for display type selection
  const handleSetViewer = useCallback(() => setDisplayType('viewer'), []);
  const handleSetStage = useCallback(() => setDisplayType('stage'), []);

  // Memoized theme types array
  const themeTypes = useMemo(() => displayType === 'stage'
    ? [{ key: 'stage', label: t('displayThemeOverrides.stageTheme', 'Stage Theme'), themes: stageThemes }]
    : [
        { key: 'viewer', label: t('displayThemeOverrides.songsTheme', 'Songs Theme'), themes },
        { key: 'bible', label: t('displayThemeOverrides.bibleTheme', 'Bible Theme'), themes: bibleThemes },
        { key: 'prayer', label: t('displayThemeOverrides.prayerTheme', 'Prayer Theme'), themes: prayerThemes }
      ], [displayType, t, stageThemes, themes, bibleThemes, prayerThemes]);

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
          background: 'rgba(30, 30, 50, 0.98)',
          borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.2)',
          padding: '24px',
          minWidth: '400px',
          maxWidth: '500px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
        }}
        onClick={handleContentClick}
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
          </div>
        </div>

        {/* Theme Overrides */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', marginBottom: '12px', color: 'white', fontSize: '0.9rem', fontWeight: 500 }}>
            {t('displaySettings.themeSettings', 'Theme Settings')}
          </label>
          <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginBottom: '12px' }}>
            {t('displaySettings.themeDescription', 'Leave as "Use Global" to use the theme from Settings, or choose a custom theme for this display.')}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '120px' }}>
            {themeTypes.map(({ key, label, themes: themeList }) => (
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
                  <option value="" style={{ background: '#1e1e32' }}>
                    {t('displayThemeOverrides.useGlobal', '-- Use Global --')}
                  </option>
                  {themeList.map(theme => (
                    <option key={theme.id} value={theme.id} style={{ background: '#1e1e32' }}>
                      {theme.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>

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
            style={{
              background: 'linear-gradient(135deg, #28a745, #20c997)',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 24px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 600
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
