const express = require('express');
const router = express.Router();
const Room = require('../models/Room');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');
const { generateUniquePin } = require('../utils/generatePin');

// Create or get active room for operator
router.post('/create', authenticateToken, async (req, res) => {
  try {
    // Check if user already has an active room
    let room = await Room.findOne({ operator: req.user._id, isActive: true });

    if (room) {
      // Update activity and return existing room
      await room.updateActivity();
      return res.json({ room });
    }

    // Generate unique PIN
    const pin = await generateUniquePin(Room);

    // Create new room
    room = await Room.create({
      pin,
      operator: req.user._id,
      isActive: true
    });

    // Update user's active room
    await User.findByIdAndUpdate(req.user._id, { activeRoom: room._id });

    res.status(201).json({ room });
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// Get room by PIN (for viewers)
router.get('/join/:pin', async (req, res) => {
  try {
    const room = await Room.findOne({
      pin: req.params.pin.toUpperCase(),
      isActive: true
    }).populate('currentSlide.songId');

    if (!room) {
      return res.status(404).json({ error: 'Room not found or inactive' });
    }

    res.json({ room });
  } catch (error) {
    console.error('Error joining room:', error);
    res.status(500).json({ error: 'Failed to join room' });
  }
});

// Get operator's active room
router.get('/my-room', authenticateToken, async (req, res) => {
  try {
    const room = await Room.findOne({
      operator: req.user._id,
      isActive: true
    }).populate('currentSlide.songId');

    if (!room) {
      return res.status(404).json({ error: 'No active room found' });
    }

    res.json({ room });
  } catch (error) {
    console.error('Error fetching room:', error);
    res.status(500).json({ error: 'Failed to fetch room' });
  }
});

// Close room
router.post('/:id/close', authenticateToken, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (room.operator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    room.isActive = false;
    await room.save();

    // Clear user's active room
    await User.findByIdAndUpdate(req.user._id, { activeRoom: null });

    res.json({ message: 'Room closed successfully' });
  } catch (error) {
    console.error('Error closing room:', error);
    res.status(500).json({ error: 'Failed to close room' });
  }
});

module.exports = router;
