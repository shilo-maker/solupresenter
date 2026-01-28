import { getDb, saveDatabase, generateId, queryAll, queryOne, beginTransaction, commitTransaction, rollbackTransaction, createBackup } from './index';
import axios from 'axios';

export interface ArrangementSection {
  id: string;
  verseType: string;
}

export interface SongArrangement {
  id: string;
  name: string;
  sections: ArrangementSection[];
  createdAt: string;
  updatedAt: string;
}

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
  arrangements?: SongArrangement[];
}

/**
 * Get all songs, optionally filtered by search query
 * Hebrew songs are always shown first, then other languages
 * Within each language group, sorted alphabetically by title
 */
export async function getSongs(query?: string): Promise<any[]> {
  // Order by: Hebrew first, then alphabetically by title
  const orderClause = "ORDER BY CASE WHEN originalLanguage = 'he' THEN 0 ELSE 1 END, title COLLATE NOCASE ASC";

  if (query) {
    const searchPattern = `%${query}%`;
    return queryAll(
      `SELECT * FROM songs WHERE title LIKE ? OR author LIKE ? ${orderClause}`,
      [searchPattern, searchPattern]
    );
  }
  return queryAll(`SELECT * FROM songs ${orderClause}`);
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
 * Generate a unique song title by appending (1), (2), etc. if needed
 */
function generateUniqueSongTitle(title: string, excludeId?: string): string {
  const baseTitle = title.trim();

  // Check if exact title exists
  const existingQuery = excludeId
    ? queryOne('SELECT id FROM songs WHERE title = ? AND id != ?', [baseTitle, excludeId])
    : queryOne('SELECT id FROM songs WHERE title = ?', [baseTitle]);

  if (!existingQuery) {
    return baseTitle;
  }

  // Find all songs with titles matching the pattern "baseTitle" or "baseTitle (N)"
  const pattern = `${baseTitle} (%)`;
  const existingSongs = queryAll(
    excludeId
      ? 'SELECT title FROM songs WHERE (title = ? OR title LIKE ?) AND id != ?'
      : 'SELECT title FROM songs WHERE title = ? OR title LIKE ?',
    excludeId ? [baseTitle, pattern, excludeId] : [baseTitle, pattern]
  );

  // Extract existing numbers
  const usedNumbers = new Set<number>([0]); // 0 represents the base title
  const regex = new RegExp(`^${baseTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\((\\d+)\\)$`);

  for (const song of existingSongs) {
    const match = song.title.match(regex);
    if (match) {
      usedNumbers.add(parseInt(match[1], 10));
    }
  }

  // Find the next available number
  let nextNumber = 1;
  while (usedNumbers.has(nextNumber)) {
    nextNumber++;
  }

  return `${baseTitle} (${nextNumber})`;
}

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

  // Enforce length limits and ensure unique title
  const rawTitle = data.title.trim().substring(0, MAX_TITLE_LENGTH);
  const title = generateUniqueSongTitle(rawTitle);
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

  // Validate arrangements
  const arrangements = Array.isArray(data.arrangements) ? data.arrangements : [];

  const id = generateId();
  const now = new Date().toISOString();

  try {
    db.run(`
      INSERT INTO songs (id, title, originalLanguage, slides, tags, author, backgroundImage, arrangements, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      title,
      data.originalLanguage || 'he',
      JSON.stringify(slides),
      JSON.stringify(tags),
      author,
      backgroundImage,
      JSON.stringify(arrangements),
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
    arrangements,
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
    // Ensure unique title (excluding current song)
    const uniqueTitle = generateUniqueSongTitle(data.title.trim(), id);
    updates.push('title = ?');
    values.push(uniqueTitle);
    updatedSong.title = uniqueTitle;
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
  if (data.arrangements !== undefined) {
    updates.push('arrangements = ?');
    values.push(JSON.stringify(data.arrangements));
    updatedSong.arrangements = data.arrangements;
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
          const arrangements = Array.isArray(remoteSong.arrangements) ? remoteSong.arrangements : [];

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
                arrangements = ?,
                updatedAt = ?
              WHERE remoteId = ?
            `, [
              remoteSong.title,
              remoteSong.originalLanguage || 'he',
              JSON.stringify(slides),
              JSON.stringify(tags),
              remoteSong.author || null,
              remoteSong.backgroundImage || '',
              JSON.stringify(arrangements),
              now,
              remoteSong._id
            ]);
            updated++;
          } else {
            // Insert new song
            const id = generateId();
            db.run(`
              INSERT INTO songs (id, title, originalLanguage, slides, tags, author, backgroundImage, arrangements, remoteId, createdAt, updatedAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              id,
              remoteSong.title,
              remoteSong.originalLanguage || 'he',
              JSON.stringify(slides),
              JSON.stringify(tags),
              remoteSong.author || null,
              remoteSong.backgroundImage || '',
              JSON.stringify(arrangements),
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

/**
 * Export all songs to JSON format
 */
export async function exportSongsToJSON(): Promise<string> {
  const songs = await getSongs();

  // Clean up the songs for export (remove internal fields)
  const exportData = songs.map(song => ({
    title: song.title,
    author: song.author,
    originalLanguage: song.originalLanguage,
    slides: typeof song.slides === 'string' ? JSON.parse(song.slides) : song.slides,
    tags: typeof song.tags === 'string' ? JSON.parse(song.tags) : song.tags,
    backgroundImage: song.backgroundImage,
    arrangements: typeof song.arrangements === 'string' ? JSON.parse(song.arrangements) : (song.arrangements || [])
  }));

  return JSON.stringify(exportData, null, 2);
}

/**
 * Import songs from JSON data
 */
export async function importSongsFromJSON(jsonData: string): Promise<{ imported: number; skipped: number; errors: number }> {
  const db = getDb();
  if (!db) throw new Error('Database not initialized');

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  try {
    const songs = JSON.parse(jsonData);

    if (!Array.isArray(songs)) {
      throw new Error('Invalid JSON format: expected an array of songs');
    }

    // Create backup before import
    createBackup('import_songs_json');

    // Use transaction for bulk import
    beginTransaction();
    try {
      for (const song of songs) {
        try {
          // Validate required fields
          if (!song.title || typeof song.title !== 'string' || !song.title.trim()) {
            console.warn('Skipping song with invalid title');
            errors++;
            continue;
          }

          // Check if song with same title already exists
          const existing = queryOne('SELECT id FROM songs WHERE title = ?', [song.title.trim()]);

          if (existing) {
            skipped++;
            continue;
          }

          // Validate and prepare data
          const slides = Array.isArray(song.slides) ? song.slides.slice(0, MAX_SLIDES_COUNT) : [];
          const validatedSlides = slides.map((slide: any) => ({
            originalText: slide.originalText ? String(slide.originalText).substring(0, MAX_SLIDE_TEXT_LENGTH) : '',
            transliteration: slide.transliteration ? String(slide.transliteration).substring(0, MAX_SLIDE_TEXT_LENGTH) : '',
            translation: slide.translation ? String(slide.translation).substring(0, MAX_SLIDE_TEXT_LENGTH) : '',
            translationOverflow: slide.translationOverflow ? String(slide.translationOverflow).substring(0, MAX_SLIDE_TEXT_LENGTH) : '',
            verseType: slide.verseType ? String(slide.verseType).substring(0, 50) : ''
          }));

          const tags = Array.isArray(song.tags) ? song.tags.filter((t: any) => typeof t === 'string').slice(0, 100) : [];
          const arrangements = Array.isArray(song.arrangements) ? song.arrangements : [];

          const id = generateId();
          const now = new Date().toISOString();

          db.run(`
            INSERT INTO songs (id, title, originalLanguage, slides, tags, author, backgroundImage, arrangements, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            id,
            song.title.trim().substring(0, MAX_TITLE_LENGTH),
            song.originalLanguage || 'he',
            JSON.stringify(validatedSlides),
            JSON.stringify(tags),
            song.author ? String(song.author).substring(0, MAX_AUTHOR_LENGTH) : null,
            song.backgroundImage ? String(song.backgroundImage).substring(0, MAX_BACKGROUND_LENGTH) : '',
            JSON.stringify(arrangements),
            now,
            now
          ]);
          imported++;
        } catch (err) {
          console.error('Error importing song:', song.title, err);
          errors++;
        }
      }
      commitTransaction();
      saveDatabase();
    } catch (transactionError) {
      rollbackTransaction();
      throw transactionError;
    }

    console.log(`JSON Import complete: ${imported} imported, ${skipped} skipped (duplicates), ${errors} errors`);
  } catch (err) {
    console.error('Failed to import songs from JSON:', err);
    throw new Error(`Failed to import songs: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }

  return { imported, skipped, errors };
}
