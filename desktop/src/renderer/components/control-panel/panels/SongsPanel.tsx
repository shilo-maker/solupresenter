import React, { useState, useMemo, useRef, useCallback, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../styles/controlPanelStyles';
import { Song } from './types';

// Memoized SongItem component to prevent unnecessary re-renders
interface SongItemProps {
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

const SongItem = memo<SongItemProps>(({
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

  const hoverBg = isSelected ? 'rgba(6,182,212,0.2)' : 'rgba(255,255,255,0.06)';
  const defaultBg = isSelected ? 'rgba(6,182,212,0.2)' : 'transparent';

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
    transition: 'background 0.15s ease',
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
      onMouseEnter={(e) => { setIsHovered(true); e.currentTarget.style.background = hoverBg; }}
      onMouseLeave={(e) => { setIsHovered(false); setShowMenu(false); e.currentTarget.style.background = defaultBg; }}
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

// Main SongsPanel component props
export interface SongsPanelProps {
  songs: Song[];
  selectedSong: Song | null;
  draggedSong: Song | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelectSong: (song: Song) => void;
  onAddToSetlist: (song: Song) => void;
  onEditSong: (song: Song | undefined) => void;
  onDeleteSong: (id: string) => void;
  onDragStart: (song: Song) => void;
  onDragEnd: () => void;
}

const SongsPanel = memo<SongsPanelProps>(({
  songs,
  selectedSong,
  draggedSong,
  searchQuery,
  onSearchChange,
  onSelectSong,
  onAddToSetlist,
  onEditSong,
  onDeleteSong,
  onDragStart,
  onDragEnd
}) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he';
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [visibleSongsCount, setVisibleSongsCount] = useState(50);

  // Filter songs based on search query (title/author matches first, then content matches)
  const filteredSongs = useMemo(() => {
    if (!searchQuery) return songs;
    const query = searchQuery.toLowerCase();

    // Helper to search in slide content
    const searchInSlides = (slides: any[] | undefined): boolean => {
      if (!Array.isArray(slides)) return false;
      return slides.some(slide =>
        (slide.originalText || '').toLowerCase().includes(query) ||
        (slide.transliteration || '').toLowerCase().includes(query) ||
        (slide.translation || '').toLowerCase().includes(query)
      );
    };

    // Separate into title/author matches and content-only matches
    const titleAuthorMatches: Song[] = [];
    const contentMatches: Song[] = [];

    for (const song of songs) {
      const matchesTitle = song.title.toLowerCase().includes(query);
      const matchesAuthor = song.author?.toLowerCase().includes(query);
      const matchesTags = song.tags?.some(tag => tag.toLowerCase().includes(query));

      if (matchesTitle || matchesAuthor || matchesTags) {
        titleAuthorMatches.push(song);
      } else if (searchInSlides(song.slides)) {
        contentMatches.push(song);
      }
    }

    // Return title/author matches first, then content matches
    return [...titleAuthorMatches, ...contentMatches];
  }, [songs, searchQuery]);

  // Reset visible count when search changes
  const handleSearchChange = useCallback((value: string) => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = setTimeout(() => {
      onSearchChange(value);
      setVisibleSongsCount(50);
    }, 150);
  }, [onSearchChange]);

  const handleNewSong = useCallback(() => {
    onEditSong(undefined);
  }, [onEditSong]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Search Bar */}
      <div style={{ padding: '0 12px 8px 12px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: '8px', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <svg width="14" height="14" fill="rgba(255,255,255,0.5)" viewBox="0 0 16 16" style={{ position: 'absolute', left: isRTL ? 'auto' : '10px', right: isRTL ? '10px' : 'auto', top: '50%', transform: 'translateY(-50%)' }}>
            <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
          </svg>
          <input
            ref={searchInputRef}
            type="text"
            placeholder={t('controlPanel.searchSongs')}
            defaultValue={searchQuery}
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
          onClick={handleNewSong}
          title="New Song"
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: 'none',
            borderRadius: '6px',
            padding: '8px 12px',
            color: 'white',
            cursor: 'pointer',
            fontSize: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'background 0.15s ease'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#06b6d4'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
        >
          +
        </button>
      </div>

      {/* Songs List */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {filteredSongs.slice(0, visibleSongsCount).map((song) => (
            <SongItem
              key={song.id}
              song={song}
              isSelected={selectedSong?.id === song.id}
              isDragged={draggedSong?.id === song.id}
              onSelect={onSelectSong}
              onDoubleClick={onAddToSetlist}
              onEdit={onEditSong}
              onDelete={onDeleteSong}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
          ))}
          {filteredSongs.length > visibleSongsCount && (
            <button
              onClick={() => setVisibleSongsCount(prev => prev + 50)}
              style={{
                padding: '10px',
                margin: '8px 12px',
                background: 'rgba(6, 182, 212, 0.15)',
                border: '1px solid rgba(6, 182, 212, 0.3)',
                borderRadius: '6px',
                color: '#06b6d4',
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              Load more ({filteredSongs.length - visibleSongsCount} remaining)
            </button>
          )}
          {filteredSongs.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: 'rgba(255,255,255,0.5)',
              fontSize: '0.9rem'
            }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>🎵</div>
              <div>{searchQuery ? t('controlPanel.noSongsFound') : t('controlPanel.noSongsYet')}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

SongsPanel.displayName = 'SongsPanel';

export default SongsPanel;
