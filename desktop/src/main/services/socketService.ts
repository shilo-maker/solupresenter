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
          console.log('Connected to server');
          // Clear timeout on successful connection
          if (this.connectionTimeoutId) {
            clearTimeout(this.connectionTimeoutId);
            this.connectionTimeoutId = null;
          }
          this.status.connected = true;
          this.status.serverUrl = serverUrl;
          this.notifyStatusChange();
          resolve(true);
        });

        this.socket.on('disconnect', () => {
          console.log('Disconnected from server');
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
          console.log('Operator joined room, PIN:', data.roomPin);
          this.status.roomPin = data.roomPin;
          this.notifyStatusChange();
        });

        this.socket.on('room:viewerCount', (data: { count: number }) => {
          this.status.viewerCount = data.count;
          this.notifyViewerCount(data.count);
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
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.status = {
      connected: false,
      viewerCount: 0
    };
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
      console.log('Creating room via API...');
      const response = await axios.post(
        `${this.status.serverUrl}/api/rooms/create`,
        { publicRoomId },
        {
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          },
          timeout: AXIOS_TIMEOUT
        }
      );

      const room = response.data.room;
      if (!room || !room.id || !room.pin) {
        console.error('Invalid room response:', response.data);
        return null;
      }

      console.log('Room created:', room.pin);
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
        setTimeout(() => {
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
    console.log('getPublicRooms called, token:', this.token ? 'present' : 'missing', 'serverUrl:', this.status.serverUrl);

    if (!this.token || !this.status.serverUrl) {
      console.log('getPublicRooms: missing token or serverUrl');
      return [];
    }

    try {
      const url = `${this.status.serverUrl}/api/public-rooms/my-rooms`;
      console.log('Fetching public rooms from:', url);

      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${this.token}`
        },
        timeout: AXIOS_TIMEOUT
      });

      console.log('Public rooms response:', JSON.stringify(response.data));
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
      if (publicRoomId) {
        await axios.post(
          `${this.status.serverUrl}/api/rooms/${this.status.roomId}/link-public-room`,
          { publicRoomId },
          {
            headers: {
              'Authorization': `Bearer ${this.token}`,
              'Content-Type': 'application/json'
            },
            timeout: AXIOS_TIMEOUT
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
            timeout: AXIOS_TIMEOUT
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
          isBible: slideData.isBible || false,
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
   * Broadcast theme to online viewers
   */
  broadcastTheme(theme: any): void {
    if (this.socket && this.status.connected && this.status.roomPin) {
      this.socket.emit('operator:applyTheme', {
        roomPin: this.status.roomPin,
        theme
      });
    }
  }

  /**
   * Broadcast background to online viewers
   */
  broadcastBackground(backgroundImage: string): void {
    if (this.socket && this.status.connected && this.status.roomId) {
      console.log('Broadcasting background to online viewers, roomId:', this.status.roomId);
      this.socket.emit('operator:updateBackground', {
        roomId: this.status.roomId,
        backgroundImage
      });
    }
  }

  /**
   * Broadcast tool data (countdown, announcement) to online viewers
   */
  broadcastTool(toolData: any): void {
    if (this.socket && this.status.connected && this.status.roomPin) {
      this.socket.emit('operator:updateTool', {
        roomPin: this.status.roomPin,
        ...toolData
      });
    }
  }

  /**
   * Broadcast local media status to online viewers
   * When visible=true, online viewers will see an overlay message
   * indicating that local media is being displayed on HDMI screens
   */
  broadcastLocalMediaStatus(visible: boolean): void {
    if (this.socket && this.status.connected && this.status.roomId) {
      console.log('Broadcasting local media status:', visible ? 'showing' : 'hidden');
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
    if (this.socket && this.status.connected && this.status.roomId) {
      console.log('Broadcasting YouTube load:', videoId);
      this.socket.emit('operator:youtubeLoad', {
        roomId: this.status.roomId,
        videoId,
        title
      });
    }
  }

  youtubePlay(currentTime: number): void {
    if (this.socket && this.status.connected && this.status.roomId) {
      this.socket.emit('operator:youtubePlay', {
        roomId: this.status.roomId,
        currentTime
      });
    }
  }

  youtubePause(currentTime: number): void {
    if (this.socket && this.status.connected && this.status.roomId) {
      this.socket.emit('operator:youtubePause', {
        roomId: this.status.roomId,
        currentTime
      });
    }
  }

  youtubeSeek(currentTime: number): void {
    if (this.socket && this.status.connected && this.status.roomId) {
      this.socket.emit('operator:youtubeSeek', {
        roomId: this.status.roomId,
        currentTime
      });
    }
  }

  youtubeStop(): void {
    if (this.socket && this.status.connected && this.status.roomId) {
      console.log('Broadcasting YouTube stop');
      this.socket.emit('operator:youtubeStop', {
        roomId: this.status.roomId
      });
    }
  }

  youtubeSync(currentTime: number, isPlaying: boolean): void {
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
}
