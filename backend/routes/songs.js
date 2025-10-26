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
    })
    .select('_id title originalLanguage tags isPublic createdBy usageCount updatedAt')
    .populate('createdBy', 'email')
    .sort({ title: 1 })
    .lean();

    // Prevent caching to ensure fresh song list
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

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
      .select('_id title originalLanguage tags isPublic createdBy usageCount updatedAt')
      .populate('createdBy', 'email')
      .sort(query ? { score: { $meta: 'textScore' } } : { title: 1 })
      .lean();

    res.json({ songs });
  } catch (error) {
    console.error('Error searching songs:', error);
    res.status(500).json({ error: 'Failed to search songs' });
  }
});

// Get all unique tags (cached for 5 minutes)
let tagsCache = { data: null, timestamp: 0 };
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

router.get('/meta/tags', authenticateToken, async (req, res) => {
  try {
    // Check cache
    const now = Date.now();
    if (tagsCache.data && (now - tagsCache.timestamp) < CACHE_DURATION) {
      return res.json({ tags: tagsCache.data });
    }

    const tags = await Song.distinct('tags', {
      $or: [
        { isPublic: true },
        { createdBy: req.user._id }
      ]
    });

    const sortedTags = tags.sort();
    tagsCache = { data: sortedTags, timestamp: now };

    res.json({ tags: sortedTags });
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

    const hasHebrew = (text) => /[\u0590-\u05FF]/.test(text);
    const extractHebrew = (text) => {
      const hebrewMatch = text.match(/[\u0590-\u05FF]+(?:\s+[\u0590-\u05FF]+)*/);
      return hebrewMatch ? hebrewMatch[0] : null;
    };

    // Process each uploaded file
    for (const file of req.files) {
      try {
        const content = file.buffer.toString('utf8');
        const lines = content.split('\n').map(line => line.trim());

        if (lines.length === 0) {
          results.failed.push({
            filename: file.originalname,
            error: 'File is empty'
          });
          continue;
        }

        // Extract title from first line: "Title: [song title]"
        let title = file.originalname.replace('.txt', ''); // Default to filename
        let i = 0;

        if (lines[i] && lines[i].startsWith('Title:')) {
          title = lines[i].substring(6).trim();
          i++;
        }

        // If title is English-only, try to get Hebrew from filename
        if (!hasHebrew(title)) {
          const hebrewFromFilename = extractHebrew(file.originalname);
          if (hebrewFromFilename) {
            title = hebrewFromFilename;
          }
        }

        // Skip empty lines after title
        while (i < lines.length && lines[i] === '') {
          i++;
        }

        // Parse slides using the correct pattern:
        // 1. Find next Hebrew line (skip if not Hebrew)
        // 2. Next line of text = transliteration
        // 3. Empty line
        // 4. 1 or 2 consecutive lines = translation (+ optional overflow)
        // 5. Empty line, then repeat
        const slides = [];

        while (i < lines.length) {
          // Skip empty lines
          while (i < lines.length && lines[i] === '') {
            i++;
          }

          if (i >= lines.length) break;

          // Step 1: Find next Hebrew line
          let originalText = '';
          while (i < lines.length && lines[i]) {
            if (hasHebrew(lines[i])) {
              originalText = lines[i];
              i++;
              break;
            }
            // Skip non-Hebrew lines
            i++;
          }

          if (!originalText) break; // No more Hebrew lines found

          // Step 2: Read transliteration (next non-empty line)
          while (i < lines.length && lines[i] === '') {
            i++;
          }

          let transliteration = '';
          if (i < lines.length && lines[i]) {
            transliteration = lines[i];
            i++;
          }

          // Step 3: Skip empty line(s) before translation
          while (i < lines.length && lines[i] === '') {
            i++;
          }

          // Step 4: Read translation (1 or 2 consecutive lines)
          let translation = '';
          let translationOverflow = '';

          if (i < lines.length && lines[i]) {
            translation = lines[i];
            i++;

            // Check if next line (without empty line in between) is also translation overflow
            if (i < lines.length && lines[i] && !hasHebrew(lines[i])) {
              translationOverflow = lines[i];
              i++;
            }
          }

          // Add slide
          slides.push({
            originalText,
            transliteration,
            translation,
            translationOverflow,
            verseType: 'verse' // Default verse type
          });

          // Step 5: Empty line should follow, and loop repeats
        }

        if (slides.length === 0) {
          results.failed.push({
            filename: file.originalname,
            error: 'No valid slides found'
          });
          continue;
        }

        // Final fallback: If title still doesn't have Hebrew, use first few words of first Hebrew line
        if (!hasHebrew(title) && slides.length > 0 && slides[0].originalText) {
          const firstHebrew = slides[0].originalText;
          const words = firstHebrew.split(/\s+/).filter(w => w.length > 0).slice(0, 4).join(' ');
          if (words) {
            title = words;
          }
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
      console.log(`Song not found: ${req.params.id}`);
      return res.status(404).json({ error: 'Song not found' });
    }

    // Check access permission (allow access if no creator or if public or if user owns it)
    if (!song.isPublic && song.createdBy && song.createdBy._id.toString() !== req.user._id.toString()) {
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
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('Extracted values:');
    console.log('  title:', title);
    console.log('  originalLanguage:', originalLanguage);
    console.log('  slides count:', slides?.length);
    console.log('  tags:', tags);
    console.log('First slide verseType:', slides && slides.length > 0 ? slides[0].verseType : 'no slides');

    // If editing a public song that user doesn't own
    // Admin users can edit directly, non-admin users get a personal copy
    const isAdmin = req.user.role === 'admin' || req.user.isAdmin;
    if (originalSong.isPublic && originalSong.createdBy && originalSong.createdBy.toString() !== req.user._id.toString()) {
      if (!isAdmin) {
        // Non-admin users: create a personal copy
        const personalCopy = await Song.create({
          title: title !== undefined ? title : originalSong.title,
          originalLanguage: originalLanguage !== undefined ? originalLanguage : originalSong.originalLanguage,
          slides: slides !== undefined ? slides : originalSong.slides,
          tags: tags !== undefined ? tags : originalSong.tags,
          createdBy: req.user._id,
          isPublic: false,
          isPendingApproval: false,
          backgroundImage: backgroundImage !== undefined ? backgroundImage : originalSong.backgroundImage
        });

        console.log('Created personal copy with slides:', personalCopy.slides);
        return res.json({ song: personalCopy, message: 'Personal copy created' });
      }
      // Admin users: continue to edit the original song below
    }

    // If user owns the song, update it
    // If createdBy is null (migrated songs), allow admin users to edit
    if (originalSong.createdBy && originalSong.createdBy.toString() !== req.user._id.toString()) {
      // Check if user is admin (already checked above, but double-check for security)
      if (!isAdmin) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    // If createdBy is null and user is not admin, deny access
    if (!originalSong.createdBy && !isAdmin) {
      return res.status(403).json({ error: 'Access denied - song has no owner' });
    }

    // Only update fields if they are provided (not undefined)
    if (title !== undefined) {
      originalSong.title = title;
    }
    if (originalLanguage !== undefined) {
      originalSong.originalLanguage = originalLanguage;
    }
    if (slides !== undefined) {
      originalSong.slides = slides;
    }
    if (tags !== undefined) {
      originalSong.tags = tags;
    }
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
