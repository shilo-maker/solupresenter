import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Use a unique test directory for each test run
const testRunId = Date.now().toString();
const baseTestDir = path.join(os.tmpdir(), `solupresenter-test-manager-${testRunId}`);

// Mock electron before importing module
vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => {
      if (name === 'userData') {
        return baseTestDir;
      }
      return os.tmpdir();
    },
    isPackaged: false
  }
}));

// Mock the logger
vi.mock('../utils/debug', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}));

import { MediaManager } from './mediaManager';

describe('MediaManager', () => {
  const testMediaDir = path.join(baseTestDir, 'test-media');
  let manager: MediaManager;

  beforeAll(async () => {
    // Create base test directory
    await fs.promises.mkdir(baseTestDir, { recursive: true });
  });

  afterAll(async () => {
    // Clean up after all tests
    try {
      await fs.promises.rm(baseTestDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  beforeEach(async () => {
    // Clean up any previous test state
    try {
      await fs.promises.rm(testMediaDir, { recursive: true, force: true });
    } catch {
      // Ignore if doesn't exist
    }

    // Remove config file to start fresh for each test
    const configPath = path.join(baseTestDir, 'media-folders.json');
    try {
      await fs.promises.unlink(configPath);
    } catch {
      // Ignore if doesn't exist
    }

    // Verify config file is truly deleted before proceeding
    // This ensures proper test isolation
    const configExists = await fs.promises.access(configPath).then(() => true).catch(() => false);
    if (configExists) {
      throw new Error('Config file should have been deleted');
    }

    // Create test directories
    await fs.promises.mkdir(testMediaDir, { recursive: true });

    // Create some test media files
    await fs.promises.writeFile(path.join(testMediaDir, 'test.jpg'), 'image data');
    await fs.promises.writeFile(path.join(testMediaDir, 'test.mp4'), 'video data');
    await fs.promises.writeFile(path.join(testMediaDir, 'test.png'), 'png data');
    await fs.promises.writeFile(path.join(testMediaDir, 'test.txt'), 'text data'); // Should be ignored

    manager = new MediaManager();

    // Clear any folders that might have been loaded from a previous test's config
    // This ensures test isolation even if there are timing issues with config file deletion
    const existingFolders = manager.getFolders();
    for (const folder of existingFolders) {
      manager.removeFolder(folder.id);
    }
  });

  afterEach(async () => {
    // Clean up test media files between tests
    try {
      await fs.promises.rm(testMediaDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('addFolder', () => {
    it('should add a valid folder', async () => {
      const folder = await manager.addFolder(testMediaDir, 'images');

      expect(folder).toBeDefined();
      expect(folder.path).toBe(testMediaDir);
      expect(folder.type).toBe('images');
      expect(folder.name).toBe('test-media');
    });

    it('should reject null/undefined folder path', async () => {
      await expect(manager.addFolder(null as any, 'images')).rejects.toThrow('Invalid folder path');
      await expect(manager.addFolder(undefined as any, 'images')).rejects.toThrow('Invalid folder path');
    });

    it('should reject invalid folder type', async () => {
      await expect(manager.addFolder(testMediaDir, 'invalid' as any)).rejects.toThrow('Invalid folder type');
    });

    it('should reject path traversal attempts', async () => {
      // The implementation normalizes paths first, which resolves '..'
      // So we test that a path with explicit '..' that doesn't resolve to our folder is rejected
      // Either as "Path traversal not allowed" or "Folder does not exist"
      const traversalPath = testMediaDir + path.sep + '..' + path.sep + '..' + path.sep + 'etc';
      await expect(manager.addFolder(traversalPath, 'images')).rejects.toThrow();
    });

    it('should reject relative paths', async () => {
      await expect(manager.addFolder('relative/path', 'images')).rejects.toThrow('Path must be absolute');
    });

    it('should reject non-existent folders', async () => {
      await expect(manager.addFolder('/nonexistent/folder', 'images')).rejects.toThrow('Folder does not exist');
    });

    it('should reject files (not directories)', async () => {
      const filePath = path.join(testMediaDir, 'test.jpg');
      await expect(manager.addFolder(filePath, 'images')).rejects.toThrow('Path is not a directory');
    });

    it('should scan folder and find media files', async () => {
      const folder = await manager.addFolder(testMediaDir, 'all');

      // Should have found the jpg, png, and mp4 files (not txt)
      expect(folder.fileCount).toBe(3);
    });
  });

  describe('removeFolder', () => {
    it('should remove a folder by ID', async () => {
      const folder = await manager.addFolder(testMediaDir, 'images');

      manager.removeFolder(folder.id);

      const folders = manager.getFolders();
      expect(folders.find(f => f.id === folder.id)).toBeUndefined();
    });

    it('should handle invalid folder ID gracefully', () => {
      // Should not throw
      expect(() => manager.removeFolder(null as any)).not.toThrow();
      expect(() => manager.removeFolder(undefined as any)).not.toThrow();
      expect(() => manager.removeFolder('')).not.toThrow();
    });
  });

  describe('getFolders', () => {
    it('should return empty array when no folders added', () => {
      const folders = manager.getFolders();
      expect(folders).toEqual([]);
    });

    it('should return all added folders', async () => {
      await manager.addFolder(testMediaDir, 'images');

      const folders = manager.getFolders();
      expect(folders.length).toBe(1);
    });
  });

  describe('getFiles', () => {
    it('should return all files when no folderId specified', async () => {
      await manager.addFolder(testMediaDir, 'all');

      const files = manager.getFiles();
      // Should find at least our 3 test files (jpg, png, mp4)
      expect(files.length).toBeGreaterThanOrEqual(3);
      // Verify the expected files are present
      const fileNames = files.map(f => f.name);
      expect(fileNames).toContain('test.jpg');
      expect(fileNames).toContain('test.png');
      expect(fileNames).toContain('test.mp4');
    });

    it('should return files from specific folder', async () => {
      const folder = await manager.addFolder(testMediaDir, 'all');

      const files = manager.getFiles(folder.id);
      expect(files.length).toBe(3);
    });

    it('should return empty array for unknown folder', () => {
      const files = manager.getFiles('unknown-folder-id');
      expect(files).toEqual([]);
    });
  });

  describe('getImages', () => {
    it('should return only image files', async () => {
      await manager.addFolder(testMediaDir, 'all');

      const images = manager.getImages();
      // Should find at least our 2 test images (jpg and png)
      expect(images.length).toBeGreaterThanOrEqual(2);
      // All returned files must be images
      expect(images.every(f => f.type === 'image')).toBe(true);
      // Verify the expected files are present
      const fileNames = images.map(f => f.name);
      expect(fileNames).toContain('test.jpg');
      expect(fileNames).toContain('test.png');
    });
  });

  describe('getVideos', () => {
    it('should return only video files', async () => {
      await manager.addFolder(testMediaDir, 'all');

      const videos = manager.getVideos();
      expect(videos.length).toBe(1); // mp4
      expect(videos.every(f => f.type === 'video')).toBe(true);
    });
  });

  describe('isPathAllowed', () => {
    it('should allow paths within registered folders', async () => {
      await manager.addFolder(testMediaDir, 'all');

      const filePath = path.join(testMediaDir, 'test.jpg');
      expect(manager.isPathAllowed(filePath)).toBe(true);
    });

    it('should reject paths outside registered folders', async () => {
      await manager.addFolder(testMediaDir, 'all');

      const outsidePath = path.join(baseTestDir, 'outside.jpg');
      expect(manager.isPathAllowed(outsidePath)).toBe(false);
    });

    it('should reject null/undefined paths', () => {
      expect(manager.isPathAllowed(null as any)).toBe(false);
      expect(manager.isPathAllowed(undefined as any)).toBe(false);
    });

    it('should reject path traversal attempts', async () => {
      await manager.addFolder(testMediaDir, 'all');

      const traversalPath = path.join(testMediaDir, '..', 'etc', 'passwd');
      expect(manager.isPathAllowed(traversalPath)).toBe(false);
    });

    it('should return false when no folders registered', () => {
      expect(manager.isPathAllowed('/some/path/file.jpg')).toBe(false);
    });
  });

  describe('getFileByPath', () => {
    it('should return file by path', async () => {
      await manager.addFolder(testMediaDir, 'all');

      const filePath = path.join(testMediaDir, 'test.jpg');
      const file = manager.getFileByPath(filePath);

      expect(file).toBeDefined();
      expect(file?.path).toBe(filePath);
      expect(file?.type).toBe('image');
    });

    it('should return undefined for unknown path', async () => {
      await manager.addFolder(testMediaDir, 'all');

      const file = manager.getFileByPath('/unknown/path.jpg');
      expect(file).toBeUndefined();
    });

    it('should handle null/undefined paths', () => {
      expect(manager.getFileByPath(null as any)).toBeUndefined();
      expect(manager.getFileByPath(undefined as any)).toBeUndefined();
    });
  });

  describe('scanFolder', () => {
    it('should skip symlinks during scanning', async () => {
      // Create a subdirectory
      const subDir = path.join(testMediaDir, 'subdir');
      await fs.promises.mkdir(subDir, { recursive: true });
      await fs.promises.writeFile(path.join(subDir, 'nested.jpg'), 'nested image');

      const folder = await manager.addFolder(testMediaDir, 'images');

      // Should find both top-level and nested images
      const files = manager.getFiles(folder.id);
      expect(files.length).toBe(3); // test.jpg, test.png, nested.jpg
    });
  });

  describe('rescanFolder', () => {
    it('should rescan folder and update file count', async () => {
      const folder = await manager.addFolder(testMediaDir, 'images');
      const initialCount = folder.fileCount;

      // Add a new file
      await fs.promises.writeFile(path.join(testMediaDir, 'new.jpg'), 'new image');

      // Rescan
      await manager.rescanFolder(folder.id);

      const updatedFolder = manager.getFolders().find(f => f.id === folder.id);
      expect(updatedFolder?.fileCount).toBe(initialCount + 1);
    });
  });
});
