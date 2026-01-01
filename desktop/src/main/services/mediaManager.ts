import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import * as crypto from 'crypto';

export interface MediaFolder {
  id: string;
  path: string;
  name: string;
  type: 'images' | 'videos' | 'all';
  fileCount: number;
  lastScanned: Date;
}

export interface MediaFile {
  id: string;
  name: string;
  path: string;
  type: 'image' | 'video';
  size: number;
  modified: Date;
  folderId: string;
  thumbnail?: string;
}

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.wmv', '.m4v'];

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
          this.scanFolder(folder.id).catch(console.error);
        }
      }
    } catch (error) {
      console.error('Failed to load media config:', error);
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
      console.error('Failed to save media config:', error);
    }
  }

  /**
   * Add a new media folder
   */
  async addFolder(folderPath: string, type: 'images' | 'videos' | 'all'): Promise<MediaFolder> {
    const id = crypto.randomUUID();
    const folder: MediaFolder = {
      id,
      path: folderPath,
      name: path.basename(folderPath),
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
      this.files.set(folderId, files);

      // Update folder info
      folder.fileCount = files.length;
      folder.lastScanned = new Date();
      this.saveConfig();
    } catch (error) {
      console.error(`Failed to scan folder ${folder.path}:`, error);
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
              console.error(`Failed to stat file ${fullPath}:`, err);
            }
          }
        }
      }
    } catch (error) {
      console.error(`Failed to read directory ${dirPath}:`, error);
    }

    return mediaFiles;
  }

  /**
   * Get files from a folder or all folders
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
   * Check if a path is within allowed folders
   */
  isPathAllowed(filePath: string): boolean {
    const normalizedPath = path.normalize(filePath);
    for (const folder of this.folders.values()) {
      const normalizedFolder = path.normalize(folder.path);
      if (normalizedPath.startsWith(normalizedFolder)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get a file by its path
   */
  getFileByPath(filePath: string): MediaFile | undefined {
    for (const files of this.files.values()) {
      const file = files.find((f) => f.path === filePath);
      if (file) return file;
    }
    return undefined;
  }
}
