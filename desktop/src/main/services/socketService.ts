import { io, Socket } from 'socket.io-client';
import { BrowserWindow } from 'electron';
import axios from 'axios';

// Configure axios defaults
const AXIOS_TIMEOUT = 15000; // 15 seconds

export interface OnlineStatus {
  connected: boolean;
  roomPin?: string;
  roomId?: string;
  viewerCount: number;
  serverUrl?: string;
}

export class SocketService {
  private socket: Socket | null = null;
  private status: OnlineStatus = {
    connected: false,
    viewerCount: 0
  };
  private controlWindow: BrowserWindow | null = null;
  private token: string | null = null;
  private userId: string | null = null;
  private connectionTimeoutId: NodeJS.Timeout | null = null;
  private roomJoinTimeoutId: NodeJS.Timeout | null = null;
  private axiosAbortController: AbortController | null = null;

  // Track last broadcast state for reconnection recovery
  private lastSlideData: any = null;
  private lastTheme: any = null;
  private lastBibleTheme: any = null;
  private lastPrayerTheme: any = null;
  private lastBackground: string | null = null;
  private lastYoutubeState: { videoId: string; title: string; currentTime: number; isPlaying: boolean } | null = null;
  private lastToolData: any = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;

  // Rate limiting for broadcasts
  private lastBroadcastTime: { [key: string]: number } = {};
  private minBroadcastIntervalMs: number = 50; // Minimum 50ms between broadcasts of same type

  /**
   * Connect to the online server
   */
  async connect(serverUrl: string, token: string, userId?: string): Promise<boolean> {
    // Disconnect existing socket first to prevent listener stacking
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    // Clear any existing connection timeout
    if (this.connectionTimeoutId) {
      clearTimeout(this.connectionTimeoutId);
      this.connectionTimeoutId = null;
    }

    this.token = token;
    this.userId = userId || null;

    return new Promise((resolve) => {
      try {
        this.socket = io(serverUrl, {
          transports: ['websocket'],
          auth: { token },
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 1000
        });

        this.socket.on('connect', () => {
          // Clear timeout on successful connection
          if (this.connectionTimeoutId) {
            clearTimeout(this.connectionTimeoutId);
            this.connectionTimeoutId = null;
          }
          this.status.connected = true;
          this.status.serverUrl = serverUrl;
          this.reconnectAttempts = 0; // Reset reconnect attempts on success

          // Restore state on reconnection if we had a room
          if (this.status.roomId && this.status.roomPin) {
            this.restoreStateOnReconnect();
          }

          this.notifyStatusChange();
          resolve(true);
        });

        this.socket.on('disconnect', () => {
          this.status.connected = false;
          this.status.roomPin = undefined;
          this.status.roomId = undefined;
          this.status.viewerCount = 0;
          this.notifyStatusChange();
        });

        this.socket.on('connect_error', (error) => {
          console.error('Connection error:', error);
          // Clear timeout on error
          if (this.connectionTimeoutId) {
            clearTimeout(this.connectionTimeoutId);
            this.connectionTimeoutId = null;
          }
          resolve(false);
        });

        // Handle room events
        this.socket.on('operator:joined', (data: { roomPin: string }) => {
          this.status.roomPin = data.roomPin;
          this.notifyStatusChange();
        });

        this.socket.on('room:viewerCount', (data: { count: number }) => {
          this.status.viewerCount = data.count;
          this.notifyViewerCount(data.count);
        });

        // MIDI bridge commands — relay to control window via existing remote:command IPC
        this.socket.on('midi:command', (data: { command: any }) => {
          if (data?.command && this.controlWindow && !this.controlWindow.isDestroyed()) {
            this.controlWindow.webContents.send('remote:command', data.command);
          }
        });

        // Timeout after 10 seconds
        this.connectionTimeoutId = setTimeout(() => {
          if (!this.status.connected) {
            this.disconnect();
            resolve(false);
          }
          this.connectionTimeoutId = null;
        }, 10000);
      } catch (error) {
        console.error('Failed to connect:', error);
        resolve(false);
      }
    });
  }

  /**
   * Disconnect from the server
   */
  disconnect(): void {
    // Clear any pending timeouts
    if (this.connectionTimeoutId) {
      clearTimeout(this.connectionTimeoutId);
      this.connectionTimeoutId = null;
    }
    if (this.roomJoinTimeoutId) {
      clearTimeout(this.roomJoinTimeoutId);
      this.roomJoinTimeoutId = null;
    }
    // Abort any pending axios requests
    if (this.axiosAbortController) {
      this.axiosAbortController.abort();
      this.axiosAbortController = null;
    }
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.status = {
      connected: false,
      viewerCount: 0
    };
    // Clear cached state to prevent memory leaks
    this.clearCachedState();
    this.reconnectAttempts = 0;
    this.lastBroadcastTime = {};
    this.notifyStatusChange();
  }

  /**
   * Create a new room on the server via REST API and join via socket
   */
  async createRoom(publicRoomId?: string): Promise<{ roomPin: string; roomId: string } | null> {
    if (!this.socket || !this.status.connected || !this.token || !this.status.serverUrl) {
      console.error('Cannot create room: not connected or missing credentials');
      return null;
    }

    try {
      // Step 1: Create room via REST API
      // Create abort controller for this request
      this.axiosAbortController = new AbortController();
      const response = await axios.post(
        `${this.status.serverUrl}/api/rooms/create`,
        { publicRoomId },
        {
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          },
          timeout: AXIOS_TIMEOUT,
          signal: this.axiosAbortController.signal
        }
      );

      const room = response.data.room;
      if (!room || !room.id || !room.pin) {
        console.error('Invalid room response:', response.data);
        return null;
      }

      this.status.roomId = room.id;
      this.status.roomPin = room.pin;

      // Step 2: Join room via socket
      return new Promise((resolve) => {
        this.socket!.emit('operator:join', {
          userId: this.userId,
          roomId: room.id
        });

        // Wait for operator:joined event (already handled in connect)
        // Just resolve with the room info
        // Clear any existing timeout to prevent memory leaks
        if (this.roomJoinTimeoutId) {
          clearTimeout(this.roomJoinTimeoutId);
        }
        this.roomJoinTimeoutId = setTimeout(() => {
          this.roomJoinTimeoutId = null;
          this.notifyStatusChange();
          resolve({ roomPin: room.pin, roomId: room.id });
        }, 500);
      });
    } catch (error: any) {
      console.error('Failed to create room:', error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Get public rooms for the current user
   */
  async getPublicRooms(): Promise<any[]> {
    if (!this.token || !this.status.serverUrl) {
      return [];
    }

    try {
      const url = `${this.status.serverUrl}/api/public-rooms/my-rooms`;

      this.axiosAbortController = new AbortController();
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${this.token}`
        },
        timeout: AXIOS_TIMEOUT,
        signal: this.axiosAbortController.signal
      });

      // API returns { publicRooms: [...] }
      return response.data?.publicRooms || response.data || [];
    } catch (error: any) {
      console.error('Failed to get public rooms:', error.response?.data || error.message);
      return [];
    }
  }

  /**
   * Switch to a public room (link the current room to a public room)
   */
  async switchToPublicRoom(publicRoomId: string | null): Promise<boolean> {
    if (!this.status.roomId || !this.token || !this.status.serverUrl) {
      return false;
    }

    try {
      this.axiosAbortController = new AbortController();
      if (publicRoomId) {
        await axios.post(
          `${this.status.serverUrl}/api/rooms/${this.status.roomId}/link-public-room`,
          { publicRoomId },
          {
            headers: {
              'Authorization': `Bearer ${this.token}`,
              'Content-Type': 'application/json'
            },
            timeout: AXIOS_TIMEOUT,
            signal: this.axiosAbortController.signal
          }
        );
      } else {
        // Unlink from public room (go back to private)
        await axios.post(
          `${this.status.serverUrl}/api/rooms/${this.status.roomId}/unlink-public-room`,
          {},
          {
            headers: {
              'Authorization': `Bearer ${this.token}`,
              'Content-Type': 'application/json'
            },
            timeout: AXIOS_TIMEOUT,
            signal: this.axiosAbortController.signal
          }
        );
      }
      return true;
    } catch (error: any) {
      console.error('Failed to switch room:', error.response?.data || error.message);
      return false;
    }
  }

  /**
   * Create or get a public room by name (for virtual displays)
   */
  async createPublicRoom(name: string): Promise<{ id: string; name: string; slug: string } | null> {
    if (!this.token || !this.status.serverUrl) {
      return null;
    }

    try {
      this.axiosAbortController = new AbortController();
      const response = await axios.post(
        `${this.status.serverUrl}/api/public-rooms/create-or-get`,
        { name },
        {
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          },
          timeout: AXIOS_TIMEOUT,
          signal: this.axiosAbortController.signal
        }
      );

      return response.data?.publicRoom || null;
    } catch (error: any) {
      console.error('Failed to create public room:', error.response?.data || error.message);
      throw new Error(error.response?.data?.error || 'Failed to create public room');
    }
  }

  /**
   * Link a public room to the current active room
   */
  async linkPublicRoom(publicRoomId: string): Promise<boolean> {
    if (!this.status.roomId || !this.token || !this.status.serverUrl) {
      return false;
    }

    try {
      this.axiosAbortController = new AbortController();
      await axios.post(
        `${this.status.serverUrl}/api/rooms/${this.status.roomId}/link-public-room`,
        { publicRoomId },
        {
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          },
          timeout: AXIOS_TIMEOUT,
          signal: this.axiosAbortController.signal
        }
      );
      return true;
    } catch (error: any) {
      console.error('Failed to link public room:', error.response?.data || error.message);
      return false;
    }
  }

  /**
   * Unlink a public room from the current active room
   */
  async unlinkPublicRoom(publicRoomId: string): Promise<boolean> {
    if (!this.status.roomId || !this.token || !this.status.serverUrl) {
      return false;
    }

    try {
      this.axiosAbortController = new AbortController();
      await axios.post(
        `${this.status.serverUrl}/api/rooms/${this.status.roomId}/unlink-public-room`,
        { publicRoomId },
        {
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          },
          timeout: AXIOS_TIMEOUT,
          signal: this.axiosAbortController.signal
        }
      );
      return true;
    } catch (error: any) {
      console.error('Failed to unlink public room:', error.response?.data || error.message);
      return false;
    }
  }

  /**
   * Get current connection status
   */
  getStatus(): OnlineStatus {
    return { ...this.status };
  }

  /**
   * Get viewer count
   */
  getViewerCount(): number {
    return this.status.viewerCount;
  }

  /**
   * Broadcast slide to online viewers
   */
  broadcastSlide(slideData: any): void {
    // Validate input
    if (!slideData || typeof slideData !== 'object') {
      console.error('[SocketService] broadcastSlide: invalid slideData');
      return;
    }
    // Cache for reconnection recovery
    this.lastSlideData = slideData;

    // Rate limit slide broadcasts
    if (!this.checkRateLimit('slide')) {
      return;
    }

    if (this.socket && this.status.connected && this.status.roomPin) {
      // Transform data to match backend expected format
      const transformedData: any = {
        roomPin: this.status.roomPin,
        roomId: this.status.roomId,
        songId: slideData.songId,
        slideIndex: slideData.slideIndex || 0,
        displayMode: slideData.displayMode || 'bilingual',
        isBlank: slideData.isBlank || false,
        imageUrl: slideData.imageUrl || null,
        toolsData: slideData.toolsData || null,
        presentationData: slideData.presentationData || null,
        backgroundImage: slideData.backgroundImage || null
      };

      // Transform slideData to backend format if present
      if (slideData.slideData && !slideData.isBlank) {
        transformedData.slideData = {
          slide: slideData.slideData,
          title: slideData.songTitle || slideData.slideData.title || '',
          isBible: slideData.isBible || slideData.contentType === 'bible' || false,
          isPrayer: slideData.contentType === 'prayer' || slideData.contentType === 'sermon' || false,
          originalLanguage: slideData.originalLanguage || 'he',
          combinedSlides: slideData.combinedSlides || null
        };
      }

      // Transform nextSlideData if present (for stage monitors)
      if (slideData.nextSlideData) {
        transformedData.nextSlideData = {
          slide: slideData.nextSlideData,
          title: slideData.songTitle || ''
        };
      }

      this.socket.emit('operator:updateSlide', transformedData);
    }
  }

  /**
   * Broadcast rendered HTML to online viewers (sent separately from slide data)
   */
  broadcastRenderedHtml(html: string, refWidth: number, refHeight: number): void {
    if (this.socket && this.status.connected && this.status.roomPin) {
      this.socket.emit('operator:renderedHtml', {
        roomPin: this.status.roomPin,
        renderedHtml: html,
        renderedHtmlDimensions: { width: refWidth, height: refHeight }
      });
    }
  }

  /**
   * Broadcast theme to online viewers
   */
  broadcastTheme(theme: any): void {
    // Cache for reconnection recovery
    this.lastTheme = theme;
    if (this.socket && this.status.connected && this.status.roomPin) {
      this.socket.emit('operator:applyTheme', {
        roomPin: this.status.roomPin,
        theme
      });
    }
  }

  /**
   * Broadcast Bible theme to online viewers
   */
  broadcastBibleTheme(theme: any): void {
    this.lastBibleTheme = theme;
    if (this.socket && this.status.connected && this.status.roomPin) {
      this.socket.emit('operator:applyBibleTheme', {
        roomPin: this.status.roomPin,
        theme
      });
    }
  }

  /**
   * Broadcast Prayer theme to online viewers
   */
  broadcastPrayerTheme(theme: any): void {
    this.lastPrayerTheme = theme;
    if (this.socket && this.status.connected && this.status.roomPin) {
      this.socket.emit('operator:applyPrayerTheme', {
        roomPin: this.status.roomPin,
        theme
      });
    }
  }

  /**
   * Broadcast background to online viewers
   */
  broadcastBackground(backgroundImage: string): void {
    // Cache for reconnection recovery
    this.lastBackground = backgroundImage;
    if (this.socket && this.status.connected && this.status.roomId) {
      this.socket.emit('operator:updateBackground', {
        roomId: this.status.roomId,
        backgroundImage
      });
    }
  }

  /**
   * Broadcast tool data (countdown, announcement, clock, stopwatch, rotatingMessages) to online viewers
   */
  broadcastTool(toolData: any): void {
    // Validate input
    if (!toolData || typeof toolData !== 'object') {
      console.error('[SocketService] broadcastTool: invalid toolData');
      return;
    }

    // Validate tool type
    const validToolTypes = ['countdown', 'announcement', 'rotatingMessages', 'clock', 'stopwatch'];
    if (!toolData.type || typeof toolData.type !== 'string' || !validToolTypes.includes(toolData.type)) {
      console.error('[SocketService] broadcastTool: invalid tool type:', toolData.type);
      return;
    }

    // Cache tool data for reconnection recovery
    if (toolData.active) {
      this.lastToolData = toolData;
    } else {
      this.lastToolData = null;
    }

    if (this.socket && this.status.connected && this.status.roomPin) {
      try {
        this.socket.emit('operator:updateTool', {
          roomPin: this.status.roomPin,
          toolData
        });
      } catch (error) {
        console.error('[SocketService] broadcastTool error:', error);
      }
    }
  }

  /**
   * Broadcast setlist summary to MIDI bridges in the room
   */
  broadcastSetlistSummary(setlist: Array<{ id: string; type: string; title: string }>): void {
    if (this.socket && this.status.connected && this.status.roomPin) {
      this.socket.emit('operator:updateSetlistSummary', {
        roomPin: this.status.roomPin,
        setlist
      });
    }
  }

  /**
   * Broadcast local media status to online viewers
   * When visible=true, online viewers will see an overlay message
   * indicating that local media is being displayed on HDMI screens
   */
  broadcastLocalMediaStatus(visible: boolean): void {
    // Validate input
    if (typeof visible !== 'boolean') {
      console.error('[SocketService] broadcastLocalMediaStatus: invalid visible value');
      return;
    }
    if (this.socket && this.status.connected && this.status.roomId) {
      this.socket.emit('operator:localMediaStatus', {
        roomId: this.status.roomId,
        visible
      });
    }
  }

  /**
   * YouTube video control methods
   */
  youtubeLoad(videoId: string, title: string): void {
    // Validate inputs
    if (!videoId || typeof videoId !== 'string') {
      console.error('[SocketService] youtubeLoad: invalid videoId');
      return;
    }
    // Sanitize videoId - YouTube IDs should only be alphanumeric with - and _
    const sanitizedVideoId = videoId.replace(/[^a-zA-Z0-9_-]/g, '');
    if (sanitizedVideoId.length === 0 || sanitizedVideoId.length > 20) {
      console.error('[SocketService] youtubeLoad: invalid videoId format');
      return;
    }
    const sanitizedTitle = typeof title === 'string' ? title.substring(0, 500) : '';

    // Cache for reconnection recovery
    this.lastYoutubeState = { videoId: sanitizedVideoId, title: sanitizedTitle, currentTime: 0, isPlaying: false };

    if (this.socket && this.status.connected && this.status.roomId) {
      this.socket.emit('operator:youtubeLoad', {
        roomId: this.status.roomId,
        videoId: sanitizedVideoId,
        title: sanitizedTitle
      });
    }
  }

  youtubePlay(currentTime: number): void {
    // Validate currentTime
    if (typeof currentTime !== 'number' || !isFinite(currentTime) || currentTime < 0) {
      console.error('[SocketService] youtubePlay: invalid currentTime');
      return;
    }
    if (this.socket && this.status.connected && this.status.roomId) {
      this.socket.emit('operator:youtubePlay', {
        roomId: this.status.roomId,
        currentTime
      });
    }
  }

  youtubePause(currentTime: number): void {
    // Validate currentTime
    if (typeof currentTime !== 'number' || !isFinite(currentTime) || currentTime < 0) {
      console.error('[SocketService] youtubePause: invalid currentTime');
      return;
    }
    if (this.socket && this.status.connected && this.status.roomId) {
      this.socket.emit('operator:youtubePause', {
        roomId: this.status.roomId,
        currentTime
      });
    }
  }

  youtubeSeek(currentTime: number): void {
    // Validate currentTime
    if (typeof currentTime !== 'number' || !isFinite(currentTime) || currentTime < 0) {
      console.error('[SocketService] youtubeSeek: invalid currentTime');
      return;
    }
    if (this.socket && this.status.connected && this.status.roomId) {
      this.socket.emit('operator:youtubeSeek', {
        roomId: this.status.roomId,
        currentTime
      });
    }
  }

  youtubeStop(): void {
    // Clear cached YouTube state
    this.lastYoutubeState = null;

    if (this.socket && this.status.connected && this.status.roomId) {
      this.socket.emit('operator:youtubeStop', {
        roomId: this.status.roomId
      });
    }
  }

  youtubeSync(currentTime: number, isPlaying: boolean): void {
    // Validate inputs
    if (typeof currentTime !== 'number' || !isFinite(currentTime) || currentTime < 0) {
      console.error('[SocketService] youtubeSync: invalid currentTime');
      return;
    }
    if (typeof isPlaying !== 'boolean') {
      console.error('[SocketService] youtubeSync: invalid isPlaying');
      return;
    }
    if (this.socket && this.status.connected && this.status.roomId) {
      this.socket.emit('operator:youtubeSync', {
        roomId: this.status.roomId,
        currentTime,
        isPlaying
      });
    }
  }

  /**
   * Set the control window for sending notifications
   */
  setControlWindow(window: BrowserWindow): void {
    this.controlWindow = window;
  }

  private notifyStatusChange(): void {
    if (this.controlWindow && !this.controlWindow.isDestroyed()) {
      this.controlWindow.webContents.send('online:status', this.status);
    }
  }

  private notifyViewerCount(count: number): void {
    if (this.controlWindow && !this.controlWindow.isDestroyed()) {
      this.controlWindow.webContents.send('online:viewerCount', count);
    }
  }

  /**
   * Check if a broadcast is rate-limited
   * @returns true if the broadcast should be allowed, false if rate-limited
   */
  private checkRateLimit(broadcastType: string): boolean {
    const now = Date.now();
    const lastTime = this.lastBroadcastTime[broadcastType] || 0;

    if (now - lastTime < this.minBroadcastIntervalMs) {
      return false; // Rate limited
    }

    this.lastBroadcastTime[broadcastType] = now;
    return true;
  }

  /**
   * Restore broadcast state after reconnection
   */
  private restoreStateOnReconnect(): void {
    // Re-broadcast last known state to sync viewers
    setTimeout(() => {
      if (this.lastTheme) {
        this.broadcastTheme(this.lastTheme);
      }
      if (this.lastBibleTheme) {
        this.broadcastBibleTheme(this.lastBibleTheme);
      }
      if (this.lastPrayerTheme) {
        this.broadcastPrayerTheme(this.lastPrayerTheme);
      }
      if (this.lastBackground) {
        this.broadcastBackground(this.lastBackground);
      }
      if (this.lastSlideData) {
        this.broadcastSlide(this.lastSlideData);
      }
      if (this.lastYoutubeState) {
        this.youtubeLoad(this.lastYoutubeState.videoId, this.lastYoutubeState.title);
        if (this.lastYoutubeState.isPlaying) {
          this.youtubePlay(this.lastYoutubeState.currentTime);
        }
      }
      if (this.lastToolData) {
        this.broadcastTool(this.lastToolData);
      }
    }, 500); // Small delay to ensure socket is fully ready
  }

  /**
   * Fetch user's online setlists from the backend
   */
  async fetchOnlineSetlists(): Promise<any[]> {
    if (!this.token || !this.status.serverUrl) {
      return [];
    }

    try {
      this.axiosAbortController = new AbortController();
      const response = await axios.get(`${this.status.serverUrl}/api/setlists`, {
        headers: {
          'Authorization': `Bearer ${this.token}`
        },
        timeout: AXIOS_TIMEOUT,
        signal: this.axiosAbortController.signal
      });

      return response.data?.setlists || response.data || [];
    } catch (error: any) {
      console.error('Failed to fetch online setlists:', error.response?.data || error.message);
      return [];
    }
  }

  /**
   * Fetch a single online setlist by ID (with populated song data)
   */
  async fetchOnlineSetlist(id: string): Promise<any | null> {
    if (!this.token || !this.status.serverUrl) {
      return null;
    }

    try {
      this.axiosAbortController = new AbortController();
      const response = await axios.get(`${this.status.serverUrl}/api/setlists/${id}`, {
        headers: {
          'Authorization': `Bearer ${this.token}`
        },
        timeout: AXIOS_TIMEOUT,
        signal: this.axiosAbortController.signal
      });

      return response.data?.setlist || response.data || null;
    } catch (error: any) {
      console.error('Failed to fetch online setlist:', error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Clear all cached state (call when intentionally disconnecting)
   */
  clearCachedState(): void {
    this.lastSlideData = null;
    this.lastTheme = null;
    this.lastBibleTheme = null;
    this.lastPrayerTheme = null;
    this.lastBackground = null;
    this.lastYoutubeState = null;
    this.lastToolData = null;
  }
}
