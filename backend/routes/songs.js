const express = require('express');
const router = express.Router();
const multer = require('multer');
const { Song, User } = require('../models');
const { Op } = require('sequelize');
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

// Export all public songs for desktop sync (no auth required)
router.get('/export', async (req, res) => {
  try {
    const songs = await Song.findAll({
      where: { isPublic: true },
      attributes: ['id', 'title', 'originalLanguage', 'tags', 'slides', 'author', 'backgroundImage'],
      order: [['title', 'ASC']]
    });

    // Map to simple format with _id for desktop compatibility
    const exportedSongs = songs.map(song => ({
      _id: song.id,
      title: song.title,
      originalLanguage: song.originalLanguage,
      tags: song.tags || [],
      slides: song.slides || [],
      author: song.author,
      backgroundImage: song.backgroundImage
    }));

    res.json(exportedSongs);
  } catch (error) {
    console.error('Error exporting songs:', error);
    res.status(500).json({ error: 'Failed to export songs' });
  }
});

// Get all songs (public + user's personal songs)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const songs = await Song.findAll({
      where: {
        [Op.or]: [
          { isPublic: true },
          { createdById: req.user.id }
        ]
      },
      attributes: ['id', 'title', 'originalLanguage', 'tags', 'isPublic', 'createdById', 'usageCount', 'updatedAt', 'slides', 'author'],
      include: [{
        model: User,
        as: 'creator',
        attributes: ['email']
      }],
      order: [['title', 'ASC']],
      raw: false
    });

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

    let whereConditions = {
      [Op.or]: [
        { isPublic: true },
        { createdById: req.user.id }
      ]
    };

    if (tags) {
      // For JSON/JSONB array fields, use contains or overlaps
      whereConditions.tags = { [Op.overlap]: tags.split(',') };
    }

    if (language) {
      whereConditions.originalLanguage = language;
    }

    // Fetch all accessible songs (we'll filter and sort by relevance in JS)
    const allSongs = await Song.findAll({
      where: whereConditions,
      attributes: ['id', 'title', 'originalLanguage', 'tags', 'isPublic', 'createdById', 'usageCount', 'updatedAt', 'slides', 'author'],
      include: [{
        model: User,
        as: 'creator',
        attributes: ['email']
      }],
      raw: false
    });

    let songs = allSongs;

    // If there's a search query, filter and prioritize results
    if (query) {
      const searchTerm = query.toLowerCase();

      // Helper to check if lyrics contain the search term
      const lyricsContain = (slides) => {
        if (!slides || !Array.isArray(slides)) return false;
        return slides.some(slide =>
          (slide.originalText && slide.originalText.toLowerCase().includes(searchTerm)) ||
          (slide.transliteration && slide.transliteration.toLowerCase().includes(searchTerm)) ||
          (slide.translation && slide.translation.toLowerCase().includes(searchTerm)) ||
          (slide.translationOverflow && slide.translationOverflow.toLowerCase().includes(searchTerm))
        );
      };

      // Filter songs that match either title or lyrics
      const matchingSongs = allSongs.filter(song => {
        const titleMatch = song.title.toLowerCase().includes(searchTerm);
        const lyricsMatch = lyricsContain(song.slides);
        return titleMatch || lyricsMatch;
      });

      // Sort: title matches first, then lyrics-only matches, alphabetically within each group
      songs = matchingSongs.sort((a, b) => {
        const aTitleMatch = a.title.toLowerCase().includes(searchTerm);
        const bTitleMatch = b.title.toLowerCase().includes(searchTerm);

        // Title matches come first
        if (aTitleMatch && !bTitleMatch) return -1;
        if (!aTitleMatch && bTitleMatch) return 1;

        // Within same priority, sort alphabetically by title
        return a.title.localeCompare(b.title);
      });
    } else {
      // No search query - just sort alphabetically
      songs = allSongs.sort((a, b) => a.title.localeCompare(b.title));
    }

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

    // Sequelize doesn't have a direct distinct for JSON array fields
    // We need to fetch all songs and extract unique tags
    const songs = await Song.findAll({
      where: {
        [Op.or]: [
          { isPublic: true },
          { createdById: req.user.id }
        ]
      },
      attributes: ['tags'],
      raw: true
    });

    // Flatten all tags and get unique values
    const allTags = songs.flatMap(song => song.tags || []);
    const uniqueTags = [...new Set(allTags)];
    const sortedTags = uniqueTags.sort();

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
          createdById: req.user.id,
          isPublic: false,
          isPendingApproval: false,
          backgroundImage: ''
        });

        results.successful.push({
          filename: file.originalname,
          songId: song.id,
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
    const song = await Song.findByPk(req.params.id, {
      include: [{
        model: User,
        as: 'creator',
        attributes: ['email']
      }]
    });

    if (!song) {
      console.log(`Song not found: ${req.params.id}`);
      return res.status(404).json({ error: 'Song not found' });
    }

    // Check access permission (allow access if no creator or if public or if user owns it)
    if (!song.isPublic && song.createdById && song.createdById.toString() !== req.user.id.toString()) {
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
    const { title, originalLanguage, slides, tags, submitForApproval, backgroundImage, author } = req.body;

    if (!title || !originalLanguage || !slides || slides.length === 0) {
      return res.status(400).json({ error: 'Title, language, and at least one slide are required' });
    }

    // Admins create public songs automatically
    const isAdmin = req.user.role === 'admin';

    const song = await Song.create({
      title,
      originalLanguage,
      slides,
      tags: tags || [],
      createdById: req.user.id,
      isPendingApproval: isAdmin ? false : (submitForApproval || false),
      isPublic: isAdmin,
      approvedById: isAdmin ? req.user.id : null,
      approvedAt: isAdmin ? new Date() : null,
      backgroundImage: backgroundImage || '',
      author: author || null
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
    const originalSong = await Song.findByPk(req.params.id);

    if (!originalSong) {
      return res.status(404).json({ error: 'Song not found' });
    }

    const { title, originalLanguage, slides, tags, backgroundImage, isPublic, isPendingApproval, author } = req.body;

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
    if (originalSong.isPublic && originalSong.createdById && originalSong.createdById.toString() !== req.user.id.toString()) {
      if (!isAdmin) {
        // Non-admin users: create a personal copy
        const personalCopy = await Song.create({
          title: title !== undefined ? title : originalSong.title,
          originalLanguage: originalLanguage !== undefined ? originalLanguage : originalSong.originalLanguage,
          slides: slides !== undefined ? slides : originalSong.slides,
          tags: tags !== undefined ? tags : originalSong.tags,
          createdById: req.user.id,
          isPublic: false,
          isPendingApproval: false,
          backgroundImage: backgroundImage !== undefined ? backgroundImage : originalSong.backgroundImage,
          author: author !== undefined ? author : originalSong.author
        });

        console.log('Created personal copy with slides:', personalCopy.slides);
        return res.json({ song: personalCopy, message: 'Personal copy created' });
      }
      // Admin users: continue to edit the original song below
    }

    // If user owns the song, update it
    // If createdById is null (migrated songs), allow admin users to edit
    if (originalSong.createdById && originalSong.createdById.toString() !== req.user.id.toString()) {
      // Check if user is admin (already checked above, but double-check for security)
      if (!isAdmin) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    // If createdById is null and user is not admin, deny access
    if (!originalSong.createdById && !isAdmin) {
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
    if (author !== undefined) {
      originalSong.author = author || null;
    }

    // Handle visibility changes
    // Admins can directly make songs public
    if (isAdmin && isPublic !== undefined) {
      originalSong.isPublic = isPublic;
      if (isPublic) {
        originalSong.isPendingApproval = false;
        originalSong.approvedById = req.user.id;
        originalSong.approvedAt = new Date();
      }
    }
    // Non-admins can submit for approval (only if they own the song)
    if (!isAdmin && isPendingApproval !== undefined &&
        originalSong.createdById && originalSong.createdById.toString() === req.user.id.toString()) {
      originalSong.isPendingApproval = isPendingApproval;
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
    const song = await Song.findByPk(req.params.id);

    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }

    if (song.createdById && song.createdById.toString() !== req.user.id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await song.destroy();

    res.json({ message: 'Song deleted successfully' });
  } catch (error) {
    console.error('Error deleting song:', error);
    res.status(500).json({ error: 'Failed to delete song' });
  }
});

module.exports = router;
