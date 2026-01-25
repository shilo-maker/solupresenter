import { getDb, saveDatabase, generateId, queryAll, queryOne } from './index';

export interface AudioPlaylistTrack {
  path: string;
  name: string;
  duration?: number | null;
}

export interface AudioPlaylist {
  id: string;
  name: string;
  tracks: AudioPlaylistTrack[];
  shuffle: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AudioPlaylistData {
  name: string;
  tracks: AudioPlaylistTrack[];
  shuffle?: boolean;
}

// Constants for input validation
const MAX_NAME_LENGTH = 255;
const MAX_TRACKS_COUNT = 500;
const MAX_PATH_LENGTH = 2000;

/**
 * Get all audio playlists
 */
export async function getAudioPlaylists(): Promise<AudioPlaylist[]> {
  const results = queryAll('SELECT * FROM audio_playlists ORDER BY updatedAt DESC');
  return results.map(row => ({
    ...row,
    shuffle: row.shuffle === 1
  }));
}

/**
 * Get a single audio playlist by ID
 */
export async function getAudioPlaylist(id: string): Promise<AudioPlaylist | null> {
  const result = queryOne('SELECT * FROM audio_playlists WHERE id = ?', [id]);
  if (!result) return null;
  return {
    ...result,
    shuffle: result.shuffle === 1
  };
}

/**
 * Create a new audio playlist
 */
export async function createAudioPlaylist(data: AudioPlaylistData): Promise<AudioPlaylist> {
  const db = getDb();
  if (!db) throw new Error('Database not initialized');

  // Validate required fields
  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
    throw new Error('Playlist name is required and must be a non-empty string');
  }

  // Enforce length limits
  const name = data.name.trim().substring(0, MAX_NAME_LENGTH);

  // Validate and limit tracks
  let tracks = Array.isArray(data.tracks) ? data.tracks.slice(0, MAX_TRACKS_COUNT) : [];
  tracks = tracks.map(track => ({
    path: track.path ? String(track.path).substring(0, MAX_PATH_LENGTH) : '',
    name: track.name ? String(track.name).substring(0, MAX_NAME_LENGTH) : '',
    duration: typeof track.duration === 'number' ? track.duration : null
  }));

  const id = generateId();
  const now = new Date().toISOString();
  const shuffle = data.shuffle ? 1 : 0;

  try {
    db.run(`
      INSERT INTO audio_playlists (id, name, tracks, shuffle, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      id,
      name,
      JSON.stringify(tracks),
      shuffle,
      now,
      now
    ]);

    saveDatabase();
  } catch (error) {
    console.error('Failed to create audio playlist:', error);
    throw new Error(`Failed to create audio playlist: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return {
    id,
    name,
    tracks,
    shuffle: data.shuffle || false,
    createdAt: now,
    updatedAt: now
  };
}

/**
 * Update an existing audio playlist
 */
export async function updateAudioPlaylist(id: string, data: Partial<AudioPlaylistData>): Promise<AudioPlaylist | null> {
  const db = getDb();
  if (!db) return null;

  const existing = await getAudioPlaylist(id);
  if (!existing) return null;

  const updates: string[] = [];
  const values: any[] = [];
  const now = new Date().toISOString();

  // Track updated values for return object
  const updatedPlaylist = { ...existing };

  if (data.name !== undefined) {
    if (typeof data.name !== 'string' || !data.name.trim()) {
      throw new Error('Playlist name must be a non-empty string');
    }
    updates.push('name = ?');
    values.push(data.name.trim().substring(0, MAX_NAME_LENGTH));
    updatedPlaylist.name = data.name.trim().substring(0, MAX_NAME_LENGTH);
  }

  if (data.tracks !== undefined) {
    let tracks = Array.isArray(data.tracks) ? data.tracks.slice(0, MAX_TRACKS_COUNT) : [];
    tracks = tracks.map(track => ({
      path: track.path ? String(track.path).substring(0, MAX_PATH_LENGTH) : '',
      name: track.name ? String(track.name).substring(0, MAX_NAME_LENGTH) : '',
      duration: typeof track.duration === 'number' ? track.duration : null
    }));
    updates.push('tracks = ?');
    values.push(JSON.stringify(tracks));
    updatedPlaylist.tracks = tracks;
  }

  if (data.shuffle !== undefined) {
    updates.push('shuffle = ?');
    values.push(data.shuffle ? 1 : 0);
    updatedPlaylist.shuffle = data.shuffle;
  }

  updates.push('updatedAt = ?');
  values.push(now);
  values.push(id);
  updatedPlaylist.updatedAt = now;

  try {
    db.run(`UPDATE audio_playlists SET ${updates.join(', ')} WHERE id = ?`, values);
    saveDatabase();
  } catch (error) {
    console.error('Failed to update audio playlist:', error);
    throw new Error(`Failed to update audio playlist: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return updatedPlaylist;
}

/**
 * Delete an audio playlist
 */
export async function deleteAudioPlaylist(id: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  // Validate input
  if (!id || typeof id !== 'string') return false;

  try {
    db.run('DELETE FROM audio_playlists WHERE id = ?', [id]);
    saveDatabase();
    return true;
  } catch (error) {
    console.error('Failed to delete audio playlist:', error);
    return false;
  }
}
