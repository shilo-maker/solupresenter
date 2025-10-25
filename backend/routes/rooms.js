const express = require('express');
const router = express.Router();
const Room = require('../models/Room');
const User = require('../models/User');
const Setlist = require('../models/Setlist');
const { authenticateToken } = require('../middleware/auth');
const { generateUniquePin } = require('../utils/generatePin');

// Create or get active room for operator
router.post('/create', authenticateToken, async (req, res) => {
  try {
    // Check if user already has an active room
    let room = await Room.findOne({ operator: req.user._id, isActive: true })
      .populate({
        path: 'temporarySetlist',
        populate: [
          { path: 'items.song' },
          { path: 'items.image' }
        ]
      })
      .populate({
        path: 'linkedPermanentSetlist',
        populate: [
          { path: 'items.song' },
          { path: 'items.image' }
        ]
      });

    if (room) {
      // If room exists but temporary setlist was deleted, recreate it
      if (!room.temporarySetlist) {
        const temporarySetlist = await Setlist.create({
          name: `Presentation ${room.pin}`,
          items: [],
          createdBy: req.user._id,
          isTemporary: true,
          linkedRoom: room._id
        });

        room.temporarySetlist = temporarySetlist._id;
        await room.save();

        // Populate the newly created setlist
        await room.populate({
          path: 'temporarySetlist',
          populate: [
            { path: 'items.song' },
            { path: 'items.image' }
          ]
        });
      }

      // Update activity and return existing room
      await room.updateActivity();
      return res.json({ room });
    }

    // Generate unique PIN
    const pin = await generateUniquePin(Room);

    // Create temporary setlist for this presentation
    const temporarySetlist = await Setlist.create({
      name: `Presentation ${pin}`,
      items: [],
      createdBy: req.user._id,
      isTemporary: true
    });

    // Create new room
    room = await Room.create({
      pin,
      operator: req.user._id,
      isActive: true,
      temporarySetlist: temporarySetlist._id
    });

    // Link the setlist to the room
    temporarySetlist.linkedRoom = room._id;
    await temporarySetlist.save();

    // Populate the temporary setlist and its items before returning
    await room.populate({
      path: 'temporarySetlist',
      populate: [
        { path: 'items.song' },
        { path: 'items.image' }
      ]
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
    })
      .populate('currentSlide.songId')
      .populate({
        path: 'temporarySetlist',
        populate: [
          { path: 'items.song' },
          { path: 'items.image' }
        ]
      });

    if (!room) {
      return res.status(404).json({ error: 'No active room found' });
    }

    res.json({ room });
  } catch (error) {
    console.error('Error fetching room:', error);
    res.status(500).json({ error: 'Failed to fetch room' });
  }
});

// Update temporary setlist (or permanent if linked)
router.put('/:id/setlist', authenticateToken, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id)
      .populate({
        path: 'temporarySetlist',
        populate: [
          { path: 'items.song' },
          { path: 'items.image' }
        ]
      })
      .populate({
        path: 'linkedPermanentSetlist',
        populate: [
          { path: 'items.song' },
          { path: 'items.image' }
        ]
      });

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (room.operator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { items } = req.body;

    // If there's a linked permanent setlist, save to that instead
    if (room.linkedPermanentSetlist) {
      room.linkedPermanentSetlist.items = items;
      await room.linkedPermanentSetlist.save();

      // Re-populate after save
      await room.populate({
        path: 'linkedPermanentSetlist',
        populate: [
          { path: 'items.song' },
          { path: 'items.image' }
        ]
      });

      res.json({ setlist: room.linkedPermanentSetlist, isPermanent: true });
    } else {
      // Otherwise, save to temporary setlist
      if (!room.temporarySetlist) {
        return res.status(404).json({ error: 'No setlist found for this room' });
      }

      room.temporarySetlist.items = items;
      await room.temporarySetlist.save();

      // Re-populate after save
      await room.populate({
        path: 'temporarySetlist',
        populate: [
          { path: 'items.song' },
          { path: 'items.image' }
        ]
      });

      res.json({ setlist: room.temporarySetlist, isPermanent: false });
    }
  } catch (error) {
    console.error('Error updating setlist:', error);
    res.status(500).json({ error: 'Failed to update setlist' });
  }
});

// Convert temporary setlist to permanent
router.post('/:id/save-setlist', authenticateToken, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id)
      .populate({
        path: 'temporarySetlist',
        populate: [
          { path: 'items.song' },
          { path: 'items.image' }
        ]
      });

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (room.operator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!room.temporarySetlist) {
      return res.status(404).json({ error: 'No temporary setlist found for this room' });
    }

    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Setlist name is required' });
    }

    // Create a new permanent setlist with the same items
    const permanentSetlist = await Setlist.create({
      name: name.trim(),
      items: room.temporarySetlist.items,
      createdBy: req.user._id,
      isTemporary: false,
      linkedRoom: null
    });

    // Link the permanent setlist to the room
    room.linkedPermanentSetlist = permanentSetlist._id;
    await room.save();

    res.json({
      message: 'Setlist saved successfully',
      setlist: permanentSetlist,
      room: {
        _id: room._id,
        linkedPermanentSetlist: permanentSetlist._id
      }
    });
  } catch (error) {
    console.error('Error saving setlist:', error);
    res.status(500).json({ error: 'Failed to save setlist' });
  }
});

// Link a setlist to room (replaces any previous link)
router.post('/:id/link-setlist', authenticateToken, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (room.operator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { setlistId } = req.body;
    if (!setlistId) {
      return res.status(400).json({ error: 'Setlist ID is required' });
    }

    // Verify the setlist exists and populate it
    const setlist = await Setlist.findById(setlistId)
      .populate('items.song')
      .populate('items.image');
    if (!setlist) {
      return res.status(404).json({ error: 'Setlist not found' });
    }

    // Link the setlist to the room (replaces any previous link)
    room.linkedPermanentSetlist = setlistId;
    await room.save();

    // Convert setlist items to the format expected by the frontend
    const songs = setlist.items.map(item => {
      if (item.type === 'song') {
        return { type: 'song', data: item.song };
      } else if (item.type === 'image') {
        return { type: 'image', data: item.image };
      } else if (item.type === 'bible') {
        return { type: 'bible', data: item.bible };
      } else if (item.type === 'blank') {
        return { type: 'blank', data: {} };
      }
      return item;
    });

    const responseData = {
      message: 'Setlist linked successfully',
      room: { linkedPermanentSetlist: setlistId },
      setlist: {
        _id: setlist._id,
        name: setlist.name,
        songs
      }
    };

    console.log('Sending link-setlist response:', JSON.stringify(responseData, null, 2));

    res.json(responseData);
  } catch (error) {
    console.error('Error linking setlist:', error);
    res.status(500).json({ error: 'Failed to link setlist' });
  }
});

// Unlink setlist from room
router.post('/:id/unlink-setlist', authenticateToken, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (room.operator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Unlink the setlist
    room.linkedPermanentSetlist = null;
    await room.save();

    res.json({ message: 'Setlist unlinked successfully' });
  } catch (error) {
    console.error('Error unlinking setlist:', error);
    res.status(500).json({ error: 'Failed to unlink setlist' });
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

    // Delete the temporary setlist if it exists
    if (room.temporarySetlist) {
      await Setlist.findByIdAndDelete(room.temporarySetlist);
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
