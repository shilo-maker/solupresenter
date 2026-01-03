import React, { memo, useMemo, useCallback, CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { colors, dropdownStyles } from '../../styles/controlPanelStyles';

interface Theme {
  id: string;
  name: string;
  isBuiltIn?: boolean;
}

interface ThemeDropdownProps {
  label: string;
  themes: Theme[];
  selectedTheme: Theme | null;
  isOpen: boolean;
  isRTL?: boolean;
  borderColor?: string;
  onToggle: () => void;
  onSelect: (theme: Theme) => void;
  onEdit?: (theme: Theme) => void;
}

const ThemeDropdown: React.FC<ThemeDropdownProps> = memo(({
  label,
  themes,
  selectedTheme,
  isOpen,
  isRTL = false,
  borderColor = colors.border.accent,
  onToggle,
  onSelect,
  onEdit,
}) => {
  const { t } = useTranslation();

  const containerStyle = useMemo((): CSSProperties => ({
    marginBottom: '10px',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  }), []);

  const labelStyle = useMemo((): CSSProperties => ({
    fontSize: '0.8rem',
    color: colors.text.secondary,
    whiteSpace: 'nowrap',
  }), []);

  const buttonStyle = useMemo((): CSSProperties => ({
    flex: 1,
    padding: '8px 12px',
    background: 'rgba(255,255,255,0.1)',
    border: `1px solid ${borderColor}`,
    borderRadius: '6px',
    color: 'white',
    fontSize: '0.8rem',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    textAlign: isRTL ? 'right' : 'left',
  }), [borderColor, isRTL]);

  const dropdownContainerStyle = useMemo((): CSSProperties => ({
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    background: '#2a2a3e',
    border: `1px solid ${borderColor}`,
    borderRadius: '8px',
    marginTop: '4px',
    zIndex: 100,
    maxHeight: '200px',
    overflowY: 'auto',
  }), [borderColor]);

  const handleSelect = useCallback((theme: Theme) => {
    onSelect(theme);
  }, [onSelect]);

  const handleEdit = useCallback((e: React.MouseEvent, theme: Theme) => {
    e.stopPropagation();
    if (onEdit) {
      onEdit(theme);
    }
  }, [onEdit]);

  return (
    <div style={containerStyle}>
      <label style={labelStyle}>{label}</label>
      <button onClick={onToggle} style={buttonStyle}>
        <span>{selectedTheme?.name || t('controlPanel.selectTheme', 'Select...')}</span>
        <span style={{
          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s',
          fontSize: '0.6rem',
        }}>
          ▼
        </span>
      </button>

      {isOpen && (
        <div style={dropdownContainerStyle}>
          {themes.map((theme) => (
            <div
              key={theme.id}
              onClick={() => handleSelect(theme)}
              style={{
                ...dropdownStyles.item,
                background: selectedTheme?.id === theme.id
                  ? 'rgba(102, 126, 234, 0.3)'
                  : 'transparent',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(102, 126, 234, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = selectedTheme?.id === theme.id
                  ? 'rgba(102, 126, 234, 0.3)'
                  : 'transparent';
              }}
            >
              <span style={{ color: 'white', fontSize: '0.85rem' }}>
                {theme.name}
              </span>
              {onEdit && (
                <button
                  onClick={(e) => handleEdit(e, theme)}
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    color: colors.text.secondary,
                    fontSize: '0.7rem',
                    cursor: 'pointer',
                  }}
                >
                  {t('common.edit', 'Edit')}
                </button>
              )}
            </div>
          ))}
          {themes.length === 0 && (
            <p style={{
              color: colors.text.muted,
              fontSize: '0.8rem',
              textAlign: 'center',
              padding: '12px',
            }}>
              {t('controlPanel.noThemesAvailable')}
            </p>
          )}
        </div>
      )}
    </div>
  );
});

ThemeDropdown.displayName = 'ThemeDropdown';

export default ThemeDropdown;
