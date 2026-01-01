import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';

// Video thumbnail cache to avoid regenerating
const videoThumbnailCache: Record<string, string> = {};

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
  createdAt: string;
}

interface LibraryFolder {
  id: string;
  name: string;
  createdAt: string;
}

interface MediaGridProps {
  onSelectImage?: (path: string) => void;
  onSelectVideo?: (path: string) => void;
  onSelectAudio?: (path: string, name: string) => void;
  onAddToSetlist?: (media: { type: 'video' | 'image' | 'audio'; path: string; name: string; duration?: number | null }) => void;
}

const INITIAL_VISIBLE = 20;
const LOAD_MORE_COUNT = 20;

// Component to generate and display video thumbnails using DOM video element
const VideoThumbnail: React.FC<{ filePath: string; fileName: string }> = ({ filePath, fileName }) => {
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
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
    // Use 'file' as hostname to prevent drive letter being parsed as host
    return `media://file/${encodedPath}`;
  }, [filePath]);

  // Check cache on mount
  useEffect(() => {
    console.log('[VideoThumbnail] Mount - mediaUrl:', mediaUrl);
    if (videoThumbnailCache[filePath]) {
      console.log('[VideoThumbnail] Found in cache');
      setThumbnail(videoThumbnailCache[filePath]);
      setLoading(false);
    }
  }, [filePath, mediaUrl]);

  const handleLoadedData = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    console.log('[VideoThumbnail] loadedData - duration:', video.duration, 'videoWidth:', video.videoWidth, 'videoHeight:', video.videoHeight);
    // Seek to the middle of the video (50%)
    const seekTime = video.duration * 0.5;
    console.log('[VideoThumbnail] seeking to:', seekTime);
    video.currentTime = seekTime;
  }, []);

  const handleSeeked = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    console.log('[VideoThumbnail] seeked event - video:', !!video, 'canvas:', !!canvas, 'thumbnail:', !!thumbnail);
    if (!video || !canvas || thumbnail) return;

    try {
      console.log('[VideoThumbnail] Drawing frame - videoWidth:', video.videoWidth, 'videoHeight:', video.videoHeight);
      const aspectRatio = video.videoWidth / video.videoHeight;
      const thumbWidth = 150;
      const thumbHeight = thumbWidth / aspectRatio;

      canvas.width = thumbWidth;
      canvas.height = thumbHeight;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, thumbWidth, thumbHeight);
        console.log('[VideoThumbnail] Canvas drawn, extracting dataURL...');
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        console.log('[VideoThumbnail] Success! dataUrl length:', dataUrl.length);

        // Cache the thumbnail
        videoThumbnailCache[filePath] = dataUrl;
        setThumbnail(dataUrl);
      }
    } catch (err) {
      console.error('[VideoThumbnail] Failed to generate thumbnail:', err);
      setError(true);
    }
    setLoading(false);
  }, [filePath, thumbnail]);

  const handleError = useCallback((e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const video = e.currentTarget;
    console.error('[VideoThumbnail] Video load error:', filePath, 'error:', video.error?.message || 'unknown');
    setError(true);
    setLoading(false);
  }, [filePath]);

  // Timeout fallback
  useEffect(() => {
    if (!loading) return;
    const timeout = setTimeout(() => {
      if (loading && !thumbnail) {
        setError(true);
        setLoading(false);
      }
    }, 8000);
    return () => clearTimeout(timeout);
  }, [loading, thumbnail]);

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
        {loading ? (
          <>
            <div style={{
              width: '20px',
              height: '20px',
              border: '2px solid rgba(255,255,255,0.2)',
              borderTopColor: 'rgba(255,140,66,0.8)',
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
      {/* Video duration indicator */}
      <div style={{
        position: 'absolute',
        bottom: '2px',
        right: '2px',
        background: 'rgba(0,0,0,0.7)',
        borderRadius: '2px',
        padding: '1px 3px',
        fontSize: '8px',
        color: 'white'
      }}>
        VIDEO
      </div>
    </div>
  );
};

type MediaTypeFilter = 'image' | 'video' | 'audio' | null;

const MediaGrid: React.FC<MediaGridProps> = ({ onSelectImage, onSelectVideo, onSelectAudio, onAddToSetlist }) => {
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [importedMedia, setImportedMedia] = useState<ImportedMediaItem[]>([]);
  const [libraryFolders, setLibraryFolders] = useState<LibraryFolder[]>([]);
  const [selectedLibraryFolder, setSelectedLibraryFolder] = useState<string | null>(null); // null = "All"
  const [selectedFolder, setSelectedFolder] = useState<MediaFolder | null>(null);
  const [selectedMediaType, setSelectedMediaType] = useState<MediaTypeFilter>(null); // null = show all
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; mediaId: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [renamingMediaId, setRenamingMediaId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [draggedMediaId, setDraggedMediaId] = useState<string | null>(null);
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null);
  const [dropTargetFolderId, setDropTargetFolderId] = useState<string | null | 'all'>(null);
  const [showFolderDropdown, setShowFolderDropdown] = useState(false);
  const folderButtonRef = useRef<HTMLButtonElement>(null);

  // Load folders, files, and imported media on mount
  useEffect(() => {
    loadFolders();
    loadImportedMedia();
    loadLibraryFolders();
  }, []);

  // Reset visible count when folder changes
  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE);
  }, [selectedFolder, selectedLibraryFolder]);

  // Close context menu and folder dropdown on click outside
  useEffect(() => {
    const handleClick = () => {
      setContextMenu(null);
      setShowFolderDropdown(false);
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
      console.error('Failed to load media folders:', err);
    }
  };

  const loadImportedMedia = async () => {
    try {
      const items = await window.electronAPI.getMediaLibrary();
      setImportedMedia(items);
    } catch (err) {
      console.error('Failed to load imported media:', err);
    }
  };

  const loadLibraryFolders = async () => {
    try {
      const folders = await window.electronAPI.getMediaFoldersLib();
      setLibraryFolders(folders);
    } catch (err) {
      console.error('Failed to load library folders:', err);
    }
  };

  const handleImportMedia = async () => {
    setImporting(true);
    try {
      const result = await window.electronAPI.importMedia();
      if (result.success && result.imported.length > 0) {
        await loadImportedMedia();
      }
    } catch (err) {
      console.error('Failed to import media:', err);
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
      console.error('Failed to create folder:', err);
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
      console.error('Failed to delete folder:', err);
    }
  };

  const handleMoveToFolder = async (mediaId: string, folderId: string | null) => {
    try {
      await window.electronAPI.moveMediaToFolder(mediaId, folderId);
      await loadImportedMedia();
      setContextMenu(null);
    } catch (err) {
      console.error('Failed to move media:', err);
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
      console.error('Failed to rename media:', err);
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
      duration: item.duration
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
      console.error('Failed to delete imported media:', err);
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
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(query) ||
        (item.tags && item.tags.toLowerCase().includes(query))
      );
    }
    return filtered;
  }, [importedMedia, selectedMediaType, selectedLibraryFolder, searchQuery]);

  // Count media by type
  const mediaTypeCounts = useMemo(() => ({
    image: importedMedia.filter(m => m.type === 'image').length,
    video: importedMedia.filter(m => m.type === 'video').length,
    audio: importedMedia.filter(m => m.type === 'audio').length
  }), [importedMedia]);

  const handleAddFolder = async () => {
    setLoading(true);
    try {
      const folder = await window.electronAPI.addMediaFolder();
      if (folder) {
        await loadFolders();
      }
    } catch (err) {
      console.error('Failed to add folder:', err);
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
      console.error('Failed to remove folder:', err);
    }
  };

  const handleRescanFolder = async (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await window.electronAPI.rescanMediaFolder(folderId);
      await loadFolders();
    } catch (err) {
      console.error('Failed to rescan folder:', err);
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
              background: 'rgba(255, 140, 66, 0.2)',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              color: '#FF8C42'
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
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '6px',
              padding: '2px'
            }}>
              {visibleFiles.map(file => {
                const isVideo = file.type === 'video';
                // Properly encode the file path for URL
                // Use media://file/ prefix to avoid drive letter being treated as hostname
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
                      e.currentTarget.style.border = '2px solid rgba(255, 140, 66, 0.6)';
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
                      <VideoThumbnail filePath={file.path} fileName={file.name} />
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
                  background: 'rgba(255, 140, 66, 0.15)',
                  border: '1px solid rgba(255, 140, 66, 0.3)',
                  borderRadius: '6px',
                  color: '#FF8C42',
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
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px',
            background: importing ? 'rgba(255, 140, 66, 0.1)' : 'rgba(255, 140, 66, 0.2)',
            border: '1px solid rgba(255, 140, 66, 0.5)',
            borderRadius: '6px',
            color: '#FF8C42',
            cursor: importing ? 'wait' : 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
          </svg>
        </button>
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
          style={{
            flex: 1,
            padding: '4px',
            background: selectedMediaType === 'video' ? 'rgba(255, 140, 66, 0.3)' : 'transparent',
            border: selectedMediaType === 'video' ? '1px solid rgba(255, 140, 66, 0.6)' : '1px solid transparent',
            borderRadius: '3px',
            color: selectedMediaType === 'video' ? '#FF8C42' : 'rgba(255,255,255,0.5)',
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
                  : selectedLibraryFolder === null ? 'rgba(255, 140, 66, 0.3)' : 'rgba(255,255,255,0.05)',
                border: dropTargetFolderId === null && draggedMediaId
                  ? '2px solid rgba(0, 200, 255, 0.7)'
                  : selectedLibraryFolder === null ? '1px solid rgba(255, 140, 66, 0.5)' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: '6px',
                color: selectedLibraryFolder === null ? '#FF8C42' : 'rgba(255,255,255,0.7)',
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
                        : isSelected ? 'rgba(255, 140, 66, 0.3)' : 'rgba(255,255,255,0.05)',
                      border: isDropTarget
                        ? '2px solid rgba(0, 200, 255, 0.7)'
                        : isSelected ? '1px solid rgba(255, 140, 66, 0.5)' : '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '6px',
                      color: isSelected ? '#FF8C42' : 'rgba(255,255,255,0.7)',
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
                    border: '1px solid rgba(255, 140, 66, 0.5)',
                    borderRadius: '4px',
                    color: 'white',
                    fontSize: '11px',
                    width: '100px',
                    outline: 'none'
                  }}
                />
                <button onClick={handleCreateFolder} style={{ padding: '4px 8px', background: 'rgba(255, 140, 66, 0.3)', border: 'none', borderRadius: '4px', color: '#FF8C42', fontSize: '10px', cursor: 'pointer' }}>
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

      {/* Imported Media Grid */}
      {filteredMedia.length > 0 && (
        <div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px'
          }}>
            {filteredMedia.map(item => {
              const isVideo = item.type === 'video';
              const isAudio = item.type === 'audio';
              const isImage = item.type === 'image';
              // Use processed path for media:// URL
              const encodedPath = item.processedPath
                .replace(/\\/g, '/')
                .split('/')
                .map(segment => encodeURIComponent(segment))
                .join('/');
              const mediaUrl = `media://file/${encodedPath}`;

              const isSelected = selectedMediaId === item.id;

              return (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, item)}
                  onDragEnd={handleDragEnd}
                  onClick={() => setSelectedMediaId(isSelected ? null : item.id)}
                  onContextMenu={(e) => handleContextMenu(e, item.id)}
                  title={`${item.name}\nClick to select • Drag to setlist • Right-click for options`}
                  style={{
                    aspectRatio: '16/9',
                    borderRadius: '8px',
                    cursor: draggedMediaId === item.id ? 'grabbing' : 'pointer',
                    border: isSelected
                      ? '2px solid rgba(0, 200, 255, 1)'
                      : draggedMediaId === item.id
                        ? '2px solid rgba(0, 200, 255, 0.8)'
                        : isAudio
                          ? '2px solid rgba(156, 39, 176, 0.3)'
                          : '2px solid rgba(255, 140, 66, 0.3)',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isAudio ? 'rgba(156, 39, 176, 0.2)' : 'rgba(0,0,0,0.4)',
                    overflow: 'hidden',
                    position: 'relative',
                    opacity: draggedMediaId === item.id ? 0.6 : 1,
                    transform: isSelected ? 'scale(1.02)' : 'scale(1)'
                  }}
                  onMouseEnter={(e) => {
                    if (!draggedMediaId && !isSelected) {
                      e.currentTarget.style.border = isAudio
                        ? '2px solid rgba(156, 39, 176, 0.8)'
                        : '2px solid rgba(255, 140, 66, 0.8)';
                      e.currentTarget.style.transform = 'scale(1.02)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!draggedMediaId && !isSelected) {
                      e.currentTarget.style.border = isAudio
                        ? '2px solid rgba(156, 39, 176, 0.3)'
                        : '2px solid rgba(255, 140, 66, 0.3)';
                      e.currentTarget.style.transform = 'scale(1)';
                    }
                  }}
                >
                  {isImage ? (
                    <img
                      src={mediaUrl}
                      alt={item.name}
                      loading="lazy"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : isVideo ? (
                    <VideoThumbnail filePath={item.processedPath} fileName={item.name} />
                  ) : isAudio ? (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '100%',
                      height: '100%',
                      padding: '8px'
                    }}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(156, 39, 176, 0.9)" strokeWidth="2">
                        <path d="M9 18V5l12-2v13" />
                        <circle cx="6" cy="18" r="3" />
                        <circle cx="18" cy="16" r="3" />
                      </svg>
                      <span style={{
                        fontSize: '9px',
                        color: 'rgba(156, 39, 176, 0.9)',
                        marginTop: '4px',
                        maxWidth: '100%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        textAlign: 'center'
                      }}>
                        {item.name}
                      </span>
                    </div>
                  ) : null}

                  {/* Selection overlay with Show button */}
                  {isSelected && (
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: 'rgba(0,0,0,0.6)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectImported(item);
                          setSelectedMediaId(null);
                        }}
                        style={{
                          padding: '8px 16px',
                          background: 'rgba(0, 200, 255, 0.9)',
                          border: 'none',
                          borderRadius: '6px',
                          color: 'white',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        Show
                      </button>
                      {onAddToSetlist && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onAddToSetlist({
                              type: item.type,
                              path: item.processedPath,
                              name: item.name,
                              duration: item.duration
                            });
                            setSelectedMediaId(null);
                          }}
                          title="Add to Setlist"
                          style={{
                            padding: '8px',
                            background: 'rgba(255, 140, 66, 0.9)',
                            border: 'none',
                            borderRadius: '6px',
                            color: 'white',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 5v14M5 12h14" />
                          </svg>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Duration badge for videos */}
                  {isVideo && item.duration && !isSelected && (
                    <div style={{
                      position: 'absolute',
                      bottom: '2px',
                      left: '2px',
                      background: 'rgba(0,0,0,0.8)',
                      borderRadius: '2px',
                      padding: '1px 4px',
                      fontSize: '9px',
                      color: '#FF8C42',
                      fontWeight: 500
                    }}>
                      {formatDuration(item.duration)}
                    </div>
                  )}
                  {/* Delete button */}
                  {!isSelected && (
                    <button
                      onClick={(e) => handleDeleteImported(item.id, e)}
                      title="Remove from library"
                      style={{
                        position: 'absolute',
                        top: '2px',
                        right: '2px',
                        padding: '2px',
                        background: 'rgba(0,0,0,0.7)',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        opacity: 0.7,
                        transition: 'opacity 0.15s'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,100,100,0.9)" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                  {/* Instant badge */}
                  {!isSelected && (
                    <div style={{
                      position: 'absolute',
                      top: '2px',
                      left: '2px',
                      background: 'rgba(50, 200, 100, 0.9)',
                      borderRadius: '2px',
                      padding: '1px 3px',
                      fontSize: '7px',
                      color: 'white',
                      fontWeight: 600,
                      textTransform: 'uppercase'
                    }}>
                      Instant
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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
          {searchQuery.trim()
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
                    duration: item.duration
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
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,140,66,0.2)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FF8C42" strokeWidth="2">
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
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255, 140, 66, 0.7)" strokeWidth="2">
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
                border: '1px solid rgba(255, 140, 66, 0.5)',
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
                  background: 'rgba(255, 140, 66, 0.3)',
                  border: '1px solid rgba(255, 140, 66, 0.5)',
                  borderRadius: '6px',
                  color: '#FF8C42',
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
    </div>
  );
};

export default MediaGrid;
