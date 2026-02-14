import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Create mock database state
let mockDb: any = null;
let mockData: {
  setlists: any[];
} = {
  setlists: []
};

// Track transaction state for error simulation
let mockTransactionActive = false;
let mockDbRunShouldThrow = false;

// Mock the database index module
vi.mock('./index', () => {
  return {
    getDb: () => mockDb,
    saveDatabase: vi.fn(),
    createBackup: vi.fn(),
    generateId: () => `test-id-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    queryAll: (sql: string, _params: any[] = []) => {
      if (!mockDb) return [];

      if (sql.includes('setlists')) {
        if (sql.includes('ORDER BY updatedAt DESC')) {
          // Return sorted by updatedAt descending
          return [...mockData.setlists].sort((a, b) => {
            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
          });
        }
        return mockData.setlists;
      }
      return [];
    },
    queryOne: (sql: string, params: any[] = []) => {
      if (!mockDb) return null;

      if (sql.includes('setlists')) {
        if (sql.includes('WHERE id = ?')) {
          const item = mockData.setlists.find(s => s.id === params[0]);
          return item || null;
        }
      }
      return null;
    },
    beginTransaction: vi.fn(() => {
      mockTransactionActive = true;
    }),
    commitTransaction: vi.fn(() => {
      mockTransactionActive = false;
    }),
    rollbackTransaction: vi.fn(() => {
      mockTransactionActive = false;
    })
  };
});

// Import functions after mocking
import {
  getSetlists,
  getSetlist,
  createSetlist,
  updateSetlist,
  deleteSetlist
} from './setlists';
import type { SetlistItem, SetlistData } from './setlists';

// Helper to create a sample song item
function makeSongItem(overrides?: Partial<SetlistItem>): SetlistItem {
  return {
    id: 'item-1',
    type: 'song',
    song: {
      id: 'song-1',
      title: 'Amazing Grace',
      artist: 'John Newton'
    },
    ...overrides
  };
}

// Helper to create a sample section item
function makeSectionItem(overrides?: Partial<SetlistItem>): SetlistItem {
  return {
    id: 'item-2',
    type: 'section',
    title: 'Worship',
    ...overrides
  };
}

// Helper to create a sample countdown item
function makeCountdownItem(overrides?: Partial<SetlistItem>): SetlistItem {
  return {
    id: 'item-3',
    type: 'countdown',
    countdownTime: '00:05:00',
    countdownMessage: 'Starting soon...',
    ...overrides
  };
}

describe('setlists database functions', () => {
  beforeEach(() => {
    mockDbRunShouldThrow = false;
    mockTransactionActive = false;

    // Reset mock database
    mockDb = {
      run: vi.fn((sql: string, params?: any[]) => {
        if (mockDbRunShouldThrow) {
          throw new Error('Simulated DB error');
        }

        // Simulate INSERT operations
        if (sql.includes('INSERT INTO setlists')) {
          const [id, name, venue, items, createdAt, updatedAt] = params || [];
          mockData.setlists.push({ id, name, venue, items, createdAt, updatedAt });
        }

        // Simulate UPDATE operations
        if (sql.includes('UPDATE setlists SET')) {
          // The last param is always the id (WHERE id = ?)
          const id = params?.[params.length - 1];
          const setlist = mockData.setlists.find(s => s.id === id);
          if (setlist) {
            // Parse the SET clause to figure out which fields are being updated
            const setClause = sql.match(/SET\s+(.*?)\s+WHERE/)?.[1] || '';
            const fields = setClause.split(',').map(f => f.trim().split('=')[0].trim());
            let paramIdx = 0;
            for (const field of fields) {
              if (params && paramIdx < params.length - 1) {
                setlist[field] = params[paramIdx];
                paramIdx++;
              }
            }
          }
        }

        // Simulate DELETE operations
        if (sql.includes('DELETE FROM setlists')) {
          const [id] = params || [];
          mockData.setlists = mockData.setlists.filter(s => s.id !== id);
        }
      }),
      exec: vi.fn()
    };

    mockData = {
      setlists: []
    };
  });

  afterEach(() => {
    mockDb = null;
    vi.clearAllMocks();
  });

  // ============================================================
  // createSetlist
  // ============================================================
  describe('createSetlist', () => {
    it('should create a setlist with name and items', async () => {
      const songItem = makeSongItem();
      const sectionItem = makeSectionItem();
      const data: SetlistData = {
        name: 'Sunday Service',
        venue: 'Main Hall',
        items: [sectionItem, songItem]
      };

      const result = await createSetlist(data);

      expect(result).not.toBeNull();
      expect(result!.name).toBe('Sunday Service');
      expect(result!.venue).toBe('Main Hall');
      expect(result!.items).toHaveLength(2);
      expect(result!.items[0].type).toBe('section');
      expect(result!.items[1].type).toBe('song');
      expect(result!.id).toBeDefined();
      expect(result!.createdAt).toBeDefined();
      expect(result!.updatedAt).toBeDefined();
      expect(result!.createdAt).toBe(result!.updatedAt);
    });

    it('should create a setlist without items (defaults to empty array)', async () => {
      const data: SetlistData = {
        name: 'Empty Setlist'
      };

      const result = await createSetlist(data);

      expect(result).not.toBeNull();
      expect(result!.name).toBe('Empty Setlist');
      expect(result!.items).toEqual([]);
      expect(result!.venue).toBeUndefined();
    });

    it('should create a setlist without venue', async () => {
      const data: SetlistData = {
        name: 'No Venue Setlist',
        items: [makeSongItem()]
      };

      const result = await createSetlist(data);

      expect(result).not.toBeNull();
      expect(result!.name).toBe('No Venue Setlist');
      expect(result!.venue).toBeUndefined();
    });

    it('should create a setlist with various item types', async () => {
      const items: SetlistItem[] = [
        makeSectionItem({ id: 'i1', title: 'Opening' }),
        makeCountdownItem({ id: 'i2' }),
        makeSongItem({ id: 'i3' }),
        { id: 'i4', type: 'blank' },
        { id: 'i5', type: 'announcement', announcementText: 'Welcome everyone!' },
        { id: 'i6', type: 'messages', messages: ['Hello', 'World'], messagesInterval: 5 },
        { id: 'i7', type: 'media', mediaType: 'video', mediaPath: '/path/to/video.mp4', mediaName: 'Intro Video' },
        { id: 'i8', type: 'bible', bibleData: { book: 'Genesis', chapter: 1 }, displayMode: 'bilingual' },
        { id: 'i9', type: 'youtube', youtubeVideoId: 'abc123', youtubeTitle: 'Worship Song' },
        { id: 'i10', type: 'clock' },
        { id: 'i11', type: 'stopwatch' },
        { id: 'i12', type: 'audioPlaylist' },
        { id: 'i13', type: 'presentation', presentation: { id: 'p1', title: 'Slides', slides: [] } }
      ];

      const result = await createSetlist({ name: 'Full Service', items });

      expect(result).not.toBeNull();
      expect(result!.items).toHaveLength(13);
      expect(result!.items.map(i => i.type)).toEqual([
        'section', 'countdown', 'song', 'blank', 'announcement',
        'messages', 'media', 'bible', 'youtube', 'clock',
        'stopwatch', 'audioPlaylist', 'presentation'
      ]);
    });

    it('should throw error when database is not initialized', async () => {
      mockDb = null;

      await expect(createSetlist({ name: 'Test' })).rejects.toThrow('Database not initialized');
    });

    it('should rollback transaction on db.run error', async () => {
      mockDbRunShouldThrow = true;
      const { rollbackTransaction } = await import('./index');

      await expect(createSetlist({ name: 'Fail' })).rejects.toThrow('Simulated DB error');
      expect(rollbackTransaction).toHaveBeenCalled();
    });

    it('should store items as JSON in the database row', async () => {
      const items = [makeSongItem()];
      await createSetlist({ name: 'JSON Test', items });

      // The mock data should have the items stored as a JSON string (what db.run received)
      expect(mockData.setlists).toHaveLength(1);
      const storedItems = mockData.setlists[0].items;
      expect(typeof storedItems).toBe('string');
      expect(JSON.parse(storedItems)).toEqual(items);
    });

    it('should set createdAt and updatedAt to the same ISO timestamp', async () => {
      const result = await createSetlist({ name: 'Timestamp Test' });

      expect(result).not.toBeNull();
      // Both should be valid ISO timestamps
      expect(new Date(result!.createdAt).toISOString()).toBe(result!.createdAt);
      expect(new Date(result!.updatedAt).toISOString()).toBe(result!.updatedAt);
      expect(result!.createdAt).toBe(result!.updatedAt);
    });

    it('should generate a unique id for each setlist', async () => {
      const result1 = await createSetlist({ name: 'First' });
      const result2 = await createSetlist({ name: 'Second' });

      expect(result1!.id).not.toBe(result2!.id);
    });
  });

  // ============================================================
  // getSetlists
  // ============================================================
  describe('getSetlists', () => {
    it('should return all setlists', async () => {
      await createSetlist({ name: 'Setlist A' });
      await createSetlist({ name: 'Setlist B' });
      await createSetlist({ name: 'Setlist C' });

      const results = await getSetlists();

      expect(results).toHaveLength(3);
    });

    it('should return empty array when no setlists exist', async () => {
      const results = await getSetlists();

      expect(results).toEqual([]);
    });

    it('should return setlists ordered by updatedAt DESC (most recent first)', async () => {
      // Manually insert rows with controlled timestamps to test ordering
      mockData.setlists.push({
        id: 'id-old',
        name: 'Old Setlist',
        venue: null,
        items: '[]',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      });
      mockData.setlists.push({
        id: 'id-new',
        name: 'New Setlist',
        venue: null,
        items: '[]',
        createdAt: '2024-06-15T00:00:00.000Z',
        updatedAt: '2024-06-15T00:00:00.000Z'
      });
      mockData.setlists.push({
        id: 'id-mid',
        name: 'Middle Setlist',
        venue: null,
        items: '[]',
        createdAt: '2024-03-10T00:00:00.000Z',
        updatedAt: '2024-03-10T00:00:00.000Z'
      });

      const results = await getSetlists();

      expect(results).toHaveLength(3);
      expect(results[0].name).toBe('New Setlist');
      expect(results[1].name).toBe('Middle Setlist');
      expect(results[2].name).toBe('Old Setlist');
    });

    it('should return empty array when database is not initialized', async () => {
      mockDb = null;

      const results = await getSetlists();

      expect(results).toEqual([]);
    });

    it('should parse JSON items strings in returned setlists', async () => {
      const songItem = makeSongItem();
      mockData.setlists.push({
        id: 'id-1',
        name: 'Parsed Setlist',
        venue: 'Chapel',
        items: JSON.stringify([songItem]),
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      });

      const results = await getSetlists();

      expect(results).toHaveLength(1);
      expect(Array.isArray(results[0].items)).toBe(true);
      expect(results[0].items[0].type).toBe('song');
      expect(results[0].items[0].song?.title).toBe('Amazing Grace');
    });

    it('should handle invalid JSON items gracefully', async () => {
      mockData.setlists.push({
        id: 'id-bad',
        name: 'Bad JSON',
        venue: null,
        items: 'not valid json{{{',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      });

      const results = await getSetlists();

      expect(results).toHaveLength(1);
      expect(results[0].items).toEqual([]);
    });
  });

  // ============================================================
  // getSetlist
  // ============================================================
  describe('getSetlist', () => {
    it('should return a setlist by ID', async () => {
      const created = await createSetlist({ name: 'Find Me', venue: 'Stage' });

      const result = await getSetlist(created!.id);

      expect(result).not.toBeNull();
      expect(result!.name).toBe('Find Me');
      expect(result!.venue).toBe('Stage');
    });

    it('should return null for non-existent ID', async () => {
      const result = await getSetlist('non-existent-id');

      expect(result).toBeNull();
    });

    it('should return null when database is not initialized', async () => {
      mockDb = null;

      const result = await getSetlist('any-id');

      expect(result).toBeNull();
    });

    it('should parse JSON items when retrieving a setlist', async () => {
      const items = [makeSongItem(), makeSectionItem()];
      mockData.setlists.push({
        id: 'id-parse',
        name: 'Parse Test',
        venue: null,
        items: JSON.stringify(items),
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      });

      const result = await getSetlist('id-parse');

      expect(result).not.toBeNull();
      expect(result!.items).toHaveLength(2);
      expect(result!.items[0].type).toBe('song');
      expect(result!.items[1].type).toBe('section');
    });

    it('should handle setlist with empty items array', async () => {
      mockData.setlists.push({
        id: 'id-empty',
        name: 'Empty Items',
        venue: null,
        items: '[]',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      });

      const result = await getSetlist('id-empty');

      expect(result).not.toBeNull();
      expect(result!.items).toEqual([]);
    });
  });

  // ============================================================
  // updateSetlist
  // ============================================================
  describe('updateSetlist', () => {
    it('should update the name of an existing setlist', async () => {
      // Pre-populate a setlist in mock data
      mockData.setlists.push({
        id: 'id-update',
        name: 'Original Name',
        venue: 'Hall A',
        items: '[]',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      });

      const result = await updateSetlist('id-update', { name: 'Updated Name' });

      expect(result).not.toBeNull();
      expect(result!.name).toBe('Updated Name');
      expect(result!.venue).toBe('Hall A');
    });

    it('should update the venue of an existing setlist', async () => {
      mockData.setlists.push({
        id: 'id-venue',
        name: 'Venue Test',
        venue: 'Old Venue',
        items: '[]',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      });

      const result = await updateSetlist('id-venue', { venue: 'New Venue' });

      expect(result).not.toBeNull();
      expect(result!.venue).toBe('New Venue');
      expect(result!.name).toBe('Venue Test');
    });

    it('should update items of an existing setlist', async () => {
      mockData.setlists.push({
        id: 'id-items',
        name: 'Items Test',
        venue: null,
        items: '[]',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      });

      const newItems = [makeSongItem(), makeCountdownItem()];
      const result = await updateSetlist('id-items', { items: newItems });

      expect(result).not.toBeNull();
      expect(result!.items).toHaveLength(2);
      expect(result!.items[0].type).toBe('song');
      expect(result!.items[1].type).toBe('countdown');
    });

    it('should update multiple fields at once', async () => {
      mockData.setlists.push({
        id: 'id-multi',
        name: 'Multi Update',
        venue: 'Old',
        items: '[]',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      });

      const result = await updateSetlist('id-multi', {
        name: 'New Name',
        venue: 'New Venue',
        items: [makeSongItem()]
      });

      expect(result).not.toBeNull();
      expect(result!.name).toBe('New Name');
      expect(result!.venue).toBe('New Venue');
      expect(result!.items).toHaveLength(1);
    });

    it('should update updatedAt timestamp', async () => {
      mockData.setlists.push({
        id: 'id-time',
        name: 'Timestamp',
        venue: null,
        items: '[]',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      });

      const result = await updateSetlist('id-time', { name: 'Updated' });

      expect(result).not.toBeNull();
      // updatedAt should be newer than the original
      expect(new Date(result!.updatedAt).getTime()).toBeGreaterThan(
        new Date('2024-01-01T00:00:00.000Z').getTime()
      );
      // createdAt should remain unchanged
      expect(result!.createdAt).toBe('2024-01-01T00:00:00.000Z');
    });

    it('should return null for non-existent setlist', async () => {
      const result = await updateSetlist('non-existent', { name: 'Test' });

      expect(result).toBeNull();
    });

    it('should return null when database is not initialized', async () => {
      mockDb = null;

      const result = await updateSetlist('any-id', { name: 'Test' });

      expect(result).toBeNull();
    });

    it('should return null when db.run throws an error', async () => {
      mockData.setlists.push({
        id: 'id-err',
        name: 'Error Test',
        venue: null,
        items: '[]',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      });

      // Enable throw after the getSetlist queryOne succeeds
      const originalRun = mockDb.run;
      mockDb.run = vi.fn(() => {
        throw new Error('Update failed');
      });

      const result = await updateSetlist('id-err', { name: 'Should Fail' });

      expect(result).toBeNull();
      mockDb.run = originalRun;
    });

    it('should allow setting venue to empty string', async () => {
      mockData.setlists.push({
        id: 'id-clear-venue',
        name: 'Clear Venue',
        venue: 'Existing Venue',
        items: '[]',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      });

      const result = await updateSetlist('id-clear-venue', { venue: '' });

      expect(result).not.toBeNull();
      expect(result!.venue).toBe('');
    });
  });

  // ============================================================
  // deleteSetlist
  // ============================================================
  describe('deleteSetlist', () => {
    it('should delete an existing setlist and return true', async () => {
      mockData.setlists.push({
        id: 'id-delete',
        name: 'To Delete',
        venue: null,
        items: '[]',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      });

      const result = await deleteSetlist('id-delete');

      expect(result).toBe(true);
      expect(mockData.setlists).toHaveLength(0);
    });

    it('should create a backup before deleting', async () => {
      const { createBackup } = await import('./index');
      mockData.setlists.push({
        id: 'id-backup',
        name: 'Backup Test',
        venue: null,
        items: '[]',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      });

      await deleteSetlist('id-backup');

      expect(createBackup).toHaveBeenCalledWith('delete_setlist');
    });

    it('should return false for non-existent setlist', async () => {
      const result = await deleteSetlist('non-existent');

      expect(result).toBe(false);
    });

    it('should return false when database is not initialized', async () => {
      mockDb = null;

      const result = await deleteSetlist('any-id');

      expect(result).toBe(false);
    });

    it('should return false for empty string id', async () => {
      const result = await deleteSetlist('');

      expect(result).toBe(false);
    });

    it('should return false for invalid id type (number cast to string edge case)', async () => {
      // The function checks `!id || typeof id !== 'string'`
      const result = await deleteSetlist(null as any);

      expect(result).toBe(false);
    });

    it('should return false for undefined id', async () => {
      const result = await deleteSetlist(undefined as any);

      expect(result).toBe(false);
    });

    it('should return false when db.run throws an error', async () => {
      mockData.setlists.push({
        id: 'id-fail-delete',
        name: 'Fail Delete',
        venue: null,
        items: '[]',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      });

      const originalRun = mockDb.run;
      mockDb.run = vi.fn(() => {
        throw new Error('Delete failed');
      });

      const result = await deleteSetlist('id-fail-delete');

      expect(result).toBe(false);
      mockDb.run = originalRun;
    });

    it('should rollback transaction when db.run throws', async () => {
      const { rollbackTransaction } = await import('./index');
      mockData.setlists.push({
        id: 'id-rollback',
        name: 'Rollback Test',
        venue: null,
        items: '[]',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      });

      mockDb.run = vi.fn(() => {
        throw new Error('Delete rollback');
      });

      await deleteSetlist('id-rollback');

      expect(rollbackTransaction).toHaveBeenCalled();
    });
  });

  // ============================================================
  // parseSetlistRow (tested indirectly via getSetlist / getSetlists)
  // ============================================================
  describe('parseSetlistRow (via getSetlist)', () => {
    it('should parse valid JSON items string into array', async () => {
      const items = [makeSongItem(), makeSectionItem()];
      mockData.setlists.push({
        id: 'id-json',
        name: 'JSON Parse',
        venue: null,
        items: JSON.stringify(items),
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      });

      const result = await getSetlist('id-json');

      expect(result).not.toBeNull();
      expect(Array.isArray(result!.items)).toBe(true);
      expect(result!.items).toHaveLength(2);
    });

    it('should return empty array for invalid JSON items', async () => {
      mockData.setlists.push({
        id: 'id-bad-json',
        name: 'Bad JSON',
        venue: null,
        items: '{not: valid json[',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      });

      const result = await getSetlist('id-bad-json');

      expect(result).not.toBeNull();
      expect(result!.items).toEqual([]);
    });

    it('should return empty array when items JSON parses to non-array (e.g. object)', async () => {
      mockData.setlists.push({
        id: 'id-obj-json',
        name: 'Object JSON',
        venue: null,
        items: '{"key": "value"}',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      });

      const result = await getSetlist('id-obj-json');

      expect(result).not.toBeNull();
      expect(result!.items).toEqual([]);
    });

    it('should return empty array when items JSON parses to a string', async () => {
      mockData.setlists.push({
        id: 'id-str-json',
        name: 'String JSON',
        venue: null,
        items: '"just a string"',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      });

      const result = await getSetlist('id-str-json');

      expect(result).not.toBeNull();
      expect(result!.items).toEqual([]);
    });

    it('should handle items that are already an array (not a string)', async () => {
      const items = [makeSongItem()];
      mockData.setlists.push({
        id: 'id-arr',
        name: 'Array Items',
        venue: null,
        items: items, // Already an array, not JSON string
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      });

      const result = await getSetlist('id-arr');

      expect(result).not.toBeNull();
      expect(Array.isArray(result!.items)).toBe(true);
      expect(result!.items).toHaveLength(1);
    });

    it('should handle null/undefined items gracefully', async () => {
      mockData.setlists.push({
        id: 'id-null-items',
        name: 'Null Items',
        venue: null,
        items: null,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      });

      const result = await getSetlist('id-null-items');

      expect(result).not.toBeNull();
      expect(result!.items).toEqual([]);
    });

    it('should handle numeric createdAt (Unix timestamp in ms)', async () => {
      const timestamp = new Date('2024-06-15T12:00:00.000Z').getTime();
      mockData.setlists.push({
        id: 'id-numeric-date',
        name: 'Numeric Date',
        venue: null,
        items: '[]',
        createdAt: timestamp, // numeric timestamp
        updatedAt: '2024-06-15T12:00:00.000Z'
      });

      const result = await getSetlist('id-numeric-date');

      expect(result).not.toBeNull();
      expect(result!.createdAt).toBe('2024-06-15T12:00:00.000Z');
    });

    it('should handle string createdAt (ISO format)', async () => {
      mockData.setlists.push({
        id: 'id-string-date',
        name: 'String Date',
        venue: null,
        items: '[]',
        createdAt: '2024-03-20T15:30:00.000Z',
        updatedAt: '2024-03-20T15:30:00.000Z'
      });

      const result = await getSetlist('id-string-date');

      expect(result).not.toBeNull();
      expect(result!.createdAt).toBe('2024-03-20T15:30:00.000Z');
    });

    it('should fall back to current date for invalid numeric createdAt (NaN)', async () => {
      mockData.setlists.push({
        id: 'id-nan-date',
        name: 'NaN Date',
        venue: null,
        items: '[]',
        createdAt: NaN, // This is numeric but results in invalid date
        updatedAt: '2024-01-01T00:00:00.000Z'
      });

      const result = await getSetlist('id-nan-date');

      expect(result).not.toBeNull();
      // Should fall back to a valid ISO date (current time)
      expect(() => new Date(result!.createdAt)).not.toThrow();
      expect(new Date(result!.createdAt).toISOString()).toBe(result!.createdAt);
    });

    it('should fall back to current date for invalid string createdAt', async () => {
      mockData.setlists.push({
        id: 'id-invalid-str-date',
        name: 'Invalid String Date',
        venue: null,
        items: '[]',
        createdAt: 'not-a-date',
        updatedAt: '2024-01-01T00:00:00.000Z'
      });

      const result = await getSetlist('id-invalid-str-date');

      expect(result).not.toBeNull();
      // Should fall back to a valid ISO date
      expect(() => new Date(result!.createdAt)).not.toThrow();
      const parsed = new Date(result!.createdAt);
      expect(isNaN(parsed.getTime())).toBe(false);
    });

    it('should fall back to current date for missing createdAt (null)', async () => {
      mockData.setlists.push({
        id: 'id-null-date',
        name: 'Null Date',
        venue: null,
        items: '[]',
        createdAt: null,
        updatedAt: '2024-01-01T00:00:00.000Z'
      });

      const result = await getSetlist('id-null-date');

      expect(result).not.toBeNull();
      expect(() => new Date(result!.createdAt)).not.toThrow();
      const parsed = new Date(result!.createdAt);
      expect(isNaN(parsed.getTime())).toBe(false);
    });

    it('should fall back to current date for undefined createdAt', async () => {
      mockData.setlists.push({
        id: 'id-undef-date',
        name: 'Undefined Date',
        venue: null,
        items: '[]',
        createdAt: undefined,
        updatedAt: '2024-01-01T00:00:00.000Z'
      });

      const result = await getSetlist('id-undef-date');

      expect(result).not.toBeNull();
      const parsed = new Date(result!.createdAt);
      expect(isNaN(parsed.getTime())).toBe(false);
    });

    it('should fall back to current date for empty string createdAt', async () => {
      mockData.setlists.push({
        id: 'id-empty-date',
        name: 'Empty String Date',
        venue: null,
        items: '[]',
        createdAt: '',
        updatedAt: '2024-01-01T00:00:00.000Z'
      });

      const result = await getSetlist('id-empty-date');

      expect(result).not.toBeNull();
      const parsed = new Date(result!.createdAt);
      expect(isNaN(parsed.getTime())).toBe(false);
    });

    it('should return null for a null row (no matching row)', async () => {
      const result = await getSetlist('does-not-exist');

      expect(result).toBeNull();
    });

    it('should preserve other row fields via spread', async () => {
      mockData.setlists.push({
        id: 'id-extra',
        name: 'Extra Fields',
        venue: 'Test Venue',
        items: '[]',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      });

      const result = await getSetlist('id-extra');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('id-extra');
      expect(result!.name).toBe('Extra Fields');
      expect(result!.venue).toBe('Test Venue');
      expect(result!.updatedAt).toBe('2024-01-01T00:00:00.000Z');
    });
  });

  // ============================================================
  // Integration-style: end-to-end workflow
  // ============================================================
  describe('end-to-end workflow', () => {
    it('should create, read, update, and delete a setlist', async () => {
      // Create
      const created = await createSetlist({
        name: 'E2E Setlist',
        venue: 'Test Hall',
        items: [makeSongItem()]
      });
      expect(created).not.toBeNull();
      const id = created!.id;

      // Read all - should contain our setlist
      const all = await getSetlists();
      expect(all.length).toBeGreaterThanOrEqual(1);

      // Update
      const updated = await updateSetlist(id, {
        name: 'Updated E2E',
        items: [makeSongItem(), makeSectionItem()]
      });
      expect(updated).not.toBeNull();
      expect(updated!.name).toBe('Updated E2E');
      expect(updated!.items).toHaveLength(2);

      // Delete
      const deleted = await deleteSetlist(id);
      expect(deleted).toBe(true);

      // Verify gone
      const afterDelete = await getSetlist(id);
      expect(afterDelete).toBeNull();
    });
  });
});
