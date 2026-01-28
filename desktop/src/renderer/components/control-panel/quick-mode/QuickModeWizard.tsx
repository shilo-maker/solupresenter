import React, { memo, useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { hebrewBookNames, numberToHebrew } from '../../../utils/bibleUtils';

// ========== Types ==========

interface QuickModeTextBox {
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
  fontWeight?: string;
  backgroundOpacity?: number;
  visible?: boolean;
  borderTop?: number;
  borderRight?: number;
  borderBottom?: number;
  borderLeft?: number;
  borderColor?: string;
  borderRadiusTopLeft?: number;
  borderRadiusTopRight?: number;
  borderRadiusBottomRight?: number;
  borderRadiusBottomLeft?: number;
  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;
  positionMode?: 'absolute' | 'flow';
  flowAnchor?: string;
  flowGap?: number;
  autoHeight?: boolean;
  growDirection?: 'up' | 'down';
}

interface QuickModeSlide {
  id: string;
  order: number;
  textBoxes: QuickModeTextBox[];
  imageBoxes: any[];
  backgroundBoxes?: any[];
  backgroundColor: string;
  backgroundGradient?: string;
  backgroundType?: 'color' | 'gradient' | 'transparent';
}

interface QuickModeSubtitle {
  subtitle: string;
  subtitleTranslation?: string;
  description: string;
  descriptionTranslation?: string;
  bibleRef?: {
    book: string;
    chapter: number;
    verseStart: number;
    verseEnd?: number;
    hebrewText: string;
    englishText: string;
    reference: string;
    hebrewReference: string;
    useHebrew: boolean;
  };
}

interface QuickModeDataForSlides {
  type: 'sermon' | 'prayer' | 'announcements';
  title: string;
  name?: string;
  titleTranslation?: string;
  subtitles: Array<{
    subtitle: string;
    subtitleTranslation?: string;
    description: string;
    descriptionTranslation?: string;
    bibleRef?: {
      book: string;
      chapter: number;
      verseStart: number;
      verseEnd?: number;
      hebrewText: string;
      englishText: string;
      reference: string;
      hebrewReference: string;
      useHebrew: boolean;
    };
  }>;
  generateTranslation?: boolean;
}

interface BibleBook {
  name: string;
  chapters: number;
}

interface BibleVerse {
  verseNumber: number;
  hebrew: string;
  english: string;
  reference: string;
  hebrewReference: string;
}

// ========== Helper Functions ==========

let quickModeIdCounter = 0;
const generateQuickModeId = (): string => {
  quickModeIdCounter++;
  return `qm_${Date.now()}_${quickModeIdCounter}_${Math.random().toString(36).substring(2, 11)}`;
};

const containsHebrew = (text: string): boolean => /[\u0590-\u05FF]/.test(text);

const hebrewToNumber = (hebrewStr: string): number | null => {
  const cleaned = hebrewStr.replace(/[""״׳']/g, '');
  const hebrewValues: Record<string, number> = {
    'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9,
    'י': 10, 'כ': 20, 'ך': 20, 'ל': 30, 'מ': 40, 'ם': 40, 'נ': 50, 'ן': 50,
    'ס': 60, 'ע': 70, 'פ': 80, 'ף': 80, 'צ': 90, 'ץ': 90,
    'ק': 100, 'ר': 200, 'ש': 300, 'ת': 400
  };
  let total = 0;
  for (const char of cleaned) {
    if (hebrewValues[char]) {
      total += hebrewValues[char];
    }
  }
  return total > 0 ? total : null;
};

const createQuickModeSlides = (data: QuickModeDataForSlides): QuickModeSlide[] => {
  const backgroundColor = data.type === 'sermon' ? '#1a1a2e' :
                          data.type === 'prayer' ? '#000000' : '#2d1f3d';

  const isBilingual = data.generateTranslation || false;

  return data.subtitles.map((item, index) => {
    const subtitlePrefix = data.type === 'sermon' ? `${index + 1}. ` :
                           data.type === 'prayer' ? '• ' : '';

    const hasBibleRef = !!item.bibleRef;
    const textBoxes: QuickModeTextBox[] = [];

    const subtitleIsHebrew = containsHebrew(item.subtitle);
    const titleIsHebrew = containsHebrew(data.title);

    if (isBilingual) {
      const titleY = 4;
      const subtitleY = 14;
      const bibleRefY = 24;
      const bibleTextY = 32;

      // Left side (English)
      textBoxes.push({
        id: generateQuickModeId(),
        text: titleIsHebrew ? (data.titleTranslation || '[Title Translation]') : data.title,
        x: 2, y: titleY, width: 46, height: 10, fontSize: 120,
        color: '#ffffff', backgroundColor: 'transparent',
        textAlign: 'left', verticalAlign: 'center',
        bold: true, italic: false, underline: false, opacity: 1, zIndex: 10, textDirection: 'ltr'
      });

      textBoxes.push({
        id: generateQuickModeId(),
        text: subtitleIsHebrew
          ? (item.subtitleTranslation || `${subtitlePrefix}[Translation]`)
          : `${subtitlePrefix}${item.subtitle}`,
        x: 2, y: subtitleY, width: 46, height: 8, fontSize: 90,
        color: '#ffffff', backgroundColor: 'transparent',
        textAlign: 'left', verticalAlign: 'center',
        bold: false, italic: false, underline: false, opacity: 1, zIndex: 9, textDirection: 'ltr'
      });

      if (hasBibleRef && item.bibleRef) {
        textBoxes.push({
          id: generateQuickModeId(),
          text: `\u{1F4D6} ${item.bibleRef.reference}`,
          x: 2, y: bibleRefY, width: 46, height: 5, fontSize: 55,
          color: '#00d4ff', backgroundColor: 'transparent',
          textAlign: 'left', verticalAlign: 'center',
          bold: true, italic: false, underline: false, opacity: 1, zIndex: 8, textDirection: 'ltr'
        });

        textBoxes.push({
          id: generateQuickModeId(),
          text: item.bibleRef.englishText || item.bibleRef.hebrewText || '',
          x: 2, y: bibleTextY, width: 46, height: 60, fontSize: 55,
          color: 'rgba(255,255,255,0.9)', backgroundColor: 'transparent',
          textAlign: 'left', verticalAlign: 'top',
          bold: false, italic: true, underline: false, opacity: 1, zIndex: 7, textDirection: 'ltr'
        });
      }

      // Right side (Hebrew)
      textBoxes.push({
        id: generateQuickModeId(),
        text: data.title,
        x: 52, y: titleY, width: 46, height: 10, fontSize: 120,
        color: '#ffffff', backgroundColor: 'transparent',
        textAlign: 'right', verticalAlign: 'center',
        bold: true, italic: false, underline: false, opacity: 1, zIndex: 10, textDirection: 'rtl'
      });

      textBoxes.push({
        id: generateQuickModeId(),
        text: subtitleIsHebrew
          ? `${subtitlePrefix}${item.subtitle}`
          : (item.subtitleTranslation || `${subtitlePrefix}${item.subtitle}`),
        x: 52, y: subtitleY, width: 46, height: 8, fontSize: 90,
        color: '#ffffff', backgroundColor: 'transparent',
        textAlign: 'right', verticalAlign: 'center',
        bold: false, italic: false, underline: false, opacity: 1, zIndex: 9, textDirection: 'rtl'
      });

      if (hasBibleRef && item.bibleRef) {
        textBoxes.push({
          id: generateQuickModeId(),
          text: `\u{1F4D6} ${item.bibleRef.hebrewReference || item.bibleRef.reference}`,
          x: 52, y: bibleRefY, width: 46, height: 5, fontSize: 55,
          color: '#00d4ff', backgroundColor: 'transparent',
          textAlign: 'right', verticalAlign: 'center',
          bold: true, italic: false, underline: false, opacity: 1, zIndex: 8, textDirection: 'rtl'
        });

        textBoxes.push({
          id: generateQuickModeId(),
          text: item.bibleRef.hebrewText || item.bibleRef.englishText || '',
          x: 52, y: bibleTextY, width: 46, height: 60, fontSize: 55,
          color: 'rgba(255,255,255,0.9)', backgroundColor: 'transparent',
          textAlign: 'right', verticalAlign: 'top',
          bold: false, italic: false, underline: false, opacity: 1, zIndex: 7, textDirection: 'rtl'
        });
      }
    } else {
      // Single language layout
      const hasDescription = item.description.trim().length > 0;
      let subtitleY = 30;
      let descriptionY = 55;
      let bibleRefY = hasDescription ? 75 : 55;
      let bibleTextY = hasDescription ? 82 : 62;

      if (!hasDescription && hasBibleRef) {
        bibleRefY = 50;
        bibleTextY = 58;
      }

      const useRTL = subtitleIsHebrew;

      textBoxes.push({
        id: generateQuickModeId(),
        text: data.title,
        x: 5, y: 5, width: 90, height: 15, fontSize: 140,
        color: '#ffffff', backgroundColor: 'transparent',
        textAlign: useRTL ? 'right' : 'left', verticalAlign: 'center',
        bold: true, italic: false, underline: false, opacity: 1, zIndex: 5,
        textDirection: useRTL ? 'rtl' : 'ltr'
      });

      textBoxes.push({
        id: generateQuickModeId(),
        text: `${subtitlePrefix}${item.subtitle}`,
        x: 5, y: subtitleY, width: 90, height: 18, fontSize: 110,
        color: '#ffffff', backgroundColor: 'transparent',
        textAlign: useRTL ? 'right' : (data.type === 'announcements' ? 'center' : 'left'),
        verticalAlign: 'center',
        bold: false, italic: false, underline: false, opacity: 1, zIndex: 4,
        textDirection: useRTL ? 'rtl' : 'ltr'
      });

      if (hasDescription) {
        textBoxes.push({
          id: generateQuickModeId(),
          text: item.description,
          x: 5, y: descriptionY, width: 90, height: hasBibleRef ? 18 : 35, fontSize: 80,
          color: 'rgba(255,255,255,0.85)', backgroundColor: 'transparent',
          textAlign: useRTL ? 'right' : (data.type === 'announcements' ? 'center' : 'left'),
          verticalAlign: 'top',
          bold: false, italic: false, underline: false, opacity: 1, zIndex: 3,
          textDirection: useRTL ? 'rtl' : 'ltr'
        });
      }

      if (hasBibleRef && item.bibleRef) {
        const bibleUseHebrew = item.bibleRef.useHebrew || false;
        const displayText = bibleUseHebrew
          ? (item.bibleRef.hebrewText || item.bibleRef.englishText || '')
          : (item.bibleRef.englishText || item.bibleRef.hebrewText || '');
        const displayReference = bibleUseHebrew
          ? (item.bibleRef.hebrewReference || item.bibleRef.reference)
          : item.bibleRef.reference;

        textBoxes.push({
          id: generateQuickModeId(),
          text: `\u{1F4D6} ${displayReference}`,
          x: 5, y: bibleRefY, width: 90, height: 6, fontSize: 60,
          color: '#00d4ff', backgroundColor: 'transparent',
          textAlign: bibleUseHebrew ? 'right' : 'left', verticalAlign: 'center',
          bold: true, italic: false, underline: false, opacity: 1, zIndex: 2,
          textDirection: bibleUseHebrew ? 'rtl' : 'ltr'
        });

        textBoxes.push({
          id: generateQuickModeId(),
          text: displayText,
          x: 5, y: bibleTextY, width: 90, height: 18, fontSize: 65,
          color: 'rgba(255,255,255,0.9)', backgroundColor: 'transparent',
          textAlign: bibleUseHebrew ? 'right' : 'left', verticalAlign: 'top',
          bold: false, italic: !bibleUseHebrew, underline: false, opacity: 1, zIndex: 1,
          textDirection: bibleUseHebrew ? 'rtl' : 'ltr'
        });
      }
    }

    return {
      id: generateQuickModeId(),
      order: index,
      textBoxes,
      imageBoxes: [],
      backgroundColor
    };
  });
};

// ========== Component Props ==========

interface QuickModeWizardProps {
  bibleBooks: BibleBook[];
  onClose: () => void;
  onPresentationCreated?: () => void;
  initialType?: 'sermon' | 'prayer' | 'announcements' | null;
  initialStep?: number;
}

// ========== Component ==========

const QuickModeWizard = memo<QuickModeWizardProps>(({
  bibleBooks,
  onClose,
  onPresentationCreated,
  initialType = null,
  initialStep = 1
}) => {
  const { t } = useTranslation();

  // Wizard state
  const [step, setStep] = useState(initialStep);
  const [type, setType] = useState<'sermon' | 'prayer' | 'announcements' | null>(initialType);
  const [title, setTitle] = useState('');
  const [titleTranslation, setTitleTranslation] = useState('');
  const [subtitles, setSubtitles] = useState<QuickModeSubtitle[]>([{ subtitle: '', description: '' }]);
  const [translationMode, setTranslationMode] = useState<'none' | 'auto' | 'manual'>('none');
  const [creating, setCreating] = useState(false);

  // Bible picker state
  const [biblePickerIndex, setBiblePickerIndex] = useState<number | null>(null);
  const [bibleSearch, setBibleSearch] = useState('');
  const [bibleVerses, setBibleVerses] = useState<BibleVerse[]>([]);
  const [bibleBook, setBibleBook] = useState('');
  const [bibleChapter, setBibleChapter] = useState<number | null>(null);
  const [verseStart, setVerseStart] = useState<number | null>(null);
  const [verseEnd, setVerseEnd] = useState<number | null>(null);
  const [bibleLoading, setBibleLoading] = useState(false);
  const [booksLoading, setBooksLoading] = useState(false);
  const [bibleNoMatch, setBibleNoMatch] = useState(false);
  const [bibleIsHebrew, setBibleIsHebrew] = useState(false);
  const [showBibleSuggestions, setShowBibleSuggestions] = useState(false);
  const [selectedBibleSuggestionIndex, setSelectedBibleSuggestionIndex] = useState(-1);

  // Refs
  const bibleSearchRef = useRef<string>('');
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Focus title input when entering step 2
  useEffect(() => {
    if (step === 2 && titleInputRef.current) {
      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 100);
    }
  }, [step]);

  // Check if form has unsaved changes
  const hasUnsavedChanges = (): boolean => {
    // Check if user has entered any data
    if (title.trim()) return true;
    if (subtitles.some(s => s.subtitle.trim() || s.description.trim() || s.bibleRef)) return true;
    if (type && step > 1) return true;
    return false;
  };

  // Reset wizard
  const resetWizard = (skipConfirmation = false) => {
    if (!skipConfirmation && hasUnsavedChanges()) {
      const confirmed = window.confirm('You have unsaved changes. Are you sure you want to discard them?');
      if (!confirmed) return;
    }
    setStep(1);
    setType(null);
    setTitle('');
    setTitleTranslation('');
    setSubtitles([{ subtitle: '', description: '' }]);
    setBiblePickerIndex(null);
    setBibleSearch('');
    bibleSearchRef.current = '';
    setBibleVerses([]);
    setBibleBook('');
    setBibleChapter(null);
    setVerseStart(null);
    setVerseEnd(null);
    setBibleNoMatch(false);
    setBibleLoading(false);
    setBibleIsHebrew(false);
    setTranslationMode('none');
    setCreating(false);
    onClose();
  };

  // Generate Bible autocomplete suggestions
  const bibleSuggestions = useMemo(() => {
    const input = bibleSearch.trim().toLowerCase();
    if (!input || input.length < 1 || !bibleBooks || bibleBooks.length === 0) return [];

    const results: Array<{ display: string; value: string; bookName: string; chapter: number }> = [];
    const maxSuggestions = 8;

    // Check if input contains a number (chapter reference)
    const arabicMatch = input.match(/^(.+?)\s+(\d+)$/);
    const hebrewMatch = input.match(/^(.+?)\s+([א-ת]+)$/);

    let bookPart = input;
    let chapterPart: number | null = null;

    if (arabicMatch) {
      bookPart = arabicMatch[1].trim();
      chapterPart = parseInt(arabicMatch[2]);
    } else if (hebrewMatch) {
      bookPart = hebrewMatch[1].trim();
      const hebrewNum = hebrewMatch[2];
      const hebrewValues: Record<string, number> = {
        'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9,
        'י': 10, 'כ': 20, 'ל': 30, 'מ': 40, 'נ': 50
      };
      let total = 0;
      for (const char of hebrewNum) {
        if (hebrewValues[char]) total += hebrewValues[char];
      }
      if (total > 0) chapterPart = total;
    }

    for (const book of bibleBooks) {
      if (results.length >= maxSuggestions) break;

      const englishLower = book.name.toLowerCase();
      const hebrewName = book.hebrewName || '';

      const matchesEnglish = englishLower.startsWith(bookPart) || englishLower.includes(bookPart);
      const matchesHebrew = hebrewName && (hebrewName.startsWith(bookPart) || hebrewName.includes(bookPart));

      let matchesHebrewMapping = false;
      for (const [hebrew, english] of Object.entries(hebrewBookNames)) {
        if (english.toLowerCase() === englishLower && hebrew.startsWith(bookPart)) {
          matchesHebrewMapping = true;
          break;
        }
      }

      if (matchesEnglish || matchesHebrew || matchesHebrewMapping) {
        if (chapterPart !== null && chapterPart >= 1 && chapterPart <= book.chapters) {
          results.push({
            display: `${book.hebrewName || book.name} ${numberToHebrew(chapterPart)} (${book.name} ${chapterPart})`,
            value: `${book.name} ${chapterPart}`,
            bookName: book.name,
            chapter: chapterPart
          });
        } else if (chapterPart === null) {
          const chaptersToShow = Math.min(3, book.chapters);
          for (let ch = 1; ch <= chaptersToShow && results.length < maxSuggestions; ch++) {
            results.push({
              display: `${book.hebrewName || book.name} ${numberToHebrew(ch)} (${book.name} ${ch})`,
              value: `${book.name} ${ch}`,
              bookName: book.name,
              chapter: ch
            });
          }
        }
      }
    }

    return results;
  }, [bibleSearch, bibleBooks]);

  // Bible search handler (called on input change)
  const handleBibleSearch = async (query: string, fromSuggestion = false) => {
    setBibleSearch(query);
    if (!fromSuggestion) {
      setShowBibleSuggestions(query.trim().length > 0);
      setSelectedBibleSuggestionIndex(-1);
    }
    bibleSearchRef.current = query;
    const trimmed = query.trim();

    if (trimmed === '') {
      setBibleVerses([]);
      setBibleBook('');
      setBibleChapter(null);
      setVerseStart(null);
      setVerseEnd(null);
      setBibleNoMatch(false);
      setBibleLoading(false);
      setBibleIsHebrew(false);
      return;
    }

    const parseVerses = (verseStr: string): { start: number | null; end: number | null } => {
      if (!verseStr) return { start: null, end: null };
      const parts = verseStr.replace(/\s/g, '').split(',').filter(Boolean);
      const allVerses: number[] = [];
      for (const part of parts) {
        if (part.includes('-')) {
          const [startStr, endStr] = part.split('-');
          const start = parseInt(startStr);
          const end = parseInt(endStr);
          if (!isNaN(start)) allVerses.push(start);
          if (!isNaN(end)) allVerses.push(end);
        } else {
          const num = parseInt(part);
          if (!isNaN(num)) allVerses.push(num);
        }
      }
      if (allVerses.length === 0) return { start: null, end: null };
      if (allVerses.length === 1) return { start: allVerses[0], end: null };
      return { start: Math.min(...allVerses), end: Math.max(...allVerses) };
    };

    const hasHebrewChars = (str: string) => /[\u0590-\u05FF]/.test(str);

    let bookNameRaw: string;
    let chapterNum: number;
    let verseStartFromQuery: number | null = null;
    let verseEndFromQuery: number | null = null;
    let isHebrewSearch = false;

    const matchArabic = trimmed.match(/^(.+?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/);
    const matchHebrewFull = trimmed.match(/^(.+?)\s+([א-ת]+["״׳']?)(?:[\s:](.+))?$/);

    if (matchArabic && !hasHebrewChars(matchArabic[1])) {
      bookNameRaw = matchArabic[1].trim().toLowerCase();
      chapterNum = parseInt(matchArabic[2]);
      verseStartFromQuery = matchArabic[3] ? parseInt(matchArabic[3]) : null;
      verseEndFromQuery = matchArabic[4] ? parseInt(matchArabic[4]) : null;
      isHebrewSearch = false;
    } else if (matchHebrewFull) {
      bookNameRaw = matchHebrewFull[1].trim();
      const hebrewChapter = matchHebrewFull[2].replace(/["״׳']/g, '');
      const hebrewNum = hebrewToNumber(hebrewChapter);
      if (!hebrewNum) {
        setBibleNoMatch(trimmed.length > 2);
        setBibleLoading(false);
        return;
      }
      chapterNum = hebrewNum;
      if (matchHebrewFull[3]) {
        const parsed = parseVerses(matchHebrewFull[3]);
        verseStartFromQuery = parsed.start;
        verseEndFromQuery = parsed.end;
      }
      isHebrewSearch = true;
    } else {
      setBibleNoMatch(trimmed.length > 2);
      setBibleLoading(false);
      return;
    }

    let searchName = bookNameRaw.toLowerCase();
    const hebrewBookMatch = Object.keys(hebrewBookNames).find(heb =>
      heb === bookNameRaw || heb.startsWith(bookNameRaw) || bookNameRaw.startsWith(heb)
    );
    if (hebrewBookMatch) {
      searchName = hebrewBookNames[hebrewBookMatch].toLowerCase();
      isHebrewSearch = true;
    }

    setBibleIsHebrew(isHebrewSearch);

    let matchedBook = bibleBooks.find(b => b.name.toLowerCase() === searchName);
    if (!matchedBook) {
      matchedBook = bibleBooks.find(b => b.name.toLowerCase().startsWith(searchName));
    }
    if (!matchedBook) {
      matchedBook = bibleBooks.find(b => b.name.toLowerCase().includes(searchName));
    }

    if (matchedBook && chapterNum >= 1 && chapterNum <= matchedBook.chapters) {
      setBibleNoMatch(false);
      setBibleBook(matchedBook.name);
      setBibleChapter(chapterNum);
      setBibleVerses([]);
      setVerseStart(null);
      setVerseEnd(null);

      setBibleLoading(true);
      try {
        const response = await window.electronAPI.getBibleVerses(matchedBook.name, chapterNum);
        const verses = response?.verses || [];

        if (bibleSearchRef.current !== query) return;

        setBibleVerses(verses);

        if (verseStartFromQuery && verses.some((v: BibleVerse) => v.verseNumber === verseStartFromQuery)) {
          setVerseStart(verseStartFromQuery);
          if (verseEndFromQuery && verseEndFromQuery > verseStartFromQuery &&
              verses.some((v: BibleVerse) => v.verseNumber === verseEndFromQuery)) {
            setVerseEnd(verseEndFromQuery);
          } else {
            setVerseEnd(null);
          }
        } else {
          setVerseStart(null);
          setVerseEnd(null);
        }
      } catch (error) {
        console.error('Error fetching Bible verses:', error);
        if (bibleSearchRef.current === query) {
          setBibleVerses([]);
          setVerseStart(null);
          setVerseEnd(null);
          setBibleLoading(false);
        }
        return;
      }
      if (bibleSearchRef.current === query) {
        setBibleLoading(false);
      }
    } else {
      setBibleNoMatch(true);
      setBibleBook('');
      setBibleChapter(null);
      setBibleVerses([]);
      setBibleLoading(false);
    }
  };

  // Add Bible reference to subtitle
  const addBibleRefToSubtitle = (index: number) => {
    if (!bibleBook || !bibleChapter || !verseStart || bibleVerses.length === 0) return;

    const startVerse = bibleVerses.find(v => v.verseNumber === verseStart);
    if (!startVerse) return;

    let hebrewText = '';
    let englishText = '';
    let reference = `${bibleBook} ${bibleChapter}:${verseStart}`;
    let hebrewReference = '';

    const baseHebrewRef = startVerse.hebrewReference?.replace(/:.*$/, '') || '';

    if (verseEnd && verseEnd > verseStart) {
      const versesInRange = bibleVerses.filter(
        v => v.verseNumber >= verseStart! && v.verseNumber <= verseEnd!
      );
      hebrewText = versesInRange.map(v => v.hebrew || '').filter(Boolean).join(' ');
      englishText = versesInRange.map(v => v.english || '').filter(Boolean).join(' ');
      reference = `${bibleBook} ${bibleChapter}:${verseStart}-${verseEnd}`;
      hebrewReference = `${baseHebrewRef}:${verseStart}-${verseEnd}`;
    } else {
      hebrewText = startVerse.hebrew || '';
      englishText = startVerse.english || '';
      hebrewReference = startVerse.hebrewReference || '';
    }

    setSubtitles(prev => prev.map((s, i) =>
      i === index ? {
        ...s,
        bibleRef: {
          book: bibleBook,
          chapter: bibleChapter!,
          verseStart: verseStart!,
          verseEnd: verseEnd || undefined,
          hebrewText,
          englishText,
          reference,
          hebrewReference,
          useHebrew: bibleIsHebrew
        }
      } : s
    ));

    // Reset picker state
    setBiblePickerIndex(null);
    setBibleSearch('');
    bibleSearchRef.current = '';
    setBibleVerses([]);
    setBibleBook('');
    setBibleChapter(null);
    setVerseStart(null);
    setBibleNoMatch(false);
    setVerseEnd(null);
    setBibleLoading(false);
    setBibleIsHebrew(false);
  };

  // Remove Bible reference from subtitle
  const removeBibleRefFromSubtitle = (index: number) => {
    setSubtitles(prev => prev.map((s, i) =>
      i === index ? { ...s, bibleRef: undefined } : s
    ));
  };

  // Create presentation
  const handleCreate = async () => {
    const validSubtitles = subtitles.filter(s => s.subtitle.trim());
    if (validSubtitles.length === 0 || !type || !title.trim()) return;

    setCreating(true);

    try {
      const typeLabel = type === 'sermon' ? t('quickMode.sermonLabel') : type === 'prayer' ? t('quickMode.prayerLabel') : t('quickMode.announcementsLabel');
      const presentationName = `${typeLabel}: ${title}`;

      let translatedSubtitles = validSubtitles.map(s => ({
        subtitle: s.subtitle,
        subtitleTranslation: s.subtitleTranslation,
        description: s.description,
        descriptionTranslation: s.descriptionTranslation,
        bibleRef: s.bibleRef
      }));
      let finalTitleTranslation: string | undefined = translationMode === 'manual' ? titleTranslation : undefined;

      let translationFailures = 0;

      // Auto-generate translations
      if (translationMode === 'auto') {
        if (containsHebrew(title.trim())) {
          try {
            const translation = await window.electronAPI.translate(title.trim());
            if (translation && translation !== title.trim()) {
              finalTitleTranslation = translation;
            }
          } catch (err) {
            console.error('Failed to translate title:', err);
            translationFailures++;
          }
        }

        translatedSubtitles = await Promise.all(
          validSubtitles.map(async (item) => {
            let subtitleTranslation: string | undefined = item.subtitleTranslation;
            let descriptionTranslation: string | undefined = item.descriptionTranslation;

            if (containsHebrew(item.subtitle) && !item.subtitleTranslation) {
              try {
                const translation = await window.electronAPI.translate(item.subtitle);
                if (translation && translation !== item.subtitle) {
                  subtitleTranslation = translation;
                }
              } catch (err) {
                console.error('Failed to translate subtitle:', err);
                translationFailures++;
              }
            }

            if (item.description && containsHebrew(item.description) && !item.descriptionTranslation) {
              try {
                const translation = await window.electronAPI.translate(item.description);
                if (translation && translation !== item.description) {
                  descriptionTranslation = translation;
                }
              } catch (err) {
                console.error('Failed to translate description:', err);
                translationFailures++;
              }
            }

            return {
              subtitle: item.subtitle,
              subtitleTranslation,
              description: item.description,
              descriptionTranslation,
              bibleRef: item.bibleRef
            };
          })
        );

        if (translationFailures > 0) {
          alert(`${translationFailures} translation(s) failed. The presentation was created with placeholder text where translations could not be generated.`);
        }
      }

      const generateTranslation = translationMode !== 'none';

      const quickModeData: QuickModeDataForSlides = {
        type,
        title: title.trim(),
        titleTranslation: finalTitleTranslation,
        subtitles: translatedSubtitles,
        generateTranslation
      };

      const slides = createQuickModeSlides(quickModeData);

      const presentationData = {
        title: presentationName,
        slides: slides,
        canvasDimensions: { width: 1920, height: 1080 },
        quickModeData: {
          type: quickModeData.type,
          title: quickModeData.title,
          titleTranslation: quickModeData.titleTranslation,
          generateTranslation,
          subtitles: translatedSubtitles
        }
      };

      await window.electronAPI.createPresentation(presentationData);

      setCreating(false);
      onPresentationCreated?.();
      resetWizard(true); // Skip confirmation since we just saved

    } catch (error) {
      console.error('Failed to create presentation:', error);
      setCreating(false);
    }
  };

  return (
    <div
      onClick={() => resetWizard()}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onMouseDown={() => window.focus()}
        style={{
          background: '#1a1a2e',
          borderRadius: '16px',
          padding: '24px',
          maxWidth: '550px',
          width: '90%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
        }}
      >
        {/* Progress Indicator */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          {(translationMode === 'manual' ? [1, 2, 3] : [1, 2]).map((s) => (
            <div
              key={s}
              style={{
                flex: 1,
                height: '4px',
                borderRadius: '2px',
                background: step >= s ? '#00d4ff' : 'rgba(255,255,255,0.2)',
                transition: 'background 0.3s'
              }}
            />
          ))}
        </div>

        {/* Step 1: Select Type */}
        {step === 1 && (
          <>
            <h2 style={{ margin: '0 0 8px 0', color: 'white', fontSize: '1.4rem' }}>
              Select Presentation Type
            </h2>
            <p style={{ margin: '0 0 20px 0', color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>
              Choose the type of presentation you want to create
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { type: 'sermon' as const, icon: '📋', label: 'Sermon Points', desc: 'Numbered points for sermon' },
                { type: 'prayer' as const, icon: '🙏', label: 'Prayer Points', desc: 'Bullet points for prayer' },
                { type: 'announcements' as const, icon: '📢', label: 'Announcements', desc: 'Announcements with details' }
              ].map((item) => (
                <div
                  key={item.type}
                  onClick={() => {
                    setType(item.type);
                    setStep(2);
                    window.focus();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '16px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '2px solid rgba(255,255,255,0.1)',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(0,212,255,0.1)';
                    e.currentTarget.style.borderColor = 'rgba(0,212,255,0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                  }}
                >
                  <div style={{ fontSize: '28px' }}>{item.icon}</div>
                  <div>
                    <div style={{ color: 'white', fontWeight: 600 }}>{item.label}</div>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => resetWizard()}
              style={{
                marginTop: '20px',
                width: '100%',
                padding: '12px',
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '8px',
                color: 'rgba(255,255,255,0.7)',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              Cancel
            </button>
          </>
        )}

        {/* Step 2: Title and Content */}
        {step === 2 && (
          <>
            <h2 style={{ margin: '0 0 8px 0', color: 'white', fontSize: '1.4rem' }}>
              {type === 'sermon' ? 'Sermon Points' : type === 'prayer' ? 'Prayer Points' : 'Announcements'}
            </h2>
            <p style={{ margin: '0 0 16px 0', color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>
              Enter a title and add your {type === 'sermon' ? 'points' : type === 'prayer' ? 'prayer items' : 'announcements'}
            </p>

            {/* Title Input */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginBottom: '6px', textTransform: 'uppercase' }}>
                Main Title
              </div>
              <input
                ref={titleInputRef}
                type="text"
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={type === 'sermon' ? 'e.g., Faith in Action' : type === 'prayer' ? 'e.g., Prayer Requests' : 'e.g., Church Updates'}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '1rem',
                  cursor: 'text'
                }}
                onClick={(e) => {
                  e.currentTarget.focus();
                  window.focus();
                }}
              />
            </div>
            <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '16px' }}>
              {subtitles.map((item, index) => (
                <div
                  key={index}
                  style={{
                    background: 'rgba(0,0,0,0.2)',
                    borderRadius: '8px',
                    padding: '12px',
                    marginBottom: '10px',
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', minWidth: '60px' }}>
                      {type === 'sermon' ? `Point ${index + 1}` : `Slide ${index + 1}`}
                    </span>
                    {subtitles.length > 1 && (
                      <button
                        onClick={() => {
                          if (biblePickerIndex !== null) {
                            if (biblePickerIndex === index) {
                              setBiblePickerIndex(null);
                              setBibleSearch('');
                              bibleSearchRef.current = '';
                              setBibleVerses([]);
                              setBibleBook('');
                              setBibleChapter(null);
                              setVerseStart(null);
                              setVerseEnd(null);
                              setBibleNoMatch(false);
                              setBibleLoading(false);
                              setBibleIsHebrew(false);
                            } else if (biblePickerIndex > index) {
                              setBiblePickerIndex(biblePickerIndex - 1);
                            }
                          }
                          setSubtitles(subtitles.filter((_, i) => i !== index));
                        }}
                        style={{
                          marginLeft: 'auto',
                          background: 'rgba(255,0,0,0.2)',
                          border: 'none',
                          borderRadius: '4px',
                          color: '#ff6b6b',
                          padding: '4px 8px',
                          cursor: 'pointer',
                          fontSize: '0.75rem'
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={item.subtitle}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      setSubtitles(prev => prev.map((s, i) =>
                        i === index ? { ...s, subtitle: newValue } : s
                      ));
                    }}
                    placeholder={type === 'sermon' ? `${index + 1}. Enter point title` : 'Enter subtitle'}
                    style={{
                      width: '100%',
                      padding: '10px',
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '6px',
                      color: 'white',
                      fontSize: '0.9rem',
                      marginBottom: '8px'
                    }}
                  />
                  <textarea
                    value={item.description}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      setSubtitles(prev => prev.map((s, i) =>
                        i === index ? { ...s, description: newValue } : s
                      ));
                    }}
                    placeholder="Description (optional)"
                    rows={2}
                    style={{
                      width: '100%',
                      padding: '10px',
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '6px',
                      color: 'rgba(255,255,255,0.8)',
                      fontSize: '0.85rem',
                      resize: 'vertical'
                    }}
                  />

                  {/* Bible Reference Section */}
                  {item.bibleRef ? (
                    <div style={{
                      marginTop: '8px',
                      padding: '8px',
                      background: 'rgba(0,212,255,0.1)',
                      border: '1px solid rgba(0,212,255,0.3)',
                      borderRadius: '6px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ color: '#00d4ff', fontSize: '0.8rem', fontWeight: 600, direction: item.bibleRef.useHebrew ? 'rtl' : 'ltr' }}>
                          {'\u{1F4D6}'} {item.bibleRef.useHebrew ? (item.bibleRef.hebrewReference || item.bibleRef.reference) : item.bibleRef.reference}
                        </span>
                        <button
                          onClick={() => removeBibleRefFromSubtitle(index)}
                          style={{
                            background: 'rgba(255,0,0,0.2)',
                            border: 'none',
                            borderRadius: '4px',
                            color: '#ff6b6b',
                            padding: '2px 6px',
                            cursor: 'pointer',
                            fontSize: '0.7rem'
                          }}
                        >
                          Remove
                        </button>
                      </div>
                      <div style={{
                        fontSize: '0.75rem',
                        color: 'rgba(255,255,255,0.7)',
                        direction: item.bibleRef.useHebrew ? 'rtl' : 'ltr',
                        textAlign: item.bibleRef.useHebrew ? 'right' : 'left'
                      }}>
                        {(() => {
                          const displayText = item.bibleRef.useHebrew
                            ? (item.bibleRef.hebrewText || item.bibleRef.englishText || '')
                            : (item.bibleRef.englishText || item.bibleRef.hebrewText || '');
                          return displayText.length > 100
                            ? displayText.substring(0, 100) + '...'
                            : (displayText || 'No text available');
                        })()}
                      </div>
                    </div>
                  ) : biblePickerIndex === index ? (
                    <div style={{
                      marginTop: '8px',
                      padding: '10px',
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(0,212,255,0.3)',
                      borderRadius: '6px'
                    }}>
                      <div style={{ marginBottom: '8px', position: 'relative' }}>
                        <input
                          type="text"
                          value={bibleSearch}
                          onChange={(e) => handleBibleSearch(e.target.value)}
                          onKeyDown={(e) => {
                            if (!showBibleSuggestions || bibleSuggestions.length === 0) return;
                            if (e.key === 'ArrowDown') {
                              e.preventDefault();
                              setSelectedBibleSuggestionIndex(prev => prev < bibleSuggestions.length - 1 ? prev + 1 : 0);
                            } else if (e.key === 'ArrowUp') {
                              e.preventDefault();
                              setSelectedBibleSuggestionIndex(prev => prev > 0 ? prev - 1 : bibleSuggestions.length - 1);
                            } else if (e.key === 'Enter' && selectedBibleSuggestionIndex >= 0) {
                              e.preventDefault();
                              const suggestion = bibleSuggestions[selectedBibleSuggestionIndex];
                              setShowBibleSuggestions(false);
                              setSelectedBibleSuggestionIndex(-1);
                              handleBibleSearch(suggestion.value, true);
                            } else if (e.key === 'Escape') {
                              setShowBibleSuggestions(false);
                            }
                          }}
                          onFocus={() => bibleSearch.trim() && setShowBibleSuggestions(true)}
                          onBlur={() => setTimeout(() => setShowBibleSuggestions(false), 200)}
                          placeholder="e.g., John 3:16 or Psalms 23:1-6"
                          style={{
                            width: '100%',
                            padding: '8px',
                            background: 'rgba(0,0,0,0.3)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            borderRadius: showBibleSuggestions && bibleSuggestions.length > 0 ? '4px 4px 0 0' : '4px',
                            color: 'white',
                            fontSize: '0.85rem'
                          }}
                        />
                        {/* Autocomplete Suggestions Dropdown */}
                        {showBibleSuggestions && bibleSuggestions.length > 0 && (
                          <div
                            style={{
                              position: 'absolute',
                              top: '100%',
                              left: 0,
                              right: 0,
                              background: '#2a2a4a',
                              border: '1px solid rgba(255,255,255,0.2)',
                              borderTop: 'none',
                              borderRadius: '0 0 4px 4px',
                              maxHeight: '180px',
                              overflowY: 'auto',
                              zIndex: 1000
                            }}
                          >
                            {bibleSuggestions.map((suggestion, index) => (
                              <div
                                key={`${suggestion.bookName}-${suggestion.chapter}`}
                                onClick={() => { setShowBibleSuggestions(false); setSelectedBibleSuggestionIndex(-1); handleBibleSearch(suggestion.value, true); }}
                                style={{
                                  padding: '8px 10px',
                                  cursor: 'pointer',
                                  background: index === selectedBibleSuggestionIndex ? 'rgba(0,212,255,0.15)' : 'transparent',
                                  borderBottom: index < bibleSuggestions.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px'
                                }}
                                onMouseEnter={() => setSelectedBibleSuggestionIndex(index)}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(0,212,255,0.6)" strokeWidth="2">
                                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                                </svg>
                                <span style={{ color: 'white', fontSize: '0.8rem' }}>
                                  {suggestion.display}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {booksLoading && (
                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', textAlign: 'center', padding: '10px' }}>
                          Loading Bible books...
                        </div>
                      )}
                      {bibleLoading && (
                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', textAlign: 'center' }}>
                          Loading verses...
                        </div>
                      )}
                      {!booksLoading && bibleBooks.length === 0 && (
                        <div style={{ color: 'rgba(255,100,100,0.7)', fontSize: '0.8rem', textAlign: 'center', padding: '10px' }}>
                          <div>Failed to load Bible books.</div>
                          <button
                            onClick={async () => {
                              setBooksLoading(true);
                              try {
                                // This would need to be handled by parent
                              } catch (error) {
                                console.error('Error loading Bible books:', error);
                              }
                              setBooksLoading(false);
                            }}
                            style={{
                              marginTop: '8px',
                              padding: '4px 12px',
                              background: 'rgba(0,212,255,0.2)',
                              border: '1px solid rgba(0,212,255,0.4)',
                              borderRadius: '4px',
                              color: '#00d4ff',
                              cursor: 'pointer',
                              fontSize: '0.8rem'
                            }}
                          >
                            Retry
                          </button>
                        </div>
                      )}
                      {bibleNoMatch && !bibleLoading && (
                        <div style={{ color: 'rgba(255,200,100,0.8)', fontSize: '0.8rem', textAlign: 'center', padding: '6px' }}>
                          No match found. Try: "John 3:16" or "Genesis 1:1-5"
                        </div>
                      )}
                      {bibleBook && bibleChapter && !bibleLoading && bibleVerses.length === 0 && (
                        <div style={{ color: 'rgba(255,200,100,0.8)', fontSize: '0.8rem', textAlign: 'center', padding: '6px' }}>
                          No verses found for {bibleBook} {bibleChapter}
                        </div>
                      )}
                      {bibleBook && bibleChapter && bibleVerses.length > 0 && (
                        <div>
                          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', marginBottom: '6px' }}>
                            {bibleBook} {bibleChapter} ({bibleVerses.length} verses)
                          </div>
                          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem' }}>From:</span>
                              <select
                                value={verseStart || ''}
                                onChange={(e) => {
                                  const newStart = e.target.value ? parseInt(e.target.value) : null;
                                  setVerseStart(newStart);
                                  if (!newStart || (verseEnd && verseEnd <= newStart)) {
                                    setVerseEnd(null);
                                  }
                                }}
                                style={{
                                  padding: '4px 8px',
                                  background: 'rgba(0,0,0,0.4)',
                                  border: '1px solid rgba(255,255,255,0.2)',
                                  borderRadius: '4px',
                                  color: 'white',
                                  fontSize: '0.8rem'
                                }}
                              >
                                <option value="">{t('controlPanel.selectVerse')}</option>
                                {bibleVerses.map(v => (
                                  <option key={v.verseNumber} value={v.verseNumber}>{v.verseNumber}</option>
                                ))}
                              </select>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem' }}>To (optional):</span>
                              <select
                                value={verseEnd || ''}
                                onChange={(e) => setVerseEnd(e.target.value ? parseInt(e.target.value) : null)}
                                style={{
                                  padding: '4px 8px',
                                  background: 'rgba(0,0,0,0.4)',
                                  border: '1px solid rgba(255,255,255,0.2)',
                                  borderRadius: '4px',
                                  color: 'white',
                                  fontSize: '0.8rem'
                                }}
                              >
                                <option value="">{t('controlPanel.singleVerse')}</option>
                                {bibleVerses
                                  .filter(v => !verseStart || v.verseNumber > verseStart)
                                  .map(v => (
                                    <option key={v.verseNumber} value={v.verseNumber}>{v.verseNumber}</option>
                                  ))}
                              </select>
                            </div>
                          </div>
                          {verseStart && (
                            <div style={{
                              padding: '6px',
                              background: 'rgba(0,0,0,0.2)',
                              borderRadius: '4px',
                              marginBottom: '8px',
                              maxHeight: '80px',
                              overflowY: 'auto'
                            }}>
                              <div style={{
                                fontSize: '0.75rem',
                                color: 'rgba(255,255,255,0.8)',
                                direction: bibleIsHebrew ? 'rtl' : 'ltr',
                                textAlign: bibleIsHebrew ? 'right' : 'left'
                              }}>
                                {bibleVerses
                                  .filter(v => v.verseNumber >= verseStart! && v.verseNumber <= (verseEnd || verseStart!))
                                  .map(v => bibleIsHebrew ? (v.hebrew || v.english || '') : (v.english || v.hebrew || ''))
                                  .filter(Boolean)
                                  .join(' ') || 'No text available'}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => {
                            setBiblePickerIndex(null);
                            setBibleSearch('');
                            bibleSearchRef.current = '';
                            setBibleVerses([]);
                            setBibleBook('');
                            setBibleChapter(null);
                            setVerseStart(null);
                            setVerseEnd(null);
                            setBibleNoMatch(false);
                            setBibleLoading(false);
                            setBibleIsHebrew(false);
                          }}
                          style={{
                            flex: 1,
                            padding: '6px',
                            background: 'transparent',
                            border: '1px solid rgba(255,255,255,0.2)',
                            borderRadius: '4px',
                            color: 'rgba(255,255,255,0.7)',
                            cursor: 'pointer',
                            fontSize: '0.8rem'
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => addBibleRefToSubtitle(index)}
                          disabled={!verseStart}
                          style={{
                            flex: 1,
                            padding: '6px',
                            background: verseStart ? '#00d4ff' : 'rgba(0,212,255,0.3)',
                            border: 'none',
                            borderRadius: '4px',
                            color: verseStart ? 'black' : 'rgba(0,0,0,0.5)',
                            cursor: verseStart ? 'pointer' : 'not-allowed',
                            fontSize: '0.8rem',
                            fontWeight: 600
                          }}
                        >
                          Add Verse
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={async () => {
                        if (booksLoading) return;
                        setBibleSearch('');
                        bibleSearchRef.current = '';
                        setBibleVerses([]);
                        setBibleBook('');
                        setBibleChapter(null);
                        setVerseStart(null);
                        setVerseEnd(null);
                        setBibleNoMatch(false);
                        setBibleLoading(false);
                        setBibleIsHebrew(false);
                        setBiblePickerIndex(index);
                      }}
                      style={{
                        marginTop: '8px',
                        width: '100%',
                        padding: '6px',
                        background: 'transparent',
                        border: '1px dashed rgba(0,212,255,0.4)',
                        borderRadius: '4px',
                        color: 'rgba(0,212,255,0.8)',
                        cursor: 'pointer',
                        fontSize: '0.8rem'
                      }}
                    >
                      + Add Bible Reference (optional)
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                setSubtitles([...subtitles, { subtitle: '', description: '' }]);
              }}
              style={{
                width: '100%',
                padding: '10px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px dashed rgba(255,255,255,0.3)',
                borderRadius: '8px',
                color: 'rgba(255,255,255,0.7)',
                cursor: 'pointer',
                fontSize: '0.9rem',
                marginBottom: '16px'
              }}
            >
              + Add Another {type === 'sermon' ? 'Point' : 'Slide'}
            </button>

            {/* Translation Mode Options */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginBottom: '8px', textTransform: 'uppercase' }}>
                Translation Options
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[
                  { mode: 'none' as const, label: 'No Translation', desc: 'Single language' },
                  { mode: 'auto' as const, label: 'Auto-Generate', desc: 'AI translation' },
                  { mode: 'manual' as const, label: 'Manual', desc: 'Enter yourself' }
                ].map((option) => (
                  <button
                    key={option.mode}
                    onClick={() => setTranslationMode(option.mode)}
                    style={{
                      flex: 1,
                      padding: '10px 8px',
                      background: translationMode === option.mode ? 'rgba(0,212,255,0.2)' : 'rgba(255,255,255,0.05)',
                      border: translationMode === option.mode ? '2px solid #00d4ff' : '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ color: translationMode === option.mode ? '#00d4ff' : 'white', fontSize: '0.8rem', fontWeight: 600 }}>
                      {option.label}
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem', marginTop: '2px' }}>
                      {option.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setStep(1)}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  color: 'rgba(255,255,255,0.7)',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                Back
              </button>
              <button
                onClick={() => translationMode === 'manual' ? setStep(3) : handleCreate()}
                disabled={!title.trim() || !subtitles.some(s => s.subtitle.trim()) || creating}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: (!title.trim() || !subtitles.some(s => s.subtitle.trim()) || creating) ? 'rgba(0,212,255,0.3)' : '#00d4ff',
                  border: 'none',
                  borderRadius: '8px',
                  color: (!title.trim() || !subtitles.some(s => s.subtitle.trim()) || creating) ? 'rgba(0,0,0,0.5)' : 'black',
                  cursor: (!title.trim() || !subtitles.some(s => s.subtitle.trim()) || creating) ? 'not-allowed' : 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: 600
                }}
              >
                {creating ? 'Creating...' : translationMode === 'manual' ? 'Next: Add Translations' : `Create Presentation (${subtitles.filter(s => s.subtitle.trim()).length} slides)`}
              </button>
            </div>
          </>
        )}

        {/* Step 3: Manual Translations */}
        {step === 3 && (
          <>
            <h2 style={{ margin: '0 0 8px 0', color: 'white', fontSize: '1.4rem' }}>
              Add Translations
            </h2>
            <p style={{ margin: '0 0 16px 0', color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>
              Enter English translations for each field
            </p>

            <div style={{ maxHeight: '350px', overflowY: 'auto', marginBottom: '16px' }}>
              {/* Title Translation */}
              <div style={{
                background: 'rgba(0,0,0,0.2)',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '12px',
                border: '1px solid rgba(255,255,255,0.1)'
              }}>
                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginBottom: '6px', textTransform: 'uppercase' }}>
                  Main Title Translation
                </div>
                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', marginBottom: '8px', direction: containsHebrew(title) ? 'rtl' : 'ltr' }}>
                  Original: {title}
                </div>
                <input
                  type="text"
                  value={titleTranslation}
                  onChange={(e) => setTitleTranslation(e.target.value)}
                  placeholder="Enter English translation..."
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '6px',
                    color: 'white',
                    fontSize: '0.9rem'
                  }}
                />
              </div>

              {/* Subtitle Translations */}
              {subtitles.filter(s => s.subtitle.trim()).map((item, index) => (
                <div
                  key={index}
                  style={{
                    background: 'rgba(0,0,0,0.2)',
                    borderRadius: '8px',
                    padding: '12px',
                    marginBottom: '10px',
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginBottom: '6px', textTransform: 'uppercase' }}>
                    {type === 'sermon' ? `Point ${index + 1}` : `Slide ${index + 1}`} Translation
                  </div>

                  {/* Subtitle */}
                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', marginBottom: '4px', direction: containsHebrew(item.subtitle) ? 'rtl' : 'ltr' }}>
                      Subtitle: {item.subtitle}
                    </div>
                    <input
                      type="text"
                      value={item.subtitleTranslation || ''}
                      onChange={(e) => {
                        const realIndex = subtitles.findIndex(s => s === item);
                        setSubtitles(prev => prev.map((s, i) =>
                          i === realIndex ? { ...s, subtitleTranslation: e.target.value } : s
                        ));
                      }}
                      placeholder="Enter subtitle translation..."
                      style={{
                        width: '100%',
                        padding: '8px',
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: '6px',
                        color: 'white',
                        fontSize: '0.85rem'
                      }}
                    />
                  </div>

                  {/* Description (if exists) */}
                  {item.description.trim() && (
                    <div>
                      <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', marginBottom: '4px', direction: containsHebrew(item.description) ? 'rtl' : 'ltr' }}>
                        Description: {item.description.length > 50 ? item.description.substring(0, 50) + '...' : item.description}
                      </div>
                      <input
                        type="text"
                        value={item.descriptionTranslation || ''}
                        onChange={(e) => {
                          const realIndex = subtitles.findIndex(s => s === item);
                          setSubtitles(prev => prev.map((s, i) =>
                            i === realIndex ? { ...s, descriptionTranslation: e.target.value } : s
                          ));
                        }}
                        placeholder="Enter description translation..."
                        style={{
                          width: '100%',
                          padding: '8px',
                          background: 'rgba(0,0,0,0.3)',
                          border: '1px solid rgba(255,255,255,0.15)',
                          borderRadius: '6px',
                          color: 'white',
                          fontSize: '0.85rem'
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setStep(2)}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  color: 'rgba(255,255,255,0.7)',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                Back
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: creating ? 'rgba(0,212,255,0.3)' : '#00d4ff',
                  border: 'none',
                  borderRadius: '8px',
                  color: creating ? 'rgba(0,0,0,0.5)' : 'black',
                  cursor: creating ? 'not-allowed' : 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: 600
                }}
              >
                {creating ? 'Creating...' : `Create Presentation (${subtitles.filter(s => s.subtitle.trim()).length} slides)`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
});

QuickModeWizard.displayName = 'QuickModeWizard';

export default QuickModeWizard;
