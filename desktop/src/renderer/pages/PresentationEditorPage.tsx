import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Rnd } from 'react-rnd';
import { gradientPresets, isGradient } from '../utils/gradients';
import { texturePatterns, textureLabels, TextureType as ThemeTextureType } from '../components/theme-editor/DraggableBox';

// Types
interface TextBox {
  id: string;
  text: string;
  x: number;        // 0-100 percentage
  y: number;        // 0-100 percentage
  width: number;    // 0-100 percentage
  height: number;   // 0-100 percentage
  fontSize: number; // 50-200 percentage (100 = base size)
  color: string;
  backgroundColor: string;
  textAlign: 'left' | 'center' | 'right';
  verticalAlign: 'top' | 'center' | 'bottom';
  bold: boolean;
  italic: boolean;
  underline: boolean;
  opacity: number;  // 0-1
  zIndex?: number;  // Layer order (higher = front)
  textDirection?: 'ltr' | 'rtl';  // Text direction for Hebrew/Arabic support

  // Enhanced properties (all optional for backward compatibility)
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

  // Flow positioning
  positionMode?: 'absolute' | 'flow';
  flowAnchor?: string;
  flowGap?: number;
  autoHeight?: boolean;
  growDirection?: 'up' | 'down';
}

interface ImageBox {
  id: string;
  src: string;      // Image source URL or data URL
  x: number;        // 0-100 percentage
  y: number;        // 0-100 percentage
  width: number;    // 0-100 percentage
  height: number;   // 0-100 percentage
  opacity: number;  // 0-1
  objectFit: 'contain' | 'cover' | 'fill';
  borderRadius: number; // pixels
  zIndex?: number;  // Layer order (higher = front)
  visible?: boolean;
}

// Texture types for background boxes
type TextureType = 'none' | 'paper' | 'parchment' | 'linen' | 'canvas' | 'noise';

// Background box for decorative rectangles
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

// Unified layer type for the layers panel
interface Layer {
  id: string;
  type: 'text' | 'image' | 'background';
  name: string;
  zIndex: number;
  visible?: boolean;
}

// Snap guide types for alignment
interface SnapGuide {
  type: 'vertical' | 'horizontal';
  position: number; // percentage
  label?: 'center' | 'edge' | 'align';
}

interface ElementBounds {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Slide {
  id: string;
  order: number;
  textBoxes: TextBox[];
  imageBoxes?: ImageBox[];
  backgroundBoxes?: PresentationBackgroundBox[];
  backgroundColor?: string;
  backgroundGradient?: string;
  backgroundType?: 'color' | 'gradient' | 'transparent';
}

interface QuickModeMetadata {
  type: 'sermon' | 'prayer' | 'announcements';
  title: string;
  titleTranslation?: string;
  generateTranslation?: boolean;
  subtitles: Array<{
    subtitle: string;
    subtitleTranslation?: string;
    description?: string;
    descriptionTranslation?: string;
    bibleRef?: { reference: string; hebrewReference?: string };
  }>;
}

interface Presentation {
  id: string;
  title: string;
  slides: Slide[];
  canvasDimensions: { width: number; height: number };
  createdAt: string;
  updatedAt: string;
  quickModeData?: QuickModeMetadata;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

// Get the highest zIndex from all elements in a slide
const getMaxZIndex = (slide: Slide): number => {
  const textZIndexes = slide.textBoxes.map(tb => tb.zIndex ?? 0);
  const imageZIndexes = (slide.imageBoxes || []).map(ib => ib.zIndex ?? 0);
  const backgroundZIndexes = (slide.backgroundBoxes || []).map(bb => bb.zIndex ?? 0);
  const allZIndexes = [...textZIndexes, ...imageZIndexes, ...backgroundZIndexes];
  return allZIndexes.length > 0 ? Math.max(...allZIndexes) : 0;
};

const createDefaultTextBox = (zIndex: number = 1): TextBox => ({
  id: generateId(),
  text: 'New Text',
  x: 25,
  y: 35,
  width: 50,
  height: 30,
  fontSize: 100,
  color: '#ffffff',
  backgroundColor: 'transparent',
  textAlign: 'center',
  verticalAlign: 'center',
  bold: false,
  italic: false,
  underline: false,
  opacity: 1,
  zIndex,
  textDirection: 'ltr',
  // New defaults
  fontWeight: '400',
  backgroundOpacity: 1,
  visible: true,
  borderTop: 0,
  borderRight: 0,
  borderBottom: 0,
  borderLeft: 0,
  borderColor: '#ffffff',
  borderRadiusTopLeft: 0,
  borderRadiusTopRight: 0,
  borderRadiusBottomRight: 0,
  borderRadiusBottomLeft: 0,
  paddingTop: 0,
  paddingBottom: 0,
  paddingLeft: 0,
  paddingRight: 0,
  positionMode: 'absolute',
  autoHeight: false,
  growDirection: 'down'
});

const createDefaultBackgroundBox = (zIndex: number = 0): PresentationBackgroundBox => ({
  id: generateId(),
  x: 10,
  y: 10,
  width: 80,
  height: 80,
  color: '#1a1a2e',
  opacity: 0.8,
  borderRadius: 8,
  texture: 'none',
  textureOpacity: 0.3,
  zIndex,
  visible: true
});

const createDefaultSlide = (): Slide => ({
  id: generateId(),
  order: 0,
  textBoxes: [],
  imageBoxes: [],
  backgroundType: 'transparent'
});

const createDefaultImageBox = (src: string, zIndex: number = 1): ImageBox => ({
  id: generateId(),
  src,
  x: 25,
  y: 25,
  width: 50,
  height: 50,
  opacity: 1,
  objectFit: 'contain',
  borderRadius: 0,
  zIndex
});

// Template slide creators
const createSermonSlide = (): Slide => ({
  id: generateId(),
  order: 0,
  textBoxes: [
    { id: generateId(), text: 'Sermon Title', x: 10, y: 5, width: 80, height: 15, fontSize: 150, color: '#ffffff', backgroundColor: 'transparent', textAlign: 'center', verticalAlign: 'center', bold: true, italic: false, underline: false, opacity: 1, zIndex: 4, textDirection: 'ltr' },
    { id: generateId(), text: '1. First Point', x: 10, y: 30, width: 80, height: 12, fontSize: 100, color: '#ffffff', backgroundColor: 'transparent', textAlign: 'left', verticalAlign: 'center', bold: false, italic: false, underline: false, opacity: 1, zIndex: 3, textDirection: 'ltr' },
    { id: generateId(), text: '2. Second Point', x: 10, y: 50, width: 80, height: 12, fontSize: 100, color: '#ffffff', backgroundColor: 'transparent', textAlign: 'left', verticalAlign: 'center', bold: false, italic: false, underline: false, opacity: 1, zIndex: 2, textDirection: 'ltr' },
    { id: generateId(), text: '3. Third Point', x: 10, y: 70, width: 80, height: 12, fontSize: 100, color: '#ffffff', backgroundColor: 'transparent', textAlign: 'left', verticalAlign: 'center', bold: false, italic: false, underline: false, opacity: 1, zIndex: 1, textDirection: 'ltr' }
  ],
  imageBoxes: [],
  backgroundType: 'transparent'
});

const createPrayerSlide = (): Slide => ({
  id: generateId(),
  order: 0,
  textBoxes: [
    { id: generateId(), text: 'Prayer Points', x: 10, y: 5, width: 80, height: 15, fontSize: 140, color: '#ffffff', backgroundColor: 'transparent', textAlign: 'center', verticalAlign: 'center', bold: true, italic: false, underline: false, opacity: 1, zIndex: 4, textDirection: 'ltr' },
    { id: generateId(), text: '• Prayer item 1', x: 10, y: 30, width: 80, height: 10, fontSize: 90, color: '#ffffff', backgroundColor: 'transparent', textAlign: 'left', verticalAlign: 'center', bold: false, italic: false, underline: false, opacity: 1, zIndex: 3, textDirection: 'ltr' },
    { id: generateId(), text: '• Prayer item 2', x: 10, y: 45, width: 80, height: 10, fontSize: 90, color: '#ffffff', backgroundColor: 'transparent', textAlign: 'left', verticalAlign: 'center', bold: false, italic: false, underline: false, opacity: 1, zIndex: 2, textDirection: 'ltr' },
    { id: generateId(), text: '• Prayer item 3', x: 10, y: 60, width: 80, height: 10, fontSize: 90, color: '#ffffff', backgroundColor: 'transparent', textAlign: 'left', verticalAlign: 'center', bold: false, italic: false, underline: false, opacity: 1, zIndex: 1, textDirection: 'ltr' }
  ],
  imageBoxes: [],
  backgroundType: 'transparent'
});

const createAnnouncementSlide = (): Slide => ({
  id: generateId(),
  order: 0,
  textBoxes: [
    { id: generateId(), text: 'Announcement Title', x: 10, y: 10, width: 80, height: 20, fontSize: 160, color: '#ffffff', backgroundColor: 'transparent', textAlign: 'center', verticalAlign: 'center', bold: true, italic: false, underline: false, opacity: 1, zIndex: 2, textDirection: 'ltr' },
    { id: generateId(), text: 'Details and information go here...', x: 10, y: 40, width: 80, height: 40, fontSize: 80, color: '#ffffff', backgroundColor: 'transparent', textAlign: 'center', verticalAlign: 'top', bold: false, italic: false, underline: false, opacity: 1, zIndex: 1, textDirection: 'ltr' }
  ],
  imageBoxes: [],
  backgroundType: 'transparent'
});

const getTemplateSlide = (templateId: string | null): Slide => {
  switch (templateId) {
    case 'sermon': return createSermonSlide();
    case 'prayer': return createPrayerSlide();
    case 'announcements': return createAnnouncementSlide();
    default: return createDefaultSlide();
  }
};

// Quick Mode data interface
interface QuickModeBibleRef {
  book: string;
  chapter: number;
  verseStart: number;
  verseEnd?: number;
  hebrewText: string;
  englishText: string;
  reference: string;
  hebrewReference: string; // Hebrew version of the reference (e.g., יוחנן ג׳:16)
  useHebrew?: boolean; // Whether to display Hebrew text in the presentation
}

interface QuickModeData {
  type: 'sermon' | 'prayer' | 'announcements';
  title: string;
  titleTranslation?: string; // English translation of Hebrew title
  subtitles: Array<{
    subtitle: string;
    subtitleTranslation?: string;
    description: string;
    descriptionTranslation?: string;
    bibleRef?: QuickModeBibleRef;
  }>;
  name: string;
  generateTranslation?: boolean;
}

// Check if text contains Hebrew characters
const containsHebrew = (text: string): boolean => /[\u0590-\u05FF]/.test(text);

// Generate slides from Quick Mode data with bilingual template support
const createQuickModeSlides = (data: QuickModeData): Slide[] => {
  const backgroundColor = data.type === 'sermon' ? '#1a1a2e' :
                          data.type === 'prayer' ? '#000000' : '#2d1f3d';

  // Check if we need bilingual layout (generateTranslation is true)
  const isBilingual = data.generateTranslation || false;

  return data.subtitles.map((item, index) => {
    const subtitlePrefix = data.type === 'sermon' ? `${index + 1}. ` :
                           data.type === 'prayer' ? '• ' : '';

    const hasBibleRef = !!item.bibleRef;
    const textBoxes: TextBox[] = [];

    // Detect if subtitle is Hebrew
    const subtitleIsHebrew = containsHebrew(item.subtitle);
    const titleIsHebrew = containsHebrew(data.title);

    if (isBilingual) {
      // ========== BILINGUAL LAYOUT ==========
      // Left side: English (x: 2%, width: 46%)
      // Right side: Hebrew (x: 52%, width: 46%)

      // Vertical positions
      const titleY = 4;
      const subtitleY = 14;
      const bibleRefY = 24;
      const bibleTextY = 32;

      // === LEFT SIDE (ENGLISH) ===

      // English Title
      textBoxes.push({
        id: generateId(),
        text: titleIsHebrew ? (data.titleTranslation || '[Title Translation]') : data.title,
        x: 2,
        y: titleY,
        width: 46,
        height: 10,
        fontSize: 120,
        color: '#ffffff',
        backgroundColor: 'transparent',
        textAlign: 'left',
        verticalAlign: 'center',
        bold: true,
        italic: false,
        underline: false,
        opacity: 1,
        zIndex: 10,
        textDirection: 'ltr'
      });

      // English Subtitle
      textBoxes.push({
        id: generateId(),
        text: subtitleIsHebrew
          ? (item.subtitleTranslation || `${subtitlePrefix}[Translation]`)
          : `${subtitlePrefix}${item.subtitle}`,
        x: 2,
        y: subtitleY,
        width: 46,
        height: 8,
        fontSize: 90,
        color: '#ffffff',
        backgroundColor: 'transparent',
        textAlign: 'left',
        verticalAlign: 'center',
        bold: false,
        italic: false,
        underline: false,
        opacity: 1,
        zIndex: 9,
        textDirection: 'ltr'
      });

      // English Bible reference
      if (hasBibleRef && item.bibleRef) {
        textBoxes.push({
          id: generateId(),
          text: `📖 ${item.bibleRef.reference}`,
          x: 2,
          y: bibleRefY,
          width: 46,
          height: 5,
          fontSize: 55,
          color: '#00d4ff',
          backgroundColor: 'transparent',
          textAlign: 'left',
          verticalAlign: 'center',
          bold: true,
          italic: false,
          underline: false,
          opacity: 1,
          zIndex: 8,
          textDirection: 'ltr'
        });

        // English Bible passage
        textBoxes.push({
          id: generateId(),
          text: item.bibleRef.englishText || item.bibleRef.hebrewText || '',
          x: 2,
          y: bibleTextY,
          width: 46,
          height: 60,
          fontSize: 55,
          color: 'rgba(255,255,255,0.9)',
          backgroundColor: 'transparent',
          textAlign: 'left',
          verticalAlign: 'top',
          bold: false,
          italic: true,
          underline: false,
          opacity: 1,
          zIndex: 7,
          textDirection: 'ltr'
        });
      }

      // === RIGHT SIDE (HEBREW) ===

      // Hebrew Title (original Hebrew, or same as English if not Hebrew)
      textBoxes.push({
        id: generateId(),
        text: data.title,
        x: 52,
        y: titleY,
        width: 46,
        height: 10,
        fontSize: 120,
        color: '#ffffff',
        backgroundColor: 'transparent',
        textAlign: 'right',
        verticalAlign: 'center',
        bold: true,
        italic: false,
        underline: false,
        opacity: 1,
        zIndex: 10,
        textDirection: 'rtl'
      });

      // Hebrew Subtitle
      textBoxes.push({
        id: generateId(),
        text: subtitleIsHebrew
          ? `${subtitlePrefix}${item.subtitle}`
          : (item.subtitleTranslation || `${subtitlePrefix}${item.subtitle}`),
        x: 52,
        y: subtitleY,
        width: 46,
        height: 8,
        fontSize: 90,
        color: '#ffffff',
        backgroundColor: 'transparent',
        textAlign: 'right',
        verticalAlign: 'center',
        bold: false,
        italic: false,
        underline: false,
        opacity: 1,
        zIndex: 9,
        textDirection: 'rtl'
      });

      // Hebrew Bible reference
      if (hasBibleRef && item.bibleRef) {
        textBoxes.push({
          id: generateId(),
          text: `📖 ${item.bibleRef.hebrewReference || item.bibleRef.reference}`,
          x: 52,
          y: bibleRefY,
          width: 46,
          height: 5,
          fontSize: 55,
          color: '#00d4ff',
          backgroundColor: 'transparent',
          textAlign: 'right',
          verticalAlign: 'center',
          bold: true,
          italic: false,
          underline: false,
          opacity: 1,
          zIndex: 8,
          textDirection: 'rtl'
        });

        // Hebrew Bible passage
        textBoxes.push({
          id: generateId(),
          text: item.bibleRef.hebrewText || item.bibleRef.englishText || '',
          x: 52,
          y: bibleTextY,
          width: 46,
          height: 60,
          fontSize: 55,
          color: 'rgba(255,255,255,0.9)',
          backgroundColor: 'transparent',
          textAlign: 'right',
          verticalAlign: 'top',
          bold: false,
          italic: false,
          underline: false,
          opacity: 1,
          zIndex: 7,
          textDirection: 'rtl'
        });
      }
    } else {
      // ========== SINGLE LANGUAGE LAYOUT (Original behavior) ==========
      const hasDescription = item.description.trim().length > 0;

      // Adjust vertical positions based on content
      let subtitleY = 30;
      let descriptionY = 55;
      let bibleRefY = hasDescription ? 75 : 55;
      let bibleTextY = hasDescription ? 82 : 62;

      // If no description but has Bible ref, adjust positions
      if (!hasDescription && hasBibleRef) {
        bibleRefY = 50;
        bibleTextY = 58;
      }

      // Determine text direction based on content
      const useRTL = subtitleIsHebrew;

      // Main title
      textBoxes.push({
        id: generateId(),
        text: data.title,
        x: 5,
        y: 5,
        width: 90,
        height: 15,
        fontSize: 140,
        color: '#ffffff',
        backgroundColor: 'transparent',
        textAlign: useRTL ? 'right' : 'left',
        verticalAlign: 'center',
        bold: true,
        italic: false,
        underline: false,
        opacity: 1,
        zIndex: 5,
        textDirection: useRTL ? 'rtl' : 'ltr'
      });

      // Subtitle
      textBoxes.push({
        id: generateId(),
        text: `${subtitlePrefix}${item.subtitle}`,
        x: 5,
        y: subtitleY,
        width: 90,
        height: 18,
        fontSize: 110,
        color: '#ffffff',
        backgroundColor: 'transparent',
        textAlign: useRTL ? 'right' : (data.type === 'announcements' ? 'center' : 'left'),
        verticalAlign: 'center',
        bold: false,
        italic: false,
        underline: false,
        opacity: 1,
        zIndex: 4,
        textDirection: useRTL ? 'rtl' : 'ltr'
      });

      // Description
      if (hasDescription) {
        textBoxes.push({
          id: generateId(),
          text: item.description,
          x: 5,
          y: descriptionY,
          width: 90,
          height: hasBibleRef ? 18 : 35,
          fontSize: 80,
          color: 'rgba(255,255,255,0.85)',
          backgroundColor: 'transparent',
          textAlign: useRTL ? 'right' : (data.type === 'announcements' ? 'center' : 'left'),
          verticalAlign: 'top',
          bold: false,
          italic: false,
          underline: false,
          opacity: 1,
          zIndex: 3,
          textDirection: useRTL ? 'rtl' : 'ltr'
        });
      }

      // Bible reference
      if (hasBibleRef && item.bibleRef) {
        const bibleUseHebrew = item.bibleRef.useHebrew || false;
        const displayText = bibleUseHebrew
          ? (item.bibleRef.hebrewText || item.bibleRef.englishText || '')
          : (item.bibleRef.englishText || item.bibleRef.hebrewText || '');
        const displayReference = bibleUseHebrew
          ? (item.bibleRef.hebrewReference || item.bibleRef.reference)
          : item.bibleRef.reference;

        textBoxes.push({
          id: generateId(),
          text: `📖 ${displayReference}`,
          x: 5,
          y: bibleRefY,
          width: 90,
          height: 6,
          fontSize: 60,
          color: '#00d4ff',
          backgroundColor: 'transparent',
          textAlign: bibleUseHebrew ? 'right' : 'left',
          verticalAlign: 'center',
          bold: true,
          italic: false,
          underline: false,
          opacity: 1,
          zIndex: 2,
          textDirection: bibleUseHebrew ? 'rtl' : 'ltr'
        });

        textBoxes.push({
          id: generateId(),
          text: displayText,
          x: 5,
          y: bibleTextY,
          width: 90,
          height: 18,
          fontSize: 65,
          color: 'rgba(255,255,255,0.9)',
          backgroundColor: 'transparent',
          textAlign: bibleUseHebrew ? 'right' : 'left',
          verticalAlign: 'top',
          bold: false,
          italic: !bibleUseHebrew,
          underline: false,
          opacity: 1,
          zIndex: 1,
          textDirection: bibleUseHebrew ? 'rtl' : 'ltr'
        });
      }
    }

    return {
      id: generateId(),
      order: index,
      textBoxes,
      imageBoxes: [],
      backgroundColor
    };
  });
};

const PresentationEditorPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const presentationId = searchParams.get('id');
  const locationState = location.state as { template?: string; quickModeData?: QuickModeData } | null;
  const templateId = locationState?.template || null;
  const quickModeData = locationState?.quickModeData || null;

  const [presentation, setPresentation] = useState<Presentation>(() => {
    // Quick Mode: generate multiple slides from wizard data
    if (templateId === 'quickMode' && quickModeData) {
      return {
        id: '',
        title: quickModeData.name,
        slides: createQuickModeSlides(quickModeData),
        canvasDimensions: { width: 1920, height: 1080 },
        createdAt: '',
        updatedAt: '',
        // Store Quick Mode metadata for prayer theme rendering
        quickModeData: {
          type: quickModeData.type,
          title: quickModeData.title,
          titleTranslation: quickModeData.titleTranslation,
          subtitles: quickModeData.subtitles.map(s => ({
            subtitle: s.subtitle,
            subtitleTranslation: s.subtitleTranslation,
            description: s.description,
            descriptionTranslation: s.descriptionTranslation,
            bibleRef: s.bibleRef
          }))
        }
      };
    }

    // Regular template: single slide
    return {
      id: '',
      title: 'New Presentation',
      slides: [getTemplateSlide(templateId)],
      canvasDimensions: { width: 1920, height: 1080 },
      createdAt: '',
      updatedAt: ''
    };
  });

  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [selectedTextBoxId, setSelectedTextBoxId] = useState<string | null>(null);
  const [selectedImageBoxId, setSelectedImageBoxId] = useState<string | null>(null);
  const [selectedBackgroundBoxId, setSelectedBackgroundBoxId] = useState<string | null>(null);
  const [editingTextBoxId, setEditingTextBoxId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [hasChanges, setHasChanges] = useState(false);
  const [draggedLayerId, setDraggedLayerId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'after' | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [propertiesTab, setPropertiesTab] = useState<'element' | 'slide' | 'layers'>('element');
  const [measuredHeights, setMeasuredHeights] = useState<Record<string, number>>({});
  const [flowCalculatedY, setFlowCalculatedY] = useState<Record<string, number>>({});
  // Track if translations are complete (or not needed)
  const [translationsReady, setTranslationsReady] = useState(!quickModeData?.generateTranslation);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [canvasDims, setCanvasDims] = useState({ width: 800, height: 450 });
  const [activeSnapGuides, setActiveSnapGuides] = useState<SnapGuide[]>([]);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const hasAutoSavedRef = useRef(false); // Prevent duplicate auto-saves in StrictMode

  const currentSlide = presentation.slides[currentSlideIndex];
  const selectedTextBox = currentSlide?.textBoxes.find(tb => tb.id === selectedTextBoxId);
  const selectedImageBox = currentSlide?.imageBoxes?.find(ib => ib.id === selectedImageBoxId);
  const selectedBackgroundBox = currentSlide?.backgroundBoxes?.find(bb => bb.id === selectedBackgroundBoxId);

  // Update canvas dimensions on resize
  useEffect(() => {
    const updateCanvasDims = () => {
      if (canvasRef.current) {
        setCanvasDims({
          width: canvasRef.current.clientWidth,
          height: canvasRef.current.clientHeight
        });
      }
    };

    // Set up ResizeObserver
    const resizeObserver = new ResizeObserver(updateCanvasDims);

    // Use requestAnimationFrame to ensure canvas is rendered
    const frameId = requestAnimationFrame(() => {
      updateCanvasDims();
      if (canvasRef.current) {
        resizeObserver.observe(canvasRef.current);
      }
    });

    // Also listen to window resize
    window.addEventListener('resize', updateCanvasDims);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateCanvasDims);
    };
  }, []);

  // Load presentation if editing existing
  useEffect(() => {
    if (presentationId) {
      window.electronAPI.getPresentation(presentationId).then((loaded: Presentation | null) => {
        if (loaded) {
          setPresentation(loaded);
        }
      }).catch((error) => {
        console.error('Failed to load presentation:', error);
      });
    }
  }, [presentationId]);

  // Generate translations for Quick Mode if enabled
  useEffect(() => {
    const generateTranslations = async () => {
      if (!quickModeData?.generateTranslation || templateId !== 'quickMode') return;

      setIsTranslating(true);

      try {
        // Translate title if Hebrew
        let translatedTitle = quickModeData.title;
        if (containsHebrew(quickModeData.title)) {
          const titleTranslation = await window.electronAPI.translate(quickModeData.title);
          if (titleTranslation && titleTranslation !== quickModeData.title) {
            translatedTitle = titleTranslation;
          }
        }

        // Translate each subtitle
        const translatedSubtitles = await Promise.all(
          quickModeData.subtitles.map(async (item) => {
            let subtitleTranslation: string | undefined;
            let descriptionTranslation: string | undefined;

            if (containsHebrew(item.subtitle)) {
              const translation = await window.electronAPI.translate(item.subtitle);
              if (translation && translation !== item.subtitle) {
                subtitleTranslation = translation;
              }
            }

            if (item.description && containsHebrew(item.description)) {
              const translation = await window.electronAPI.translate(item.description);
              if (translation && translation !== item.description) {
                descriptionTranslation = translation;
              }
            }

            return {
              ...item,
              subtitleTranslation,
              descriptionTranslation
            };
          })
        );

        // Recreate slides with translations
        const updatedData: QuickModeData = {
          ...quickModeData,
          titleTranslation: translatedTitle !== quickModeData.title ? translatedTitle : undefined,
          subtitles: translatedSubtitles
        };

        const newSlides = createQuickModeSlides(updatedData);

        // Update presentation with translated slides AND quickModeData
        setPresentation(prev => ({
          ...prev,
          slides: newSlides,
          quickModeData: {
            type: updatedData.type,
            title: updatedData.title,
            titleTranslation: updatedData.titleTranslation,
            subtitles: translatedSubtitles.map(s => ({
              subtitle: s.subtitle,
              subtitleTranslation: s.subtitleTranslation,
              description: s.description,
              descriptionTranslation: s.descriptionTranslation,
              bibleRef: s.bibleRef
            }))
          }
        }));
      } catch (error) {
        console.error('Failed to generate translations:', error);
      } finally {
        setIsTranslating(false);
        setTranslationsReady(true);
      }
    };

    generateTranslations();
  }, []); // Run once on mount

  // Auto-save new presentations from templates (including Quick Mode)
  // Wait for translations to complete before saving
  useEffect(() => {
    const autoSaveNewPresentation = async () => {
      // Prevent duplicate saves in React StrictMode (which runs effects twice)
      if (hasAutoSavedRef.current) return;

      // Wait for translations to be ready before saving
      if (!translationsReady) return;

      // Only auto-save if this is a new presentation from a template
      if (!presentationId && templateId && presentation.slides.length > 0) {
        hasAutoSavedRef.current = true; // Mark as saving immediately
        try {
          const data = {
            title: presentation.title,
            slides: presentation.slides,
            canvasDimensions: presentation.canvasDimensions,
            quickModeData: presentation.quickModeData
          };
          const created = await window.electronAPI.createPresentation(data);
          if (created) {
            setPresentation(prev => ({
              ...prev,
              id: created.id,
              createdAt: created.createdAt,
              updatedAt: created.updatedAt
            }));
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 1500);
          }
        } catch (error) {
          console.error('Auto-save failed:', error);
          hasAutoSavedRef.current = false; // Reset on error so it can retry
        }
      }
    };

    autoSaveNewPresentation();
  }, [translationsReady, presentation.slides, presentation.quickModeData]); // Re-run when translations complete

  // Update a text box
  const updateTextBox = useCallback((textBoxId: string, updates: Partial<TextBox>) => {
    setPresentation(prev => ({
      ...prev,
      slides: prev.slides.map((slide, idx) =>
        idx === currentSlideIndex
          ? {
              ...slide,
              textBoxes: slide.textBoxes.map(tb =>
                tb.id === textBoxId ? { ...tb, ...updates } : tb
              )
            }
          : slide
      )
    }));
    setHasChanges(true);
  }, [currentSlideIndex]);

  // Add a new text box
  const addTextBox = useCallback(() => {
    const currentSlide = presentation.slides[currentSlideIndex];
    const nextZIndex = getMaxZIndex(currentSlide) + 1;
    const newTextBox = createDefaultTextBox(nextZIndex);
    setPresentation(prev => ({
      ...prev,
      slides: prev.slides.map((slide, idx) =>
        idx === currentSlideIndex
          ? { ...slide, textBoxes: [...slide.textBoxes, newTextBox] }
          : slide
      )
    }));
    setSelectedTextBoxId(newTextBox.id);
    setSelectedImageBoxId(null);
    setHasChanges(true);
  }, [currentSlideIndex, presentation.slides]);

  // Delete a text box
  const deleteTextBox = useCallback((textBoxId: string) => {
    setPresentation(prev => ({
      ...prev,
      slides: prev.slides.map((slide, idx) =>
        idx === currentSlideIndex
          ? { ...slide, textBoxes: slide.textBoxes.filter(tb => tb.id !== textBoxId) }
          : slide
      )
    }));
    if (selectedTextBoxId === textBoxId) {
      setSelectedTextBoxId(null);
    }
    setHasChanges(true);
  }, [currentSlideIndex, selectedTextBoxId]);

  // Update an image box
  const updateImageBox = useCallback((imageBoxId: string, updates: Partial<ImageBox>) => {
    setPresentation(prev => ({
      ...prev,
      slides: prev.slides.map((slide, idx) =>
        idx === currentSlideIndex
          ? {
              ...slide,
              imageBoxes: (slide.imageBoxes || []).map(ib =>
                ib.id === imageBoxId ? { ...ib, ...updates } : ib
              )
            }
          : slide
      )
    }));
    setHasChanges(true);
  }, [currentSlideIndex]);

  // Add a new image box
  const addImageBox = useCallback((src: string) => {
    const currentSlide = presentation.slides[currentSlideIndex];
    const nextZIndex = getMaxZIndex(currentSlide) + 1;
    const newImageBox = createDefaultImageBox(src, nextZIndex);
    setPresentation(prev => ({
      ...prev,
      slides: prev.slides.map((slide, idx) =>
        idx === currentSlideIndex
          ? { ...slide, imageBoxes: [...(slide.imageBoxes || []), newImageBox] }
          : slide
      )
    }));
    setSelectedTextBoxId(null);
    setSelectedImageBoxId(newImageBox.id);
    setHasChanges(true);
  }, [currentSlideIndex, presentation.slides]);

  // Delete an image box
  const deleteImageBox = useCallback((imageBoxId: string) => {
    setPresentation(prev => ({
      ...prev,
      slides: prev.slides.map((slide, idx) =>
        idx === currentSlideIndex
          ? { ...slide, imageBoxes: (slide.imageBoxes || []).filter(ib => ib.id !== imageBoxId) }
          : slide
      )
    }));
    if (selectedImageBoxId === imageBoxId) {
      setSelectedImageBoxId(null);
    }
    setHasChanges(true);
  }, [currentSlideIndex, selectedImageBoxId]);

  // Update a background box
  const updateBackgroundBox = useCallback((boxId: string, updates: Partial<PresentationBackgroundBox>) => {
    setPresentation(prev => ({
      ...prev,
      slides: prev.slides.map((slide, idx) =>
        idx === currentSlideIndex
          ? {
              ...slide,
              backgroundBoxes: (slide.backgroundBoxes || []).map(bb =>
                bb.id === boxId ? { ...bb, ...updates } : bb
              )
            }
          : slide
      )
    }));
    setHasChanges(true);
  }, [currentSlideIndex]);

  // Add a new background box
  const addBackgroundBox = useCallback(() => {
    const currentSlide = presentation.slides[currentSlideIndex];
    // Background boxes typically go behind everything (lowest zIndex)
    const minZ = Math.min(0, ...currentSlide.textBoxes.map(tb => tb.zIndex ?? 0), ...(currentSlide.imageBoxes || []).map(ib => ib.zIndex ?? 0), ...(currentSlide.backgroundBoxes || []).map(bb => bb.zIndex ?? 0));
    const newBox = createDefaultBackgroundBox(minZ - 1);
    setPresentation(prev => ({
      ...prev,
      slides: prev.slides.map((slide, idx) =>
        idx === currentSlideIndex
          ? { ...slide, backgroundBoxes: [...(slide.backgroundBoxes || []), newBox] }
          : slide
      )
    }));
    setSelectedTextBoxId(null);
    setSelectedImageBoxId(null);
    setSelectedBackgroundBoxId(newBox.id);
    setHasChanges(true);
  }, [currentSlideIndex, presentation.slides]);

  // Delete a background box
  const deleteBackgroundBox = useCallback((boxId: string) => {
    setPresentation(prev => ({
      ...prev,
      slides: prev.slides.map((slide, idx) =>
        idx === currentSlideIndex
          ? { ...slide, backgroundBoxes: (slide.backgroundBoxes || []).filter(bb => bb.id !== boxId) }
          : slide
      )
    }));
    if (selectedBackgroundBoxId === boxId) {
      setSelectedBackgroundBoxId(null);
    }
    setHasChanges(true);
  }, [currentSlideIndex, selectedBackgroundBoxId]);

  // Toggle layer visibility
  const toggleLayerVisibility = useCallback((layerId: string, layerType: 'text' | 'image' | 'background') => {
    setPresentation(prev => ({
      ...prev,
      slides: prev.slides.map((slide, idx) => {
        if (idx !== currentSlideIndex) return slide;

        if (layerType === 'text') {
          return {
            ...slide,
            textBoxes: slide.textBoxes.map(tb =>
              tb.id === layerId ? { ...tb, visible: !(tb.visible ?? true) } : tb
            )
          };
        } else if (layerType === 'image') {
          return {
            ...slide,
            imageBoxes: (slide.imageBoxes || []).map(ib =>
              ib.id === layerId ? { ...ib, visible: !(ib.visible ?? true) } : ib
            )
          };
        } else {
          return {
            ...slide,
            backgroundBoxes: (slide.backgroundBoxes || []).map(bb =>
              bb.id === layerId ? { ...bb, visible: !(bb.visible ?? true) } : bb
            )
          };
        }
      })
    }));
    setHasChanges(true);
  }, [currentSlideIndex]);

  // Get all layers sorted by zIndex (highest first = front)
  // Uses stable sort with ID as tiebreaker for consistent ordering
  const getLayers = useCallback((): Layer[] => {
    const slide = presentation.slides[currentSlideIndex];
    if (!slide) return [];

    const textLayers: Layer[] = slide.textBoxes.map(tb => ({
      id: tb.id,
      type: 'text' as const,
      name: tb.text.substring(0, 20) || 'Text',
      zIndex: tb.zIndex ?? 0,
      visible: tb.visible ?? true
    }));

    const imageLayers: Layer[] = (slide.imageBoxes || []).map(ib => ({
      id: ib.id,
      type: 'image' as const,
      name: 'Image',
      zIndex: ib.zIndex ?? 0,
      visible: ib.visible ?? true
    }));

    const backgroundLayers: Layer[] = (slide.backgroundBoxes || []).map(bb => ({
      id: bb.id,
      type: 'background' as const,
      name: 'Background Box',
      zIndex: bb.zIndex ?? 0,
      visible: bb.visible ?? true
    }));

    // Sort by zIndex (descending), with ID as stable tiebreaker
    return [...textLayers, ...imageLayers, ...backgroundLayers].sort((a, b) => {
      if (b.zIndex !== a.zIndex) return b.zIndex - a.zIndex;
      return a.id.localeCompare(b.id); // Stable tiebreaker
    });
  }, [presentation.slides, currentSlideIndex]);

  // Move layer up (increase zIndex)
  const moveLayerUp = useCallback((layerId: string, layerType: 'text' | 'image' | 'background') => {
    const layers = getLayers();
    const currentIndex = layers.findIndex(l => l.id === layerId);
    if (currentIndex <= 0) return; // Already at top

    const targetLayer = layers[currentIndex - 1]; // Layer above
    const currentLayer = layers[currentIndex];

    // Calculate new zIndex values - ensure they're different after swap
    // If both have same zIndex, give the moving-up layer a higher value
    let newCurrentZ = targetLayer.zIndex;
    let newTargetZ = currentLayer.zIndex;
    if (newCurrentZ === newTargetZ) {
      newCurrentZ = newTargetZ + 1;
    }

    // Swap zIndex values
    setPresentation(prev => ({
      ...prev,
      slides: prev.slides.map((slide, idx) => {
        if (idx !== currentSlideIndex) return slide;

        const newTextBoxes = slide.textBoxes.map(tb => {
          if (tb.id === currentLayer.id) return { ...tb, zIndex: newCurrentZ };
          if (tb.id === targetLayer.id) return { ...tb, zIndex: newTargetZ };
          return tb;
        });

        const newImageBoxes = (slide.imageBoxes || []).map(ib => {
          if (ib.id === currentLayer.id) return { ...ib, zIndex: newCurrentZ };
          if (ib.id === targetLayer.id) return { ...ib, zIndex: newTargetZ };
          return ib;
        });

        const newBackgroundBoxes = (slide.backgroundBoxes || []).map(bb => {
          if (bb.id === currentLayer.id) return { ...bb, zIndex: newCurrentZ };
          if (bb.id === targetLayer.id) return { ...bb, zIndex: newTargetZ };
          return bb;
        });

        return { ...slide, textBoxes: newTextBoxes, imageBoxes: newImageBoxes, backgroundBoxes: newBackgroundBoxes };
      })
    }));
    setHasChanges(true);
  }, [getLayers, currentSlideIndex]);

  // Move layer down (decrease zIndex)
  const moveLayerDown = useCallback((layerId: string, layerType: 'text' | 'image' | 'background') => {
    const layers = getLayers();
    const currentIndex = layers.findIndex(l => l.id === layerId);
    if (currentIndex >= layers.length - 1) return; // Already at bottom

    const targetLayer = layers[currentIndex + 1]; // Layer below
    const currentLayer = layers[currentIndex];

    // Swap zIndex values - ensure different values when equal
    let newCurrentZ = targetLayer.zIndex;
    let newTargetZ = currentLayer.zIndex;
    if (newCurrentZ === newTargetZ) {
      // Moving down means going behind, so current gets lower value
      newCurrentZ = newTargetZ - 1;
    }

    setPresentation(prev => ({
      ...prev,
      slides: prev.slides.map((slide, idx) => {
        if (idx !== currentSlideIndex) return slide;

        const newTextBoxes = slide.textBoxes.map(tb => {
          if (tb.id === currentLayer.id) return { ...tb, zIndex: newCurrentZ };
          if (tb.id === targetLayer.id) return { ...tb, zIndex: newTargetZ };
          return tb;
        });

        const newImageBoxes = (slide.imageBoxes || []).map(ib => {
          if (ib.id === currentLayer.id) return { ...ib, zIndex: newCurrentZ };
          if (ib.id === targetLayer.id) return { ...ib, zIndex: newTargetZ };
          return ib;
        });

        const newBackgroundBoxes = (slide.backgroundBoxes || []).map(bb => {
          if (bb.id === currentLayer.id) return { ...bb, zIndex: newCurrentZ };
          if (bb.id === targetLayer.id) return { ...bb, zIndex: newTargetZ };
          return bb;
        });

        return { ...slide, textBoxes: newTextBoxes, imageBoxes: newImageBoxes, backgroundBoxes: newBackgroundBoxes };
      })
    }));
    setHasChanges(true);
  }, [getLayers, currentSlideIndex]);

  // Move layer to front (highest zIndex)
  const moveLayerToFront = useCallback((layerId: string, layerType: 'text' | 'image' | 'background') => {
    const slide = presentation.slides[currentSlideIndex];
    const maxZ = getMaxZIndex(slide);

    setPresentation(prev => ({
      ...prev,
      slides: prev.slides.map((s, idx) => {
        if (idx !== currentSlideIndex) return s;

        if (layerType === 'text') {
          return {
            ...s,
            textBoxes: s.textBoxes.map(tb =>
              tb.id === layerId ? { ...tb, zIndex: maxZ + 1 } : tb
            )
          };
        } else if (layerType === 'image') {
          return {
            ...s,
            imageBoxes: (s.imageBoxes || []).map(ib =>
              ib.id === layerId ? { ...ib, zIndex: maxZ + 1 } : ib
            )
          };
        } else {
          return {
            ...s,
            backgroundBoxes: (s.backgroundBoxes || []).map(bb =>
              bb.id === layerId ? { ...bb, zIndex: maxZ + 1 } : bb
            )
          };
        }
      })
    }));
    setHasChanges(true);
  }, [presentation.slides, currentSlideIndex]);

  // Move layer to back (lowest zIndex)
  const moveLayerToBack = useCallback((layerId: string, layerType: 'text' | 'image' | 'background') => {
    const slide = presentation.slides[currentSlideIndex];
    const allElements = [
      ...slide.textBoxes,
      ...(slide.imageBoxes || []),
      ...(slide.backgroundBoxes || [])
    ];
    const allZIndexes = allElements.map(e => e.zIndex ?? 0);
    const minZ = allZIndexes.length > 0 ? Math.min(...allZIndexes) : 0;

    setPresentation(prev => ({
      ...prev,
      slides: prev.slides.map((s, idx) => {
        if (idx !== currentSlideIndex) return s;

        if (layerType === 'text') {
          return {
            ...s,
            textBoxes: s.textBoxes.map(tb =>
              tb.id === layerId ? { ...tb, zIndex: minZ - 1 } : tb
            )
          };
        } else if (layerType === 'image') {
          return {
            ...s,
            imageBoxes: (s.imageBoxes || []).map(ib =>
              ib.id === layerId ? { ...ib, zIndex: minZ - 1 } : ib
            )
          };
        } else {
          return {
            ...s,
            backgroundBoxes: (s.backgroundBoxes || []).map(bb =>
              bb.id === layerId ? { ...bb, zIndex: minZ - 1 } : bb
            )
          };
        }
      })
    }));
    setHasChanges(true);
  }, [presentation.slides, currentSlideIndex]);

  // Reorder layers via drag-and-drop
  const reorderLayers = useCallback((draggedId: string, targetId: string, insertBefore: boolean) => {
    if (draggedId === targetId) return;

    const layers = getLayers();
    const draggedIndex = layers.findIndex(l => l.id === draggedId);
    const targetIndex = layers.findIndex(l => l.id === targetId);
    if (draggedIndex === -1 || targetIndex === -1) return;

    // Calculate new order: remove dragged, insert at target position
    const newOrder = layers.filter(l => l.id !== draggedId);
    const insertIndex = insertBefore ?
      newOrder.findIndex(l => l.id === targetId) :
      newOrder.findIndex(l => l.id === targetId) + 1;

    const draggedLayer = layers[draggedIndex];
    newOrder.splice(insertIndex, 0, draggedLayer);

    // Assign new zIndex values (highest first in the visual list)
    const zIndexMap: Record<string, number> = {};
    newOrder.forEach((layer, idx) => {
      zIndexMap[layer.id] = newOrder.length - idx;
    });

    // Update all elements with new zIndex values
    setPresentation(prev => ({
      ...prev,
      slides: prev.slides.map((slide, idx) => {
        if (idx !== currentSlideIndex) return slide;

        return {
          ...slide,
          textBoxes: slide.textBoxes.map(tb => ({
            ...tb,
            zIndex: zIndexMap[tb.id] ?? tb.zIndex ?? 0
          })),
          imageBoxes: (slide.imageBoxes || []).map(ib => ({
            ...ib,
            zIndex: zIndexMap[ib.id] ?? ib.zIndex ?? 0
          })),
          backgroundBoxes: (slide.backgroundBoxes || []).map(bb => ({
            ...bb,
            zIndex: zIndexMap[bb.id] ?? bb.zIndex ?? 0
          }))
        };
      })
    }));
    setHasChanges(true);
  }, [getLayers, currentSlideIndex]);

  // Handle image file selection (add new or replace selected)
  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      // If an image is selected, replace it; otherwise add new
      if (selectedImageBoxId) {
        updateImageBox(selectedImageBoxId, { src: dataUrl });
      } else {
        addImageBox(dataUrl);
      }
    };
    reader.readAsDataURL(file);

    // Reset input so the same file can be selected again
    e.target.value = '';
  }, [addImageBox, selectedImageBoxId, updateImageBox]);

  // Add a new slide
  const addSlide = useCallback(() => {
    const newSlide = createDefaultSlide();
    newSlide.order = presentation.slides.length;
    setPresentation(prev => ({
      ...prev,
      slides: [...prev.slides, newSlide]
    }));
    setCurrentSlideIndex(presentation.slides.length);
    setSelectedTextBoxId(null);
    setSelectedImageBoxId(null);
    setHasChanges(true);
  }, [presentation.slides.length]);

  // Delete current slide
  const deleteSlide = useCallback((index: number) => {
    if (presentation.slides.length <= 1) return; // Keep at least one slide
    setPresentation(prev => ({
      ...prev,
      slides: prev.slides.filter((_, idx) => idx !== index)
    }));
    if (currentSlideIndex >= presentation.slides.length - 1) {
      setCurrentSlideIndex(Math.max(0, currentSlideIndex - 1));
    }
    setSelectedTextBoxId(null);
    setSelectedImageBoxId(null);
    setHasChanges(true);
  }, [presentation.slides.length, currentSlideIndex]);

  // Drag-and-drop slide reordering
  const [dragSlideIndex, setDragSlideIndex] = useState<number | null>(null);
  const [dragOverSlideIndex, setDragOverSlideIndex] = useState<number | null>(null);

  const moveSlide = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setPresentation(prev => {
      const slides = [...prev.slides];
      const [moved] = slides.splice(fromIndex, 1);
      slides.splice(toIndex, 0, moved);
      return { ...prev, slides };
    });
    // Update current slide index to follow the moved slide
    if (currentSlideIndex === fromIndex) {
      setCurrentSlideIndex(toIndex);
    } else if (fromIndex < currentSlideIndex && toIndex >= currentSlideIndex) {
      setCurrentSlideIndex(currentSlideIndex - 1);
    } else if (fromIndex > currentSlideIndex && toIndex <= currentSlideIndex) {
      setCurrentSlideIndex(currentSlideIndex + 1);
    }
    setHasChanges(true);
  }, [currentSlideIndex]);

  // Duplicate slide
  const duplicateSlide = useCallback((index: number) => {
    const slideToDuplicate = presentation.slides[index];
    const newSlide: Slide = {
      ...slideToDuplicate,
      id: generateId(),
      order: presentation.slides.length,
      textBoxes: slideToDuplicate.textBoxes.map(tb => ({ ...tb, id: generateId() })),
      imageBoxes: slideToDuplicate.imageBoxes?.map(ib => ({ ...ib, id: generateId() })) || [],
      backgroundBoxes: slideToDuplicate.backgroundBoxes?.map(bb => ({ ...bb, id: generateId() })) || []
    };
    setPresentation(prev => ({
      ...prev,
      slides: [...prev.slides.slice(0, index + 1), newSlide, ...prev.slides.slice(index + 1)]
    }));
    setCurrentSlideIndex(index + 1);
    setHasChanges(true);
  }, [presentation.slides]);

  // Update slide background
  const updateSlideBackground = useCallback((value: string, type: 'color' | 'gradient' | 'transparent' = 'color') => {
    setPresentation(prev => ({
      ...prev,
      slides: prev.slides.map((slide, idx) => {
        if (idx !== currentSlideIndex) return slide;

        if (type === 'transparent') {
          return { ...slide, backgroundType: 'transparent', backgroundColor: undefined, backgroundGradient: undefined };
        } else if (type === 'gradient' || isGradient(value)) {
          return { ...slide, backgroundType: 'gradient', backgroundGradient: value, backgroundColor: undefined };
        } else {
          return { ...slide, backgroundType: 'color', backgroundColor: value, backgroundGradient: undefined };
        }
      })
    }));
    setHasChanges(true);
  }, [currentSlideIndex]);

  // Get the background style for a slide (for editor display - shows checkerboard for transparent)
  const getSlideBackgroundStyle = useCallback((slide: Slide): string => {
    if (slide.backgroundType === 'transparent') {
      // Checkerboard pattern for transparency (darkened)
      return 'repeating-conic-gradient(#2a2a2a 0% 25%, #1a1a1a 0% 50%) 50% / 16px 16px';
    } else if (slide.backgroundType === 'gradient' && slide.backgroundGradient) {
      return slide.backgroundGradient;
    } else {
      return slide.backgroundColor || '#1a1a2e';
    }
  }, []);

  // Get all element bounds for snap detection (excluding the current element)
  const getOtherElementBounds = useCallback((excludeId: string): ElementBounds[] => {
    if (!currentSlide) return [];
    const bounds: ElementBounds[] = [];

    // Add text boxes
    currentSlide.textBoxes.forEach(tb => {
      if (tb.id !== excludeId && tb.visible !== false) {
        bounds.push({ id: tb.id, x: tb.x, y: tb.y, width: tb.width, height: tb.height });
      }
    });

    // Add image boxes
    currentSlide.imageBoxes?.forEach(ib => {
      if (ib.id !== excludeId && ib.visible !== false) {
        bounds.push({ id: ib.id, x: ib.x, y: ib.y, width: ib.width, height: ib.height });
      }
    });

    // Add background boxes
    currentSlide.backgroundBoxes?.forEach(bb => {
      if (bb.id !== excludeId && bb.visible !== false) {
        bounds.push({ id: bb.id, x: bb.x, y: bb.y, width: bb.width, height: bb.height });
      }
    });

    return bounds;
  }, [currentSlide]);

  // Calculate snap guides and return snapped position
  const SNAP_THRESHOLD = 1.5; // percentage
  const calculateSnap = useCallback((
    elementId: string,
    currentX: number,
    currentY: number,
    currentWidth: number,
    currentHeight: number
  ): { x: number; y: number; guides: SnapGuide[] } => {
    const guides: SnapGuide[] = [];
    const otherElements = getOtherElementBounds(elementId);

    if (currentWidth <= 0 || currentHeight <= 0) {
      return { x: currentX, y: currentY, guides };
    }

    let bestSnapX: { value: number; distance: number; guide: SnapGuide } | null = null;
    let bestSnapY: { value: number; distance: number; guide: SnapGuide } | null = null;

    const trySnapX = (snappedValue: number, distance: number, guide: SnapGuide, priority: number) => {
      const adjustedDistance = distance + priority * 0.001;
      if (!bestSnapX || adjustedDistance < bestSnapX.distance) {
        bestSnapX = { value: snappedValue, distance: adjustedDistance, guide };
      }
    };

    const trySnapY = (snappedValue: number, distance: number, guide: SnapGuide, priority: number) => {
      const adjustedDistance = distance + priority * 0.001;
      if (!bestSnapY || adjustedDistance < bestSnapY.distance) {
        bestSnapY = { value: snappedValue, distance: adjustedDistance, guide };
      }
    };

    // Canvas center points
    const canvasCenterX = 50;
    const canvasCenterY = 50;

    // Current element edges and center
    const myLeft = currentX;
    const myRight = currentX + currentWidth;
    const myCenterX = currentX + currentWidth / 2;
    const myTop = currentY;
    const myBottom = currentY + currentHeight;
    const myCenterY = currentY + currentHeight / 2;

    // Priority 0: Canvas center (highest priority)
    const centerXDist = Math.abs(myCenterX - canvasCenterX);
    if (centerXDist < SNAP_THRESHOLD) {
      const snappedValue = canvasCenterX - currentWidth / 2;
      if (snappedValue >= 0 && snappedValue + currentWidth <= 100) {
        trySnapX(snappedValue, centerXDist, { type: 'vertical', position: canvasCenterX, label: 'center' }, 0);
      }
    }

    const centerYDist = Math.abs(myCenterY - canvasCenterY);
    if (centerYDist < SNAP_THRESHOLD) {
      const snappedValue = canvasCenterY - currentHeight / 2;
      if (snappedValue >= 0 && snappedValue + currentHeight <= 100) {
        trySnapY(snappedValue, centerYDist, { type: 'horizontal', position: canvasCenterY, label: 'center' }, 0);
      }
    }

    // Priority 1: Canvas edges
    if (Math.abs(myLeft) < SNAP_THRESHOLD) {
      trySnapX(0, Math.abs(myLeft), { type: 'vertical', position: 0, label: 'edge' }, 1);
    }
    if (Math.abs(myRight - 100) < SNAP_THRESHOLD && currentWidth <= 100) {
      trySnapX(100 - currentWidth, Math.abs(myRight - 100), { type: 'vertical', position: 100, label: 'edge' }, 1);
    }
    if (Math.abs(myTop) < SNAP_THRESHOLD) {
      trySnapY(0, Math.abs(myTop), { type: 'horizontal', position: 0, label: 'edge' }, 1);
    }
    if (Math.abs(myBottom - 100) < SNAP_THRESHOLD && currentHeight <= 100) {
      trySnapY(100 - currentHeight, Math.abs(myBottom - 100), { type: 'horizontal', position: 100, label: 'edge' }, 1);
    }

    // Priority 2: Element alignment
    for (const other of otherElements) {
      if (other.width <= 0 || other.height <= 0) continue;

      const otherLeft = other.x;
      const otherRight = other.x + other.width;
      const otherCenterX = other.x + other.width / 2;
      const otherTop = other.y;
      const otherBottom = other.y + other.height;
      const otherCenterY = other.y + other.height / 2;

      // Vertical alignment checks (X axis)
      if (Math.abs(myLeft - otherLeft) < SNAP_THRESHOLD) {
        trySnapX(otherLeft, Math.abs(myLeft - otherLeft), { type: 'vertical', position: otherLeft, label: 'align' }, 2);
      }
      if (Math.abs(myRight - otherRight) < SNAP_THRESHOLD) {
        const snappedValue = otherRight - currentWidth;
        if (snappedValue >= 0) {
          trySnapX(snappedValue, Math.abs(myRight - otherRight), { type: 'vertical', position: otherRight, label: 'align' }, 2);
        }
      }
      if (Math.abs(myCenterX - otherCenterX) < SNAP_THRESHOLD) {
        const snappedValue = otherCenterX - currentWidth / 2;
        if (snappedValue >= 0 && snappedValue + currentWidth <= 100) {
          trySnapX(snappedValue, Math.abs(myCenterX - otherCenterX), { type: 'vertical', position: otherCenterX, label: 'align' }, 2);
        }
      }
      if (Math.abs(myLeft - otherRight) < SNAP_THRESHOLD) {
        trySnapX(otherRight, Math.abs(myLeft - otherRight), { type: 'vertical', position: otherRight, label: 'align' }, 2);
      }
      if (Math.abs(myRight - otherLeft) < SNAP_THRESHOLD) {
        const snappedValue = otherLeft - currentWidth;
        if (snappedValue >= 0) {
          trySnapX(snappedValue, Math.abs(myRight - otherLeft), { type: 'vertical', position: otherLeft, label: 'align' }, 2);
        }
      }

      // Horizontal alignment checks (Y axis)
      if (Math.abs(myTop - otherTop) < SNAP_THRESHOLD) {
        trySnapY(otherTop, Math.abs(myTop - otherTop), { type: 'horizontal', position: otherTop, label: 'align' }, 2);
      }
      if (Math.abs(myBottom - otherBottom) < SNAP_THRESHOLD) {
        const snappedValue = otherBottom - currentHeight;
        if (snappedValue >= 0) {
          trySnapY(snappedValue, Math.abs(myBottom - otherBottom), { type: 'horizontal', position: otherBottom, label: 'align' }, 2);
        }
      }
      if (Math.abs(myCenterY - otherCenterY) < SNAP_THRESHOLD) {
        const snappedValue = otherCenterY - currentHeight / 2;
        if (snappedValue >= 0 && snappedValue + currentHeight <= 100) {
          trySnapY(snappedValue, Math.abs(myCenterY - otherCenterY), { type: 'horizontal', position: otherCenterY, label: 'align' }, 2);
        }
      }
      if (Math.abs(myTop - otherBottom) < SNAP_THRESHOLD) {
        trySnapY(otherBottom, Math.abs(myTop - otherBottom), { type: 'horizontal', position: otherBottom, label: 'align' }, 2);
      }
      if (Math.abs(myBottom - otherTop) < SNAP_THRESHOLD) {
        const snappedValue = otherTop - currentHeight;
        if (snappedValue >= 0) {
          trySnapY(snappedValue, Math.abs(myBottom - otherTop), { type: 'horizontal', position: otherTop, label: 'align' }, 2);
        }
      }
    }

    // Apply best snaps (type assertions needed because TypeScript doesn't track mutations through nested functions)
    type SnapResult = { value: number; distance: number; guide: SnapGuide } | null;
    const finalSnapX = bestSnapX as SnapResult;
    const finalSnapY = bestSnapY as SnapResult;
    const snappedX = finalSnapX ? finalSnapX.value : currentX;
    const snappedY = finalSnapY ? finalSnapY.value : currentY;

    if (finalSnapX) guides.push(finalSnapX.guide);
    if (finalSnapY) guides.push(finalSnapY.guide);

    return { x: snappedX, y: snappedY, guides };
  }, [getOtherElementBounds]);

  // Check if presentation is valid for saving
  const isValidPresentation = useCallback(() => {
    if (!presentation.title.trim()) return false;
    if (presentation.slides.length === 0) return false;
    // Check if at least one slide has content (text boxes, image boxes, or background boxes)
    const hasContent = presentation.slides.some(slide =>
      (slide.textBoxes && slide.textBoxes.length > 0) ||
      (slide.imageBoxes && slide.imageBoxes.length > 0) ||
      (slide.backgroundBoxes && slide.backgroundBoxes.length > 0)
    );
    return hasContent;
  }, [presentation.title, presentation.slides]);

  // Save presentation
  const handleSave = async () => {
    if (!presentation.title.trim()) {
      alert('Please enter a presentation title');
      return;
    }
    if (presentation.slides.length === 0 || !isValidPresentation()) {
      alert('Please add at least one slide with content');
      return;
    }
    setSaveStatus('saving');
    try {
      const data = {
        title: presentation.title,
        slides: presentation.slides,
        canvasDimensions: presentation.canvasDimensions,
        quickModeData: presentation.quickModeData
      };

      if (presentation.id) {
        await window.electronAPI.updatePresentation(presentation.id, data);
      } else {
        const created = await window.electronAPI.createPresentation(data);
        if (created && created.id) {
          setPresentation(prev => ({ ...prev, id: created.id }));
        } else {
          throw new Error('No presentation returned from create');
        }
      }
      setHasChanges(false);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error: any) {
      console.error('Failed to save presentation:', error);
      alert('Failed to save presentation: ' + (error?.message || String(error)));
      setSaveStatus('idle');
    }
  };

  // Handle back navigation
  const handleBack = () => {
    if (hasChanges && !confirm('You have unsaved changes. Discard?')) {
      return;
    }
    // Pass the presentation ID so ControlPanel can select it
    navigate('/', { state: { activeTab: 'presentations', editedPresentationId: presentation.id } });
  };

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      color: 'white'
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(0,0,0,0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={handleBack}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'transparent',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            ← Back
          </button>
          <input
            type="text"
            value={presentation.title}
            onChange={(e) => {
              setPresentation(prev => ({ ...prev, title: e.target.value }));
              setHasChanges(true);
            }}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(0,0,0,0.3)',
              color: 'white',
              fontSize: '16px',
              fontWeight: 600,
              width: '300px'
            }}
            placeholder="Presentation Title"
          />
          {hasChanges && (
            <span style={{ fontSize: '12px', color: '#ffc107' }}>● Unsaved changes</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={addTextBox}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'transparent',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            + Add Text
          </button>
          <button
            onClick={() => imageInputRef.current?.click()}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'transparent',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            + Add Image
          </button>
          <button
            onClick={addBackgroundBox}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'transparent',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            + Add Box
          </button>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            style={{ display: 'none' }}
          />
          {(hasChanges || saveStatus !== 'idle') && (
            <button
              onClick={handleSave}
              disabled={saveStatus !== 'idle' || !isValidPresentation()}
              style={{
                padding: '10px 24px',
                borderRadius: '6px',
                border: 'none',
                background: saveStatus === 'saved' ? '#28a745' : (!isValidPresentation() ? 'rgba(255,255,255,0.2)' : '#00d4ff'),
                color: saveStatus === 'saved' ? 'white' : (!isValidPresentation() ? 'rgba(255,255,255,0.5)' : 'black'),
                cursor: (saveStatus !== 'idle' || !isValidPresentation()) ? 'not-allowed' : 'pointer',
                fontWeight: 600
              }}
            >
              {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved ✓' : 'Save'}
            </button>
          )}
          {isTranslating && (
            <span style={{
              padding: '10px 16px',
              color: '#00d4ff',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span style={{
                width: '12px',
                height: '12px',
                border: '2px solid rgba(0,212,255,0.3)',
                borderTopColor: '#00d4ff',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              Translating...
            </span>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left Panel - Slides Thumbnails */}
        <div style={{
          width: '180px',
          borderRight: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(0,0,0,0.2)',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          overflowY: 'auto'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px'
          }}>
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase' }}>
              Slides
            </span>
            <button
              onClick={addSlide}
              style={{
                padding: '4px 8px',
                borderRadius: '4px',
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'transparent',
                color: 'white',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              +
            </button>
          </div>

          {presentation.slides.map((slide, index) => (
            <div
              key={slide.id}
              draggable
              onDragStart={(e) => {
                setDragSlideIndex(index);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setDragOverSlideIndex(index);
              }}
              onDragLeave={() => {
                setDragOverSlideIndex(prev => prev === index ? null : prev);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragSlideIndex !== null && dragSlideIndex !== index) {
                  moveSlide(dragSlideIndex, index);
                }
                setDragSlideIndex(null);
                setDragOverSlideIndex(null);
              }}
              onDragEnd={() => {
                setDragSlideIndex(null);
                setDragOverSlideIndex(null);
              }}
              onClick={() => {
                setCurrentSlideIndex(index);
                setSelectedTextBoxId(null);
                setSelectedImageBoxId(null);
                setSelectedBackgroundBoxId(null);
              }}
              style={{
                position: 'relative',
                aspectRatio: '16/9',
                borderRadius: '6px',
                border: dragOverSlideIndex === index && dragSlideIndex !== index
                  ? '2px solid #ffc107'
                  : currentSlideIndex === index ? '2px solid #00d4ff' : '1px solid rgba(255,255,255,0.2)',
                background: getSlideBackgroundStyle(slide),
                cursor: 'grab',
                overflow: 'hidden',
                opacity: dragSlideIndex === index ? 0.4 : 1,
                transition: 'opacity 0.15s, border-color 0.15s'
              }}
            >
              {/* Slide number */}
              <div style={{
                position: 'absolute',
                bottom: '4px',
                left: '4px',
                fontSize: '10px',
                background: 'rgba(0,0,0,0.6)',
                padding: '2px 6px',
                borderRadius: '3px',
                zIndex: 100
              }}>
                {index + 1}
              </div>

              {/* Mini preview of background boxes */}
              {slide.backgroundBoxes?.filter(bb => bb.visible !== false).map(bb => (
                <div
                  key={bb.id}
                  style={{
                    position: 'absolute',
                    left: `${bb.x}%`,
                    top: `${bb.y}%`,
                    width: `${bb.width}%`,
                    height: `${bb.height}%`,
                    backgroundColor: bb.color,
                    opacity: bb.opacity,
                    borderRadius: `${bb.borderRadius}px`,
                    zIndex: bb.zIndex ?? 0
                  }}
                />
              ))}

              {/* Mini preview of image boxes */}
              {slide.imageBoxes?.filter(ib => ib.visible !== false).map(ib => (
                <img
                  key={ib.id}
                  src={ib.src}
                  alt=""
                  style={{
                    position: 'absolute',
                    left: `${ib.x}%`,
                    top: `${ib.y}%`,
                    width: `${ib.width}%`,
                    height: `${ib.height}%`,
                    objectFit: ib.objectFit,
                    opacity: ib.opacity,
                    borderRadius: `${ib.borderRadius}px`,
                    zIndex: ib.zIndex ?? 0
                  }}
                />
              ))}

              {/* Mini preview of text boxes */}
              {slide.textBoxes.filter(tb => tb.visible !== false).map(tb => (
                <div
                  key={tb.id}
                  style={{
                    position: 'absolute',
                    left: `${tb.x}%`,
                    top: `${tb.y}%`,
                    width: `${tb.width}%`,
                    height: `${tb.height}%`,
                    background: tb.backgroundColor !== 'transparent' ? tb.backgroundColor : 'transparent',
                    borderRadius: '2px',
                    zIndex: tb.zIndex ?? 0,
                    display: 'flex',
                    alignItems: tb.verticalAlign === 'top' ? 'flex-start' : tb.verticalAlign === 'bottom' ? 'flex-end' : 'center',
                    overflow: 'hidden',
                    padding: '1px'
                  }}
                >
                  <span
                    dir={tb.textDirection || 'ltr'}
                    style={{
                      width: '100%',
                      fontSize: '4px',
                      color: tb.color,
                      opacity: tb.opacity,
                      fontWeight: tb.bold ? 700 : 400,
                      fontStyle: tb.italic ? 'italic' : 'normal',
                      textDecoration: tb.underline ? 'underline' : 'none',
                      textAlign: tb.textAlign,
                      lineHeight: 1.1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      direction: tb.textDirection || 'ltr'
                    }}>
                    {tb.text}
                  </span>
                </div>
              ))}

              {/* Duplicate button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  duplicateSlide(index);
                }}
                title="Duplicate slide"
                style={{
                  position: 'absolute',
                  top: '4px',
                  right: presentation.slides.length > 1 ? '26px' : '4px',
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  border: 'none',
                  background: 'rgba(100,100,255,0.6)',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0.7,
                  zIndex: 101
                }}
              >
                ⧉
              </button>

              {/* Delete button (only if more than 1 slide) */}
              {presentation.slides.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSlide(index);
                  }}
                  title="Delete slide"
                  style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    border: 'none',
                    background: 'rgba(255,0,0,0.6)',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: 0.7,
                    zIndex: 101
                  }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Center Panel - Canvas */}
        <div style={{
          flex: 1,
          padding: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'auto'
        }}>
          <div
            ref={canvasRef}
            onClick={() => {
              setSelectedTextBoxId(null);
              setSelectedImageBoxId(null);
              setSelectedBackgroundBoxId(null);
            }}
            style={{
              width: '100%',
              maxWidth: '900px',
              aspectRatio: '16/9',
              background: currentSlide ? getSlideBackgroundStyle(currentSlide) : '#1a1a2e',
              borderRadius: '8px',
              position: 'relative',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              overflow: 'hidden'
            }}
          >
            {/* Background boxes - decorative rectangles */}
            {currentSlide?.backgroundBoxes?.filter(bb => bb.visible !== false).map(box => (
              <Rnd
                key={box.id}
                position={{
                  x: (box.x / 100) * canvasDims.width,
                  y: (box.y / 100) * canvasDims.height
                }}
                size={{
                  width: (box.width / 100) * canvasDims.width,
                  height: (box.height / 100) * canvasDims.height
                }}
                onDrag={(e, d) => {
                  const currentX = (d.x / canvasDims.width) * 100;
                  const currentY = (d.y / canvasDims.height) * 100;
                  const { guides } = calculateSnap(box.id, currentX, currentY, box.width, box.height);
                  setActiveSnapGuides(guides);
                }}
                onDragStop={(e, d) => {
                  const currentX = (d.x / canvasDims.width) * 100;
                  const currentY = (d.y / canvasDims.height) * 100;
                  const { x: snappedX, y: snappedY } = calculateSnap(box.id, currentX, currentY, box.width, box.height);
                  updateBackgroundBox(box.id, { x: snappedX, y: snappedY });
                  setActiveSnapGuides([]);
                }}
                onResize={(e, direction, ref, delta, position) => {
                  const currentX = (position.x / canvasDims.width) * 100;
                  const currentY = (position.y / canvasDims.height) * 100;
                  const currentWidth = (ref.offsetWidth / canvasDims.width) * 100;
                  const currentHeight = (ref.offsetHeight / canvasDims.height) * 100;
                  const { guides } = calculateSnap(box.id, currentX, currentY, currentWidth, currentHeight);
                  setActiveSnapGuides(guides);
                }}
                onResizeStop={(e, direction, ref, delta, position) => {
                  const currentX = (position.x / canvasDims.width) * 100;
                  const currentY = (position.y / canvasDims.height) * 100;
                  const currentWidth = (ref.offsetWidth / canvasDims.width) * 100;
                  const currentHeight = (ref.offsetHeight / canvasDims.height) * 100;
                  const { x: snappedX, y: snappedY } = calculateSnap(box.id, currentX, currentY, currentWidth, currentHeight);
                  updateBackgroundBox(box.id, {
                    x: snappedX,
                    y: snappedY,
                    width: currentWidth,
                    height: currentHeight
                  });
                  setActiveSnapGuides([]);
                }}
                bounds="parent"
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  setSelectedTextBoxId(null);
                  setSelectedImageBoxId(null);
                  setSelectedBackgroundBoxId(box.id);
                }}
                style={{
                  border: selectedBackgroundBoxId === box.id ? '2px solid #00d4ff' : '1px dashed rgba(255,255,255,0.2)',
                  cursor: 'move',
                  zIndex: box.zIndex ?? 0
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    backgroundColor: box.color,
                    opacity: box.opacity,
                    borderRadius: `${box.borderRadius}px`,
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  {/* Texture overlay */}
                  {box.texture && box.texture !== 'none' && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundImage: texturePatterns[box.texture as ThemeTextureType]?.pattern || 'none',
                        backgroundRepeat: 'repeat',
                        backgroundSize: texturePatterns[box.texture as ThemeTextureType]?.size || 'auto',
                        opacity: box.textureOpacity ?? 0.3,
                        pointerEvents: 'none',
                        borderRadius: `${box.borderRadius}px`
                      }}
                    />
                  )}
                </div>
              </Rnd>
            ))}

            {/* Image boxes - with zIndex for layer ordering */}
            {currentSlide?.imageBoxes?.filter(ib => ib.visible !== false).map(imageBox => (
              <Rnd
                key={imageBox.id}
                position={{
                  x: (imageBox.x / 100) * canvasDims.width,
                  y: (imageBox.y / 100) * canvasDims.height
                }}
                size={{
                  width: (imageBox.width / 100) * canvasDims.width,
                  height: (imageBox.height / 100) * canvasDims.height
                }}
                onDrag={(e, d) => {
                  const currentX = (d.x / canvasDims.width) * 100;
                  const currentY = (d.y / canvasDims.height) * 100;
                  const { guides } = calculateSnap(imageBox.id, currentX, currentY, imageBox.width, imageBox.height);
                  setActiveSnapGuides(guides);
                }}
                onDragStop={(e, d) => {
                  const currentX = (d.x / canvasDims.width) * 100;
                  const currentY = (d.y / canvasDims.height) * 100;
                  const { x: snappedX, y: snappedY } = calculateSnap(imageBox.id, currentX, currentY, imageBox.width, imageBox.height);
                  updateImageBox(imageBox.id, { x: snappedX, y: snappedY });
                  setActiveSnapGuides([]);
                }}
                onResize={(e, direction, ref, delta, position) => {
                  const currentX = (position.x / canvasDims.width) * 100;
                  const currentY = (position.y / canvasDims.height) * 100;
                  const currentWidth = (ref.offsetWidth / canvasDims.width) * 100;
                  const currentHeight = (ref.offsetHeight / canvasDims.height) * 100;
                  const { guides } = calculateSnap(imageBox.id, currentX, currentY, currentWidth, currentHeight);
                  setActiveSnapGuides(guides);
                }}
                onResizeStop={(e, direction, ref, delta, position) => {
                  const currentX = (position.x / canvasDims.width) * 100;
                  const currentY = (position.y / canvasDims.height) * 100;
                  const currentWidth = (ref.offsetWidth / canvasDims.width) * 100;
                  const currentHeight = (ref.offsetHeight / canvasDims.height) * 100;
                  const { x: snappedX, y: snappedY } = calculateSnap(imageBox.id, currentX, currentY, currentWidth, currentHeight);
                  updateImageBox(imageBox.id, {
                    x: snappedX,
                    y: snappedY,
                    width: currentWidth,
                    height: currentHeight
                  });
                  setActiveSnapGuides([]);
                }}
                bounds="parent"
                lockAspectRatio={false}
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  setSelectedTextBoxId(null);
                  setSelectedImageBoxId(imageBox.id);
                  setSelectedBackgroundBoxId(null);
                }}
                style={{
                  border: selectedImageBoxId === imageBox.id ? '2px solid #00d4ff' : '1px dashed rgba(255,255,255,0.3)',
                  borderRadius: `${imageBox.borderRadius}px`,
                  cursor: 'move',
                  zIndex: imageBox.zIndex ?? 0
                }}
              >
                <img
                  src={imageBox.src}
                  alt=""
                  draggable={false}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: imageBox.objectFit,
                    opacity: imageBox.opacity,
                    borderRadius: `${imageBox.borderRadius}px`,
                    pointerEvents: 'none'
                  }}
                />
              </Rnd>
            ))}

            {/* Text boxes - with zIndex for layer ordering */}
            {currentSlide?.textBoxes.filter(tb => tb.visible !== false).map(textBox => (
              <Rnd
                key={textBox.id}
                position={{
                  x: (textBox.x / 100) * canvasDims.width,
                  y: (textBox.y / 100) * canvasDims.height
                }}
                size={{
                  width: (textBox.width / 100) * canvasDims.width,
                  height: (textBox.height / 100) * canvasDims.height
                }}
                onDrag={(e, d) => {
                  const currentX = (d.x / canvasDims.width) * 100;
                  const currentY = (d.y / canvasDims.height) * 100;
                  const { guides } = calculateSnap(textBox.id, currentX, currentY, textBox.width, textBox.height);
                  setActiveSnapGuides(guides);
                }}
                onDragStop={(e, d) => {
                  const currentX = (d.x / canvasDims.width) * 100;
                  const currentY = (d.y / canvasDims.height) * 100;
                  const { x: snappedX, y: snappedY } = calculateSnap(textBox.id, currentX, currentY, textBox.width, textBox.height);
                  updateTextBox(textBox.id, { x: snappedX, y: snappedY });
                  setActiveSnapGuides([]);
                }}
                onResize={(e, direction, ref, delta, position) => {
                  const currentX = (position.x / canvasDims.width) * 100;
                  const currentY = (position.y / canvasDims.height) * 100;
                  const currentWidth = (ref.offsetWidth / canvasDims.width) * 100;
                  const currentHeight = (ref.offsetHeight / canvasDims.height) * 100;
                  const { guides } = calculateSnap(textBox.id, currentX, currentY, currentWidth, currentHeight);
                  setActiveSnapGuides(guides);
                }}
                onResizeStop={(e, direction, ref, delta, position) => {
                  const currentX = (position.x / canvasDims.width) * 100;
                  const currentY = (position.y / canvasDims.height) * 100;
                  const currentWidth = (ref.offsetWidth / canvasDims.width) * 100;
                  const currentHeight = (ref.offsetHeight / canvasDims.height) * 100;
                  const { x: snappedX, y: snappedY } = calculateSnap(textBox.id, currentX, currentY, currentWidth, currentHeight);
                  updateTextBox(textBox.id, {
                    x: snappedX,
                    y: snappedY,
                    width: currentWidth,
                    height: currentHeight
                  });
                  setActiveSnapGuides([]);
                }}
                bounds="parent"
                disableDragging={editingTextBoxId === textBox.id}
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  setSelectedImageBoxId(null);
                  setSelectedTextBoxId(textBox.id);
                  setSelectedBackgroundBoxId(null);
                }}
                onDoubleClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  setEditingTextBoxId(textBox.id);
                }}
                style={{
                  border: selectedTextBoxId === textBox.id ? '2px solid #00d4ff' : '1px dashed rgba(255,255,255,0.3)',
                  borderRadius: '4px',
                  cursor: editingTextBoxId === textBox.id ? 'text' : 'move',
                  zIndex: textBox.zIndex ?? 0
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: textBox.verticalAlign === 'top' ? 'flex-start' : textBox.verticalAlign === 'bottom' ? 'flex-end' : 'center',
                    justifyContent: textBox.textAlign === 'left' ? 'flex-start' : textBox.textAlign === 'right' ? 'flex-end' : 'center',
                    padding: `${textBox.paddingTop ?? 0}% ${textBox.paddingRight ?? 0}% ${textBox.paddingBottom ?? 0}% ${textBox.paddingLeft ?? 0}%`,
                    backgroundColor: textBox.backgroundColor !== 'transparent' && textBox.backgroundColor
                      ? `rgba(${parseInt(textBox.backgroundColor.slice(1, 3), 16)}, ${parseInt(textBox.backgroundColor.slice(3, 5), 16)}, ${parseInt(textBox.backgroundColor.slice(5, 7), 16)}, ${textBox.backgroundOpacity ?? 1})`
                      : 'transparent',
                    borderTop: textBox.borderTop ? `${textBox.borderTop}px solid ${textBox.borderColor || '#ffffff'}` : 'none',
                    borderRight: textBox.borderRight ? `${textBox.borderRight}px solid ${textBox.borderColor || '#ffffff'}` : 'none',
                    borderBottom: textBox.borderBottom ? `${textBox.borderBottom}px solid ${textBox.borderColor || '#ffffff'}` : 'none',
                    borderLeft: textBox.borderLeft ? `${textBox.borderLeft}px solid ${textBox.borderColor || '#ffffff'}` : 'none',
                    borderRadius: `${textBox.borderRadiusTopLeft ?? 0}px ${textBox.borderRadiusTopRight ?? 0}px ${textBox.borderRadiusBottomRight ?? 0}px ${textBox.borderRadiusBottomLeft ?? 0}px`,
                    overflow: 'hidden',
                    boxSizing: 'border-box'
                  }}
                >
                  <div
                    contentEditable={editingTextBoxId === textBox.id}
                    suppressContentEditableWarning
                    onBlur={(e) => {
                      // Save text on blur
                      const newText = e.currentTarget.innerText;
                      if (newText !== textBox.text) {
                        updateTextBox(textBox.id, { text: newText });
                      }
                      setEditingTextBoxId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        // Restore original text and exit
                        e.currentTarget.innerText = textBox.text;
                        e.currentTarget.blur();
                      }
                      // Stop propagation to prevent other handlers from interfering
                      e.stopPropagation();
                    }}
                    ref={(el) => {
                      if (el && editingTextBoxId === textBox.id && document.activeElement !== el) {
                        el.focus();
                        // Place cursor at end
                        const range = document.createRange();
                        range.selectNodeContents(el);
                        range.collapse(false);
                        const sel = window.getSelection();
                        sel?.removeAllRanges();
                        sel?.addRange(range);
                      }
                    }}
                    dir={textBox.textDirection || 'ltr'}
                    style={{
                      width: '100%',
                      color: textBox.color,
                      fontSize: `${(textBox.fontSize / 100) * (canvasDims.height * 0.05)}px`,
                      fontWeight: textBox.fontWeight || (textBox.bold ? '700' : '400'),
                      fontStyle: textBox.italic ? 'italic' : 'normal',
                      textDecoration: textBox.underline ? 'underline' : 'none',
                      textAlign: textBox.textAlign,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      direction: textBox.textDirection || 'ltr',
                      opacity: textBox.opacity,
                      lineHeight: 1.4,
                      outline: 'none',
                      cursor: editingTextBoxId === textBox.id ? 'text' : 'inherit'
                    }}
                  >
                    {textBox.text}
                  </div>
                </div>
              </Rnd>
            ))}

            {/* Snap guide lines */}
            {activeSnapGuides.map((guide, index) => (
              <div
                key={`guide-${guide.type}-${guide.position.toFixed(2)}-${index}`}
                style={{
                  position: 'absolute',
                  pointerEvents: 'none',
                  zIndex: 1000,
                  ...(guide.type === 'vertical' ? {
                    left: `${guide.position}%`,
                    top: 0,
                    width: '1px',
                    height: '100%',
                    background: guide.label === 'center'
                      ? '#f59e0b'
                      : guide.label === 'edge'
                        ? '#ef4444'
                        : '#22c55e',
                    boxShadow: guide.label === 'center'
                      ? '0 0 4px #f59e0b'
                      : guide.label === 'edge'
                        ? '0 0 4px #ef4444'
                        : '0 0 4px #22c55e'
                  } : {
                    top: `${guide.position}%`,
                    left: 0,
                    height: '1px',
                    width: '100%',
                    background: guide.label === 'center'
                      ? '#f59e0b'
                      : guide.label === 'edge'
                        ? '#ef4444'
                        : '#22c55e',
                    boxShadow: guide.label === 'center'
                      ? '0 0 4px #f59e0b'
                      : guide.label === 'edge'
                        ? '0 0 4px #ef4444'
                        : '0 0 4px #22c55e'
                  })
                }}
              />
            ))}
          </div>
        </div>

        {/* Right Panel - Properties with Tabs */}
        <div style={{
          width: '300px',
          borderLeft: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(0,0,0,0.2)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* Tab buttons */}
          <div style={{
            display: 'flex',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            flexShrink: 0
          }}>
            {(['element', 'slide', 'layers'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setPropertiesTab(tab)}
                style={{
                  flex: 1,
                  padding: '12px 8px',
                  border: 'none',
                  borderBottom: propertiesTab === tab ? '2px solid #00d4ff' : '2px solid transparent',
                  background: propertiesTab === tab ? 'rgba(0,212,255,0.1)' : 'transparent',
                  color: propertiesTab === tab ? '#00d4ff' : 'rgba(255,255,255,0.6)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: propertiesTab === tab ? 600 : 400,
                  textTransform: 'capitalize'
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            {/* ===== ELEMENT TAB ===== */}
            {propertiesTab === 'element' && (
              <>
                {selectedTextBox ? (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <h3 style={{ margin: 0, fontSize: '14px' }}>Text Properties</h3>
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={selectedTextBox.visible !== false}
                            onChange={() => toggleLayerVisibility(selectedTextBox.id, 'text')}
                            style={{ accentColor: '#00d4ff' }}
                          />
                          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>Visible</span>
                        </label>
                        <button
                          onClick={() => deleteTextBox(selectedTextBox.id)}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            border: 'none',
                            background: '#dc3545',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '11px'
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {/* Text Content */}
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>Text</label>
                      <textarea
                        value={selectedTextBox.text}
                        onChange={(e) => updateTextBox(selectedTextBox.id, { text: e.target.value })}
                        dir={selectedTextBox.textDirection || 'ltr'}
                        style={{
                          width: '100%',
                          height: '60px',
                          padding: '8px',
                          borderRadius: '4px',
                          border: '1px solid rgba(255,255,255,0.1)',
                          background: 'rgba(0,0,0,0.3)',
                          color: 'white',
                          resize: 'vertical',
                          boxSizing: 'border-box',
                          direction: selectedTextBox.textDirection || 'ltr'
                        }}
                      />
                    </div>

                    {/* Font Size & Weight */}
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>Font Size: {selectedTextBox.fontSize}%</label>
                      <input
                        type="range"
                        min="50"
                        max="300"
                        value={selectedTextBox.fontSize}
                        onChange={(e) => updateTextBox(selectedTextBox.id, { fontSize: parseInt(e.target.value) })}
                        style={{ width: '100%', accentColor: '#00d4ff' }}
                      />
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>Font Weight</label>
                      <select
                        value={selectedTextBox.fontWeight || (selectedTextBox.bold ? '700' : '400')}
                        onChange={(e) => updateTextBox(selectedTextBox.id, { fontWeight: e.target.value, bold: parseInt(e.target.value) >= 600 })}
                        style={{
                          width: '100%',
                          padding: '8px',
                          borderRadius: '4px',
                          border: '1px solid rgba(255,255,255,0.1)',
                          background: 'rgba(0,0,0,0.3)',
                          color: 'white',
                          fontSize: '13px'
                        }}
                      >
                        <option value="300">Light (300)</option>
                        <option value="400">Normal (400)</option>
                        <option value="500">Medium (500)</option>
                        <option value="600">Semi-Bold (600)</option>
                        <option value="700">Bold (700)</option>
                        <option value="800">Extra Bold (800)</option>
                      </select>
                    </div>

                    {/* Colors */}
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>Text Color</label>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                          type="color"
                          value={selectedTextBox.color}
                          onChange={(e) => updateTextBox(selectedTextBox.id, { color: e.target.value })}
                          style={{ width: '40px', height: '32px', padding: '2px', borderRadius: '4px', cursor: 'pointer', border: 'none' }}
                        />
                        <input
                          type="text"
                          value={selectedTextBox.color}
                          onChange={(e) => updateTextBox(selectedTextBox.id, { color: e.target.value })}
                          style={{ flex: 1, padding: '6px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: 'white', fontSize: '12px' }}
                        />
                      </div>
                    </div>

                    {/* Background with opacity */}
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>Background</label>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                          type="color"
                          value={selectedTextBox.backgroundColor === 'transparent' ? '#000000' : selectedTextBox.backgroundColor}
                          onChange={(e) => updateTextBox(selectedTextBox.id, { backgroundColor: e.target.value })}
                          style={{ width: '40px', height: '32px', padding: '2px', borderRadius: '4px', cursor: 'pointer', border: 'none' }}
                        />
                        <button
                          onClick={() => updateTextBox(selectedTextBox.id, { backgroundColor: 'transparent' })}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '4px',
                            border: selectedTextBox.backgroundColor === 'transparent' ? '2px solid #00d4ff' : '1px solid rgba(255,255,255,0.2)',
                            background: 'transparent',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '11px'
                          }}
                        >
                          None
                        </button>
                      </div>
                      {selectedTextBox.backgroundColor !== 'transparent' && (
                        <div style={{ marginTop: '8px' }}>
                          <label style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>BG Opacity: {Math.round((selectedTextBox.backgroundOpacity ?? 1) * 100)}%</label>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={(selectedTextBox.backgroundOpacity ?? 1) * 100}
                            onChange={(e) => updateTextBox(selectedTextBox.id, { backgroundOpacity: parseInt(e.target.value) / 100 })}
                            style={{ width: '100%', accentColor: '#00d4ff' }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Text Style */}
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>Style</label>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={() => updateTextBox(selectedTextBox.id, { italic: !selectedTextBox.italic })}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '4px',
                            border: selectedTextBox.italic ? '2px solid #00d4ff' : '1px solid rgba(255,255,255,0.2)',
                            background: selectedTextBox.italic ? 'rgba(0,212,255,0.15)' : 'transparent',
                            color: 'white',
                            cursor: 'pointer',
                            fontStyle: 'italic'
                          }}
                        >
                          I
                        </button>
                        <button
                          onClick={() => updateTextBox(selectedTextBox.id, { underline: !selectedTextBox.underline })}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '4px',
                            border: selectedTextBox.underline ? '2px solid #00d4ff' : '1px solid rgba(255,255,255,0.2)',
                            background: selectedTextBox.underline ? 'rgba(0,212,255,0.15)' : 'transparent',
                            color: 'white',
                            cursor: 'pointer',
                            textDecoration: 'underline'
                          }}
                        >
                          U
                        </button>
                      </div>
                    </div>

                    {/* Text Direction */}
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>Text Direction</label>
                      <div dir="ltr" style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={() => updateTextBox(selectedTextBox.id, { textDirection: 'ltr' })}
                          style={{
                            flex: 1,
                            padding: '6px',
                            borderRadius: '4px',
                            border: (selectedTextBox.textDirection || 'ltr') === 'ltr' ? '2px solid #00d4ff' : '1px solid rgba(255,255,255,0.2)',
                            background: (selectedTextBox.textDirection || 'ltr') === 'ltr' ? 'rgba(0,212,255,0.15)' : 'transparent',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '11px'
                          }}
                        >
                          LTR
                        </button>
                        <button
                          onClick={() => updateTextBox(selectedTextBox.id, { textDirection: 'rtl' })}
                          style={{
                            flex: 1,
                            padding: '6px',
                            borderRadius: '4px',
                            border: selectedTextBox.textDirection === 'rtl' ? '2px solid #00d4ff' : '1px solid rgba(255,255,255,0.2)',
                            background: selectedTextBox.textDirection === 'rtl' ? 'rgba(0,212,255,0.15)' : 'transparent',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '11px'
                          }}
                        >
                          RTL
                        </button>
                      </div>
                    </div>

                    {/* Alignment */}
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>Horizontal Align</label>
                      <div dir="ltr" style={{ display: 'flex', gap: '4px' }}>
                        {(['left', 'center', 'right'] as const).map(align => (
                          <button
                            key={align}
                            onClick={() => updateTextBox(selectedTextBox.id, { textAlign: align })}
                            style={{
                              flex: 1,
                              padding: '6px',
                              borderRadius: '4px',
                              border: selectedTextBox.textAlign === align ? '2px solid #00d4ff' : '1px solid rgba(255,255,255,0.2)',
                              background: selectedTextBox.textAlign === align ? 'rgba(0,212,255,0.15)' : 'transparent',
                              color: 'white',
                              cursor: 'pointer',
                              fontSize: '11px',
                              textTransform: 'capitalize'
                            }}
                          >
                            {align}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>Vertical Align</label>
                      <div dir="ltr" style={{ display: 'flex', gap: '4px' }}>
                        {(['top', 'center', 'bottom'] as const).map(align => (
                          <button
                            key={align}
                            onClick={() => updateTextBox(selectedTextBox.id, { verticalAlign: align })}
                            style={{
                              flex: 1,
                              padding: '6px',
                              borderRadius: '4px',
                              border: selectedTextBox.verticalAlign === align ? '2px solid #00d4ff' : '1px solid rgba(255,255,255,0.2)',
                              background: selectedTextBox.verticalAlign === align ? 'rgba(0,212,255,0.15)' : 'transparent',
                              color: 'white',
                              cursor: 'pointer',
                              fontSize: '11px',
                              textTransform: 'capitalize'
                            }}
                          >
                            {align}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Opacity */}
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>Text Opacity: {Math.round(selectedTextBox.opacity * 100)}%</label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={selectedTextBox.opacity * 100}
                        onChange={(e) => updateTextBox(selectedTextBox.id, { opacity: parseInt(e.target.value) / 100 })}
                        style={{ width: '100%', accentColor: '#00d4ff' }}
                      />
                    </div>

                    {/* Borders Section */}
                    <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
                      <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>Borders</label>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>Color:</span>
                        <input
                          type="color"
                          value={selectedTextBox.borderColor || '#ffffff'}
                          onChange={(e) => updateTextBox(selectedTextBox.id, { borderColor: e.target.value })}
                          style={{ width: '30px', height: '24px', padding: '1px', borderRadius: '4px', cursor: 'pointer', border: 'none' }}
                        />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        {[
                          { label: 'Top', prop: 'borderTop' as const },
                          { label: 'Right', prop: 'borderRight' as const },
                          { label: 'Bottom', prop: 'borderBottom' as const },
                          { label: 'Left', prop: 'borderLeft' as const }
                        ].map(({ label, prop }) => (
                          <div key={prop}>
                            <label style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginBottom: '2px' }}>{label}: {selectedTextBox[prop] || 0}px</label>
                            <input
                              type="range"
                              min="0"
                              max="10"
                              value={selectedTextBox[prop] || 0}
                              onChange={(e) => updateTextBox(selectedTextBox.id, { [prop]: parseInt(e.target.value) })}
                              style={{ width: '100%', accentColor: '#00d4ff' }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Corner Radius Section */}
                    <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
                      <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>Corner Radius</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        {[
                          { label: 'Top-Left', prop: 'borderRadiusTopLeft' as const },
                          { label: 'Top-Right', prop: 'borderRadiusTopRight' as const },
                          { label: 'Bottom-Left', prop: 'borderRadiusBottomLeft' as const },
                          { label: 'Bottom-Right', prop: 'borderRadiusBottomRight' as const }
                        ].map(({ label, prop }) => (
                          <div key={prop}>
                            <label style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginBottom: '2px' }}>{label}: {selectedTextBox[prop] || 0}px</label>
                            <input
                              type="range"
                              min="0"
                              max="50"
                              value={selectedTextBox[prop] || 0}
                              onChange={(e) => updateTextBox(selectedTextBox.id, { [prop]: parseInt(e.target.value) })}
                              style={{ width: '100%', accentColor: '#00d4ff' }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Padding Section */}
                    <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
                      <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>Padding</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        {[
                          { label: 'Top', prop: 'paddingTop' as const },
                          { label: 'Right', prop: 'paddingRight' as const },
                          { label: 'Bottom', prop: 'paddingBottom' as const },
                          { label: 'Left', prop: 'paddingLeft' as const }
                        ].map(({ label, prop }) => (
                          <div key={prop}>
                            <label style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginBottom: '2px' }}>{label}: {selectedTextBox[prop] || 0}%</label>
                            <input
                              type="range"
                              min="0"
                              max="20"
                              step="0.5"
                              value={selectedTextBox[prop] || 0}
                              onChange={(e) => updateTextBox(selectedTextBox.id, { [prop]: parseFloat(e.target.value) })}
                              style={{ width: '100%', accentColor: '#00d4ff' }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
          ) : selectedImageBox ? (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <h3 style={{ margin: 0, fontSize: '14px' }}>Image Properties</h3>
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={selectedImageBox.visible !== false}
                            onChange={() => toggleLayerVisibility(selectedImageBox.id, 'image')}
                            style={{ accentColor: '#00d4ff' }}
                          />
                          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>Visible</span>
                        </label>
                        <button
                          onClick={() => deleteImageBox(selectedImageBox.id)}
                          style={{ padding: '4px 8px', borderRadius: '4px', border: 'none', background: '#dc3545', color: 'white', cursor: 'pointer', fontSize: '11px' }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                      <img src={selectedImageBox.src} alt="" style={{ width: '100%', height: '80px', objectFit: 'contain', borderRadius: '6px', background: 'rgba(0,0,0,0.3)' }} />
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>Fit Mode</label>
                      <div dir="ltr" style={{ display: 'flex', gap: '4px' }}>
                        {(['contain', 'cover', 'fill'] as const).map(fit => (
                          <button
                            key={fit}
                            onClick={() => updateImageBox(selectedImageBox.id, { objectFit: fit })}
                            style={{
                              flex: 1,
                              padding: '6px',
                              borderRadius: '4px',
                              border: selectedImageBox.objectFit === fit ? '2px solid #00d4ff' : '1px solid rgba(255,255,255,0.2)',
                              background: selectedImageBox.objectFit === fit ? 'rgba(0,212,255,0.15)' : 'transparent',
                              color: 'white',
                              cursor: 'pointer',
                              fontSize: '11px',
                              textTransform: 'capitalize'
                            }}
                          >
                            {fit}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>Opacity: {Math.round(selectedImageBox.opacity * 100)}%</label>
                      <input type="range" min="0" max="100" value={selectedImageBox.opacity * 100} onChange={(e) => updateImageBox(selectedImageBox.id, { opacity: parseInt(e.target.value) / 100 })} style={{ width: '100%', accentColor: '#00d4ff' }} />
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>Corner Radius: {selectedImageBox.borderRadius}px</label>
                      <input type="range" min="0" max="50" value={selectedImageBox.borderRadius} onChange={(e) => updateImageBox(selectedImageBox.id, { borderRadius: parseInt(e.target.value) })} style={{ width: '100%', accentColor: '#00d4ff' }} />
                    </div>

                    <button onClick={() => imageInputRef.current?.click()} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'white', cursor: 'pointer' }}>
                      Replace Image
                    </button>
                  </div>
                ) : selectedBackgroundBox ? (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <h3 style={{ margin: 0, fontSize: '14px' }}>Background Box</h3>
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={selectedBackgroundBox.visible !== false}
                            onChange={() => toggleLayerVisibility(selectedBackgroundBox.id, 'background')}
                            style={{ accentColor: '#00d4ff' }}
                          />
                          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>Visible</span>
                        </label>
                        <button onClick={() => deleteBackgroundBox(selectedBackgroundBox.id)} style={{ padding: '4px 8px', borderRadius: '4px', border: 'none', background: '#dc3545', color: 'white', cursor: 'pointer', fontSize: '11px' }}>
                          Delete
                        </button>
                      </div>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>Color</label>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input type="color" value={selectedBackgroundBox.color} onChange={(e) => updateBackgroundBox(selectedBackgroundBox.id, { color: e.target.value })} style={{ width: '40px', height: '32px', padding: '2px', borderRadius: '4px', cursor: 'pointer', border: 'none' }} />
                        <input type="text" value={selectedBackgroundBox.color} onChange={(e) => updateBackgroundBox(selectedBackgroundBox.id, { color: e.target.value })} style={{ flex: 1, padding: '6px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: 'white', fontSize: '12px' }} />
                      </div>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>Color Presets</label>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {['#000000', '#1a1a2e', '#16213e', '#1f1f1f', '#f5f0e6', '#e8dcc8', '#d4c4a8', '#ffffff'].map(color => (
                          <button key={color} onClick={() => updateBackgroundBox(selectedBackgroundBox.id, { color })} style={{ width: '28px', height: '28px', borderRadius: '4px', border: selectedBackgroundBox.color === color ? '2px solid #00d4ff' : '1px solid rgba(255,255,255,0.2)', background: color, cursor: 'pointer' }} />
                        ))}
                      </div>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>Opacity: {Math.round(selectedBackgroundBox.opacity * 100)}%</label>
                      <input type="range" min="0" max="100" value={selectedBackgroundBox.opacity * 100} onChange={(e) => updateBackgroundBox(selectedBackgroundBox.id, { opacity: parseInt(e.target.value) / 100 })} style={{ width: '100%', accentColor: '#00d4ff' }} />
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>Texture</label>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {(['none', 'paper', 'parchment', 'linen', 'canvas', 'noise'] as TextureType[]).map(texture => (
                          <button
                            key={texture}
                            onClick={() => updateBackgroundBox(selectedBackgroundBox.id, { texture, textureOpacity: selectedBackgroundBox.textureOpacity ?? 0.3 })}
                            style={{
                              padding: '6px 10px',
                              borderRadius: '4px',
                              border: (selectedBackgroundBox.texture || 'none') === texture ? '2px solid #00d4ff' : '1px solid rgba(255,255,255,0.2)',
                              background: 'rgba(0,0,0,0.3)',
                              color: (selectedBackgroundBox.texture || 'none') === texture ? '#00d4ff' : 'white',
                              cursor: 'pointer',
                              fontSize: '11px',
                              textTransform: 'capitalize'
                            }}
                          >
                            {textureLabels[texture as ThemeTextureType] || texture}
                          </button>
                        ))}
                      </div>
                      {selectedBackgroundBox.texture && selectedBackgroundBox.texture !== 'none' && (
                        <div style={{ marginTop: '8px' }}>
                          <label style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>Texture Intensity: {Math.round((selectedBackgroundBox.textureOpacity ?? 0.3) * 100)}%</label>
                          <input type="range" min="10" max="100" value={(selectedBackgroundBox.textureOpacity ?? 0.3) * 100} onChange={(e) => updateBackgroundBox(selectedBackgroundBox.id, { textureOpacity: parseInt(e.target.value) / 100 })} style={{ width: '100%', accentColor: '#00d4ff' }} />
                        </div>
                      )}
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>Border Radius: {selectedBackgroundBox.borderRadius}px</label>
                      <input type="range" min="0" max="50" value={selectedBackgroundBox.borderRadius} onChange={(e) => updateBackgroundBox(selectedBackgroundBox.id, { borderRadius: parseInt(e.target.value) })} style={{ width: '100%', accentColor: '#00d4ff' }} />
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>Quick Presets</label>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        <button onClick={() => updateBackgroundBox(selectedBackgroundBox.id, { x: 0, y: 0, width: 100, height: 100 })} style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: 'white', cursor: 'pointer', fontSize: '11px' }}>Full</button>
                        <button onClick={() => updateBackgroundBox(selectedBackgroundBox.id, { x: 0, y: 70, width: 100, height: 30 })} style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: 'white', cursor: 'pointer', fontSize: '11px' }}>Bottom</button>
                        <button onClick={() => updateBackgroundBox(selectedBackgroundBox.id, { x: 0, y: 0, width: 100, height: 30 })} style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: 'white', cursor: 'pointer', fontSize: '11px' }}>Top</button>
                        <button onClick={() => updateBackgroundBox(selectedBackgroundBox.id, { x: 10, y: 10, width: 80, height: 80, borderRadius: 20 })} style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: 'white', cursor: 'pointer', fontSize: '11px' }}>Centered</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>
                    Click on an element to edit its properties
                  </div>
                )}
              </>
            )}

            {/* ===== SLIDE TAB ===== */}
            {propertiesTab === 'slide' && (
              <div>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '14px' }}>Slide Background</h3>

                {/* Background Type */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>Type</label>
                  <div dir="ltr" style={{ display: 'flex', gap: '4px' }}>
                    {(['color', 'gradient', 'transparent'] as const).map(type => (
                      <button
                        key={type}
                        onClick={() => {
                          if (type === 'transparent') {
                            updateSlideBackground('transparent', 'transparent');
                          } else if (type === 'gradient') {
                            updateSlideBackground(gradientPresets[0].value, 'gradient');
                          } else {
                            updateSlideBackground(currentSlide?.backgroundColor || '#1a1a2e', 'color');
                          }
                        }}
                        style={{
                          flex: 1,
                          padding: '6px',
                          borderRadius: '4px',
                          border: (currentSlide?.backgroundType || 'transparent') === type ? '2px solid #00d4ff' : '1px solid rgba(255,255,255,0.2)',
                          background: (currentSlide?.backgroundType || 'transparent') === type ? 'rgba(0,212,255,0.15)' : 'transparent',
                          color: 'white',
                          cursor: 'pointer',
                          fontSize: '11px',
                          textTransform: 'capitalize'
                        }}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color Picker (for color type) */}
                {(currentSlide?.backgroundType || 'transparent') === 'color' && (
                  <>
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>Color</label>
                      <input type="color" value={currentSlide?.backgroundColor || '#1a1a2e'} onChange={(e) => updateSlideBackground(e.target.value, 'color')} style={{ width: '50px', height: '32px', padding: '2px', borderRadius: '4px', cursor: 'pointer', border: 'none' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '16px' }}>
                      {['#000000', '#1a1a2e', '#16213e', '#0f0f23', '#1e3a5f', '#2c3e50', '#1b4f72', '#ffffff'].map(color => (
                        <button key={color} onClick={() => updateSlideBackground(color, 'color')} style={{ width: '28px', height: '28px', borderRadius: '4px', border: currentSlide?.backgroundColor === color ? '2px solid #00d4ff' : '1px solid rgba(255,255,255,0.2)', background: color, cursor: 'pointer' }} />
                      ))}
                    </div>
                  </>
                )}

                {/* Gradient Picker (for gradient type) */}
                {currentSlide?.backgroundType === 'gradient' && (
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>Gradient Presets</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                      {gradientPresets.filter(g => isGradient(g.value)).map(gradient => (
                        <button
                          key={gradient.id}
                          onClick={() => updateSlideBackground(gradient.value, 'gradient')}
                          title={gradient.name}
                          style={{
                            height: '32px',
                            borderRadius: '4px',
                            border: currentSlide?.backgroundGradient === gradient.value ? '2px solid #00d4ff' : '1px solid rgba(255,255,255,0.2)',
                            background: gradient.value,
                            cursor: 'pointer'
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Divider */}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', margin: '16px 0' }} />

                {/* Add Background Box Button */}
                <button
                  onClick={addBackgroundBox}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: 'transparent',
                    color: 'white',
                    cursor: 'pointer',
                    marginBottom: '16px'
                  }}
                >
                  + Add Background Box
                </button>

                {/* Duplicate Slide */}
                <button onClick={() => duplicateSlide(currentSlideIndex)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'white', cursor: 'pointer' }}>
                  Duplicate Slide
                </button>
              </div>
            )}

            {/* ===== LAYERS TAB ===== */}
            {propertiesTab === 'layers' && (
              <div>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '14px' }}>Layers</h3>
                <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  {getLayers().length === 0 ? (
                    <div style={{ padding: '12px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>No elements</div>
                  ) : (
                    getLayers().map((layer, idx) => {
                      const isSelected = (layer.type === 'text' && selectedTextBoxId === layer.id) ||
                                        (layer.type === 'image' && selectedImageBoxId === layer.id) ||
                                        (layer.type === 'background' && selectedBackgroundBoxId === layer.id);
                      const isFirst = idx === 0;
                      const isLast = idx === getLayers().length - 1;
                      const isDragging = draggedLayerId === layer.id;
                      const isDropTarget = dropTargetId === layer.id;

                      return (
                        <div
                          key={layer.id}
                          draggable
                          onDragStart={(e) => { setDraggedLayerId(layer.id); e.dataTransfer.effectAllowed = 'move'; }}
                          onDragEnd={() => { setDraggedLayerId(null); setDropTargetId(null); setDropPosition(null); }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            if (draggedLayerId && draggedLayerId !== layer.id) {
                              const rect = e.currentTarget.getBoundingClientRect();
                              const midY = rect.top + rect.height / 2;
                              setDropTargetId(layer.id);
                              setDropPosition(e.clientY < midY ? 'before' : 'after');
                            }
                          }}
                          onDragLeave={() => { if (dropTargetId === layer.id) { setDropTargetId(null); setDropPosition(null); } }}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (draggedLayerId && draggedLayerId !== layer.id) {
                              const rect = e.currentTarget.getBoundingClientRect();
                              reorderLayers(draggedLayerId, layer.id, e.clientY < rect.top + rect.height / 2);
                            }
                            setDraggedLayerId(null);
                            setDropTargetId(null);
                            setDropPosition(null);
                          }}
                          onClick={() => {
                            if (layer.type === 'text') { setSelectedTextBoxId(layer.id); setSelectedImageBoxId(null); setSelectedBackgroundBoxId(null); }
                            else if (layer.type === 'image') { setSelectedImageBoxId(layer.id); setSelectedTextBoxId(null); setSelectedBackgroundBoxId(null); }
                            else { setSelectedBackgroundBoxId(layer.id); setSelectedTextBoxId(null); setSelectedImageBoxId(null); }
                            setPropertiesTab('element');
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 10px',
                            borderBottom: isDropTarget && dropPosition === 'after' ? '2px solid #00d4ff' : '1px solid rgba(255,255,255,0.05)',
                            borderTop: isDropTarget && dropPosition === 'before' ? '2px solid #00d4ff' : 'none',
                            background: isSelected ? 'rgba(0, 212, 255, 0.15)' : 'transparent',
                            opacity: isDragging ? 0.5 : (layer.visible === false ? 0.4 : 1),
                            cursor: 'grab'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                            {/* Visibility toggle */}
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleLayerVisibility(layer.id, layer.type); }}
                              style={{
                                width: '20px',
                                height: '20px',
                                border: 'none',
                                background: 'transparent',
                                color: layer.visible === false ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.8)',
                                cursor: 'pointer',
                                fontSize: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              title={layer.visible === false ? 'Show' : 'Hide'}
                            >
                              {layer.visible === false ? '◯' : '◉'}
                            </button>
                            {/* Type icon */}
                            <span style={{ fontSize: '12px', opacity: 0.6 }}>
                              {layer.type === 'text' ? 'T' : layer.type === 'image' ? '🖼' : '▢'}
                            </span>
                            {/* Name */}
                            <span style={{ fontSize: '11px', color: isSelected ? '#00d4ff' : 'rgba(255,255,255,0.8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: layer.visible === false ? 'line-through' : 'none' }}>
                              {layer.name}
                            </span>
                          </div>
                          {/* Layer order controls */}
                          <div style={{ display: 'flex', gap: '2px' }}>
                            <button onClick={(e) => { e.stopPropagation(); moveLayerToFront(layer.id, layer.type); }} disabled={isFirst} title="Bring to front" style={{ width: '20px', height: '20px', border: 'none', background: 'transparent', color: isFirst ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.6)', cursor: isFirst ? 'default' : 'pointer', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⇈</button>
                            <button onClick={(e) => { e.stopPropagation(); moveLayerUp(layer.id, layer.type); }} disabled={isFirst} title="Move up" style={{ width: '20px', height: '20px', border: 'none', background: 'transparent', color: isFirst ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.6)', cursor: isFirst ? 'default' : 'pointer', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>↑</button>
                            <button onClick={(e) => { e.stopPropagation(); moveLayerDown(layer.id, layer.type); }} disabled={isLast} title="Move down" style={{ width: '20px', height: '20px', border: 'none', background: 'transparent', color: isLast ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.6)', cursor: isLast ? 'default' : 'pointer', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>↓</button>
                            <button onClick={(e) => { e.stopPropagation(); moveLayerToBack(layer.id, layer.type); }} disabled={isLast} title="Send to back" style={{ width: '20px', height: '20px', border: 'none', background: 'transparent', color: isLast ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.6)', cursor: isLast ? 'default' : 'pointer', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⇊</button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PresentationEditorPage;
