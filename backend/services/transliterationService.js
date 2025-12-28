/**
 * Hebrew Transliteration Service
 *
 * Uses a dictionary built from existing songs for accurate transliteration,
 * with consonant-only fallback for unknown words.
 */

const fs = require('fs');
const path = require('path');

// Load the dictionary
let dictionary = {};
const dictPath = path.join(__dirname, '..', 'scripts', 'hebrew-transliteration-dict.json');

try {
  if (fs.existsSync(dictPath)) {
    dictionary = JSON.parse(fs.readFileSync(dictPath, 'utf-8'));
    console.log(`📖 Transliteration dictionary loaded: ${Object.keys(dictionary).length} words`);
  } else {
    console.warn('⚠️ Transliteration dictionary not found. Run build-transliteration-dictionary.js first.');
  }
} catch (error) {
  console.error('❌ Error loading transliteration dictionary:', error.message);
}

// Hebrew consonant to Latin mapping (fallback for unknown words)
const CONSONANT_MAP = {
  'א': '', // aleph - silent or glottal stop
  'ב': 'v', // vet (without dagesh)
  'בּ': 'b', // bet (with dagesh)
  'ג': 'g',
  'ד': 'd',
  'ה': 'h',
  'ו': 'v', // vav as consonant
  'ז': 'z',
  'ח': 'ch',
  'ט': 't',
  'י': 'y',
  'כ': 'kh', // khaf
  'ך': 'kh', // final khaf
  'כּ': 'k', // kaf with dagesh
  'ל': 'l',
  'מ': 'm',
  'ם': 'm', // final mem
  'נ': 'n',
  'ן': 'n', // final nun
  'ס': 's',
  'ע': '', // ayin - silent or guttural
  'פ': 'f', // feh
  'ף': 'f', // final feh
  'פּ': 'p', // peh with dagesh
  'צ': 'ts',
  'ץ': 'ts', // final tsade
  'ק': 'k',
  'ר': 'r',
  'ש': 'sh', // shin
  'שׂ': 's', // sin
  'ת': 't',
  // Common niqqud (vowels) - basic mapping
  'ָ': 'a', // kamatz
  'ַ': 'a', // patach
  'ֶ': 'e', // segol
  'ֵ': 'e', // tsere
  'ִ': 'i', // hiriq
  'ֹ': 'o', // holam
  'ֻ': 'u', // kubutz
  'ּ': '', // dagesh (handled by specific letters)
  'ְ': '', // shva (often silent)
};

// Hebrew character detection
const HEBREW_REGEX = /[\u0590-\u05FF]/;

// Punctuation to normalize
const PUNCTUATION = /[.,!?;:'"()[\]{}\-–—]/g;

/**
 * Check if text contains Hebrew characters
 */
function isHebrew(text) {
  return HEBREW_REGEX.test(text);
}

/**
 * Normalize a word for dictionary lookup
 */
function normalizeWord(word) {
  return word.replace(PUNCTUATION, '').trim();
}

/**
 * Consonant-only transliteration (fallback)
 * Returns basic Latin representation without vowels
 */
function consonantFallback(hebrewWord) {
  let result = '';
  for (const char of hebrewWord) {
    if (CONSONANT_MAP[char] !== undefined) {
      result += CONSONANT_MAP[char];
    } else if (!HEBREW_REGEX.test(char)) {
      // Keep non-Hebrew characters as-is (spaces, numbers, etc.)
      result += char;
    }
    // Skip unknown Hebrew characters
  }
  return result || hebrewWord; // Return original if completely empty
}

/**
 * Transliterate a single Hebrew word
 * Returns { text: string, source: 'dictionary' | 'fallback' }
 */
function transliterateWord(hebrewWord) {
  const normalized = normalizeWord(hebrewWord);

  if (!normalized || !isHebrew(normalized)) {
    return { text: hebrewWord, source: 'passthrough' };
  }

  // Try dictionary lookup
  if (dictionary[normalized]) {
    return { text: dictionary[normalized], source: 'dictionary' };
  }

  // Fallback to consonant mapping
  const fallback = consonantFallback(normalized);
  return { text: fallback, source: 'fallback' };
}

/**
 * Transliterate a full Hebrew line
 * Returns { text: string, stats: { dictionary: number, fallback: number } }
 */
function transliterateLine(hebrewLine) {
  if (!hebrewLine || !isHebrew(hebrewLine)) {
    return { text: hebrewLine, stats: { dictionary: 0, fallback: 0 } };
  }

  const words = hebrewLine.split(/(\s+)/); // Keep whitespace
  const stats = { dictionary: 0, fallback: 0 };

  const transliterated = words.map(word => {
    if (/^\s+$/.test(word)) {
      return word; // Preserve whitespace
    }

    const result = transliterateWord(word);
    if (result.source === 'dictionary') {
      stats.dictionary++;
    } else if (result.source === 'fallback') {
      stats.fallback++;
    }
    return result.text;
  });

  return {
    text: transliterated.join(''),
    stats
  };
}

/**
 * Get dictionary statistics
 */
function getDictionaryStats() {
  return {
    wordCount: Object.keys(dictionary).length,
    loaded: Object.keys(dictionary).length > 0
  };
}

/**
 * Reload dictionary from file (useful after rebuilding)
 */
function reloadDictionary() {
  try {
    if (fs.existsSync(dictPath)) {
      dictionary = JSON.parse(fs.readFileSync(dictPath, 'utf-8'));
      console.log(`📖 Transliteration dictionary reloaded: ${Object.keys(dictionary).length} words`);
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ Error reloading dictionary:', error.message);
    return false;
  }
}

module.exports = {
  transliterateLine,
  transliterateWord,
  isHebrew,
  getDictionaryStats,
  reloadDictionary
};
