import React, { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { colors, buttonStyles, dropdownStyles, panelStyles, flexStyles } from '../../styles/controlPanelStyles';
import DisplaySettingsModal from './modals/DisplaySettingsModal';
import { DisplayAssignedType, DISPLAY_TYPE_BADGE_COLORS } from './panels/types';

interface Theme {
  id: string;
  name: string;
}

interface Display {
  id: number;
  label: string;
  bounds: { x: number; y: number; width: number; height: number };
  isPrimary: boolean;
  isAssigned: boolean;
  assignedType?: DisplayAssignedType;
}

interface DisplayPanelProps {
  displays: Display[];
  isOpen: boolean;
  isRTL: boolean;
  onToggle: () => void;
  onOpenDisplay: (displayId: number, type: DisplayAssignedType, deviceId?: string) => void;
  onCloseDisplay: (displayId: number) => void;
  // Theme props for the settings modal
  themes?: Theme[];
  stageThemes?: Theme[];
  bibleThemes?: Theme[];
  prayerThemes?: Theme[];
  onThemeOverrideChanged?: () => void;
}

const DisplayPanel: React.FC<DisplayPanelProps> = memo(({
  displays,
  isOpen,
  isRTL,
  onToggle,
  onOpenDisplay,
  onCloseDisplay,
  themes = [],
  stageThemes = [],
  bibleThemes = [],
  prayerThemes = [],
  onThemeOverrideChanged = () => {},
}) => {
  const { t } = useTranslation();
  const [hoveredDisplayId, setHoveredDisplayId] = useState<number | null>(null);
  const [settingsDisplay, setSettingsDisplay] = useState<Display | null>(null);

  const assignedDisplays = useMemo(() =>
    displays.filter(d => d.isAssigned),
    [displays]
  );

  const buttonStyle = useMemo(() => ({
    background: assignedDisplays.length > 0 ? colors.button.success : 'rgba(255,255,255,0.1)',
    border: 'none',
    borderRadius: '10px',
    padding: '10px 16px',
    color: 'white',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  }), [assignedDisplays.length]);

  const dropdownStyle = useMemo(() => ({
    ...dropdownStyles.container,
    top: '100%',
    left: isRTL ? 'auto' : 0,
    right: isRTL ? 0 : 'auto',
    marginTop: '8px',
    padding: '12px',
    minWidth: '280px',
  }), [isRTL]);

  const handleQuickStart = (display: Display) => {
    // Quick start with default type (viewer)
    onOpenDisplay(display.id, 'viewer');
  };

  const handleOpenSettings = (display: Display, e: React.MouseEvent) => {
    e.stopPropagation();
    setSettingsDisplay(display);
  };

  return (
    <>
      <div data-panel="display" style={{ position: 'relative' }}>
        <button onClick={onToggle} style={buttonStyle}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" fill="none" stroke="white" strokeWidth="2"/>
            <line x1="8" y1="21" x2="16" y2="21" stroke="white" strokeWidth="2"/>
            <line x1="12" y1="17" x2="12" y2="21" stroke="white" strokeWidth="2"/>
          </svg>
          <span style={{ fontWeight: 500 }}>
            {assignedDisplays.length > 0
              ? `${assignedDisplays.length} ${assignedDisplays.length > 1 ? t('controlPanel.displays') : t('controlPanel.display')}`
              : t('controlPanel.displays')}
          </span>
        </button>

        {isOpen && (
          <div style={dropdownStyle}>
            <h4 style={{ ...panelStyles.sectionTitle, marginBottom: '12px' }}>
              {t('controlPanel.connectedDisplays')}
            </h4>

            {displays.map((display) => (
              <div
                key={display.id}
                style={{
                  ...flexStyles.rowBetween,
                  padding: '10px',
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: '8px',
                  marginBottom: '8px',
                }}
                onMouseEnter={() => setHoveredDisplayId(display.id)}
                onMouseLeave={() => setHoveredDisplayId(null)}
              >
                <div>
                  <div style={{ color: 'white', fontWeight: 500 }}>
                    {display.label}
                    {display.isPrimary && (
                      <span style={{
                        marginLeft: '8px',
                        fontSize: '0.7rem',
                        background: colors.button.info,
                        padding: '2px 6px',
                        borderRadius: '4px'
                      }}>
                        {t('controlPanel.primary')}
                      </span>
                    )}
                    {display.isAssigned && (
                      <span style={{
                        marginLeft: '8px',
                        fontSize: '0.7rem',
                        background: DISPLAY_TYPE_BADGE_COLORS[display.assignedType!] || '#28a745',
                        padding: '2px 6px',
                        borderRadius: '4px'
                      }}>
                        {display.assignedType === 'camera' ? t('controlPanel.camera', 'Camera') : display.assignedType === 'stage' ? t('controlPanel.stage') : t('controlPanel.viewer')}
                      </span>
                    )}
                  </div>
                  <div style={{ color: colors.text.muted, fontSize: '0.75rem' }}>
                    {display.bounds.width}x{display.bounds.height}
                  </div>
                </div>

                {!display.isPrimary && (
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {display.isAssigned ? (
                      <>
                        {/* Settings button (always visible when assigned) */}
                        <button
                          onClick={(e) => handleOpenSettings(display, e)}
                          style={{
                            ...buttonStyles.base,
                            ...buttonStyles.small,
                            background: 'rgba(255,255,255,0.1)',
                            padding: '6px',
                            minWidth: 'auto'
                          }}
                          title={t('displaySettings.title', 'Display Settings')}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                            <circle cx="12" cy="12" r="3" />
                            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                          </svg>
                        </button>
                        {/* Close button */}
                        <button
                          onClick={() => onCloseDisplay(display.id)}
                          style={{
                            ...buttonStyles.base,
                            ...buttonStyles.small,
                            background: colors.button.danger
                          }}
                        >
                          {t('common.close')}
                        </button>
                      </>
                    ) : (
                      <>
                        {/* Settings gear - visible on hover */}
                        {hoveredDisplayId === display.id && (
                          <button
                            onClick={(e) => handleOpenSettings(display, e)}
                            style={{
                              ...buttonStyles.base,
                              ...buttonStyles.small,
                              background: 'rgba(255,255,255,0.1)',
                              padding: '6px',
                              minWidth: 'auto'
                            }}
                            title={t('displaySettings.title', 'Display Settings')}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                              <circle cx="12" cy="12" r="3" />
                              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                            </svg>
                          </button>
                        )}
                        {/* Start button */}
                        <button
                          onClick={() => handleQuickStart(display)}
                          style={{
                            ...buttonStyles.base,
                            ...buttonStyles.small,
                            background: colors.button.success
                          }}
                        >
                          {t('controlPanel.start', 'Start')}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Display Settings Modal */}
      <DisplaySettingsModal
        isOpen={settingsDisplay !== null}
        onClose={() => setSettingsDisplay(null)}
        display={settingsDisplay}
        themes={themes}
        stageThemes={stageThemes}
        bibleThemes={bibleThemes}
        prayerThemes={prayerThemes}
        onStart={onOpenDisplay}
        onThemeOverrideChanged={onThemeOverrideChanged}
      />
    </>
  );
});

DisplayPanel.displayName = 'DisplayPanel';

export default DisplayPanel;
