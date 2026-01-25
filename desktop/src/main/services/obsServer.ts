import * as http from 'http';
import { EventEmitter } from 'events';
import { getDefaultOBSTheme } from '../database/obsThemes';

const DEFAULT_PORT = 45678;
const MAX_PORT_RETRIES = 10;
const SSE_HEARTBEAT_INTERVAL_MS = 30000; // Send heartbeat every 30 seconds

interface SlideData {
  originalText?: string;
  transliteration?: string;
  translation?: string;
  translationOverflow?: string;
  reference?: string;
  referenceTranslation?: string;
  referenceEnglish?: string;
  // Prayer/Sermon content fields
  title?: string;
  titleTranslation?: string;
  subtitle?: string;
  subtitleTranslation?: string;
  description?: string;
  descriptionTranslation?: string;
}

interface OBSState {
  slideData: SlideData | null;
  combinedSlides?: SlideData[] | null;
  displayMode: string;
  isBlank: boolean;
  songsTheme?: any;
  bibleTheme?: any;
  prayerTheme?: any;
  contentType?: 'song' | 'bible' | 'prayer' | 'sermon' | 'presentation';
  toolsData?: any;
  presentationSlide?: any; // Free-form presentation slide data
}

class OBSServer extends EventEmitter {
  private server: http.Server | null = null;
  private clients: Set<http.ServerResponse> = new Set();
  private currentState: OBSState = {
    slideData: null,
    displayMode: 'bilingual',
    isBlank: true
  };
  private port: number = DEFAULT_PORT;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Start the OBS server
   */
  start(port: number = DEFAULT_PORT, retryCount: number = 0): Promise<number> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        resolve(this.port);
        return;
      }

      if (retryCount >= MAX_PORT_RETRIES) {
        reject(new Error(`[OBSServer] Failed to find available port after ${MAX_PORT_RETRIES} attempts`));
        return;
      }

      this.port = port;
      this.server = http.createServer((req, res) => this.handleRequest(req, res));

      // Store reference for cleanup in error handler
      const currentServer = this.server;

      this.server.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          // Remove all listeners from current server to prevent accumulation
          if (currentServer) {
            currentServer.removeAllListeners();
            currentServer.close();
          }
          this.server = null;
          this.start(port + 1, retryCount + 1).then(resolve).catch(reject);
        } else {
          reject(err);
        }
      });

      this.server.listen(port, '127.0.0.1', async () => {
        console.log(`[OBSServer] Started on http://localhost:${port}`);
        this.port = port;
        // Start SSE heartbeat to keep connections alive
        this.startHeartbeat();
        // Load default themes if not already set
        await this.loadDefaultThemes();
        resolve(port);
      });
    });
  }

  /**
   * Start sending periodic SSE heartbeats to keep connections alive
   */
  private startHeartbeat(): void {
    // Clear any existing heartbeat interval
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      // Send SSE comment (heartbeat) to all clients
      const deadClients: http.ServerResponse[] = [];

      for (const client of this.clients) {
        try {
          if (client.writableEnded || client.destroyed) {
            deadClients.push(client);
          } else {
            // SSE comment (starts with :) - keeps connection alive but client ignores it
            const success = client.write(': heartbeat\n\n');
            if (!success) {
              deadClients.push(client);
            }
          }
        } catch (error) {
          deadClients.push(client);
        }
      }

      // Clean up dead clients
      for (const client of deadClients) {
        this.clients.delete(client);
        try {
          client.end();
        } catch {
          // Ignore cleanup errors
        }
      }
    }, SSE_HEARTBEAT_INTERVAL_MS);
  }

  /**
   * Load default OBS themes from database if not already set
   */
  private async loadDefaultThemes(): Promise<void> {
    try {
      // Load default songs theme if not set
      if (!this.currentState.songsTheme) {
        const defaultSongsTheme = await getDefaultOBSTheme('songs');
        if (defaultSongsTheme) {
          this.currentState.songsTheme = defaultSongsTheme;
        }
      }

      // Load default bible theme if not set
      if (!this.currentState.bibleTheme) {
        const defaultBibleTheme = await getDefaultOBSTheme('bible');
        if (defaultBibleTheme) {
          this.currentState.bibleTheme = defaultBibleTheme;
        }
      }

      // Load default prayer theme if not set
      if (!this.currentState.prayerTheme) {
        const defaultPrayerTheme = await getDefaultOBSTheme('prayer');
        if (defaultPrayerTheme) {
          this.currentState.prayerTheme = defaultPrayerTheme;
        }
      }
    } catch (error) {
      console.error('[OBSServer] Error loading default themes:', error);
    }
  }

  /**
   * Stop the OBS server
   */
  stop(): void {
    // Stop heartbeat interval
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.server) {
      // Close all SSE connections
      for (const client of this.clients) {
        try {
          client.end();
        } catch {
          // Ignore close errors
        }
      }
      this.clients.clear();

      // Remove all listeners to prevent accumulation
      this.server.removeAllListeners();
      this.server.close();
      this.server = null;
    }
  }

  /**
   * Get the server URL
   */
  getUrl(): string | null {
    if (!this.server) return null;
    return `http://localhost:${this.port}`;
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return this.server !== null;
  }

  /**
   * Update slide data and broadcast to all connected clients
   */
  updateSlide(data: any): void {
    if (data.isBlank) {
      this.currentState = {
        ...this.currentState,
        slideData: null,
        presentationSlide: undefined,
        isBlank: true,
        contentType: undefined
      };
    } else if (data.presentationSlide) {
      // Free-form presentation - pass through directly without theme manipulation
      this.currentState = {
        ...this.currentState,
        slideData: null,
        presentationSlide: data.presentationSlide,
        displayMode: data.displayMode || this.currentState.displayMode,
        isBlank: false,
        contentType: 'presentation'
      };
    } else if (data.slideData) {
      this.currentState = {
        ...this.currentState,
        slideData: data.slideData,
        presentationSlide: undefined,
        combinedSlides: data.combinedSlides || null,
        displayMode: data.displayMode || this.currentState.displayMode,
        isBlank: false,
        contentType: data.contentType || 'song'
      };
    }

    // Broadcast to all SSE clients
    this.broadcast();
  }

  /**
   * Update theme and broadcast to all connected clients
   */
  updateTheme(theme: any): void {
    // Store themes by type so we can use the appropriate one based on content
    if (theme.type === 'bible') {
      this.currentState = {
        ...this.currentState,
        bibleTheme: theme
      };
    } else if (theme.type === 'prayer' || theme.type === 'sermon') {
      this.currentState = {
        ...this.currentState,
        prayerTheme: theme
      };
    } else {
      // Songs theme (default)
      this.currentState = {
        ...this.currentState,
        songsTheme: theme
      };
    }
    // Broadcast to all SSE clients
    this.broadcast();
  }

  /**
   * Update tool data (countdown, clock, stopwatch, announcement, rotatingMessages) and broadcast
   */
  broadcastTool(toolData: any): void {
    if (toolData && toolData.active) {
      this.currentState = {
        ...this.currentState,
        toolsData: toolData
      };
    } else {
      // Tool was stopped - clear it from state
      this.currentState = {
        ...this.currentState,
        toolsData: null
      };
    }
    // Broadcast to all SSE clients
    this.broadcast();
  }

  /**
   * Handle incoming HTTP requests
   */
  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    // Enable CORS for OBS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = req.url || '/';

    if (url === '/events') {
      this.handleSSE(req, res);
    } else if (url === '/' || url.startsWith('/?')) {
      this.serveOverlayPage(req, res);
    } else if (url === '/state') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(this.currentState));
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  }

  /**
   * Handle Server-Sent Events connection
   */
  private handleSSE(req: http.IncomingMessage, res: http.ServerResponse): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    // Send current state immediately
    res.write(`data: ${JSON.stringify(this.currentState)}\n\n`);

    this.clients.add(res);

    // Track if cleanup has been called to prevent double execution
    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      this.clients.delete(res);
    };

    // Handle close and error events on both req and res to prevent client leaks
    req.on('close', cleanup);
    req.on('error', cleanup);
    res.on('close', cleanup);
    res.on('error', cleanup);
  }

  /**
   * Broadcast current state to all SSE clients
   */
  private broadcast(): void {
    const data = `data: ${JSON.stringify(this.currentState)}\n\n`;
    const deadClients: http.ServerResponse[] = [];

    for (const client of this.clients) {
      try {
        // Check if connection is still writable
        if (client.writableEnded || client.destroyed) {
          deadClients.push(client);
        } else {
          const success = client.write(data);
          if (!success) {
            // Buffer full, connection may be dead
            deadClients.push(client);
          }
        }
      } catch (error) {
        // Write failed, connection is dead
        deadClients.push(client);
      }
    }

    // Clean up dead clients
    for (const client of deadClients) {
      this.clients.delete(client);
      try {
        client.end();
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Serve the overlay HTML page
   */
  private serveOverlayPage(req: http.IncomingMessage, res: http.ServerResponse): void {
    // Parse URL parameters
    const url = new URL(req.url || '/', `http://localhost:${this.port}`);

    // Sanitize URL parameters to prevent injection attacks
    const sanitizeColor = (color: string | null): string => {
      if (!color) return 'white';
      // Only allow valid CSS color patterns (hex, rgb, rgba, named colors)
      const validColorPattern = /^(#[0-9A-Fa-f]{3,8}|rgb\(\d{1,3},\s*\d{1,3},\s*\d{1,3}\)|rgba\(\d{1,3},\s*\d{1,3},\s*\d{1,3},\s*[\d.]+\)|[a-zA-Z]+)$/;
      return validColorPattern.test(color) ? color : 'white';
    };

    const sanitizeNumber = (value: string | null, defaultVal: string): string => {
      if (!value) return defaultVal;
      const num = parseFloat(value);
      return !isNaN(num) && isFinite(num) ? String(num) : defaultVal;
    };

    const sanitizePosition = (pos: string | null): string => {
      const validPositions = ['top', 'center', 'bottom'];
      return pos && validPositions.includes(pos) ? pos : 'bottom';
    };

    const position = sanitizePosition(url.searchParams.get('position'));
    const fontSize = sanitizeNumber(url.searchParams.get('fontSize'), '100');
    const textColor = sanitizeColor(url.searchParams.get('color'));
    const showOriginal = url.searchParams.get('original') !== 'false';
    const showTransliteration = url.searchParams.get('transliteration') !== 'false';
    const showTranslation = url.searchParams.get('translation') !== 'false';
    const paddingBottom = sanitizeNumber(url.searchParams.get('paddingBottom'), '3');
    const paddingTop = sanitizeNumber(url.searchParams.get('paddingTop'), '5');
    const maxWidth = sanitizeNumber(url.searchParams.get('maxWidth'), '90');
    // New: useThemePositioning defaults to true for full theme support
    const useThemePositioning = url.searchParams.get('useThemePositioning') !== 'false';

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>SoluPresenter OBS Overlay</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100%;
      height: 100%;
      background: transparent !important;
      overflow: hidden;
      font-family: 'Heebo', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes fadeOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }

    /* Full-screen container for theme-based positioning */
    .theme-container {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      animation: fadeIn 0.3s ease-out forwards;
    }

    .theme-container.exiting {
      animation: fadeOut 0.3s ease-in forwards;
    }

    /* Background box styling */
    .bg-box {
      position: absolute;
    }

    /* Positioned text box */
    .text-box {
      position: absolute;
      display: flex;
      overflow: hidden;
    }

    .text-box .text-content {
      /* Width controlled by inline styles based on whether background is used */
    }

    .text-box .text-content.has-bg {
      display: inline-block;
      width: auto;
      max-width: 100%;
    }

    .text-box.rtl {
      direction: rtl;
      unicode-bidi: plaintext;
    }

    /* Legacy wrapper for fallback mode */
    .wrapper {
      position: fixed;
      left: 0;
      right: 0;
      display: flex;
      justify-content: center;
      pointer-events: none;
      ${position === 'top' ? `top: ${paddingTop}vh; bottom: auto; align-items: flex-start;` : ''}
      ${position === 'center' ? 'top: 0; bottom: 0; align-items: center;' : ''}
      ${position === 'bottom' ? `top: auto; bottom: ${paddingBottom}vh; align-items: flex-end;` : ''}
    }

    .container {
      width: ${maxWidth}%;
      max-width: 1600px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 1.5rem 2rem;
    }

    .slide {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0;
      width: 100%;
      animation: fadeIn 0.3s ease-out forwards;
    }

    .slide.exiting {
      animation: fadeOut 0.3s ease-in forwards;
    }

    .line {
      display: inline-block;
      font-size: calc(clamp(1rem, 2.7vw, 2.7rem) * ${parseInt(fontSize) / 100});
      line-height: 1.0;
      color: ${textColor};
      background: rgba(0,0,0,1);
      padding: 0.15em 0.6em;
      border-radius: 6px;
    }

    .line.original { font-weight: bold; }
    .line.rtl { direction: rtl; unicode-bidi: plaintext; }
  </style>
</head>
<body>
  <!-- Theme-based container (used when theme has linePositions) -->
  <div id="theme-slide" class="theme-container" style="display: none;"></div>

  <!-- Presentation container (used for free-form presentations) -->
  <div id="presentation-slide" class="theme-container" style="display: none;"></div>

  <!-- Legacy container (fallback when no theme positioning) -->
  <div class="wrapper">
    <div class="container">
      <div id="slide" class="slide" style="display: none;"></div>
    </div>
  </div>

  <script>
    // URL parameter fallback config
    const urlConfig = {
      showOriginal: ${showOriginal},
      showTransliteration: ${showTransliteration},
      showTranslation: ${showTranslation},
      fontSize: ${parseInt(fontSize)},
      textColor: '${textColor}',
      useThemePositioning: ${useThemePositioning}
    };

    const slideEl = document.getElementById('slide');
    const themeSlideEl = document.getElementById('theme-slide');
    const presentationSlideEl = document.getElementById('presentation-slide');
    let currentSlide = null;
    let currentTheme = null;
    let songsTheme = null;
    let bibleTheme = null;
    let prayerTheme = null;

    function isHebrew(text) {
      if (!text) return false;
      return /[\\u0590-\\u05FF\\u0600-\\u06FF]/.test(text);
    }

    // Check if theme has positioning data
    function hasThemePositioning(theme) {
      return theme && theme.linePositions && Object.keys(theme.linePositions).length > 0;
    }

    // Get position for a line type from theme
    function getLinePosition(lineType) {
      if (!currentTheme || !currentTheme.linePositions) return null;

      // For Bible themes, reference positions are stored separately
      // For Prayer themes, reference is in linePositions with flow settings
      const isBibleTheme = currentTheme.type === 'bible';

      if (isBibleTheme) {
        if (lineType === 'reference' && currentTheme.referencePosition) {
          return currentTheme.referencePosition;
        }
        if (lineType === 'referenceEnglish' && currentTheme.referenceEnglishPosition) {
          return currentTheme.referenceEnglishPosition;
        }
      }

      return currentTheme.linePositions[lineType] || null;
    }

    // Get style for a line type from theme or fallback to URL config
    function getLineStyle(lineType, contentType) {
      // Default style WITHOUT backgroundColor - theme must explicitly set it
      const defaultStyle = {
        fontSize: urlConfig.fontSize,
        fontWeight: lineType === 'original' || lineType === 'hebrew' ? '700' : '400',
        color: urlConfig.textColor,
        opacity: 1,
        visible: true
      };

      if (!currentTheme) {
        // Only for legacy mode (no theme), add default background
        return {
          ...defaultStyle,
          backgroundColor: 'rgba(0,0,0,1)',
          backgroundOpacity: 1,
          backgroundPadding: '0.15em 0.6em',
          borderRadius: 6
        };
      }

      // For Bible themes only, reference styling is in referenceStyle property
      // Prayer themes store reference styles in lineStyles
      const isBibleTheme = currentTheme.type === 'bible';
      if (isBibleTheme) {
        if (lineType === 'reference' && currentTheme.referenceStyle) {
          return { ...defaultStyle, ...currentTheme.referenceStyle };
        }
        if (lineType === 'referenceEnglish' && currentTheme.referenceEnglishStyle) {
          return { ...defaultStyle, ...currentTheme.referenceEnglishStyle };
        }
      }

      // Check lineStyles
      if (currentTheme.lineStyles) {
        const themeStyle = currentTheme.lineStyles[lineType];
        if (themeStyle) {
          return { ...defaultStyle, ...themeStyle };
        }
      }

      return defaultStyle;
    }

    // Texture patterns for background boxes (CSS/SVG) - grayscale for blending
    // Using single quotes inside url() to avoid conflict with HTML style attribute double quotes
    const texturePatterns = {
      none: { pattern: 'none', size: 'auto' },
      paper: {
        pattern: "url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27100%27 height=%27100%27%3E%3Crect width=%27100%27 height=%27100%27 fill=%27%23888%27/%3E%3Ccircle cx=%2720%27 cy=%2730%27 r=%273%27 fill=%27%23666%27/%3E%3Ccircle cx=%2770%27 cy=%2715%27 r=%272%27 fill=%27%23999%27/%3E%3Ccircle cx=%2745%27 cy=%2760%27 r=%274%27 fill=%27%23777%27/%3E%3Ccircle cx=%2710%27 cy=%2780%27 r=%272%27 fill=%27%23aaa%27/%3E%3Ccircle cx=%2785%27 cy=%2770%27 r=%273%27 fill=%27%23666%27/%3E%3Ccircle cx=%2730%27 cy=%2790%27 r=%272%27 fill=%27%23999%27/%3E%3Ccircle cx=%2760%27 cy=%2740%27 r=%272%27 fill=%27%23555%27/%3E%3Ccircle cx=%2790%27 cy=%2750%27 r=%273%27 fill=%27%23888%27/%3E%3Ccircle cx=%275%27 cy=%2745%27 r=%272%27 fill=%27%23777%27/%3E%3Ccircle cx=%2755%27 cy=%2785%27 r=%273%27 fill=%27%23666%27/%3E%3Ccircle cx=%2775%27 cy=%2735%27 r=%272%27 fill=%27%23aaa%27/%3E%3Ccircle cx=%2735%27 cy=%2710%27 r=%272%27 fill=%27%23999%27/%3E%3C/svg%3E')",
        size: '100px 100px'
      },
      parchment: {
        pattern: "url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2760%27 height=%2760%27%3E%3Crect width=%2760%27 height=%2760%27 fill=%27%23888%27/%3E%3Cpath d=%27M0 15 Q15 12 30 15 T60 15%27 stroke=%27%23666%27 stroke-width=%271%27 fill=%27none%27/%3E%3Cpath d=%27M0 35 Q15 38 30 35 T60 35%27 stroke=%27%23999%27 stroke-width=%270.8%27 fill=%27none%27/%3E%3Cpath d=%27M0 50 Q15 47 30 50 T60 50%27 stroke=%27%23777%27 stroke-width=%270.6%27 fill=%27none%27/%3E%3Ccircle cx=%2710%27 cy=%2710%27 r=%274%27 fill=%27%23777%27/%3E%3Ccircle cx=%2745%27 cy=%2725%27 r=%275%27 fill=%27%23999%27/%3E%3Ccircle cx=%2725%27 cy=%2745%27 r=%273%27 fill=%27%23666%27/%3E%3C/svg%3E')",
        size: '60px 60px'
      },
      linen: {
        pattern: "url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%278%27 height=%278%27%3E%3Crect width=%278%27 height=%278%27 fill=%27%23888%27/%3E%3Cpath d=%27M0 0L8 8M8 0L0 8%27 stroke=%27%23666%27 stroke-width=%271%27/%3E%3C/svg%3E')",
        size: '8px 8px'
      },
      canvas: {
        pattern: "url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27%3E%3Crect width=%2712%27 height=%2712%27 fill=%27%23888%27/%3E%3Crect x=%270%27 y=%270%27 width=%276%27 height=%276%27 fill=%27%23777%27/%3E%3Crect x=%276%27 y=%276%27 width=%276%27 height=%276%27 fill=%27%23777%27/%3E%3C/svg%3E')",
        size: '12px 12px'
      },
      noise: {
        pattern: "url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2740%27 height=%2740%27%3E%3Crect width=%2740%27 height=%2740%27 fill=%27%23808080%27/%3E%3Crect x=%272%27 y=%273%27 width=%272%27 height=%272%27 fill=%27%23606060%27/%3E%3Crect x=%2712%27 y=%277%27 width=%272%27 height=%272%27 fill=%27%23a0a0a0%27/%3E%3Crect x=%2725%27 y=%272%27 width=%272%27 height=%272%27 fill=%27%23707070%27/%3E%3Crect x=%2735%27 y=%2710%27 width=%272%27 height=%272%27 fill=%27%23909090%27/%3E%3Crect x=%278%27 y=%2718%27 width=%272%27 height=%272%27 fill=%27%23505050%27/%3E%3Crect x=%2720%27 y=%2715%27 width=%272%27 height=%272%27 fill=%27%23b0b0b0%27/%3E%3Crect x=%2732%27 y=%2722%27 width=%272%27 height=%272%27 fill=%27%23656565%27/%3E%3Crect x=%275%27 y=%2730%27 width=%272%27 height=%272%27 fill=%27%23959595%27/%3E%3Crect x=%2718%27 y=%2728%27 width=%272%27 height=%272%27 fill=%27%23757575%27/%3E%3Crect x=%2728%27 y=%2735%27 width=%272%27 height=%272%27 fill=%27%23858585%27/%3E%3Crect x=%2738%27 y=%2732%27 width=%272%27 height=%272%27 fill=%27%23555555%27/%3E%3Crect x=%2715%27 y=%2738%27 width=%272%27 height=%272%27 fill=%27%23a5a5a5%27/%3E%3C/svg%3E')",
        size: '40px 40px'
      }
    };

    // Render background boxes from theme
    function renderBackgroundBoxes() {
      if (!currentTheme || !currentTheme.backgroundBoxes) return '';

      return currentTheme.backgroundBoxes.map(box => {
        const style = [
          'left: ' + (box.x || 0) + '%',
          'top: ' + (box.y || 0) + '%',
          'width: ' + (box.width || 100) + '%',
          'height: ' + (box.height || 10) + '%',
          'background-color: ' + (box.color || '#000000'),
          'opacity: ' + (box.opacity !== undefined ? box.opacity : 0.7),
          'border-radius: ' + (box.borderRadius || 0) + 'px',
          'overflow: hidden'
        ].join('; ');

        // Add texture overlay if texture is specified
        let textureOverlay = '';
        if (box.texture && box.texture !== 'none' && texturePatterns[box.texture]) {
          const textureDef = texturePatterns[box.texture];
          const textureOpacity = box.textureOpacity !== undefined ? box.textureOpacity : 0.3;
          textureOverlay = '<div style="position: absolute; inset: 0; background-image: ' + textureDef.pattern + '; background-repeat: repeat; background-size: ' + textureDef.size + '; opacity: ' + textureOpacity + '; pointer-events: none;"></div>';
        }

        return '<div class="bg-box" style="' + style + '">' + textureOverlay + '</div>';
      }).join('');
    }

    // Calculate flow positions for all lines
    // Returns a map of lineType -> calculated Y position (in %)
    let flowPositions = {};

    // Store which elements are autoHeight for rendering
    let autoHeightElements = {};

    // Helper to get all line positions including reference positions
    function getAllLinePositions() {
      if (!currentTheme) return {};
      const positions = { ...(currentTheme.linePositions || {}) };
      // For Bible themes only, include reference positions stored separately
      // Prayer themes store reference in linePositions with flow settings
      const isBibleTheme = currentTheme.type === 'bible';
      if (isBibleTheme) {
        if (currentTheme.referencePosition) {
          positions.reference = currentTheme.referencePosition;
        }
        if (currentTheme.referenceEnglishPosition) {
          positions.referenceEnglish = currentTheme.referenceEnglishPosition;
        }
      }
      return positions;
    }

    function calculateFlowPositions() {
      flowPositions = {};
      autoHeightElements = {};
      if (!currentTheme || !currentTheme.lineOrder) return;

      const lineOrder = currentTheme.lineOrder;
      const linePositions = getAllLinePositions();

      // First pass: identify autoHeight elements
      Object.keys(linePositions).forEach(lineType => {
        const position = linePositions[lineType];
        if (position && position.autoHeight) {
          autoHeightElements[lineType] = true;
        }
      });

      lineOrder.forEach(lineType => {
        const position = linePositions[lineType];
        if (!position || position.positionMode !== 'flow') return;

        let calculatedY;

        if (!position.flowAnchor) {
          // No anchor - use stored Y as starting position
          calculatedY = position.y || 0;
        } else {
          const anchorPosition = linePositions[position.flowAnchor];
          if (anchorPosition) {
            // Get anchor's Y position (calculated if it's also flow, or stored)
            const anchorY = flowPositions[position.flowAnchor] !== undefined
              ? flowPositions[position.flowAnchor]
              : anchorPosition.y;

            if (position.flowBeside) {
              // Beside mode: use same Y position as anchor
              calculatedY = anchorY;
            } else {
              // Below mode: position below the anchor
              // Always use stored height for calculation (needed for individual rendering)
              const anchorHeight = anchorPosition.height || 10;
              // Calculate Y = anchor Y + anchor height + gap
              const gap = position.flowGap || 0;
              calculatedY = anchorY + anchorHeight + gap;
            }
          } else {
            // Anchor not found, use stored position
            calculatedY = position.y || 0;
          }
        }

        flowPositions[lineType] = calculatedY;
      });
    }

    // Build flow chains - groups of elements connected by flowAnchor (below mode only)
    // Elements in "beside" mode are NOT included in chains - they render independently
    function buildFlowChains() {
      const chains = [];
      const processed = new Set();

      if (!currentTheme || !currentTheme.lineOrder) return chains;

      const linePositions = getAllLinePositions();

      // Find chain roots (elements that are not following anyone, or following non-flow elements)
      currentTheme.lineOrder.forEach(lineType => {
        if (processed.has(lineType)) return;

        const position = linePositions[lineType];
        if (!position) return;

        // Skip elements in "beside" mode - they'll be rendered independently
        if (position.positionMode === 'flow' && position.flowBeside) {
          return;
        }

        // Check if this is a root of a chain (absolute positioned or flow with no anchor)
        const isRoot = position.positionMode !== 'flow' || !position.flowAnchor;

        if (isRoot) {
          // Build chain starting from this element
          const chain = [lineType];
          processed.add(lineType);

          // Find all elements that flow BELOW this one (not beside)
          let current = lineType;
          let foundNext = true;
          while (foundNext) {
            foundNext = false;
            for (const nextType of currentTheme.lineOrder) {
              if (processed.has(nextType)) continue;
              const nextPos = linePositions[nextType];
              // Only include elements in "below" mode (not beside)
              if (nextPos && nextPos.positionMode === 'flow' && nextPos.flowAnchor === current && !nextPos.flowBeside) {
                chain.push(nextType);
                processed.add(nextType);
                current = nextType;
                foundNext = true;
                break;
              }
            }
          }

          chains.push(chain);
        }
      });

      return chains;
    }

    // Render a flow chain as a flex container
    function renderFlowChain(chain, lineData, contentType, isBilingual, combinedSlides) {
      if (!chain || chain.length === 0) return '';

      const firstLineType = chain[0];
      const firstPosition = getLinePosition(firstLineType);
      if (!firstPosition) return '';

      // Check if any element in chain has content
      const hasContent = chain.some(lt => {
        const text = getTextForLineType(lt, lineData, isBilingual, combinedSlides);
        return text && text.length > 0;
      });
      if (!hasContent) return '';

      // Check if the first element grows upward
      const growsUp = firstPosition.autoHeight && firstPosition.growDirection === 'up';

      let html = '';

      if (growsUp && chain.length > 1) {
        // For grow-up with multiple elements:
        // 1. Render first element individually with bottom-anchoring
        // 2. Render remaining elements in a top-anchored container at Y + height

        const firstText = getTextForLineType(firstLineType, lineData, isBilingual, combinedSlides);
        if (firstText) {
          html += renderPositionedLine(firstLineType, firstText, contentType, combinedSlides, isBilingual);
        }

        // Render remaining elements in a separate container
        const remainingChain = chain.slice(1);
        if (remainingChain.length > 0) {
          const storedHeight = firstPosition.height || 10;
          const anchorY = (firstPosition.y || 0) + storedHeight;

          const containerStyles = [
            'position: absolute',
            'left: ' + (firstPosition.x || 0) + '%',
            'top: ' + anchorY + '%',
            'width: ' + (firstPosition.width || 100) + '%',
            'display: flex',
            'flex-direction: column'
          ];

          html += '<div style="' + containerStyles.join('; ') + '">';

          remainingChain.forEach((lineType, index) => {
            html += renderFlowChainElement(lineType, lineData, contentType, isBilingual, index, combinedSlides);
          });

          html += '</div>';
        }
      } else {
        // Normal case: single element or grow-down
        // Position the container at the first element's position
        const containerStyles = [
          'position: absolute',
          'left: ' + (firstPosition.x || 0) + '%',
          'top: ' + (firstPosition.y || 0) + '%',
          'width: ' + (firstPosition.width || 100) + '%',
          'display: flex',
          'flex-direction: column'
        ];

        html += '<div style="' + containerStyles.join('; ') + '">';

        // Render each element in the chain
        chain.forEach((lineType, index) => {
          html += renderFlowChainElement(lineType, lineData, contentType, isBilingual, index, combinedSlides);
        });

        html += '</div>';
      }

      return html;
    }

    // Helper to render a single element within a flow chain
    function renderFlowChainElement(lineType, lineData, contentType, isBilingual, index, combinedSlides) {
      const text = getTextForLineType(lineType, lineData, isBilingual, combinedSlides);
      if (!text) return '';

      const style = getLineStyle(lineType, contentType);
      if (style.visible === false) return '';

      const position = getLinePosition(lineType);
      if (!position) return '';

      const rtl = isHebrew(text) ? ' rtl' : '';
      const baseFontSize = (style.fontSize || 100) / 100;
      const fontSizeVh = baseFontSize * 5;

      // Alignment
      let textAlign = 'center';
      let alignSelf = 'center';
      if (position.alignH === 'left') {
        textAlign = 'left';
        alignSelf = 'flex-start';
      } else if (position.alignH === 'right') {
        textAlign = 'right';
        alignSelf = 'flex-end';
      }

      // Gap from flowGap - skip gap for the first element in the chain
      const gap = (index > 0 && position.flowGap) ? (position.flowGap + '%') : '0';

      const textStyles = [
        'font-size: ' + fontSizeVh + 'vh',
        'line-height: 1.1',
        'font-weight: ' + (style.fontWeight || '400'),
        'color: ' + (style.color || 'white'),
        'opacity: ' + (style.opacity !== undefined ? style.opacity : 1),
        'text-align: ' + textAlign,
        'align-self: ' + alignSelf,
        'margin-top: ' + gap,
        'width: 100%'
      ];

      // Add background color if specified
      if (style.backgroundColor) {
        const bgOpacity = style.backgroundOpacity !== undefined ? style.backgroundOpacity : 1;
        let bgColor = style.backgroundColor;
        if (bgColor.startsWith('#')) {
          const r = parseInt(bgColor.slice(1, 3), 16);
          const g = parseInt(bgColor.slice(3, 5), 16);
          const b = parseInt(bgColor.slice(5, 7), 16);
          bgColor = 'rgba(' + r + ',' + g + ',' + b + ',' + bgOpacity + ')';
        }
        textStyles.push('background-color: ' + bgColor);
        textStyles.push('padding: ' + (style.backgroundPadding || '0.15em 0.4em'));
        textStyles.push('border-radius: ' + (style.borderRadius || 4) + 'px');
        textStyles.push('width: fit-content');
      }

      const contentClass = style.backgroundColor ? 'text-content has-bg' : 'text-content';

      // Build the text content, including combined slides with <br> tags for original/hebrew
      let textContent = escapeHtml(text);
      if ((lineType === 'original' || lineType === 'hebrew') && !isBilingual && combinedSlides && combinedSlides.length > 1) {
        combinedSlides.slice(1).forEach(function(slide) {
          if (slide.originalText) {
            textContent += '<br>' + escapeHtml(slide.originalText);
          }
        });
      }

      return '<div class="' + contentClass + rtl + '" style="' + textStyles.join('; ') + '">' + textContent + '</div>';
    }

    // Helper to get text for a line type (returns just the main text, not combined)
    function getTextForLineType(lineType, data, isBilingual, combinedSlides) {
      switch (lineType) {
        case 'original':
        case 'hebrew':
          return data.originalText;
        case 'transliteration': return isBilingual ? data.transliteration : null;
        case 'translation': return isBilingual ? (data.translation + (data.translationOverflow ? ' ' + data.translationOverflow : '')) : null;
        case 'english': return isBilingual ? data.translation : null;
        case 'reference': return data.reference;
        case 'referenceEnglish': return isBilingual ? data.referenceEnglish : null;
        case 'title': return data.title;
        case 'titleTranslation': return isBilingual ? data.titleTranslation : null;
        case 'subtitle': return data.subtitle;
        case 'subtitleTranslation': return isBilingual ? data.subtitleTranslation : null;
        case 'description': return data.description;
        case 'descriptionTranslation': return isBilingual ? data.descriptionTranslation : null;
        case 'referenceTranslation': return isBilingual ? data.referenceTranslation : null;
        default: return null;
      }
    }

    // Render a positioned text box (theme-based)
    // For original/hebrew lines with combined slides, pass combinedSlides to render them with <br> tags
    function renderPositionedLine(lineType, text, contentType, combinedSlides, isBilingual) {
      if (!text) return '';

      const style = getLineStyle(lineType, contentType);
      if (style.visible === false) return '';

      const position = getLinePosition(lineType);
      if (!position) return ''; // Skip if no position defined

      const rtl = isHebrew(text) ? ' rtl' : '';

      // Calculate font size based on viewport
      const baseFontSize = (style.fontSize || 100) / 100;
      const fontSizeVh = baseFontSize * 5; // Scale factor for vh units

      // Horizontal alignment
      let justifyContent = 'center';
      let textAlign = 'center';
      if (position.alignH === 'left') {
        justifyContent = 'flex-start';
        textAlign = 'left';
      } else if (position.alignH === 'right') {
        justifyContent = 'flex-end';
        textAlign = 'right';
      }

      // Vertical alignment
      let alignItems = 'center';
      if (position.alignV === 'top') {
        alignItems = 'flex-start';
      } else if (position.alignV === 'bottom') {
        alignItems = 'flex-end';
      }

      // Use calculated Y for flow mode, otherwise use stored position
      const effectiveY = (position.positionMode === 'flow' && flowPositions[lineType] !== undefined)
        ? flowPositions[lineType]
        : (position.y || 0);

      // For autoHeight elements, use 'auto' height
      const isAutoHeight = position.autoHeight === true;
      const heightStyle = isAutoHeight ? 'auto' : (position.height || 20) + '%';

      // Check if element should grow upward
      const growsUp = isAutoHeight && position.growDirection === 'up';

      // Build position styles
      const positionStyles = [
        'left: ' + (position.x || 0) + '%',
        'width: ' + (position.width || 100) + '%',
        'height: ' + heightStyle,
        'justify-content: ' + justifyContent,
        'align-items: ' + alignItems,
        'padding-top: ' + (position.paddingTop || 0) + '%',
        'padding-bottom: ' + (position.paddingBottom || 0) + '%',
        'padding-left: ' + (position.paddingLeft || 0) + 'px',
        'padding-right: ' + (position.paddingRight || 0) + 'px'
      ];

      // For grow-up elements, use bottom positioning instead of top
      if (growsUp) {
        // Calculate bottom position: 100% - Y - Height
        // For autoHeight, we use the stored height as a reference point for where the bottom edge should be
        const storedHeight = position.height || 10;
        const bottomPosition = 100 - effectiveY - storedHeight;
        positionStyles.push('bottom: ' + bottomPosition + '%');
        positionStyles.push('top: auto');
      } else {
        positionStyles.push('top: ' + effectiveY + '%');
      }

      // Build text styles
      const textStyles = [
        'font-size: ' + fontSizeVh + 'vh',
        'line-height: 1.1',
        'font-weight: ' + (style.fontWeight || '400'),
        'color: ' + (style.color || 'white'),
        'opacity: ' + (style.opacity !== undefined ? style.opacity : 1),
        'text-align: ' + textAlign
      ];

      // Add background color if specified
      if (style.backgroundColor) {
        const bgOpacity = style.backgroundOpacity !== undefined ? style.backgroundOpacity : 1;
        // Convert hex to rgba if needed
        let bgColor = style.backgroundColor;
        if (bgColor.startsWith('#')) {
          const r = parseInt(bgColor.slice(1, 3), 16);
          const g = parseInt(bgColor.slice(3, 5), 16);
          const b = parseInt(bgColor.slice(5, 7), 16);
          bgColor = 'rgba(' + r + ',' + g + ',' + b + ',' + bgOpacity + ')';
        }
        textStyles.push('background-color: ' + bgColor);
        textStyles.push('padding: ' + (style.backgroundPadding || '0.15em 0.4em'));
        textStyles.push('border-radius: ' + (style.borderRadius || 4) + 'px');
      }

      // Add border styles for reference boxes
      if (style.borderBottom) {
        textStyles.push('border-bottom: ' + style.borderBottom + 'px solid ' + (style.color || 'white'));
      }
      if (style.borderLeft) {
        textStyles.push('border-left: ' + style.borderLeft + 'px solid ' + (style.color || 'white'));
      }
      if (style.borderRight) {
        textStyles.push('border-right: ' + style.borderRight + 'px solid ' + (style.color || 'white'));
      }
      if (style.borderRadius) {
        textStyles.push('border-radius: ' + style.borderRadius + 'px');
      }
      if (style.borderRadiusBottomLeft) {
        textStyles.push('border-bottom-left-radius: ' + style.borderRadiusBottomLeft + 'px');
      }
      if (style.borderRadiusBottomRight) {
        textStyles.push('border-bottom-right-radius: ' + style.borderRadiusBottomRight + 'px');
      }

      // Add has-bg class if background color is set
      const contentClass = style.backgroundColor ? 'text-content has-bg' : 'text-content';
      // Add width: 100% only when no background (so text fills the box for alignment)
      if (!style.backgroundColor) {
        textStyles.push('width: 100%');
      }

      // Build the text content, including combined slides with <br> tags for original/hebrew
      let textContent = escapeHtml(text);
      if ((lineType === 'original' || lineType === 'hebrew') && !isBilingual && combinedSlides && combinedSlides.length > 1) {
        combinedSlides.slice(1).forEach(function(slide) {
          if (slide.originalText) {
            textContent += '<br>' + escapeHtml(slide.originalText);
          }
        });
      }

      return '<div class="text-box' + rtl + '" style="' + positionStyles.join('; ') + '">' +
             '<div class="' + contentClass + '" style="' + textStyles.join('; ') + '">' + textContent + '</div>' +
             '</div>';
    }

    // Legacy render function (fallback)
    function renderLine(lineType, text, contentType) {
      if (!text) return '';

      const style = getLineStyle(lineType, contentType);
      if (style.visible === false) return '';

      const rtl = isHebrew(text) ? ' rtl' : '';
      const baseFontSize = 2.7; // vw base
      const fontSizeScale = (style.fontSize || 100) / 100;
      const fontSize = 'calc(clamp(1rem, ' + (baseFontSize * fontSizeScale) + 'vw, ' + (baseFontSize * fontSizeScale) + 'rem))';

      const bgColor = style.backgroundColor || 'rgba(0,0,0,1)';
      const bgOpacity = style.backgroundOpacity !== undefined ? style.backgroundOpacity : 1;
      const padding = style.backgroundPadding || '0.15em 0.6em';
      const borderRadius = style.borderRadius !== undefined ? style.borderRadius + 'px' : '6px';

      const inlineStyle = [
        'display: inline-block',
        'font-size: ' + fontSize,
        'line-height: 1.0',
        'font-weight: ' + (style.fontWeight || '400'),
        'color: ' + (style.color || 'white'),
        'opacity: ' + (style.opacity !== undefined ? style.opacity : 1),
        'background: ' + bgColor,
        'padding: ' + padding,
        'border-radius: ' + borderRadius
      ].join('; ');

      return '<div class="line' + rtl + '" style="' + inlineStyle + '">' + escapeHtml(text) + '</div>';
    }

    // Render a presentation text box
    function renderPresentationTextBox(textBox) {
      if (textBox.visible === false) return '';

      const bgOpacity = textBox.backgroundOpacity !== undefined ? textBox.backgroundOpacity : 1;
      let bgColor = textBox.backgroundColor || 'transparent';
      if (bgColor && bgColor.startsWith('#') && bgOpacity < 1) {
        const r = parseInt(bgColor.slice(1, 3), 16);
        const g = parseInt(bgColor.slice(3, 5), 16);
        const b = parseInt(bgColor.slice(5, 7), 16);
        bgColor = 'rgba(' + r + ',' + g + ',' + b + ',' + bgOpacity + ')';
      }

      const textDirection = textBox.textDirection || (isHebrew(textBox.text) ? 'rtl' : 'ltr');
      const justifyContent = textBox.textAlign === 'left' ? 'flex-start' : textBox.textAlign === 'right' ? 'flex-end' : 'center';
      const alignItems = textBox.verticalAlign === 'top' ? 'flex-start' : textBox.verticalAlign === 'bottom' ? 'flex-end' : 'center';

      const styles = [
        'position: absolute',
        'left: ' + (textBox.x || 0) + '%',
        'top: ' + (textBox.y || 0) + '%',
        'width: ' + (textBox.width || 10) + '%',
        'height: ' + (textBox.height || 10) + '%',
        'font-size: ' + (textBox.fontSize * 0.05) + 'vh',
        'color: ' + (textBox.color || 'white'),
        'background-color: ' + bgColor,
        'text-align: ' + (textBox.textAlign || 'center'),
        'display: flex',
        'justify-content: ' + justifyContent,
        'align-items: ' + alignItems,
        'font-weight: ' + (textBox.fontWeight || (textBox.bold ? '700' : '400')),
        'font-style: ' + (textBox.italic ? 'italic' : 'normal'),
        'text-decoration: ' + (textBox.underline ? 'underline' : 'none'),
        'opacity: ' + (textBox.opacity !== undefined ? textBox.opacity : 1),
        'z-index: ' + (textBox.zIndex || 1),
        'direction: ' + textDirection,
        'unicode-bidi: plaintext',
        'box-sizing: border-box',
        'overflow: hidden',
        'white-space: pre-wrap',
        'word-break: break-word'
      ];

      // Border properties
      if (textBox.borderTop) styles.push('border-top: ' + textBox.borderTop + 'px solid ' + (textBox.borderColor || 'white'));
      if (textBox.borderRight) styles.push('border-right: ' + textBox.borderRight + 'px solid ' + (textBox.borderColor || 'white'));
      if (textBox.borderBottom) styles.push('border-bottom: ' + textBox.borderBottom + 'px solid ' + (textBox.borderColor || 'white'));
      if (textBox.borderLeft) styles.push('border-left: ' + textBox.borderLeft + 'px solid ' + (textBox.borderColor || 'white'));

      // Border radius
      if (textBox.borderRadiusTopLeft) styles.push('border-top-left-radius: ' + textBox.borderRadiusTopLeft + 'px');
      if (textBox.borderRadiusTopRight) styles.push('border-top-right-radius: ' + textBox.borderRadiusTopRight + 'px');
      if (textBox.borderRadiusBottomRight) styles.push('border-bottom-right-radius: ' + textBox.borderRadiusBottomRight + 'px');
      if (textBox.borderRadiusBottomLeft) styles.push('border-bottom-left-radius: ' + textBox.borderRadiusBottomLeft + 'px');

      // Padding
      if (textBox.paddingTop) styles.push('padding-top: ' + textBox.paddingTop + 'px');
      if (textBox.paddingRight) styles.push('padding-right: ' + textBox.paddingRight + 'px');
      if (textBox.paddingBottom) styles.push('padding-bottom: ' + textBox.paddingBottom + 'px');
      if (textBox.paddingLeft) styles.push('padding-left: ' + textBox.paddingLeft + 'px');

      return '<div style="' + styles.join('; ') + '">' + escapeHtml(textBox.text || '') + '</div>';
    }

    // Escape string for use in HTML attributes
    function escapeAttribute(str) {
      if (!str) return '';
      return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // Render a presentation image box
    function renderPresentationImageBox(imageBox) {
      if (imageBox.visible === false) return '';

      const styles = [
        'position: absolute',
        'left: ' + (imageBox.x || 0) + '%',
        'top: ' + (imageBox.y || 0) + '%',
        'width: ' + (imageBox.width || 10) + '%',
        'height: ' + (imageBox.height || 10) + '%',
        'opacity: ' + (imageBox.opacity !== undefined ? imageBox.opacity : 1),
        'z-index: ' + (imageBox.zIndex || 0),
        'border-radius: ' + (imageBox.borderRadius || 0) + 'px',
        'overflow: hidden'
      ];

      const imgStyles = [
        'width: 100%',
        'height: 100%',
        'object-fit: ' + (imageBox.objectFit || 'contain')
      ];

      return '<div style="' + styles.join('; ') + '"><img src="' + escapeAttribute(imageBox.src || '') + '" style="' + imgStyles.join('; ') + '" /></div>';
    }

    // Render a presentation background box
    function renderPresentationBackgroundBox(bgBox) {
      if (bgBox.visible === false) return '';

      const styles = [
        'position: absolute',
        'left: ' + (bgBox.x || 0) + '%',
        'top: ' + (bgBox.y || 0) + '%',
        'width: ' + (bgBox.width || 10) + '%',
        'height: ' + (bgBox.height || 10) + '%',
        'background-color: ' + (bgBox.color || 'transparent'),
        'opacity: ' + (bgBox.opacity !== undefined ? bgBox.opacity : 1),
        'z-index: ' + (bgBox.zIndex || 0),
        'border-radius: ' + (bgBox.borderRadius || 0) + 'px',
        'overflow: hidden'
      ];

      return '<div style="' + styles.join('; ') + '"></div>';
    }

    // Get slide background style
    function getSlideBackgroundStyle(presentationSlide) {
      if (!presentationSlide) return 'transparent';
      const { backgroundType, backgroundColor, backgroundGradient } = presentationSlide;
      if (backgroundType === 'gradient' && backgroundGradient) return backgroundGradient;
      if (backgroundType === 'color' && backgroundColor) return backgroundColor;
      return 'transparent';
    }

    // Render a free-form presentation slide
    function renderPresentation(presentationSlide) {
      let html = '';

      // Background boxes first (lowest z-index)
      if (presentationSlide.backgroundBoxes) {
        presentationSlide.backgroundBoxes.forEach(function(box) {
          html += renderPresentationBackgroundBox(box);
        });
      }

      // Image boxes
      if (presentationSlide.imageBoxes) {
        presentationSlide.imageBoxes.forEach(function(box) {
          html += renderPresentationImageBox(box);
        });
      }

      // Text boxes last (highest z-index)
      if (presentationSlide.textBoxes) {
        presentationSlide.textBoxes.forEach(function(box) {
          html += renderPresentationTextBox(box);
        });
      }

      return html;
    }

    function renderSlide(state) {
      // Update themes if present (stored by type)
      if (state.songsTheme) {
        songsTheme = state.songsTheme;
      }
      if (state.bibleTheme) {
        bibleTheme = state.bibleTheme;
      }
      if (state.prayerTheme) {
        prayerTheme = state.prayerTheme;
      }

      // Handle blank state
      if (state.isBlank) {
        slideEl.style.display = 'none';
        themeSlideEl.style.display = 'none';
        presentationSlideEl.style.display = 'none';
        currentSlide = null;
        return;
      }

      // Handle free-form presentations
      if (state.presentationSlide) {
        slideEl.style.display = 'none';
        themeSlideEl.style.display = 'none';

        const html = renderPresentation(state.presentationSlide);
        const bgStyle = getSlideBackgroundStyle(state.presentationSlide);

        presentationSlideEl.style.background = bgStyle;
        presentationSlideEl.innerHTML = html;
        presentationSlideEl.style.display = 'block';
        presentationSlideEl.classList.remove('exiting');
        currentSlide = state.presentationSlide;
        return;
      }

      // Hide presentation container when showing themed content
      presentationSlideEl.style.display = 'none';

      if (!state.slideData) {
        slideEl.style.display = 'none';
        themeSlideEl.style.display = 'none';
        currentSlide = null;
        return;
      }

      const data = state.slideData;
      const isBilingual = state.displayMode === 'bilingual';
      // Use contentType from state (sent from ControlPanel)
      const contentType = state.contentType || 'song';

      // Select the appropriate theme based on content type
      if (contentType === 'bible') {
        currentTheme = bibleTheme;
      } else if (contentType === 'prayer' || contentType === 'sermon') {
        currentTheme = prayerTheme;
      } else {
        currentTheme = songsTheme;
      }

      // Calculate flow positions for this theme
      calculateFlowPositions();

      // Check if we should use theme-based positioning
      const useTheme = urlConfig.useThemePositioning && hasThemePositioning(currentTheme);

      if (useTheme) {
        // Theme-based rendering
        let html = renderBackgroundBoxes();

        // Check if theme has any "beside" elements - if so, render all individually
        const allPositions = getAllLinePositions();
        const hasBesideElements = Object.values(allPositions).some(function(pos) {
          return pos && pos.positionMode === 'flow' && pos.flowBeside === true;
        });

        if (hasBesideElements) {
          // Render all elements individually using calculated flow positions
          // This handles complex layouts with "beside" elements correctly
          const allLineTypes = contentType === 'bible'
            ? ['hebrew', 'english', 'reference', 'referenceEnglish']
            : (contentType === 'prayer' || contentType === 'sermon')
            ? ['title', 'titleTranslation', 'subtitle', 'subtitleTranslation', 'description', 'descriptionTranslation', 'reference', 'referenceTranslation']
            : ['original', 'transliteration', 'translation'];

          allLineTypes.forEach(lineType => {
            const text = getTextForLineType(lineType, data, isBilingual, state.combinedSlides);
            if (text) {
              const pos = allPositions[lineType];
              html += renderPositionedLine(lineType, text, contentType, state.combinedSlides, isBilingual);
            }
          });
        } else {
          // No beside elements - use flow chain rendering for better auto-height handling
          const chains = buildFlowChains();
          const renderedElements = new Set();

          // Render each chain
          chains.forEach(chain => {
            const hasFlowElement = chain.some(lt => {
              const pos = allPositions[lt];
              return pos && pos.positionMode === 'flow';
            });

            if (hasFlowElement && chain.length > 1) {
              // Render as flex chain
              html += renderFlowChain(chain, data, contentType, isBilingual, state.combinedSlides);
              chain.forEach(lt => renderedElements.add(lt));
            } else {
              // Render each element individually with absolute positioning
              chain.forEach(lineType => {
                const text = getTextForLineType(lineType, data, isBilingual, state.combinedSlides);
                if (text) {
                  html += renderPositionedLine(lineType, text, contentType, state.combinedSlides, isBilingual);
                  renderedElements.add(lineType);
                }
              });
            }
          });

          // Render any remaining elements not in chains (fallback)
          const allLineTypes = contentType === 'bible'
            ? ['hebrew', 'english', 'reference', 'referenceEnglish']
            : (contentType === 'prayer' || contentType === 'sermon')
            ? ['title', 'titleTranslation', 'subtitle', 'subtitleTranslation', 'description', 'descriptionTranslation', 'reference', 'referenceTranslation']
            : ['original', 'transliteration', 'translation'];

          allLineTypes.forEach(lineType => {
            if (renderedElements.has(lineType)) return;
            const text = getTextForLineType(lineType, data, isBilingual, state.combinedSlides);
            if (text) {
              html += renderPositionedLine(lineType, text, contentType, state.combinedSlides, isBilingual);
            }
          });
        }

        if (html) {
          slideEl.style.display = 'none';
          themeSlideEl.innerHTML = html;
          themeSlideEl.style.display = 'block';
          themeSlideEl.classList.remove('exiting');
        } else {
          themeSlideEl.style.display = 'none';
          slideEl.style.display = 'none';
        }
      } else {
        // Legacy rendering (fallback)
        let html = '';

        if (contentType === 'prayer' || contentType === 'sermon') {
          if (data.title) html += renderLine('title', data.title, contentType);
          if (isBilingual && data.titleTranslation) html += renderLine('titleTranslation', data.titleTranslation, contentType);
          if (data.subtitle) html += renderLine('subtitle', data.subtitle, contentType);
          if (isBilingual && data.subtitleTranslation) html += renderLine('subtitleTranslation', data.subtitleTranslation, contentType);
          if (data.description) html += renderLine('description', data.description, contentType);
          if (isBilingual && data.descriptionTranslation) html += renderLine('descriptionTranslation', data.descriptionTranslation, contentType);
          if (data.reference) html += renderLine('reference', data.reference, contentType);
          if (isBilingual && data.referenceTranslation) html += renderLine('referenceTranslation', data.referenceTranslation, contentType);
        } else if (contentType === 'bible') {
          if (data.originalText) html += renderLine('hebrew', data.originalText, contentType);
          if (isBilingual && data.translation) html += renderLine('english', data.translation, contentType);
          if (data.reference) html += renderLine('reference', data.reference, contentType);
          if (isBilingual && data.referenceEnglish) html += renderLine('referenceEnglish', data.referenceEnglish, contentType);
        } else {
          if (urlConfig.showOriginal && data.originalText) {
            html += renderLine('original', data.originalText, contentType);
            // Show combined slides in original mode (skip first slide - already rendered above)
            if (!isBilingual && state.combinedSlides && state.combinedSlides.length > 1) {
              state.combinedSlides.slice(1).forEach(function(slide) {
                if (slide.originalText) {
                  html += renderLine('original', slide.originalText, contentType);
                }
              });
            }
          }
          if (isBilingual && urlConfig.showTransliteration && data.transliteration) {
            html += renderLine('transliteration', data.transliteration, contentType);
          }
          if (isBilingual && urlConfig.showTranslation && data.translation) {
            let text = data.translation;
            if (data.translationOverflow) text += ' ' + data.translationOverflow;
            html += renderLine('translation', text, contentType);
          }
        }

        if (html) {
          themeSlideEl.style.display = 'none';
          slideEl.innerHTML = html;
          slideEl.style.display = 'flex';
          slideEl.classList.remove('exiting');
        } else {
          slideEl.style.display = 'none';
          themeSlideEl.style.display = 'none';
        }
      }

      currentSlide = data;
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // Connect to SSE
    let currentEventSource = null;

    function connect() {
      // Close existing connection if any
      if (currentEventSource) {
        currentEventSource.close();
      }

      const evtSource = new EventSource('/events');
      currentEventSource = evtSource;

      evtSource.onmessage = (event) => {
        try {
          const state = JSON.parse(event.data);
          renderSlide(state);
        } catch (e) {
          console.error('Failed to parse SSE data:', e);
        }
      };

      evtSource.onerror = () => {
        evtSource.close();
        currentEventSource = null;
        setTimeout(connect, 2000);
      };
    }

    // Cleanup on page unload to prevent memory leaks
    window.addEventListener('beforeunload', () => {
      if (currentEventSource) {
        currentEventSource.close();
        currentEventSource = null;
      }
    });

    connect();
  </script>
</body>
</html>`;

    res.writeHead(200, {
      'Content-Type': 'text/html',
      'Content-Security-Policy': "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'"
    });
    res.end(html);
  }
}

// Export singleton instance
export const obsServer = new OBSServer();
