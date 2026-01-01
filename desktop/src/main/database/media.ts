import { getDb, saveDatabase, generateId, rowsToObjects } from './index';

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

  saveDatabase();
}

// ============ Folder Functions ============

/**
 * Create a new media folder
 */
export function createMediaFolder(name: string): MediaFolder {
  const db = getDb();
  if (!db) throw new Error('Database not initialized');

  const id = generateId();
  const createdAt = new Date().toISOString();

  db.run(`INSERT INTO media_folders (id, name, createdAt) VALUES (?, ?, ?)`, [id, name, createdAt]);
  saveDatabase();

  return { id, name, createdAt };
}

/**
 * Get all media folders
 */
export function getAllMediaFolders(): MediaFolder[] {
  const db = getDb();
  if (!db) return [];

  const result = db.exec('SELECT * FROM media_folders ORDER BY name ASC');
  return rowsToObjects(result) as MediaFolder[];
}

/**
 * Rename a media folder
 */
export function renameMediaFolder(id: string, name: string): boolean {
  const db = getDb();
  if (!db) return false;

  db.run(`UPDATE media_folders SET name = ? WHERE id = ?`, [name, id]);
  saveDatabase();
  return true;
}

/**
 * Delete a media folder (media items will have folderId set to null)
 */
export function deleteMediaFolder(id: string): boolean {
  const db = getDb();
  if (!db) return false;

  // Set folderId to null for all items in this folder
  db.run(`UPDATE media_items SET folderId = NULL WHERE folderId = ?`, [id]);
  // Delete the folder
  db.run(`DELETE FROM media_folders WHERE id = ?`, [id]);
  saveDatabase();
  return true;
}

// ============ Media Item Functions ============

/**
 * Add a media item to the library
 */
export function addMediaItem(item: Omit<MediaItem, 'id' | 'createdAt'> & { folderId?: string | null }): MediaItem {
  const db = getDb();
  if (!db) throw new Error('Database not initialized');

  const id = generateId();
  const createdAt = new Date().toISOString();
  const folderId = item.folderId || null;

  db.run(`
    INSERT INTO media_items (id, name, type, originalPath, processedPath, duration, thumbnailPath, fileSize, folderId, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [id, item.name, item.type, item.originalPath, item.processedPath, item.duration, item.thumbnailPath, item.fileSize, folderId, createdAt]);

  saveDatabase();

  return {
    id,
    name: item.name,
    type: item.type,
    originalPath: item.originalPath,
    processedPath: item.processedPath,
    duration: item.duration,
    thumbnailPath: item.thumbnailPath,
    fileSize: item.fileSize,
    folderId,
    tags: null,
    createdAt
  };
}

/**
 * Get all media items, optionally filtered by folder
 */
export function getAllMediaItems(folderId?: string | null): MediaItem[] {
  const db = getDb();
  if (!db) return [];

  let query = 'SELECT * FROM media_items';
  if (folderId === null) {
    // Get items without a folder
    query += ' WHERE folderId IS NULL';
  } else if (folderId) {
    // Get items in specific folder
    query += ` WHERE folderId = '${folderId.replace(/'/g, "''")}'`;
  }
  query += ' ORDER BY createdAt DESC';

  const result = db.exec(query);
  return rowsToObjects(result) as MediaItem[];
}

/**
 * Get media item by ID
 */
export function getMediaItem(id: string): MediaItem | null {
  const db = getDb();
  if (!db) return null;

  const result = db.exec(`SELECT * FROM media_items WHERE id = '${id.replace(/'/g, "''")}'`);
  const items = rowsToObjects(result) as MediaItem[];
  return items[0] || null;
}

/**
 * Update media item's folder
 */
export function moveMediaToFolder(mediaId: string, folderId: string | null): boolean {
  const db = getDb();
  if (!db) return false;

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

  db.run(`DELETE FROM media_items WHERE id = ?`, [id]);
  saveDatabase();
  return true;
}

/**
 * Check if media already imported (by original path)
 */
export function isMediaImported(originalPath: string): boolean {
  const db = getDb();
  if (!db) return false;

  const result = db.exec(`SELECT id FROM media_items WHERE originalPath = '${originalPath.replace(/'/g, "''")}'`);
  return result.length > 0 && result[0].values.length > 0;
}

/**
 * Rename a media item
 */
export function renameMediaItem(id: string, name: string): boolean {
  const db = getDb();
  if (!db) return false;

  db.run(`UPDATE media_items SET name = ? WHERE id = ?`, [name, id]);
  saveDatabase();
  return true;
}

/**
 * Update media item's tags
 */
export function updateMediaTags(id: string, tags: string | null): boolean {
  const db = getDb();
  if (!db) return false;

  db.run(`UPDATE media_items SET tags = ? WHERE id = ?`, [tags, id]);
  saveDatabase();
  return true;
}
