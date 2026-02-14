import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { numberToHebrew, getHebrewBookName } from '../../../utils/bibleUtils';

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

const PrayerEditorModal: React.FC<PrayerEditorModalProps> = ({
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
  const [bibleVerses, setBibleVerses] = useState<BibleVerse[]>([]);
  const [bibleBook, setBibleBook] = useState('');
  const [bibleChapter, setBibleChapter] = useState<number | null>(null);
  const [verseStart, setVerseStart] = useState<number | null>(null);
  const [verseEnd, setVerseEnd] = useState<number | null>(null);
  const [bibleLoading, setBibleLoading] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);

  // Block ALL keyboard events at the document level when this modal is open
  // This prevents the global keyboard shortcuts from ever seeing the events
  useEffect(() => {
    const blockKeyboardEvents = (e: KeyboardEvent) => {
      // Allow Escape to close the modal
      if (e.key === 'Escape') return;

      // For all other keys, stop propagation at capture phase
      // This prevents useKeyboardShortcuts and useSlideKeyboardNav from seeing these events
      e.stopPropagation();
    };

    // Add listener in capture phase (third argument true) so it runs before bubbling handlers
    document.addEventListener('keydown', blockKeyboardEvents, true);
    document.addEventListener('keyup', blockKeyboardEvents, true);
    document.addEventListener('keypress', blockKeyboardEvents, true);

    return () => {
      document.removeEventListener('keydown', blockKeyboardEvents, true);
      document.removeEventListener('keyup', blockKeyboardEvents, true);
      document.removeEventListener('keypress', blockKeyboardEvents, true);
    };
  }, []);

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

  // Handle book selection from dropdown
  const handleBookSelect = useCallback((bookName: string) => {
    setBibleBook(bookName);
    setBibleChapter(null);
    setBibleVerses([]);
    setVerseStart(null);
    setVerseEnd(null);
  }, []);

  // Handle chapter selection from dropdown
  const handleChapterSelect = useCallback(async (chapterNum: number) => {
    if (!bibleBook) return;
    setBibleChapter(chapterNum);
    setBibleVerses([]);
    setVerseStart(null);
    setVerseEnd(null);
    setBibleLoading(true);
    try {
      const response = await window.electronAPI.getBibleVerses(bibleBook, chapterNum);
      setBibleVerses(response?.verses || []);
    } catch (error) {
      console.error('Error fetching Bible verses:', error);
      setBibleVerses([]);
    } finally {
      setBibleLoading(false);
    }
  }, [bibleBook]);

  // Add Bible reference to subtitle
  const addBibleRefToSubtitle = useCallback((index: number) => {
    if (!bibleBook || !bibleChapter || !verseStart || bibleVerses.length === 0) return;

    const startVerse = bibleVerses.find(v => v.verseNumber === verseStart);
    if (!startVerse) return;

    let hebrewText = '';
    let englishText = '';
    const hebrewBookName = getHebrewBookName(bibleBook);
    let reference = `${bibleBook} ${bibleChapter}:${verseStart}`;
    let hebrewReference = `${hebrewBookName} ${numberToHebrew(bibleChapter)}:${numberToHebrew(verseStart)}`;

    if (verseEnd && verseEnd > verseStart) {
      const versesInRange = bibleVerses.filter(
        v => v.verseNumber >= verseStart! && v.verseNumber <= verseEnd!
      );
      hebrewText = versesInRange.map(v => v.hebrew || '').filter(Boolean).join(' ');
      englishText = versesInRange.map(v => v.english || '').filter(Boolean).join(' ');
      reference = `${bibleBook} ${bibleChapter}:${verseStart}-${verseEnd}`;
      hebrewReference = `${hebrewBookName} ${numberToHebrew(bibleChapter)}:${numberToHebrew(verseStart)}-${numberToHebrew(verseEnd)}`;
    } else {
      hebrewText = startVerse.hebrew || '';
      englishText = startVerse.english || '';
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
          useHebrew: true
        }
      } : s
    ));

    // Reset picker state
    setBiblePickerIndex(null);
    setBibleVerses([]);
    setBibleBook('');
    setBibleChapter(null);
    setVerseStart(null);
    setVerseEnd(null);
    setBibleLoading(false);
  }, [bibleBook, bibleChapter, verseStart, verseEnd, bibleVerses]);

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
      setBibleVerses([]);
      setBibleBook('');
      setBibleChapter(null);
      setVerseStart(null);
      setVerseEnd(null);
      setBibleLoading(false);
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
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'linear-gradient(135deg, rgba(24, 24, 27, 0.98), rgba(18, 18, 21, 0.98))',
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
              id="prayer-title-input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              autoComplete="off"
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
              id="prayer-title-translation-input"
              type="text"
              value={titleTranslation}
              onChange={(e) => setTitleTranslation(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              autoComplete="off"
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
              key={`subtitle-${index}`}
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
                <div>
                <input
                  id={`subtitle-hebrew-input-${index}`}
                  type="text"
                  value={item.subtitle}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSubtitles(prev => {
                      const copy = [...prev];
                      copy[index] = { ...copy[index], subtitle: val };
                      return copy;
                    });
                  }}
                  onKeyDown={(e) => e.stopPropagation()}
                  autoComplete="off"
                  spellCheck={false}
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

                {/* Description (Hebrew) - Controlled textarea matching Step 2 pattern */}
                <textarea
                  id={`description-hebrew-input-${index}`}
                  value={item.description || ''}
                  onChange={(e) => updateSubtitle(index, 'description', e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  autoComplete="off"
                  spellCheck={false}
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
              </div>
              )}

              {/* Step 2: English Translations */}
              {step === 2 && (
                <div key={`step2-inputs-${index}`}>
                  {/* Show Hebrew subtitle as reference */}
                  <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginBottom: '6px', direction: 'rtl', textAlign: 'right' }}>
                    {item.subtitle || '(No subtitle)'}
                  </div>
                  {/* Subtitle Translation */}
                  <input
                    id={`subtitle-translation-input-${index}`}
                    type="text"
                    value={item.subtitleTranslation || ''}
                    onChange={(e) => updateSubtitle(index, 'subtitleTranslation', e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    autoComplete="off"
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
                    <div key={`step2-desc-${index}`}>
                      <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginBottom: '6px', direction: 'rtl', textAlign: 'right' }}>
                        {item.description}
                      </div>
                      {/* Description Translation */}
                      <input
                        id={`description-translation-input-${index}`}
                        type="text"
                        value={item.descriptionTranslation || ''}
                        onChange={(e) => updateSubtitle(index, 'descriptionTranslation', e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()}
                        autoComplete="off"
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
                    </div>
                  )}
                </div>
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
                  {/* Book and Chapter Selectors */}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap', direction: 'rtl' }}>
                    <div style={{ flex: 1, minWidth: '140px' }}>
                      <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', marginBottom: '4px' }}>ספר:</div>
                      <select
                        value={bibleBook}
                        onChange={(e) => handleBookSelect(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px',
                          background: 'rgba(0,0,0,0.4)',
                          border: '1px solid rgba(255,255,255,0.2)',
                          borderRadius: '4px',
                          color: 'white',
                          fontSize: '0.85rem',
                          direction: 'rtl'
                        }}
                      >
                        <option value="">בחר ספר...</option>
                        {bibleBooks.map(book => (
                          <option key={book.name} value={book.name}>{getHebrewBookName(book.name)}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ minWidth: '80px' }}>
                      <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', marginBottom: '4px' }}>פרק:</div>
                      <select
                        value={bibleChapter || ''}
                        onChange={(e) => e.target.value && handleChapterSelect(parseInt(e.target.value))}
                        disabled={!bibleBook}
                        style={{
                          width: '100%',
                          padding: '8px',
                          background: 'rgba(0,0,0,0.4)',
                          border: '1px solid rgba(255,255,255,0.2)',
                          borderRadius: '4px',
                          color: bibleBook ? 'white' : 'rgba(255,255,255,0.4)',
                          fontSize: '0.85rem',
                          cursor: bibleBook ? 'pointer' : 'not-allowed',
                          direction: 'rtl'
                        }}
                      >
                        <option value="">בחר...</option>
                        {bibleBook && bibleBooks.find(b => b.name === bibleBook) &&
                          Array.from({ length: bibleBooks.find(b => b.name === bibleBook)!.chapters }, (_, i) => i + 1).map(ch => (
                            <option key={ch} value={ch}>{numberToHebrew(ch)}</option>
                          ))
                        }
                      </select>
                    </div>
                  </div>

                  {bibleLoading && (
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', textAlign: 'center', padding: '6px', direction: 'rtl' }}>
                      טוען פסוקים...
                    </div>
                  )}

                  {/* Verse Selectors */}
                  {bibleBook && bibleChapter && !bibleLoading && bibleVerses.length > 0 && (
                    <div>
                      <div style={{ display: 'flex', gap: '12px', marginBottom: '8px', flexWrap: 'wrap', direction: 'rtl' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem' }}>מפסוק:</span>
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
                              padding: '6px 10px',
                              background: 'rgba(0,0,0,0.4)',
                              border: '1px solid rgba(255,255,255,0.2)',
                              borderRadius: '4px',
                              color: 'white',
                              fontSize: '0.85rem',
                              direction: 'rtl'
                            }}
                          >
                            <option value="">בחר...</option>
                            {bibleVerses.map(v => (
                              <option key={v.verseNumber} value={v.verseNumber}>{numberToHebrew(v.verseNumber)}</option>
                            ))}
                          </select>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem' }}>עד פסוק:</span>
                          <select
                            value={verseEnd || ''}
                            onChange={(e) => setVerseEnd(e.target.value ? parseInt(e.target.value) : null)}
                            style={{
                              padding: '6px 10px',
                              background: 'rgba(0,0,0,0.4)',
                              border: '1px solid rgba(255,255,255,0.2)',
                              borderRadius: '4px',
                              color: 'white',
                              fontSize: '0.85rem',
                              direction: 'rtl'
                            }}
                          >
                            <option value="">פסוק בודד</option>
                            {bibleVerses
                              .filter(v => !verseStart || v.verseNumber > verseStart)
                              .map(v => (
                                <option key={v.verseNumber} value={v.verseNumber}>{numberToHebrew(v.verseNumber)}</option>
                              ))}
                          </select>
                        </div>
                      </div>
                      {verseStart && (
                        <div style={{
                          padding: '8px',
                          background: 'rgba(0,0,0,0.2)',
                          borderRadius: '4px',
                          marginBottom: '8px',
                          maxHeight: '60px',
                          overflowY: 'auto'
                        }}>
                          <div style={{
                            fontSize: '0.8rem',
                            color: 'rgba(255,255,255,0.8)',
                            direction: 'rtl',
                            textAlign: 'right',
                            lineHeight: 1.5
                          }}>
                            {bibleVerses
                              .filter(v => v.verseNumber >= verseStart! && v.verseNumber <= (verseEnd || verseStart!))
                              .map(v => v.hebrew || v.english || '')
                              .filter(Boolean)
                              .join(' ') || 'אין טקסט זמין'}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '8px', direction: 'rtl' }}>
                    <button
                      onClick={() => addBibleRefToSubtitle(index)}
                      disabled={!verseStart}
                      style={{
                        flex: 1,
                        padding: '8px',
                        background: verseStart ? '#00d4ff' : 'rgba(0,212,255,0.3)',
                        border: 'none',
                        borderRadius: '4px',
                        color: verseStart ? 'black' : 'rgba(0,0,0,0.5)',
                        cursor: verseStart ? 'pointer' : 'not-allowed',
                        fontSize: '0.85rem',
                        fontWeight: 600
                      }}
                    >
                      הוסף פסוק
                    </button>
                    <button
                      onClick={() => {
                        setBiblePickerIndex(null);
                        setBibleVerses([]);
                        setBibleBook('');
                        setBibleChapter(null);
                        setVerseStart(null);
                        setVerseEnd(null);
                        setBibleLoading(false);
                      }}
                      style={{
                        flex: 1,
                        padding: '8px',
                        background: 'transparent',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '4px',
                        color: 'rgba(255,255,255,0.7)',
                        cursor: 'pointer',
                        fontSize: '0.85rem'
                      }}
                    >
                      ביטול
                    </button>
                  </div>
                </div>
              ) : step === 1 ? (
                <button
                  onClick={() => {
                    setBibleVerses([]);
                    setBibleBook('');
                    setBibleChapter(null);
                    setVerseStart(null);
                    setVerseEnd(null);
                    setBibleLoading(false);
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
};

export default PrayerEditorModal;
