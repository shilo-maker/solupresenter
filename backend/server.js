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
const { sequelize, Room, Song, PublicRoom, ViewerTheme, StageMonitorTheme, User } = require('./models');
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
const stageMonitorThemesRoutes = require('./routes/stageMonitorThemes');
const remoteScreensRoutes = require('./routes/remoteScreens');
const screenAccessRoutes = require('./routes/screenAccess');
const presentationsRoutes = require('./routes/presentations');
const quickSlideRoutes = require('./routes/quickSlide');

// Import cleanup jobs
const cleanupTemporarySetlists = require('./jobs/cleanupTemporarySetlists');
const cleanupExpiredRooms = require('./jobs/cleanupExpiredRooms');

// Global error handlers for production stability
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit - let the server continue running
});

process.on('uncaughtException', (error) => {
  console.error('⚠️ Uncaught Exception:', error);
  // For critical errors, log and continue - the server should try to stay up
  // Only exit for truly fatal errors that corrupt state
  if (error.message && error.message.includes('FATAL')) {
    console.error('Fatal error detected, shutting down gracefully...');
    process.exit(1);
  }
});

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
    await StageMonitorTheme.seedBuiltInThemes();
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
app.use('/api/stage-monitor-themes', stageMonitorThemesRoutes);
app.use('/api/remote-screens', remoteScreensRoutes);
app.use('/api/screen-access', screenAccessRoutes);
app.use('/api/presentations', presentationsRoutes);
app.use('/api/quick-slide', quickSlideRoutes);

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
const roomRenderedHtml = new Map(); // Map of roomPin -> { html, dimensions } (for late-joining viewers)
const roomActiveTheme = new Map(); // Map of roomPin -> theme (for new viewers)
const roomActiveBibleTheme = new Map(); // Map of roomPin -> bible theme (for new viewers)
const roomActivePrayerTheme = new Map(); // Map of roomPin -> prayer theme (for new viewers)
const midiBridgeSockets = new Map(); // Map of socketId -> roomPin (for MIDI bridge connections)

io.on('connection', (socket) => {
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
          attributes: ['id', 'pin', 'operatorId', 'currentSlide', 'currentImageUrl', 'currentBibleData', 'currentPresentationData', 'backgroundImage', 'viewerCount', 'activeThemeId']
        });
      } else {
        // Otherwise, look up by PIN
        room = await Room.findOne({
          where: { pin: pin.toUpperCase(), isActive: true },
          attributes: ['id', 'pin', 'operatorId', 'currentSlide', 'currentImageUrl', 'currentBibleData', 'currentPresentationData', 'backgroundImage', 'viewerCount', 'activeThemeId']
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

      // Load viewer theme from memory cache or database
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

      // Load operator's default stage monitor theme
      let stageMonitorTheme = null;
      if (room.operatorId) {
        const operator = await User.findByPk(room.operatorId, { attributes: ['preferences'] });
        if (operator?.preferences?.defaultStageMonitorThemeId) {
          const smTheme = await StageMonitorTheme.findByPk(operator.preferences.defaultStageMonitorThemeId);
          if (smTheme) {
            stageMonitorTheme = smTheme.toJSON();
          }
        }
        // Fallback to built-in classic dark if no default set
        if (!stageMonitorTheme) {
          const classicTheme = await StageMonitorTheme.findOne({ where: { isBuiltIn: true } });
          if (classicTheme) {
            stageMonitorTheme = classicTheme.toJSON();
          }
        }
      }

      // Send current slide to viewer
      const viewerJoinedData = {
        roomPin: room.pin,
        operatorId: room.operatorId,
        currentSlide: room.currentSlide,
        slideData: slideData,
        imageUrl: imageUrl,
        isBlank: room.currentSlide?.isBlank || false,
        backgroundImage: room.backgroundImage || '',
        toolsData: roomToolsData.get(room.pin) || null,
        presentationData: room.currentPresentationData || null,
        renderedHtml: roomRenderedHtml.get(room.pin)?.html || null,
        renderedHtmlDimensions: roomRenderedHtml.get(room.pin)?.dimensions || null,
        theme: theme,
        bibleTheme: roomActiveBibleTheme.get(room.pin) || null,
        prayerTheme: roomActivePrayerTheme.get(room.pin) || null,
        stageMonitorTheme: stageMonitorTheme
      };

      socket.emit('viewer:joined', viewerJoinedData);

      // Notify operator of viewer count
      io.to(`room:${room.pin}`).emit('room:viewerCount', { count: room.viewerCount + 1 });
    } catch (error) {
      console.error('Error in viewer:join:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  // Operator updates slide
  socket.on('operator:updateSlide', async (data) => {
    try {
      const { roomId, roomPin, backgroundImage: clientBackgroundImage, songId, slideIndex, displayMode, isBlank, imageUrl, bibleData, slideData, nextSlideData, toolsData, presentationData } = data;

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
            isPrayer: slideData.isPrayer || false,
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
        toolsData: toolsData || null,
        presentationData: presentationData || null
      });

      // 💾 Save to database asynchronously (don't block broadcast)
      setImmediate(async () => {
        try {
          const roomToUpdate = await Room.findByPk(roomId);
          if (roomToUpdate) {
            roomToUpdate.currentSlide = currentSlideData;
            roomToUpdate.currentImageUrl = imageUrl || null;
            roomToUpdate.currentBibleData = bibleData || slideData || null;
            roomToUpdate.currentPresentationData = presentationData || null;
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

  // Operator sends rendered HTML (arrives separately after display window renders)
  socket.on('operator:renderedHtml', (data) => {
    const { roomPin, renderedHtml, renderedHtmlDimensions } = data;
    if (!roomPin || !renderedHtml) return;

    // Store for late-joining viewers
    roomRenderedHtml.set(roomPin, { html: renderedHtml, dimensions: renderedHtmlDimensions });

    // Broadcast to all viewers in the room
    io.to(`room:${roomPin}`).emit('renderedHtml:update', {
      renderedHtml,
      renderedHtmlDimensions
    });
  });

  // Operator updates background
  socket.on('operator:updateBackground', async (data) => {
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
    } catch (error) {
      console.error('Error in operator:updateBackground:', error);
      socket.emit('error', { message: 'Failed to update background' });
    }
  });

  // Operator updates quick slide text
  socket.on('operator:updateQuickSlideText', async (data) => {
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

      io.to(`room:${room.pin}`).emit('localVideo:stop');
    } catch (error) {
      console.error('Error in operator:stopLocalVideo:', error);
    }
  });


  // ==================== YouTube Video Handlers ====================

  // Load YouTube video for viewers
  socket.on('operator:youtubeLoad', async (data) => {
    try {
      const { roomId, videoId, title } = data;
      const room = await Room.findByPk(roomId);

      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      io.to(`room:${room.pin}`).emit('youtube:load', { videoId, title });
    } catch (error) {
      console.error('Error in operator:youtubeLoad:', error);
      socket.emit('error', { message: 'Failed to load YouTube video' });
    }
  });

  // Play YouTube video
  socket.on('operator:youtubePlay', async (data) => {
    try {
      const { roomId, currentTime } = data;
      const room = await Room.findByPk(roomId);

      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      io.to(`room:${room.pin}`).emit('youtube:play', { currentTime });
    } catch (error) {
      console.error('Error in operator:youtubePlay:', error);
    }
  });

  // Pause YouTube video
  socket.on('operator:youtubePause', async (data) => {
    try {
      const { roomId, currentTime } = data;
      const room = await Room.findByPk(roomId);

      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      io.to(`room:${room.pin}`).emit('youtube:pause', { currentTime });
    } catch (error) {
      console.error('Error in operator:youtubePause:', error);
    }
  });

  // Seek YouTube video
  socket.on('operator:youtubeSeek', async (data) => {
    try {
      const { roomId, currentTime } = data;
      const room = await Room.findByPk(roomId);

      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      io.to(`room:${room.pin}`).emit('youtube:seek', { currentTime });
    } catch (error) {
      console.error('Error in operator:youtubeSeek:', error);
    }
  });

  // Stop YouTube video (clear from display)
  socket.on('operator:youtubeStop', async (data) => {
    try {
      const { roomId } = data;
      const room = await Room.findByPk(roomId);

      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      io.to(`room:${room.pin}`).emit('youtube:stop');
    } catch (error) {
      console.error('Error in operator:youtubeStop:', error);
    }
  });

  // Sync YouTube playback state
  socket.on('operator:youtubeSync', async (data) => {
    try {
      const { roomId, currentTime, isPlaying } = data;
      const room = await Room.findByPk(roomId);

      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      io.to(`room:${room.pin}`).emit('youtube:sync', { currentTime, isPlaying });
    } catch (error) {
      console.error('Error in operator:youtubeSync:', error);
    }
  });

  // Viewer signals their YouTube player is ready
  socket.on('viewer:youtubeReady', async (data) => {
    try {
      const { roomPin } = data;
      // Notify operator that viewer's YouTube is ready
      io.to(`room:${roomPin}`).emit('viewer:youtubeReady', { roomPin });
    } catch (error) {
      console.error('Error in viewer:youtubeReady:', error);
    }
  });

  // ==================== End YouTube Handlers ====================

  // Operator applies a viewer theme
  socket.on('operator:applyTheme', async (data) => {
    try {
      const { roomId, roomPin, themeId, theme: clientTheme } = data;

      // Support both roomId (web app) and roomPin (desktop app)
      let pin = roomPin;
      let room = null;

      if (roomId) {
        room = await Room.findByPk(roomId);
        if (room) pin = room.pin;
      }

      if (!pin) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      let themeData = null;

      // Desktop app sends full theme object directly
      if (clientTheme) {
        themeData = clientTheme;
      }
      // Web app sends themeId to look up from database
      else if (themeId) {
        const theme = await ViewerTheme.findByPk(themeId);
        if (!theme) {
          socket.emit('error', { message: 'Theme not found' });
          return;
        }
        themeData = theme.toJSON();
      }

      // Store theme in memory for new viewers
      if (themeData) {
        roomActiveTheme.set(pin, themeData);
      } else {
        roomActiveTheme.delete(pin);
      }

      // 🚀 Broadcast immediately to all viewers
      io.to(`room:${pin}`).emit('theme:update', {
        theme: themeData
      });

      // 💾 Save to database asynchronously (only if we have roomId)
      if (roomId && room) {
        setImmediate(async () => {
          try {
            room.activeThemeId = themeId || null;
            await room.save();
          } catch (err) {
            console.error('⚠️ Error saving theme to DB:', err);
          }
        });
      }

    } catch (error) {
      console.error('Error in operator:applyTheme:', error);
      socket.emit('error', { message: 'Failed to apply theme' });
    }
  });

  // Operator applies a Bible viewer theme
  socket.on('operator:applyBibleTheme', async (data) => {
    try {
      const { roomPin, theme } = data;
      if (!roomPin) return;

      if (theme) {
        roomActiveBibleTheme.set(roomPin, theme);
      } else {
        roomActiveBibleTheme.delete(roomPin);
      }

      io.to(`room:${roomPin}`).emit('bibleTheme:update', { theme });
    } catch (error) {
      console.error('Error in operator:applyBibleTheme:', error);
    }
  });

  // Operator applies a Prayer viewer theme
  socket.on('operator:applyPrayerTheme', async (data) => {
    try {
      const { roomPin, theme } = data;
      if (!roomPin) return;

      if (theme) {
        roomActivePrayerTheme.set(roomPin, theme);
      } else {
        roomActivePrayerTheme.delete(roomPin);
      }

      io.to(`room:${roomPin}`).emit('prayerTheme:update', { theme });
    } catch (error) {
      console.error('Error in operator:applyPrayerTheme:', error);
    }
  });

  // Operator updates local media status (to show overlay on online viewers)
  socket.on('operator:localMediaStatus', async (data) => {
    try {
      const { roomId, visible } = data;

      const room = await Room.findByPk(roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      // Broadcast to all viewers in the room
      io.to(`room:${room.pin}`).emit('localMedia:status', {
        visible
      });
    } catch (error) {
      console.error('Error in operator:localMediaStatus:', error);
      socket.emit('error', { message: 'Failed to update local media status' });
    }
  });

  // Operator updates tools (countdown, clock, stopwatch, announcement, rotating messages)
  socket.on('operator:updateTool', async (data) => {
    try {
      const { roomId, roomPin, toolData } = data;

      // Support both roomId (web app) and roomPin (desktop app)
      let pin = roomPin;

      if (roomId && !roomPin) {
        const room = await Room.findByPk(roomId);
        if (room) pin = room.pin;
      }

      if (!pin) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      // Validate tool type
      const validToolTypes = ['countdown', 'announcement', 'rotatingMessages', 'clock', 'stopwatch'];
      if (!toolData || !toolData.type || !validToolTypes.includes(toolData.type)) {
        console.error('Invalid tool data received:', toolData);
        socket.emit('error', { message: 'Invalid tool data' });
        return;
      }

      // Store tool data for new viewers joining later
      if (toolData.active) {
        roomToolsData.set(pin, toolData);
      } else {
        roomToolsData.delete(pin);
      }

      // Broadcast to all viewers in the room
      io.to(`room:${pin}`).emit('tools:update', toolData);
    } catch (error) {
      console.error('Error in operator:updateTool:', error);
      socket.emit('error', { message: 'Failed to update tool' });
    }
  });

  // ==================== MIDI Bridge Handlers ====================

  // MIDI bridge joins a room
  socket.on('midi:join', async (data) => {
    try {
      const { pin } = data || {};
      if (!pin) {
        socket.emit('midi:error', { message: 'Room PIN is required' });
        return;
      }

      const room = await Room.findOne({
        where: { pin: pin.toUpperCase(), isActive: true },
        attributes: ['id', 'pin']
      });

      if (!room) {
        socket.emit('midi:error', { message: 'Room not found or inactive' });
        return;
      }

      socket.join(`room:${room.pin}`);
      midiBridgeSockets.set(socket.id, room.pin);

      socket.emit('midi:joined', { roomPin: room.pin });
    } catch (error) {
      console.error('Error in midi:join:', error);
      socket.emit('midi:error', { message: 'Failed to join room' });
    }
  });

  // MIDI bridge sends a command (relayed to operator's room)
  socket.on('midi:command', (data) => {
    try {
      const roomPin = midiBridgeSockets.get(socket.id);
      if (!roomPin) {
        socket.emit('midi:error', { message: 'Not connected to a room' });
        return;
      }

      if (data && data.command && typeof data.command === 'object' && data.command.type) {
        io.to(`room:${roomPin}`).emit('midi:command', { command: data.command });
      }
    } catch (error) {
      console.error('Error in midi:command:', error);
    }
  });

  // MIDI bridge explicitly leaves a room
  socket.on('midi:leave', () => {
    const roomPin = midiBridgeSockets.get(socket.id);
    if (roomPin) {
      socket.leave(`room:${roomPin}`);
      midiBridgeSockets.delete(socket.id);
    }
  });

  // Operator broadcasts setlist summary for MIDI bridges
  socket.on('operator:updateSetlistSummary', (data) => {
    try {
      const { roomPin, setlist } = data || {};
      if (roomPin && Array.isArray(setlist)) {
        io.to(`room:${roomPin}`).emit('setlist:summary', { setlist });
      }
    } catch (error) {
      console.error('Error in operator:updateSetlistSummary:', error);
    }
  });

  // ==================== End MIDI Bridge Handlers ====================

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
        }
        viewerRooms.delete(socket.id);
      }

      // Check if this was a MIDI bridge
      midiBridgeSockets.delete(socket.id);

      // Check if this was an operator
      for (const [userId, socketId] of operatorSockets.entries()) {
        if (socketId === socket.id) {
          operatorSockets.delete(userId);
          break;
        }
      }
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

