import * as http from 'http';
import * as os from 'os';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { BrowserWindow } from 'electron';
import { EventEmitter } from 'events';
import { getRemoteControlUI } from './remoteControlUI';
import { getSongs } from '../database/songs';
import { getAllMediaItems } from '../database/media';
import { getBibleBooks, getBibleVerses } from './bibleService';

const DEFAULT_PORT = 45680;
const MAX_PORT_RETRIES = 10;
const PIN_LENGTH = 4;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const MAX_COMMANDS_PER_SECOND = 20;
const MAX_AUTH_ATTEMPTS = 5;

// Valid command types whitelist
const VALID_COMMANDS = new Set([
  'slide:next', 'slide:prev', 'slide:goto', 'slide:blank',
  'setlist:select',
  'mode:set',
  'library:addSong', 'library:selectSong',
  'library:addBible', 'library:selectBible',
  'library:addMedia', 'library:selectMedia',
  'media:stop',
  'audio:play', 'audio:pause', 'audio:stop', 'audio:volume', 'audio:seek',
  'video:play', 'video:pause', 'video:stop', 'video:seek', 'video:volume',
  'youtube:play', 'youtube:pause', 'youtube:stop', 'youtube:seek'
]);

// Rate limiting per client
const clientRateLimits = new Map<string, { lastCall: number; count: number }>();

// Brute-force protection: track failed auth attempts per socket
const authAttempts = new Map<string, number>();

function checkClientRateLimit(socketId: string): boolean {
  const now = Date.now();
  const limiter = clientRateLimits.get(socketId);

  if (!limiter || now - limiter.lastCall > 1000) {
    clientRateLimits.set(socketId, { lastCall: now, count: 1 });
    return true;
  }

  if (limiter.count >= MAX_COMMANDS_PER_SECOND) {
    return false;
  }

  limiter.count++;
  limiter.lastCall = now;
  return true;
}

export interface RemoteControlState {
  currentItem: {
    id: string;
    type: string;
    title: string;
    slideCount: number;
  } | null;
  currentSlideIndex: number;
  totalSlides: number;
  displayMode: 'bilingual' | 'original' | 'translation';
  isBlank: boolean;
  setlist: Array<{
    id: string;
    type: string;
    title: string;
  }>;
  slides: Array<{
    index: number;
    preview: string;
    verseType?: string;
    isCombined?: boolean;
  }>;
  activeTools: string[];
  onlineViewerCount: number;
  activeMedia: {
    type: 'image' | 'video';
    name: string;
  } | null;
  activeAudio: {
    name: string;
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    volume: number;
  } | null;
  activeVideo: {
    name: string;
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    volume: number;
  } | null;
  activeYoutube: {
    videoId: string;
    title: string;
    isPlaying: boolean;
    currentTime: number;
    duration: number;
  } | null;
}

export interface RemoteCommand {
  type: string;
  payload?: any;
}

class RemoteControlServer extends EventEmitter {
  private httpServer: http.Server | null = null;
  private io: SocketIOServer | null = null;
  private port: number = DEFAULT_PORT;
  private pin: string = '';
  private authenticatedSockets: Set<string> = new Set();
  private controlWindow: BrowserWindow | null = null;
  private currentState: RemoteControlState = {
    currentItem: null,
    currentSlideIndex: 0,
    totalSlides: 0,
    displayMode: 'bilingual',
    isBlank: false,
    setlist: [],
    slides: [],
    activeTools: [],
    onlineViewerCount: 0,
    activeMedia: null,
    activeAudio: null,
    activeVideo: null,
    activeYoutube: null
  };
  private sessionTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();

  constructor() {
    super();
    this.generatePin();
  }

  /**
   * Generate a random 6-digit PIN for better security
   */
  private generatePin(): void {
    this.pin = Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Get local network IP addresses
   */
  private getLocalIPs(): string[] {
    const interfaces = os.networkInterfaces();
    const ips: string[] = [];

    for (const iface of Object.values(interfaces)) {
      if (!iface) continue;
      for (const alias of iface) {
        if (alias.family === 'IPv4' && !alias.internal) {
          ips.push(alias.address);
        }
      }
    }

    return ips;
  }

  /**
   * Start the remote control server
   */
  start(port: number = DEFAULT_PORT, retryCount: number = 0): Promise<{ port: number; url: string; pin: string }> {
    return new Promise((resolve, reject) => {
      if (this.httpServer) {
        const ips = this.getLocalIPs();
        const url = ips.length > 0 ? `http://${ips[0]}:${this.port}` : `http://localhost:${this.port}`;
        resolve({ port: this.port, url, pin: this.pin });
        return;
      }

      if (retryCount >= MAX_PORT_RETRIES) {
        reject(new Error(`[RemoteControlServer] Failed to find available port after ${MAX_PORT_RETRIES} attempts`));
        return;
      }

      // Generate a new PIN on each start
      this.generatePin();
      this.port = port;

      // Create HTTP server
      this.httpServer = http.createServer((req, res) => this.handleHttpRequest(req, res));

      // Store reference for cleanup
      const currentServer = this.httpServer;

      this.httpServer.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          if (currentServer) {
            currentServer.removeAllListeners();
            currentServer.close();
          }
          this.httpServer = null;
          this.start(port + 1, retryCount + 1).then(resolve).catch(reject);
        } else {
          reject(err);
        }
      });

      this.httpServer.listen(port, '0.0.0.0', () => {
        console.log(`[RemoteControlServer] Started on port ${port}`);
        this.port = port;

        // Initialize Socket.IO - restrict CORS to local network only
        this.io = new SocketIOServer(this.httpServer!, {
          cors: {
            origin: (origin, callback) => {
              // Allow requests with no origin (mobile apps, curl, etc.)
              if (!origin) return callback(null, true);
              // Allow localhost and local network IPs
              const allowedPatterns = [
                /^https?:\/\/localhost(:\d+)?$/,
                /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
                /^https?:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/,
                /^https?:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/,
                /^https?:\/\/172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}(:\d+)?$/
              ];
              const isAllowed = allowedPatterns.some(pattern => pattern.test(origin));
              callback(null, isAllowed);
            },
            methods: ['GET', 'POST']
          }
        });

        this.setupSocketHandlers();

        const ips = this.getLocalIPs();
        const url = ips.length > 0 ? `http://${ips[0]}:${this.port}` : `http://localhost:${this.port}`;

        resolve({ port: this.port, url, pin: this.pin });
      });
    });
  }

  /**
   * Stop the server
   */
  stop(): void {
    // Clear all session timeouts
    for (const timeout of this.sessionTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.sessionTimeouts.clear();

    // Clear authenticated sockets and auth attempts
    this.authenticatedSockets.clear();
    clientRateLimits.clear();
    authAttempts.clear();

    if (this.io) {
      this.io.close();
      this.io = null;
    }

    if (this.httpServer) {
      this.httpServer.removeAllListeners();
      this.httpServer.close();
      this.httpServer = null;
    }
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return this.httpServer !== null;
  }

  /**
   * Get server status
   */
  getStatus(): { running: boolean; url: string | null; pin: string; clients: number } {
    if (!this.httpServer) {
      return { running: false, url: null, pin: this.pin, clients: 0 };
    }

    const ips = this.getLocalIPs();
    const url = ips.length > 0 ? `http://${ips[0]}:${this.port}` : `http://localhost:${this.port}`;

    return {
      running: true,
      url,
      pin: this.pin,
      clients: this.authenticatedSockets.size
    };
  }

  /**
   * Set the control window reference for forwarding commands
   */
  setControlWindow(window: BrowserWindow): void {
    this.controlWindow = window;
  }

  /**
   * Update state and broadcast to all authenticated clients
   */
  updateState(state: Partial<RemoteControlState>): void {
    this.currentState = { ...this.currentState, ...state };
    this.broadcastState();
  }

  /**
   * Broadcast current state to all authenticated clients
   */
  private broadcastState(): void {
    if (!this.io) return;

    for (const socketId of this.authenticatedSockets) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit('state', this.currentState);
      }
    }
  }

  /**
   * Setup Socket.IO event handlers
   */
  private setupSocketHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket: Socket) => {
      console.log(`[RemoteControlServer] Client connected: ${socket.id}`);

      // Handle authentication with brute-force protection
      socket.on('authenticate', (pin: string) => {
        // Check if already blocked due to too many failed attempts
        const attempts = authAttempts.get(socket.id) || 0;
        if (attempts >= MAX_AUTH_ATTEMPTS) {
          socket.emit('authenticated', { success: false, error: 'Too many failed attempts. Please reconnect.' });
          socket.disconnect(true);
          return;
        }

        if (pin === this.pin) {
          // Reset failed attempts on success
          authAttempts.delete(socket.id);
          this.authenticatedSockets.add(socket.id);
          this.resetSessionTimeout(socket.id);
          socket.emit('authenticated', { success: true });
          // Send current state immediately
          socket.emit('state', this.currentState);
          console.log(`[RemoteControlServer] Client authenticated: ${socket.id}`);
        } else {
          // Increment failed attempts
          authAttempts.set(socket.id, attempts + 1);
          const remaining = MAX_AUTH_ATTEMPTS - attempts - 1;
          socket.emit('authenticated', {
            success: false,
            error: remaining > 0 ? `Invalid PIN. ${remaining} attempts remaining.` : 'Too many failed attempts.'
          });
          console.log(`[RemoteControlServer] Client auth failed: ${socket.id} (attempt ${attempts + 1}/${MAX_AUTH_ATTEMPTS})`);

          // Disconnect if max attempts reached
          if (remaining <= 0) {
            socket.disconnect(true);
          }
        }
      });

      // Handle commands (only from authenticated clients)
      socket.on('command', (command: RemoteCommand) => {
        if (!this.authenticatedSockets.has(socket.id)) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }

        // Validate command type
        if (!command?.type || !VALID_COMMANDS.has(command.type)) {
          socket.emit('error', { message: 'Invalid command type' });
          console.log(`[RemoteControlServer] Invalid command rejected: ${command?.type}`);
          return;
        }

        // Rate limiting
        if (!checkClientRateLimit(socket.id)) {
          socket.emit('error', { message: 'Rate limit exceeded' });
          return;
        }

        this.resetSessionTimeout(socket.id);
        this.handleCommand(command);
      });

      // Handle data requests (only from authenticated clients)
      socket.on('getSongs', async (callback: (data: any) => void) => {
        if (!this.authenticatedSockets.has(socket.id)) {
          callback({ error: 'Not authenticated' });
          return;
        }
        this.resetSessionTimeout(socket.id);
        try {
          const songs = await getSongs();
          // Send simplified song data for mobile
          const simplifiedSongs = songs.map((s: any) => ({
            id: s.id,
            title: s.title,
            author: s.author,
            originalLanguage: s.originalLanguage,
            slideCount: s.slides?.length || 0
          }));
          callback({ songs: simplifiedSongs });
        } catch (error) {
          console.error('[RemoteControlServer] Error fetching songs:', error);
          callback({ error: 'Failed to fetch songs' });
        }
      });

      socket.on('getSongDetails', async (songId: string, callback: (data: any) => void) => {
        if (!this.authenticatedSockets.has(socket.id)) {
          callback({ error: 'Not authenticated' });
          return;
        }
        this.resetSessionTimeout(socket.id);
        try {
          const songs = await getSongs();
          const song = songs.find((s: any) => s.id === songId);
          if (song) {
            callback({ song });
          } else {
            callback({ error: 'Song not found' });
          }
        } catch (error) {
          console.error('[RemoteControlServer] Error fetching song details:', error);
          callback({ error: 'Failed to fetch song' });
        }
      });

      socket.on('getBibleBooks', async (callback: (data: any) => void) => {
        if (!this.authenticatedSockets.has(socket.id)) {
          callback({ error: 'Not authenticated' });
          return;
        }
        this.resetSessionTimeout(socket.id);
        try {
          const books = await getBibleBooks();
          callback({ books });
        } catch (error) {
          console.error('[RemoteControlServer] Error fetching Bible books:', error);
          callback({ error: 'Failed to fetch Bible books' });
        }
      });

      socket.on('getBibleChapter', async (data: { book: string; chapter: number }, callback: (data: any) => void) => {
        if (!this.authenticatedSockets.has(socket.id)) {
          callback({ error: 'Not authenticated' });
          return;
        }
        this.resetSessionTimeout(socket.id);
        try {
          const result = await getBibleVerses(data.book, data.chapter);
          callback({ verses: result.verses });
        } catch (error) {
          console.error('[RemoteControlServer] Error fetching Bible chapter:', error);
          callback({ error: 'Failed to fetch chapter' });
        }
      });

      socket.on('getMedia', async (callback: (data: any) => void) => {
        if (!this.authenticatedSockets.has(socket.id)) {
          callback({ error: 'Not authenticated' });
          return;
        }
        this.resetSessionTimeout(socket.id);
        try {
          const media = getAllMediaItems();
          // Send simplified media data
          const simplifiedMedia = media.map((m: any) => ({
            id: m.id,
            name: m.name,
            type: m.type,
            thumbnailPath: m.thumbnailPath,
            duration: m.duration
          }));
          callback({ media: simplifiedMedia });
        } catch (error) {
          console.error('[RemoteControlServer] Error fetching media:', error);
          callback({ error: 'Failed to fetch media' });
        }
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        console.log(`[RemoteControlServer] Client disconnected: ${socket.id}`);
        this.authenticatedSockets.delete(socket.id);
        const timeout = this.sessionTimeouts.get(socket.id);
        if (timeout) {
          clearTimeout(timeout);
          this.sessionTimeouts.delete(socket.id);
        }
        clientRateLimits.delete(socket.id);
        authAttempts.delete(socket.id);
      });
    });
  }

  /**
   * Reset session timeout for a client
   */
  private resetSessionTimeout(socketId: string): void {
    const existing = this.sessionTimeouts.get(socketId);
    if (existing) {
      clearTimeout(existing);
    }

    const timeout = setTimeout(() => {
      const socket = this.io?.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit('session_expired');
        socket.disconnect(true);
      }
      this.authenticatedSockets.delete(socketId);
      this.sessionTimeouts.delete(socketId);
    }, SESSION_TIMEOUT_MS);

    this.sessionTimeouts.set(socketId, timeout);
  }

  /**
   * Handle a command from a mobile client
   */
  private handleCommand(command: RemoteCommand): void {
    // Forward command to control window
    if (this.controlWindow && !this.controlWindow.isDestroyed()) {
      this.controlWindow.webContents.send('remote:command', command);
    }

    // Emit event for other handlers
    this.emit('command', command);
  }

  /**
   * Handle HTTP requests (serve mobile UI)
   */
  private handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = req.url || '/';

    if (url === '/' || url.startsWith('/?')) {
      // Serve mobile UI with CSP headers
      const html = getRemoteControlUI(this.port);
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self' ws: wss:; img-src 'self' data:"
      });
      res.end(html);
    } else {
      // Don't expose status endpoint - authentication is handled via Socket.IO
      res.writeHead(404);
      res.end('Not Found');
    }
  }
}

// Export singleton instance
export const remoteControlServer = new RemoteControlServer();
