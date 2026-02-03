import React, { useState, useEffect, useCallback, memo, useMemo } from 'react';
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

interface ThemeOverride {
  id: number;
  displayId: number;
  themeType: 'viewer' | 'stage' | 'bible' | 'prayer';
  themeId: string;
}

interface OBSTheme {
  id: string;
  name: string;
  type?: 'songs' | 'bible' | 'prayer';
}

interface DisplayThemeOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  displays: Display[];
  themes: Theme[];
  stageThemes: Theme[];
  bibleThemes: Theme[];
  prayerThemes: Theme[];
  onOverrideChanged: () => void;
  /** Optional: Show settings only for a specific display */
  selectedDisplayId?: number | 'obs' | null;
  /** OBS themes for OBS mode */
  obsThemes?: OBSTheme[];
  selectedOBSSongsTheme?: OBSTheme | null;
  selectedOBSBibleTheme?: OBSTheme | null;
  selectedOBSPrayerTheme?: OBSTheme | null;
  onApplyOBSTheme?: (theme: OBSTheme) => void;
}

// Helper function moved outside component - doesn't depend on any state/props
const getThemeTypesForDisplay = (display: Display): Array<'viewer' | 'stage' | 'bible' | 'prayer'> => {
  if (display.assignedType === 'stage') {
    return ['stage'];
  } else if (display.assignedType === 'viewer') {
    return ['viewer', 'bible', 'prayer'];
  }
  // Not assigned - show all options for future assignment
  return ['viewer', 'stage', 'bible', 'prayer'];
};

const DisplayThemeOverrideModal = memo<DisplayThemeOverrideModalProps>(({
  isOpen,
  onClose,
  displays,
  themes,
  stageThemes,
  bibleThemes,
  prayerThemes,
  onOverrideChanged,
  selectedDisplayId,
  obsThemes = [],
  selectedOBSSongsTheme,
  selectedOBSBibleTheme,
  selectedOBSPrayerTheme,
  onApplyOBSTheme
}) => {
  const { t } = useTranslation();
  const [overrides, setOverrides] = useState<ThemeOverride[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing overrides
  const loadOverrides = useCallback(async () => {
    try {
      setError(null);
      const data = await window.electronAPI.displayThemeOverrides.getAll();
      setOverrides(data);
    } catch (err) {
      console.error('Failed to load display theme overrides:', err);
      setError(t('displayThemeOverrides.loadError', 'Failed to load theme overrides'));
    }
  }, [t]);

  useEffect(() => {
    if (isOpen) {
      loadOverrides();
    }
  }, [isOpen, loadOverrides]);

  // Get the current override for a display and theme type
  const getOverrideThemeId = (displayId: number, themeType: 'viewer' | 'stage' | 'bible' | 'prayer'): string | null => {
    const override = overrides.find(o => o.displayId === displayId && o.themeType === themeType);
    return override?.themeId || null;
  };

  // Handle theme selection change
  const handleThemeChange = useCallback(async (
    displayId: number,
    themeType: 'viewer' | 'stage' | 'bible' | 'prayer',
    themeId: string
  ) => {
    setLoading(true);
    setError(null);
    try {
      if (themeId === '') {
        // Remove override (use global theme)
        await window.electronAPI.displayThemeOverrides.remove(displayId, themeType);
      } else {
        // Set override
        await window.electronAPI.displayThemeOverrides.set(displayId, themeType, themeId);
      }
      await loadOverrides();
      onOverrideChanged();
    } catch (err) {
      console.error('Failed to update display theme override:', err);
      setError(t('displayThemeOverrides.updateError', 'Failed to update theme override. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [loadOverrides, onOverrideChanged, t]);

  // Memoized theme map for efficient lookups
  const themesMap = useMemo(() => ({
    viewer: themes,
    stage: stageThemes,
    bible: bibleThemes,
    prayer: prayerThemes
  }), [themes, stageThemes, bibleThemes, prayerThemes]);

  // Memoized OBS themes filtered by type
  const obsThemesMap = useMemo(() => ({
    viewer: obsThemes.filter(t => t.type === 'songs'),
    bible: obsThemes.filter(t => t.type === 'bible'),
    prayer: obsThemes.filter(t => t.type === 'prayer')
  }), [obsThemes]);

  // Get themes for a specific type
  const getThemesForType = useCallback((themeType: 'viewer' | 'stage' | 'bible' | 'prayer'): Theme[] => {
    return themesMap[themeType] || [];
  }, [themesMap]);

  // Get OBS themes for a specific type (viewer uses 'songs', others match directly)
  const getOBSThemesForType = useCallback((themeType: 'viewer' | 'stage' | 'bible' | 'prayer'): OBSTheme[] => {
    if (themeType === 'stage') return []; // No OBS themes for stage
    return obsThemesMap[themeType] || [];
  }, [obsThemesMap]);

  // Get display name for theme type
  const getThemeTypeName = useCallback((themeType: 'viewer' | 'stage' | 'bible' | 'prayer'): string => {
    switch (themeType) {
      case 'viewer':
        return t('displayThemeOverrides.songsTheme', 'Songs Theme');
      case 'stage':
        return t('displayThemeOverrides.stageTheme', 'Stage Theme');
      case 'bible':
        return t('displayThemeOverrides.bibleTheme', 'Bible Theme');
      case 'prayer':
        return t('displayThemeOverrides.prayerTheme', 'Prayer Theme');
      default:
        return themeType;
    }
  }, [t]);

  if (!isOpen) return null;

  // Determine which displays to show
  const isOBSMode = selectedDisplayId === 'obs';
  const isSingleDisplayMode = selectedDisplayId !== undefined && selectedDisplayId !== null && !isOBSMode;

  let displayList: Display[];
  if (isOBSMode) {
    // OBS mode - create a virtual display for OBS
    displayList = [];
  } else if (isSingleDisplayMode) {
    // Single display mode - show only the selected display
    const targetDisplay = displays.find(d => d.id === selectedDisplayId);
    displayList = targetDisplay ? [targetDisplay] : [];
  } else {
    // Show all assigned displays
    displayList = displays.filter(d => d.isAssigned);
  }

  // Get title based on mode
  const getTitle = () => {
    if (isOBSMode) {
      return t('displayThemeOverrides.obsTitle', 'OBS Theme Settings');
    }
    if (isSingleDisplayMode && displayList.length > 0) {
      return t('displayThemeOverrides.displayTitle', 'Theme Settings - {{displayName}}', { displayName: displayList[0].label });
    }
    return t('displayThemeOverrides.title', 'Per-Display Theme Overrides');
  };

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
          minWidth: '500px',
          maxWidth: '700px',
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h2 style={{ margin: 0, color: 'white', fontSize: '1.25rem' }}>
            {getTitle()}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '8px',
              padding: '8px',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Description */}
        {!isOBSMode && (
          <p style={{
            color: 'rgba(255,255,255,0.7)',
            fontSize: '0.85rem',
            marginBottom: '20px',
            lineHeight: 1.5
          }}>
            {isSingleDisplayMode
              ? t('displayThemeOverrides.singleDescription', 'Override the global theme for this display. When set to "Use Global", it will use the theme from Settings.')
              : t('displayThemeOverrides.description', 'Configure specific themes for individual displays. When set to "Use Global", the display will use whatever theme is selected in the main theme selector.')}
          </p>
        )}
        {isOBSMode && (
          <p style={{
            color: 'rgba(255,255,255,0.7)',
            fontSize: '0.85rem',
            marginBottom: '20px',
            lineHeight: 1.5
          }}>
            {t('displayThemeOverrides.obsDescription', 'OBS themes are configured in the Global Themes section of Settings. Per-display overrides are not available for OBS.')}
          </p>
        )}

        {/* Error Message */}
        {error && (
          <div style={{
            padding: '10px 16px',
            background: 'rgba(220, 53, 69, 0.2)',
            border: '1px solid rgba(220, 53, 69, 0.5)',
            borderRadius: '8px',
            marginBottom: '16px',
            color: '#ff6b6b',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        {/* Display List */}
        {isOBSMode ? (
          <div style={{
            background: 'rgba(23, 162, 184, 0.1)',
            borderRadius: '12px',
            border: '1px solid rgba(23, 162, 184, 0.3)',
            padding: '16px'
          }}>
            {/* OBS Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '16px'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(23, 162, 184, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#17a2b8" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              </div>
              <div>
                <div style={{ color: 'white', fontWeight: 500 }}>OBS Browser Source</div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>
                  {t('displayThemeOverrides.obsGlobalThemes', 'Global OBS Themes')}
                </div>
              </div>
            </div>

            {/* OBS Theme Selectors */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* OBS Songs Theme */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', minWidth: '100px' }}>
                  {t('controlPanel.obsSongsTheme', 'OBS Songs')}:
                </label>
                <select
                  value={selectedOBSSongsTheme?.id || ''}
                  onChange={(e) => {
                    const theme = obsThemes.find(t => t.id === e.target.value);
                    if (theme && onApplyOBSTheme) onApplyOBSTheme(theme);
                  }}
                  style={{
                    flex: 1,
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(102, 126, 234, 0.4)',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    color: 'white',
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  <option value="" style={{ background: '#1e1e32' }}>
                    {t('common.selectTheme', 'Select...')}
                  </option>
                  {obsThemes.filter(t => t.type === 'songs').map(theme => (
                    <option key={theme.id} value={theme.id} style={{ background: '#1e1e32' }}>
                      {theme.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* OBS Bible Theme */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', minWidth: '100px' }}>
                  {t('controlPanel.obsBibleTheme', 'OBS Bible')}:
                </label>
                <select
                  value={selectedOBSBibleTheme?.id || ''}
                  onChange={(e) => {
                    const theme = obsThemes.find(t => t.id === e.target.value);
                    if (theme && onApplyOBSTheme) onApplyOBSTheme(theme);
                  }}
                  style={{
                    flex: 1,
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(76, 175, 80, 0.4)',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    color: 'white',
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  <option value="" style={{ background: '#1e1e32' }}>
                    {t('common.selectTheme', 'Select...')}
                  </option>
                  {obsThemes.filter(t => t.type === 'bible').map(theme => (
                    <option key={theme.id} value={theme.id} style={{ background: '#1e1e32' }}>
                      {theme.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* OBS Prayer Theme */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', minWidth: '100px' }}>
                  {t('controlPanel.obsPrayerTheme', 'OBS Prayer')}:
                </label>
                <select
                  value={selectedOBSPrayerTheme?.id || ''}
                  onChange={(e) => {
                    const theme = obsThemes.find(t => t.id === e.target.value);
                    if (theme && onApplyOBSTheme) onApplyOBSTheme(theme);
                  }}
                  style={{
                    flex: 1,
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(6, 182, 212, 0.4)',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    color: 'white',
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  <option value="" style={{ background: '#1e1e32' }}>
                    {t('common.selectTheme', 'Select...')}
                  </option>
                  {obsThemes.filter(t => t.type === 'prayer').map(theme => (
                    <option key={theme.id} value={theme.id} style={{ background: '#1e1e32' }}>
                      {theme.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        ) : displayList.length === 0 ? (
          <div style={{
            padding: '40px 20px',
            textAlign: 'center',
            color: 'rgba(255,255,255,0.5)'
          }}>
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              style={{ marginBottom: '12px', opacity: 0.5 }}
            >
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            <p style={{ margin: 0 }}>
              {isSingleDisplayMode
                ? t('displayThemeOverrides.displayNotFound', 'Display not found or not active.')
                : t('displayThemeOverrides.noDisplays', 'No displays are currently active. Open a viewer or stage display to configure per-display themes.')}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {displayList.map((display, index) => (
              <div
                key={display.id}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: '12px',
                  padding: '16px',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}
              >
                {/* Display Header */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '12px'
                }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: display.assignedType === 'stage' ? 'rgba(108, 117, 125, 0.3)' : 'rgba(33, 150, 243, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: display.assignedType === 'stage' ? '#adb5bd' : '#2196F3',
                    fontWeight: 'bold',
                    fontSize: '0.9rem'
                  }}>
                    {displays.indexOf(display) + 1}
                  </div>
                  <div>
                    <div style={{ color: 'white', fontWeight: 500 }}>
                      {display.label}
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>
                      {display.bounds.width}x{display.bounds.height} - {display.assignedType === 'stage' ? t('controlPanel.stage', 'Stage') : t('controlPanel.viewer', 'Viewer')}
                    </div>
                  </div>
                </div>

                {/* Theme Selectors */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {getThemeTypesForDisplay(display).map(themeType => (
                    <div
                      key={themeType}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                      }}
                    >
                      <label style={{
                        color: 'rgba(255,255,255,0.7)',
                        fontSize: '0.85rem',
                        minWidth: '100px'
                      }}>
                        {getThemeTypeName(themeType)}:
                      </label>
                      <select
                        value={getOverrideThemeId(display.id, themeType) || ''}
                        onChange={(e) => handleThemeChange(display.id, themeType, e.target.value)}
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
                        {getThemesForType(themeType).length > 0 && (
                          <optgroup label={t('displayThemeOverrides.regularThemes', 'Regular Themes')} style={{ background: '#1e1e32' }}>
                            {getThemesForType(themeType).map(theme => (
                              <option key={theme.id} value={theme.id} style={{ background: '#1e1e32' }}>
                                {theme.name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {getOBSThemesForType(themeType).length > 0 && (
                          <optgroup label={t('displayThemeOverrides.obsThemes', 'OBS Themes')} style={{ background: '#1e1e32' }}>
                            {getOBSThemesForType(themeType).map(theme => (
                              <option key={theme.id} value={theme.id} style={{ background: '#1e1e32' }}>
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
            ))}
          </div>
        )}

        {/* Footer */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginTop: '20px',
          paddingTop: '16px',
          borderTop: '1px solid rgba(255,255,255,0.1)'
        }}>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 24px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 500
            }}
          >
            {t('common.close', 'Close')}
          </button>
        </div>
      </div>
    </div>
  );
});

DisplayThemeOverrideModal.displayName = 'DisplayThemeOverrideModal';

export default DisplayThemeOverrideModal;
