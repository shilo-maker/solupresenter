const express = require('express');
const router = express.Router();
const { Setlist, Song, User, Room, Media } = require('../models');
const { Op } = require('sequelize');
const { authenticateToken } = require('../middleware/auth');
const crypto = require('crypto');

// Get all user's setlists (only permanent ones)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const setlists = await Setlist.findAll({
      where: {
        createdById: req.user.id,
        isTemporary: false  // Only show permanent setlists
      },
      order: [['updatedAt', 'DESC']]
    });

    res.json({ setlists });
  } catch (error) {
    console.error('Error fetching setlists:', error);
    res.status(500).json({ error: 'Failed to fetch setlists' });
  }
});

// Get single setlist
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const setlist = await Setlist.findByPk(req.params.id, {
      include: [
        {
          model: Song,
          as: 'itemSongs',
          through: { attributes: [] }
        },
        {
          model: Media,
          as: 'itemImages',
          through: { attributes: [] }
        }
      ]
    });

    if (!setlist) {
      return res.status(404).json({ error: 'Setlist not found' });
    }

    if (setlist.createdById !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Populate song and image data for each item
    const populatedItems = await Promise.all(
      (setlist.items || []).map(async (item) => {
        if (item.type === 'song' && item.song) {
          const songData = await Song.findByPk(item.song);
          return { ...item, song: songData };
        } else if (item.type === 'image' && item.image) {
          const imageData = await Media.findByPk(item.image);
          return { ...item, image: imageData };
        }
        return item;
      })
    );

    const setlistWithPopulatedItems = {
      ...setlist.toJSON(),
      items: populatedItems
    };

    res.json({ setlist: setlistWithPopulatedItems });
  } catch (error) {
    console.error('Error fetching setlist:', error);
    res.status(500).json({ error: 'Failed to fetch setlist' });
  }
});

// Get setlist by share token
router.get('/shared/:token', authenticateToken, async (req, res) => {
  try {
    const setlist = await Setlist.findOne({
      where: { shareToken: req.params.token },
      include: [
        {
          model: Song,
          as: 'itemSongs',
          through: { attributes: [] }
        },
        {
          model: Media,
          as: 'itemImages',
          through: { attributes: [] }
        }
      ]
    });

    if (!setlist) {
      return res.status(404).json({ error: 'Setlist not found' });
    }

    // Populate song and image data for each item
    const populatedItems = await Promise.all(
      (setlist.items || []).map(async (item) => {
        if (item.type === 'song' && item.song) {
          const songData = await Song.findByPk(item.song);
          return { ...item, song: songData };
        } else if (item.type === 'image' && item.image) {
          const imageData = await Media.findByPk(item.image);
          return { ...item, image: imageData };
        }
        return item;
      })
    );

    const setlistWithPopulatedItems = {
      ...setlist.toJSON(),
      items: populatedItems
    };

    res.json({ setlist: setlistWithPopulatedItems });
  } catch (error) {
    console.error('Error fetching shared setlist:', error);
    res.status(500).json({ error: 'Failed to fetch setlist' });
  }
});

// Create new setlist
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, items } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Setlist name is required' });
    }

    const setlist = await Setlist.create({
      name,
      items: items || [],
      createdById: req.user.id
    });

    res.status(201).json({ setlist });
  } catch (error) {
    console.error('Error creating setlist:', error);
    res.status(500).json({ error: 'Failed to create setlist' });
  }
});

// Update setlist
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const setlist = await Setlist.findByPk(req.params.id);

    if (!setlist) {
      return res.status(404).json({ error: 'Setlist not found' });
    }

    if (setlist.createdById !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { name, items } = req.body;

    if (name) setlist.name = name;
    if (items) setlist.items = items;

    await setlist.save();

    const updatedSetlist = await Setlist.findByPk(setlist.id, {
      include: [
        {
          model: Song,
          as: 'itemSongs',
          through: { attributes: [] }
        },
        {
          model: Media,
          as: 'itemImages',
          through: { attributes: [] }
        }
      ]
    });

    res.json({ setlist: updatedSetlist });
  } catch (error) {
    console.error('Error updating setlist:', error);
    res.status(500).json({ error: 'Failed to update setlist' });
  }
});

// Delete setlist
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const setlist = await Setlist.findByPk(req.params.id);

    if (!setlist) {
      return res.status(404).json({ error: 'Setlist not found' });
    }

    if (setlist.createdById !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await setlist.destroy();

    res.json({ message: 'Setlist deleted successfully' });
  } catch (error) {
    console.error('Error deleting setlist:', error);
    res.status(500).json({ error: 'Failed to delete setlist' });
  }
});

// Generate share link
router.post('/:id/share', authenticateToken, async (req, res) => {
  try {
    const setlist = await Setlist.findByPk(req.params.id);

    if (!setlist) {
      return res.status(404).json({ error: 'Setlist not found' });
    }

    if (setlist.createdById !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Generate share token if doesn't exist
    if (!setlist.shareToken) {
      setlist.shareToken = crypto.randomBytes(16).toString('hex');
      await setlist.save();
    }

    res.json({
      shareToken: setlist.shareToken,
      shareUrl: `${process.env.FRONTEND_URL}/setlist/shared/${setlist.shareToken}`
    });
  } catch (error) {
    console.error('Error generating share link:', error);
    res.status(500).json({ error: 'Failed to generate share link' });
  }
});

// Increment usage count
router.post('/:id/use', authenticateToken, async (req, res) => {
  try {
    const setlist = await Setlist.findByPk(req.params.id);

    if (!setlist) {
      return res.status(404).json({ error: 'Setlist not found' });
    }

    setlist.usageCount += 1;
    await setlist.save();

    res.json({ message: 'Usage count updated' });
  } catch (error) {
    console.error('Error updating usage:', error);
    res.status(500).json({ error: 'Failed to update usage' });
  }
});

module.exports = router;
