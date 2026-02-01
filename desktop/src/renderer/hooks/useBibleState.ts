import { useState, useRef, useCallback, useEffect } from 'react';
import { parseBibleSearch } from '../utils/bibleUtils';
import { toHebrewNumerals } from '../utils/hebrewUtils';

interface BibleBook {
  name: string;
  chapters: number;
  hebrewName?: string;
  testament?: 'old' | 'new';
}

interface BibleSlide {
  originalText: string;
  transliteration: string;
  translation: string;
  verseType: string;
  reference: string;
  hebrewReference: string;
}

interface Song {
  id: string;
  title: string;
  slides: Array<{
    originalText?: string;
    transliteration?: string;
    translation?: string;
    verseType?: string;
    reference?: string;
    hebrewReference?: string;
  }>;
}

interface UseBibleStateCallbacks {
  setSelectedSong: (song: Song | null) => void;
  setCurrentSlideIndex: (index: number) => void;
  setIsBlank: (blank: boolean) => void;
  setCurrentContentType: (type: 'song' | 'bible' | 'prayer' | 'presentation') => void;
}

interface UseBibleStateReturn {
  // State
  bibleBooks: BibleBook[];
  selectedBibleBook: string;
  selectedBibleChapter: number | '';
  bibleSlides: BibleSlide[];
  bibleLoading: boolean;
  biblePassage: Song | null;
  bibleSearchQuery: string;

  // Setters
  setSelectedBibleBook: React.Dispatch<React.SetStateAction<string>>;
  setSelectedBibleChapter: React.Dispatch<React.SetStateAction<number | ''>>;
  setBibleSearchQuery: React.Dispatch<React.SetStateAction<string>>;

  // Actions
  fetchBibleBooks: () => Promise<void>;
  handleBibleSearch: (query: string) => void;
}

export function useBibleState(callbacks: UseBibleStateCallbacks): UseBibleStateReturn {
  const { setSelectedSong, setCurrentSlideIndex, setIsBlank, setCurrentContentType } = callbacks;

  // State
  const [bibleBooks, setBibleBooks] = useState<BibleBook[]>([]);
  const [selectedBibleBook, setSelectedBibleBook] = useState('');
  const [selectedBibleChapter, setSelectedBibleChapter] = useState<number | ''>('');
  const [bibleSlides, setBibleSlides] = useState<BibleSlide[]>([]);
  const [bibleLoading, setBibleLoading] = useState(false);
  const [biblePassage, setBiblePassage] = useState<Song | null>(null);
  const [bibleSearchQuery, setBibleSearchQuery] = useState('');
  const bibleSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch Bible books list
  const fetchBibleBooks = useCallback(async () => {
    try {
      const books = await window.electronAPI.getBibleBooks();
      setBibleBooks((books || []) as BibleBook[]);
    } catch (error) {
      console.error('Error fetching Bible books:', error);
    }
  }, []);

  // Fetch verses for a specific book and chapter
  const fetchBibleVerses = useCallback(async (book: string, chapter: number) => {
    if (!book || !chapter) return;

    setBibleLoading(true);
    try {
      const response = await window.electronAPI.getBibleVerses(book, chapter);
      const bookData = bibleBooks.find(b => b.name === book);

      // Create a Bible passage that acts like a song
      const passage: Song = {
        id: `bible-${book}-${chapter}`,
        title: `${bookData?.hebrewName || book} ${toHebrewNumerals(chapter)} (${chapter})`,
        slides: response.slides.map((slide: any, idx: number) => ({
          originalText: slide.originalText,
          transliteration: '',
          translation: slide.translation,
          verseType: `${idx + 1}`,
          reference: slide.reference,
          hebrewReference: slide.hebrewReference
        }))
      };

      setBibleSlides(response.slides);
      setBiblePassage(passage);

      // Auto-select this passage with bible content type
      setSelectedSong(passage);
      setCurrentSlideIndex(0);
      setIsBlank(false);
      setCurrentContentType('bible');
    } catch (error) {
      console.error('Error fetching Bible verses:', error);
    } finally {
      setBibleLoading(false);
    }
  }, [bibleBooks, setSelectedSong, setCurrentSlideIndex, setIsBlank, setCurrentContentType]);

  // Handle Bible search using imported utilities
  const handleBibleSearch = useCallback((query: string) => {
    setBibleSearchQuery(query);
    const { book, chapter } = parseBibleSearch(query, bibleBooks);
    if (book && chapter) {
      setSelectedBibleBook(book.name);
      setSelectedBibleChapter(chapter);
    }
  }, [bibleBooks]);

  // Fetch verses when book and chapter are selected
  useEffect(() => {
    if (selectedBibleBook && selectedBibleChapter !== '') {
      fetchBibleVerses(selectedBibleBook, selectedBibleChapter as number);
    }
  }, [selectedBibleBook, selectedBibleChapter, fetchBibleVerses]);

  return {
    // State
    bibleBooks,
    selectedBibleBook,
    selectedBibleChapter,
    bibleSlides,
    bibleLoading,
    biblePassage,
    bibleSearchQuery,

    // Setters
    setSelectedBibleBook,
    setSelectedBibleChapter,
    setBibleSearchQuery,

    // Actions
    fetchBibleBooks,
    handleBibleSearch
  };
}
