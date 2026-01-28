import React, { useRef, useEffect, useState, useLayoutEffect, useCallback, useMemo, memo } from 'react';
import { createLogger } from '../utils/debug';

// Create logger for this module
const log = createLogger('SlideRenderer');

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
  originalLanguage?: string; // Song's original language - used to determine single-language rendering
  reference?: string;  // Bible verse reference (e.g., "Genesis 1:1") or Hebrew reference for prayer
  referenceTranslation?: string; // English reference for prayer
  referenceEnglish?: string; // English reference for Bible themes (e.g., "Genesis 1:1")
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
  // Enhanced properties
  fontWeight?: string;              // '300'-'800' (overrides bold when set)
  backgroundOpacity?: number;       // 0-1 (separate from text opacity)
  visible?: boolean;                // default true
  // Per-side borders
  borderTop?: number;
  borderRight?: number;
  borderBottom?: number;
  borderLeft?: number;
  borderColor?: string;
  // Per-corner radius
  borderRadiusTopLeft?: number;
  borderRadiusTopRight?: number;
  borderRadiusBottomRight?: number;
  borderRadiusBottomLeft?: number;
  // Per-side padding
  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;
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
  visible?: boolean;
}

interface PresentationBackgroundBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  opacity: number;
  borderRadius: number;
  texture?: TextureType;
  textureOpacity?: number;
  zIndex?: number;
  visible?: boolean;
}

interface PresentationSlide {
  id: string;
  order: number;
  textBoxes: PresentationTextBox[];
  imageBoxes?: PresentationImageBox[];
  backgroundBoxes?: PresentationBackgroundBox[];
  backgroundColor?: string;
  backgroundGradient?: string;
  backgroundType?: 'color' | 'gradient' | 'transparent';
}

interface LinePosition {
  x: number;      // percentage
  y: number;      // percentage
  width: number;  // percentage
  height: number; // percentage
  paddingTop: number;
  paddingBottom: number;
  paddingLeft?: number;
  paddingRight?: number;
  alignH: 'left' | 'center' | 'right';
  alignV: 'top' | 'center' | 'bottom';
  // Flow positioning properties
  positionMode?: 'absolute' | 'flow';  // Default: 'absolute'
  flowGap?: number;                     // Gap below box (percentage)
  flowAnchor?: string;                  // Line type to position after (null = top of canvas)
  // Auto-height properties
  autoHeight?: boolean;                 // Height determined by content (default: false)
}

interface LineStyle {
  fontSize: number;   // 100 = base size
  fontWeight: string;
  color: string;
  opacity: number;
  visible: boolean;
  // Background properties (optional) - for per-line backgrounds like OBS overlay
  backgroundColor?: string;
  backgroundOpacity?: number;
  backgroundPadding?: string;  // CSS padding, e.g. "0.15em 0.6em"
  // Border properties (optional)
  borderTop?: number;
  borderRight?: number;
  borderBottom?: number;
  borderLeft?: number;
  borderColor?: string;
  borderRadius?: number;
  // Individual corner radii (optional)
  borderRadiusTopLeft?: number;
  borderRadiusTopRight?: number;
  borderRadiusBottomRight?: number;
  borderRadiusBottomLeft?: number;
}

type TextureType = 'none' | 'paper' | 'parchment' | 'linen' | 'canvas' | 'noise';

interface BackgroundBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  opacity: number;
  borderRadius: number;
  texture?: TextureType;
  textureOpacity?: number;
}

// CSS texture patterns - grayscale patterns that blend with any base color
const texturePatterns: Record<TextureType, { pattern: string; size: string }> = {
  none: { pattern: 'none', size: 'auto' },
  paper: {
    pattern: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='%23888'/%3E%3Ccircle cx='20' cy='30' r='3' fill='%23666'/%3E%3Ccircle cx='70' cy='15' r='2' fill='%23999'/%3E%3Ccircle cx='45' cy='60' r='4' fill='%23777'/%3E%3Ccircle cx='10' cy='80' r='2' fill='%23aaa'/%3E%3Ccircle cx='85' cy='70' r='3' fill='%23666'/%3E%3Ccircle cx='30' cy='90' r='2' fill='%23999'/%3E%3Ccircle cx='60' cy='40' r='2' fill='%23555'/%3E%3Ccircle cx='90' cy='50' r='3' fill='%23888'/%3E%3Ccircle cx='5' cy='45' r='2' fill='%23777'/%3E%3Ccircle cx='55' cy='85' r='3' fill='%23666'/%3E%3Ccircle cx='75' cy='35' r='2' fill='%23aaa'/%3E%3Ccircle cx='35' cy='10' r='2' fill='%23999'/%3E%3C/svg%3E")`,
    size: '100px 100px'
  },
  parchment: {
    pattern: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Crect width='60' height='60' fill='%23888'/%3E%3Cpath d='M0 15 Q15 12 30 15 T60 15' stroke='%23666' stroke-width='1' fill='none'/%3E%3Cpath d='M0 35 Q15 38 30 35 T60 35' stroke='%23999' stroke-width='0.8' fill='none'/%3E%3Cpath d='M0 50 Q15 47 30 50 T60 50' stroke='%23777' stroke-width='0.6' fill='none'/%3E%3Ccircle cx='10' cy='10' r='4' fill='%23777'/%3E%3Ccircle cx='45' cy='25' r='5' fill='%23999'/%3E%3Ccircle cx='25' cy='45' r='3' fill='%23666'/%3E%3C/svg%3E")`,
    size: '60px 60px'
  },
  linen: {
    pattern: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8'%3E%3Crect width='8' height='8' fill='%23888'/%3E%3Cpath d='M0 0L8 8M8 0L0 8' stroke='%23666' stroke-width='1'/%3E%3C/svg%3E")`,
    size: '8px 8px'
  },
  canvas: {
    pattern: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12'%3E%3Crect width='12' height='12' fill='%23888'/%3E%3Crect x='0' y='0' width='6' height='6' fill='%23777'/%3E%3Crect x='6' y='6' width='6' height='6' fill='%23777'/%3E%3C/svg%3E")`,
    size: '12px 12px'
  },
  noise: {
    pattern: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' fill='%23808080'/%3E%3Crect x='2' y='3' width='2' height='2' fill='%23606060'/%3E%3Crect x='12' y='7' width='2' height='2' fill='%23a0a0a0'/%3E%3Crect x='25' y='2' width='2' height='2' fill='%23707070'/%3E%3Crect x='35' y='10' width='2' height='2' fill='%23909090'/%3E%3Crect x='8' y='18' width='2' height='2' fill='%23505050'/%3E%3Crect x='20' y='15' width='2' height='2' fill='%23b0b0b0'/%3E%3Crect x='32' y='22' width='2' height='2' fill='%23656565'/%3E%3Crect x='5' y='30' width='2' height='2' fill='%23959595'/%3E%3Crect x='18' y='28' width='2' height='2' fill='%23757575'/%3E%3Crect x='28' y='35' width='2' height='2' fill='%23858585'/%3E%3Crect x='38' y='32' width='2' height='2' fill='%23555555'/%3E%3Crect x='15' y='38' width='2' height='2' fill='%23a5a5a5'/%3E%3C/svg%3E")`,
    size: '40px 40px'
  }
};

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
  // Bible theme English reference line (separate from prayer's referenceTranslation)
  referenceEnglishStyle?: LineStyle;
  referenceEnglishPosition?: LinePosition;
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

  // Combined slides for original-only mode
  combinedSlides?: SlideData[] | null;
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

// Display font - Heebo supports both Hebrew and Latin with consistent metrics
const DISPLAY_FONT = "'Heebo', 'Segoe UI', sans-serif";

/**
 * Calculate how many lines a text needs at a given font size
 */
const calculateLinesNeeded = (
  text: string,
  fontSize: number,
  boxWidthPx: number,
  isHebrew: boolean
): number => {
  if (!text || fontSize <= 0 || boxWidthPx <= 0) return 1;

  // Balanced character width estimates
  const avgCharWidth = isHebrew ? 0.58 : 0.50;

  // Use 90% of width
  const effectiveWidth = boxWidthPx * 0.90;
  const charsPerLine = Math.max(1, Math.floor(effectiveWidth / (fontSize * avgCharWidth)));

  // Add 10% buffer for word-wrap
  const linesNeeded = Math.ceil((text.length / charsPerLine) * 1.10);

  return Math.max(1, linesNeeded);
};

/**
 * Calculate optimal font size to fit text within a box
 * Returns a scale factor to apply to the font size
 */
const calculateDynamicFontScale = (
  text: string,
  baseFontSize: number,
  boxWidthPx: number,
  boxHeightPx: number,
  isRtl: boolean = false
): number => {
  if (!text || boxWidthPx <= 0 || boxHeightPx <= 0) return 1;

  const isHebrew = (text.match(/[\u0590-\u05FF]/g) || []).length > text.length * 0.5;
  const lineHeight = 1.35;

  let minScale = 0.3;
  let maxScale = 2.5;
  let optimalScale = 1;

  for (let i = 0; i < 15; i++) {
    const testScale = (minScale + maxScale) / 2;
    const testFontSize = baseFontSize * testScale;

    const linesNeeded = calculateLinesNeeded(text, testFontSize, boxWidthPx, isHebrew);
    const heightNeeded = linesNeeded * testFontSize * lineHeight;
    const effectiveHeight = boxHeightPx * 0.85;

    if (heightNeeded <= effectiveHeight) {
      optimalScale = testScale;
      minScale = testScale;
    } else {
      maxScale = testScale;
    }
  }

  return Math.max(0.4, Math.min(2.5, optimalScale));
};

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

// Default line styles - Updated to match new design spec
// Base font at 1080p = 54px (fontSize 100), so: 86px=159, 64px=119
const DEFAULT_LINE_STYLES: Record<string, LineStyle> = {
  original: {
    fontSize: 159, fontWeight: '700', color: '#ffffff', opacity: 1, visible: true  // 86px bold white
  },
  transliteration: {
    fontSize: 119, fontWeight: '300', color: '#ffffff', opacity: 1, visible: true  // 64px light white
  },
  translation: {
    fontSize: 119, fontWeight: '300', color: '#b7b7b7', opacity: 1, visible: true  // 64px light #b7b7b7
  },
  translationOverflow: {
    fontSize: 119, fontWeight: '300', color: '#b7b7b7', opacity: 1, visible: true  // 64px light #b7b7b7
  },
  // Prayer/Sermon default styles (NewClassicPrayer layout)
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
  presentationSlide,
  combinedSlides
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  // For flow positioning: refs to measure actual heights and calculated positions
  const lineRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [measuredHeights, setMeasuredHeights] = useState<Record<string, number>>({});
  const [flowPositions, setFlowPositions] = useState<Record<string, number>>({});

  // Reference dimensions from theme or default to 1920x1080
  const refWidth = theme?.canvasDimensions?.width || 1920;
  const refHeight = theme?.canvasDimensions?.height || 1080;
  const aspectRatio = refHeight / refWidth;

  // Calculate scale factor to fit container (throttled resize handler)
  useEffect(() => {
    let resizeTimeout: ReturnType<typeof setTimeout> | null = null;

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

    // Throttled resize handler to prevent excessive recalculations
    const handleResize = () => {
      if (resizeTimeout) return;
      resizeTimeout = setTimeout(() => {
        calculateScale();
        resizeTimeout = null;
      }, 16); // ~60fps throttle
    };

    calculateScale();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimeout) clearTimeout(resizeTimeout);
    };
  }, [refWidth, refHeight, containerWidth, containerHeight, fillContainer]);

  // Get line order from theme (add translationOverflow after translation if not in theme)
  // Memoize to prevent infinite re-render loops in useLayoutEffect
  const lineOrder = useMemo(() => {
    const baseLineOrder = theme?.lineOrder || ['original', 'transliteration', 'translation'];
    return baseLineOrder.includes('translationOverflow')
      ? baseLineOrder
      : [...baseLineOrder, 'translationOverflow'];
  }, [theme?.lineOrder]);

  // Merge line positions including reference positions for Bible/Prayer themes
  // This needs to be calculated before flow position calculation
  const mergedLinePositions: Record<string, LinePosition> = useMemo(() => ({
    ...DEFAULT_LINE_POSITIONS,
    ...(theme?.linePositions || {}),
    ...(theme?.referencePosition ? { reference: theme.referencePosition } : {}),
    ...(theme?.referenceEnglishPosition ? { referenceEnglish: theme.referenceEnglishPosition } : {}),
    ...(theme?.referenceTranslationPosition ? { referenceTranslation: theme.referenceTranslationPosition } : {})
  }), [theme?.linePositions, theme?.referencePosition, theme?.referenceEnglishPosition, theme?.referenceTranslationPosition]);

  // Calculate flow positions based on measured heights
  useLayoutEffect(() => {
    const positions = mergedLinePositions;
    const newMeasuredHeights: Record<string, number> = {};
    const newFlowPositions: Record<string, number> = {};

    // First pass: measure all line heights
    Object.entries(lineRefs.current).forEach(([lineType, ref]) => {
      if (ref) {
        const heightPx = ref.scrollHeight;
        // Convert pixel height to percentage of reference height
        const heightPercent = (heightPx / refHeight) * 100;
        newMeasuredHeights[lineType] = heightPercent;
      }
    });

    // Helper function to calculate flow position with dependency resolution
    const calculateFlowY = (lineType: string, visited: Set<string>): number | null => {
      const position = positions[lineType];
      if (!position || position.positionMode !== 'flow') return null;

      // Check for circular dependency
      if (visited.has(lineType)) {
        log.warn(`Circular flow dependency detected for: ${lineType}`);
        return position.y || 0;
      }
      visited.add(lineType);

      // If already calculated, return cached value
      if (newFlowPositions[lineType] !== undefined) {
        return newFlowPositions[lineType];
      }

      let calculatedY: number;

      if (!position.flowAnchor) {
        // No anchor - position at top of canvas (or use stored y as offset)
        calculatedY = position.y || 0;
      } else {
        // Has anchor - position below the anchor
        const anchorPosition = positions[position.flowAnchor];
        if (!anchorPosition) {
          // Anchor not found, warn and use stored position
          log.warn(`Flow anchor '${position.flowAnchor}' not found for line '${lineType}'`);
          calculatedY = position.y || 0;
        } else {
          // Recursively calculate anchor's Y position if it's also flow mode
          let anchorY: number;
          if (anchorPosition.positionMode === 'flow') {
            const calculatedAnchorY = calculateFlowY(position.flowAnchor, visited);
            anchorY = calculatedAnchorY ?? anchorPosition.y;
          } else {
            anchorY = anchorPosition.y;
          }

          // Get anchor's height - use measured if autoHeight enabled OR if measured height exists
          // If autoHeight is enabled but no measured height exists, the anchor has no content (not rendered) - use 0
          const hasMeasuredHeight = newMeasuredHeights[position.flowAnchor] !== undefined;
          const useAutoHeight = anchorPosition.autoHeight === true || hasMeasuredHeight;
          let anchorHeight: number;
          if (useAutoHeight) {
            // If autoHeight but no measured height, content is empty - treat as 0 height
            anchorHeight = hasMeasuredHeight ? newMeasuredHeights[position.flowAnchor] : 0;
          } else {
            anchorHeight = anchorPosition.height;
          }

          // Calculate Y = anchor Y + anchor height + gap
          const gap = position.flowGap ?? 0;
          calculatedY = anchorY + anchorHeight + gap;
        }
      }

      newFlowPositions[lineType] = calculatedY;
      return calculatedY;
    };

    // Second pass: calculate flow positions with proper dependency resolution
    lineOrder.forEach((lineType) => {
      const position = positions[lineType];
      if (position?.positionMode === 'flow') {
        calculateFlowY(lineType, new Set());
      }
    });

    setMeasuredHeights(newMeasuredHeights);
    setFlowPositions(newFlowPositions);
  }, [mergedLinePositions, lineOrder, refHeight, slideData, sampleText, editorMode]);

  // Use the merged positions for rendering (already includes defaults and reference positions)
  const effectiveLinePositions = mergedLinePositions;

  // Memoize line styles to prevent unnecessary object recreation
  const effectiveLineStyles: Record<string, LineStyle> = useMemo(() => ({
    ...DEFAULT_LINE_STYLES,
    ...(theme?.lineStyles || {}),
    // Include reference styles for Bible/Prayer themes
    ...(theme?.referenceStyle ? { reference: theme.referenceStyle } : {}),
    ...(theme?.referenceEnglishStyle ? { referenceEnglish: theme.referenceEnglishStyle } : {}),
    ...(theme?.referenceTranslationStyle ? { referenceTranslation: theme.referenceTranslationStyle } : {})
  }), [theme?.lineStyles, theme?.referenceStyle, theme?.referenceEnglishStyle, theme?.referenceTranslationStyle]);

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

    // Check if this is a single-language song
    const lang = slideData.originalLanguage;
    const isSingleLang = lang && lang !== 'he' && lang !== 'ar';

    switch (lineType) {
      case 'original':
      case 'hebrew':  // Bible theme compatibility
        // For single-language songs, combine all text fields into one display
        if (isSingleLang) {
          const lines: string[] = [];
          if (slideData.originalText) lines.push(slideData.originalText);
          if (slideData.transliteration) lines.push(slideData.transliteration);
          if (slideData.translation) lines.push(slideData.translation);
          if (slideData.translationOverflow) lines.push(slideData.translationOverflow);
          return lines.length > 0 ? lines.join('\n') : null;
        }
        // In original-only mode with combined slides, show all combined slides' original text
        // combinedSlides already contains all slides (including the first), so don't add mainText
        if (displayMode === 'original' && combinedSlides && combinedSlides.length > 0) {
          return combinedSlides
            .map(slide => slide.originalText)
            .filter(Boolean)
            .join('\n') || null;
        }
        return slideData.originalText || null;
      case 'transliteration':
        // For single-language songs, this is handled in 'original' above
        if (isSingleLang) return null;
        return slideData.transliteration || null;
      case 'translation':
      case 'english':  // Bible theme compatibility
        // For single-language songs, this is handled in 'original' above
        if (isSingleLang) return null;
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
      case 'referenceEnglish':
        return slideData.referenceEnglish || null;
      case 'referenceTranslation':
        return slideData.referenceTranslation || null;
      default:
        return null;
    }
  };

  // Check if this is a single-language song (not Hebrew/Arabic that needs transliteration)
  const isSingleLanguageSong = useMemo(() => {
    if (!slideData?.originalLanguage) return false;
    const lang = slideData.originalLanguage;
    // Hebrew and Arabic use transliteration, all others are single-language
    return lang !== 'he' && lang !== 'ar';
  }, [slideData?.originalLanguage]);

  // Check if line should be visible based on display mode
  const shouldShowLine = (lineType: string): boolean => {
    // For single-language songs, only show 'original' line (which will contain all text)
    if (isSingleLanguageSong) {
      switch (lineType) {
        case 'original':
        case 'hebrew':
          return true;
        case 'transliteration':
        case 'translation':
        case 'translationOverflow':
        case 'english':
          return false; // Hide these - content is combined into 'original'
        default:
          // Allow other line types (reference, title, etc.) to follow normal rules
          break;
      }
    }

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
      case 'referenceEnglish':
        // English reference for Bible themes - visible in bilingual and translation modes
        return displayMode === 'bilingual' || displayMode === 'translation';
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
          zIndex: 1,
          overflow: 'hidden'
        }}
      >
        {/* Texture overlay */}
        {box.texture && box.texture !== 'none' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: texturePatterns[box.texture].pattern,
              backgroundRepeat: 'repeat',
              backgroundSize: texturePatterns[box.texture].size,
              opacity: box.textureOpacity ?? 0.3,
              pointerEvents: 'none',
              mixBlendMode: 'overlay'
            }}
          />
        )}
      </div>
    ));
  };

  // Render lines with absolute positioning (always used - with defaults if no theme positions)
  const renderAbsoluteLines = () => {
    return lineOrder.map((lineType) => {
      // Note: references (reference, referenceEnglish, referenceTranslation) are now included
      // in effectiveLinePositions/Styles and rendered in lineOrder for proper z-ordering

      const position = effectiveLinePositions[lineType];
      const style = effectiveLineStyles[lineType];

      if (!position) return null;
      if (style?.visible === false) return null;
      if (!shouldShowLine(lineType)) return null;

      const content = getLineContent(lineType);
      if (!content && !editorMode) return null;

      // Use theme values directly - no hardcoded overrides
      const baseFontSize = getBaseFontSize();
      const fontSize = baseFontSize * ((style?.fontSize || 100) / 100);
      const fontWeight = style?.fontWeight || '500';
      const fontColor = style?.color || '#FFFFFF';

      // RTL for Hebrew content - check actual content for Hebrew characters
      const hasHebrewChars = (text: string | null) => {
        if (!text) return false;
        return /[\u0590-\u05FF\uFB1D-\uFB4F]/.test(text);
      };
      const contentHasHebrew = hasHebrewChars(content);
      // Use content detection, or fall back to line type heuristics for Hebrew-typical lines
      const isRtl = contentHasHebrew ||
                    (lineType === 'original' || lineType === 'hebrew' ||
                     lineType === 'title' || lineType === 'subtitle' || lineType === 'description');

      // Map alignment to CSS
      const justifyContent = position.alignH === 'left' ? 'flex-start' :
                            position.alignH === 'right' ? 'flex-end' : 'center';
      const alignItems = position.alignV === 'top' ? 'flex-start' :
                        position.alignV === 'bottom' ? 'flex-end' : 'center';

      // Check for per-line background (OBS overlay style)
      const hasLineBackground = !!style?.backgroundColor;

      // Check if this is a reference line that may have border styling
      const isReferenceLine = lineType === 'reference' || lineType === 'referenceEnglish' || lineType === 'referenceTranslation';

      // Build border styles for reference lines
      const borderStyles: React.CSSProperties = {};
      if (isReferenceLine && style) {
        const borderColor = style.borderColor || '#ffffff';
        if (style.borderTop) borderStyles.borderTop = `${style.borderTop}px solid ${borderColor}`;
        if (style.borderRight) borderStyles.borderRight = `${style.borderRight}px solid ${borderColor}`;
        if (style.borderBottom) borderStyles.borderBottom = `${style.borderBottom}px solid ${borderColor}`;
        if (style.borderLeft) borderStyles.borderLeft = `${style.borderLeft}px solid ${borderColor}`;
        // Apply individual corner radii or fallback to single borderRadius
        const hasCornerRadii = style.borderRadiusTopLeft || style.borderRadiusTopRight || style.borderRadiusBottomRight || style.borderRadiusBottomLeft;
        if (hasCornerRadii) {
          borderStyles.borderRadius = `${style.borderRadiusTopLeft ?? 0}px ${style.borderRadiusTopRight ?? 0}px ${style.borderRadiusBottomRight ?? 0}px ${style.borderRadiusBottomLeft ?? 0}px`;
        } else if (style.borderRadius) {
          borderStyles.borderRadius = `${style.borderRadius}px`;
        }
      }

      // Check if this is a combined slides scenario (original line with multiple slides)
      const hasCombinedContent = (lineType === 'original' || lineType === 'hebrew') &&
                                  combinedSlides && combinedSlides.length > 1;

      // Determine Y position: use calculated flow position or stored position
      const isFlowMode = position.positionMode === 'flow';
      const isAutoHeight = position.autoHeight === true;
      const effectiveY = isFlowMode && flowPositions[lineType] !== undefined
        ? flowPositions[lineType]
        : position.y;

      // Determine if height should be auto (for combined content, flow mode, or auto-height mode)
      const useAutoHeight = hasCombinedContent || isFlowMode || isAutoHeight;

      return (
        <div
          key={lineType}
          ref={(el) => { lineRefs.current[lineType] = el; }}
          style={{
            position: 'absolute',
            left: `${position.x}%`,
            top: `${effectiveY}%`,
            width: `${position.width}%`,
            // For combined slides, flow mode, or auto-height, use auto height to fit content
            height: useAutoHeight ? 'auto' : `${position.height}%`,
            display: 'flex',
            justifyContent,
            alignItems,
            paddingTop: `${position.paddingTop}%`,
            paddingBottom: `${position.paddingBottom}%`,
            paddingLeft: `${position.paddingLeft ?? 0}px`,
            paddingRight: `${position.paddingRight ?? 0}px`,
            boxSizing: 'border-box',
            zIndex: isReferenceLine ? 10 : 2,
            overflow: useAutoHeight ? 'visible' : 'hidden',
            ...borderStyles
          }}
        >
          <div
            style={{
              width: hasLineBackground ? 'auto' : '100%',
              display: hasLineBackground ? 'inline-block' : 'block',
              fontFamily: DISPLAY_FONT,
              fontSize: `${fontSize}px`,
              fontWeight: fontWeight,
              color: fontColor,
              opacity: style?.backgroundOpacity ?? style?.opacity ?? 1,
              direction: isRtl ? 'rtl' : 'ltr',
              textAlign: position.alignH,
              lineHeight: hasLineBackground ? 1.0 : 1.35,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              textShadow: hasLineBackground ? '0 2px 4px rgba(0, 0, 0, 0.3)' : DEFAULT_TEXT_SHADOW,
              // Per-line background support
              backgroundColor: style?.backgroundColor || 'transparent',
              padding: style?.backgroundPadding || (hasLineBackground ? '0.15em 0.6em' : undefined),
              borderRadius: hasLineBackground ? `${style?.borderRadius ?? 6}px` : undefined
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
            fontFamily: DISPLAY_FONT,
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
      result = result.slice(0, -1) + '״' + result.slice(-1);
    } else if (result.length === 1) {
      result = result + '׳';
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

  // Render reference line using theme values
  // Skip if reference is in lineOrder (it will be rendered by renderAbsoluteLines)
  const renderReferenceLine = () => {
    // Skip if reference is in lineOrder - it will be rendered by renderAbsoluteLines
    if (lineOrder.includes('reference')) return null;
    if (!slideData?.reference) return null;
    if (!theme?.referencePosition) return null;

    const position = theme.referencePosition;
    const style = theme?.referenceStyle || {
      fontSize: 70,
      fontWeight: '500',
      color: '#06b6d4',
      opacity: 0.9,
      visible: true
    };

    if (style.visible === false) return null;

    const baseFontSize = refHeight * 0.05;
    const fontSize = baseFontSize * ((style.fontSize || 70) / 100);

    const justifyContent = position.alignH === 'left' ? 'flex-start' :
                          position.alignH === 'right' ? 'flex-end' : 'center';
    const alignItems = position.alignV === 'top' ? 'flex-start' :
                      position.alignV === 'bottom' ? 'flex-end' : 'center';

    // Build border styles
    const borderColor = style.borderColor || '#ffffff';
    const borderStyles: React.CSSProperties = {};
    if (style.borderTop) borderStyles.borderTop = `${style.borderTop}px solid ${borderColor}`;
    if (style.borderRight) borderStyles.borderRight = `${style.borderRight}px solid ${borderColor}`;
    if (style.borderBottom) borderStyles.borderBottom = `${style.borderBottom}px solid ${borderColor}`;
    if (style.borderLeft) borderStyles.borderLeft = `${style.borderLeft}px solid ${borderColor}`;
    // Apply individual corner radii or fallback to single borderRadius
    const hasCornerRadii = style.borderRadiusTopLeft || style.borderRadiusTopRight || style.borderRadiusBottomRight || style.borderRadiusBottomLeft;
    if (hasCornerRadii) {
      borderStyles.borderRadius = `${style.borderRadiusTopLeft ?? 0}px ${style.borderRadiusTopRight ?? 0}px ${style.borderRadiusBottomRight ?? 0}px ${style.borderRadiusBottomLeft ?? 0}px`;
    } else if (style.borderRadius) {
      borderStyles.borderRadius = `${style.borderRadius}px`;
    }

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
          paddingLeft: `${position.paddingLeft ?? 0}px`,
          paddingRight: `${position.paddingRight ?? 0}px`,
          boxSizing: 'border-box',
          zIndex: 10,
          ...borderStyles
        }}
      >
        <div
          style={{
            width: '100%',
            fontFamily: DISPLAY_FONT,
            fontSize: `${fontSize}px`,
            fontWeight: style.fontWeight || '500',
            color: style.color || '#06b6d4',
            opacity: style.opacity ?? 0.9,
            textAlign: position.alignH || 'center',
            lineHeight: 1.3,
            textShadow: DEFAULT_TEXT_SHADOW
          }}
        >
          {slideData.reference}
        </div>
      </div>
    );
  };

  // Render reference translation line (for Prayer themes - English reference)
  const renderReferenceTranslationLine = () => {
    // Skip if referenceTranslation is in lineOrder - it will be rendered by renderAbsoluteLines
    if (lineOrder.includes('referenceTranslation')) return null;
    if (!slideData?.referenceTranslation) {
      return null;
    }
    if (displayMode !== 'bilingual') {
      return null; // Only show in bilingual mode
    }

    // Use theme position if available, otherwise use defaults
    const position = theme?.referenceTranslationPosition || DEFAULT_LINE_POSITIONS.referenceTranslation;
    const style = theme?.referenceTranslationStyle || DEFAULT_LINE_STYLES.referenceTranslation;

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
          paddingLeft: `${position.paddingLeft ?? 0}px`,
          paddingRight: `${position.paddingRight ?? 0}px`,
          boxSizing: 'border-box',
          zIndex: 10
        }}
      >
        <div
          style={{
            width: '100%',
            fontFamily: DISPLAY_FONT,
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

  // Render reference English line (for Bible themes - English reference like "Genesis 1:1")
  const renderReferenceEnglishLine = () => {
    // Skip if referenceEnglish is in lineOrder - it will be rendered by renderAbsoluteLines
    if (lineOrder.includes('referenceEnglish')) return null;
    if (!slideData?.referenceEnglish) {
      return null;
    }
    if (displayMode !== 'bilingual') {
      return null; // Only show in bilingual mode
    }

    // Use theme position if available
    const position = theme?.referenceEnglishPosition;
    const style = theme?.referenceEnglishStyle;

    // If no specific referenceEnglish position, don't render (Bible theme not configured)
    if (!position) {
      return null;
    }

    if (style?.visible === false) return null;

    const baseFontSize = refHeight * 0.05;
    const fontSize = baseFontSize * ((style?.fontSize || 70) / 100);

    const justifyContent = position.alignH === 'left' ? 'flex-start' :
                          position.alignH === 'right' ? 'flex-end' : 'center';
    const alignItems = position.alignV === 'top' ? 'flex-start' :
                      position.alignV === 'bottom' ? 'flex-end' : 'center';

    // Build border styles
    const borderColor = style?.borderColor || '#ffffff';
    const borderStyles: React.CSSProperties = {};
    if (style?.borderTop) borderStyles.borderTop = `${style.borderTop}px solid ${borderColor}`;
    if (style?.borderRight) borderStyles.borderRight = `${style.borderRight}px solid ${borderColor}`;
    if (style?.borderBottom) borderStyles.borderBottom = `${style.borderBottom}px solid ${borderColor}`;
    if (style?.borderLeft) borderStyles.borderLeft = `${style.borderLeft}px solid ${borderColor}`;
    // Apply individual corner radii or fallback to single borderRadius
    const hasCornerRadii = style?.borderRadiusTopLeft || style?.borderRadiusTopRight || style?.borderRadiusBottomRight || style?.borderRadiusBottomLeft;
    if (hasCornerRadii) {
      borderStyles.borderRadius = `${style?.borderRadiusTopLeft ?? 0}px ${style?.borderRadiusTopRight ?? 0}px ${style?.borderRadiusBottomRight ?? 0}px ${style?.borderRadiusBottomLeft ?? 0}px`;
    } else if (style?.borderRadius) {
      borderStyles.borderRadius = `${style.borderRadius}px`;
    }

    return (
      <div
        key="referenceEnglish"
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
          paddingLeft: `${position.paddingLeft ?? 0}px`,
          paddingRight: `${position.paddingRight ?? 0}px`,
          boxSizing: 'border-box',
          zIndex: 10,
          ...borderStyles
        }}
      >
        <div
          style={{
            width: '100%',
            fontFamily: DISPLAY_FONT,
            fontSize: `${fontSize}px`,
            fontWeight: style?.fontWeight || '400',
            color: style?.color || '#06b6d4',
            opacity: style?.opacity ?? 0.9,
            textAlign: position.alignH || 'center',
            lineHeight: 1.3,
            textShadow: DEFAULT_TEXT_SHADOW
          }}
        >
          {slideData.referenceEnglish}
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

    return presentationSlide.textBoxes
      .filter((textBox) => textBox.visible !== false)
      .map((textBox) => {
      // Calculate font size in pixels based on percentage (100 = 5% of height = 54px at 1080p)
      const baseFontSize = refHeight * 0.05;
      const fontSize = baseFontSize * (textBox.fontSize / 100);

      // Map vertical alignment to CSS flexbox (horizontal alignment uses textAlign on inner div)
      const alignItems = textBox.verticalAlign === 'top' ? 'flex-start' :
                        textBox.verticalAlign === 'bottom' ? 'flex-end' : 'center';

      // Build per-side border styles
      const borderColor = textBox.borderColor || '#ffffff';
      const borderStyles: React.CSSProperties = {};
      if (textBox.borderTop) borderStyles.borderTop = `${textBox.borderTop}px solid ${borderColor}`;
      if (textBox.borderRight) borderStyles.borderRight = `${textBox.borderRight}px solid ${borderColor}`;
      if (textBox.borderBottom) borderStyles.borderBottom = `${textBox.borderBottom}px solid ${borderColor}`;
      if (textBox.borderLeft) borderStyles.borderLeft = `${textBox.borderLeft}px solid ${borderColor}`;

      // Build per-corner border radius
      const borderRadiusValue = `${textBox.borderRadiusTopLeft ?? 0}px ${textBox.borderRadiusTopRight ?? 0}px ${textBox.borderRadiusBottomRight ?? 0}px ${textBox.borderRadiusBottomLeft ?? 0}px`;

      // Build per-side padding (in percentage)
      const paddingValue = `${textBox.paddingTop ?? 0}% ${textBox.paddingRight ?? 0}% ${textBox.paddingBottom ?? 0}% ${textBox.paddingLeft ?? 0}%`;

      // Calculate background color with separate opacity
      let bgColor = textBox.backgroundColor || 'transparent';
      if (bgColor !== 'transparent' && textBox.backgroundOpacity !== undefined && textBox.backgroundOpacity < 1) {
        // Convert hex to rgba with backgroundOpacity
        if (bgColor.startsWith('#') && bgColor.length >= 7) {
          const r = parseInt(bgColor.slice(1, 3), 16);
          const g = parseInt(bgColor.slice(3, 5), 16);
          const b = parseInt(bgColor.slice(5, 7), 16);
          bgColor = `rgba(${r}, ${g}, ${b}, ${textBox.backgroundOpacity})`;
        }
      }

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
            alignItems,
            backgroundColor: bgColor,
            boxSizing: 'border-box',
            padding: paddingValue,
            zIndex: textBox.zIndex ?? 0,
            borderRadius: borderRadiusValue,
            ...borderStyles
          }}
        >
          <div
            dir={textBox.textDirection || 'ltr'}
            style={{
              fontFamily: DISPLAY_FONT,
              fontSize: `${fontSize}px`,
              fontWeight: textBox.fontWeight || (textBox.bold ? '700' : '400'),
              fontStyle: textBox.italic ? 'italic' : 'normal',
              textDecoration: textBox.underline ? 'underline' : 'none',
              color: textBox.color || '#FFFFFF',
              opacity: textBox.opacity ?? 1,
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

  // Render presentation background boxes
  const renderPresentationBackgroundBoxes = () => {
    if (!presentationSlide?.backgroundBoxes || presentationSlide.backgroundBoxes.length === 0) return null;

    return presentationSlide.backgroundBoxes
      .filter((box) => box.visible !== false)
      .map((box) => (
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
          zIndex: box.zIndex ?? 0,
          overflow: 'hidden'
        }}
      >
        {/* Texture overlay */}
        {box.texture && box.texture !== 'none' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: texturePatterns[box.texture].pattern,
              backgroundRepeat: 'repeat',
              backgroundSize: texturePatterns[box.texture].size,
              opacity: box.textureOpacity ?? 0.3,
              pointerEvents: 'none',
              mixBlendMode: 'overlay'
            }}
          />
        )}
      </div>
    ));
  };

  // Get presentation slide background (if any)
  const getPresentationBackgroundStyle = (): React.CSSProperties => {
    if (!presentationSlide) {
      return { backgroundColor: '#000000' };
    }

    // Handle different background types
    if (presentationSlide.backgroundType === 'transparent') {
      return { backgroundColor: 'transparent' };
    } else if (presentationSlide.backgroundType === 'gradient' && presentationSlide.backgroundGradient) {
      return { background: presentationSlide.backgroundGradient };
    } else {
      return { backgroundColor: presentationSlide.backgroundColor || '#000000' };
    }
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
            /* Presentation mode - render background boxes, image boxes and textboxes with embedded styling */
            <>
              {renderPresentationBackgroundBoxes()}
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
              {renderReferenceEnglishLine()}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(SlideRenderer);
