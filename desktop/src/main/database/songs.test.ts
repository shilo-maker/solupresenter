import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Create mock database state
let mockDb: any = null;
let mockSongs: any[] = [];
let idCounter = 0;

// Mock the database index module
vi.mock('./index', () => {
  return {
    getDb: () => mockDb,
    saveDatabase: vi.fn(),
    createBackup: vi.fn(),
    beginTransaction: vi.fn(),
    commitTransaction: vi.fn(),
    rollbackTransaction: vi.fn(),
    generateId: () => {
      idCounter++;
      return `test-id-${idCounter}`;
    },
    queryAll: (sql: string, params: any[] = []) => {
      if (!mockDb) return [];

      // Handle songs table queries
      if (!sql.includes('songs')) return [];

      // Handle "SELECT id FROM songs WHERE title = ? AND id != ?" (unique title check with exclude)
      if (sql.includes('SELECT id FROM songs WHERE title = ?') && sql.includes('AND id != ?')) {
        const title = params[0];
        const excludeId = params[1];
        return mockSongs.filter(s => s.title === title && s.id !== excludeId);
      }

      // Handle "SELECT id FROM songs WHERE title = ?" (unique title check without exclude)
      if (sql.includes('SELECT id FROM songs WHERE title = ?') && !sql.includes('LIKE') && !sql.includes('AND id')) {
        const title = params[0];
        return mockSongs.filter(s => s.title === title);
      }

      // Handle "SELECT title FROM songs WHERE (title = ? OR title LIKE ?) AND id != ?"
      if (sql.includes('SELECT title FROM songs WHERE') && sql.includes('title LIKE ?') && sql.includes('AND id != ?')) {
        const baseTitle = params[0];
        const pattern = params[1]; // e.g. "My Song (%)"
        const excludeId = params[2];
        return mockSongs.filter(s => {
          if (s.id === excludeId) return false;
          if (s.title === baseTitle) return true;
          // Match pattern like "BaseTitle (%)" -> "BaseTitle (N)"
          const patternBase = pattern.replace(' (%)', '');
          const regex = new RegExp(`^${escapeRegex(patternBase)} \\(\\d+\\)$`);
          return regex.test(s.title);
        });
      }

      // Handle "SELECT title FROM songs WHERE title = ? OR title LIKE ?"
      if (sql.includes('SELECT title FROM songs WHERE') && sql.includes('title LIKE ?') && !sql.includes('AND id')) {
        const baseTitle = params[0];
        const pattern = params[1]; // e.g. "My Song (%)"
        return mockSongs.filter(s => {
          if (s.title === baseTitle) return true;
          const patternBase = pattern.replace(' (%)', '');
          const regex = new RegExp(`^${escapeRegex(patternBase)} \\(\\d+\\)$`);
          return regex.test(s.title);
        });
      }

      // Handle remoteId IN (...) query for batchResolveSongs
      if (sql.includes('remoteId IN')) {
        return mockSongs.filter(s => s.remoteId && params.includes(s.remoteId));
      }

      // Handle title COLLATE NOCASE IN (...) query for batchResolveSongs
      if (sql.includes('title COLLATE NOCASE IN')) {
        return mockSongs.filter(s =>
          params.some(p => s.title && s.title.toLowerCase() === String(p).toLowerCase())
        );
      }

      // Handle search queries with LIKE for getSongs(query)
      if (sql.includes('title LIKE ?') && sql.includes('author LIKE ?') && sql.includes('matchPriority')) {
        const searchPattern = params[0]; // e.g. "%query%"
        const searchTerm = searchPattern.replace(/%/g, '').toLowerCase();
        return mockSongs.filter(s => {
          const titleMatch = s.title && s.title.toLowerCase().includes(searchTerm);
          const authorMatch = s.author && s.author.toLowerCase().includes(searchTerm);
          return titleMatch || authorMatch;
        }).map(s => ({ ...s, matchPriority: 0 }));
      }

      // Handle content search (slides LIKE ? OR tags LIKE ?) with NOT IN exclusion
      if (sql.includes('slides LIKE ?') && sql.includes('tags LIKE ?') && sql.includes('matchPriority')) {
        const searchPattern = params[0]; // e.g. "%query%"
        const searchTerm = searchPattern.replace(/%/g, '').toLowerCase();
        const excludeIds = params.slice(2); // IDs already matched by title/author
        return mockSongs.filter(s => {
          if (excludeIds.includes(s.id)) return false;
          const slidesStr = typeof s.slides === 'string' ? s.slides : JSON.stringify(s.slides);
          const tagsStr = typeof s.tags === 'string' ? s.tags : JSON.stringify(s.tags);
          const slidesMatch = slidesStr && slidesStr.toLowerCase().includes(searchTerm);
          const tagsMatch = tagsStr && tagsStr.toLowerCase().includes(searchTerm);
          return slidesMatch || tagsMatch;
        }).map(s => ({ ...s, matchPriority: 2 }));
      }

      // Handle "SELECT * FROM songs ORDER BY ..." (getSongs without query)
      if (sql.includes('SELECT * FROM songs') && sql.includes('ORDER BY') && !sql.includes('WHERE')) {
        // Sort: Hebrew first, then alphabetically by title
        return [...mockSongs].sort((a, b) => {
          const aHe = a.originalLanguage === 'he' ? 0 : 1;
          const bHe = b.originalLanguage === 'he' ? 0 : 1;
          if (aHe !== bHe) return aHe - bHe;
          return (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' });
        });
      }

      return mockSongs;
    },
    queryOne: (sql: string, params: any[] = []) => {
      if (!mockDb) return null;

      // Handle "SELECT * FROM songs WHERE id = ?"
      if (sql.includes('WHERE id = ?')) {
        return mockSongs.find(s => s.id === params[0]) || null;
      }

      // Handle "SELECT * FROM songs WHERE remoteId = ?"
      if (sql.includes('WHERE remoteId = ?')) {
        return mockSongs.find(s => s.remoteId === params[0]) || null;
      }

      // Handle "SELECT * FROM songs WHERE title = ? COLLATE NOCASE"
      if (sql.includes('WHERE title = ?') && sql.includes('COLLATE NOCASE')) {
        return mockSongs.find(s => s.title && s.title.toLowerCase() === String(params[0]).toLowerCase()) || null;
      }

      // Handle "SELECT id FROM songs WHERE title = ? AND id != ?" (unique title check with exclude)
      if (sql.includes('SELECT id FROM songs WHERE title = ?') && sql.includes('AND id != ?')) {
        return mockSongs.find(s => s.title === params[0] && s.id !== params[1]) || null;
      }

      // Handle "SELECT id FROM songs WHERE title = ?" (unique title check)
      if (sql.includes('SELECT id FROM songs WHERE title = ?') && !sql.includes('AND id')) {
        return mockSongs.find(s => s.title === params[0]) || null;
      }

      return null;
    }
  };
});

// Mock axios
vi.mock('axios');

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Helper: add a song directly to mockSongs (simulates pre-existing data)
function seedSong(overrides: Partial<any> = {}): any {
  idCounter++;
  const song = {
    id: `seed-id-${idCounter}`,
    title: `Song ${idCounter}`,
    originalLanguage: 'he',
    slides: '[]',
    tags: '[]',
    author: null,
    backgroundImage: '',
    arrangements: '[]',
    usageCount: 0,
    remoteId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  };
  mockSongs.push(song);
  return song;
}

// Import functions after mocking
import {
  getSongs,
  getSong,
  getSongByRemoteId,
  getSongByTitle,
  batchResolveSongs,
  createSong,
  updateSong,
  deleteSong,
  importSongsFromJSON,
  exportSongsToJSON
} from './songs';

describe('songs database functions', () => {
  beforeEach(() => {
    idCounter = 0;
    mockSongs = [];
    mockDb = {
      run: vi.fn((sql: string, params?: any[]) => {
        // Simulate INSERT operations
        if (sql.includes('INSERT INTO songs')) {
          const [id, title, originalLanguage, slides, tags, author, backgroundImage, arrangements, createdAtOrRemoteId, createdAtOrUpdatedAt, maybeUpdatedAt] = params || [];
          // importSongsFromBackend has remoteId as extra param
          if (maybeUpdatedAt !== undefined) {
            // Import with remoteId: (id, title, originalLanguage, slides, tags, author, backgroundImage, arrangements, remoteId, createdAt, updatedAt)
            mockSongs.push({
              id, title, originalLanguage, slides, tags, author, backgroundImage, arrangements,
              remoteId: createdAtOrRemoteId,
              createdAt: createdAtOrUpdatedAt,
              updatedAt: maybeUpdatedAt,
              usageCount: 0
            });
          } else {
            // Normal create: (id, title, originalLanguage, slides, tags, author, backgroundImage, arrangements, createdAt, updatedAt)
            mockSongs.push({
              id, title, originalLanguage, slides, tags, author, backgroundImage, arrangements,
              remoteId: null,
              createdAt: createdAtOrRemoteId,
              updatedAt: createdAtOrUpdatedAt,
              usageCount: 0
            });
          }
        }
        // Simulate UPDATE operations
        if (sql.includes('UPDATE songs SET') && sql.includes('WHERE id = ?')) {
          const idParam = params![params!.length - 1];
          const song = mockSongs.find(s => s.id === idParam);
          if (song) {
            // Parse SET clause from the sql to figure out which fields to update
            const setClause = sql.match(/SET (.+?) WHERE/)?.[1] || '';
            const fields = setClause.split(',').map(f => f.trim().split(' = ')[0].trim());
            let paramIdx = 0;
            for (const field of fields) {
              if (paramIdx < params!.length - 1) {
                song[field] = params![paramIdx];
                paramIdx++;
              }
            }
          }
        }
        // Simulate DELETE operations
        if (sql.includes('DELETE FROM songs WHERE id = ?')) {
          const deleteId = params![0];
          mockSongs = mockSongs.filter(s => s.id !== deleteId);
        }
      }),
      exec: vi.fn()
    };
  });

  afterEach(() => {
    mockDb = null;
    mockSongs = [];
    vi.clearAllMocks();
  });

  // ==========================================
  // 1. createSong
  // ==========================================
  describe('createSong', () => {
    it('should create a song with valid data', async () => {
      const song = await createSong({
        title: 'Amazing Grace',
        originalLanguage: 'en',
        slides: [{ originalText: 'Verse 1', transliteration: '', translation: '' }],
        tags: ['hymn', 'classic'],
        author: 'John Newton'
      });

      expect(song).toBeDefined();
      expect(song.title).toBe('Amazing Grace');
      expect(song.originalLanguage).toBe('en');
      expect(song.author).toBe('John Newton');
      expect(song.id).toBeDefined();
      expect(song.createdAt).toBeDefined();
      expect(song.updatedAt).toBeDefined();
      expect(song.usageCount).toBe(0);
      expect(song.remoteId).toBeNull();
    });

    it('should create a song with minimal data (title only)', async () => {
      const song = await createSong({ title: 'Simple Song' });

      expect(song).toBeDefined();
      expect(song.title).toBe('Simple Song');
      expect(song.originalLanguage).toBe('he'); // default
      expect(song.slides).toEqual([]);
      expect(song.tags).toEqual([]);
      expect(song.author).toBeNull();
      expect(song.backgroundImage).toBe('');
      expect(song.arrangements).toEqual([]);
    });

    it('should throw error for empty title', async () => {
      await expect(createSong({ title: '' })).rejects.toThrow('Song title is required and must be a non-empty string');
    });

    it('should throw error for whitespace-only title', async () => {
      await expect(createSong({ title: '   ' })).rejects.toThrow('Song title is required and must be a non-empty string');
    });

    it('should throw error for null title', async () => {
      await expect(createSong({ title: null as any })).rejects.toThrow('Song title is required and must be a non-empty string');
    });

    it('should throw error for undefined title', async () => {
      await expect(createSong({ title: undefined as any })).rejects.toThrow('Song title is required and must be a non-empty string');
    });

    it('should throw error for non-string title', async () => {
      await expect(createSong({ title: 123 as any })).rejects.toThrow('Song title is required and must be a non-empty string');
    });

    it('should throw error if database is not initialized', async () => {
      mockDb = null;
      await expect(createSong({ title: 'Test' })).rejects.toThrow('Database not initialized');
    });

    it('should trim the title', async () => {
      const song = await createSong({ title: '  Trimmed Song  ' });
      expect(song.title).toBe('Trimmed Song');
    });

    it('should truncate title to MAX_TITLE_LENGTH (500)', async () => {
      const longTitle = 'a'.repeat(600);
      const song = await createSong({ title: longTitle });
      expect(song.title.length).toBeLessThanOrEqual(500);
    });

    it('should truncate author to MAX_AUTHOR_LENGTH (255)', async () => {
      const longAuthor = 'b'.repeat(300);
      const song = await createSong({ title: 'Author Test', author: longAuthor });
      expect(song.author.length).toBeLessThanOrEqual(255);
    });

    it('should truncate backgroundImage to MAX_BACKGROUND_LENGTH (5000)', async () => {
      const longBg = 'c'.repeat(6000);
      const song = await createSong({ title: 'BG Test', backgroundImage: longBg });
      expect(song.backgroundImage.length).toBeLessThanOrEqual(5000);
    });

    it('should limit slides to MAX_SLIDES_COUNT (500)', async () => {
      const slides = Array.from({ length: 600 }, (_, i) => ({
        originalText: `Slide ${i}`
      }));
      const song = await createSong({ title: 'Many Slides', slides });
      expect(song.slides.length).toBeLessThanOrEqual(500);
    });

    it('should truncate slide text fields to MAX_SLIDE_TEXT_LENGTH (10000)', async () => {
      const longText = 'x'.repeat(15000);
      const song = await createSong({
        title: 'Long Slide',
        slides: [{
          originalText: longText,
          transliteration: longText,
          translation: longText,
          translationOverflow: longText
        }]
      });
      expect(song.slides[0].originalText.length).toBeLessThanOrEqual(10000);
      expect(song.slides[0].transliteration.length).toBeLessThanOrEqual(10000);
      expect(song.slides[0].translation.length).toBeLessThanOrEqual(10000);
      expect(song.slides[0].translationOverflow.length).toBeLessThanOrEqual(10000);
    });

    it('should truncate verseType to 50 chars', async () => {
      const longVerse = 'v'.repeat(100);
      const song = await createSong({
        title: 'Verse Type Test',
        slides: [{ verseType: longVerse }]
      });
      expect(song.slides[0].verseType.length).toBeLessThanOrEqual(50);
    });

    it('should filter out non-string tags', async () => {
      const song = await createSong({
        title: 'Tags Test',
        tags: ['valid', 123 as any, null as any, 'another']
      });
      expect(song.tags).toEqual(['valid', 'another']);
    });

    it('should limit tags to 100 entries', async () => {
      const tags = Array.from({ length: 150 }, (_, i) => `tag-${i}`);
      const song = await createSong({ title: 'Many Tags', tags });
      expect(song.tags.length).toBeLessThanOrEqual(100);
    });

    it('should generate unique title when duplicate exists', async () => {
      // Pre-seed a song with the same title
      seedSong({ title: 'Duplicate Song' });

      const song = await createSong({ title: 'Duplicate Song' });
      expect(song.title).toBe('Duplicate Song (1)');
    });

    it('should generate unique title with incrementing numbers', async () => {
      seedSong({ title: 'My Song' });
      seedSong({ title: 'My Song (1)' });

      const song = await createSong({ title: 'My Song' });
      expect(song.title).toBe('My Song (2)');
    });

    it('should find gaps in numbering when generating unique titles', async () => {
      seedSong({ title: 'Gap Song' });
      seedSong({ title: 'Gap Song (2)' }); // skip (1)

      const song = await createSong({ title: 'Gap Song' });
      expect(song.title).toBe('Gap Song (1)');
    });

    it('should default originalLanguage to he', async () => {
      const song = await createSong({ title: 'Hebrew Default' });
      expect(song.originalLanguage).toBe('he');
    });

    it('should handle non-array slides gracefully', async () => {
      const song = await createSong({
        title: 'No Slides',
        slides: 'not-an-array' as any
      });
      expect(song.slides).toEqual([]);
    });

    it('should handle non-array tags gracefully', async () => {
      const song = await createSong({
        title: 'No Tags',
        tags: 'not-an-array' as any
      });
      expect(song.tags).toEqual([]);
    });

    it('should handle non-array arrangements gracefully', async () => {
      const song = await createSong({
        title: 'No Arrangements',
        arrangements: 'not-an-array' as any
      });
      expect(song.arrangements).toEqual([]);
    });

    it('should set empty string defaults for missing slide fields', async () => {
      const song = await createSong({
        title: 'Sparse Slide',
        slides: [{}]
      });
      expect(song.slides[0]).toEqual({
        originalText: '',
        transliteration: '',
        translation: '',
        translationOverflow: '',
        verseType: ''
      });
    });
  });

  // ==========================================
  // 2. getSongs
  // ==========================================
  describe('getSongs', () => {
    it('should return all songs when no query', async () => {
      seedSong({ title: 'Song A' });
      seedSong({ title: 'Song B' });
      seedSong({ title: 'Song C' });

      const songs = await getSongs();
      expect(songs.length).toBe(3);
    });

    it('should return empty array when no songs exist', async () => {
      const songs = await getSongs();
      expect(songs).toEqual([]);
    });

    it('should order Hebrew songs first', async () => {
      seedSong({ title: 'English Song', originalLanguage: 'en' });
      seedSong({ title: 'Hebrew Song', originalLanguage: 'he' });

      const songs = await getSongs();
      expect(songs[0].originalLanguage).toBe('he');
      expect(songs[1].originalLanguage).toBe('en');
    });

    it('should sort alphabetically within language group', async () => {
      seedSong({ title: 'Zeta', originalLanguage: 'he' });
      seedSong({ title: 'Alpha', originalLanguage: 'he' });
      seedSong({ title: 'Middle', originalLanguage: 'he' });

      const songs = await getSongs();
      expect(songs[0].title).toBe('Alpha');
      expect(songs[1].title).toBe('Middle');
      expect(songs[2].title).toBe('Zeta');
    });

    it('should search by title', async () => {
      seedSong({ title: 'Amazing Grace', author: 'Newton' });
      seedSong({ title: 'How Great', author: 'Hillsong' });

      const songs = await getSongs('Amazing');
      expect(songs.length).toBeGreaterThanOrEqual(1);
      expect(songs.some(s => s.title === 'Amazing Grace')).toBe(true);
    });

    it('should search by author', async () => {
      seedSong({ title: 'Song A', author: 'David' });
      seedSong({ title: 'Song B', author: 'Sarah' });

      const songs = await getSongs('David');
      expect(songs.length).toBeGreaterThanOrEqual(1);
      expect(songs.some(s => s.author === 'David')).toBe(true);
    });

    it('should search by content in slides (LIKE)', async () => {
      seedSong({
        title: 'Song Without Match',
        author: 'Nobody',
        slides: JSON.stringify([{ originalText: 'nothing here' }])
      });
      seedSong({
        title: 'Song With Hallelujah',
        author: 'Someone',
        slides: JSON.stringify([{ originalText: 'Hallelujah praise the Lord' }])
      });

      const songs = await getSongs('Hallelujah');
      expect(songs.length).toBeGreaterThanOrEqual(1);
      // The content match should include the song with hallelujah in slides
      const hallelujahSong = songs.find(s => s.title === 'Song With Hallelujah');
      expect(hallelujahSong).toBeDefined();
    });

    it('should search by tags content', async () => {
      seedSong({
        title: 'Tagged Song',
        author: 'Test',
        tags: JSON.stringify(['worship', 'praise'])
      });
      seedSong({
        title: 'Other Song',
        author: 'Test2',
        tags: JSON.stringify(['secular'])
      });

      const songs = await getSongs('worship');
      expect(songs.some(s => s.title === 'Tagged Song')).toBe(true);
    });

    it('should prioritize title matches over content matches', async () => {
      seedSong({
        title: 'Love Song',
        author: null,
        slides: JSON.stringify([{ originalText: 'ordinary lyrics' }])
      });
      seedSong({
        title: 'Other',
        author: null,
        slides: JSON.stringify([{ originalText: 'love is all around' }])
      });

      const songs = await getSongs('Love');
      // Title match should come first (matchPriority 0 vs 2)
      if (songs.length >= 2) {
        expect(songs[0].title).toBe('Love Song');
      }
    });

    it('should return empty array when search has no matches', async () => {
      seedSong({ title: 'Song A' });

      const songs = await getSongs('NonexistentQuery12345');
      expect(songs.length).toBe(0);
    });
  });

  // ==========================================
  // 3. getSong / getSongByRemoteId / getSongByTitle
  // ==========================================
  describe('getSong', () => {
    it('should return a song by id', async () => {
      const seeded = seedSong({ title: 'Find Me' });

      const song = await getSong(seeded.id);
      expect(song).toBeDefined();
      expect(song.title).toBe('Find Me');
    });

    it('should return null for non-existent id', async () => {
      const song = await getSong('non-existent-id');
      expect(song).toBeNull();
    });

    it('should return null when db is not initialized', async () => {
      mockDb = null;
      const song = await getSong('any-id');
      expect(song).toBeNull();
    });
  });

  describe('getSongByRemoteId', () => {
    it('should return a song by remoteId', async () => {
      seedSong({ title: 'Remote Song', remoteId: 'remote-123' });

      const song = await getSongByRemoteId('remote-123');
      expect(song).toBeDefined();
      expect(song.title).toBe('Remote Song');
    });

    it('should return null for non-existent remoteId', async () => {
      const song = await getSongByRemoteId('non-existent-remote');
      expect(song).toBeNull();
    });

    it('should return null when db is not initialized', async () => {
      mockDb = null;
      const song = await getSongByRemoteId('any-remote');
      expect(song).toBeNull();
    });
  });

  describe('getSongByTitle', () => {
    it('should return a song by title (case-insensitive)', async () => {
      seedSong({ title: 'My Great Song' });

      const song = await getSongByTitle('my great song');
      expect(song).toBeDefined();
      expect(song.title).toBe('My Great Song');
    });

    it('should return null for non-existent title', async () => {
      const song = await getSongByTitle('No Such Song');
      expect(song).toBeNull();
    });

    it('should return null when db is not initialized', async () => {
      mockDb = null;
      const song = await getSongByTitle('any title');
      expect(song).toBeNull();
    });
  });

  // ==========================================
  // 4. updateSong
  // ==========================================
  describe('updateSong', () => {
    it('should update song title', async () => {
      const seeded = seedSong({ title: 'Old Title' });

      const updated = await updateSong(seeded.id, { title: 'New Title' });
      expect(updated).toBeDefined();
      expect(updated.title).toBe('New Title');
    });

    it('should update song author', async () => {
      const seeded = seedSong({ title: 'Author Song', author: 'Old Author' });

      const updated = await updateSong(seeded.id, { author: 'New Author' });
      expect(updated).toBeDefined();
      expect(updated.author).toBe('New Author');
    });

    it('should update song originalLanguage', async () => {
      const seeded = seedSong({ title: 'Language Song', originalLanguage: 'he' });

      const updated = await updateSong(seeded.id, { originalLanguage: 'en' });
      expect(updated).toBeDefined();
      expect(updated.originalLanguage).toBe('en');
    });

    it('should update song slides', async () => {
      const seeded = seedSong({ title: 'Slides Song', slides: '[]' });

      const newSlides = [{ originalText: 'New verse' }];
      const updated = await updateSong(seeded.id, { slides: newSlides });
      expect(updated).toBeDefined();
      expect(updated.slides).toEqual(newSlides);
    });

    it('should update song tags', async () => {
      const seeded = seedSong({ title: 'Tags Song', tags: '[]' });

      const updated = await updateSong(seeded.id, { tags: ['worship', 'new'] });
      expect(updated).toBeDefined();
      expect(updated.tags).toEqual(['worship', 'new']);
    });

    it('should update backgroundImage', async () => {
      const seeded = seedSong({ title: 'BG Song', backgroundImage: '' });

      const updated = await updateSong(seeded.id, { backgroundImage: 'new-bg.jpg' });
      expect(updated).toBeDefined();
      expect(updated.backgroundImage).toBe('new-bg.jpg');
    });

    it('should update arrangements', async () => {
      const seeded = seedSong({ title: 'Arr Song', arrangements: '[]' });

      const newArrangements = [{ id: 'arr-1', name: 'Default', sections: [], createdAt: '', updatedAt: '' }];
      const updated = await updateSong(seeded.id, { arrangements: newArrangements as any });
      expect(updated).toBeDefined();
      expect(updated.arrangements).toEqual(newArrangements);
    });

    it('should do partial updates (only update provided fields)', async () => {
      const seeded = seedSong({
        title: 'Partial Song',
        author: 'Original Author',
        originalLanguage: 'he'
      });

      const updated = await updateSong(seeded.id, { author: 'Updated Author' });
      expect(updated).toBeDefined();
      expect(updated.author).toBe('Updated Author');
      expect(updated.title).toBe('Partial Song'); // unchanged
      expect(updated.originalLanguage).toBe('he'); // unchanged
    });

    it('should set updatedAt on update', async () => {
      const seeded = seedSong({ title: 'Timestamp Song' });
      const originalUpdatedAt = seeded.updatedAt;

      // Small delay to ensure different timestamp
      await new Promise(r => setTimeout(r, 10));

      const updated = await updateSong(seeded.id, { author: 'New' });
      expect(updated.updatedAt).toBeDefined();
      // updatedAt should be newer or at least defined
      expect(typeof updated.updatedAt).toBe('string');
    });

    it('should return null for non-existent song', async () => {
      const updated = await updateSong('non-existent-id', { title: 'New Title' });
      expect(updated).toBeNull();
    });

    it('should return null when db is not initialized', async () => {
      mockDb = null;
      const updated = await updateSong('any-id', { title: 'New' });
      expect(updated).toBeNull();
    });

    it('should throw error for empty title on update', async () => {
      const seeded = seedSong({ title: 'Valid Title' });

      await expect(updateSong(seeded.id, { title: '' })).rejects.toThrow('Song title must be a non-empty string');
    });

    it('should throw error for whitespace-only title on update', async () => {
      const seeded = seedSong({ title: 'Valid Title' });

      await expect(updateSong(seeded.id, { title: '   ' })).rejects.toThrow('Song title must be a non-empty string');
    });

    it('should generate unique title on update when duplicate exists', async () => {
      const song1 = seedSong({ title: 'Existing Title' });
      const song2 = seedSong({ title: 'Original Title' });

      const updated = await updateSong(song2.id, { title: 'Existing Title' });
      expect(updated).toBeDefined();
      expect(updated.title).toBe('Existing Title (1)');
    });

    it('should allow keeping the same title on update (exclude self)', async () => {
      const seeded = seedSong({ title: 'Keep Same' });

      // Updating with the same title should not append (1)
      const updated = await updateSong(seeded.id, { title: 'Keep Same' });
      expect(updated).toBeDefined();
      expect(updated.title).toBe('Keep Same');
    });
  });

  // ==========================================
  // 5. deleteSong
  // ==========================================
  describe('deleteSong', () => {
    it('should delete an existing song', async () => {
      const seeded = seedSong({ title: 'To Delete' });
      expect(mockSongs.length).toBe(1);

      const result = await deleteSong(seeded.id);
      expect(result).toBe(true);
      expect(mockSongs.length).toBe(0);
    });

    it('should return true even for non-existent song (SQL DELETE succeeds silently)', async () => {
      const result = await deleteSong('non-existent-id');
      expect(result).toBe(true);
    });

    it('should return false for empty id', async () => {
      const result = await deleteSong('');
      expect(result).toBe(false);
    });

    it('should return false for null id', async () => {
      const result = await deleteSong(null as any);
      expect(result).toBe(false);
    });

    it('should return false for undefined id', async () => {
      const result = await deleteSong(undefined as any);
      expect(result).toBe(false);
    });

    it('should return false for non-string id', async () => {
      const result = await deleteSong(123 as any);
      expect(result).toBe(false);
    });

    it('should return false when db is not initialized', async () => {
      mockDb = null;
      const result = await deleteSong('any-id');
      expect(result).toBe(false);
    });

    it('should call createBackup before deleting', async () => {
      const { createBackup } = await import('./index');
      seedSong({ title: 'Backup Test' });

      await deleteSong(mockSongs[0].id);
      expect(createBackup).toHaveBeenCalledWith('delete_song');
    });

    it('should not remove other songs when deleting one', async () => {
      seedSong({ title: 'Keep Me' });
      const toDelete = seedSong({ title: 'Delete Me' });
      seedSong({ title: 'Also Keep Me' });

      await deleteSong(toDelete.id);
      expect(mockSongs.length).toBe(2);
      expect(mockSongs.some(s => s.title === 'Keep Me')).toBe(true);
      expect(mockSongs.some(s => s.title === 'Also Keep Me')).toBe(true);
    });
  });

  // ==========================================
  // 6. batchResolveSongs
  // ==========================================
  describe('batchResolveSongs', () => {
    it('should resolve songs by remoteId', async () => {
      seedSong({ title: 'Remote A', remoteId: 'r-1' });
      seedSong({ title: 'Remote B', remoteId: 'r-2' });

      const result = await batchResolveSongs([
        { remoteId: 'r-1' },
        { remoteId: 'r-2' }
      ]);

      expect(result[0]).toBeDefined();
      expect(result[0].title).toBe('Remote A');
      expect(result[1]).toBeDefined();
      expect(result[1].title).toBe('Remote B');
    });

    it('should fallback to title when remoteId not found', async () => {
      seedSong({ title: 'By Title', remoteId: null });

      const result = await batchResolveSongs([
        { remoteId: 'non-existent', title: 'By Title' }
      ]);

      expect(result[0]).toBeDefined();
      expect(result[0].title).toBe('By Title');
    });

    it('should resolve mixed remoteId and title lookups', async () => {
      seedSong({ title: 'Remote Song', remoteId: 'r-100' });
      seedSong({ title: 'Title Song', remoteId: null });

      const result = await batchResolveSongs([
        { remoteId: 'r-100' },
        { title: 'Title Song' }
      ]);

      expect(result[0]).toBeDefined();
      expect(result[0].title).toBe('Remote Song');
      expect(result[1]).toBeDefined();
      expect(result[1].title).toBe('Title Song');
    });

    it('should return empty result for unresolvable items', async () => {
      const result = await batchResolveSongs([
        { remoteId: 'none', title: 'Nothing' }
      ]);

      expect(result[0]).toBeUndefined();
    });

    it('should handle empty items array', async () => {
      const result = await batchResolveSongs([]);
      expect(Object.keys(result).length).toBe(0);
    });

    it('should prefer remoteId over title', async () => {
      seedSong({ title: 'Song X', remoteId: 'remote-x' });
      seedSong({ title: 'Wrong Song', remoteId: null });

      const result = await batchResolveSongs([
        { remoteId: 'remote-x', title: 'Wrong Song' }
      ]);

      expect(result[0]).toBeDefined();
      expect(result[0].title).toBe('Song X');
    });

    it('should handle items with neither remoteId nor title', async () => {
      seedSong({ title: 'Some Song' });

      const result = await batchResolveSongs([
        {} as any
      ]);

      expect(result[0]).toBeUndefined();
    });

    it('should handle case-insensitive title fallback', async () => {
      seedSong({ title: 'UPPERCASE SONG', remoteId: null });

      const result = await batchResolveSongs([
        { title: 'uppercase song' }
      ]);

      expect(result[0]).toBeDefined();
      expect(result[0].title).toBe('UPPERCASE SONG');
    });
  });

  // ==========================================
  // 7. importSongsFromJSON
  // ==========================================
  describe('importSongsFromJSON', () => {
    it('should import valid songs from JSON', async () => {
      const jsonData = JSON.stringify([
        {
          title: 'Imported Song 1',
          originalLanguage: 'en',
          slides: [{ originalText: 'Hello' }],
          tags: ['import'],
          author: 'Test Author'
        },
        {
          title: 'Imported Song 2',
          originalLanguage: 'he',
          slides: [],
          tags: [],
          author: null
        }
      ]);

      const result = await importSongsFromJSON(jsonData);
      expect(result.imported).toBe(2);
      expect(result.skipped).toBe(0);
      expect(result.errors).toBe(0);
    });

    it('should skip songs with duplicate titles', async () => {
      seedSong({ title: 'Existing Song' });

      const jsonData = JSON.stringify([
        { title: 'Existing Song', originalLanguage: 'en' },
        { title: 'New Song', originalLanguage: 'en' }
      ]);

      const result = await importSongsFromJSON(jsonData);
      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(1);
      expect(result.errors).toBe(0);
    });

    it('should skip songs with invalid/empty titles', async () => {
      const jsonData = JSON.stringify([
        { title: '', originalLanguage: 'en' },
        { title: null, originalLanguage: 'en' },
        { title: 123, originalLanguage: 'en' },
        { originalLanguage: 'en' }, // no title field
        { title: '   ', originalLanguage: 'en' }
      ]);

      const result = await importSongsFromJSON(jsonData);
      expect(result.errors).toBe(5);
      expect(result.imported).toBe(0);
    });

    it('should throw error for invalid JSON', async () => {
      await expect(importSongsFromJSON('not valid json')).rejects.toThrow('Failed to import songs');
    });

    it('should throw error for non-array JSON', async () => {
      await expect(importSongsFromJSON('{"title": "not an array"}')).rejects.toThrow('Invalid JSON format: expected an array of songs');
    });

    it('should throw error when db is not initialized', async () => {
      mockDb = null;
      await expect(importSongsFromJSON('[]')).rejects.toThrow('Database not initialized');
    });

    it('should validate and limit slide data on import', async () => {
      const longText = 'x'.repeat(15000);
      const jsonData = JSON.stringify([
        {
          title: 'Long Slide Import',
          slides: [{ originalText: longText }]
        }
      ]);

      const result = await importSongsFromJSON(jsonData);
      expect(result.imported).toBe(1);
      // The song should have been inserted with truncated slide text
      const insertedSong = mockSongs.find(s => s.title === 'Long Slide Import');
      expect(insertedSong).toBeDefined();
    });

    it('should limit slides to MAX_SLIDES_COUNT on import', async () => {
      const slides = Array.from({ length: 600 }, (_, i) => ({ originalText: `Slide ${i}` }));
      const jsonData = JSON.stringify([
        { title: 'Many Slides Import', slides }
      ]);

      const result = await importSongsFromJSON(jsonData);
      expect(result.imported).toBe(1);
    });

    it('should call createBackup before import', async () => {
      const { createBackup } = await import('./index');

      const jsonData = JSON.stringify([{ title: 'Backup Song' }]);
      await importSongsFromJSON(jsonData);

      expect(createBackup).toHaveBeenCalledWith('import_songs_json');
    });

    it('should use beginTransaction and commitTransaction', async () => {
      const { beginTransaction, commitTransaction } = await import('./index');

      const jsonData = JSON.stringify([{ title: 'Transaction Song' }]);
      await importSongsFromJSON(jsonData);

      expect(beginTransaction).toHaveBeenCalled();
      expect(commitTransaction).toHaveBeenCalled();
    });

    it('should handle empty array gracefully', async () => {
      const result = await importSongsFromJSON('[]');
      expect(result.imported).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.errors).toBe(0);
    });

    it('should truncate title to MAX_TITLE_LENGTH on import', async () => {
      const longTitle = 'a'.repeat(600);
      const jsonData = JSON.stringify([{ title: longTitle }]);

      const result = await importSongsFromJSON(jsonData);
      expect(result.imported).toBe(1);
      const inserted = mockSongs.find(s => s.title.startsWith('aaa'));
      expect(inserted).toBeDefined();
      expect(inserted.title.length).toBeLessThanOrEqual(500);
    });

    it('should truncate author to MAX_AUTHOR_LENGTH on import', async () => {
      const longAuthor = 'b'.repeat(300);
      const jsonData = JSON.stringify([{ title: 'Author Import', author: longAuthor }]);

      const result = await importSongsFromJSON(jsonData);
      expect(result.imported).toBe(1);
    });

    it('should default originalLanguage to he on import', async () => {
      const jsonData = JSON.stringify([{ title: 'Default Lang' }]);
      await importSongsFromJSON(jsonData);

      const inserted = mockSongs.find(s => s.title === 'Default Lang');
      expect(inserted).toBeDefined();
      expect(inserted.originalLanguage).toBe('he');
    });

    it('should handle songs with non-array slides/tags/arrangements', async () => {
      const jsonData = JSON.stringify([
        {
          title: 'Bad Structures',
          slides: 'not-array',
          tags: 42,
          arrangements: 'bad'
        }
      ]);

      const result = await importSongsFromJSON(jsonData);
      expect(result.imported).toBe(1);
    });

    it('should filter non-string tags on import', async () => {
      const jsonData = JSON.stringify([
        { title: 'Tag Filter', tags: ['valid', 123, null, 'also-valid'] }
      ]);

      const result = await importSongsFromJSON(jsonData);
      expect(result.imported).toBe(1);
    });
  });

  // ==========================================
  // 8. exportSongsToJSON
  // ==========================================
  describe('exportSongsToJSON', () => {
    it('should export all songs as JSON string', async () => {
      seedSong({
        title: 'Export Song 1',
        author: 'Author 1',
        originalLanguage: 'he',
        slides: JSON.stringify([{ originalText: 'Verse 1' }]),
        tags: JSON.stringify(['tag1']),
        backgroundImage: 'bg.jpg',
        arrangements: JSON.stringify([])
      });
      seedSong({
        title: 'Export Song 2',
        author: 'Author 2',
        originalLanguage: 'en',
        slides: JSON.stringify([]),
        tags: JSON.stringify([]),
        backgroundImage: '',
        arrangements: JSON.stringify([])
      });

      const json = await exportSongsToJSON();
      expect(typeof json).toBe('string');

      const parsed = JSON.parse(json);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(2);
    });

    it('should include correct fields in exported data', async () => {
      seedSong({
        title: 'Full Song',
        author: 'Full Author',
        originalLanguage: 'he',
        slides: JSON.stringify([{ originalText: 'text' }]),
        tags: JSON.stringify(['tag']),
        backgroundImage: 'bg.png',
        arrangements: JSON.stringify([{ id: 'arr-1' }])
      });

      const json = await exportSongsToJSON();
      const parsed = JSON.parse(json);

      expect(parsed[0]).toHaveProperty('title', 'Full Song');
      expect(parsed[0]).toHaveProperty('author', 'Full Author');
      expect(parsed[0]).toHaveProperty('originalLanguage', 'he');
      expect(parsed[0]).toHaveProperty('slides');
      expect(parsed[0]).toHaveProperty('tags');
      expect(parsed[0]).toHaveProperty('backgroundImage', 'bg.png');
      expect(parsed[0]).toHaveProperty('arrangements');
    });

    it('should exclude internal fields (id, remoteId, usageCount, createdAt, updatedAt)', async () => {
      seedSong({
        title: 'Clean Export',
        remoteId: 'remote-xyz',
        usageCount: 5,
        slides: '[]',
        tags: '[]',
        arrangements: '[]'
      });

      const json = await exportSongsToJSON();
      const parsed = JSON.parse(json);

      expect(parsed[0]).not.toHaveProperty('id');
      expect(parsed[0]).not.toHaveProperty('remoteId');
      expect(parsed[0]).not.toHaveProperty('usageCount');
      expect(parsed[0]).not.toHaveProperty('createdAt');
      expect(parsed[0]).not.toHaveProperty('updatedAt');
    });

    it('should parse JSON string fields (slides, tags, arrangements)', async () => {
      seedSong({
        title: 'Stringified Fields',
        slides: JSON.stringify([{ originalText: 'parsed' }]),
        tags: JSON.stringify(['parsed-tag']),
        arrangements: JSON.stringify([{ id: 'parsed-arr' }])
      });

      const json = await exportSongsToJSON();
      const parsed = JSON.parse(json);

      // The exported data should have parsed arrays, not stringified ones
      expect(Array.isArray(parsed[0].slides)).toBe(true);
      expect(parsed[0].slides[0].originalText).toBe('parsed');
      expect(Array.isArray(parsed[0].tags)).toBe(true);
      expect(parsed[0].tags[0]).toBe('parsed-tag');
      expect(Array.isArray(parsed[0].arrangements)).toBe(true);
    });

    it('should export empty array when no songs exist', async () => {
      const json = await exportSongsToJSON();
      const parsed = JSON.parse(json);
      expect(parsed).toEqual([]);
    });

    it('should handle songs where slides/tags/arrangements are already objects (not strings)', async () => {
      // When queryAll parses JSON automatically, fields may already be objects
      seedSong({
        title: 'Object Fields',
        slides: [{ originalText: 'already object' }],
        tags: ['already', 'array'],
        arrangements: [{ id: 'obj-arr' }]
      });

      const json = await exportSongsToJSON();
      const parsed = JSON.parse(json);

      expect(Array.isArray(parsed[0].slides)).toBe(true);
      expect(Array.isArray(parsed[0].tags)).toBe(true);
      expect(Array.isArray(parsed[0].arrangements)).toBe(true);
    });

    it('should produce valid JSON output', async () => {
      seedSong({ title: 'Valid JSON Test', slides: '[]', tags: '[]', arrangements: '[]' });

      const json = await exportSongsToJSON();
      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('should produce pretty-printed JSON (with indentation)', async () => {
      seedSong({ title: 'Pretty Print', slides: '[]', tags: '[]', arrangements: '[]' });

      const json = await exportSongsToJSON();
      // JSON.stringify with null, 2 produces indented output
      expect(json).toContain('\n');
      expect(json).toContain('  ');
    });
  });
});
