const express = require('express');
const router = express.Router();
const { RemoteScreen, Room, ViewerTheme } = require('../models');

// Public endpoint - Get screen config and active room info
// No authentication required - this is accessed by kiosk devices
router.get('/:userId/:screenId', async (req, res) => {
  try {
    const { userId, screenId } = req.params;

    // Find the remote screen
    const screen = await RemoteScreen.findOne({
      where: { id: screenId, userId: userId }
    });

    if (!screen) {
      return res.status(404).json({ error: 'Screen not found' });
    }

    // Find user's active room
    const activeRoom = await Room.findOne({
      where: { operatorId: userId, isActive: true },
      attributes: ['id', 'pin', 'backgroundImage', 'activeThemeId']
    });

    // Get theme if room has one
    let theme = null;
    if (activeRoom && activeRoom.activeThemeId) {
      theme = await ViewerTheme.findByPk(activeRoom.activeThemeId);
    }

    res.json({
      screen: {
        id: screen.id,
        name: screen.name,
        displayType: screen.displayType,
        config: screen.config
      },
      room: activeRoom ? {
        pin: activeRoom.pin,
        backgroundImage: activeRoom.backgroundImage,
        theme: theme
      } : null
    });
  } catch (error) {
    console.error('Error fetching screen access:', error);
    res.status(500).json({ error: 'Failed to fetch screen data' });
  }
});

module.exports = router;
