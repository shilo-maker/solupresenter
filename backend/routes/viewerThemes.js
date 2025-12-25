const express = require('express');
const router = express.Router();
const { ViewerTheme, User } = require('../models');
const { Op } = require('sequelize');
const { authenticateToken } = require('../middleware/auth');

// Get all themes (built-in + user's own)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const themes = await ViewerTheme.findAll({
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
    console.error('Error fetching viewer themes:', error);
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

    const defaultThemeId = user.preferences?.defaultThemeId;

    // If user has a custom default, return it
    if (defaultThemeId) {
      const theme = await ViewerTheme.findByPk(defaultThemeId);
      return res.json({ defaultThemeId, theme });
    }

    // Otherwise, return the built-in Classic theme as default
    const classicTheme = await ViewerTheme.findOne({ where: { isBuiltIn: true } });
    if (classicTheme) {
      return res.json({ defaultThemeId: classicTheme.id, theme: classicTheme });
    }

    // Fallback if no built-in theme exists
    res.json({ defaultThemeId: null, theme: null });
  } catch (error) {
    console.error('Error getting default theme:', error);
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

    // Create new preferences object without defaultThemeId
    const { defaultThemeId, ...restPreferences } = user.preferences || {};
    user.preferences = restPreferences;
    user.changed('preferences', true); // Force Sequelize to detect the change
    await user.save();

    res.json({ message: 'Default theme cleared' });
  } catch (error) {
    console.error('Error clearing default theme:', error);
    res.status(500).json({ error: 'Failed to clear default theme' });
  }
});

// Get single theme
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const theme = await ViewerTheme.findByPk(req.params.id);

    if (!theme) {
      return res.status(404).json({ error: 'Theme not found' });
    }

    // Allow access to built-in themes or user's own themes
    if (!theme.isBuiltIn && theme.createdById !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ theme });
  } catch (error) {
    console.error('Error fetching theme:', error);
    res.status(500).json({ error: 'Failed to fetch theme' });
  }
});

// Create new theme
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, lineOrder, lineStyles, positioning, container, viewerBackground, linePositions, canvasDimensions } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Theme name is required' });
    }

    const theme = await ViewerTheme.create({
      name,
      createdById: req.user.id,
      isBuiltIn: false,
      lineOrder: lineOrder || ['original', 'transliteration', 'translation'],
      lineStyles: lineStyles || undefined, // Use model defaults if not provided
      positioning: positioning || undefined,
      container: container || undefined,
      viewerBackground: viewerBackground || undefined,
      linePositions: linePositions || undefined,
      canvasDimensions: canvasDimensions || undefined
    });

    res.status(201).json({ theme });
  } catch (error) {
    console.error('Error creating theme:', error);
    res.status(500).json({ error: 'Failed to create theme' });
  }
});

// Update theme
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const theme = await ViewerTheme.findByPk(req.params.id);

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

    const { name, lineOrder, lineStyles, positioning, container, viewerBackground, linePositions, canvasDimensions } = req.body;

    if (name !== undefined) theme.name = name;
    if (lineOrder !== undefined) theme.lineOrder = lineOrder;
    if (lineStyles !== undefined) theme.lineStyles = lineStyles;
    if (positioning !== undefined) theme.positioning = positioning;
    if (container !== undefined) theme.container = container;
    if (viewerBackground !== undefined) theme.viewerBackground = viewerBackground;
    if (linePositions !== undefined) theme.linePositions = linePositions;
    if (canvasDimensions !== undefined) theme.canvasDimensions = canvasDimensions;

    await theme.save();

    const updatedTheme = await ViewerTheme.findByPk(theme.id);

    res.json({ theme: updatedTheme });
  } catch (error) {
    console.error('Error updating theme:', error);
    res.status(500).json({ error: 'Failed to update theme' });
  }
});

// Delete theme
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const theme = await ViewerTheme.findByPk(req.params.id);

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

    await theme.destroy();

    res.json({ message: 'Theme deleted successfully' });
  } catch (error) {
    console.error('Error deleting theme:', error);
    res.status(500).json({ error: 'Failed to delete theme' });
  }
});

// Set theme as user's default
router.post('/:id/set-default', authenticateToken, async (req, res) => {
  try {
    const theme = await ViewerTheme.findByPk(req.params.id);

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
    const newPreferences = { ...(user.preferences || {}), defaultThemeId: theme.id };
    user.preferences = newPreferences;
    user.changed('preferences', true); // Force Sequelize to detect the change
    await user.save();

    res.json({ message: 'Default theme set successfully', defaultThemeId: theme.id });
  } catch (error) {
    console.error('Error setting default theme:', error);
    res.status(500).json({ error: 'Failed to set default theme' });
  }
});

// Duplicate theme
router.post('/:id/duplicate', authenticateToken, async (req, res) => {
  try {
    const sourceTheme = await ViewerTheme.findByPk(req.params.id);

    if (!sourceTheme) {
      return res.status(404).json({ error: 'Theme not found' });
    }

    // Allow duplicating built-in themes or user's own themes
    if (!sourceTheme.isBuiltIn && sourceTheme.createdById !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { name } = req.body;
    const newName = name || `${sourceTheme.name} (Copy)`;

    const newTheme = await ViewerTheme.create({
      name: newName,
      createdById: req.user.id,
      isBuiltIn: false,
      lineOrder: sourceTheme.lineOrder,
      lineStyles: sourceTheme.lineStyles,
      positioning: sourceTheme.positioning,
      container: sourceTheme.container,
      viewerBackground: sourceTheme.viewerBackground,
      linePositions: sourceTheme.linePositions,
      canvasDimensions: sourceTheme.canvasDimensions
    });

    res.status(201).json({ theme: newTheme });
  } catch (error) {
    console.error('Error duplicating theme:', error);
    res.status(500).json({ error: 'Failed to duplicate theme' });
  }
});

module.exports = router;
