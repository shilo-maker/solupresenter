import { ipcMain, dialog, app, shell, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { DisplayManager } from '../windows/displayManager';
import { getLocalServerPort } from '../index';

// ============ Constants ============
const RATE_LIMIT_WINDOW_MS = 1000; // Rate limit window in milliseconds
const VIDEO_TIME_UPDATE_INTERVAL_MS = 100; // Throttle interval for video time updates (10 updates/sec)
const YOUTUBE_SYNC_INTERVAL_MS = 200; // Throttle interval for YouTube sync (5 syncs/sec)
const YOUTUBE_SEARCH_TIMEOUT_MS = 15000; // Timeout for YouTube search API calls
const MAX_TAG_LENGTH = 1000; // Maximum length for media tags
const MAX_NAME_LENGTH = 255; // Maximum length for file/folder names
const MAX_YOUTUBE_VIDEO_ID_LENGTH = 20; // Maximum YouTube video ID length
const MAX_YOUTUBE_TITLE_LENGTH = 500; // Maximum YouTube title length
const MAX_YOUTUBE_SEARCH_RESULTS = 12; // Maximum number of YouTube search results to return
const MAX_IMPORT_FILE_SIZE_MB = 500; // Maximum file size for media import in MB
const MAX_IMPORT_FILE_SIZE_BYTES = MAX_IMPORT_FILE_SIZE_MB * 1024 * 1024; // Convert to bytes
const MAX_TOTAL_IMPORT_SIZE_MB = 2000; // Maximum total size for batch import in MB
const MAX_TOTAL_IMPORT_SIZE_BYTES = MAX_TOTAL_IMPORT_SIZE_MB * 1024 * 1024;

// Rate limiting utility - throttles calls to once per interval
function createThrottle<T extends (...args: any[]) => any>(
  fn: T,
  intervalMs: number
): (...args: Parameters<T>) => ReturnType<T> | undefined {
  let lastCallTime = 0;
  let lastResult: ReturnType<T> | undefined;

  return (...args: Parameters<T>): ReturnType<T> | undefined => {
    const now = Date.now();
    if (now - lastCallTime >= intervalMs) {
      lastCallTime = now;
      lastResult = fn(...args);
      return lastResult;
    }
    return lastResult;
  };
}

// Rate limit tracking for specific callers
const rateLimiters = new Map<string, { lastCall: number; count: number }>();

function checkRateLimit(key: string, maxCallsPerSecond: number): boolean {
  const now = Date.now();
  const limiter = rateLimiters.get(key);

  if (!limiter || now - limiter.lastCall > RATE_LIMIT_WINDOW_MS) {
    // Reset counter if more than 1 second has passed
    rateLimiters.set(key, { lastCall: now, count: 1 });
    return true;
  }

  if (limiter.count >= maxCallsPerSecond) {
    return false; // Rate limited
  }

  limiter.count++;
  limiter.lastCall = now;
  return true;
}
import { getSongs, getSong, createSong, updateSong, deleteSong, importSongsFromBackend, exportSongsToJSON, importSongsFromJSON, getSongByRemoteId, getSongByTitle, batchResolveSongs } from '../database/songs';
import { getSetlists, getSetlist, createSetlist, updateSetlist, deleteSetlist } from '../database/setlists';
import { getThemes, getTheme, createTheme, updateTheme, deleteTheme } from '../database/themes';
import { exportThemesToJSON, importThemesFromJSON } from '../database/themeExportImport';
import { getStageThemes, getStageTheme, createStageTheme, updateStageTheme, deleteStageTheme, duplicateStageTheme, setDefaultStageTheme } from '../database/stageThemes';
import { getBibleThemes, getBibleTheme, createBibleTheme, updateBibleTheme, deleteBibleTheme, getDefaultBibleTheme } from '../database/bibleThemes';
import { getOBSThemes, getOBSTheme, createOBSTheme, updateOBSTheme, deleteOBSTheme, getDefaultOBSTheme, OBSThemeType } from '../database/obsThemes';
import { getPrayerThemes, getPrayerTheme, createPrayerTheme, updatePrayerTheme, deletePrayerTheme, getDefaultPrayerTheme } from '../database/prayerThemes';
import { getPresentations, getPresentation, createPresentation, updatePresentation, deletePresentation } from '../database/presentations';
import { getAudioPlaylists, getAudioPlaylist, createAudioPlaylist, updateAudioPlaylist, deleteAudioPlaylist } from '../database/audioPlaylists';
import {
  getSelectedThemeIds, saveSelectedThemeId,
  getAllDisplayThemeOverrides, getDisplayThemeOverrides, getDisplayThemeOverride,
  setDisplayThemeOverride, removeDisplayThemeOverride, removeAllDisplayThemeOverrides,
  DisplayThemeType, queryOne
} from '../database/index';
import {
  addMediaItem, getAllMediaItems, getMediaItem, deleteMediaItem, isMediaImported, moveMediaToFolder,
  createMediaFolder, getAllMediaFolders, renameMediaFolder, deleteMediaFolder,
  renameMediaItem, updateMediaTags,
  MediaItem, MediaFolder
} from '../database/media';
import { transliterate, translate, processQuickSlide } from '../services/textProcessing';
import { MediaManager } from '../services/mediaManager';
import { SocketService } from '../services/socketService';
import { getBibleBooks, getBibleVerses, versesToSlides } from '../services/bibleService';
import { authService } from '../services/authService';
import { processVideo, processImage, processAudio, deleteProcessedMedia, getMediaLibraryPath } from '../services/mediaProcessor';
import { obsServer } from '../services/obsServer';
import { remoteControlServer, RemoteControlState } from '../services/remoteControlServer';
import QRCode from 'qrcode';

let mediaManager: MediaManager;
let socketService: SocketService;
let controlWindowRef: BrowserWindow | null = null;

export function setSocketControlWindow(window: import('electron').BrowserWindow): void {
  controlWindowRef = window;
  if (socketService) {
    socketService.setControlWindow(window);
  }
  // Also set control window for remote control server
  remoteControlServer.setControlWindow(window);
}

export function registerIpcHandlers(displayManager: DisplayManager): void {
  mediaManager = new MediaManager();
  socketService = new SocketService();

  // Set displayManager reference for remote control server (for direct slide broadcasting)
  remoteControlServer.setDisplayManager(displayManager);

  // Initialize auth service
  authService.initialize().catch(err => console.error('Auth init failed:', err));

  // ============ Display Management ============

  ipcMain.handle('displays:getAll', () => {
    try {
      return displayManager.getAllDisplays();
    } catch (error) {
      console.error('[IPC displays:getAll] Error:', error);
      return [];
    }
  });

  ipcMain.handle('displays:getExternal', () => {
    try {
      return displayManager.getExternalDisplays();
    } catch (error) {
      console.error('[IPC displays:getExternal] Error:', error);
      return [];
    }
  });

  ipcMain.handle('displays:open', (event, displayId: number, type: 'viewer' | 'stage') => {
    try {
      return displayManager.openDisplayWindow(displayId, type);
    } catch (error) {
      console.error('[IPC displays:open] Error:', error);
      return false;
    }
  });

  ipcMain.handle('displays:close', (event, displayId: number) => {
    try {
      displayManager.closeDisplayWindow(displayId);
      return true;
    } catch (error) {
      console.error('[IPC displays:close] Error:', error);
      return false;
    }
  });

  ipcMain.handle('displays:closeAll', () => {
    try {
      displayManager.closeAllDisplays();
      return true;
    } catch (error) {
      console.error('[IPC displays:closeAll] Error:', error);
      return false;
    }
  });

  ipcMain.handle('displays:captureViewer', async () => {
    try {
      return await displayManager.captureViewerThumbnail();
    } catch (error) {
      console.error('[IPC displays:captureViewer] Error:', error);
      return null;
    }
  });

  ipcMain.handle('displays:identify', (event, displayId?: number) => {
    try {
      displayManager.identifyDisplays(displayId);
      return true;
    } catch (error) {
      console.error('[IPC displays:identify] Error:', error);
      return false;
    }
  });

  ipcMain.handle('displays:moveControlWindow', (event, targetDisplayId: number) => {
    try {
      return displayManager.moveControlWindow(targetDisplayId);
    } catch (error) {
      console.error('[IPC displays:moveControlWindow] Error:', error);
      return false;
    }
  });

  ipcMain.handle('displays:getControlWindowDisplay', () => {
    try {
      return displayManager.getControlWindowDisplay();
    } catch (error) {
      console.error('[IPC displays:getControlWindowDisplay] Error:', error);
      return null;
    }
  });

  // Send a message to a specific stage display
  ipcMain.handle('displays:sendStageMessage', (event, displayId: number, message: string) => {
    try {
      displayManager.sendStageMessage(displayId, message);
      return true;
    } catch (error) {
      console.error('[IPC displays:sendStageMessage] Error:', error);
      return false;
    }
  });

  // Close the display window that sent this message (used when display is on same screen as control)
  ipcMain.handle('display:closeSelf', (event) => {
    try {
      const senderWindow = BrowserWindow.fromWebContents(event.sender);
      if (senderWindow && !senderWindow.isDestroyed()) {
        senderWindow.close();
        return true;
      }
      return false;
    } catch (error) {
      console.error('[IPC display:closeSelf] Error:', error);
      return false;
    }
  });

  // Get local media server port for display windows
  ipcMain.handle('media:getServerPort', () => {
    return getLocalServerPort();
  });

  // ============ OBS Browser Source Server ============

  ipcMain.handle('obs:start', async () => {
    try {
      const port = await obsServer.start();
      return { success: true, url: obsServer.getUrl(), port };
    } catch (err) {
      console.error('[IPC obs:start] Error:', err);
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('obs:stop', () => {
    obsServer.stop();
    return true;
  });

  ipcMain.handle('obs:getUrl', () => {
    return obsServer.getUrl();
  });

  ipcMain.handle('obs:isRunning', () => {
    return obsServer.isRunning();
  });

  // Legacy handlers for backwards compatibility
  ipcMain.handle('obs:open', async () => {
    try {
      const port = await obsServer.start();
      return { success: true, url: obsServer.getUrl(), port };
    } catch (error) {
      console.error('[IPC obs:open] Failed to start OBS server:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to start OBS server' };
    }
  });

  ipcMain.handle('obs:close', () => {
    obsServer.stop();
    return true;
  });

  ipcMain.handle('obs:isOpen', () => {
    return obsServer.isRunning();
  });

  // ============ Slide Control ============
  // Use 'on' (fire-and-forget) instead of 'handle' for instant slide updates

  ipcMain.on('slides:send', (event, slideData) => {
    // Validate slideData
    if (!slideData || typeof slideData !== 'object') {
      console.error('[IPC] slides:send: invalid slideData');
      return;
    }
    try {
      const resolved = displayManager.broadcastSlide(slideData);
      socketService.broadcastSlide(slideData);
      obsServer.updateSlide(slideData);

      // Forward auto-resolved theme to online viewers (e.g. default Bible/Prayer theme loaded on first slide)
      if (resolved?.theme) {
        if (resolved.contentType === 'bible') {
          socketService.broadcastBibleTheme(resolved.theme);
        } else if (resolved.contentType === 'prayer' || resolved.contentType === 'sermon') {
          socketService.broadcastPrayerTheme(resolved.theme);
        }
      }
    } catch (error) {
      console.error('[IPC slides:send] Broadcast error:', error);
    }
  });

  // Rendered HTML arrives separately from display window (after React render settles)
  ipcMain.on('display:renderedHtml', (_event, html: string, refWidth: number, refHeight: number) => {
    socketService.broadcastRenderedHtml(html, refWidth, refHeight);
  });

  ipcMain.on('slides:blank', () => {
    try {
      displayManager.broadcastSlide({ isBlank: true });
      socketService.broadcastSlide({ isBlank: true });
      obsServer.updateSlide({ isBlank: true });
    } catch (error) {
      console.error('[IPC slides:blank] Broadcast error:', error);
    }
  });

  ipcMain.on('theme:apply', (event, theme) => {
    // Validate theme
    if (!theme || typeof theme !== 'object') {
      console.error('[IPC] theme:apply: invalid theme data');
      return;
    }
    try {
      displayManager.broadcastTheme(theme);
      socketService.broadcastTheme(theme);
    } catch (error) {
      console.error('[IPC theme:apply] Broadcast error:', error);
    }
  });

  ipcMain.on('background:set', (event, background: string) => {
    try {
      displayManager.broadcastBackground(background);

      // Check if this is local media (media:// protocol)
      const isLocalMedia = background.startsWith('media://');

      if (isLocalMedia) {
        // For local media, don't send the URL to online viewers (they can't access it)
        // Instead, broadcast that local media is being displayed
        socketService.broadcastLocalMediaStatus(true);
      } else {
        // For gradients, http URLs, or empty - hide the local media overlay
        socketService.broadcastLocalMediaStatus(false);
        // Send the background to online viewers
        socketService.broadcastBackground(background);
      }
    } catch (error) {
      console.error('[IPC background:set] Broadcast error:', error);
    }
  });

  ipcMain.on('tools:send', (event, toolData) => {
    try {
      displayManager.broadcastTool(toolData);
      socketService.broadcastTool(toolData);
      // Also broadcast to OBS server if running
      if (obsServer.isRunning()) {
        obsServer.broadcastTool(toolData);
      }
    } catch (error) {
      console.error('[IPC tools:send] Broadcast error:', error);
    }
  });

  ipcMain.on('obsTheme:apply', (event, theme) => {
    try {
      obsServer.updateTheme(theme);
    } catch (error) {
      console.error('[IPC obsTheme:apply] Error:', error);
    }
  });

  // Display fullscreen media (images/videos) - uses proper media broadcast
  ipcMain.handle('media:display', (event, mediaData: { type: 'image' | 'video'; url: string }) => {
    try {
      // Broadcast to local display windows with proper type info
      displayManager.broadcastMedia({ type: mediaData.type, path: mediaData.url });

      // For online viewers, show local media overlay (they can't access local files)
      socketService.broadcastLocalMediaStatus(true);

      return true;
    } catch (error) {
      console.error('[IPC media:display] Error:', error);
      return false;
    }
  });

  // Read file as base64 data URL for blob creation (enables video seeking)
  // Security: Validate file path to prevent arbitrary file reading
  ipcMain.handle('file:readAsDataUrl', async (event, filePath: string) => {
    try {
      // Normalize and validate path
      const normalizedPath = path.normalize(filePath);

      // Allowed file extensions (media files only)
      const allowedExtensions = [
        '.mp4', '.webm', '.mov', '.avi', '.mkv', '.m4v',
        '.jpg', '.jpeg', '.png', '.gif', '.webp',
        '.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac'
      ];
      const ext = path.extname(normalizedPath).toLowerCase();

      if (!allowedExtensions.includes(ext)) {
        throw new Error(`File type not allowed: ${ext}`);
      }

      // Allowed directories
      const userDataPath = app.getPath('userData');
      const mediaLibraryPath = getMediaLibraryPath();
      const homePath = app.getPath('home');

      // Check if path is within allowed directories
      const isInUserData = normalizedPath.startsWith(userDataPath);
      const isInMediaLibrary = normalizedPath.startsWith(mediaLibraryPath);
      const isInUserHome = normalizedPath.startsWith(homePath);

      // Must be in allowed directory (home covers user-selected files)
      if (!isInUserData && !isInMediaLibrary && !isInUserHome) {
        throw new Error('Access denied: File path not in allowed directory');
      }

      // Prevent directory traversal attacks
      if (normalizedPath.includes('..')) {
        throw new Error('Access denied: Directory traversal not allowed');
      }

      const data = await fs.promises.readFile(normalizedPath);
      const mimeTypes: Record<string, string> = {
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.mov': 'video/quicktime',
        '.avi': 'video/x-msvideo',
        '.mkv': 'video/x-matroska',
        '.m4v': 'video/x-m4v',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.ogg': 'audio/ogg',
        '.m4a': 'audio/mp4',
        '.flac': 'audio/flac',
        '.aac': 'audio/aac',
      };
      const mimeType = mimeTypes[ext] || 'application/octet-stream';
      const base64 = data.toString('base64');
      return `data:${mimeType};base64,${base64}`;
    } catch (error) {
      console.error('Failed to read file as data URL:', error);
      throw error;
    }
  });

  // Clear fullscreen media
  ipcMain.handle('media:clear', () => {
    // Clear media on local displays
    displayManager.broadcastMedia({ type: 'image', path: '' });

    // Hide local media overlay for online viewers
    socketService.broadcastLocalMediaStatus(false);

    return true;
  });

  // ============ Media Management ============

  ipcMain.handle('media:getFolders', () => {
    return mediaManager.getFolders();
  });

  ipcMain.handle('media:addFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select Media Folder'
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const folder = await mediaManager.addFolder(result.filePaths[0], 'all');
      return folder;
    }
    return null;
  });

  ipcMain.handle('media:removeFolder', (event, folderId: string) => {
    mediaManager.removeFolder(folderId);
    return true;
  });

  ipcMain.handle('media:getFiles', (event, folderId?: string) => {
    return mediaManager.getFiles(folderId);
  });

  ipcMain.handle('media:rescan', async (event, folderId: string) => {
    try {
      await mediaManager.rescanFolder(folderId);
      return { success: true };
    } catch (error) {
      console.error('[IPC media:rescan] Failed to rescan folder:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to rescan folder' };
    }
  });

  // ============ Media Library (Imported Media) ============

  ipcMain.handle('mediaLibrary:import', async () => {
    console.log('[mediaLibrary:import] Starting import dialog...');
    // Open file dialog to select media files
    const result = await dialog.showOpenDialog({
      title: 'Import Media',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'All Media', extensions: ['mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'] },
        { name: 'Videos', extensions: ['mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi'] },
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] },
        { name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'] }
      ]
    });

    console.log('[mediaLibrary:import] Dialog result:', { canceled: result.canceled, fileCount: result.filePaths.length, paths: result.filePaths });

    if (result.canceled || result.filePaths.length === 0) {
      console.log('[mediaLibrary:import] Dialog canceled or no files selected');
      return { success: false, imported: [] };
    }

    const imported: MediaItem[] = [];
    const errors: string[] = [];

    const videoExtensions = ['.mp4', '.mov', '.m4v', '.webm', '.mkv', '.avi'];
    const audioExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac'];
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const allowedExtensions = [...videoExtensions, ...audioExtensions, ...imageExtensions];

    // Pre-validate all files for size limits
    let totalSize = 0;
    for (const filePath of result.filePaths) {
      try {
        const stat = await fs.promises.stat(filePath);

        // Validate file extension
        const ext = path.extname(filePath).toLowerCase();
        if (!allowedExtensions.includes(ext)) {
          errors.push(`Invalid file type: ${path.basename(filePath)} (${ext})`);
          continue;
        }

        // Check individual file size
        if (stat.size > MAX_IMPORT_FILE_SIZE_BYTES) {
          errors.push(`File too large (>${MAX_IMPORT_FILE_SIZE_MB}MB): ${path.basename(filePath)}`);
          continue;
        }
        totalSize += stat.size;
      } catch (err) {
        errors.push(`Cannot access file: ${path.basename(filePath)}`);
      }
    }

    // Check total batch size
    if (totalSize > MAX_TOTAL_IMPORT_SIZE_BYTES) {
      return {
        success: false,
        imported: [],
        errors: [`Total import size exceeds ${MAX_TOTAL_IMPORT_SIZE_MB}MB limit. Please import fewer files.`]
      };
    }

    for (const filePath of result.filePaths) {
      try {
        console.log('[mediaLibrary:import] Processing file:', filePath);
        // Validate file extension again (in case it was skipped above)
        const ext = path.extname(filePath).toLowerCase();
        if (!allowedExtensions.includes(ext)) {
          console.log('[mediaLibrary:import] Skipping - invalid extension:', ext);
          continue; // Already added to errors above
        }

        // Check if already imported
        if (isMediaImported(filePath)) {
          console.log('[mediaLibrary:import] Skipping - already imported');
          continue;
        }

        const fileName = path.basename(filePath);
        const stat = await fs.promises.stat(filePath);
        console.log('[mediaLibrary:import] File stats:', { fileName, size: stat.size });

        // Skip oversized files (already in errors)
        if (stat.size > MAX_IMPORT_FILE_SIZE_BYTES) {
          console.log('[mediaLibrary:import] Skipping - file too large');
          continue;
        }

        const isVideo = videoExtensions.includes(ext);
        const isAudio = audioExtensions.includes(ext);
        const mediaType = isVideo ? 'video' : isAudio ? 'audio' : 'image';

        // Process the file with timeout protection
        let processResult;
        const processTimeout = 60000; // 60 second timeout for processing
        const processPromise = (async () => {
          if (isVideo) {
            return await processVideo(filePath, fileName);
          } else if (isAudio) {
            return await processAudio(filePath, fileName);
          } else {
            return await processImage(filePath, fileName);
          }
        })();

        const timeoutPromise = new Promise<{ success: false; processedPath: string; duration: null; error: string }>((resolve) => {
          setTimeout(() => resolve({
            success: false,
            processedPath: '',
            duration: null,
            error: `Processing timed out after ${processTimeout / 1000}s`
          }), processTimeout);
        });

        try {
          processResult = await Promise.race([processPromise, timeoutPromise]);
        } catch (processError) {
          // Catch any unhandled errors during processing
          console.error(`[mediaLibrary] Unexpected error processing ${fileName}:`, processError);
          errors.push(`Unexpected error processing ${fileName}: ${processError instanceof Error ? processError.message : String(processError)}`);
          continue;
        }

        if (!processResult.success) {
          console.error(`[mediaLibrary] Processing failed for ${fileName}:`, processResult.error);
          errors.push(`Failed to process ${fileName}: ${processResult.error}`);
          continue;
        }

        // Add to database with error handling
        let mediaItem;
        try {
          mediaItem = addMediaItem({
            name: fileName,
            type: mediaType,
            originalPath: filePath,
            processedPath: processResult.processedPath,
            duration: processResult.duration,
            thumbnailPath: processResult.thumbnailPath,
            fileSize: stat.size,
            folderId: null,
            tags: null,
            width: processResult.width,
            height: processResult.height
          });
        } catch (dbError) {
          // If database insert fails, clean up the processed file
          console.error(`[mediaLibrary] Database error for ${fileName}:`, dbError);
          try {
            await deleteProcessedMedia(processResult.processedPath);
          } catch {
            // Ignore cleanup errors
          }
          errors.push(`Database error for ${fileName}: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
          continue;
        }

        imported.push(mediaItem);
      } catch (error) {
        console.error(`[mediaLibrary] Error importing ${filePath}:`, error);
        errors.push(`Error importing ${path.basename(filePath)}: ${error}`);
      }
    }

    return { success: true, imported, errors };
  });

  ipcMain.handle('mediaLibrary:getAll', () => {
    return getAllMediaItems();
  });

  ipcMain.handle('mediaLibrary:get', (event, id: string) => {
    // Validate ID
    if (!id || typeof id !== 'string' || id.length > MAX_NAME_LENGTH) {
      console.error('[IPC] mediaLibrary:get: invalid id');
      return null;
    }
    return getMediaItem(id);
  });

  ipcMain.handle('mediaLibrary:delete', async (event, id: string) => {
    // Validate ID
    if (!id || typeof id !== 'string' || id.length > MAX_NAME_LENGTH) {
      console.error('[IPC] mediaLibrary:delete: invalid id');
      return { success: false, error: 'Invalid ID' };
    }

    try {
      const item = getMediaItem(id);
      if (!item) {
        console.warn('[IPC] mediaLibrary:delete: item not found:', id);
        return { success: false, error: 'Item not found' };
      }

      // Delete processed file
      await deleteProcessedMedia(item.processedPath);
      // Delete thumbnail if exists
      if (item.thumbnailPath) {
        await deleteProcessedMedia(item.thumbnailPath);
      }
      // Delete from database
      const deleted = deleteMediaItem(id);

      if (!deleted) {
        console.error('[IPC] mediaLibrary:delete: database delete failed');
        return { success: false, error: 'Database delete failed' };
      }

      return { success: true };
    } catch (error) {
      console.error('[IPC] mediaLibrary:delete: error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('mediaLibrary:getPath', () => {
    return getMediaLibraryPath();
  });

  ipcMain.handle('mediaLibrary:move', (event, mediaId: string, folderId: string | null) => {
    if (!mediaId || typeof mediaId !== 'string') {
      console.error('[IPC] mediaLibrary:move: invalid mediaId');
      return false;
    }
    if (folderId !== null && typeof folderId !== 'string') {
      console.error('[IPC] mediaLibrary:move: invalid folderId');
      return false;
    }
    return moveMediaToFolder(mediaId, folderId);
  });

  ipcMain.handle('mediaLibrary:rename', (event, mediaId: string, name: string) => {
    if (!mediaId || typeof mediaId !== 'string') {
      console.error('[IPC] mediaLibrary:rename: invalid mediaId');
      return false;
    }
    if (!name || typeof name !== 'string') {
      console.error('[IPC] mediaLibrary:rename: invalid name');
      return false;
    }
    // Sanitize name - remove path separators and limit length
    const sanitizedName = name.replace(/[\/\\:*?"<>|]/g, '').trim().substring(0, MAX_NAME_LENGTH);
    if (sanitizedName.length === 0) {
      return false;
    }
    return renameMediaItem(mediaId, sanitizedName);
  });

  ipcMain.handle('mediaLibrary:updateTags', (event, mediaId: string, tags: string | null) => {
    if (!mediaId || typeof mediaId !== 'string') {
      console.error('[IPC] mediaLibrary:updateTags: invalid mediaId');
      return false;
    }
    // Sanitize tags if provided - limit length
    const sanitizedTags = tags !== null ? String(tags).substring(0, MAX_TAG_LENGTH) : null;
    return updateMediaTags(mediaId, sanitizedTags);
  });

  // ============ Media Folders ============

  ipcMain.handle('mediaFolders:getAll', () => {
    return getAllMediaFolders();
  });

  ipcMain.handle('mediaFolders:create', (event, name: string) => {
    // Validate folder name
    if (!name || typeof name !== 'string') {
      console.error('[IPC] mediaFolders:create: invalid name');
      throw new Error('Invalid folder name');
    }
    // Sanitize name - remove path separators and limit length
    const sanitizedName = name.replace(/[\/\\:*?"<>|]/g, '').trim().substring(0, MAX_NAME_LENGTH);
    if (sanitizedName.length === 0) {
      throw new Error('Folder name cannot be empty');
    }
    return createMediaFolder(sanitizedName);
  });

  ipcMain.handle('mediaFolders:rename', (event, id: string, name: string) => {
    // Validate inputs
    if (!id || typeof id !== 'string') {
      console.error('[IPC] mediaFolders:rename: invalid id');
      return false;
    }
    if (!name || typeof name !== 'string') {
      console.error('[IPC] mediaFolders:rename: invalid name');
      return false;
    }
    // Sanitize name
    const sanitizedName = name.replace(/[\/\\:*?"<>|]/g, '').trim().substring(0, MAX_NAME_LENGTH);
    if (sanitizedName.length === 0) {
      return false;
    }
    return renameMediaFolder(id, sanitizedName);
  });

  ipcMain.handle('mediaFolders:delete', (event, id: string) => {
    if (!id || typeof id !== 'string') {
      console.error('[IPC] mediaFolders:delete: invalid id');
      return false;
    }
    return deleteMediaFolder(id);
  });

  // ============ Video Control ============

  ipcMain.handle('video:play', (event, filePath: string) => {
    if (!filePath || typeof filePath !== 'string') {
      console.error('[IPC] video:play: invalid filePath');
      return false;
    }
    // Only broadcast media to load it - don't start playing yet
    // Display will signal ready via video:displayReady, then startVideoPlayback()
    // will send synchronized play command to both display and control panel
    displayManager.broadcastMedia({ type: 'video', path: filePath });
    return true;
  });

  ipcMain.handle('video:pause', () => {
    displayManager.broadcastVideoCommand({ type: 'pause' });
    return true;
  });

  ipcMain.handle('video:resume', () => {
    displayManager.broadcastVideoCommand({ type: 'resume' });
    return true;
  });

  ipcMain.handle('video:seek', (event, time: number) => {
    if (typeof time !== 'number' || isNaN(time) || time < 0) {
      console.error('[IPC] video:seek: invalid time', time);
      return false;
    }
    displayManager.broadcastVideoCommand({ type: 'seek', time });
    return true;
  });

  ipcMain.handle('video:stop', () => {
    displayManager.broadcastVideoCommand({ type: 'stop' });
    return true;
  });

  ipcMain.handle('video:mute', (event, muted: boolean) => {
    if (typeof muted !== 'boolean') {
      console.error('[IPC] video:mute: invalid muted value', muted);
      return false;
    }
    displayManager.broadcastVideoCommand({ type: 'mute', muted });
    return true;
  });

  ipcMain.handle('video:volume', (event, volume: number) => {
    if (typeof volume !== 'number' || isNaN(volume) || volume < 0 || volume > 1) {
      console.error('[IPC] video:volume: invalid volume', volume);
      return false;
    }
    displayManager.broadcastVideoCommand({ type: 'volume', volume });
    return true;
  });

  // Get current video position for late-joining display sync
  ipcMain.handle('video:getPosition', () => {
    return displayManager.getVideoPosition();
  });

  // Display signals it's ready to play video - start synchronized playback
  ipcMain.handle('video:displayReady', () => {
    const started = displayManager.startVideoPlayback();
    if (started && controlWindowRef && !controlWindowRef.isDestroyed()) {
      // Tell control panel to start playing from 0
      controlWindowRef.webContents.send('video:syncStart');
    }
    return started;
  });

  // Get current YouTube position for display sync
  ipcMain.handle('youtube:getPosition', () => {
    return displayManager.getYoutubePosition();
  });

  // Forward video time updates from display windows to control panel
  // Throttled to max 10 calls per second to prevent performance issues
  const throttledVideoTimeUpdate = createThrottle((time: number, duration: number) => {
    if (controlWindowRef && !controlWindowRef.isDestroyed()) {
      controlWindowRef.webContents.send('video:status', { currentTime: time, duration });
    }
  }, VIDEO_TIME_UPDATE_INTERVAL_MS);

  ipcMain.on('video:timeUpdate', (event, time: number, duration: number) => {
    throttledVideoTimeUpdate(time, duration);
    // Also update remote control server's activeVideo state
    const currentState = remoteControlServer.getCurrentState?.();
    if (currentState?.activeMedia?.type === 'video') {
      remoteControlServer.updateState({
        activeVideo: {
          name: currentState.activeMedia.name || 'Video',
          isPlaying: currentState.activeVideo?.isPlaying ?? true,
          currentTime: time,
          duration: duration,
          volume: currentState.activeVideo?.volume ?? 1
        }
      } as Partial<RemoteControlState>);
    }
  });

  ipcMain.on('video:ended', () => {
    if (controlWindowRef && !controlWindowRef.isDestroyed()) {
      controlWindowRef.webContents.send('video:ended');
    }
    // Also update remote control server
    remoteControlServer.updateState({
      activeVideo: null
    } as Partial<RemoteControlState>);
  });

  ipcMain.on('video:playing', (event, playing: boolean) => {
    if (controlWindowRef && !controlWindowRef.isDestroyed()) {
      controlWindowRef.webContents.send('video:playing', playing);
    }
    // Also update remote control server's activeVideo state
    const currentState = remoteControlServer.getCurrentState?.();
    if (currentState?.activeMedia?.type === 'video') {
      remoteControlServer.updateState({
        activeVideo: {
          name: currentState.activeMedia.name || 'Video',
          isPlaying: playing,
          currentTime: currentState.activeVideo?.currentTime ?? 0,
          duration: currentState.activeVideo?.duration ?? 0,
          volume: currentState.activeVideo?.volume ?? 1
        }
      } as Partial<RemoteControlState>);
    }
  });

  // ============ Database - Songs ============

  ipcMain.handle('db:songs:getAll', async () => {
    try {
      return await getSongs();
    } catch (error) {
      console.error('IPC db:songs:getAll error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:songs:get', async (event, id: string) => {
    try {
      // Validate ID
      if (!id || typeof id !== 'string' || id.length > MAX_NAME_LENGTH) {
        throw new Error('Invalid song ID');
      }
      return await getSong(id);
    } catch (error) {
      console.error('IPC db:songs:get error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:songs:create', async (event, data) => {
    try {
      return await createSong(data);
    } catch (error) {
      console.error('IPC db:songs:create error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:songs:update', async (event, id: string, data) => {
    try {
      // Validate ID
      if (!id || typeof id !== 'string' || id.length > MAX_NAME_LENGTH) {
        throw new Error('Invalid song ID');
      }
      // Validate data object exists
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid song data');
      }
      return await updateSong(id, data);
    } catch (error) {
      console.error('IPC db:songs:update error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:songs:delete', async (event, id: string) => {
    try {
      // Validate ID
      if (!id || typeof id !== 'string' || id.length > MAX_NAME_LENGTH) {
        throw new Error('Invalid song ID');
      }
      return await deleteSong(id);
    } catch (error) {
      console.error('IPC db:songs:delete error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:songs:search', async (event, query: string) => {
    try {
      return await getSongs(query);
    } catch (error) {
      console.error('IPC db:songs:search error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:songs:import', async (event, backendUrl: string) => {
    try {
      return await importSongsFromBackend(backendUrl);
    } catch (error) {
      console.error('IPC db:songs:import error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:songs:exportJSON', async () => {
    try {
      return await exportSongsToJSON();
    } catch (error) {
      console.error('IPC db:songs:exportJSON error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:songs:importJSON', async (event, jsonData: string) => {
    try {
      if (!jsonData || typeof jsonData !== 'string') {
        throw new Error('Invalid JSON data');
      }
      return await importSongsFromJSON(jsonData);
    } catch (error) {
      console.error('IPC db:songs:importJSON error:', error);
      throw error;
    }
  });

  // ============ Theme Export/Import ============
  ipcMain.handle('db:themes:exportJSON', async () => {
    try {
      return await exportThemesToJSON();
    } catch (error) {
      console.error('IPC db:themes:exportJSON error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:themes:importJSON', async (event, jsonData: string) => {
    try {
      if (!jsonData || typeof jsonData !== 'string') {
        throw new Error('Invalid JSON data');
      }
      return await importThemesFromJSON(jsonData);
    } catch (error) {
      console.error('IPC db:themes:importJSON error:', error);
      throw error;
    }
  });

  ipcMain.handle('fs:writeFile', async (event, filePath: string, content: string) => {
    try {
      if (!filePath || typeof filePath !== 'string') {
        throw new Error('Invalid file path');
      }
      fs.writeFileSync(filePath, content, 'utf-8');
      return true;
    } catch (error) {
      console.error('IPC fs:writeFile error:', error);
      throw error;
    }
  });

  ipcMain.handle('fs:readFile', async (event, filePath: string) => {
    try {
      if (!filePath || typeof filePath !== 'string') {
        throw new Error('Invalid file path');
      }
      return fs.readFileSync(filePath, 'utf-8');
    } catch (error) {
      console.error('IPC fs:readFile error:', error);
      throw error;
    }
  });

  // ============ Database - Setlists ============

  ipcMain.handle('db:setlists:getAll', async () => {
    try {
      return await getSetlists();
    } catch (error) {
      console.error('IPC db:setlists:getAll error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:setlists:get', async (event, id: string) => {
    try {
      if (!id || typeof id !== 'string' || id.length > MAX_NAME_LENGTH) {
        throw new Error('Invalid setlist ID');
      }
      return await getSetlist(id);
    } catch (error) {
      console.error('IPC db:setlists:get error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:setlists:create', async (event, data) => {
    try {
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid setlist data');
      }
      return await createSetlist(data);
    } catch (error) {
      console.error('IPC db:setlists:create error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:setlists:update', async (event, id: string, data) => {
    try {
      if (!id || typeof id !== 'string' || id.length > MAX_NAME_LENGTH) {
        throw new Error('Invalid setlist ID');
      }
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid setlist data');
      }
      return await updateSetlist(id, data);
    } catch (error) {
      console.error('IPC db:setlists:update error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:setlists:delete', async (event, id: string) => {
    try {
      if (!id || typeof id !== 'string' || id.length > MAX_NAME_LENGTH) {
        throw new Error('Invalid setlist ID');
      }
      return await deleteSetlist(id);
    } catch (error) {
      console.error('IPC db:setlists:delete error:', error);
      throw error;
    }
  });

  // ============ Database - Themes ============

  ipcMain.handle('db:themes:getAll', async () => {
    try {
      return await getThemes();
    } catch (error) {
      console.error('IPC db:themes:getAll error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:themes:get', async (event, id: string) => {
    try {
      if (!id || typeof id !== 'string' || id.length > MAX_NAME_LENGTH) {
        throw new Error('Invalid theme ID');
      }
      return await getTheme(id);
    } catch (error) {
      console.error('IPC db:themes:get error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:themes:create', async (event, data) => {
    try {
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid theme data');
      }
      return await createTheme(data);
    } catch (error) {
      console.error('IPC db:themes:create error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:themes:update', async (event, id: string, data) => {
    try {
      if (!id || typeof id !== 'string' || id.length > MAX_NAME_LENGTH) {
        throw new Error('Invalid theme ID');
      }
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid theme data');
      }
      return await updateTheme(id, data);
    } catch (error) {
      console.error('IPC db:themes:update error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:themes:delete', async (event, id: string) => {
    try {
      if (!id || typeof id !== 'string' || id.length > MAX_NAME_LENGTH) {
        throw new Error('Invalid theme ID');
      }
      return await deleteTheme(id);
    } catch (error) {
      console.error('IPC db:themes:delete error:', error);
      throw error;
    }
  });

  // ============ Database - Stage Monitor Themes ============

  ipcMain.handle('db:stageThemes:getAll', async () => {
    try {
      return getStageThemes();
    } catch (error) {
      console.error('IPC db:stageThemes:getAll error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:stageThemes:get', async (event, id: string) => {
    try {
      if (!id || typeof id !== 'string' || id.length > MAX_NAME_LENGTH) {
        throw new Error('Invalid stage theme ID');
      }
      return getStageTheme(id);
    } catch (error) {
      console.error('IPC db:stageThemes:get error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:stageThemes:create', async (event, data) => {
    try {
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid stage theme data');
      }
      return createStageTheme(data);
    } catch (error) {
      console.error('IPC db:stageThemes:create error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:stageThemes:update', async (event, id: string, data) => {
    try {
      if (!id || typeof id !== 'string' || id.length > MAX_NAME_LENGTH) {
        throw new Error('Invalid stage theme ID');
      }
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid stage theme data');
      }
      return updateStageTheme(id, data);
    } catch (error) {
      console.error('IPC db:stageThemes:update error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:stageThemes:delete', async (event, id: string) => {
    try {
      if (!id || typeof id !== 'string' || id.length > MAX_NAME_LENGTH) {
        throw new Error('Invalid stage theme ID');
      }
      return deleteStageTheme(id);
    } catch (error) {
      console.error('IPC db:stageThemes:delete error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:stageThemes:duplicate', async (event, id: string, newName?: string) => {
    try {
      if (!id || typeof id !== 'string' || id.length > MAX_NAME_LENGTH) {
        throw new Error('Invalid stage theme ID');
      }
      if (newName !== undefined && (typeof newName !== 'string' || newName.length > MAX_NAME_LENGTH)) {
        throw new Error('Invalid new name');
      }
      return duplicateStageTheme(id, newName);
    } catch (error) {
      console.error('IPC db:stageThemes:duplicate error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:stageThemes:setDefault', async (event, id: string) => {
    try {
      if (!id || typeof id !== 'string' || id.length > MAX_NAME_LENGTH) {
        throw new Error('Invalid stage theme ID');
      }
      return setDefaultStageTheme(id);
    } catch (error) {
      console.error('IPC db:stageThemes:setDefault error:', error);
      throw error;
    }
  });

  ipcMain.handle('stageTheme:apply', (event, theme) => {
    if (!theme || typeof theme !== 'object') {
      throw new Error('Invalid stage theme data');
    }
    displayManager.broadcastStageTheme(theme);
    return true;
  });

  // ============ Database - Bible Themes ============

  ipcMain.handle('db:bibleThemes:getAll', async () => {
    try {
      return await getBibleThemes();
    } catch (error) {
      console.error('IPC db:bibleThemes:getAll error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:bibleThemes:get', async (event, id: string) => {
    try {
      if (!id || typeof id !== 'string' || id.length > MAX_NAME_LENGTH) {
        throw new Error('Invalid bible theme ID');
      }
      return await getBibleTheme(id);
    } catch (error) {
      console.error('IPC db:bibleThemes:get error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:bibleThemes:getDefault', async () => {
    try {
      return await getDefaultBibleTheme();
    } catch (error) {
      console.error('IPC db:bibleThemes:getDefault error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:bibleThemes:create', async (event, data) => {
    try {
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid bible theme data');
      }
      return await createBibleTheme(data);
    } catch (error) {
      console.error('IPC db:bibleThemes:create error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:bibleThemes:update', async (event, id: string, data) => {
    try {
      if (!id || typeof id !== 'string' || id.length > MAX_NAME_LENGTH) {
        throw new Error('Invalid bible theme ID');
      }
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid bible theme data');
      }
      return await updateBibleTheme(id, data);
    } catch (error) {
      console.error('IPC db:bibleThemes:update error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:bibleThemes:delete', async (event, id: string) => {
    try {
      if (!id || typeof id !== 'string' || id.length > MAX_NAME_LENGTH) {
        throw new Error('Invalid bible theme ID');
      }
      return await deleteBibleTheme(id);
    } catch (error) {
      console.error('IPC db:bibleThemes:delete error:', error);
      throw error;
    }
  });

  ipcMain.handle('bibleTheme:apply', (event, theme) => {
    if (!theme || typeof theme !== 'object') {
      throw new Error('Invalid bible theme data');
    }
    displayManager.broadcastBibleTheme(theme);
    socketService.broadcastBibleTheme(theme);
    return true;
  });

  // ============ Database - OBS Themes ============

  ipcMain.handle('db:obsThemes:getAll', async (event, type?: OBSThemeType) => {
    try {
      return await getOBSThemes(type);
    } catch (error) {
      console.error('IPC db:obsThemes:getAll error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:obsThemes:get', async (event, id: string) => {
    try {
      if (!id || typeof id !== 'string' || id.length > MAX_NAME_LENGTH) {
        throw new Error('Invalid OBS theme ID');
      }
      return await getOBSTheme(id);
    } catch (error) {
      console.error('IPC db:obsThemes:get error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:obsThemes:getDefault', async (event, type: OBSThemeType) => {
    try {
      if (type && !['songs', 'bible', 'prayer'].includes(type)) {
        throw new Error('Invalid OBS theme type');
      }
      return await getDefaultOBSTheme(type);
    } catch (error) {
      console.error('IPC db:obsThemes:getDefault error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:obsThemes:create', async (event, data) => {
    try {
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid OBS theme data');
      }
      const theme = await createOBSTheme(data);
      // Broadcast new theme to OBS overlay if server is running
      if (theme && obsServer.isRunning()) {
        obsServer.updateTheme(theme);
      }
      return theme;
    } catch (error) {
      console.error('IPC db:obsThemes:create error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:obsThemes:update', async (event, id: string, data) => {
    try {
      if (!id || typeof id !== 'string' || id.length > MAX_NAME_LENGTH) {
        throw new Error('Invalid OBS theme ID');
      }
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid OBS theme data');
      }
      const theme = await updateOBSTheme(id, data);
      // Broadcast updated theme to OBS overlay if server is running
      if (theme && obsServer.isRunning()) {
        obsServer.updateTheme(theme);
      }
      return theme;
    } catch (error) {
      console.error('IPC db:obsThemes:update error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:obsThemes:delete', async (event, id: string) => {
    try {
      if (!id || typeof id !== 'string' || id.length > MAX_NAME_LENGTH) {
        throw new Error('Invalid OBS theme ID');
      }
      return await deleteOBSTheme(id);
    } catch (error) {
      console.error('IPC db:obsThemes:delete error:', error);
      throw error;
    }
  });

  // ============ Database - Prayer Themes ============

  ipcMain.handle('db:prayerThemes:getAll', async () => {
    try {
      return await getPrayerThemes();
    } catch (error) {
      console.error('IPC db:prayerThemes:getAll error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:prayerThemes:get', async (event, id: string) => {
    try {
      if (!id || typeof id !== 'string' || id.length > MAX_NAME_LENGTH) {
        throw new Error('Invalid prayer theme ID');
      }
      return await getPrayerTheme(id);
    } catch (error) {
      console.error('IPC db:prayerThemes:get error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:prayerThemes:getDefault', async () => {
    try {
      return await getDefaultPrayerTheme();
    } catch (error) {
      console.error('IPC db:prayerThemes:getDefault error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:prayerThemes:create', async (event, data) => {
    try {
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid prayer theme data');
      }
      return await createPrayerTheme(data);
    } catch (error) {
      console.error('IPC db:prayerThemes:create error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:prayerThemes:update', async (event, id: string, data) => {
    try {
      if (!id || typeof id !== 'string' || id.length > MAX_NAME_LENGTH) {
        throw new Error('Invalid prayer theme ID');
      }
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid prayer theme data');
      }
      return await updatePrayerTheme(id, data);
    } catch (error) {
      console.error('IPC db:prayerThemes:update error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:prayerThemes:delete', async (event, id: string) => {
    try {
      if (!id || typeof id !== 'string' || id.length > MAX_NAME_LENGTH) {
        throw new Error('Invalid prayer theme ID');
      }
      return await deletePrayerTheme(id);
    } catch (error) {
      console.error('IPC db:prayerThemes:delete error:', error);
      throw error;
    }
  });

  ipcMain.handle('prayerTheme:apply', (event, theme) => {
    if (!theme || typeof theme !== 'object') {
      throw new Error('Invalid prayer theme data');
    }
    displayManager.broadcastPrayerTheme(theme);
    socketService.broadcastPrayerTheme(theme);
    return true;
  });

  // ============ Theme Selection Persistence ============

  ipcMain.handle('settings:getSelectedThemeIds', () => {
    return getSelectedThemeIds();
  });

  ipcMain.handle('settings:saveSelectedThemeId', (event, themeType: 'viewer' | 'stage' | 'bible' | 'obs' | 'obsBible' | 'prayer' | 'obsPrayer', themeId: string | null) => {
    // Validate themeType
    const validTypes = ['viewer', 'stage', 'bible', 'obs', 'obsBible', 'prayer', 'obsPrayer'];
    if (!themeType || !validTypes.includes(themeType)) {
      throw new Error('Invalid theme type');
    }
    // Validate themeId (if not null)
    if (themeId !== null && (typeof themeId !== 'string' || themeId.length > MAX_NAME_LENGTH)) {
      throw new Error('Invalid theme ID');
    }
    saveSelectedThemeId(themeType, themeId);
    return true;
  });

  // ============ Database - Presentations ============

  ipcMain.handle('db:presentations:getAll', async () => {
    try {
      return await getPresentations();
    } catch (error) {
      console.error('IPC db:presentations:getAll error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:presentations:get', async (event, id: string) => {
    try {
      return await getPresentation(id);
    } catch (error) {
      console.error('IPC db:presentations:get error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:presentations:create', async (event, data) => {
    try {
      return await createPresentation(data);
    } catch (error) {
      console.error('IPC db:presentations:create error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:presentations:update', async (event, id: string, data) => {
    try {
      return await updatePresentation(id, data);
    } catch (error) {
      console.error('IPC db:presentations:update error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:presentations:delete', async (event, id: string) => {
    try {
      return await deletePresentation(id);
    } catch (error) {
      console.error('IPC db:presentations:delete error:', error);
      throw error;
    }
  });

  // ============ Database - Audio Playlists ============

  ipcMain.handle('db:audioPlaylists:getAll', async () => {
    try {
      return await getAudioPlaylists();
    } catch (error) {
      console.error('IPC db:audioPlaylists:getAll error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:audioPlaylists:get', async (event, id: string) => {
    try {
      if (!id || typeof id !== 'string' || id.length > MAX_NAME_LENGTH) {
        throw new Error('Invalid audio playlist ID');
      }
      return await getAudioPlaylist(id);
    } catch (error) {
      console.error('IPC db:audioPlaylists:get error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:audioPlaylists:create', async (event, data) => {
    try {
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid audio playlist data');
      }
      return await createAudioPlaylist(data);
    } catch (error) {
      console.error('IPC db:audioPlaylists:create error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:audioPlaylists:update', async (event, id: string, data) => {
    try {
      if (!id || typeof id !== 'string' || id.length > MAX_NAME_LENGTH) {
        throw new Error('Invalid audio playlist ID');
      }
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid audio playlist data');
      }
      return await updateAudioPlaylist(id, data);
    } catch (error) {
      console.error('IPC db:audioPlaylists:update error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:audioPlaylists:delete', async (event, id: string) => {
    try {
      if (!id || typeof id !== 'string' || id.length > MAX_NAME_LENGTH) {
        throw new Error('Invalid audio playlist ID');
      }
      return await deleteAudioPlaylist(id);
    } catch (error) {
      console.error('IPC db:audioPlaylists:delete error:', error);
      throw error;
    }
  });

  // ============ Bible ============

  ipcMain.handle('bible:getBooks', async () => {
    try {
      return getBibleBooks();
    } catch (error) {
      console.error('[IPC bible:getBooks] Failed to get Bible books:', error);
      return [];
    }
  });

  ipcMain.handle('bible:getVerses', async (event, bookName: string, chapter: number) => {
    try {
      const response = await getBibleVerses(bookName, chapter);
      return {
        ...response,
        slides: versesToSlides(response.verses, bookName, chapter)
      };
    } catch (error) {
      console.error('[IPC bible:getVerses] Failed to get verses:', error);
      return { verses: [], slides: [], error: error instanceof Error ? error.message : 'Failed to load verses' };
    }
  });

  // ============ Text Processing Services ============

  ipcMain.handle('service:transliterate', async (event, text: string) => {
    if (!text || typeof text !== 'string') {
      return '';
    }
    return transliterate(text);
  });

  ipcMain.handle('service:translate', async (event, text: string) => {
    if (!text || typeof text !== 'string') {
      return '';
    }
    return translate(text);
  });

  ipcMain.handle('service:quickSlide', async (event, text: string) => {
    if (!text || typeof text !== 'string') {
      return { original: '', transliteration: '', translation: '' };
    }
    return processQuickSlide(text);
  });

  // ============ Online Mode (Socket.IO) ============

  ipcMain.handle('online:connect', async (event, serverUrl: string, token: string) => {
    try {
      return await socketService.connect(serverUrl, token);
    } catch (error) {
      console.error('IPC online:connect error:', error);
      throw error;
    }
  });

  ipcMain.handle('online:disconnect', () => {
    socketService.disconnect();
    return true;
  });

  ipcMain.handle('online:createRoom', async () => {
    try {
      return await socketService.createRoom();
    } catch (error) {
      console.error('IPC online:createRoom error:', error);
      throw error;
    }
  });

  ipcMain.handle('online:getStatus', () => {
    return socketService.getStatus();
  });

  ipcMain.handle('online:getViewerCount', () => {
    return socketService.getViewerCount();
  });

  ipcMain.handle('online:getPublicRooms', async () => {
    try {
      return await socketService.getPublicRooms();
    } catch (error) {
      console.error('IPC online:getPublicRooms error:', error);
      throw error;
    }
  });

  ipcMain.handle('online:switchToPublicRoom', async (event, publicRoomId: string | null) => {
    try {
      return await socketService.switchToPublicRoom(publicRoomId);
    } catch (error) {
      console.error('IPC online:switchToPublicRoom error:', error);
      throw error;
    }
  });

  ipcMain.handle('online:createPublicRoom', async (event, name: string) => {
    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new Error('Room name is required');
    }
    try {
      return await socketService.createPublicRoom(name);
    } catch (error) {
      console.error('IPC online:createPublicRoom error:', error);
      throw error;
    }
  });

  ipcMain.handle('online:linkPublicRoom', async (event, publicRoomId: string) => {
    if (!publicRoomId || typeof publicRoomId !== 'string') {
      throw new Error('Public room ID is required');
    }
    try {
      return await socketService.linkPublicRoom(publicRoomId);
    } catch (error) {
      console.error('IPC online:linkPublicRoom error:', error);
      throw error;
    }
  });

  ipcMain.handle('online:unlinkPublicRoom', async (event, publicRoomId: string) => {
    if (!publicRoomId || typeof publicRoomId !== 'string') {
      throw new Error('Public room ID is required');
    }
    try {
      return await socketService.unlinkPublicRoom(publicRoomId);
    } catch (error) {
      console.error('IPC online:unlinkPublicRoom error:', error);
      throw error;
    }
  });

  ipcMain.handle('qrcode:generate', async (event, url: string) => {
    if (!url || typeof url !== 'string') {
      return null;
    }
    try {
      return await QRCode.toDataURL(url, {
        width: 200,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' }
      });
    } catch (error) {
      console.error('IPC qrcode:generate error:', error);
      return null;
    }
  });

  // ============ App ============

  ipcMain.handle('app:version', () => {
    return app.getVersion();
  });

  ipcMain.handle('app:getPath', (event, name: string) => {
    return app.getPath(name as any);
  });

  ipcMain.handle('app:openExternal', (event, url: string) => {
    // Validate URL scheme for security - only allow http/https
    if (!url || typeof url !== 'string') {
      console.error('[IPC app:openExternal] Invalid URL provided');
      return false;
    }

    try {
      const parsedUrl = new URL(url);
      const allowedProtocols = ['http:', 'https:'];

      if (!allowedProtocols.includes(parsedUrl.protocol)) {
        console.error('[IPC app:openExternal] Blocked unsafe protocol:', parsedUrl.protocol);
        return false;
      }

      shell.openExternal(url);
      return true;
    } catch (error) {
      console.error('[IPC app:openExternal] Invalid URL:', error);
      return false;
    }
  });

  // ============ File Dialogs ============

  ipcMain.handle('dialog:openFile', async (event, options) => {
    return dialog.showOpenDialog(options);
  });

  ipcMain.handle('dialog:saveFile', async (event, options) => {
    return dialog.showSaveDialog(options);
  });

  // ============ Authentication ============

  ipcMain.handle('auth:login', async (event, email: string, password: string, serverUrl?: string) => {
    try {
      return await authService.login(email, password, serverUrl);
    } catch (error) {
      console.error('IPC auth:login error:', error);
      throw error;
    }
  });

  ipcMain.handle('auth:register', async (event, email: string, password: string, serverUrl?: string) => {
    try {
      return await authService.register(email, password, serverUrl);
    } catch (error) {
      console.error('IPC auth:register error:', error);
      throw error;
    }
  });

  ipcMain.handle('auth:logout', () => {
    try {
      authService.logout();
      socketService.disconnect();
      return true;
    } catch (error) {
      console.error('IPC auth:logout error:', error);
      throw error;
    }
  });

  ipcMain.handle('auth:getState', async () => {
    try {
      return await authService.getState();
    } catch (error) {
      console.error('IPC auth:getState error:', error);
      throw error;
    }
  });

  ipcMain.handle('auth:initialize', async () => {
    try {
      return await authService.initialize();
    } catch (error) {
      console.error('IPC auth:initialize error:', error);
      throw error;
    }
  });

  ipcMain.handle('auth:setServerUrl', (event, url: string) => {
    authService.setServerUrl(url);
    return true;
  });

  // ============ Online Mode (with Auth Integration) ============

  ipcMain.handle('online:fetchSetlists', async () => {
    try {
      return await socketService.fetchOnlineSetlists();
    } catch (error) {
      console.error('IPC online:fetchSetlists error:', error);
      return [];
    }
  });

  ipcMain.handle('online:fetchSetlist', async (event, id: string) => {
    if (!id || typeof id !== 'string') {
      return null;
    }
    try {
      return await socketService.fetchOnlineSetlist(id);
    } catch (error) {
      console.error('IPC online:fetchSetlist error:', error);
      return null;
    }
  });

  ipcMain.handle('db:songs:getByRemoteId', async (event, remoteId: string) => {
    if (!remoteId || typeof remoteId !== 'string') {
      return null;
    }
    try {
      return await getSongByRemoteId(remoteId);
    } catch (error) {
      console.error('IPC db:songs:getByRemoteId error:', error);
      return null;
    }
  });

  ipcMain.handle('db:songs:getByTitle', async (event, title: string) => {
    if (!title || typeof title !== 'string') {
      return null;
    }
    try {
      return await getSongByTitle(title);
    } catch (error) {
      console.error('IPC db:songs:getByTitle error:', error);
      return null;
    }
  });

  ipcMain.handle('db:songs:batchResolve', async (event, items: Array<{ remoteId?: string; title?: string }>) => {
    if (!Array.isArray(items)) {
      return {};
    }
    try {
      return await batchResolveSongs(items);
    } catch (error) {
      console.error('IPC db:songs:batchResolve error:', error);
      return {};
    }
  });

  ipcMain.handle('online:connectWithAuth', async () => {
    const token = authService.getToken();
    const serverUrl = authService.getServerUrl();
    const userId = authService.getUserId();

    if (!token) {
      return { success: false, error: 'Not authenticated' };
    }

    const connected = await socketService.connect(serverUrl, token, userId || undefined);
    return { success: connected };
  });

  // ============ YouTube Control ============

  ipcMain.handle('youtube:load', (event, videoId: string, title: string) => {
    // Validate inputs
    if (!videoId || typeof videoId !== 'string') {
      console.error('[IPC] youtube:load: invalid videoId');
      return false;
    }
    // Sanitize videoId - YouTube IDs are alphanumeric with - and _
    const sanitizedVideoId = videoId.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, MAX_YOUTUBE_VIDEO_ID_LENGTH);
    if (sanitizedVideoId !== videoId || sanitizedVideoId.length === 0) {
      console.error('[IPC] youtube:load: invalid videoId format');
      return false;
    }
    const sanitizedTitle = typeof title === 'string' ? title.substring(0, MAX_YOUTUBE_TITLE_LENGTH) : '';

    // Broadcast to online viewers
    socketService.youtubeLoad(sanitizedVideoId, sanitizedTitle);
    // Broadcast to local display windows
    displayManager.broadcastYoutube({ type: 'load', videoId: sanitizedVideoId, title: sanitizedTitle });
    return true;
  });

  ipcMain.handle('youtube:play', (event, currentTime: number) => {
    if (typeof currentTime !== 'number' || isNaN(currentTime) || currentTime < 0) {
      console.error('[IPC] youtube:play: invalid currentTime', currentTime);
      return false;
    }
    socketService.youtubePlay(currentTime);
    displayManager.broadcastYoutube({ type: 'play', currentTime });
    return true;
  });

  ipcMain.handle('youtube:pause', (event, currentTime: number) => {
    if (typeof currentTime !== 'number' || isNaN(currentTime) || currentTime < 0) {
      console.error('[IPC] youtube:pause: invalid currentTime', currentTime);
      return false;
    }
    socketService.youtubePause(currentTime);
    displayManager.broadcastYoutube({ type: 'pause', currentTime });
    return true;
  });

  ipcMain.handle('youtube:seek', (event, currentTime: number) => {
    if (typeof currentTime !== 'number' || isNaN(currentTime) || currentTime < 0) {
      console.error('[IPC] youtube:seek: invalid currentTime', currentTime);
      return false;
    }
    socketService.youtubeSeek(currentTime);
    displayManager.broadcastYoutube({ type: 'seek', currentTime });
    return true;
  });

  ipcMain.handle('youtube:stop', () => {
    socketService.youtubeStop();
    displayManager.broadcastYoutube({ type: 'stop' });
    return true;
  });

  // Throttled YouTube sync - limits to 5 syncs per second to prevent flooding
  const throttledYoutubeSync = createThrottle((currentTime: number, isPlaying: boolean) => {
    socketService.youtubeSync(currentTime, isPlaying);
    displayManager.broadcastYoutube({ type: 'sync', currentTime, isPlaying });
  }, YOUTUBE_SYNC_INTERVAL_MS);

  ipcMain.handle('youtube:sync', (event, currentTime: number, isPlaying: boolean) => {
    if (typeof currentTime !== 'number' || isNaN(currentTime) || currentTime < 0) {
      console.error('[IPC] youtube:sync: invalid currentTime', currentTime);
      return false;
    }
    if (typeof isPlaying !== 'boolean') {
      console.error('[IPC] youtube:sync: invalid isPlaying', isPlaying);
      return false;
    }
    throttledYoutubeSync(currentTime, isPlaying);
    return true;
  });

  // YouTube search using Piped API (no API key required)
  ipcMain.handle('youtube:search', async (event, query: string, timeoutMs?: number) => {
    // Use provided timeout or fall back to default
    const searchTimeout = (typeof timeoutMs === 'number' && timeoutMs > 0) ? timeoutMs : YOUTUBE_SEARCH_TIMEOUT_MS;

    const instances = [
      'https://api.piped.private.coffee',
      'https://pipedapi.kavin.rocks',
      'https://pipedapi.r4fo.com'
    ];

    for (const instance of instances) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), searchTimeout);

      try {
        const response = await fetch(
          `${instance}/search?q=${encodeURIComponent(query)}&filter=videos`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        let data: any;
        try {
          data = await response.json();
        } catch (parseError) {
          throw new Error(`Failed to parse response as JSON: ${parseError}`);
        }

        const results = (data.items || [])
          .filter((item: any) => item.type === 'stream')
          .slice(0, MAX_YOUTUBE_SEARCH_RESULTS)
          .map((item: any) => {
            const videoId = item.url?.replace('/watch?v=', '') || '';
            return {
              videoId,
              title: item.title || '',
              thumbnail: item.thumbnail || `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
              channelTitle: item.uploaderName || ''
            };
          })
          .filter((item: any) => item.videoId);

        return { success: true, results };
      } catch (error) {
        console.warn(`Piped instance ${instance} failed:`, error);
      } finally {
        // Always clear the timeout to prevent memory leaks
        clearTimeout(timeout);
      }
    }

    return { success: false, error: 'All instances failed' };
  });

  // ============ Remote Control ============

  ipcMain.handle('remoteControl:start', async () => {
    try {
      const result = await remoteControlServer.start();
      return { success: true, ...result };
    } catch (err) {
      console.error('[IPC remoteControl:start] Error:', err);
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('remoteControl:stop', () => {
    remoteControlServer.stop();
    return true;
  });

  ipcMain.handle('remoteControl:getStatus', () => {
    return remoteControlServer.getStatus();
  });

  ipcMain.handle('remoteControl:getQRCode', async () => {
    const status = remoteControlServer.getStatus();
    if (!status.running || !status.url) {
      return null;
    }
    // Create URL with PIN for auto-authentication
    const urlWithPin = `${status.url}?pin=${status.pin}`;
    try {
      const qrDataUrl = await QRCode.toDataURL(urlWithPin, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });
      return qrDataUrl;
    } catch (err) {
      console.error('[IPC remoteControl:getQRCode] Error:', err);
      return null;
    }
  });

  ipcMain.on('remoteControl:updateState', (event, state: Partial<RemoteControlState>) => {
    remoteControlServer.updateState(state);
  });

  ipcMain.on('remoteControl:setCommandHandlerActive', (event, active: boolean) => {
    remoteControlServer.setCommandHandlerActive(active);
  });

  ipcMain.handle('remoteControl:getSetlist', () => {
    return remoteControlServer.getSetlist();
  });

  // Set control window reference for remote control
  if (controlWindowRef) {
    remoteControlServer.setControlWindow(controlWindowRef);
  }

  // Set up theme resolvers for per-display theme overrides
  // Use synchronous queryOne directly since the async functions return Promises
  displayManager.setThemeResolvers({
    viewer: (id: string) => queryOne('SELECT * FROM viewer_themes WHERE id = ?', [id]),
    stage: (id: string) => queryOne('SELECT * FROM stage_themes WHERE id = ?', [id]),
    bible: (id: string) => queryOne('SELECT * FROM bible_themes WHERE id = ?', [id]),
    prayer: (id: string) => queryOne('SELECT * FROM prayer_themes WHERE id = ?', [id])
  });

  // Set up default theme resolvers to load default themes when none are set
  displayManager.setDefaultThemeResolvers({
    viewer: () => queryOne('SELECT * FROM viewer_themes WHERE isDefault = 1'),
    bible: () => queryOne('SELECT * FROM bible_themes WHERE isDefault = 1'),
    prayer: () => queryOne('SELECT * FROM prayer_themes WHERE isDefault = 1')
  });

  // ============ Display Theme Overrides ============

  ipcMain.handle('displayThemeOverrides:getAll', () => {
    try {
      return getAllDisplayThemeOverrides();
    } catch (error) {
      console.error('[IPC displayThemeOverrides:getAll] Error:', error);
      return [];
    }
  });

  ipcMain.handle('displayThemeOverrides:getForDisplay', (event, displayId: number) => {
    try {
      if (typeof displayId !== 'number' || isNaN(displayId)) {
        throw new Error('Invalid display ID');
      }
      return getDisplayThemeOverrides(displayId);
    } catch (error) {
      console.error('[IPC displayThemeOverrides:getForDisplay] Error:', error);
      return [];
    }
  });

  ipcMain.handle('displayThemeOverrides:get', (event, displayId: number, themeType: DisplayThemeType) => {
    try {
      if (typeof displayId !== 'number' || isNaN(displayId)) {
        throw new Error('Invalid display ID');
      }
      const validTypes: DisplayThemeType[] = ['viewer', 'stage', 'bible', 'prayer'];
      if (!validTypes.includes(themeType)) {
        throw new Error('Invalid theme type');
      }
      return getDisplayThemeOverride(displayId, themeType);
    } catch (error) {
      console.error('[IPC displayThemeOverrides:get] Error:', error);
      return null;
    }
  });

  ipcMain.handle('displayThemeOverrides:set', (event, displayId: number, themeType: DisplayThemeType, themeId: string) => {
    try {
      if (typeof displayId !== 'number' || isNaN(displayId)) {
        throw new Error('Invalid display ID');
      }
      const validTypes: DisplayThemeType[] = ['viewer', 'stage', 'bible', 'prayer'];
      if (!validTypes.includes(themeType)) {
        throw new Error('Invalid theme type');
      }
      if (!themeId || typeof themeId !== 'string' || themeId.length > MAX_NAME_LENGTH) {
        throw new Error('Invalid theme ID');
      }
      const result = setDisplayThemeOverride(displayId, themeType, themeId);
      // Re-broadcast themes to apply the new override immediately
      displayManager.rebroadcastAllThemes();
      return result;
    } catch (error) {
      console.error('[IPC displayThemeOverrides:set] Error:', error);
      return null;
    }
  });

  ipcMain.handle('displayThemeOverrides:remove', (event, displayId: number, themeType: DisplayThemeType) => {
    try {
      if (typeof displayId !== 'number' || isNaN(displayId)) {
        throw new Error('Invalid display ID');
      }
      const validTypes: DisplayThemeType[] = ['viewer', 'stage', 'bible', 'prayer'];
      if (!validTypes.includes(themeType)) {
        throw new Error('Invalid theme type');
      }
      const result = removeDisplayThemeOverride(displayId, themeType);
      // Re-broadcast themes to apply the change immediately
      displayManager.rebroadcastAllThemes();
      return result;
    } catch (error) {
      console.error('[IPC displayThemeOverrides:remove] Error:', error);
      return false;
    }
  });

  ipcMain.handle('displayThemeOverrides:removeAllForDisplay', (event, displayId: number) => {
    try {
      if (typeof displayId !== 'number' || isNaN(displayId)) {
        throw new Error('Invalid display ID');
      }
      const result = removeAllDisplayThemeOverrides(displayId);
      // Re-broadcast themes to apply the change immediately
      displayManager.rebroadcastAllThemes();
      return result;
    } catch (error) {
      console.error('[IPC displayThemeOverrides:removeAllForDisplay] Error:', error);
      return false;
    }
  });

  ipcMain.handle('displayThemeOverrides:rebroadcast', () => {
    try {
      displayManager.rebroadcastAllThemes();
      return true;
    } catch (error) {
      console.error('[IPC displayThemeOverrides:rebroadcast] Error:', error);
      return false;
    }
  });
}
