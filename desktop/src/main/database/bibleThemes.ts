import { getDb, saveDatabase, generateId, queryAll, queryOne, CLASSIC_BIBLE_THEME_ID, createBackup } from './index';

export interface BibleThemeData {
  name: string;
  lineOrder?: string[];
  lineStyles?: Record<string, any>;
  linePositions?: Record<string, any>;
  referenceStyle?: Record<string, any>;
  referencePosition?: Record<string, any>;
  referenceEnglishStyle?: Record<string, any>;
  referenceEnglishPosition?: Record<string, any>;
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

  // Hebrew reference (bottom-left by default)
  const defaultReferenceStyle = { fontSize: 50, fontWeight: '400', color: '#a0a0a0', opacity: 1, visible: true };
  const defaultReferencePosition = { x: 2, y: 44, width: 50, height: 5, alignH: 'left', alignV: 'center' };
  // English reference (bottom-right by default)
  const defaultReferenceEnglishStyle = { fontSize: 50, fontWeight: '400', color: '#a0a0a0', opacity: 1, visible: true };
  const defaultReferenceEnglishPosition = { x: 48, y: 94, width: 50, height: 5, alignH: 'right', alignV: 'center' };

  // Prepare values for return
  const lineOrder = data.lineOrder || ['hebrew', 'english'];
  const lineStyles = data.lineStyles || defaultStyles;
  const linePositions = data.linePositions || defaultPositions;
  const referenceStyle = data.referenceStyle || defaultReferenceStyle;
  const referencePosition = data.referencePosition || defaultReferencePosition;
  const referenceEnglishStyle = data.referenceEnglishStyle || defaultReferenceEnglishStyle;
  const referenceEnglishPosition = data.referenceEnglishPosition || defaultReferenceEnglishPosition;
  const container = data.container || { maxWidth: '100%', padding: '2vh 6vw', backgroundColor: 'transparent', borderRadius: '0px' };
  const viewerBackground = data.viewerBackground || { type: 'color', color: '#000000' };
  const canvasDimensions = data.canvasDimensions || { width: 1920, height: 1080 };
  const backgroundBoxes = data.backgroundBoxes || null;

  db.run(`
    INSERT INTO bible_themes (id, name, isBuiltIn, isDefault, lineOrder, lineStyles, linePositions, referenceStyle, referencePosition, referenceEnglishStyle, referenceEnglishPosition, container, viewerBackground, canvasDimensions, backgroundBoxes, createdAt, updatedAt)
    VALUES (?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id,
    data.name,
    JSON.stringify(lineOrder),
    JSON.stringify(lineStyles),
    JSON.stringify(linePositions),
    JSON.stringify(referenceStyle),
    JSON.stringify(referencePosition),
    JSON.stringify(referenceEnglishStyle),
    JSON.stringify(referenceEnglishPosition),
    JSON.stringify(container),
    JSON.stringify(viewerBackground),
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
    linePositions,
    referenceStyle,
    referencePosition,
    referenceEnglishStyle,
    referenceEnglishPosition,
    container,
    viewerBackground,
    canvasDimensions,
    backgroundBoxes,
    createdAt: now,
    updatedAt: now
  };
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
  if (data.linePositions !== undefined) {
    updates.push('linePositions = ?');
    values.push(data.linePositions ? JSON.stringify(data.linePositions) : null);
    updatedTheme.linePositions = data.linePositions;
  }
  if (data.referenceStyle !== undefined) {
    updates.push('referenceStyle = ?');
    values.push(JSON.stringify(data.referenceStyle));
    updatedTheme.referenceStyle = data.referenceStyle;
  }
  if (data.referencePosition !== undefined) {
    updates.push('referencePosition = ?');
    values.push(data.referencePosition ? JSON.stringify(data.referencePosition) : null);
    updatedTheme.referencePosition = data.referencePosition;
  }
  if (data.referenceEnglishStyle !== undefined) {
    updates.push('referenceEnglishStyle = ?');
    values.push(JSON.stringify(data.referenceEnglishStyle));
    updatedTheme.referenceEnglishStyle = data.referenceEnglishStyle;
  }
  if (data.referenceEnglishPosition !== undefined) {
    updates.push('referenceEnglishPosition = ?');
    values.push(data.referenceEnglishPosition ? JSON.stringify(data.referenceEnglishPosition) : null);
    updatedTheme.referenceEnglishPosition = data.referenceEnglishPosition;
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

  db.run(`UPDATE bible_themes SET ${updates.join(', ')} WHERE id = ?`, values);
  saveDatabase();

  // Return the updated object directly instead of re-querying
  return updatedTheme;
}

/**
 * Delete a Bible theme
 */
export async function deleteBibleTheme(id: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  // Validate input
  if (!id || typeof id !== 'string') return false;

  const existing = await getBibleTheme(id);
  if (!existing) return false;

  // Don't allow deleting built-in themes
  if (existing.isBuiltIn) {
    throw new Error('Cannot delete built-in theme');
  }

  // Create backup before destructive operation
  createBackup('delete_bible_theme');

  try {
    db.run(`DELETE FROM bible_themes WHERE id = ?`, [id]);
    saveDatabase();
    return true;
  } catch (error) {
    console.error('[bibleThemes] deleteBibleTheme error:', error);
    throw new Error(`Failed to delete Bible theme: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
