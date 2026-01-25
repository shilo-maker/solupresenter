import React, { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { theme } from '../styles/theme';
import MediaErrorBoundary from './MediaErrorBoundary';
import { useToast } from '../contexts/ToastContext';
import { useSettings } from '../contexts/SettingsContext';
import { createLogger } from '../utils/debug';

// Create logger for this module
const log = createLogger('MediaGrid');

// ============ Constants ============
const DEFAULT_THUMBNAIL_TIMEOUT_MS = 8000; // 8 seconds default timeout for video thumbnail generation
const MAX_RETRY_ATTEMPTS = 3; // Maximum number of retry attempts for thumbnail generation
const INITIAL_VISIBLE_ITEMS = 20; // Initial number of items to show in virtualized list
const LOAD_MORE_COUNT = 20; // Number of additional items to load when scrolling
const MAX_THUMBNAIL_CACHE_SIZE = 100; // Maximum number of cached video thumbnails
const THUMBNAIL_WIDTH = 150; // Width for video thumbnail generation

/**
 * LRU cache for video thumbnails with size eviction.
 * Stores base64 data URLs for generated thumbnails.
 */
class ThumbnailCache {
  private cache = new Map<string, string>();
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get(key: string): string | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: string, value: string): void {
    // Remove if exists (will be re-added at end)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    // Evict oldest entries if at capacity
    while (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(key, value);
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }
}

// Video thumbnail cache with LRU eviction to prevent memory leaks
const videoThumbnailCache = new ThumbnailCache(MAX_THUMBNAIL_CACHE_SIZE);

interface MediaFolder {
  id: string;
  path: string;
  name: string;
  type: 'images' | 'videos' | 'all';
  fileCount: number;
}

interface MediaFile {
  id: string;
  name: string;
  path: string;
  type: 'image' | 'video';
  size: number;
  folderId: string;
}

interface ImportedMediaItem {
  id: string;
  name: string;
  type: 'video' | 'image' | 'audio';
  originalPath: string;
  processedPath: string;
  duration: number | null;
  thumbnailPath: string | null;
  fileSize: number;
  folderId: string | null;
  tags: string | null;
  width: number | null;
  height: number | null;
  createdAt: string;
}

interface LibraryFolder {
  id: string;
  name: string;
  createdAt: string;
}

interface AudioPlaylistTrack {
  path: string;
  name: string;
  duration?: number | null;
}

interface MediaGridProps {
  onSelectImage?: (path: string) => void;
  onSelectVideo?: (path: string) => void;
  onSelectAudio?: (path: string, name: string) => void;
  onAddToSetlist?: (media: { type: 'video' | 'image' | 'audio'; path: string; name: string; duration?: number | null; thumbnailPath?: string | null }) => void;
  onAddPlaylistToSetlist?: (playlist: { tracks: AudioPlaylistTrack[]; shuffle: boolean; name: string }) => void;
}

// Component to generate and display video thumbnails using DOM video element
const VideoThumbnail: React.FC<{ filePath: string; fileName: string; timeoutMs?: number }> = memo(({ filePath, fileName, timeoutMs = DEFAULT_THUMBNAIL_TIMEOUT_MS }) => {
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Build media:// URL for the video (custom protocol registered in main process)
  const mediaUrl = useMemo(() => {
    // Use custom media:// protocol which bypasses Electron security restrictions
    const normalizedPath = filePath.replace(/\\/g, '/');
    const encodedPath = normalizedPath
      .split('/')
      .map(segment => encodeURIComponent(segment))
      .join('/');
    // Use triple-slash format (no hostname) for better cross-window compatibility
    return `media://file/${encodedPath}`;
  }, [filePath]);

  // Check cache on mount
  useEffect(() => {
    const cached = videoThumbnailCache.get(filePath);
    if (cached) {
      setThumbnail(cached);
      setLoading(false);
    }
  }, [filePath, mediaUrl]);

  // Cleanup video element on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      const video = videoRef.current;
      if (video) {
        video.pause();
        video.src = '';
        video.load();
      }
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }
    };
  }, []);

  const handleLoadedData = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    // Guard against invalid duration (NaN, Infinity, or 0)
    if (!isFinite(video.duration) || video.duration <= 0) {
      log.warn('Invalid video duration:', video.duration);
      // Try to capture at current position instead
      video.currentTime = 0;
      return;
    }
    // Seek to the middle of the video (50%)
    const seekTime = video.duration * 0.5;
    video.currentTime = seekTime;
  }, []);

  const handleSeeked = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || thumbnail) return;

    try {
      // Guard against division by zero
      if (video.videoHeight === 0 || video.videoWidth === 0) {
        log.error('Invalid video dimensions:', video.videoWidth, 'x', video.videoHeight);
        setError(true);
        setLoading(false);
        return;
      }
      const aspectRatio = video.videoWidth / video.videoHeight;
      const thumbWidth = THUMBNAIL_WIDTH;
      const thumbHeight = thumbWidth / aspectRatio;

      canvas.width = thumbWidth;
      canvas.height = thumbHeight;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, thumbWidth, thumbHeight);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);

        // Cache the thumbnail (with LRU eviction)
        videoThumbnailCache.set(filePath, dataUrl);
        setThumbnail(dataUrl);

        // Clear canvas to help with memory management
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.width = 0;
        canvas.height = 0;
      }
    } catch (err) {
      log.error('Failed to generate thumbnail:', err);
      setError(true);
    }
    setLoading(false);
  }, [filePath, thumbnail]);

  const handleError = useCallback((e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const video = e.currentTarget;
    log.error('Video load error:', filePath, 'error:', video.error?.message || 'unknown', 'attempt:', retryCount + 1);

    // Auto-retry if under max attempts
    if (retryCount < MAX_RETRY_ATTEMPTS - 1) {
      log.debug('Auto-retrying thumbnail generation...');
      setRetryCount(prev => prev + 1);
      setLoading(true);
      setError(false);
      // Force video element to reload by updating key (handled via retryCount)
    } else {
      setError(true);
      setLoading(false);
    }
  }, [filePath, retryCount]);

  // Manual retry handler
  const handleRetry = useCallback(() => {
    if (retryCount < MAX_RETRY_ATTEMPTS) {
      setRetryCount(prev => prev + 1);
      setLoading(true);
      setError(false);
      setThumbnail(null);
    }
  }, [retryCount]);

  // Timeout fallback
  useEffect(() => {
    if (!loading) return;
    const timeout = setTimeout(() => {
      if (loading && !thumbnail) {
        setError(true);
        setLoading(false);
      }
    }, timeoutMs);
    return () => clearTimeout(timeout);
  }, [loading, thumbnail, timeoutMs]);

  // Show loading state with hidden video for thumbnail generation
  if (loading || !thumbnail) {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        background: 'rgba(0,0,0,0.6)',
        position: 'relative'
      }}>
        {/* Hidden video element for thumbnail generation - must be in DOM to access media:// protocol */}
        {!thumbnail && !error && (
          <>
            <video
              key={`video-${filePath}-${retryCount}`}
              ref={videoRef}
              src={mediaUrl}
              muted
              playsInline
              preload="metadata"
              onLoadedData={handleLoadedData}
              onSeeked={handleSeeked}
              onError={handleError}
              style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
            />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </>
        )}
        {error ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,100,100,0.7)" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.5)' }}>Failed</span>
            {retryCount < MAX_RETRY_ATTEMPTS && (
              <button
                onClick={(e) => { e.stopPropagation(); handleRetry(); }}
                style={{
                  padding: '2px 6px',
                  fontSize: '8px',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '3px',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                Retry
              </button>
            )}
          </div>
        ) : loading ? (
          <>
            <div style={{
              width: '20px',
              height: '20px',
              border: '2px solid rgba(255,255,255,0.2)',
              borderTopColor: theme.colors.primary.main,
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            <style>{`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}</style>
          </>
        ) : (
          <>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="rgba(255,255,255,0.7)" stroke="none">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.5)', textAlign: 'center', padding: '0 4px' }}>
              {fileName.length > 12 ? fileName.substring(0, 12) + '...' : fileName}
            </span>
          </>
        )}
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <img
        src={thumbnail}
        alt={fileName}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover'
        }}
      />
      {/* Play icon overlay */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '28px',
        height: '28px',
        background: 'rgba(0,0,0,0.6)',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="white" stroke="none">
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
      </div>
    </div>
  );
});

VideoThumbnail.displayName = 'VideoThumbnail';

type MediaTypeFilter = 'image' | 'video' | 'audio' | 'playlist' | null;

// Memoized static styles to prevent recreation on each render
const listContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '2px'
};

const folderGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: '6px',
  padding: '2px'
};

const MediaGrid: React.FC<MediaGridProps> = ({ onSelectImage, onSelectVideo, onSelectAudio, onAddToSetlist, onAddPlaylistToSetlist }) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he';
  const { showError, showSuccess } = useToast();
  const { settings } = useSettings();

  // Memoize thumbnail timeout to prevent VideoThumbnail re-renders when settings change but timeout stays same
  const thumbnailTimeoutMs = useMemo(
    () => (settings.thumbnailGenerationTimeout || 8) * 1000,
    [settings.thumbnailGenerationTimeout]
  );
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [importedMedia, setImportedMedia] = useState<ImportedMediaItem[]>([]);
  const [libraryFolders, setLibraryFolders] = useState<LibraryFolder[]>([]);
  const [selectedLibraryFolder, setSelectedLibraryFolder] = useState<string | null>(null); // null = "All"
  const [selectedFolder, setSelectedFolder] = useState<MediaFolder | null>(null);
  const [selectedMediaType, setSelectedMediaType] = useState<MediaTypeFilter>(null); // null = show all
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_ITEMS);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; mediaId: string } | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; right: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [renamingMediaId, setRenamingMediaId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [draggedMediaId, setDraggedMediaId] = useState<string | null>(null);
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null);
  const [hoveredMediaId, setHoveredMediaId] = useState<string | null>(null);
  const [dropTargetFolderId, setDropTargetFolderId] = useState<string | null | 'all'>(null);
  const [showFolderDropdown, setShowFolderDropdown] = useState(false);
  const folderButtonRef = useRef<HTMLButtonElement>(null);
  // Saved playlists state
  const [savedPlaylists, setSavedPlaylists] = useState<Array<{
    id: string;
    name: string;
    tracks: AudioPlaylistTrack[];
    shuffle: boolean;
    createdAt: string;
    updatedAt: string;
  }>>([]);
  // Playlist editor state
  const [showPlaylistEditor, setShowPlaylistEditor] = useState(false);
  const [editingPlaylistId, setEditingPlaylistId] = useState<string | null>(null); // null = creating new
  const [editorPlaylistName, setEditorPlaylistName] = useState('');
  const [editorPlaylistTracks, setEditorPlaylistTracks] = useState<AudioPlaylistTrack[]>([]);
  const [editorPlaylistShuffle, setEditorPlaylistShuffle] = useState(false);
  const [editorSearchQuery, setEditorSearchQuery] = useState('');
  const [editorDraggedIndex, setEditorDraggedIndex] = useState<number | null>(null);
  const [editorDropTargetIndex, setEditorDropTargetIndex] = useState<number | null>(null);
  // Playlist context menu
  const [playlistMenuId, setPlaylistMenuId] = useState<string | null>(null);
  const [playlistMenuPosition, setPlaylistMenuPosition] = useState<{ top: number; left: number } | null>(null);
  // Loading states
  const [isSaving, setIsSaving] = useState(false);

  // Load saved playlists
  const loadSavedPlaylists = useCallback(async () => {
    try {
      const playlists = await window.electronAPI.getAudioPlaylists();
      setSavedPlaylists(playlists);
    } catch (error) {
      log.error('Failed to load saved playlists:', error);
    }
  }, []);

  // Open playlist editor for creating new playlist
  const openNewPlaylistEditor = useCallback(() => {
    setEditingPlaylistId(null);
    setEditorPlaylistName('');
    setEditorPlaylistTracks([]);
    setEditorPlaylistShuffle(false);
    setEditorSearchQuery('');
    setShowPlaylistEditor(true);
  }, []);

  // Open playlist editor for editing existing playlist
  const openEditPlaylistEditor = useCallback((playlist: typeof savedPlaylists[0]) => {
    setEditingPlaylistId(playlist.id);
    setEditorPlaylistName(playlist.name);
    setEditorPlaylistTracks([...playlist.tracks]);
    setEditorPlaylistShuffle(playlist.shuffle);
    setEditorSearchQuery('');
    setShowPlaylistEditor(true);
    setPlaylistMenuId(null);
  }, []);

  // Close playlist editor
  const closePlaylistEditor = useCallback(() => {
    setShowPlaylistEditor(false);
    setEditingPlaylistId(null);
    setEditorPlaylistName('');
    setEditorPlaylistTracks([]);
    setEditorPlaylistShuffle(false);
    setEditorSearchQuery('');
    setEditorDraggedIndex(null);
    setEditorDropTargetIndex(null);
  }, []);

  // Add audio file to playlist being edited
  const addTrackToEditor = useCallback((item: ImportedMediaItem) => {
    if (item.type !== 'audio') return;
    // Check if already in playlist
    if (editorPlaylistTracks.some(t => t.path === item.processedPath)) return;

    setEditorPlaylistTracks(prev => [...prev, {
      path: item.processedPath,
      name: item.name,
      duration: item.duration
    }]);
  }, [editorPlaylistTracks]);

  // Remove track from editor
  const removeTrackFromEditor = useCallback((index: number) => {
    setEditorPlaylistTracks(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Refs for drag indices to avoid stale closures
  const editorDraggedIndexRef = useRef<number | null>(null);
  const editorDropTargetIndexRef = useRef<number | null>(null);

  // Handle track reordering in editor
  const handleEditorTrackDragStart = useCallback((index: number) => {
    editorDraggedIndexRef.current = index;
    setEditorDraggedIndex(index);
  }, []);

  const handleEditorTrackDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    editorDropTargetIndexRef.current = index;
    setEditorDropTargetIndex(index);
  }, []);

  const handleEditorTrackDragEnd = useCallback(() => {
    const draggedIdx = editorDraggedIndexRef.current;
    const dropIdx = editorDropTargetIndexRef.current;

    if (draggedIdx !== null && dropIdx !== null && draggedIdx !== dropIdx) {
      setEditorPlaylistTracks(prev => {
        const newTracks = [...prev];
        const [removed] = newTracks.splice(draggedIdx, 1);
        const insertIndex = dropIdx > draggedIdx ? dropIdx - 1 : dropIdx;
        newTracks.splice(insertIndex, 0, removed);
        return newTracks;
      });
    }
    editorDraggedIndexRef.current = null;
    editorDropTargetIndexRef.current = null;
    setEditorDraggedIndex(null);
    setEditorDropTargetIndex(null);
  }, []);

  // Save playlist (create or update)
  const savePlaylistFromEditor = useCallback(async () => {
    if (editorPlaylistTracks.length === 0 || isSaving) return;

    const name = editorPlaylistName.trim() || `Playlist (${editorPlaylistTracks.length} tracks)`;

    setIsSaving(true);
    try {
      if (editingPlaylistId) {
        // Update existing
        await window.electronAPI.updateAudioPlaylist(editingPlaylistId, {
          name,
          tracks: editorPlaylistTracks,
          shuffle: editorPlaylistShuffle
        });
        showSuccess('Playlist updated!');
      } else {
        // Create new
        await window.electronAPI.createAudioPlaylist({
          name,
          tracks: editorPlaylistTracks,
          shuffle: editorPlaylistShuffle
        });
        showSuccess('Playlist created!');
      }
      await loadSavedPlaylists();
      closePlaylistEditor();
    } catch (error) {
      log.error('Failed to save playlist:', error);
      showError('Failed to save playlist');
    } finally {
      setIsSaving(false);
    }
  }, [editingPlaylistId, editorPlaylistName, editorPlaylistTracks, editorPlaylistShuffle, isSaving, loadSavedPlaylists, closePlaylistEditor, showSuccess, showError]);

  // Add saved playlist to setlist
  const handleAddPlaylistToSetlist = useCallback((playlist: typeof savedPlaylists[0]) => {
    if (!onAddPlaylistToSetlist) return;

    onAddPlaylistToSetlist({
      tracks: playlist.tracks,
      shuffle: playlist.shuffle,
      name: playlist.name
    });
    setPlaylistMenuId(null);
  }, [onAddPlaylistToSetlist]);

  // Delete saved playlist
  const handleDeletePlaylist = useCallback(async (playlistId: string) => {
    // Find the playlist name for the confirmation message
    const playlist = savedPlaylists.find(p => p.id === playlistId);
    const playlistName = playlist?.name || 'this playlist';

    // Show confirmation dialog
    if (!window.confirm(`Are you sure you want to delete "${playlistName}"? This action cannot be undone.`)) {
      setPlaylistMenuId(null);
      return;
    }

    try {
      await window.electronAPI.deleteAudioPlaylist(playlistId);
      showSuccess('Playlist deleted');
      await loadSavedPlaylists();
      setPlaylistMenuId(null);
    } catch (error) {
      log.error('Failed to delete playlist:', error);
      showError('Failed to delete playlist');
    }
  }, [savedPlaylists, loadSavedPlaylists, showSuccess, showError]);

  // Show playlist context menu
  const showPlaylistMenu = useCallback((e: React.MouseEvent, playlistId: string) => {
    e.stopPropagation();
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setPlaylistMenuPosition({ top: rect.bottom + 4, left: rect.left });
    setPlaylistMenuId(playlistId);
  }, []);

  // Get audio files filtered by editor search
  const editorFilteredAudio = useMemo(() => {
    const audioFiles = importedMedia.filter(item => item.type === 'audio');
    if (!editorSearchQuery.trim()) return audioFiles;
    const query = editorSearchQuery.toLowerCase();
    return audioFiles.filter(item => item.name.toLowerCase().includes(query));
  }, [importedMedia, editorSearchQuery]);

  // Load folders, files, and imported media on mount
  useEffect(() => {
    loadFolders();
    loadImportedMedia();
    loadLibraryFolders();
    loadSavedPlaylists();
  }, [loadSavedPlaylists]);

  // Reset visible count when folder changes
  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE_ITEMS);
  }, [selectedFolder, selectedLibraryFolder]);

  // Debounce search query to prevent excessive filtering on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 200); // 200ms debounce delay
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Close context menu, folder dropdown, playlist menu, and three-dot menu on click outside
  useEffect(() => {
    const handleClick = () => {
      setContextMenu(null);
      setShowFolderDropdown(false);
      setOpenMenuId(null);
      setMenuPosition(null);
      setPlaylistMenuId(null);
      setPlaylistMenuPosition(null);
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const loadFolders = async () => {
    try {
      const mediaFolders = await window.electronAPI.getMediaFolders();
      setFolders(mediaFolders);

      // Load all files
      const allFiles = await window.electronAPI.getMediaFiles();
      setFiles(allFiles);
    } catch (err) {
      log.error('Failed to load media folders:', err);
      showError('Failed to load media folders');
    }
  };

  const loadImportedMedia = async () => {
    try {
      const items = await window.electronAPI.getMediaLibrary();
      setImportedMedia(items);
    } catch (err) {
      log.error('Failed to load imported media:', err);
      showError('Failed to load media library');
    }
  };

  const loadLibraryFolders = async () => {
    try {
      const folders = await window.electronAPI.getMediaFoldersLib();
      setLibraryFolders(folders);
    } catch (err) {
      log.error('Failed to load library folders:', err);
      showError('Failed to load folders');
    }
  };

  const handleImportMedia = async () => {
    setImporting(true);
    try {
      const result = await window.electronAPI.importMedia();
      log.debug('Import result:', result);
      if (result.success && result.imported.length > 0) {
        await loadImportedMedia();
      } else if (result.errors && result.errors.length > 0) {
        // Show the first error to the user
        log.error('Import errors:', result.errors);
        showError(result.errors[0]);
      } else if (result.success && result.imported.length === 0) {
        // File was selected but nothing imported (likely already exists or was filtered)
        log.warn('No files imported - may already exist in library');
      }
    } catch (err) {
      log.error('Failed to import media:', err);
      showError('Failed to import media');
    }
    setImporting(false);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await window.electronAPI.createMediaFolderLib(newFolderName.trim());
      await loadLibraryFolders();
      setNewFolderName('');
      setShowNewFolderInput(false);
    } catch (err) {
      log.error('Failed to create folder:', err);
      showError('Failed to create folder');
    }
  };

  const handleDeleteFolder = async (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await window.electronAPI.deleteMediaFolderLib(folderId);
      await loadLibraryFolders();
      await loadImportedMedia(); // Reload to update folderId references
      if (selectedLibraryFolder === folderId) {
        setSelectedLibraryFolder(null);
      }
    } catch (err) {
      log.error('Failed to delete folder:', err);
      showError('Failed to delete folder');
    }
  };

  const handleMoveToFolder = async (mediaId: string, folderId: string | null) => {
    try {
      await window.electronAPI.moveMediaToFolder(mediaId, folderId);
      await loadImportedMedia();
      setContextMenu(null);
    } catch (err) {
      log.error('Failed to move media:', err);
      showError('Failed to move media');
    }
  };

  const handleContextMenu = (e: React.MouseEvent, mediaId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, mediaId });
  };

  const handleStartRename = (item: ImportedMediaItem) => {
    setRenamingMediaId(item.id);
    setRenameValue(item.name);
    setContextMenu(null);
  };

  const handleRename = async () => {
    if (!renamingMediaId || !renameValue.trim()) {
      setRenamingMediaId(null);
      setRenameValue('');
      return;
    }
    try {
      await window.electronAPI.renameMediaItem(renamingMediaId, renameValue.trim());
      await loadImportedMedia();
    } catch (err) {
      log.error('Failed to rename media:', err);
      showError('Failed to rename media');
    }
    setRenamingMediaId(null);
    setRenameValue('');
  };

  // Drag handlers for media items
  const handleDragStart = (e: React.DragEvent, item: ImportedMediaItem) => {
    setDraggedMediaId(item.id);
    e.dataTransfer.effectAllowed = 'copyMove';
    // Store media info in dataTransfer for setlist drop
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: item.type,
      path: item.processedPath,
      name: item.name,
      duration: item.duration,
      thumbnailPath: item.thumbnailPath
    }));
    e.dataTransfer.setData('text/plain', item.name);
  };

  const handleDragEnd = () => {
    setDraggedMediaId(null);
    setDropTargetFolderId(null);
  };

  const handleFolderDragOver = (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTargetFolderId(folderId);
  };

  const handleFolderDrop = async (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    if (draggedMediaId) {
      await handleMoveToFolder(draggedMediaId, folderId);
    }
    setDraggedMediaId(null);
    setDropTargetFolderId(null);
  };

  const handleFolderDragLeave = () => {
    setDropTargetFolderId(null);
  };

  const handleDeleteImported = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await window.electronAPI.deleteMediaLibraryItem(id);
      await loadImportedMedia();
    } catch (err) {
      log.error('Failed to delete imported media:', err);
      showError('Failed to delete media');
    }
  };

  const handleSelectImported = useCallback((item: ImportedMediaItem) => {
    // Use the processed path for instant playback
    if (item.type === 'image' && onSelectImage) {
      onSelectImage(item.processedPath);
    } else if (item.type === 'video' && onSelectVideo) {
      onSelectVideo(item.processedPath);
    } else if (item.type === 'audio' && onSelectAudio) {
      onSelectAudio(item.processedPath, item.name);
    }
  }, [onSelectImage, onSelectVideo, onSelectAudio]);

  // Filter imported media by selected type, folder, and search query
  const filteredMedia = useMemo(() => {
    let filtered = importedMedia;
    // Filter by media type if one is selected
    if (selectedMediaType !== null) {
      filtered = filtered.filter(item => item.type === selectedMediaType);
    }
    if (selectedLibraryFolder !== null) {
      filtered = filtered.filter(item => item.folderId === selectedLibraryFolder);
    }
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase().trim();
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(query) ||
        (item.tags && item.tags.toLowerCase().includes(query))
      );
    }
    return filtered;
  }, [importedMedia, selectedMediaType, selectedLibraryFolder, debouncedSearchQuery]);

  // Count media by type
  const mediaTypeCounts = useMemo(() => ({
    image: importedMedia.filter(m => m.type === 'image').length,
    video: importedMedia.filter(m => m.type === 'video').length,
    audio: importedMedia.filter(m => m.type === 'audio').length
  }), [importedMedia]);

  // Categorized media for unfiltered view (3 items per type)
  const categorizedMedia = useMemo(() => {
    // Apply folder and search filters but not type filter
    let filtered = importedMedia;
    if (selectedLibraryFolder !== null) {
      filtered = filtered.filter(item => item.folderId === selectedLibraryFolder);
    }
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase().trim();
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(query) ||
        (item.tags && item.tags.toLowerCase().includes(query))
      );
    }
    return {
      images: filtered.filter(m => m.type === 'image'),
      videos: filtered.filter(m => m.type === 'video'),
      audio: filtered.filter(m => m.type === 'audio')
    };
  }, [importedMedia, selectedLibraryFolder, debouncedSearchQuery]);

  const handleAddFolder = async () => {
    setLoading(true);
    try {
      const folder = await window.electronAPI.addMediaFolder();
      if (folder) {
        await loadFolders();
      }
    } catch (err) {
      log.error('Failed to add folder:', err);
      showError('Failed to add folder');
    }
    setLoading(false);
  };

  const handleRemoveFolder = async (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await window.electronAPI.removeMediaFolder(folderId);
      if (selectedFolder?.id === folderId) {
        setSelectedFolder(null);
      }
      await loadFolders();
    } catch (err) {
      log.error('Failed to remove folder:', err);
      showError('Failed to remove folder');
    }
  };

  const handleRescanFolder = async (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await window.electronAPI.rescanMediaFolder(folderId);
      await loadFolders();
    } catch (err) {
      log.error('Failed to rescan folder:', err);
      showError('Failed to rescan folder');
    }
  };

  const handleSelectFile = useCallback((file: MediaFile) => {
    if (file.type === 'image' && onSelectImage) {
      onSelectImage(file.path);
    } else if (file.type === 'video' && onSelectVideo) {
      onSelectVideo(file.path);
    }
  }, [onSelectImage, onSelectVideo]);

  const getFilesForFolder = (folderId: string) => {
    return files.filter(f => f.folderId === folderId);
  };

  const loadMore = () => {
    setVisibleCount(prev => prev + LOAD_MORE_COUNT);
  };

  // Folder Detail View
  if (selectedFolder) {
    const folderFiles = getFilesForFolder(selectedFolder.id);
    const visibleFiles = folderFiles.slice(0, visibleCount);
    const hasMore = folderFiles.length > visibleCount;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '8px' }}>
        {/* Header with back button and folder name */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 8px',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '6px'
        }}>
          <button
            onClick={() => setSelectedFolder(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px',
              background: 'rgba(6, 182, 212, 0.2)',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              color: '#06b6d4'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <span style={{
            flex: 1,
            fontSize: '12px',
            fontWeight: 600,
            color: 'rgba(255,255,255,0.9)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {selectedFolder.name}
          </span>
          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>
            {folderFiles.length} files
          </span>
        </div>

        {/* Image Grid */}
        {folderFiles.length > 0 ? (
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
            <div style={folderGridStyle}>
              {visibleFiles.map(file => {
                const isVideo = file.type === 'video';
                // Properly encode the file path for URL
                // Use triple-slash format for cross-window compatibility
                const encodedPath = file.path
                  .replace(/\\/g, '/')
                  .split('/')
                  .map(segment => encodeURIComponent(segment))
                  .join('/');
                const fileUrl = `media://file/${encodedPath}`;

                return (
                  <div
                    key={file.id}
                    onClick={() => handleSelectFile(file)}
                    title={file.name}
                    style={{
                      aspectRatio: '1',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      border: '2px solid transparent',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'rgba(0,0,0,0.4)',
                      overflow: 'hidden',
                      position: 'relative'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.border = '2px solid rgba(6, 182, 212, 0.6)';
                      e.currentTarget.style.transform = 'scale(1.02)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.border = '2px solid transparent';
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                  >
                    {!isVideo ? (
                      <img
                        src={fileUrl}
                        alt={file.name}
                        loading="lazy"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          if (target.parentElement) {
                            target.parentElement.innerHTML = `
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                <circle cx="8.5" cy="8.5" r="1.5"/>
                                <polyline points="21 15 16 10 5 21"/>
                              </svg>
                            `;
                          }
                        }}
                      />
                    ) : (
                      <MediaErrorBoundary>
                        <VideoThumbnail filePath={file.path} fileName={file.name} timeoutMs={thumbnailTimeoutMs} />
                      </MediaErrorBoundary>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Load More Button */}
            {hasMore && (
              <button
                onClick={loadMore}
                style={{
                  width: '100%',
                  marginTop: '8px',
                  padding: '10px',
                  background: 'rgba(6, 182, 212, 0.15)',
                  border: '1px solid rgba(6, 182, 212, 0.3)',
                  borderRadius: '6px',
                  color: '#06b6d4',
                  fontSize: '11px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                Load more ({folderFiles.length - visibleCount} remaining)
              </button>
            )}
          </div>
        ) : (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255,255,255,0.4)',
            fontSize: '12px'
          }}>
            No media files in this folder
          </div>
        )}
      </div>
    );
  }

  // Folder List View
  const imageCount = files.filter(f => f.type === 'image').length;
  const videoCount = files.filter(f => f.type === 'video').length;
  const importedImageCount = importedMedia.filter(m => m.type === 'image').length;
  const importedVideoCount = importedMedia.filter(m => m.type === 'video').length;

  // Format duration as mm:ss
  const formatDuration = (seconds: number | null): string => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', height: '100%', overflow: 'auto' }}>
      {/* Search Input + Import Button Row */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <input
            type="text"
            placeholder="Search by name or tag..."
            value={searchQuery}
            aria-label="Search media by name or tag"
            onChange={(e) => {
              const value = e.target.value;
              setSearchQuery(value);
              // Clear type filter when searching so results include all media types
              if (value.trim()) {
                setSelectedMediaType(null);
              }
            }}
            style={{
              width: '100%',
              padding: '8px 12px 8px 32px',
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '6px',
              color: 'white',
              fontSize: '11px',
              outline: 'none'
            }}
          />
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(255,255,255,0.4)"
            strokeWidth="2"
            style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)'
            }}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '2px'
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Import Media Button - Icon only */}
        <button
          onClick={handleImportMedia}
          disabled={importing}
          title={importing ? 'Importing...' : 'Import Media'}
          aria-label={importing ? 'Importing media...' : 'Import media files'}
          aria-busy={importing}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px',
            background: importing ? 'rgba(6, 182, 212, 0.1)' : 'rgba(6, 182, 212, 0.2)',
            border: '1px solid rgba(6, 182, 212, 0.5)',
            borderRadius: '6px',
            color: '#06b6d4',
            cursor: importing ? 'wait' : 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          {importing ? (
            <div style={{
              width: '18px',
              height: '18px',
              border: '2px solid rgba(6, 182, 212, 0.3)',
              borderTopColor: '#06b6d4',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
            </svg>
          )}
        </button>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>

      {/* Media Type Filter Tabs */}
      <div style={{
        display: 'flex',
        gap: '2px',
        background: 'rgba(0,0,0,0.3)',
        padding: '2px',
        borderRadius: '4px'
      }}>
        {/* Images Filter */}
        <button
          onClick={() => setSelectedMediaType(selectedMediaType === 'image' ? null : 'image')}
          title={`Images (${mediaTypeCounts.image}) - Click to ${selectedMediaType === 'image' ? 'show all' : 'filter'}`}
          aria-label={`Filter by images (${mediaTypeCounts.image} items)`}
          aria-pressed={selectedMediaType === 'image'}
          style={{
            flex: 1,
            padding: '4px',
            background: selectedMediaType === 'image' ? 'rgba(76, 175, 80, 0.3)' : 'transparent',
            border: selectedMediaType === 'image' ? '1px solid rgba(76, 175, 80, 0.6)' : '1px solid transparent',
            borderRadius: '3px',
            color: selectedMediaType === 'image' ? '#4CAF50' : 'rgba(255,255,255,0.5)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease'
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        </button>

        {/* Videos Filter */}
        <button
          onClick={() => setSelectedMediaType(selectedMediaType === 'video' ? null : 'video')}
          title={`Videos (${mediaTypeCounts.video}) - Click to ${selectedMediaType === 'video' ? 'show all' : 'filter'}`}
          aria-label={`Filter by videos (${mediaTypeCounts.video} items)`}
          aria-pressed={selectedMediaType === 'video'}
          style={{
            flex: 1,
            padding: '4px',
            background: selectedMediaType === 'video' ? 'rgba(6, 182, 212, 0.3)' : 'transparent',
            border: selectedMediaType === 'video' ? '1px solid rgba(6, 182, 212, 0.6)' : '1px solid transparent',
            borderRadius: '3px',
            color: selectedMediaType === 'video' ? '#06b6d4' : 'rgba(255,255,255,0.5)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease'
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        </button>

        {/* Audio Filter */}
        <button
          onClick={() => setSelectedMediaType(selectedMediaType === 'audio' ? null : 'audio')}
          title={`Audio (${mediaTypeCounts.audio}) - Click to ${selectedMediaType === 'audio' ? 'show all' : 'filter'}`}
          aria-label={`Filter by audio (${mediaTypeCounts.audio} items)`}
          aria-pressed={selectedMediaType === 'audio'}
          style={{
            flex: 1,
            padding: '4px',
            background: selectedMediaType === 'audio' ? 'rgba(156, 39, 176, 0.3)' : 'transparent',
            border: selectedMediaType === 'audio' ? '1px solid rgba(156, 39, 176, 0.6)' : '1px solid transparent',
            borderRadius: '3px',
            color: selectedMediaType === 'audio' ? '#9C27B0' : 'rgba(255,255,255,0.5)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease'
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        </button>

        {/* Playlists Tab */}
        <button
          onClick={() => setSelectedMediaType(selectedMediaType === 'playlist' ? null : 'playlist')}
          title={`Playlists (${savedPlaylists.length})`}
          aria-label={`View playlists (${savedPlaylists.length} playlists)`}
          aria-pressed={selectedMediaType === 'playlist'}
          style={{
            flex: 1,
            padding: '4px',
            background: selectedMediaType === 'playlist' ? 'rgba(255, 152, 0, 0.3)' : 'transparent',
            border: selectedMediaType === 'playlist' ? '1px solid rgba(255, 152, 0, 0.6)' : '1px solid transparent',
            borderRadius: '3px',
            color: selectedMediaType === 'playlist' ? '#FF9800' : 'rgba(255,255,255,0.5)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease'
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <circle cx="4" cy="6" r="2" />
            <circle cx="4" cy="12" r="2" />
            <circle cx="4" cy="18" r="2" />
          </svg>
        </button>

        {/* Folder Filter */}
        <div style={{ position: 'relative', flex: 1 }}>
          <button
            ref={folderButtonRef}
            onClick={(e) => {
              e.stopPropagation();
              setShowFolderDropdown(!showFolderDropdown);
            }}
            title={selectedLibraryFolder ? `Folder: ${libraryFolders.find(f => f.id === selectedLibraryFolder)?.name}` : 'Filter by folder'}
            style={{
              width: '100%',
              padding: '4px',
              background: selectedLibraryFolder ? 'rgba(255, 193, 7, 0.3)' : 'transparent',
              border: selectedLibraryFolder ? '1px solid rgba(255, 193, 7, 0.6)' : '1px solid transparent',
              borderRadius: '3px',
              color: selectedLibraryFolder ? '#FFC107' : 'rgba(255,255,255,0.5)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease'
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
          </button>

          {/* Folder Dropdown - Fixed position to avoid clipping */}
          {showFolderDropdown && folderButtonRef.current && (() => {
            const rect = folderButtonRef.current.getBoundingClientRect();
            return (
              <div
                style={{
                  position: 'fixed',
                  top: rect.bottom + 4,
                  left: rect.left,
                  background: 'rgba(30, 30, 35, 0.98)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '6px',
                  padding: '4px',
                  zIndex: 9999,
                  minWidth: '160px',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
                }}
                onClick={(e) => e.stopPropagation()}
              >
              {/* All (no folder filter) */}
              <button
                onClick={() => {
                  setSelectedLibraryFolder(null);
                  setShowFolderDropdown(false);
                }}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  background: selectedLibraryFolder === null ? 'rgba(255, 193, 7, 0.2)' : 'transparent',
                  border: 'none',
                  borderRadius: '4px',
                  color: selectedLibraryFolder === null ? '#FFC107' : 'rgba(255,255,255,0.8)',
                  fontSize: '11px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                </svg>
                All Media
              </button>

              {libraryFolders.length > 0 && (
                <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />
              )}

              {/* Folder list */}
              {libraryFolders.map(folder => (
                <button
                  key={folder.id}
                  onClick={() => {
                    setSelectedLibraryFolder(folder.id);
                    setShowFolderDropdown(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    background: selectedLibraryFolder === folder.id ? 'rgba(255, 193, 7, 0.2)' : 'transparent',
                    border: 'none',
                    borderRadius: '4px',
                    color: selectedLibraryFolder === folder.id ? '#FFC107' : 'rgba(255,255,255,0.8)',
                    fontSize: '11px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                  {folder.name}
                </button>
              ))}

              {libraryFolders.length === 0 && (
                <div style={{ padding: '8px', fontSize: '10px', color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
                  No folders yet
                </div>
              )}

              <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />

              {/* Create new folder */}
              {showNewFolderInput ? (
                <div style={{ padding: '4px', display: 'flex', gap: '4px' }}>
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleCreateFolder();
                        setShowFolderDropdown(false);
                      }
                      if (e.key === 'Escape') setShowNewFolderInput(false);
                    }}
                    placeholder="Folder name"
                    autoFocus
                    style={{
                      flex: 1,
                      padding: '4px 6px',
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255, 193, 7, 0.5)',
                      borderRadius: '3px',
                      color: 'white',
                      fontSize: '10px',
                      outline: 'none'
                    }}
                  />
                  <button
                    onClick={() => {
                      handleCreateFolder();
                      setShowFolderDropdown(false);
                    }}
                    style={{
                      padding: '4px 8px',
                      background: 'rgba(255, 193, 7, 0.3)',
                      border: 'none',
                      borderRadius: '3px',
                      color: '#FFC107',
                      fontSize: '10px',
                      cursor: 'pointer'
                    }}
                  >
                    Add
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewFolderInput(true)}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '4px',
                    color: 'rgba(255,255,255,0.5)',
                    fontSize: '11px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  New Folder
                </button>
              )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Folder Tabs - Hidden for now */}
      {false && (importedMedia.length > 0 || libraryFolders.length > 0) && (
        <div style={{ marginTop: '4px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            flexWrap: 'wrap',
            marginBottom: '8px'
          }}>
            {/* All tab - drop target to remove from folder */}
            <button
              onClick={() => setSelectedLibraryFolder(null)}
              onDragOver={(e) => handleFolderDragOver(e, null)}
              onDrop={(e) => handleFolderDrop(e, null)}
              onDragLeave={handleFolderDragLeave}
              style={{
                padding: '6px 12px',
                background: dropTargetFolderId === null && draggedMediaId
                  ? 'rgba(0, 200, 255, 0.3)'
                  : selectedLibraryFolder === null ? 'rgba(6, 182, 212, 0.3)' : 'rgba(255,255,255,0.05)',
                border: dropTargetFolderId === null && draggedMediaId
                  ? '2px solid rgba(0, 200, 255, 0.7)'
                  : selectedLibraryFolder === null ? '1px solid rgba(6, 182, 212, 0.5)' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: '6px',
                color: selectedLibraryFolder === null ? '#06b6d4' : 'rgba(255,255,255,0.7)',
                fontSize: '11px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              All ({importedMedia.filter(m => m.type === selectedMediaType).length})
            </button>
            {/* Folder tabs - drop targets */}
            {libraryFolders.map(folder => {
              const count = importedMedia.filter(m => m.folderId === folder.id && m.type === selectedMediaType).length;
              const isSelected = selectedLibraryFolder === folder.id;
              const isDropTarget = dropTargetFolderId === folder.id && draggedMediaId;
              return (
                <div
                  key={folder.id}
                  style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
                  onDragOver={(e) => handleFolderDragOver(e, folder.id)}
                  onDrop={(e) => handleFolderDrop(e, folder.id)}
                  onDragLeave={handleFolderDragLeave}
                >
                  <button
                    onClick={() => setSelectedLibraryFolder(folder.id)}
                    style={{
                      padding: '6px 12px',
                      paddingRight: '28px',
                      background: isDropTarget
                        ? 'rgba(0, 200, 255, 0.3)'
                        : isSelected ? 'rgba(6, 182, 212, 0.3)' : 'rgba(255,255,255,0.05)',
                      border: isDropTarget
                        ? '2px solid rgba(0, 200, 255, 0.7)'
                        : isSelected ? '1px solid rgba(6, 182, 212, 0.5)' : '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '6px',
                      color: isSelected ? '#06b6d4' : 'rgba(255,255,255,0.7)',
                      fontSize: '11px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {folder.name} ({count})
                  </button>
                  <button
                    onClick={(e) => handleDeleteFolder(folder.id, e)}
                    style={{
                      position: 'absolute',
                      right: '4px',
                      padding: '2px',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      opacity: 0.5
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.5'; }}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,100,100,0.9)" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              );
            })}
            {/* New folder button/input */}
            {showNewFolderInput ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setShowNewFolderInput(false); }}
                  placeholder="Folder name"
                  autoFocus
                  style={{
                    padding: '5px 8px',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(6, 182, 212, 0.5)',
                    borderRadius: '4px',
                    color: 'white',
                    fontSize: '11px',
                    width: '100px',
                    outline: 'none'
                  }}
                />
                <button onClick={handleCreateFolder} style={{ padding: '4px 8px', background: 'rgba(6, 182, 212, 0.3)', border: 'none', borderRadius: '4px', color: '#06b6d4', fontSize: '10px', cursor: 'pointer' }}>
                  Add
                </button>
                <button onClick={() => setShowNewFolderInput(false)} style={{ padding: '4px 8px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '4px', color: 'rgba(255,255,255,0.6)', fontSize: '10px', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowNewFolderInput(true)}
                style={{
                  padding: '6px 10px',
                  background: 'transparent',
                  border: '1px dashed rgba(255,255,255,0.2)',
                  borderRadius: '6px',
                  color: 'rgba(255,255,255,0.5)',
                  fontSize: '11px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                New Folder
              </button>
            )}
          </div>
        </div>
      )}

      {/* Playlists View - shows when playlist filter is selected */}
      {selectedMediaType === 'playlist' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Create Playlist Button */}
          <button
            onClick={openNewPlaylistEditor}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '12px',
              background: 'rgba(255, 152, 0, 0.15)',
              border: '1px dashed rgba(255, 152, 0, 0.5)',
              borderRadius: '8px',
              color: '#FF9800',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Create New Playlist
          </button>

          {/* Saved Playlists List */}
          {savedPlaylists.length === 0 ? (
            <div style={{
              padding: '32px 16px',
              textAlign: 'center',
              color: 'rgba(255,255,255,0.4)',
              fontSize: '12px'
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: '8px', opacity: 0.5 }}>
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <circle cx="4" cy="6" r="2" />
                <circle cx="4" cy="12" r="2" />
                <circle cx="4" cy="18" r="2" />
              </svg>
              <div>No playlists yet</div>
              <div style={{ fontSize: '11px', marginTop: '4px' }}>Create a playlist to organize your audio files</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {savedPlaylists.map(playlist => (
                <div
                  key={playlist.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 12px',
                    background: 'rgba(255, 152, 0, 0.08)',
                    border: '1px solid rgba(255, 152, 0, 0.15)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onDoubleClick={() => handleAddPlaylistToSetlist(playlist)}
                  title="Double-click to add to setlist"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF9800" strokeWidth="2">
                    <line x1="8" y1="6" x2="21" y2="6" />
                    <line x1="8" y1="12" x2="21" y2="12" />
                    <line x1="8" y1="18" x2="21" y2="18" />
                    <circle cx="4" cy="6" r="2" fill="#FF9800" />
                    <circle cx="4" cy="12" r="2" fill="#FF9800" />
                    <circle cx="4" cy="18" r="2" fill="#FF9800" />
                  </svg>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '12px',
                      color: 'white',
                      fontWeight: 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {playlist.name}
                    </div>
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>
                      {playlist.tracks.length} track{playlist.tracks.length !== 1 ? 's' : ''}
                      {playlist.shuffle && ' • Shuffle'}
                    </div>
                  </div>
                  {/* Menu button */}
                  <button
                    onClick={(e) => showPlaylistMenu(e, playlist.id)}
                    style={{
                      padding: '4px',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '4px',
                      color: 'rgba(255,255,255,0.5)',
                      cursor: 'pointer'
                    }}
                    title="More options"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="12" cy="5" r="2" />
                      <circle cx="12" cy="12" r="2" />
                      <circle cx="12" cy="19" r="2" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Playlist Context Menu */}
          {playlistMenuId && playlistMenuPosition && (
            <div
              style={{
                position: 'fixed',
                top: playlistMenuPosition.top,
                left: playlistMenuPosition.left,
                background: 'rgba(30, 30, 35, 0.98)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '6px',
                padding: '4px',
                zIndex: 9999,
                minWidth: '140px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => {
                  const playlist = savedPlaylists.find(p => p.id === playlistMenuId);
                  if (playlist) handleAddPlaylistToSetlist(playlist);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '8px 10px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'white',
                  fontSize: '11px',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Add to Setlist
              </button>
              <button
                onClick={() => {
                  const playlist = savedPlaylists.find(p => p.id === playlistMenuId);
                  if (playlist) openEditPlaylistEditor(playlist);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '8px 10px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'white',
                  fontSize: '11px',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Edit
              </button>
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />
              <button
                onClick={() => handleDeletePlaylist(playlistMenuId)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '8px 10px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#ef4444',
                  fontSize: '11px',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                Delete
              </button>
            </div>
          )}
        </div>
      )}

      {/* Categorized Media View - when no filter is selected */}
      {selectedMediaType === null && !debouncedSearchQuery.trim() && (categorizedMedia.images.length > 0 || categorizedMedia.videos.length > 0 || categorizedMedia.audio.length > 0 || savedPlaylists.length > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Images Section */}
          {categorizedMedia.images.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', padding: '0 4px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(76, 175, 80, 0.8)" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
                <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px', fontWeight: 600 }}>
                  Images ({categorizedMedia.images.length})
                </span>
              </div>
              <div style={listContainerStyle}>
                {categorizedMedia.images.slice(0, 3).map(item => {
                  const encodedPath = item.processedPath.replace(/\\/g, '/').split('/').map(segment => encodeURIComponent(segment)).join('/');
                  const mediaUrl = `media://file/${encodedPath}`;
                  return (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, item)}
                      onDragEnd={handleDragEnd}
                      onClick={() => setSelectedMediaId(selectedMediaId === item.id ? null : item.id)}
                      onDoubleClick={() => onAddToSetlist && onAddToSetlist({ type: item.type, path: item.processedPath, name: item.name, duration: item.duration, thumbnailPath: item.thumbnailPath })}
                      onContextMenu={(e) => handleContextMenu(e, item.id)}
                      onMouseEnter={() => { if (!draggedMediaId) setHoveredMediaId(item.id); }}
                      onMouseLeave={() => { if (!draggedMediaId) setHoveredMediaId(null); }}
                      title={`${item.name}\nClick to select • Double-click to add to setlist`}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 8px', borderRadius: '6px',
                        cursor: 'pointer',
                        background: selectedMediaId === item.id ? 'rgba(6, 182, 212, 0.15)' : hoveredMediaId === item.id ? 'rgba(255,255,255,0.08)' : 'transparent',
                        borderLeft: '3px solid rgba(76, 175, 80, 0.6)', transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ width: '48px', height: '36px', borderRadius: '4px', overflow: 'hidden', flexShrink: 0, backgroundColor: 'rgba(0,0,0,0.4)' }}>
                        <img src={item.thumbnailPath ? `media://file/${item.thumbnailPath.replace(/\\/g, '/').split('/').map(s => encodeURIComponent(s)).join('/')}` : mediaUrl} alt={item.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                        <div style={{ color: 'white', fontSize: '11px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                      </div>
                      {/* Display button on hover/select */}
                      {(selectedMediaId === item.id || hoveredMediaId === item.id) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleSelectImported(item); }}
                          style={{
                            padding: '4px 10px', borderRadius: '4px', border: 'none',
                            background: 'rgba(76, 175, 80, 0.9)', color: 'white', cursor: 'pointer',
                            fontSize: '0.7rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap'
                          }}
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                          </svg>
                          {t('media.display')}
                        </button>
                      )}
                      {/* Menu button on hover */}
                      {(hoveredMediaId === item.id || openMenuId === item.id) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (openMenuId === item.id) { setOpenMenuId(null); setMenuPosition(null); }
                            else {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setMenuPosition({ top: rect.bottom + 4, left: rect.left, right: window.innerWidth - rect.right });
                              setOpenMenuId(item.id);
                            }
                          }}
                          style={{
                            padding: '4px 6px', borderRadius: '4px', border: 'none',
                            background: openMenuId === item.id ? 'rgba(255,255,255,0.15)' : 'transparent',
                            cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center'
                          }}
                        >
                          <span style={{ width: '3px', height: '3px', background: 'rgba(255,255,255,0.5)', borderRadius: '50%' }} />
                          <span style={{ width: '3px', height: '3px', background: 'rgba(255,255,255,0.5)', borderRadius: '50%' }} />
                          <span style={{ width: '3px', height: '3px', background: 'rgba(255,255,255,0.5)', borderRadius: '50%' }} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              {categorizedMedia.images.length > 3 && (
                <button
                  onClick={() => setSelectedMediaType('image')}
                  style={{
                    width: '100%',
                    marginTop: '8px',
                    background: 'rgba(76, 175, 80, 0.1)',
                    border: '1px solid rgba(76, 175, 80, 0.25)',
                    borderRadius: '4px',
                    padding: '6px 10px',
                    color: 'rgba(76, 175, 80, 0.9)',
                    fontSize: '11px',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  Show all {categorizedMedia.images.length} images
                </button>
              )}
            </div>
          )}

          {/* Videos Section */}
          {categorizedMedia.videos.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', padding: '0 4px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(6, 182, 212, 0.8)" strokeWidth="2">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px', fontWeight: 600 }}>
                  Videos ({categorizedMedia.videos.length})
                </span>
              </div>
              <div style={listContainerStyle}>
                {categorizedMedia.videos.slice(0, 3).map(item => {
                  const encodedPath = item.processedPath.replace(/\\/g, '/').split('/').map(segment => encodeURIComponent(segment)).join('/');
                  const mediaUrl = `media://file/${encodedPath}`;
                  return (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, item)}
                      onDragEnd={handleDragEnd}
                      onClick={() => setSelectedMediaId(selectedMediaId === item.id ? null : item.id)}
                      onDoubleClick={() => onAddToSetlist && onAddToSetlist({ type: item.type, path: item.processedPath, name: item.name, duration: item.duration, thumbnailPath: item.thumbnailPath })}
                      onContextMenu={(e) => handleContextMenu(e, item.id)}
                      onMouseEnter={() => { if (!draggedMediaId) setHoveredMediaId(item.id); }}
                      onMouseLeave={() => { if (!draggedMediaId) setHoveredMediaId(null); }}
                      title={`${item.name}\nClick to select • Double-click to add to setlist`}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 8px', borderRadius: '6px',
                        cursor: 'pointer',
                        background: selectedMediaId === item.id ? 'rgba(6, 182, 212, 0.15)' : hoveredMediaId === item.id ? 'rgba(255,255,255,0.08)' : 'transparent',
                        borderLeft: '3px solid rgba(6, 182, 212, 0.6)', transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ width: '48px', height: '36px', borderRadius: '4px', overflow: 'hidden', flexShrink: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {item.thumbnailPath ? (
                          <img src={`media://file/${item.thumbnailPath.replace(/\\/g, '/').split('/').map(s => encodeURIComponent(s)).join('/')}`} alt={item.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(6, 182, 212, 0.7)" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                        <div style={{ color: 'white', fontSize: '11px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                        {item.duration && <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px' }}>{formatDuration(item.duration)}</div>}
                      </div>
                      {/* Play button on hover/select */}
                      {(selectedMediaId === item.id || hoveredMediaId === item.id) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleSelectImported(item); }}
                          style={{
                            padding: '4px 10px', borderRadius: '4px', border: 'none',
                            background: 'rgba(6, 182, 212, 0.9)', color: 'white', cursor: 'pointer',
                            fontSize: '0.7rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap'
                          }}
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                            <polygon points="5 3 19 12 5 21 5 3" />
                          </svg>
                          {t('common.play')}
                        </button>
                      )}
                      {/* Menu button on hover */}
                      {(hoveredMediaId === item.id || openMenuId === item.id) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (openMenuId === item.id) { setOpenMenuId(null); setMenuPosition(null); }
                            else {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setMenuPosition({ top: rect.bottom + 4, left: rect.left, right: window.innerWidth - rect.right });
                              setOpenMenuId(item.id);
                            }
                          }}
                          style={{
                            padding: '4px 6px', borderRadius: '4px', border: 'none',
                            background: openMenuId === item.id ? 'rgba(255,255,255,0.15)' : 'transparent',
                            cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center'
                          }}
                        >
                          <span style={{ width: '3px', height: '3px', background: 'rgba(255,255,255,0.5)', borderRadius: '50%' }} />
                          <span style={{ width: '3px', height: '3px', background: 'rgba(255,255,255,0.5)', borderRadius: '50%' }} />
                          <span style={{ width: '3px', height: '3px', background: 'rgba(255,255,255,0.5)', borderRadius: '50%' }} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              {categorizedMedia.videos.length > 3 && (
                <button
                  onClick={() => setSelectedMediaType('video')}
                  style={{
                    width: '100%',
                    marginTop: '8px',
                    background: 'rgba(6, 182, 212, 0.1)',
                    border: '1px solid rgba(6, 182, 212, 0.25)',
                    borderRadius: '4px',
                    padding: '6px 10px',
                    color: 'rgba(6, 182, 212, 0.9)',
                    fontSize: '11px',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  Show all {categorizedMedia.videos.length} videos
                </button>
              )}
            </div>
          )}

          {/* Audio Section */}
          {categorizedMedia.audio.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', padding: '0 4px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(156, 39, 176, 0.8)" strokeWidth="2">
                  <path d="M9 18V5l12-2v13"/>
                  <circle cx="6" cy="18" r="3"/>
                  <circle cx="18" cy="16" r="3"/>
                </svg>
                <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px', fontWeight: 600 }}>
                  Audio ({categorizedMedia.audio.length})
                </span>
              </div>
              <div style={listContainerStyle}>
                {categorizedMedia.audio.slice(0, 3).map(item => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, item)}
                    onDragEnd={handleDragEnd}
                    onClick={() => setSelectedMediaId(selectedMediaId === item.id ? null : item.id)}
                    onDoubleClick={() => onAddToSetlist && onAddToSetlist({ type: item.type, path: item.processedPath, name: item.name, duration: item.duration, thumbnailPath: item.thumbnailPath })}
                    onContextMenu={(e) => handleContextMenu(e, item.id)}
                    onMouseEnter={() => { if (!draggedMediaId) setHoveredMediaId(item.id); }}
                    onMouseLeave={() => { if (!draggedMediaId) setHoveredMediaId(null); }}
                    title={`${item.name}\nClick to select • Double-click to add to setlist`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 8px', borderRadius: '6px',
                      cursor: 'pointer',
                      background: selectedMediaId === item.id ? 'rgba(6, 182, 212, 0.15)' : hoveredMediaId === item.id ? 'rgba(255,255,255,0.08)' : 'transparent',
                      borderLeft: '3px solid rgba(156, 39, 176, 0.6)', transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ width: '48px', height: '36px', borderRadius: '4px', overflow: 'hidden', flexShrink: 0, backgroundColor: 'rgba(156, 39, 176, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(156, 39, 176, 0.8)" strokeWidth="2">
                        <path d="M9 18V5l12-2v13"/>
                        <circle cx="6" cy="18" r="3"/>
                        <circle cx="18" cy="16" r="3"/>
                      </svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                      <div style={{ color: 'white', fontSize: '11px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                      {item.duration && <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px' }}>{formatDuration(item.duration)}</div>}
                    </div>
                    {/* Play button on hover/select */}
                    {(selectedMediaId === item.id || hoveredMediaId === item.id) && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleSelectImported(item); }}
                        style={{
                          padding: '4px 10px', borderRadius: '4px', border: 'none',
                          background: 'rgba(156, 39, 176, 0.9)', color: 'white', cursor: 'pointer',
                          fontSize: '0.7rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap'
                        }}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                        {t('common.play')}
                      </button>
                    )}
                    {/* Menu button on hover */}
                    {(hoveredMediaId === item.id || openMenuId === item.id) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (openMenuId === item.id) { setOpenMenuId(null); setMenuPosition(null); }
                          else {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setMenuPosition({ top: rect.bottom + 4, left: rect.left, right: window.innerWidth - rect.right });
                            setOpenMenuId(item.id);
                          }
                        }}
                        style={{
                          padding: '4px 6px', borderRadius: '4px', border: 'none',
                          background: openMenuId === item.id ? 'rgba(255,255,255,0.15)' : 'transparent',
                          cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center'
                        }}
                      >
                        <span style={{ width: '3px', height: '3px', background: 'rgba(255,255,255,0.5)', borderRadius: '50%' }} />
                        <span style={{ width: '3px', height: '3px', background: 'rgba(255,255,255,0.5)', borderRadius: '50%' }} />
                        <span style={{ width: '3px', height: '3px', background: 'rgba(255,255,255,0.5)', borderRadius: '50%' }} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {categorizedMedia.audio.length > 3 && (
                <button
                  onClick={() => setSelectedMediaType('audio')}
                  style={{
                    width: '100%',
                    marginTop: '8px',
                    background: 'rgba(156, 39, 176, 0.1)',
                    border: '1px solid rgba(156, 39, 176, 0.25)',
                    borderRadius: '4px',
                    padding: '6px 10px',
                    color: 'rgba(156, 39, 176, 0.9)',
                    fontSize: '11px',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  Show all {categorizedMedia.audio.length} audio files
                </button>
              )}
            </div>
          )}

          {/* Playlists section in categorized view */}
          {savedPlaylists.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', padding: '0 4px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255, 152, 0, 0.8)" strokeWidth="2">
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <circle cx="4" cy="6" r="2" fill="rgba(255, 152, 0, 0.8)" />
                  <circle cx="4" cy="12" r="2" fill="rgba(255, 152, 0, 0.8)" />
                  <circle cx="4" cy="18" r="2" fill="rgba(255, 152, 0, 0.8)" />
                </svg>
                <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px', fontWeight: 600 }}>
                  Playlists ({savedPlaylists.length})
                </span>
              </div>
              <div style={listContainerStyle}>
                {savedPlaylists.slice(0, 3).map(playlist => (
                  <div
                    key={playlist.id}
                    onDoubleClick={() => handleAddPlaylistToSetlist(playlist)}
                    onMouseEnter={() => setHoveredMediaId(`playlist_${playlist.id}`)}
                    onMouseLeave={() => setHoveredMediaId(null)}
                    title={`${playlist.name}\n${playlist.tracks.length} track${playlist.tracks.length !== 1 ? 's' : ''}\nDouble-click to add to setlist`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 8px', borderRadius: '6px',
                      cursor: 'pointer',
                      background: hoveredMediaId === `playlist_${playlist.id}` ? 'rgba(255,255,255,0.08)' : 'transparent',
                      borderLeft: '3px solid rgba(255, 152, 0, 0.6)', transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ width: '48px', height: '36px', borderRadius: '4px', overflow: 'hidden', flexShrink: 0, backgroundColor: 'rgba(255, 152, 0, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255, 152, 0, 0.8)" strokeWidth="2">
                        <line x1="8" y1="6" x2="21" y2="6" />
                        <line x1="8" y1="12" x2="21" y2="12" />
                        <line x1="8" y1="18" x2="21" y2="18" />
                        <circle cx="4" cy="6" r="2" fill="rgba(255, 152, 0, 0.8)" />
                        <circle cx="4" cy="12" r="2" fill="rgba(255, 152, 0, 0.8)" />
                        <circle cx="4" cy="18" r="2" fill="rgba(255, 152, 0, 0.8)" />
                      </svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                      <div style={{ color: 'white', fontSize: '11px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{playlist.name}</div>
                      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px' }}>
                        {playlist.tracks.length} track{playlist.tracks.length !== 1 ? 's' : ''}
                        {playlist.shuffle && ' • Shuffle'}
                      </div>
                    </div>
                    {/* Add to Setlist button on hover */}
                    {hoveredMediaId === `playlist_${playlist.id}` && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleAddPlaylistToSetlist(playlist); }}
                        style={{
                          padding: '4px 10px', borderRadius: '4px', border: 'none',
                          background: 'rgba(255, 152, 0, 0.9)', color: 'white', cursor: 'pointer',
                          fontSize: '0.7rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap'
                        }}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                        Add
                      </button>
                    )}
                    {/* Menu button on hover */}
                    {(hoveredMediaId === `playlist_${playlist.id}` || playlistMenuId === playlist.id) && (
                      <button
                        onClick={(e) => { e.stopPropagation(); showPlaylistMenu(e, playlist.id); }}
                        style={{
                          padding: '4px 6px', borderRadius: '4px', border: 'none',
                          background: playlistMenuId === playlist.id ? 'rgba(255,255,255,0.15)' : 'transparent',
                          cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center'
                        }}
                      >
                        <span style={{ width: '3px', height: '3px', background: 'rgba(255,255,255,0.5)', borderRadius: '50%' }} />
                        <span style={{ width: '3px', height: '3px', background: 'rgba(255,255,255,0.5)', borderRadius: '50%' }} />
                        <span style={{ width: '3px', height: '3px', background: 'rgba(255,255,255,0.5)', borderRadius: '50%' }} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {savedPlaylists.length > 3 && (
                <button
                  onClick={() => setSelectedMediaType('playlist')}
                  style={{
                    width: '100%',
                    marginTop: '8px',
                    background: 'rgba(255, 152, 0, 0.1)',
                    border: '1px solid rgba(255, 152, 0, 0.25)',
                    borderRadius: '4px',
                    padding: '6px 10px',
                    color: 'rgba(255, 152, 0, 0.9)',
                    fontSize: '11px',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  Show all {savedPlaylists.length} playlists
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Imported Media List - when a filter is selected or searching */}
      {selectedMediaType !== 'playlist' && (selectedMediaType !== null || debouncedSearchQuery.trim()) && filteredMedia.length > 0 && (
        <div>
          <div style={listContainerStyle}>
            {filteredMedia.slice(0, visibleCount).map(item => {
              const isVideo = item.type === 'video';
              const isAudio = item.type === 'audio';
              const isImage = item.type === 'image';
              // Use processed path for media:// URL (triple-slash format)
              const encodedPath = item.processedPath
                .replace(/\\/g, '/')
                .split('/')
                .map(segment => encodeURIComponent(segment))
                .join('/');
              const mediaUrl = `media://file/${encodedPath}`;

              return (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, item)}
                  onDragEnd={handleDragEnd}
                  onClick={() => {
                    setSelectedMediaId(selectedMediaId === item.id ? null : item.id);
                  }}
                  onDoubleClick={() => {
                    if (onAddToSetlist) {
                      onAddToSetlist({
                        type: item.type,
                        path: item.processedPath,
                        name: item.name,
                        duration: item.duration,
                        thumbnailPath: item.thumbnailPath
                      });
                    }
                  }}
                  onContextMenu={(e) => handleContextMenu(e, item.id)}
                  title={`${item.name}\nClick to select • Double-click to add to setlist • Drag to setlist`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    cursor: draggedMediaId === item.id ? 'grabbing' : 'pointer',
                    background: selectedMediaId === item.id
                      ? 'rgba(6, 182, 212, 0.15)'
                      : hoveredMediaId === item.id
                        ? 'rgba(255,255,255,0.08)'
                        : 'transparent',
                    borderLeft: isVideo
                      ? '3px solid rgba(6, 182, 212, 0.6)'
                      : isAudio
                        ? '3px solid rgba(156, 39, 176, 0.6)'
                        : '3px solid rgba(76, 175, 80, 0.6)',
                    transition: 'all 0.15s ease',
                    opacity: draggedMediaId === item.id ? 0.6 : 1,
                    outline: selectedMediaId === item.id
                      ? '1px solid rgba(6, 182, 212, 0.4)'
                      : 'none'
                  }}
                  onMouseEnter={() => { if (!draggedMediaId) setHoveredMediaId(item.id); }}
                  onMouseLeave={() => { if (!draggedMediaId) setHoveredMediaId(null); }}
                >
                  {/* Thumbnail */}
                  <div style={{
                    width: '48px',
                    height: '36px',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    flexShrink: 0,
                    backgroundColor: isAudio ? 'rgba(156, 39, 176, 0.2)' : 'rgba(0,0,0,0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative'
                  }}>
                    {isImage ? (
                      // Use pre-generated thumbnail for images if available, otherwise use full image
                      <img
                        src={item.thumbnailPath ? `media://file/${item.thumbnailPath.replace(/\\/g, '/').split('/').map(s => encodeURIComponent(s)).join('/')}` : mediaUrl}
                        alt={item.name}
                        loading="lazy"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          if (target.parentElement) {
                            target.parentElement.innerHTML = `
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(76, 175, 80, 0.7)" stroke-width="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                <circle cx="8.5" cy="8.5" r="1.5"/>
                                <polyline points="21 15 16 10 5 21"/>
                              </svg>
                            `;
                          }
                        }}
                      />
                    ) : isVideo ? (
                      // Use pre-generated thumbnail for videos if available
                      item.thumbnailPath ? (
                        <>
                          <img
                            src={`media://file/${item.thumbnailPath.replace(/\\/g, '/').split('/').map(s => encodeURIComponent(s)).join('/')}`}
                            alt={item.name}
                            loading="lazy"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => {
                              // Show video placeholder icon when thumbnail fails to load
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              if (target.parentElement) {
                                // Add a centered video icon as fallback
                                const fallback = document.createElement('div');
                                fallback.style.cssText = 'display:flex;align-items:center;justify-content:center;width:100%;height:100%;';
                                fallback.innerHTML = `
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(6, 182, 212, 0.7)" stroke-width="2">
                                    <polygon points="5 3 19 12 5 21 5 3" />
                                  </svg>
                                `;
                                target.parentElement.insertBefore(fallback, target);
                              }
                            }}
                          />
                          {/* Play icon overlay for videos */}
                          <div style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: '18px',
                            height: '18px',
                            background: 'rgba(0,0,0,0.5)',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="white" stroke="none">
                              <polygon points="5 3 19 12 5 21 5 3" />
                            </svg>
                          </div>
                        </>
                      ) : (
                        // Fall back to dynamic thumbnail generation if no pre-generated one
                        <MediaErrorBoundary>
                          <VideoThumbnail filePath={item.processedPath} fileName={item.name} timeoutMs={thumbnailTimeoutMs} />
                        </MediaErrorBoundary>
                      )
                    ) : isAudio ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(156, 39, 176, 0.9)" strokeWidth="2">
                        <path d="M9 18V5l12-2v13" />
                        <circle cx="6" cy="18" r="3" />
                        <circle cx="18" cy="16" r="3" />
                      </svg>
                    ) : null}
                  </div>

                  {/* Name and duration */}
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{
                      fontSize: '0.8rem',
                      color: 'white',
                      whiteSpace: 'nowrap'
                    }}>
                      {item.name.length > 30 ? item.name.slice(0, 30) + '...' : item.name}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{
                        fontSize: '0.65rem',
                        color: isVideo ? 'rgba(6, 182, 212, 0.8)' : isAudio ? 'rgba(156, 39, 176, 0.8)' : 'rgba(76, 175, 80, 0.8)',
                        textTransform: 'uppercase',
                        fontWeight: 600
                      }}>
                        {item.type}
                      </span>
                      {item.duration && (
                        <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)' }}>
                          {formatDuration(item.duration)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Play/Display button */}
                  {(selectedMediaId === item.id || hoveredMediaId === item.id) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectImported(item);
                      }}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '4px',
                        border: 'none',
                        background: isVideo || isAudio ? 'rgba(6, 182, 212, 0.9)' : 'rgba(76, 175, 80, 0.9)',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {isVideo || isAudio ? (
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
                  )}

                  {/* Three-dot menu button */}
                  {(hoveredMediaId === item.id || openMenuId === item.id) && (
                    <div style={{ position: 'relative' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (openMenuId === item.id) {
                            setOpenMenuId(null); setMenuPosition(null);
                            setMenuPosition(null);
                          } else {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setMenuPosition({
                              top: rect.bottom + 4,
                              left: rect.left,
                              right: window.innerWidth - rect.right
                            });
                            setOpenMenuId(item.id);
                          }
                        }}
                        style={{
                          padding: '4px 6px',
                          borderRadius: '4px',
                          border: 'none',
                          background: openMenuId === item.id ? 'rgba(255,255,255,0.15)' : 'transparent',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px',
                          alignItems: 'center'
                        }}
                      >
                        <span style={{ width: '3px', height: '3px', background: 'rgba(255,255,255,0.5)', borderRadius: '50%' }} />
                        <span style={{ width: '3px', height: '3px', background: 'rgba(255,255,255,0.5)', borderRadius: '50%' }} />
                        <span style={{ width: '3px', height: '3px', background: 'rgba(255,255,255,0.5)', borderRadius: '50%' }} />
                      </button>
                      {openMenuId === item.id && menuPosition && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            position: 'fixed',
                            right: isRTL ? 'auto' : menuPosition.right,
                            left: isRTL ? menuPosition.left : 'auto',
                            top: menuPosition.top,
                            background: '#2a2a3e',
                            borderRadius: '6px',
                            border: '1px solid rgba(255,255,255,0.15)',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                            zIndex: 10000,
                            padding: '4px',
                            minWidth: '140px',
                            maxHeight: 'calc(100vh - 100px)',
                            overflowY: 'auto'
                          }}
                        >
                          {/* Add to Setlist */}
                          {onAddToSetlist && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuId(null); setMenuPosition(null);
                                onAddToSetlist({
                                  type: item.type,
                                  path: item.processedPath,
                                  name: item.name,
                                  duration: item.duration,
                                  thumbnailPath: item.thumbnailPath
                                });
                              }}
                              style={{
                                width: '100%',
                                padding: '6px 10px',
                                border: 'none',
                                background: 'transparent',
                                color: 'white',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                textAlign: isRTL ? 'right' : 'left',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                borderRadius: '4px'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                              </svg>
                              {t('controlPanel.addToSetlist')}
                            </button>
                          )}
                          {/* Rename */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(null); setMenuPosition(null);
                              handleStartRename(item);
                            }}
                            style={{
                              width: '100%',
                              padding: '6px 10px',
                              border: 'none',
                              background: 'transparent',
                              color: 'white',
                              cursor: 'pointer',
                              fontSize: '0.8rem',
                              textAlign: isRTL ? 'right' : 'left',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              borderRadius: '4px'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                            {t('common.rename')}
                          </button>
                          <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />
                          {/* Move to Folder submenu */}
                          <div style={{ padding: '4px 10px', fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase' }}>
                            {t('media.moveToFolder')}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(null); setMenuPosition(null);
                              handleMoveToFolder(item.id, null);
                            }}
                            style={{
                              width: '100%',
                              padding: '6px 10px',
                              border: 'none',
                              background: 'transparent',
                              color: 'rgba(255,255,255,0.7)',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              textAlign: isRTL ? 'right' : 'left',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              borderRadius: '4px'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="3" y="3" width="18" height="18" rx="2" />
                            </svg>
                            {t('media.noFolder')}
                          </button>
                          {libraryFolders.map(folder => (
                            <button
                              key={folder.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuId(null); setMenuPosition(null);
                                handleMoveToFolder(item.id, folder.id);
                              }}
                              style={{
                                width: '100%',
                                padding: '6px 10px',
                                border: 'none',
                                background: 'transparent',
                                color: 'rgba(255,255,255,0.7)',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                textAlign: isRTL ? 'right' : 'left',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                borderRadius: '4px'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(6, 182, 212, 0.7)" strokeWidth="2">
                                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                              </svg>
                              {folder.name}
                            </button>
                          ))}
                          <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />
                          {/* Delete */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(null); setMenuPosition(null);
                              handleDeleteImported(item.id, e);
                            }}
                            style={{
                              width: '100%',
                              padding: '6px 10px',
                              border: 'none',
                              background: 'transparent',
                              color: '#dc3545',
                              cursor: 'pointer',
                              fontSize: '0.8rem',
                              textAlign: isRTL ? 'right' : 'left',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              borderRadius: '4px'
                            }}
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
            })}
          </div>

          {/* Load More Button for pagination */}
          {filteredMedia.length > visibleCount && (
            <button
              onClick={loadMore}
              style={{
                width: '100%',
                marginTop: '8px',
                padding: '10px',
                background: 'rgba(6, 182, 212, 0.15)',
                border: '1px solid rgba(6, 182, 212, 0.3)',
                borderRadius: '6px',
                color: '#06b6d4',
                fontSize: '11px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Load more ({filteredMedia.length - visibleCount} remaining)
            </button>
          )}
        </div>
      )}

      {/* Empty state */}
      {filteredMedia.length === 0 && (
        <div style={{
          padding: '20px',
          textAlign: 'center',
          color: 'rgba(255,255,255,0.4)',
          fontSize: '12px'
        }}>
          {debouncedSearchQuery.trim()
            ? 'No media found matching your search.'
            : selectedMediaType === 'image'
              ? 'No images imported yet. Click the import button to add images.'
              : selectedMediaType === 'video'
                ? 'No videos imported yet. Click the import button to add videos.'
                : selectedMediaType === 'audio'
                  ? 'No audio files imported yet. Click the import button to add music.'
                  : 'No media imported yet. Click the import button to add media.'}
        </div>
      )}

      {/* Context Menu for media actions */}
      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            background: 'rgba(30, 30, 35, 0.98)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '8px',
            padding: '4px',
            minWidth: '150px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            zIndex: 1000
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Add to Setlist option */}
          {onAddToSetlist && (
            <button
              onClick={() => {
                const item = importedMedia.find(m => m.id === contextMenu.mediaId);
                if (item) {
                  onAddToSetlist({
                    type: item.type,
                    path: item.processedPath,
                    name: item.name,
                    duration: item.duration,
                    thumbnailPath: item.thumbnailPath
                  });
                  setContextMenu(null);
                }
              }}
              style={{
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
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = theme.colors.primary.bgHover; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add to Setlist
            </button>
          )}

          {/* Rename option */}
          <button
            onClick={() => {
              const item = importedMedia.find(m => m.id === contextMenu.mediaId);
              if (item) handleStartRename(item);
            }}
            style={{
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
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Rename
          </button>

          <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />

          <div style={{ padding: '6px 10px', fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
            MOVE TO FOLDER
          </div>
          <button
            onClick={() => handleMoveToFolder(contextMenu.mediaId, null)}
            style={{
              width: '100%',
              padding: '8px 10px',
              background: 'transparent',
              border: 'none',
              borderRadius: '4px',
              color: 'rgba(255,255,255,0.8)',
              fontSize: '11px',
              textAlign: 'left',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            No Folder (Root)
          </button>
          {libraryFolders.map(folder => (
            <button
              key={folder.id}
              onClick={() => handleMoveToFolder(contextMenu.mediaId, folder.id)}
              style={{
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
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(6, 182, 212, 0.7)" strokeWidth="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              {folder.name}
            </button>
          ))}
          {libraryFolders.length === 0 && (
            <div style={{ padding: '8px 10px', fontSize: '10px', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>
              No folders yet
            </div>
          )}
        </div>
      )}

      {/* Rename Modal */}
      {renamingMediaId && (
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
          onClick={() => { setRenamingMediaId(null); setRenameValue(''); }}
        >
          <div
            style={{
              background: 'rgba(30, 30, 35, 0.98)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '12px',
              padding: '16px',
              minWidth: '300px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'white', marginBottom: '12px' }}>
              Rename Media
            </div>
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename();
                if (e.key === 'Escape') { setRenamingMediaId(null); setRenameValue(''); }
              }}
              autoFocus
              style={{
                width: '100%',
                padding: '10px 12px',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(6, 182, 212, 0.5)',
                borderRadius: '6px',
                color: 'white',
                fontSize: '12px',
                outline: 'none',
                marginBottom: '12px'
              }}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setRenamingMediaId(null); setRenameValue(''); }}
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
                onClick={handleRename}
                style={{
                  padding: '8px 16px',
                  background: 'rgba(6, 182, 212, 0.3)',
                  border: '1px solid rgba(6, 182, 212, 0.5)',
                  borderRadius: '6px',
                  color: '#06b6d4',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Playlist Editor Dialog */}
      {showPlaylistEditor && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000
          }}
          onClick={() => !isSaving && closePlaylistEditor()}
        >
          <div
            style={{
              background: 'rgba(30, 30, 35, 0.98)',
              border: '1px solid rgba(255, 152, 0, 0.3)',
              borderRadius: '12px',
              padding: '20px',
              width: '600px',
              maxWidth: '90vw',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF9800" strokeWidth="2">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <circle cx="4" cy="6" r="2" fill="#FF9800" />
                <circle cx="4" cy="12" r="2" fill="#FF9800" />
                <circle cx="4" cy="18" r="2" fill="#FF9800" />
              </svg>
              <div style={{ fontSize: '16px', fontWeight: 600, color: 'white' }}>
                {editingPlaylistId ? 'Edit Playlist' : 'Create Playlist'}
              </div>
            </div>

            {/* Playlist Name */}
            <div style={{ marginBottom: '12px' }}>
              <input
                type="text"
                value={editorPlaylistName}
                onChange={(e) => setEditorPlaylistName(e.target.value)}
                placeholder="Playlist name..."
                autoFocus
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255, 152, 0, 0.4)',
                  borderRadius: '6px',
                  color: 'white',
                  fontSize: '13px',
                  outline: 'none'
                }}
              />
            </div>

            {/* Shuffle toggle */}
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              fontSize: '12px',
              color: 'rgba(255,255,255,0.8)',
              marginBottom: '16px'
            }}>
              <div style={{
                width: '18px',
                height: '18px',
                borderRadius: '4px',
                border: editorPlaylistShuffle ? '2px solid #FF9800' : '2px solid rgba(255,255,255,0.3)',
                background: editorPlaylistShuffle ? 'rgba(255, 152, 0, 0.3)' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
                onClick={() => setEditorPlaylistShuffle(!editorPlaylistShuffle)}
              >
                {editorPlaylistShuffle && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FF9800" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
              <span onClick={() => setEditorPlaylistShuffle(!editorPlaylistShuffle)}>Shuffle playback</span>
            </label>

            {/* Two column layout: Audio files / Playlist tracks */}
            <div style={{ display: 'flex', gap: '16px', flex: 1, minHeight: 0 }}>
              {/* Left: Available audio files */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>
                  Available Audio Files
                </div>
                <input
                  type="text"
                  value={editorSearchQuery}
                  onChange={(e) => setEditorSearchQuery(e.target.value)}
                  placeholder="Search audio files..."
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '4px',
                    color: 'white',
                    fontSize: '11px',
                    outline: 'none',
                    marginBottom: '8px'
                  }}
                />
                <div style={{
                  flex: 1,
                  overflowY: 'auto',
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: '6px',
                  padding: '4px'
                }}>
                  {editorFilteredAudio.length === 0 ? (
                    <div style={{ padding: '16px', textAlign: 'center', fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
                      No audio files found
                    </div>
                  ) : (
                    editorFilteredAudio.map(item => {
                      const isInPlaylist = editorPlaylistTracks.some(t => t.path === item.processedPath);
                      return (
                        <div
                          key={item.id}
                          onClick={() => !isInPlaylist && addTrackToEditor(item)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '6px 8px',
                            borderRadius: '4px',
                            cursor: isInPlaylist ? 'default' : 'pointer',
                            opacity: isInPlaylist ? 0.4 : 1,
                            background: isInPlaylist ? 'rgba(255, 152, 0, 0.1)' : 'transparent'
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9C27B0" strokeWidth="2">
                            <path d="M9 18V5l12-2v13" />
                            <circle cx="6" cy="18" r="3" />
                            <circle cx="18" cy="16" r="3" />
                          </svg>
                          <span style={{
                            flex: 1,
                            fontSize: '11px',
                            color: 'white',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {item.name}
                          </span>
                          {!isInPlaylist && (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2">
                              <path d="M12 5v14M5 12h14" />
                            </svg>
                          )}
                          {isInPlaylist && (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FF9800" strokeWidth="2">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right: Playlist tracks (reorderable) */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>
                  Playlist Tracks ({editorPlaylistTracks.length})
                </div>
                <div style={{
                  flex: 1,
                  overflowY: 'auto',
                  background: 'rgba(255, 152, 0, 0.05)',
                  border: '1px solid rgba(255, 152, 0, 0.15)',
                  borderRadius: '6px',
                  padding: '4px'
                }}>
                  {editorPlaylistTracks.length === 0 ? (
                    <div style={{ padding: '16px', textAlign: 'center', fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
                      Click audio files to add
                    </div>
                  ) : (
                    editorPlaylistTracks.map((track, index) => (
                      <div
                        key={`${track.path}-${index}`}
                        draggable
                        onDragStart={() => handleEditorTrackDragStart(index)}
                        onDragOver={(e) => handleEditorTrackDragOver(e, index)}
                        onDragEnd={handleEditorTrackDragEnd}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '6px 8px',
                          background: editorDraggedIndex === index
                            ? 'rgba(255, 152, 0, 0.3)'
                            : editorDropTargetIndex === index
                              ? 'rgba(255, 152, 0, 0.15)'
                              : 'transparent',
                          borderRadius: '4px',
                          cursor: 'grab',
                          borderTop: editorDropTargetIndex === index && editorDraggedIndex !== null && editorDraggedIndex > index
                            ? '2px solid #FF9800'
                            : 'none',
                          borderBottom: editorDropTargetIndex === index && editorDraggedIndex !== null && editorDraggedIndex < index
                            ? '2px solid #FF9800'
                            : 'none'
                        }}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2">
                          <line x1="8" y1="6" x2="16" y2="6" />
                          <line x1="8" y1="12" x2="16" y2="12" />
                          <line x1="8" y1="18" x2="16" y2="18" />
                        </svg>
                        <span style={{ fontSize: '10px', color: '#FF9800', width: '16px' }}>{index + 1}</span>
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
                        {track.duration && (
                          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>
                            {Math.floor(track.duration / 60)}:{String(Math.floor(track.duration % 60)).padStart(2, '0')}
                          </span>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); removeTrackFromEditor(index); }}
                          style={{
                            padding: '2px',
                            background: 'transparent',
                            border: 'none',
                            color: 'rgba(255,255,255,0.4)',
                            cursor: 'pointer'
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Footer buttons */}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button
                onClick={closePlaylistEditor}
                disabled={isSaving}
                style={{
                  padding: '10px 20px',
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '6px',
                  color: isSaving ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.7)',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: isSaving ? 'not-allowed' : 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={savePlaylistFromEditor}
                disabled={editorPlaylistTracks.length === 0 || isSaving}
                style={{
                  padding: '10px 24px',
                  background: (editorPlaylistTracks.length === 0 || isSaving) ? 'rgba(255,255,255,0.05)' : 'rgba(255, 152, 0, 0.3)',
                  border: (editorPlaylistTracks.length === 0 || isSaving) ? 'none' : '1px solid rgba(255, 152, 0, 0.5)',
                  borderRadius: '6px',
                  color: (editorPlaylistTracks.length === 0 || isSaving) ? 'rgba(255,255,255,0.3)' : '#FF9800',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: (editorPlaylistTracks.length === 0 || isSaving) ? 'not-allowed' : 'pointer'
                }}
              >
                {isSaving ? 'Saving...' : (editingPlaylistId ? 'Save Changes' : 'Create Playlist')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(MediaGrid);
