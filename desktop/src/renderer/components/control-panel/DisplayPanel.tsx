import React, { memo, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { colors, buttonStyles, dropdownStyles, panelStyles, flexStyles } from '../../styles/controlPanelStyles';

interface Display {
  id: number;
  label: string;
  bounds: { x: number; y: number; width: number; height: number };
  isPrimary: boolean;
  isAssigned: boolean;
  assignedType?: 'viewer' | 'stage';
}

interface DisplayPanelProps {
  displays: Display[];
  isOpen: boolean;
  isRTL: boolean;
  onToggle: () => void;
  onOpenDisplay: (displayId: number, type: 'viewer' | 'stage') => void;
  onCloseDisplay: (displayId: number) => void;
}

const DisplayPanel: React.FC<DisplayPanelProps> = memo(({
  displays,
  isOpen,
  isRTL,
  onToggle,
  onOpenDisplay,
  onCloseDisplay,
}) => {
  const { t } = useTranslation();

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

  const displayItemStyle = useMemo(() => ({
    ...flexStyles.rowBetween,
    padding: '10px',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '8px',
    marginBottom: '8px',
  }), []);

  return (
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
            <div key={display.id} style={displayItemStyle}>
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
                      background: '#28a745',
                      padding: '2px 6px',
                      borderRadius: '4px'
                    }}>
                      {display.assignedType}
                    </span>
                  )}
                </div>
                <div style={{ color: colors.text.muted, fontSize: '0.75rem' }}>
                  {display.bounds.width}x{display.bounds.height}
                </div>
              </div>

              {!display.isPrimary && (
                <div style={{ display: 'flex', gap: '4px' }}>
                  {display.isAssigned ? (
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
                  ) : (
                    <>
                      <button
                        onClick={() => onOpenDisplay(display.id, 'viewer')}
                        style={{
                          ...buttonStyles.base,
                          ...buttonStyles.small,
                          background: colors.button.info
                        }}
                      >
                        {t('controlPanel.viewer')}
                      </button>
                      <button
                        onClick={() => onOpenDisplay(display.id, 'stage')}
                        style={{
                          ...buttonStyles.base,
                          ...buttonStyles.small,
                          background: colors.button.secondary
                        }}
                      >
                        {t('controlPanel.stage')}
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
  );
});

DisplayPanel.displayName = 'DisplayPanel';

export default DisplayPanel;
