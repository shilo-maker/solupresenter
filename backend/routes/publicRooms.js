const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { PublicRoom, Room, User } = require('../models');
const { authenticateToken } = require('../middleware/auth');

// Get current user's public rooms
router.get('/my-rooms', authenticateToken, async (req, res) => {
  try {
    const publicRooms = await PublicRoom.findAll({
      where: { ownerId: req.user.id },
      include: [{
        model: Room,
        as: 'activeRoom',
        attributes: ['id', 'pin', 'isActive', 'viewerCount']
      }],
      order: [['createdAt', 'DESC']]
    });

    res.json({ publicRooms });
  } catch (error) {
    console.error('Error fetching public rooms:', error);
    res.status(500).json({ error: 'Failed to fetch public rooms' });
  }
});

// Create a new public room
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Room name is required' });
    }

    // Generate slug from name
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, ''); // Strip leading/trailing hyphens

    // Validate slug is not empty after sanitization
    if (!slug) {
      return res.status(400).json({ error: 'Room name must contain at least one letter or number' });
    }

    // Check if slug already exists
    const existing = await PublicRoom.findOne({ where: { slug } });
    if (existing) {
      return res.status(400).json({ error: 'A room with this name already exists. Please choose a different name.' });
    }

    const publicRoom = await PublicRoom.create({
      name: name.trim(),
      slug,
      ownerId: req.user.id
    });

    res.status(201).json({ publicRoom });
  } catch (error) {
    console.error('Error creating public room:', error);
    res.status(500).json({ error: 'Failed to create public room' });
  }
});

// Delete a public room
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const publicRoom = await PublicRoom.findByPk(req.params.id);

    if (!publicRoom) {
      return res.status(404).json({ error: 'Public room not found' });
    }

    if (publicRoom.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await publicRoom.destroy();

    res.json({ message: 'Public room deleted successfully' });
  } catch (error) {
    console.error('Error deleting public room:', error);
    res.status(500).json({ error: 'Failed to delete public room' });
  }
});

// Search public rooms by name (for viewers - no auth required)
// Privacy: Only returns results for exact name/slug match (case-insensitive)
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 2) {
      return res.json({ publicRooms: [] });
    }

    const searchTerm = q.trim();
    // Convert search term to slug format for slug matching
    const searchSlug = searchTerm
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');

    // Case-insensitive search on both name and slug
    // Use iLike for PostgreSQL (case-insensitive), like for SQLite
    const isPostgres = process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgres');
    const likeOp = isPostgres ? Op.iLike : Op.like;

    const publicRooms = await PublicRoom.findAll({
      where: {
        [Op.or]: [
          { name: { [likeOp]: searchTerm } },
          { name: { [likeOp]: `%${searchTerm}%` } },
          { slug: searchSlug },
          { slug: { [likeOp]: `%${searchSlug}%` } }
        ]
      },
      include: [{
        model: Room,
        as: 'activeRoom',
        attributes: ['id', 'pin', 'isActive', 'viewerCount'],
        required: false
      }],
      limit: 10,
      order: [['name', 'ASC']]
    });

    // Format response with live status
    const results = publicRooms.map(pr => ({
      id: pr.id,
      name: pr.name,
      slug: pr.slug,
      isLive: !!(pr.activeRoom && pr.activeRoom.isActive),
      viewerCount: pr.activeRoom?.viewerCount || 0
    }));

    res.json({ publicRooms: results });
  } catch (error) {
    console.error('Error searching public rooms:', error);
    res.status(500).json({ error: 'Failed to search public rooms' });
  }
});

// Join public room by slug (for viewers - no auth required)
router.get('/join/:slug', async (req, res) => {
  try {
    const slug = req.params.slug.toLowerCase();

    const publicRoom = await PublicRoom.findOne({
      where: { slug },
      include: [{
        model: Room,
        as: 'activeRoom',
        attributes: ['id', 'pin', 'isActive', 'viewerCount']
      }]
    });

    if (!publicRoom) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (!publicRoom.activeRoom || !publicRoom.activeRoom.isActive) {
      return res.status(404).json({
        error: 'Room is not currently live',
        roomName: publicRoom.name
      });
    }

    res.json({
      publicRoom: {
        id: publicRoom.id,
        name: publicRoom.name,
        slug: publicRoom.slug
      },
      room: {
        pin: publicRoom.activeRoom.pin,
        viewerCount: publicRoom.activeRoom.viewerCount
      }
    });
  } catch (error) {
    console.error('Error joining public room:', error);
    res.status(500).json({ error: 'Failed to join room' });
  }
});

module.exports = router;
