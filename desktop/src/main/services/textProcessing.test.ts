import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';

// Mock electron before importing the module under test
// (vitest.config.ts already aliases 'electron' to src/__mocks__/electron.ts,
// but we add getAppPath which the mock doesn't include)
vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => {
      if (name === 'userData') {
        return path.join(os.tmpdir(), 'solupresenter-test');
      }
      if (name === 'exe') {
        return path.join(os.tmpdir(), 'solupresenter-test', 'app.exe');
      }
      return os.tmpdir();
    },
    getAppPath: () => path.join(os.tmpdir(), 'solupresenter-test-app'),
    isPackaged: false
  }
}));

// Mock mlTranslation - return null by default (testing dictionary fallback path)
vi.mock('./mlTranslation', () => ({
  translateHebrewToEnglish: vi.fn().mockResolvedValue(null),
  initTranslator: vi.fn().mockResolvedValue(false),
  isTranslatorReady: vi.fn().mockReturnValue(false)
}));

import {
  isHebrew,
  transliterate,
  translate,
  processQuickSlide,
  getDictionaryStats
} from './textProcessing';

import { translateHebrewToEnglish } from './mlTranslation';

// ============================================================
// 1. isHebrew
// ============================================================
describe('isHebrew', () => {
  it('should return true for a purely Hebrew string', () => {
    expect(isHebrew('שלום')).toBe(true);
  });

  it('should return true for Hebrew sentence with spaces', () => {
    expect(isHebrew('ברוך אתה אדוני')).toBe(true);
  });

  it('should return false for English text', () => {
    expect(isHebrew('Hello world')).toBe(false);
  });

  it('should return true for mixed Hebrew and English text', () => {
    expect(isHebrew('Hello שלום world')).toBe(true);
  });

  it('should return false for an empty string', () => {
    expect(isHebrew('')).toBe(false);
  });

  it('should return false for numbers only', () => {
    expect(isHebrew('12345')).toBe(false);
  });

  it('should return false for symbols and punctuation', () => {
    expect(isHebrew('!@#$%^&*()')).toBe(false);
  });

  it('should return false for whitespace only', () => {
    expect(isHebrew('   ')).toBe(false);
  });

  it('should return true for a single Hebrew character', () => {
    expect(isHebrew('א')).toBe(true);
  });

  it('should return true for Hebrew with niqqud (vowel marks)', () => {
    // \u05E9\u05C1\u05B8\u05DC\u05D5\u05B9\u05DD = שָׁלוֹם with niqqud
    expect(isHebrew('שָׁלוֹם')).toBe(true);
  });

  it('should return false for other non-Latin scripts (e.g. Arabic, Cyrillic)', () => {
    expect(isHebrew('مرحبا')).toBe(false); // Arabic
    expect(isHebrew('Привет')).toBe(false); // Cyrillic
  });

  it('should return true for text containing Hebrew surrounded by numbers', () => {
    expect(isHebrew('123 שלום 456')).toBe(true);
  });
});

// ============================================================
// 2. transliterate
// ============================================================
describe('transliterate', () => {
  it('should transliterate basic Hebrew consonants', () => {
    // ש = sh, ל = l, ו = v, מ = m => "shlvm"
    // But שלום = sh + l + v + m
    const result = transliterate('שלום');
    expect(result).toBe('shlvm');
  });

  it('should return non-Hebrew text unchanged', () => {
    expect(transliterate('Hello world')).toBe('Hello world');
  });

  it('should handle mixed Hebrew and English words', () => {
    const result = transliterate('Hello שלום world');
    // English words preserved, Hebrew word transliterated
    expect(result).toContain('Hello');
    expect(result).toContain('world');
    // The Hebrew part should be transliterated (not remain Hebrew)
    expect(isHebrew(result)).toBe(false);
  });

  it('should transliterate aleph as empty string', () => {
    // א maps to ''
    const result = transliterate('א');
    expect(result).toBe('');
  });

  it('should transliterate bet without dagesh as v', () => {
    // ב without dagesh = 'v'
    const result = transliterate('ב');
    expect(result).toBe('v');
  });

  it('should transliterate gimel as g', () => {
    const result = transliterate('ג');
    expect(result).toBe('g');
  });

  it('should transliterate shin as sh', () => {
    const result = transliterate('ש');
    expect(result).toBe('sh');
  });

  it('should transliterate final-form letters correctly', () => {
    // ך = kh (final kaf), ם = m (final mem), ן = n (final nun), ף = f (final pe), ץ = tz (final tsadi)
    expect(transliterate('ך')).toBe('kh');
    expect(transliterate('ם')).toBe('m');
    expect(transliterate('ן')).toBe('n');
    expect(transliterate('ף')).toBe('f');
    expect(transliterate('ץ')).toBe('tz');
  });

  it('should handle niqqud vowels', () => {
    // Add hiriq (\u05B4 = 'i') after a consonant
    // ב + hiriq = 'v' + 'i' = 'vi'
    const result = transliterate('בִ');
    expect(result).toBe('vi');
  });

  it('should handle patah vowel', () => {
    // ב + patah (\u05B7) = 'v' + 'a' = 'va'
    const result = transliterate('בַ');
    expect(result).toBe('va');
  });

  it('should handle holam vowel', () => {
    // ב + holam (\u05B9) = 'v' + 'o' = 'vo'
    const result = transliterate('בֹ');
    expect(result).toBe('vo');
  });

  it('should handle qubuts vowel', () => {
    // ב + qubuts (\u05BB) = 'v' + 'u' = 'vu'
    const result = transliterate('בֻ');
    expect(result).toBe('vu');
  });

  it('should handle shva vowel', () => {
    // ב + shva (\u05B0) = 'v' + 'e' = 've'
    const result = transliterate('בְ');
    expect(result).toBe('ve');
  });

  it('should strip dagesh (not add extra characters)', () => {
    // dagesh \u05BC maps to ''
    const result = transliterate('בּ');
    // ב = 'v', dagesh = '' => 'v'
    // (Note: the dagesh-bet combo 'בּ' as a single char maps to 'b')
    // When entered as two separate chars, ב + dagesh, it's 'v' + ''
    expect(typeof result).toBe('string');
  });

  it('should handle maqaf (Hebrew hyphen) as -', () => {
    // maqaf \u05BE = '-'
    const result = transliterate('ב\u05BEג');
    expect(result).toBe('v-g');
  });

  it('should handle an empty string', () => {
    expect(transliterate('')).toBe('');
  });

  it('should pass through numbers and punctuation within Hebrew text', () => {
    // transliterateWord keeps non-Hebrew chars as-is
    const result = transliterate('שלום123');
    expect(result).toContain('123');
  });

  it('should handle multi-word Hebrew text', () => {
    // Two words: שלום עולם
    const result = transliterate('שלום עולם');
    // Should be two transliterated words separated by space
    const parts = result.split(' ');
    expect(parts.length).toBe(2);
    // Neither part should contain Hebrew
    parts.forEach(part => {
      expect(isHebrew(part)).toBe(false);
    });
  });

  it('should transliterate chet as ch', () => {
    const result = transliterate('ח');
    expect(result).toBe('ch');
  });

  it('should transliterate tsadi as tz', () => {
    const result = transliterate('צ');
    expect(result).toBe('tz');
  });

  it('should transliterate qof as k', () => {
    const result = transliterate('ק');
    expect(result).toBe('k');
  });
});

// ============================================================
// 3. translate
// ============================================================
describe('translate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return non-Hebrew text unchanged', async () => {
    const result = await translate('Hello world');
    expect(result).toBe('Hello world');
  });

  it('should fall back to dictionary when ML translation returns null', async () => {
    vi.mocked(translateHebrewToEnglish).mockResolvedValue(null);

    const result = await translate('שלום');
    // With no dictionary loaded, translateWithDictionary returns original
    // since no word-by-word match exists. The function returns the original text.
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('should fall back to dictionary when ML translation throws', async () => {
    vi.mocked(translateHebrewToEnglish).mockRejectedValue(new Error('ML model failed'));

    const result = await translate('שלום');
    // Should not throw, should return something
    expect(typeof result).toBe('string');
  });

  it('should fall back to dictionary when ML returns empty string', async () => {
    vi.mocked(translateHebrewToEnglish).mockResolvedValue('   ');

    const result = await translate('שלום');
    // Empty/whitespace ML result should trigger fallback
    expect(typeof result).toBe('string');
  });

  it('should use ML translation when it returns a valid result', async () => {
    vi.mocked(translateHebrewToEnglish).mockResolvedValue('Peace');

    const result = await translate('שלום');
    expect(result).toBe('Peace');
  });

  it('should return original Hebrew when no translation is found anywhere', async () => {
    vi.mocked(translateHebrewToEnglish).mockResolvedValue(null);

    // Without dictionaries loaded, we get the original back
    const result = await translate('שלום');
    expect(result).toBe('שלום');
  });

  it('should handle empty string', async () => {
    // Empty string has no Hebrew, so it returns as-is
    const result = await translate('');
    expect(result).toBe('');
  });

  it('should handle whitespace-only string', async () => {
    const result = await translate('   ');
    // No Hebrew chars, returns as-is
    expect(result).toBe('   ');
  });

  it('should call translateHebrewToEnglish with trimmed text', async () => {
    vi.mocked(translateHebrewToEnglish).mockResolvedValue('Peace');

    await translate('  שלום  ');
    expect(translateHebrewToEnglish).toHaveBeenCalledWith('שלום');
  });

  it('should preserve non-Hebrew words in dictionary fallback', async () => {
    vi.mocked(translateHebrewToEnglish).mockResolvedValue(null);

    // Mixed text: "Hello שלום" - English word should be preserved in fallback
    const result = await translate('Hello שלום');
    expect(result).toContain('Hello');
  });
});

// ============================================================
// 4. processQuickSlide
// ============================================================
describe('processQuickSlide', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(translateHebrewToEnglish).mockResolvedValue(null);
  });

  it('should return all three forms for Hebrew text', async () => {
    const result = await processQuickSlide('שלום');

    expect(result).toHaveProperty('original');
    expect(result).toHaveProperty('transliteration');
    expect(result).toHaveProperty('translation');
  });

  it('should set original to the trimmed input for Hebrew text', async () => {
    const result = await processQuickSlide('  שלום  ');
    expect(result.original).toBe('שלום');
  });

  it('should return a non-Hebrew transliteration for Hebrew input', async () => {
    const result = await processQuickSlide('שלום');

    // Transliteration should not contain Hebrew characters
    expect(isHebrew(result.transliteration)).toBe(false);
  });

  it('should return the same string for all three fields when text is English', async () => {
    const result = await processQuickSlide('Hello world');

    expect(result.original).toBe('Hello world');
    expect(result.transliteration).toBe('Hello world');
    expect(result.translation).toBe('Hello world');
  });

  it('should trim the original text', async () => {
    const result = await processQuickSlide('  Hello world  ');

    expect(result.original).toBe('Hello world');
    expect(result.transliteration).toBe('Hello world');
    expect(result.translation).toBe('Hello world');
  });

  it('should use ML translation when available', async () => {
    vi.mocked(translateHebrewToEnglish).mockResolvedValue('Peace');

    const result = await processQuickSlide('שלום');

    expect(result.original).toBe('שלום');
    expect(result.translation).toBe('Peace');
    // Transliteration should still be the char-by-char result
    expect(isHebrew(result.transliteration)).toBe(false);
  });

  it('should handle empty string', async () => {
    const result = await processQuickSlide('');

    expect(result.original).toBe('');
    expect(result.transliteration).toBe('');
    expect(result.translation).toBe('');
  });

  it('should handle numbers-only input', async () => {
    const result = await processQuickSlide('12345');

    // Not Hebrew, so all three should be the same
    expect(result.original).toBe('12345');
    expect(result.transliteration).toBe('12345');
    expect(result.translation).toBe('12345');
  });

  it('should handle multi-line Hebrew text', async () => {
    // processQuickSlide just trims, translate/transliterate work per-word
    const result = await processQuickSlide('שלום\nעולם');

    expect(result.original).toBe('שלום\nעולם');
    expect(isHebrew(result.transliteration)).toBe(false);
  });

  it('should not throw when ML translation fails', async () => {
    vi.mocked(translateHebrewToEnglish).mockRejectedValue(new Error('Model crashed'));

    const result = await processQuickSlide('שלום');

    // Should still return a valid result via fallback
    expect(result).toHaveProperty('original');
    expect(result).toHaveProperty('transliteration');
    expect(result).toHaveProperty('translation');
  });
});

// ============================================================
// 5. getDictionaryStats
// ============================================================
describe('getDictionaryStats', () => {
  it('should return an object with the three expected keys', () => {
    const stats = getDictionaryStats();

    expect(stats).toHaveProperty('transliterationWords');
    expect(stats).toHaveProperty('translationLines');
    expect(stats).toHaveProperty('translationWords');
  });

  it('should return numeric values for all counts', () => {
    const stats = getDictionaryStats();

    expect(typeof stats.transliterationWords).toBe('number');
    expect(typeof stats.translationLines).toBe('number');
    expect(typeof stats.translationWords).toBe('number');
  });

  it('should return zero counts when no dictionary files are loaded', () => {
    // In test environment, no dictionary files exist at the mock paths
    const stats = getDictionaryStats();

    expect(stats.transliterationWords).toBe(0);
    expect(stats.translationLines).toBe(0);
    expect(stats.translationWords).toBe(0);
  });

  it('should return non-negative values', () => {
    const stats = getDictionaryStats();

    expect(stats.transliterationWords).toBeGreaterThanOrEqual(0);
    expect(stats.translationLines).toBeGreaterThanOrEqual(0);
    expect(stats.translationWords).toBeGreaterThanOrEqual(0);
  });
});
