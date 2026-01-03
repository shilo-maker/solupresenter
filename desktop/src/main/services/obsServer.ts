import * as http from 'http';
import { EventEmitter } from 'events';

const DEFAULT_PORT = 45678;

interface SlideData {
  originalText?: string;
  transliteration?: string;
  translation?: string;
  translationOverflow?: string;
}

interface OBSState {
  slideData: SlideData | null;
  displayMode: string;
  isBlank: boolean;
  theme?: any;
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

  /**
   * Start the OBS server
   */
  start(port: number = DEFAULT_PORT): Promise<number> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        console.log('[OBSServer] Server already running on port', this.port);
        resolve(this.port);
        return;
      }

      this.port = port;
      this.server = http.createServer((req, res) => this.handleRequest(req, res));

      this.server.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          console.log(`[OBSServer] Port ${port} in use, trying ${port + 1}`);
          this.server?.close();
          this.server = null;
          this.start(port + 1).then(resolve).catch(reject);
        } else {
          reject(err);
        }
      });

      this.server.listen(port, '127.0.0.1', () => {
        console.log(`[OBSServer] Started on http://localhost:${port}`);
        this.port = port;
        resolve(port);
      });
    });
  }

  /**
   * Stop the OBS server
   */
  stop(): void {
    if (this.server) {
      // Close all SSE connections
      for (const client of this.clients) {
        client.end();
      }
      this.clients.clear();

      this.server.close();
      this.server = null;
      console.log('[OBSServer] Stopped');
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
        isBlank: true
      };
    } else if (data.slideData) {
      this.currentState = {
        ...this.currentState,
        slideData: data.slideData,
        displayMode: data.displayMode || this.currentState.displayMode,
        isBlank: false
      };
    }

    // Broadcast to all SSE clients
    this.broadcast();
  }

  /**
   * Update theme and broadcast to all connected clients
   */
  updateTheme(theme: any): void {
    this.currentState = {
      ...this.currentState,
      theme
    };
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
    console.log(`[OBSServer] SSE client connected (${this.clients.size} total)`);

    req.on('close', () => {
      this.clients.delete(res);
      console.log(`[OBSServer] SSE client disconnected (${this.clients.size} total)`);
    });
  }

  /**
   * Broadcast current state to all SSE clients
   */
  private broadcast(): void {
    const data = `data: ${JSON.stringify(this.currentState)}\n\n`;
    for (const client of this.clients) {
      client.write(data);
    }
  }

  /**
   * Serve the overlay HTML page
   */
  private serveOverlayPage(req: http.IncomingMessage, res: http.ServerResponse): void {
    // Parse URL parameters
    const url = new URL(req.url || '/', `http://localhost:${this.port}`);
    const position = url.searchParams.get('position') || 'bottom';
    const fontSize = url.searchParams.get('fontSize') || '100';
    const textColor = url.searchParams.get('color') || 'white';
    const showOriginal = url.searchParams.get('original') !== 'false';
    const showTransliteration = url.searchParams.get('transliteration') !== 'false';
    const showTranslation = url.searchParams.get('translation') !== 'false';
    const paddingBottom = url.searchParams.get('paddingBottom') || '3';
    const paddingTop = url.searchParams.get('paddingTop') || '5';
    const maxWidth = url.searchParams.get('maxWidth') || '90';

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
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }

    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes fadeOut {
      from { opacity: 1; transform: translateY(0); }
      to { opacity: 0; transform: translateY(-10px); }
    }

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
      animation: fadeInUp 0.4s ease-out forwards;
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
  <div class="wrapper">
    <div class="container">
      <div id="slide" class="slide" style="display: none;"></div>
    </div>
  </div>

  <script>
    const config = {
      showOriginal: ${showOriginal},
      showTransliteration: ${showTransliteration},
      showTranslation: ${showTranslation}
    };

    const slideEl = document.getElementById('slide');
    let currentSlide = null;

    function isHebrew(text) {
      if (!text) return false;
      return /[\\u0590-\\u05FF\\u0600-\\u06FF]/.test(text);
    }

    function renderSlide(state) {
      if (state.isBlank || !state.slideData) {
        slideEl.style.display = 'none';
        currentSlide = null;
        return;
      }

      const data = state.slideData;
      const isBilingual = state.displayMode === 'bilingual';

      let html = '';

      if (config.showOriginal && data.originalText) {
        const rtl = isHebrew(data.originalText) ? ' rtl' : '';
        html += '<div class="line original' + rtl + '">' + escapeHtml(data.originalText) + '</div>';
      }

      if (isBilingual && config.showTransliteration && data.transliteration) {
        const rtl = isHebrew(data.transliteration) ? ' rtl' : '';
        html += '<div class="line' + rtl + '">' + escapeHtml(data.transliteration) + '</div>';
      }

      if (isBilingual && config.showTranslation && data.translation) {
        const rtl = isHebrew(data.translation) ? ' rtl' : '';
        let text = escapeHtml(data.translation);
        if (data.translationOverflow) {
          text += ' ' + escapeHtml(data.translationOverflow);
        }
        html += '<div class="line' + rtl + '">' + text + '</div>';
      }

      if (html) {
        slideEl.innerHTML = html;
        slideEl.style.display = 'flex';
        slideEl.classList.remove('exiting');
      } else {
        slideEl.style.display = 'none';
      }

      currentSlide = data;
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // Connect to SSE
    function connect() {
      const evtSource = new EventSource('/events');

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
        setTimeout(connect, 2000);
      };
    }

    connect();
  </script>
</body>
</html>`;

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  }
}

// Export singleton instance
export const obsServer = new OBSServer();
