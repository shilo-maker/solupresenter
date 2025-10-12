const express = require('express');
const router = express.Router();
const Setlist = require('../models/Setlist');
const { authenticateToken } = require('../middleware/auth');
const crypto = require('crypto');

// Get all user's setlists
router.get('/', authenticateToken, async (req, res) => {
  try {
    const setlists = await Setlist.find({ createdBy: req.user._id })
      .populate('items.song')
      .sort({ updatedAt: -1 });

    res.json({ setlists });
  } catch (error) {
    console.error('Error fetching setlists:', error);
    res.status(500).json({ error: 'Failed to fetch setlists' });
  }
});

// Get single setlist
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const setlist = await Setlist.findById(req.params.id).populate('items.song');

    if (!setlist) {
      return res.status(404).json({ error: 'Setlist not found' });
    }

    if (setlist.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ setlist });
  } catch (error) {
    console.error('Error fetching setlist:', error);
    res.status(500).json({ error: 'Failed to fetch setlist' });
  }
});

// Get setlist by share token
router.get('/shared/:token', authenticateToken, async (req, res) => {
  try {
    const setlist = await Setlist.findOne({ shareToken: req.params.token }).populate('items.song');

    if (!setlist) {
      return res.status(404).json({ error: 'Setlist not found' });
    }

    res.json({ setlist });
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
      createdBy: req.user._id
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
    const setlist = await Setlist.findById(req.params.id);

    if (!setlist) {
      return res.status(404).json({ error: 'Setlist not found' });
    }

    if (setlist.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { name, items } = req.body;

    if (name) setlist.name = name;
    if (items) setlist.items = items;

    await setlist.save();

    const updatedSetlist = await Setlist.findById(setlist._id).populate('items.song');

    res.json({ setlist: updatedSetlist });
  } catch (error) {
    console.error('Error updating setlist:', error);
    res.status(500).json({ error: 'Failed to update setlist' });
  }
});

// Delete setlist
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const setlist = await Setlist.findById(req.params.id);

    if (!setlist) {
      return res.status(404).json({ error: 'Setlist not found' });
    }

    if (setlist.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await setlist.deleteOne();

    res.json({ message: 'Setlist deleted successfully' });
  } catch (error) {
    console.error('Error deleting setlist:', error);
    res.status(500).json({ error: 'Failed to delete setlist' });
  }
});

// Generate share link
router.post('/:id/share', authenticateToken, async (req, res) => {
  try {
    const setlist = await Setlist.findById(req.params.id);

    if (!setlist) {
      return res.status(404).json({ error: 'Setlist not found' });
    }

    if (setlist.createdBy.toString() !== req.user._id.toString()) {
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
    const setlist = await Setlist.findById(req.params.id);

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
