import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Create mock database state
let mockDb: any = null;
let mockData: {
  presentations: any[];
} = {
  presentations: []
};

// Counter for unique IDs
let idCounter = 0;

// Mock the database index module
vi.mock('./index', () => {
  return {
    getDb: () => mockDb,
    saveDatabase: vi.fn(),
    createBackup: vi.fn(),
    generateId: () => {
      idCounter++;
      return `test-id-${idCounter}-${Math.random().toString(36).substring(7)}`;
    },
    queryAll: (sql: string, params: any[] = []) => {
      if (!mockDb) return [];

      if (sql.includes('presentations')) {
        // SELECT * FROM presentations ORDER BY updatedAt DESC
        if (sql.includes('ORDER BY updatedAt DESC') && !sql.includes('WHERE')) {
          return [...mockData.presentations].sort((a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
        }

        // SELECT title FROM presentations WHERE (title = ? OR title LIKE ?) AND id != ?
        if (sql.includes('SELECT title') && sql.includes('title LIKE') && sql.includes('id != ?')) {
          const [baseTitle, pattern, excludeId] = params;
          const likeRegex = new RegExp(
            '^' + baseTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\(\\d+\\)$'
          );
          return mockData.presentations.filter(
            (p) =>
              p.id !== excludeId &&
              (p.title === baseTitle || likeRegex.test(p.title))
          );
        }

        // SELECT title FROM presentations WHERE title = ? OR title LIKE ?
        if (sql.includes('SELECT title') && sql.includes('title LIKE')) {
          const [baseTitle, _pattern] = params;
          const likeRegex = new RegExp(
            '^' + baseTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\(\\d+\\)$'
          );
          return mockData.presentations.filter(
            (p) => p.title === baseTitle || likeRegex.test(p.title)
          );
        }

        // SELECT id FROM presentations WHERE title = ? AND id != ?
        if (sql.includes('SELECT id') && sql.includes('title = ?') && sql.includes('id != ?')) {
          const [title, excludeId] = params;
          return mockData.presentations.filter(
            (p) => p.title === title && p.id !== excludeId
          );
        }

        // SELECT id FROM presentations WHERE title = ?
        if (sql.includes('SELECT id') && sql.includes('title = ?')) {
          const [title] = params;
          return mockData.presentations.filter((p) => p.title === title);
        }

        // SELECT * FROM presentations WHERE id = ?
        if (sql.includes('WHERE id = ?') && params.length > 0) {
          return mockData.presentations.filter((p) => p.id === params[0]);
        }

        return mockData.presentations;
      }
      return [];
    },
    queryOne: (sql: string, params: any[] = []) => {
      if (!mockDb) return null;

      if (sql.includes('presentations')) {
        // SELECT * FROM presentations WHERE id = ?
        if (sql.includes('WHERE id = ?')) {
          const item = mockData.presentations.find((p) => p.id === params[0]);
          return item || null;
        }

        // SELECT id FROM presentations WHERE title = ? AND id != ?
        if (sql.includes('SELECT id') && sql.includes('title = ?') && sql.includes('id != ?')) {
          const [title, excludeId] = params;
          const item = mockData.presentations.find(
            (p) => p.title === title && p.id !== excludeId
          );
          return item || null;
        }

        // SELECT id FROM presentations WHERE title = ?
        if (sql.includes('SELECT id') && sql.includes('title = ?')) {
          const [title] = params;
          const item = mockData.presentations.find((p) => p.title === title);
          return item || null;
        }
      }
      return null;
    }
  };
});

// Import functions after mocking
import {
  getPresentations,
  getPresentation,
  createPresentation,
  updatePresentation,
  deletePresentation
} from './presentations';
import type { Slide, PresentationData } from './presentations';

describe('presentations database functions', () => {
  beforeEach(() => {
    idCounter = 0;
    // Reset mock database
    mockDb = {
      run: vi.fn((sql: string, params?: any[]) => {
        // Simulate INSERT operations
        if (sql.includes('INSERT INTO presentations')) {
          const [id, title, slides, canvasDimensions, quickModeData, createdAt, updatedAt] =
            params || [];
          mockData.presentations.push({
            id,
            title,
            slides: typeof slides === 'string' ? JSON.parse(slides) : slides,
            canvasDimensions:
              typeof canvasDimensions === 'string'
                ? JSON.parse(canvasDimensions)
                : canvasDimensions,
            quickModeData:
              quickModeData && typeof quickModeData === 'string'
                ? JSON.parse(quickModeData)
                : quickModeData || undefined,
            createdAt,
            updatedAt
          });
        }
        // Simulate UPDATE operations
        if (sql.includes('UPDATE presentations SET')) {
          // The last param is always the id (WHERE id = ?)
          const id = params![params!.length - 1];
          const presentation = mockData.presentations.find((p) => p.id === id);
          if (presentation) {
            // Parse the SET clause to figure out which fields are being updated
            const setClause = sql.match(/SET (.+) WHERE/)?.[1] || '';
            const fields = setClause.split(',').map((f) => f.trim().split(' = ')[0]);
            let paramIdx = 0;
            for (const field of fields) {
              const value = params![paramIdx];
              if (field === 'title') {
                presentation.title = value;
              } else if (field === 'slides') {
                presentation.slides =
                  typeof value === 'string' ? JSON.parse(value) : value;
              } else if (field === 'canvasDimensions') {
                presentation.canvasDimensions =
                  typeof value === 'string' ? JSON.parse(value) : value;
              } else if (field === 'quickModeData') {
                presentation.quickModeData =
                  value && typeof value === 'string'
                    ? JSON.parse(value)
                    : value || undefined;
              } else if (field === 'updatedAt') {
                presentation.updatedAt = value;
              }
              paramIdx++;
            }
          }
        }
        // Simulate DELETE operations
        if (sql.includes('DELETE FROM presentations')) {
          const [id] = params || [];
          mockData.presentations = mockData.presentations.filter((p) => p.id !== id);
        }
      }),
      exec: vi.fn()
    };
    mockData = {
      presentations: []
    };
  });

  afterEach(() => {
    mockDb = null;
    vi.clearAllMocks();
  });

  // ========== createPresentation ==========

  describe('createPresentation', () => {
    it('should create a presentation with valid data', async () => {
      const data: PresentationData = {
        title: 'My Presentation'
      };

      const result = await createPresentation(data);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.title).toBe('My Presentation');
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('should create a default slide when no slides provided', async () => {
      const data: PresentationData = {
        title: 'No Slides Presentation'
      };

      const result = await createPresentation(data);

      expect(result.slides).toBeDefined();
      expect(result.slides).toHaveLength(1);
      expect(result.slides[0].order).toBe(0);
      expect(result.slides[0].textBoxes).toEqual([]);
      expect(result.slides[0].id).toBeDefined();
    });

    it('should use provided slides when given', async () => {
      const customSlides: Slide[] = [
        {
          id: 'slide-1',
          order: 0,
          textBoxes: [
            {
              id: 'tb-1',
              text: 'Hello',
              x: 10,
              y: 10,
              width: 80,
              height: 20,
              fontSize: 100,
              color: '#ffffff',
              backgroundColor: 'transparent',
              textAlign: 'center',
              verticalAlign: 'center',
              bold: false,
              italic: false,
              underline: false,
              opacity: 1
            }
          ]
        },
        {
          id: 'slide-2',
          order: 1,
          textBoxes: []
        }
      ];

      const result = await createPresentation({
        title: 'With Slides',
        slides: customSlides
      });

      expect(result.slides).toHaveLength(2);
      expect(result.slides[0].id).toBe('slide-1');
      expect(result.slides[1].id).toBe('slide-2');
      expect(result.slides[0].textBoxes).toHaveLength(1);
      expect(result.slides[0].textBoxes[0].text).toBe('Hello');
    });

    it('should use default canvas dimensions of 1920x1080 when not provided', async () => {
      const result = await createPresentation({ title: 'Default Canvas' });

      expect(result.canvasDimensions).toEqual({ width: 1920, height: 1080 });
    });

    it('should use provided canvas dimensions when given', async () => {
      const result = await createPresentation({
        title: 'Custom Canvas',
        canvasDimensions: { width: 1280, height: 720 }
      });

      expect(result.canvasDimensions).toEqual({ width: 1280, height: 720 });
    });

    it('should store quickModeData when provided', async () => {
      const quickModeData = {
        type: 'sermon' as const,
        title: 'Sunday Sermon',
        subtitles: [
          { subtitle: 'Grace', subtitleTranslation: 'chen' }
        ]
      };

      const result = await createPresentation({
        title: 'Sermon Presentation',
        quickModeData
      });

      expect(result.quickModeData).toBeDefined();
      expect(result.quickModeData!.type).toBe('sermon');
      expect(result.quickModeData!.title).toBe('Sunday Sermon');
    });

    it('should generate a unique title when a duplicate title exists', async () => {
      await createPresentation({ title: 'Duplicate Title' });
      const second = await createPresentation({ title: 'Duplicate Title' });

      expect(second.title).toBe('Duplicate Title (1)');
    });

    it('should generate incremental unique titles for multiple duplicates', async () => {
      await createPresentation({ title: 'Same Name' });
      await createPresentation({ title: 'Same Name' });
      const third = await createPresentation({ title: 'Same Name' });

      expect(third.title).toBe('Same Name (2)');
    });

    it('should trim the title', async () => {
      const result = await createPresentation({ title: '  Trimmed Title  ' });

      expect(result.title).toBe('Trimmed Title');
    });

    it('should truncate title to 500 characters', async () => {
      const longTitle = 'a'.repeat(600);
      const result = await createPresentation({ title: longTitle });

      expect(result.title.length).toBeLessThanOrEqual(500);
    });

    it('should throw error for empty title', async () => {
      await expect(createPresentation({ title: '' })).rejects.toThrow(
        'Presentation title is required'
      );
    });

    it('should throw error for whitespace-only title', async () => {
      await expect(createPresentation({ title: '   ' })).rejects.toThrow(
        'Presentation title cannot be empty'
      );
    });

    it('should throw error for null data', async () => {
      await expect(createPresentation(null as any)).rejects.toThrow(
        'Invalid presentation data'
      );
    });

    it('should throw error for undefined title', async () => {
      await expect(createPresentation({ title: undefined as any })).rejects.toThrow(
        'Presentation title is required'
      );
    });

    it('should throw error if database not initialized', async () => {
      mockDb = null;
      await expect(createPresentation({ title: 'Test' })).rejects.toThrow(
        'Database not initialized'
      );
    });

    it('should set createdAt and updatedAt to the same ISO string', async () => {
      const result = await createPresentation({ title: 'Timestamp Test' });

      expect(result.createdAt).toBe(result.updatedAt);
      // Verify it's a valid ISO string
      expect(new Date(result.createdAt).toISOString()).toBe(result.createdAt);
    });
  });

  // ========== getPresentations ==========

  describe('getPresentations', () => {
    it('should return all presentations', async () => {
      await createPresentation({ title: 'Presentation A' });
      await createPresentation({ title: 'Presentation B' });
      await createPresentation({ title: 'Presentation C' });

      const presentations = await getPresentations();

      expect(presentations).toHaveLength(3);
    });

    it('should return empty array when no presentations exist', async () => {
      const presentations = await getPresentations();

      expect(presentations).toEqual([]);
    });

    it('should return presentations ordered by updatedAt DESC', async () => {
      // Create presentations with different timestamps by manipulating mock data
      await createPresentation({ title: 'Oldest' });
      await createPresentation({ title: 'Newest' });

      // Manually set different timestamps to ensure ordering
      mockData.presentations[0].updatedAt = '2024-01-01T00:00:00.000Z';
      mockData.presentations[1].updatedAt = '2025-01-01T00:00:00.000Z';

      const presentations = await getPresentations();

      expect(presentations[0].title).toBe('Newest');
      expect(presentations[1].title).toBe('Oldest');
    });

    it('should return empty array when database is not initialized', async () => {
      mockDb = null;
      const presentations = await getPresentations();

      expect(presentations).toEqual([]);
    });
  });

  // ========== getPresentation ==========

  describe('getPresentation', () => {
    it('should return a presentation by ID', async () => {
      const created = await createPresentation({ title: 'Find Me' });

      const found = await getPresentation(created.id);

      expect(found).toBeDefined();
      expect(found!.title).toBe('Find Me');
      expect(found!.id).toBe(created.id);
    });

    it('should return null for non-existent ID', async () => {
      const found = await getPresentation('non-existent-id');

      expect(found).toBeNull();
    });

    it('should return null for empty string ID', async () => {
      const found = await getPresentation('');

      expect(found).toBeNull();
    });

    it('should return null for null ID', async () => {
      const found = await getPresentation(null as any);

      expect(found).toBeNull();
    });

    it('should return null for undefined ID', async () => {
      const found = await getPresentation(undefined as any);

      expect(found).toBeNull();
    });

    it('should return null for non-string ID', async () => {
      const found = await getPresentation(123 as any);

      expect(found).toBeNull();
    });
  });

  // ========== updatePresentation ==========

  describe('updatePresentation', () => {
    it('should update the title', async () => {
      const created = await createPresentation({ title: 'Original Title' });

      const updated = await updatePresentation(created.id, { title: 'Updated Title' });

      expect(updated).toBeDefined();
      expect(updated!.title).toBe('Updated Title');
    });

    it('should enforce unique title on update', async () => {
      await createPresentation({ title: 'Existing Title' });
      const second = await createPresentation({ title: 'Will Change' });

      const updated = await updatePresentation(second.id, { title: 'Existing Title' });

      expect(updated).toBeDefined();
      expect(updated!.title).toBe('Existing Title (1)');
    });

    it('should allow keeping the same title on update', async () => {
      const created = await createPresentation({ title: 'Same Title' });

      const updated = await updatePresentation(created.id, { title: 'Same Title' });

      expect(updated).toBeDefined();
      // Same title for the same ID should remain unchanged
      expect(updated!.title).toBe('Same Title');
    });

    it('should update slides', async () => {
      const created = await createPresentation({ title: 'Slides Update' });

      const newSlides: Slide[] = [
        { id: 'new-slide-1', order: 0, textBoxes: [] },
        { id: 'new-slide-2', order: 1, textBoxes: [] }
      ];

      const updated = await updatePresentation(created.id, { slides: newSlides });

      expect(updated).toBeDefined();
      expect(updated!.slides).toHaveLength(2);
      expect(updated!.slides[0].id).toBe('new-slide-1');
      expect(updated!.slides[1].id).toBe('new-slide-2');
    });

    it('should update canvas dimensions', async () => {
      const created = await createPresentation({ title: 'Canvas Update' });

      const updated = await updatePresentation(created.id, {
        canvasDimensions: { width: 3840, height: 2160 }
      });

      expect(updated).toBeDefined();
      expect(updated!.canvasDimensions).toEqual({ width: 3840, height: 2160 });
    });

    it('should update quickModeData', async () => {
      const created = await createPresentation({ title: 'QuickMode Update' });

      const quickModeData = {
        type: 'prayer' as const,
        title: 'Prayer Requests',
        subtitles: [{ subtitle: 'Healing' }]
      };

      const updated = await updatePresentation(created.id, { quickModeData });

      expect(updated).toBeDefined();
      expect(updated!.quickModeData).toBeDefined();
      expect(updated!.quickModeData!.type).toBe('prayer');
    });

    it('should do a partial update without affecting other fields', async () => {
      const created = await createPresentation({
        title: 'Partial Update',
        canvasDimensions: { width: 1280, height: 720 }
      });

      const updated = await updatePresentation(created.id, { title: 'New Title Only' });

      expect(updated).toBeDefined();
      expect(updated!.title).toBe('New Title Only');
      // Canvas dimensions should remain unchanged
      expect(updated!.canvasDimensions).toEqual({ width: 1280, height: 720 });
    });

    it('should update the updatedAt timestamp', async () => {
      const created = await createPresentation({ title: 'Timestamp Update' });
      const originalUpdatedAt = created.updatedAt;

      // Small delay to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      const updated = await updatePresentation(created.id, { title: 'New Title' });

      expect(updated).toBeDefined();
      expect(updated!.updatedAt).not.toBe(originalUpdatedAt);
    });

    it('should return null for non-existent ID', async () => {
      const result = await updatePresentation('non-existent-id', { title: 'New' });

      expect(result).toBeNull();
    });

    it('should return null for empty string ID', async () => {
      const result = await updatePresentation('', { title: 'New' });

      expect(result).toBeNull();
    });

    it('should return null for null ID', async () => {
      const result = await updatePresentation(null as any, { title: 'New' });

      expect(result).toBeNull();
    });

    it('should return null for invalid data', async () => {
      const created = await createPresentation({ title: 'Valid' });

      const result = await updatePresentation(created.id, null as any);

      expect(result).toBeNull();
    });

    it('should return null when database is not initialized', async () => {
      mockDb = null;
      const result = await updatePresentation('some-id', { title: 'New' });

      expect(result).toBeNull();
    });
  });

  // ========== deletePresentation ==========

  describe('deletePresentation', () => {
    it('should delete a presentation by ID', async () => {
      const created = await createPresentation({ title: 'To Delete' });
      expect(mockData.presentations).toHaveLength(1);

      const result = await deletePresentation(created.id);

      expect(result).toBe(true);
      expect(mockData.presentations).toHaveLength(0);
    });

    it('should call createBackup before deleting', async () => {
      const { createBackup } = await import('./index');
      const created = await createPresentation({ title: 'Backup Before Delete' });

      await deletePresentation(created.id);

      expect(createBackup).toHaveBeenCalledWith('delete_presentation');
    });

    it('should return true even for non-existent ID (fire-and-forget delete)', async () => {
      const result = await deletePresentation('non-existent-id');

      // The implementation runs DELETE and returns true regardless of whether a row was affected
      expect(result).toBe(true);
    });

    it('should return false for empty string ID', async () => {
      const result = await deletePresentation('');

      expect(result).toBe(false);
    });

    it('should return false for null ID', async () => {
      const result = await deletePresentation(null as any);

      expect(result).toBe(false);
    });

    it('should return false for undefined ID', async () => {
      const result = await deletePresentation(undefined as any);

      expect(result).toBe(false);
    });

    it('should return false when database is not initialized', async () => {
      mockDb = null;
      const result = await deletePresentation('some-id');

      expect(result).toBe(false);
    });

    it('should not affect other presentations when deleting one', async () => {
      const first = await createPresentation({ title: 'Keep Me' });
      const second = await createPresentation({ title: 'Delete Me' });

      await deletePresentation(second.id);

      expect(mockData.presentations).toHaveLength(1);
      expect(mockData.presentations[0].id).toBe(first.id);
      expect(mockData.presentations[0].title).toBe('Keep Me');
    });
  });

  // ========== generateUniquePresentationTitle (tested through createPresentation) ==========

  describe('unique title generation (via createPresentation)', () => {
    it('should not modify a title that is already unique', async () => {
      const result = await createPresentation({ title: 'Unique Title' });

      expect(result.title).toBe('Unique Title');
    });

    it('should append (1) for first duplicate', async () => {
      await createPresentation({ title: 'Title' });
      const result = await createPresentation({ title: 'Title' });

      expect(result.title).toBe('Title (1)');
    });

    it('should find the next available number when gaps exist', async () => {
      await createPresentation({ title: 'Title' });
      await createPresentation({ title: 'Title' }); // becomes "Title (1)"
      await createPresentation({ title: 'Title' }); // becomes "Title (2)"

      // Delete "Title (1)" to create a gap
      const toDelete = mockData.presentations.find((p) => p.title === 'Title (1)');
      if (toDelete) {
        mockData.presentations = mockData.presentations.filter((p) => p.id !== toDelete.id);
      }

      const result = await createPresentation({ title: 'Title' });

      // Should fill the gap and use (1)
      expect(result.title).toBe('Title (1)');
    });

    it('should handle titles with special regex characters', async () => {
      await createPresentation({ title: 'Title (special)' });
      const result = await createPresentation({ title: 'Title (special)' });

      expect(result.title).toBe('Title (special) (1)');
    });
  });
});
