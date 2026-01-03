import { getDb, saveDatabase, generateId, queryAll, queryOne, CLASSIC_THEME_ID } from './index';

export interface ThemeData {
  name: string;
  lineOrder?: string[];
  lineStyles?: Record<string, any>;
  positioning?: Record<string, any>;
  container?: Record<string, any>;
  viewerBackground?: Record<string, any>;
  linePositions?: Record<string, any>;
  canvasDimensions?: { width: number; height: number };
  backgroundBoxes?: any[];
}

/**
 * Get all themes
 */
export async function getThemes(): Promise<any[]> {
  return queryAll('SELECT * FROM viewer_themes ORDER BY isBuiltIn DESC, name ASC');
}

/**
 * Get a single theme by ID
 */
export async function getTheme(id: string): Promise<any | null> {
  return queryOne('SELECT * FROM viewer_themes WHERE id = ?', [id]);
}

/**
 * Get the default theme
 */
export async function getDefaultTheme(): Promise<any | null> {
  const theme = queryOne('SELECT * FROM viewer_themes WHERE isDefault = 1');
  if (theme) return theme;

  // Fall back to classic theme
  return getTheme(CLASSIC_THEME_ID);
}

/**
 * Create a new theme
 */
export async function createTheme(data: ThemeData): Promise<any> {
  const db = getDb();
  if (!db) throw new Error('Database not initialized');

  const id = generateId();
  const now = new Date().toISOString();

  const defaultStyles = {
    original: { fontSize: 100, fontWeight: '500', color: '#FFFFFF', opacity: 1, visible: true },
    transliteration: { fontSize: 90, fontWeight: '400', color: '#FFFFFF', opacity: 0.95, visible: true },
    translation: { fontSize: 90, fontWeight: '400', color: '#FFFFFF', opacity: 0.95, visible: true }
  };

  db.run(`
    INSERT INTO viewer_themes (id, name, isBuiltIn, isDefault, lineOrder, lineStyles, positioning, container, viewerBackground, linePositions, canvasDimensions, backgroundBoxes, createdAt, updatedAt)
    VALUES (?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id,
    data.name,
    JSON.stringify(data.lineOrder || ['original', 'transliteration', 'translation']),
    JSON.stringify(data.lineStyles || defaultStyles),
    JSON.stringify(data.positioning || { vertical: 'center', horizontal: 'center' }),
    JSON.stringify(data.container || { maxWidth: '100%', padding: '2vh 6vw', backgroundColor: 'transparent', borderRadius: '0px' }),
    JSON.stringify(data.viewerBackground || { type: 'inherit', color: null }),
    data.linePositions ? JSON.stringify(data.linePositions) : null,
    JSON.stringify(data.canvasDimensions || { width: 1920, height: 1080 }),
    data.backgroundBoxes ? JSON.stringify(data.backgroundBoxes) : null,
    now,
    now
  ]);

  saveDatabase();
  return getTheme(id);
}

/**
 * Update an existing theme
 */
export async function updateTheme(id: string, data: Partial<ThemeData>): Promise<any | null> {
  const db = getDb();
  if (!db) return null;

  const existing = await getTheme(id);
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
  if (data.positioning !== undefined) {
    updates.push('positioning = ?');
    values.push(JSON.stringify(data.positioning));
  }
  if (data.container !== undefined) {
    updates.push('container = ?');
    values.push(JSON.stringify(data.container));
  }
  if (data.viewerBackground !== undefined) {
    updates.push('viewerBackground = ?');
    values.push(JSON.stringify(data.viewerBackground));
  }
  if (data.linePositions !== undefined) {
    updates.push('linePositions = ?');
    values.push(data.linePositions ? JSON.stringify(data.linePositions) : null);
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

  db.run(`UPDATE viewer_themes SET ${updates.join(', ')} WHERE id = ?`, values);
  saveDatabase();

  return getTheme(id);
}

/**
 * Delete a theme
 */
export async function deleteTheme(id: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  const existing = await getTheme(id);
  if (!existing) return false;

  // Don't allow deleting built-in themes
  if (existing.isBuiltIn) {
    throw new Error('Cannot delete built-in theme');
  }

  db.run(`DELETE FROM viewer_themes WHERE id = ?`, [id]);
  saveDatabase();
  return true;
}
