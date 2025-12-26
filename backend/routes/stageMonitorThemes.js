const express = require('express');
const router = express.Router();
const { StageMonitorTheme, User } = require('../models');
const { Op } = require('sequelize');
const { authenticateToken } = require('../middleware/auth');

// Get all themes (built-in + user's own)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const themes = await StageMonitorTheme.findAll({
      where: {
        [Op.or]: [
          { isBuiltIn: true },
          { createdById: req.user.id }
        ]
      },
      order: [
        ['isBuiltIn', 'DESC'], // Built-in themes first
        ['name', 'ASC']
      ]
    });

    res.json({ themes });
  } catch (error) {
    console.error('Error fetching stage monitor themes:', error);
    res.status(500).json({ error: 'Failed to fetch themes' });
  }
});

// Get user's default theme (must be before /:id route)
router.get('/default', authenticateToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const defaultThemeId = user.preferences?.defaultStageMonitorThemeId;

    // If user has a custom default, return it
    if (defaultThemeId) {
      const theme = await StageMonitorTheme.findByPk(defaultThemeId);
      if (theme) {
        return res.json({ defaultThemeId, theme });
      }
      // Theme was deleted - clear the orphaned reference and fall through to classic theme
      const { defaultStageMonitorThemeId: _, ...restPreferences } = user.preferences || {};
      user.preferences = restPreferences;
      user.changed('preferences', true);
      await user.save();
    }

    // Otherwise, return the built-in Classic Dark theme as default
    const classicTheme = await StageMonitorTheme.findOne({ where: { isBuiltIn: true } });
    if (classicTheme) {
      return res.json({ defaultThemeId: classicTheme.id, theme: classicTheme });
    }

    // Fallback if no built-in theme exists
    res.json({ defaultThemeId: null, theme: null });
  } catch (error) {
    console.error('Error getting default stage monitor theme:', error);
    res.status(500).json({ error: 'Failed to get default theme' });
  }
});

// Clear default theme (must be before /:id route)
router.post('/clear-default', authenticateToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Create new preferences object without defaultStageMonitorThemeId
    const { defaultStageMonitorThemeId, ...restPreferences } = user.preferences || {};
    user.preferences = restPreferences;
    user.changed('preferences', true);
    await user.save();

    res.json({ message: 'Default stage monitor theme cleared' });
  } catch (error) {
    console.error('Error clearing default stage monitor theme:', error);
    res.status(500).json({ error: 'Failed to clear default theme' });
  }
});

// Get theme by ID (PUBLIC - for remote screens with specific theme)
router.get('/public/:id', async (req, res) => {
  try {
    const theme = await StageMonitorTheme.findByPk(req.params.id);

    if (!theme) {
      return res.status(404).json({ error: 'Theme not found' });
    }

    res.json({ theme });
  } catch (error) {
    console.error('Error fetching stage monitor theme:', error);
    res.status(500).json({ error: 'Failed to fetch theme' });
  }
});

// Get operator's default theme (PUBLIC - for stage monitors connecting to rooms)
router.get('/operator/:operatorId/default', async (req, res) => {
  try {
    const { operatorId } = req.params;

    const user = await User.findByPk(operatorId);
    if (!user) {
      return res.status(404).json({ error: 'Operator not found' });
    }

    const defaultThemeId = user.preferences?.defaultStageMonitorThemeId;

    // If operator has a custom default, return it
    if (defaultThemeId) {
      const theme = await StageMonitorTheme.findByPk(defaultThemeId);
      if (theme) {
        return res.json({ theme });
      }
    }

    // Otherwise, return the built-in Classic Dark theme as default
    const classicTheme = await StageMonitorTheme.findOne({ where: { isBuiltIn: true } });
    if (classicTheme) {
      return res.json({ theme: classicTheme });
    }

    // Fallback if no built-in theme exists
    res.json({ theme: null });
  } catch (error) {
    console.error('Error getting operator default stage monitor theme:', error);
    res.status(500).json({ error: 'Failed to get theme' });
  }
});

// Get single theme
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const theme = await StageMonitorTheme.findByPk(req.params.id);

    if (!theme) {
      return res.status(404).json({ error: 'Theme not found' });
    }

    // Allow access to built-in themes or user's own themes
    if (!theme.isBuiltIn && theme.createdById !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ theme });
  } catch (error) {
    console.error('Error fetching stage monitor theme:', error);
    res.status(500).json({ error: 'Failed to fetch theme' });
  }
});

// Create new theme
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      name,
      canvasDimensions,
      colors,
      header,
      clock,
      songTitle,
      currentSlideArea,
      currentSlideText,
      nextSlideArea,
      backgroundBoxes
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Theme name is required' });
    }

    const theme = await StageMonitorTheme.create({
      name,
      createdById: req.user.id,
      isBuiltIn: false,
      canvasDimensions: canvasDimensions || undefined,
      colors: colors || undefined,
      header: header || undefined,
      clock: clock || undefined,
      songTitle: songTitle || undefined,
      currentSlideArea: currentSlideArea || undefined,
      currentSlideText: currentSlideText || undefined,
      nextSlideArea: nextSlideArea || undefined,
      backgroundBoxes: backgroundBoxes || []
    });

    res.status(201).json({ theme });
  } catch (error) {
    console.error('Error creating stage monitor theme:', error);
    res.status(500).json({ error: 'Failed to create theme' });
  }
});

// Update theme
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const theme = await StageMonitorTheme.findByPk(req.params.id);

    if (!theme) {
      return res.status(404).json({ error: 'Theme not found' });
    }

    // Cannot edit built-in themes
    if (theme.isBuiltIn) {
      return res.status(403).json({ error: 'Cannot modify built-in themes' });
    }

    if (theme.createdById !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const {
      name,
      canvasDimensions,
      colors,
      header,
      clock,
      songTitle,
      currentSlideArea,
      currentSlideText,
      nextSlideArea,
      backgroundBoxes
    } = req.body;

    if (name !== undefined) theme.name = name;
    if (canvasDimensions !== undefined) theme.canvasDimensions = canvasDimensions;
    if (colors !== undefined) theme.colors = colors;
    if (header !== undefined) theme.header = header;
    if (clock !== undefined) theme.clock = clock;
    if (songTitle !== undefined) theme.songTitle = songTitle;
    if (currentSlideArea !== undefined) theme.currentSlideArea = currentSlideArea;
    if (currentSlideText !== undefined) theme.currentSlideText = currentSlideText;
    if (nextSlideArea !== undefined) theme.nextSlideArea = nextSlideArea;
    if (backgroundBoxes !== undefined) theme.backgroundBoxes = backgroundBoxes;

    await theme.save();

    const updatedTheme = await StageMonitorTheme.findByPk(theme.id);

    res.json({ theme: updatedTheme });
  } catch (error) {
    console.error('Error updating stage monitor theme:', error);
    res.status(500).json({ error: 'Failed to update theme' });
  }
});

// Delete theme
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const theme = await StageMonitorTheme.findByPk(req.params.id);

    if (!theme) {
      return res.status(404).json({ error: 'Theme not found' });
    }

    // Cannot delete built-in themes
    if (theme.isBuiltIn) {
      return res.status(403).json({ error: 'Cannot delete built-in themes' });
    }

    if (theme.createdById !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if this theme is the user's default and clear it
    const user = await User.findByPk(req.user.id);
    if (user && user.preferences?.defaultStageMonitorThemeId === theme.id) {
      const { defaultStageMonitorThemeId, ...restPreferences } = user.preferences || {};
      user.preferences = restPreferences;
      user.changed('preferences', true);
      await user.save();
    }

    await theme.destroy();

    res.json({ message: 'Theme deleted successfully' });
  } catch (error) {
    console.error('Error deleting stage monitor theme:', error);
    res.status(500).json({ error: 'Failed to delete theme' });
  }
});

// Set theme as user's default
router.post('/:id/set-default', authenticateToken, async (req, res) => {
  try {
    const theme = await StageMonitorTheme.findByPk(req.params.id);

    if (!theme) {
      return res.status(404).json({ error: 'Theme not found' });
    }

    // Allow setting built-in or user's own themes as default
    if (!theme.isBuiltIn && theme.createdById !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Update user's preferences with default theme
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Create new preferences object to ensure Sequelize detects the change
    const newPreferences = { ...(user.preferences || {}), defaultStageMonitorThemeId: theme.id };
    user.preferences = newPreferences;
    user.changed('preferences', true);
    await user.save();

    res.json({ message: 'Default stage monitor theme set successfully', defaultThemeId: theme.id });
  } catch (error) {
    console.error('Error setting default stage monitor theme:', error);
    res.status(500).json({ error: 'Failed to set default theme' });
  }
});

// Duplicate theme
router.post('/:id/duplicate', authenticateToken, async (req, res) => {
  try {
    const sourceTheme = await StageMonitorTheme.findByPk(req.params.id);

    if (!sourceTheme) {
      return res.status(404).json({ error: 'Theme not found' });
    }

    // Allow duplicating built-in themes or user's own themes
    if (!sourceTheme.isBuiltIn && sourceTheme.createdById !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { name } = req.body;
    const newName = name || `${sourceTheme.name} (Copy)`;

    const newTheme = await StageMonitorTheme.create({
      name: newName,
      createdById: req.user.id,
      isBuiltIn: false,
      canvasDimensions: sourceTheme.canvasDimensions,
      colors: sourceTheme.colors,
      header: sourceTheme.header,
      clock: sourceTheme.clock,
      songTitle: sourceTheme.songTitle,
      currentSlideArea: sourceTheme.currentSlideArea,
      currentSlideText: sourceTheme.currentSlideText,
      nextSlideArea: sourceTheme.nextSlideArea,
      backgroundBoxes: sourceTheme.backgroundBoxes || []
    });

    res.status(201).json({ theme: newTheme });
  } catch (error) {
    console.error('Error duplicating stage monitor theme:', error);
    res.status(500).json({ error: 'Failed to duplicate theme' });
  }
});

module.exports = router;
