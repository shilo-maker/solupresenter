/**
 * Utility functions for combining slides in original-only display mode
 */

/**
 * Creates combined slides by pairing consecutive slides with the same verseType.
 *
 * @param {Array} slides - Array of slide objects with verseType property
 * @returns {Object} Object containing:
 *   - combinedSlides: Array of combined/single slide objects
 *   - originalToCombined: Map of originalIndex -> combinedIndex
 *   - combinedToOriginal: Map of combinedIndex -> [originalIndex(es)]
 */
export function createCombinedSlides(slides) {
  if (!slides || slides.length === 0) {
    return {
      combinedSlides: [],
      originalToCombined: new Map(),
      combinedToOriginal: new Map()
    };
  }

  const combinedSlides = [];
  const originalToCombined = new Map();
  const combinedToOriginal = new Map();

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

    // Pair slides within this group (2-by-2)
    let j = i;
    while (j < groupEnd) {
      const combinedIndex = combinedSlides.length;

      if (j + 1 < groupEnd) {
        // Can pair: combine slides j and j+1
        combinedSlides.push({
          type: 'combined',
          originalIndices: [j, j + 1],
          slides: [slides[j], slides[j + 1]],
          label: `${j + 1}-${j + 2}`,
          verseType: currentType
        });
        originalToCombined.set(j, combinedIndex);
        originalToCombined.set(j + 1, combinedIndex);
        combinedToOriginal.set(combinedIndex, [j, j + 1]);
        j += 2;
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

/**
 * Gets the display label for a combined slide item
 * @param {Object} item - Combined slide item
 * @returns {string} Display label like "Verse 1-2" or "Chorus 3"
 */
export function getCombinedSlideLabel(item) {
  const verseType = item.verseType || '';
  const label = item.label;

  if (verseType) {
    // Capitalize first letter
    const formattedType = verseType.charAt(0).toUpperCase() + verseType.slice(1);
    return `${formattedType} ${label}`;
  }
  return label;
}
