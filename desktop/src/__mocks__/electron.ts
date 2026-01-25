import * as os from 'os';
import * as path from 'path';

// Mock Electron app module
export const app = {
  getPath: (name: string) => {
    if (name === 'userData') {
      return path.join(os.tmpdir(), 'solupresenter-test');
    }
    return os.tmpdir();
  },
  isPackaged: false
};

// Mock BrowserWindow
export class BrowserWindow {
  webContents = {
    send: () => {}
  };
  static getAllWindows() {
    return [];
  }
}

// Mock ipcMain
export const ipcMain = {
  handle: () => {},
  on: () => {}
};

// Mock screen
export const screen = {
  getAllDisplays: () => [],
  getPrimaryDisplay: () => ({ id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 } })
};

export default { app, BrowserWindow, ipcMain, screen };
