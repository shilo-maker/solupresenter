import { getDb, saveDatabase, generateId, queryAll, queryOne, CLASSIC_BIBLE_THEME_ID } from './index';

export interface BibleThemeData {
  name: string;
  lineOrder?: string[];
  lineStyles?: Record<string, any>;
  linePositions?: Record<string, any>;
  referenceStyle?: Record<string, any>;
  referencePosition?: Record<string, any>;
  container?: Record<string, any>;
  viewerBackground?: Record<string, any>;
  canvasDimensions?: { width: number; height: number };
  backgroundBoxes?: any[];
}

/**
 * Get all Bible themes
 */
export async function getBibleThemes(): Promise<any[]> {
  return queryAll('SELECT * FROM bible_themes ORDER BY isBuiltIn DESC, name ASC');
}

/**
 * Get a single Bible theme by ID
 */
export async function getBibleTheme(id: string): Promise<any | null> {
  return queryOne('SELECT * FROM bible_themes WHERE id = ?', [id]);
}

/**
 * Get the default Bible theme
 */
export async function getDefaultBibleTheme(): Promise<any | null> {
  const theme = queryOne('SELECT * FROM bible_themes WHERE isDefault = 1');
  if (theme) return theme;

  // Fall back to classic bible theme
  return getBibleTheme(CLASSIC_BIBLE_THEME_ID);
}

/**
 * Create a new Bible theme
 */
export async function createBibleTheme(data: BibleThemeData): Promise<any> {
  const db = getDb();
  if (!db) throw new Error('Database not initialized');

  const id = generateId();
  const now = new Date().toISOString();

  const defaultStyles = {
    hebrew: { fontSize: 160, fontWeight: '700', color: '#ffffff', opacity: 1, visible: true },
    english: { fontSize: 120, fontWeight: '400', color: '#e0e0e0', opacity: 0.9, visible: true }
  };

  const defaultPositions = {
    hebrew: { x: 0, y: 25, width: 100, height: 20, paddingTop: 2, paddingBottom: 2, alignH: 'center', alignV: 'center' },
    english: { x: 0, y: 45, width: 100, height: 20, paddingTop: 1, paddingBottom: 1, alignH: 'center', alignV: 'center' }
  };

  const defaultReferenceStyle = { fontSize: 80, fontWeight: '500', color: '#FF8C42', opacity: 0.9 };
  const defaultReferencePosition = { x: 0, y: 70, width: 100, height: 10, alignH: 'center', alignV: 'center' };

  db.run(`
    INSERT INTO bible_themes (id, name, isBuiltIn, isDefault, lineOrder, lineStyles, linePositions, referenceStyle, referencePosition, container, viewerBackground, canvasDimensions, backgroundBoxes, createdAt, updatedAt)
    VALUES (?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id,
    data.name,
    JSON.stringify(data.lineOrder || ['hebrew', 'english']),
    JSON.stringify(data.lineStyles || defaultStyles),
    JSON.stringify(data.linePositions || defaultPositions),
    JSON.stringify(data.referenceStyle || defaultReferenceStyle),
    JSON.stringify(data.referencePosition || defaultReferencePosition),
    JSON.stringify(data.container || { maxWidth: '100%', padding: '2vh 6vw', backgroundColor: 'transparent', borderRadius: '0px' }),
    JSON.stringify(data.viewerBackground || { type: 'color', color: '#000000' }),
    JSON.stringify(data.canvasDimensions || { width: 1920, height: 1080 }),
    data.backgroundBoxes ? JSON.stringify(data.backgroundBoxes) : null,
    now,
    now
  ]);

  saveDatabase();
  return getBibleTheme(id);
}

/**
 * Update an existing Bible theme
 */
export async function updateBibleTheme(id: string, data: Partial<BibleThemeData>): Promise<any | null> {
  const db = getDb();
  if (!db) return null;

  const existing = await getBibleTheme(id);
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
    values.push(JSON.stringify(data.referenceStyle));
  }
  if (data.referencePosition !== undefined) {
    updates.push('referencePosition = ?');
    values.push(data.referencePosition ? JSON.stringify(data.referencePosition) : null);
  }
  if (data.container !== undefined) {
    updates.push('container = ?');
    values.push(JSON.stringify(data.container));
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

  db.run(`UPDATE bible_themes SET ${updates.join(', ')} WHERE id = ?`, values);
  saveDatabase();

  return getBibleTheme(id);
}

/**
 * Delete a Bible theme
 */
export async function deleteBibleTheme(id: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  const existing = await getBibleTheme(id);
  if (!existing) return false;

  // Don't allow deleting built-in themes
  if (existing.isBuiltIn) {
    throw new Error('Cannot delete built-in theme');
  }

  db.run(`DELETE FROM bible_themes WHERE id = ?`, [id]);
  saveDatabase();
  return true;
}
