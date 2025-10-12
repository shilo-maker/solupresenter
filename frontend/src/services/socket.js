import { io } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

class SocketService {
  constructor() {
    this.socket = null;
  }

  connect() {
    console.log('🔌 socketService.connect() called, current socket:', this.socket);
    if (!this.socket) {
      console.log('📡 Creating new socket connection to:', SOCKET_URL);
      this.socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });

      this.socket.on('connect', () => {
        console.log('✅ Socket connected, ID:', this.socket.id);
      });

      this.socket.on('disconnect', () => {
        console.log('❌ Socket disconnected');
      });

      this.socket.on('error', (error) => {
        console.error('⚠️ Socket error:', error);
      });
    } else {
      console.log('ℹ️ Socket already exists, reusing it');
    }
    return this.socket;
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
      console.error('❌ No socket available to send operator:updateSlide');
      return;
    }

    console.log('🔌 Socket status:', {
      connected: this.socket.connected,
      id: this.socket.id,
      data
    });

    // If socket is connected, emit immediately
    if (this.socket.connected) {
      this.socket.emit('operator:updateSlide', data);
      console.log('📡 operator:updateSlide event emitted');
    } else {
      // Otherwise, wait for connection before emitting
      console.log('⏳ Socket not connected, waiting...');
      this.socket.once('connect', () => {
        console.log('✅ Socket connected, now sending slide update');
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

  // Viewer methods
  viewerJoinRoom(pin) {
    if (this.socket) {
      this.socket.emit('viewer:join', { pin });
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
}

const socketService = new SocketService();

export default socketService;
