/**
 * Song Arrangements Utilities
 *
 * This module provides types and utility functions for managing custom song arrangements.
 * Arrangements allow users to create custom orderings of song sections (e.g., V1-C-V2 vs V1-V2-C).
 */

// ============= Type Definitions =============

export interface ArrangementSection {
  id: string;              // Unique ID for this instance (for React keys and drag handling)
  verseType: string;       // "Verse1", "Chorus", "Bridge", etc.
}

export interface SongArrangement {
  id: string;              // UUID
  name: string;            // "Default", "Extended", "Live Version", etc.
  sections: ArrangementSection[];
  createdAt: string;
  updatedAt: string;
}

export interface SectionInfo {
  verseType: string;
  startIndex: number;      // First slide index with this verseType
  endIndex: number;        // Last slide index with this verseType (inclusive)
  slideCount: number;      // Number of slides in this section
}

export interface Slide {
  originalText?: string;
  transliteration?: string;
  translation?: string;
  verseType?: string;
  [key: string]: any;
}

// ============= Utility Functions =============

/**
 * Generate a unique ID for arrangement sections
 */
export function generateSectionId(): string {
  return 'sec-' + Math.random().toString(36).substring(2, 11);
}

/**
 * Generate a UUID for arrangements
 */
export function generateArrangementId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Group slides by their verseType, returning information about each section.
 * Consecutive slides with the same verseType are grouped together.
 */
export function groupSlidesBySection(slides: Slide[] | undefined): Map<string, SectionInfo> {
  const sectionMap = new Map<string, SectionInfo>();

  if (!slides || slides.length === 0) {
    return sectionMap;
  }

  let currentVerseType: string | null = null;
  let currentStartIndex = 0;

  slides.forEach((slide, index) => {
    const verseType = slide.verseType || 'Unknown';

    if (verseType !== currentVerseType) {
      // If we were tracking a section, finalize it
      if (currentVerseType !== null) {
        const existing = sectionMap.get(currentVerseType);
        if (!existing) {
          sectionMap.set(currentVerseType, {
            verseType: currentVerseType,
            startIndex: currentStartIndex,
            endIndex: index - 1,
            slideCount: index - currentStartIndex
          });
        }
      }

      // Start tracking new section (only if not already seen)
      if (!sectionMap.has(verseType)) {
        currentVerseType = verseType;
        currentStartIndex = index;
      } else {
        // If we've already seen this verse type, don't override
        currentVerseType = verseType;
        currentStartIndex = index;
      }
    }
  });

  // Finalize the last section
  if (currentVerseType !== null && !sectionMap.has(currentVerseType)) {
    sectionMap.set(currentVerseType, {
      verseType: currentVerseType,
      startIndex: currentStartIndex,
      endIndex: slides.length - 1,
      slideCount: slides.length - currentStartIndex
    });
  }

  return sectionMap;
}

/**
 * Get all unique section types from slides in order of first appearance.
 * This is useful for the section palette in the arrangement editor.
 */
export function getUniqueSections(slides: Slide[] | undefined): string[] {
  if (!slides || slides.length === 0) {
    return [];
  }

  const seen = new Set<string>();
  const sections: string[] = [];

  slides.forEach(slide => {
    const verseType = slide.verseType || '';
    if (verseType && !seen.has(verseType)) {
      seen.add(verseType);
      sections.push(verseType);
    }
  });

  return sections;
}

/**
 * Get section ranges - maps each verseType to its slide index range.
 * Returns the first occurrence of each section type.
 */
export function getSectionRanges(slides: Slide[] | undefined): Map<string, { start: number; end: number }> {
  const ranges = new Map<string, { start: number; end: number }>();

  if (!slides || slides.length === 0) {
    return ranges;
  }

  let i = 0;
  while (i < slides.length) {
    const verseType = slides[i].verseType || '';
    if (verseType && !ranges.has(verseType)) {
      // Find end of this section
      let end = i;
      while (end + 1 < slides.length && slides[end + 1].verseType === verseType) {
        end++;
      }
      ranges.set(verseType, { start: i, end });
    }
    i++;
  }

  return ranges;
}

/**
 * Create a default arrangement from the song's slide order.
 * Each unique section appears once in the order it first appears.
 */
export function createDefaultArrangement(slides: Slide[] | undefined): SongArrangement {
  const now = new Date().toISOString();
  const sections = getUniqueSections(slides);

  return {
    id: generateArrangementId(),
    name: 'Default',
    sections: sections.map(verseType => ({
      id: generateSectionId(),
      verseType
    })),
    createdAt: now,
    updatedAt: now
  };
}

/**
 * Resolve the actual slide index for a position within an arrangement.
 *
 * @param slides - The song's slides
 * @param arrangement - The arrangement being used
 * @param arrangementPosition - The position in the arrangement (which section)
 * @param slideInSection - Which slide within that section (0-based)
 * @param precomputedRanges - Optional pre-computed section ranges to avoid recalculation
 * @returns The actual slide index in the song, or -1 if invalid
 */
export function resolveSlideIndex(
  slides: Slide[] | undefined,
  arrangement: SongArrangement | null,
  arrangementPosition: number,
  slideInSection: number,
  precomputedRanges?: Map<string, { start: number; end: number }>
): number {
  if (!slides || slides.length === 0) return -1;
  if (!arrangement || arrangement.sections.length === 0) {
    // Bounds check for non-arrangement mode
    if (slideInSection < 0 || slideInSection >= slides.length) return -1;
    return slideInSection;
  }
  if (arrangementPosition < 0 || arrangementPosition >= arrangement.sections.length) return -1;

  const section = arrangement.sections[arrangementPosition];
  const ranges = precomputedRanges || getSectionRanges(slides);
  const range = ranges.get(section.verseType);

  if (!range) return -1;

  const slideIndex = range.start + slideInSection;
  if (slideIndex > range.end) return -1;

  return slideIndex;
}

/**
 * Get total number of slides when playing through an arrangement.
 * @param precomputedRanges - Optional pre-computed section ranges to avoid recalculation
 */
export function getArrangementSlideCount(
  slides: Slide[] | undefined,
  arrangement: SongArrangement | null,
  precomputedRanges?: Map<string, { start: number; end: number }>
): number {
  if (!slides || slides.length === 0) return 0;
  if (!arrangement || arrangement.sections.length === 0) return slides.length;

  const ranges = precomputedRanges || getSectionRanges(slides);
  let total = 0;

  for (const section of arrangement.sections) {
    const range = ranges.get(section.verseType);
    if (range) {
      total += range.end - range.start + 1;
    }
  }

  return total;
}

/**
 * Get the number of slides in a specific section.
 * @param precomputedRanges - Optional pre-computed section ranges to avoid recalculation
 */
export function getSectionSlideCount(
  slides: Slide[] | undefined,
  verseType: string,
  precomputedRanges?: Map<string, { start: number; end: number }>
): number {
  if (!slides || slides.length === 0) return 0;

  const ranges = precomputedRanges || getSectionRanges(slides);
  const range = ranges.get(verseType);

  if (!range) return 0;
  return range.end - range.start + 1;
}

/**
 * Validate that all sections in an arrangement exist in the song.
 */
export function validateArrangement(
  slides: Slide[] | undefined,
  arrangement: SongArrangement
): { valid: boolean; missingSections: string[] } {
  if (!slides || slides.length === 0) {
    // Deduplicate missing sections to avoid showing duplicates in UI
    const uniqueMissing = [...new Set(arrangement.sections.map(s => s.verseType))];
    return { valid: false, missingSections: uniqueMissing };
  }

  const availableSections = new Set(getUniqueSections(slides));
  const missingSet = new Set<string>();

  for (const section of arrangement.sections) {
    if (!availableSections.has(section.verseType)) {
      missingSet.add(section.verseType);
    }
  }

  return {
    valid: missingSet.size === 0,
    missingSections: [...missingSet]
  };
}

/**
 * Convert a flat slide index to arrangement position (section index + slide within section).
 * This is used when navigating through an arrangement.
 * @param precomputedRanges - Optional pre-computed section ranges to avoid recalculation
 */
export function slideIndexToArrangementPosition(
  slides: Slide[] | undefined,
  arrangement: SongArrangement | null,
  flatIndex: number,
  precomputedRanges?: Map<string, { start: number; end: number }>
): { sectionIndex: number; slideInSection: number } | null {
  if (!slides || slides.length === 0) return null;
  // Early return for negative indices
  if (flatIndex < 0) return null;
  if (!arrangement || arrangement.sections.length === 0) {
    // Bounds check for non-arrangement mode
    if (flatIndex >= slides.length) return null;
    return { sectionIndex: 0, slideInSection: flatIndex };
  }

  const ranges = precomputedRanges || getSectionRanges(slides);
  let currentIndex = 0;

  for (let sectionIndex = 0; sectionIndex < arrangement.sections.length; sectionIndex++) {
    const section = arrangement.sections[sectionIndex];
    const range = ranges.get(section.verseType);

    if (range) {
      const sectionSlideCount = range.end - range.start + 1;
      if (flatIndex < currentIndex + sectionSlideCount) {
        return {
          sectionIndex,
          slideInSection: flatIndex - currentIndex
        };
      }
      currentIndex += sectionSlideCount;
    }
  }

  return null;
}

/**
 * Convert arrangement position (section index + slide within section) to flat slide index.
 * @param precomputedRanges - Optional pre-computed section ranges to avoid recalculation
 */
export function arrangementPositionToSlideIndex(
  slides: Slide[] | undefined,
  arrangement: SongArrangement | null,
  sectionIndex: number,
  slideInSection: number,
  precomputedRanges?: Map<string, { start: number; end: number }>
): number {
  if (!slides || slides.length === 0) return 0;
  if (!arrangement || arrangement.sections.length === 0) return slideInSection;

  const ranges = precomputedRanges || getSectionRanges(slides);
  let flatIndex = 0;

  for (let i = 0; i < sectionIndex && i < arrangement.sections.length; i++) {
    const section = arrangement.sections[i];
    const range = ranges.get(section.verseType);
    if (range) {
      flatIndex += range.end - range.start + 1;
    }
  }

  return flatIndex + slideInSection;
}

/**
 * Get the actual slide data for an arrangement position.
 */
export function getSlideAtArrangementPosition(
  slides: Slide[] | undefined,
  arrangement: SongArrangement | null,
  sectionIndex: number,
  slideInSection: number
): Slide | null {
  const actualIndex = resolveSlideIndex(slides, arrangement, sectionIndex, slideInSection);
  if (actualIndex < 0 || !slides) return null;
  return slides[actualIndex] || null;
}

/**
 * Get abbreviated section name for display.
 */
export function getSectionAbbreviation(verseType: string): string {
  switch(verseType) {
    case 'Intro': return 'In';
    case 'Verse1': return 'V1';
    case 'Verse2': return 'V2';
    case 'Verse3': return 'V3';
    case 'Verse4': return 'V4';
    case 'PreChorus': return 'PC';
    case 'Chorus': return 'Ch';
    case 'Bridge': return 'Br';
    case 'Instrumental': return 'Inst';
    case 'Outro': return 'Out';
    case 'Tag': return 'Tag';
    default: return verseType?.substring(0, 2) || '?';
  }
}
