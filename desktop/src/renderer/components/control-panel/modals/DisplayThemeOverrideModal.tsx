import React, { useState, useEffect, useCallback } from 'react';
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

interface DisplayThemeOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  displays: Display[];
  themes: Theme[];
  stageThemes: Theme[];
  bibleThemes: Theme[];
  prayerThemes: Theme[];
  onOverrideChanged: () => void;
}

const DisplayThemeOverrideModal: React.FC<DisplayThemeOverrideModalProps> = ({
  isOpen,
  onClose,
  displays,
  themes,
  stageThemes,
  bibleThemes,
  prayerThemes,
  onOverrideChanged
}) => {
  const { t } = useTranslation();
  const [overrides, setOverrides] = useState<ThemeOverride[]>([]);
  const [loading, setLoading] = useState(false);

  // Load existing overrides
  const loadOverrides = useCallback(async () => {
    try {
      const data = await window.electronAPI.displayThemeOverrides.getAll();
      setOverrides(data);
    } catch (error) {
      console.error('Failed to load display theme overrides:', error);
    }
  }, []);

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
  const handleThemeChange = async (
    displayId: number,
    themeType: 'viewer' | 'stage' | 'bible' | 'prayer',
    themeId: string
  ) => {
    setLoading(true);
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
    } catch (error) {
      console.error('Failed to update display theme override:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get themes for a specific type
  const getThemesForType = (themeType: 'viewer' | 'stage' | 'bible' | 'prayer'): Theme[] => {
    switch (themeType) {
      case 'viewer':
        return themes;
      case 'stage':
        return stageThemes;
      case 'bible':
        return bibleThemes;
      case 'prayer':
        return prayerThemes;
      default:
        return [];
    }
  };

  // Get the relevant theme types for a display based on its assigned type
  const getThemeTypesForDisplay = (display: Display): Array<'viewer' | 'stage' | 'bible' | 'prayer'> => {
    if (display.assignedType === 'stage') {
      return ['stage'];
    } else if (display.assignedType === 'viewer') {
      return ['viewer', 'bible', 'prayer'];
    }
    // Not assigned - show all options for future assignment
    return ['viewer', 'stage', 'bible', 'prayer'];
  };

  // Get display name for theme type
  const getThemeTypeName = (themeType: 'viewer' | 'stage' | 'bible' | 'prayer'): string => {
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
  };

  if (!isOpen) return null;

  const assignedDisplays = displays.filter(d => d.isAssigned);

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
            {t('displayThemeOverrides.title', 'Per-Display Theme Overrides')}
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
        <p style={{
          color: 'rgba(255,255,255,0.7)',
          fontSize: '0.85rem',
          marginBottom: '20px',
          lineHeight: 1.5
        }}>
          {t('displayThemeOverrides.description', 'Configure specific themes for individual displays. When set to "Use Global", the display will use whatever theme is selected in the main theme selector.')}
        </p>

        {/* Display List */}
        {assignedDisplays.length === 0 ? (
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
              {t('displayThemeOverrides.noDisplays', 'No displays are currently active. Open a viewer or stage display to configure per-display themes.')}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {assignedDisplays.map((display, index) => (
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
                        {getThemesForType(themeType).map(theme => (
                          <option key={theme.id} value={theme.id} style={{ background: '#1e1e32' }}>
                            {theme.name}
                          </option>
                        ))}
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
};

export default DisplayThemeOverrideModal;
