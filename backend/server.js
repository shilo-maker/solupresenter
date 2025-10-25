require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const session = require('express-session');
const multer = require('multer');
const compression = require('compression');
const connectDB = require('./config/database');
const passport = require('./config/passport');

// Import routes
const authRoutes = require('./routes/auth');
const songRoutes = require('./routes/songs');
const roomRoutes = require('./routes/rooms');
const setlistRoutes = require('./routes/setlists');
const adminRoutes = require('./routes/admin');
const mediaRoutes = require('./routes/media');
const bibleRoutes = require('./routes/bible');

// Import models
const Room = require('./models/Room');
const Song = require('./models/Song');

// Import cleanup job
const cleanupTemporarySetlists = require('./jobs/cleanupTemporarySetlists');

const app = express();
const server = http.createServer(app);
const allowedOrigins = [
  'http://localhost:3456',
  'http://10.100.102.27:3456',
  'https://main.d390gabr466gfy.amplifyapp.com',
  'https://d125ckyjvo1azi.cloudfront.net',
  'https://solupresenter-frontend.onrender.com',
  'https://solucast.app',
  'http://solucast.app',
  process.env.FRONTEND_URL
].filter(Boolean);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Connect to MongoDB
connectDB();

// Middleware
app.use(compression()); // Enable gzip compression
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
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

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Operator joins their room
  socket.on('operator:join', async (data) => {
    try {
      const { userId, roomId } = data;

      const room = await Room.findById(roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      // Join socket room
      socket.join(`room:${room.pin}`);
      operatorSockets.set(userId, socket.id);

      socket.emit('operator:joined', { roomPin: room.pin });
      console.log(`Operator ${userId} joined room ${room.pin}`);
    } catch (error) {
      console.error('Error in operator:join:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  // Viewer joins a room
  socket.on('viewer:join', async (data) => {
    try {
      const { pin } = data;

      const room = await Room.findOne({ pin: pin.toUpperCase(), isActive: true })
        .select('pin currentSlide currentImageUrl currentBibleData backgroundImage viewerCount')
        .lean();

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
      await Room.findByIdAndUpdate(room._id, { $inc: { viewerCount: 1 } });

      // Fetch current slide data if available
      let slideData = null;
      let imageUrl = null;

      if (room.currentSlide && !room.currentSlide.isBlank) {
        // Check if there's a stored image URL
        if (room.currentImageUrl) {
          imageUrl = room.currentImageUrl;
        }
        // Check if there's stored Bible data
        else if (room.currentBibleData) {
          slideData = {
            slide: room.currentBibleData.slide,
            displayMode: room.currentSlide.displayMode,
            songTitle: room.currentBibleData.title,
            backgroundImage: room.backgroundImage || '',
            isBible: true
          };
        }
        // Otherwise, fetch song from database (only needed fields)
        else if (room.currentSlide.songId) {
          const song = await Song.findById(room.currentSlide.songId)
            .select('title slides')
            .lean();
          if (song && song.slides[room.currentSlide.slideIndex]) {
            slideData = {
              slide: song.slides[room.currentSlide.slideIndex],
              displayMode: room.currentSlide.displayMode,
              songTitle: song.title,
              backgroundImage: room.backgroundImage || ''
            };
          }
        }
      }

      // Send current slide to viewer
      socket.emit('viewer:joined', {
        roomPin: room.pin,
        currentSlide: room.currentSlide,
        slideData: slideData,
        imageUrl: imageUrl,
        isBlank: room.currentSlide.isBlank,
        backgroundImage: room.backgroundImage || ''
      });

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
    console.log('📥 Received operator:updateSlide event:', data);
    try {
      const { roomId, songId, slideIndex, displayMode, isBlank, imageUrl, bibleData } = data;

      const room = await Room.findById(roomId)
        .select('pin currentSlide currentImageUrl currentBibleData backgroundImage lastActivity expiresAt');

      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      // Update room's current slide
      // For Bible passages, set songId to null since they're not in the database
      const isBiblePassage = bibleData || (songId && songId.startsWith('bible-'));
      room.currentSlide = {
        songId: (isBlank || isBiblePassage) ? null : songId,
        slideIndex: slideIndex || 0,
        displayMode: displayMode || 'bilingual',
        isBlank: isBlank || false
      };

      // Store image URL and Bible data for new viewers
      room.currentImageUrl = imageUrl || null;
      room.currentBibleData = bibleData || null;

      await room.updateActivity();

      // Fetch song data if not blank, not an image, and not Bible data
      let slideData = null;
      if (!isBlank && !imageUrl) {
        if (bibleData) {
          // Use Bible data directly
          slideData = {
            slide: bibleData.slide,
            displayMode: room.currentSlide.displayMode,
            songTitle: bibleData.title,
            backgroundImage: room.backgroundImage || '',
            isBible: true
          };
        } else if (songId) {
          // Fetch song from database (only needed fields)
          const song = await Song.findById(songId).select('title slides').lean();
          if (song && song.slides[slideIndex]) {
            slideData = {
              slide: song.slides[slideIndex],
              displayMode: room.currentSlide.displayMode,
              songTitle: song.title,
              backgroundImage: room.backgroundImage || ''
            };
          }
        }
      }

      // Broadcast to all viewers in the room
      io.to(`room:${room.pin}`).emit('slide:update', {
        currentSlide: room.currentSlide,
        slideData,
        isBlank,
        imageUrl: imageUrl || null,
        backgroundImage: room.backgroundImage || ''
      });

      console.log(`Slide updated in room ${room.pin}`, imageUrl ? `(image: ${imageUrl})` : bibleData ? `(Bible: ${bibleData.title})` : '');
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

      const room = await Room.findById(roomId);

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
        const room = await Room.findOneAndUpdate(
          { pin: roomPin },
          { $inc: { viewerCount: -1 } },
          { new: true }
        ).select('viewerCount');

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

  // Defer cleanup job to run 30 seconds after startup (faster cold starts)
  setTimeout(() => {
    cleanupTemporarySetlists();
    console.log('✅ Initial cleanup completed');
  }, 30000);

  // Schedule cleanup job to run every hour
  setInterval(cleanupTemporarySetlists, 60 * 60 * 1000); // 1 hour
  console.log('✅ Scheduled temporary setlist cleanup job (runs every hour)');
});

module.exports = { app, server, io };

