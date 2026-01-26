import React, { useRef, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { BibleBook, BibleSlide, Song } from './types';

export interface BiblePanelProps {
  bibleBooks: BibleBook[];
  selectedBibleBook: string;
  selectedBibleChapter: number | '';
  bibleSlides: BibleSlide[];
  bibleLoading: boolean;
  biblePassage: Song | null;
  bibleSearchQuery: string;
  onBibleBookChange: (book: string) => void;
  onBibleChapterChange: (chapter: number | '') => void;
  onBibleSearch: (query: string) => void;
  onAddBibleToSetlist: (passage: Song) => void;
}

const BiblePanel = memo<BiblePanelProps>(({
  bibleBooks,
  selectedBibleBook,
  selectedBibleChapter,
  bibleSlides,
  bibleLoading,
  biblePassage,
  bibleSearchQuery,
  onBibleBookChange,
  onBibleChapterChange,
  onBibleSearch,
  onAddBibleToSetlist
}) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he';
  const bibleSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Separate old and new testament books
  const oldTestamentBooks = bibleBooks.filter(book => book.testament === 'old');
  const newTestamentBooks = bibleBooks.filter(book => book.testament === 'new');

  // Get chapter options for selected book
  const getChapterOptions = () => {
    const book = bibleBooks.find(b => b.name === selectedBibleBook);
    if (!book) return [];
    return Array.from({ length: book.chapters }, (_, i) => i + 1);
  };

  const handleSearchChange = (value: string) => {
    if (bibleSearchDebounceRef.current) {
      clearTimeout(bibleSearchDebounceRef.current);
    }
    bibleSearchDebounceRef.current = setTimeout(() => {
      onBibleSearch(value);
    }, 150);
  };

  const handleBookChange = (book: string) => {
    onBibleBookChange(book);
    onBibleChapterChange('');
  };

  return (
    <div style={{ display: 'flex', padding: '12px', flexDirection: 'column', gap: '12px' }}>
      {/* Search Input */}
      <div style={{ position: 'relative' }}>
        <svg width="14" height="14" fill="rgba(255,255,255,0.5)" viewBox="0 0 16 16" style={{ position: 'absolute', left: isRTL ? 'auto' : '10px', right: isRTL ? '10px' : 'auto', top: '50%', transform: 'translateY(-50%)' }}>
          <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
        </svg>
        <input
          type="text"
          placeholder="תהילים כ״ג or Psalms 23..."
          defaultValue={bibleSearchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.08)',
            border: '2px solid rgba(255,255,255,0.15)',
            borderRadius: '8px',
            padding: isRTL ? '10px 32px 10px 12px' : '10px 12px 10px 32px',
            color: 'white',
            fontSize: '0.85rem',
            outline: 'none'
          }}
        />
      </div>

      {/* Book Selector */}
      <div>
        <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', marginBottom: '6px', textTransform: 'uppercase' }}>{t('controlPanel.book')}</div>
        <select
          value={selectedBibleBook}
          onChange={(e) => handleBookChange(e.target.value)}
          style={{
            width: '100%',
            background: '#2a2a4a',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '6px',
            padding: '8px',
            color: 'white',
            fontSize: '0.85rem'
          }}
        >
          <option value="" style={{ background: '#2a2a4a', color: 'white' }}>{t('controlPanel.selectABook')}</option>
          <optgroup label="תנ״ך (Old Testament)" style={{ background: '#1a1a3a', color: '#aaa' }}>
            {oldTestamentBooks.map(book => (
              <option key={book.name} value={book.name} style={{ background: '#2a2a4a', color: 'white' }}>
                {book.hebrewName} - {book.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="הברית החדשה (New Testament)" style={{ background: '#1a1a3a', color: '#aaa' }}>
            {newTestamentBooks.map(book => (
              <option key={book.name} value={book.name} style={{ background: '#2a2a4a', color: 'white' }}>
                {book.hebrewName} - {book.name}
              </option>
            ))}
          </optgroup>
        </select>
      </div>

      {/* Chapter Selector */}
      {selectedBibleBook && (
        <div>
          <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', marginBottom: '6px', textTransform: 'uppercase' }}>{t('controlPanel.chapter')}</div>
          <select
            value={selectedBibleChapter}
            onChange={(e) => onBibleChapterChange(e.target.value ? parseInt(e.target.value) : '')}
            style={{
              width: '100%',
              background: '#2a2a4a',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '6px',
              padding: '8px',
              color: 'white',
              fontSize: '0.85rem'
            }}
          >
            <option value="" style={{ background: '#2a2a4a', color: 'white' }}>{t('controlPanel.selectChapter')}</option>
            {getChapterOptions().map(ch => (
              <option key={ch} value={ch} style={{ background: '#2a2a4a', color: 'white' }}>{ch}</option>
            ))}
          </select>
        </div>
      )}

      {/* Loading indicator */}
      {bibleLoading && (
        <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.5)' }}>
          {t('controlPanel.loadingVerses')}
        </div>
      )}

      {/* Status and Add to Setlist */}
      {biblePassage && bibleSlides.length > 0 && !bibleLoading && (
        <div>
          <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', marginBottom: '8px', textAlign: 'center' }}>
            {biblePassage.title} • {bibleSlides.length} verses
          </div>
          <button
            onClick={() => onAddBibleToSetlist(biblePassage)}
            style={{
              width: '100%',
              background: '#28a745',
              border: 'none',
              borderRadius: '8px',
              padding: '10px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 600
            }}
          >
            {t('tools.addToSetlist')}
          </button>
        </div>
      )}
    </div>
  );
});

BiblePanel.displayName = 'BiblePanel';

export default BiblePanel;
