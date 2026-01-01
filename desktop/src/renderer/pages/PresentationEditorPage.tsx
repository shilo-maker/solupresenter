import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Rnd } from 'react-rnd';

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
}

// Unified layer type for the layers panel
interface Layer {
  id: string;
  type: 'text' | 'image';
  name: string;
  zIndex: number;
}

interface Slide {
  id: string;
  order: number;
  textBoxes: TextBox[];
  imageBoxes?: ImageBox[];
  backgroundColor?: string;
}

interface Presentation {
  id: string;
  title: string;
  slides: Slide[];
  canvasDimensions: { width: number; height: number };
  createdAt: string;
  updatedAt: string;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

// Get the highest zIndex from all elements in a slide
const getMaxZIndex = (slide: Slide): number => {
  const textZIndexes = slide.textBoxes.map(tb => tb.zIndex ?? 0);
  const imageZIndexes = (slide.imageBoxes || []).map(ib => ib.zIndex ?? 0);
  const allZIndexes = [...textZIndexes, ...imageZIndexes];
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
  textDirection: 'ltr'
});

const createDefaultSlide = (): Slide => ({
  id: generateId(),
  order: 0,
  textBoxes: [],
  imageBoxes: [],
  backgroundColor: '#1a1a2e'
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
  backgroundColor: '#1a1a2e'
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
  backgroundColor: '#1e3a5f'
});

const createAnnouncementSlide = (): Slide => ({
  id: generateId(),
  order: 0,
  textBoxes: [
    { id: generateId(), text: 'Announcement Title', x: 10, y: 10, width: 80, height: 20, fontSize: 160, color: '#ffffff', backgroundColor: 'transparent', textAlign: 'center', verticalAlign: 'center', bold: true, italic: false, underline: false, opacity: 1, zIndex: 2, textDirection: 'ltr' },
    { id: generateId(), text: 'Details and information go here...', x: 10, y: 40, width: 80, height: 40, fontSize: 80, color: '#ffffff', backgroundColor: 'transparent', textAlign: 'center', verticalAlign: 'top', bold: false, italic: false, underline: false, opacity: 1, zIndex: 1, textDirection: 'ltr' }
  ],
  imageBoxes: [],
  backgroundColor: '#2d1f3d'
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
                          data.type === 'prayer' ? '#1e3a5f' : '#2d1f3d';

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
        updatedAt: ''
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
  const [editingTextBoxId, setEditingTextBoxId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [hasChanges, setHasChanges] = useState(false);
  const [draggedLayerId, setDraggedLayerId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'after' | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [canvasDims, setCanvasDims] = useState({ width: 800, height: 450 });
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const currentSlide = presentation.slides[currentSlideIndex];
  const selectedTextBox = currentSlide?.textBoxes.find(tb => tb.id === selectedTextBoxId);
  const selectedImageBox = currentSlide?.imageBoxes?.find(ib => ib.id === selectedImageBoxId);

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
      });
    }
  }, [presentationId]);

  // Generate translations for Quick Mode if enabled
  useEffect(() => {
    const generateTranslations = async () => {
      if (!quickModeData?.generateTranslation || templateId !== 'quickMode') return;

      setIsTranslating(true);
      console.log('Generating translations for Quick Mode slides...');

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

        // Update presentation with translated slides
        setPresentation(prev => ({
          ...prev,
          slides: newSlides
        }));

        console.log('Translations generated successfully');
      } catch (error) {
        console.error('Failed to generate translations:', error);
      } finally {
        setIsTranslating(false);
      }
    };

    generateTranslations();
  }, []); // Run once on mount

  // Auto-save new presentations from templates (including Quick Mode)
  useEffect(() => {
    const autoSaveNewPresentation = async () => {
      // Only auto-save if this is a new presentation from a template
      if (!presentationId && templateId && presentation.slides.length > 0) {
        try {
          const data = {
            title: presentation.title,
            slides: presentation.slides,
            canvasDimensions: presentation.canvasDimensions
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
        }
      }
    };

    autoSaveNewPresentation();
  }, []); // Run once on mount

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

  // Get all layers sorted by zIndex (highest first = front)
  // Uses stable sort with ID as tiebreaker for consistent ordering
  const getLayers = useCallback((): Layer[] => {
    const slide = presentation.slides[currentSlideIndex];
    if (!slide) return [];

    const textLayers: Layer[] = slide.textBoxes.map(tb => ({
      id: tb.id,
      type: 'text' as const,
      name: tb.text.substring(0, 20) || 'Text',
      zIndex: tb.zIndex ?? 0
    }));

    const imageLayers: Layer[] = (slide.imageBoxes || []).map(ib => ({
      id: ib.id,
      type: 'image' as const,
      name: 'Image',
      zIndex: ib.zIndex ?? 0
    }));

    // Sort by zIndex (descending), with ID as stable tiebreaker
    return [...textLayers, ...imageLayers].sort((a, b) => {
      if (b.zIndex !== a.zIndex) return b.zIndex - a.zIndex;
      return a.id.localeCompare(b.id); // Stable tiebreaker
    });
  }, [presentation.slides, currentSlideIndex]);

  // Move layer up (increase zIndex)
  const moveLayerUp = useCallback((layerId: string, layerType: 'text' | 'image') => {
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

        return { ...slide, textBoxes: newTextBoxes, imageBoxes: newImageBoxes };
      })
    }));
    setHasChanges(true);
  }, [getLayers, currentSlideIndex]);

  // Move layer down (decrease zIndex)
  const moveLayerDown = useCallback((layerId: string, layerType: 'text' | 'image') => {
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

        return { ...slide, textBoxes: newTextBoxes, imageBoxes: newImageBoxes };
      })
    }));
    setHasChanges(true);
  }, [getLayers, currentSlideIndex]);

  // Move layer to front (highest zIndex)
  const moveLayerToFront = useCallback((layerId: string, layerType: 'text' | 'image') => {
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
        } else {
          return {
            ...s,
            imageBoxes: (s.imageBoxes || []).map(ib =>
              ib.id === layerId ? { ...ib, zIndex: maxZ + 1 } : ib
            )
          };
        }
      })
    }));
    setHasChanges(true);
  }, [presentation.slides, currentSlideIndex]);

  // Move layer to back (lowest zIndex)
  const moveLayerToBack = useCallback((layerId: string, layerType: 'text' | 'image') => {
    const slide = presentation.slides[currentSlideIndex];
    const allElements = [
      ...slide.textBoxes,
      ...(slide.imageBoxes || [])
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
        } else {
          return {
            ...s,
            imageBoxes: (s.imageBoxes || []).map(ib =>
              ib.id === layerId ? { ...ib, zIndex: minZ - 1 } : ib
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

  // Duplicate slide
  const duplicateSlide = useCallback((index: number) => {
    const slideToDuplicate = presentation.slides[index];
    const newSlide: Slide = {
      ...slideToDuplicate,
      id: generateId(),
      order: presentation.slides.length,
      textBoxes: slideToDuplicate.textBoxes.map(tb => ({ ...tb, id: generateId() })),
      imageBoxes: slideToDuplicate.imageBoxes?.map(ib => ({ ...ib, id: generateId() })) || []
    };
    setPresentation(prev => ({
      ...prev,
      slides: [...prev.slides.slice(0, index + 1), newSlide, ...prev.slides.slice(index + 1)]
    }));
    setCurrentSlideIndex(index + 1);
    setHasChanges(true);
  }, [presentation.slides]);

  // Update slide background
  const updateSlideBackground = useCallback((color: string) => {
    setPresentation(prev => ({
      ...prev,
      slides: prev.slides.map((slide, idx) =>
        idx === currentSlideIndex ? { ...slide, backgroundColor: color } : slide
      )
    }));
    setHasChanges(true);
  }, [currentSlideIndex]);

  // Save presentation
  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      const data = {
        title: presentation.title,
        slides: presentation.slides,
        canvasDimensions: presentation.canvasDimensions
      };

      console.log('Saving presentation:', presentation.id ? 'update' : 'create', data);

      if (presentation.id) {
        const updated = await window.electronAPI.updatePresentation(presentation.id, data);
        console.log('Presentation updated:', updated);
      } else {
        const created = await window.electronAPI.createPresentation(data);
        console.log('Presentation created:', created);
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
    navigate('/', { state: { activeTab: 'presentations' } });
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
              disabled={saveStatus !== 'idle'}
              style={{
                padding: '10px 24px',
                borderRadius: '6px',
                border: 'none',
                background: saveStatus === 'saved' ? '#28a745' : '#00d4ff',
                color: saveStatus === 'saved' ? 'white' : 'black',
                cursor: saveStatus !== 'idle' ? 'not-allowed' : 'pointer',
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
              onClick={() => {
                setCurrentSlideIndex(index);
                setSelectedTextBoxId(null);
                setSelectedImageBoxId(null);
              }}
              style={{
                position: 'relative',
                aspectRatio: '16/9',
                borderRadius: '6px',
                border: currentSlideIndex === index ? '2px solid #00d4ff' : '1px solid rgba(255,255,255,0.2)',
                background: slide.backgroundColor || '#1a1a2e',
                cursor: 'pointer',
                overflow: 'hidden'
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
                borderRadius: '3px'
              }}>
                {index + 1}
              </div>

              {/* Mini preview of image boxes */}
              {slide.imageBoxes?.map(ib => (
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
              {slide.textBoxes.map(tb => (
                <div
                  key={tb.id}
                  dir={tb.textDirection || 'ltr'}
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
                    justifyContent: tb.textAlign === 'left' ? 'flex-start' : tb.textAlign === 'right' ? 'flex-end' : 'center',
                    overflow: 'hidden',
                    padding: '1px',
                    direction: tb.textDirection || 'ltr'
                  }}
                >
                  <span style={{
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
                    maxWidth: '100%',
                    direction: tb.textDirection || 'ltr'
                  }}>
                    {tb.text}
                  </span>
                </div>
              ))}

              {/* Delete button (only if more than 1 slide) */}
              {presentation.slides.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSlide(index);
                  }}
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
                    opacity: 0.7
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
            }}
            style={{
              width: '100%',
              maxWidth: '900px',
              aspectRatio: '16/9',
              background: currentSlide?.backgroundColor || '#1a1a2e',
              borderRadius: '8px',
              position: 'relative',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
            }}
          >
            {/* Image boxes - with zIndex for layer ordering */}
            {currentSlide?.imageBoxes?.map(imageBox => (
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
                onDragStop={(e, d) => {
                  updateImageBox(imageBox.id, {
                    x: (d.x / canvasDims.width) * 100,
                    y: (d.y / canvasDims.height) * 100
                  });
                }}
                onResizeStop={(e, direction, ref, delta, position) => {
                  updateImageBox(imageBox.id, {
                    x: (position.x / canvasDims.width) * 100,
                    y: (position.y / canvasDims.height) * 100,
                    width: (ref.offsetWidth / canvasDims.width) * 100,
                    height: (ref.offsetHeight / canvasDims.height) * 100
                  });
                }}
                bounds="parent"
                lockAspectRatio={false}
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  setSelectedTextBoxId(null);
                  setSelectedImageBoxId(imageBox.id);
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
            {currentSlide?.textBoxes.map(textBox => (
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
                onDragStop={(e, d) => {
                  updateTextBox(textBox.id, {
                    x: (d.x / canvasDims.width) * 100,
                    y: (d.y / canvasDims.height) * 100
                  });
                }}
                onResizeStop={(e, direction, ref, delta, position) => {
                  updateTextBox(textBox.id, {
                    x: (position.x / canvasDims.width) * 100,
                    y: (position.y / canvasDims.height) * 100,
                    width: (ref.offsetWidth / canvasDims.width) * 100,
                    height: (ref.offsetHeight / canvasDims.height) * 100
                  });
                }}
                bounds="parent"
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  setSelectedImageBoxId(null);
                  setSelectedTextBoxId(textBox.id);
                }}
                onDoubleClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  setEditingTextBoxId(textBox.id);
                }}
                style={{
                  border: selectedTextBoxId === textBox.id ? '2px solid #00d4ff' : '1px dashed rgba(255,255,255,0.3)',
                  borderRadius: '4px',
                  cursor: 'move',
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
                    padding: '8px',
                    backgroundColor: textBox.backgroundColor,
                    opacity: textBox.opacity,
                    overflow: 'hidden'
                  }}
                >
                  {editingTextBoxId === textBox.id ? (
                    <textarea
                      autoFocus
                      value={textBox.text}
                      onChange={(e) => updateTextBox(textBox.id, { text: e.target.value })}
                      onBlur={() => setEditingTextBoxId(null)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setEditingTextBoxId(null);
                      }}
                      dir={textBox.textDirection || 'ltr'}
                      style={{
                        width: '100%',
                        height: '100%',
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        resize: 'none',
                        color: textBox.color,
                        fontSize: `${(textBox.fontSize / 100) * (canvasDims.height * 0.05)}px`,
                        fontWeight: textBox.bold ? 'bold' : 'normal',
                        fontStyle: textBox.italic ? 'italic' : 'normal',
                        textDecoration: textBox.underline ? 'underline' : 'none',
                        textAlign: textBox.textAlign,
                        direction: textBox.textDirection || 'ltr'
                      }}
                    />
                  ) : (
                    <span
                      dir={textBox.textDirection || 'ltr'}
                      style={{
                        color: textBox.color,
                        fontSize: `${(textBox.fontSize / 100) * (canvasDims.height * 0.05)}px`,
                        fontWeight: textBox.bold ? 'bold' : 'normal',
                        fontStyle: textBox.italic ? 'italic' : 'normal',
                        textDecoration: textBox.underline ? 'underline' : 'none',
                        textAlign: textBox.textAlign,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        direction: textBox.textDirection || 'ltr'
                      }}
                    >
                      {textBox.text}
                    </span>
                  )}
                </div>
              </Rnd>
            ))}
          </div>
        </div>

        {/* Right Panel - Properties */}
        <div style={{
          width: '280px',
          borderLeft: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(0,0,0,0.2)',
          padding: '16px',
          overflowY: 'auto'
        }}>
          {selectedTextBox ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '14px' }}>Text Properties</h3>
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

              {/* Text Content */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>
                  Text
                </label>
                <textarea
                  value={selectedTextBox.text}
                  onChange={(e) => updateTextBox(selectedTextBox.id, { text: e.target.value })}
                  dir={selectedTextBox.textDirection || 'ltr'}
                  style={{
                    width: '100%',
                    height: '80px',
                    padding: '8px',
                    borderRadius: '4px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(0,0,0,0.3)',
                    color: 'white',
                    resize: 'vertical',
                    direction: selectedTextBox.textDirection || 'ltr',
                    textAlign: selectedTextBox.textDirection === 'rtl' ? 'right' : 'left'
                  }}
                />
              </div>

              {/* Font Size */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>
                  Font Size: {selectedTextBox.fontSize}%
                </label>
                <input
                  type="range"
                  min="50"
                  max="300"
                  value={selectedTextBox.fontSize}
                  onChange={(e) => updateTextBox(selectedTextBox.id, { fontSize: parseInt(e.target.value) })}
                  style={{ width: '100%' }}
                />
              </div>

              {/* Text Color */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>
                  Text Color
                </label>
                <input
                  type="color"
                  value={selectedTextBox.color}
                  onChange={(e) => updateTextBox(selectedTextBox.id, { color: e.target.value })}
                  style={{ width: '50px', height: '32px', padding: '2px', borderRadius: '4px', cursor: 'pointer' }}
                />
              </div>

              {/* Background Color */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>
                  Background
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="color"
                    value={selectedTextBox.backgroundColor === 'transparent' ? '#000000' : selectedTextBox.backgroundColor}
                    onChange={(e) => updateTextBox(selectedTextBox.id, { backgroundColor: e.target.value })}
                    style={{ width: '50px', height: '32px', padding: '2px', borderRadius: '4px', cursor: 'pointer' }}
                  />
                  <button
                    onClick={() => updateTextBox(selectedTextBox.id, { backgroundColor: 'transparent' })}
                    style={{
                      padding: '6px 12px',
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
              </div>

              {/* Text Style */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>
                  Style
                </label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    onClick={() => updateTextBox(selectedTextBox.id, { bold: !selectedTextBox.bold })}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '4px',
                      border: selectedTextBox.bold ? '2px solid #00d4ff' : '1px solid rgba(255,255,255,0.2)',
                      background: selectedTextBox.bold ? 'rgba(0,212,255,0.15)' : 'transparent',
                      color: 'white',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    B
                  </button>
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

              {/* Text Direction (RTL/LTR) */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>
                  Text Direction
                </label>
                <div style={{ display: 'flex', gap: '4px' }}>
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
                    LTR ←
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
                    → RTL
                  </button>
                </div>
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
                  Use RTL for Hebrew/Arabic text
                </div>
              </div>

              {/* Text Alignment */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>
                  Horizontal Align
                </label>
                <div style={{ display: 'flex', gap: '4px' }}>
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

              {/* Vertical Alignment */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>
                  Vertical Align
                </label>
                <div style={{ display: 'flex', gap: '4px' }}>
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
                <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>
                  Opacity: {Math.round(selectedTextBox.opacity * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={selectedTextBox.opacity * 100}
                  onChange={(e) => updateTextBox(selectedTextBox.id, { opacity: parseInt(e.target.value) / 100 })}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          ) : selectedImageBox ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '14px' }}>Image Properties</h3>
                <button
                  onClick={() => deleteImageBox(selectedImageBox.id)}
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

              {/* Image preview */}
              <div style={{ marginBottom: '16px' }}>
                <img
                  src={selectedImageBox.src}
                  alt=""
                  style={{
                    width: '100%',
                    height: '100px',
                    objectFit: 'contain',
                    borderRadius: '6px',
                    background: 'rgba(0,0,0,0.3)'
                  }}
                />
              </div>

              {/* Object Fit */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>
                  Fit Mode
                </label>
                <div style={{ display: 'flex', gap: '4px' }}>
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

              {/* Opacity */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>
                  Opacity: {Math.round(selectedImageBox.opacity * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={selectedImageBox.opacity * 100}
                  onChange={(e) => updateImageBox(selectedImageBox.id, { opacity: parseInt(e.target.value) / 100 })}
                  style={{ width: '100%' }}
                />
              </div>

              {/* Border Radius */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>
                  Corner Radius: {selectedImageBox.borderRadius}px
                </label>
                <input
                  type="range"
                  min="0"
                  max="50"
                  value={selectedImageBox.borderRadius}
                  onChange={(e) => updateImageBox(selectedImageBox.id, { borderRadius: parseInt(e.target.value) })}
                  style={{ width: '100%' }}
                />
              </div>

              {/* Replace Image */}
              <button
                onClick={() => imageInputRef.current?.click()}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: 'transparent',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                Replace Image
              </button>
            </div>
          ) : (
            <div>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '14px' }}>Slide Properties</h3>

              {/* Slide Background */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>
                  Background Color
                </label>
                <input
                  type="color"
                  value={currentSlide?.backgroundColor || '#1a1a2e'}
                  onChange={(e) => updateSlideBackground(e.target.value)}
                  style={{ width: '50px', height: '32px', padding: '2px', borderRadius: '4px', cursor: 'pointer' }}
                />
              </div>

              {/* Color presets */}
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '16px' }}>
                {['#000000', '#1a1a2e', '#16213e', '#0f0f23', '#1e3a5f', '#2c3e50', '#1b4f72', '#ffffff'].map(color => (
                  <button
                    key={color}
                    onClick={() => updateSlideBackground(color)}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '4px',
                      border: currentSlide?.backgroundColor === color ? '2px solid #00d4ff' : '1px solid rgba(255,255,255,0.2)',
                      background: color,
                      cursor: 'pointer'
                    }}
                  />
                ))}
              </div>

              {/* Duplicate Slide */}
              <button
                onClick={() => duplicateSlide(currentSlideIndex)}
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
                Duplicate Slide
              </button>

              {/* Layers Panel */}
              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' }}>
                  Layers
                </h4>
                <div style={{
                  background: 'rgba(0,0,0,0.3)',
                  borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  maxHeight: '200px',
                  overflowY: 'auto'
                }}>
                  {getLayers().length === 0 ? (
                    <div style={{ padding: '12px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>
                      No elements
                    </div>
                  ) : (
                    getLayers().map((layer, idx) => {
                      const isSelected = (layer.type === 'text' && selectedTextBoxId === layer.id) ||
                                        (layer.type === 'image' && selectedImageBoxId === layer.id);
                      const isFirst = idx === 0;
                      const isLast = idx === getLayers().length - 1;
                      const isDragging = draggedLayerId === layer.id;
                      const isDropTarget = dropTargetId === layer.id;

                      return (
                        <div
                          key={layer.id}
                          draggable
                          onDragStart={(e) => {
                            setDraggedLayerId(layer.id);
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          onDragEnd={() => {
                            setDraggedLayerId(null);
                            setDropTargetId(null);
                            setDropPosition(null);
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            if (draggedLayerId && draggedLayerId !== layer.id) {
                              const rect = e.currentTarget.getBoundingClientRect();
                              const midY = rect.top + rect.height / 2;
                              const position = e.clientY < midY ? 'before' : 'after';
                              setDropTargetId(layer.id);
                              setDropPosition(position);
                            }
                          }}
                          onDragLeave={() => {
                            if (dropTargetId === layer.id) {
                              setDropTargetId(null);
                              setDropPosition(null);
                            }
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (draggedLayerId && draggedLayerId !== layer.id) {
                              const rect = e.currentTarget.getBoundingClientRect();
                              const midY = rect.top + rect.height / 2;
                              const insertBefore = e.clientY < midY;
                              reorderLayers(draggedLayerId, layer.id, insertBefore);
                            }
                            setDraggedLayerId(null);
                            setDropTargetId(null);
                            setDropPosition(null);
                          }}
                          onClick={() => {
                            if (layer.type === 'text') {
                              setSelectedTextBoxId(layer.id);
                              setSelectedImageBoxId(null);
                            } else {
                              setSelectedImageBoxId(layer.id);
                              setSelectedTextBoxId(null);
                            }
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 10px',
                            borderBottom: isDropTarget && dropPosition === 'after' ? '2px solid #00d4ff' : '1px solid rgba(255,255,255,0.05)',
                            borderTop: isDropTarget && dropPosition === 'before' ? '2px solid #00d4ff' : 'none',
                            background: isSelected ? 'rgba(0, 212, 255, 0.15)' : 'transparent',
                            opacity: isDragging ? 0.5 : 1,
                            cursor: 'grab'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                            {/* Type icon */}
                            <span style={{ fontSize: '12px', opacity: 0.6 }}>
                              {layer.type === 'text' ? 'T' : '🖼'}
                            </span>
                            {/* Name */}
                            <span style={{
                              fontSize: '11px',
                              color: isSelected ? '#00d4ff' : 'rgba(255,255,255,0.8)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {layer.name}
                            </span>
                          </div>
                          {/* Layer controls */}
                          <div style={{ display: 'flex', gap: '2px' }}>
                            <button
                              onClick={(e) => { e.stopPropagation(); moveLayerToFront(layer.id, layer.type); }}
                              disabled={isFirst}
                              title="Bring to front"
                              style={{
                                width: '20px',
                                height: '20px',
                                border: 'none',
                                background: 'transparent',
                                color: isFirst ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.6)',
                                cursor: isFirst ? 'default' : 'pointer',
                                fontSize: '10px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              ⇈
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); moveLayerUp(layer.id, layer.type); }}
                              disabled={isFirst}
                              title="Move up"
                              style={{
                                width: '20px',
                                height: '20px',
                                border: 'none',
                                background: 'transparent',
                                color: isFirst ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.6)',
                                cursor: isFirst ? 'default' : 'pointer',
                                fontSize: '10px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              ↑
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); moveLayerDown(layer.id, layer.type); }}
                              disabled={isLast}
                              title="Move down"
                              style={{
                                width: '20px',
                                height: '20px',
                                border: 'none',
                                background: 'transparent',
                                color: isLast ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.6)',
                                cursor: isLast ? 'default' : 'pointer',
                                fontSize: '10px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              ↓
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); moveLayerToBack(layer.id, layer.type); }}
                              disabled={isLast}
                              title="Send to back"
                              style={{
                                width: '20px',
                                height: '20px',
                                border: 'none',
                                background: 'transparent',
                                color: isLast ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.6)',
                                cursor: isLast ? 'default' : 'pointer',
                                fontSize: '10px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              ⇊
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div style={{
                padding: '12px',
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '8px',
                textAlign: 'center',
                color: 'rgba(255,255,255,0.5)',
                fontSize: '12px'
              }}>
                Click on an element to edit its properties
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PresentationEditorPage;
