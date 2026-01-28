import React, { useRef, memo, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { BibleBook, BibleSlide, Song } from './types';
import { hebrewBookNames, numberToHebrew } from '../../../utils/bibleUtils';

interface BibleSuggestion {
  display: string;
  value: string;
  book: BibleBook;
  chapter?: number;
}

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
  const [searchInputValue, setSearchInputValue] = useState(bibleSearchQuery || '');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  // Separate old and new testament books
  const oldTestamentBooks = bibleBooks.filter(book => book.testament === 'old');
  const newTestamentBooks = bibleBooks.filter(book => book.testament === 'new');

  // Get chapter options for selected book
  const getChapterOptions = () => {
    const book = bibleBooks.find(b => b.name === selectedBibleBook);
    if (!book) return [];
    return Array.from({ length: book.chapters }, (_, i) => i + 1);
  };

  // Generate autocomplete suggestions based on input
  const suggestions = useMemo((): BibleSuggestion[] => {
    const input = searchInputValue.trim().toLowerCase();
    if (!input || input.length < 1) return [];

    const results: BibleSuggestion[] = [];
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
      // Simple Hebrew numeral conversion for common chapters
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

    // Find matching books
    for (const book of bibleBooks) {
      if (results.length >= maxSuggestions) break;

      const englishLower = book.name.toLowerCase();
      const hebrewName = book.hebrewName || '';

      // Check if book matches
      const matchesEnglish = englishLower.startsWith(bookPart) || englishLower.includes(bookPart);
      const matchesHebrew = hebrewName && (hebrewName.startsWith(bookPart) || hebrewName.includes(bookPart));

      // Also check Hebrew book name mapping
      let matchesHebrewMapping = false;
      for (const [hebrew, english] of Object.entries(hebrewBookNames)) {
        if (english.toLowerCase() === englishLower && hebrew.startsWith(bookPart)) {
          matchesHebrewMapping = true;
          break;
        }
      }

      if (matchesEnglish || matchesHebrew || matchesHebrewMapping) {
        if (chapterPart !== null && chapterPart >= 1 && chapterPart <= book.chapters) {
          // Suggest specific chapter
          results.push({
            display: `${book.hebrewName || book.name} ${numberToHebrew(chapterPart)} (${book.name} ${chapterPart})`,
            value: `${book.name} ${chapterPart}`,
            book,
            chapter: chapterPart
          });
        } else if (chapterPart === null) {
          // Suggest book with first few chapters
          const chaptersToShow = Math.min(3, book.chapters);
          for (let ch = 1; ch <= chaptersToShow && results.length < maxSuggestions; ch++) {
            results.push({
              display: `${book.hebrewName || book.name} ${numberToHebrew(ch)} (${book.name} ${ch})`,
              value: `${book.name} ${ch}`,
              book,
              chapter: ch
            });
          }
        }
      }
    }

    return results;
  }, [searchInputValue, bibleBooks]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchInputValue(value);
    setShowSuggestions(value.trim().length > 0);
    setSelectedSuggestionIndex(-1);

    if (bibleSearchDebounceRef.current) {
      clearTimeout(bibleSearchDebounceRef.current);
    }
    bibleSearchDebounceRef.current = setTimeout(() => {
      onBibleSearch(value);
    }, 300);
  }, [onBibleSearch]);

  const handleSuggestionClick = useCallback((suggestion: BibleSuggestion) => {
    setSearchInputValue(suggestion.value);
    setShowSuggestions(false);
    onBibleSearch(suggestion.value);
  }, [onBibleSearch]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSuggestionIndex(prev =>
        prev < suggestions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSuggestionIndex(prev =>
        prev > 0 ? prev - 1 : suggestions.length - 1
      );
    } else if (e.key === 'Enter' && selectedSuggestionIndex >= 0) {
      e.preventDefault();
      handleSuggestionClick(suggestions[selectedSuggestionIndex]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  }, [showSuggestions, suggestions, selectedSuggestionIndex, handleSuggestionClick]);

  const handleBookChange = (book: string) => {
    onBibleBookChange(book);
    onBibleChapterChange('');
  };

  return (
    <div style={{ display: 'flex', padding: '12px', flexDirection: 'column', gap: '12px' }}>
      {/* Search Input with Autocomplete */}
      <div style={{ position: 'relative' }}>
        <svg width="14" height="14" fill="rgba(255,255,255,0.5)" viewBox="0 0 16 16" style={{ position: 'absolute', left: isRTL ? 'auto' : '10px', right: isRTL ? '10px' : 'auto', top: '50%', transform: 'translateY(-50%)', zIndex: 1 }}>
          <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
        </svg>
        <input
          ref={inputRef}
          type="text"
          placeholder="תהילים כ״ג or Psalms 23..."
          value={searchInputValue}
          onChange={(e) => handleSearchChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => searchInputValue.trim() && setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.08)',
            border: '2px solid rgba(255,255,255,0.15)',
            borderRadius: showSuggestions && suggestions.length > 0 ? '8px 8px 0 0' : '8px',
            padding: isRTL ? '10px 32px 10px 12px' : '10px 12px 10px 32px',
            color: 'white',
            fontSize: '0.85rem',
            outline: 'none'
          }}
        />

        {/* Autocomplete Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              background: '#2a2a4a',
              border: '2px solid rgba(255,255,255,0.15)',
              borderTop: 'none',
              borderRadius: '0 0 8px 8px',
              maxHeight: '200px',
              overflowY: 'auto',
              zIndex: 1000
            }}
          >
            {suggestions.map((suggestion, index) => (
              <div
                key={`${suggestion.book.name}-${suggestion.chapter}`}
                onClick={() => handleSuggestionClick(suggestion)}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  background: index === selectedSuggestionIndex ? 'rgba(255,255,255,0.1)' : 'transparent',
                  borderBottom: index < suggestions.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onMouseEnter={() => setSelectedSuggestionIndex(index)}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
                <span style={{ color: 'white', fontSize: '0.85rem' }}>
                  {suggestion.display}
                </span>
              </div>
            ))}
          </div>
        )}
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
