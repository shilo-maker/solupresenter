const express = require('express');
const router = express.Router();
const { Room, User, Setlist, Song, Media, PublicRoom } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const { generateUniquePin } = require('../utils/generatePin');

// Helper function to populate setlist items with full data
async function populateSetlistItems(setlist) {
  if (!setlist || !setlist.items) return setlist;

  const populatedItems = await Promise.all(setlist.items.map(async (item) => {
    if (item.type === 'song') {
      // Handle both songId and song fields (song field might contain the ID)
      const songId = item.songId || item.song;
      if (songId) {
        const song = await Song.findByPk(songId);
        return { ...item, song };
      }
    } else if (item.type === 'image') {
      // Handle both imageId and image fields
      const imageId = item.imageId || item.image;
      if (imageId) {
        const image = await Media.findByPk(imageId);
        return { ...item, image };
      }
    }
    return item;
  }));

  return {
    ...setlist.toJSON(),
    items: populatedItems
  };
}

// Create or get active room for operator
router.post('/create', authenticateToken, async (req, res) => {
  try {
    const { publicRoomId } = req.body || {};

    // Check if user already has an active room
    let room = await Room.findOne({
      where: {
        operatorId: req.user.id,
        isActive: true
      },
      include: [
        { association: 'temporarySetlist' },
        { association: 'linkedPermanentSetlist' }
      ]
    });

    if (room) {
      // If room exists but temporary setlist was deleted, recreate it
      if (!room.temporarySetlist) {
        const temporarySetlist = await Setlist.create({
          name: `Presentation ${room.pin}`,
          items: [],
          createdById: req.user.id,
          isTemporary: true,
          linkedRoomId: room.id
        });

        room.temporarySetlistId = temporarySetlist.id;
        await room.save();

        // Reload the room with the newly created setlist
        room = await Room.findByPk(room.id, {
          include: [
            { association: 'temporarySetlist' }
          ]
        });
      }

      // Update activity
      await room.updateActivity();

      // Populate setlist items with full data
      const roomData = room.toJSON();
      if (roomData.temporarySetlist) {
        roomData.temporarySetlist = await populateSetlistItems(room.temporarySetlist);
      }
      if (roomData.linkedPermanentSetlist) {
        roomData.linkedPermanentSetlist = await populateSetlistItems(room.linkedPermanentSetlist);
        console.log('📋 Populated linked setlist:', JSON.stringify(roomData.linkedPermanentSetlist.items[0], null, 2));
      }

      return res.json({ room: roomData });
    }

    // Generate unique PIN
    const pin = await generateUniquePin(Room);

    // Create temporary setlist for this presentation
    const temporarySetlist = await Setlist.create({
      name: `Presentation ${pin}`,
      items: [],
      createdById: req.user.id,
      isTemporary: true
    });

    // Create new room
    room = await Room.create({
      pin,
      operatorId: req.user.id,
      isActive: true,
      temporarySetlistId: temporarySetlist.id
    });

    // Link the setlist to the room
    temporarySetlist.linkedRoom = room.id;
    await temporarySetlist.save();

    // Reload the room with populated associations
    room = await Room.findByPk(room.id, {
      include: [
        { association: 'temporarySetlist' }
      ]
    });

    // Update user's active room
    await User.update(
      { activeRoomId: room.id },
      { where: { id: req.user.id } }
    );

    // Link public room if provided
    if (publicRoomId) {
      const publicRoom = await PublicRoom.findOne({
        where: { id: publicRoomId, ownerId: req.user.id }
      });
      if (publicRoom) {
        publicRoom.activeRoomId = room.id;
        await publicRoom.save();
      }
    }

    // Populate setlist items with full data
    const roomData = room.toJSON();
    if (roomData.temporarySetlist) {
      roomData.temporarySetlist = await populateSetlistItems(room.temporarySetlist);
    }

    res.status(201).json({ room: roomData });
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// Get room by PIN (for viewers)
router.get('/join/:pin', async (req, res) => {
  try {
    const room = await Room.findOne({
      where: {
        pin: req.params.pin.toUpperCase(),
        isActive: true
      },
      include: [
        {
          association: 'currentSlide',
          include: [{ association: 'songId', model: Song }]
        }
      ]
    });

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
      where: {
        operatorId: req.user.id,
        isActive: true
      },
      include: [
        {
          association: 'currentSlide',
          include: [{ association: 'songId', model: Song }]
        },
        { association: 'temporarySetlist' }
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
    const room = await Room.findByPk(req.params.id, {
      include: [
        { association: 'temporarySetlist' },
        { association: 'linkedPermanentSetlist' }
      ]
    });

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (room.operatorId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { items } = req.body;

    // If there's a linked permanent setlist, save to that instead
    if (room.linkedPermanentSetlist) {
      room.linkedPermanentSetlist.items = items;
      await room.linkedPermanentSetlist.save();

      // Reload the setlist
      const updatedSetlist = await Setlist.findByPk(room.linkedPermanentSetlist.id);

      res.json({ setlist: updatedSetlist, isPermanent: true });
    } else {
      // Otherwise, save to temporary setlist
      if (!room.temporarySetlist) {
        return res.status(404).json({ error: 'No setlist found for this room' });
      }

      room.temporarySetlist.items = items;
      await room.temporarySetlist.save();

      // Reload the setlist
      const updatedSetlist = await Setlist.findByPk(room.temporarySetlist.id);

      res.json({ setlist: updatedSetlist, isPermanent: false });
    }
  } catch (error) {
    console.error('Error updating setlist:', error);
    res.status(500).json({ error: 'Failed to update setlist' });
  }
});

// Convert temporary setlist to permanent
router.post('/:id/save-setlist', authenticateToken, async (req, res) => {
  try {
    const room = await Room.findByPk(req.params.id, {
      include: [
        { association: 'temporarySetlist' }
      ]
    });

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (room.operatorId.toString() !== req.user.id.toString()) {
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
      createdById: req.user.id,
      isTemporary: false,
      linkedRoomId: null
    });

    // Link the permanent setlist to the room
    room.linkedPermanentSetlistId = permanentSetlist.id;
    await room.save();

    res.json({
      message: 'Setlist saved successfully',
      setlist: permanentSetlist,
      room: {
        id: room.id,
        linkedPermanentSetlist: permanentSetlist.id
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
    const room = await Room.findByPk(req.params.id);

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (room.operatorId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { setlistId } = req.body;
    if (!setlistId) {
      return res.status(400).json({ error: 'Setlist ID is required' });
    }

    // Verify the setlist exists
    const setlist = await Setlist.findByPk(setlistId);

    if (!setlist) {
      return res.status(404).json({ error: 'Setlist not found' });
    }

    // Link the setlist to the room (replaces any previous link)
    room.linkedPermanentSetlistId = setlistId;
    await room.save();

    // Convert setlist items to the format expected by the frontend
    // Fetch full data for each item from the database
    const songs = await Promise.all(setlist.items.map(async (item) => {
      if (item.type === 'song' && item.song) {
        const songData = await Song.findByPk(item.song);
        return { type: 'song', data: songData };
      } else if (item.type === 'image' && item.image) {
        const imageData = await Media.findByPk(item.image);
        return { type: 'image', data: imageData };
      } else if (item.type === 'bible') {
        // Bible data is stored directly in the item
        return { type: 'bible', data: item.bibleData || item };
      } else if (item.type === 'blank') {
        return { type: 'blank', data: {} };
      } else if (item.type === 'section') {
        return { type: 'section', data: { title: item.sectionTitle } };
      }
      return item;
    }));

    const responseData = {
      message: 'Setlist linked successfully',
      room: { linkedPermanentSetlist: setlistId },
      setlist: {
        id: setlist.id,
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
    const room = await Room.findByPk(req.params.id);

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (room.operatorId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Unlink the setlist
    room.linkedPermanentSetlistId = null;
    await room.save();

    res.json({ message: 'Setlist unlinked successfully' });
  } catch (error) {
    console.error('Error unlinking setlist:', error);
    res.status(500).json({ error: 'Failed to unlink setlist' });
  }
});

// Link a public room to the active room
router.post('/:id/link-public-room', authenticateToken, async (req, res) => {
  try {
    const room = await Room.findByPk(req.params.id);

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (room.operatorId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { publicRoomId } = req.body;

    // Notify all current viewers that the broadcast is changing and disconnect them
    const io = req.app.get('io');
    if (io) {
      console.log(`📢 Emitting room:closed to room:${room.pin} - broadcast room changed`);
      io.to(`room:${room.pin}`).emit('room:closed', {
        message: 'The presenter has changed the broadcast room'
      });
    }

    // Reset viewer count since all viewers are being disconnected
    await Room.update({ viewerCount: 0 }, { where: { id: room.id } });

    // First, unlink any existing public room from this room
    await PublicRoom.update(
      { activeRoomId: null },
      { where: { activeRoomId: room.id } }
    );

    // If publicRoomId is provided, link the new public room
    if (publicRoomId) {
      const publicRoom = await PublicRoom.findOne({
        where: { id: publicRoomId, ownerId: req.user.id }
      });

      if (!publicRoom) {
        return res.status(404).json({ error: 'Public room not found' });
      }

      publicRoom.activeRoomId = room.id;
      await publicRoom.save();

      res.json({
        message: 'Public room linked successfully',
        publicRoom: { id: publicRoom.id, name: publicRoom.name, slug: publicRoom.slug }
      });
    } else {
      res.json({ message: 'Public room unlinked successfully' });
    }
  } catch (error) {
    console.error('Error linking public room:', error);
    res.status(500).json({ error: 'Failed to link public room' });
  }
});

// Close room
router.post('/:id/close', authenticateToken, async (req, res) => {
  try {
    const room = await Room.findByPk(req.params.id);

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (room.operatorId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Delete the temporary setlist if it exists
    if (room.temporarySetlist) {
      await Setlist.destroy({
        where: { id: room.temporarySetlist }
      });
    }

    // Notify all viewers in the room that it's closing
    const io = req.app.get('io');
    if (io) {
      io.to(`room:${room.pin}`).emit('room:closed', {
        message: 'The presenter has ended the session'
      });
    }

    room.isActive = false;
    await room.save();

    // Clear user's active room
    await User.update(
      { activeRoomId: null },
      { where: { id: req.user.id } }
    );

    // Clear any public room links to this room
    await PublicRoom.update(
      { activeRoomId: null },
      { where: { activeRoomId: room.id } }
    );

    res.json({ message: 'Room closed successfully' });
  } catch (error) {
    console.error('Error closing room:', error);
    res.status(500).json({ error: 'Failed to close room' });
  }
});

module.exports = router;
