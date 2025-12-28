/**
 * Translation Service
 *
 * Uses local dictionaries from worship songs first, then falls back to MyMemory API.
 * This ensures worship-context translations (e.g., "שלום" → "peace" not "hello")
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// MyMemory API endpoint
const API_URL = 'https://api.mymemory.translated.net/get';

// Load translation dictionaries
let lineDictionary = {};
let wordDictionary = {};

const lineDictPath = path.join(__dirname, '..', 'scripts', 'hebrew-translation-lines.json');
const wordDictPath = path.join(__dirname, '..', 'scripts', 'hebrew-translation-words.json');

try {
  if (fs.existsSync(lineDictPath)) {
    lineDictionary = JSON.parse(fs.readFileSync(lineDictPath, 'utf-8'));
    console.log(`📖 Translation line dictionary loaded: ${Object.keys(lineDictionary).length} phrases`);
  }
  if (fs.existsSync(wordDictPath)) {
    wordDictionary = JSON.parse(fs.readFileSync(wordDictPath, 'utf-8'));
    console.log(`📖 Translation word dictionary loaded: ${Object.keys(wordDictionary).length} words`);
  }
} catch (error) {
  console.error('❌ Error loading translation dictionaries:', error.message);
}

/**
 * Try to translate using local dictionaries
 * Returns null if no translation found
 */
function translateFromDictionary(hebrewText) {
  const trimmed = hebrewText.trim();

  // Try exact line match first
  if (lineDictionary[trimmed]) {
    return {
      text: lineDictionary[trimmed],
      source: 'line-dictionary'
    };
  }

  // Try word-by-word translation
  const words = trimmed.split(/\s+/);
  const translated = [];
  let allFound = true;

  for (const word of words) {
    // Remove punctuation for lookup
    const cleanWord = word.replace(/[.,!?;:'"()[\]{}\-–—]/g, '').trim();

    if (wordDictionary[cleanWord]) {
      translated.push(wordDictionary[cleanWord]);
    } else {
      allFound = false;
      break;
    }
  }

  // Only return if all words were found
  if (allFound && translated.length > 0) {
    // Capitalize only the first letter of the entire translation
    const result = translated.join(' ');
    return {
      text: result.charAt(0).toUpperCase() + result.slice(1),
      source: 'word-dictionary'
    };
  }

  return null;
}

/**
 * Translate text using MyMemory API (fallback)
 */
async function translateWithAPI(text, sourceLang = 'he', targetLang = 'en') {
  if (!text || text.trim().length === 0) {
    return { text: '', success: true, source: 'empty' };
  }

  const params = new URLSearchParams({
    q: text,
    langpair: `${sourceLang}|${targetLang}`,
    de: 'shilo@soluisrael.org' // Registered email for 30,000 chars/day limit
  });

  const url = `${API_URL}?${params.toString()}`;

  return new Promise((resolve) => {
    const request = https.get(url, { timeout: 10000 }, (response) => {
      let data = '';

      response.on('data', (chunk) => {
        data += chunk;
      });

      response.on('end', () => {
        try {
          const result = JSON.parse(data);

          if (result.responseStatus === 200 && result.responseData) {
            resolve({
              text: result.responseData.translatedText,
              success: true,
              source: 'mymemory-api',
              match: result.responseData.match
            });
          } else {
            resolve({
              text: '',
              success: false,
              source: 'mymemory-api',
              error: result.responseDetails || 'Translation failed'
            });
          }
        } catch (parseError) {
          resolve({
            text: '',
            success: false,
            source: 'mymemory-api',
            error: 'Failed to parse translation response'
          });
        }
      });
    });

    request.on('error', (error) => {
      resolve({
        text: '',
        success: false,
        source: 'mymemory-api',
        error: error.message
      });
    });

    request.on('timeout', () => {
      request.destroy();
      resolve({
        text: '',
        success: false,
        source: 'mymemory-api',
        error: 'Translation request timed out'
      });
    });
  });
}

/**
 * Main translation function
 * Tries local dictionaries first, falls back to MyMemory API
 */
async function translate(text, sourceLang = 'he', targetLang = 'en') {
  if (!text || text.trim().length === 0) {
    return { text: '', success: true, source: 'empty' };
  }

  // Only use dictionaries for Hebrew to English
  if (sourceLang === 'he' && targetLang === 'en') {
    const dictResult = translateFromDictionary(text);
    if (dictResult) {
      return {
        text: dictResult.text,
        success: true,
        source: dictResult.source
      };
    }
  }

  // Fall back to API
  return translateWithAPI(text, sourceLang, targetLang);
}

/**
 * Translate Hebrew text to English
 * Convenience wrapper for common use case
 */
async function translateHebrewToEnglish(hebrewText) {
  return translate(hebrewText, 'he', 'en');
}

/**
 * Get dictionary statistics
 */
function getDictionaryStats() {
  return {
    lineCount: Object.keys(lineDictionary).length,
    wordCount: Object.keys(wordDictionary).length
  };
}

module.exports = {
  translate,
  translateHebrewToEnglish,
  getDictionaryStats
};
