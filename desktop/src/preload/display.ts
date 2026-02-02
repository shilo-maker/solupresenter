import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods to the display window renderer
contextBridge.exposeInMainWorld('displayAPI', {
  // ============ Receive Updates ============
  onSlideUpdate: (callback: (data: any) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('slide:update', handler);
    return () => ipcRenderer.removeListener('slide:update', handler);
  },

  onMediaUpdate: (callback: (data: any) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('media:update', handler);
    return () => ipcRenderer.removeListener('media:update', handler);
  },

  onVideoCommand: (callback: (command: any) => void) => {
    const handler = (_: any, command: any) => callback(command);
    ipcRenderer.on('video:command', handler);
    return () => ipcRenderer.removeListener('video:command', handler);
  },

  onThemeUpdate: (callback: (theme: any) => void) => {
    const handler = (_: any, theme: any) => callback(theme);
    ipcRenderer.on('theme:update', handler);
    return () => ipcRenderer.removeListener('theme:update', handler);
  },

  onToolUpdate: (callback: (data: any) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('tool:update', handler);
    return () => ipcRenderer.removeListener('tool:update', handler);
  },

  onBackgroundUpdate: (callback: (background: string) => void) => {
    const handler = (_: any, background: string) => callback(background);
    ipcRenderer.on('background:update', handler);
    return () => ipcRenderer.removeListener('background:update', handler);
  },

  onStageThemeUpdate: (callback: (theme: any) => void) => {
    const handler = (_: any, theme: any) => callback(theme);
    ipcRenderer.on('stageTheme:update', handler);
    return () => ipcRenderer.removeListener('stageTheme:update', handler);
  },

  onBibleThemeUpdate: (callback: (theme: any) => void) => {
    const handler = (_: any, theme: any) => callback(theme);
    ipcRenderer.on('bibleTheme:update', handler);
    return () => ipcRenderer.removeListener('bibleTheme:update', handler);
  },

  onPrayerThemeUpdate: (callback: (theme: any) => void) => {
    const handler = (_: any, theme: any) => callback(theme);
    ipcRenderer.on('prayerTheme:update', handler);
    return () => ipcRenderer.removeListener('prayerTheme:update', handler);
  },

  onOBSThemeUpdate: (callback: (theme: any) => void) => {
    const handler = (_: any, theme: any) => callback(theme);
    ipcRenderer.on('obsTheme:update', handler);
    return () => ipcRenderer.removeListener('obsTheme:update', handler);
  },

  onYoutubeCommand: (callback: (command: any) => void) => {
    const handler = (_: any, command: any) => callback(command);
    ipcRenderer.on('youtube:command', handler);
    return () => ipcRenderer.removeListener('youtube:command', handler);
  },

  onStageMessage: (callback: (data: { text: string; timestamp: number }) => void) => {
    const handler = (_: any, data: { text: string; timestamp: number }) => callback(data);
    ipcRenderer.on('stage:message', handler);
    return () => ipcRenderer.removeListener('stage:message', handler);
  },

  // ============ Report Status Back ============
  reportReady: () => ipcRenderer.send('display:ready'),
  reportVideoTime: (time: number, duration: number) => {
    // Validate inputs to prevent sending invalid data
    if (typeof time !== 'number' || !isFinite(time) || time < 0) return;
    if (typeof duration !== 'number' || !isFinite(duration) || duration < 0) return;
    ipcRenderer.send('video:timeUpdate', time, duration);
  },
  reportVideoEnded: () => ipcRenderer.send('video:ended'),
  reportVideoPlaying: (playing: boolean) => {
    if (typeof playing !== 'boolean') return;
    ipcRenderer.send('video:playing', playing);
  },
  reportError: (error: string) => {
    // Validate and sanitize error message
    if (typeof error !== 'string') return;
    ipcRenderer.send('display:error', error.substring(0, 1000));
  },

  // ============ Request Data ============
  getVideoPosition: () => ipcRenderer.invoke('video:getPosition'),
  getYoutubePosition: () => ipcRenderer.invoke('youtube:getPosition'),
  getMediaServerPort: () => ipcRenderer.invoke('media:getServerPort'),

  // ============ Video Sync ============
  // Signal that display is ready to play video (triggers synchronized start)
  signalVideoReady: () => ipcRenderer.invoke('video:displayReady'),

  // ============ Display Control ============
  // Close this display window (used when display is on same screen as control)
  closeDisplay: () => ipcRenderer.invoke('display:closeSelf')
});

// Type declarations for TypeScript
declare global {
  interface Window {
    displayAPI: {
      // Receive Updates
      onSlideUpdate: (callback: (data: any) => void) => () => void;
      onMediaUpdate: (callback: (data: any) => void) => () => void;
      onVideoCommand: (callback: (command: any) => void) => () => void;
      onThemeUpdate: (callback: (theme: any) => void) => () => void;
      onToolUpdate: (callback: (data: any) => void) => () => void;
      onBackgroundUpdate: (callback: (background: string) => void) => () => void;
      onStageThemeUpdate: (callback: (theme: any) => void) => () => void;
      onBibleThemeUpdate: (callback: (theme: any) => void) => () => void;
      onPrayerThemeUpdate: (callback: (theme: any) => void) => () => void;
      onOBSThemeUpdate: (callback: (theme: any) => void) => () => void;
      onYoutubeCommand: (callback: (command: any) => void) => () => void;
      onStageMessage: (callback: (data: { text: string; timestamp: number }) => void) => () => void;

      // Report Status Back
      reportReady: () => void;
      reportVideoTime: (time: number, duration: number) => void;
      reportVideoEnded: () => void;
      reportVideoPlaying: (playing: boolean) => void;
      reportError: (error: string) => void;

      // Request Data
      getVideoPosition: () => Promise<{ time: number; isPlaying: boolean } | null>;
      getYoutubePosition: () => Promise<{ time: number; isPlaying: boolean } | null>;
      getMediaServerPort: () => Promise<number>;

      // Video Sync
      signalVideoReady: () => Promise<boolean>;

      // Display Control
      closeDisplay: () => Promise<boolean>;
    };
  }
}
