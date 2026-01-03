import React, { memo, useState, useCallback, CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { colors } from '../../styles/controlPanelStyles';

// Inject minimal CSS for hover states (much faster than JS handlers)
const styleId = 'theme-dropdown-styles';
if (typeof document !== 'undefined' && !document.getElementById(styleId)) {
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    .theme-dd-item { cursor: pointer; }
    .theme-dd-item:hover { background: var(--hover-bg) !important; }
  `;
  document.head.appendChild(style);
}

interface Theme {
  id: string;
  name: string;
  isDefault?: boolean;
  type?: 'songs' | 'bible';
}

interface ThemeSelectionPanelProps {
  themes: Theme[];
  stageMonitorThemes: Theme[];
  bibleThemes: Theme[];
  prayerThemes: Theme[];
  obsThemes: Theme[];
  selectedTheme: Theme | null;
  selectedStageTheme: Theme | null;
  selectedBibleTheme: Theme | null;
  selectedPrayerTheme: Theme | null;
  selectedOBSTheme: Theme | null;
  isRTL: boolean;
  onApplyViewerTheme: (theme: Theme) => void;
  onApplyStageTheme: (theme: Theme) => void;
  onApplyBibleTheme: (theme: Theme) => void;
  onApplyPrayerTheme: (theme: Theme) => void;
  onApplyOBSTheme: (theme: Theme) => void;
  onCreateNewTheme: () => void;
  onCloseDisplayPanel: () => void;
}

// Static styles (never recreated)
const containerStyle: CSSProperties = {
  marginTop: '16px',
  paddingTop: '12px',
  borderTop: '1px solid rgba(255,255,255,0.1)',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '12px',
};

const titleStyle: CSSProperties = {
  margin: 0,
  color: 'white',
  fontSize: '0.9rem',
};

const createBtnStyle: CSSProperties = {
  background: colors.button.primary,
  border: 'none',
  borderRadius: '6px',
  padding: '4px 10px',
  color: 'white',
  fontSize: '0.75rem',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
};

const rowStyle: CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  marginBottom: '10px',
};

const labelStyle: CSSProperties = {
  fontSize: '0.8rem',
  color: 'rgba(255,255,255,0.7)',
  whiteSpace: 'nowrap',
};

const dropdownStyle: CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  right: 0,
  background: '#2a2a3e',
  borderRadius: '8px',
  marginTop: '4px',
  zIndex: 100,
  maxHeight: '200px',
  overflowY: 'auto',
};

const itemStyle: CSSProperties = {
  padding: '10px 12px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
};

const editBtnStyle: CSSProperties = {
  background: 'rgba(255,255,255,0.1)',
  border: 'none',
  borderRadius: '4px',
  padding: '4px 8px',
  color: 'rgba(255,255,255,0.7)',
  fontSize: '0.7rem',
  cursor: 'pointer',
};

const emptyStyle: CSSProperties = {
  color: 'rgba(255,255,255,0.5)',
  fontSize: '0.8rem',
  textAlign: 'center',
  padding: '12px',
};

const arrowStyle: CSSProperties = {
  fontSize: '0.6rem',
  display: 'inline-block',
};

const ThemeSelectionPanel: React.FC<ThemeSelectionPanelProps> = memo(({
  themes,
  stageMonitorThemes,
  bibleThemes,
  prayerThemes,
  obsThemes,
  selectedTheme,
  selectedStageTheme,
  selectedBibleTheme,
  selectedPrayerTheme,
  selectedOBSTheme,
  isRTL,
  onApplyViewerTheme,
  onApplyStageTheme,
  onApplyBibleTheme,
  onApplyPrayerTheme,
  onApplyOBSTheme,
  onCreateNewTheme,
  onCloseDisplayPanel,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState<'v' | 's' | 'b' | 'p' | 'o' | null>(null);

  const toggle = useCallback((d: 'v' | 's' | 'b' | 'p' | 'o') => {
    setOpen(p => p === d ? null : d);
  }, []);

  const edit = useCallback((e: React.MouseEvent, route: string) => {
    e.stopPropagation();
    navigate(route);
    onCloseDisplayPanel();
  }, [navigate, onCloseDisplayPanel]);

  const btnStyle = (borderColor: string): CSSProperties => ({
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
  });

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h4 style={titleStyle}>{t('themes.title')}</h4>
        <button onClick={onCreateNewTheme} style={createBtnStyle}>
          <span>+</span> {t('themes.createNew')}
        </button>
      </div>

      {/* Songs Theme */}
      <div style={rowStyle}>
        <label style={labelStyle}>{t('controlPanel.songsTheme', 'Songs Theme')}</label>
        <button onClick={() => toggle('v')} style={btnStyle('rgba(102, 126, 234, 0.5)')}>
          <span>{selectedTheme?.name || t('controlPanel.selectTheme', 'Select...')}</span>
          <span style={{ ...arrowStyle, transform: open === 'v' ? 'rotate(180deg)' : 'none' }}>▼</span>
        </button>
        {open === 'v' && (
          <div style={{ ...dropdownStyle, border: '1px solid rgba(102, 126, 234, 0.5)', '--hover-bg': 'rgba(102, 126, 234, 0.2)' } as CSSProperties}>
            {themes.map((theme) => (
              <div
                key={theme.id}
                className="theme-dd-item"
                onClick={() => { onApplyViewerTheme(theme); setOpen(null); }}
                style={{ ...itemStyle, background: selectedTheme?.id === theme.id ? 'rgba(102, 126, 234, 0.3)' : 'transparent' }}
              >
                <span style={{ color: 'white', fontSize: '0.85rem' }}>{theme.name}</span>
                <button onClick={(e) => edit(e, `/theme-editor?id=${theme.id}`)} style={editBtnStyle}>{t('common.edit', 'Edit')}</button>
              </div>
            ))}
            {themes.length === 0 && <p style={emptyStyle}>{t('controlPanel.noThemesAvailable')}</p>}
          </div>
        )}
      </div>

      {/* Stage Monitor Theme */}
      <div style={{ ...rowStyle, marginBottom: '10px' }}>
        <label style={labelStyle}>{t('controlPanel.stageMonitorTheme', 'Stage Monitor')}</label>
        <button onClick={() => toggle('s')} style={btnStyle('rgba(240, 147, 251, 0.5)')}>
          <span>{selectedStageTheme?.name || t('controlPanel.selectTheme', 'Select...')}</span>
          <span style={{ ...arrowStyle, transform: open === 's' ? 'rotate(180deg)' : 'none' }}>▼</span>
        </button>
        {open === 's' && (
          <div style={{ ...dropdownStyle, border: '1px solid rgba(240, 147, 251, 0.5)', '--hover-bg': 'rgba(240, 147, 251, 0.2)' } as CSSProperties}>
            {stageMonitorThemes.map((theme) => (
              <div
                key={theme.id}
                className="theme-dd-item"
                onClick={() => { onApplyStageTheme(theme); setOpen(null); }}
                style={{ ...itemStyle, background: selectedStageTheme?.id === theme.id ? 'rgba(240, 147, 251, 0.3)' : 'transparent' }}
              >
                <span style={{ color: 'white', fontSize: '0.85rem' }}>{theme.name}</span>
                <button onClick={(e) => edit(e, `/stage-monitor-editor?id=${theme.id}`)} style={editBtnStyle}>{t('common.edit', 'Edit')}</button>
              </div>
            ))}
            {stageMonitorThemes.length === 0 && <p style={emptyStyle}>{t('controlPanel.noStageMonitorThemes')}</p>}
          </div>
        )}
      </div>

      {/* Bible Theme */}
      <div style={rowStyle}>
        <label style={labelStyle}>{t('controlPanel.bibleTheme', 'Bible')}</label>
        <button onClick={() => toggle('b')} style={btnStyle('rgba(76, 175, 80, 0.5)')}>
          <span>{selectedBibleTheme?.name || t('controlPanel.selectTheme', 'Select...')}</span>
          <span style={{ ...arrowStyle, transform: open === 'b' ? 'rotate(180deg)' : 'none' }}>▼</span>
        </button>
        {open === 'b' && (
          <div style={{ ...dropdownStyle, border: '1px solid rgba(76, 175, 80, 0.5)', '--hover-bg': 'rgba(76, 175, 80, 0.2)' } as CSSProperties}>
            {bibleThemes.map((theme) => (
              <div
                key={theme.id}
                className="theme-dd-item"
                onClick={() => { onApplyBibleTheme(theme); setOpen(null); }}
                style={{ ...itemStyle, background: selectedBibleTheme?.id === theme.id ? 'rgba(76, 175, 80, 0.3)' : 'transparent' }}
              >
                <span style={{ color: 'white', fontSize: '0.85rem' }}>{theme.name}</span>
                <button onClick={(e) => edit(e, `/bible-theme-editor?id=${theme.id}`)} style={editBtnStyle}>{t('common.edit', 'Edit')}</button>
              </div>
            ))}
            {bibleThemes.length === 0 && <p style={emptyStyle}>{t('controlPanel.noThemesAvailable')}</p>}
          </div>
        )}
      </div>

      {/* Prayer/Sermon Theme */}
      <div style={rowStyle}>
        <label style={labelStyle}>{t('controlPanel.prayerTheme', 'Prayer/Sermon')}</label>
        <button onClick={() => toggle('p')} style={btnStyle('rgba(255, 140, 66, 0.5)')}>
          <span>{selectedPrayerTheme?.name || t('controlPanel.selectTheme', 'Select...')}</span>
          <span style={{ ...arrowStyle, transform: open === 'p' ? 'rotate(180deg)' : 'none' }}>▼</span>
        </button>
        {open === 'p' && (
          <div style={{ ...dropdownStyle, border: '1px solid rgba(255, 140, 66, 0.5)', '--hover-bg': 'rgba(255, 140, 66, 0.2)' } as CSSProperties}>
            {prayerThemes.map((theme) => (
              <div
                key={theme.id}
                className="theme-dd-item"
                onClick={() => { onApplyPrayerTheme(theme); setOpen(null); }}
                style={{ ...itemStyle, background: selectedPrayerTheme?.id === theme.id ? 'rgba(255, 140, 66, 0.3)' : 'transparent' }}
              >
                <span style={{ color: 'white', fontSize: '0.85rem' }}>{theme.name}</span>
                <button onClick={(e) => edit(e, `/prayer-theme-editor?id=${theme.id}`)} style={editBtnStyle}>{t('common.edit', 'Edit')}</button>
              </div>
            ))}
            {prayerThemes.length === 0 && <p style={emptyStyle}>{t('controlPanel.noThemesAvailable')}</p>}
          </div>
        )}
      </div>

      {/* OBS Overlay Theme */}
      <div style={{ ...rowStyle, marginBottom: 0 }}>
        <label style={labelStyle}>{t('controlPanel.obsTheme', 'OBS Overlay')}</label>
        <button onClick={() => toggle('o')} style={btnStyle('rgba(23, 162, 184, 0.5)')}>
          <span>{selectedOBSTheme?.name || t('controlPanel.selectTheme', 'Select...')}</span>
          <span style={{ ...arrowStyle, transform: open === 'o' ? 'rotate(180deg)' : 'none' }}>▼</span>
        </button>
        {open === 'o' && (
          <div style={{ ...dropdownStyle, border: '1px solid rgba(23, 162, 184, 0.5)', '--hover-bg': 'rgba(23, 162, 184, 0.2)' } as CSSProperties}>
            {obsThemes.map((theme) => (
              <div
                key={theme.id}
                className="theme-dd-item"
                onClick={() => { onApplyOBSTheme(theme); setOpen(null); }}
                style={{ ...itemStyle, background: selectedOBSTheme?.id === theme.id ? 'rgba(23, 162, 184, 0.3)' : 'transparent' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: 'white', fontSize: '0.85rem' }}>{theme.name}</span>
                  <span style={{
                    fontSize: '0.65rem',
                    padding: '2px 6px',
                    borderRadius: '3px',
                    background: theme.type === 'songs' ? 'rgba(102, 126, 234, 0.3)' : 'rgba(76, 175, 80, 0.3)',
                    color: theme.type === 'songs' ? '#a0b4f7' : '#81c784'
                  }}>
                    {theme.type === 'songs' ? t('themes.songs', 'Songs') : t('themes.bible', 'Bible')}
                  </span>
                </div>
                <button
                  onClick={(e) => edit(e, `${theme.type === 'songs' ? '/obs-songs-theme-editor' : '/obs-bible-theme-editor'}?id=${theme.id}`)}
                  style={editBtnStyle}
                >
                  {t('common.edit', 'Edit')}
                </button>
              </div>
            ))}
            {obsThemes.length === 0 && <p style={emptyStyle}>{t('controlPanel.noThemesAvailable')}</p>}
          </div>
        )}
      </div>
    </div>
  );
});

ThemeSelectionPanel.displayName = 'ThemeSelectionPanel';

export default ThemeSelectionPanel;
