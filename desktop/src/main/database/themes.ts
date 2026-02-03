import { getDb, saveDatabase, generateId, queryAll, queryOne, CLASSIC_THEME_ID, createBackup } from './index';

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

  // Prepare all values for return
  const lineOrder = data.lineOrder || ['original', 'transliteration', 'translation'];
  const lineStyles = data.lineStyles || defaultStyles;
  const positioning = data.positioning || { vertical: 'center', horizontal: 'center' };
  const container = data.container || { maxWidth: '100%', padding: '2vh 6vw', backgroundColor: 'transparent', borderRadius: '0px' };
  const viewerBackground = data.viewerBackground || { type: 'inherit', color: null };
  const linePositions = data.linePositions || null;
  const canvasDimensions = data.canvasDimensions || { width: 1920, height: 1080 };
  const backgroundBoxes = data.backgroundBoxes || null;

  db.run(`
    INSERT INTO viewer_themes (id, name, isBuiltIn, isDefault, lineOrder, lineStyles, positioning, container, viewerBackground, linePositions, canvasDimensions, backgroundBoxes, createdAt, updatedAt)
    VALUES (?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id,
    data.name,
    JSON.stringify(lineOrder),
    JSON.stringify(lineStyles),
    JSON.stringify(positioning),
    JSON.stringify(container),
    JSON.stringify(viewerBackground),
    linePositions ? JSON.stringify(linePositions) : null,
    JSON.stringify(canvasDimensions),
    backgroundBoxes ? JSON.stringify(backgroundBoxes) : null,
    now,
    now
  ]);

  saveDatabase();

  // Return the created object directly instead of re-querying
  return {
    id,
    name: data.name,
    isBuiltIn: 0,
    isDefault: 0,
    lineOrder,
    lineStyles,
    positioning,
    container,
    viewerBackground,
    linePositions,
    canvasDimensions,
    backgroundBoxes,
    createdAt: now,
    updatedAt: now
  };
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
  const now = new Date().toISOString();

  // Track updated values for return object
  const updatedTheme = { ...existing };

  if (data.name !== undefined) {
    updates.push('name = ?');
    values.push(data.name);
    updatedTheme.name = data.name;
  }
  if (data.lineOrder !== undefined) {
    updates.push('lineOrder = ?');
    values.push(JSON.stringify(data.lineOrder));
    updatedTheme.lineOrder = data.lineOrder;
  }
  if (data.lineStyles !== undefined) {
    updates.push('lineStyles = ?');
    values.push(JSON.stringify(data.lineStyles));
    updatedTheme.lineStyles = data.lineStyles;
  }
  if (data.positioning !== undefined) {
    updates.push('positioning = ?');
    values.push(JSON.stringify(data.positioning));
    updatedTheme.positioning = data.positioning;
  }
  if (data.container !== undefined) {
    updates.push('container = ?');
    values.push(JSON.stringify(data.container));
    updatedTheme.container = data.container;
  }
  if (data.viewerBackground !== undefined) {
    updates.push('viewerBackground = ?');
    values.push(JSON.stringify(data.viewerBackground));
    updatedTheme.viewerBackground = data.viewerBackground;
  }
  if (data.linePositions !== undefined) {
    updates.push('linePositions = ?');
    values.push(data.linePositions ? JSON.stringify(data.linePositions) : null);
    updatedTheme.linePositions = data.linePositions;
  }
  if (data.canvasDimensions !== undefined) {
    updates.push('canvasDimensions = ?');
    values.push(JSON.stringify(data.canvasDimensions));
    updatedTheme.canvasDimensions = data.canvasDimensions;
  }
  if (data.backgroundBoxes !== undefined) {
    updates.push('backgroundBoxes = ?');
    values.push(data.backgroundBoxes ? JSON.stringify(data.backgroundBoxes) : null);
    updatedTheme.backgroundBoxes = data.backgroundBoxes;
  }

  updates.push('updatedAt = ?');
  values.push(now);
  values.push(id);
  updatedTheme.updatedAt = now;

  db.run(`UPDATE viewer_themes SET ${updates.join(', ')} WHERE id = ?`, values);
  saveDatabase();

  // Return the updated object directly instead of re-querying
  return updatedTheme;
}

/**
 * Delete a theme
 */
export async function deleteTheme(id: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  // Validate input
  if (!id || typeof id !== 'string') return false;

  const existing = await getTheme(id);
  if (!existing) return false;

  // Don't allow deleting built-in themes
  if (existing.isBuiltIn) {
    throw new Error('Cannot delete built-in theme');
  }

  // Create backup before destructive operation
  createBackup('delete_theme');

  try {
    // Delete the viewer theme
    db.run(`DELETE FROM viewer_themes WHERE id = ?`, [id]);

    // Cascade cleanup: remove any display_theme_overrides that reference this theme
    db.run(`DELETE FROM display_theme_overrides WHERE themeId = ?`, [id]);

    saveDatabase();
    return true;
  } catch (error) {
    console.error('[themes] deleteTheme error:', error);
    throw new Error(`Failed to delete theme: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
