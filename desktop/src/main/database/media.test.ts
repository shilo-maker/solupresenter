import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Create mock database state
let mockDb: any = null;
let mockData: {
  media_folders: any[];
  media_items: any[];
} = {
  media_folders: [],
  media_items: []
};

// Mock the database index module
vi.mock('./index', () => {
  return {
    getDb: () => mockDb,
    saveDatabase: vi.fn(),
    createBackup: vi.fn(), // Mock backup function
    generateId: () => `test-id-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    queryAll: (sql: string, params: any[] = []) => {
      if (!mockDb) return [];

      if (sql.includes('media_folders')) {
        if (sql.includes('WHERE') && params.length > 0) {
          return mockData.media_folders.filter(f => f.id === params[0]);
        }
        return mockData.media_folders;
      }
      if (sql.includes('media_items')) {
        if (sql.includes('folderId IS NULL')) {
          return mockData.media_items.filter(i => i.folderId === null);
        }
        if (sql.includes('WHERE folderId = ?') && params.length > 0) {
          return mockData.media_items.filter(i => i.folderId === params[0]);
        }
        if (sql.includes('WHERE id = ?') && params.length > 0) {
          return mockData.media_items.filter(i => i.id === params[0]);
        }
        if (sql.includes('WHERE originalPath = ?') && params.length > 0) {
          return mockData.media_items.filter(i => i.originalPath === params[0]);
        }
        return mockData.media_items;
      }
      return [];
    },
    queryOne: (sql: string, params: any[] = []) => {
      if (!mockDb) return null;

      if (sql.includes('media_items')) {
        if (sql.includes('WHERE id = ?')) {
          const item = mockData.media_items.find(i => i.id === params[0]);
          return item || null;
        }
        if (sql.includes('WHERE originalPath = ?')) {
          const item = mockData.media_items.find(i => i.originalPath === params[0]);
          return item || null;
        }
      }
      return null;
    }
  };
});

// Import functions after mocking
import {
  createMediaFolder,
  getAllMediaFolders,
  renameMediaFolder,
  deleteMediaFolder,
  addMediaItem,
  getAllMediaItems,
  getMediaItem,
  moveMediaToFolder,
  deleteMediaItem,
  isMediaImported,
  renameMediaItem,
  updateMediaTags
} from './media';

describe('media database functions', () => {
  beforeEach(() => {
    // Reset mock database
    mockDb = {
      run: vi.fn((sql: string, params?: any[]) => {
        // Simulate INSERT operations
        if (sql.includes('INSERT INTO media_folders')) {
          const [id, name, createdAt] = params || [];
          mockData.media_folders.push({ id, name, createdAt });
        }
        if (sql.includes('INSERT INTO media_items')) {
          const [id, name, type, originalPath, processedPath, duration, thumbnailPath, fileSize, folderId, tags, createdAt] = params || [];
          mockData.media_items.push({ id, name, type, originalPath, processedPath, duration, thumbnailPath, fileSize, folderId, tags, createdAt });
        }
        // Simulate UPDATE operations
        if (sql.includes('UPDATE media_folders SET name')) {
          const [name, id] = params || [];
          const folder = mockData.media_folders.find(f => f.id === id);
          if (folder) folder.name = name;
        }
        if (sql.includes('UPDATE media_items SET folderId')) {
          const [folderId, id] = params || [];
          const item = mockData.media_items.find(i => i.id === id);
          if (item) item.folderId = folderId;
        }
        if (sql.includes('UPDATE media_items SET name')) {
          const [name, id] = params || [];
          const item = mockData.media_items.find(i => i.id === id);
          if (item) item.name = name;
        }
        if (sql.includes('UPDATE media_items SET tags')) {
          const [tags, id] = params || [];
          const item = mockData.media_items.find(i => i.id === id);
          if (item) item.tags = tags;
        }
        // Simulate DELETE operations
        if (sql.includes('DELETE FROM media_folders')) {
          const [id] = params || [];
          mockData.media_folders = mockData.media_folders.filter(f => f.id !== id);
        }
        if (sql.includes('DELETE FROM media_items')) {
          const [id] = params || [];
          mockData.media_items = mockData.media_items.filter(i => i.id !== id);
        }
      }),
      exec: vi.fn()
    };
    mockData = {
      media_folders: [],
      media_items: []
    };
  });

  afterEach(() => {
    mockDb = null;
    vi.clearAllMocks();
  });

  describe('createMediaFolder', () => {
    it('should create a folder with valid name', () => {
      const folder = createMediaFolder('Test Folder');

      expect(folder).toBeDefined();
      expect(folder.name).toBe('Test Folder');
      expect(folder.id).toBeDefined();
    });

    it('should trim folder name', () => {
      const folder = createMediaFolder('  Test Folder  ');

      expect(folder.name).toBe('Test Folder');
    });

    it('should truncate long folder names to 255 chars', () => {
      const longName = 'a'.repeat(300);
      const folder = createMediaFolder(longName);

      expect(folder.name.length).toBeLessThanOrEqual(255);
    });

    it('should throw error for empty name', () => {
      // Empty string is falsy, so it throws 'Invalid folder name'
      expect(() => createMediaFolder('')).toThrow('Invalid folder name');
    });

    it('should throw error for whitespace-only name', () => {
      expect(() => createMediaFolder('   ')).toThrow('Folder name cannot be empty');
    });

    it('should throw error for null name', () => {
      expect(() => createMediaFolder(null as any)).toThrow('Invalid folder name');
    });

    it('should throw error for undefined name', () => {
      expect(() => createMediaFolder(undefined as any)).toThrow('Invalid folder name');
    });

    it('should throw error if database not initialized', () => {
      mockDb = null;
      expect(() => createMediaFolder('Test')).toThrow('Database not initialized');
    });
  });

  describe('renameMediaFolder', () => {
    it('should rename folder with valid inputs', () => {
      createMediaFolder('Original');
      const folderId = mockData.media_folders[0].id;

      const result = renameMediaFolder(folderId, 'Renamed');

      expect(result).toBe(true);
      expect(mockData.media_folders[0].name).toBe('Renamed');
    });

    it('should return false for empty id', () => {
      expect(renameMediaFolder('', 'New Name')).toBe(false);
    });

    it('should return false for null id', () => {
      expect(renameMediaFolder(null as any, 'New Name')).toBe(false);
    });

    it('should return false for empty name', () => {
      expect(renameMediaFolder('some-id', '')).toBe(false);
    });

    it('should return false for whitespace-only name', () => {
      expect(renameMediaFolder('some-id', '   ')).toBe(false);
    });

    it('should truncate long names', () => {
      createMediaFolder('Original');
      const folderId = mockData.media_folders[0].id;
      const longName = 'a'.repeat(300);

      renameMediaFolder(folderId, longName);

      expect(mockData.media_folders[0].name.length).toBeLessThanOrEqual(255);
    });
  });

  describe('deleteMediaFolder', () => {
    it('should delete folder by id', () => {
      createMediaFolder('ToDelete');
      const folderId = mockData.media_folders[0].id;

      const result = deleteMediaFolder(folderId);

      expect(result).toBe(true);
      expect(mockData.media_folders.length).toBe(0);
    });

    it('should return false for empty id', () => {
      expect(deleteMediaFolder('')).toBe(false);
    });

    it('should return false for null id', () => {
      expect(deleteMediaFolder(null as any)).toBe(false);
    });
  });

  describe('addMediaItem', () => {
    it('should add media item with valid data', () => {
      const item = addMediaItem({
        name: 'test.mp4',
        type: 'video',
        originalPath: '/path/to/original.mp4',
        processedPath: '/path/to/processed.mp4',
        duration: 120,
        thumbnailPath: '/path/to/thumb.jpg',
        fileSize: 1024000,
        tags: 'tag1,tag2',
        folderId: null
      });

      expect(item).toBeDefined();
      expect(item.name).toBe('test.mp4');
      expect(item.type).toBe('video');
      expect(item.id).toBeDefined();
    });

    it('should accept audio type', () => {
      const item = addMediaItem({
        name: 'test.mp3',
        type: 'audio',
        originalPath: '/path/to/original.mp3',
        processedPath: '/path/to/processed.mp3',
        duration: 180,
        thumbnailPath: null,
        fileSize: 512000,
        tags: null,
        folderId: null
      });

      expect(item.type).toBe('audio');
    });

    it('should accept image type', () => {
      const item = addMediaItem({
        name: 'test.jpg',
        type: 'image',
        originalPath: '/path/to/original.jpg',
        processedPath: '/path/to/processed.jpg',
        duration: null,
        thumbnailPath: null,
        fileSize: 256000,
        tags: null,
        folderId: null
      });

      expect(item.type).toBe('image');
    });

    it('should throw error for invalid type', () => {
      expect(() => addMediaItem({
        name: 'test.xyz',
        type: 'invalid' as any,
        originalPath: '/path/to/file',
        processedPath: '/path/to/file',
        duration: null,
        thumbnailPath: null,
        fileSize: 1000,
        tags: null,
        folderId: null
      })).toThrow('Invalid media item type');
    });

    it('should throw error for missing name', () => {
      expect(() => addMediaItem({
        name: '',
        type: 'video',
        originalPath: '/path/to/file',
        processedPath: '/path/to/file',
        duration: null,
        thumbnailPath: null,
        fileSize: 1000,
        tags: null,
        folderId: null
      })).toThrow('Invalid media item name');
    });

    it('should throw error for missing originalPath', () => {
      expect(() => addMediaItem({
        name: 'test.mp4',
        type: 'video',
        originalPath: '',
        processedPath: '/path/to/file',
        duration: null,
        thumbnailPath: null,
        fileSize: 1000,
        tags: null,
        folderId: null
      })).toThrow('Invalid media item originalPath');
    });

    it('should throw error for missing processedPath', () => {
      expect(() => addMediaItem({
        name: 'test.mp4',
        type: 'video',
        originalPath: '/path/to/file',
        processedPath: '',
        duration: null,
        thumbnailPath: null,
        fileSize: 1000,
        tags: null,
        folderId: null
      })).toThrow('Invalid media item processedPath');
    });

    it('should truncate long names', () => {
      const longName = 'a'.repeat(600) + '.mp4';
      const item = addMediaItem({
        name: longName,
        type: 'video',
        originalPath: '/path/to/file',
        processedPath: '/path/to/file',
        duration: null,
        thumbnailPath: null,
        fileSize: 1000,
        tags: null,
        folderId: null
      });

      expect(item.name.length).toBeLessThanOrEqual(500);
    });

    it('should truncate long tags', () => {
      const longTags = 'a'.repeat(1200);
      const item = addMediaItem({
        name: 'test.mp4',
        type: 'video',
        originalPath: '/path/to/file',
        processedPath: '/path/to/file',
        duration: null,
        thumbnailPath: null,
        fileSize: 1000,
        tags: longTags,
        folderId: null
      });

      expect(item.tags?.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('getMediaItem', () => {
    it('should return item by id', () => {
      const created = addMediaItem({
        name: 'test.mp4',
        type: 'video',
        originalPath: '/path/to/original.mp4',
        processedPath: '/path/to/processed.mp4',
        duration: 120,
        thumbnailPath: null,
        fileSize: 1000,
        tags: null,
        folderId: null
      });

      const item = getMediaItem(created.id);

      expect(item).toBeDefined();
      expect(item?.name).toBe('test.mp4');
    });

    it('should return null for non-existent id', () => {
      const item = getMediaItem('non-existent-id');
      expect(item).toBeNull();
    });

    it('should return null for empty id', () => {
      expect(getMediaItem('')).toBeNull();
    });

    it('should return null for null id', () => {
      expect(getMediaItem(null as any)).toBeNull();
    });
  });

  describe('moveMediaToFolder', () => {
    it('should move item to folder', () => {
      const folder = createMediaFolder('Target');
      const item = addMediaItem({
        name: 'test.mp4',
        type: 'video',
        originalPath: '/path/to/original.mp4',
        processedPath: '/path/to/processed.mp4',
        duration: 120,
        thumbnailPath: null,
        fileSize: 1000,
        tags: null,
        folderId: null
      });

      const result = moveMediaToFolder(item.id, folder.id);

      expect(result).toBe(true);
    });

    it('should allow moving to null (no folder)', () => {
      const item = addMediaItem({
        name: 'test.mp4',
        type: 'video',
        originalPath: '/path/to/original.mp4',
        processedPath: '/path/to/processed.mp4',
        duration: 120,
        thumbnailPath: null,
        fileSize: 1000,
        tags: null,
        folderId: 'some-folder'
      });

      const result = moveMediaToFolder(item.id, null);

      expect(result).toBe(true);
    });

    it('should return false for empty mediaId', () => {
      expect(moveMediaToFolder('', 'folder-id')).toBe(false);
    });

    it('should return false for null mediaId', () => {
      expect(moveMediaToFolder(null as any, 'folder-id')).toBe(false);
    });
  });

  describe('deleteMediaItem', () => {
    it('should delete item by id', () => {
      const item = addMediaItem({
        name: 'test.mp4',
        type: 'video',
        originalPath: '/path/to/original.mp4',
        processedPath: '/path/to/processed.mp4',
        duration: 120,
        thumbnailPath: null,
        fileSize: 1000,
        tags: null,
        folderId: null
      });

      const result = deleteMediaItem(item.id);

      expect(result).toBe(true);
      expect(mockData.media_items.length).toBe(0);
    });

    it('should return false for empty id', () => {
      expect(deleteMediaItem('')).toBe(false);
    });

    it('should return false for null id', () => {
      expect(deleteMediaItem(null as any)).toBe(false);
    });
  });

  describe('isMediaImported', () => {
    it('should return true if path is imported', () => {
      addMediaItem({
        name: 'test.mp4',
        type: 'video',
        originalPath: '/path/to/original.mp4',
        processedPath: '/path/to/processed.mp4',
        duration: 120,
        thumbnailPath: null,
        fileSize: 1000,
        tags: null,
        folderId: null
      });

      expect(isMediaImported('/path/to/original.mp4')).toBe(true);
    });

    it('should return false if path not imported', () => {
      expect(isMediaImported('/path/to/unknown.mp4')).toBe(false);
    });

    it('should return false for empty path', () => {
      expect(isMediaImported('')).toBe(false);
    });

    it('should return false for null path', () => {
      expect(isMediaImported(null as any)).toBe(false);
    });
  });

  describe('renameMediaItem', () => {
    it('should rename item with valid inputs', () => {
      const item = addMediaItem({
        name: 'original.mp4',
        type: 'video',
        originalPath: '/path/to/original.mp4',
        processedPath: '/path/to/processed.mp4',
        duration: 120,
        thumbnailPath: null,
        fileSize: 1000,
        tags: null,
        folderId: null
      });

      const result = renameMediaItem(item.id, 'renamed.mp4');

      expect(result).toBe(true);
      expect(mockData.media_items[0].name).toBe('renamed.mp4');
    });

    it('should return false for empty id', () => {
      expect(renameMediaItem('', 'new name')).toBe(false);
    });

    it('should return false for empty name', () => {
      expect(renameMediaItem('some-id', '')).toBe(false);
    });

    it('should return false for whitespace-only name', () => {
      expect(renameMediaItem('some-id', '   ')).toBe(false);
    });

    it('should truncate long names', () => {
      const item = addMediaItem({
        name: 'original.mp4',
        type: 'video',
        originalPath: '/path/to/original.mp4',
        processedPath: '/path/to/processed.mp4',
        duration: 120,
        thumbnailPath: null,
        fileSize: 1000,
        tags: null,
        folderId: null
      });

      const longName = 'a'.repeat(600);
      renameMediaItem(item.id, longName);

      expect(mockData.media_items[0].name.length).toBeLessThanOrEqual(500);
    });
  });

  describe('updateMediaTags', () => {
    it('should update tags', () => {
      const item = addMediaItem({
        name: 'test.mp4',
        type: 'video',
        originalPath: '/path/to/original.mp4',
        processedPath: '/path/to/processed.mp4',
        duration: 120,
        thumbnailPath: null,
        fileSize: 1000,
        tags: null,
        folderId: null
      });

      const result = updateMediaTags(item.id, 'tag1,tag2,tag3');

      expect(result).toBe(true);
      expect(mockData.media_items[0].tags).toBe('tag1,tag2,tag3');
    });

    it('should allow null tags', () => {
      const item = addMediaItem({
        name: 'test.mp4',
        type: 'video',
        originalPath: '/path/to/original.mp4',
        processedPath: '/path/to/processed.mp4',
        duration: 120,
        thumbnailPath: null,
        fileSize: 1000,
        tags: 'existing,tags',
        folderId: null
      });

      const result = updateMediaTags(item.id, null);

      expect(result).toBe(true);
    });

    it('should return false for empty id', () => {
      expect(updateMediaTags('', 'tags')).toBe(false);
    });

    it('should truncate long tags', () => {
      const item = addMediaItem({
        name: 'test.mp4',
        type: 'video',
        originalPath: '/path/to/original.mp4',
        processedPath: '/path/to/processed.mp4',
        duration: 120,
        thumbnailPath: null,
        fileSize: 1000,
        tags: null,
        folderId: null
      });

      const longTags = 'a'.repeat(1200);
      updateMediaTags(item.id, longTags);

      expect(mockData.media_items[0].tags.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('getAllMediaFolders', () => {
    it('should return all folders', () => {
      createMediaFolder('Folder 1');
      createMediaFolder('Folder 2');

      const folders = getAllMediaFolders();

      expect(folders.length).toBe(2);
    });

    it('should return empty array when no folders', () => {
      const folders = getAllMediaFolders();
      expect(folders).toEqual([]);
    });
  });

  describe('getAllMediaItems', () => {
    it('should return all items when no filter', () => {
      addMediaItem({
        name: 'test1.mp4',
        type: 'video',
        originalPath: '/path1',
        processedPath: '/processed1',
        duration: null,
        thumbnailPath: null,
        fileSize: 1000,
        tags: null,
        folderId: null
      });
      addMediaItem({
        name: 'test2.mp4',
        type: 'video',
        originalPath: '/path2',
        processedPath: '/processed2',
        duration: null,
        thumbnailPath: null,
        fileSize: 1000,
        tags: null,
        folderId: null
      });

      const items = getAllMediaItems();

      expect(items.length).toBe(2);
    });

    it('should filter by folderId', () => {
      const folder = createMediaFolder('Folder');
      addMediaItem({
        name: 'test1.mp4',
        type: 'video',
        originalPath: '/path1',
        processedPath: '/processed1',
        duration: null,
        thumbnailPath: null,
        fileSize: 1000,
        folderId: folder.id,
        tags: null
      });
      addMediaItem({
        name: 'test2.mp4',
        type: 'video',
        originalPath: '/path2',
        processedPath: '/processed2',
        duration: null,
        thumbnailPath: null,
        fileSize: 1000,
        folderId: null,
        tags: null
      });

      const items = getAllMediaItems(folder.id);

      expect(items.length).toBe(1);
      expect(items[0].name).toBe('test1.mp4');
    });

    it('should return items without folder when folderId is null', () => {
      const folder = createMediaFolder('Folder');
      addMediaItem({
        name: 'test1.mp4',
        type: 'video',
        originalPath: '/path1',
        processedPath: '/processed1',
        duration: null,
        thumbnailPath: null,
        fileSize: 1000,
        folderId: folder.id,
        tags: null
      });
      addMediaItem({
        name: 'test2.mp4',
        type: 'video',
        originalPath: '/path2',
        processedPath: '/processed2',
        duration: null,
        thumbnailPath: null,
        fileSize: 1000,
        folderId: null,
        tags: null
      });

      const items = getAllMediaItems(null);

      expect(items.length).toBe(1);
      expect(items[0].name).toBe('test2.mp4');
    });
  });
});
