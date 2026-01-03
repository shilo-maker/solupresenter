import { getDb, saveDatabase, generateId, queryAll, queryOne, beginTransaction, commitTransaction, rollbackTransaction } from './index';
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

/**
 * Create a new song
 */
export async function createSong(data: SongData): Promise<any> {
  const db = getDb();
  if (!db) throw new Error('Database not initialized');

  const id = generateId();
  const now = new Date().toISOString();

  db.run(`
    INSERT INTO songs (id, title, originalLanguage, slides, tags, author, backgroundImage, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id,
    data.title,
    data.originalLanguage || 'he',
    JSON.stringify(data.slides || []),
    JSON.stringify(data.tags || []),
    data.author || null,
    data.backgroundImage || '',
    now,
    now
  ]);

  saveDatabase();
  return getSong(id);
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

  if (data.title !== undefined) {
    updates.push('title = ?');
    values.push(data.title);
  }
  if (data.originalLanguage !== undefined) {
    updates.push('originalLanguage = ?');
    values.push(data.originalLanguage);
  }
  if (data.slides !== undefined) {
    updates.push('slides = ?');
    values.push(JSON.stringify(data.slides));
  }
  if (data.tags !== undefined) {
    updates.push('tags = ?');
    values.push(JSON.stringify(data.tags));
  }
  if (data.author !== undefined) {
    updates.push('author = ?');
    values.push(data.author);
  }
  if (data.backgroundImage !== undefined) {
    updates.push('backgroundImage = ?');
    values.push(data.backgroundImage);
  }

  updates.push('updatedAt = ?');
  values.push(new Date().toISOString());
  values.push(id);

  db.run(`UPDATE songs SET ${updates.join(', ')} WHERE id = ?`, values);
  saveDatabase();

  return getSong(id);
}

/**
 * Delete a song
 */
export async function deleteSong(id: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  db.run(`DELETE FROM songs WHERE id = ?`, [id]);
  saveDatabase();
  return true;
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
          // Check if song exists by remoteId
          const existing = queryAll('SELECT id FROM songs WHERE remoteId = ?', [remoteSong._id]);

          const now = new Date().toISOString();

          if (existing.length > 0) {
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
              JSON.stringify(remoteSong.slides || []),
              JSON.stringify(remoteSong.tags || []),
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
              JSON.stringify(remoteSong.slides || []),
              JSON.stringify(remoteSong.tags || []),
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
