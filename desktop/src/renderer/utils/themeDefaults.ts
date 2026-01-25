/**
 * Shared theme editor defaults and utilities
 * Extracted to reduce code duplication across theme editor pages
 */

import { LinePosition, LineStyle, ViewerBackground, CanvasDimensions } from '../components/theme-editor';

// ==========================================
// Song Theme Defaults (ThemeEditorPage)
// ==========================================

export const DEFAULT_SONG_LINE_POSITIONS: Record<string, LinePosition> = {
  original: {
    x: 0, y: 27.897104546981193, width: 100, height: 11.379800853485063,
    paddingTop: 2, paddingBottom: 2,
    alignH: 'center', alignV: 'center'
  },
  transliteration: {
    x: 0, y: 38.96539940433855, width: 100, height: 12.138454243717401,
    paddingTop: 1, paddingBottom: 1,
    alignH: 'center', alignV: 'center'
  },
  translation: {
    x: 0, y: 50.838474679449185, width: 100, height: 27.311522048364157,
    paddingTop: 1, paddingBottom: 1,
    alignH: 'center', alignV: 'top'
  }
};

export const DEFAULT_SONG_LINE_STYLES: Record<string, LineStyle> = {
  original: {
    fontSize: 187, fontWeight: '700', color: '#ffffff', opacity: 1, visible: true
  },
  transliteration: {
    fontSize: 136, fontWeight: '400', color: '#e0e0e0', opacity: 0.9, visible: true
  },
  translation: {
    fontSize: 146, fontWeight: '400', color: '#b0b0b0', opacity: 0.85, visible: true
  }
};

// ==========================================
// Bible Theme Defaults (BibleThemeEditorPage)
// ==========================================

export const DEFAULT_BIBLE_LINE_POSITIONS: Record<string, LinePosition> = {
  hebrew: {
    x: 2, y: 2, width: 96, height: 45,
    paddingTop: 0, paddingBottom: 0,
    alignH: 'right', alignV: 'top'
  },
  english: {
    x: 2, y: 50, width: 96, height: 45,
    paddingTop: 0, paddingBottom: 0,
    alignH: 'left', alignV: 'top'
  }
};

export const DEFAULT_BIBLE_LINE_STYLES: Record<string, LineStyle> = {
  hebrew: {
    fontSize: 83, fontWeight: '400', color: '#ffffff', opacity: 1, visible: true
  },
  english: {
    fontSize: 78, fontWeight: '200', color: '#ffffff', opacity: 1, visible: true
  }
};

export const DEFAULT_BIBLE_REFERENCE_STYLE = {
  fontSize: 50, fontWeight: '400', color: '#a0a0a0', opacity: 1
};

export const DEFAULT_BIBLE_REFERENCE_POSITION: LinePosition = {
  x: 2, y: 44, width: 50, height: 5,
  paddingTop: 0, paddingBottom: 0,
  alignH: 'left', alignV: 'center'
};

// ==========================================
// Prayer Theme Defaults (PrayerThemeEditorPage)
// ==========================================

export const DEFAULT_PRAYER_LINE_POSITIONS: Record<string, LinePosition> = {
  title: {
    x: 0, y: 3, width: 100, height: 8,
    paddingTop: 1, paddingBottom: 1,
    alignH: 'right', alignV: 'center'
  },
  titleTranslation: {
    x: 0, y: 40.97, width: 100, height: 8.85,
    paddingTop: 0, paddingBottom: 1,
    alignH: 'left', alignV: 'center'
  },
  subtitle: {
    x: 0, y: 11.15, width: 100, height: 10.87,
    paddingTop: 2, paddingBottom: 2,
    alignH: 'right', alignV: 'top'
  },
  subtitleTranslation: {
    x: 0, y: 50.90, width: 100, height: 9.61,
    paddingTop: 1, paddingBottom: 1,
    alignH: 'left', alignV: 'top'
  },
  description: {
    x: 0, y: 21.65, width: 100, height: 10.12,
    paddingTop: 1, paddingBottom: 1,
    alignH: 'right', alignV: 'top'
  },
  descriptionTranslation: {
    x: 0, y: 60.18, width: 100, height: 10,
    paddingTop: 1, paddingBottom: 1,
    alignH: 'left', alignV: 'center'
  }
};

export const DEFAULT_PRAYER_LINE_STYLES: Record<string, LineStyle> = {
  title: {
    fontSize: 130, fontWeight: '700', color: '#06b6d4', opacity: 1, visible: true
  },
  titleTranslation: {
    fontSize: 129, fontWeight: '700', color: '#06b6d4', opacity: 0.9, visible: true
  },
  subtitle: {
    fontSize: 94, fontWeight: '700', color: '#ffffff', opacity: 1, visible: true
  },
  subtitleTranslation: {
    fontSize: 94, fontWeight: '700', color: '#e0e0e0', opacity: 0.9, visible: true
  },
  description: {
    fontSize: 90, fontWeight: '400', color: '#e0e0e0', opacity: 0.9, visible: true
  },
  descriptionTranslation: {
    fontSize: 90, fontWeight: '400', color: '#b0b0b0', opacity: 0.85, visible: true
  }
};

export const DEFAULT_PRAYER_REFERENCE_STYLE = {
  fontSize: 56, fontWeight: '500', color: '#ffffff', opacity: 0.8, visible: true
};

export const DEFAULT_PRAYER_REFERENCE_POSITION: LinePosition = {
  x: 0, y: 31.78, width: 100, height: 5.11,
  paddingTop: 0, paddingBottom: 0,
  alignH: 'right', alignV: 'center'
};

export const DEFAULT_PRAYER_REF_TRANSLATION_STYLE = {
  fontSize: 60, fontWeight: '400', color: '#ffffff', opacity: 0.7, visible: true
};

export const DEFAULT_PRAYER_REF_TRANSLATION_POSITION: LinePosition = {
  x: 0, y: 70.32, width: 100, height: 8,
  paddingTop: 0, paddingBottom: 0,
  alignH: 'left', alignV: 'center'
};

// ==========================================
// OBS Theme Defaults
// ==========================================

export const DEFAULT_OBS_SONG_LINE_POSITIONS: Record<string, LinePosition> = {
  original: {
    x: 0, y: 70, width: 100, height: 10,
    paddingTop: 1, paddingBottom: 1,
    alignH: 'center', alignV: 'center'
  },
  transliteration: {
    x: 0, y: 80, width: 100, height: 8,
    paddingTop: 1, paddingBottom: 1,
    alignH: 'center', alignV: 'center'
  },
  translation: {
    x: 0, y: 88, width: 100, height: 10,
    paddingTop: 1, paddingBottom: 1,
    alignH: 'center', alignV: 'center'
  }
};

export const DEFAULT_OBS_SONG_LINE_STYLES: Record<string, LineStyle> = {
  original: {
    fontSize: 120, fontWeight: '700', color: '#ffffff', opacity: 1, visible: true
  },
  transliteration: {
    fontSize: 90, fontWeight: '400', color: '#e0e0e0', opacity: 0.9, visible: true
  },
  translation: {
    fontSize: 100, fontWeight: '400', color: '#b0b0b0', opacity: 0.85, visible: true
  }
};

export const DEFAULT_OBS_BIBLE_LINE_POSITIONS: Record<string, LinePosition> = {
  hebrew: {
    x: 0, y: 72, width: 100, height: 10,
    paddingTop: 1, paddingBottom: 1,
    alignH: 'center', alignV: 'center'
  },
  english: {
    x: 0, y: 82, width: 100, height: 10,
    paddingTop: 1, paddingBottom: 1,
    alignH: 'center', alignV: 'center'
  }
};

export const DEFAULT_OBS_BIBLE_LINE_STYLES: Record<string, LineStyle> = {
  hebrew: {
    fontSize: 100, fontWeight: '700', color: '#ffffff', opacity: 1, visible: true
  },
  english: {
    fontSize: 80, fontWeight: '400', color: '#e0e0e0', opacity: 0.9, visible: true
  }
};

export const DEFAULT_OBS_REFERENCE_STYLE = {
  fontSize: 60, fontWeight: '500', color: '#06b6d4', opacity: 0.9
};

export const DEFAULT_OBS_REFERENCE_POSITION: LinePosition = {
  x: 0, y: 92, width: 100, height: 6,
  paddingTop: 0, paddingBottom: 0,
  alignH: 'center', alignV: 'center'
};

// ==========================================
// Common Defaults
// ==========================================

export const DEFAULT_CANVAS_DIMENSIONS: CanvasDimensions = {
  width: 1920,
  height: 1080
};

export const DEFAULT_VIEWER_BACKGROUND: ViewerBackground = {
  type: 'color',
  color: '#000000'
};

export const DEFAULT_TRANSPARENT_BACKGROUND: ViewerBackground = {
  type: 'transparent',
  color: null
};

// ==========================================
// Utility Functions
// ==========================================

/**
 * Deep clone a theme object to avoid mutation
 */
export function cloneTheme<T>(theme: T): T {
  return JSON.parse(JSON.stringify(theme));
}

/**
 * Merge partial line positions with defaults
 */
export function mergeLinePositions(
  partial: Partial<Record<string, LinePosition>> | undefined,
  defaults: Record<string, LinePosition>
): Record<string, LinePosition> {
  if (!partial) return { ...defaults };

  const result: Record<string, LinePosition> = {};
  for (const key of Object.keys(defaults)) {
    result[key] = { ...defaults[key], ...(partial[key] || {}) };
  }
  return result;
}

/**
 * Merge partial line styles with defaults
 */
export function mergeLineStyles(
  partial: Partial<Record<string, LineStyle>> | undefined,
  defaults: Record<string, LineStyle>
): Record<string, LineStyle> {
  if (!partial) return { ...defaults };

  const result: Record<string, LineStyle> = {};
  for (const key of Object.keys(defaults)) {
    result[key] = { ...defaults[key], ...(partial[key] || {}) };
  }
  return result;
}
