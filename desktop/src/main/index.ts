import { app, BrowserWindow, ipcMain, screen, dialog, protocol, net } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import { DisplayManager, setLocalServerPort } from './windows/displayManager';
import { registerIpcHandlers, setSocketControlWindow } from './ipc';
import { initDatabase } from './database';
import { initTranslator } from './services/mlTranslation';

// Local server for production (needed for YouTube to work - requires http:// origin)
let localServer: http.Server | null = null;
export let localServerPort = 0;

// Enable hardware acceleration for video
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('enable-accelerated-video-decode');

// Register custom protocols
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

// Global references
let controlWindow: BrowserWindow | null = null;
let displayManager: DisplayManager;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createControlWindow(): void {
  const primaryDisplay = screen.getPrimaryDisplay();

  // Get icon path - use ICO for Windows, PNG for other platforms
  const iconExt = process.platform === 'win32' ? 'favicon.ico' : 'logo512.png';
  let iconPath = '';

  // Try multiple locations
  const possiblePaths = [
    // Production: extraResources icons folder
    path.join(process.resourcesPath || '', 'icons', iconExt),
    // Development: relative to dist folder
    path.join(__dirname, '..', '..', '..', 'resources', 'icons', iconExt),
    // Alternative dev path
    path.join(__dirname, '..', '..', 'resources', 'icons', iconExt),
    // Next to app
    path.join(app.getAppPath(), 'resources', 'icons', iconExt),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      iconPath = p;
      break;
    }
  }

  console.log('[Icon] __dirname:', __dirname);
  console.log('[Icon] iconPath:', iconPath);
  console.log('[Icon] icon exists:', fs.existsSync(iconPath));

  controlWindow = new BrowserWindow({
    x: primaryDisplay.bounds.x + 50,
    y: primaryDisplay.bounds.y + 50,
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'SoluCast',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'control.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  // Load the renderer
  if (isDev) {
    controlWindow.loadURL('http://localhost:5173');
    controlWindow.webContents.openDevTools();
  } else {
    // In production, use local HTTP server for proper origin (needed for YouTube)
    controlWindow.loadURL(`http://127.0.0.1:${localServerPort}/`);
  }

  controlWindow.on('closed', () => {
    controlWindow = null;
    // Close all display windows when control window closes
    displayManager.closeAllDisplays();
    app.quit();
  });
}

/**
 * Start local HTTP server for serving renderer files in production
 * This is needed because YouTube requires http:// origin for embedding
 */
async function startLocalServer(): Promise<number> {
  return new Promise((resolve, reject) => {
    const rendererPath = path.join(__dirname, '../../renderer');
    console.log('[LocalServer] Starting server for:', rendererPath);

    const mimeTypes: Record<string, string> = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
      '.eot': 'application/vnd.ms-fontobject',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav'
    };

    localServer = http.createServer((req, res) => {
      let filePath = req.url || '/';

      // Handle hash routes - serve index.html
      if (filePath.includes('#')) {
        filePath = '/index.html';
      }

      // Handle root and paths without extension
      if (filePath === '/' || !path.extname(filePath)) {
        filePath = '/index.html';
      }

      const fullPath = path.join(rendererPath, filePath);

      // Security check
      const normalizedPath = path.normalize(fullPath);
      if (!normalizedPath.startsWith(path.normalize(rendererPath))) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      fs.readFile(fullPath, (err, data) => {
        if (err) {
          // Try index.html for SPA routing
          fs.readFile(path.join(rendererPath, 'index.html'), (err2, data2) => {
            if (err2) {
              res.writeHead(404);
              res.end('Not Found');
            } else {
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end(data2);
            }
          });
          return;
        }

        const ext = path.extname(fullPath).toLowerCase();
        const contentType = mimeTypes[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
      });
    });

    // Find available port starting from 45678
    const tryPort = (port: number) => {
      localServer!.listen(port, '127.0.0.1', () => {
        localServerPort = port;
        console.log(`[LocalServer] Running on http://127.0.0.1:${port}`);
        resolve(port);
      }).on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          tryPort(port + 1);
        } else {
          reject(err);
        }
      });
    };

    tryPort(45678);
  });
}

async function initializeApp(): Promise<void> {
  console.log('Starting app initialization...');

  // Initialize database
  try {
    await initDatabase();
  } catch (err) {
    console.error('Database initialization failed:', err);
  }

  // Initialize ML translator in background (downloads model on first run)
  initTranslator().then((success) => {
    if (success) {
      console.log('ML Translation model ready');
    } else {
      console.warn('ML Translation model failed to load, will use dictionary fallback');
    }
  }).catch((err) => {
    console.warn('ML Translation initialization error:', err);
  });

  // Initialize display manager
  console.log('Creating display manager...');
  displayManager = new DisplayManager();
  console.log('Display manager created');

  // Register IPC handlers
  console.log('Registering IPC handlers...');
  registerIpcHandlers(displayManager);
  console.log('IPC handlers registered');

  // Register media protocol handler with streaming support
  console.log('Registering media protocol...');
  try {
    protocol.handle('media', async (request) => {
      // Extract file path from media:// URL
      const url = new URL(request.url);
      let filePath = decodeURIComponent(url.pathname);

      // On Windows, pathname starts with / before drive letter, remove it
      if (process.platform === 'win32' && filePath.startsWith('/')) {
        filePath = filePath.substring(1);
      }

      // Convert forward slashes to backslashes on Windows
      if (process.platform === 'win32') {
        filePath = filePath.replace(/\//g, '\\');
      }

      // Security: prevent directory traversal
      if (filePath.includes('..')) {
        return new Response('Forbidden', { status: 403 });
      }

      console.log('[media protocol] Request URL:', request.url);
      console.log('[media protocol] Resolved path:', filePath);

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.error('[media protocol] File not found:', filePath);
        return new Response('Not Found', { status: 404 });
      }

      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.bmp': 'image/bmp',
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.mov': 'video/quicktime',
        '.avi': 'video/x-msvideo',
        '.mkv': 'video/x-matroska',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.ogg': 'audio/ogg',
        '.m4a': 'audio/mp4',
        '.flac': 'audio/flac',
        '.aac': 'audio/aac',
      };
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      const stat = await fs.promises.stat(filePath);
      const fileSize = stat.size;

      const isVideo = ['.mp4', '.mov', '.m4v', '.webm', '.mkv', '.avi'].includes(ext);
      const isAudio = ['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac'].includes(ext);
      const isStreamable = isVideo || isAudio;
      const rangeHeader = request.headers.get('range');

      console.log(`[media protocol] File: ${fileSize} bytes, Range: ${rangeHeader || 'none'}, Video: ${isVideo}, Audio: ${isAudio}`);

      // For videos and audio: serve full file on initial request so browser gets duration
      // Then use chunked responses for seeking
      if (isStreamable) {
        if (!rangeHeader || rangeHeader === 'bytes=0-' || rangeHeader.startsWith('bytes=0-')) {
          // Initial request - serve full file for duration metadata
          console.log('[media protocol] Serving full media file for duration metadata');
          const fullBuffer = await fs.promises.readFile(filePath);

          return new Response(fullBuffer, {
            status: 200,
            headers: {
              'Content-Type': contentType,
              'Content-Length': String(fileSize),
              'Accept-Ranges': 'bytes'
            }
          });
        }

        // Seeking request - serve the requested range
        const rangeMatch = rangeHeader.match(/bytes=(\d+)-(\d*)/);
        if (rangeMatch) {
          const start = parseInt(rangeMatch[1], 10);
          const end = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : fileSize - 1;
          const chunkSize = end - start + 1;

          console.log(`[media protocol] Serving range ${start}-${end} (${chunkSize} bytes)`);

          const fd = await fs.promises.open(filePath, 'r');
          const buffer = Buffer.alloc(chunkSize);
          await fd.read(buffer, 0, chunkSize, start);
          await fd.close();

          return new Response(buffer, {
            status: 206,
            headers: {
              'Content-Type': contentType,
              'Content-Range': `bytes ${start}-${end}/${fileSize}`,
              'Accept-Ranges': 'bytes',
              'Content-Length': String(chunkSize)
            }
          });
        }
      }

      // For images and other files, just serve the full file
      const fileBuffer = await fs.promises.readFile(filePath);
      return new Response(fileBuffer, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Length': String(fileSize),
          'Accept-Ranges': 'bytes'
        }
      });
    });
    console.log('Media protocol registered');
  } catch (err) {
    console.error('Failed to register media protocol:', err);
  }

  // Register app protocol for serving renderer files (needed for YouTube to work)
  if (!isDev) {
    console.log('Registering app protocol for production...');
    try {
      const rendererPath = path.join(__dirname, '../../renderer');
      console.log('[app protocol] Renderer path:', rendererPath);

      protocol.handle('app', async (request) => {
        const url = new URL(request.url);
        let filePath = url.pathname;

        // Handle root path
        if (filePath === '/' || filePath === '') {
          filePath = '/index.html';
        }

        // Remove leading slash
        if (filePath.startsWith('/')) {
          filePath = filePath.substring(1);
        }

        const fullPath = path.join(rendererPath, filePath);
        console.log('[app protocol] Request:', request.url, '-> File:', fullPath);

        // Security: ensure path is within renderer directory
        const normalizedPath = path.normalize(fullPath);
        if (!normalizedPath.startsWith(path.normalize(rendererPath))) {
          console.error('[app protocol] Path traversal attempt blocked:', filePath);
          return new Response('Forbidden', { status: 403 });
        }

        try {
          const fileBuffer = await fs.promises.readFile(fullPath);

          // Determine content type
          const ext = path.extname(fullPath).toLowerCase();
          const mimeTypes: Record<string, string> = {
            '.html': 'text/html',
            '.js': 'application/javascript',
            '.css': 'text/css',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon',
            '.woff': 'font/woff',
            '.woff2': 'font/woff2',
            '.ttf': 'font/ttf',
            '.eot': 'application/vnd.ms-fontobject'
          };
          const contentType = mimeTypes[ext] || 'application/octet-stream';

          return new Response(fileBuffer, {
            status: 200,
            headers: {
              'Content-Type': contentType,
              'Content-Length': String(fileBuffer.length)
            }
          });
        } catch (err) {
          console.error('[app protocol] File not found:', fullPath);
          return new Response('Not Found', { status: 404 });
        }
      });
      console.log('App protocol registered');
    } catch (err) {
      console.error('Failed to register app protocol:', err);
    }

    // Start local HTTP server for production (needed for YouTube)
    try {
      const port = await startLocalServer();
      setLocalServerPort(port);
      console.log('Local server started on port:', port);
    } catch (err) {
      console.error('Failed to start local server:', err);
    }
  }

  // Create main control window
  createControlWindow();

  // Set control window reference for socket service (for status notifications)
  if (controlWindow) {
    setSocketControlWindow(controlWindow);
  }

  // Start watching for display changes
  displayManager.startWatching((displays) => {
    if (controlWindow) {
      controlWindow.webContents.send('displays:changed', displays);
    }
  });
}

// App lifecycle
app.whenReady().then(initializeApp);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createControlWindow();
  }
});

// Handle second instance (single instance lock)
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

// Export for IPC handlers
export { controlWindow, displayManager };
