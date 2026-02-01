import React, { useState, useRef, useMemo, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../styles/controlPanelStyles';
import { Presentation } from './types';

// Memoized PresentationItem component
interface PresentationItemProps {
  presentation: Presentation;
  isSelected: boolean;
  onSelect: (pres: Presentation) => void;
  onDoubleClick: (pres: Presentation) => void;
  onEdit: (pres: Presentation) => void;
  onDelete: (pres: Presentation) => void;
  onDragStart: (e: React.DragEvent, pres: Presentation) => void;
}

const PresentationItem = memo<PresentationItemProps>(({
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

  const hoverBg = isSelected ? 'rgba(6,182,212,0.2)' : 'rgba(255,255,255,0.06)';
  const defaultBg = isSelected ? 'rgba(6,182,212,0.2)' : 'transparent';

  const containerStyle = useMemo(() => ({
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    padding: '10px 12px',
    cursor: 'pointer' as const,
    background: isSelected ? 'rgba(6,182,212,0.2)' : 'transparent',
    borderLeft: isSelected ? '3px solid #06b6d4' : '3px solid transparent',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    transition: 'background 0.15s ease',
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
      onMouseEnter={(e) => { setIsHovered(true); e.currentTarget.style.background = hoverBg; }}
      onMouseLeave={(e) => { setIsHovered(false); setShowMenu(false); e.currentTarget.style.background = defaultBg; }}
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

// Main PresentationsPanel props
export interface PresentationsPanelProps {
  presentations: Presentation[];
  selectedPresentation: Presentation | null;
  presentationSearchQuery: string;
  onSearchChange: (query: string) => void;
  onSelectPresentation: (pres: Presentation) => void;
  onAddToSetlist: (pres: Presentation) => void;
  onEditPresentation: (pres: Presentation) => void;
  onDeletePresentation: (pres: Presentation) => void;
  onDragStart: (e: React.DragEvent, pres: Presentation) => void;
  onNewPresentation: () => void;
}

const PresentationsPanel = memo<PresentationsPanelProps>(({
  presentations,
  selectedPresentation,
  presentationSearchQuery,
  onSearchChange,
  onSelectPresentation,
  onAddToSetlist,
  onEditPresentation,
  onDeletePresentation,
  onDragStart,
  onNewPresentation
}) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he';
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Filter presentations based on search
  const filteredPresentations = useMemo(() => {
    if (!presentationSearchQuery) return presentations;
    return presentations.filter(p =>
      p.title.toLowerCase().includes(presentationSearchQuery.toLowerCase())
    );
  }, [presentations, presentationSearchQuery]);

  const handleSearchChange = (value: string) => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = setTimeout(() => {
      onSearchChange(value);
    }, 150);
  };

  return (
    <div style={{ display: 'flex', padding: '12px', flexDirection: 'column', gap: '12px' }}>
      {/* Search and New Button Row */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <svg width="14" height="14" fill="rgba(255,255,255,0.5)" viewBox="0 0 16 16" style={{ position: 'absolute', left: isRTL ? 'auto' : '10px', right: isRTL ? '10px' : 'auto', top: '50%', transform: 'translateY(-50%)' }}>
            <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
          </svg>
          <input
            type="text"
            placeholder={t('controlPanel.searchPresentations')}
            defaultValue={presentationSearchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.08)',
              border: '2px solid rgba(255,255,255,0.15)',
              borderRadius: '8px',
              padding: isRTL ? '8px 32px 8px 12px' : '8px 12px 8px 32px',
              color: 'white',
              fontSize: '0.85rem',
              outline: 'none'
            }}
          />
        </div>
        <button
          onClick={onNewPresentation}
          title="New Presentation"
          style={{
            background: '#06b6d4',
            border: 'none',
            borderRadius: '8px',
            width: '34px',
            height: '34px',
            color: 'white',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '1.2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          +
        </button>
      </div>

      {/* Presentations List */}
      {filteredPresentations.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '40px 20px',
          color: 'rgba(255,255,255,0.5)',
          fontSize: '0.9rem'
        }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>📊</div>
          <div>{t('controlPanel.noPresentationsYet')}</div>
          <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>{t('controlPanel.createFirstPresentation')}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {filteredPresentations.map((pres) => (
            <PresentationItem
              key={pres.id}
              presentation={pres}
              isSelected={selectedPresentation?.id === pres.id}
              onSelect={onSelectPresentation}
              onDoubleClick={onAddToSetlist}
              onEdit={onEditPresentation}
              onDelete={onDeletePresentation}
              onDragStart={onDragStart}
            />
          ))}
        </div>
      )}
    </div>
  );
});

PresentationsPanel.displayName = 'PresentationsPanel';

export default PresentationsPanel;
