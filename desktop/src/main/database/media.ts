import { getDb, saveDatabase, generateId, queryAll, queryOne, createBackup } from './index';
import { createLogger } from '../utils/debug';

const log = createLogger('MediaDB');

export interface MediaFolder {
  id: string;
  name: string;
  createdAt: string;
}

export interface MediaItem {
  id: string;
  name: string;
  type: 'video' | 'image' | 'audio';
  originalPath: string;
  processedPath: string;
  duration: number | null;
  thumbnailPath: string | null;
  fileSize: number;
  folderId: string | null;
  tags: string | null; // Comma-separated tags for searching
  width: number | null;  // Media width in pixels
  height: number | null; // Media height in pixels
  createdAt: string;
}

/**
 * Initialize media tables (called from main database init)
 */
export function initMediaTables(): void {
  const db = getDb();
  if (!db) return;

  // Media folders table
  db.run(`
    CREATE TABLE IF NOT EXISTS media_folders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Media items table with folderId
  db.run(`
    CREATE TABLE IF NOT EXISTS media_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      originalPath TEXT NOT NULL,
      processedPath TEXT NOT NULL,
      duration REAL,
      thumbnailPath TEXT,
      fileSize INTEGER DEFAULT 0,
      folderId TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (folderId) REFERENCES media_folders(id) ON DELETE SET NULL
    )
  `);

  // Add folderId column if it doesn't exist (migration for existing databases)
  try {
    db.run(`ALTER TABLE media_items ADD COLUMN folderId TEXT`);
  } catch {
    // Column already exists
  }

  // Add tags column if it doesn't exist (migration for existing databases)
  try {
    db.run(`ALTER TABLE media_items ADD COLUMN tags TEXT`);
  } catch {
    // Column already exists
  }

  // Add width column if it doesn't exist (migration for existing databases)
  try {
    db.run(`ALTER TABLE media_items ADD COLUMN width INTEGER`);
  } catch {
    // Column already exists
  }

  // Add height column if it doesn't exist (migration for existing databases)
  try {
    db.run(`ALTER TABLE media_items ADD COLUMN height INTEGER`);
  } catch {
    // Column already exists
  }

  saveDatabase();
}

// ============ Folder Functions ============

/**
 * Create a new media folder
 */
export function createMediaFolder(name: string): MediaFolder {
  const db = getDb();
  if (!db) throw new Error('Database not initialized');

  // Validate input
  if (!name || typeof name !== 'string') {
    throw new Error('Invalid folder name');
  }
  const sanitizedName = name.trim().substring(0, 255);
  if (sanitizedName.length === 0) {
    throw new Error('Folder name cannot be empty');
  }

  const id = generateId();
  const createdAt = new Date().toISOString();

  db.run(`INSERT INTO media_folders (id, name, createdAt) VALUES (?, ?, ?)`, [id, sanitizedName, createdAt]);
  saveDatabase();

  return { id, name: sanitizedName, createdAt };
}

/**
 * Get all media folders
 */
export function getAllMediaFolders(): MediaFolder[] {
  return queryAll('SELECT * FROM media_folders ORDER BY name ASC') as MediaFolder[];
}

/**
 * Rename a media folder
 */
export function renameMediaFolder(id: string, name: string): boolean {
  const db = getDb();
  if (!db) return false;

  // Validate inputs
  if (!id || typeof id !== 'string') return false;
  if (!name || typeof name !== 'string') return false;
  const sanitizedName = name.trim().substring(0, 255);
  if (sanitizedName.length === 0) return false;

  db.run(`UPDATE media_folders SET name = ? WHERE id = ?`, [sanitizedName, id]);
  saveDatabase();
  return true;
}

/**
 * Delete a media folder (media items will have folderId set to null)
 * Uses a transaction for atomicity
 */
export function deleteMediaFolder(id: string): boolean {
  const db = getDb();
  if (!db) return false;

  // Validate input
  if (!id || typeof id !== 'string') return false;

  // Create backup before destructive operation
  createBackup('delete_media_folder');

  try {
    // Begin transaction for atomicity
    db.run('BEGIN TRANSACTION');

    // Set folderId to null for all items in this folder
    db.run(`UPDATE media_items SET folderId = NULL WHERE folderId = ?`, [id]);
    // Delete the folder
    db.run(`DELETE FROM media_folders WHERE id = ?`, [id]);

    // Commit transaction
    db.run('COMMIT');
    saveDatabase();
    return true;
  } catch (error) {
    // Rollback on error
    try {
      db.run('ROLLBACK');
    } catch {
      // Ignore rollback errors
    }
    log.error('deleteMediaFolder error:', error);
    return false;
  }
}

// ============ Media Item Functions ============

/**
 * Add a media item to the library
 */
export function addMediaItem(item: Omit<MediaItem, 'id' | 'createdAt'> & { folderId?: string | null }): MediaItem {
  const db = getDb();
  if (!db) throw new Error('Database not initialized');

  // Validate required fields
  if (!item || typeof item !== 'object') {
    throw new Error('Invalid media item');
  }
  if (!item.name || typeof item.name !== 'string') {
    throw new Error('Invalid media item name');
  }
  if (!item.type || !['video', 'image', 'audio'].includes(item.type)) {
    throw new Error('Invalid media item type');
  }
  if (!item.originalPath || typeof item.originalPath !== 'string') {
    throw new Error('Invalid media item originalPath');
  }
  if (!item.processedPath || typeof item.processedPath !== 'string') {
    throw new Error('Invalid media item processedPath');
  }

  const id = generateId();
  const createdAt = new Date().toISOString();
  const folderId = item.folderId || null;

  // Sanitize name and tags
  const sanitizedName = item.name.substring(0, 500);
  const tags = item.tags ? item.tags.substring(0, 1000) : null;
  const width = item.width || null;
  const height = item.height || null;

  db.run(`
    INSERT INTO media_items (id, name, type, originalPath, processedPath, duration, thumbnailPath, fileSize, folderId, tags, width, height, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [id, sanitizedName, item.type, item.originalPath, item.processedPath, item.duration, item.thumbnailPath, item.fileSize, folderId, tags, width, height, createdAt]);

  saveDatabase();

  return {
    id,
    name: sanitizedName,
    type: item.type,
    originalPath: item.originalPath,
    processedPath: item.processedPath,
    duration: item.duration,
    thumbnailPath: item.thumbnailPath,
    fileSize: item.fileSize,
    folderId,
    tags,
    width,
    height,
    createdAt
  };
}

/**
 * Get all media items, optionally filtered by folder
 */
export function getAllMediaItems(folderId?: string | null): MediaItem[] {
  if (folderId === null) {
    // Get items without a folder
    return queryAll('SELECT * FROM media_items WHERE folderId IS NULL ORDER BY createdAt DESC') as MediaItem[];
  } else if (folderId) {
    // Get items in specific folder
    return queryAll('SELECT * FROM media_items WHERE folderId = ? ORDER BY createdAt DESC', [folderId]) as MediaItem[];
  }
  return queryAll('SELECT * FROM media_items ORDER BY createdAt DESC') as MediaItem[];
}

/**
 * Get media item by ID
 */
export function getMediaItem(id: string): MediaItem | null {
  // Validate input
  if (!id || typeof id !== 'string') return null;
  return queryOne('SELECT * FROM media_items WHERE id = ?', [id]) as MediaItem | null;
}

/**
 * Update media item's folder
 */
export function moveMediaToFolder(mediaId: string, folderId: string | null): boolean {
  const db = getDb();
  if (!db) return false;

  // Validate inputs
  if (!mediaId || typeof mediaId !== 'string') return false;
  if (folderId !== null && typeof folderId !== 'string') return false;

  db.run(`UPDATE media_items SET folderId = ? WHERE id = ?`, [folderId, mediaId]);
  saveDatabase();
  return true;
}

/**
 * Delete media item
 */
export function deleteMediaItem(id: string): boolean {
  const db = getDb();
  if (!db) return false;

  // Validate input
  if (!id || typeof id !== 'string') return false;

  // Create backup before destructive operation
  createBackup('delete_media_item');

  db.run(`DELETE FROM media_items WHERE id = ?`, [id]);
  saveDatabase();
  return true;
}

/**
 * Check if media already imported (by original path)
 */
export function isMediaImported(originalPath: string): boolean {
  // Validate input
  if (!originalPath || typeof originalPath !== 'string') return false;
  const result = queryOne('SELECT id FROM media_items WHERE originalPath = ?', [originalPath]);
  return result !== null;
}

/**
 * Rename a media item
 */
export function renameMediaItem(id: string, name: string): boolean {
  const db = getDb();
  if (!db) return false;

  // Validate inputs
  if (!id || typeof id !== 'string') return false;
  if (!name || typeof name !== 'string') return false;
  const sanitizedName = name.trim().substring(0, 500);
  if (sanitizedName.length === 0) return false;

  db.run(`UPDATE media_items SET name = ? WHERE id = ?`, [sanitizedName, id]);
  saveDatabase();
  return true;
}

/**
 * Update media item's tags
 */
export function updateMediaTags(id: string, tags: string | null): boolean {
  const db = getDb();
  if (!db) return false;

  // Validate inputs
  if (!id || typeof id !== 'string') return false;
  // Sanitize tags
  const sanitizedTags = tags ? tags.substring(0, 1000) : null;

  db.run(`UPDATE media_items SET tags = ? WHERE id = ?`, [sanitizedTags, id]);
  saveDatabase();
  return true;
}
