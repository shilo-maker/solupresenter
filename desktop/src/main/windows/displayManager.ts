import { BrowserWindow, screen, Display, ipcMain } from 'electron';
import * as path from 'path';

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
  assignedType?: 'viewer' | 'stage';
}

export interface ManagedDisplay {
  id: number;
  electronDisplay: Display;
  window: BrowserWindow | null;
  type: 'viewer' | 'stage';
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
}

const isDev = process.env.NODE_ENV === 'development' || !require('electron').app.isPackaged;

export class DisplayManager {
  private displays: Map<number, ManagedDisplay> = new Map();
  private onDisplayChangeCallback: ((displays: DisplayInfo[]) => void) | null = null;

  // Track ALL current presentation state for late-joining displays
  private currentViewerTheme: any = null;
  private currentStageTheme: any = null;
  private currentSlideData: SlideData | null = null;
  private currentBackground: string | null = null;
  private currentMedia: { type: 'image' | 'video'; path: string } | null = null;
  private currentToolData: Map<string, any> = new Map(); // keyed by tool type
  private currentVideoState: {
    currentTime: number;
    isPlaying: boolean;
    playStartedAt?: number;  // Timestamp when play started (for calculating current position)
  } | null = null;

  constructor() {
    console.log('[DisplayManager] Constructor called, setting up IPC listener for display:ready');

    // Listen for display:ready IPC from renderer processes
    ipcMain.on('display:ready', (event) => {
      console.log('[DisplayManager] display:ready IPC received!');
      const senderWindow = BrowserWindow.fromWebContents(event.sender);
      if (!senderWindow) {
        console.log('[DisplayManager] display:ready received but no matching window');
        return;
      }

      console.log(`[DisplayManager] Found sender window, checking ${this.displays.size} managed displays`);

      // Find which managed display this is
      for (const [displayId, managed] of this.displays) {
        console.log(`[DisplayManager] Checking display ${displayId}, window match: ${managed.window === senderWindow}`);
        if (managed.window === senderWindow) {
          console.log(`[DisplayManager] display:ready received for display ${displayId}, type=${managed.type}`);
          this.sendInitialState(managed);
          return;
        }
      }
      console.log('[DisplayManager] display:ready received but window not in managed displays');
    });
  }

  /**
   * Send current state to a newly ready display
   * This ensures late-joining displays get ALL current presentation state
   */
  private sendInitialState(managed: ManagedDisplay): void {
    if (!managed.window || managed.window.isDestroyed()) return;

    console.log('[DisplayManager] Sending initial state to late-joining display');

    if (managed.type === 'viewer') {
      // Theme
      if (this.currentViewerTheme) {
        console.log('[DisplayManager] -> Sending theme:', this.currentViewerTheme?.name);
        managed.window.webContents.send('theme:update', this.currentViewerTheme);
      }

      // Background
      if (this.currentBackground) {
        console.log('[DisplayManager] -> Sending background');
        managed.window.webContents.send('background:update', this.currentBackground);
      }

      // Slide data
      if (this.currentSlideData) {
        console.log('[DisplayManager] -> Sending slide data');
        managed.window.webContents.send('slide:update', this.currentSlideData);
      }

      // Media (image/video)
      if (this.currentMedia && this.currentMedia.path) {
        console.log('[DisplayManager] -> Sending media:', this.currentMedia.type);
        managed.window.webContents.send('media:update', this.currentMedia);

        // If it's a video with tracked position, send seek command to sync
        // Note: The display will also request position after video loads for more precise sync
        if (this.currentMedia.type === 'video' && this.currentVideoState) {
          const videoPos = this.getVideoPosition();
          if (videoPos) {
            console.log('[DisplayManager] -> Sending initial video sync, time:', videoPos.time, 'playing:', videoPos.isPlaying);
            // Small delay to ensure video element is ready
            setTimeout(() => {
              if (managed.window && !managed.window.isDestroyed()) {
                managed.window.webContents.send('video:command', {
                  type: 'seek',
                  time: videoPos.time
                });
                // Also send play/pause state
                if (videoPos.isPlaying) {
                  managed.window.webContents.send('video:command', { type: 'resume' });
                } else {
                  managed.window.webContents.send('video:command', { type: 'pause' });
                }
              }
            }, 100);
          }
        }
      }

      // All active tools (countdown, announcement, rotating messages, clock, stopwatch)
      for (const [toolType, toolData] of this.currentToolData) {
        if (toolData && toolData.active) {
          console.log('[DisplayManager] -> Sending tool:', toolType);
          managed.window.webContents.send('tool:update', toolData);
        }
      }
    } else if (managed.type === 'stage') {
      // Stage theme
      if (this.currentStageTheme) {
        console.log('[DisplayManager] -> Sending stage theme');
        managed.window.webContents.send('stageTheme:update', this.currentStageTheme);
      }

      // Slide data (stage monitors also show slides)
      if (this.currentSlideData) {
        console.log('[DisplayManager] -> Sending slide data to stage');
        managed.window.webContents.send('slide:update', this.currentSlideData);
      }

      // Tools also shown on stage
      for (const [toolType, toolData] of this.currentToolData) {
        if (toolData && toolData.active) {
          console.log('[DisplayManager] -> Sending tool to stage:', toolType);
          managed.window.webContents.send('tool:update', toolData);
        }
      }
    }

    console.log('[DisplayManager] Initial state sent');
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
      console.error(`Display ${displayId} not found`);
      return false;
    }

    // Close existing window on this display if any
    this.closeDisplayWindow(displayId);

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

    // Load appropriate content based on type
    if (isDev) {
      window.loadURL(`http://localhost:5173/#/display/${type}`);
      // Open DevTools in development mode
      window.webContents.openDevTools({ mode: 'detach' });
    } else {
      window.loadFile(path.join(__dirname, '../renderer/index.html'), {
        hash: `/display/${type}`
      });
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
  }

  /**
   * Broadcast slide data to all display windows
   */
  broadcastSlide(slideData: SlideData): void {
    // Store for late-joining displays
    this.currentSlideData = slideData;
    console.log('[DisplayManager] broadcastSlide - storing slide data, isBlank:', slideData.isBlank);

    for (const managed of this.displays.values()) {
      if (managed.window && !managed.window.isDestroyed()) {
        managed.window.webContents.send('slide:update', slideData);
      }
    }
  }

  /**
   * Broadcast to specific display types
   */
  broadcastToType(type: 'viewer' | 'stage', channel: string, data: any): void {
    console.log(`broadcastToType: type=${type}, channel=${channel}, displays=${this.displays.size}`);
    for (const managed of this.displays.values()) {
      console.log(`  Display ${managed.id}: type=${managed.type}, hasWindow=${!!managed.window}, destroyed=${managed.window?.isDestroyed()}`);
      if (managed.type === type && managed.window && !managed.window.isDestroyed()) {
        console.log(`  -> Sending to display ${managed.id}`);
        managed.window.webContents.send(channel, data);
      }
    }
  }

  /**
   * Send theme update to all viewers
   */
  broadcastTheme(theme: any): void {
    this.currentViewerTheme = theme;
    console.log('[DisplayManager] broadcastTheme - storing theme:', theme?.name);
    this.broadcastToType('viewer', 'theme:update', theme);
  }

  /**
   * Send stage theme update to all stage monitors
   */
  broadcastStageTheme(theme: any): void {
    this.currentStageTheme = theme;
    this.broadcastToType('stage', 'stageTheme:update', theme);
  }

  /**
   * Send background update to all viewers
   */
  broadcastBackground(background: string): void {
    // Store for late-joining displays
    this.currentBackground = background;
    console.log('broadcastBackground called, displays:', this.displays.size);
    this.broadcastToType('viewer', 'background:update', background);
  }

  /**
   * Send video command to all display windows
   */
  broadcastVideoCommand(command: { type: string; time?: number; path?: string; muted?: boolean; volume?: number }): void {
    console.log('[DisplayManager] broadcastVideoCommand:', command.type, 'displays:', this.displays.size);

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
        if (this.currentVideoState && typeof command.time === 'number') {
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
        console.log('[DisplayManager] -> Sending video command to display:', managed.id);
        managed.window.webContents.send('video:command', command);
      }
    }
  }

  /**
   * Send media update to all display windows
   */
  broadcastMedia(mediaData: { type: 'image' | 'video'; path: string }): void {
    // Store for late-joining displays
    // If path is empty, clear media state
    if (mediaData.path) {
      this.currentMedia = mediaData;
      console.log('[DisplayManager] broadcastMedia - storing media:', mediaData.type);

      // Initialize video state when video starts (autoplay)
      if (mediaData.type === 'video') {
        this.currentVideoState = { currentTime: 0, isPlaying: true, playStartedAt: Date.now() };
        console.log('[DisplayManager] broadcastMedia - initialized video state for autoplay');
      }
    } else {
      this.currentMedia = null;
      this.currentVideoState = null;
      console.log('[DisplayManager] broadcastMedia - clearing media');
    }

    for (const managed of this.displays.values()) {
      if (managed.window && !managed.window.isDestroyed()) {
        managed.window.webContents.send('media:update', mediaData);
      }
    }
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
    // Store for late-joining displays, keyed by tool type
    if (toolData && toolData.type) {
      if (toolData.active) {
        this.currentToolData.set(toolData.type, toolData);
        console.log('[DisplayManager] broadcastTool - storing active tool:', toolData.type);
      } else {
        // Tool deactivated, remove from state
        this.currentToolData.delete(toolData.type);
        console.log('[DisplayManager] broadcastTool - removing inactive tool:', toolData.type);
      }
    }

    for (const managed of this.displays.values()) {
      if (managed.window && !managed.window.isDestroyed()) {
        managed.window.webContents.send('tool:update', toolData);
      }
    }
  }

  /**
   * Start watching for display changes (connect/disconnect)
   */
  startWatching(callback: (displays: DisplayInfo[]) => void): void {
    this.onDisplayChangeCallback = callback;

    screen.on('display-added', (event, newDisplay) => {
      console.log('Display added:', newDisplay.id);
      this.notifyDisplayChange();
    });

    screen.on('display-removed', (event, oldDisplay) => {
      console.log('Display removed:', oldDisplay.id);
      // Close window if it was on this display
      const managed = this.displays.get(oldDisplay.id);
      if (managed?.window && !managed.window.isDestroyed()) {
        managed.window.close();
      }
      this.displays.delete(oldDisplay.id);
      this.notifyDisplayChange();
    });

    screen.on('display-metrics-changed', (event, display, changedMetrics) => {
      console.log('Display metrics changed:', display.id, changedMetrics);
      // Could handle resolution changes here
    });
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
          console.error('Failed to capture viewer:', err);
          return null;
        }
      }
    }
    return null;
  }
}
