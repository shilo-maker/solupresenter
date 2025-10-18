const express = require('express');
const router = express.Router();
const multer = require('multer');
const Song = require('../models/Song');
const { authenticateToken } = require('../middleware/auth');

// Helper function to detect and extract primary language text from title
function extractPrimaryLanguage(title) {
  // Remove content in parentheses/brackets (usually translations)
  let cleanTitle = title.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').trim();

  // If we still have text, use it
  if (cleanTitle) {
    return cleanTitle;
  }

  // Otherwise return original title
  return title.trim();
}

// Configure multer for file uploads (store in memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit per file
    files: 50 // Max 50 files at once
  },
  fileFilter: (req, file, cb) => {
    // Accept only .txt files
    if (file.mimetype === 'text/plain' || file.originalname.endsWith('.txt')) {
      cb(null, true);
    } else {
      cb(new Error('Only .txt files are allowed'));
    }
  }
});

// Get all songs (public + user's personal songs)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const songs = await Song.find({
      $or: [
        { isPublic: true },
        { createdBy: req.user._id }
      ]
    }).populate('createdBy', 'email').sort({ title: 1 });

    res.json({ songs });
  } catch (error) {
    console.error('Error fetching songs:', error);
    res.status(500).json({ error: 'Failed to fetch songs' });
  }
});

// Search songs
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const { query, tags, language } = req.query;

    let filter = {
      $or: [
        { isPublic: true },
        { createdBy: req.user._id }
      ]
    };

    if (query) {
      filter.$text = { $search: query };
    }

    if (tags) {
      filter.tags = { $in: tags.split(',') };
    }

    if (language) {
      filter.originalLanguage = language;
    }

    const songs = await Song.find(filter)
      .populate('createdBy', 'email')
      .sort(query ? { score: { $meta: 'textScore' } } : { title: 1 });

    res.json({ songs });
  } catch (error) {
    console.error('Error searching songs:', error);
    res.status(500).json({ error: 'Failed to search songs' });
  }
});

// Get all unique tags
router.get('/meta/tags', authenticateToken, async (req, res) => {
  try {
    const tags = await Song.distinct('tags', {
      $or: [
        { isPublic: true },
        { createdBy: req.user._id }
      ]
    });

    res.json({ tags: tags.sort() });
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

// Bulk import songs from .txt files
router.post('/bulk-import', authenticateToken, upload.array('songFiles', 50), async (req, res) => {
  console.log('📤 Bulk import request received');
  console.log('Files count:', req.files?.length || 0);
  console.log('User:', req.user?.email);

  try {
    if (!req.files || req.files.length === 0) {
      console.error('❌ No files uploaded');
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const results = {
      successful: [],
      failed: []
    };

    // Process each uploaded file
    for (const file of req.files) {
      try {
        const content = file.buffer.toString('utf8');
        const lines = content.split('\n').map(line => line.trim()).filter(line => line);

        if (lines.length === 0) {
          results.failed.push({
            filename: file.originalname,
            error: 'File is empty'
          });
          continue;
        }

        // First line is the title - extract primary language (remove translations in parentheses)
        const title = extractPrimaryLanguage(lines[0]);
        const slides = [];
        let i = 1;

        // Parse slides (4 lines per slide)
        while (i < lines.length) {
          const originalText = lines[i] || '';
          const transliteration = lines[i + 1] || '';
          const translation = lines[i + 2] || '';
          const translationOverflow = lines[i + 3] || '';

          // Only add slide if it has at least original text
          if (originalText) {
            slides.push({
              originalText,
              transliteration,
              translation,
              translationOverflow,
              verseType: 'verse' // Default verse type
            });
          }

          i += 4; // Move to next slide
        }

        if (slides.length === 0) {
          results.failed.push({
            filename: file.originalname,
            error: 'No valid slides found'
          });
          continue;
        }

        // Create the song
        const song = await Song.create({
          title,
          originalLanguage: 'he', // Default to Hebrew, user can change later
          slides,
          tags: [],
          createdBy: req.user._id,
          isPublic: false,
          isPendingApproval: false,
          backgroundImage: ''
        });

        results.successful.push({
          filename: file.originalname,
          songId: song._id,
          title: song.title,
          slideCount: slides.length
        });

      } catch (error) {
        console.error(`Error processing file ${file.originalname}:`, error);
        results.failed.push({
          filename: file.originalname,
          error: error.message
        });
      }
    }

    console.log('✅ Bulk import completed');
    console.log('Summary:', {
      total: req.files.length,
      successful: results.successful.length,
      failed: results.failed.length
    });

    res.json({
      message: 'Bulk import completed',
      results,
      summary: {
        total: req.files.length,
        successful: results.successful.length,
        failed: results.failed.length
      }
    });

  } catch (error) {
    console.error('❌ Error in bulk import:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to process bulk import' });
  }
});

// Get single song
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const song = await Song.findById(req.params.id).populate('createdBy', 'email');

    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }

    // Check access permission
    if (!song.isPublic && song.createdBy._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ song });
  } catch (error) {
    console.error('Error fetching song:', error);
    res.status(500).json({ error: 'Failed to fetch song' });
  }
});

// Create new song
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { title, originalLanguage, slides, tags, submitForApproval, backgroundImage } = req.body;

    if (!title || !originalLanguage || !slides || slides.length === 0) {
      return res.status(400).json({ error: 'Title, language, and at least one slide are required' });
    }

    const song = await Song.create({
      title,
      originalLanguage,
      slides,
      tags: tags || [],
      createdBy: req.user._id,
      isPendingApproval: submitForApproval || false,
      isPublic: false,
      backgroundImage: backgroundImage || ''
    });

    res.status(201).json({ song });
  } catch (error) {
    console.error('Error creating song:', error);
    res.status(500).json({ error: 'Failed to create song' });
  }
});

// Update song (creates personal copy if editing public song)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const originalSong = await Song.findById(req.params.id);

    if (!originalSong) {
      return res.status(404).json({ error: 'Song not found' });
    }

    const { title, originalLanguage, slides, tags, backgroundImage } = req.body;

    console.log('Received update request for song:', req.params.id);
    console.log('Received slides:', slides);
    console.log('First slide verseType:', slides && slides.length > 0 ? slides[0].verseType : 'no slides');

    // If editing a public song that user doesn't own, create personal copy
    if (originalSong.isPublic && originalSong.createdBy && originalSong.createdBy.toString() !== req.user._id.toString()) {
      const personalCopy = await Song.create({
        title: title || originalSong.title,
        originalLanguage: originalLanguage || originalSong.originalLanguage,
        slides: slides || originalSong.slides,
        tags: tags || originalSong.tags,
        createdBy: req.user._id,
        isPublic: false,
        isPendingApproval: false,
        backgroundImage: backgroundImage !== undefined ? backgroundImage : originalSong.backgroundImage
      });

      console.log('Created personal copy with slides:', personalCopy.slides);
      return res.json({ song: personalCopy, message: 'Personal copy created' });
    }

    // If user owns the song, update it
    // If createdBy is null (migrated songs), allow admin users to edit
    if (originalSong.createdBy && originalSong.createdBy.toString() !== req.user._id.toString()) {
      // Check if user is admin
      if (req.user.role !== 'admin' && !req.user.isAdmin) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    // If createdBy is null and user is not admin, deny access
    if (!originalSong.createdBy && req.user.role !== 'admin' && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Access denied - song has no owner' });
    }

    originalSong.title = title || originalSong.title;
    originalSong.originalLanguage = originalLanguage || originalSong.originalLanguage;
    originalSong.slides = slides || originalSong.slides;
    originalSong.tags = tags || originalSong.tags;
    if (backgroundImage !== undefined) {
      originalSong.backgroundImage = backgroundImage;
    }

    console.log('Updating song with slides:', originalSong.slides);
    console.log('First slide before save:', originalSong.slides[0]);

    await originalSong.save();

    console.log('Song saved. First slide after save:', originalSong.slides[0]);

    res.json({ song: originalSong });
  } catch (error) {
    console.error('Error updating song:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    if (error.name === 'ValidationError') {
      console.error('Validation errors:', error.errors);
    }
    res.status(500).json({
      error: 'Failed to update song',
      details: error.message
    });
  }
});

// Delete song (only own songs)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);

    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }

    if (song.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await song.deleteOne();

    res.json({ message: 'Song deleted successfully' });
  } catch (error) {
    console.error('Error deleting song:', error);
    res.status(500).json({ error: 'Failed to delete song' });
  }
});

module.exports = router;
