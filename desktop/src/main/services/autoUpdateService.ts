import { BrowserWindow, app } from 'electron';

export type UpdateStatusType =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

export interface UpdateStatus {
  status: UpdateStatusType;
  version?: string;
  releaseNotes?: string;
  progress?: number;
  error?: string;
}

let controlWindow: BrowserWindow | null = null;
let currentStatus: UpdateStatus = { status: 'idle' };
let autoUpdaterInstance: typeof import('electron-updater').autoUpdater | null = null;
let isInitialized = false;

function getAutoUpdater() {
  if (!autoUpdaterInstance) {
    try {
      // Dynamic import to avoid issues in dev mode
      const { autoUpdater } = require('electron-updater');
      autoUpdaterInstance = autoUpdater;
    } catch (error) {
      console.error('[AutoUpdate] Failed to load electron-updater:', error);
      return null;
    }
  }
  return autoUpdaterInstance;
}

function initializeAutoUpdater(): boolean {
  if (isInitialized) return true;

  const autoUpdater = getAutoUpdater();
  if (!autoUpdater) return false;

  try {
    // Configure auto-updater
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    // Set up event handlers
    autoUpdater.on('checking-for-update', () => {
      setStatus({ status: 'checking' });
    });

    autoUpdater.on('update-available', (info: any) => {
      setStatus({
        status: 'available',
        version: info.version,
        releaseNotes: typeof info.releaseNotes === 'string'
          ? info.releaseNotes
          : Array.isArray(info.releaseNotes)
            ? info.releaseNotes.map((n: any) => n.note).join('\n')
            : undefined
      });
    });

    autoUpdater.on('update-not-available', () => {
      setStatus({ status: 'not-available' });
    });

    autoUpdater.on('download-progress', (progress: any) => {
      setStatus({
        status: 'downloading',
        progress: Math.round(progress.percent)
      });
    });

    autoUpdater.on('update-downloaded', (info: any) => {
      setStatus({
        status: 'downloaded',
        version: info.version
      });
    });

    autoUpdater.on('error', (error: Error) => {
      console.error('[AutoUpdate] Error:', error.message);
      setStatus({
        status: 'error',
        error: error.message
      });
    });

    isInitialized = true;
    return true;
  } catch (error) {
    console.error('[AutoUpdate] Failed to initialize:', error);
    return false;
  }
}

function setStatus(status: UpdateStatus): void {
  currentStatus = status;
  // Send status to renderer
  if (controlWindow && !controlWindow.isDestroyed()) {
    controlWindow.webContents.send('autoUpdate:status', status);
  }
}

export function setControlWindow(window: BrowserWindow): void {
  controlWindow = window;
}

export async function checkForUpdates(): Promise<UpdateStatus> {
  try {
    // Don't check in development
    if (!app.isPackaged) {
      setStatus({ status: 'not-available' });
      return currentStatus;
    }

    if (!initializeAutoUpdater()) {
      setStatus({ status: 'error', error: 'Auto-updater not available' });
      return currentStatus;
    }

    const autoUpdater = getAutoUpdater();
    if (!autoUpdater) {
      setStatus({ status: 'error', error: 'Auto-updater not available' });
      return currentStatus;
    }

    setStatus({ status: 'checking' });
    await autoUpdater.checkForUpdates();
    return currentStatus;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    setStatus({ status: 'error', error: errorMessage });
    return currentStatus;
  }
}

export async function downloadUpdate(): Promise<boolean> {
  try {
    if (currentStatus.status !== 'available') {
      return false;
    }

    const autoUpdater = getAutoUpdater();
    if (!autoUpdater) {
      setStatus({ status: 'error', error: 'Auto-updater not available' });
      return false;
    }

    setStatus({ status: 'downloading', progress: 0 });
    await autoUpdater.downloadUpdate();
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Download failed';
    setStatus({ status: 'error', error: errorMessage });
    return false;
  }
}

export function installUpdate(): boolean {
  try {
    if (currentStatus.status !== 'downloaded') {
      return false;
    }

    const autoUpdater = getAutoUpdater();
    if (!autoUpdater) {
      return false;
    }

    // This will quit the app and install the update
    autoUpdater.quitAndInstall(false, true);
    return true;
  } catch (error) {
    console.error('[AutoUpdate] Install error:', error);
    return false;
  }
}

export function getUpdateStatus(): UpdateStatus {
  return currentStatus;
}

export function resetUpdateStatus(): boolean {
  setStatus({ status: 'idle' });
  return true;
}
