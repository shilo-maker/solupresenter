/**
 * App Loader - Contains all heavy initialization
 *
 * This file is loaded AFTER the splash screen is visible.
 * It imports all the heavy modules (database, IPC, services, etc.)
 */
import { BrowserWindow, protocol, app, session } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';

// Heavy imports - these are the slow ones
import { DisplayManager, setLocalServerPort } from './windows/displayManager';
import { registerIpcHandlers, setSocketControlWindow } from './ipc';
import { initDatabase, flushDatabase } from './database';
import { initTranslator } from './services/mlTranslation';
import { cleanupOrphanedFiles } from './services/mediaProcessor';
import { checkForUpdates } from './services/autoUpdateService';
import { streamingService } from './services/streamingService';

// Local server
let localServer: http.Server | null = null;
let localServerPort = 0;

// Shared MIME type map (used by local server and media protocol handler)
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
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
  '.aac': 'audio/aac'
};

export function getLocalServerPort(): number {
  return localServerPort;
}

let displayManager: DisplayManager;

/**
 * Check if Vite dev server is ready
 */
async function isViteReady(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:5173', (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Wait for Vite dev server with polling
 */
async function waitForVite(maxAttempts = 100): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    if (await isViteReady()) return true;
    await new Promise(r => setTimeout(r, 100));
  }
  return false;
}

/**
 * Start local HTTP server for serving renderer files in production
 */
async function startLocalServer(): Promise<number> {
  return new Promise((resolve, reject) => {
    const rendererPath = path.join(__dirname, '../../renderer');

    const allowedMediaExtensions = new Set([
      '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg',
      '.mp4', '.webm', '.mov', '.avi', '.mkv', '.wmv', '.m4v',
      '.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac'
    ]);

    localServer = http.createServer(async (req, res) => {
      const reqUrl = req.url || '/';

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      // Handle media requests: /media/<base64-encoded-path>
      if (reqUrl.startsWith('/media/')) {
        try {
          const encodedPath = reqUrl.substring(7);
          let base64Path = decodeURIComponent(encodedPath)
            .replace(/-/g, '+')
            .replace(/_/g, '/');
          while (base64Path.length % 4 !== 0) {
            base64Path += '=';
          }
          const mediaPath = Buffer.from(base64Path, 'base64').toString('utf8');

          const ext = path.extname(mediaPath).toLowerCase();
          if (!allowedMediaExtensions.has(ext)) {
            res.writeHead(403);
            res.end('Forbidden');
            return;
          }

          if (!path.isAbsolute(mediaPath) || mediaPath.includes('..')) {
            res.writeHead(403);
            res.end('Forbidden');
            return;
          }

          if (!fs.existsSync(mediaPath)) {
            res.writeHead(404);
            res.end('Not Found');
            return;
          }

          const stat = await fs.promises.stat(mediaPath);
          const fileSize = stat.size;
          const contentType = MIME_TYPES[ext] || 'application/octet-stream';

          const rangeHeader = req.headers.range;

          if (rangeHeader) {
            const rangeMatch = rangeHeader.match(/bytes=(\d+)-(\d*)/);
            if (rangeMatch) {
              const start = parseInt(rangeMatch[1], 10);
              const hasEndByte = rangeMatch[2] && rangeMatch[2].length > 0;
              let end = hasEndByte ? parseInt(rangeMatch[2], 10) : fileSize - 1;
              if (end >= fileSize) end = fileSize - 1;
              if (start >= fileSize) {
                res.writeHead(416, { 'Content-Range': `bytes */${fileSize}` });
                res.end();
                return;
              }
              const chunkSize = end - start + 1;

              res.writeHead(206, {
                'Content-Type': contentType,
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunkSize
              });

              const fileStream = fs.createReadStream(mediaPath, { start, end, highWaterMark: 1024 * 1024 });
              fileStream.pipe(res);
              return;
            }
          }

          res.writeHead(200, {
            'Content-Type': contentType,
            'Content-Length': fileSize,
            'Accept-Ranges': 'bytes'
          });

          fs.createReadStream(mediaPath).pipe(res);
          return;
        } catch (error) {
          res.writeHead(500);
          res.end('Internal Server Error');
          return;
        }
      }

      let filePath = reqUrl;

      if (filePath.includes('#')) {
        filePath = '/index.html';
      }

      if (filePath === '/' || !path.extname(filePath)) {
        filePath = '/index.html';
      }

      const fullPath = path.join(rendererPath, filePath);

      const normalizedPath = path.normalize(fullPath);
      if (!normalizedPath.startsWith(path.normalize(rendererPath))) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      fs.readFile(fullPath, (err, data) => {
        if (err) {
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
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
      });
    });

    const tryPort = (port: number) => {
      localServer!.listen(port, '127.0.0.1', () => {
        localServerPort = port;
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

/**
 * Register media protocol handler
 */
function registerMediaProtocol() {
  const ALLOWED_MEDIA_EXTENSIONS = new Set([
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg',
    '.mp4', '.webm', '.mov', '.avi', '.mkv', '.wmv', '.m4v',
    '.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac'
  ]);

  try {
    protocol.handle('media', async (request) => {
      try {
        const url = new URL(request.url);
        let filePath = decodeURIComponent(url.pathname);

        if (filePath.startsWith('/file/')) {
          filePath = filePath.substring(6);
        } else if (filePath.startsWith('/')) {
          filePath = filePath.substring(1);
        }

        if (process.platform === 'win32') {
          filePath = filePath.replace(/\//g, '\\');
        }

        filePath = path.normalize(filePath);

        if (filePath.includes('..')) {
          return new Response('Forbidden', { status: 403 });
        }

        if (!path.isAbsolute(filePath)) {
          return new Response('Forbidden', { status: 403 });
        }

        const ext = path.extname(filePath).toLowerCase();
        if (!ALLOWED_MEDIA_EXTENSIONS.has(ext)) {
          return new Response('Forbidden', { status: 403 });
        }

        if (!fs.existsSync(filePath)) {
          return new Response('Not Found', { status: 404 });
        }

        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        const stat = await fs.promises.stat(filePath);
        const fileSize = stat.size;

        const isStreamable = ['.mp4', '.mov', '.m4v', '.webm', '.mkv', '.avi', '.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac'].includes(ext);
        const rangeHeader = request.headers.get('range');

        if (isStreamable && rangeHeader) {
          const rangeMatch = rangeHeader.match(/bytes=(\d+)-(\d*)/);
          if (rangeMatch) {
            let start = parseInt(rangeMatch[1], 10);
            let end = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : fileSize - 1;

            if (end >= fileSize) end = fileSize - 1;
            if (start >= fileSize) {
              return new Response('Range Not Satisfiable', {
                status: 416,
                headers: { 'Content-Range': `bytes */${fileSize}` }
              });
            }

            const contentLength = end - start + 1;

            let fileStream: fs.ReadStream;
            const stream = new ReadableStream({
              start(controller) {
                let closed = false;
                fileStream = fs.createReadStream(filePath, { start, end });
                fileStream.on('data', (chunk: Buffer) => {
                  if (!closed) {
                    controller.enqueue(new Uint8Array(chunk));
                  }
                });
                fileStream.on('end', () => {
                  if (!closed) {
                    closed = true;
                    controller.close();
                  }
                });
                fileStream.on('error', (err) => {
                  if (!closed) {
                    closed = true;
                    controller.error(err);
                  }
                });
              },
              cancel() {
                fileStream?.destroy();
              }
            });

            return new Response(stream, {
              status: 206,
              headers: {
                'Content-Type': contentType,
                'Content-Length': String(contentLength),
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes'
              }
            });
          }
        }

        const fileBuffer = await fs.promises.readFile(filePath);
        return new Response(fileBuffer, {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Content-Length': String(fileSize),
            'Accept-Ranges': 'bytes'
          }
        });
      } catch (error) {
        return new Response('Internal Server Error', { status: 500 });
      }
    });
  } catch (err) {
    console.error('Failed to register media protocol:', err);
  }
}

/**
 * Main initialization - called AFTER splash screen is visible
 */
export async function initializeFullApp(controlWindow: BrowserWindow, isDev: boolean): Promise<void> {
  console.log('[AppLoader] Starting full initialization...');

  // Initialize display manager
  displayManager = new DisplayManager();

  // Grant camera permissions for getUserMedia (needed for camera display type)
  // Only 'media' is allowed; all other permissions (geolocation, notifications, etc.) are denied.
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'media');
  });

  // Handle synchronous permission checks (e.g., enumerateDevices label access)
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    return permission === 'media';
  });

  // Register protocol handlers
  registerMediaProtocol();

  // Register IPC handlers
  registerIpcHandlers(displayManager);
  setSocketControlWindow(controlWindow);

  // Start database initialization
  const dbPromise = initDatabase().catch((err) => {
    console.error('Database initialization failed:', err);
  });

  // Cleanup orphaned media files
  cleanupOrphanedFiles().catch((err) => {
    console.warn('Media cleanup warning:', err);
  });

  // Initialize ML translator in background
  initTranslator().then((success) => {
    if (success) {
      console.log('ML Translation model ready');
    } else {
      console.warn('ML Translation model failed to load');
    }
  }).catch((err) => {
    console.warn('ML Translation initialization error:', err);
  });

  // Auto-check for updates after the UI is fully loaded
  controlWindow.webContents.on('did-finish-load', () => {
    setTimeout(() => {
      console.log('[AppLoader] Auto-checking for updates...');
      checkForUpdates().catch((err) => {
        console.warn('[AppLoader] Auto-update check failed:', err);
      });
    }, 5000);
  });

  if (isDev) {
    // DEV MODE: Wait for both Vite and database before loading
    Promise.all([waitForVite(), dbPromise]).then(([ready]) => {
      if (ready && controlWindow && !controlWindow.isDestroyed()) {
        controlWindow.loadURL('http://localhost:5173');
        controlWindow.webContents.openDevTools({ mode: 'detach' });
      }
    });
  } else {
    // PRODUCTION: Start local server then load app
    const serverPromise = startLocalServer().then((port) => {
      setLocalServerPort(port);
      console.log(`[AppLoader] Local server started on port ${port}`);
    }).catch((err) => {
      console.error('Failed to start local server:', err);
      throw err; // Re-throw so Promise.all rejects instead of loading from port 0
    });

    // Wait for both server and database, then load the app
    Promise.all([serverPromise, dbPromise]).then(() => {
      console.log(`[AppLoader] Server and database ready, loading app...`);
      if (controlWindow && !controlWindow.isDestroyed()) {
        controlWindow.loadURL(`http://127.0.0.1:${localServerPort}/`);
      }
    }).catch((err) => {
      console.error('Failed to initialize:', err);
    });
  }

  // Watch for display changes
  displayManager.startWatching((displays) => {
    if (controlWindow && !controlWindow.isDestroyed()) {
      controlWindow.webContents.send('displays:changed', displays);
    }
  });

  // Handle window close
  controlWindow.on('closed', () => {
    displayManager.closeAllDisplays();
    app.quit();
  });

  console.log('[AppLoader] Initialization complete');
}

// Cleanup on quit
app.on('before-quit', () => {
  // Stop streaming if active and close the hidden streaming display
  streamingService.stop().catch(() => {});
  if (displayManager) {
    displayManager.closeStreamingDisplay();
    displayManager.stopWatching();
  }
  if (localServer) {
    localServer.close();
    localServer = null;
  }
  flushDatabase();
});

// Export for other modules
export { displayManager };
