interface Slide {
  originalText?: string;
  transliteration?: string;
  translation?: string;
  verseType?: string;
  [key: string]: any;
}

// Combined slide types for original-only mode
export interface CombinedSlideItem {
  type: 'single' | 'combined';
  originalIndex?: number;
  originalIndices?: number[];
  slide?: Slide;
  slides?: Slide[];
  label: string;
  verseType: string;
}

export interface CombinedSlidesResult {
  combinedSlides: CombinedSlideItem[];
  originalToCombined: Map<number, number>;
  combinedToOriginal: Map<number, number[]>;
}

// Utility function to create combined slides for original-only mode
export function createCombinedSlides(slides: Slide[]): CombinedSlidesResult {
  if (!slides || slides.length === 0) {
    return {
      combinedSlides: [],
      originalToCombined: new Map(),
      combinedToOriginal: new Map()
    };
  }

  const combinedSlides: CombinedSlideItem[] = [];
  const originalToCombined = new Map<number, number>();
  const combinedToOriginal = new Map<number, number[]>();

  let i = 0;
  while (i < slides.length) {
    const currentType = slides[i].verseType || '';

    // If slide has no verseType, keep it as single (don't combine)
    if (!currentType) {
      const combinedIndex = combinedSlides.length;
      combinedSlides.push({
        type: 'single',
        originalIndex: i,
        slide: slides[i],
        label: `${i + 1}`,
        verseType: ''
      });
      originalToCombined.set(i, combinedIndex);
      combinedToOriginal.set(combinedIndex, [i]);
      i++;
      continue;
    }

    // Find all consecutive slides with the same verseType
    let groupEnd = i;
    while (groupEnd < slides.length) {
      const nextType = slides[groupEnd].verseType || '';
      if (nextType !== currentType) break;
      groupEnd++;
    }

    // Pair slides within this group (2-by-2, max 4 slides per combined group for readability)
    const MAX_COMBINED_SLIDES = 4;
    let j = i;
    while (j < groupEnd) {
      const combinedIndex = combinedSlides.length;
      const remainingInGroup = groupEnd - j;

      // Combine up to MAX_COMBINED_SLIDES at a time
      const slidesToCombine = Math.min(2, remainingInGroup, MAX_COMBINED_SLIDES);

      if (slidesToCombine >= 2) {
        // Can pair: combine slides
        const indices = Array.from({ length: slidesToCombine }, (_, k) => j + k);
        combinedSlides.push({
          type: 'combined',
          originalIndices: indices,
          slides: indices.map(idx => slides[idx]),
          label: `${j + 1}-${j + slidesToCombine}`,
          verseType: currentType
        });
        indices.forEach(idx => originalToCombined.set(idx, combinedIndex));
        combinedToOriginal.set(combinedIndex, indices);
        j += slidesToCombine;
      } else {
        // Last slide in group with odd count: stays single
        combinedSlides.push({
          type: 'single',
          originalIndex: j,
          slide: slides[j],
          label: `${j + 1}`,
          verseType: currentType
        });
        originalToCombined.set(j, combinedIndex);
        combinedToOriginal.set(combinedIndex, [j]);
        j += 1;
      }
    }

    i = groupEnd;
  }

  return {
    combinedSlides,
    originalToCombined,
    combinedToOriginal
  };
}

// Format time for video/audio playback (seconds to m:ss)
export const formatTime = (seconds: number): string => {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Format clock time
export const formatClockTime = (date: Date, format: '12h' | '24h') => {
  if (format === '12h') {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  }
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
};

// Format clock date
export const formatClockDate = (date: Date) => {
  return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
};

// Format stopwatch time (milliseconds to mm:ss.d)
export const formatStopwatchTime = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const tenths = Math.floor((ms % 1000) / 100);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${tenths}`;
};

// Get verse type color
export const getVerseTypeColor = (verseType?: string) => {
  switch (verseType?.toLowerCase()) {
    case 'chorus': return '#06b6d4';
    case 'verse1': case 'verse2': case 'verse3': case 'verse4': return '#54A0FF';
    case 'bridge': return '#1DD1A1';
    case 'prechorus': return '#FFA502';
    case 'intro': case 'outro': return '#A29BFE';
    default: return 'transparent';
  }
};
