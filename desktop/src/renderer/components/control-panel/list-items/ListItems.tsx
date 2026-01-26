import React, { useState, useMemo, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../styles/controlPanelStyles';

// Song interface
interface Song {
  id: string;
  title: string;
  slides: Array<{
    originalText: string;
    translation?: string;
    transliteration?: string;
    verseType?: string;
  }>;
}

// SongItem Component
export interface SongItemProps {
  song: Song;
  isSelected: boolean;
  isDragged: boolean;
  onSelect: (song: Song) => void;
  onDoubleClick: (song: Song) => void;
  onEdit: (song: Song) => void;
  onDelete: (id: string) => void;
  onDragStart: (song: Song) => void;
  onDragEnd: () => void;
}

export const SongItem = memo<SongItemProps>(({
  song,
  isSelected,
  isDragged,
  onSelect,
  onDoubleClick,
  onEdit,
  onDelete,
  onDragStart,
  onDragEnd
}) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he';
  const [isHovered, setIsHovered] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const containerStyle = useMemo(() => ({
    padding: '10px 12px',
    cursor: 'grab' as const,
    background: isSelected ? 'rgba(6,182,212,0.2)' : 'transparent',
    borderLeft: isSelected ? `3px solid ${colors.button.accent}` : '3px solid transparent',
    borderBottom: `1px solid ${colors.border.light}`,
    opacity: isDragged ? 0.5 : 1,
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    position: 'relative' as const,
  }), [isSelected, isDragged]);

  const menuButtonStyle = useMemo(() => ({
    background: colors.background.cardHover,
    border: 'none',
    borderRadius: '4px',
    padding: '4px 6px',
    cursor: 'pointer' as const,
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: '2px',
    alignItems: 'center' as const,
  }), []);

  const dropdownStyle = useMemo(() => ({
    position: 'absolute' as const,
    top: '100%',
    right: isRTL ? 'auto' : 0,
    left: isRTL ? 0 : 'auto',
    marginTop: '4px',
    background: colors.background.dropdown,
    borderRadius: '6px',
    border: `1px solid ${colors.border.medium}`,
    padding: '4px',
    minWidth: '120px',
    zIndex: 100,
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
  }), [isRTL]);

  return (
    <div
      draggable
      onDragStart={(e) => {
        onDragStart(song);
        e.dataTransfer.effectAllowed = 'copy';
      }}
      onDragEnd={onDragEnd}
      onClick={() => onSelect(song)}
      onDoubleClick={() => onDoubleClick(song)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setShowMenu(false); }}
      style={containerStyle}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: 'white', fontWeight: 500, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.title}</div>
      </div>
      {(isHovered || showMenu) && (
        <div style={{ position: 'relative' }}>
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            style={menuButtonStyle}
          >
            <span style={{ width: '3px', height: '3px', background: colors.text.secondary, borderRadius: '50%' }} />
            <span style={{ width: '3px', height: '3px', background: colors.text.secondary, borderRadius: '50%' }} />
            <span style={{ width: '3px', height: '3px', background: colors.text.secondary, borderRadius: '50%' }} />
          </button>
          {showMenu && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={dropdownStyle}
            >
              <button
                onClick={(e) => { e.stopPropagation(); onDoubleClick(song); setShowMenu(false); }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', borderRadius: '4px', padding: '6px 10px', color: 'white', cursor: 'pointer', fontSize: '0.8rem', textAlign: isRTL ? 'right' : 'left' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                {t('controlPanel.addToSetlist')}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(song); setShowMenu(false); }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', borderRadius: '4px', padding: '6px 10px', color: 'white', cursor: 'pointer', fontSize: '0.8rem', textAlign: isRTL ? 'right' : 'left' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                {t('controlPanel.edit')}
              </button>
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(song.id); setShowMenu(false); }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', borderRadius: '4px', padding: '6px 10px', color: '#dc3545', cursor: 'pointer', fontSize: '0.8rem', textAlign: isRTL ? 'right' : 'left' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                {t('controlPanel.delete')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

SongItem.displayName = 'SongItem';

// PresentationItem Component
export interface PresentationItemProps {
  presentation: any;
  isSelected: boolean;
  onSelect: (pres: any) => void;
  onDoubleClick: (pres: any) => void;
  onEdit: (pres: any) => void;
  onDelete: (pres: any) => void;
  onDragStart: (e: React.DragEvent, pres: any) => void;
}

export const PresentationItem = memo<PresentationItemProps>(({
  presentation,
  isSelected,
  onSelect,
  onDoubleClick,
  onEdit,
  onDelete,
  onDragStart
}) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he';
  const [isHovered, setIsHovered] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const containerStyle = useMemo(() => ({
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    padding: '10px 12px',
    cursor: 'pointer' as const,
    background: isSelected ? 'rgba(0, 212, 255, 0.2)' : 'transparent',
    borderLeft: isSelected ? '3px solid #00d4ff' : '3px solid transparent',
    borderBottom: '1px solid rgba(255,255,255,0.05)'
  }), [isSelected]);

  const menuButtonStyle = useMemo(() => ({
    padding: '4px 6px',
    borderRadius: '4px',
    border: 'none',
    background: colors.background.cardHover,
    cursor: 'pointer' as const,
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: '2px',
    alignItems: 'center' as const
  }), []);

  const dropdownStyle = useMemo(() => ({
    position: 'absolute' as const,
    right: isRTL ? 'auto' : 0,
    left: isRTL ? 0 : 'auto',
    top: '100%',
    marginTop: '4px',
    background: colors.background.dropdown,
    borderRadius: '6px',
    border: `1px solid ${colors.border.medium}`,
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    zIndex: 100,
    padding: '4px',
    minWidth: '100px',
    overflow: 'hidden'
  }), [isRTL]);

  const menuItemStyle = useMemo(() => ({
    width: '100%',
    padding: '6px 10px',
    border: 'none',
    background: 'transparent',
    color: 'white',
    cursor: 'pointer' as const,
    fontSize: '0.8rem',
    textAlign: (isRTL ? 'right' : 'left') as 'right' | 'left',
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: '8px',
    borderRadius: '4px'
  }), [isRTL]);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, presentation)}
      onClick={() => onSelect(presentation)}
      onDoubleClick={() => onDoubleClick(presentation)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setShowMenu(false); }}
      style={containerStyle}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {presentation.title}
        </div>
      </div>
      {(isHovered || showMenu) && (
        <div style={{ position: 'relative' }}>
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            style={menuButtonStyle}
          >
            <span style={{ width: '3px', height: '3px', background: colors.text.secondary, borderRadius: '50%' }} />
            <span style={{ width: '3px', height: '3px', background: colors.text.secondary, borderRadius: '50%' }} />
            <span style={{ width: '3px', height: '3px', background: colors.text.secondary, borderRadius: '50%' }} />
          </button>
          {showMenu && (
            <div onClick={(e) => e.stopPropagation()} style={dropdownStyle}>
              <button
                onClick={(e) => { e.stopPropagation(); onDoubleClick(presentation); setShowMenu(false); }}
                style={menuItemStyle}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                {t('controlPanel.addToSetlist')}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(presentation); setShowMenu(false); }}
                style={menuItemStyle}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                {t('controlPanel.edit')}
              </button>
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(presentation); setShowMenu(false); }}
                style={{ ...menuItemStyle, color: '#dc3545' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                {t('controlPanel.delete')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

PresentationItem.displayName = 'PresentationItem';

// ThemeItem Component
export interface ThemeItemProps {
  theme: any;
  isSelected: boolean;
  accentColor: string;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export const ThemeItem = memo<ThemeItemProps>(({
  theme,
  isSelected,
  accentColor,
  onSelect,
  onEdit,
  onDelete
}) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he';
  const [isHovered, setIsHovered] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const containerStyle = useMemo(() => ({
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    padding: '10px',
    background: isSelected ? `${accentColor}30` : colors.background.card,
    borderRadius: '8px',
    marginBottom: '6px',
    cursor: 'pointer' as const,
    border: isSelected ? `1px solid ${accentColor}` : '1px solid transparent',
    position: 'relative' as const,
  }), [isSelected, accentColor]);

  const menuButtonStyle = useMemo(() => ({
    background: colors.background.cardHover,
    border: 'none',
    borderRadius: '4px',
    padding: '4px 6px',
    cursor: 'pointer' as const,
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: '2px',
    alignItems: 'center' as const,
  }), []);

  const dropdownStyle = useMemo(() => ({
    position: 'absolute' as const,
    top: '100%',
    right: isRTL ? 'auto' : 0,
    left: isRTL ? 0 : 'auto',
    marginTop: '4px',
    background: colors.background.dropdown,
    borderRadius: '6px',
    border: `1px solid ${colors.border.medium}`,
    padding: '4px',
    minWidth: '100px',
    zIndex: 100,
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
  }), [isRTL]);

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setShowMenu(false); }}
      style={containerStyle}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ color: colors.text.primary, fontSize: '0.85rem' }}>{theme.name}</span>
        {theme.isBuiltIn && (
          <span style={{ fontSize: '0.65rem', background: colors.border.medium, padding: '2px 5px', borderRadius: '3px', color: colors.text.muted }}>{t('themes.builtIn')}</span>
        )}
      </div>
      {(isHovered || showMenu) && (
        <div style={{ position: 'relative' }}>
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            style={menuButtonStyle}
          >
            <span style={{ width: '3px', height: '3px', background: colors.text.secondary, borderRadius: '50%' }} />
            <span style={{ width: '3px', height: '3px', background: colors.text.secondary, borderRadius: '50%' }} />
            <span style={{ width: '3px', height: '3px', background: colors.text.secondary, borderRadius: '50%' }} />
          </button>
          {showMenu && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={dropdownStyle}
            >
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(); setShowMenu(false); }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', borderRadius: '4px', padding: '6px 10px', color: 'white', cursor: 'pointer', fontSize: '0.8rem', textAlign: isRTL ? 'right' : 'left' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                {t('controlPanel.edit')}
              </button>
              {!theme.isBuiltIn && (
                <>
                  <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(); setShowMenu(false); }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', borderRadius: '4px', padding: '6px 10px', color: '#dc3545', cursor: 'pointer', fontSize: '0.8rem', textAlign: isRTL ? 'right' : 'left' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                    {t('controlPanel.delete')}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

ThemeItem.displayName = 'ThemeItem';
