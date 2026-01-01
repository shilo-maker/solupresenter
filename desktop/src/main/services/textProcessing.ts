import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { translateHebrewToEnglish, initTranslator, isTranslatorReady } from './mlTranslation';

// Hebrew character detection
const HEBREW_REGEX = /[\u0590-\u05FF]/;

// Basic Hebrew to Latin transliteration map
const TRANSLITERATION_MAP: Record<string, string> = {
  'א': '', 'ב': 'v', 'ג': 'g', 'ד': 'd', 'ה': 'h',
  'ו': 'v', 'ז': 'z', 'ח': 'ch', 'ט': 't', 'י': 'y',
  'כ': 'kh', 'ך': 'kh', 'ל': 'l', 'מ': 'm', 'ם': 'm',
  'נ': 'n', 'ן': 'n', 'ס': 's', 'ע': '', 'פ': 'f',
  'ף': 'f', 'צ': 'tz', 'ץ': 'tz', 'ק': 'k', 'ר': 'r',
  'ש': 'sh', 'ת': 't',
  // With dagesh
  'בּ': 'b', 'כּ': 'k', 'פּ': 'p', 'שׁ': 'sh', 'שׂ': 's'
};

// Vowels (niqqud)
const VOWEL_MAP: Record<string, string> = {
  '\u05B0': 'e', // shva
  '\u05B1': 'e', // hataf segol
  '\u05B2': 'a', // hataf patah
  '\u05B3': 'o', // hataf qamats
  '\u05B4': 'i', // hiriq
  '\u05B5': 'e', // tsere
  '\u05B6': 'e', // segol
  '\u05B7': 'a', // patah
  '\u05B8': 'a', // qamats
  '\u05B9': 'o', // holam
  '\u05BA': 'o', // holam haser
  '\u05BB': 'u', // qubuts
  '\u05BC': '', // dagesh
  '\u05BD': '', // meteg
  '\u05BE': '-', // maqaf
  '\u05BF': '', // rafe
  '\u05C1': '', // shin dot
  '\u05C2': '', // sin dot
};

// Extended dictionary (will be loaded from file)
let transliterationDict: Record<string, string> = {};
let translationLineDict: Record<string, string> = {};
let translationWordDict: Record<string, string> = {};

/**
 * Load dictionaries from various possible locations
 */
function loadDictionaries(): void {
  // Possible paths to look for dictionaries
  const possiblePaths = [
    // Development: resources folder in desktop app
    path.join(app.getAppPath(), 'resources', 'dictionaries'),
    // Development: relative to src folder
    path.join(app.getAppPath(), '..', '..', 'resources', 'dictionaries'),
    // Development: relative to desktop folder
    path.join(app.getAppPath(), '..', 'backend', 'services'),
    // Development: from solupresenter root
    path.join(app.getAppPath(), '..', '..', 'backend', 'services'),
    // Packaged: resources folder
    path.join(process.resourcesPath || '', 'dictionaries'),
    // Packaged: next to executable
    path.join(path.dirname(app.getPath('exe')), 'dictionaries'),
    // User data folder (for downloaded dictionaries)
    path.join(app.getPath('userData'), 'dictionaries')
  ];

  let loaded = false;

  for (const basePath of possiblePaths) {
    if (!fs.existsSync(basePath)) continue;

    try {
      // Load transliteration dictionary
      const transLitPath = path.join(basePath, 'transliteration-dict.json');
      if (fs.existsSync(transLitPath)) {
        transliterationDict = JSON.parse(fs.readFileSync(transLitPath, 'utf-8'));
        console.log(`Loaded transliteration dictionary from ${basePath}: ${Object.keys(transliterationDict).length} words`);
        loaded = true;
      }

      // Load translation dictionaries
      const transLinePath = path.join(basePath, 'translation-line-dict.json');
      if (fs.existsSync(transLinePath)) {
        translationLineDict = JSON.parse(fs.readFileSync(transLinePath, 'utf-8'));
        console.log(`Loaded translation line dictionary: ${Object.keys(translationLineDict).length} phrases`);
      }

      const transWordPath = path.join(basePath, 'translation-word-dict.json');
      if (fs.existsSync(transWordPath)) {
        translationWordDict = JSON.parse(fs.readFileSync(transWordPath, 'utf-8'));
        console.log(`Loaded translation word dictionary: ${Object.keys(translationWordDict).length} words`);
      }

      if (loaded) break;
    } catch (error) {
      console.warn(`Failed to load dictionaries from ${basePath}:`, error);
    }
  }

  if (!loaded) {
    console.warn('No dictionaries found, using basic character-by-character transliteration');
  }
}

// Load dictionaries on module initialization
loadDictionaries();

/**
 * Check if text contains Hebrew characters
 */
export function isHebrew(text: string): boolean {
  return HEBREW_REGEX.test(text);
}

/**
 * Transliterate a single Hebrew word
 */
function transliterateWord(word: string): string {
  // Check dictionary first
  const normalized = word.trim().toLowerCase();
  if (transliterationDict[normalized]) {
    return transliterationDict[normalized];
  }

  // Fall back to character-by-character transliteration
  let result = '';
  for (let i = 0; i < word.length; i++) {
    const char = word[i];

    // Check for vowels
    if (VOWEL_MAP[char] !== undefined) {
      result += VOWEL_MAP[char];
      continue;
    }

    // Check for consonants
    if (TRANSLITERATION_MAP[char] !== undefined) {
      result += TRANSLITERATION_MAP[char];
      continue;
    }

    // Keep non-Hebrew characters as is
    if (!HEBREW_REGEX.test(char)) {
      result += char;
    }
  }

  return result;
}

/**
 * Transliterate Hebrew text to Latin characters
 */
export function transliterate(text: string): string {
  if (!isHebrew(text)) {
    return text;
  }

  // Split into words and transliterate each
  const words = text.split(/\s+/);
  const transliterated = words.map((word) => {
    if (!isHebrew(word)) {
      return word;
    }
    return transliterateWord(word);
  });

  return transliterated.join(' ');
}

/**
 * Translate Hebrew text to English using dictionary (fallback method)
 */
function translateWithDictionary(text: string): string {
  const normalized = text.trim();

  // Check line dictionary first
  if (translationLineDict[normalized]) {
    return translationLineDict[normalized];
  }

  // Try word-by-word translation
  const words = normalized.split(/\s+/);
  const translated = words.map((word) => {
    if (!isHebrew(word)) {
      return word;
    }
    return translationWordDict[word] || word;
  });

  return translated.join(' ');
}

/**
 * Translate Hebrew text to English
 * Uses ML translation (transformers.js) first, falls back to dictionary
 */
export async function translate(text: string): Promise<string> {
  if (!isHebrew(text)) {
    return text;
  }

  const normalized = text.trim();

  // Try ML translation first (transformers.js)
  try {
    const mlTranslation = await translateHebrewToEnglish(normalized);
    if (mlTranslation && mlTranslation.trim()) {
      console.log(`ML Translation: "${normalized}" -> "${mlTranslation}"`);
      return mlTranslation;
    }
  } catch (error) {
    console.warn('ML translation failed, falling back to dictionary:', error);
  }

  // Fall back to dictionary-based translation
  console.log('Using dictionary fallback for translation');
  const dictTranslation = translateWithDictionary(normalized);

  // If dictionary translation changed anything, return it
  if (dictTranslation !== normalized) {
    return dictTranslation;
  }

  // Return original if all else fails
  return text;
}

/**
 * Process text for quick slide - returns original, transliteration, and translation
 */
export async function processQuickSlide(text: string): Promise<{
  original: string;
  transliteration: string;
  translation: string;
}> {
  const original = text.trim();

  if (!isHebrew(original)) {
    return {
      original,
      transliteration: original,
      translation: original
    };
  }

  const transliteration = transliterate(original);
  const translation = await translate(original);

  return {
    original,
    transliteration,
    translation
  };
}

/**
 * Get dictionary statistics
 */
export function getDictionaryStats(): {
  transliterationWords: number;
  translationLines: number;
  translationWords: number;
} {
  return {
    transliterationWords: Object.keys(transliterationDict).length,
    translationLines: Object.keys(translationLineDict).length,
    translationWords: Object.keys(translationWordDict).length
  };
}
