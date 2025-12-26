require('dotenv').config();
const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');
const session = require('express-session');
const multer = require('multer');
const compression = require('compression');
const helmet = require('helmet');
const { sequelize, Room, Song, PublicRoom, ViewerTheme } = require('./models');
const passport = require('./config/passport');

// Import routes
const authRoutes = require('./routes/auth');
const songRoutes = require('./routes/songs');
const roomRoutes = require('./routes/rooms');
const setlistRoutes = require('./routes/setlists');
const adminRoutes = require('./routes/admin');
const mediaRoutes = require('./routes/media');
const bibleRoutes = require('./routes/bible');
const publicRoomsRoutes = require('./routes/publicRooms');
const viewerThemesRoutes = require('./routes/viewerThemes');
const remoteScreensRoutes = require('./routes/remoteScreens');
const screenAccessRoutes = require('./routes/screenAccess');

// Import cleanup jobs
const cleanupTemporarySetlists = require('./jobs/cleanupTemporarySetlists');
const cleanupExpiredRooms = require('./jobs/cleanupExpiredRooms');

const app = express();

// In development, allow any origin for local network testing (Chromecast)
// In production, use specific allowed origins
const isDevelopment = process.env.NODE_ENV !== 'production';

// Create HTTPS server in development for Chromecast support
let server;
if (isDevelopment) {
  try {
    const certPath = path.join(__dirname, 'certs', 'cert.pem');
    const keyPath = path.join(__dirname, 'certs', 'key.pem');

    if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
      const httpsOptions = {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath)
      };
      server = https.createServer(httpsOptions, app);
      console.log('🔒 HTTPS server created for development');
    } else {
      server = http.createServer(app);
      console.log('📦 HTTP server created (certificates not found)');
    }
  } catch (error) {
    console.error('Error loading SSL certificates:', error);
    server = http.createServer(app);
    console.log('📦 HTTP server created (fallback)');
  }
} else {
  server = http.createServer(app);
  console.log('📦 HTTP server created for production');
}

const allowedOrigins = [
  'http://localhost:3456',
  'https://localhost:3456',
  'http://localhost:3000',
  'https://localhost:3000',
  'http://10.100.102.27:3456',
  'https://10.100.102.27:3456',
  'https://main.d390gabr466gfy.amplifyapp.com',
  'https://d125ckyjvo1azi.cloudfront.net',
  'https://solupresenter-frontend.onrender.com',
  'https://solucast.app',
  'http://solucast.app',
  process.env.FRONTEND_URL
].filter(Boolean);

const corsOptions = {
  origin: isDevelopment ? true : allowedOrigins, // Allow all origins in development
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
};

const io = new Server(server, {
  cors: corsOptions,
  // Performance optimizations
  pingInterval: 10000,        // Ping every 10s (faster disconnect detection)
  pingTimeout: 5000,          // 5s timeout for pong response
  perMessageDeflate: false,   // Disable compression (faster for small messages)
  httpCompression: false,     // Disable HTTP compression
  transports: ['websocket', 'polling'],  // Prefer WebSocket
  allowUpgrades: true
});

// Make io accessible to routes
app.set('io', io);

// Connect to PostgreSQL
sequelize.authenticate()
  .then(async () => {
    console.log('✅ PostgreSQL connection established successfully');
    // Sync database schema (create tables if they don't exist)
    // Use alter: true to add new columns to existing tables
    await sequelize.sync({ alter: true });
    console.log('✅ Database models ready');

    // Seed the Classic theme if it doesn't exist
    await ViewerTheme.seedClassicTheme();
  })
  .catch(err => {
    console.error('❌ Unable to connect to PostgreSQL:', err);
    process.exit(1);
  });

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin resources
  contentSecurityPolicy: false // Disable CSP for now (can be configured later)
})); // Security headers
app.use(compression()); // Enable gzip compression
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Serve uploaded files statically
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/auth', authRoutes);
app.use('/api/songs', songRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/setlists', setlistRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/bible', bibleRoutes);
app.use('/api/public-rooms', publicRoomsRoutes);
app.use('/api/viewer-themes', viewerThemesRoutes);
app.use('/api/remote-screens', remoteScreensRoutes);
app.use('/api/screen-access', screenAccessRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);

  if (err instanceof multer.MulterError) {
    // Multer-specific errors
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 5MB per file.' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Too many files. Maximum is 50 files.' });
    }
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }

  // Other errors
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Socket.IO for real-time room synchronization
const operatorSockets = new Map(); // Map of userId -> socketId
const viewerRooms = new Map(); // Map of socketId -> roomPin
const roomToolsData = new Map(); // Map of roomPin -> toolsData (for new viewers)
const roomActiveTheme = new Map(); // Map of roomPin -> theme (for new viewers)

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Operator joins their room
  socket.on('operator:join', async (data) => {
    try {
      const { userId, roomId } = data;

      const room = await Room.findByPk(roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      // Join socket room
      socket.join(`room:${room.pin}`);
      operatorSockets.set(userId, socket.id);

      socket.emit('operator:joined', {
        roomPin: room.pin,
        quickSlideText: room.quickSlideText || ''
      });
      console.log(`Operator ${userId} joined room ${room.pin}`);
    } catch (error) {
      console.error('Error in operator:join:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  // Viewer joins a room
  socket.on('viewer:join', async (data) => {
    try {
      const { pin, slug } = data || {};

      // Validate that either pin or slug is provided
      if (!pin && !slug) {
        socket.emit('error', { message: 'Room PIN or name is required' });
        return;
      }

      let room;

      // If slug is provided, look up the public room first
      if (slug) {
        const publicRoom = await PublicRoom.findOne({
          where: { slug: slug.toLowerCase() }
        });

        if (!publicRoom) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }

        if (!publicRoom.activeRoomId) {
          socket.emit('error', { message: 'Room is not currently live', roomName: publicRoom.name });
          return;
        }

        room = await Room.findOne({
          where: { id: publicRoom.activeRoomId, isActive: true },
          attributes: ['id', 'pin', 'currentSlide', 'currentImageUrl', 'currentBibleData', 'backgroundImage', 'viewerCount', 'activeThemeId']
        });
      } else {
        // Otherwise, look up by PIN
        room = await Room.findOne({
          where: { pin: pin.toUpperCase(), isActive: true },
          attributes: ['id', 'pin', 'currentSlide', 'currentImageUrl', 'currentBibleData', 'backgroundImage', 'viewerCount', 'activeThemeId']
        });
      }

      if (!room) {
        socket.emit('error', { message: 'Room not found or inactive' });
        return;
      }

      // Check room capacity
      if (room.viewerCount >= 500) {
        socket.emit('error', { message: 'Room is at capacity' });
        return;
      }

      // Join socket room
      socket.join(`room:${room.pin}`);
      viewerRooms.set(socket.id, room.pin);

      // Increment viewer count (atomic operation)
      await Room.increment('viewerCount', { where: { id: room.id } });

      // Fetch current slide data if available
      let slideData = null;
      let imageUrl = null;

      if (room.currentSlide && !room.currentSlide.isBlank) {
        // Check if there's a stored image URL
        if (room.currentImageUrl) {
          imageUrl = room.currentImageUrl;
        }
        // Check if there's stored slide data (can be Bible or song data)
        else if (room.currentBibleData) {
          slideData = {
            slide: room.currentBibleData.slide,
            combinedSlides: room.currentBibleData.combinedSlides || null, // For original-only mode paired slides
            displayMode: room.currentSlide.displayMode,
            songTitle: room.currentBibleData.title,
            backgroundImage: room.backgroundImage || '',
            isBible: room.currentBibleData.isBible || false,
            isTemporary: room.currentBibleData.isTemporary || false,
            originalLanguage: room.currentBibleData.originalLanguage || 'en'
          };
        }
        // Otherwise, fetch song from database (only needed fields)
        else if (room.currentSlide.songId) {
          const song = await Song.findByPk(room.currentSlide.songId, {
            attributes: ['title', 'slides', 'originalLanguage'],
            raw: true
          });
          if (song && song.slides[room.currentSlide.slideIndex]) {
            slideData = {
              slide: song.slides[room.currentSlide.slideIndex],
              displayMode: room.currentSlide.displayMode,
              songTitle: song.title,
              backgroundImage: room.backgroundImage || '',
              isBible: false,
              originalLanguage: song.originalLanguage || 'en'
            };
          }
        }
      }

      // Load theme from memory cache or database
      let theme = roomActiveTheme.get(room.pin) || null;
      if (!theme && room.activeThemeId) {
        // Theme not in cache but room has activeThemeId - load from database
        const dbTheme = await ViewerTheme.findByPk(room.activeThemeId);
        if (dbTheme) {
          theme = dbTheme.toJSON();
          // Cache for future viewers
          roomActiveTheme.set(room.pin, theme);
        }
      }

      // Send current slide to viewer
      const viewerJoinedData = {
        roomPin: room.pin,
        currentSlide: room.currentSlide,
        slideData: slideData,
        imageUrl: imageUrl,
        isBlank: room.currentSlide?.isBlank || false,
        backgroundImage: room.backgroundImage || '',
        toolsData: roomToolsData.get(room.pin) || null,
        theme: theme
      };

      console.log(`📤 Sending to viewer:`, JSON.stringify(viewerJoinedData, null, 2));
      socket.emit('viewer:joined', viewerJoinedData);

      // Notify operator of viewer count
      io.to(`room:${room.pin}`).emit('room:viewerCount', { count: room.viewerCount + 1 });

      console.log(`Viewer joined room ${room.pin}, total viewers: ${room.viewerCount + 1}`);
    } catch (error) {
      console.error('Error in viewer:join:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  // Operator updates slide
  socket.on('operator:updateSlide', async (data) => {
    try {
      const { roomId, roomPin, backgroundImage: clientBackgroundImage, songId, slideIndex, displayMode, isBlank, imageUrl, bibleData, slideData, nextSlideData, toolsData } = data;

      // Use PIN from client if available (fast path), otherwise query DB (fallback)
      let pin = roomPin;
      let backgroundImage = clientBackgroundImage;

      if (!pin) {
        // Fallback: Query DB for room info
        const room = await Room.findByPk(roomId, {
          attributes: ['id', 'pin', 'backgroundImage'],
          raw: true
        });

        if (!room) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }
        pin = room.pin;
        backgroundImage = room.backgroundImage || '';
      }

      // Prepare slide data for broadcast
      const currentSlideData = {
        songId: (isBlank || slideData?.isTemporary || bibleData || (songId && (songId.startsWith('bible-') || songId.startsWith('quick-')))) ? null : songId,
        slideIndex: slideIndex || 0,
        displayMode: displayMode || 'bilingual',
        isBlank: isBlank || false
      };

      // Use provided slide data (no DB query needed!)
      let broadcastSlideData = null;
      if (!isBlank && !imageUrl) {
        if (slideData) {
          // Use slide data sent from frontend (new optimized path)
          broadcastSlideData = {
            slide: slideData.slide,
            combinedSlides: slideData.combinedSlides || null, // For original-only mode paired slides
            displayMode: currentSlideData.displayMode,
            songTitle: slideData.title,
            backgroundImage: backgroundImage || '',
            isBible: slideData.isBible || false,
            originalLanguage: slideData.originalLanguage || 'en'
          };
        } else if (bibleData) {
          // Legacy: Use Bible data directly (for backward compatibility)
          broadcastSlideData = {
            slide: bibleData.slide,
            displayMode: currentSlideData.displayMode,
            songTitle: bibleData.title,
            backgroundImage: backgroundImage || '',
            isBible: true,
            originalLanguage: bibleData.originalLanguage || 'he'
          };
        } else if (songId) {
          // Fallback: Fetch song from database (for backward compatibility)
          const song = await Song.findByPk(songId, {
            attributes: ['title', 'slides', 'originalLanguage'],
            raw: true
          });
          if (song && song.slides[slideIndex]) {
            broadcastSlideData = {
              slide: song.slides[slideIndex],
              displayMode: currentSlideData.displayMode,
              songTitle: song.title,
              backgroundImage: backgroundImage || '',
              originalLanguage: song.originalLanguage || 'en'
            };
          }
        }
      }

      // Store tools data in memory for new viewers
      if (toolsData) {
        roomToolsData.set(pin, toolsData);
      } else {
        roomToolsData.delete(pin);
      }

      // 🚀 BROADCAST IMMEDIATELY - no DB query needed when PIN is provided!
      io.to(`room:${pin}`).emit('slide:update', {
        currentSlide: currentSlideData,
        slideData: broadcastSlideData,
        nextSlideData: nextSlideData || null,  // For stage monitors
        isBlank,
        imageUrl: imageUrl || null,
        backgroundImage: backgroundImage || '',
        toolsData: toolsData || null
      });

      // 💾 Save to database asynchronously (don't block broadcast)
      setImmediate(async () => {
        try {
          const roomToUpdate = await Room.findByPk(roomId);
          if (roomToUpdate) {
            roomToUpdate.currentSlide = currentSlideData;
            roomToUpdate.currentImageUrl = imageUrl || null;
            roomToUpdate.currentBibleData = bibleData || slideData || null;
            await roomToUpdate.updateActivity();
          }
        } catch (err) {
          console.error('⚠️ Error saving room state to DB:', err);
        }
      });

    } catch (error) {
      console.error('Error in operator:updateSlide:', error);
      socket.emit('error', { message: 'Failed to update slide' });
    }
  });

  // Operator updates background
  socket.on('operator:updateBackground', async (data) => {
    console.log('📥 Received operator:updateBackground event:', data);
    try {
      const { roomId, backgroundImage } = data;

      const room = await Room.findByPk(roomId);

      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      // Update room's background
      room.backgroundImage = backgroundImage || '';
      await room.save();

      // Broadcast to all viewers in the room
      io.to(`room:${room.pin}`).emit('background:update', {
        backgroundImage: room.backgroundImage
      });

      console.log(`Background updated in room ${room.pin}`);
    } catch (error) {
      console.error('Error in operator:updateBackground:', error);
      socket.emit('error', { message: 'Failed to update background' });
    }
  });

  // Operator updates quick slide text
  socket.on('operator:updateQuickSlideText', async (data) => {
    console.log('📥 Received operator:updateQuickSlideText event');
    try {
      const { roomId, quickSlideText } = data;

      const room = await Room.findByPk(roomId);

      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      // Update room's quick slide text
      room.quickSlideText = quickSlideText || '';
      await room.save();

      console.log(`Quick slide text updated in room ${room.pin}`);
    } catch (error) {
      console.error('Error in operator:updateQuickSlideText:', error);
      socket.emit('error', { message: 'Failed to update quick slide text' });
    }
  });

  // Handle local video broadcast (for HDMI display only)
  socket.on('operator:localVideo', async (data) => {
    try {
      const { roomId, videoData } = data;
      const room = await Room.findByPk(roomId);

      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      console.log(`📺 Broadcasting local video to room ${room.pin}: ${videoData.fileName}`);

      // Broadcast to all viewers in the room (local viewers will display, online viewers can ignore)
      io.to(`room:${room.pin}`).emit('localVideo:update', videoData);
    } catch (error) {
      console.error('Error in operator:localVideo:', error);
      socket.emit('error', { message: 'Failed to broadcast local video' });
    }
  });

  // Handle stop local video
  socket.on('operator:stopLocalVideo', async (data) => {
    try {
      const { roomId } = data;
      const room = await Room.findByPk(roomId);

      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      console.log(`🛑 Stopping local video in room ${room.pin}`);
      io.to(`room:${room.pin}`).emit('localVideo:stop');
    } catch (error) {
      console.error('Error in operator:stopLocalVideo:', error);
    }
  });

  // Operator applies a viewer theme
  socket.on('operator:applyTheme', async (data) => {
    try {
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
      }

      // Store theme in memory for new viewers
      if (theme) {
        roomActiveTheme.set(room.pin, theme.toJSON());
      } else {
        roomActiveTheme.delete(room.pin);
      }

      // 🚀 Broadcast immediately to all viewers
      io.to(`room:${room.pin}`).emit('theme:update', {
        theme: theme ? theme.toJSON() : null
      });

      console.log(`Theme ${themeId || 'none'} applied to room ${room.pin}`);

      // 💾 Save to database asynchronously
      setImmediate(async () => {
        try {
          room.activeThemeId = themeId || null;
          await room.save();
        } catch (err) {
          console.error('⚠️ Error saving theme to DB:', err);
        }
      });

    } catch (error) {
      console.error('Error in operator:applyTheme:', error);
      socket.emit('error', { message: 'Failed to apply theme' });
    }
  });

  // Heartbeat - ping/pong
  socket.on('ping', (timestamp) => {
    socket.emit('pong', timestamp);
  });

  // Handle disconnect
  socket.on('disconnect', async () => {
    try {
      // Check if this was a viewer
      const roomPin = viewerRooms.get(socket.id);
      if (roomPin) {
        // Atomic decrement of viewer count
        await Room.decrement('viewerCount', { where: { pin: roomPin } });

        const room = await Room.findOne({
          where: { pin: roomPin },
          attributes: ['viewerCount']
        });

        if (room) {
          // Notify operator of viewer count
          io.to(`room:${roomPin}`).emit('room:viewerCount', { count: Math.max(0, room.viewerCount) });
          console.log(`Viewer left room ${roomPin}, remaining viewers: ${Math.max(0, room.viewerCount)}`);
        }
        viewerRooms.delete(socket.id);
      }

      // Check if this was an operator
      for (const [userId, socketId] of operatorSockets.entries()) {
        if (socketId === socket.id) {
          operatorSockets.delete(userId);
          break;
        }
      }

      console.log('Client disconnected:', socket.id);
    } catch (error) {
      console.error('Error in disconnect:', error);
    }
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  // Defer cleanup jobs to run 30 seconds after startup (faster cold starts)
  setTimeout(() => {
    cleanupTemporarySetlists();
    cleanupExpiredRooms();
    console.log('✅ Initial cleanup completed');
  }, 30000);

  // Schedule cleanup jobs
  setInterval(cleanupTemporarySetlists, 60 * 60 * 1000); // Run every hour
  setInterval(cleanupExpiredRooms, 15 * 60 * 1000); // Run every 15 minutes
  console.log('✅ Scheduled cleanup jobs:');
  console.log('   - Temporary setlists: every hour');
  console.log('   - Expired rooms: every 15 minutes');
});

module.exports = { app, server, io };

