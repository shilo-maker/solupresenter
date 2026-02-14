import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import * as crypto from 'crypto';
import { createLogger } from '../utils/debug';

// Create logger for this module
const log = createLogger('MediaManager');

/**
 * Represents a registered media folder that is scanned for media files.
 */
export interface MediaFolder {
  /** Unique identifier for the folder */
  id: string;
  /** Absolute path to the folder */
  path: string;
  /** Display name (usually the folder's basename) */
  name: string;
  /** Type of media to scan for in this folder */
  type: 'images' | 'videos' | 'all';
  /** Number of media files found in the folder */
  fileCount: number;
  /** Timestamp of the last folder scan */
  lastScanned: Date;
}

/**
 * Represents a media file (image or video) found in a registered folder.
 */
export interface MediaFile {
  /** Unique identifier for the file */
  id: string;
  /** Filename (not the full path) */
  name: string;
  /** Absolute path to the file */
  path: string;
  /** Type of media (image or video) */
  type: 'image' | 'video';
  /** File size in bytes */
  size: number;
  /** Last modification timestamp */
  modified: Date;
  /** ID of the folder this file belongs to */
  folderId: string;
  /** Optional base64 thumbnail data */
  thumbnail?: string;
}

/** Supported image file extensions */
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
/** Supported video file extensions */
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.wmv', '.m4v'];

/**
 * Manages media folders and files for the presentation system.
 * Handles folder registration, file scanning, and media queries.
 * Configuration is persisted to the user's app data folder.
 *
 * @example
 * const manager = new MediaManager();
 * await manager.addFolder('/path/to/images', 'images');
 * const files = manager.getImages();
 */
export class MediaManager {
  private folders: Map<string, MediaFolder> = new Map();
  private files: Map<string, MediaFile[]> = new Map();
  private configPath: string;

  constructor() {
    this.configPath = path.join(app.getPath('userData'), 'media-folders.json');
    this.loadConfig();
  }

  /**
   * Load saved folder configuration
   */
  private loadConfig(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
        for (const folder of data.folders || []) {
          this.folders.set(folder.id, {
            ...folder,
            lastScanned: new Date(folder.lastScanned)
          });
          // Scan folder on load
          this.scanFolder(folder.id).catch(err => log.error('Scan folder failed:', err));
        }
      }
    } catch (error) {
      log.error('Failed to load media config:', error);
    }
  }

  /**
   * Save folder configuration
   */
  private saveConfig(): void {
    try {
      const data = {
        folders: Array.from(this.folders.values())
      };
      fs.writeFileSync(this.configPath, JSON.stringify(data, null, 2));
    } catch (error) {
      log.error('Failed to save media config:', error);
    }
  }

  /**
   * Add a new media folder to be scanned for media files.
   * Validates the path for security and immediately scans the folder.
   *
   * @param folderPath - Absolute path to the folder to add
   * @param type - Type of media to scan for ('images', 'videos', or 'all')
   * @returns The created MediaFolder object
   * @throws Error if path is invalid, doesn't exist, or contains traversal attempts
   */
  async addFolder(folderPath: string, type: 'images' | 'videos' | 'all'): Promise<MediaFolder> {
    // Validate inputs
    if (!folderPath || typeof folderPath !== 'string') {
      throw new Error('Invalid folder path');
    }
    if (!['images', 'videos', 'all'].includes(type)) {
      throw new Error('Invalid folder type');
    }

    // Normalize and validate path
    const normalizedPath = path.normalize(folderPath);

    // Check for path traversal
    if (normalizedPath.includes('..')) {
      throw new Error('Path traversal not allowed');
    }

    // Ensure path is absolute
    if (!path.isAbsolute(normalizedPath)) {
      throw new Error('Path must be absolute');
    }

    // Check if folder exists and is a directory
    try {
      const stats = await fs.promises.stat(normalizedPath);
      if (!stats.isDirectory()) {
        throw new Error('Path is not a directory');
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error('Folder does not exist');
      }
      throw error;
    }

    const id = crypto.randomUUID();
    const folder: MediaFolder = {
      id,
      path: normalizedPath,
      name: path.basename(normalizedPath),
      type,
      fileCount: 0,
      lastScanned: new Date()
    };

    this.folders.set(id, folder);
    await this.scanFolder(id);
    this.saveConfig();

    return folder;
  }

  /**
   * Remove a media folder
   */
  removeFolder(folderId: string): void {
    // Validate input
    if (!folderId || typeof folderId !== 'string') {
      log.error('removeFolder: invalid folderId');
      return;
    }
    this.folders.delete(folderId);
    this.files.delete(folderId);
    this.saveConfig();
  }

  /**
   * Get all folders
   */
  getFolders(): MediaFolder[] {
    return Array.from(this.folders.values());
  }

  /**
   * Scan a folder for media files
   */
  async scanFolder(folderId: string): Promise<void> {
    const folder = this.folders.get(folderId);
    if (!folder) return;

    try {
      const files = await this.scanDirectory(folder.path, folder.type, folderId);
      // Re-check folder still exists after async scan (may have been removed during scan)
      if (!this.folders.has(folderId)) return;
      this.files.set(folderId, files);

      // Update folder info
      folder.fileCount = files.length;
      folder.lastScanned = new Date();
      this.saveConfig();
    } catch (error) {
      log.error(`Failed to scan folder ${folder.path}:`, error);
    }
  }

  /**
   * Rescan a folder
   */
  async rescanFolder(folderId: string): Promise<void> {
    await this.scanFolder(folderId);
  }

  /**
   * Scan directory recursively for media files
   */
  private async scanDirectory(
    dirPath: string,
    type: 'images' | 'videos' | 'all',
    folderId: string
  ): Promise<MediaFile[]> {
    const mediaFiles: MediaFile[] = [];

    const extensions = type === 'images'
      ? IMAGE_EXTENSIONS
      : type === 'videos'
        ? VIDEO_EXTENSIONS
        : [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS];

    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        // Skip symlinks to prevent infinite loops and accessing files outside intended directories
        if (entry.isSymbolicLink()) {
          log.debug(`Skipping symlink: ${fullPath}`);
          continue;
        }

        if (entry.isDirectory()) {
          // Recursively scan subdirectories
          const subFiles = await this.scanDirectory(fullPath, type, folderId);
          mediaFiles.push(...subFiles);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (extensions.includes(ext)) {
            try {
              const stats = await fs.promises.stat(fullPath);
              const fileType = IMAGE_EXTENSIONS.includes(ext) ? 'image' : 'video';

              mediaFiles.push({
                id: crypto.randomUUID(),
                name: entry.name,
                path: fullPath,
                type: fileType,
                size: stats.size,
                modified: stats.mtime,
                folderId
              });
            } catch (err) {
              log.error(`Failed to stat file ${fullPath}:`, err);
            }
          }
        }
      }
    } catch (error) {
      log.error(`Failed to read directory ${dirPath}:`, error);
    }

    return mediaFiles;
  }

  /**
   * Get media files from a specific folder or all registered folders.
   *
   * @param folderId - Optional folder ID to filter by. If omitted, returns all files.
   * @returns Array of MediaFile objects, sorted by modification date (newest first)
   */
  getFiles(folderId?: string): MediaFile[] {
    if (folderId) {
      return this.files.get(folderId) || [];
    }

    // Return all files from all folders
    const allFiles: MediaFile[] = [];
    for (const files of this.files.values()) {
      allFiles.push(...files);
    }

    // Sort by modified date (newest first)
    return allFiles.sort((a, b) => b.modified.getTime() - a.modified.getTime());
  }

  /**
   * Get images only
   */
  getImages(folderId?: string): MediaFile[] {
    return this.getFiles(folderId).filter((f) => f.type === 'image');
  }

  /**
   * Get videos only
   */
  getVideos(folderId?: string): MediaFile[] {
    return this.getFiles(folderId).filter((f) => f.type === 'video');
  }

  /**
   * Check if a file path is within one of the registered media folders.
   * Used for security validation before serving files.
   *
   * @param filePath - The path to validate
   * @returns true if the path is within a registered folder, false otherwise
   */
  isPathAllowed(filePath: string): boolean {
    // Validate input
    if (!filePath || typeof filePath !== 'string') {
      return false;
    }
    const normalizedPath = path.normalize(filePath);
    // Check for path traversal
    if (normalizedPath.includes('..')) {
      return false;
    }
    for (const folder of this.folders.values()) {
      const normalizedFolder = path.normalize(folder.path);
      if (normalizedPath.startsWith(normalizedFolder + path.sep) || normalizedPath === normalizedFolder) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get a file by its path
   */
  getFileByPath(filePath: string): MediaFile | undefined {
    // Validate input
    if (!filePath || typeof filePath !== 'string') {
      return undefined;
    }
    for (const files of this.files.values()) {
      const file = files.find((f) => f.path === filePath);
      if (file) return file;
    }
    return undefined;
  }
}
