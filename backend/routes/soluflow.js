const express = require('express');
const router = express.Router();
const { Sequelize, DataTypes, Op } = require('sequelize');
const { Song, SongMapping } = require('../models');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// SoluFlow external database connection
const soluflowDb = new Sequelize(
  'postgresql://soluflow_2lzn_user:33ENrqD3QhoPlR8lktBPu0HaGoR7pSu1@dpg-d46aah6mcj7s73b4g7n0-a.frankfurt-postgres.render.com/soluflow_2lzn',
  {
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: { require: true, rejectUnauthorized: false }
    }
  }
);

// SoluFlow Song model (read-only from external DB)
const SoluflowSong = soluflowDb.define('Song', {
  id: { type: DataTypes.INTEGER, primaryKey: true },
  title: DataTypes.STRING,
  content: DataTypes.TEXT,
  workspace_id: DataTypes.INTEGER
}, { tableName: 'songs', timestamps: false });

/**
 * Strip ChordPro chords from content to get pure lyrics
 */
function stripChords(chordProContent) {
  if (!chordProContent) return '';
  return chordProContent
    .replace(/\[([A-Ga-g][#b]?)(m|maj|min|dim|aug|sus|add|7|9|11|13)*[^\]]*\]/g, '')
    .replace(/\{[^}]+\}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract lyrics from SoluPresenter slides
 */
function extractPresenterLyrics(slides) {
  if (!slides || !Array.isArray(slides)) return '';
  return slides
    .map(slide => slide.originalText || '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize text for comparison
 */
function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^\u0590-\u05FF\u0041-\u007Aa-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate Levenshtein distance
 */
function levenshteinDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

/**
 * Calculate similarity percentage (0-100)
 */
function calculateSimilarity(str1, str2) {
  if (!str1 && !str2) return 100;
  if (!str1 || !str2) return 0;

  const norm1 = normalizeText(str1);
  const norm2 = normalizeText(str2);

  if (norm1 === norm2) return 100;
  if (!norm1 || !norm2) return 0;

  const maxLen = Math.max(norm1.length, norm2.length);
  if (maxLen === 0) return 100;

  const distance = levenshteinDistance(norm1, norm2);
  return Math.round((1 - distance / maxLen) * 100);
}

/**
 * Calculate match score between SoluFlow and SoluPresenter songs
 */
function calculateMatchScore(flowTitle, flowContent, presenterTitle, presenterSlides) {
  const flowLyrics = stripChords(flowContent);
  const presenterLyrics = extractPresenterLyrics(presenterSlides);

  const titleSimilarity = calculateSimilarity(flowTitle, presenterTitle);
  const lyricsSimilarity = calculateSimilarity(flowLyrics, presenterLyrics);

  // Weight: 40% title, 60% lyrics
  const overallScore = Math.round(titleSimilarity * 0.4 + lyricsSimilarity * 0.6);

  return {
    titleSimilarity,
    lyricsSimilarity,
    overallScore
  };
}

// Get single SoluFlow song with content
router.get('/songs/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const songId = parseInt(req.params.id);
    await soluflowDb.authenticate();

    const song = await SoluflowSong.findByPk(songId);
    if (!song) {
      return res.status(404).json({ error: 'SoluFlow song not found' });
    }

    // Strip chords from content
    const lyricsOnly = stripChords(song.content);

    res.json({
      id: song.id,
      title: song.title,
      content: song.content,
      lyricsOnly
    });
  } catch (error) {
    console.error('Error fetching SoluFlow song:', error);
    res.status(500).json({ error: 'Failed to fetch SoluFlow song' });
  }
});

// Get all SoluFlow songs
router.get('/songs', authenticateToken, isAdmin, async (req, res) => {
  try {
    await soluflowDb.authenticate();
    const songs = await SoluflowSong.findAll({
      order: [['title', 'ASC']]
    });

    res.json({ songs: songs.map(s => ({ id: s.id, title: s.title })) });
  } catch (error) {
    console.error('Error fetching SoluFlow songs:', error);
    res.status(500).json({ error: 'Failed to fetch SoluFlow songs' });
  }
});

// Get unmatched SoluFlow songs
router.get('/unmatched', authenticateToken, isAdmin, async (req, res) => {
  try {
    await soluflowDb.authenticate();

    // Get all SoluFlow songs
    const flowSongs = await SoluflowSong.findAll({
      order: [['title', 'ASC']]
    });

    // Get all mapped SoluFlow IDs
    const mappings = await SongMapping.findAll({
      attributes: ['soluflowId']
    });
    const mappedIds = new Set(mappings.map(m => m.soluflowId));

    // Filter unmatched
    const unmatched = flowSongs
      .filter(s => !mappedIds.has(s.id))
      .map(s => ({ id: s.id, title: s.title }));

    res.json({
      songs: unmatched,
      total: flowSongs.length,
      mapped: mappedIds.size,
      unmatched: unmatched.length
    });
  } catch (error) {
    console.error('Error fetching unmatched songs:', error);
    res.status(500).json({ error: 'Failed to fetch unmatched songs' });
  }
});

// Get all mappings
router.get('/mappings', authenticateToken, isAdmin, async (req, res) => {
  try {
    const mappings = await SongMapping.findAll({
      order: [['soluflowTitle', 'ASC']]
    });

    res.json({ mappings });
  } catch (error) {
    console.error('Error fetching mappings:', error);
    res.status(500).json({ error: 'Failed to fetch mappings' });
  }
});

// Get suggested matches for a SoluFlow song
router.get('/suggest/:flowSongId', authenticateToken, isAdmin, async (req, res) => {
  try {
    const flowSongId = parseInt(req.params.flowSongId);

    await soluflowDb.authenticate();

    // Get the SoluFlow song
    const flowSong = await SoluflowSong.findByPk(flowSongId);
    if (!flowSong) {
      return res.status(404).json({ error: 'SoluFlow song not found' });
    }

    // Get all SoluPresenter songs
    const presenterSongs = await Song.findAll({
      where: { isPublic: true },
      attributes: ['id', 'title', 'slides']
    });

    // Calculate similarity scores
    const suggestions = presenterSongs.map(pSong => {
      const score = calculateMatchScore(
        flowSong.title,
        flowSong.content,
        pSong.title,
        pSong.slides
      );

      return {
        id: pSong.id,
        title: pSong.title,
        ...score
      };
    });

    // Sort by score and return top 10
    suggestions.sort((a, b) => b.overallScore - a.overallScore);
    const topSuggestions = suggestions.slice(0, 10);

    // Get a preview of the SoluFlow song lyrics
    const lyricsPreview = stripChords(flowSong.content).substring(0, 200);

    res.json({
      flowSong: {
        id: flowSong.id,
        title: flowSong.title,
        lyricsPreview
      },
      suggestions: topSuggestions
    });
  } catch (error) {
    console.error('Error getting suggestions:', error);
    res.status(500).json({ error: 'Failed to get suggestions' });
  }
});

// Search SoluPresenter songs for manual matching
router.get('/search-presenter', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.length < 2) {
      return res.json({ songs: [] });
    }

    // Use Op.like with LOWER() for cross-database compatibility (SQLite + PostgreSQL)
    const searchPattern = `%${query.toLowerCase()}%`;
    const sequelize = Song.sequelize;

    // Search by title first (priority 1)
    const titleMatches = await Song.findAll({
      where: {
        isPublic: true,
        [Op.and]: [
          sequelize.where(sequelize.fn('LOWER', sequelize.col('title')), Op.like, searchPattern)
        ]
      },
      attributes: ['id', 'title'],
      limit: 20,
      order: [['title', 'ASC']]
    });

    // Get IDs of title matches to exclude from content search
    const titleMatchIds = titleMatches.map(s => s.id);

    // Search by content second (priority 2), excluding title matches
    const contentMatches = await Song.findAll({
      where: {
        isPublic: true,
        id: {
          [Op.notIn]: titleMatchIds.length > 0 ? titleMatchIds : [0]
        },
        [Op.and]: [
          sequelize.where(sequelize.fn('LOWER', sequelize.col('content')), Op.like, searchPattern)
        ]
      },
      attributes: ['id', 'title'],
      limit: 20 - titleMatches.length,
      order: [['title', 'ASC']]
    });

    // Combine results: title matches first, then content matches
    const songs = [
      ...titleMatches.map(s => ({ ...s.toJSON(), matchType: 'title' })),
      ...contentMatches.map(s => ({ ...s.toJSON(), matchType: 'content' }))
    ];

    res.json({ songs });
  } catch (error) {
    console.error('Error searching songs:', error);
    res.status(500).json({ error: 'Failed to search songs' });
  }
});

// Create a new mapping
router.post('/mappings', authenticateToken, isAdmin, async (req, res) => {
  try {
    // Support both old format and new format from auto-linking
    const {
      soluflowId, soluflowTitle, solupresenterId, solupresenterTitle, confidence, noMatch,
      soluflowSongId, presenterSongId, matchType
    } = req.body;

    // Normalize parameters (support both old and new format)
    const flowId = soluflowId || soluflowSongId;
    const presenterId = solupresenterId || presenterSongId;

    if (!flowId) {
      return res.status(400).json({ error: 'SoluFlow song ID is required' });
    }

    // Check if mapping already exists
    const existing = await SongMapping.findOne({ where: { soluflowId: flowId } });

    if (existing) {
      // If it's a "no_match" entry and we now have a presenter ID, update it
      if (existing.noMatch && presenterId) {
        // Fetch presenter song title
        let presenterTitle = solupresenterTitle;
        if (!presenterTitle && presenterId) {
          const { Song } = require('../models');
          const presenterSong = await Song.findByPk(presenterId);
          presenterTitle = presenterSong?.title || '';
        }

        existing.solupresenterId = presenterId;
        existing.solupresenterTitle = presenterTitle;
        existing.noMatch = false;
        existing.manuallyLinked = true;
        existing.confidence = confidence || (matchType === 'manual' ? 1.0 : null);
        await existing.save();

        return res.json({ mapping: existing, updated: true });
      }
      return res.status(400).json({ error: 'Mapping already exists for this SoluFlow song' });
    }

    // Get titles if not provided
    let flowTitle = soluflowTitle;
    if (!flowTitle && flowId) {
      try {
        await soluflowDb.authenticate();
        const flowSong = await SoluflowSong.findByPk(flowId);
        flowTitle = flowSong?.title || '';
      } catch (e) {
        console.error('Error fetching SoluFlow song title:', e);
        flowTitle = '';
      }
    }

    let presenterTitle = solupresenterTitle;
    if (!presenterTitle && presenterId) {
      const { Song } = require('../models');
      const presenterSong = await Song.findByPk(presenterId);
      presenterTitle = presenterSong?.title || '';
    }

    const mapping = await SongMapping.create({
      soluflowId: flowId,
      soluflowTitle: flowTitle,
      solupresenterId: noMatch ? null : presenterId,
      solupresenterTitle: noMatch ? null : presenterTitle,
      confidence: noMatch ? null : (confidence || (matchType === 'manual' ? 1.0 : null)),
      manuallyLinked: true,
      noMatch: noMatch || false
    });

    res.status(201).json({ mapping });
  } catch (error) {
    console.error('Error creating mapping:', error);
    res.status(500).json({ error: 'Failed to create mapping' });
  }
});

// Delete a mapping
router.delete('/mappings/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const mapping = await SongMapping.findByPk(req.params.id);

    if (!mapping) {
      return res.status(404).json({ error: 'Mapping not found' });
    }

    await mapping.destroy();
    res.json({ message: 'Mapping deleted successfully' });
  } catch (error) {
    console.error('Error deleting mapping:', error);
    res.status(500).json({ error: 'Failed to delete mapping' });
  }
});

// Import existing mappings from JSON file
router.post('/import-existing', authenticateToken, isAdmin, async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');

    const mappingPath = path.join(__dirname, '../scripts/song-mapping.json');

    if (!fs.existsSync(mappingPath)) {
      return res.status(404).json({ error: 'song-mapping.json not found' });
    }

    const data = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));

    let imported = 0;
    let skipped = 0;

    for (const m of data.mappings) {
      // Check if already exists
      const existing = await SongMapping.findOne({ where: { soluflowId: m.soluflow.id } });
      if (existing) {
        skipped++;
        continue;
      }

      await SongMapping.create({
        soluflowId: m.soluflow.id,
        soluflowTitle: m.soluflow.title,
        solupresenterId: m.solupresenter.id,
        solupresenterTitle: m.solupresenter.title,
        confidence: m.confidence,
        manuallyLinked: false,
        noMatch: false
      });
      imported++;
    }

    res.json({
      message: 'Import completed',
      imported,
      skipped,
      total: data.mappings.length
    });
  } catch (error) {
    console.error('Error importing mappings:', error);
    res.status(500).json({ error: 'Failed to import mappings' });
  }
});

// Get mapping stats
router.get('/stats', authenticateToken, isAdmin, async (req, res) => {
  try {
    await soluflowDb.authenticate();

    const totalFlowSongs = await SoluflowSong.count();
    const totalMappings = await SongMapping.count();
    const noMatchCount = await SongMapping.count({ where: { noMatch: true } });
    const linkedCount = totalMappings - noMatchCount;

    res.json({
      totalSoluflowSongs: totalFlowSongs,
      totalMappings,
      linked: linkedCount,
      noMatch: noMatchCount,
      unmatched: totalFlowSongs - totalMappings
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

module.exports = router;
