import React, { useRef, useEffect, useState } from 'react';

/**
 * SlideRenderer - Unified rendering component for slides
 *
 * This component renders slide content at a fixed reference resolution
 * and scales to fit any container using CSS transform. This ensures
 * pixel-perfect consistency across:
 * - Theme Editor canvas
 * - Live Preview
 * - Connected Display (viewer window)
 *
 * Key principle: Render at reference resolution, scale to fit.
 */

interface SlideData {
  originalText?: string;
  transliteration?: string;
  translation?: string;
  translationOverflow?: string;
  reference?: string;  // Bible verse reference (e.g., "Genesis 1:1") or Hebrew reference for prayer
  referenceTranslation?: string; // English reference for prayer
  // Prayer/Sermon content fields
  title?: string;
  titleTranslation?: string;   // English title translation
  subtitle?: string;           // Hebrew subtitle text
  subtitleTranslation?: string; // English subtitle translation
  description?: string;         // Hebrew description text
  descriptionTranslation?: string; // English description translation
}

interface PresentationTextBox {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  color: string;
  backgroundColor: string;
  textAlign: 'left' | 'center' | 'right';
  verticalAlign: 'top' | 'center' | 'bottom';
  bold: boolean;
  italic: boolean;
  underline: boolean;
  opacity: number;
  zIndex?: number;
  textDirection?: 'ltr' | 'rtl';
}

interface PresentationImageBox {
  id: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  objectFit: 'contain' | 'cover' | 'fill';
  borderRadius: number;
  zIndex?: number;
}

interface PresentationSlide {
  id: string;
  order: number;
  textBoxes: PresentationTextBox[];
  imageBoxes?: PresentationImageBox[];
  backgroundColor?: string;
}

interface LinePosition {
  x: number;      // percentage
  y: number;      // percentage
  width: number;  // percentage
  height: number; // percentage
  paddingTop: number;
  paddingBottom: number;
  alignH: 'left' | 'center' | 'right';
  alignV: 'top' | 'center' | 'bottom';
}

interface LineStyle {
  fontSize: number;   // 100 = base size
  fontWeight: string;
  color: string;
  opacity: number;
  visible: boolean;
}

interface BackgroundBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  opacity: number;
  borderRadius: number;
}

interface CanvasDimensions {
  width: number;
  height: number;
}

interface Theme {
  lineOrder?: string[];
  lineStyles?: Record<string, LineStyle>;
  linePositions?: Record<string, LinePosition> | null;
  backgroundBoxes?: BackgroundBox[] | null;
  canvasDimensions?: CanvasDimensions;
  viewerBackground?: { type?: string; color?: string };
  // Bible/Prayer theme reference lines
  referenceStyle?: LineStyle;
  referencePosition?: LinePosition;
  referenceTranslationStyle?: LineStyle;
  referenceTranslationPosition?: LinePosition;
}

interface SlideRendererProps {
  slideData: SlideData | null;
  displayMode: string;
  theme: Theme | null;
  backgroundImage?: string;
  isBlank?: boolean;

  // Container behavior
  containerWidth?: number;   // If provided, scale to fit this width
  containerHeight?: number;  // If provided, scale to fit this height
  fillContainer?: boolean;   // If true, fill the entire container (for viewer windows)

  // Editor mode (show placeholder text even without slideData)
  editorMode?: boolean;

  // Optional: custom sample text for editor
  sampleText?: Record<string, string>;

  // Presentation mode (renders textboxes with embedded styling instead of theme)
  presentationSlide?: PresentationSlide | null;
}

const DEFAULT_SAMPLE_TEXT: Record<string, string> = {
  original: 'שִׁירוּ לַיהוָה שִׁיר חָדָשׁ',
  transliteration: 'Shiru lAdonai shir chadash',
  translation: 'Sing to the Lord a new song',
  // Prayer/Sermon sample text
  title: 'נושאי תפילה',
  titleTranslation: 'Prayer Points',
  subtitle: 'ריפוי לחולים',
  subtitleTranslation: 'Healing for the Sick',
  description: 'התפללו בעד משפחת כהן',
  descriptionTranslation: 'Pray for the Cohen family',
  reference: 'יעקב ה׳:16',
  referenceTranslation: 'James 5:16'
};

// Default text shadow for better readability against any background
const DEFAULT_TEXT_SHADOW = '2px 2px 4px rgba(0, 0, 0, 0.8), 0 0 8px rgba(0, 0, 0, 0.5)';

// Default line positions - matches Classic theme (NewDefault values)
const DEFAULT_LINE_POSITIONS: Record<string, LinePosition> = {
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
  },
  translationOverflow: {
    x: 0, y: 64, width: 100, height: 13.5,
    paddingTop: 1, paddingBottom: 1,
    alignH: 'center', alignV: 'top'
  },
  // Prayer/Sermon default positions - Hebrew right, English left (NewClassicPrayer layout)
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
  },
  reference: {
    x: 0, y: 31.78, width: 100, height: 5.11,
    paddingTop: 0, paddingBottom: 0,
    alignH: 'right', alignV: 'center'
  },
  referenceTranslation: {
    x: 0, y: 70.32, width: 100, height: 8,
    paddingTop: 0, paddingBottom: 0,
    alignH: 'left', alignV: 'center'
  }
};

// Default line styles - matches Classic theme (NewDefault values)
const DEFAULT_LINE_STYLES: Record<string, LineStyle> = {
  original: {
    fontSize: 187, fontWeight: '700', color: '#ffffff', opacity: 1, visible: true
  },
  transliteration: {
    fontSize: 136, fontWeight: '400', color: '#e0e0e0', opacity: 0.9, visible: true
  },
  translation: {
    fontSize: 146, fontWeight: '400', color: '#b0b0b0', opacity: 0.85, visible: true
  },
  translationOverflow: {
    fontSize: 146, fontWeight: '400', color: '#b0b0b0', opacity: 0.85, visible: true
  },
  // Prayer/Sermon default styles (NewClassicPrayer layout)
  title: {
    fontSize: 130, fontWeight: '700', color: '#FF8C42', opacity: 1, visible: true
  },
  titleTranslation: {
    fontSize: 129, fontWeight: '700', color: '#FF8C42', opacity: 0.9, visible: true
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
  },
  reference: {
    fontSize: 56, fontWeight: '500', color: '#ffffff', opacity: 0.8, visible: true
  },
  referenceTranslation: {
    fontSize: 60, fontWeight: '400', color: '#ffffff', opacity: 0.7, visible: true
  }
};

const SlideRenderer: React.FC<SlideRendererProps> = ({
  slideData,
  displayMode,
  theme,
  backgroundImage,
  isBlank = false,
  containerWidth,
  containerHeight,
  fillContainer = false,
  editorMode = false,
  sampleText = DEFAULT_SAMPLE_TEXT,
  presentationSlide
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  // Reference dimensions from theme or default to 1920x1080
  const refWidth = theme?.canvasDimensions?.width || 1920;
  const refHeight = theme?.canvasDimensions?.height || 1080;
  const aspectRatio = refHeight / refWidth;

  // Calculate scale factor to fit container
  useEffect(() => {
    const calculateScale = () => {
      if (fillContainer) {
        // For viewer windows, fill the entire viewport
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const scaleX = viewportWidth / refWidth;
        const scaleY = viewportHeight / refHeight;
        setScale(Math.min(scaleX, scaleY));
      } else if (containerWidth && containerHeight) {
        // Fit within provided dimensions
        const scaleX = containerWidth / refWidth;
        const scaleY = containerHeight / refHeight;
        setScale(Math.min(scaleX, scaleY));
      } else if (containerRef.current) {
        // Auto-detect container size
        const rect = containerRef.current.parentElement?.getBoundingClientRect();
        if (rect) {
          const scaleX = rect.width / refWidth;
          const scaleY = rect.height / refHeight;
          setScale(Math.min(scaleX, scaleY));
        }
      }
    };

    calculateScale();
    window.addEventListener('resize', calculateScale);
    return () => window.removeEventListener('resize', calculateScale);
  }, [refWidth, refHeight, containerWidth, containerHeight, fillContainer]);

  // Get line order from theme (add translationOverflow after translation if not in theme)
  const baseLineOrder = theme?.lineOrder || ['original', 'transliteration', 'translation'];
  const lineOrder = baseLineOrder.includes('translationOverflow')
    ? baseLineOrder
    : [...baseLineOrder, 'translationOverflow'];

  // Always use absolute positioning with defaults if theme doesn't have positions
  // This ensures Theme Editor, Preview, and Display all match
  // Merge with defaults to ensure translationOverflow is always available
  const effectiveLinePositions = {
    ...DEFAULT_LINE_POSITIONS,
    ...(theme?.linePositions || {})
  };
  const effectiveLineStyles = {
    ...DEFAULT_LINE_STYLES,
    ...(theme?.lineStyles || {})
  };

  // Calculate base font size in pixels at reference resolution
  // Base: 5% of reference height at fontSize=100
  const getBaseFontSize = () => {
    return refHeight * 0.05; // 54px at 1080p
  };

  // Get font size for a line type in pixels
  const getFontSize = (lineType: string): number => {
    const style = effectiveLineStyles[lineType] || DEFAULT_LINE_STYLES[lineType];
    const baseFontSize = getBaseFontSize();
    const fontSizeMultiplier = (style?.fontSize || 100) / 100;
    return baseFontSize * fontSizeMultiplier;
  };

  // Get text content for a line
  const getLineContent = (lineType: string): string | null => {
    if (editorMode && !slideData) {
      return sampleText[lineType] || '';
    }

    if (!slideData) return null;

    switch (lineType) {
      case 'original':
      case 'hebrew':  // Bible theme compatibility
        return slideData.originalText || null;
      case 'transliteration':
        return slideData.transliteration || null;
      case 'translation':
      case 'english':  // Bible theme compatibility
        // Combine translation with overflow if present
        if (slideData.translationOverflow) {
          return `${slideData.translation || ''}\n${slideData.translationOverflow}`;
        }
        return slideData.translation || null;
      case 'translationOverflow':
        // Don't render separately - it's combined with translation above
        return null;
      // Prayer/Sermon theme line types
      case 'title':
        return slideData.title || null;
      case 'titleTranslation':
        return slideData.titleTranslation || null;
      case 'subtitle':
        return slideData.subtitle || null;
      case 'subtitleTranslation':
        return slideData.subtitleTranslation || null;
      case 'description':
        return slideData.description || null;
      case 'descriptionTranslation':
        return slideData.descriptionTranslation || null;
      case 'reference':
        return slideData.reference || null;
      case 'referenceTranslation':
        return slideData.referenceTranslation || null;
      default:
        return null;
    }
  };

  // Check if line should be visible based on display mode
  const shouldShowLine = (lineType: string): boolean => {
    switch (lineType) {
      case 'original':
      case 'hebrew':  // Bible theme compatibility
        return displayMode === 'bilingual' || displayMode === 'original';
      case 'transliteration':
        return displayMode === 'bilingual';
      case 'translation':
      case 'translationOverflow':
      case 'english':  // Bible theme compatibility
        return displayMode === 'bilingual' || displayMode === 'translation';
      // Prayer/Sermon theme line types
      case 'title':
        // Title always visible
        return true;
      case 'titleTranslation':
        // Title translation visible in bilingual mode
        return displayMode === 'bilingual';
      case 'subtitle':
      case 'description':
        // Hebrew content visible in original and bilingual modes
        return displayMode === 'bilingual' || displayMode === 'original';
      case 'subtitleTranslation':
      case 'descriptionTranslation':
        // Translation content visible only in bilingual mode
        return displayMode === 'bilingual';
      case 'reference':
        // Reference (Hebrew) is always visible (controlled by its own style.visible)
        return true;
      case 'referenceTranslation':
        // Reference translation visible only in bilingual mode (controlled by its own style.visible)
        return displayMode === 'bilingual';
      default:
        return false;
    }
  };

  // Render background boxes
  const renderBackgroundBoxes = () => {
    if (!theme?.backgroundBoxes || theme.backgroundBoxes.length === 0) return null;

    return theme.backgroundBoxes.map((box) => (
      <div
        key={box.id}
        style={{
          position: 'absolute',
          left: `${box.x}%`,
          top: `${box.y}%`,
          width: `${box.width}%`,
          height: `${box.height}%`,
          backgroundColor: box.color,
          opacity: box.opacity,
          borderRadius: box.borderRadius,
          zIndex: 1
        }}
      />
    ));
  };

  // Render lines with absolute positioning (always used - with defaults if no theme positions)
  const renderAbsoluteLines = () => {
    return lineOrder.map((lineType) => {
      // Skip 'reference' if it will be handled by renderReferenceLine (Bible/Prayer themes)
      if (lineType === 'reference' && theme?.referencePosition) return null;
      // Skip 'referenceTranslation' if it will be handled by renderReferenceTranslationLine
      if (lineType === 'referenceTranslation' && theme?.referenceTranslationPosition) return null;

      const position = effectiveLinePositions[lineType];
      const style = effectiveLineStyles[lineType];

      if (!position) return null;
      if (style?.visible === false) return null;
      if (!shouldShowLine(lineType)) return null;

      const content = getLineContent(lineType);
      if (!content && !editorMode) return null;

      const fontSize = getFontSize(lineType);
      // RTL for Hebrew content (songs: original/hebrew, prayer: title/subtitle/description)
      const isRtl = lineType === 'original' || lineType === 'hebrew' ||
                    lineType === 'title' || lineType === 'subtitle' || lineType === 'description';

      // Map alignment to CSS
      const justifyContent = position.alignH === 'left' ? 'flex-start' :
                            position.alignH === 'right' ? 'flex-end' : 'center';
      const alignItems = position.alignV === 'top' ? 'flex-start' :
                        position.alignV === 'bottom' ? 'flex-end' : 'center';

      return (
        <div
          key={lineType}
          style={{
            position: 'absolute',
            left: `${position.x}%`,
            top: `${position.y}%`,
            width: `${position.width}%`,
            height: `${position.height}%`,
            display: 'flex',
            justifyContent,
            alignItems,
            paddingTop: `${position.paddingTop}%`,
            paddingBottom: `${position.paddingBottom}%`,
            boxSizing: 'border-box',
            zIndex: 2
          }}
        >
          <div
            style={{
              width: '100%',
              fontSize: `${fontSize}px`,
              fontWeight: style?.fontWeight || '500',
              color: style?.color || '#FFFFFF',
              opacity: style?.opacity ?? 1,
              direction: isRtl ? 'rtl' : 'ltr',
              textAlign: position.alignH,
              lineHeight: lineType === 'translation' ? 1.15 : 1.4,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              textShadow: DEFAULT_TEXT_SHADOW
            }}
          >
            {content}
          </div>
        </div>
      );
    });
  };

  // Render lines with flow layout (legacy mode)
  const renderFlowLines = () => {
    return lineOrder.map((lineType) => {
      const style = theme?.lineStyles?.[lineType];

      if (style?.visible === false) return null;
      if (!shouldShowLine(lineType)) return null;

      const content = getLineContent(lineType);
      if (!content && !editorMode) return null;

      const fontSize = getFontSize(lineType);
      // RTL for Hebrew content (songs: original/hebrew, prayer: title/subtitle/description)
      const isRtl = lineType === 'original' || lineType === 'hebrew' ||
                    lineType === 'title' || lineType === 'subtitle' || lineType === 'description';

      return (
        <div
          key={lineType}
          style={{
            fontSize: `${fontSize}px`,
            fontWeight: style?.fontWeight || '500',
            color: style?.color || '#FFFFFF',
            opacity: style?.opacity ?? 1,
            direction: isRtl ? 'rtl' : 'ltr',
            marginBottom: refHeight * 0.02, // 2% of height
            lineHeight: 1.4,
            textShadow: DEFAULT_TEXT_SHADOW
          }}
        >
          {content}
        </div>
      );
    });
  };

  // Bible book name mappings (English to Hebrew)
  const bibleBookNames: Record<string, string> = {
    'genesis': 'בראשית', 'exodus': 'שמות', 'leviticus': 'ויקרא', 'numbers': 'במדבר', 'deuteronomy': 'דברים',
    'joshua': 'יהושע', 'judges': 'שופטים', 'ruth': 'רות', '1 samuel': 'שמואל א', '2 samuel': 'שמואל ב',
    '1 kings': 'מלכים א', '2 kings': 'מלכים ב', '1 chronicles': 'דברי הימים א', '2 chronicles': 'דברי הימים ב',
    'ezra': 'עזרא', 'nehemiah': 'נחמיה', 'esther': 'אסתר', 'job': 'איוב', 'psalms': 'תהלים', 'psalm': 'תהלים',
    'proverbs': 'משלי', 'ecclesiastes': 'קהלת', 'song of solomon': 'שיר השירים', 'song of songs': 'שיר השירים',
    'isaiah': 'ישעיהו', 'jeremiah': 'ירמיהו', 'lamentations': 'איכה', 'ezekiel': 'יחזקאל', 'daniel': 'דניאל',
    'hosea': 'הושע', 'joel': 'יואל', 'amos': 'עמוס', 'obadiah': 'עובדיה', 'jonah': 'יונה', 'micah': 'מיכה',
    'nahum': 'נחום', 'habakkuk': 'חבקוק', 'zephaniah': 'צפניה', 'haggai': 'חגי', 'zechariah': 'זכריה', 'malachi': 'מלאכי',
    // Hebrew to Hebrew (for already Hebrew references)
    'בראשית': 'בראשית', 'שמות': 'שמות', 'ויקרא': 'ויקרא', 'במדבר': 'במדבר', 'דברים': 'דברים',
    'יהושע': 'יהושע', 'שופטים': 'שופטים', 'רות': 'רות', 'שמואל א': 'שמואל א', 'שמואל ב': 'שמואל ב',
    'מלכים א': 'מלכים א', 'מלכים ב': 'מלכים ב', 'תהלים': 'תהלים', 'משלי': 'משלי', 'איוב': 'איוב',
    'ישעיהו': 'ישעיהו', 'ירמיהו': 'ירמיהו', 'יחזקאל': 'יחזקאל', 'דניאל': 'דניאל'
  };

  // Hebrew to English book names (for bilingual display)
  const hebrewToEnglish: Record<string, string> = {
    'בראשית': 'Genesis', 'שמות': 'Exodus', 'ויקרא': 'Leviticus', 'במדבר': 'Numbers', 'דברים': 'Deuteronomy',
    'יהושע': 'Joshua', 'שופטים': 'Judges', 'רות': 'Ruth', 'שמואל א': '1 Samuel', 'שמואל ב': '2 Samuel',
    'מלכים א': '1 Kings', 'מלכים ב': '2 Kings', 'דברי הימים א': '1 Chronicles', 'דברי הימים ב': '2 Chronicles',
    'עזרא': 'Ezra', 'נחמיה': 'Nehemiah', 'אסתר': 'Esther', 'איוב': 'Job', 'תהלים': 'Psalms',
    'משלי': 'Proverbs', 'קהלת': 'Ecclesiastes', 'שיר השירים': 'Song of Solomon',
    'ישעיהו': 'Isaiah', 'ירמיהו': 'Jeremiah', 'איכה': 'Lamentations', 'יחזקאל': 'Ezekiel', 'דניאל': 'Daniel',
    'הושע': 'Hosea', 'יואל': 'Joel', 'עמוס': 'Amos', 'עובדיה': 'Obadiah', 'יונה': 'Jonah', 'מיכה': 'Micah',
    'נחום': 'Nahum', 'חבקוק': 'Habakkuk', 'צפניה': 'Zephaniah', 'חגי': 'Haggai', 'זכריה': 'Zechariah', 'מלאכי': 'Malachi'
  };

  // Convert number to Hebrew numerals (gematria)
  const toHebrewNumerals = (num: number): string => {
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

  // Format Bible reference based on display mode
  const formatBibleReference = (reference: string): string => {
    if (!reference) return '';

    // Parse the reference: "Exodus 23" or "Exodus 23:1-5" or "שמות 23"
    const match = reference.match(/^(.+?)\s+(\d+)(?::(.+))?$/);
    if (!match) return reference;

    const [, bookName, chapter, verses] = match;
    const chapterNum = parseInt(chapter);

    // Get Hebrew book name
    const hebrewBook = bibleBookNames[bookName.toLowerCase()] || bookName;
    const hebrewChapter = toHebrewNumerals(chapterNum);

    // Format verses in Hebrew if present
    let hebrewVerses = '';
    if (verses) {
      // Handle verse ranges like "1-5" or single verses like "3"
      const verseParts = verses.split('-').map(v => {
        const verseNum = parseInt(v.trim());
        return isNaN(verseNum) ? v : toHebrewNumerals(verseNum);
      });
      hebrewVerses = ':' + verseParts.join('-');
    }

    const hebrewRef = `${hebrewBook} ${hebrewChapter}${hebrewVerses}`;

    // For original mode, return only Hebrew
    if (displayMode === 'original') {
      return hebrewRef;
    }

    // For bilingual/translation mode, return both Hebrew and English
    const englishBook = hebrewToEnglish[hebrewBook] || bookName;
    const englishRef = `${englishBook} ${chapter}${verses ? ':' + verses : ''}`;

    return `${hebrewRef} | ${englishRef}`;
  };

  // Render Bible/Prayer reference line (Hebrew reference for prayer, formatted reference for Bible)
  const renderReferenceLine = () => {
    if (!slideData?.reference) return null;
    if (!theme?.referencePosition) return null;

    const position = theme.referencePosition;
    const style = theme.referenceStyle || {
      fontSize: 80,
      fontWeight: '500',
      color: '#FF8C42',
      opacity: 0.9,
      visible: true
    };

    if (style.visible === false) return null;

    const baseFontSize = refHeight * 0.05;
    const fontSize = baseFontSize * ((style.fontSize || 80) / 100);

    const justifyContent = position.alignH === 'left' ? 'flex-start' :
                          position.alignH === 'right' ? 'flex-end' : 'center';
    const alignItems = position.alignV === 'top' ? 'flex-start' :
                      position.alignV === 'bottom' ? 'flex-end' : 'center';

    // For prayer themes (when referenceTranslation exists or referenceTranslationPosition is set),
    // display reference as-is (it's already the Hebrew reference)
    // For Bible themes, format the reference to show both Hebrew and English
    const isPrayerTheme = slideData.referenceTranslation || theme.referenceTranslationPosition;
    const formattedReference = isPrayerTheme ? slideData.reference : formatBibleReference(slideData.reference);

    return (
      <div
        key="reference"
        style={{
          position: 'absolute',
          left: `${position.x}%`,
          top: `${position.y}%`,
          width: `${position.width}%`,
          height: `${position.height}%`,
          display: 'flex',
          justifyContent,
          alignItems,
          paddingTop: `${(position.paddingTop || 0) * refHeight / 100}px`,
          paddingBottom: `${(position.paddingBottom || 0) * refHeight / 100}px`,
          boxSizing: 'border-box',
          zIndex: 10
        }}
      >
        <div
          style={{
            width: '100%',
            fontSize: `${fontSize}px`,
            fontWeight: style.fontWeight || '500',
            color: style.color || '#FF8C42',
            opacity: style.opacity ?? 0.9,
            textAlign: position.alignH || 'center',
            lineHeight: 1.3,
            textShadow: DEFAULT_TEXT_SHADOW
          }}
        >
          {formattedReference}
        </div>
      </div>
    );
  };

  // Render reference translation line (for Prayer themes - English reference)
  const renderReferenceTranslationLine = () => {
    console.log('[SlideRenderer] renderReferenceTranslationLine - referenceTranslation:', slideData?.referenceTranslation);
    console.log('[SlideRenderer] renderReferenceTranslationLine - reference:', slideData?.reference);
    console.log('[SlideRenderer] renderReferenceTranslationLine - displayMode:', displayMode);
    console.log('[SlideRenderer] renderReferenceTranslationLine - theme.referenceTranslationPosition:', theme?.referenceTranslationPosition);

    if (!slideData?.referenceTranslation) {
      console.log('[SlideRenderer] renderReferenceTranslationLine - SKIPPED: no referenceTranslation');
      return null;
    }
    if (displayMode !== 'bilingual') {
      console.log('[SlideRenderer] renderReferenceTranslationLine - SKIPPED: not bilingual mode');
      return null; // Only show in bilingual mode
    }

    // Use theme position if available, otherwise use defaults
    const position = theme?.referenceTranslationPosition || DEFAULT_LINE_POSITIONS.referenceTranslation;
    const style = theme?.referenceTranslationStyle || DEFAULT_LINE_STYLES.referenceTranslation;
    console.log('[SlideRenderer] renderReferenceTranslationLine - RENDERING with position:', position, 'style:', style);

    if (style.visible === false) return null;

    const baseFontSize = refHeight * 0.05;
    const fontSize = baseFontSize * ((style.fontSize || 60) / 100);

    const justifyContent = position.alignH === 'left' ? 'flex-start' :
                          position.alignH === 'right' ? 'flex-end' : 'center';
    const alignItems = position.alignV === 'top' ? 'flex-start' :
                      position.alignV === 'bottom' ? 'flex-end' : 'center';

    return (
      <div
        key="referenceTranslation"
        style={{
          position: 'absolute',
          left: `${position.x}%`,
          top: `${position.y}%`,
          width: `${position.width}%`,
          height: `${position.height}%`,
          display: 'flex',
          justifyContent,
          alignItems,
          paddingTop: `${(position.paddingTop || 0) * refHeight / 100}px`,
          paddingBottom: `${(position.paddingBottom || 0) * refHeight / 100}px`,
          boxSizing: 'border-box',
          zIndex: 10
        }}
      >
        <div
          style={{
            width: '100%',
            fontSize: `${fontSize}px`,
            fontWeight: style.fontWeight || '400',
            color: style.color || '#00d4ff',
            opacity: style.opacity ?? 0.7,
            textAlign: position.alignH || 'center',
            lineHeight: 1.3,
            textShadow: DEFAULT_TEXT_SHADOW
          }}
        >
          {slideData.referenceTranslation}
        </div>
      </div>
    );
  };

  // Render presentation image boxes
  const renderPresentationImageBoxes = () => {
    if (!presentationSlide?.imageBoxes) return null;

    return presentationSlide.imageBoxes.map((imageBox) => (
      <div
        key={imageBox.id}
        style={{
          position: 'absolute',
          left: `${imageBox.x}%`,
          top: `${imageBox.y}%`,
          width: `${imageBox.width}%`,
          height: `${imageBox.height}%`,
          zIndex: imageBox.zIndex ?? 0
        }}
      >
        <img
          src={imageBox.src}
          alt=""
          style={{
            width: '100%',
            height: '100%',
            objectFit: imageBox.objectFit,
            opacity: imageBox.opacity,
            borderRadius: `${imageBox.borderRadius}px`
          }}
        />
      </div>
    ));
  };

  // Render presentation textboxes with embedded styling
  const renderPresentationTextBoxes = () => {
    if (!presentationSlide?.textBoxes) return null;

    return presentationSlide.textBoxes.map((textBox) => {
      // Calculate font size in pixels based on percentage (100 = 5% of height = 54px at 1080p)
      const baseFontSize = refHeight * 0.05;
      const fontSize = baseFontSize * (textBox.fontSize / 100);

      // Map alignment to CSS flexbox
      const justifyContent = textBox.textAlign === 'left' ? 'flex-start' :
                            textBox.textAlign === 'right' ? 'flex-end' : 'center';
      const alignItems = textBox.verticalAlign === 'top' ? 'flex-start' :
                        textBox.verticalAlign === 'bottom' ? 'flex-end' : 'center';

      return (
        <div
          key={textBox.id}
          style={{
            position: 'absolute',
            left: `${textBox.x}%`,
            top: `${textBox.y}%`,
            width: `${textBox.width}%`,
            height: `${textBox.height}%`,
            display: 'flex',
            justifyContent,
            alignItems,
            backgroundColor: textBox.backgroundColor || 'transparent',
            opacity: textBox.opacity ?? 1,
            boxSizing: 'border-box',
            padding: '8px',
            zIndex: textBox.zIndex ?? 0
          }}
        >
          <div
            dir={textBox.textDirection || 'ltr'}
            style={{
              fontSize: `${fontSize}px`,
              fontWeight: textBox.bold ? '700' : '400',
              fontStyle: textBox.italic ? 'italic' : 'normal',
              textDecoration: textBox.underline ? 'underline' : 'none',
              color: textBox.color || '#FFFFFF',
              textAlign: textBox.textAlign,
              direction: textBox.textDirection || 'ltr',
              lineHeight: 1.4,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              width: '100%',
              textShadow: DEFAULT_TEXT_SHADOW
            }}
          >
            {textBox.text}
          </div>
        </div>
      );
    });
  };

  // Get presentation slide background (if any)
  const getPresentationBackgroundStyle = (): React.CSSProperties => {
    const style: React.CSSProperties = {
      backgroundColor: presentationSlide?.backgroundColor || '#000000'
    };
    return style;
  };

  // Build background style
  const getBackgroundStyle = (): React.CSSProperties => {
    const style: React.CSSProperties = {
      backgroundColor: '#000000'
    };

    if (backgroundImage) {
      if (backgroundImage.startsWith('linear-gradient') || backgroundImage.startsWith('radial-gradient')) {
        style.background = backgroundImage;
      } else if (backgroundImage.startsWith('#') || backgroundImage.startsWith('rgb')) {
        style.backgroundColor = backgroundImage;
      } else {
        style.backgroundImage = `url(${backgroundImage})`;
        style.backgroundSize = 'cover';
        style.backgroundPosition = 'center';
      }
    } else if (theme?.viewerBackground?.type === 'color' && theme.viewerBackground.color) {
      const color = theme.viewerBackground.color;
      if (color.startsWith('linear-gradient') || color.startsWith('radial-gradient')) {
        style.background = color;
      } else {
        style.backgroundColor = color;
      }
    }

    return style;
  };

  // Get positioning style for flow layout
  const getFlowPositioningStyle = (): React.CSSProperties => {
    return {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      textAlign: 'center',
      width: '100%',
      height: '100%',
      padding: `${refHeight * 0.05}px ${refWidth * 0.1}px`,
      boxSizing: 'border-box'
    };
  };

  // Calculate the scaled dimensions for the outer wrapper
  const scaledWidth = refWidth * scale;
  const scaledHeight = refHeight * scale;

  // Render blank screen
  if (isBlank) {
    return (
      <div
        ref={containerRef}
        style={{
          width: fillContainer ? '100vw' : scaledWidth,
          height: fillContainer ? '100vh' : scaledHeight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden'
        }}
      >
        {/* Wrapper that's the scaled size, containing the full-size content */}
        <div style={{
          width: scaledWidth,
          height: scaledHeight,
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Full-size content, scaled down with transform */}
          <div
            style={{
              width: refWidth,
              height: refHeight,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              position: 'absolute',
              top: 0,
              left: 0,
              ...getBackgroundStyle()
            }}
          />
        </div>
      </div>
    );
  }

  // Check if we're rendering a presentation slide
  const isPresentation = !!presentationSlide;

  return (
    <div
      ref={containerRef}
      style={{
        width: fillContainer ? '100vw' : scaledWidth,
        height: fillContainer ? '100vh' : scaledHeight,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden'
      }}
    >
      {/* Wrapper that's the scaled size, containing the full-size content */}
      <div style={{
        width: scaledWidth,
        height: scaledHeight,
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Full-size content (1920x1080), scaled down with transform */}
        <div
          style={{
            width: refWidth,
            height: refHeight,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            position: 'absolute',
            top: 0,
            left: 0,
            ...(isPresentation ? getPresentationBackgroundStyle() : getBackgroundStyle())
          }}
        >
          {isPresentation ? (
            /* Presentation mode - render image boxes and textboxes with embedded styling */
            <>
              {renderPresentationImageBoxes()}
              {renderPresentationTextBoxes()}
            </>
          ) : (
            <>
              {/* Background boxes */}
              {renderBackgroundBoxes()}

              {/* Content - always use absolute positioning with defaults if needed */}
              {renderAbsoluteLines()}

              {/* Bible/Prayer reference lines */}
              {renderReferenceLine()}
              {renderReferenceTranslationLine()}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SlideRenderer;
