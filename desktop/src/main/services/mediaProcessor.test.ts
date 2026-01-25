import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock electron before importing module
vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => {
      if (name === 'userData') {
        return path.join(os.tmpdir(), 'solupresenter-test');
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

// Mock generateId
vi.mock('../database', () => ({
  generateId: () => 'test-id-12345'
}));

import {
  ensureMediaLibrary,
  processVideo,
  processAudio,
  processImage,
  deleteProcessedMedia,
  getMediaLibraryPath
} from './mediaProcessor';

describe('mediaProcessor', () => {
  const testDir = path.join(os.tmpdir(), 'solupresenter-test');
  const mediaLibraryPath = path.join(testDir, 'media-library');
  let testFile: string;

  beforeEach(async () => {
    // Create test directories
    await fs.promises.mkdir(testDir, { recursive: true });
    await fs.promises.mkdir(mediaLibraryPath, { recursive: true });

    // Create a test file
    testFile = path.join(testDir, 'test-file.mp4');
    await fs.promises.writeFile(testFile, 'test content');
  });

  afterEach(async () => {
    // Clean up test files
    try {
      await fs.promises.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('ensureMediaLibrary', () => {
    it('should create media library directory if it does not exist', async () => {
      // Remove the directory first
      await fs.promises.rm(mediaLibraryPath, { recursive: true, force: true });

      ensureMediaLibrary();

      expect(fs.existsSync(mediaLibraryPath)).toBe(true);
    });

    it('should not throw if directory already exists', () => {
      expect(() => ensureMediaLibrary()).not.toThrow();
    });
  });

  describe('getMediaLibraryPath', () => {
    it('should return the media library path', () => {
      const result = getMediaLibraryPath();
      expect(result).toBe(mediaLibraryPath);
    });
  });

  describe('processVideo', () => {
    it('should reject path traversal attempts in inputPath', async () => {
      const result = await processVideo('/some/path/../../../etc/passwd', 'video.mp4');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Path traversal not allowed');
    });

    it('should reject path traversal attempts in fileName', async () => {
      const result = await processVideo(testFile, '../../../etc/passwd');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Path traversal not allowed');
    });

    it('should reject relative paths', async () => {
      const result = await processVideo('relative/path/video.mp4', 'video.mp4');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Path must be absolute');
    });

    it('should reject non-existent files', async () => {
      const result = await processVideo('/nonexistent/video.mp4', 'video.mp4');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Input file does not exist');
    });

    it('should sanitize dangerous characters in filename', async () => {
      const result = await processVideo(testFile, 'video<>:"|?*.mp4');

      // Should succeed (file gets sanitized)
      expect(result.success).toBe(true);
      // The filename part (after last separator) should not contain dangerous characters
      const filename = path.basename(result.processedPath);
      expect(filename).not.toMatch(/[<>"|?*]/);
      // The dangerous chars should be replaced with underscores
      expect(filename).toContain('_');
    });

    it('should copy file successfully when ffmpeg is not available', async () => {
      const result = await processVideo(testFile, 'test-video.mp4');

      expect(result.success).toBe(true);
      expect(result.processedPath).toContain('test-id-12345');
      expect(fs.existsSync(result.processedPath)).toBe(true);
    });
  });

  describe('processAudio', () => {
    it('should reject path traversal attempts', async () => {
      const result = await processAudio('/path/../../../etc/passwd', 'audio.mp3');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Path traversal not allowed');
    });

    it('should reject relative paths', async () => {
      const result = await processAudio('relative/audio.mp3', 'audio.mp3');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Path must be absolute');
    });

    it('should copy audio file successfully', async () => {
      const audioFile = path.join(testDir, 'test.mp3');
      await fs.promises.writeFile(audioFile, 'audio content');

      const result = await processAudio(audioFile, 'test.mp3');

      expect(result.success).toBe(true);
      expect(result.processedPath).toContain('test-id-12345');
      expect(fs.existsSync(result.processedPath)).toBe(true);
    });
  });

  describe('processImage', () => {
    it('should reject path traversal attempts', async () => {
      const result = await processImage('/path/../../../etc/passwd', 'image.png');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Path traversal not allowed');
    });

    it('should reject relative paths', async () => {
      const result = await processImage('relative/image.png', 'image.png');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Path must be absolute');
    });

    it('should copy image file successfully', async () => {
      const imageFile = path.join(testDir, 'test.png');
      await fs.promises.writeFile(imageFile, 'image content');

      const result = await processImage(imageFile, 'test.png');

      expect(result.success).toBe(true);
      expect(result.processedPath).toContain('test-id-12345');
      expect(fs.existsSync(result.processedPath)).toBe(true);
    });
  });

  describe('deleteProcessedMedia', () => {
    it('should delete file within media library', async () => {
      // Create a test file in media library
      const testMediaFile = path.join(mediaLibraryPath, 'test-media.mp4');
      await fs.promises.writeFile(testMediaFile, 'media content');

      await deleteProcessedMedia(testMediaFile);

      expect(fs.existsSync(testMediaFile)).toBe(false);
    });

    it('should not delete file outside media library', async () => {
      // Create a test file outside media library
      const outsideFile = path.join(testDir, 'outside-file.txt');
      await fs.promises.writeFile(outsideFile, 'outside content');

      await deleteProcessedMedia(outsideFile);

      // File should still exist
      expect(fs.existsSync(outsideFile)).toBe(true);
    });

    it('should reject path traversal attempts', async () => {
      const traversalPath = path.join(mediaLibraryPath, '..', '..', 'etc', 'passwd');

      // Should not throw, but should not delete
      await deleteProcessedMedia(traversalPath);
    });

    it('should handle non-existent files gracefully', async () => {
      const nonExistentFile = path.join(mediaLibraryPath, 'nonexistent.mp4');

      // Should not throw
      await expect(deleteProcessedMedia(nonExistentFile)).resolves.not.toThrow();
    });
  });
});
