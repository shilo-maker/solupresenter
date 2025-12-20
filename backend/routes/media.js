const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { Media, User } = require('../models');
const { Op } = require('sequelize');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../uploads/backgrounds');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer to use memory storage for processing with sharp
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit for original upload
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

// Image compression settings
const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1080;
const WEBP_QUALITY = 80;

// Upload limits (images uploaded by user, not gradients/URLs)
const LIMITS = {
  normal: {
    maxImages: 5,
    maxBytes: 2 * 1024 * 1024 // 2MB
  },
  admin: {
    maxImages: 15,
    maxBytes: 20 * 1024 * 1024 // 20MB
  }
};

/**
 * Get user's current upload usage (only counts uploaded images, not gradients/URLs)
 */
async function getUserUploadUsage(userId) {
  const userMedia = await Media.findAll({
    where: {
      uploadedById: userId,
      url: { [Op.like]: '/uploads/%' } // Only count actual uploaded files
    },
    attributes: ['id', 'fileSize']
  });

  const imageCount = userMedia.length;
  const totalBytes = userMedia.reduce((sum, m) => sum + (m.fileSize || 0), 0);

  return { imageCount, totalBytes };
}

/**
 * Process and compress an image using sharp
 * - Resize if larger than 1920x1080 (maintaining aspect ratio)
 * - Convert to WebP format
 * - Compress to 80% quality
 */
async function processImage(buffer, originalName) {
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
  const outputFilename = `${uniqueSuffix}.webp`;
  const outputPath = path.join(uploadDir, outputFilename);

  // Get image metadata
  const metadata = await sharp(buffer).metadata();

  // Process the image
  let processor = sharp(buffer);

  // Resize if larger than max dimensions (maintain aspect ratio)
  if (metadata.width > MAX_WIDTH || metadata.height > MAX_HEIGHT) {
    processor = processor.resize(MAX_WIDTH, MAX_HEIGHT, {
      fit: 'inside',
      withoutEnlargement: true
    });
  }

  // Convert to WebP with quality setting
  const outputBuffer = await processor
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();

  // Write to disk
  await fs.promises.writeFile(outputPath, outputBuffer);

  return {
    filename: outputFilename,
    path: outputPath,
    size: outputBuffer.length,
    originalSize: buffer.length
  };
}

// Get user's upload usage and limits
router.get('/usage', authenticateToken, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const limits = isAdmin ? LIMITS.admin : LIMITS.normal;
    const usage = await getUserUploadUsage(req.user.id);

    res.json({
      usage: {
        imageCount: usage.imageCount,
        totalBytes: usage.totalBytes
      },
      limits: {
        maxImages: limits.maxImages,
        maxBytes: limits.maxBytes
      },
      remaining: {
        images: limits.maxImages - usage.imageCount,
        bytes: limits.maxBytes - usage.totalBytes
      }
    });
  } catch (error) {
    console.error('Error fetching usage:', error);
    res.status(500).json({ error: 'Failed to fetch usage' });
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
  let processedFile = null;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Check upload limits
    const isAdmin = req.user.role === 'admin';
    const limits = isAdmin ? LIMITS.admin : LIMITS.normal;
    const usage = await getUserUploadUsage(req.user.id);

    if (usage.imageCount >= limits.maxImages) {
      return res.status(400).json({
        error: `Upload limit reached. You can upload up to ${limits.maxImages} images.`,
        usage: {
          imageCount: usage.imageCount,
          totalBytes: usage.totalBytes,
          limits
        }
      });
    }

    const { name } = req.body;

    // Process and compress the image
    console.log(`📷 Processing image: ${req.file.originalname} (${(req.file.size / 1024).toFixed(1)} KB)`);
    processedFile = await processImage(req.file.buffer, req.file.originalname);
    console.log(`✅ Compressed: ${(processedFile.originalSize / 1024).toFixed(1)} KB → ${(processedFile.size / 1024).toFixed(1)} KB (${Math.round((1 - processedFile.size / processedFile.originalSize) * 100)}% reduction)`);

    // Check if adding this file would exceed storage limit
    if (usage.totalBytes + processedFile.size > limits.maxBytes) {
      // Delete the processed file since we won't be saving it
      fs.unlink(processedFile.path, () => {});
      const limitMB = (limits.maxBytes / (1024 * 1024)).toFixed(0);
      const usedMB = (usage.totalBytes / (1024 * 1024)).toFixed(2);
      return res.status(400).json({
        error: `Storage limit reached. You have ${usedMB}MB used of ${limitMB}MB allowed.`,
        usage: {
          imageCount: usage.imageCount,
          totalBytes: usage.totalBytes,
          limits
        }
      });
    }

    // Generate URL for the processed file
    const fileUrl = `/uploads/backgrounds/${processedFile.filename}`;

    const media = await Media.create({
      name: name || req.file.originalname,
      type: 'image',
      url: fileUrl,
      thumbnailUrl: fileUrl,
      uploadedById: req.user.id,
      isPublic: false,
      fileSize: processedFile.size
    });

    // Calculate updated usage
    const newUsage = {
      imageCount: usage.imageCount + 1,
      totalBytes: usage.totalBytes + processedFile.size
    };

    res.status(201).json({
      media,
      compression: {
        originalSize: processedFile.originalSize,
        compressedSize: processedFile.size,
        reduction: Math.round((1 - processedFile.size / processedFile.originalSize) * 100)
      },
      usage: newUsage,
      limits,
      remaining: {
        images: limits.maxImages - newUsage.imageCount,
        bytes: limits.maxBytes - newUsage.totalBytes
      }
    });
  } catch (error) {
    console.error('Error uploading media:', error);
    // Delete processed file if database save failed
    if (processedFile && processedFile.path) {
      fs.unlink(processedFile.path, (err) => {
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
