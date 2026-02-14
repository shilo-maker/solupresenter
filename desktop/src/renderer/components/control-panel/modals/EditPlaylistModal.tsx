import React, { useState, useCallback, useRef } from 'react';

interface AudioPlaylistTrack {
  path: string;
  name: string;
  duration?: number | null;
}

interface EditPlaylistModalProps {
  initialTracks: AudioPlaylistTrack[];
  initialName: string;
  initialShuffle: boolean;
  onClose: () => void;
  onSave: (tracks: AudioPlaylistTrack[], name: string, shuffle: boolean) => void;
  onSaveAsNew: (tracks: AudioPlaylistTrack[], name: string, shuffle: boolean) => Promise<void>;
}

const EditPlaylistModal: React.FC<EditPlaylistModalProps> = ({
  initialTracks,
  initialName,
  initialShuffle,
  onClose,
  onSave,
  onSaveAsNew
}) => {
  const [tracks, setTracks] = useState<AudioPlaylistTrack[]>(initialTracks);
  const [name, setName] = useState(initialName);
  const [shuffle, setShuffle] = useState(initialShuffle);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const draggedIndexRef = useRef<number | null>(null);
  const dropTargetIndexRef = useRef<number | null>(null);

  const handleDragStart = useCallback((index: number) => {
    setDraggedIndex(index);
    draggedIndexRef.current = index;
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDropTargetIndex(index);
    dropTargetIndexRef.current = index;
  }, []);

  const handleDragEnd = useCallback(() => {
    const dragged = draggedIndexRef.current;
    const dropTarget = dropTargetIndexRef.current;
    if (dragged !== null && dropTarget !== null && dragged !== dropTarget) {
      setTracks(prev => {
        const newTracks = [...prev];
        const [removed] = newTracks.splice(dragged, 1);
        const insertIndex = dropTarget > dragged ? dropTarget - 1 : dropTarget;
        newTracks.splice(insertIndex, 0, removed);
        return newTracks;
      });
    }
    setDraggedIndex(null);
    setDropTargetIndex(null);
    draggedIndexRef.current = null;
    dropTargetIndexRef.current = null;
  }, []);

  const removeTrack = useCallback((index: number) => {
    setTracks(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleSave = () => {
    if (tracks.length === 0) return;
    onSave(tracks, name, shuffle);
  };

  const handleSaveAsNew = async () => {
    if (tracks.length === 0) return;
    await onSaveAsNew(tracks, name, shuffle);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'rgba(30, 30, 35, 0.98)',
          border: '1px solid rgba(255, 152, 0, 0.3)',
          borderRadius: '12px',
          padding: '16px',
          minWidth: '400px',
          maxWidth: '500px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={() => window.focus()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF9800" strokeWidth="2">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'white' }}>
            Edit Audio Playlist
          </div>
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>
            Playlist Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Playlist name"
            style={{
              width: '100%',
              padding: '10px 12px',
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(255, 152, 0, 0.4)',
              borderRadius: '6px',
              color: 'white',
              fontSize: '12px',
              outline: 'none'
            }}
          />
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            fontSize: '12px',
            color: 'rgba(255,255,255,0.8)'
          }}>
            <div style={{
              width: '18px',
              height: '18px',
              borderRadius: '4px',
              border: shuffle ? '2px solid #FF9800' : '2px solid rgba(255,255,255,0.3)',
              background: shuffle ? 'rgba(255, 152, 0, 0.3)' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease'
            }}
              onClick={() => setShuffle(!shuffle)}
            >
              {shuffle && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FF9800" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
            <span onClick={() => setShuffle(!shuffle)}>
              Shuffle playback order
            </span>
          </label>
        </div>

        {/* Track List with Reordering */}
        <div style={{
          maxHeight: '300px',
          overflowY: 'auto',
          marginBottom: '12px',
          background: 'rgba(0,0,0,0.2)',
          borderRadius: '6px',
          padding: '4px'
        }}>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', padding: '4px 8px', marginBottom: '4px' }}>
            Drag to reorder tracks ({tracks.length} tracks)
          </div>
          {tracks.map((track, index) => (
            <div
              key={`${track.path}-${index}`}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 8px',
                background: draggedIndex === index
                  ? 'rgba(255, 152, 0, 0.3)'
                  : dropTargetIndex === index
                    ? 'rgba(255, 152, 0, 0.15)'
                    : 'transparent',
                borderRadius: '4px',
                cursor: 'grab',
                borderTop: dropTargetIndex === index && draggedIndex !== null && draggedIndex > index
                  ? '2px solid #FF9800'
                  : 'none',
                borderBottom: dropTargetIndex === index && draggedIndex !== null && draggedIndex < index
                  ? '2px solid #FF9800'
                  : 'none',
                transition: 'background 0.15s ease'
              }}
            >
              {/* Drag handle */}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2">
                <line x1="8" y1="6" x2="16" y2="6" />
                <line x1="8" y1="12" x2="16" y2="12" />
                <line x1="8" y1="18" x2="16" y2="18" />
              </svg>
              {/* Track number */}
              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', width: '16px', textAlign: 'center' }}>
                {index + 1}
              </span>
              {/* Track name */}
              <span style={{
                flex: 1,
                fontSize: '11px',
                color: 'white',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {track.name}
              </span>
              {/* Duration */}
              {track.duration && (
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>
                  {Math.floor(track.duration / 60)}:{String(Math.floor(track.duration % 60)).padStart(2, '0')}
                </span>
              )}
              {/* Remove button */}
              <button
                onClick={(e) => { e.stopPropagation(); removeTrack(index); }}
                style={{
                  padding: '2px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '3px',
                  color: 'rgba(255,255,255,0.4)',
                  cursor: 'pointer'
                }}
                title="Remove from playlist"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
          {tracks.length === 0 && (
            <div style={{ padding: '16px', textAlign: 'center', fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
              No tracks in playlist
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between' }}>
          <button
            onClick={handleSaveAsNew}
            disabled={tracks.length === 0}
            style={{
              padding: '8px 12px',
              background: tracks.length === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(102, 126, 234, 0.2)',
              border: tracks.length === 0 ? 'none' : '1px solid rgba(102, 126, 234, 0.4)',
              borderRadius: '6px',
              color: tracks.length === 0 ? 'rgba(255,255,255,0.3)' : '#667eea',
              fontSize: '11px',
              fontWeight: 500,
              cursor: tracks.length === 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="Save as new playlist"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            Save as New
          </button>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px',
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: '6px',
                color: 'rgba(255,255,255,0.7)',
                fontSize: '11px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={tracks.length === 0}
              style={{
                padding: '8px 16px',
                background: tracks.length === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(255, 152, 0, 0.3)',
                border: tracks.length === 0 ? 'none' : '1px solid rgba(255, 152, 0, 0.5)',
                borderRadius: '6px',
                color: tracks.length === 0 ? 'rgba(255,255,255,0.3)' : '#FF9800',
                fontSize: '11px',
                fontWeight: 600,
                cursor: tracks.length === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditPlaylistModal;
