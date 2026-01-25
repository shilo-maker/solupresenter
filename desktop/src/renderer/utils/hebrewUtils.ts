/**
 * Convert number to Hebrew numerals (gematria)
 * Examples: 1 -> א', 8 -> ח', 15 -> ט"ו, 119 -> קי"ט
 */
export const toHebrewNumerals = (num: number): string => {
  if (num <= 0 || num > 999) return num.toString();

  const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
  const tens = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
  const hundreds = ['', 'ק', 'ר', 'ש', 'ת', 'תק', 'תר', 'תש', 'תת', 'תתק'];

  // Special cases for 15 and 16 (avoid יה and יו which are divine names)
  if (num === 15) return 'ט"ו';
  if (num === 16) return 'ט"ז';

  let result = '';
  if (num >= 100) {
    result += hundreds[Math.floor(num / 100)];
    num %= 100;
  }
  if (num >= 10) {
    result += tens[Math.floor(num / 10)];
    num %= 10;
  }
  if (num > 0) {
    result += ones[num];
  }

  // Add gershayim (״) before last letter if more than one letter
  if (result.length > 1) {
    result = result.slice(0, -1) + '"' + result.slice(-1);
  } else if (result.length === 1) {
    result = result + "'";
  }

  return result;
};

/**
 * Format a Hebrew Bible reference
 * Input: bookName (Hebrew), chapter (number), verse (number or string)
 * Output: "בראשית א' 1" format (book + Hebrew chapter + Arabic verse)
 */
export const formatHebrewBibleRef = (hebrewBookName: string, chapter: number | string, verse: number | string): string => {
  const chapterNum = typeof chapter === 'string' ? parseInt(chapter) : chapter;
  const hebrewChapter = toHebrewNumerals(chapterNum);
  return `${hebrewBookName} ${hebrewChapter} ${verse}`;
};

/**
 * Parse a title like "בראשית 1" into book name and chapter
 */
export const parseHebrewTitle = (title: string): { bookName: string; chapter: number } | null => {
  // Match Hebrew text followed by a number
  const match = title.match(/^(.+?)\s+(\d+)$/);
  if (!match) return null;
  return {
    bookName: match[1].trim(),
    chapter: parseInt(match[2])
  };
};

/**
 * Format a title like "בראשית 1" to "בראשית א'" (with Hebrew chapter numeral)
 */
export const formatHebrewTitle = (title: string): string => {
  const parsed = parseHebrewTitle(title);
  if (!parsed) return title;
  return `${parsed.bookName} ${toHebrewNumerals(parsed.chapter)}`;
};
