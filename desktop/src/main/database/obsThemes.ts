import { getDb, saveDatabase, generateId, queryAll, queryOne, CLASSIC_OBS_SONGS_THEME_ID, CLASSIC_OBS_BIBLE_THEME_ID } from './index';

export type OBSThemeType = 'songs' | 'bible';

export interface OBSThemeData {
  name: string;
  type: OBSThemeType;
  lineOrder?: string[];
  lineStyles?: Record<string, any>;
  linePositions?: Record<string, any>;
  referenceStyle?: Record<string, any>;
  referencePosition?: Record<string, any>;
  viewerBackground?: Record<string, any>;
  canvasDimensions?: { width: number; height: number };
  backgroundBoxes?: any[];
}

/**
 * Get all OBS themes, optionally filtered by type
 */
export async function getOBSThemes(type?: OBSThemeType): Promise<any[]> {
  if (type) {
    return queryAll('SELECT * FROM obs_themes WHERE type = ? ORDER BY isBuiltIn DESC, name ASC', [type]);
  }
  return queryAll('SELECT * FROM obs_themes ORDER BY type ASC, isBuiltIn DESC, name ASC');
}

/**
 * Get a single OBS theme by ID
 */
export async function getOBSTheme(id: string): Promise<any | null> {
  return queryOne('SELECT * FROM obs_themes WHERE id = ?', [id]);
}

/**
 * Get the default OBS theme for a specific type
 */
export async function getDefaultOBSTheme(type: OBSThemeType): Promise<any | null> {
  const theme = queryOne('SELECT * FROM obs_themes WHERE type = ? AND isDefault = 1', [type]);
  if (theme) return theme;

  // Fall back to classic OBS theme based on type
  const fallbackId = type === 'songs' ? CLASSIC_OBS_SONGS_THEME_ID : CLASSIC_OBS_BIBLE_THEME_ID;
  return getOBSTheme(fallbackId);
}

/**
 * Create a new OBS theme
 */
export async function createOBSTheme(data: OBSThemeData): Promise<any> {
  const db = getDb();
  if (!db) throw new Error('Database not initialized');

  const id = generateId();
  const now = new Date().toISOString();

  // Default styles based on type
  const isSongs = data.type === 'songs';

  const defaultSongsStyles = {
    original: { fontSize: 120, fontWeight: '700', color: '#ffffff', opacity: 1, visible: true },
    transliteration: { fontSize: 90, fontWeight: '400', color: '#e0e0e0', opacity: 0.9, visible: true },
    translation: { fontSize: 100, fontWeight: '400', color: '#b0b0b0', opacity: 0.85, visible: true }
  };

  const defaultBibleStyles = {
    hebrew: { fontSize: 100, fontWeight: '700', color: '#ffffff', opacity: 1, visible: true },
    english: { fontSize: 80, fontWeight: '400', color: '#e0e0e0', opacity: 0.9, visible: true }
  };

  const defaultSongsPositions = {
    original: { x: 0, y: 70, width: 100, height: 10, paddingTop: 1, paddingBottom: 1, alignH: 'center', alignV: 'center' },
    transliteration: { x: 0, y: 80, width: 100, height: 8, paddingTop: 1, paddingBottom: 1, alignH: 'center', alignV: 'center' },
    translation: { x: 0, y: 88, width: 100, height: 10, paddingTop: 1, paddingBottom: 1, alignH: 'center', alignV: 'center' }
  };

  const defaultBiblePositions = {
    hebrew: { x: 0, y: 72, width: 100, height: 10, paddingTop: 1, paddingBottom: 1, alignH: 'center', alignV: 'center' },
    english: { x: 0, y: 82, width: 100, height: 10, paddingTop: 1, paddingBottom: 1, alignH: 'center', alignV: 'center' }
  };

  const defaultLineOrder = isSongs
    ? ['original', 'transliteration', 'translation']
    : ['hebrew', 'english'];

  const defaultStyles = isSongs ? defaultSongsStyles : defaultBibleStyles;
  const defaultPositions = isSongs ? defaultSongsPositions : defaultBiblePositions;

  // Reference fields only for bible type
  const referenceStyle = !isSongs
    ? JSON.stringify(data.referenceStyle || { fontSize: 60, fontWeight: '500', color: '#FF8C42', opacity: 0.9 })
    : null;
  const referencePosition = !isSongs
    ? JSON.stringify(data.referencePosition || { x: 0, y: 92, width: 100, height: 6, alignH: 'center', alignV: 'center' })
    : null;

  db.run(`
    INSERT INTO obs_themes (id, name, type, isBuiltIn, isDefault, lineOrder, lineStyles, linePositions, referenceStyle, referencePosition, viewerBackground, canvasDimensions, backgroundBoxes, createdAt, updatedAt)
    VALUES (?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id,
    data.name,
    data.type,
    JSON.stringify(data.lineOrder || defaultLineOrder),
    JSON.stringify(data.lineStyles || defaultStyles),
    JSON.stringify(data.linePositions || defaultPositions),
    referenceStyle,
    referencePosition,
    JSON.stringify(data.viewerBackground || { type: 'transparent', color: null }),
    JSON.stringify(data.canvasDimensions || { width: 1920, height: 1080 }),
    data.backgroundBoxes ? JSON.stringify(data.backgroundBoxes) : JSON.stringify([{ x: 0, y: 68, width: 100, height: 32, color: '#000000', opacity: 0.7, borderRadius: 0 }]),
    now,
    now
  ]);

  saveDatabase();
  return getOBSTheme(id);
}

/**
 * Update an existing OBS theme
 */
export async function updateOBSTheme(id: string, data: Partial<OBSThemeData>): Promise<any | null> {
  const db = getDb();
  if (!db) return null;

  const existing = await getOBSTheme(id);
  if (!existing) return null;

  // Don't allow modifying built-in themes
  if (existing.isBuiltIn) {
    throw new Error('Cannot modify built-in theme');
  }

  const updates: string[] = [];
  const values: any[] = [];

  if (data.name !== undefined) {
    updates.push('name = ?');
    values.push(data.name);
  }
  // Note: type should not be changed after creation
  if (data.lineOrder !== undefined) {
    updates.push('lineOrder = ?');
    values.push(JSON.stringify(data.lineOrder));
  }
  if (data.lineStyles !== undefined) {
    updates.push('lineStyles = ?');
    values.push(JSON.stringify(data.lineStyles));
  }
  if (data.linePositions !== undefined) {
    updates.push('linePositions = ?');
    values.push(data.linePositions ? JSON.stringify(data.linePositions) : null);
  }
  if (data.referenceStyle !== undefined) {
    updates.push('referenceStyle = ?');
    values.push(data.referenceStyle ? JSON.stringify(data.referenceStyle) : null);
  }
  if (data.referencePosition !== undefined) {
    updates.push('referencePosition = ?');
    values.push(data.referencePosition ? JSON.stringify(data.referencePosition) : null);
  }
  if (data.viewerBackground !== undefined) {
    updates.push('viewerBackground = ?');
    values.push(JSON.stringify(data.viewerBackground));
  }
  if (data.canvasDimensions !== undefined) {
    updates.push('canvasDimensions = ?');
    values.push(JSON.stringify(data.canvasDimensions));
  }
  if (data.backgroundBoxes !== undefined) {
    updates.push('backgroundBoxes = ?');
    values.push(data.backgroundBoxes ? JSON.stringify(data.backgroundBoxes) : null);
  }

  updates.push('updatedAt = ?');
  values.push(new Date().toISOString());
  values.push(id);

  db.run(`UPDATE obs_themes SET ${updates.join(', ')} WHERE id = ?`, values);
  saveDatabase();

  return getOBSTheme(id);
}

/**
 * Delete an OBS theme
 */
export async function deleteOBSTheme(id: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  const existing = await getOBSTheme(id);
  if (!existing) return false;

  // Don't allow deleting built-in themes
  if (existing.isBuiltIn) {
    throw new Error('Cannot delete built-in theme');
  }

  db.run(`DELETE FROM obs_themes WHERE id = ?`, [id]);
  saveDatabase();
  return true;
}
