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

  // ============ Report Status Back ============
  reportReady: () => ipcRenderer.send('display:ready'),
  reportVideoTime: (time: number, duration: number) => ipcRenderer.send('video:timeUpdate', time, duration),
  reportVideoEnded: () => ipcRenderer.send('video:ended'),
  reportVideoPlaying: (playing: boolean) => ipcRenderer.send('video:playing', playing),
  reportError: (error: string) => ipcRenderer.send('display:error', error),

  // ============ Request Data ============
  getVideoPosition: () => ipcRenderer.invoke('video:getPosition')
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

      // Report Status Back
      reportReady: () => void;
      reportVideoTime: (time: number, duration: number) => void;
      reportVideoEnded: () => void;
      reportVideoPlaying: (playing: boolean) => void;
      reportError: (error: string) => void;

      // Request Data
      getVideoPosition: () => Promise<{ time: number; isPlaying: boolean } | null>;
    };
  }
}
