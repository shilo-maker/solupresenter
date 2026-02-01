import { app, BrowserWindow, ipcMain, screen, dialog, protocol, net } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import { DisplayManager, setLocalServerPort } from './windows/displayManager';
import { registerIpcHandlers, setSocketControlWindow } from './ipc';
import { initDatabase, flushDatabase } from './database';
import { initTranslator } from './services/mlTranslation';
import { cleanupOrphanedFiles } from './services/mediaProcessor';

// Local server for production (needed for YouTube to work - requires http:// origin)
let localServer: http.Server | null = null;
let localServerPort = 0;

// Export getter function for localServerPort (ES modules don't provide live bindings for reassigned let variables)
export function getLocalServerPort(): number {
  return localServerPort;
}

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

  controlWindow = new BrowserWindow({
    x: primaryDisplay.bounds.x + 50,
    y: primaryDisplay.bounds.y + 50,
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'SoluCast',
    icon: iconPath,
    show: false, // Don't show until ready
    backgroundColor: '#09090b', // Match app background to prevent white flash
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'control.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  controlWindow.setMenu(null);

  // Show window with smooth fade when ready to display
  controlWindow.once('ready-to-show', () => {
    controlWindow?.show();
  });

  // Load the renderer
  if (isDev) {
    controlWindow.loadURL('http://localhost:5173');
    controlWindow.webContents.openDevTools({ mode: 'detach' });
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

    // Whitelist of allowed media extensions
    const allowedMediaExtensions = new Set([
      '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg',
      '.mp4', '.webm', '.mov', '.avi', '.mkv', '.wmv', '.m4v',
      '.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac'
    ]);

    localServer = http.createServer(async (req, res) => {
      const reqUrl = req.url || '/';
      console.log('[LocalServer] Incoming request:', req.method, reqUrl.substring(0, 100));

      // Add CORS headers for all responses (needed for display windows in dev mode)
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');

      // Handle preflight OPTIONS requests
      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      // Handle media requests: /media/<base64-encoded-path>
      if (reqUrl.startsWith('/media/')) {
        try {
          const encodedPath = reqUrl.substring(7); // Remove '/media/'
          // Convert URL-safe base64 back to standard base64
          // Replace - with +, _ with /, and add padding if needed
          let base64Path = decodeURIComponent(encodedPath)
            .replace(/-/g, '+')
            .replace(/_/g, '/');
          // Add padding if needed
          while (base64Path.length % 4 !== 0) {
            base64Path += '=';
          }
          const mediaPath = Buffer.from(base64Path, 'base64').toString('utf8');
          console.log('[LocalServer] Media request for:', mediaPath);

          // Security: validate file extension
          const ext = path.extname(mediaPath).toLowerCase();
          if (!allowedMediaExtensions.has(ext)) {
            console.error('[LocalServer] Disallowed file extension:', ext);
            res.writeHead(403);
            res.end('Forbidden');
            return;
          }

          // Security: ensure path is absolute and doesn't contain traversal
          if (!path.isAbsolute(mediaPath) || mediaPath.includes('..')) {
            console.error('[LocalServer] Invalid media path:', mediaPath);
            res.writeHead(403);
            res.end('Forbidden');
            return;
          }

          // Check if file exists
          if (!fs.existsSync(mediaPath)) {
            console.error('[LocalServer] Media file not found:', mediaPath);
            res.writeHead(404);
            res.end('Not Found');
            return;
          }

          const stat = await fs.promises.stat(mediaPath);
          const fileSize = stat.size;
          const contentType = mimeTypes[ext] || 'application/octet-stream';
          console.log('[LocalServer] File size:', fileSize, 'Content-Type:', contentType);

          // Handle range requests for video/audio streaming
          const rangeHeader = req.headers.range;
          console.log('[LocalServer] Range header:', rangeHeader);

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
              console.log('[LocalServer] Serving range:', start, '-', end, 'chunk size:', chunkSize);

              // Always use 206 for range requests - this tells the browser we support seeking
              res.writeHead(206, {
                'Content-Type': contentType,
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunkSize
              });

              // Manual streaming with explicit drain handling
              const fileStream = fs.createReadStream(mediaPath, { start, end, highWaterMark: 1024 * 1024 }); // 1MB chunks
              let bytesSent = 0;
              let isClientConnected = true;

              res.on('close', () => {
                console.log('[LocalServer] Response closed, bytes sent:', bytesSent);
                isClientConnected = false;
                fileStream.destroy();
              });

              res.on('error', (err) => {
                console.error('[LocalServer] Response error:', err);
                isClientConnected = false;
                fileStream.destroy();
              });

              fileStream.on('error', (err) => {
                console.error('[LocalServer] File stream error:', err);
                if (!res.headersSent) {
                  res.writeHead(500);
                }
                res.end();
              });

              fileStream.on('data', (chunk) => {
                if (!isClientConnected) {
                  fileStream.destroy();
                  return;
                }

                bytesSent += chunk.length;
                if (bytesSent <= 1000000 || bytesSent % 10000000 < 1100000) {
                  console.log('[LocalServer] Sending chunk, total bytes:', bytesSent);
                }

                const canContinue = res.write(chunk);
                if (!canContinue) {
                  // Backpressure - pause until drained
                  fileStream.pause();
                  res.once('drain', () => {
                    if (isClientConnected) {
                      fileStream.resume();
                    }
                  });
                }
              });

              fileStream.on('end', () => {
                console.log('[LocalServer] Stream complete, total bytes:', bytesSent);
                res.end();
              });

              return;
            }
          }

          // Full file response - no Range header (rare case)
          console.log('[LocalServer] Serving full file (no range), size:', fileSize);
          res.writeHead(200, {
            'Content-Type': contentType,
            'Content-Length': fileSize,
            'Accept-Ranges': 'bytes'
          });

          // Use same manual streaming for consistency
          const fileStream = fs.createReadStream(mediaPath, { highWaterMark: 1024 * 1024 });
          let bytesSent = 0;
          let isClientConnected = true;

          res.on('close', () => {
            console.log('[LocalServer] Response closed (full file), bytes sent:', bytesSent);
            isClientConnected = false;
            fileStream.destroy();
          });

          res.on('error', (err) => {
            console.error('[LocalServer] Response error (full file):', err);
            isClientConnected = false;
            fileStream.destroy();
          });

          fileStream.on('error', (err) => {
            console.error('[LocalServer] File stream error (full file):', err);
            if (!res.headersSent) {
              res.writeHead(500);
            }
            res.end();
          });

          fileStream.on('data', (chunk) => {
            if (!isClientConnected) {
              fileStream.destroy();
              return;
            }
            bytesSent += chunk.length;
            if (bytesSent <= 1000000 || bytesSent % 10000000 < 1100000) {
              console.log('[LocalServer] Full file chunk, total bytes:', bytesSent);
            }
            const canContinue = res.write(chunk);
            if (!canContinue) {
              fileStream.pause();
              res.once('drain', () => {
                if (isClientConnected) {
                  fileStream.resume();
                }
              });
            }
          });

          fileStream.on('end', () => {
            console.log('[LocalServer] Full file stream complete, total bytes:', bytesSent);
            res.end();
          });

          return;
        } catch (error) {
          console.error('[LocalServer] Media request error:', error);
          res.writeHead(500);
          res.end('Internal Server Error');
          return;
        }
      }

      let filePath = reqUrl;

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
        try {
          if (err) {
            // Try index.html for SPA routing
            fs.readFile(path.join(rendererPath, 'index.html'), (err2, data2) => {
              try {
                if (err2) {
                  res.writeHead(404);
                  res.end('Not Found');
                } else {
                  res.writeHead(200, { 'Content-Type': 'text/html' });
                  res.end(data2);
                }
              } catch (responseError) {
                console.error('[LocalServer] Error sending fallback response:', responseError);
              }
            });
            return;
          }

          const ext = path.extname(fullPath).toLowerCase();
          const contentType = mimeTypes[ext] || 'application/octet-stream';
          res.writeHead(200, { 'Content-Type': contentType });
          res.end(data);
        } catch (responseError) {
          console.error('[LocalServer] Error sending response:', responseError);
        }
      });
    });

    // Find available port starting from 45678
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

async function initializeApp(): Promise<void> {
  // Initialize database
  try {
    await initDatabase();
  } catch (err) {
    console.error('Database initialization failed:', err);
  }

  // Cleanup orphaned media files from previous crashes
  cleanupOrphanedFiles().catch((err) => {
    console.warn('Media cleanup warning:', err);
  });

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
  displayManager = new DisplayManager();

  // Register IPC handlers
  registerIpcHandlers(displayManager);

  // Register media protocol handler with streaming support

  // Whitelist of allowed file extensions for security
  const ALLOWED_MEDIA_EXTENSIONS = new Set([
    // Images
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg',
    // Videos
    '.mp4', '.webm', '.mov', '.avi', '.mkv', '.wmv', '.m4v',
    // Audio
    '.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac'
  ]);

  try {
    protocol.handle('media', async (request) => {
      try {
        // Extract file path from media:// URL
        const url = new URL(request.url);
        console.log('[media protocol] Request URL:', request.url);
        console.log('[media protocol] pathname:', url.pathname);

        let filePath = decodeURIComponent(url.pathname);
        console.log('[media protocol] Decoded pathname:', filePath);

        // Remove /file/ prefix if present (used in media://file/C:/path format)
        if (filePath.startsWith('/file/')) {
          filePath = filePath.substring(6); // Remove '/file/'
          console.log('[media protocol] After removing /file/:', filePath);
        } else if (filePath.startsWith('/')) {
          // On Windows, pathname starts with / before drive letter, remove it
          filePath = filePath.substring(1);
          console.log('[media protocol] After removing leading /:', filePath);
        }

        // Convert forward slashes to backslashes on Windows
        if (process.platform === 'win32') {
          filePath = filePath.replace(/\//g, '\\');
        }

        // Normalize path to resolve any . or redundant separators
        filePath = path.normalize(filePath);
        console.log('[media protocol] Final path:', filePath);
        console.log('[media protocol] File exists:', fs.existsSync(filePath));

        // Security: prevent directory traversal
        if (filePath.includes('..')) {
          console.error('[media protocol] Path traversal attempt blocked:', request.url);
          return new Response('Forbidden', { status: 403 });
        }

        // Security: ensure path is absolute
        if (!path.isAbsolute(filePath)) {
          console.error('[media protocol] Non-absolute path rejected:', filePath);
          return new Response('Forbidden', { status: 403 });
        }

        // Security: validate file extension
        const ext = path.extname(filePath).toLowerCase();
        if (!ALLOWED_MEDIA_EXTENSIONS.has(ext)) {
          console.error('[media protocol] Disallowed file extension:', ext);
          return new Response('Forbidden', { status: 403 });
        }

        // Check if file exists
        if (!fs.existsSync(filePath)) {
          console.error('[media protocol] File not found:', filePath);
          return new Response('Not Found', { status: 404 });
        }

        // Security: check for symlinks and resolve to real path
        const lstatResult = await fs.promises.lstat(filePath);
        if (lstatResult.isSymbolicLink()) {
          const realPath = await fs.promises.realpath(filePath);
          // Ensure the real path still has an allowed extension
          const realExt = path.extname(realPath).toLowerCase();
          if (!ALLOWED_MEDIA_EXTENSIONS.has(realExt)) {
            console.error('[media protocol] Symlink target has disallowed extension:', realPath);
            return new Response('Forbidden', { status: 403 });
          }
          // Use the real path for serving
          filePath = realPath;
          console.log('[media protocol] Resolved symlink to:', filePath);
        }

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

      // For videos and audio: use ReadableStream for proper streaming
      console.log('[media protocol] isStreamable:', isStreamable, 'rangeHeader:', rangeHeader, 'fileSize:', fileSize);

      if (isStreamable) {
        // Parse range header
        let start = 0;
        let end = fileSize - 1;
        let isRangeRequest = false;

        if (rangeHeader) {
          const rangeMatch = rangeHeader.match(/bytes=(\d+)-(\d*)/);
          if (rangeMatch) {
            start = parseInt(rangeMatch[1], 10);
            if (rangeMatch[2]) {
              end = parseInt(rangeMatch[2], 10);
            }
            isRangeRequest = true;
          }
        }

        // Clamp values
        if (end >= fileSize) end = fileSize - 1;
        if (start >= fileSize) {
          return new Response('Range Not Satisfiable', {
            status: 416,
            headers: { 'Content-Range': `bytes */${fileSize}` }
          });
        }

        const contentLength = end - start + 1;
        console.log('[media protocol] Streaming range:', start, '-', end, 'length:', contentLength);

        // Create a ReadableStream from the file
        let fileStream: fs.ReadStream | null = null;
        let isClosed = false;

        const stream = new ReadableStream({
          start(controller) {
            fileStream = fs.createReadStream(filePath, { start, end });

            fileStream.on('data', (chunk: Buffer | string) => {
              if (isClosed) return; // Don't enqueue if already closed
              try {
                if (typeof chunk === 'string') {
                  controller.enqueue(new TextEncoder().encode(chunk));
                } else {
                  controller.enqueue(new Uint8Array(chunk));
                }
              } catch (err) {
                // Controller may have been closed
                console.log('[media protocol] Enqueue failed (controller likely closed)');
                fileStream?.destroy();
              }
            });

            fileStream.on('end', () => {
              if (isClosed) return;
              isClosed = true;
              try {
                controller.close();
              } catch (err) {
                // Already closed
              }
            });

            fileStream.on('error', (err) => {
              if (isClosed) return;
              isClosed = true;
              console.error('[media protocol] Stream error:', err);
              try {
                controller.error(err);
              } catch (e) {
                // Already closed
              }
            });
          },
          cancel() {
            console.log('[media protocol] Stream cancelled by consumer');
            isClosed = true;
            fileStream?.destroy();
          }
        });

        const headers: Record<string, string> = {
          'Content-Type': contentType,
          'Content-Length': String(contentLength),
          'Accept-Ranges': 'bytes'
        };

        if (isRangeRequest) {
          headers['Content-Range'] = `bytes ${start}-${end}/${fileSize}`;
          console.log('[media protocol] Returning 206 with Content-Range:', headers['Content-Range']);
          return new Response(stream, {
            status: 206,
            headers
          });
        } else {
          console.log('[media protocol] Returning 200 with full stream');
          return new Response(stream, {
            status: 200,
            headers
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
      } catch (error) {
        console.error('[media protocol] Error handling request:', error);
        return new Response('Internal Server Error', { status: 500 });
      }
    });
  } catch (err) {
    console.error('Failed to register media protocol:', err);
  }

  // Register app protocol for serving renderer files (needed for YouTube to work)
  if (!isDev) {
    try {
      const rendererPath = path.join(__dirname, '../../renderer');

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
    } catch (err) {
      console.error('Failed to register app protocol:', err);
    }

    // Start local HTTP server for production (needed for YouTube)
    try {
      const port = await startLocalServer();
      setLocalServerPort(port);
    } catch (err) {
      console.error('Failed to start local server:', err);
    }
  } else {
    // In dev mode, also start local HTTP server just for media file serving
    // (renderer is served by Vite, but media files need our server)
    try {
      const port = await startLocalServer();
      setLocalServerPort(port);
      console.log(`[Dev] Media server started on port ${port}`);
    } catch (err) {
      console.error('Failed to start media server:', err);
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

// Cleanup on quit to ensure all resources are properly released
app.on('before-quit', () => {
  // Stop watching for display changes
  if (displayManager) {
    displayManager.stopWatching();
  }

  // Close local HTTP server
  if (localServer) {
    localServer.close();
    localServer = null;
  }

  // Flush database
  flushDatabase();
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
