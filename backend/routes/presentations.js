const express = require('express');
const router = express.Router();
const { Presentation, User } = require('../models');
const { Op } = require('sequelize');
const { authenticateToken } = require('../middleware/auth');

// Get all presentations (public + user's personal)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const presentations = await Presentation.findAll({
      where: {
        [Op.or]: [
          { isPublic: true },
          { createdById: req.user.id }
        ]
      },
      attributes: ['id', 'title', 'slides', 'isPublic', 'createdById', 'canvasDimensions', 'backgroundSettings', 'usageCount', 'updatedAt', 'createdAt'],
      include: [{
        model: User,
        as: 'creator',
        attributes: ['email']
      }],
      order: [['title', 'ASC']],
      raw: false
    });

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.json({ presentations });
  } catch (error) {
    console.error('Error fetching presentations:', error);
    res.status(500).json({ error: 'Failed to fetch presentations' });
  }
});

// Search presentations
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const { query } = req.query;

    let whereConditions = {
      [Op.or]: [
        { isPublic: true },
        { createdById: req.user.id }
      ]
    };

    const allPresentations = await Presentation.findAll({
      where: whereConditions,
      attributes: ['id', 'title', 'slides', 'isPublic', 'createdById', 'canvasDimensions', 'backgroundSettings', 'usageCount', 'updatedAt', 'createdAt'],
      include: [{
        model: User,
        as: 'creator',
        attributes: ['email']
      }],
      raw: false
    });

    let presentations = allPresentations;

    if (query) {
      const searchTerm = query.toLowerCase();
      presentations = allPresentations.filter(p =>
        p.title.toLowerCase().includes(searchTerm)
      ).sort((a, b) => a.title.localeCompare(b.title));
    } else {
      presentations = allPresentations.sort((a, b) => a.title.localeCompare(b.title));
    }

    res.json({ presentations });
  } catch (error) {
    console.error('Error searching presentations:', error);
    res.status(500).json({ error: 'Failed to search presentations' });
  }
});

// Get single presentation
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const presentation = await Presentation.findByPk(req.params.id, {
      include: [{
        model: User,
        as: 'creator',
        attributes: ['email']
      }]
    });

    if (!presentation) {
      return res.status(404).json({ error: 'Presentation not found' });
    }

    // Check access permission
    if (!presentation.isPublic && presentation.createdById && presentation.createdById.toString() !== req.user.id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ presentation });
  } catch (error) {
    console.error('Error fetching presentation:', error);
    res.status(500).json({ error: 'Failed to fetch presentation' });
  }
});

// Create new presentation
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { title, slides, canvasDimensions, backgroundSettings } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const presentation = await Presentation.create({
      title,
      slides: slides || [],
      canvasDimensions: canvasDimensions || { width: 1920, height: 1080 },
      backgroundSettings: backgroundSettings || { type: 'color', value: '#000000' },
      createdById: req.user.id,
      isPublic: false
    });

    res.status(201).json({ presentation });
  } catch (error) {
    console.error('Error creating presentation:', error);
    res.status(500).json({ error: 'Failed to create presentation' });
  }
});

// Update presentation
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const presentation = await Presentation.findByPk(req.params.id);

    if (!presentation) {
      return res.status(404).json({ error: 'Presentation not found' });
    }

    // Check ownership
    if (presentation.createdById && presentation.createdById.toString() !== req.user.id.toString()) {
      const isAdmin = req.user.role === 'admin';
      if (!isAdmin) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const { title, slides, canvasDimensions, backgroundSettings, isPublic } = req.body;

    if (title !== undefined) {
      presentation.title = title;
    }
    if (slides !== undefined) {
      presentation.slides = slides;
    }
    if (canvasDimensions !== undefined) {
      presentation.canvasDimensions = canvasDimensions;
    }
    if (backgroundSettings !== undefined) {
      presentation.backgroundSettings = backgroundSettings;
    }

    // Only admins can change public status
    const isAdmin = req.user.role === 'admin';
    if (isAdmin && isPublic !== undefined) {
      presentation.isPublic = isPublic;
    }

    await presentation.save();

    res.json({ presentation });
  } catch (error) {
    console.error('Error updating presentation:', error);
    res.status(500).json({ error: 'Failed to update presentation' });
  }
});

// Delete presentation
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const presentation = await Presentation.findByPk(req.params.id);

    if (!presentation) {
      return res.status(404).json({ error: 'Presentation not found' });
    }

    // Check ownership (admins can delete any)
    const isAdmin = req.user.role === 'admin';
    if (presentation.createdById && presentation.createdById.toString() !== req.user.id.toString() && !isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await presentation.destroy();

    res.json({ message: 'Presentation deleted successfully' });
  } catch (error) {
    console.error('Error deleting presentation:', error);
    res.status(500).json({ error: 'Failed to delete presentation' });
  }
});

module.exports = router;
