/**
 * Comprehensive Socket.io Event Tests
 * Tests all real-time socket events for SoluPresenter
 */

const { Server } = require('socket.io');
const { createServer } = require('http');
const Client = require('socket.io-client');
const { sequelize, User, Room, Song, PublicRoom, ViewerTheme } = require('../models');

let io;
let httpServer;
let operatorSocket;
let viewerSocket;
let testUser;
let testRoom;
let testSong;
let testTheme;
let publicRoom;

// ============================================
// TEST SETUP AND TEARDOWN
// ============================================

beforeAll(async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ force: true });

    // Create test data
    testUser = await User.create({
      email: 'sockettest@example.com',
      password: 'TestPassword123!',
      authProvider: 'local',
      isEmailVerified: true
    });

    testRoom = await Room.create({
      pin: 'SOCK',
      operatorId: testUser.id,
      isActive: true,
      backgroundImage: '/uploads/test-bg.jpg'
    });

    testSong = await Song.create({
      title: 'Socket Test Song',
      createdById: testUser.id,
      slides: [
        { originalText: 'Verse 1', transliteration: 'Verse One', translation: 'Verse 1 Translation', verseType: 'Verse1' },
        { originalText: 'Chorus', transliteration: 'Chorus Trans', translation: 'Chorus Translation', verseType: 'Chorus' }
      ]
    });

    await ViewerTheme.seedClassicTheme();
    testTheme = await ViewerTheme.findOne({ where: { isBuiltIn: true } });

    publicRoom = await PublicRoom.create({
      name: 'Socket Test Church',
      slug: 'socket-church',
      ownerId: testUser.id,
      activeRoomId: testRoom.id
    });

    // Create Socket.io server
    httpServer = createServer();
    io = new Server(httpServer, {
      cors: { origin: '*' }
    });

    // Map to track sockets
    const operatorSockets = new Map();
    const viewerRooms = new Map();
    const roomToolsData = new Map();
    const roomActiveTheme = new Map();

    // Set up socket handlers (simplified version of server.js)
    io.on('connection', (socket) => {
      // Operator joins
      socket.on('operator:join', async (data) => {
        const { userId, roomId } = data;
        const room = await Room.findByPk(roomId);
        if (!room) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }
        socket.join(`room:${room.pin}`);
        operatorSockets.set(userId, socket.id);
        socket.emit('operator:joined', {
          roomPin: room.pin,
          quickSlideText: room.quickSlideText || ''
        });
      });

      // Viewer joins
      socket.on('viewer:join', async (data) => {
        const { pin, slug } = data || {};

        if (!pin && !slug) {
          socket.emit('error', { message: 'Room PIN or name is required' });
          return;
        }

        let room;
        if (slug) {
          const pubRoom = await PublicRoom.findOne({ where: { slug: slug.toLowerCase() } });
          if (!pubRoom || !pubRoom.activeRoomId) {
            socket.emit('error', { message: 'Room not found or not live' });
            return;
          }
          room = await Room.findOne({ where: { id: pubRoom.activeRoomId, isActive: true } });
        } else {
          room = await Room.findOne({ where: { pin: pin.toUpperCase(), isActive: true } });
        }

        if (!room) {
          socket.emit('error', { message: 'Room not found or inactive' });
          return;
        }

        socket.join(`room:${room.pin}`);
        viewerRooms.set(socket.id, room.pin);

        await Room.increment('viewerCount', { where: { id: room.id } });
        const updatedRoom = await Room.findByPk(room.id);

        socket.emit('viewer:joined', {
          roomPin: room.pin,
          currentSlide: room.currentSlide,
          slideData: null,
          isBlank: room.currentSlide?.isBlank || false,
          backgroundImage: room.backgroundImage || '',
          toolsData: roomToolsData.get(room.pin) || null,
          theme: roomActiveTheme.get(room.pin) || null
        });

        io.to(`room:${room.pin}`).emit('room:viewerCount', { count: updatedRoom.viewerCount });
      });

      // Operator updates slide
      socket.on('operator:updateSlide', async (data) => {
        const { roomId, roomPin, songId, slideIndex, displayMode, isBlank, imageUrl, slideData, toolsData } = data;

        let pin = roomPin;
        if (!pin) {
          const room = await Room.findByPk(roomId);
          if (!room) {
            socket.emit('error', { message: 'Room not found' });
            return;
          }
          pin = room.pin;
        }

        if (toolsData) {
          roomToolsData.set(pin, toolsData);
        } else {
          roomToolsData.delete(pin);
        }

        io.to(`room:${pin}`).emit('slide:update', {
          currentSlide: { songId, slideIndex, displayMode, isBlank },
          slideData: slideData,
          isBlank,
          imageUrl,
          toolsData
        });
      });

      // Operator updates background
      socket.on('operator:updateBackground', async (data) => {
        const { roomId, backgroundImage } = data;
        const room = await Room.findByPk(roomId);
        if (!room) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }
        room.backgroundImage = backgroundImage || '';
        await room.save();

        io.to(`room:${room.pin}`).emit('background:update', { backgroundImage: room.backgroundImage });
      });

      // Operator applies theme
      socket.on('operator:applyTheme', async (data) => {
        const { roomId, themeId } = data;
        const room = await Room.findByPk(roomId);
        if (!room) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }

        let theme = null;
        if (themeId) {
          theme = await ViewerTheme.findByPk(themeId);
          if (!theme) {
            socket.emit('error', { message: 'Theme not found' });
            return;
          }
          roomActiveTheme.set(room.pin, theme.toJSON());
        } else {
          roomActiveTheme.delete(room.pin);
        }

        io.to(`room:${room.pin}`).emit('theme:update', { theme: theme ? theme.toJSON() : null });
      });

      // Local video
      socket.on('operator:localVideo', async (data) => {
        const { roomId, videoData } = data;
        const room = await Room.findByPk(roomId);
        if (!room) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }
        io.to(`room:${room.pin}`).emit('localVideo:update', videoData);
      });

      socket.on('operator:stopLocalVideo', async (data) => {
        const { roomId } = data;
        const room = await Room.findByPk(roomId);
        if (!room) return;
        io.to(`room:${room.pin}`).emit('localVideo:stop');
      });

      // Ping/pong
      socket.on('ping', (timestamp) => {
        socket.emit('pong', timestamp);
      });

      // Disconnect
      socket.on('disconnect', async () => {
        const roomPin = viewerRooms.get(socket.id);
        if (roomPin) {
          await Room.decrement('viewerCount', { where: { pin: roomPin } });
          const room = await Room.findOne({ where: { pin: roomPin } });
          if (room) {
            io.to(`room:${roomPin}`).emit('room:viewerCount', { count: Math.max(0, room.viewerCount) });
          }
          viewerRooms.delete(socket.id);
        }

        for (const [userId, socketId] of operatorSockets.entries()) {
          if (socketId === socket.id) {
            operatorSockets.delete(userId);
            break;
          }
        }
      });
    });

    await new Promise((resolve) => {
      httpServer.listen(() => resolve());
    });

  } catch (error) {
    console.error('Test setup failed:', error);
    throw error;
  }
});

afterAll(async () => {
  if (operatorSocket) operatorSocket.close();
  if (viewerSocket) viewerSocket.close();
  if (io) io.close();
  if (httpServer) httpServer.close();
  await sequelize.close();
});

beforeEach(async () => {
  // Reset room viewer count
  await Room.update({ viewerCount: 0 }, { where: { id: testRoom.id } });
});

afterEach(() => {
  if (operatorSocket) {
    operatorSocket.removeAllListeners();
    operatorSocket.close();
    operatorSocket = null;
  }
  if (viewerSocket) {
    viewerSocket.removeAllListeners();
    viewerSocket.close();
    viewerSocket = null;
  }
});

// Helper to create socket client
const createClient = () => {
  const port = httpServer.address().port;
  return Client(`http://localhost:${port}`, {
    transports: ['websocket'],
    forceNew: true
  });
};

// ============================================
// OPERATOR JOIN TESTS
// ============================================

describe('Operator Join', () => {
  it('should allow operator to join their room', (done) => {
    operatorSocket = createClient();

    operatorSocket.on('connect', () => {
      operatorSocket.emit('operator:join', {
        userId: testUser.id,
        roomId: testRoom.id
      });
    });

    operatorSocket.on('operator:joined', (data) => {
      expect(data).toHaveProperty('roomPin', 'SOCK');
      expect(data).toHaveProperty('quickSlideText');
      done();
    });
  });

  it('should emit error for non-existent room', (done) => {
    operatorSocket = createClient();

    operatorSocket.on('connect', () => {
      operatorSocket.emit('operator:join', {
        userId: testUser.id,
        roomId: '00000000-0000-0000-0000-000000000999'
      });
    });

    operatorSocket.on('error', (data) => {
      expect(data.message).toContain('not found');
      done();
    });
  });
});

// ============================================
// VIEWER JOIN TESTS
// ============================================

describe('Viewer Join', () => {
  it('should allow viewer to join by PIN', (done) => {
    viewerSocket = createClient();

    viewerSocket.on('connect', () => {
      viewerSocket.emit('viewer:join', { pin: 'SOCK' });
    });

    viewerSocket.on('viewer:joined', (data) => {
      expect(data).toHaveProperty('roomPin', 'SOCK');
      expect(data).toHaveProperty('currentSlide');
      expect(data).toHaveProperty('backgroundImage');
      done();
    });
  });

  it('should allow viewer to join by slug', (done) => {
    viewerSocket = createClient();

    viewerSocket.on('connect', () => {
      viewerSocket.emit('viewer:join', { slug: 'socket-church' });
    });

    viewerSocket.on('viewer:joined', (data) => {
      expect(data).toHaveProperty('roomPin', 'SOCK');
      done();
    });
  });

  it('should handle lowercase PIN', (done) => {
    viewerSocket = createClient();

    viewerSocket.on('connect', () => {
      viewerSocket.emit('viewer:join', { pin: 'sock' });
    });

    viewerSocket.on('viewer:joined', (data) => {
      expect(data.roomPin).toBe('SOCK');
      done();
    });
  });

  it('should emit error for missing PIN and slug', (done) => {
    viewerSocket = createClient();

    viewerSocket.on('connect', () => {
      viewerSocket.emit('viewer:join', {});
    });

    viewerSocket.on('error', (data) => {
      expect(data.message).toContain('required');
      done();
    });
  });

  it('should emit error for non-existent room', (done) => {
    viewerSocket = createClient();

    viewerSocket.on('connect', () => {
      viewerSocket.emit('viewer:join', { pin: 'XXXX' });
    });

    viewerSocket.on('error', (data) => {
      expect(data.message).toContain('not found');
      done();
    });
  });

  it('should emit error for non-existent slug', (done) => {
    viewerSocket = createClient();

    viewerSocket.on('connect', () => {
      viewerSocket.emit('viewer:join', { slug: 'non-existent-church' });
    });

    viewerSocket.on('error', (data) => {
      expect(data.message).toContain('not found');
      done();
    });
  });
});

// ============================================
// VIEWER COUNT TESTS
// ============================================

describe('Viewer Count', () => {
  it('should increment viewer count when viewer joins', (done) => {
    operatorSocket = createClient();
    viewerSocket = createClient();

    operatorSocket.on('connect', () => {
      operatorSocket.emit('operator:join', {
        userId: testUser.id,
        roomId: testRoom.id
      });
    });

    operatorSocket.on('operator:joined', () => {
      // Now connect viewer
      viewerSocket.emit('viewer:join', { pin: 'SOCK' });
    });

    operatorSocket.on('room:viewerCount', (data) => {
      expect(data.count).toBeGreaterThanOrEqual(1);
      done();
    });
  });

  it('should decrement viewer count when viewer disconnects', (done) => {
    operatorSocket = createClient();
    viewerSocket = createClient();
    let viewerJoined = false;

    operatorSocket.on('connect', () => {
      operatorSocket.emit('operator:join', {
        userId: testUser.id,
        roomId: testRoom.id
      });
    });

    operatorSocket.on('operator:joined', () => {
      viewerSocket.emit('viewer:join', { pin: 'SOCK' });
    });

    viewerSocket.on('viewer:joined', () => {
      viewerJoined = true;
      // Disconnect after joining
      setTimeout(() => {
        viewerSocket.disconnect();
      }, 100);
    });

    let countUpdates = 0;
    operatorSocket.on('room:viewerCount', (data) => {
      countUpdates++;
      if (viewerJoined && countUpdates >= 2) {
        expect(data.count).toBe(0);
        done();
      }
    });
  });
});

// ============================================
// SLIDE UPDATE TESTS
// ============================================

describe('Slide Updates', () => {
  it('should broadcast slide update to viewers', (done) => {
    operatorSocket = createClient();
    viewerSocket = createClient();

    operatorSocket.on('connect', () => {
      operatorSocket.emit('operator:join', {
        userId: testUser.id,
        roomId: testRoom.id
      });
    });

    operatorSocket.on('operator:joined', () => {
      viewerSocket.emit('viewer:join', { pin: 'SOCK' });
    });

    viewerSocket.on('viewer:joined', () => {
      // Send slide update
      operatorSocket.emit('operator:updateSlide', {
        roomId: testRoom.id,
        roomPin: 'SOCK',
        songId: testSong.id,
        slideIndex: 0,
        displayMode: 'bilingual',
        isBlank: false,
        slideData: {
          slide: testSong.slides[0],
          title: testSong.title
        }
      });
    });

    viewerSocket.on('slide:update', (data) => {
      expect(data.currentSlide).toBeDefined();
      expect(data.currentSlide.slideIndex).toBe(0);
      expect(data.currentSlide.displayMode).toBe('bilingual');
      expect(data.slideData).toBeDefined();
      done();
    });
  });

  it('should broadcast blank slide', (done) => {
    operatorSocket = createClient();
    viewerSocket = createClient();

    operatorSocket.on('connect', () => {
      operatorSocket.emit('operator:join', {
        userId: testUser.id,
        roomId: testRoom.id
      });
    });

    operatorSocket.on('operator:joined', () => {
      viewerSocket.emit('viewer:join', { pin: 'SOCK' });
    });

    viewerSocket.on('viewer:joined', () => {
      operatorSocket.emit('operator:updateSlide', {
        roomId: testRoom.id,
        roomPin: 'SOCK',
        isBlank: true
      });
    });

    viewerSocket.on('slide:update', (data) => {
      expect(data.isBlank).toBe(true);
      done();
    });
  });

  it('should broadcast image URL slide', (done) => {
    operatorSocket = createClient();
    viewerSocket = createClient();

    operatorSocket.on('connect', () => {
      operatorSocket.emit('operator:join', {
        userId: testUser.id,
        roomId: testRoom.id
      });
    });

    operatorSocket.on('operator:joined', () => {
      viewerSocket.emit('viewer:join', { pin: 'SOCK' });
    });

    viewerSocket.on('viewer:joined', () => {
      operatorSocket.emit('operator:updateSlide', {
        roomId: testRoom.id,
        roomPin: 'SOCK',
        imageUrl: 'https://example.com/image.jpg'
      });
    });

    viewerSocket.on('slide:update', (data) => {
      expect(data.imageUrl).toBe('https://example.com/image.jpg');
      done();
    });
  });

  it('should include tools data in slide update', (done) => {
    operatorSocket = createClient();
    viewerSocket = createClient();
    const toolsData = { countdown: { running: true, seconds: 300 } };

    operatorSocket.on('connect', () => {
      operatorSocket.emit('operator:join', {
        userId: testUser.id,
        roomId: testRoom.id
      });
    });

    operatorSocket.on('operator:joined', () => {
      viewerSocket.emit('viewer:join', { pin: 'SOCK' });
    });

    viewerSocket.on('viewer:joined', () => {
      operatorSocket.emit('operator:updateSlide', {
        roomId: testRoom.id,
        roomPin: 'SOCK',
        isBlank: false,
        toolsData
      });
    });

    viewerSocket.on('slide:update', (data) => {
      expect(data.toolsData).toEqual(toolsData);
      done();
    });
  });
});

// ============================================
// BACKGROUND UPDATE TESTS
// ============================================

describe('Background Updates', () => {
  it('should broadcast background update', (done) => {
    operatorSocket = createClient();
    viewerSocket = createClient();

    operatorSocket.on('connect', () => {
      operatorSocket.emit('operator:join', {
        userId: testUser.id,
        roomId: testRoom.id
      });
    });

    operatorSocket.on('operator:joined', () => {
      viewerSocket.emit('viewer:join', { pin: 'SOCK' });
    });

    viewerSocket.on('viewer:joined', () => {
      operatorSocket.emit('operator:updateBackground', {
        roomId: testRoom.id,
        backgroundImage: '/uploads/new-background.webp'
      });
    });

    viewerSocket.on('background:update', (data) => {
      expect(data.backgroundImage).toBe('/uploads/new-background.webp');
      done();
    });
  });

  it('should handle empty background (clear)', (done) => {
    operatorSocket = createClient();
    viewerSocket = createClient();

    operatorSocket.on('connect', () => {
      operatorSocket.emit('operator:join', {
        userId: testUser.id,
        roomId: testRoom.id
      });
    });

    operatorSocket.on('operator:joined', () => {
      viewerSocket.emit('viewer:join', { pin: 'SOCK' });
    });

    viewerSocket.on('viewer:joined', () => {
      operatorSocket.emit('operator:updateBackground', {
        roomId: testRoom.id,
        backgroundImage: ''
      });
    });

    viewerSocket.on('background:update', (data) => {
      expect(data.backgroundImage).toBe('');
      done();
    });
  });
});

// ============================================
// THEME UPDATE TESTS
// ============================================

describe('Theme Updates', () => {
  it('should broadcast theme update', (done) => {
    operatorSocket = createClient();
    viewerSocket = createClient();

    operatorSocket.on('connect', () => {
      operatorSocket.emit('operator:join', {
        userId: testUser.id,
        roomId: testRoom.id
      });
    });

    operatorSocket.on('operator:joined', () => {
      viewerSocket.emit('viewer:join', { pin: 'SOCK' });
    });

    viewerSocket.on('viewer:joined', () => {
      operatorSocket.emit('operator:applyTheme', {
        roomId: testRoom.id,
        themeId: testTheme.id
      });
    });

    viewerSocket.on('theme:update', (data) => {
      expect(data.theme).toBeDefined();
      expect(data.theme.name).toBe('Classic');
      done();
    });
  });

  it('should clear theme when null themeId', (done) => {
    operatorSocket = createClient();
    viewerSocket = createClient();

    operatorSocket.on('connect', () => {
      operatorSocket.emit('operator:join', {
        userId: testUser.id,
        roomId: testRoom.id
      });
    });

    operatorSocket.on('operator:joined', () => {
      viewerSocket.emit('viewer:join', { pin: 'SOCK' });
    });

    viewerSocket.on('viewer:joined', () => {
      operatorSocket.emit('operator:applyTheme', {
        roomId: testRoom.id,
        themeId: null
      });
    });

    viewerSocket.on('theme:update', (data) => {
      expect(data.theme).toBeNull();
      done();
    });
  });

  it('should emit error for non-existent theme', (done) => {
    operatorSocket = createClient();

    operatorSocket.on('connect', () => {
      operatorSocket.emit('operator:join', {
        userId: testUser.id,
        roomId: testRoom.id
      });
    });

    operatorSocket.on('operator:joined', () => {
      operatorSocket.emit('operator:applyTheme', {
        roomId: testRoom.id,
        themeId: '00000000-0000-0000-0000-000000000999'
      });
    });

    operatorSocket.on('error', (data) => {
      expect(data.message).toContain('not found');
      done();
    });
  });
});

// ============================================
// LOCAL VIDEO TESTS
// ============================================

describe('Local Video', () => {
  it('should broadcast local video start', (done) => {
    operatorSocket = createClient();
    viewerSocket = createClient();

    operatorSocket.on('connect', () => {
      operatorSocket.emit('operator:join', {
        userId: testUser.id,
        roomId: testRoom.id
      });
    });

    operatorSocket.on('operator:joined', () => {
      viewerSocket.emit('viewer:join', { pin: 'SOCK' });
    });

    viewerSocket.on('viewer:joined', () => {
      operatorSocket.emit('operator:localVideo', {
        roomId: testRoom.id,
        videoData: {
          fileName: 'worship-video.mp4',
          isPlaying: true
        }
      });
    });

    viewerSocket.on('localVideo:update', (data) => {
      expect(data.fileName).toBe('worship-video.mp4');
      expect(data.isPlaying).toBe(true);
      done();
    });
  });

  it('should broadcast local video stop', (done) => {
    operatorSocket = createClient();
    viewerSocket = createClient();

    operatorSocket.on('connect', () => {
      operatorSocket.emit('operator:join', {
        userId: testUser.id,
        roomId: testRoom.id
      });
    });

    operatorSocket.on('operator:joined', () => {
      viewerSocket.emit('viewer:join', { pin: 'SOCK' });
    });

    viewerSocket.on('viewer:joined', () => {
      operatorSocket.emit('operator:stopLocalVideo', {
        roomId: testRoom.id
      });
    });

    viewerSocket.on('localVideo:stop', () => {
      // Event received, test passes
      done();
    });
  });
});

// ============================================
// HEARTBEAT TESTS
// ============================================

describe('Heartbeat', () => {
  it('should respond to ping with pong', (done) => {
    operatorSocket = createClient();
    const timestamp = Date.now();

    operatorSocket.on('connect', () => {
      operatorSocket.emit('ping', timestamp);
    });

    operatorSocket.on('pong', (receivedTimestamp) => {
      expect(receivedTimestamp).toBe(timestamp);
      done();
    });
  });

  it('should measure latency accurately', (done) => {
    operatorSocket = createClient();
    const sentTime = Date.now();

    operatorSocket.on('connect', () => {
      operatorSocket.emit('ping', sentTime);
    });

    operatorSocket.on('pong', (receivedTimestamp) => {
      const latency = Date.now() - receivedTimestamp;
      expect(latency).toBeLessThan(1000); // Should be less than 1 second
      done();
    });
  });
});

// ============================================
// MULTIPLE VIEWERS TESTS
// ============================================

describe('Multiple Viewers', () => {
  it('should broadcast to all viewers in room', (done) => {
    operatorSocket = createClient();
    const viewer1 = createClient();
    const viewer2 = createClient();
    let receivedCount = 0;

    operatorSocket.on('connect', () => {
      operatorSocket.emit('operator:join', {
        userId: testUser.id,
        roomId: testRoom.id
      });
    });

    operatorSocket.on('operator:joined', () => {
      viewer1.emit('viewer:join', { pin: 'SOCK' });
      viewer2.emit('viewer:join', { pin: 'SOCK' });
    });

    let viewer1Joined = false;
    let viewer2Joined = false;

    viewer1.on('viewer:joined', () => {
      viewer1Joined = true;
      if (viewer1Joined && viewer2Joined) sendSlide();
    });

    viewer2.on('viewer:joined', () => {
      viewer2Joined = true;
      if (viewer1Joined && viewer2Joined) sendSlide();
    });

    const sendSlide = () => {
      operatorSocket.emit('operator:updateSlide', {
        roomId: testRoom.id,
        roomPin: 'SOCK',
        slideIndex: 1,
        isBlank: false
      });
    };

    viewer1.on('slide:update', () => {
      receivedCount++;
      if (receivedCount === 2) {
        viewer1.close();
        viewer2.close();
        done();
      }
    });

    viewer2.on('slide:update', () => {
      receivedCount++;
      if (receivedCount === 2) {
        viewer1.close();
        viewer2.close();
        done();
      }
    });
  });
});

// ============================================
// ERROR HANDLING TESTS
// ============================================

describe('Error Handling', () => {
  it('should handle malformed data gracefully', (done) => {
    operatorSocket = createClient();

    operatorSocket.on('connect', () => {
      operatorSocket.emit('operator:updateSlide', null);
    });

    // Should not crash, wait a bit to ensure
    setTimeout(() => {
      expect(operatorSocket.connected).toBe(true);
      done();
    }, 500);
  });

  it('should handle rapid events', (done) => {
    operatorSocket = createClient();
    let eventsReceived = 0;

    operatorSocket.on('connect', () => {
      operatorSocket.emit('operator:join', {
        userId: testUser.id,
        roomId: testRoom.id
      });
    });

    operatorSocket.on('operator:joined', () => {
      // Send 10 rapid slide updates
      for (let i = 0; i < 10; i++) {
        operatorSocket.emit('operator:updateSlide', {
          roomId: testRoom.id,
          roomPin: 'SOCK',
          slideIndex: i,
          isBlank: false
        });
      }
    });

    operatorSocket.on('slide:update', () => {
      eventsReceived++;
      if (eventsReceived === 10) {
        done();
      }
    });
  });
});

console.log('Socket Events tests loaded successfully');
