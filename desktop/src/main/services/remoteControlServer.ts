import * as http from 'http';
import * as os from 'os';
import { exec } from 'child_process';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { BrowserWindow } from 'electron';
import { EventEmitter } from 'events';
import { getRemoteControlUI } from './remoteControlUI';
import { getMidiBridgeUI } from './midiBridgeUI';
import { getSongs } from '../database/songs';
import { getAllMediaItems, getMediaItem } from '../database/media';
import { getBibleBooks, getBibleVerses } from './bibleService';
import { getPresentations, getPresentation } from '../database/presentations';
import { getThemes, getTheme } from '../database/themes';
import { getStageThemes, getStageTheme } from '../database/stageThemes';
import { getBibleThemes, getBibleTheme } from '../database/bibleThemes';
import { getPrayerThemes, getPrayerTheme } from '../database/prayerThemes';
import { getSelectedThemeIds, saveSelectedThemeId } from '../database/index';
import type { DisplayManager } from '../windows/displayManager';

const FIREWALL_RULE_NAME = 'SoluCast Remote Control';

/**
 * Resolve translation from a slide's translations map (main process version).
 * Mirrors resolveTranslation from src/renderer/utils/translationUtils.ts.
 */
function resolveSlideTranslation(
  slide: any,
  preferredLang: string
): { translation: string; translationOverflow: string } {
  if (slide?.translations && typeof slide.translations === 'object' && !Array.isArray(slide.translations) && Object.keys(slide.translations).length > 0) {
    const text = slide.translations[preferredLang]
      || slide.translations['en']
      || Object.values(slide.translations)[0]
      || '';
    if (typeof text !== 'string') {
      return { translation: slide?.translation || '', translationOverflow: slide?.translationOverflow || '' };
    }
    const nlIdx = text.indexOf('\n');
    if (nlIdx !== -1) {
      return { translation: text.substring(0, nlIdx), translationOverflow: text.substring(nlIdx + 1) };
    }
    return { translation: text, translationOverflow: '' };
  }
  return { translation: slide?.translation || '', translationOverflow: slide?.translationOverflow || '' };
}

const DEFAULT_PORT = 45680;
const MAX_PORT_RETRIES = 10;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const MAX_COMMANDS_PER_SECOND = 20;
const MAX_AUTH_ATTEMPTS = 5;
const DEVICE_ID_REGEX = /^[a-zA-Z0-9_\-=.:]+$/; // Valid Chromium device ID characters

// MIDI bridge command whitelist (strict subset of VALID_COMMANDS)
const MIDI_ALLOWED_COMMANDS = new Set([
  'slide:next', 'slide:prev', 'slide:goto', 'slide:blank',
  'setlist:select', 'song:identify', 'item:identify',
  'item:activate', 'item:pause', 'item:stop', 'item:loopOn', 'item:loopOff'
]);

// Valid command types whitelist
const VALID_COMMANDS = new Set([
  'slide:next', 'slide:prev', 'slide:goto', 'slide:blank',
  'setlist:select', 'song:identify', 'item:identify',
  'item:activate', 'item:pause', 'item:stop', 'item:loopOn', 'item:loopOff',
  'mode:set',
  'library:addSong', 'library:selectSong',
  'library:addBible', 'library:selectBible',
  'library:addMedia', 'library:selectMedia',
  'library:addPresentation', 'library:selectPresentation',
  'media:stop',
  'audio:play', 'audio:pause', 'audio:stop', 'audio:volume', 'audio:seek',
  'video:play', 'video:pause', 'video:stop', 'video:seek', 'video:volume', 'video:mute',
  'youtube:play', 'youtube:pause', 'youtube:stop', 'youtube:seek'
]);

// Rate limiting per client
const clientRateLimits = new Map<string, { lastCall: number; count: number }>();

// Brute-force protection: track failed auth attempts per socket
const authAttempts = new Map<string, number>();

// Periodic cleanup interval for rate limiter maps (every 5 minutes)
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const RATE_LIMIT_STALE_MS = 60 * 1000; // Consider entries stale after 1 minute of inactivity

let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function startMapCleanup(): void {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    // Clean up stale rate limit entries
    Array.from(clientRateLimits.entries()).forEach(([socketId, limiter]) => {
      if (now - limiter.lastCall > RATE_LIMIT_STALE_MS) {
        clientRateLimits.delete(socketId);
      }
    });
  }, CLEANUP_INTERVAL_MS);
}

function stopMapCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

// Simple cache for database queries to reduce latency
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}
const CACHE_TTL_MS = 30000; // 30 second cache
const BIBLE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minute cache for Bible (rarely changes)

const songsCache: { entry: CacheEntry<any[]> | null } = { entry: null };
const bibleCache: { books: CacheEntry<any[]> | null; chapters: Map<string, CacheEntry<any>> } = {
  books: null,
  chapters: new Map()
};

async function getCachedSongs(): Promise<any[]> {
  const now = Date.now();
  if (songsCache.entry && (now - songsCache.entry.timestamp) < CACHE_TTL_MS) {
    return songsCache.entry.data;
  }
  const songs = await getSongs();
  songsCache.entry = { data: songs, timestamp: now };
  return songs;
}

async function getCachedBibleBooks(): Promise<any[]> {
  const now = Date.now();
  if (bibleCache.books && (now - bibleCache.books.timestamp) < BIBLE_CACHE_TTL_MS) {
    return bibleCache.books.data;
  }
  const books = await getBibleBooks();
  bibleCache.books = { data: books, timestamp: now };
  return books;
}

async function getCachedBibleChapter(book: string, chapter: number): Promise<any> {
  const now = Date.now();
  const cacheKey = `${book}:${chapter}`;
  const cached = bibleCache.chapters.get(cacheKey);
  if (cached && (now - cached.timestamp) < BIBLE_CACHE_TTL_MS) {
    return cached.data;
  }
  const result = await getBibleVerses(book, chapter);
  bibleCache.chapters.set(cacheKey, { data: result, timestamp: now });

  // Limit cache size to prevent memory bloat (keep last 20 chapters)
  if (bibleCache.chapters.size > 20) {
    const oldestKey = bibleCache.chapters.keys().next().value;
    if (oldestKey) bibleCache.chapters.delete(oldestKey);
  }

  return result;
}

// Media cache (synchronous function but still worth caching to avoid disk I/O)
const mediaCache: { entry: CacheEntry<any[]> | null } = { entry: null };

function getCachedMedia(): any[] {
  const now = Date.now();
  if (mediaCache.entry && (now - mediaCache.entry.timestamp) < CACHE_TTL_MS) {
    return mediaCache.entry.data;
  }
  const media = getAllMediaItems();
  mediaCache.entry = { data: media, timestamp: now };
  return media;
}

// Presentations cache
const presentationsCache: { entry: CacheEntry<any[]> | null } = { entry: null };

async function getCachedPresentations(): Promise<any[]> {
  const now = Date.now();
  if (presentationsCache.entry && (now - presentationsCache.entry.timestamp) < CACHE_TTL_MS) {
    return presentationsCache.entry.data;
  }
  const presentations = await getPresentations();
  presentationsCache.entry = { data: presentations, timestamp: now };
  return presentations;
}

// Theme caches
const themesCache: { entry: CacheEntry<any[]> | null } = { entry: null };
const stageThemesCache: { entry: CacheEntry<any[]> | null } = { entry: null };
const bibleThemesCache: { entry: CacheEntry<any[]> | null } = { entry: null };
const prayerThemesCache: { entry: CacheEntry<any[]> | null } = { entry: null };

async function getCachedThemes(): Promise<any[]> {
  const now = Date.now();
  if (themesCache.entry && (now - themesCache.entry.timestamp) < CACHE_TTL_MS) {
    return themesCache.entry.data;
  }
  const themes = await getThemes();
  themesCache.entry = { data: themes, timestamp: now };
  return themes;
}

function getCachedStageThemes(): any[] {
  const now = Date.now();
  if (stageThemesCache.entry && (now - stageThemesCache.entry.timestamp) < CACHE_TTL_MS) {
    return stageThemesCache.entry.data;
  }
  const themes = getStageThemes();
  stageThemesCache.entry = { data: themes, timestamp: now };
  return themes;
}

async function getCachedBibleThemes(): Promise<any[]> {
  const now = Date.now();
  if (bibleThemesCache.entry && (now - bibleThemesCache.entry.timestamp) < CACHE_TTL_MS) {
    return bibleThemesCache.entry.data;
  }
  const themes = await getBibleThemes();
  bibleThemesCache.entry = { data: themes, timestamp: now };
  return themes;
}

async function getCachedPrayerThemes(): Promise<any[]> {
  const now = Date.now();
  if (prayerThemesCache.entry && (now - prayerThemesCache.entry.timestamp) < CACHE_TTL_MS) {
    return prayerThemesCache.entry.data;
  }
  const themes = await getPrayerThemes();
  prayerThemesCache.entry = { data: themes, timestamp: now };
  return themes;
}

// Invalidate songs cache (call when songs are modified)
export function invalidateSongsCache(): void {
  songsCache.entry = null;
}

// Invalidate media cache (call when media is modified)
export function invalidateMediaCache(): void {
  mediaCache.entry = null;
}

// Invalidate presentations cache (call when presentations are modified)
export function invalidatePresentationsCache(): void {
  presentationsCache.entry = null;
}

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

/**
 * Ensure Windows Firewall rule exists for the remote control port
 */
function ensureFirewallRule(port: number): Promise<void> {
  return new Promise((resolve) => {
    // Only run on Windows
    if (process.platform !== 'win32') {
      resolve();
      return;
    }

    // Check if rule already exists
    const checkCmd = `netsh advfirewall firewall show rule name="${FIREWALL_RULE_NAME}"`;
    exec(checkCmd, (checkError, stdout) => {
      if (!checkError && stdout.includes(`${port}`)) {
        // Rule exists with correct port, nothing to do
        console.log(`[RemoteControlServer] Firewall rule already exists for port ${port}`);
        resolve();
      } else if (!checkError) {
        // Rule exists but may have wrong port - delete and recreate
        const deleteCmd = `netsh advfirewall firewall delete rule name="${FIREWALL_RULE_NAME}"`;
        exec(deleteCmd, () => {
          // Ignore delete errors, try to create anyway
          const createCmd = `netsh advfirewall firewall add rule name="${FIREWALL_RULE_NAME}" dir=in action=allow protocol=TCP localport=${port}`;
          exec(createCmd, (createError) => {
            if (createError) {
              console.log('[RemoteControlServer] Could not update firewall rule (may need admin rights)');
            } else {
              console.log(`[RemoteControlServer] Updated firewall rule for port ${port}`);
            }
            resolve();
          });
        });
      } else {
        // Rule doesn't exist, create it
        const createCmd = `netsh advfirewall firewall add rule name="${FIREWALL_RULE_NAME}" dir=in action=allow protocol=TCP localport=${port}`;
        exec(createCmd, (createError) => {
          if (createError) {
            console.log('[RemoteControlServer] Could not create firewall rule (may need admin rights)');
            console.log('[RemoteControlServer] Remote control may not work from other devices');
          } else {
            console.log(`[RemoteControlServer] Created firewall rule for port ${port}`);
          }
          resolve();
        });
      }
    });
  });
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
  // Full slide data for direct broadcasting (not sent to mobile clients)
  fullSlides?: Array<any>;
  songTitle?: string;
  // Full setlist with complete song/presentation data (not sent to mobile clients)
  fullSetlist?: Array<any>;
  // Current content type for theme selection
  currentContentType?: 'song' | 'bible' | 'prayer' | 'presentation';
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
  // Translation language for multi-translation songs
  translationLanguage?: string;
}

export interface RemoteCommand {
  type: string;
  payload?: any;
}

// Simple hash function for state comparison
function simpleHash(obj: any): string {
  return JSON.stringify(obj);
}

// Combined slide types for original-only mode (replicated from slideUtils.ts)
interface CombinedSlideItem {
  type: 'single' | 'combined';
  originalIndex?: number;
  originalIndices?: number[];
  slide?: any;
  slides?: any[];
  label: string;
  verseType: string;
}

// Create combined slides for original-only mode
function createCombinedSlides(slides: any[]): CombinedSlideItem[] {
  if (!slides || slides.length === 0) {
    return [];
  }

  const combinedSlides: CombinedSlideItem[] = [];

  let i = 0;
  while (i < slides.length) {
    const currentType = slides[i].verseType || '';

    // If slide has no verseType, keep it as single
    if (!currentType) {
      combinedSlides.push({
        type: 'single',
        originalIndex: i,
        slide: slides[i],
        label: `${i + 1}`,
        verseType: ''
      });
      i++;
      continue;
    }

    // Find all consecutive slides with the same verseType
    let groupEnd = i;
    while (groupEnd < slides.length) {
      const nextType = slides[groupEnd].verseType || '';
      if (nextType !== currentType) break;
      groupEnd++;
    }

    // Pair slides within this group (2-by-2)
    let j = i;
    while (j < groupEnd) {
      const remainingInGroup = groupEnd - j;
      const slidesToCombine = Math.min(2, remainingInGroup);

      if (slidesToCombine >= 2) {
        // Combine slides
        const indices = Array.from({ length: slidesToCombine }, (_, k) => j + k);
        combinedSlides.push({
          type: 'combined',
          originalIndices: indices,
          slides: indices.map(idx => slides[idx]),
          label: `${j + 1}-${j + slidesToCombine}`,
          verseType: currentType
        });
        j += slidesToCombine;
      } else {
        // Last slide stays single
        combinedSlides.push({
          type: 'single',
          originalIndex: j,
          slide: slides[j],
          label: `${j + 1}`,
          verseType: currentType
        });
        j += 1;
      }
    }

    i = groupEnd;
  }

  return combinedSlides;
}

class RemoteControlServer extends EventEmitter {
  private httpServer: http.Server | null = null;
  private io: SocketIOServer | null = null;
  private port: number = DEFAULT_PORT;
  private pin: string = '';
  private authenticatedSockets: Set<string> = new Set();
  private controlWindow: BrowserWindow | null = null;
  private displayManager: DisplayManager | null = null;
  private commandHandlerActive: boolean = false; // True when ControlPanel's useRemoteControl is active
  private directlyLoadedContent: boolean = false; // True when content was loaded via direct commands (not ControlPanel)
  private broadcastDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingBroadcast: boolean = false;
  // Track last broadcast state for diff optimization
  private lastBroadcastHash: {
    setlist: string;
    slides: string;
  } = { setlist: '', slides: '' };
  private currentState: RemoteControlState = {
    currentItem: null,
    currentSlideIndex: 0,
    totalSlides: 0,
    displayMode: 'bilingual',
    translationLanguage: 'en',
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
  // Cache for combined slides (original mode) and raw slides
  private combinedSlidesCache: CombinedSlideItem[] = [];
  private rawSlidesCache: any[] = [];
  private sessionTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private midiBridgeSockets: Set<string> = new Set();
  private midiControlEnabled: boolean = true;
  private translationLanguage: string = 'en';

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

        // Ensure Windows Firewall allows connections (non-blocking)
        ensureFirewallRule(port).catch(() => {
          // Ignore errors - already logged in ensureFirewallRule
        });

        // Initialize Socket.IO - restrict CORS to local network only
        // Configure for low latency: WebSocket first, minimal ping interval, compression enabled
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
          },
          // Performance optimizations for low latency
          transports: ['websocket', 'polling'], // WebSocket first for lower latency
          pingInterval: 10000, // 10 seconds between pings (default is 25s)
          pingTimeout: 5000,   // 5 second timeout (default is 20s)
          upgradeTimeout: 5000, // Faster upgrade to WebSocket
          // Enable per-message compression for smaller payload sizes
          perMessageDeflate: {
            threshold: 1024, // Only compress messages > 1KB
            zlibDeflateOptions: {
              chunkSize: 16 * 1024 // 16KB chunks for efficient compression
            },
            zlibInflateOptions: {
              chunkSize: 16 * 1024
            }
          }
        });

        // Start periodic cleanup of rate limiter maps
        startMapCleanup();

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
    // Stop periodic cleanup
    stopMapCleanup();

    // Clear all session timeouts
    for (const timeout of this.sessionTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.sessionTimeouts.clear();

    // Clear broadcast debounce timer
    if (this.broadcastDebounceTimer) {
      clearTimeout(this.broadcastDebounceTimer);
      this.broadcastDebounceTimer = null;
    }

    // Clear authenticated sockets, MIDI bridge sockets, and auth attempts
    this.authenticatedSockets.clear();
    this.midiBridgeSockets.clear();
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
   * Get the current setlist from the server's state
   */
  getSetlist(): any[] {
    return this.currentState.fullSetlist || [];
  }

  /**
   * Set the control window reference for forwarding commands
   */
  setControlWindow(window: BrowserWindow): void {
    this.controlWindow = window;
  }

  /**
   * Set the display manager reference for direct slide broadcasting
   */
  setDisplayManager(manager: DisplayManager): void {
    this.displayManager = manager;
    console.log('[RemoteControlServer] DisplayManager reference set');
  }

  /**
   * Set whether the command handler (ControlPanel's useRemoteControl) is active
   */
  setCommandHandlerActive(active: boolean): void {
    this.commandHandlerActive = active;
    console.log(`[RemoteControlServer] Command handler active: ${active}`);
  }

  /**
   * Enable or disable MIDI bridge command processing
   */
  setMidiControlEnabled(enabled: boolean): void {
    this.midiControlEnabled = enabled;
    console.log(`[RemoteControlServer] MIDI control enabled: ${enabled}`);
  }

  /**
   * Get current state (for reading without modification)
   */
  getCurrentState(): RemoteControlState {
    return this.currentState;
  }

  /**
   * Update state and broadcast to all authenticated clients
   */
  updateState(state: Partial<RemoteControlState>): void {
    // When ControlPanel syncs setlist, handle carefully:
    // - If ControlPanel sends empty setlist, accept it (user cleared the setlist)
    // - If ControlPanel sends non-empty setlist missing our items, preserve ours
    if (state.fullSetlist !== undefined && this.currentState.fullSetlist) {
      if (state.fullSetlist.length === 0) {
        // ControlPanel cleared the setlist - accept this
        console.log(`[RemoteControlServer] ControlPanel cleared setlist - syncing to remote`);
        // Also clear directlyLoadedContent since the content source is gone
        this.directlyLoadedContent = false;
      } else {
        // Check if our setlist has items that ControlPanel's doesn't
        const ourIds = new Set(this.currentState.fullSetlist.map((i: any) => i.id));
        const theirIds = new Set(state.fullSetlist.map((i: any) => i.id));
        const weHaveExtra = Array.from(ourIds).some(id => !theirIds.has(id));

        if (weHaveExtra) {
          // Keep our setlist, don't let ControlPanel overwrite it
          // Instead, sync our additions back to ControlPanel
          console.log(`[RemoteControlServer] Preserving locally added setlist items`);
          delete state.fullSetlist;
          delete state.setlist;
        }
      }
    }

    this.currentState = { ...this.currentState, ...state };
    // Track translation language for resolving multi-translation slides
    if (state.translationLanguage !== undefined) {
      this.translationLanguage = state.translationLanguage;
    }
    // When ControlPanel syncs fullSlides with actual content, it's taking over content control
    // Only reset directlyLoadedContent if:
    // 1. ControlPanel is sending non-empty slides
    // 2. The content is different from what we loaded directly
    if (state.fullSlides && state.fullSlides.length > 0) {
      // Check if this is different content from what we loaded - use IDs for reliable comparison
      const currentContentId = this.currentState.currentItem?.id;
      const incomingContentId = state.currentItem?.id;
      const incomingTitle = state.songTitle || 'unknown';

      // Only reset if we have directly loaded content AND this looks like different content
      if (this.directlyLoadedContent) {
        // Compare by content ID (more reliable than title which can be duplicated)
        // Fall back to title comparison only if IDs aren't available
        const isSameContent = currentContentId && incomingContentId
          ? currentContentId === incomingContentId
          : (this.currentState.songTitle || '') === incomingTitle;

        if (!isSameContent) {
          this.directlyLoadedContent = false;
          console.log(`[RemoteControlServer] ControlPanel took over with different content: "${incomingTitle}" (ID: ${incomingContentId}, was ID: ${currentContentId})`);
        } else {
          console.log(`[RemoteControlServer] Received ${state.fullSlides.length} fullSlides for same content "${incomingTitle}" (ID: ${currentContentId}) - keeping directlyLoadedContent=true`);
        }
      } else {
        console.log(`[RemoteControlServer] Received ${state.fullSlides.length} fullSlides for "${incomingTitle}"`);
      }
    }
    // Note: Empty fullSlides arrays are silently ignored to avoid log spam
    this.broadcastState();
  }

  /**
   * Broadcast current state to all authenticated clients
   * Uses debouncing to avoid excessive updates during rapid commands
   */
  private broadcastState(immediate: boolean = false): void {
    if (!this.io) return;

    // Mark that we have a pending broadcast
    this.pendingBroadcast = true;

    // For immediate broadcasts (e.g., slide changes), send right away
    if (immediate) {
      this.sendStateToClients();
      return;
    }

    // Debounce non-immediate broadcasts (e.g., state sync)
    if (this.broadcastDebounceTimer) {
      return; // Already scheduled
    }

    this.broadcastDebounceTimer = setTimeout(() => {
      this.broadcastDebounceTimer = null;
      if (this.pendingBroadcast) {
        this.sendStateToClients();
      }
    }, 16); // ~60fps max update rate
  }

  /**
   * Actually send state to all clients
   * Uses differential updates to reduce data transmission
   */
  private sendStateToClients(): void {
    if (!this.io) return;
    this.pendingBroadcast = false;

    // Create a copy without fullSlides and fullSetlist (mobile clients don't need the full data)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { fullSlides, fullSetlist, ...stateForClients } = this.currentState;

    // Check what has changed since last broadcast
    const currentSetlistHash = simpleHash(stateForClients.setlist);
    const currentSlidesHash = simpleHash(stateForClients.slides);

    const setlistChanged = currentSetlistHash !== this.lastBroadcastHash.setlist;
    const slidesChanged = currentSlidesHash !== this.lastBroadcastHash.slides;

    if (setlistChanged) {
      console.log(`[RemoteControlServer] Broadcasting setlist change: ${stateForClients.setlist?.length || 0} items`);
    }

    // Update hash cache
    this.lastBroadcastHash.setlist = currentSetlistHash;
    this.lastBroadcastHash.slides = currentSlidesHash;

    // Create optimized state - omit unchanged arrays to reduce payload
    const optimizedState: Partial<typeof stateForClients> = {
      ...stateForClients
    };

    // Only include arrays if they changed (mobile client keeps last known state)
    if (!setlistChanged) {
      delete optimizedState.setlist;
    }
    if (!slidesChanged) {
      delete optimizedState.slides;
    }

    const numClients = this.authenticatedSockets.size;
    console.log(`[RemoteControlServer] Sending state to ${numClients} clients, setlist included: ${!!optimizedState.setlist}`);

    for (const socketId of this.authenticatedSockets) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit('state', optimizedState);
      }
    }

    // Send setlist:summary to MIDI bridge sockets when setlist changes
    if (setlistChanged && this.midiBridgeSockets.size > 0) {
      const setlistSummary = (stateForClients.setlist || []).map((item: any) => ({
        id: item.id,
        title: item.title,
        type: item.type
      }));
      for (const socketId of this.midiBridgeSockets) {
        const socket = this.io.sockets.sockets.get(socketId);
        if (socket) {
          socket.emit('setlist:summary', { setlist: setlistSummary });
        }
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
          // Send current state immediately (strip fullSlides/fullSetlist - mobile clients don't need them)
          const { fullSlides: _fs, fullSetlist: _fsl, ...stateForClient } = this.currentState;
          socket.emit('state', stateForClient);
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
        if (typeof callback !== 'function') return;
        if (!this.authenticatedSockets.has(socket.id)) {
          callback({ error: 'Not authenticated' });
          return;
        }
        this.resetSessionTimeout(socket.id);
        try {
          const songs = await getCachedSongs();
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
        if (typeof callback !== 'function') return;
        if (!this.authenticatedSockets.has(socket.id)) {
          callback({ error: 'Not authenticated' });
          return;
        }
        this.resetSessionTimeout(socket.id);
        try {
          const songs = await getCachedSongs();
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
        if (typeof callback !== 'function') return;
        if (!this.authenticatedSockets.has(socket.id)) {
          callback({ error: 'Not authenticated' });
          return;
        }
        this.resetSessionTimeout(socket.id);
        try {
          const books = await getCachedBibleBooks();
          callback({ books });
        } catch (error) {
          console.error('[RemoteControlServer] Error fetching Bible books:', error);
          callback({ error: 'Failed to fetch Bible books' });
        }
      });

      socket.on('getBibleChapter', async (data: { book: string; chapter: number }, callback: (data: any) => void) => {
        if (typeof callback !== 'function') return;
        if (!this.authenticatedSockets.has(socket.id)) {
          callback({ error: 'Not authenticated' });
          return;
        }
        this.resetSessionTimeout(socket.id);
        try {
          const result = await getCachedBibleChapter(data.book, data.chapter);
          callback({ verses: result.verses });
        } catch (error) {
          console.error('[RemoteControlServer] Error fetching Bible chapter:', error);
          callback({ error: 'Failed to fetch chapter' });
        }
      });

      socket.on('getMedia', (callback: (data: any) => void) => {
        if (typeof callback !== 'function') return;
        if (!this.authenticatedSockets.has(socket.id)) {
          callback({ error: 'Not authenticated' });
          return;
        }
        this.resetSessionTimeout(socket.id);
        try {
          const media = getCachedMedia();
          // Send simplified media data
          const simplifiedMedia = media.map((m: any) => ({
            id: m.id,
            name: m.name,
            type: m.type,
            duration: m.duration
          }));
          callback({ media: simplifiedMedia });
        } catch (error) {
          console.error('[RemoteControlServer] Error fetching media:', error);
          callback({ error: 'Failed to fetch media' });
        }
      });

      socket.on('getPresentations', async (callback: (data: any) => void) => {
        if (typeof callback !== 'function') return;
        if (!this.authenticatedSockets.has(socket.id)) {
          callback({ error: 'Not authenticated' });
          return;
        }
        this.resetSessionTimeout(socket.id);
        try {
          const presentations = await getCachedPresentations();
          // Send simplified presentation data for mobile
          const simplifiedPresentations = presentations.map((p: any) => ({
            id: p.id,
            title: p.title,
            slideCount: p.slides?.length || 0,
            quickModeType: p.quickModeData?.type || null,
            updatedAt: p.updatedAt
          }));
          callback({ presentations: simplifiedPresentations });
        } catch (error) {
          console.error('[RemoteControlServer] Error fetching presentations:', error);
          callback({ error: 'Failed to fetch presentations' });
        }
      });

      // Display handlers
      socket.on('getDisplays', (callback: (data: any) => void) => {
        if (typeof callback !== 'function') return;
        if (!this.authenticatedSockets.has(socket.id)) {
          callback({ error: 'Not authenticated' });
          return;
        }
        this.resetSessionTimeout(socket.id);
        try {
          if (!this.displayManager) {
            callback({ error: 'Display manager not available' });
            return;
          }
          const displays = this.displayManager.getAllDisplays();
          callback({ displays });
        } catch (error) {
          console.error('[RemoteControlServer] Error fetching displays:', error);
          callback({ error: 'Failed to fetch displays' });
        }
      });

      socket.on('openDisplay', (data: { displayId: number; type: 'viewer' | 'stage' | 'camera'; deviceId?: string; audioDeviceId?: string }, callback: (data: any) => void) => {
        if (typeof callback !== 'function') return;
        if (!this.authenticatedSockets.has(socket.id)) {
          callback({ error: 'Not authenticated' });
          return;
        }
        this.resetSessionTimeout(socket.id);
        try {
          if (!this.displayManager) {
            callback({ error: 'Display manager not available' });
            return;
          }
          if (typeof data?.displayId !== 'number' || !data?.type || !['viewer', 'stage', 'camera'].includes(data.type)) {
            callback({ error: 'Invalid parameters' });
            return;
          }
          // Only pass deviceId/audioDeviceId for camera type; validate they are reasonable device ID strings
          let sanitizedDeviceId: string | undefined;
          let sanitizedAudioDeviceId: string | undefined;
          if (data.type === 'camera' && data.deviceId) {
            if (typeof data.deviceId !== 'string' || data.deviceId.length > 256 || !DEVICE_ID_REGEX.test(data.deviceId)) {
              callback({ error: 'Invalid camera device ID' });
              return;
            }
            sanitizedDeviceId = data.deviceId;
          }
          if (data.type === 'camera' && data.audioDeviceId) {
            if (typeof data.audioDeviceId !== 'string' || data.audioDeviceId.length > 256 || !DEVICE_ID_REGEX.test(data.audioDeviceId)) {
              callback({ error: 'Invalid audio device ID' });
              return;
            }
            sanitizedAudioDeviceId = data.audioDeviceId;
          }
          const success = this.displayManager.openDisplayWindow(data.displayId, data.type, sanitizedDeviceId, sanitizedAudioDeviceId);
          callback({ success });
        } catch (error) {
          console.error('[RemoteControlServer] Error opening display:', error);
          callback({ error: 'Failed to open display' });
        }
      });

      socket.on('closeDisplay', (data: { displayId: number }, callback: (data: any) => void) => {
        if (typeof callback !== 'function') return;
        if (!this.authenticatedSockets.has(socket.id)) {
          callback({ error: 'Not authenticated' });
          return;
        }
        this.resetSessionTimeout(socket.id);
        try {
          if (!this.displayManager) {
            callback({ error: 'Display manager not available' });
            return;
          }
          if (typeof data?.displayId !== 'number') {
            callback({ error: 'Invalid parameters' });
            return;
          }
          this.displayManager.closeDisplayWindow(data.displayId);
          callback({ success: true });
        } catch (error) {
          console.error('[RemoteControlServer] Error closing display:', error);
          callback({ error: 'Failed to close display' });
        }
      });

      socket.on('identifyDisplays', (data: { displayId?: number }, callback: (data: any) => void) => {
        if (typeof callback !== 'function') return;
        if (!this.authenticatedSockets.has(socket.id)) {
          callback({ error: 'Not authenticated' });
          return;
        }
        this.resetSessionTimeout(socket.id);
        try {
          if (!this.displayManager) {
            callback({ error: 'Display manager not available' });
            return;
          }
          this.displayManager.identifyDisplays(data?.displayId);
          callback({ success: true });
        } catch (error) {
          console.error('[RemoteControlServer] Error identifying displays:', error);
          callback({ error: 'Failed to identify displays' });
        }
      });

      // Theme handlers
      socket.on('getThemes', async (callback: (data: any) => void) => {
        if (typeof callback !== 'function') return;
        if (!this.authenticatedSockets.has(socket.id)) {
          callback({ error: 'Not authenticated' });
          return;
        }
        this.resetSessionTimeout(socket.id);
        try {
          const [viewerThemes, bibleThemes, prayerThemes] = await Promise.all([
            getCachedThemes(),
            getCachedBibleThemes(),
            getCachedPrayerThemes()
          ]);
          const stageThemes = getCachedStageThemes();
          const selectedIds = getSelectedThemeIds();
          callback({
            viewer: viewerThemes.map((t: any) => ({ id: t.id, name: t.name })),
            stage: stageThemes.map((t: any) => ({ id: t.id, name: t.name })),
            bible: bibleThemes.map((t: any) => ({ id: t.id, name: t.name })),
            prayer: prayerThemes.map((t: any) => ({ id: t.id, name: t.name })),
            selectedIds: {
              viewer: selectedIds.viewerThemeId,
              stage: selectedIds.stageThemeId,
              bible: selectedIds.bibleThemeId,
              prayer: selectedIds.prayerThemeId
            }
          });
        } catch (error) {
          console.error('[RemoteControlServer] Error fetching themes:', error);
          callback({ error: 'Failed to fetch themes' });
        }
      });

      socket.on('selectTheme', async (data: { themeType: 'viewer' | 'stage' | 'bible' | 'prayer'; themeId: string }, callback: (data: any) => void) => {
        if (typeof callback !== 'function') return;
        if (!this.authenticatedSockets.has(socket.id)) {
          callback({ error: 'Not authenticated' });
          return;
        }
        this.resetSessionTimeout(socket.id);
        try {
          if (!data?.themeType || !data?.themeId?.trim() || !['viewer', 'stage', 'bible', 'prayer'].includes(data.themeType)) {
            callback({ error: 'Invalid parameters' });
            return;
          }
          if (!this.displayManager) {
            callback({ error: 'Display manager not available' });
            return;
          }

          // Fetch single theme by ID and broadcast to displays
          let theme: any = null;
          switch (data.themeType) {
            case 'viewer':
              theme = await getTheme(data.themeId);
              if (theme) this.displayManager.broadcastTheme(theme);
              break;
            case 'stage':
              theme = getStageTheme(data.themeId);
              if (theme) this.displayManager.broadcastStageTheme(theme);
              break;
            case 'bible':
              theme = await getBibleTheme(data.themeId);
              if (theme) this.displayManager.broadcastBibleTheme(theme);
              break;
            case 'prayer':
              theme = await getPrayerTheme(data.themeId);
              if (theme) this.displayManager.broadcastPrayerTheme(theme);
              break;
          }

          if (!theme) {
            callback({ error: 'Theme not found' });
            return;
          }

          // Save selection to database (after confirming theme exists)
          saveSelectedThemeId(data.themeType, data.themeId);

          // Selectively invalidate only the changed theme type cache
          switch (data.themeType) {
            case 'viewer': themesCache.entry = null; break;
            case 'stage': stageThemesCache.entry = null; break;
            case 'bible': bibleThemesCache.entry = null; break;
            case 'prayer': prayerThemesCache.entry = null; break;
          }

          // Notify ControlPanel so it can sync its theme state
          if (this.controlWindow && !this.controlWindow.isDestroyed()) {
            this.controlWindow.webContents.send('remote:themeSelected', {
              themeType: data.themeType,
              themeId: data.themeId
            });
          }

          callback({ success: true });
        } catch (error) {
          console.error('[RemoteControlServer] Error selecting theme:', error);
          callback({ error: 'Failed to select theme' });
        }
      });

      // MIDI Bridge: authenticate with same PIN, track as MIDI bridge socket
      socket.on('midi:join', (data: { pin: string }) => {
        // Brute-force protection (shared with regular auth)
        const attempts = authAttempts.get(socket.id) || 0;
        if (attempts >= MAX_AUTH_ATTEMPTS) {
          socket.emit('midi:error', { message: 'Too many failed attempts. Please reconnect.' });
          socket.disconnect(true);
          return;
        }

        if (data?.pin === this.pin) {
          authAttempts.delete(socket.id);
          this.authenticatedSockets.add(socket.id);
          this.midiBridgeSockets.add(socket.id);
          this.resetSessionTimeout(socket.id);
          socket.emit('midi:joined', { roomPin: this.pin });

          // Send current setlist summary
          const setlistSummary = (this.currentState.setlist || []).map((item: any) => ({
            id: item.id,
            title: item.title,
            type: item.type
          }));
          socket.emit('setlist:summary', { setlist: setlistSummary });

          // Notify operator
          if (this.controlWindow && !this.controlWindow.isDestroyed()) {
            this.controlWindow.webContents.send('midi:bridgeStatus', true);
          }

          console.log(`[RemoteControlServer] MIDI bridge client authenticated: ${socket.id}`);
        } else {
          authAttempts.set(socket.id, attempts + 1);
          const remaining = MAX_AUTH_ATTEMPTS - attempts - 1;
          socket.emit('midi:error', {
            message: remaining > 0 ? `Invalid PIN. ${remaining} attempts remaining.` : 'Too many failed attempts.'
          });
          if (remaining <= 0) {
            socket.disconnect(true);
          }
        }
      });

      // MIDI Bridge: handle commands with whitelist
      socket.on('midi:command', (data: { command: RemoteCommand }) => {
        if (!this.authenticatedSockets.has(socket.id) || !this.midiBridgeSockets.has(socket.id)) {
          socket.emit('midi:error', { message: 'Not authenticated' });
          return;
        }

        // Operator toggled MIDI control off
        if (!this.midiControlEnabled) return;

        const command = data?.command;
        if (!command?.type) {
          socket.emit('midi:error', { message: 'Invalid command' });
          return;
        }

        // MIDI bridge whitelist — only slide/setlist/song commands
        if (!MIDI_ALLOWED_COMMANDS.has(command.type)) {
          socket.emit('midi:error', { message: 'Command not allowed from MIDI bridge' });
          return;
        }

        // Rate limiting
        if (!checkClientRateLimit(socket.id)) {
          socket.emit('midi:error', { message: 'Rate limit exceeded' });
          return;
        }

        this.resetSessionTimeout(socket.id);
        this.handleCommand(command);
      });

      // MIDI Bridge: explicit leave
      socket.on('midi:leave', () => {
        const wasMidi = this.midiBridgeSockets.has(socket.id);
        this.midiBridgeSockets.delete(socket.id);
        this.authenticatedSockets.delete(socket.id);
        if (wasMidi && this.controlWindow && !this.controlWindow.isDestroyed()) {
          const anyMidiLeft = this.midiBridgeSockets.size > 0;
          this.controlWindow.webContents.send('midi:bridgeStatus', anyMidiLeft);
        }
        console.log(`[RemoteControlServer] MIDI bridge client left: ${socket.id}`);
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        console.log(`[RemoteControlServer] Client disconnected: ${socket.id}`);
        const wasMidi = this.midiBridgeSockets.has(socket.id);
        this.authenticatedSockets.delete(socket.id);
        this.midiBridgeSockets.delete(socket.id);
        const timeout = this.sessionTimeouts.get(socket.id);
        if (timeout) {
          clearTimeout(timeout);
          this.sessionTimeouts.delete(socket.id);
        }
        clientRateLimits.delete(socket.id);
        authAttempts.delete(socket.id);

        // Notify operator if a MIDI bridge disconnected
        if (wasMidi && this.controlWindow && !this.controlWindow.isDestroyed()) {
          const anyMidiLeft = this.midiBridgeSockets.size > 0;
          this.controlWindow.webContents.send('midi:bridgeStatus', anyMidiLeft);
        }
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
    // Check if control window is available and not destroyed
    const controlWindowAvailable = this.controlWindow && !this.controlWindow.isDestroyed();

    // Commands that can be handled directly in main process
    const directHandleCommands = [
      'slide:next', 'slide:prev', 'slide:goto', 'slide:blank',
      'setlist:select', 'library:selectSong', 'library:addSong',
      'library:selectBible', 'library:addBible',
      'library:selectMedia', 'library:addMedia',
      'library:selectPresentation', 'library:addPresentation',
      'mode:set'
    ];

    // Commands that MUST be handled directly (ControlPanel doesn't support them)
    const alwaysDirectCommands = [
      'library:selectPresentation', 'library:addPresentation'
    ];

    // Commands that should be handled directly when content was loaded directly
    const contentRelatedCommands = [
      'slide:next', 'slide:prev', 'slide:goto', 'slide:blank', 'setlist:select', 'mode:set'
    ];

    const canHandleDirectly = directHandleCommands.includes(command.type);
    let mustHandleDirectly = alwaysDirectCommands.includes(command.type);
    const isContentCommand = contentRelatedCommands.includes(command.type);

    // Check if setlist:select is for a presentation - must handle directly
    // because ControlPanel doesn't properly support presentation slide navigation
    if (command.type === 'setlist:select' && command.payload?.id) {
      const item = this.currentState.fullSetlist?.find((i: any) => i.id === command.payload.id);
      if (item?.type === 'presentation') {
        mustHandleDirectly = true;
      }
    }

    // Handle directly if:
    // - Command must always be handled directly (presentations), OR
    // - Command can be handled directly AND ControlPanel not active, OR
    // - Content-related command AND content was loaded directly (even if ControlPanel is active)
    const shouldHandleDirectly = mustHandleDirectly ||
      (canHandleDirectly && !this.commandHandlerActive) ||
      (isContentCommand && this.directlyLoadedContent);

    if (shouldHandleDirectly) {
      // Handle directly in main process
      this.handleCommandDirectly(command).then(handled => {
        console.log(`[RemoteControlServer] Direct handling of ${command.type}: ${handled ? 'success' : 'failed'}`);
      }).catch(err => {
        console.error(`[RemoteControlServer] Error handling ${command.type}:`, err);
      });
    } else if (this.commandHandlerActive && controlWindowAvailable) {
      // ControlPanel is active - let it handle the command
      console.log(`[RemoteControlServer] Forwarding ${command.type} to ControlPanel`);
      this.controlWindow!.webContents.send('remote:command', command);
    } else if (controlWindowAvailable) {
      // Forward to control window for any other commands
      this.controlWindow!.webContents.send('remote:command', command);
    } else {
      console.log(`[RemoteControlServer] Cannot handle ${command.type} - no handler available`);
    }

    // Emit event for other handlers
    this.emit('command', command);
  }

  /**
   * Handle commands directly in main process
   * Returns true if the command was handled
   */
  private async handleCommandDirectly(command: RemoteCommand): Promise<boolean> {
    if (!this.displayManager) {
      console.log(`[RemoteControlServer] handleCommandDirectly: no displayManager`);
      return false;
    }

    // Route to specific handlers
    switch (command.type) {
      case 'slide:next':
      case 'slide:prev':
      case 'slide:goto':
      case 'slide:blank':
        return this.handleSlideCommand(command);
      case 'setlist:select':
        return this.handleSetlistSelect(command);
      case 'library:selectSong':
      case 'library:addSong':
        return await this.handleLibrarySongCommand(command);
      case 'library:selectBible':
      case 'library:addBible':
        return await this.handleLibraryBibleCommand(command);
      case 'library:selectMedia':
      case 'library:addMedia':
        return await this.handleLibraryMediaCommand(command);
      case 'library:selectPresentation':
      case 'library:addPresentation':
        return await this.handleLibraryPresentationCommand(command);
      case 'mode:set':
        return this.handleModeSet(command);
      default:
        return false;
    }
  }

  /**
   * Handle slide navigation commands
   */
  private handleSlideCommand(command: RemoteCommand): boolean {
    const { fullSlides, currentSlideIndex, totalSlides, isBlank, songTitle, currentItem, displayMode, currentContentType } = this.currentState;

    // Only handle if we have slide data
    if (!fullSlides || fullSlides.length === 0) {
      console.log(`[RemoteControlServer] handleSlideCommand: no slides available`);
      return false;
    }

    console.log(`[RemoteControlServer] handleSlideCommand: ${command.type}, currentIndex=${currentSlideIndex}, totalSlides=${totalSlides}`);

    let newIndex = currentSlideIndex;
    let shouldBroadcast = false;

    switch (command.type) {
      case 'slide:next':
        if (currentSlideIndex < totalSlides - 1) {
          newIndex = currentSlideIndex + 1;
          shouldBroadcast = true;
        }
        break;

      case 'slide:prev':
        if (currentSlideIndex > 0) {
          newIndex = currentSlideIndex - 1;
          shouldBroadcast = true;
        }
        break;

      case 'slide:goto':
        if (command.payload?.index !== undefined && command.payload.index >= 0 && command.payload.index < totalSlides) {
          newIndex = command.payload.index;
          shouldBroadcast = true;
        }
        break;

      case 'slide:blank':
        // Toggle blank state
        const newBlankState = !isBlank;
        this.currentState.isBlank = newBlankState;
        if (newBlankState) {
          this.displayManager!.broadcastSlide({ isBlank: true });
        } else if (fullSlides[currentSlideIndex]) {
          const slide = fullSlides[currentSlideIndex];
          const nextSlide = currentSlideIndex < fullSlides.length - 1 ? fullSlides[currentSlideIndex + 1] : null;
          this.displayManager!.broadcastSlide(this.buildSlideData(slide, nextSlide, songTitle, currentContentType || currentItem?.type, displayMode));
        }
        this.broadcastState(true); // Immediate for user responsiveness
        return true;

      default:
        return false;
    }

    if (shouldBroadcast && fullSlides[newIndex]) {
      // Update internal state
      this.currentState.currentSlideIndex = newIndex;
      this.currentState.isBlank = false;

      // Broadcast to displays - use currentContentType for proper theme (e.g., 'prayer' for Quick Mode presentations)
      const slide = fullSlides[newIndex];
      const nextSlide = newIndex < fullSlides.length - 1 ? fullSlides[newIndex + 1] : null;
      const effectiveContentType = currentContentType || currentItem?.type;
      console.log(`[RemoteControlServer] Broadcasting slide ${newIndex} with contentType: ${effectiveContentType}, mode: ${displayMode}`);
      this.displayManager!.broadcastSlide(this.buildSlideData(slide, nextSlide, songTitle, effectiveContentType, displayMode));

      // Broadcast updated state to mobile clients (immediate for user responsiveness)
      this.broadcastState(true);
      return true;
    }

    return false;
  }

  /**
   * Set up slides for the current content, creating combined slides if in original mode
   * @param rawSlides - The raw slides array
   * @param title - The content title
   * @param contentType - The content type (song, bible, prayer, etc.)
   * @param preservePosition - If true, translate the current slide index to the new mode
   */
  private setupSlidesForMode(rawSlides: any[], title: string, contentType: string, preservePosition: boolean = false): void {
    // Store the current raw slide index before changing modes (for position preservation)
    const oldMode = this.currentState.displayMode;
    const oldIndex = this.currentState.currentSlideIndex || 0;
    let oldRawIndex = oldIndex; // The index in raw slides

    // If we were in original mode, find the raw index from the combined slide
    if (preservePosition && oldMode === 'original' && this.combinedSlidesCache.length > 0 && oldIndex < this.combinedSlidesCache.length) {
      const combinedSlide = this.combinedSlidesCache[oldIndex];
      if (combinedSlide.type === 'combined' && combinedSlide.originalIndices) {
        oldRawIndex = combinedSlide.originalIndices[0]; // First raw slide in the combined
      } else if (combinedSlide.originalIndex !== undefined) {
        oldRawIndex = combinedSlide.originalIndex;
      }
    }

    // Store raw slides
    this.rawSlidesCache = rawSlides;

    // Create combined slides
    this.combinedSlidesCache = createCombinedSlides(rawSlides);

    const mode = this.currentState.displayMode;

    if (mode === 'original' && this.combinedSlidesCache.length > 0) {
      // Use combined slides for original mode
      const combinedSlides = this.combinedSlidesCache;

      // Build fullSlides from combined slides (for display broadcasting)
      this.currentState.fullSlides = combinedSlides.map(cs => {
        if (cs.type === 'combined' && cs.slides) {
          // Combine the original text from all slides; carry forward first slide's translations
          const first = cs.slides[0];
          return {
            originalText: cs.slides.map(s => s.originalText || '').join('\n'),
            transliteration: '',
            translation: first?.translation || '',
            translationOverflow: first?.translationOverflow || '',
            translations: first?.translations,
            verseType: cs.verseType,
            _combined: true,
            _originalIndices: cs.originalIndices
          };
        } else if (cs.slide) {
          return {
            originalText: cs.slide.originalText || '',
            transliteration: cs.slide.transliteration || '',
            translation: cs.slide.translation || '',
            translationOverflow: cs.slide.translationOverflow || '',
            translations: cs.slide.translations,
            verseType: cs.verseType,
            _combined: false,
            _originalIndex: cs.originalIndex
          };
        }
        return { originalText: '', transliteration: '', translation: '', verseType: '' };
      });

      this.currentState.totalSlides = combinedSlides.length;

      // Build slides preview for mobile (combined slides show both languages)
      this.currentState.slides = combinedSlides.map((cs, idx) => {
        let preview: string;
        if (cs.type === 'combined' && cs.slides) {
          // For combined slides, show first slide's original + resolved translation
          const first = cs.slides[0];
          const resolvedFirst = first ? resolveSlideTranslation(first, this.translationLanguage) : { translation: '' };
          preview = first?.originalText && resolvedFirst.translation
            ? (first.originalText || '').slice(0, 30) + ' \u2022 ' + resolvedFirst.translation.slice(0, 30)
            : cs.slides.map(s => (s.originalText || '').slice(0, 30)).join(' / ');
        } else if (cs.slide) {
          // For single slides, show both languages if available
          const resolvedSingle = resolveSlideTranslation(cs.slide, this.translationLanguage);
          preview = cs.slide.originalText && resolvedSingle.translation
            ? (cs.slide.originalText || '').slice(0, 30) + ' \u2022 ' + resolvedSingle.translation.slice(0, 30)
            : (cs.slide.originalText || '').slice(0, 60);
        } else {
          preview = '';
        }
        return {
          index: idx,
          preview,
          verseType: cs.label,
          isCombined: cs.type === 'combined'
        };
      });
    } else {
      // Use raw slides for bilingual/translation modes
      this.currentState.fullSlides = rawSlides;
      this.currentState.totalSlides = rawSlides.length;

      // Build slides preview for mobile (show both languages if available)
      this.currentState.slides = rawSlides.map((slide, idx) => {
        const resolved = resolveSlideTranslation(slide, this.translationLanguage);
        return {
          index: idx,
          preview: slide.originalText && resolved.translation
            ? (slide.originalText || '').slice(0, 30) + ' \u2022 ' + resolved.translation.slice(0, 30)
            : (slide.originalText || resolved.translation || '').slice(0, 60),
          verseType: slide.verseType || `Slide ${idx + 1}`
        };
      });
    }

    // Set the slide index - either translate position or reset to 0
    if (preservePosition) {
      let newIndex = 0;
      if (mode === 'original' && this.combinedSlidesCache.length > 0) {
        // Switching TO original mode - find which combined slide contains our raw index
        for (let i = 0; i < this.combinedSlidesCache.length; i++) {
          const cs = this.combinedSlidesCache[i];
          if (cs.type === 'combined' && cs.originalIndices?.includes(oldRawIndex)) {
            newIndex = i;
            break;
          } else if (cs.originalIndex === oldRawIndex) {
            newIndex = i;
            break;
          }
        }
      } else {
        // Switching TO bilingual/translation mode - use the raw index directly
        newIndex = Math.min(oldRawIndex, rawSlides.length - 1);
      }
      this.currentState.currentSlideIndex = Math.max(0, newIndex);
      console.log(`[RemoteControlServer] Mode switch: translated index ${oldIndex} (raw: ${oldRawIndex}) → ${this.currentState.currentSlideIndex}`);
    } else {
      this.currentState.currentSlideIndex = 0;
    }

    this.currentState.songTitle = title;
  }

  /**
   * Build a SlideData object for display broadcasting
   */
  private buildSlideData(
    slide: any,
    nextSlide: any | null,
    songTitle: string | undefined,
    contentType: string | undefined,
    displayMode: 'bilingual' | 'original' | 'translation'
  ): any {
    // Determine content type for theme selection
    let mappedContentType: 'song' | 'bible' | 'prayer' | 'sermon' = 'song';
    if (contentType === 'bible') {
      mappedContentType = 'bible';
    } else if (contentType === 'prayer') {
      mappedContentType = 'prayer';
    } else if (contentType === 'sermon') {
      mappedContentType = 'sermon';
    } else if (contentType === 'presentation') {
      // Regular presentations use song theme as default
      mappedContentType = 'song';
    }

    // For prayer/sermon content, use prayer theme field names
    // Prayer theme expects: title, titleTranslation, subtitle, subtitleTranslation, description, descriptionTranslation, reference, referenceTranslation
    if (mappedContentType === 'prayer' || mappedContentType === 'sermon') {
      const resolvedPrayer = resolveSlideTranslation(slide, this.translationLanguage);
      const resolvedNextPrayer = nextSlide ? resolveSlideTranslation(nextSlide, this.translationLanguage) : null;
      return {
        slideData: {
          title: slide._prayerTitle || '',
          titleTranslation: slide._prayerTitleTranslation || '',
          subtitle: slide.originalText || '',
          subtitleTranslation: resolvedPrayer.translation || '',
          description: slide.description || '',
          descriptionTranslation: slide.descriptionTranslation || '',
          reference: slide._hebrewReference || slide._reference || '',
          referenceTranslation: slide._reference || '',
          // Also include original fields for compatibility
          originalText: slide.originalText || '',
          translation: resolvedPrayer.translation || ''
        },
        nextSlideData: nextSlide ? {
          subtitle: nextSlide.originalText || '',
          subtitleTranslation: resolvedNextPrayer!.translation || '',
          description: nextSlide.description || '',
          descriptionTranslation: nextSlide.descriptionTranslation || '',
          reference: nextSlide._hebrewReference || nextSlide._reference || '',
          referenceTranslation: nextSlide._reference || ''
        } : null,
        songTitle: songTitle || '',
        displayMode,
        contentType: mappedContentType,
        isBlank: false
      };
    }

    // Resolve translations from multi-translation map
    const lang = this.translationLanguage;
    const resolvedSlide = resolveSlideTranslation(slide, lang);
    const resolvedNext = nextSlide ? resolveSlideTranslation(nextSlide, lang) : null;

    // For Bible content, include reference fields for Bible theme
    // Bible theme expects: originalText (hebrew), translation (english), reference, referenceEnglish
    if (mappedContentType === 'bible') {
      return {
        slideData: {
          originalText: slide.originalText || '',
          transliteration: slide.transliteration || '',
          translation: resolvedSlide.translation,
          translationOverflow: resolvedSlide.translationOverflow,
          verseType: slide.verseType || '',
          // Bible theme reference fields
          reference: slide.reference || slide.verseType || '',
          referenceEnglish: slide.referenceEnglish || slide.verseType || ''
        },
        nextSlideData: nextSlide ? {
          originalText: nextSlide.originalText || '',
          transliteration: nextSlide.transliteration || '',
          translation: resolvedNext!.translation,
          translationOverflow: resolvedNext!.translationOverflow,
          verseType: nextSlide.verseType || '',
          reference: nextSlide.reference || nextSlide.verseType || '',
          referenceEnglish: nextSlide.referenceEnglish || nextSlide.verseType || ''
        } : null,
        songTitle: songTitle || '',
        displayMode,
        contentType: mappedContentType,
        isBlank: false
      };
    }

    // Default for songs: originalText, transliteration, translation
    return {
      slideData: {
        originalText: slide.originalText || '',
        transliteration: slide.transliteration || '',
        translation: resolvedSlide.translation,
        translationOverflow: resolvedSlide.translationOverflow,
        verseType: slide.verseType || ''
      },
      nextSlideData: nextSlide ? {
        originalText: nextSlide.originalText || '',
        transliteration: nextSlide.transliteration || '',
        translation: resolvedNext!.translation,
        translationOverflow: resolvedNext!.translationOverflow,
        verseType: nextSlide.verseType || ''
      } : null,
      songTitle: songTitle || '',
      displayMode,
      contentType: mappedContentType,
      isBlank: false
    };
  }

  /**
   * Handle setlist:select command - select an item from the setlist
   */
  private handleSetlistSelect(command: RemoteCommand): boolean {
    const { fullSetlist, displayMode } = this.currentState;
    const itemId = command.payload?.id;

    if (!itemId || !fullSetlist || fullSetlist.length === 0) {
      console.log(`[RemoteControlServer] handleSetlistSelect: no itemId or fullSetlist`);
      return false;
    }

    const item = fullSetlist.find((s: any) => s.id === itemId);
    if (!item) {
      console.log(`[RemoteControlServer] handleSetlistSelect: item not found: ${itemId}`);
      return false;
    }

    console.log(`[RemoteControlServer] handleSetlistSelect: selecting ${item.type} - ${item.title || item.song?.title || item.presentation?.title}`);

    let slides: any[] = [];
    let title = '';
    let contentType: 'song' | 'bible' | 'prayer' | 'presentation' = 'song';

    if (item.type === 'song' && item.song) {
      slides = item.song.slides || [];
      title = item.song.title || '';
      contentType = 'song';
    } else if (item.type === 'bible' && item.song) {
      slides = item.song.slides || [];
      title = item.song.title || item.title || '';
      contentType = 'bible';
    } else if (item.type === 'presentation' && item.presentation) {
      title = item.presentation.title || '';
      const quickModeData = item.presentation.quickModeData;
      const quickModeType = quickModeData?.type;

      // Check if it's a Quick Mode presentation (prayer/sermon)
      if (quickModeData && quickModeData.subtitles && (quickModeType === 'prayer' || quickModeType === 'sermon')) {
        contentType = 'prayer';
        // Build slides from quickModeData for proper theme rendering
        slides = quickModeData.subtitles.map((sub: any, idx: number) => ({
          originalText: sub.subtitle || '',
          transliteration: '',
          translation: sub.subtitleTranslation || '',
          verseType: `Point ${idx + 1}`,
          description: sub.description || '',
          descriptionTranslation: sub.descriptionTranslation || '',
          bibleRef: sub.bibleRef,
          // Prayer-specific fields for buildSlideData
          _prayerTitle: quickModeData.title || '',
          _prayerTitleTranslation: quickModeData.titleTranslation || '',
          _reference: sub.bibleRef?.reference || '',
          _hebrewReference: sub.bibleRef?.hebrewReference || ''
        }));
        console.log(`[RemoteControlServer] handleSetlistSelect: Built ${slides.length} slides from quickModeData for ${quickModeType}`);
      } else {
        // Regular presentation - extract from presentation slides
        contentType = 'presentation';
        slides = (item.presentation.slides || []).map((slide: any, idx: number) => {
          const textContent = (slide.textBoxes || [])
            .map((tb: any) => tb.text || '')
            .filter((t: string) => t.trim())
            .join('\n');
          return {
            originalText: textContent,
            transliteration: '',
            translation: '',
            verseType: `Slide ${idx + 1}`
          };
        });
      }
    } else if (item.type === 'media' && item.mediaPath && item.mediaType) {
      // Media items (image/video) don't have slides - display directly
      if (item.mediaType === 'audio') {
        // Audio requires ControlPanel renderer - cannot handle directly
        console.log(`[RemoteControlServer] handleSetlistSelect: audio requires ControlPanel`);
        return false;
      }

      const encodedPath = item.mediaPath
        .replace(/\\/g, '/')
        .split('/')
        .map((segment: string) => encodeURIComponent(segment))
        .join('/');
      const mediaUrl = `media://file/${encodedPath}`;

      // Update state
      const mediaName = item.mediaName || item.title || 'Media';
      this.currentState.activeMedia = { type: item.mediaType as 'image' | 'video', name: mediaName };
      this.currentState.isBlank = false;
      this.currentState.currentItem = {
        id: item.id,
        type: 'media',
        title: mediaName,
        slideCount: 0
      };

      // Set activeVideo for video type so remote UI shows controls
      if (item.mediaType === 'video') {
        this.currentState.activeVideo = {
          name: mediaName,
          isPlaying: false,
          currentTime: 0,
          duration: item.mediaDuration || 0,
          volume: 1
        };
      } else {
        this.currentState.activeVideo = null;
      }
      this.currentState.activeAudio = null;
      this.currentState.activeYoutube = null;

      this.currentState.slides = [];
      this.currentState.fullSlides = [];
      this.currentState.totalSlides = 0;
      this.currentState.currentSlideIndex = 0;

      // Broadcast to displays
      this.displayManager!.broadcastMedia({ type: item.mediaType as 'image' | 'video', path: mediaUrl });

      console.log(`[RemoteControlServer] handleSetlistSelect: displayed media ${item.mediaName || item.title}`);
      this.broadcastState(true);
      return true;
    } else {
      console.log(`[RemoteControlServer] handleSetlistSelect: unsupported item type: ${item.type}`);
      return false;
    }

    if (slides.length === 0) {
      console.log(`[RemoteControlServer] handleSetlistSelect: no slides in item`);
      return false;
    }

    // Set up slides for the current mode (handles combined slides for original mode)
    this.currentState.isBlank = false;
    this.currentState.currentContentType = contentType;
    this.setupSlidesForMode(slides, title, contentType);

    this.currentState.currentItem = {
      id: item.id,
      type: item.type,
      title: title,
      slideCount: this.currentState.totalSlides
    };

    // Mark that content was loaded directly (for slide command routing)
    this.directlyLoadedContent = true;

    // Broadcast first slide to displays
    const { fullSlides } = this.currentState;
    if (fullSlides && fullSlides.length > 0) {
      const nextSlide = fullSlides.length > 1 ? fullSlides[1] : null;
      this.displayManager!.broadcastSlide(this.buildSlideData(fullSlides[0], nextSlide, title, contentType, displayMode));
    }

    // Broadcast updated state to mobile clients (immediate for user responsiveness)
    this.broadcastState(true);
    return true;
  }

  /**
   * Handle library song commands (selectSong, addSong)
   */
  private async handleLibrarySongCommand(command: RemoteCommand): Promise<boolean> {
    const songId = command.payload?.songId;
    if (!songId) {
      console.log(`[RemoteControlServer] handleLibrarySongCommand: no songId`);
      return false;
    }

    try {
      // Load song from database
      const songs = await getCachedSongs();
      const song = songs.find((s: any) => s.id === songId);
      if (!song) {
        console.log(`[RemoteControlServer] handleLibrarySongCommand: song not found: ${songId}`);
        return false;
      }

      if (command.type === 'library:addSong') {
        // Add to setlist
        const newItem = {
          id: crypto.randomUUID(),
          type: 'song',
          song: song,
          title: song.title
        };

        if (!this.currentState.fullSetlist) {
          this.currentState.fullSetlist = [];
        }
        this.currentState.fullSetlist.push(newItem);

        // Update setlist summary for mobile
        this.currentState.setlist = this.currentState.fullSetlist.map((item: any) => ({
          id: item.id,
          type: item.type,
          title: item.song?.title || item.presentation?.title || item.title || item.type
        }));

        console.log(`[RemoteControlServer] Added song to setlist: ${song.title}`);
        this.broadcastState();
        return true;
      } else if (command.type === 'library:selectSong') {
        // Select and display the song
        const rawSlides = song.slides || [];
        if (rawSlides.length === 0) {
          console.log(`[RemoteControlServer] handleLibrarySongCommand: song has no slides`);
          return false;
        }

        // Set up slides for the current mode (handles combined slides for original mode)
        this.currentState.isBlank = false;
        this.currentState.currentContentType = 'song';
        this.setupSlidesForMode(rawSlides, song.title || '', 'song');

        this.currentState.currentItem = {
          id: song.id,
          type: 'song',
          title: song.title || '',
          slideCount: this.currentState.totalSlides
        };

        // Mark that content was loaded directly (for slide command routing)
        this.directlyLoadedContent = true;

        // Broadcast to displays
        const { fullSlides, displayMode } = this.currentState;
        if (fullSlides && fullSlides.length > 0) {
          const nextSlide = fullSlides.length > 1 ? fullSlides[1] : null;
          this.displayManager!.broadcastSlide(this.buildSlideData(fullSlides[0], nextSlide, song.title, 'song', displayMode));
        }

        console.log(`[RemoteControlServer] Selected song: ${song.title} (mode: ${displayMode}, slides: ${this.currentState.totalSlides})`);
        this.broadcastState(true); // Immediate for user responsiveness
        return true;
      }
    } catch (error) {
      console.error(`[RemoteControlServer] handleLibrarySongCommand error:`, error);
    }
    return false;
  }

  /**
   * Handle library media commands (selectMedia, addMedia)
   */
  private async handleLibraryMediaCommand(command: RemoteCommand): Promise<boolean> {
    const mediaId = command.payload?.mediaId;
    if (!mediaId) {
      console.log(`[RemoteControlServer] handleLibraryMediaCommand: no mediaId`);
      return false;
    }

    try {
      const media = getMediaItem(mediaId);
      if (!media) {
        console.log(`[RemoteControlServer] handleLibraryMediaCommand: media not found: ${mediaId}`);
        return false;
      }

      if (command.type === 'library:addMedia') {
        // Add to setlist
        const newItem = {
          id: crypto.randomUUID(),
          type: 'media',
          mediaType: media.type,
          mediaPath: media.processedPath || media.originalPath,
          mediaDuration: media.duration,
          mediaName: media.name,
          thumbnailPath: media.thumbnailPath,
          title: media.name
        };

        if (!this.currentState.fullSetlist) {
          this.currentState.fullSetlist = [];
        }
        this.currentState.fullSetlist.push(newItem);

        // Update setlist summary for mobile
        this.currentState.setlist = this.currentState.fullSetlist.map((item: any) => ({
          id: item.id,
          type: item.type,
          title: item.song?.title || item.presentation?.title || item.title || item.type
        }));

        console.log(`[RemoteControlServer] Added media to setlist: ${media.name}`);
        this.broadcastState();
        return true;
      } else if (command.type === 'library:selectMedia') {
        // Audio cannot be displayed on screen directly from main process - requires ControlPanel renderer
        if (media.type === 'audio') {
          console.log(`[RemoteControlServer] handleLibraryMediaCommand: audio requires ControlPanel, forwarding`);
          return false;
        }

        // Display the image/video directly
        const filePath = media.processedPath || media.originalPath;
        const encodedPath = filePath
          .replace(/\\/g, '/')
          .split('/')
          .map((segment: string) => encodeURIComponent(segment))
          .join('/');
        const mediaUrl = `media://file/${encodedPath}`;

        // Update state
        this.currentState.activeMedia = { type: media.type, name: media.name };
        this.currentState.isBlank = false;
        this.currentState.currentItem = {
          id: media.id,
          type: 'media',
          title: media.name,
          slideCount: 0
        };

        // Set activeVideo for video type so remote UI shows controls
        if (media.type === 'video') {
          this.currentState.activeVideo = {
            name: media.name,
            isPlaying: false,
            currentTime: 0,
            duration: media.duration || 0,
            volume: 1
          };
        } else {
          this.currentState.activeVideo = null;
        }
        this.currentState.activeAudio = null;
        this.currentState.activeYoutube = null;

        // Clear slides since media doesn't have slides
        this.currentState.slides = [];
        this.currentState.fullSlides = [];
        this.currentState.totalSlides = 0;
        this.currentState.currentSlideIndex = 0;

        // Broadcast to displays
        this.displayManager!.broadcastMedia({ type: media.type, path: mediaUrl });

        console.log(`[RemoteControlServer] Selected media: ${media.name} (${media.type})`);
        this.broadcastState(true);
        return true;
      }
    } catch (error) {
      console.error(`[RemoteControlServer] handleLibraryMediaCommand error:`, error);
    }
    return false;
  }

  /**
   * Handle library Bible commands (selectBible, addBible)
   */
  private async handleLibraryBibleCommand(command: RemoteCommand): Promise<boolean> {
    const { book, chapter, verseStart, verseEnd } = command.payload || {};
    if (!book || !chapter) {
      console.log(`[RemoteControlServer] handleLibraryBibleCommand: missing book or chapter`);
      return false;
    }

    try {
      // Load Bible verses
      const result = await getBibleVerses(book, chapter);
      if (!result || !result.verses || result.verses.length === 0) {
        console.log(`[RemoteControlServer] handleLibraryBibleCommand: no verses found`);
        return false;
      }

      // Convert verses to slides format
      // Include reference fields for Bible theme compatibility
      let slides = result.verses.map((verse: any) => ({
        originalText: verse.hebrew || '',
        transliteration: '',
        translation: verse.english || '',
        verseType: `${book} ${chapter}:${verse.verseNumber}`,
        // Bible theme reference fields
        reference: verse.hebrewRef || `${book} ${chapter}:${verse.verseNumber}`,
        referenceEnglish: `${book} ${chapter}:${verse.verseNumber}`
      }));

      // Filter slides if verse range is specified
      if (verseStart) {
        const endVerse = verseEnd || verseStart;
        slides = slides.filter((s: any) => {
          const verseMatch = s.verseType?.match(/:(\d+)$/);
          const verseNum = verseMatch ? parseInt(verseMatch[1]) : 0;
          return verseNum >= verseStart && verseNum <= endVerse;
        });
      }

      const filteredSlides = slides;

      // Build title
      let title = `${book} ${chapter}`;
      if (verseStart) {
        title += `:${verseStart}`;
        if (verseEnd && verseEnd > verseStart) {
          title += `-${verseEnd}`;
        }
      }

      const biblePassage = {
        id: crypto.randomUUID(),
        title: title,
        slides: filteredSlides
      };

      if (command.type === 'library:addBible') {
        // Add to setlist
        const newItem = {
          id: crypto.randomUUID(),
          type: 'bible',
          song: biblePassage,
          title: title
        };

        if (!this.currentState.fullSetlist) {
          this.currentState.fullSetlist = [];
        }
        this.currentState.fullSetlist.push(newItem);

        // Update setlist summary
        this.currentState.setlist = this.currentState.fullSetlist.map((item: any) => ({
          id: item.id,
          type: item.type,
          title: item.song?.title || item.presentation?.title || item.title || item.type
        }));

        console.log(`[RemoteControlServer] Added Bible to setlist: ${title}`);
        this.broadcastState();
        return true;
      } else if (command.type === 'library:selectBible') {
        // Select and display — use setupSlidesForMode to populate rawSlidesCache
        // and create combined slides for original mode
        this.currentState.songTitle = title;
        this.currentState.isBlank = false;
        this.currentState.currentContentType = 'bible';
        this.currentState.currentItem = {
          id: biblePassage.id,
          type: 'bible',
          title: title,
          slideCount: filteredSlides.length
        };

        // Mark that content was loaded directly (for slide command routing)
        this.directlyLoadedContent = true;

        // Setup slides with mode support (populates rawSlidesCache, combinedSlidesCache)
        this.setupSlidesForMode(filteredSlides, title, 'bible');

        // Broadcast first slide to displays
        const slides = this.currentState.fullSlides || filteredSlides;
        const nextSlide = slides.length > 1 ? slides[1] : null;
        this.displayManager!.broadcastSlide(this.buildSlideData(slides[0], nextSlide, title, 'bible', this.currentState.displayMode));

        console.log(`[RemoteControlServer] Selected Bible: ${title}`);
        this.broadcastState(true); // Immediate for user responsiveness
        return true;
      }
    } catch (error) {
      console.error(`[RemoteControlServer] handleLibraryBibleCommand error:`, error);
    }
    return false;
  }

  /**
   * Handle library presentation commands (selectPresentation, addPresentation)
   */
  private async handleLibraryPresentationCommand(command: RemoteCommand): Promise<boolean> {
    const presentationId = command.payload?.presentationId;
    if (!presentationId) {
      console.log(`[RemoteControlServer] handleLibraryPresentationCommand: no presentationId`);
      return false;
    }

    try {
      // Load presentation from database
      const presentation = await getPresentation(presentationId);
      if (!presentation) {
        console.log(`[RemoteControlServer] handleLibraryPresentationCommand: presentation not found: ${presentationId}`);
        return false;
      }

      // Determine content type based on quickModeData
      let contentType: 'song' | 'bible' | 'prayer' | 'presentation' = 'presentation';
      const quickModeType = presentation.quickModeData?.type;
      if (quickModeType === 'prayer' || quickModeType === 'sermon') {
        contentType = 'prayer';
      }

      let slides: any[] = [];

      // Check if this is a Quick Mode presentation (prayer/sermon)
      if (presentation.quickModeData && presentation.quickModeData.subtitles) {
        // Build slides from quickModeData for proper theme rendering
        const subtitles = presentation.quickModeData.subtitles;
        const qmd = presentation.quickModeData;
        slides = subtitles.map((item: any, idx: number) => {
          // Format: subtitle is the main text (Hebrew), subtitleTranslation is translation
          // description is additional text, bibleRef is the reference
          return {
            originalText: item.subtitle || '',
            transliteration: '',
            translation: item.subtitleTranslation || '',
            verseType: `Point ${idx + 1}`,
            // Include additional data for richer rendering
            description: item.description || '',
            descriptionTranslation: item.descriptionTranslation || '',
            bibleRef: item.bibleRef,
            // Prayer-specific fields for buildSlideData
            _prayerTitle: qmd.title || '',
            _prayerTitleTranslation: qmd.titleTranslation || '',
            _reference: item.bibleRef?.reference || '',
            _hebrewReference: item.bibleRef?.hebrewReference || ''
          };
        });
        console.log(`[RemoteControlServer] Built ${slides.length} slides from quickModeData for ${quickModeType}`);
      } else {
        // Regular presentation - extract text from textBoxes
        slides = (presentation.slides || []).map((slide: any, idx: number) => {
          const textContent = (slide.textBoxes || [])
            .map((tb: any) => tb.text || '')
            .filter((t: string) => t.trim())
            .join('\n');

          return {
            originalText: textContent,
            transliteration: '',
            translation: '',
            verseType: `Slide ${idx + 1}`,
            _presentationSlide: slide
          };
        });
      }

      if (slides.length === 0) {
        console.log(`[RemoteControlServer] handleLibraryPresentationCommand: presentation has no slides`);
        return false;
      }

      if (command.type === 'library:addPresentation') {
        // Add to setlist
        const newItem = {
          id: crypto.randomUUID(),
          type: 'presentation',
          presentation: presentation,
          title: presentation.title
        };

        if (!this.currentState.fullSetlist) {
          this.currentState.fullSetlist = [];
        }
        this.currentState.fullSetlist.push(newItem);

        // Update setlist summary for mobile
        this.currentState.setlist = this.currentState.fullSetlist.map((item: any) => ({
          id: item.id,
          type: item.type,
          title: item.song?.title || item.presentation?.title || item.title || item.type
        }));

        console.log(`[RemoteControlServer] Added presentation to setlist: ${presentation.title}`);
        console.log(`[RemoteControlServer] Setlist now has ${this.currentState.setlist.length} items:`,
          this.currentState.setlist.map((s: any) => s.title).join(', '));

        // Sync to ControlPanel so it knows about the new item
        if (this.controlWindow && !this.controlWindow.isDestroyed()) {
          console.log(`[RemoteControlServer] Sending addToSetlist to ControlPanel:`, newItem.title);
          this.controlWindow.webContents.send('remote:addToSetlist', newItem);
        } else {
          console.log(`[RemoteControlServer] Cannot send to ControlPanel - window not available`);
        }

        this.broadcastState(true); // Immediate for UI update
        return true;
      } else if (command.type === 'library:selectPresentation') {
        // Select and display the presentation — use setupSlidesForMode to populate
        // rawSlidesCache and create combined slides for original mode
        this.currentState.songTitle = presentation.title || '';
        this.currentState.isBlank = false;
        this.currentState.currentContentType = contentType;
        this.currentState.currentItem = {
          id: presentation.id,
          type: 'presentation',
          title: presentation.title || '',
          slideCount: slides.length
        };

        // Mark that content was loaded directly (for slide command routing)
        this.directlyLoadedContent = true;

        // Setup slides with mode support (populates rawSlidesCache, combinedSlidesCache)
        this.setupSlidesForMode(slides, presentation.title || '', contentType);

        // Broadcast first slide to displays - use the correct contentType for theme selection
        const modeSlides = this.currentState.fullSlides || slides;
        const nextSlide = modeSlides.length > 1 ? modeSlides[1] : null;
        this.displayManager!.broadcastSlide(this.buildSlideData(modeSlides[0], nextSlide, presentation.title, contentType, this.currentState.displayMode));

        console.log(`[RemoteControlServer] Selected presentation: ${presentation.title} (contentType: ${contentType})`);
        this.broadcastState(true);
        return true;
      }
    } catch (error) {
      console.error(`[RemoteControlServer] handleLibraryPresentationCommand error:`, error);
    }
    return false;
  }

  /**
   * Handle mode:set command - change display mode
   */
  private handleModeSet(command: RemoteCommand): boolean {
    const newMode = command.payload?.mode as 'bilingual' | 'original' | 'translation';
    if (!newMode || !['bilingual', 'original', 'translation'].includes(newMode)) {
      console.log(`[RemoteControlServer] handleModeSet: invalid mode: ${newMode}`);
      return false;
    }

    console.log(`[RemoteControlServer] handleModeSet: changing to ${newMode}`);

    const oldMode = this.currentState.displayMode;
    this.currentState.displayMode = newMode;

    // If we have cached slides, reconfigure for the new mode
    if (this.rawSlidesCache.length > 0) {
      const { songTitle, currentContentType, isBlank } = this.currentState;
      // Preserve the current position when switching modes
      this.setupSlidesForMode(this.rawSlidesCache, songTitle || '', currentContentType || 'song', true);

      // Broadcast the current slide with new mode (if not blank)
      if (!isBlank && this.currentState.fullSlides && this.currentState.fullSlides.length > 0) {
        const idx = this.currentState.currentSlideIndex;
        const slide = this.currentState.fullSlides[idx];
        const nextSlide = idx < this.currentState.fullSlides.length - 1 ? this.currentState.fullSlides[idx + 1] : null;
        this.displayManager!.broadcastSlide(this.buildSlideData(slide, nextSlide, songTitle, currentContentType, newMode));
      }
    } else {
      // No cached slides - just re-broadcast current slide with new mode
      const { fullSlides, currentSlideIndex, songTitle, currentItem, isBlank } = this.currentState;

      if (!isBlank && fullSlides && fullSlides.length > 0 && fullSlides[currentSlideIndex]) {
        const slide = fullSlides[currentSlideIndex];
        const nextSlide = currentSlideIndex < fullSlides.length - 1 ? fullSlides[currentSlideIndex + 1] : null;
        this.displayManager!.broadcastSlide(this.buildSlideData(slide, nextSlide, songTitle, currentItem?.type, newMode));
      }
    }

    // Broadcast updated state to mobile clients
    this.broadcastState(true);
    return true;
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
    } else if (url === '/midi-bridge' || url.startsWith('/midi-bridge?')) {
      // Serve MIDI Bridge UI
      const html = getMidiBridgeUI(this.port);
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
