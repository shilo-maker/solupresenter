import { io } from 'socket.io-client';

// Dynamically determine Socket URL based on current hostname
// This allows the app to work both on localhost and when accessed via IP address
const getSocketUrl = () => {
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }

  // Use the current hostname with backend port
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  const backendPort = 5000;

  return `${protocol}//${hostname}:${backendPort}`;
};

const SOCKET_URL = getSocketUrl();

class SocketService {
  constructor() {
    this.socket = null;
    this.connectionStatus = 'disconnected'; // 'connecting', 'connected', 'disconnected', 'reconnecting'
    this.statusCallbacks = [];
    this.latency = null;
    this.heartbeatInterval = null;
  }

  connect() {
    if (!this.socket) {
      this.updateConnectionStatus('connecting');

      this.socket = io(SOCKET_URL, {
        transports: ['websocket'],  // WebSocket only (faster, no polling overhead)
        upgrade: false,             // Don't upgrade from polling
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 500,     // Faster reconnection
        reconnectionDelayMax: 3000,
        timeout: 10000,             // Faster timeout
        forceNew: false,
        multiplex: true
      });

      this.socket.on('connect', () => {
        this.updateConnectionStatus('connected');
        this.startHeartbeat();
      });

      this.socket.on('disconnect', () => {
        this.updateConnectionStatus('disconnected');
        this.stopHeartbeat();
      });

      this.socket.on('reconnect_attempt', () => {
        this.updateConnectionStatus('reconnecting');
      });

      this.socket.on('reconnect', () => {
        this.updateConnectionStatus('connected');
        this.startHeartbeat();
      });

      this.socket.on('reconnect_error', (error) => {
        console.error('Reconnection error:', error);
      });

      this.socket.on('reconnect_failed', () => {
        console.error('Reconnection failed after all attempts');
        this.updateConnectionStatus('disconnected');
      });

      this.socket.on('error', (error) => {
        console.error('Socket error:', error);
      });

      // Heartbeat response
      this.socket.on('pong', (timestamp) => {
        this.latency = Date.now() - timestamp;
      });
    }
    return this.socket;
  }

  startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Send ping every 5 seconds
    this.heartbeatInterval = setInterval(() => {
      if (this.socket && this.socket.connected) {
        this.socket.emit('ping', Date.now());
      }
    }, 5000);
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  updateConnectionStatus(status) {
    this.connectionStatus = status;
    this.statusCallbacks.forEach(callback => callback(status, this.latency));
  }

  onConnectionStatusChange(callback) {
    this.statusCallbacks.push(callback);
    // Immediately call with current status
    callback(this.connectionStatus, this.latency);

    // Return unsubscribe function
    return () => {
      this.statusCallbacks = this.statusCallbacks.filter(cb => cb !== callback);
    };
  }

  getConnectionStatus() {
    return {
      status: this.connectionStatus,
      latency: this.latency,
      isConnected: this.socket?.connected || false
    };
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Operator methods
  operatorJoinRoom(userId, roomId) {
    if (!this.socket) {
      console.error('No socket available for operator to join');
      return;
    }

    // If socket is already connected, emit immediately
    if (this.socket.connected) {
      this.socket.emit('operator:join', { userId, roomId });
    } else {
      // Otherwise, wait for connection before emitting
      this.socket.once('connect', () => {
        this.socket.emit('operator:join', { userId, roomId });
      });
    }
  }

  operatorUpdateSlide(data) {
    if (!this.socket) {
      console.error('No socket available');
      return;
    }

    // Emit immediately if connected, otherwise queue for connection
    if (this.socket.connected) {
      this.socket.emit('operator:updateSlide', data);
    } else {
      this.socket.once('connect', () => {
        this.socket.emit('operator:updateSlide', data);
      });
    }
  }

  updateSlide(roomId, songId, slideIndex, displayMode, isBlank = false) {
    if (this.socket) {
      this.socket.emit('operator:updateSlide', {
        roomId,
        songId,
        slideIndex,
        displayMode,
        isBlank
      });
    }
  }

  operatorUpdateBackground(roomId, backgroundImage) {
    if (!this.socket) {
      console.error('No socket available to update background');
      return;
    }

    if (this.socket.connected) {
      this.socket.emit('operator:updateBackground', { roomId, backgroundImage });
    } else {
      this.socket.once('connect', () => {
        this.socket.emit('operator:updateBackground', { roomId, backgroundImage });
      });
    }
  }

  operatorUpdateQuickSlideText(roomId, quickSlideText) {
    if (!this.socket) {
      console.error('No socket available to update quick slide text');
      return;
    }

    if (this.socket.connected) {
      this.socket.emit('operator:updateQuickSlideText', { roomId, quickSlideText });
    } else {
      this.socket.once('connect', () => {
        this.socket.emit('operator:updateQuickSlideText', { roomId, quickSlideText });
      });
    }
  }

  operatorApplyTheme(roomId, themeId) {
    if (!this.socket) {
      console.error('No socket available to apply theme');
      return;
    }

    if (this.socket.connected) {
      this.socket.emit('operator:applyTheme', { roomId, themeId });
    } else {
      this.socket.once('connect', () => {
        this.socket.emit('operator:applyTheme', { roomId, themeId });
      });
    }
  }

  operatorUpdateLocalMediaStatus(roomId, visible) {
    if (!this.socket) {
      console.error('No socket available to update local media status');
      return;
    }

    if (this.socket.connected) {
      this.socket.emit('operator:localMediaStatus', { roomId, visible });
    } else {
      this.socket.once('connect', () => {
        this.socket.emit('operator:localMediaStatus', { roomId, visible });
      });
    }
  }


  // YouTube methods
  operatorYoutubeLoad(roomId, videoId, title) {
    if (!this.socket) {
      console.error('No socket available to load YouTube video');
      return;
    }

    if (this.socket.connected) {
      this.socket.emit('operator:youtubeLoad', { roomId, videoId, title });
    } else {
      this.socket.once('connect', () => {
        this.socket.emit('operator:youtubeLoad', { roomId, videoId, title });
      });
    }
  }

  operatorYoutubePlay(roomId, currentTime) {
    if (this.socket?.connected) {
      this.socket.emit('operator:youtubePlay', { roomId, currentTime });
    }
  }

  operatorYoutubePause(roomId, currentTime) {
    if (this.socket?.connected) {
      this.socket.emit('operator:youtubePause', { roomId, currentTime });
    }
  }

  operatorYoutubeSeek(roomId, currentTime) {
    if (this.socket?.connected) {
      this.socket.emit('operator:youtubeSeek', { roomId, currentTime });
    }
  }

  operatorYoutubeStop(roomId) {
    if (this.socket?.connected) {
      this.socket.emit('operator:youtubeStop', { roomId });
    }
  }

  operatorYoutubeSync(roomId, currentTime, isPlaying) {
    if (this.socket?.connected) {
      this.socket.emit('operator:youtubeSync', { roomId, currentTime, isPlaying });
    }
  }

  // Viewer signals YouTube player is ready
  viewerYoutubeReady(roomPin) {
    if (this.socket?.connected) {
      this.socket.emit('viewer:youtubeReady', { roomPin });
    }
  }

  // Operator listens for viewer YouTube ready
  onViewerYoutubeReady(callback) {
    if (this.socket) {
      this.socket.on('viewer:youtubeReady', callback);
    }
  }

  // Viewer methods
  viewerJoinRoom(pin) {
    if (!this.socket) {
      console.error('No socket available for viewer to join');
      return;
    }

    if (this.socket.connected) {
      this.socket.emit('viewer:join', { pin });
    } else {
      this.socket.once('connect', () => {
        this.socket.emit('viewer:join', { pin });
      });
    }
  }

  viewerJoinRoomBySlug(slug) {
    if (!this.socket) {
      console.error('No socket available for viewer to join');
      return;
    }

    if (this.socket.connected) {
      this.socket.emit('viewer:join', { slug });
    } else {
      this.socket.once('connect', () => {
        this.socket.emit('viewer:join', { slug });
      });
    }
  }

  // Event listeners
  onOperatorJoined(callback) {
    if (this.socket) {
      this.socket.on('operator:joined', callback);
    }
  }

  onViewerJoined(callback) {
    if (this.socket) {
      this.socket.on('viewer:joined', callback);
    }
  }

  onSlideUpdate(callback) {
    if (this.socket) {
      this.socket.on('slide:update', callback);
    }
  }

  onViewerCount(callback) {
    if (this.socket) {
      this.socket.on('room:viewerCount', callback);
    }
  }

  onError(callback) {
    if (this.socket) {
      this.socket.on('error', callback);
    }
  }

  onBackgroundUpdate(callback) {
    if (this.socket) {
      this.socket.on('background:update', callback);
    }
  }

  onRoomClosed(callback) {
    if (this.socket) {
      this.socket.on('room:closed', callback);
    }
  }

  onThemeUpdate(callback) {
    if (this.socket) {
      this.socket.on('theme:update', callback);
    }
  }

  onBibleThemeUpdate(callback) {
    if (this.socket) {
      this.socket.on('bibleTheme:update', callback);
    }
  }

  onPrayerThemeUpdate(callback) {
    if (this.socket) {
      this.socket.on('prayerTheme:update', callback);
    }
  }

  onLocalMediaStatus(callback) {
    if (this.socket) {
      this.socket.on('localMedia:status', callback);
    }
  }

  onToolsUpdate(callback) {
    if (this.socket) {
      this.socket.on('tools:update', callback);
    }
  }

  onYoutubeLoad(callback) {
    if (this.socket) {
      this.socket.on('youtube:load', callback);
    }
  }

  onYoutubePlay(callback) {
    if (this.socket) {
      this.socket.on('youtube:play', callback);
    }
  }

  onYoutubePause(callback) {
    if (this.socket) {
      this.socket.on('youtube:pause', callback);
    }
  }

  onYoutubeSeek(callback) {
    if (this.socket) {
      this.socket.on('youtube:seek', callback);
    }
  }

  onYoutubeStop(callback) {
    if (this.socket) {
      this.socket.on('youtube:stop', callback);
    }
  }

  onYoutubeSync(callback) {
    if (this.socket) {
      this.socket.on('youtube:sync', callback);
    }
  }

  // Remove listeners
  removeListener(eventName) {
    if (this.socket) {
      this.socket.off(eventName);
    }
  }

  removeAllListeners() {
    if (this.socket) {
      this.socket.removeAllListeners();
    }
  }

  // Emit generic event (for direct socket.emit access)
  emit(event, data) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    }
  }
}

const socketService = new SocketService();

export default socketService;
