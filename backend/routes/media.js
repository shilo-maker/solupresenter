const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Media, User } = require('../models');
const { Op } = require('sequelize');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/backgrounds');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp-randomstring-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (JPEG, PNG, GIF, WebP)'));
    }
  }
});

// Get all media (public + user's personal media)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const media = await Media.findAll({
      where: {
        [Op.or]: [
          { isPublic: true },
          { uploadedById: req.user.id }
        ]
      },
      include: [{
        model: User,
        as: 'uploader',
        attributes: ['email']
      }],
      order: [['createdAt', 'DESC']]
    });

    res.json({ media });
  } catch (error) {
    console.error('Error fetching media:', error);
    res.status(500).json({ error: 'Failed to fetch media' });
  }
});

// Upload background image file
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { name } = req.body;

    // Generate URL for the uploaded file
    const fileUrl = `/uploads/backgrounds/${req.file.filename}`;

    const media = await Media.create({
      name: name || req.file.originalname,
      type: 'image',
      url: fileUrl,
      thumbnailUrl: fileUrl, // Use same URL for thumbnail (could optimize later)
      uploadedById: req.user.id,
      isPublic: false,
      fileSize: req.file.size
    });

    res.status(201).json({ media });
  } catch (error) {
    console.error('Error uploading media:', error);
    // Delete uploaded file if database save failed
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error deleting file:', err);
      });
    }
    res.status(500).json({ error: 'Failed to upload media' });
  }
});

// Create new media (for URLs and gradients)
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
      uploadedById: req.user.id,
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
    const media = await Media.findByPk(req.params.id);

    if (!media) {
      return res.status(404).json({ error: 'Media not found' });
    }

    if (media.uploadedById !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // If it's an uploaded file (not a URL or gradient), delete the file
    if (media.url.startsWith('/uploads/')) {
      const filePath = path.join(__dirname, '..', media.url);
      fs.unlink(filePath, (err) => {
        if (err) console.error('Error deleting file:', err);
      });
    }

    await media.destroy();

    res.json({ message: 'Media deleted successfully' });
  } catch (error) {
    console.error('Error deleting media:', error);
    res.status(500).json({ error: 'Failed to delete media' });
  }
});

// Admin: Make media public
router.post('/:id/make-public', authenticateToken, isAdmin, async (req, res) => {
  try {
    const media = await Media.findByPk(req.params.id);

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
