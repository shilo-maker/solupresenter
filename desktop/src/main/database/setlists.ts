import { getDb, saveDatabase, generateId, rowsToObjects } from './index';

export interface SetlistItem {
  id: string;
  type: 'song' | 'blank' | 'section' | 'countdown' | 'announcement' | 'messages' | 'media' | 'bible' | 'presentation';
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
  messagesItems?: string[];
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
}

export interface Setlist {
  id: string;
  name: string;
  venue?: string;
  items: SetlistItem[];
  createdAt: number;
  updatedAt: string;
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
  return {
    ...row,
    items: typeof row.items === 'string' ? JSON.parse(row.items) : (row.items || []),
    createdAt: typeof row.createdAt === 'string' ? new Date(row.createdAt).getTime() : row.createdAt
  };
}

/**
 * Get all setlists
 */
export async function getSetlists(): Promise<Setlist[]> {
  const db = getDb();
  if (!db) return [];

  const result = db.exec('SELECT * FROM setlists ORDER BY updatedAt DESC');
  const rows = rowsToObjects(result);
  return rows.map(row => parseSetlistRow(row)).filter(Boolean) as Setlist[];
}

/**
 * Get a single setlist by ID
 */
export async function getSetlist(id: string): Promise<Setlist | null> {
  const db = getDb();
  if (!db) return null;

  const result = db.exec(`SELECT * FROM setlists WHERE id = '${id.replace(/'/g, "''")}'`);
  const setlists = rowsToObjects(result);
  return setlists.length > 0 ? parseSetlistRow(setlists[0]) : null;
}

/**
 * Create a new setlist
 */
export async function createSetlist(data: SetlistData): Promise<Setlist | null> {
  const db = getDb();
  if (!db) throw new Error('Database not initialized');

  const id = generateId();
  const now = new Date().toISOString();
  const createdAt = Date.now();

  db.run(`
    INSERT INTO setlists (id, name, venue, items, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [
    id,
    data.name,
    data.venue || null,
    JSON.stringify(data.items || []),
    createdAt,
    now
  ]);

  saveDatabase();
  return getSetlist(id);
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

  if (data.name !== undefined) {
    updates.push('name = ?');
    values.push(data.name);
  }
  if (data.venue !== undefined) {
    updates.push('venue = ?');
    values.push(data.venue);
  }
  if (data.items !== undefined) {
    updates.push('items = ?');
    values.push(JSON.stringify(data.items));
  }

  updates.push('updatedAt = ?');
  values.push(new Date().toISOString());
  values.push(id);

  db.run(`UPDATE setlists SET ${updates.join(', ')} WHERE id = ?`, values);
  saveDatabase();

  return getSetlist(id);
}

/**
 * Delete a setlist
 */
export async function deleteSetlist(id: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  db.run(`DELETE FROM setlists WHERE id = ?`, [id]);
  saveDatabase();
  return true;
}
