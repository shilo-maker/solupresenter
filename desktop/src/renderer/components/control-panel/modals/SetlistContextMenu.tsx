import React from 'react';

interface Song {
  id: string;
  title: string;
  [key: string]: unknown;
}

interface Presentation {
  id: string;
  title: string;
  quickModeData?: {
    type: 'sermon' | 'prayer' | 'announcements';
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface AudioPlaylist {
  id: string;
  name: string;
  [key: string]: unknown;
}

interface SetlistItem {
  id: string;
  type: string;
  title: string;
  song?: Song;
  presentation?: Presentation;
  audioPlaylist?: AudioPlaylist;
  [key: string]: unknown;
}

interface ContextMenuState {
  x: number;
  y: number;
  item: SetlistItem;
}

interface SetlistContextMenuProps {
  contextMenu: ContextMenuState;
  onClose: () => void;
  onEditSong: (song: Song) => void;
  onEditPrayerPresentation: (presentation: Presentation) => void;
  onNavigateToPresentation: (id: string) => void;
  onEditPlaylist: (item: SetlistItem) => void;
  onRenameSection: (itemId: string, newName: string) => void;
  onRemoveFromSetlist: (itemId: string) => void;
}

const menuButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  background: 'transparent',
  border: 'none',
  borderRadius: '4px',
  color: 'rgba(255,255,255,0.8)',
  fontSize: '11px',
  textAlign: 'left',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '6px'
};

const EditIcon = ({ color = '#06b6d4' }: { color?: string }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const DeleteIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const SetlistContextMenu: React.FC<SetlistContextMenuProps> = ({
  contextMenu,
  onClose,
  onEditSong,
  onEditPrayerPresentation,
  onNavigateToPresentation,
  onEditPlaylist,
  onRenameSection,
  onRemoveFromSetlist
}) => {
  const { item, x, y } = contextMenu;

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>, isDelete = false) => {
    e.currentTarget.style.background = isDelete ? 'rgba(239,68,68,0.2)' : 'rgba(6,182,212,0.2)';
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = 'transparent';
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: 'fixed',
          top: y,
          left: x,
          background: 'rgba(30, 30, 35, 0.98)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: '8px',
          padding: '4px',
          minWidth: '160px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          zIndex: 2001
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Edit Song */}
        {item.type === 'song' && item.song && (
          <button
            onClick={() => {
              onEditSong(item.song!);
              onClose();
            }}
            style={menuButtonStyle}
            onMouseEnter={(e) => handleMouseEnter(e)}
            onMouseLeave={handleMouseLeave}
          >
            <EditIcon />
            Edit Song
          </button>
        )}

        {/* Edit Prayer/Sermon Presentation */}
        {item.type === 'presentation' && item.presentation?.quickModeData &&
         (item.presentation.quickModeData.type === 'prayer' || item.presentation.quickModeData.type === 'sermon') && (
          <button
            onClick={() => {
              onEditPrayerPresentation(item.presentation!);
              onClose();
            }}
            style={menuButtonStyle}
            onMouseEnter={(e) => handleMouseEnter(e)}
            onMouseLeave={handleMouseLeave}
          >
            <EditIcon />
            Edit {item.presentation.quickModeData.type === 'sermon' ? 'Sermon' : 'Prayer'} Points
          </button>
        )}

        {/* Edit Free-form Presentation */}
        {item.type === 'presentation' && item.presentation && !item.presentation.quickModeData && (
          <button
            onClick={() => {
              onNavigateToPresentation(item.presentation!.id);
              onClose();
            }}
            style={menuButtonStyle}
            onMouseEnter={(e) => handleMouseEnter(e)}
            onMouseLeave={handleMouseLeave}
          >
            <EditIcon />
            Edit Presentation
          </button>
        )}

        {/* Edit Playlist */}
        {item.type === 'audioPlaylist' && item.audioPlaylist && (
          <button
            onClick={() => {
              onEditPlaylist(item);
              onClose();
            }}
            style={menuButtonStyle}
            onMouseEnter={(e) => handleMouseEnter(e)}
            onMouseLeave={handleMouseLeave}
          >
            <EditIcon />
            Edit Playlist
          </button>
        )}

        {/* Rename Section */}
        {item.type === 'section' && (
          <button
            onClick={() => {
              const newName = prompt('Enter new section name:', item.title || 'Section');
              if (newName && newName.trim()) {
                onRenameSection(item.id, newName.trim());
              }
              onClose();
            }}
            style={menuButtonStyle}
            onMouseEnter={(e) => handleMouseEnter(e)}
            onMouseLeave={handleMouseLeave}
          >
            <EditIcon />
            Rename Section
          </button>
        )}

        {/* Divider */}
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />

        {/* Delete */}
        <button
          onClick={() => {
            onRemoveFromSetlist(item.id);
            onClose();
          }}
          style={{ ...menuButtonStyle, color: '#ef4444' }}
          onMouseEnter={(e) => handleMouseEnter(e, true)}
          onMouseLeave={handleMouseLeave}
        >
          <DeleteIcon />
          Remove from Setlist
        </button>
      </div>
    </div>
  );
};

export default SetlistContextMenu;
