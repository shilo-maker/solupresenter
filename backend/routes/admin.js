const express = require('express');
const router = express.Router();
const Song = require('../models/Song');
const User = require('../models/User');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// Get all pending songs
router.get('/pending-songs', authenticateToken, isAdmin, async (req, res) => {
  try {
    const songs = await Song.find({ isPendingApproval: true })
      .populate('createdBy', 'email')
      .sort({ createdAt: -1 });

    res.json({ songs });
  } catch (error) {
    console.error('Error fetching pending songs:', error);
    res.status(500).json({ error: 'Failed to fetch pending songs' });
  }
});

// Approve song
router.post('/approve-song/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);

    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }

    song.isPendingApproval = false;
    song.isPublic = true;
    song.approvedBy = req.user._id;
    song.approvedAt = new Date();

    await song.save();

    res.json({ song, message: 'Song approved successfully' });
  } catch (error) {
    console.error('Error approving song:', error);
    res.status(500).json({ error: 'Failed to approve song' });
  }
});

// Reject song
router.post('/reject-song/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);

    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }

    song.isPendingApproval = false;
    await song.save();

    res.json({ message: 'Song rejected' });
  } catch (error) {
    console.error('Error rejecting song:', error);
    res.status(500).json({ error: 'Failed to reject song' });
  }
});

// Create public song directly (admin only)
router.post('/create-public-song', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { title, originalLanguage, slides, tags } = req.body;

    if (!title || !originalLanguage || !slides || slides.length === 0) {
      return res.status(400).json({ error: 'Title, language, and at least one slide are required' });
    }

    const song = await Song.create({
      title,
      originalLanguage,
      slides,
      tags: tags || [],
      createdBy: req.user._id,
      isPublic: true,
      isPendingApproval: false,
      approvedBy: req.user._id,
      approvedAt: new Date()
    });

    res.status(201).json({ song });
  } catch (error) {
    console.error('Error creating public song:', error);
    res.status(500).json({ error: 'Failed to create public song' });
  }
});

// User Management Routes

// Get all users
router.get('/users', authenticateToken, isAdmin, async (req, res) => {
  try {
    const users = await User.find()
      .select('-password')
      .sort({ createdAt: -1 });

    res.json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Toggle user admin status
router.post('/users/:id/toggle-admin', authenticateToken, isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent admins from removing their own admin status
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ error: 'Cannot modify your own admin status' });
    }

    // Toggle between 'operator' and 'admin' roles
    user.role = user.role === 'admin' ? 'operator' : 'admin';
    await user.save();

    res.json({
      user: {
        _id: user._id,
        email: user.email,
        role: user.role
      },
      message: `User ${user.role === 'admin' ? 'promoted to' : 'removed from'} admin`
    });
  } catch (error) {
    console.error('Error toggling admin status:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user
router.delete('/users/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent admins from deleting themselves
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;
