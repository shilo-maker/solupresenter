const express = require('express');
const router = express.Router();
const Media = require('../models/Media');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// Get all media (public + user's personal media)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const media = await Media.find({
      $or: [
        { isPublic: true },
        { uploadedBy: req.user._id }
      ]
    }).populate('uploadedBy', 'email').sort({ createdAt: -1 });

    res.json({ media });
  } catch (error) {
    console.error('Error fetching media:', error);
    res.status(500).json({ error: 'Failed to fetch media' });
  }
});

// Create new media (for now, just storing URLs)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, type, url, thumbnailUrl } = req.body;

    if (!name || !type || !url) {
      return res.status(400).json({ error: 'Name, type, and URL are required' });
    }

    const media = await Media.create({
      name,
      type,
      url,
      thumbnailUrl: thumbnailUrl || '',
      uploadedBy: req.user._id,
      isPublic: false
    });

    res.status(201).json({ media });
  } catch (error) {
    console.error('Error creating media:', error);
    res.status(500).json({ error: 'Failed to create media' });
  }
});

// Delete media (only own media)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const media = await Media.findById(req.params.id);

    if (!media) {
      return res.status(404).json({ error: 'Media not found' });
    }

    if (media.uploadedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await media.deleteOne();

    res.json({ message: 'Media deleted successfully' });
  } catch (error) {
    console.error('Error deleting media:', error);
    res.status(500).json({ error: 'Failed to delete media' });
  }
});

// Admin: Make media public
router.post('/:id/make-public', authenticateToken, isAdmin, async (req, res) => {
  try {
    const media = await Media.findById(req.params.id);

    if (!media) {
      return res.status(404).json({ error: 'Media not found' });
    }

    media.isPublic = true;
    await media.save();

    res.json({ media, message: 'Media made public' });
  } catch (error) {
    console.error('Error making media public:', error);
    res.status(500).json({ error: 'Failed to update media' });
  }
});

module.exports = router;
