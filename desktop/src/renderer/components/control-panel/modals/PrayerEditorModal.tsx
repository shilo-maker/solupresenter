import React, { useState, useCallback, useRef, useMemo, memo } from 'react';
import { hebrewBookNames, numberToHebrew } from '../../../utils/bibleUtils';

// Slide colors defined outside component to avoid recreation on each render
const SLIDE_COLORS = [
  { bg: 'rgba(6, 182, 212, 0.15)', border: 'rgba(6, 182, 212, 0.3)' },    // Cyan
  { bg: 'rgba(168, 85, 247, 0.15)', border: 'rgba(168, 85, 247, 0.3)' },  // Purple
  { bg: 'rgba(34, 197, 94, 0.15)', border: 'rgba(34, 197, 94, 0.3)' },    // Green
  { bg: 'rgba(251, 146, 60, 0.15)', border: 'rgba(251, 146, 60, 0.3)' },  // Orange
  { bg: 'rgba(236, 72, 153, 0.15)', border: 'rgba(236, 72, 153, 0.3)' },  // Pink
  { bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.3)' },  // Blue
  { bg: 'rgba(250, 204, 21, 0.15)', border: 'rgba(250, 204, 21, 0.3)' },  // Yellow
  { bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.3)' },    // Red
];

interface BibleBook {
  name: string;
  chapters: number;
  hebrewName?: string;
}

interface BibleVerse {
  verseNumber: number;
  hebrew: string;
  english: string;
  reference: string;
  hebrewReference: string;
}

interface QuickModeSubtitle {
  subtitle: string;
  subtitleTranslation?: string;
  description: string;
  descriptionTranslation?: string;
  bibleRef?: {
    book?: string;
    chapter?: number;
    verseStart?: number;
    verseEnd?: number;
    hebrewText?: string;
    englishText?: string;
    reference: string;
    hebrewReference?: string;
    useHebrew?: boolean;
  };
}

interface QuickModeData {
  type: 'sermon' | 'prayer' | 'announcements';
  title: string;
  titleTranslation?: string;
  subtitles: QuickModeSubtitle[];
  generateTranslation?: boolean;
}

interface Presentation {
  id: string;
  title: string;
  quickModeData?: QuickModeData;
}

interface PrayerEditorModalProps {
  presentation: Presentation;
  bibleBooks?: BibleBook[];
  onClose: () => void;
  onSave: (presentationId: string, subtitles: QuickModeSubtitle[], title?: string, titleTranslation?: string) => Promise<void>;
}

const containsHebrew = (text: string): boolean => /[\u0590-\u05FF]/.test(text);

const PrayerEditorModal = memo<PrayerEditorModalProps>(({
  presentation,
  bibleBooks = [],
  onClose,
  onSave
}) => {
  const qmd = presentation.quickModeData;
  const type = qmd?.type || 'prayer';

  // State
  const [title, setTitle] = useState(qmd?.title || '');
  const [titleTranslation, setTitleTranslation] = useState(qmd?.titleTranslation || '');
  const [subtitles, setSubtitles] = useState<QuickModeSubtitle[]>(
    qmd?.subtitles?.length ? qmd.subtitles.map(s => ({ ...s })) : [{ subtitle: '', description: '' }]
  );
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(1); // 1 = Hebrew, 2 = English translations

  // Bible picker state
  const [biblePickerIndex, setBiblePickerIndex] = useState<number | null>(null);
  const [bibleSearch, setBibleSearch] = useState('');
  const [bibleVerses, setBibleVerses] = useState<BibleVerse[]>([]);
  const [bibleBook, setBibleBook] = useState('');
  const [bibleChapter, setBibleChapter] = useState<number | null>(null);
  const [verseStart, setVerseStart] = useState<number | null>(null);
  const [verseEnd, setVerseEnd] = useState<number | null>(null);
  const [bibleLoading, setBibleLoading] = useState(false);
  const [bibleNoMatch, setBibleNoMatch] = useState(false);
  const [bibleIsHebrew, setBibleIsHebrew] = useState(false);
  const [showBibleSuggestions, setShowBibleSuggestions] = useState(false);
  const [selectedBibleSuggestionIndex, setSelectedBibleSuggestionIndex] = useState(-1);

  const bibleSearchRef = useRef<string>('');

  // Memoize original values to avoid recalculation on every render
  const originalValues = useMemo(() => ({
    title: qmd?.title || '',
    titleTranslation: qmd?.titleTranslation || '',
    subtitlesJson: JSON.stringify(qmd?.subtitles || [])
  }), [qmd?.title, qmd?.titleTranslation, qmd?.subtitles]);

  // Check if there are unsaved changes
  const hasUnsavedChanges = useCallback((): boolean => {
    if (title !== originalValues.title) return true;
    if (titleTranslation !== originalValues.titleTranslation) return true;
    if (JSON.stringify(subtitles) !== originalValues.subtitlesJson) return true;
    return false;
  }, [title, titleTranslation, subtitles, originalValues]);

  // Handle close with confirmation
  const handleClose = useCallback(() => {
    if (hasUnsavedChanges()) {
      const confirmed = window.confirm('You have unsaved changes. Are you sure you want to discard them?');
      if (!confirmed) return;
    }
    onClose();
  }, [hasUnsavedChanges, onClose]);

  // Generate Bible autocomplete suggestions
  const bibleSuggestions = useMemo(() => {
    const input = bibleSearch.trim().toLowerCase();
    if (!input || input.length < 1 || !bibleBooks || bibleBooks.length === 0) return [];

    const results: Array<{ display: string; value: string; bookName: string; chapter: number }> = [];
    const maxSuggestions = 8;

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

  // Hebrew to number conversion
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
      if (hebrewValues[char]) total += hebrewValues[char];
    }
    return total > 0 ? total : null;
  };

  // Bible search handler
  const handleBibleSearch = useCallback(async (query: string, fromSuggestion = false) => {
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

    const hasHebrewChars = (str: string) => /[\u0590-\u05FF]/.test(str);

    let bookNameRaw: string;
    let chapterNum: number;
    let isHebrewSearch = false;

    const matchArabic = trimmed.match(/^(.+?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/);
    const matchHebrewFull = trimmed.match(/^(.+?)\s+([א-ת]+["״׳']?)(?:[\s:](.+))?$/);

    if (matchArabic && !hasHebrewChars(matchArabic[1])) {
      bookNameRaw = matchArabic[1].trim().toLowerCase();
      chapterNum = parseInt(matchArabic[2]);
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
      } catch (error) {
        console.error('Error fetching Bible verses:', error);
        if (bibleSearchRef.current === query) {
          setBibleVerses([]);
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
  }, [bibleBooks]);

  // Add Bible reference to subtitle
  const addBibleRefToSubtitle = useCallback((index: number) => {
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
    setVerseEnd(null);
    setBibleNoMatch(false);
    setBibleLoading(false);
    setBibleIsHebrew(false);
  }, [bibleBook, bibleChapter, verseStart, verseEnd, bibleVerses, bibleIsHebrew]);

  // Remove Bible reference
  const removeBibleRef = useCallback((index: number) => {
    setSubtitles(prev => prev.map((s, i) =>
      i === index ? { ...s, bibleRef: undefined } : s
    ));
  }, []);

  // Add new point
  const addPoint = useCallback(() => {
    setSubtitles(prev => [...prev, { subtitle: '', description: '' }]);
  }, []);

  // Remove point
  const removePoint = useCallback((index: number) => {
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
    } else if (biblePickerIndex !== null && biblePickerIndex > index) {
      setBiblePickerIndex(biblePickerIndex - 1);
    }
    setSubtitles(prev => prev.filter((_, i) => i !== index));
  }, [biblePickerIndex]);

  // Update subtitle field
  const updateSubtitle = useCallback((index: number, field: keyof QuickModeSubtitle, value: string) => {
    setSubtitles(prev => prev.map((s, i) =>
      i === index ? { ...s, [field]: value } : s
    ));
  }, []);

  // Save handler
  const handleSave = async () => {
    const validSubtitles = subtitles.filter(s => s.subtitle.trim());
    if (validSubtitles.length === 0) {
      alert('Please add at least one point');
      return;
    }
    if (!title.trim()) {
      alert('Please enter a title');
      return;
    }
    setSaving(true);
    try {
      await onSave(presentation.id, validSubtitles, title, titleTranslation || undefined);
    } catch (error) {
      console.error('Error saving:', error);
    }
    setSaving(false);
  };

  return (
    <div
      onClick={handleClose}
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
        style={{
          background: 'linear-gradient(135deg, rgba(30,30,50,0.98), rgba(20,20,40,0.98))',
          borderRadius: '16px',
          padding: '24px',
          width: '600px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid rgba(6,182,212,0.3)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ color: 'white', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{type === 'sermon' ? '📋' : type === 'prayer' ? '🙏' : '📢'}</span>
            Edit {type === 'sermon' ? 'Sermon Points' : type === 'prayer' ? 'Prayer Points' : 'Announcements'}
            <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginLeft: '8px' }}>
              Step {step}/2: {step === 1 ? 'Hebrew' : 'English'}
            </span>
          </h3>
          <button
            onClick={handleClose}
            style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '6px', padding: '4px 8px', color: 'white', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {/* Progress Indicator */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '16px' }}>
          {[1, 2].map((s) => (
            <div
              key={s}
              style={{
                width: '80px',
                height: '4px',
                borderRadius: '2px',
                background: s <= step ? 'linear-gradient(90deg, #06b6d4, #22d3ee)' : 'rgba(255,255,255,0.2)',
                transition: 'background 0.3s'
              }}
            />
          ))}
        </div>

        {/* Title Input - Step 1: Hebrew */}
        {step === 1 && (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginBottom: '6px', textTransform: 'uppercase' }}>
              Main Title (Hebrew)
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="הכנס כותרת ראשית..."
              dir="rtl"
              style={{
                width: '100%',
                padding: '10px',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '6px',
                color: 'white',
                fontSize: '0.95rem',
                textAlign: 'right'
              }}
            />
          </div>
        )}

        {/* Title Translation - Step 2: English */}
        {step === 2 && (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginBottom: '6px', textTransform: 'uppercase' }}>
              Title Translation (English)
            </div>
            <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginBottom: '6px', direction: 'rtl', textAlign: 'right' }}>
              {title || '(No title)'}
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
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '6px',
                color: 'white',
                fontSize: '0.95rem'
              }}
            />
          </div>
        )}

        {/* Points List */}
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '12px', maxHeight: '400px' }}>
          {subtitles.map((item, index) => {
            const color = SLIDE_COLORS[index % SLIDE_COLORS.length];

            return (
            <div
              key={index}
              style={{
                background: color.bg,
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '10px',
                border: `1px solid ${color.border}`
              }}
            >
              {/* Point Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', minWidth: '60px' }}>
                  {type === 'sermon' ? `Point ${index + 1}` : `Slide ${index + 1}`}
                </span>
                {step === 1 && subtitles.length > 1 && (
                  <button
                    onClick={() => removePoint(index)}
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

              {/* Step 1: Hebrew Content */}
              {step === 1 && (
                <>
                  {/* Subtitle (Hebrew) */}
                  <input
                    type="text"
                    value={item.subtitle}
                    onChange={(e) => updateSubtitle(index, 'subtitle', e.target.value)}
                    placeholder={type === 'sermon' ? `${index + 1}. הכנס כותרת נקודה` : 'הכנס כותרת משנה'}
                    dir="rtl"
                    style={{
                      width: '100%',
                      padding: '8px',
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '6px',
                      color: 'white',
                      fontSize: '0.9rem',
                      marginBottom: '8px',
                      textAlign: 'right'
                    }}
                  />

                  {/* Description (Hebrew) */}
                  <textarea
                    value={item.description || ''}
                    onChange={(e) => updateSubtitle(index, 'description', e.target.value)}
                    placeholder="תיאור (אופציונלי)"
                    dir="rtl"
                    rows={2}
                    style={{
                      width: '100%',
                      padding: '8px',
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '6px',
                      color: 'rgba(255,255,255,0.8)',
                      fontSize: '0.85rem',
                      resize: 'vertical',
                      textAlign: 'right'
                    }}
                  />
                </>
              )}

              {/* Step 2: English Translations */}
              {step === 2 && (
                <>
                  {/* Show Hebrew subtitle as reference */}
                  <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginBottom: '6px', direction: 'rtl', textAlign: 'right' }}>
                    {item.subtitle || '(No subtitle)'}
                  </div>
                  {/* Subtitle Translation */}
                  <input
                    type="text"
                    value={item.subtitleTranslation || ''}
                    onChange={(e) => updateSubtitle(index, 'subtitleTranslation', e.target.value)}
                    placeholder="Subtitle translation (English)"
                    style={{
                      width: '100%',
                      padding: '8px',
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '6px',
                      color: 'white',
                      fontSize: '0.9rem',
                      marginBottom: '8px'
                    }}
                  />

                  {/* Show Hebrew description as reference if exists */}
                  {item.description && (
                    <>
                      <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginBottom: '6px', direction: 'rtl', textAlign: 'right' }}>
                        {item.description}
                      </div>
                      {/* Description Translation */}
                      <input
                        type="text"
                        value={item.descriptionTranslation || ''}
                        onChange={(e) => updateSubtitle(index, 'descriptionTranslation', e.target.value)}
                        placeholder="Description translation (English)"
                        style={{
                          width: '100%',
                          padding: '8px',
                          background: 'rgba(0,0,0,0.3)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '6px',
                          color: 'rgba(255,255,255,0.8)',
                          fontSize: '0.85rem'
                        }}
                      />
                    </>
                  )}
                </>
              )}

              {/* Bible Reference Section - Only in Step 1 */}
              {step === 1 && item.bibleRef ? (
                <div style={{
                  marginTop: '8px',
                  padding: '8px',
                  background: 'rgba(0,212,255,0.1)',
                  border: '1px solid rgba(0,212,255,0.3)',
                  borderRadius: '6px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ color: '#00d4ff', fontSize: '0.8rem', fontWeight: 600 }}>
                      📖 {item.bibleRef.useHebrew ? (item.bibleRef.hebrewReference || item.bibleRef.reference) : item.bibleRef.reference}
                    </span>
                    <button
                      onClick={() => removeBibleRef(index)}
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
                    {/* Autocomplete Dropdown */}
                    {showBibleSuggestions && bibleSuggestions.length > 0 && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        background: '#2a2a4a',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderTop: 'none',
                        borderRadius: '0 0 4px 4px',
                        maxHeight: '150px',
                        overflowY: 'auto',
                        zIndex: 1000
                      }}>
                        {bibleSuggestions.map((suggestion, idx) => (
                          <div
                            key={`${suggestion.bookName}-${suggestion.chapter}`}
                            onClick={() => { setShowBibleSuggestions(false); setSelectedBibleSuggestionIndex(-1); handleBibleSearch(suggestion.value, true); }}
                            style={{
                              padding: '8px 10px',
                              cursor: 'pointer',
                              background: idx === selectedBibleSuggestionIndex ? 'rgba(0,212,255,0.15)' : 'transparent',
                              borderBottom: idx < bibleSuggestions.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none'
                            }}
                            onMouseEnter={() => setSelectedBibleSuggestionIndex(idx)}
                          >
                            <span style={{ color: 'white', fontSize: '0.8rem' }}>{suggestion.display}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {bibleLoading && (
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', textAlign: 'center' }}>
                      Loading verses...
                    </div>
                  )}

                  {bibleNoMatch && !bibleLoading && (
                    <div style={{ color: 'rgba(255,200,100,0.8)', fontSize: '0.8rem', textAlign: 'center', padding: '6px' }}>
                      No match found. Try: "John 3:16" or "Genesis 1:1-5"
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
                            <option value="">Select verse</option>
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
                            <option value="">Single verse</option>
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
                          maxHeight: '60px',
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
              ) : step === 1 ? (
                <button
                  onClick={() => {
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
                  + Add Bible Reference
                </button>
              ) : null}
            </div>
            );
          })}
        </div>

        {/* Add Point Button - Only in Step 1 */}
        {step === 1 && (
          <button
            onClick={addPoint}
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
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          {step === 1 ? (
            <>
              <button
                onClick={handleClose}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => setStep(2)}
                disabled={!title.trim() || !subtitles.some(s => s.subtitle.trim())}
                style={{
                  background: (!title.trim() || !subtitles.some(s => s.subtitle.trim())) ? 'rgba(6,182,212,0.3)' : 'linear-gradient(135deg, #06b6d4 0%, #22d3ee 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 24px',
                  color: 'white',
                  cursor: (!title.trim() || !subtitles.some(s => s.subtitle.trim())) ? 'not-allowed' : 'pointer',
                  fontWeight: 600
                }}
              >
                Next →
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setStep(1)}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                ← Back
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  background: saving ? 'rgba(6,182,212,0.3)' : 'linear-gradient(135deg, #06b6d4 0%, #22d3ee 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 24px',
                  color: 'white',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontWeight: 600
                }}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
});

PrayerEditorModal.displayName = 'PrayerEditorModal';

export default PrayerEditorModal;
