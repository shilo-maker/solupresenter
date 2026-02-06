/**
 * MINIMAL BOOTSTRAP - Shows splash screen instantly, then loads the app
 *
 * This file is intentionally minimal to ensure the splash screen appears
 * within milliseconds of the user clicking the app icon.
 *
 * Heavy imports (database, IPC, services) are loaded AFTER the window is visible.
 */
import { app, BrowserWindow, screen, protocol } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

// Register custom protocols BEFORE app is ready (required by Electron)
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true
    }
  },
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true
    }
  }
]);

// Enable hardware acceleration for video
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('enable-accelerated-video-decode');

// Global window reference
let controlWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Load splash logo as base64 at startup (avoids esbuild truncation issues with inline base64)
function getSplashLogoDataUri(): string {
  const logoPaths = [
    path.join(process.resourcesPath || '', 'icons', 'splash_logo.png'),
    path.join(__dirname, '..', '..', '..', 'resources', 'icons', 'splash_logo.png'),
    path.join(__dirname, '..', '..', 'resources', 'icons', 'splash_logo.png'),
    path.join(app.getAppPath(), 'resources', 'icons', 'splash_logo.png'),
  ];
  for (const p of logoPaths) {
    if (fs.existsSync(p)) {
      const buf = fs.readFileSync(p);
      return 'data:image/png;base64,' + buf.toString('base64');
    }
  }
  return '';
}

// Professional splash screen HTML - inline for instant load (no file I/O latency)
const splashLogoUri = getSplashLogoDataUri();
const splashScreenHTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: linear-gradient(135deg, #0a0a0f 0%, #12121a 50%, #0d0d14 100%);
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      overflow: hidden;
      position: relative;
    }
    body::before {
      content: '';
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(circle at 30% 30%, rgba(59, 130, 246, 0.08) 0%, transparent 50%),
                  radial-gradient(circle at 70% 70%, rgba(6, 182, 212, 0.06) 0%, transparent 50%);
      animation: bgPulse 4s ease-in-out infinite;
    }
    @keyframes bgPulse {
      0%, 100% { opacity: 0.5; transform: scale(1); }
      50% { opacity: 1; transform: scale(1.1); }
    }
    .content {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 32px;
    }
    .logo-container {
      position: relative;
      width: 100px;
      height: 100px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .logo-glow {
      position: absolute;
      width: 120px;
      height: 120px;
      background: radial-gradient(circle, rgba(6, 182, 212, 0.4) 0%, transparent 70%);
      border-radius: 50%;
      animation: glowPulse 2s ease-in-out infinite;
    }
    @keyframes glowPulse {
      0%, 100% { transform: scale(0.9); opacity: 0.5; }
      50% { transform: scale(1.2); opacity: 0.8; }
    }
    .logo {
      width: 80px;
      height: 80px;
      position: relative;
      z-index: 1;
    }
    .app-name {
      font-size: 28px;
      font-weight: 700;
      background: linear-gradient(135deg, #ffffff 0%, #06b6d4 50%, #3b82f6 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      letter-spacing: -0.5px;
    }
    .loader-container {
      width: 200px;
      height: 3px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 3px;
      overflow: hidden;
      position: relative;
    }
    .loader-bar {
      position: absolute;
      height: 100%;
      width: 40%;
      background: linear-gradient(90deg, #06b6d4, #3b82f6, #06b6d4);
      background-size: 200% 100%;
      border-radius: 3px;
      animation: loading 1.5s ease-in-out infinite;
    }
    @keyframes loading {
      0% { left: -40%; background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { left: 100%; background-position: 0% 50%; }
    }
    .loading-text {
      color: rgba(255, 255, 255, 0.5);
      font-size: 13px;
      font-weight: 500;
      letter-spacing: 0.5px;
    }
    .dots::after {
      content: '';
      animation: dots 1.5s steps(4, end) infinite;
    }
    @keyframes dots {
      0% { content: ''; }
      25% { content: '.'; }
      50% { content: '..'; }
      75% { content: '...'; }
      100% { content: ''; }
    }
    .version {
      position: absolute;
      bottom: 24px;
      color: rgba(255, 255, 255, 0.25);
      font-size: 11px;
      font-weight: 500;
    }
  </style>
</head>
<body>
  <div class="content">
    <div class="logo-container">
      <div class="logo-glow"></div>
      <img class="logo" src="${splashLogoUri}" alt="SoluCast" style="border-radius: 16px;" />
    </div>
    <div class="app-name">SoluCast</div>
    <div class="loader-container">
      <div class="loader-bar"></div>
    </div>
    <div class="loading-text">Loading<span class="dots"></span></div>
  </div>
  <div class="version">v${app.getVersion()}</div>
</body>
</html>`;

// Get icon path (cached)
let cachedIconPath: string | null = null;
function getIconPath(): string {
  if (cachedIconPath !== null) return cachedIconPath;
  const iconExt = process.platform === 'win32' ? 'favicon.ico' : 'logo512.png';
  const possiblePaths = [
    path.join(process.resourcesPath || '', 'icons', iconExt),
    path.join(__dirname, '..', '..', '..', 'resources', 'icons', iconExt),
    path.join(__dirname, '..', '..', 'resources', 'icons', iconExt),
    path.join(app.getAppPath(), 'resources', 'icons', iconExt),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      cachedIconPath = p;
      return cachedIconPath;
    }
  }
  cachedIconPath = '';
  return cachedIconPath;
}

// Create the window with splash screen - FAST, no heavy imports
function createWindowWithSplash(onShown: () => void): BrowserWindow {
  const primaryDisplay = screen.getPrimaryDisplay();
  const iconPath = getIconPath();

  const win = new BrowserWindow({
    x: primaryDisplay.bounds.x + 50,
    y: primaryDisplay.bounds.y + 50,
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'SoluCast',
    icon: iconPath,
    show: false,
    backgroundColor: '#0a0a0f',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'control.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.setMenu(null);

  // Show window as soon as splash DOM is ready, THEN load heavy modules
  win.webContents.once('dom-ready', () => {
    win.show();
    // Use setImmediate to ensure the window is actually painted before loading heavy modules
    setImmediate(onShown);
  });

  // Load splash screen (instant - data URL, no file I/O)
  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashScreenHTML)}`);

  return win;
}

// Handle single instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (controlWindow) {
      if (controlWindow.isMinimized()) controlWindow.restore();
      controlWindow.focus();
    }
  });
}

// Main startup
app.whenReady().then(() => {
  // STEP 1: Show splash screen IMMEDIATELY
  // STEP 2: Load heavy modules only AFTER window is visible (in the callback)
  controlWindow = createWindowWithSplash(() => {
    // This runs AFTER the splash screen is painted
    const { initializeFullApp } = require('./appLoader.js');
    initializeFullApp(controlWindow, isDev);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0 && controlWindow === null) {
    controlWindow = createWindowWithSplash();
  }
});

// Export for other modules
export { controlWindow };
