import { ipcMain, dialog, app, shell, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { DisplayManager } from '../windows/displayManager';
import { getSongs, getSong, createSong, updateSong, deleteSong, importSongsFromBackend } from '../database/songs';
import { getSetlists, getSetlist, createSetlist, updateSetlist, deleteSetlist } from '../database/setlists';
import { getThemes, getTheme, createTheme, updateTheme, deleteTheme } from '../database/themes';
import { getStageThemes, getStageTheme, createStageTheme, updateStageTheme, deleteStageTheme, duplicateStageTheme, setDefaultStageTheme } from '../database/stageThemes';
import { getBibleThemes, getBibleTheme, createBibleTheme, updateBibleTheme, deleteBibleTheme, getDefaultBibleTheme } from '../database/bibleThemes';
import { getOBSThemes, getOBSTheme, createOBSTheme, updateOBSTheme, deleteOBSTheme, getDefaultOBSTheme, OBSThemeType } from '../database/obsThemes';
import { getPrayerThemes, getPrayerTheme, createPrayerTheme, updatePrayerTheme, deletePrayerTheme, getDefaultPrayerTheme } from '../database/prayerThemes';
import { getPresentations, getPresentation, createPresentation, updatePresentation, deletePresentation } from '../database/presentations';
import { getSelectedThemeIds, saveSelectedThemeId } from '../database/index';
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

let mediaManager: MediaManager;
let socketService: SocketService;
let controlWindowRef: BrowserWindow | null = null;

export function setSocketControlWindow(window: import('electron').BrowserWindow): void {
  controlWindowRef = window;
  if (socketService) {
    socketService.setControlWindow(window);
  }
}

export function registerIpcHandlers(displayManager: DisplayManager): void {
  mediaManager = new MediaManager();
  socketService = new SocketService();

  // Initialize auth service
  authService.initialize().catch(err => console.error('Auth init failed:', err));

  // ============ Display Management ============

  ipcMain.handle('displays:getAll', () => {
    return displayManager.getAllDisplays();
  });

  ipcMain.handle('displays:getExternal', () => {
    return displayManager.getExternalDisplays();
  });

  ipcMain.handle('displays:open', (event, displayId: number, type: 'viewer' | 'stage') => {
    return displayManager.openDisplayWindow(displayId, type);
  });

  ipcMain.handle('displays:close', (event, displayId: number) => {
    displayManager.closeDisplayWindow(displayId);
    return true;
  });

  ipcMain.handle('displays:closeAll', () => {
    displayManager.closeAllDisplays();
    return true;
  });

  ipcMain.handle('displays:captureViewer', async () => {
    return displayManager.captureViewerThumbnail();
  });

  // ============ OBS Browser Source Server ============

  ipcMain.handle('obs:start', async () => {
    console.log('[IPC obs:start] Starting OBS server...');
    try {
      const port = await obsServer.start();
      console.log('[IPC obs:start] Server started on port:', port);
      return { success: true, url: obsServer.getUrl(), port };
    } catch (err) {
      console.error('[IPC obs:start] Error:', err);
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('obs:stop', () => {
    console.log('[IPC obs:stop] Stopping OBS server...');
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
    const port = await obsServer.start();
    return { success: true, url: obsServer.getUrl(), port };
  });

  ipcMain.handle('obs:close', () => {
    obsServer.stop();
    return true;
  });

  ipcMain.handle('obs:isOpen', () => {
    return obsServer.isRunning();
  });

  // ============ Slide Control ============

  ipcMain.handle('slides:send', (event, slideData) => {
    console.log('[IPC slides:send] backgroundImage:', slideData.backgroundImage);
    displayManager.broadcastSlide(slideData);
    socketService.broadcastSlide(slideData);
    // Also send to OBS Browser Source server
    obsServer.updateSlide(slideData);
    return true;
  });

  ipcMain.handle('slides:blank', () => {
    displayManager.broadcastSlide({ isBlank: true });
    socketService.broadcastSlide({ isBlank: true });
    // Also send to OBS Browser Source server
    obsServer.updateSlide({ isBlank: true });
    return true;
  });

  ipcMain.handle('theme:apply', (event, theme) => {
    console.log('theme:apply IPC called');
    console.log('  - name:', theme?.name);
    console.log('  - has linePositions:', !!theme?.linePositions);
    console.log('  - has backgroundBoxes:', !!theme?.backgroundBoxes);
    console.log('  - linePositions keys:', theme?.linePositions ? Object.keys(theme.linePositions) : 'none');
    displayManager.broadcastTheme(theme);
    socketService.broadcastTheme(theme);
    return true;
  });

  ipcMain.handle('background:set', (event, background: string) => {
    console.log('background:set IPC called with:', background.substring(0, 50));
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
    return true;
  });

  // Display fullscreen media (images/videos) - uses proper media broadcast
  ipcMain.handle('media:display', (event, mediaData: { type: 'image' | 'video'; url: string }) => {
    console.log('media:display IPC called:', mediaData.type, mediaData.url.substring(0, 50));

    // Broadcast to local display windows with proper type info
    displayManager.broadcastMedia({ type: mediaData.type, path: mediaData.url });

    // For online viewers, show local media overlay (they can't access local files)
    socketService.broadcastLocalMediaStatus(true);

    return true;
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
    console.log('media:clear IPC called');

    // Clear media on local displays
    displayManager.broadcastMedia({ type: 'image', path: '' });

    // Hide local media overlay for online viewers
    socketService.broadcastLocalMediaStatus(false);

    return true;
  });

  // ============ Tools (Countdown, Announcements) ============

  ipcMain.handle('tools:send', (event, toolData) => {
    displayManager.broadcastTool(toolData);
    socketService.broadcastTool(toolData);
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
    await mediaManager.rescanFolder(folderId);
    return true;
  });

  // ============ Media Library (Imported Media) ============

  ipcMain.handle('mediaLibrary:import', async () => {
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

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, imported: [] };
    }

    const imported: MediaItem[] = [];
    const errors: string[] = [];

    const videoExtensions = ['.mp4', '.mov', '.m4v', '.webm', '.mkv', '.avi'];
    const audioExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac'];

    for (const filePath of result.filePaths) {
      try {
        // Check if already imported
        if (isMediaImported(filePath)) {
          console.log(`[mediaLibrary] Already imported: ${filePath}`);
          continue;
        }

        const fileName = path.basename(filePath);
        const ext = path.extname(filePath).toLowerCase();
        const stat = await fs.promises.stat(filePath);
        const isVideo = videoExtensions.includes(ext);
        const isAudio = audioExtensions.includes(ext);
        const mediaType = isVideo ? 'video' : isAudio ? 'audio' : 'image';

        console.log(`[mediaLibrary] Importing ${mediaType}: ${fileName}`);

        // Process the file
        let processResult;
        if (isVideo) {
          processResult = await processVideo(filePath, fileName);
        } else if (isAudio) {
          processResult = await processAudio(filePath, fileName);
        } else {
          processResult = await processImage(filePath, fileName);
        }

        if (!processResult.success) {
          errors.push(`Failed to process ${fileName}: ${processResult.error}`);
          continue;
        }

        // Add to database
        const mediaItem = addMediaItem({
          name: fileName,
          type: mediaType,
          originalPath: filePath,
          processedPath: processResult.processedPath,
          duration: processResult.duration,
          thumbnailPath: null,
          fileSize: stat.size,
          folderId: null,
          tags: null
        });

        imported.push(mediaItem);
        console.log(`[mediaLibrary] Imported: ${fileName}`);
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
    return getMediaItem(id);
  });

  ipcMain.handle('mediaLibrary:delete', async (event, id: string) => {
    const item = getMediaItem(id);
    if (item) {
      // Delete processed file
      await deleteProcessedMedia(item.processedPath);
      // Delete from database
      deleteMediaItem(id);
    }
    return true;
  });

  ipcMain.handle('mediaLibrary:getPath', () => {
    return getMediaLibraryPath();
  });

  ipcMain.handle('mediaLibrary:move', (event, mediaId: string, folderId: string | null) => {
    return moveMediaToFolder(mediaId, folderId);
  });

  ipcMain.handle('mediaLibrary:rename', (event, mediaId: string, name: string) => {
    return renameMediaItem(mediaId, name);
  });

  ipcMain.handle('mediaLibrary:updateTags', (event, mediaId: string, tags: string | null) => {
    return updateMediaTags(mediaId, tags);
  });

  // ============ Media Folders ============

  ipcMain.handle('mediaFolders:getAll', () => {
    return getAllMediaFolders();
  });

  ipcMain.handle('mediaFolders:create', (event, name: string) => {
    return createMediaFolder(name);
  });

  ipcMain.handle('mediaFolders:rename', (event, id: string, name: string) => {
    return renameMediaFolder(id, name);
  });

  ipcMain.handle('mediaFolders:delete', (event, id: string) => {
    return deleteMediaFolder(id);
  });

  // ============ Video Control ============

  ipcMain.handle('video:play', (event, filePath: string) => {
    displayManager.broadcastMedia({ type: 'video', path: filePath });
    displayManager.broadcastVideoCommand({ type: 'play', path: filePath });
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
    displayManager.broadcastVideoCommand({ type: 'seek', time });
    return true;
  });

  ipcMain.handle('video:stop', () => {
    displayManager.broadcastVideoCommand({ type: 'stop' });
    return true;
  });

  ipcMain.handle('video:mute', (event, muted: boolean) => {
    displayManager.broadcastVideoCommand({ type: 'mute', muted });
    return true;
  });

  ipcMain.handle('video:volume', (event, volume: number) => {
    displayManager.broadcastVideoCommand({ type: 'volume', volume });
    return true;
  });

  // Get current video position for late-joining display sync
  ipcMain.handle('video:getPosition', () => {
    return displayManager.getVideoPosition();
  });

  // Get current YouTube position for display sync
  ipcMain.handle('youtube:getPosition', () => {
    return displayManager.getYoutubePosition();
  });

  // Forward video time updates from display windows to control panel
  ipcMain.on('video:timeUpdate', (event, time: number, duration: number) => {
    if (controlWindowRef && !controlWindowRef.isDestroyed()) {
      controlWindowRef.webContents.send('video:status', { currentTime: time, duration });
    }
  });

  ipcMain.on('video:ended', () => {
    if (controlWindowRef && !controlWindowRef.isDestroyed()) {
      controlWindowRef.webContents.send('video:ended');
    }
  });

  ipcMain.on('video:playing', (event, playing: boolean) => {
    if (controlWindowRef && !controlWindowRef.isDestroyed()) {
      controlWindowRef.webContents.send('video:playing', playing);
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
      return await updateSong(id, data);
    } catch (error) {
      console.error('IPC db:songs:update error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:songs:delete', async (event, id: string) => {
    try {
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
      return await getSetlist(id);
    } catch (error) {
      console.error('IPC db:setlists:get error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:setlists:create', async (event, data) => {
    try {
      return await createSetlist(data);
    } catch (error) {
      console.error('IPC db:setlists:create error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:setlists:update', async (event, id: string, data) => {
    try {
      return await updateSetlist(id, data);
    } catch (error) {
      console.error('IPC db:setlists:update error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:setlists:delete', async (event, id: string) => {
    try {
      return await deleteSetlist(id);
    } catch (error) {
      console.error('IPC db:setlists:delete error:', error);
      throw error;
    }
  });

  // ============ Database - Themes ============

  ipcMain.handle('db:themes:getAll', async () => {
    try {
      const themes = await getThemes();
      console.log('db:themes:getAll - loaded', themes.length, 'themes');
      return themes;
    } catch (error) {
      console.error('IPC db:themes:getAll error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:themes:get', async (event, id: string) => {
    try {
      return await getTheme(id);
    } catch (error) {
      console.error('IPC db:themes:get error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:themes:create', async (event, data) => {
    try {
      return await createTheme(data);
    } catch (error) {
      console.error('IPC db:themes:create error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:themes:update', async (event, id: string, data) => {
    try {
      return await updateTheme(id, data);
    } catch (error) {
      console.error('IPC db:themes:update error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:themes:delete', async (event, id: string) => {
    try {
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
      return getStageTheme(id);
    } catch (error) {
      console.error('IPC db:stageThemes:get error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:stageThemes:create', async (event, data) => {
    try {
      return createStageTheme(data);
    } catch (error) {
      console.error('IPC db:stageThemes:create error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:stageThemes:update', async (event, id: string, data) => {
    try {
      return updateStageTheme(id, data);
    } catch (error) {
      console.error('IPC db:stageThemes:update error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:stageThemes:delete', async (event, id: string) => {
    try {
      return deleteStageTheme(id);
    } catch (error) {
      console.error('IPC db:stageThemes:delete error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:stageThemes:duplicate', async (event, id: string, newName?: string) => {
    try {
      return duplicateStageTheme(id, newName);
    } catch (error) {
      console.error('IPC db:stageThemes:duplicate error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:stageThemes:setDefault', async (event, id: string) => {
    try {
      return setDefaultStageTheme(id);
    } catch (error) {
      console.error('IPC db:stageThemes:setDefault error:', error);
      throw error;
    }
  });

  ipcMain.handle('stageTheme:apply', (event, theme) => {
    displayManager.broadcastStageTheme(theme);
    return true;
  });

  // ============ Database - Bible Themes ============

  ipcMain.handle('db:bibleThemes:getAll', async () => {
    try {
      const themes = await getBibleThemes();
      console.log('[IPC] db:bibleThemes:getAll returned:', themes?.length, 'themes');
      return themes;
    } catch (error) {
      console.error('IPC db:bibleThemes:getAll error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:bibleThemes:get', async (event, id: string) => {
    try {
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
      return await createBibleTheme(data);
    } catch (error) {
      console.error('IPC db:bibleThemes:create error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:bibleThemes:update', async (event, id: string, data) => {
    try {
      return await updateBibleTheme(id, data);
    } catch (error) {
      console.error('IPC db:bibleThemes:update error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:bibleThemes:delete', async (event, id: string) => {
    try {
      return await deleteBibleTheme(id);
    } catch (error) {
      console.error('IPC db:bibleThemes:delete error:', error);
      throw error;
    }
  });

  ipcMain.handle('bibleTheme:apply', (event, theme) => {
    displayManager.broadcastBibleTheme(theme);
    return true;
  });

  // ============ Database - OBS Themes ============

  ipcMain.handle('db:obsThemes:getAll', async (event, type?: OBSThemeType) => {
    try {
      const themes = await getOBSThemes(type);
      console.log('[IPC] db:obsThemes:getAll returned:', themes?.length, 'themes (type filter:', type, ')');
      return themes;
    } catch (error) {
      console.error('IPC db:obsThemes:getAll error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:obsThemes:get', async (event, id: string) => {
    try {
      return await getOBSTheme(id);
    } catch (error) {
      console.error('IPC db:obsThemes:get error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:obsThemes:getDefault', async (event, type: OBSThemeType) => {
    try {
      return await getDefaultOBSTheme(type);
    } catch (error) {
      console.error('IPC db:obsThemes:getDefault error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:obsThemes:create', async (event, data) => {
    try {
      return await createOBSTheme(data);
    } catch (error) {
      console.error('IPC db:obsThemes:create error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:obsThemes:update', async (event, id: string, data) => {
    try {
      return await updateOBSTheme(id, data);
    } catch (error) {
      console.error('IPC db:obsThemes:update error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:obsThemes:delete', async (event, id: string) => {
    try {
      return await deleteOBSTheme(id);
    } catch (error) {
      console.error('IPC db:obsThemes:delete error:', error);
      throw error;
    }
  });

  ipcMain.handle('obsTheme:apply', (event, theme) => {
    obsServer.updateTheme(theme);
    return true;
  });

  // ============ Database - Prayer Themes ============

  ipcMain.handle('db:prayerThemes:getAll', async () => {
    try {
      const themes = await getPrayerThemes();
      console.log('[IPC] db:prayerThemes:getAll returned:', themes?.length, 'themes');
      return themes;
    } catch (error) {
      console.error('IPC db:prayerThemes:getAll error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:prayerThemes:get', async (event, id: string) => {
    try {
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
      return await createPrayerTheme(data);
    } catch (error) {
      console.error('IPC db:prayerThemes:create error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:prayerThemes:update', async (event, id: string, data) => {
    try {
      return await updatePrayerTheme(id, data);
    } catch (error) {
      console.error('IPC db:prayerThemes:update error:', error);
      throw error;
    }
  });

  ipcMain.handle('db:prayerThemes:delete', async (event, id: string) => {
    try {
      return await deletePrayerTheme(id);
    } catch (error) {
      console.error('IPC db:prayerThemes:delete error:', error);
      throw error;
    }
  });

  ipcMain.handle('prayerTheme:apply', (event, theme) => {
    displayManager.broadcastPrayerTheme(theme);
    return true;
  });

  // ============ Theme Selection Persistence ============

  ipcMain.handle('settings:getSelectedThemeIds', () => {
    return getSelectedThemeIds();
  });

  ipcMain.handle('settings:saveSelectedThemeId', (event, themeType: 'viewer' | 'stage' | 'bible' | 'obs' | 'prayer', themeId: string | null) => {
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
      console.log('Creating presentation with data:', JSON.stringify(data).substring(0, 200));
      console.log('  quickModeData present:', !!data.quickModeData, data.quickModeData ? JSON.stringify(data.quickModeData).substring(0, 100) : 'null');
      const result = await createPresentation(data);
      console.log('Presentation created:', result?.id, 'quickModeData in result:', !!result?.quickModeData);
      return result;
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

  // ============ Bible ============

  ipcMain.handle('bible:getBooks', async () => {
    return getBibleBooks();
  });

  ipcMain.handle('bible:getVerses', async (event, bookName: string, chapter: number) => {
    const response = await getBibleVerses(bookName, chapter);
    return {
      ...response,
      slides: versesToSlides(response.verses, bookName, chapter)
    };
  });

  // ============ Text Processing Services ============

  ipcMain.handle('service:transliterate', async (event, text: string) => {
    return transliterate(text);
  });

  ipcMain.handle('service:translate', async (event, text: string) => {
    return translate(text);
  });

  ipcMain.handle('service:quickSlide', async (event, text: string) => {
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

  // ============ App ============

  ipcMain.handle('app:version', () => {
    return app.getVersion();
  });

  ipcMain.handle('app:getPath', (event, name: string) => {
    return app.getPath(name as any);
  });

  ipcMain.handle('app:openExternal', (event, url: string) => {
    shell.openExternal(url);
    return true;
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
    // Broadcast to online viewers
    socketService.youtubeLoad(videoId, title);
    // Broadcast to local display windows
    displayManager.broadcastYoutube({ type: 'load', videoId, title });
    return true;
  });

  ipcMain.handle('youtube:play', (event, currentTime: number) => {
    socketService.youtubePlay(currentTime);
    displayManager.broadcastYoutube({ type: 'play', currentTime });
    return true;
  });

  ipcMain.handle('youtube:pause', (event, currentTime: number) => {
    socketService.youtubePause(currentTime);
    displayManager.broadcastYoutube({ type: 'pause', currentTime });
    return true;
  });

  ipcMain.handle('youtube:seek', (event, currentTime: number) => {
    socketService.youtubeSeek(currentTime);
    displayManager.broadcastYoutube({ type: 'seek', currentTime });
    return true;
  });

  ipcMain.handle('youtube:stop', () => {
    socketService.youtubeStop();
    displayManager.broadcastYoutube({ type: 'stop' });
    return true;
  });

  ipcMain.handle('youtube:sync', (event, currentTime: number, isPlaying: boolean) => {
    socketService.youtubeSync(currentTime, isPlaying);
    displayManager.broadcastYoutube({ type: 'sync', currentTime, isPlaying });
    return true;
  });

  // YouTube search using Piped API (no API key required)
  ipcMain.handle('youtube:search', async (event, query: string) => {
    const instances = [
      'https://api.piped.private.coffee',
      'https://pipedapi.kavin.rocks',
      'https://pipedapi.r4fo.com'
    ];

    for (const instance of instances) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(
          `${instance}/search?q=${encodeURIComponent(query)}&filter=videos`,
          { signal: controller.signal }
        );
        clearTimeout(timeout);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const results = (data.items || [])
          .filter((item: any) => item.type === 'stream')
          .slice(0, 12)
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
      }
    }

    return { success: false, error: 'All instances failed' };
  });
}
