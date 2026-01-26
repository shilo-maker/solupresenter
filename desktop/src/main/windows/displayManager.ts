import { BrowserWindow, screen, Display, ipcMain, app } from 'electron';
import * as path from 'path';
import { createLogger } from '../utils/debug';
import { getDisplayThemeOverride, DisplayThemeType } from '../database/index';

// Create logger for this module
const log = createLogger('DisplayManager');

// Local server port for production (set from main index.ts)
let localServerPort = 0;
export function setLocalServerPort(port: number) {
  localServerPort = port;
}

export interface DisplayInfo {
  id: number;
  label: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  isPrimary: boolean;
  scaleFactor: number;
  isAssigned: boolean;
  assignedType?: 'viewer' | 'stage' | 'obs';
}

export interface ManagedDisplay {
  id: number;
  electronDisplay: Display;
  window: BrowserWindow | null;
  type: 'viewer' | 'stage' | 'obs';
}

// OBS Overlay specific window (not tied to a display)
export interface OBSOverlayWindow {
  window: BrowserWindow;
  config: OBSOverlayConfig;
}

export interface OBSOverlayConfig {
  position: 'top' | 'center' | 'bottom';
  fontSize: number;
  textColor: string;
  showOriginal: boolean;
  showTransliteration: boolean;
  showTranslation: boolean;
  paddingBottom: number;
  paddingTop: number;
  maxWidth: number;
}

export interface SlideData {
  songId?: string;
  slideIndex?: number;
  displayMode?: 'bilingual' | 'original' | 'transliteration' | 'translation';
  isBlank?: boolean;
  songTitle?: string;
  slideData?: {
    originalText?: string;
    transliteration?: string;
    translation?: string;
    verseType?: string;
  };
  nextSlideData?: {
    originalText?: string;
    transliteration?: string;
    translation?: string;
    verseType?: string;
  } | null;
  backgroundImage?: string;
  imageUrl?: string;
  toolsData?: any;
  presentationData?: any;
  theme?: any;
  contentType?: 'song' | 'bible' | 'prayer' | 'sermon';
  activeTheme?: any;
}

const isDev = process.env.NODE_ENV === 'development' || !require('electron').app.isPackaged;

export class DisplayManager {
  private displays: Map<number, ManagedDisplay> = new Map();
  private onDisplayChangeCallback: ((displays: DisplayInfo[]) => void) | null = null;

  // Store screen event listeners for proper cleanup
  private screenListeners: {
    displayAdded?: (event: Electron.Event, display: Display) => void;
    displayRemoved?: (event: Electron.Event, display: Display) => void;
    displayMetricsChanged?: (event: Electron.Event, display: Display, changedMetrics: string[]) => void;
  } = {};

  // OBS Overlay window (special transparent window, not tied to a display)
  private obsOverlayWindow: OBSOverlayWindow | null = null;

  // Track identify overlay windows to prevent duplicates
  private identifyWindows: BrowserWindow[] = [];
  private identifyTimeout: NodeJS.Timeout | null = null;

  // Theme resolver callbacks - set from IPC to resolve theme IDs to theme objects
  private themeResolvers: {
    viewer?: (id: string) => any;
    stage?: (id: string) => any;
    bible?: (id: string) => any;
    prayer?: (id: string) => any;
  } = {};

  // Track ALL current presentation state for late-joining displays
  private currentViewerTheme: any = null;
  private currentStageTheme: any = null;
  private currentBibleTheme: any = null;
  private currentPrayerTheme: any = null;
  private currentSlideData: SlideData | null = null;
  private currentBackground: string | null = null;
  private currentMedia: { type: 'image' | 'video'; path: string } | null = null;
  private currentToolData: Map<string, any> = new Map(); // keyed by tool type
  private currentVideoState: {
    currentTime: number;
    isPlaying: boolean;
    playStartedAt?: number;  // Timestamp when play started (for calculating current position)
  } | null = null;

  private currentYoutubeState: {
    videoId: string;
    title: string;
  } | null = null;

  private currentYoutubePosition: {
    currentTime: number;
    isPlaying: boolean;
  } | null = null;

  constructor() {
    // Listen for display:ready IPC from renderer processes
    ipcMain.on('display:ready', (event) => {
      const senderWindow = BrowserWindow.fromWebContents(event.sender);
      if (!senderWindow) {
        return;
      }

      // Check if this is the OBS overlay window
      if (this.obsOverlayWindow?.window === senderWindow) {
        this.sendInitialStateToOBS();
        return;
      }

      // Find which managed display this is
      for (const [displayId, managed] of this.displays) {
        if (managed.window === senderWindow) {
          this.sendInitialState(managed);
          return;
        }
      }
    });

    // Listen for display:error IPC from renderer processes
    ipcMain.on('display:error', (event, error: string) => {
      const senderWindow = BrowserWindow.fromWebContents(event.sender);
      let displayId = 'unknown';

      if (senderWindow) {
        for (const [id, managed] of this.displays) {
          if (managed.window === senderWindow) {
            displayId = String(id);
            break;
          }
        }
      }

      log.error(`Display ${displayId} error:`, error);
    });
  }

  /**
   * Send current state to a newly ready display
   * This ensures late-joining displays get ALL current presentation state
   */
  private sendInitialState(managed: ManagedDisplay): void {
    if (!managed.window || managed.window.isDestroyed()) return;

    try {
    if (managed.type === 'viewer') {
      // Theme - respect per-display overrides
      if (this.currentViewerTheme) {
        const themeToSend = this.getThemeForDisplay(managed.id, 'viewer', this.currentViewerTheme);
        managed.window.webContents.send('theme:update', themeToSend);
      }

      // Background
      if (this.currentBackground) {
        managed.window.webContents.send('background:update', this.currentBackground);
      }

      // Slide data (with calculated activeTheme for late-joining displays, respecting overrides)
      if (this.currentSlideData) {
        const contentType = this.currentSlideData.contentType || 'song';
        let activeTheme = this.currentViewerTheme;
        let themeType: DisplayThemeType = 'viewer';
        if (contentType === 'bible') {
          activeTheme = this.currentBibleTheme;
          themeType = 'bible';
        } else if (contentType === 'prayer' || contentType === 'sermon') {
          activeTheme = this.currentPrayerTheme;
          themeType = 'prayer';
        }
        // Apply per-display override if available
        activeTheme = this.getThemeForDisplay(managed.id, themeType, activeTheme);
        managed.window.webContents.send('slide:update', { ...this.currentSlideData, activeTheme });
      }

      // Media (image/video)
      if (this.currentMedia && this.currentMedia.path) {
        log.debug(` sendInitialState - sending media to display ${managed.id}:`, this.currentMedia.path.substring(0, 80));
        managed.window.webContents.send('media:update', this.currentMedia);
        // Note: The display handles its own video position sync via getVideoPosition()
        // in the onCanPlay handler. This avoids race conditions between the timeout-based
        // sync here and the event-based sync in the display.
      }

      // All active tools (countdown, announcement, rotating messages, clock, stopwatch)
      for (const [toolType, toolData] of this.currentToolData) {
        if (toolData && toolData.active) {
          managed.window.webContents.send('tool:update', toolData);
        }
      }

      // YouTube state
      if (this.currentYoutubeState) {
        managed.window.webContents.send('youtube:command', {
          type: 'load',
          videoId: this.currentYoutubeState.videoId,
          title: this.currentYoutubeState.title
        });
      }
    } else if (managed.type === 'stage') {
      // Stage theme - respect per-display overrides
      if (this.currentStageTheme) {
        const themeToSend = this.getThemeForDisplay(managed.id, 'stage', this.currentStageTheme);
        managed.window.webContents.send('stageTheme:update', themeToSend);
      }

      // Slide data (stage monitors also show slides, with activeTheme)
      if (this.currentSlideData) {
        const contentType = this.currentSlideData.contentType || 'song';
        let activeTheme = this.currentViewerTheme;
        if (contentType === 'bible') {
          activeTheme = this.currentBibleTheme;
        } else if (contentType === 'prayer' || contentType === 'sermon') {
          activeTheme = this.currentPrayerTheme;
        }
        managed.window.webContents.send('slide:update', { ...this.currentSlideData, activeTheme });
      }

      // Tools also shown on stage
      for (const [toolType, toolData] of this.currentToolData) {
        if (toolData && toolData.active) {
          managed.window.webContents.send('tool:update', toolData);
        }
      }
    }
    } catch (error) {
      // Window may have been destroyed between check and use - this is expected
      log.debug('Window destroyed during sendInitialState:', error);
    }
  }

  /**
   * Send current state to OBS overlay window
   */
  private sendInitialStateToOBS(): void {
    if (!this.obsOverlayWindow?.window || this.obsOverlayWindow.window.isDestroyed()) return;

    log.debug(' Sending initial state to OBS overlay');

    // OBS overlay needs slide data with activeTheme for content-specific styling
    if (this.currentSlideData) {
      log.debug(' -> Sending slide data to OBS');
      const contentType = this.currentSlideData.contentType || 'song';
      let activeTheme = this.currentViewerTheme;
      if (contentType === 'bible') {
        activeTheme = this.currentBibleTheme;
      } else if (contentType === 'prayer' || contentType === 'sermon') {
        activeTheme = this.currentPrayerTheme;
      }
      this.obsOverlayWindow.window.webContents.send('slide:update', { ...this.currentSlideData, activeTheme });
    }

    log.debug(' OBS overlay initial state sent');
  }

  /**
   * Get all connected displays with their current assignment status
   */
  getAllDisplays(): DisplayInfo[] {
    const allDisplays = screen.getAllDisplays();
    const primaryDisplay = screen.getPrimaryDisplay();

    return allDisplays.map((d) => ({
      id: d.id,
      label: d.label || `Display ${d.id}`,
      bounds: d.bounds,
      isPrimary: d.id === primaryDisplay.id,
      scaleFactor: d.scaleFactor,
      isAssigned: this.displays.has(d.id),
      assignedType: this.displays.get(d.id)?.type
    }));
  }

  /**
   * Get only external (non-primary) displays
   */
  getExternalDisplays(): DisplayInfo[] {
    return this.getAllDisplays().filter((d) => !d.isPrimary);
  }

  /**
   * Open a display window on a specific monitor
   */
  openDisplayWindow(displayId: number, type: 'viewer' | 'stage'): boolean {
    const electronDisplay = screen.getAllDisplays().find((d) => d.id === displayId);
    if (!electronDisplay) {
      log.error(`Display ${displayId} not found`);
      return false;
    }

    // Close existing window on this display if any
    this.closeDisplayWindow(displayId);

    // Check if this display is the same as where the control window is located
    const controlWindowDisplayId = this.getControlWindowDisplay();
    const isSameScreenAsControl = controlWindowDisplayId === displayId;

    const window = new BrowserWindow({
      x: electronDisplay.bounds.x,
      y: electronDisplay.bounds.y,
      width: electronDisplay.bounds.width,
      height: electronDisplay.bounds.height,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      // Use kiosk mode on Windows for true fullscreen (no taskbar)
      kiosk: process.platform === 'win32',
      fullscreen: process.platform !== 'win32',
      webPreferences: {
        preload: path.join(__dirname, '..', '..', 'preload', 'display.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        backgroundThrottling: false // Critical for smooth video playback
      }
    });

    // Prevent the window from showing in alt-tab on Windows
    window.setSkipTaskbar(true);

    // On Windows, ensure the window covers the taskbar completely
    if (process.platform === 'win32') {
      window.once('ready-to-show', () => {
        window.setBounds({
          x: electronDisplay.bounds.x,
          y: electronDisplay.bounds.y,
          width: electronDisplay.bounds.width,
          height: electronDisplay.bounds.height
        });
        window.setAlwaysOnTop(true, 'screen-saver');
      });
    }

    // Build URL with sameScreen parameter if applicable
    const sameScreenParam = isSameScreenAsControl ? '?sameScreen=true' : '';

    // Load appropriate content based on type
    if (isDev) {
      window.loadURL(`http://localhost:5173/#/display/${type}${sameScreenParam}`);
      // Open DevTools in development mode
      window.webContents.openDevTools({ mode: 'detach' });
    } else {
      // In production, use local HTTP server for proper origin (needed for YouTube)
      window.loadURL(`http://127.0.0.1:${localServerPort}/#/display/${type}${sameScreenParam}`);
    }

    // Note: Initial state is now sent when we receive 'display:ready' IPC from the renderer
    // This ensures the React component has mounted and registered its IPC listeners

    // Store reference
    this.displays.set(displayId, {
      id: displayId,
      electronDisplay,
      window,
      type
    });

    // Handle window close
    window.on('closed', () => {
      this.displays.delete(displayId);
      this.notifyDisplayChange();
    });

    this.notifyDisplayChange();
    return true;
  }

  /**
   * Close a display window
   */
  closeDisplayWindow(displayId: number): void {
    const managed = this.displays.get(displayId);
    if (managed?.window) {
      managed.window.close();
    }
    this.displays.delete(displayId);
    this.notifyDisplayChange();
  }

  /**
   * Close all display windows
   */
  closeAllDisplays(): void {
    for (const [id, managed] of this.displays) {
      if (managed.window) {
        managed.window.close();
      }
    }
    this.displays.clear();
    // Also close OBS overlay if open
    this.closeOBSOverlay();
  }

  /**
   * Open OBS Overlay window (transparent, for capture by OBS)
   */
  openOBSOverlay(config: Partial<OBSOverlayConfig> = {}): boolean {
    log.debug(' openOBSOverlay called with config:', config);
    // Close existing OBS overlay if any
    this.closeOBSOverlay();

    const defaultConfig: OBSOverlayConfig = {
      position: 'bottom',
      fontSize: 100,
      textColor: 'white',
      showOriginal: true,
      showTransliteration: true,
      showTranslation: true,
      paddingBottom: 3,
      paddingTop: 5,
      maxWidth: 90
    };

    const fullConfig: OBSOverlayConfig = { ...defaultConfig, ...config };

    // Create transparent window for OBS capture
    // Size: 1920x1080 (standard HD) - user can resize as needed
    const window = new BrowserWindow({
      width: 1920,
      height: 1080,
      transparent: true,
      frame: false,
      alwaysOnTop: false, // Not always on top - just for OBS capture
      skipTaskbar: false, // Show in taskbar so user can find it
      hasShadow: false,
      backgroundColor: '#00000000', // Fully transparent
      webPreferences: {
        preload: path.join(__dirname, '..', '..', 'preload', 'display.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        backgroundThrottling: false
      }
    });

    // Build URL with config parameters
    const configParams = new URLSearchParams({
      position: fullConfig.position,
      fontSize: fullConfig.fontSize.toString(),
      color: fullConfig.textColor,
      original: fullConfig.showOriginal.toString(),
      transliteration: fullConfig.showTransliteration.toString(),
      translation: fullConfig.showTranslation.toString(),
      paddingBottom: fullConfig.paddingBottom.toString(),
      paddingTop: fullConfig.paddingTop.toString(),
      maxWidth: fullConfig.maxWidth.toString()
    });

    // Load OBS overlay page
    const url = isDev
      ? `http://localhost:5173/#/display/obs?${configParams}`
      : path.join(__dirname, '../../../renderer/index.html');

    log.debug(' OBS overlay URL:', url);
    log.debug(' isDev:', isDev);

    if (isDev) {
      window.loadURL(`http://localhost:5173/#/display/obs?${configParams}`);
      // Open DevTools in development mode
      window.webContents.openDevTools({ mode: 'detach' });
    } else {
      // In production, use local HTTP server for proper origin (needed for YouTube)
      window.loadURL(`http://127.0.0.1:${localServerPort}/#/display/obs?${configParams}`);
    }

    log.debug(' OBS overlay window created and loading');

    // Store reference
    this.obsOverlayWindow = {
      window,
      config: fullConfig
    };

    // Handle window close
    window.on('closed', () => {
      log.debug(' OBS overlay window closed');
      this.obsOverlayWindow = null;
    });

    log.debug(' OBS overlay setup complete, returning true');
    return true;
  }

  /**
   * Close OBS Overlay window
   */
  closeOBSOverlay(): void {
    if (this.obsOverlayWindow?.window && !this.obsOverlayWindow.window.isDestroyed()) {
      this.obsOverlayWindow.window.close();
    }
    this.obsOverlayWindow = null;
  }

  /**
   * Check if OBS Overlay is open
   */
  isOBSOverlayOpen(): boolean {
    return this.obsOverlayWindow !== null && !this.obsOverlayWindow.window.isDestroyed();
  }

  /**
   * Get OBS Overlay config
   */
  getOBSOverlayConfig(): OBSOverlayConfig | null {
    return this.obsOverlayWindow?.config || null;
  }

  /**
   * Update OBS Overlay config (reopens window with new config)
   */
  updateOBSOverlayConfig(config: Partial<OBSOverlayConfig>): boolean {
    if (!this.obsOverlayWindow) return false;
    const currentConfig = this.obsOverlayWindow.config;
    return this.openOBSOverlay({ ...currentConfig, ...config });
  }

  /**
   * Broadcast slide data to all display windows
   */
  broadcastSlide(slideData: SlideData): void {
    // Validate input
    if (!slideData || typeof slideData !== 'object') {
      log.error(' broadcastSlide: invalid slideData');
      return;
    }

    // Store for late-joining displays
    this.currentSlideData = slideData;

    // Include the appropriate theme based on contentType
    const contentType = slideData.contentType || 'song';
    let activeTheme = this.currentViewerTheme;
    if (contentType === 'bible') {
      activeTheme = this.currentBibleTheme;
    } else if (contentType === 'prayer' || contentType === 'sermon') {
      activeTheme = this.currentPrayerTheme;
    }
    const slideWithTheme = {
      ...slideData,
      activeTheme // Include theme so viewer knows which to apply
    };

    for (const managed of this.displays.values()) {
      try {
        if (managed.window && !managed.window.isDestroyed()) {
          managed.window.webContents.send('slide:update', slideWithTheme);
        }
      } catch (error) {
        // Window may have been destroyed between check and send
        log.debug('Window destroyed during broadcastSlide:', error);
      }
    }

    // Also send to OBS overlay
    try {
      if (this.obsOverlayWindow?.window && !this.obsOverlayWindow.window.isDestroyed()) {
        this.obsOverlayWindow.window.webContents.send('slide:update', slideWithTheme);
      }
    } catch (error) {
      log.debug('OBS window destroyed during broadcastSlide:', error);
    }
  }

  /**
   * Broadcast to specific display types
   */
  broadcastToType(type: 'viewer' | 'stage', channel: string, data: any): void {
    for (const managed of this.displays.values()) {
      try {
        if (managed.type === type && managed.window && !managed.window.isDestroyed()) {
          managed.window.webContents.send(channel, data);
        }
      } catch (error) {
        // Window may have been destroyed between check and send
        log.debug('Window destroyed during broadcastToType:', error);
      }
    }
  }

  /**
   * Send theme update to all viewers (respects per-display overrides)
   */
  broadcastTheme(theme: any): void {
    // Validate theme is an object (can be null to clear theme)
    if (theme !== null && (typeof theme !== 'object' || Array.isArray(theme))) {
      log.error(' broadcastTheme: invalid theme, expected object or null');
      return;
    }
    this.currentViewerTheme = theme;
    log.debug(' broadcastTheme - storing theme:', theme?.name);

    // Send to each viewer with potential per-display override
    for (const managed of this.displays.values()) {
      if (managed.type === 'viewer') {
        this.sendThemeToDisplay(managed, 'viewer', theme, 'theme:update');
      }
    }
  }

  /**
   * Send stage theme update to all stage monitors (respects per-display overrides)
   */
  broadcastStageTheme(theme: any): void {
    // Validate theme is an object (can be null to clear theme)
    if (theme !== null && (typeof theme !== 'object' || Array.isArray(theme))) {
      log.error(' broadcastStageTheme: invalid theme, expected object or null');
      return;
    }
    this.currentStageTheme = theme;

    // Send to each stage display with potential per-display override
    for (const managed of this.displays.values()) {
      if (managed.type === 'stage') {
        this.sendThemeToDisplay(managed, 'stage', theme, 'stageTheme:update');
      }
    }
  }

  /**
   * Send bible theme update to all viewers (for bible content, respects per-display overrides)
   */
  broadcastBibleTheme(theme: any): void {
    // Validate theme is an object (can be null to clear theme)
    if (theme !== null && (typeof theme !== 'object' || Array.isArray(theme))) {
      log.error(' broadcastBibleTheme: invalid theme, expected object or null');
      return;
    }
    // Store for late-joining displays and content-type detection
    this.currentBibleTheme = theme;

    // Send to each viewer with potential per-display override
    for (const managed of this.displays.values()) {
      if (managed.type === 'viewer') {
        this.sendThemeToDisplay(managed, 'bible', theme, 'bibleTheme:update');
      }
    }
  }

  /**
   * Send prayer theme update to all viewers (for prayer/sermon content, respects per-display overrides)
   */
  broadcastPrayerTheme(theme: any): void {
    // Validate theme is an object (can be null to clear theme)
    if (theme !== null && (typeof theme !== 'object' || Array.isArray(theme))) {
      log.error(' broadcastPrayerTheme: invalid theme, expected object or null');
      return;
    }
    // Store for late-joining displays and content-type detection
    this.currentPrayerTheme = theme;

    // Send to each viewer with potential per-display override
    for (const managed of this.displays.values()) {
      if (managed.type === 'viewer') {
        this.sendThemeToDisplay(managed, 'prayer', theme, 'prayerTheme:update');
      }
    }
  }

  /**
   * Send background update to all viewers
   */
  broadcastBackground(background: string): void {
    // Validate background is a string (can be empty to clear)
    if (typeof background !== 'string') {
      log.error(' broadcastBackground: invalid background, expected string');
      return;
    }
    // Limit background string length to prevent abuse
    if (background.length > 10000) {
      log.error(' broadcastBackground: background string too long');
      return;
    }
    // Store for late-joining displays
    this.currentBackground = background;
    log.debug('broadcastBackground called, displays:', this.displays.size);
    this.broadcastToType('viewer', 'background:update', background);
  }

  /**
   * Send video command to all display windows
   */
  broadcastVideoCommand(command: { type: string; time?: number; path?: string; muted?: boolean; volume?: number }): void {
    // Validate command
    if (!command || !command.type || typeof command.type !== 'string') {
      log.error(' broadcastVideoCommand: invalid command');
      return;
    }

    log.debug(' broadcastVideoCommand:', command.type, 'displays:', this.displays.size);

    // Track video state for late-joining displays
    switch (command.type) {
      case 'play':
        this.currentVideoState = { currentTime: 0, isPlaying: true, playStartedAt: Date.now() };
        break;
      case 'pause':
        if (this.currentVideoState) {
          // Calculate current position before pausing
          if (this.currentVideoState.isPlaying && this.currentVideoState.playStartedAt) {
            const elapsed = (Date.now() - this.currentVideoState.playStartedAt) / 1000;
            this.currentVideoState.currentTime += elapsed;
          }
          this.currentVideoState.isPlaying = false;
          this.currentVideoState.playStartedAt = undefined;
        }
        break;
      case 'resume':
        if (this.currentVideoState) {
          this.currentVideoState.isPlaying = true;
          this.currentVideoState.playStartedAt = Date.now();
        }
        break;
      case 'seek':
        if (this.currentVideoState && typeof command.time === 'number' && isFinite(command.time) && command.time >= 0) {
          this.currentVideoState.currentTime = command.time;
          // Reset play start time if playing
          if (this.currentVideoState.isPlaying) {
            this.currentVideoState.playStartedAt = Date.now();
          }
        }
        break;
      case 'stop':
        this.currentVideoState = null;
        break;
    }

    for (const managed of this.displays.values()) {
      if (managed.window && !managed.window.isDestroyed()) {
        log.debug(' -> Sending video command to display:', managed.id);
        managed.window.webContents.send('video:command', command);
      }
    }
  }

  /**
   * Send media update to all display windows
   */
  broadcastMedia(mediaData: { type: 'image' | 'video'; path: string }): void {
    // Validate input
    if (!mediaData || typeof mediaData !== 'object') {
      log.error(' broadcastMedia: invalid mediaData');
      return;
    }
    if (mediaData.type && mediaData.type !== 'image' && mediaData.type !== 'video') {
      log.error(' broadcastMedia: invalid media type:', mediaData.type);
      return;
    }

    // Store for late-joining displays
    // If path is empty, clear media state
    if (mediaData.path) {
      this.currentMedia = mediaData;
      log.debug(' broadcastMedia - storing media:', mediaData.type);

      // Initialize video state when video starts - paused until display is ready
      if (mediaData.type === 'video') {
        this.currentVideoState = { currentTime: 0, isPlaying: false, playStartedAt: undefined };
        log.debug(' broadcastMedia - initialized video state (paused, waiting for display ready)');
      }
    } else {
      this.currentMedia = null;
      this.currentVideoState = null;
      log.debug(' broadcastMedia - clearing media');
    }

    for (const managed of this.displays.values()) {
      if (managed.window && !managed.window.isDestroyed()) {
        log.debug(` broadcastMedia - sending to display ${managed.id} (${managed.type}):`, mediaData.path?.substring(0, 80));
        managed.window.webContents.send('media:update', mediaData);
      }
    }
  }

  /**
   * Signal that display is ready for video playback
   * Does NOT start playback - control panel will orchestrate sync via resumeVideo
   * Returns true if ready to play, false if no video or already playing
   */
  startVideoPlayback(): boolean {
    if (!this.currentVideoState) return false;
    if (this.currentVideoState.isPlaying) return false; // Already playing

    // Just mark as ready - don't actually play yet
    // Control panel will call resumeVideo() after syncing both videos to same position
    log.debug(' startVideoPlayback - display ready, waiting for control panel to sync');

    return true;
  }

  /**
   * Calculate the current video position based on tracked state
   * Used both internally and by IPC handler for display sync
   */
  getVideoPosition(): { time: number; isPlaying: boolean } | null {
    if (!this.currentVideoState) return null;

    let time = this.currentVideoState.currentTime;
    if (this.currentVideoState.isPlaying && this.currentVideoState.playStartedAt) {
      // Calculate elapsed time since playback started
      const elapsed = (Date.now() - this.currentVideoState.playStartedAt) / 1000;
      time += elapsed;
    }

    return { time, isPlaying: this.currentVideoState.isPlaying };
  }

  /**
   * Send tool data (countdown, announcement, rotating messages, clock, stopwatch) to all display windows
   */
  broadcastTool(toolData: any): void {
    // Validate toolData
    if (!toolData || typeof toolData !== 'object') {
      log.error(' broadcastTool: invalid toolData, expected object');
      return;
    }

    // Validate tool type
    const validToolTypes = ['countdown', 'announcement', 'rotatingMessages', 'clock', 'stopwatch'];
    if (!toolData.type || typeof toolData.type !== 'string' || !validToolTypes.includes(toolData.type)) {
      log.error(' broadcastTool: invalid tool type:', toolData.type);
      return;
    }

    // Store for late-joining displays, keyed by tool type
    if (toolData.active) {
      this.currentToolData.set(toolData.type, toolData);
      log.debug(' broadcastTool - storing active tool:', toolData.type);
    } else {
      // Tool deactivated, remove from state
      this.currentToolData.delete(toolData.type);
      log.debug(' broadcastTool - removing inactive tool:', toolData.type);
    }

    for (const managed of this.displays.values()) {
      if (managed.window && !managed.window.isDestroyed()) {
        managed.window.webContents.send('tool:update', toolData);
      }
    }
  }

  /**
   * Broadcast YouTube command to all display windows
   */
  broadcastYoutube(command: { type: string; videoId?: string; title?: string; currentTime?: number; isPlaying?: boolean }): void {
    // Validate command type
    if (!command || !command.type) {
      log.error(' broadcastYoutube: invalid command');
      return;
    }

    log.debug(' broadcastYoutube:', command.type, 'displays:', this.displays.size);

    // Track YouTube state for late-joining displays
    switch (command.type) {
      case 'load':
        // Validate videoId for load command
        if (!command.videoId || typeof command.videoId !== 'string') {
          log.error(' broadcastYoutube load: invalid videoId');
          return;
        }
        // Sanitize videoId - YouTube IDs should only contain alphanumeric, - and _
        const sanitizedVideoId = command.videoId.replace(/[^a-zA-Z0-9_-]/g, '');
        if (sanitizedVideoId.length === 0 || sanitizedVideoId.length > 20) {
          log.error(' broadcastYoutube load: invalid videoId format');
          return;
        }
        this.currentYoutubeState = { videoId: sanitizedVideoId, title: (command.title || 'YouTube Video').substring(0, 500) };
        this.currentYoutubePosition = { currentTime: 0, isPlaying: true };
        // Clear any other media state when YouTube starts
        this.currentMedia = null;
        this.currentVideoState = null;
        // Update command with sanitized values
        command = { ...command, videoId: sanitizedVideoId };
        break;
      case 'stop':
        this.currentYoutubeState = null;
        this.currentYoutubePosition = null;
        break;
      case 'play':
      case 'sync':
        // Validate currentTime
        if (typeof command.currentTime === 'number' && isFinite(command.currentTime) && command.currentTime >= 0) {
          this.currentYoutubePosition = {
            currentTime: command.currentTime,
            isPlaying: command.isPlaying ?? true
          };
        }
        break;
      case 'pause':
      case 'seek':
        // Validate currentTime
        if (typeof command.currentTime === 'number' && isFinite(command.currentTime) && command.currentTime >= 0) {
          this.currentYoutubePosition = {
            currentTime: command.currentTime,
            isPlaying: command.type === 'seek' ? (this.currentYoutubePosition?.isPlaying ?? false) : false
          };
        }
        break;
    }

    for (const managed of this.displays.values()) {
      if (managed.type === 'viewer' && managed.window && !managed.window.isDestroyed()) {
        log.debug(' -> Sending youtube command to display:', managed.id);
        managed.window.webContents.send('youtube:command', command);
      }
    }
  }

  /**
   * Get current YouTube position for display sync
   */
  getYoutubePosition(): { time: number; isPlaying: boolean } | null {
    if (!this.currentYoutubePosition) return null;
    return {
      time: this.currentYoutubePosition.currentTime,
      isPlaying: this.currentYoutubePosition.isPlaying
    };
  }

  /**
   * Set theme resolvers for looking up themes by ID
   * These are used when applying per-display theme overrides
   */
  setThemeResolvers(resolvers: {
    viewer?: (id: string) => any;
    stage?: (id: string) => any;
    bible?: (id: string) => any;
    prayer?: (id: string) => any;
  }): void {
    this.themeResolvers = resolvers;
  }

  /**
   * Get the theme to apply for a specific display, considering overrides
   */
  private getThemeForDisplay(displayId: number, themeType: DisplayThemeType, globalTheme: any): any {
    // Check for display-specific override
    const override = getDisplayThemeOverride(displayId, themeType);
    if (override && this.themeResolvers[themeType]) {
      const overrideTheme = this.themeResolvers[themeType]!(override.themeId);
      if (overrideTheme) {
        log.debug(`Using override theme for display ${displayId}, type ${themeType}:`, overrideTheme.name);
        return overrideTheme;
      }
    }
    // Fall back to global theme
    return globalTheme;
  }

  /**
   * Send theme to a specific display, respecting overrides
   */
  private sendThemeToDisplay(managed: ManagedDisplay, themeType: DisplayThemeType, globalTheme: any, channel: string): void {
    if (!managed.window || managed.window.isDestroyed()) return;

    try {
      const themeToSend = this.getThemeForDisplay(managed.id, themeType, globalTheme);
      managed.window.webContents.send(channel, themeToSend);
    } catch (error) {
      log.debug(`Error sending theme to display ${managed.id}:`, error);
    }
  }

  /**
   * Start watching for display changes (connect/disconnect)
   */
  startWatching(callback: (displays: DisplayInfo[]) => void): void {
    // Remove any existing listeners first to prevent duplicates
    this.stopWatching();

    this.onDisplayChangeCallback = callback;

    // Store listeners for proper cleanup
    this.screenListeners.displayAdded = (event, newDisplay) => {
      log.debug('Display added:', newDisplay.id);
      this.notifyDisplayChange();
    };

    this.screenListeners.displayRemoved = (event, oldDisplay) => {
      log.debug('Display removed:', oldDisplay.id);
      // Close window if it was on this display
      const managed = this.displays.get(oldDisplay.id);
      if (managed?.window && !managed.window.isDestroyed()) {
        managed.window.close();
      }
      this.displays.delete(oldDisplay.id);
      this.notifyDisplayChange();
    };

    this.screenListeners.displayMetricsChanged = (event, display, changedMetrics) => {
      log.debug('Display metrics changed:', display.id, changedMetrics);
      // Could handle resolution changes here
    };

    screen.on('display-added', this.screenListeners.displayAdded);
    screen.on('display-removed', this.screenListeners.displayRemoved);
    screen.on('display-metrics-changed', this.screenListeners.displayMetricsChanged);
  }

  /**
   * Stop watching for display changes and remove listeners
   */
  stopWatching(): void {
    if (this.screenListeners.displayAdded) {
      screen.off('display-added', this.screenListeners.displayAdded);
    }
    if (this.screenListeners.displayRemoved) {
      screen.off('display-removed', this.screenListeners.displayRemoved);
    }
    if (this.screenListeners.displayMetricsChanged) {
      screen.off('display-metrics-changed', this.screenListeners.displayMetricsChanged);
    }
    this.screenListeners = {};
    this.onDisplayChangeCallback = null;
  }

  private notifyDisplayChange(): void {
    if (this.onDisplayChangeCallback) {
      this.onDisplayChangeCallback(this.getAllDisplays());
    }
  }

  /**
   * Get count of active display windows
   */
  getActiveDisplayCount(): number {
    return this.displays.size;
  }

  /**
   * Check if a display is assigned
   */
  isDisplayAssigned(displayId: number): boolean {
    return this.displays.has(displayId);
  }

  /**
   * Capture the first viewer window as a thumbnail
   */
  async captureViewerThumbnail(): Promise<string | null> {
    // Find first viewer window
    for (const managed of this.displays.values()) {
      if (managed.type === 'viewer' && managed.window && !managed.window.isDestroyed()) {
        try {
          const image = await managed.window.webContents.capturePage();
          // Resize to thumbnail size for performance
          const resized = image.resize({ width: 480, height: 270 });
          return resized.toDataURL();
        } catch (err) {
          log.error('Failed to capture viewer:', err);
          return null;
        }
      }
    }
    return null;
  }

  /**
   * Show identification overlay on a specific display or all displays
   * @param targetDisplayId - Optional. If provided, only identify that display. Otherwise identify all.
   */
  identifyDisplays(targetDisplayId?: number): void {
    // Close any existing identify windows first to prevent duplicates
    this.closeIdentifyWindows();

    const allDisplays = screen.getAllDisplays();
    const primaryDisplay = screen.getPrimaryDisplay();

    log.debug('identifyDisplays called with targetDisplayId:', targetDisplayId);

    // Filter to single display if targetDisplayId is provided
    const displaysToIdentify = targetDisplayId !== undefined
      ? allDisplays.filter(d => d.id === targetDisplayId)
      : allDisplays;

    if (displaysToIdentify.length === 0) {
      log.warn('No displays found to identify for targetDisplayId:', targetDisplayId);
      return;
    }

    // Helper to escape HTML special characters
    const escapeHtml = (str: string): string => {
      return str.replace(/[&<>"']/g, c => {
        const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        return entities[c] || c;
      });
    };

    displaysToIdentify.forEach((display) => {
      // Find the index in the full list for consistent numbering
      const index = allDisplays.findIndex(d => d.id === display.id);
      const isPrimary = display.id === primaryDisplay.id;
      const displayNumber = index + 1;
      const label = escapeHtml(display.label || `Display ${displayNumber}`);

      log.debug(`Creating identify window for display ${display.id} at position:`, {
        x: display.bounds.x + Math.floor(display.bounds.width / 2) - 200,
        y: display.bounds.y + Math.floor(display.bounds.height / 2) - 100
      });

      // Create overlay window with transparency
      const identifyWindow = new BrowserWindow({
        x: display.bounds.x + Math.floor(display.bounds.width / 2) - 200,
        y: display.bounds.y + Math.floor(display.bounds.height / 2) - 100,
        width: 400,
        height: 200,
        frame: false,
        transparent: true,
        backgroundColor: '#00000000', // Fully transparent
        hasShadow: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        focusable: false,
        resizable: false,
        show: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      });

      // Create HTML content for the overlay
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            html, body {
              width: 100%;
              height: 100%;
              overflow: hidden;
              background: transparent !important;
            }
            body {
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              background: transparent !important;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              -webkit-app-region: no-drag;
            }
            .container {
              background: rgba(0, 0, 0, 0.9);
              border: 3px solid #FF9800;
              border-radius: 20px;
              padding: 30px 50px;
              text-align: center;
              box-shadow: 0 8px 32px rgba(0,0,0,0.5);
            }
            .number {
              font-size: 72px;
              font-weight: bold;
              color: #FF9800;
              line-height: 1;
            }
            .label {
              font-size: 18px;
              color: white;
              margin-top: 8px;
            }
            .badge {
              display: inline-block;
              background: #2196F3;
              color: white;
              font-size: 12px;
              padding: 4px 10px;
              border-radius: 10px;
              margin-top: 8px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="number">${displayNumber}</div>
            <div class="label">${label}</div>
            ${isPrimary ? '<div class="badge">Primary (Control)</div>' : ''}
          </div>
        </body>
        </html>
      `;

      identifyWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
      this.identifyWindows.push(identifyWindow);

      log.debug(`Identify window created for display ${displayNumber}`);
    });

    // Close all identify windows after 3 seconds
    this.identifyTimeout = setTimeout(() => {
      this.closeIdentifyWindows();
    }, 3000);
  }

  /**
   * Close all identify overlay windows
   */
  private closeIdentifyWindows(): void {
    // Clear the timeout if it exists
    if (this.identifyTimeout) {
      clearTimeout(this.identifyTimeout);
      this.identifyTimeout = null;
    }

    // Close all identify windows
    this.identifyWindows.forEach(win => {
      if (!win.isDestroyed()) {
        win.close();
      }
    });
    this.identifyWindows = [];
  }

  /**
   * Move the control window to a different display
   */
  moveControlWindow(targetDisplayId: number): boolean {
    const targetDisplay = screen.getAllDisplays().find(d => d.id === targetDisplayId);
    if (!targetDisplay) {
      log.error(`Target display ${targetDisplayId} not found`);
      return false;
    }

    // Get all windows and find the control window (the main window that's not a display window)
    const allWindows = BrowserWindow.getAllWindows();

    // Find the control window - it's the one that's not in our managed displays and not the OBS overlay
    const controlWindow = allWindows.find(win => {
      if (win.isDestroyed()) return false;

      // Check if it's a managed display window
      for (const managed of this.displays.values()) {
        if (managed.window === win) return false;
      }

      // Check if it's the OBS overlay
      if (this.obsOverlayWindow?.window === win) return false;

      return true;
    });

    if (!controlWindow) {
      log.error('Control window not found');
      return false;
    }

    // Move the control window to the target display
    const bounds = controlWindow.getBounds();
    const newX = targetDisplay.bounds.x + Math.floor((targetDisplay.bounds.width - bounds.width) / 2);
    const newY = targetDisplay.bounds.y + Math.floor((targetDisplay.bounds.height - bounds.height) / 2);

    controlWindow.setBounds({
      x: newX,
      y: newY,
      width: bounds.width,
      height: bounds.height
    });

    log.debug(`Moved control window to display ${targetDisplayId}`);
    return true;
  }

  /**
   * Get the display where the control window is currently located
   */
  getControlWindowDisplay(): number | null {
    const allWindows = BrowserWindow.getAllWindows();

    // Find the control window
    const controlWindow = allWindows.find(win => {
      if (win.isDestroyed()) return false;

      for (const managed of this.displays.values()) {
        if (managed.window === win) return false;
      }

      if (this.obsOverlayWindow?.window === win) return false;

      return true;
    });

    if (!controlWindow) return null;

    const bounds = controlWindow.getBounds();
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;

    // Find which display contains the center of the control window
    const allDisplays = screen.getAllDisplays();
    for (const display of allDisplays) {
      if (centerX >= display.bounds.x &&
          centerX < display.bounds.x + display.bounds.width &&
          centerY >= display.bounds.y &&
          centerY < display.bounds.y + display.bounds.height) {
        return display.id;
      }
    }

    return null;
  }
}
