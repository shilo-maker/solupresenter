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
    console.log('🔌 socketService.connect() called, current socket:', this.socket);
    if (!this.socket) {
      console.log('📡 Creating new socket connection to:', SOCKET_URL);
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
        console.log('✅ Socket connected, ID:', this.socket.id);
        this.updateConnectionStatus('connected');
        this.startHeartbeat();
      });

      this.socket.on('disconnect', (reason) => {
        console.log('❌ Socket disconnected, reason:', reason);
        this.updateConnectionStatus('disconnected');
        this.stopHeartbeat();
      });

      this.socket.on('reconnect_attempt', () => {
        console.log('🔄 Attempting to reconnect...');
        this.updateConnectionStatus('reconnecting');
      });

      this.socket.on('reconnect', (attemptNumber) => {
        console.log('✅ Reconnected after', attemptNumber, 'attempts');
        this.updateConnectionStatus('connected');
        this.startHeartbeat();
      });

      this.socket.on('reconnect_error', (error) => {
        console.error('⚠️ Reconnection error:', error);
      });

      this.socket.on('reconnect_failed', () => {
        console.error('❌ Reconnection failed after all attempts');
        this.updateConnectionStatus('disconnected');
      });

      this.socket.on('error', (error) => {
        console.error('⚠️ Socket error:', error);
      });

      // Heartbeat response
      this.socket.on('pong', (timestamp) => {
        this.latency = Date.now() - timestamp;
        console.log('💓 Heartbeat latency:', this.latency, 'ms');
      });
    } else {
      console.log('ℹ️ Socket already exists, reusing it');
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
      console.error('❌ No socket available for operator to join');
      return;
    }

    console.log('👤 Operator joining room:', {
      connected: this.socket.connected,
      socketId: this.socket.id,
      userId,
      roomId
    });

    // If socket is already connected, emit immediately
    if (this.socket.connected) {
      this.socket.emit('operator:join', { userId, roomId });
    } else {
      // Otherwise, wait for connection before emitting
      console.log('⏳ Socket not connected yet, waiting...');
      this.socket.once('connect', () => {
        console.log('✅ Socket connected, now joining room');
        this.socket.emit('operator:join', { userId, roomId });
      });
    }
  }

  operatorUpdateSlide(data) {
    if (!this.socket) {
      console.error('❌ No socket available');
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
      console.error('❌ No socket available to update background');
      return;
    }

    console.log('🎨 Updating background:', { roomId, backgroundImage });

    if (this.socket.connected) {
      this.socket.emit('operator:updateBackground', { roomId, backgroundImage });
      console.log('📡 operator:updateBackground event emitted');
    } else {
      console.log('⏳ Socket not connected, waiting...');
      this.socket.once('connect', () => {
        console.log('✅ Socket connected, now sending background update');
        this.socket.emit('operator:updateBackground', { roomId, backgroundImage });
      });
    }
  }

  operatorUpdateQuickSlideText(roomId, quickSlideText) {
    if (!this.socket) {
      console.error('❌ No socket available to update quick slide text');
      return;
    }

    console.log('⚡ Updating quick slide text:', { roomId, textLength: quickSlideText?.length || 0 });

    if (this.socket.connected) {
      this.socket.emit('operator:updateQuickSlideText', { roomId, quickSlideText });
      console.log('📡 operator:updateQuickSlideText event emitted');
    } else {
      console.log('⏳ Socket not connected, waiting...');
      this.socket.once('connect', () => {
        console.log('✅ Socket connected, now sending quick slide text update');
        this.socket.emit('operator:updateQuickSlideText', { roomId, quickSlideText });
      });
    }
  }

  // Viewer methods
  viewerJoinRoom(pin) {
    if (!this.socket) {
      console.error('❌ No socket available for viewer to join');
      return;
    }

    if (this.socket.connected) {
      this.socket.emit('viewer:join', { pin });
    } else {
      console.log('⏳ Socket not connected yet, waiting...');
      this.socket.once('connect', () => {
        console.log('✅ Socket connected, now joining room by PIN');
        this.socket.emit('viewer:join', { pin });
      });
    }
  }

  viewerJoinRoomBySlug(slug) {
    if (!this.socket) {
      console.error('❌ No socket available for viewer to join');
      return;
    }

    if (this.socket.connected) {
      this.socket.emit('viewer:join', { slug });
    } else {
      console.log('⏳ Socket not connected yet, waiting...');
      this.socket.once('connect', () => {
        console.log('✅ Socket connected, now joining room by slug');
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
