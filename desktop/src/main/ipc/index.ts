import { ipcMain, dialog, app, shell, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { DisplayManager } from '../windows/displayManager';
import { getSongs, getSong, createSong, updateSong, deleteSong, importSongsFromBackend } from '../database/songs';
import { getSetlists, getSetlist, createSetlist, updateSetlist, deleteSetlist } from '../database/setlists';
import { getThemes, getTheme, createTheme, updateTheme, deleteTheme } from '../database/themes';
import { getStageThemes, getStageTheme, createStageTheme, updateStageTheme, deleteStageTheme, duplicateStageTheme, setDefaultStageTheme } from '../database/stageThemes';
import { getPresentations, getPresentation, createPresentation, updatePresentation, deletePresentation } from '../database/presentations';
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

  // ============ Slide Control ============

  ipcMain.handle('slides:send', (event, slideData) => {
    console.log('[IPC slides:send] backgroundImage:', slideData.backgroundImage);
    displayManager.broadcastSlide(slideData);
    socketService.broadcastSlide(slideData);
    return true;
  });

  ipcMain.handle('slides:blank', () => {
    displayManager.broadcastSlide({ isBlank: true });
    socketService.broadcastSlide({ isBlank: true });
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
  ipcMain.handle('file:readAsDataUrl', async (event, filePath: string) => {
    try {
      const data = await fs.promises.readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.mov': 'video/quicktime',
        '.avi': 'video/x-msvideo',
        '.mkv': 'video/x-matroska',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
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
    return getSongs();
  });

  ipcMain.handle('db:songs:get', async (event, id: string) => {
    return getSong(id);
  });

  ipcMain.handle('db:songs:create', async (event, data) => {
    return createSong(data);
  });

  ipcMain.handle('db:songs:update', async (event, id: string, data) => {
    return updateSong(id, data);
  });

  ipcMain.handle('db:songs:delete', async (event, id: string) => {
    return deleteSong(id);
  });

  ipcMain.handle('db:songs:search', async (event, query: string) => {
    return getSongs(query);
  });

  ipcMain.handle('db:songs:import', async (event, backendUrl: string) => {
    return importSongsFromBackend(backendUrl);
  });

  // ============ Database - Setlists ============

  ipcMain.handle('db:setlists:getAll', async () => {
    return getSetlists();
  });

  ipcMain.handle('db:setlists:get', async (event, id: string) => {
    return getSetlist(id);
  });

  ipcMain.handle('db:setlists:create', async (event, data) => {
    return createSetlist(data);
  });

  ipcMain.handle('db:setlists:update', async (event, id: string, data) => {
    return updateSetlist(id, data);
  });

  ipcMain.handle('db:setlists:delete', async (event, id: string) => {
    return deleteSetlist(id);
  });

  // ============ Database - Themes ============

  ipcMain.handle('db:themes:getAll', async () => {
    const themes = await getThemes();
    console.log('db:themes:getAll - loaded', themes.length, 'themes');
    themes.forEach((t: any) => {
      console.log(`  - ${t.name}: linePositions=${!!t.linePositions}, backgroundBoxes=${!!t.backgroundBoxes}`);
    });
    return themes;
  });

  ipcMain.handle('db:themes:get', async (event, id: string) => {
    return getTheme(id);
  });

  ipcMain.handle('db:themes:create', async (event, data) => {
    return createTheme(data);
  });

  ipcMain.handle('db:themes:update', async (event, id: string, data) => {
    return updateTheme(id, data);
  });

  ipcMain.handle('db:themes:delete', async (event, id: string) => {
    return deleteTheme(id);
  });

  // ============ Database - Stage Monitor Themes ============

  ipcMain.handle('db:stageThemes:getAll', async () => {
    return getStageThemes();
  });

  ipcMain.handle('db:stageThemes:get', async (event, id: string) => {
    return getStageTheme(id);
  });

  ipcMain.handle('db:stageThemes:create', async (event, data) => {
    return createStageTheme(data);
  });

  ipcMain.handle('db:stageThemes:update', async (event, id: string, data) => {
    return updateStageTheme(id, data);
  });

  ipcMain.handle('db:stageThemes:delete', async (event, id: string) => {
    return deleteStageTheme(id);
  });

  ipcMain.handle('db:stageThemes:duplicate', async (event, id: string, newName?: string) => {
    return duplicateStageTheme(id, newName);
  });

  ipcMain.handle('db:stageThemes:setDefault', async (event, id: string) => {
    return setDefaultStageTheme(id);
  });

  ipcMain.handle('stageTheme:apply', (event, theme) => {
    displayManager.broadcastStageTheme(theme);
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
      const result = await createPresentation(data);
      console.log('Presentation created:', result?.id);
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
    return socketService.connect(serverUrl, token);
  });

  ipcMain.handle('online:disconnect', () => {
    socketService.disconnect();
    return true;
  });

  ipcMain.handle('online:createRoom', async () => {
    return socketService.createRoom();
  });

  ipcMain.handle('online:getStatus', () => {
    return socketService.getStatus();
  });

  ipcMain.handle('online:getViewerCount', () => {
    return socketService.getViewerCount();
  });

  ipcMain.handle('online:getPublicRooms', async () => {
    return socketService.getPublicRooms();
  });

  ipcMain.handle('online:switchToPublicRoom', async (event, publicRoomId: string | null) => {
    return socketService.switchToPublicRoom(publicRoomId);
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
    return authService.login(email, password, serverUrl);
  });

  ipcMain.handle('auth:register', async (event, email: string, password: string, serverUrl?: string) => {
    return authService.register(email, password, serverUrl);
  });

  ipcMain.handle('auth:logout', () => {
    authService.logout();
    socketService.disconnect();
    return true;
  });

  ipcMain.handle('auth:getState', async () => {
    return authService.getState();
  });

  ipcMain.handle('auth:initialize', async () => {
    return authService.initialize();
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
}
