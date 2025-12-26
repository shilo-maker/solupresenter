const express = require('express');
const router = express.Router();
const { RemoteScreen } = require('../models');
const { authenticateToken } = require('../middleware/auth');

const MAX_SCREENS_PER_USER = 5;

// Get all user's remote screens
router.get('/', authenticateToken, async (req, res) => {
  try {
    const screens = await RemoteScreen.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']]
    });

    res.json({ screens });
  } catch (error) {
    console.error('Error fetching remote screens:', error);
    res.status(500).json({ error: 'Failed to fetch remote screens' });
  }
});

// Get single remote screen
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const screen = await RemoteScreen.findByPk(req.params.id);

    if (!screen) {
      return res.status(404).json({ error: 'Screen not found' });
    }

    if (screen.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ screen });
  } catch (error) {
    console.error('Error fetching screen:', error);
    res.status(500).json({ error: 'Failed to fetch screen' });
  }
});

// Create new remote screen
router.post('/', authenticateToken, async (req, res) => {
  try {
    // Check limit
    const count = await RemoteScreen.count({ where: { userId: req.user.id } });
    if (count >= MAX_SCREENS_PER_USER) {
      return res.status(400).json({ error: `Maximum ${MAX_SCREENS_PER_USER} screens allowed per user` });
    }

    const { name, displayType, config } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Screen name is required' });
    }

    const validDisplayTypes = ['viewer', 'stage', 'obs', 'custom'];
    if (displayType && !validDisplayTypes.includes(displayType)) {
      return res.status(400).json({ error: 'Invalid display type' });
    }

    const screen = await RemoteScreen.create({
      name: name.trim(),
      userId: req.user.id,
      displayType: displayType || 'viewer',
      config: config || {}
    });

    res.status(201).json({ screen });
  } catch (error) {
    console.error('Error creating remote screen:', error);
    res.status(500).json({ error: 'Failed to create remote screen' });
  }
});

// Update remote screen
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const screen = await RemoteScreen.findByPk(req.params.id);

    if (!screen) {
      return res.status(404).json({ error: 'Screen not found' });
    }

    if (screen.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { name, displayType, config } = req.body;

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({ error: 'Screen name cannot be empty' });
      }
      screen.name = name.trim();
    }

    if (displayType !== undefined) {
      const validDisplayTypes = ['viewer', 'stage', 'obs', 'custom'];
      if (!validDisplayTypes.includes(displayType)) {
        return res.status(400).json({ error: 'Invalid display type' });
      }
      screen.displayType = displayType;
    }

    if (config !== undefined) {
      screen.config = config;
    }

    await screen.save();

    res.json({ screen });
  } catch (error) {
    console.error('Error updating remote screen:', error);
    res.status(500).json({ error: 'Failed to update remote screen' });
  }
});

// Delete remote screen
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const screen = await RemoteScreen.findByPk(req.params.id);

    if (!screen) {
      return res.status(404).json({ error: 'Screen not found' });
    }

    if (screen.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await screen.destroy();

    res.json({ message: 'Screen deleted successfully' });
  } catch (error) {
    console.error('Error deleting remote screen:', error);
    res.status(500).json({ error: 'Failed to delete remote screen' });
  }
});

module.exports = router;
