import { getDb, saveDatabase, generateId, queryAll, queryOne, createBackup, beginTransaction, commitTransaction, rollbackTransaction } from './index';

export interface SetlistItem {
  id: string;
  type: 'song' | 'blank' | 'section' | 'countdown' | 'announcement' | 'messages' | 'media' | 'bible' | 'presentation' | 'youtube' | 'clock' | 'stopwatch' | 'audioPlaylist';
  // Song data (full song object for offline use)
  song?: {
    id: string;
    title: string;
    hebrewTitle?: string;
    artist?: string;
    [key: string]: any;
  };
  // Section header
  title?: string;
  // Countdown tool
  countdownTime?: string;
  countdownMessage?: string;
  // Announcement tool
  announcementText?: string;
  // Rotating messages tool
  messages?: string[];
  messagesInterval?: number;
  // Media (video/image/audio)
  mediaType?: 'video' | 'image' | 'audio';
  mediaPath?: string;
  mediaDuration?: number | null;
  mediaName?: string;
  // Presentation data
  presentation?: {
    id: string;
    title: string;
    slides: any[];
    [key: string]: any;
  };
  // Bible data
  bibleData?: {
    book: string;
    chapter: number;
    verses?: any[];
  };
  displayMode?: 'bilingual' | 'original';
  // YouTube data
  youtubeVideoId?: string;
  youtubeTitle?: string;
  youtubeThumbnail?: string;
}

export interface Setlist {
  id: string;
  name: string;
  venue?: string;
  items: SetlistItem[];
  createdAt: string;  // ISO timestamp string
  updatedAt: string;  // ISO timestamp string
}

export interface SetlistData {
  name: string;
  venue?: string;
  items?: SetlistItem[];
}

/**
 * Parse setlist row - converts JSON strings to objects
 */
function parseSetlistRow(row: any): Setlist | null {
  if (!row) return null;

  // Safely parse items JSON
  let items: any[] = [];
  if (typeof row.items === 'string') {
    try {
      items = JSON.parse(row.items);
      if (!Array.isArray(items)) {
        items = [];
      }
    } catch (error) {
      console.error('Failed to parse setlist items JSON:', error);
      items = [];
    }
  } else {
    items = row.items || [];
  }

  // Safely parse createdAt date
  let createdAt: string;
  if (typeof row.createdAt === 'number') {
    const date = new Date(row.createdAt);
    createdAt = isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  } else if (typeof row.createdAt === 'string' && row.createdAt) {
    // Validate the string is a valid date
    const date = new Date(row.createdAt);
    createdAt = isNaN(date.getTime()) ? new Date().toISOString() : row.createdAt;
  } else {
    createdAt = new Date().toISOString();
  }

  return {
    ...row,
    items,
    createdAt
  };
}

/**
 * Get all setlists
 */
export async function getSetlists(): Promise<Setlist[]> {
  const rows = queryAll('SELECT * FROM setlists ORDER BY updatedAt DESC');
  return rows.map(row => parseSetlistRow(row)).filter(Boolean) as Setlist[];
}

/**
 * Get a single setlist by ID
 */
export async function getSetlist(id: string): Promise<Setlist | null> {
  const row = queryOne('SELECT * FROM setlists WHERE id = ?', [id]);
  return row ? parseSetlistRow(row) : null;
}

/**
 * Create a new setlist
 */
export async function createSetlist(data: SetlistData): Promise<Setlist | null> {
  const db = getDb();
  if (!db) throw new Error('Database not initialized');

  const id = generateId();
  const now = new Date().toISOString();
  const items = data.items || [];

  try {
    beginTransaction();

    db.run(`
      INSERT INTO setlists (id, name, venue, items, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      id,
      data.name,
      data.venue || null,
      JSON.stringify(items),
      now,  // Use ISO string for createdAt
      now
    ]);

    commitTransaction();
    saveDatabase();

    // Return the created object directly instead of re-querying
    return {
      id,
      name: data.name,
      venue: data.venue,
      items,
      createdAt: now,
      updatedAt: now
    };
  } catch (error) {
    rollbackTransaction();
    console.error('[setlists] createSetlist error:', error);
    throw error;
  }
}

/**
 * Update an existing setlist
 */
export async function updateSetlist(id: string, data: Partial<SetlistData>): Promise<Setlist | null> {
  const db = getDb();
  if (!db) return null;

  const existing = await getSetlist(id);
  if (!existing) return null;

  const updates: string[] = [];
  const values: any[] = [];
  const now = new Date().toISOString();

  // Track updated values for return object
  const updatedSetlist = { ...existing };

  if (data.name !== undefined) {
    updates.push('name = ?');
    values.push(data.name);
    updatedSetlist.name = data.name;
  }
  if (data.venue !== undefined) {
    updates.push('venue = ?');
    values.push(data.venue);
    updatedSetlist.venue = data.venue;
  }
  if (data.items !== undefined) {
    updates.push('items = ?');
    values.push(JSON.stringify(data.items));
    updatedSetlist.items = data.items;
  }

  updates.push('updatedAt = ?');
  values.push(now);
  values.push(id);
  updatedSetlist.updatedAt = now;

  try {
    beginTransaction();
    db.run(`UPDATE setlists SET ${updates.join(', ')} WHERE id = ?`, values);
    commitTransaction();
    saveDatabase();

    // Return the updated object directly instead of re-querying
    return updatedSetlist;
  } catch (error) {
    rollbackTransaction();
    console.error('[setlists] updateSetlist error:', error);
    return null;
  }
}

/**
 * Delete a setlist
 */
export async function deleteSetlist(id: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  // Validate input
  if (!id || typeof id !== 'string') return false;

  // Verify setlist exists before deleting
  const existing = await getSetlist(id);
  if (!existing) return false;

  // Create backup before destructive operation
  createBackup('delete_setlist');

  try {
    beginTransaction();
    db.run(`DELETE FROM setlists WHERE id = ?`, [id]);
    commitTransaction();
    saveDatabase();
    return true;
  } catch (error) {
    rollbackTransaction();
    console.error('[setlists] deleteSetlist error:', error);
    return false;
  }
}
