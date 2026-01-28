/**
 * Slide Code Utilities
 *
 * Generates navigation codes for slides based on their section type.
 * Format: [Section Letter][Occurrence Number][Slide Number]
 *
 * Examples:
 * - V11 = Verse 1, slide 1
 * - V12 = Verse 1, slide 2
 * - C1 or C11 = Chorus 1, slide 1
 * - B1 = Bridge 1, slide 1
 */

export interface SlideCode {
  code: string;           // e.g., "V11", "C12"
  shortCode: string;      // e.g., "V1" (when slide 1), same as code otherwise
  sectionLetter: string;  // e.g., "V", "C", "B"
  sectionNumber: number;  // e.g., 1, 2, 3
  slideNumber: number;    // e.g., 1, 2
  slideIndex: number;     // Original slide index
}

export interface SlideCodeMap {
  codes: SlideCode[];
  byCode: Map<string, number>;  // Maps code -> slideIndex
}

// Map verseType to section letter
// Note: Bridge uses 'R' (not 'B') because 'B' is reserved for blank toggle
const SECTION_LETTERS: Record<string, string> = {
  'Verse1': 'V1',
  'Verse2': 'V2',
  'Verse3': 'V3',
  'Verse4': 'V4',
  'Verse5': 'V5',
  'Chorus': 'C',
  'Chorus1': 'C1',
  'Chorus2': 'C2',
  'PreChorus': 'P',
  'PreChorus1': 'P1',
  'PreChorus2': 'P2',
  'Bridge': 'R',      // R for bRidge (B is for blank)
  'Bridge1': 'R1',
  'Bridge2': 'R2',
  'Intro': 'I',
  'Outro': 'O',
  'Ending': 'E',
  'Tag': 'T',
  'Instrumental': 'X',
};

// Parse verseType to get section letter and number
function parseVerseType(verseType: string): { letter: string; number: number } {
  // Check direct mapping first
  const mapped = SECTION_LETTERS[verseType];
  if (mapped) {
    // Extract letter and number from mapped value
    const match = mapped.match(/^([A-Z]+)(\d*)$/);
    if (match) {
      return {
        letter: match[1],
        number: match[2] ? parseInt(match[2]) : 1
      };
    }
  }

  // Try to parse verseType directly (e.g., "Verse1" -> V, 1)
  const verseMatch = verseType.match(/^(Verse|Chorus|PreChorus|Bridge|Intro|Outro|Ending|Tag|Instrumental)(\d*)$/i);
  if (verseMatch) {
    const type = verseMatch[1].toLowerCase();
    const num = verseMatch[2] ? parseInt(verseMatch[2]) : 1;

    const letterMap: Record<string, string> = {
      'verse': 'V',
      'chorus': 'C',
      'prechorus': 'P',
      'bridge': 'R',    // R for bRidge (B is for blank)
      'intro': 'I',
      'outro': 'O',
      'ending': 'E',
      'tag': 'T',
      'instrumental': 'X',
    };

    return {
      letter: letterMap[type] || type[0].toUpperCase(),
      number: num
    };
  }

  // Default: use first letter
  return {
    letter: verseType[0]?.toUpperCase() || '?',
    number: 1
  };
}

// Generate slide codes for an array of slides
export function generateSlideCodes(slides: Array<{ verseType?: string; [key: string]: any }>): SlideCodeMap {
  const codes: SlideCode[] = [];
  const byCode = new Map<string, number>();

  // Track slide count per section (e.g., "V1" -> count)
  const sectionSlideCount = new Map<string, number>();

  slides.forEach((slide, index) => {
    const verseType = slide.verseType || `Slide${index + 1}`;
    const { letter, number } = parseVerseType(verseType);

    // Section key (e.g., "V1", "C1", "B1")
    const sectionKey = `${letter}${number}`;

    // Increment slide count for this section
    const currentCount = sectionSlideCount.get(sectionKey) || 0;
    const slideNumber = currentCount + 1;
    sectionSlideCount.set(sectionKey, slideNumber);

    // Generate codes
    const code = `${letter}${number}${slideNumber}`;
    const shortCode = slideNumber === 1 ? `${letter}${number}` : code;

    const slideCode: SlideCode = {
      code,
      shortCode,
      sectionLetter: letter,
      sectionNumber: number,
      slideNumber,
      slideIndex: index
    };

    codes.push(slideCode);

    // Map all possible ways to reference this slide
    byCode.set(code.toUpperCase(), index);
    if (slideNumber === 1) {
      // V1, V11, V both map to first slide of Verse 1
      byCode.set(shortCode.toUpperCase(), index);
      // For single-occurrence sections, also map just the letter
      // This will be overwritten if there are multiple occurrences
    }
  });

  // Add single-letter shortcuts for sections that appear only once
  const sectionCounts = new Map<string, number>();
  codes.forEach(sc => {
    const key = sc.sectionLetter;
    sectionCounts.set(key, (sectionCounts.get(key) || 0) + 1);
  });

  // For sections with only one occurrence number, allow just the letter
  const letterToFirstIndex = new Map<string, number>();
  codes.forEach(sc => {
    if (sc.slideNumber === 1 && !letterToFirstIndex.has(sc.sectionLetter)) {
      // Check if this is the only occurrence of this section type
      const hasSingleOccurrence = !codes.some(
        other => other.sectionLetter === sc.sectionLetter &&
                 other.sectionNumber !== sc.sectionNumber
      );
      if (hasSingleOccurrence) {
        byCode.set(sc.sectionLetter, sc.slideIndex);
        letterToFirstIndex.set(sc.sectionLetter, sc.slideIndex);
      }
    }
  });

  return { codes, byCode };
}

// Parse user input to find matching slide index
export function parseSlideCode(input: string, codeMap: SlideCodeMap): number | null {
  const normalized = input.toUpperCase().trim();

  if (!normalized) return null;

  // Try exact match first
  if (codeMap.byCode.has(normalized)) {
    return codeMap.byCode.get(normalized) ?? null;
  }

  // Try adding "1" if input is like "V1" (could mean V11)
  if (/^[A-Z]\d$/.test(normalized)) {
    const withSlide = normalized + '1';
    if (codeMap.byCode.has(withSlide)) {
      return codeMap.byCode.get(withSlide) ?? null;
    }
  }

  // Try just the letter for single sections
  if (/^[A-Z]$/.test(normalized)) {
    if (codeMap.byCode.has(normalized)) {
      return codeMap.byCode.get(normalized) ?? null;
    }
  }

  return null;
}

// Get display label for a slide (e.g., "Verse 1 - V11")
export function getSlideDisplayLabel(verseType: string, slideCode: SlideCode): string {
  return `${verseType} - ${slideCode.code}`;
}
