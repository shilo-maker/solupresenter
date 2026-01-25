import { getDb, saveDatabase, generateId, queryAll, queryOne, beginTransaction, commitTransaction, rollbackTransaction, createBackup } from './index';
import axios from 'axios';

export interface SongData {
  title: string;
  originalLanguage?: string;
  slides?: Array<{
    originalText?: string;
    transliteration?: string;
    translation?: string;
    translationOverflow?: string;
    verseType?: string;
  }>;
  tags?: string[];
  author?: string;
  backgroundImage?: string;
}

/**
 * Get all songs, optionally filtered by search query
 */
export async function getSongs(query?: string): Promise<any[]> {
  if (query) {
    const searchPattern = `%${query}%`;
    return queryAll(
      'SELECT * FROM songs WHERE title LIKE ? OR author LIKE ? ORDER BY updatedAt DESC',
      [searchPattern, searchPattern]
    );
  }
  return queryAll('SELECT * FROM songs ORDER BY updatedAt DESC');
}

/**
 * Get a single song by ID
 */
export async function getSong(id: string): Promise<any | null> {
  return queryOne('SELECT * FROM songs WHERE id = ?', [id]);
}

// Constants for input validation
const MAX_TITLE_LENGTH = 500;
const MAX_AUTHOR_LENGTH = 255;
const MAX_BACKGROUND_LENGTH = 5000;
const MAX_SLIDES_COUNT = 500;
const MAX_SLIDE_TEXT_LENGTH = 10000;

/**
 * Create a new song
 */
export async function createSong(data: SongData): Promise<any> {
  const db = getDb();
  if (!db) throw new Error('Database not initialized');

  // Validate required fields
  if (!data.title || typeof data.title !== 'string' || !data.title.trim()) {
    throw new Error('Song title is required and must be a non-empty string');
  }

  // Enforce length limits
  const title = data.title.trim().substring(0, MAX_TITLE_LENGTH);
  const author = data.author ? String(data.author).substring(0, MAX_AUTHOR_LENGTH) : null;
  const backgroundImage = data.backgroundImage ? String(data.backgroundImage).substring(0, MAX_BACKGROUND_LENGTH) : '';

  // Validate and limit slides
  let slides = Array.isArray(data.slides) ? data.slides.slice(0, MAX_SLIDES_COUNT) : [];
  slides = slides.map(slide => ({
    originalText: slide.originalText ? String(slide.originalText).substring(0, MAX_SLIDE_TEXT_LENGTH) : '',
    transliteration: slide.transliteration ? String(slide.transliteration).substring(0, MAX_SLIDE_TEXT_LENGTH) : '',
    translation: slide.translation ? String(slide.translation).substring(0, MAX_SLIDE_TEXT_LENGTH) : '',
    translationOverflow: slide.translationOverflow ? String(slide.translationOverflow).substring(0, MAX_SLIDE_TEXT_LENGTH) : '',
    verseType: slide.verseType ? String(slide.verseType).substring(0, 50) : ''
  }));

  // Validate tags
  const tags = Array.isArray(data.tags) ? data.tags.filter(t => typeof t === 'string').slice(0, 100) : [];

  const id = generateId();
  const now = new Date().toISOString();

  try {
    db.run(`
      INSERT INTO songs (id, title, originalLanguage, slides, tags, author, backgroundImage, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      title,
      data.originalLanguage || 'he',
      JSON.stringify(slides),
      JSON.stringify(tags),
      author,
      backgroundImage,
      now,
      now
    ]);

    saveDatabase();
  } catch (error) {
    console.error('Failed to create song:', error);
    throw new Error(`Failed to create song: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Return the created object directly instead of re-querying
  return {
    id,
    title,
    originalLanguage: data.originalLanguage || 'he',
    slides,
    tags,
    author,
    backgroundImage,
    usageCount: 0,
    remoteId: null,
    createdAt: now,
    updatedAt: now
  };
}

/**
 * Update an existing song
 */
export async function updateSong(id: string, data: Partial<SongData>): Promise<any | null> {
  const db = getDb();
  if (!db) return null;

  const existing = await getSong(id);
  if (!existing) return null;

  const updates: string[] = [];
  const values: any[] = [];
  const now = new Date().toISOString();

  // Track updated values for return object
  const updatedSong = { ...existing };

  if (data.title !== undefined) {
    // Validate title if provided
    if (typeof data.title !== 'string' || !data.title.trim()) {
      throw new Error('Song title must be a non-empty string');
    }
    updates.push('title = ?');
    values.push(data.title.trim());
    updatedSong.title = data.title.trim();
  }
  if (data.originalLanguage !== undefined) {
    updates.push('originalLanguage = ?');
    values.push(data.originalLanguage);
    updatedSong.originalLanguage = data.originalLanguage;
  }
  if (data.slides !== undefined) {
    updates.push('slides = ?');
    values.push(JSON.stringify(data.slides));
    updatedSong.slides = data.slides;
  }
  if (data.tags !== undefined) {
    updates.push('tags = ?');
    values.push(JSON.stringify(data.tags));
    updatedSong.tags = data.tags;
  }
  if (data.author !== undefined) {
    updates.push('author = ?');
    values.push(data.author);
    updatedSong.author = data.author;
  }
  if (data.backgroundImage !== undefined) {
    updates.push('backgroundImage = ?');
    values.push(data.backgroundImage);
    updatedSong.backgroundImage = data.backgroundImage;
  }

  updates.push('updatedAt = ?');
  values.push(now);
  values.push(id);
  updatedSong.updatedAt = now;

  try {
    db.run(`UPDATE songs SET ${updates.join(', ')} WHERE id = ?`, values);
    saveDatabase();
  } catch (error) {
    console.error('Failed to update song:', error);
    throw new Error(`Failed to update song: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Return the updated object directly instead of re-querying
  return updatedSong;
}

/**
 * Delete a song
 */
export async function deleteSong(id: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  // Validate input
  if (!id || typeof id !== 'string') return false;

  // Create backup before destructive operation
  createBackup('delete_song');

  try {
    db.run(`DELETE FROM songs WHERE id = ?`, [id]);
    saveDatabase();
    return true;
  } catch (error) {
    console.error('Failed to delete song:', error);
    return false;
  }
}

/**
 * Import songs from web backend
 */
export async function importSongsFromBackend(backendUrl: string): Promise<{ imported: number; updated: number; errors: number }> {
  const db = getDb();
  if (!db) throw new Error('Database not initialized');

  let imported = 0;
  let updated = 0;
  let errors = 0;

  try {
    const response = await axios.get(`${backendUrl}/api/songs/export`, { timeout: 30000 });
    const remoteSongs = response.data;

    // Use transaction for bulk import
    beginTransaction();
    try {
      for (const remoteSong of remoteSongs) {
        try {
          // Validate song data structure
          if (!remoteSong._id || typeof remoteSong._id !== 'string') {
            console.warn('Skipping song with invalid _id:', remoteSong.title);
            errors++;
            continue;
          }
          if (!remoteSong.title || typeof remoteSong.title !== 'string') {
            console.warn('Skipping song with invalid title:', remoteSong._id);
            errors++;
            continue;
          }
          // Validate slides is an array if provided
          const slides = Array.isArray(remoteSong.slides) ? remoteSong.slides : [];
          const tags = Array.isArray(remoteSong.tags) ? remoteSong.tags : [];

          // Check if song exists by remoteId
          const existing = queryOne('SELECT id FROM songs WHERE remoteId = ?', [remoteSong._id]);

          const now = new Date().toISOString();

          if (existing) {
            // Update existing song
            db.run(`
              UPDATE songs SET
                title = ?,
                originalLanguage = ?,
                slides = ?,
                tags = ?,
                author = ?,
                backgroundImage = ?,
                updatedAt = ?
              WHERE remoteId = ?
            `, [
              remoteSong.title,
              remoteSong.originalLanguage || 'he',
              JSON.stringify(slides),
              JSON.stringify(tags),
              remoteSong.author || null,
              remoteSong.backgroundImage || '',
              now,
              remoteSong._id
            ]);
            updated++;
          } else {
            // Insert new song
            const id = generateId();
            db.run(`
              INSERT INTO songs (id, title, originalLanguage, slides, tags, author, backgroundImage, remoteId, createdAt, updatedAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              id,
              remoteSong.title,
              remoteSong.originalLanguage || 'he',
              JSON.stringify(slides),
              JSON.stringify(tags),
              remoteSong.author || null,
              remoteSong.backgroundImage || '',
              remoteSong._id,
              now,
              now
            ]);
            imported++;
          }
        } catch (err) {
          console.error('Error importing song:', remoteSong.title, err);
          errors++;
        }
      }
      commitTransaction();
    } catch (transactionError) {
      rollbackTransaction();
      throw transactionError;
    }

    console.log(`Import complete: ${imported} imported, ${updated} updated, ${errors} errors`);
  } catch (err) {
    console.error('Failed to fetch songs from backend:', err);
    throw new Error('Failed to connect to backend server');
  }

  return { imported, updated, errors };
}
