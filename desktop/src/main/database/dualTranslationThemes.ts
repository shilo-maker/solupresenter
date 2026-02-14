import { getDb, saveDatabase, generateId, queryAll, queryOne, createBackup, CLASSIC_DUAL_TRANSLATION_THEME_ID } from './index';

export { CLASSIC_DUAL_TRANSLATION_THEME_ID };

export interface DualTranslationThemeData {
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
 * Get all dual translation themes
 */
export async function getDualTranslationThemes(): Promise<any[]> {
  return queryAll('SELECT * FROM dual_translation_themes ORDER BY isBuiltIn DESC, name ASC');
}

/**
 * Get a single dual translation theme by ID
 */
export async function getDualTranslationTheme(id: string): Promise<any | null> {
  return queryOne('SELECT * FROM dual_translation_themes WHERE id = ?', [id]);
}

/**
 * Get the default dual translation theme
 */
export async function getDefaultDualTranslationTheme(): Promise<any | null> {
  const theme = queryOne('SELECT * FROM dual_translation_themes WHERE isDefault = 1');
  if (theme) return theme;

  // Fall back to classic dual translation theme
  return getDualTranslationTheme(CLASSIC_DUAL_TRANSLATION_THEME_ID);
}

/**
 * Create a new dual translation theme
 */
export async function createDualTranslationTheme(data: DualTranslationThemeData): Promise<any> {
  const db = getDb();
  if (!db) throw new Error('Database not initialized');

  const id = generateId();
  const now = new Date().toISOString();

  const defaultStyles = {
    original: { fontSize: 195, fontWeight: '700', color: '#ffffff', opacity: 1, visible: true },
    transliteration: { fontSize: 150, fontWeight: '400', color: '#ffffff', opacity: 0.9, visible: true },
    translation: { fontSize: 160, fontWeight: '400', color: '#cfcfcf', opacity: 0.85, visible: true },
    translationB: { fontSize: 160, fontWeight: '400', color: '#a0c8e0', opacity: 0.85, visible: true }
  };

  const lineOrder = data.lineOrder || ['original', 'transliteration', 'translation', 'translationB'];
  const lineStyles = data.lineStyles || defaultStyles;
  const positioning = data.positioning || { vertical: 'center', horizontal: 'center' };
  const container = data.container || { maxWidth: '100%', padding: '2vh 6vw', backgroundColor: 'transparent', borderRadius: '0px' };
  const viewerBackground = data.viewerBackground || { type: 'inherit', color: null };
  const linePositions = data.linePositions || null;
  const canvasDimensions = data.canvasDimensions || { width: 1920, height: 1080 };
  const backgroundBoxes = data.backgroundBoxes || null;

  db.run(`
    INSERT INTO dual_translation_themes (id, name, isBuiltIn, isDefault, lineOrder, lineStyles, positioning, container, viewerBackground, linePositions, canvasDimensions, backgroundBoxes, createdAt, updatedAt)
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
 * Update an existing dual translation theme
 */
export async function updateDualTranslationTheme(id: string, data: Partial<DualTranslationThemeData>): Promise<any | null> {
  const db = getDb();
  if (!db) return null;

  const existing = await getDualTranslationTheme(id);
  if (!existing) return null;

  if (existing.isBuiltIn) {
    throw new Error('Cannot modify built-in theme');
  }

  const updates: string[] = [];
  const values: any[] = [];
  const now = new Date().toISOString();

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

  db.run(`UPDATE dual_translation_themes SET ${updates.join(', ')} WHERE id = ?`, values);
  saveDatabase();

  return updatedTheme;
}

/**
 * Delete a dual translation theme
 */
export async function deleteDualTranslationTheme(id: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  if (!id || typeof id !== 'string') return false;

  const existing = await getDualTranslationTheme(id);
  if (!existing) return false;

  if (existing.isBuiltIn) {
    throw new Error('Cannot delete built-in theme');
  }

  createBackup('delete_dual_translation_theme');

  try {
    db.run(`DELETE FROM dual_translation_themes WHERE id = ?`, [id]);
    db.run(`DELETE FROM display_theme_overrides WHERE themeId = ?`, [id]);
    saveDatabase();
    return true;
  } catch (error) {
    console.error('[dualTranslationThemes] deleteDualTranslationTheme error:', error);
    throw new Error(`Failed to delete dual translation theme: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
