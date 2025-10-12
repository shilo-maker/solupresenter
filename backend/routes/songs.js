const express = require('express');
const router = express.Router();
const Song = require('../models/Song');
const { authenticateToken } = require('../middleware/auth');

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
    if (originalSong.isPublic && originalSong.createdBy.toString() !== req.user._id.toString()) {
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
    if (originalSong.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
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
    res.status(500).json({ error: 'Failed to update song' });
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

module.exports = router;
