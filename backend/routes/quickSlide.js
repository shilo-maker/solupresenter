/**
 * Quick Slide API Routes
 *
 * Provides auto-transliteration and translation for the Quick Slide feature.
 */

const express = require('express');
const router = express.Router();
const { transliterateLine, isHebrew, getDictionaryStats } = require('../services/transliterationService');
const { translateHebrewToEnglish } = require('../services/translationService');

/**
 * POST /api/quick-slide/process
 *
 * Process Hebrew text and return transliteration + translation
 *
 * Request body:
 * {
 *   text: "Hebrew text to process"
 * }
 *
 * Response:
 * {
 *   original: "Hebrew text",
 *   transliteration: "Latin characters",
 *   translation: "English translation",
 *   stats: { dictionary: 5, fallback: 1 }
 * }
 */
router.post('/process', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required' });
    }

    // Check if text contains Hebrew
    if (!isHebrew(text)) {
      return res.json({
        original: text,
        transliteration: text, // Return as-is if not Hebrew
        translation: '',
        stats: { dictionary: 0, fallback: 0 },
        isHebrew: false
      });
    }

    // Get transliteration from dictionary
    const translitResult = transliterateLine(text);

    // Get translation from MyMemory API
    const translationResult = await translateHebrewToEnglish(text);

    res.json({
      original: text,
      transliteration: translitResult.text,
      translation: translationResult.success ? translationResult.text : '',
      translationSource: translationResult.source || 'unknown',
      stats: translitResult.stats,
      isHebrew: true,
      translationSuccess: translationResult.success,
      translationError: translationResult.error || null
    });

  } catch (error) {
    console.error('Quick Slide process error:', error);
    res.status(500).json({ error: 'Failed to process text' });
  }
});

/**
 * POST /api/quick-slide/transliterate
 *
 * Transliterate Hebrew text only (no translation API call)
 */
router.post('/transliterate', (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required' });
    }

    if (!isHebrew(text)) {
      return res.json({
        original: text,
        transliteration: text,
        stats: { dictionary: 0, fallback: 0 },
        isHebrew: false
      });
    }

    const result = transliterateLine(text);

    res.json({
      original: text,
      transliteration: result.text,
      stats: result.stats,
      isHebrew: true
    });

  } catch (error) {
    console.error('Transliteration error:', error);
    res.status(500).json({ error: 'Failed to transliterate text' });
  }
});

/**
 * POST /api/quick-slide/translate
 *
 * Translate Hebrew text to English only
 */
router.post('/translate', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required' });
    }

    const result = await translateHebrewToEnglish(text);

    res.json({
      original: text,
      translation: result.text,
      success: result.success,
      error: result.error || null
    });

  } catch (error) {
    console.error('Translation error:', error);
    res.status(500).json({ error: 'Failed to translate text' });
  }
});

/**
 * GET /api/quick-slide/stats
 *
 * Get transliteration dictionary statistics
 */
router.get('/stats', (req, res) => {
  const stats = getDictionaryStats();
  res.json(stats);
});

module.exports = router;
