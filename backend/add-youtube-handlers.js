const fs = require('fs');
const path = require('path');

const serverFile = path.join(__dirname, 'server.js');
let content = fs.readFileSync(serverFile, 'utf8');

// Check if already added
if (content.includes('operator:youtubeLoad')) {
  console.log('YouTube handlers already exist');
  process.exit(0);
}

const youtubeHandlers = `
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

      console.log(\`▶️ Loading YouTube video in room \${room.pin}: \${videoId} - \${title}\`);
      io.to(\`room:\${room.pin}\`).emit('youtube:load', { videoId, title });
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

      console.log(\`▶️ Playing YouTube in room \${room.pin} at \${currentTime}s\`);
      io.to(\`room:\${room.pin}\`).emit('youtube:play', { currentTime });
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

      console.log(\`⏸️ Pausing YouTube in room \${room.pin} at \${currentTime}s\`);
      io.to(\`room:\${room.pin}\`).emit('youtube:pause', { currentTime });
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

      console.log(\`⏩ Seeking YouTube in room \${room.pin} to \${currentTime}s\`);
      io.to(\`room:\${room.pin}\`).emit('youtube:seek', { currentTime });
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

      console.log(\`🛑 Stopping YouTube in room \${room.pin}\`);
      io.to(\`room:\${room.pin}\`).emit('youtube:stop');
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

      io.to(\`room:\${room.pin}\`).emit('youtube:sync', { currentTime, isPlaying });
    } catch (error) {
      console.error('Error in operator:youtubeSync:', error);
    }
  });

  // ==================== End YouTube Handlers ====================

`;

// Insert before the applyTheme handler
const marker = '  // Operator applies a viewer theme';
if (content.includes(marker)) {
  content = content.replace(marker, youtubeHandlers + marker);
  fs.writeFileSync(serverFile, content, 'utf8');
  console.log('YouTube handlers added successfully');
} else {
  console.error('Could not find insertion point');
  process.exit(1);
}
