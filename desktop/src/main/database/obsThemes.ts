import { getDb, saveDatabase, generateId, queryAll, queryOne, CLASSIC_OBS_SONGS_THEME_ID, CLASSIC_OBS_BIBLE_THEME_ID, CLASSIC_OBS_PRAYER_THEME_ID, createBackup } from './index';

export type OBSThemeType = 'songs' | 'bible' | 'prayer';

export interface OBSThemeData {
  name: string;
  type: OBSThemeType;
  lineOrder?: string[];
  lineStyles?: Record<string, any>;
  linePositions?: Record<string, any>;
  referenceStyle?: Record<string, any>;
  referencePosition?: Record<string, any>;
  referenceEnglishStyle?: Record<string, any>;
  referenceEnglishPosition?: Record<string, any>;
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
  let fallbackId: string;
  if (type === 'songs') {
    fallbackId = CLASSIC_OBS_SONGS_THEME_ID;
  } else if (type === 'bible') {
    fallbackId = CLASSIC_OBS_BIBLE_THEME_ID;
  } else {
    fallbackId = CLASSIC_OBS_PRAYER_THEME_ID;
  }
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
  const isBible = data.type === 'bible';
  const isPrayer = data.type === 'prayer';

  const defaultSongsStyles = {
    original: { fontSize: 120, fontWeight: '700', color: '#ffffff', opacity: 1, visible: true },
    transliteration: { fontSize: 90, fontWeight: '400', color: '#e0e0e0', opacity: 0.9, visible: true },
    translation: { fontSize: 100, fontWeight: '400', color: '#b0b0b0', opacity: 0.85, visible: true }
  };

  const defaultBibleStyles = {
    hebrew: { fontSize: 100, fontWeight: '700', color: '#ffffff', opacity: 1, visible: true },
    english: { fontSize: 80, fontWeight: '400', color: '#e0e0e0', opacity: 0.9, visible: true }
  };

  // OBS Prayer styles - matches NewClassicPrayer structure
  const defaultPrayerStyles = {
    title: { fontSize: 130, fontWeight: '700', color: '#FF8C42', opacity: 1, visible: true },
    titleTranslation: { fontSize: 129, fontWeight: '700', color: '#FF8C42', opacity: 0.9, visible: true },
    subtitle: { fontSize: 94, fontWeight: '700', color: '#ffffff', opacity: 1, visible: true },
    subtitleTranslation: { fontSize: 94, fontWeight: '700', color: '#e0e0e0', opacity: 0.9, visible: true },
    description: { fontSize: 90, fontWeight: '400', color: '#e0e0e0', opacity: 0.9, visible: true },
    descriptionTranslation: { fontSize: 90, fontWeight: '400', color: '#b0b0b0', opacity: 0.85, visible: true },
    reference: { fontSize: 56, fontWeight: '500', color: '#ffffff', opacity: 0.8, visible: true },
    referenceTranslation: { fontSize: 60, fontWeight: '400', color: '#ffffff', opacity: 0.7, visible: true }
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

  // OBS Prayer positions - lower-third layout for OBS overlay
  const defaultPrayerPositions = {
    title: { x: 0, y: 58, width: 100, height: 6, paddingTop: 1, paddingBottom: 1, alignH: 'center', alignV: 'center' },
    titleTranslation: { x: 0, y: 64, width: 100, height: 6, paddingTop: 1, paddingBottom: 1, alignH: 'center', alignV: 'center' },
    subtitle: { x: 0, y: 70, width: 100, height: 6, paddingTop: 1, paddingBottom: 1, alignH: 'center', alignV: 'center' },
    subtitleTranslation: { x: 0, y: 76, width: 100, height: 6, paddingTop: 1, paddingBottom: 1, alignH: 'center', alignV: 'center' },
    description: { x: 0, y: 82, width: 100, height: 5, paddingTop: 1, paddingBottom: 1, alignH: 'center', alignV: 'center' },
    descriptionTranslation: { x: 0, y: 87, width: 100, height: 5, paddingTop: 1, paddingBottom: 1, alignH: 'center', alignV: 'center' },
    reference: { x: 0, y: 92, width: 100, height: 4, paddingTop: 0, paddingBottom: 0, alignH: 'center', alignV: 'center' },
    referenceTranslation: { x: 0, y: 96, width: 100, height: 4, paddingTop: 0, paddingBottom: 0, alignH: 'center', alignV: 'center' }
  };

  let defaultLineOrder: string[];
  let defaultStyles: Record<string, any>;
  let defaultPositions: Record<string, any>;

  if (isSongs) {
    defaultLineOrder = ['original', 'transliteration', 'translation'];
    defaultStyles = defaultSongsStyles;
    defaultPositions = defaultSongsPositions;
  } else if (isBible) {
    defaultLineOrder = ['hebrew', 'english'];
    defaultStyles = defaultBibleStyles;
    defaultPositions = defaultBiblePositions;
  } else {
    // Prayer
    defaultLineOrder = ['title', 'titleTranslation', 'subtitle', 'subtitleTranslation', 'description', 'descriptionTranslation', 'reference', 'referenceTranslation'];
    defaultStyles = defaultPrayerStyles;
    defaultPositions = defaultPrayerPositions;
  }

  // Reference fields only for bible type (prayer has reference in lineStyles)
  const referenceStyleObj = isBible
    ? (data.referenceStyle || { fontSize: 60, fontWeight: '500', color: '#FF8C42', opacity: 0.9 })
    : null;
  const referencePositionObj = isBible
    ? (data.referencePosition || { x: 0, y: 92, width: 100, height: 6, alignH: 'center', alignV: 'center' })
    : null;
  const referenceEnglishStyleObj = isBible
    ? (data.referenceEnglishStyle || { fontSize: 50, fontWeight: '400', color: '#a0a0a0', opacity: 1, visible: true })
    : null;
  const referenceEnglishPositionObj = isBible
    ? (data.referenceEnglishPosition || { x: 48, y: 90, width: 50, height: 8, alignH: 'right', alignV: 'center' })
    : null;

  // Prepare values for return
  const lineOrder = data.lineOrder || defaultLineOrder;
  const lineStyles = data.lineStyles || defaultStyles;
  const linePositions = data.linePositions || defaultPositions;
  const viewerBackground = data.viewerBackground || { type: 'transparent', color: null };
  const canvasDimensions = data.canvasDimensions || { width: 1920, height: 1080 };
  // Background box default - adjusted for prayer themes starting at y: 56
  const defaultBgBox = isPrayer
    ? [{ x: 0, y: 56, width: 100, height: 44, color: '#000000', opacity: 0.7, borderRadius: 0 }]
    : [{ x: 0, y: 68, width: 100, height: 32, color: '#000000', opacity: 0.7, borderRadius: 0 }];
  const backgroundBoxes = data.backgroundBoxes || defaultBgBox;

  db.run(`
    INSERT INTO obs_themes (id, name, type, isBuiltIn, isDefault, lineOrder, lineStyles, linePositions, referenceStyle, referencePosition, referenceEnglishStyle, referenceEnglishPosition, viewerBackground, canvasDimensions, backgroundBoxes, createdAt, updatedAt)
    VALUES (?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id,
    data.name,
    data.type,
    JSON.stringify(lineOrder),
    JSON.stringify(lineStyles),
    JSON.stringify(linePositions),
    referenceStyleObj ? JSON.stringify(referenceStyleObj) : null,
    referencePositionObj ? JSON.stringify(referencePositionObj) : null,
    referenceEnglishStyleObj ? JSON.stringify(referenceEnglishStyleObj) : null,
    referenceEnglishPositionObj ? JSON.stringify(referenceEnglishPositionObj) : null,
    JSON.stringify(viewerBackground),
    JSON.stringify(canvasDimensions),
    JSON.stringify(backgroundBoxes),
    now,
    now
  ]);

  saveDatabase();

  // Return the created object directly instead of re-querying
  return {
    id,
    name: data.name,
    type: data.type,
    isBuiltIn: 0,
    isDefault: 0,
    lineOrder,
    lineStyles,
    linePositions,
    referenceStyle: referenceStyleObj,
    referencePosition: referencePositionObj,
    referenceEnglishStyle: referenceEnglishStyleObj,
    referenceEnglishPosition: referenceEnglishPositionObj,
    viewerBackground,
    canvasDimensions,
    backgroundBoxes,
    createdAt: now,
    updatedAt: now
  };
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
  const now = new Date().toISOString();

  // Track updated values for return object
  const updatedTheme = { ...existing };

  if (data.name !== undefined) {
    updates.push('name = ?');
    values.push(data.name);
    updatedTheme.name = data.name;
  }
  // Note: type should not be changed after creation
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
    values.push(data.referenceStyle ? JSON.stringify(data.referenceStyle) : null);
    updatedTheme.referenceStyle = data.referenceStyle;
  }
  if (data.referencePosition !== undefined) {
    updates.push('referencePosition = ?');
    values.push(data.referencePosition ? JSON.stringify(data.referencePosition) : null);
    updatedTheme.referencePosition = data.referencePosition;
  }
  if (data.referenceEnglishStyle !== undefined) {
    updates.push('referenceEnglishStyle = ?');
    values.push(data.referenceEnglishStyle ? JSON.stringify(data.referenceEnglishStyle) : null);
    updatedTheme.referenceEnglishStyle = data.referenceEnglishStyle;
  }
  if (data.referenceEnglishPosition !== undefined) {
    updates.push('referenceEnglishPosition = ?');
    values.push(data.referenceEnglishPosition ? JSON.stringify(data.referenceEnglishPosition) : null);
    updatedTheme.referenceEnglishPosition = data.referenceEnglishPosition;
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

  db.run(`UPDATE obs_themes SET ${updates.join(', ')} WHERE id = ?`, values);
  saveDatabase();

  // Return the updated object directly instead of re-querying
  return updatedTheme;
}

/**
 * Delete an OBS theme
 */
export async function deleteOBSTheme(id: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  // Validate input
  if (!id || typeof id !== 'string') return false;

  const existing = await getOBSTheme(id);
  if (!existing) return false;

  // Don't allow deleting built-in themes
  if (existing.isBuiltIn) {
    throw new Error('Cannot delete built-in theme');
  }

  // Create backup before destructive operation
  createBackup('delete_obs_theme');

  try {
    db.run(`DELETE FROM obs_themes WHERE id = ?`, [id]);
    saveDatabase();
    return true;
  } catch (error) {
    console.error('[obsThemes] deleteOBSTheme error:', error);
    throw new Error(`Failed to delete OBS theme: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
