import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { SetlistItem, Song, Presentation } from './types';

// Active media state type
interface ActiveMedia {
  type: 'video' | 'image';
  url: string;
}

// Active audio state type
interface ActiveAudio {
  url: string;
  name: string;
}

// Audio status type
interface AudioStatus {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
}

// Active YouTube video type
interface ActiveYoutubeVideo {
  videoId: string;
  title?: string;
}

// Context menu state type
interface SetlistContextMenu {
  x: number;
  y: number;
  item: SetlistItem;
}

export interface SetlistPanelProps {
  // Setlist data
  setlist: SetlistItem[];
  currentSetlistId: string | null;
  currentSetlistName: string;
  hasUnsavedChanges: boolean;

  // UI state
  showSetlistMenu: boolean;
  setlistMenuHover: boolean;
  draggedSong: Song | null;
  isDraggingMedia: boolean;
  dropTargetIndex: number | null;
  draggedSetlistIndex: number | null;
  collapsedSections: Set<string>;
  expandedPlaylistIds: Set<string>;
  setlistMenuOpen: string | null;
  hoveredMediaStopId: string | null;
  selectedSetlistMediaId: string | null;
  selectedYoutubeItemId: string | null;

  // Selection state
  selectedSong: Song | null;
  selectedPresentation: Presentation | null;

  // Media playback state
  activeMedia: ActiveMedia | null;
  activeAudio: ActiveAudio | null;
  audioStatus: AudioStatus;
  activeToolId: string | null;
  youtubeOnDisplay: boolean;
  activeYoutubeVideo: ActiveYoutubeVideo | null;

  // Playlist state
  activePlaylistId: string | null;
  activePlaylistIndex: number;
  activePlaylistOrder: number[];

  // Presentation auto-play state
  autoPlayActive: boolean;
  autoPlayInterval: number;
  currentPresentationSlideIndex: number;

  // UI setters
  onShowSetlistMenuChange: (show: boolean) => void;
  onSetlistMenuHoverChange: (hover: boolean) => void;
  onDraggedSongChange: (song: Song | null) => void;
  onIsDraggingMediaChange: (isDragging: boolean) => void;
  onDropTargetIndexChange: (index: number | null) => void;
  onDraggedSetlistIndexChange: (index: number | null) => void;
  onCollapsedSectionsChange: (fn: (prev: Set<string>) => Set<string>) => void;
  onExpandedPlaylistIdsChange: (fn: (prev: Set<string>) => Set<string>) => void;
  onSetlistMenuOpenChange: (id: string | null) => void;
  onHoveredMediaStopIdChange: (id: string | null) => void;
  onSelectedSetlistMediaIdChange: (id: string | null) => void;
  onSelectedYoutubeItemIdChange: (id: string | null) => void;
  onSetlistContextMenuChange: (menu: SetlistContextMenu | null) => void;

  // Setlist actions
  onSetlistChange: (fn: (prev: SetlistItem[]) => SetlistItem[]) => void;
  onAddToSetlist: (song: Song) => void;
  onRemoveFromSetlist: (id: string) => void;
  onTryClearSetlist: () => void;
  onAddSectionHeader: () => void;
  onShowLoadModal: () => void;
  onShowSaveModal: () => void;

  // Selection/playback actions
  onSelectSong: (song: Song, type: 'song' | 'bible', sendToDisplay: boolean) => void;
  onSelectPresentation: (presentation: Presentation) => void;
  onSetSelectedSong: (song: Song | null) => void;
  onSetSelectedPresentation: (pres: Presentation | null) => void;
  onSetCurrentPresentationSlideIndex: (index: number) => void;
  onSetCurrentContentType: (type: 'song' | 'bible' | 'prayer' | 'presentation') => void;
  onSetIsBlank: (blank: boolean) => void;
  onSetLiveState: (state: any) => void;
  onSendBlank: () => void;

  // Tool actions
  onStopAllTools: () => void;
  onBroadcastToolFromSetlist: (item: SetlistItem) => void;

  // Media actions
  onSetActiveMedia: (media: ActiveMedia | null) => void;
  onSetActiveAudio: (audio: ActiveAudio | null) => void;
  onSetActiveAudioSetlistId: (id: string | null) => void;
  onHandlePlayAudio: (path: string, name: string) => void;
  onHandleDisplayMedia: (type: 'video' | 'image', path: string) => void;
  onClearMedia: () => void;

  // Playlist actions
  onStartPlaylist: (item: SetlistItem, startIndex?: number) => void;
  onSetActivePlaylistId: (id: string | null) => void;
  onSetActivePlaylistIndex: (index: number) => void;
  onSetActivePlaylistOrder: (order: number[]) => void;
  onOpenEditPlaylistModal: (item: SetlistItem) => void;

  // Song editing
  onStartEditingSong: (song?: Song | null) => void;

  // YouTube actions
  onPlayYoutubeVideo: (videoId: string, title: string, thumbnail?: string) => void;
  onStopYoutubeVideo: () => void;
}

// Memoized SetlistItem component for better performance
interface SetlistItemRowProps {
  item: SetlistItem;
  index: number;
  // ... all the props needed for rendering a single item
  isRTL: boolean;
  t: (key: string) => string;
  setlist: SetlistItem[];
  collapsedSections: Set<string>;
  expandedPlaylistIds: Set<string>;
  selectedSong: Song | null;
  selectedPresentation: Presentation | null;
  activeMedia: ActiveMedia | null;
  activeAudio: ActiveAudio | null;
  audioStatus: AudioStatus;
  activeToolId: string | null;
  youtubeOnDisplay: boolean;
  activeYoutubeVideo: ActiveYoutubeVideo | null;
  activePlaylistId: string | null;
  activePlaylistIndex: number;
  activePlaylistOrder: number[];
  autoPlayActive: boolean;
  autoPlayInterval: number;
  currentPresentationSlideIndex: number;
  selectedSetlistMediaId: string | null;
  selectedYoutubeItemId: string | null;
  dropTargetIndex: number | null;
  draggedSetlistIndex: number | null;
  setlistMenuOpen: string | null;
  hoveredMediaStopId: string | null;
  currentSectionId: string | null;
  sectionItemCount: number;
  isCollapsed: boolean;
  onDragStart: (index: number) => void;
  onDragEnd: () => void;
  onDragOver: (index: number) => void;
  onMouseLeave: (itemId: string) => void;
  onContextMenu: (e: React.MouseEvent, item: SetlistItem) => void;
  onClick: (item: SetlistItem, index: number) => void;
  onDoubleClick: (itemId: string) => void;
  onCollapsedSectionsChange: (fn: (prev: Set<string>) => Set<string>) => void;
  onExpandedPlaylistIdsChange: (fn: (prev: Set<string>) => Set<string>) => void;
  onSetlistMenuOpenChange: (id: string | null) => void;
  onHoveredMediaStopIdChange: (id: string | null) => void;
  onSelectedSetlistMediaIdChange: (id: string | null) => void;
  onSetActiveAudio: (audio: ActiveAudio | null) => void;
  onSetActiveAudioSetlistId: (id: string | null) => void;
  onSetActivePlaylistId: (id: string | null) => void;
  onSetActivePlaylistIndex: (index: number) => void;
  onSetActivePlaylistOrder: (order: number[]) => void;
  onSetActiveMedia: (media: ActiveMedia | null) => void;
  onClearMedia: () => void;
  onHandlePlayAudio: (path: string, name: string) => void;
  onHandleDisplayMedia: (type: 'video' | 'image', path: string) => void;
  onStopAllTools: () => void;
  onStartPlaylist: (item: SetlistItem, startIndex?: number) => void;
  onOpenEditPlaylistModal: (item: SetlistItem) => void;
  onStartEditingSong: (song: Song | null) => void;
  onRemoveFromSetlist: (id: string) => void;
  onPlayYoutubeVideo: (videoId: string, title: string, thumbnail?: string) => void;
  onStopYoutubeVideo: () => void;
}

const SetlistItemRow = memo<SetlistItemRowProps>(({
  item,
  index,
  isRTL,
  t,
  setlist,
  collapsedSections,
  expandedPlaylistIds,
  selectedSong,
  selectedPresentation,
  activeMedia,
  activeAudio,
  audioStatus,
  activeToolId,
  youtubeOnDisplay,
  activeYoutubeVideo,
  activePlaylistId,
  activePlaylistIndex,
  activePlaylistOrder,
  autoPlayActive,
  autoPlayInterval,
  currentPresentationSlideIndex,
  selectedSetlistMediaId,
  selectedYoutubeItemId,
  dropTargetIndex,
  draggedSetlistIndex,
  setlistMenuOpen,
  hoveredMediaStopId,
  sectionItemCount,
  isCollapsed,
  onDragStart,
  onDragEnd,
  onDragOver,
  onMouseLeave,
  onContextMenu,
  onClick,
  onDoubleClick,
  onCollapsedSectionsChange,
  onExpandedPlaylistIdsChange,
  onSetlistMenuOpenChange,
  onHoveredMediaStopIdChange,
  onSelectedSetlistMediaIdChange,
  onSetActiveAudio,
  onSetActiveAudioSetlistId,
  onSetActivePlaylistId,
  onSetActivePlaylistIndex,
  onSetActivePlaylistOrder,
  onSetActiveMedia,
  onClearMedia,
  onHandlePlayAudio,
  onHandleDisplayMedia,
  onStopAllTools,
  onStartPlaylist,
  onOpenEditPlaylistModal,
  onStartEditingSong,
  onRemoveFromSetlist,
  onPlayYoutubeVideo,
  onStopYoutubeVideo
}) => {
  return (
    <React.Fragment>
      <div
        className="setlist-row"
        {...(item.type === 'audioPlaylist' && expandedPlaylistIds.has(item.id) ? { 'data-playlist-expanded': true } : {})}
        draggable
        onDragStart={() => onDragStart(index)}
        onDragEnd={onDragEnd}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDragOver(index);
        }}
        onMouseLeave={() => onMouseLeave(item.id)}
        onContextMenu={(e) => onContextMenu(e, item)}
        onClick={() => onClick(item, index)}
        onDoubleClick={() => onDoubleClick(item.id)}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: item.type === 'section' ? '6px 12px' : '10px 12px',
          cursor: item.type === 'section' ? 'pointer' : 'grab',
          background: dropTargetIndex === index
            ? 'rgba(0, 212, 255, 0.2)'
            : activeToolId === item.id
            ? 'rgba(102, 126, 234, 0.4)'
            : item.type === 'song' && selectedSong?.id === item.song?.id
            ? 'rgba(6,182,212,0.2)'
            : item.type === 'bible' && selectedSong?.id === item.song?.id
            ? 'rgba(230, 184, 0, 0.2)'
            : item.type === 'media' && item.mediaPath && activeMedia && activeMedia.url.includes(encodeURIComponent(item.mediaPath.split(/[/\\]/).pop() || ''))
            ? 'rgba(50, 200, 100, 0.3)'
            : item.type === 'media' && item.mediaType === 'audio' && item.mediaPath && activeAudio && activeAudio.url.includes(encodeURIComponent(item.mediaPath.split(/[/\\]/).pop() || ''))
            ? 'rgba(156, 39, 176, 0.3)'
            : item.type === 'media' && selectedSetlistMediaId === item.id
            ? 'rgba(6, 182, 212, 0.2)'
            : item.type === 'section'
            ? 'rgba(6,182,212,0.15)'
            : (item.type === 'countdown' || item.type === 'announcement' || item.type === 'messages')
            ? 'rgba(102, 126, 234, 0.1)'
            : item.type === 'media'
            ? 'rgba(50, 200, 100, 0.1)'
            : item.type === 'presentation'
            ? 'rgba(156, 39, 176, 0.1)'
            : item.type === 'youtube' && youtubeOnDisplay && activeYoutubeVideo?.videoId === item.youtubeVideoId
            ? 'rgba(255, 0, 0, 0.3)'
            : item.type === 'youtube' && selectedYoutubeItemId === item.id
            ? 'rgba(255, 0, 0, 0.2)'
            : item.type === 'youtube'
            ? 'rgba(255, 0, 0, 0.1)'
            : item.type === 'audioPlaylist' && activePlaylistId === item.id
            ? 'rgba(255, 152, 0, 0.3)'
            : item.type === 'audioPlaylist'
            ? 'rgba(255, 152, 0, 0.1)'
            : 'transparent',
          borderLeft: item.type === 'section'
            ? '3px solid #06b6d4'
            : activeToolId === item.id
            ? '3px solid #00d4ff'
            : item.type === 'song' && selectedSong?.id === item.song?.id
            ? '3px solid #06b6d4'
            : item.type === 'bible' && selectedSong?.id === item.song?.id
            ? '3px solid #e6b800'
            : item.type === 'media' && item.mediaPath && activeMedia && activeMedia.url.includes(encodeURIComponent(item.mediaPath.split(/[/\\]/).pop() || ''))
            ? '3px solid #32c864'
            : item.type === 'media' && item.mediaType === 'audio' && item.mediaPath && activeAudio && activeAudio.url.includes(encodeURIComponent(item.mediaPath.split(/[/\\]/).pop() || ''))
            ? '3px solid #9C27B0'
            : item.type === 'media' && selectedSetlistMediaId === item.id
            ? '3px solid #06b6d4'
            : (item.type === 'countdown' || item.type === 'announcement' || item.type === 'messages')
            ? '3px solid #667eea'
            : item.type === 'media'
            ? '3px solid transparent'
            : item.type === 'presentation'
            ? '3px solid #9C27B0'
            : item.type === 'youtube' && youtubeOnDisplay && activeYoutubeVideo?.videoId === item.youtubeVideoId
            ? '3px solid #FF0000'
            : item.type === 'youtube' && selectedYoutubeItemId === item.id
            ? '3px solid #FF0000'
            : item.type === 'youtube'
            ? '3px solid transparent'
            : item.type === 'audioPlaylist' && activePlaylistId === item.id
            ? '3px solid #FF9800'
            : item.type === 'audioPlaylist'
            ? '3px solid transparent'
            : '3px solid transparent',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          borderTop: dropTargetIndex === index ? '2px solid #00d4ff' : '2px solid transparent',
          opacity: draggedSetlistIndex === index ? 0.5 : 1,
          transition: 'background 0.15s, border 0.15s'
        }}
      >
        {/* Section collapse arrow */}
        {item.type === 'section' && (
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#06b6d4"
            strokeWidth="2"
            style={{
              marginRight: '8px',
              transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
              transition: 'transform 0.15s'
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )}

        {/* Item number (not for sections) */}
        {item.type !== 'section' && (
          <span style={{ color: 'rgba(255,255,255,0.4)', marginRight: '10px', fontSize: '0.75rem', minWidth: '20px' }}>
            {setlist.slice(0, index + 1).filter(i => i.type !== 'section').length}
          </span>
        )}

        {/* Item type icon */}
        <span style={{ marginRight: '8px', display: 'flex', alignItems: 'center' }}>
          {item.type === 'song' && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          )}
          {item.type === 'countdown' && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#667eea" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          )}
          {item.type === 'announcement' && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#667eea" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          )}
          {item.type === 'messages' && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#667eea" strokeWidth="2">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
          )}
          {item.type === 'media' && item.mediaType === 'video' && (
            item.thumbnailPath ? (
              <img
                src={`media://file/${encodeURIComponent(item.thumbnailPath)}`}
                alt=""
                style={{
                  width: '28px',
                  height: '28px',
                  objectFit: 'cover',
                  borderRadius: '4px',
                  border: '1px solid rgba(50, 200, 100, 0.5)'
                }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#32c864" strokeWidth="2">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            )
          )}
          {item.type === 'media' && item.mediaType === 'image' && (
            item.thumbnailPath || item.mediaPath ? (
              <img
                src={`media://file/${encodeURIComponent(item.thumbnailPath || item.mediaPath || '')}`}
                alt=""
                style={{
                  width: '28px',
                  height: '28px',
                  objectFit: 'cover',
                  borderRadius: '4px',
                  border: '1px solid rgba(50, 200, 100, 0.5)'
                }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#32c864" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
            )
          )}
          {item.type === 'media' && item.mediaType === 'audio' && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9C27B0" strokeWidth="2">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          )}
          {item.type === 'presentation' && (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="#9C27B0">
              <path d="M0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2zm5 3a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm3 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm3 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/>
              <path d="M2 13h12v1H2v-1z"/>
            </svg>
          )}
          {item.type === 'bible' && (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="#e6b800">
              <path d="M1 2.828c.885-.37 2.154-.769 3.388-.893 1.33-.134 2.458.063 3.112.752v9.746c-.935-.53-2.12-.603-3.213-.493-1.18.12-2.37.461-3.287.811V2.828zm7.5-.141c.654-.689 1.782-.886 3.112-.752 1.234.124 2.503.523 3.388.893v9.923c-.918-.35-2.107-.692-3.287-.81-1.094-.111-2.278-.039-3.213.492V2.687zM8 1.783C7.015.936 5.587.81 4.287.94c-1.514.153-3.042.672-3.994 1.105A.5.5 0 0 0 0 2.5v11a.5.5 0 0 0 .707.455c.882-.4 2.303-.881 3.68-1.02 1.409-.142 2.59.087 3.223.877a.5.5 0 0 0 .78 0c.633-.79 1.814-1.019 3.222-.877 1.378.139 2.8.62 3.681 1.02A.5.5 0 0 0 16 13.5v-11a.5.5 0 0 0-.293-.455c-.952-.433-2.48-.952-3.994-1.105C10.413.809 8.985.936 8 1.783z"/>
            </svg>
          )}
          {item.type === 'blank' && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            </svg>
          )}
          {item.type === 'youtube' && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#FF0000">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
          )}
          {item.type === 'audioPlaylist' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onExpandedPlaylistIdsChange(prev => {
                    const newSet = new Set(prev);
                    if (newSet.has(item.id)) {
                      newSet.delete(item.id);
                    } else {
                      newSet.add(item.id);
                    }
                    return newSet;
                  });
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#FF9800"
                  strokeWidth="2"
                  style={{
                    transform: expandedPlaylistIds.has(item.id) ? 'rotate(90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.15s'
                  }}
                >
                  <polyline points="9 6 15 12 9 18" />
                </svg>
              </button>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FF9800" strokeWidth="2">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <circle cx="4" cy="6" r="2" fill="#FF9800" />
                <circle cx="4" cy="12" r="2" fill="#FF9800" />
                <circle cx="4" cy="18" r="2" fill="#FF9800" />
              </svg>
            </div>
          )}
        </span>

        {/* Item title */}
        <span style={{
          flex: 1,
          color: 'white',
          fontWeight: item.type === 'section' ? 700 : 400,
          fontSize: '0.85rem',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {item.type === 'song' ? item.song?.title :
           item.type === 'section' ? item.title :
           item.type === 'bible' ? item.song?.title || item.title :
           item.type === 'media' ? (() => {
             const name = item.mediaName || item.title || 'Media';
             return name.length > 30 ? name.slice(0, 30) + '...' : name;
           })() :
           item.type === 'presentation' ? (item.presentation?.title || item.title || 'Presentation') :
           item.type === 'youtube' ? (item.youtubeTitle || item.title || 'YouTube Video') :
           item.type === 'audioPlaylist' ? (item.audioPlaylist?.name || item.title || 'Playlist') :
           item.title}
        </span>

        {/* Section item count badge */}
        {item.type === 'section' && sectionItemCount > 0 && (
          <span style={{
            background: 'rgba(6,182,212,0.3)',
            color: '#06b6d4',
            fontSize: '0.65rem',
            fontWeight: 600,
            padding: '1px 6px',
            borderRadius: '10px',
            marginLeft: '8px'
          }}>
            {sectionItemCount}
          </span>
        )}

        {/* Auto-play cycling indicator for presentations */}
        {item.type === 'presentation' && autoPlayActive && selectedPresentation?.id === item.presentation?.id && (
          <span style={{
            background: '#00d4ff',
            color: '#000',
            fontSize: '0.6rem',
            fontWeight: 700,
            padding: '2px 6px',
            borderRadius: '4px',
            marginLeft: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            animation: 'pulse 1.5s ease-in-out infinite'
          }}>
            <span>🔄</span>
            {currentPresentationSlideIndex + 1}/{selectedPresentation?.slides?.length || 0} • {autoPlayInterval}s
          </span>
        )}

        {/* Audio Playlist controls */}
        {item.type === 'audioPlaylist' && item.audioPlaylist && (() => {
          const isPlaying = activePlaylistId === item.id;
          const trackCount = item.audioPlaylist.tracks.length;
          const currentTrackIndex = isPlaying ? activePlaylistIndex + 1 : 0;

          if (isPlaying) {
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '8px' }}>
                <span style={{
                  background: 'rgba(255, 152, 0, 0.3)',
                  color: '#FF9800',
                  fontSize: '0.6rem',
                  fontWeight: 600,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" style={{ animation: 'pulse 1s ease-in-out infinite' }}>
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  {currentTrackIndex}/{trackCount}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSetActiveAudio(null);
                    onSetActivePlaylistId(null);
                    onSetActivePlaylistIndex(0);
                    onSetActivePlaylistOrder([]);
                  }}
                  style={{
                    background: 'rgba(239, 68, 68, 0.9)',
                    color: 'white',
                    fontSize: '0.6rem',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px'
                  }}
                >
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="6" width="12" height="12" />
                  </svg>
                  {t('common.stop')}
                </button>
              </div>
            );
          }

          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '8px' }}>
              <span style={{
                background: 'rgba(255, 152, 0, 0.2)',
                color: '#FF9800',
                fontSize: '0.65rem',
                fontWeight: 600,
                padding: '1px 6px',
                borderRadius: '10px'
              }}>
                {trackCount} {item.audioPlaylist.shuffle ? '🔀' : ''}
              </span>
              <button
                className={`setlist-hover-menu ${selectedSetlistMediaId === item.id ? 'menu-open' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenEditPlaylistModal(item);
                }}
                style={{
                  background: 'rgba(102, 126, 234, 0.3)',
                  color: '#667eea',
                  fontSize: '0.6rem',
                  fontWeight: 600,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  border: '1px solid rgba(102, 126, 234, 0.5)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px'
                }}
                title="Edit playlist"
              >
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Edit
              </button>
            </div>
          );
        })()}

        {/* Audio play/stop controls */}
        {item.type === 'media' && item.mediaType === 'audio' && (() => {
          const encodedPath = (item.mediaPath || '')
            .replace(/\\/g, '/')
            .split('/')
            .map(segment => encodeURIComponent(segment))
            .join('/');
          const itemAudioUrl = `media://file/${encodedPath}`;
          const isPlaying = activeAudio && activeAudio.url === itemAudioUrl;
          const isSelected = selectedSetlistMediaId === item.id;

          if (!isPlaying) {
            return (
              <button
                className={`setlist-hover-menu ${isSelected ? 'menu-open' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onHandlePlayAudio(item.mediaPath!, item.mediaName || item.title || 'Audio');
                  onSetActiveAudioSetlistId(item.id);
                  onSelectedSetlistMediaIdChange(null);
                }}
                style={{
                  background: 'rgba(156, 39, 176, 0.9)',
                  color: 'white',
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  padding: '3px 10px',
                  borderRadius: '4px',
                  marginLeft: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  alignItems: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap'
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                {t('common.play')}
              </button>
            );
          }

          const isStopHovered = hoveredMediaStopId === item.id;
          return (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSetActiveAudio(null);
                onSetActiveAudioSetlistId(null);
              }}
              onMouseEnter={() => onHoveredMediaStopIdChange(item.id)}
              onMouseLeave={() => onHoveredMediaStopIdChange(null)}
              style={{
                background: isStopHovered ? '#dc3545' : (audioStatus.isPlaying ? '#9C27B0' : 'rgba(156, 39, 176, 0.5)'),
                color: 'white',
                fontSize: '0.6rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '4px',
                marginLeft: '8px',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'background 0.15s'
              }}
            >
              {isStopHovered ? (
                <>
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="4" y="4" width="16" height="16" rx="2" />
                  </svg>
                  {t('common.stop').toUpperCase()}
                </>
              ) : audioStatus.isPlaying ? (
                <>
                  <span style={{ animation: 'pulse 1s ease-in-out infinite' }}>♪</span>
                  {t('common.playing').toUpperCase()}
                </>
              ) : (
                t('common.pause').toUpperCase()
              )}
            </button>
          );
        })()}

        {/* Video/Image play/display controls */}
        {item.type === 'media' && (item.mediaType === 'video' || item.mediaType === 'image') && (() => {
          const encodedPath = (item.mediaPath || '')
            .replace(/\\/g, '/')
            .split('/')
            .map(segment => encodeURIComponent(segment))
            .join('/');
          const itemMediaUrl = `media://file/${encodedPath}`;
          const isActive = activeMedia && activeMedia.url === itemMediaUrl;
          const isVideo = item.mediaType === 'video';
          const isSelected = selectedSetlistMediaId === item.id;

          if (!isActive) {
            return (
              <button
                className={`setlist-hover-menu ${isSelected ? 'menu-open' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onStopAllTools();
                  onHandleDisplayMedia(item.mediaType as 'video' | 'image', item.mediaPath!);
                  onSelectedSetlistMediaIdChange(null);
                }}
                style={{
                  background: isVideo ? 'rgba(6, 182, 212, 0.9)' : 'rgba(76, 175, 80, 0.9)',
                  color: 'white',
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  padding: '3px 10px',
                  borderRadius: '4px',
                  marginLeft: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  alignItems: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap'
                }}
              >
                {isVideo ? (
                  <>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    {t('common.play')}
                  </>
                ) : (
                  <>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                    {t('media.display')}
                  </>
                )}
              </button>
            );
          }

          const isStopHovered = hoveredMediaStopId === item.id;
          return (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSetActiveMedia(null);
                onClearMedia();
              }}
              onMouseEnter={() => onHoveredMediaStopIdChange(item.id)}
              onMouseLeave={() => onHoveredMediaStopIdChange(null)}
              style={{
                background: isStopHovered ? '#dc3545' : (isVideo ? '#32c864' : '#4CAF50'),
                color: 'white',
                fontSize: '0.6rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '4px',
                marginLeft: '8px',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                animation: isStopHovered ? 'none' : 'pulse 1.5s ease-in-out infinite',
                transition: 'background 0.15s'
              }}
            >
              {isStopHovered ? (
                <>
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="4" y="4" width="16" height="16" rx="2" />
                  </svg>
                  {t('common.stop').toUpperCase()}
                </>
              ) : isVideo ? (
                <>
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  {t('common.playing').toUpperCase()}
                </>
              ) : (
                <>
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  </svg>
                  {t('common.showing').toUpperCase()}
                </>
              )}
            </button>
          );
        })()}

        {/* YouTube play/stop controls */}
        {item.type === 'youtube' && item.youtubeVideoId && (() => {
          const isPlaying = youtubeOnDisplay && activeYoutubeVideo?.videoId === item.youtubeVideoId;
          const isSelected = selectedYoutubeItemId === item.id;

          if (!isPlaying) {
            return (
              <button
                className={`setlist-hover-menu ${isSelected ? 'menu-open' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onStopAllTools();
                  onPlayYoutubeVideo(item.youtubeVideoId!, item.youtubeTitle || item.title || 'YouTube Video', item.youtubeThumbnail);
                  onSelectedSetlistMediaIdChange(null);
                }}
                style={{
                  background: 'rgba(255, 0, 0, 0.9)',
                  color: 'white',
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  padding: '3px 10px',
                  borderRadius: '4px',
                  marginLeft: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  alignItems: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap'
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                {t('common.play')}
              </button>
            );
          }

          const isStopHovered = hoveredMediaStopId === item.id;
          return (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStopYoutubeVideo();
              }}
              onMouseEnter={() => onHoveredMediaStopIdChange(item.id)}
              onMouseLeave={() => onHoveredMediaStopIdChange(null)}
              style={{
                background: isStopHovered ? '#dc3545' : '#FF0000',
                color: 'white',
                fontSize: '0.6rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '4px',
                marginLeft: '8px',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'background 0.15s'
              }}
            >
              {isStopHovered ? (
                <>
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="4" y="4" width="16" height="16" rx="2" />
                  </svg>
                  {t('common.stop').toUpperCase()}
                </>
              ) : (
                <>
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  {t('common.playing').toUpperCase()}
                </>
              )}
            </button>
          );
        })()}

        {/* Active tool indicator */}
        {activeToolId === item.id && (
          <span style={{
            background: '#00d4ff',
            color: '#000',
            fontSize: '0.6rem',
            fontWeight: 700,
            padding: '2px 6px',
            borderRadius: '4px',
            marginLeft: '8px',
            animation: 'pulse 1.5s ease-in-out infinite'
          }}>
            ACTIVE
          </span>
        )}

        {/* 3-dot menu for song and bible items */}
        {(item.type === 'song' || item.type === 'bible') && (
          <div
            className={`setlist-hover-menu ${setlistMenuOpen === item.id ? 'menu-open' : ''}`}
            style={{ position: 'relative', marginLeft: '8px' }}
          >
            <button
              className={`setlist-menu-btn ${setlistMenuOpen === item.id ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onSetlistMenuOpenChange(setlistMenuOpen === item.id ? null : item.id);
              }}
            >
              <span className="setlist-menu-dot" />
              <span className="setlist-menu-dot" />
              <span className="setlist-menu-dot" />
            </button>
            {setlistMenuOpen === item.id && (
              <div
                className="setlist-menu-dropdown"
                onClick={(e) => e.stopPropagation()}
                dir={isRTL ? 'rtl' : 'ltr'}
              >
                {item.type === 'song' && item.song && (
                  <button
                    className="setlist-menu-item"
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartEditingSong(item.song!);
                      onSetlistMenuOpenChange(null);
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    {t('controlPanel.edit')}
                  </button>
                )}
                {item.type === 'song' && item.song && (
                  <div className="setlist-menu-divider" />
                )}
                <button
                  className="setlist-menu-item danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveFromSetlist(item.id);
                    onSetlistMenuOpenChange(null);
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  {t('controlPanel.removeFromSetlist')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Expanded track list for audio playlists */}
      {item.type === 'audioPlaylist' && item.audioPlaylist && expandedPlaylistIds.has(item.id) && (
        <div
          data-playlist-expanded
          style={{
            marginLeft: '30px',
            borderLeft: '2px solid rgba(255, 152, 0, 0.3)',
            background: 'rgba(0,0,0,0.2)'
          }}
        >
          {item.audioPlaylist.tracks.map((track, trackIndex) => {
            const isCurrentTrack = activePlaylistId === item.id &&
              activePlaylistOrder[activePlaylistIndex] === trackIndex;
            return (
              <div
                key={trackIndex}
                onClick={(e) => {
                  e.stopPropagation();
                  onStartPlaylist(item, trackIndex);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '8px 12px',
                  cursor: 'pointer',
                  background: isCurrentTrack ? 'rgba(255, 152, 0, 0.2)' : 'transparent',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  borderLeft: isCurrentTrack ? '3px solid #FF9800' : '3px solid transparent',
                  transition: 'background 0.15s'
                }}
                onMouseEnter={(e) => {
                  if (!isCurrentTrack) {
                    e.currentTarget.style.background = 'rgba(255, 152, 0, 0.1)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isCurrentTrack) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <span style={{
                  color: isCurrentTrack ? '#FF9800' : 'rgba(255,255,255,0.4)',
                  fontSize: '0.7rem',
                  minWidth: '24px',
                  marginRight: '8px'
                }}>
                  {trackIndex + 1}
                </span>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={isCurrentTrack ? '#FF9800' : 'rgba(255,255,255,0.5)'}
                  strokeWidth="2"
                  style={{ marginRight: '8px', flexShrink: 0 }}
                >
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
                <span style={{
                  flex: 1,
                  color: isCurrentTrack ? '#FF9800' : 'white',
                  fontSize: '0.8rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontWeight: isCurrentTrack ? 600 : 400
                }}>
                  {track.name}
                </span>
                {isCurrentTrack && (
                  <span style={{
                    color: '#FF9800',
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    marginLeft: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" style={{ animation: 'pulse 1s ease-in-out infinite' }}>
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    Playing
                  </span>
                )}
                {track.duration && (
                  <span style={{
                    color: 'rgba(255,255,255,0.4)',
                    fontSize: '0.7rem',
                    marginLeft: '8px'
                  }}>
                    {Math.floor(track.duration / 60)}:{String(Math.floor(track.duration % 60)).padStart(2, '0')}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </React.Fragment>
  );
});

SetlistItemRow.displayName = 'SetlistItemRow';

// Main SetlistPanel component
const SetlistPanel = memo<SetlistPanelProps>(({
  setlist,
  currentSetlistId,
  currentSetlistName,
  hasUnsavedChanges,
  showSetlistMenu,
  setlistMenuHover,
  draggedSong,
  isDraggingMedia,
  dropTargetIndex,
  draggedSetlistIndex,
  collapsedSections,
  expandedPlaylistIds,
  setlistMenuOpen,
  hoveredMediaStopId,
  selectedSetlistMediaId,
  selectedYoutubeItemId,
  selectedSong,
  selectedPresentation,
  activeMedia,
  activeAudio,
  audioStatus,
  activeToolId,
  youtubeOnDisplay,
  activeYoutubeVideo,
  activePlaylistId,
  activePlaylistIndex,
  activePlaylistOrder,
  autoPlayActive,
  autoPlayInterval,
  currentPresentationSlideIndex,
  onShowSetlistMenuChange,
  onSetlistMenuHoverChange,
  onDraggedSongChange,
  onIsDraggingMediaChange,
  onDropTargetIndexChange,
  onDraggedSetlistIndexChange,
  onCollapsedSectionsChange,
  onExpandedPlaylistIdsChange,
  onSetlistMenuOpenChange,
  onHoveredMediaStopIdChange,
  onSelectedSetlistMediaIdChange,
  onSelectedYoutubeItemIdChange,
  onSetlistContextMenuChange,
  onSetlistChange,
  onAddToSetlist,
  onRemoveFromSetlist,
  onTryClearSetlist,
  onAddSectionHeader,
  onShowLoadModal,
  onShowSaveModal,
  onSelectSong,
  onSelectPresentation,
  onSetSelectedSong,
  onSetSelectedPresentation,
  onSetCurrentPresentationSlideIndex,
  onSetCurrentContentType,
  onSetIsBlank,
  onSetLiveState,
  onSendBlank,
  onStopAllTools,
  onBroadcastToolFromSetlist,
  onSetActiveMedia,
  onSetActiveAudio,
  onSetActiveAudioSetlistId,
  onHandlePlayAudio,
  onHandleDisplayMedia,
  onClearMedia,
  onStartPlaylist,
  onSetActivePlaylistId,
  onSetActivePlaylistIndex,
  onSetActivePlaylistOrder,
  onOpenEditPlaylistModal,
  onStartEditingSong,
  onPlayYoutubeVideo,
  onStopYoutubeVideo
}) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he';

  // Handle item click
  const handleItemClick = (item: SetlistItem, index: number) => {
    if (item.type === 'section') {
      onCollapsedSectionsChange(prev => {
        const next = new Set(prev);
        if (next.has(item.id)) {
          next.delete(item.id);
        } else {
          next.add(item.id);
        }
        return next;
      });
    } else if (item.type === 'song' && item.song) {
      onStopAllTools();
      onSetActiveMedia(null);
      onSelectSong(item.song, 'song', false);
    } else if (item.type === 'bible' && item.song) {
      onStopAllTools();
      onSetActiveMedia(null);
      onSelectSong(item.song, 'bible', false);
    } else if (item.type === 'countdown' || item.type === 'announcement' || item.type === 'messages') {
      onBroadcastToolFromSetlist(item);
    } else if (item.type === 'media' && item.mediaPath && item.mediaType) {
      onSelectedSetlistMediaIdChange(selectedSetlistMediaId === item.id ? null : item.id);
    } else if (item.type === 'presentation' && item.presentation) {
      onStopAllTools();
      onSetActiveMedia(null);
      onSetSelectedSong(null);
      onSelectPresentation(item.presentation);
      onSetCurrentPresentationSlideIndex(0);
      if (item.presentation.quickModeData?.type === 'prayer' || item.presentation.quickModeData?.type === 'sermon') {
        onSetCurrentContentType('prayer');
      } else {
        onSetCurrentContentType('presentation');
      }
    } else if (item.type === 'youtube' && item.youtubeVideoId) {
      onSelectedYoutubeItemIdChange(selectedYoutubeItemId === item.id ? null : item.id);
    } else if (item.type === 'audioPlaylist' && item.audioPlaylist) {
      onStartPlaylist(item);
    } else if (item.type === 'blank') {
      onStopAllTools();
      onSetActiveMedia(null);
      onSetSelectedSong(null);
      onSetSelectedPresentation(null);
      onSetIsBlank(true);
      onSetLiveState({ slideData: null, contentType: null, songId: null, slideIndex: 0 });
      onSendBlank();
    }
  };

  // Handle drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedSong) {
      if (dropTargetIndex !== null) {
        onSetlistChange(prev => {
          const newSetlist = [...prev];
          newSetlist.splice(dropTargetIndex, 0, { id: crypto.randomUUID(), type: 'song', song: draggedSong });
          return newSetlist;
        });
      } else {
        onAddToSetlist(draggedSong);
      }
      onDraggedSongChange(null);
    } else if (draggedSetlistIndex !== null && dropTargetIndex !== null && draggedSetlistIndex !== dropTargetIndex) {
      onSetlistChange(prev => {
        const newSetlist = [...prev];
        const [removed] = newSetlist.splice(draggedSetlistIndex, 1);
        newSetlist.splice(dropTargetIndex > draggedSetlistIndex ? dropTargetIndex - 1 : dropTargetIndex, 0, removed);
        return newSetlist;
      });
    } else {
      const jsonData = e.dataTransfer.getData('application/json');
      if (jsonData) {
        try {
          const data = JSON.parse(jsonData);
          if (data.type === 'presentation' && data.presentation) {
            const presItem: SetlistItem = {
              id: crypto.randomUUID(),
              type: 'presentation',
              title: data.presentation.title,
              presentation: data.presentation
            };
            if (dropTargetIndex !== null) {
              onSetlistChange(prev => {
                const newSetlist = [...prev];
                newSetlist.splice(dropTargetIndex, 0, presItem);
                return newSetlist;
              });
            } else {
              onSetlistChange(prev => [...prev, presItem]);
            }
          } else if (data.type && data.path && data.name) {
            const mediaItem: SetlistItem = {
              id: crypto.randomUUID(),
              type: 'media',
              title: data.name,
              mediaType: data.type,
              mediaPath: data.path,
              mediaName: data.name,
              mediaDuration: data.duration,
              thumbnailPath: data.thumbnailPath
            };
            if (dropTargetIndex !== null) {
              onSetlistChange(prev => {
                const newSetlist = [...prev];
                newSetlist.splice(dropTargetIndex, 0, mediaItem);
                return newSetlist;
              });
            } else {
              onSetlistChange(prev => [...prev, mediaItem]);
            }
          }
        } catch (err) {
          console.error('Failed to parse drop data:', err);
        }
      }
    }
    onDropTargetIndexChange(null);
    onDraggedSetlistIndexChange(null);
    onIsDraggingMediaChange(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.1)', cursor: 'context-menu' }}
        onContextMenu={(e) => { e.preventDefault(); onShowSetlistMenuChange(true); }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: 'white', fontWeight: 600 }}>{currentSetlistId ? currentSetlistName : t('controlPanel.setlist')}</span>
          {hasUnsavedChanges && setlist.length > 0 && (
            <span style={{ color: '#ffc107', fontSize: '0.7rem', fontWeight: 600 }}>*</span>
          )}
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', marginLeft: '2px' }}>{setlist.length} {t('controlPanel.items')}</span>
        </div>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => onShowSetlistMenuChange(!showSetlistMenu)}
            onMouseEnter={() => onSetlistMenuHoverChange(true)}
            onMouseLeave={() => onSetlistMenuHoverChange(false)}
            style={{
              background: setlistMenuHover ? 'rgba(255,255,255,0.15)' : 'transparent',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 8px',
              color: 'rgba(255,255,255,0.6)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s ease',
              position: 'relative'
            }}
          >
            <span style={{ width: '14px', height: '2px', background: 'currentColor', borderRadius: '1px' }} />
            <span style={{ width: '14px', height: '2px', background: 'currentColor', borderRadius: '1px' }} />
            <span style={{ width: '14px', height: '2px', background: 'currentColor', borderRadius: '1px' }} />
            {hasUnsavedChanges && setlist.length > 0 && (
              <span style={{
                position: 'absolute',
                top: '2px',
                right: '2px',
                width: '6px',
                height: '6px',
                background: '#ffc107',
                borderRadius: '50%'
              }} />
            )}
          </button>
          {showSetlistMenu && (
            <>
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                onClick={() => onShowSetlistMenuChange(false)}
              />
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '4px',
                background: 'rgba(30,30,50,0.98)',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.2)',
                padding: '4px',
                minWidth: '140px',
                zIndex: 100,
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
              }}>
                <button
                  onClick={() => { onTryClearSetlist(); onShowSetlistMenuChange(false); }}
                  style={{ width: '100%', display: 'flex', flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', borderRadius: '6px', padding: '8px 12px', color: 'white', cursor: 'pointer', fontSize: '0.85rem', textAlign: isRTL ? 'right' : 'left' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2Z"/></svg>
                  {t('controlPanel.newSetlist')}
                </button>
                <button
                  onClick={() => { onShowLoadModal(); onShowSetlistMenuChange(false); }}
                  style={{ width: '100%', display: 'flex', flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', borderRadius: '6px', padding: '8px 12px', color: 'white', cursor: 'pointer', fontSize: '0.85rem', textAlign: isRTL ? 'right' : 'left' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h2.764c.958 0 1.76.56 2.311 1.184C7.985 3.648 8.48 4 9 4h4.5A1.5 1.5 0 0 1 15 5.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12.5v-9zM2.5 3a.5.5 0 0 0-.5.5V6h12v-.5a.5.5 0 0 0-.5-.5H9c-.964 0-1.71-.629-2.174-1.154C6.374 3.334 5.82 3 5.264 3H2.5zM14 7H2v5.5a.5.5 0 0 0 .5.5h11a.5.5 0 0 0 .5-.5V7z"/></svg>
                  {t('controlPanel.loadSetlist')}
                </button>
                <button
                  onClick={() => { onShowSaveModal(); onShowSetlistMenuChange(false); }}
                  style={{ width: '100%', display: 'flex', flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', borderRadius: '6px', padding: '8px 12px', color: hasUnsavedChanges && setlist.length > 0 ? '#ffc107' : 'white', cursor: 'pointer', fontSize: '0.85rem', textAlign: isRTL ? 'right' : 'left' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M2 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H9.5a1 1 0 0 0-1 1v7.293l2.146-2.147a.5.5 0 0 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-3-3a.5.5 0 1 1 .708-.708L7.5 9.293V2a2 2 0 0 1 2-2H14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h2.5a.5.5 0 0 1 0 1H2z"/></svg>
                  {t('controlPanel.saveSetlist')}
                </button>
                <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />
                <button
                  onClick={() => { onAddSectionHeader(); onShowSetlistMenuChange(false); }}
                  style={{ width: '100%', display: 'flex', flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', borderRadius: '6px', padding: '8px 12px', color: 'white', cursor: 'pointer', fontSize: '0.85rem', textAlign: isRTL ? 'right' : 'left' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path fillRule="evenodd" d="M2 3.5a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5zm0 4a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5zm0 4a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5z"/></svg>
                  {t('controlPanel.addSection')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Setlist content area */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          background: draggedSong ? 'rgba(6,182,212,0.05)' : isDraggingMedia ? 'rgba(50,200,100,0.08)' : 'transparent',
          transition: 'background 0.2s'
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (e.dataTransfer.types.includes('application/json')) {
            onIsDraggingMediaChange(true);
            e.dataTransfer.dropEffect = 'copy';
          } else {
            e.dataTransfer.dropEffect = draggedSong ? 'copy' : 'move';
          }
        }}
        onDragEnter={(e) => {
          if (e.dataTransfer.types.includes('application/json')) {
            onIsDraggingMediaChange(true);
          }
        }}
        onDrop={handleDrop}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            onDropTargetIndexChange(null);
            onIsDraggingMediaChange(false);
          }
        }}
      >
        {setlist.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
            {t('controlPanel.dragItemsHere')}
          </div>
        ) : (
          (() => {
            let currentSectionId: string | null = null;
            return setlist.map((item, index) => {
              if (item.type === 'section') {
                currentSectionId = item.id;
              }
              const belongsToSection = item.type !== 'section' ? currentSectionId : null;
              if (belongsToSection && collapsedSections.has(belongsToSection)) {
                return null;
              }
              const sectionItemCount = item.type === 'section' ? (() => {
                let count = 0;
                for (let i = index + 1; i < setlist.length; i++) {
                  if (setlist[i].type === 'section') break;
                  count++;
                }
                return count;
              })() : 0;
              const isCollapsed = item.type === 'section' && collapsedSections.has(item.id);

              return (
                <SetlistItemRow
                  key={item.id}
                  item={item}
                  index={index}
                  isRTL={isRTL}
                  t={t}
                  setlist={setlist}
                  collapsedSections={collapsedSections}
                  expandedPlaylistIds={expandedPlaylistIds}
                  selectedSong={selectedSong}
                  selectedPresentation={selectedPresentation}
                  activeMedia={activeMedia}
                  activeAudio={activeAudio}
                  audioStatus={audioStatus}
                  activeToolId={activeToolId}
                  youtubeOnDisplay={youtubeOnDisplay}
                  activeYoutubeVideo={activeYoutubeVideo}
                  activePlaylistId={activePlaylistId}
                  activePlaylistIndex={activePlaylistIndex}
                  activePlaylistOrder={activePlaylistOrder}
                  autoPlayActive={autoPlayActive}
                  autoPlayInterval={autoPlayInterval}
                  currentPresentationSlideIndex={currentPresentationSlideIndex}
                  selectedSetlistMediaId={selectedSetlistMediaId}
                  selectedYoutubeItemId={selectedYoutubeItemId}
                  dropTargetIndex={dropTargetIndex}
                  draggedSetlistIndex={draggedSetlistIndex}
                  setlistMenuOpen={setlistMenuOpen}
                  hoveredMediaStopId={hoveredMediaStopId}
                  currentSectionId={currentSectionId}
                  sectionItemCount={sectionItemCount}
                  isCollapsed={isCollapsed}
                  onDragStart={(idx) => {
                    onDraggedSetlistIndexChange(idx);
                  }}
                  onDragEnd={() => {
                    onDraggedSetlistIndexChange(null);
                    onDropTargetIndexChange(null);
                  }}
                  onDragOver={(idx) => onDropTargetIndexChange(idx)}
                  onMouseLeave={(itemId) => {
                    if (setlistMenuOpen === itemId) onSetlistMenuOpenChange(null);
                  }}
                  onContextMenu={(e, itm) => {
                    e.preventDefault();
                    onSetlistContextMenuChange({ x: e.clientX, y: e.clientY, item: itm });
                  }}
                  onClick={handleItemClick}
                  onDoubleClick={onRemoveFromSetlist}
                  onCollapsedSectionsChange={onCollapsedSectionsChange}
                  onExpandedPlaylistIdsChange={onExpandedPlaylistIdsChange}
                  onSetlistMenuOpenChange={onSetlistMenuOpenChange}
                  onHoveredMediaStopIdChange={onHoveredMediaStopIdChange}
                  onSelectedSetlistMediaIdChange={onSelectedSetlistMediaIdChange}
                  onSetActiveAudio={onSetActiveAudio}
                  onSetActiveAudioSetlistId={onSetActiveAudioSetlistId}
                  onSetActivePlaylistId={onSetActivePlaylistId}
                  onSetActivePlaylistIndex={onSetActivePlaylistIndex}
                  onSetActivePlaylistOrder={onSetActivePlaylistOrder}
                  onSetActiveMedia={onSetActiveMedia}
                  onClearMedia={onClearMedia}
                  onHandlePlayAudio={onHandlePlayAudio}
                  onHandleDisplayMedia={onHandleDisplayMedia}
                  onStopAllTools={onStopAllTools}
                  onStartPlaylist={onStartPlaylist}
                  onOpenEditPlaylistModal={onOpenEditPlaylistModal}
                  onStartEditingSong={onStartEditingSong}
                  onRemoveFromSetlist={onRemoveFromSetlist}
                  onPlayYoutubeVideo={onPlayYoutubeVideo}
                  onStopYoutubeVideo={onStopYoutubeVideo}
                />
              );
            });
          })()
        )}
      </div>
    </div>
  );
});

SetlistPanel.displayName = 'SetlistPanel';

export default SetlistPanel;
