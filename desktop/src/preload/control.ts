import { contextBridge, ipcRenderer, clipboard, webFrame } from 'electron';

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // ============ Display Management ============
  getDisplays: () => ipcRenderer.invoke('displays:getAll'),
  getExternalDisplays: () => ipcRenderer.invoke('displays:getExternal'),
  openDisplayWindow: (displayId: number, type: 'viewer' | 'stage') =>
    ipcRenderer.invoke('displays:open', displayId, type),
  closeDisplayWindow: (displayId: number) => ipcRenderer.invoke('displays:close', displayId),
  closeAllDisplays: () => ipcRenderer.invoke('displays:closeAll'),
  captureViewer: () => ipcRenderer.invoke('displays:captureViewer'),
  onDisplaysChanged: (callback: (displays: any[]) => void) => {
    const handler = (_: any, displays: any[]) => callback(displays);
    ipcRenderer.on('displays:changed', handler);
    return () => ipcRenderer.removeListener('displays:changed', handler);
  },
  identifyDisplays: (displayId?: number) => ipcRenderer.invoke('displays:identify', displayId),
  moveControlWindow: (targetDisplayId: number) => ipcRenderer.invoke('displays:moveControlWindow', targetDisplayId),
  getControlWindowDisplay: () => ipcRenderer.invoke('displays:getControlWindowDisplay'),

  // ============ OBS Browser Source Server ============
  startOBSServer: () => ipcRenderer.invoke('obs:start'),
  stopOBSServer: () => ipcRenderer.invoke('obs:stop'),
  getOBSServerUrl: () => ipcRenderer.invoke('obs:getUrl'),
  isOBSServerRunning: () => ipcRenderer.invoke('obs:isRunning'),
  // Legacy compatibility
  openOBSOverlay: () => ipcRenderer.invoke('obs:open'),
  closeOBSOverlay: () => ipcRenderer.invoke('obs:close'),
  isOBSOverlayOpen: () => ipcRenderer.invoke('obs:isOpen'),

  // ============ Slide Control ============
  // Use send (fire-and-forget) for instant slide updates instead of invoke (request-response)
  sendSlide: (slideData: any) => ipcRenderer.send('slides:send', slideData),
  sendBlank: () => ipcRenderer.send('slides:blank'),
  sendTool: (toolData: any) => ipcRenderer.send('tools:send', toolData),
  applyTheme: (theme: any) => ipcRenderer.send('theme:apply', theme),
  setBackground: (background: string) => ipcRenderer.send('background:set', background),
  applyOBSTheme: (theme: any) => ipcRenderer.send('obsTheme:apply', theme),

  // ============ Fullscreen Media Display ============
  displayMedia: (mediaData: { type: 'image' | 'video'; url: string }) => ipcRenderer.invoke('media:display', mediaData),
  clearMedia: () => ipcRenderer.invoke('media:clear'),
  readFileAsDataUrl: (filePath: string) => ipcRenderer.invoke('file:readAsDataUrl', filePath),

  // ============ Media Management ============
  getMediaFolders: () => ipcRenderer.invoke('media:getFolders'),
  addMediaFolder: () => ipcRenderer.invoke('media:addFolder'),
  removeMediaFolder: (id: string) => ipcRenderer.invoke('media:removeFolder', id),
  getMediaFiles: (folderId?: string) => ipcRenderer.invoke('media:getFiles', folderId),
  rescanMediaFolder: (id: string) => ipcRenderer.invoke('media:rescan', id),

  // ============ Media Library (Imported Media) ============
  importMedia: () => ipcRenderer.invoke('mediaLibrary:import'),
  getMediaLibrary: () => ipcRenderer.invoke('mediaLibrary:getAll'),
  getMediaLibraryItem: (id: string) => ipcRenderer.invoke('mediaLibrary:get', id),
  deleteMediaLibraryItem: (id: string) => ipcRenderer.invoke('mediaLibrary:delete', id),
  getMediaLibraryPath: () => ipcRenderer.invoke('mediaLibrary:getPath'),
  moveMediaToFolder: (mediaId: string, folderId: string | null) => ipcRenderer.invoke('mediaLibrary:move', mediaId, folderId),
  renameMediaItem: (mediaId: string, name: string) => ipcRenderer.invoke('mediaLibrary:rename', mediaId, name),
  updateMediaTags: (mediaId: string, tags: string | null) => ipcRenderer.invoke('mediaLibrary:updateTags', mediaId, tags),

  // ============ Media Folders ============
  getMediaFoldersLib: () => ipcRenderer.invoke('mediaFolders:getAll'),
  createMediaFolderLib: (name: string) => ipcRenderer.invoke('mediaFolders:create', name),
  renameMediaFolderLib: (id: string, name: string) => ipcRenderer.invoke('mediaFolders:rename', id, name),
  deleteMediaFolderLib: (id: string) => ipcRenderer.invoke('mediaFolders:delete', id),

  // ============ Video Control ============
  playVideo: (path: string) => ipcRenderer.invoke('video:play', path),
  pauseVideo: () => ipcRenderer.invoke('video:pause'),
  resumeVideo: () => ipcRenderer.invoke('video:resume'),
  seekVideo: (time: number) => ipcRenderer.invoke('video:seek', time),
  stopVideo: () => ipcRenderer.invoke('video:stop'),
  muteVideo: (muted: boolean) => ipcRenderer.invoke('video:mute', muted),
  setVideoVolume: (volume: number) => ipcRenderer.invoke('video:volume', volume),

  // Video status listeners
  onVideoStatus: (callback: (status: { currentTime: number; duration: number }) => void) => {
    const handler = (_: any, status: { currentTime: number; duration: number }) => callback(status);
    ipcRenderer.on('video:status', handler);
    return () => ipcRenderer.removeListener('video:status', handler);
  },
  onVideoEnded: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('video:ended', handler);
    return () => ipcRenderer.removeListener('video:ended', handler);
  },
  onVideoPlaying: (callback: (playing: boolean) => void) => {
    const handler = (_: any, playing: boolean) => callback(playing);
    ipcRenderer.on('video:playing', handler);
    return () => ipcRenderer.removeListener('video:playing', handler);
  },
  onVideoSyncStart: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('video:syncStart', handler);
    return () => ipcRenderer.removeListener('video:syncStart', handler);
  },

  // ============ Database - Songs ============
  getSongs: (query?: string) => ipcRenderer.invoke(query ? 'db:songs:search' : 'db:songs:getAll', query),
  getSong: (id: string) => ipcRenderer.invoke('db:songs:get', id),
  createSong: (data: any) => ipcRenderer.invoke('db:songs:create', data),
  updateSong: (id: string, data: any) => ipcRenderer.invoke('db:songs:update', id, data),
  deleteSong: (id: string) => ipcRenderer.invoke('db:songs:delete', id),
  importSongs: (backendUrl: string) => ipcRenderer.invoke('db:songs:import', backendUrl),

  // ============ Database - Setlists ============
  getSetlists: () => ipcRenderer.invoke('db:setlists:getAll'),
  getSetlist: (id: string) => ipcRenderer.invoke('db:setlists:get', id),
  createSetlist: (data: any) => ipcRenderer.invoke('db:setlists:create', data),
  updateSetlist: (id: string, data: any) => ipcRenderer.invoke('db:setlists:update', id, data),
  deleteSetlist: (id: string) => ipcRenderer.invoke('db:setlists:delete', id),

  // ============ Database - Themes ============
  getThemes: () => ipcRenderer.invoke('db:themes:getAll'),
  getTheme: (id: string) => ipcRenderer.invoke('db:themes:get', id),
  createTheme: (data: any) => ipcRenderer.invoke('db:themes:create', data),
  updateTheme: (id: string, data: any) => ipcRenderer.invoke('db:themes:update', id, data),
  deleteTheme: (id: string) => ipcRenderer.invoke('db:themes:delete', id),

  // ============ Database - Stage Monitor Themes ============
  getStageThemes: () => ipcRenderer.invoke('db:stageThemes:getAll'),
  getStageTheme: (id: string) => ipcRenderer.invoke('db:stageThemes:get', id),
  createStageTheme: (data: any) => ipcRenderer.invoke('db:stageThemes:create', data),
  updateStageTheme: (id: string, data: any) => ipcRenderer.invoke('db:stageThemes:update', id, data),
  deleteStageTheme: (id: string) => ipcRenderer.invoke('db:stageThemes:delete', id),
  duplicateStageTheme: (id: string, newName?: string) => ipcRenderer.invoke('db:stageThemes:duplicate', id, newName),
  setDefaultStageTheme: (id: string) => ipcRenderer.invoke('db:stageThemes:setDefault', id),
  applyStageTheme: (theme: any) => ipcRenderer.invoke('stageTheme:apply', theme),

  // ============ Database - Bible Themes ============
  getBibleThemes: () => ipcRenderer.invoke('db:bibleThemes:getAll'),
  getBibleTheme: (id: string) => ipcRenderer.invoke('db:bibleThemes:get', id),
  getDefaultBibleTheme: () => ipcRenderer.invoke('db:bibleThemes:getDefault'),
  createBibleTheme: (data: any) => ipcRenderer.invoke('db:bibleThemes:create', data),
  updateBibleTheme: (id: string, data: any) => ipcRenderer.invoke('db:bibleThemes:update', id, data),
  deleteBibleTheme: (id: string) => ipcRenderer.invoke('db:bibleThemes:delete', id),
  applyBibleTheme: (theme: any) => ipcRenderer.invoke('bibleTheme:apply', theme),

  // ============ Database - OBS Themes ============
  getOBSThemes: (type?: 'songs' | 'bible' | 'prayer') => ipcRenderer.invoke('db:obsThemes:getAll', type),
  getOBSTheme: (id: string) => ipcRenderer.invoke('db:obsThemes:get', id),
  getDefaultOBSTheme: (type: 'songs' | 'bible' | 'prayer') => ipcRenderer.invoke('db:obsThemes:getDefault', type),
  createOBSTheme: (data: any) => ipcRenderer.invoke('db:obsThemes:create', data),
  updateOBSTheme: (id: string, data: any) => ipcRenderer.invoke('db:obsThemes:update', id, data),
  deleteOBSTheme: (id: string) => ipcRenderer.invoke('db:obsThemes:delete', id),

  // ============ Database - Prayer Themes ============
  getPrayerThemes: () => ipcRenderer.invoke('db:prayerThemes:getAll'),
  getPrayerTheme: (id: string) => ipcRenderer.invoke('db:prayerThemes:get', id),
  getDefaultPrayerTheme: () => ipcRenderer.invoke('db:prayerThemes:getDefault'),
  createPrayerTheme: (data: any) => ipcRenderer.invoke('db:prayerThemes:create', data),
  updatePrayerTheme: (id: string, data: any) => ipcRenderer.invoke('db:prayerThemes:update', id, data),
  deletePrayerTheme: (id: string) => ipcRenderer.invoke('db:prayerThemes:delete', id),
  applyPrayerTheme: (theme: any) => ipcRenderer.invoke('prayerTheme:apply', theme),

  // ============ Theme Selection Persistence ============
  getSelectedThemeIds: () => ipcRenderer.invoke('settings:getSelectedThemeIds'),
  saveSelectedThemeId: (themeType: 'viewer' | 'stage' | 'bible' | 'obs' | 'obsBible' | 'prayer' | 'obsPrayer', themeId: string | null) =>
    ipcRenderer.invoke('settings:saveSelectedThemeId', themeType, themeId),

  // ============ Display Theme Overrides ============
  displayThemeOverrides: {
    getAll: () => ipcRenderer.invoke('displayThemeOverrides:getAll'),
    getForDisplay: (displayId: number) => ipcRenderer.invoke('displayThemeOverrides:getForDisplay', displayId),
    get: (displayId: number, themeType: 'viewer' | 'stage' | 'bible' | 'prayer') =>
      ipcRenderer.invoke('displayThemeOverrides:get', displayId, themeType),
    set: (displayId: number, themeType: 'viewer' | 'stage' | 'bible' | 'prayer', themeId: string) =>
      ipcRenderer.invoke('displayThemeOverrides:set', displayId, themeType, themeId),
    remove: (displayId: number, themeType: 'viewer' | 'stage' | 'bible' | 'prayer') =>
      ipcRenderer.invoke('displayThemeOverrides:remove', displayId, themeType),
    removeAllForDisplay: (displayId: number) =>
      ipcRenderer.invoke('displayThemeOverrides:removeAllForDisplay', displayId),
    rebroadcast: () => ipcRenderer.invoke('displayThemeOverrides:rebroadcast')
  },

  // ============ Database - Presentations ============
  getPresentations: () => ipcRenderer.invoke('db:presentations:getAll'),
  getPresentation: (id: string) => ipcRenderer.invoke('db:presentations:get', id),
  createPresentation: (data: any) => ipcRenderer.invoke('db:presentations:create', data),
  updatePresentation: (id: string, data: any) => ipcRenderer.invoke('db:presentations:update', id, data),
  deletePresentation: (id: string) => ipcRenderer.invoke('db:presentations:delete', id),

  // ============ Database - Audio Playlists ============
  getAudioPlaylists: () => ipcRenderer.invoke('db:audioPlaylists:getAll'),
  getAudioPlaylist: (id: string) => ipcRenderer.invoke('db:audioPlaylists:get', id),
  createAudioPlaylist: (data: any) => ipcRenderer.invoke('db:audioPlaylists:create', data),
  updateAudioPlaylist: (id: string, data: any) => ipcRenderer.invoke('db:audioPlaylists:update', id, data),
  deleteAudioPlaylist: (id: string) => ipcRenderer.invoke('db:audioPlaylists:delete', id),

  // ============ Bible ============
  getBibleBooks: () => ipcRenderer.invoke('bible:getBooks'),
  getBibleVerses: (bookName: string, chapter: number) => ipcRenderer.invoke('bible:getVerses', bookName, chapter),

  // ============ Text Processing Services ============
  transliterate: (text: string) => ipcRenderer.invoke('service:transliterate', text),
  translate: (text: string) => ipcRenderer.invoke('service:translate', text),
  processQuickSlide: (text: string) => ipcRenderer.invoke('service:quickSlide', text),

  // ============ Online Mode ============
  connectOnline: (serverUrl: string, token: string) =>
    ipcRenderer.invoke('online:connect', serverUrl, token),
  disconnectOnline: () => ipcRenderer.invoke('online:disconnect'),
  createOnlineRoom: () => ipcRenderer.invoke('online:createRoom'),
  getOnlineStatus: () => ipcRenderer.invoke('online:getStatus'),
  getViewerCount: () => ipcRenderer.invoke('online:getViewerCount'),
  getPublicRooms: () => ipcRenderer.invoke('online:getPublicRooms'),
  switchToPublicRoom: (publicRoomId: string | null) => ipcRenderer.invoke('online:switchToPublicRoom', publicRoomId),
  onViewerCountChanged: (callback: (count: number) => void) => {
    const handler = (_: any, count: number) => callback(count);
    ipcRenderer.on('online:viewerCount', handler);
    return () => ipcRenderer.removeListener('online:viewerCount', handler);
  },
  onOnlineStatusChanged: (callback: (status: any) => void) => {
    const handler = (_: any, status: any) => callback(status);
    ipcRenderer.on('online:status', handler);
    return () => ipcRenderer.removeListener('online:status', handler);
  },

  // ============ App ============
  getAppVersion: () => ipcRenderer.invoke('app:version'),
  getAppPath: (name: string) => ipcRenderer.invoke('app:getPath', name),
  openExternal: (url: string) => ipcRenderer.invoke('app:openExternal', url),
  copyToClipboard: (text: string) => clipboard.writeText(text),

  // ============ Dialogs ============
  openFileDialog: (options: any) => ipcRenderer.invoke('dialog:openFile', options),
  saveFileDialog: (options: any) => ipcRenderer.invoke('dialog:saveFile', options),

  // ============ Authentication ============
  login: (email: string, password: string, serverUrl?: string) =>
    ipcRenderer.invoke('auth:login', email, password, serverUrl),
  register: (email: string, password: string, serverUrl?: string) =>
    ipcRenderer.invoke('auth:register', email, password, serverUrl),
  logout: () => ipcRenderer.invoke('auth:logout'),
  getAuthState: () => ipcRenderer.invoke('auth:getState'),
  initializeAuth: () => ipcRenderer.invoke('auth:initialize'),
  setServerUrl: (url: string) => ipcRenderer.invoke('auth:setServerUrl', url),
  connectWithAuth: () => ipcRenderer.invoke('online:connectWithAuth'),

  // ============ YouTube Control ============
  youtubeLoad: (videoId: string, title: string) => ipcRenderer.invoke('youtube:load', videoId, title),
  youtubePlay: (currentTime: number) => ipcRenderer.invoke('youtube:play', currentTime),
  youtubePause: (currentTime: number) => ipcRenderer.invoke('youtube:pause', currentTime),
  youtubeSeek: (currentTime: number) => ipcRenderer.invoke('youtube:seek', currentTime),
  youtubeStop: () => ipcRenderer.invoke('youtube:stop'),
  youtubeSync: (currentTime: number, isPlaying: boolean) => ipcRenderer.invoke('youtube:sync', currentTime, isPlaying),
  youtubeSearch: (query: string, timeoutMs?: number) => ipcRenderer.invoke('youtube:search', query, timeoutMs),

  // ============ Remote Control ============
  remoteControl: {
    start: () => ipcRenderer.invoke('remoteControl:start'),
    stop: () => ipcRenderer.invoke('remoteControl:stop'),
    getStatus: () => ipcRenderer.invoke('remoteControl:getStatus'),
    getQRCode: () => ipcRenderer.invoke('remoteControl:getQRCode'),
    updateState: (state: any) => ipcRenderer.send('remoteControl:updateState', state),
    onCommand: (callback: (command: any) => void) => {
      const handler = (_: any, command: any) => callback(command);
      ipcRenderer.on('remote:command', handler);
      return () => ipcRenderer.removeListener('remote:command', handler);
    }
  },

  // ============ UI Scaling ============
  setZoomFactor: (factor: number) => {
    // Clamp to reasonable range (80% to 150%)
    const clampedFactor = Math.max(0.8, Math.min(1.5, factor));
    webFrame.setZoomFactor(clampedFactor);
  },
  getZoomFactor: () => webFrame.getZoomFactor()
});

// Type declarations for TypeScript
declare global {
  interface Window {
    electronAPI: {
      // Display Management
      getDisplays: () => Promise<any[]>;
      getExternalDisplays: () => Promise<any[]>;
      openDisplayWindow: (displayId: number, type: 'viewer' | 'stage') => Promise<boolean>;
      closeDisplayWindow: (displayId: number) => Promise<boolean>;
      closeAllDisplays: () => Promise<boolean>;
      captureViewer: () => Promise<string | null>;
      onDisplaysChanged: (callback: (displays: any[]) => void) => () => void;
      identifyDisplays: (displayId?: number) => Promise<boolean>;
      moveControlWindow: (targetDisplayId: number) => Promise<boolean>;
      getControlWindowDisplay: () => Promise<number | null>;

      // OBS Browser Source Server
      startOBSServer: () => Promise<{ success: boolean; url?: string; port?: number; error?: string }>;
      stopOBSServer: () => Promise<boolean>;
      getOBSServerUrl: () => Promise<string | null>;
      isOBSServerRunning: () => Promise<boolean>;

      // OBS Overlay
      openOBSOverlay: (config?: {
        position?: 'top' | 'center' | 'bottom';
        fontSize?: number;
        textColor?: string;
        showOriginal?: boolean;
        showTransliteration?: boolean;
        showTranslation?: boolean;
        paddingBottom?: number;
        paddingTop?: number;
        maxWidth?: number;
      }) => Promise<boolean>;
      closeOBSOverlay: () => Promise<boolean>;
      isOBSOverlayOpen: () => Promise<boolean>;

      // Slide Control (fire-and-forget, no return value)
      sendSlide: (slideData: any) => void;
      sendBlank: () => void;
      sendTool: (toolData: any) => void;
      applyTheme: (theme: any) => void;
      setBackground: (background: string) => void;
      applyOBSTheme: (theme: any) => void;

      // Fullscreen Media Display
      displayMedia: (mediaData: { type: 'image' | 'video'; url: string }) => Promise<boolean>;
      clearMedia: () => Promise<boolean>;
      readFileAsDataUrl: (filePath: string) => Promise<string>;

      // Media Management
      getMediaFolders: () => Promise<any[]>;
      addMediaFolder: () => Promise<any | null>;
      removeMediaFolder: (id: string) => Promise<boolean>;
      getMediaFiles: (folderId?: string) => Promise<any[]>;
      rescanMediaFolder: (id: string) => Promise<boolean>;

      // Media Library (Imported Media)
      importMedia: () => Promise<{ success: boolean; imported: any[]; errors?: string[] }>;
      getMediaLibrary: () => Promise<any[]>;
      getMediaLibraryItem: (id: string) => Promise<any | null>;
      deleteMediaLibraryItem: (id: string) => Promise<boolean>;
      getMediaLibraryPath: () => Promise<string>;
      moveMediaToFolder: (mediaId: string, folderId: string | null) => Promise<boolean>;
      renameMediaItem: (mediaId: string, name: string) => Promise<boolean>;
      updateMediaTags: (mediaId: string, tags: string | null) => Promise<boolean>;

      // Media Folders
      getMediaFoldersLib: () => Promise<Array<{ id: string; name: string; createdAt: string }>>;
      createMediaFolderLib: (name: string) => Promise<{ id: string; name: string; createdAt: string }>;
      renameMediaFolderLib: (id: string, name: string) => Promise<boolean>;
      deleteMediaFolderLib: (id: string) => Promise<boolean>;

      // Video Control
      playVideo: (path: string) => Promise<boolean>;
      pauseVideo: () => Promise<boolean>;
      resumeVideo: () => Promise<boolean>;
      seekVideo: (time: number) => Promise<boolean>;
      stopVideo: () => Promise<boolean>;
      muteVideo: (muted: boolean) => Promise<boolean>;
      setVideoVolume: (volume: number) => Promise<boolean>;
      onVideoStatus: (callback: (status: { currentTime: number; duration: number }) => void) => () => void;
      onVideoEnded: (callback: () => void) => () => void;
      onVideoPlaying: (callback: (playing: boolean) => void) => () => void;
      onVideoSyncStart: (callback: () => void) => () => void;

      // Database - Songs
      getSongs: (query?: string) => Promise<any[]>;
      getSong: (id: string) => Promise<any>;
      createSong: (data: any) => Promise<any>;
      updateSong: (id: string, data: any) => Promise<any>;
      deleteSong: (id: string) => Promise<boolean>;
      importSongs: (backendUrl: string) => Promise<{ imported: number; updated: number; errors: number }>;

      // Database - Setlists
      getSetlists: () => Promise<any[]>;
      getSetlist: (id: string) => Promise<any>;
      createSetlist: (data: any) => Promise<any>;
      updateSetlist: (id: string, data: any) => Promise<any>;
      deleteSetlist: (id: string) => Promise<boolean>;

      // Database - Themes
      getThemes: () => Promise<any[]>;
      getTheme: (id: string) => Promise<any>;
      createTheme: (data: any) => Promise<any>;
      updateTheme: (id: string, data: any) => Promise<any>;
      deleteTheme: (id: string) => Promise<boolean>;

      // Database - Stage Monitor Themes
      getStageThemes: () => Promise<any[]>;
      getStageTheme: (id: string) => Promise<any>;
      createStageTheme: (data: any) => Promise<any>;
      updateStageTheme: (id: string, data: any) => Promise<any>;
      deleteStageTheme: (id: string) => Promise<boolean>;
      duplicateStageTheme: (id: string, newName?: string) => Promise<any>;
      setDefaultStageTheme: (id: string) => Promise<boolean>;
      applyStageTheme: (theme: any) => Promise<boolean>;

      // Database - Bible Themes
      getBibleThemes: () => Promise<any[]>;
      getBibleTheme: (id: string) => Promise<any>;
      getDefaultBibleTheme: () => Promise<any>;
      createBibleTheme: (data: any) => Promise<any>;
      updateBibleTheme: (id: string, data: any) => Promise<any>;
      deleteBibleTheme: (id: string) => Promise<boolean>;
      applyBibleTheme: (theme: any) => Promise<boolean>;

      // Database - OBS Themes
      getOBSThemes: (type?: 'songs' | 'bible' | 'prayer') => Promise<any[]>;
      getOBSTheme: (id: string) => Promise<any>;
      getDefaultOBSTheme: (type: 'songs' | 'bible' | 'prayer') => Promise<any>;
      createOBSTheme: (data: any) => Promise<any>;
      updateOBSTheme: (id: string, data: any) => Promise<any>;
      deleteOBSTheme: (id: string) => Promise<boolean>;

      // Database - Prayer Themes
      getPrayerThemes: () => Promise<any[]>;
      getPrayerTheme: (id: string) => Promise<any>;
      getDefaultPrayerTheme: () => Promise<any>;
      createPrayerTheme: (data: any) => Promise<any>;
      updatePrayerTheme: (id: string, data: any) => Promise<any>;
      deletePrayerTheme: (id: string) => Promise<boolean>;
      applyPrayerTheme: (theme: any) => Promise<boolean>;

      // Theme Selection Persistence
      getSelectedThemeIds: () => Promise<{
        viewerThemeId: string | null;
        stageThemeId: string | null;
        bibleThemeId: string | null;
        obsThemeId: string | null;
        obsBibleThemeId: string | null;
        prayerThemeId: string | null;
        obsPrayerThemeId: string | null;
      }>;
      saveSelectedThemeId: (themeType: 'viewer' | 'stage' | 'bible' | 'obs' | 'obsBible' | 'prayer' | 'obsPrayer', themeId: string | null) => Promise<boolean>;

      // Display Theme Overrides
      displayThemeOverrides: {
        getAll: () => Promise<Array<{
          id: number;
          displayId: number;
          themeType: 'viewer' | 'stage' | 'bible' | 'prayer';
          themeId: string;
          createdAt: string;
          updatedAt: string;
        }>>;
        getForDisplay: (displayId: number) => Promise<Array<{
          id: number;
          displayId: number;
          themeType: 'viewer' | 'stage' | 'bible' | 'prayer';
          themeId: string;
          createdAt: string;
          updatedAt: string;
        }>>;
        get: (displayId: number, themeType: 'viewer' | 'stage' | 'bible' | 'prayer') => Promise<{
          id: number;
          displayId: number;
          themeType: 'viewer' | 'stage' | 'bible' | 'prayer';
          themeId: string;
          createdAt: string;
          updatedAt: string;
        } | null>;
        set: (displayId: number, themeType: 'viewer' | 'stage' | 'bible' | 'prayer', themeId: string) => Promise<{
          id: number;
          displayId: number;
          themeType: 'viewer' | 'stage' | 'bible' | 'prayer';
          themeId: string;
          createdAt: string;
          updatedAt: string;
        } | null>;
        remove: (displayId: number, themeType: 'viewer' | 'stage' | 'bible' | 'prayer') => Promise<boolean>;
        removeAllForDisplay: (displayId: number) => Promise<boolean>;
        rebroadcast: () => Promise<boolean>;
      };

      // Database - Presentations
      getPresentations: () => Promise<any[]>;
      getPresentation: (id: string) => Promise<any>;
      createPresentation: (data: any) => Promise<any>;
      updatePresentation: (id: string, data: any) => Promise<any>;
      deletePresentation: (id: string) => Promise<boolean>;

      // Database - Audio Playlists
      getAudioPlaylists: () => Promise<Array<{
        id: string;
        name: string;
        tracks: Array<{ path: string; name: string; duration?: number | null }>;
        shuffle: boolean;
        createdAt: string;
        updatedAt: string;
      }>>;
      getAudioPlaylist: (id: string) => Promise<{
        id: string;
        name: string;
        tracks: Array<{ path: string; name: string; duration?: number | null }>;
        shuffle: boolean;
        createdAt: string;
        updatedAt: string;
      } | null>;
      createAudioPlaylist: (data: {
        name: string;
        tracks: Array<{ path: string; name: string; duration?: number | null }>;
        shuffle?: boolean;
      }) => Promise<{
        id: string;
        name: string;
        tracks: Array<{ path: string; name: string; duration?: number | null }>;
        shuffle: boolean;
        createdAt: string;
        updatedAt: string;
      }>;
      updateAudioPlaylist: (id: string, data: {
        name?: string;
        tracks?: Array<{ path: string; name: string; duration?: number | null }>;
        shuffle?: boolean;
      }) => Promise<{
        id: string;
        name: string;
        tracks: Array<{ path: string; name: string; duration?: number | null }>;
        shuffle: boolean;
        createdAt: string;
        updatedAt: string;
      } | null>;
      deleteAudioPlaylist: (id: string) => Promise<boolean>;

      // Bible
      getBibleBooks: () => Promise<Array<{ name: string; chapters: number; hebrewName?: string; testament?: string }>>;
      getBibleVerses: (bookName: string, chapter: number) => Promise<{
        book: string;
        chapter: number;
        verses: Array<{ verseNumber: number; hebrew: string; english: string; reference: string; hebrewReference: string }>;
        slides: Array<{ originalText: string; transliteration: string; translation: string; verseType: string; reference: string; hebrewReference: string }>;
        totalVerses: number;
        testament: string;
      }>;

      // Text Processing Services
      transliterate: (text: string) => Promise<string>;
      translate: (text: string) => Promise<string>;
      processQuickSlide: (text: string) => Promise<{ original: string; transliteration: string; translation: string }>;

      // Online Mode
      connectOnline: (serverUrl: string, token: string) => Promise<boolean>;
      disconnectOnline: () => Promise<boolean>;
      createOnlineRoom: () => Promise<{ roomPin: string }>;
      getOnlineStatus: () => Promise<{ connected: boolean; roomPin?: string; roomId?: string }>;
      getViewerCount: () => Promise<number>;
      getPublicRooms: () => Promise<Array<{ id: string; name: string; slug: string }>>;
      switchToPublicRoom: (publicRoomId: string | null) => Promise<boolean>;
      onViewerCountChanged: (callback: (count: number) => void) => () => void;
      onOnlineStatusChanged: (callback: (status: any) => void) => () => void;

      // App
      getAppVersion: () => Promise<string>;
      getAppPath: (name: string) => Promise<string>;
      openExternal: (url: string) => Promise<boolean>;
      copyToClipboard: (text: string) => void;

      // Dialogs
      openFileDialog: (options: any) => Promise<any>;
      saveFileDialog: (options: any) => Promise<any>;

      // Authentication
      login: (email: string, password: string, serverUrl?: string) => Promise<{ success: boolean; error?: string; requiresVerification?: boolean }>;
      register: (email: string, password: string, serverUrl?: string) => Promise<{ success: boolean; error?: string; requiresVerification?: boolean; message?: string }>;
      logout: () => Promise<boolean>;
      getAuthState: () => Promise<{
        isAuthenticated: boolean;
        user: { id: string; email: string; role: string; isEmailVerified: boolean; preferences?: { language?: string } } | null;
        token: string | null;
        serverUrl: string;
      }>;
      initializeAuth: () => Promise<any>;
      setServerUrl: (url: string) => Promise<boolean>;
      connectWithAuth: () => Promise<{ success: boolean; error?: string }>;

      // YouTube Control
      youtubeLoad: (videoId: string, title: string) => Promise<boolean>;
      youtubePlay: (currentTime: number) => Promise<boolean>;
      youtubePause: (currentTime: number) => Promise<boolean>;
      youtubeSeek: (currentTime: number) => Promise<boolean>;
      youtubeStop: () => Promise<boolean>;
      youtubeSync: (currentTime: number, isPlaying: boolean) => Promise<boolean>;
      youtubeSearch: (query: string, timeoutMs?: number) => Promise<{ success: boolean; results?: Array<{ videoId: string; title: string; thumbnail: string; channelTitle: string }>; error?: string }>;

      // Remote Control
      remoteControl: {
        start: () => Promise<{ success: boolean; port?: number; url?: string; pin?: string; error?: string }>;
        stop: () => Promise<boolean>;
        getStatus: () => Promise<{ running: boolean; url: string | null; pin: string; clients: number }>;
        getQRCode: () => Promise<string | null>;
        updateState: (state: {
          currentItem?: { id: string; type: string; title: string; slideCount: number } | null;
          currentSlideIndex?: number;
          totalSlides?: number;
          displayMode?: 'bilingual' | 'original' | 'translation';
          isBlank?: boolean;
          setlist?: Array<{ id: string; type: string; title: string }>;
          slides?: Array<{ index: number; preview: string; verseType?: string; isCombined?: boolean }>;
          activeTools?: string[];
          onlineViewerCount?: number;
          activeMedia?: { type: 'image' | 'video'; name: string } | null;
          activeAudio?: { name: string; isPlaying: boolean; currentTime: number; duration: number; volume: number } | null;
          activeVideo?: { name: string; isPlaying: boolean; currentTime: number; duration: number; volume: number } | null;
          activeYoutube?: { videoId: string; title: string; isPlaying: boolean; currentTime: number; duration: number } | null;
        }) => void;
        onCommand: (callback: (command: { type: string; payload?: any }) => void) => () => void;
      };

      // UI Scaling
      setZoomFactor: (factor: number) => void;
      getZoomFactor: () => number;
    };
  }
}
