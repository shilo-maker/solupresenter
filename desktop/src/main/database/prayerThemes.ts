import { getDb, saveDatabase, generateId, queryAll, queryOne, CLASSIC_PRAYER_THEME_ID } from './index';

export interface PrayerThemeData {
  name: string;
  lineOrder?: string[];
  lineStyles?: Record<string, any>;
  linePositions?: Record<string, any>;
  referenceStyle?: Record<string, any>;
  referencePosition?: Record<string, any>;
  referenceTranslationStyle?: Record<string, any>;
  referenceTranslationPosition?: Record<string, any>;
  container?: Record<string, any>;
  viewerBackground?: Record<string, any>;
  canvasDimensions?: { width: number; height: number };
  backgroundBoxes?: any[];
}

/**
 * Get all Prayer themes
 */
export async function getPrayerThemes(): Promise<any[]> {
  return queryAll('SELECT * FROM prayer_themes ORDER BY isBuiltIn DESC, name ASC');
}

/**
 * Get a single Prayer theme by ID
 */
export async function getPrayerTheme(id: string): Promise<any | null> {
  return queryOne('SELECT * FROM prayer_themes WHERE id = ?', [id]);
}

/**
 * Get the default Prayer theme
 */
export async function getDefaultPrayerTheme(): Promise<any | null> {
  const theme = queryOne('SELECT * FROM prayer_themes WHERE isDefault = 1');
  if (theme) return theme;

  // Fall back to classic prayer theme
  return getPrayerTheme(CLASSIC_PRAYER_THEME_ID);
}

/**
 * Create a new Prayer theme
 */
export async function createPrayerTheme(data: PrayerThemeData): Promise<any> {
  const db = getDb();
  if (!db) throw new Error('Database not initialized');

  const id = generateId();
  const now = new Date().toISOString();

  // Defaults based on NewClassicPrayer layout - Hebrew right, English left
  const defaultStyles = {
    title: { fontSize: 130, fontWeight: '700', color: '#FF8C42', opacity: 1, visible: true },
    titleTranslation: { fontSize: 129, fontWeight: '700', color: '#FF8C42', opacity: 0.9, visible: true },
    subtitle: { fontSize: 94, fontWeight: '700', color: '#ffffff', opacity: 1, visible: true },
    subtitleTranslation: { fontSize: 94, fontWeight: '700', color: '#e0e0e0', opacity: 0.9, visible: true },
    description: { fontSize: 90, fontWeight: '400', color: '#e0e0e0', opacity: 0.9, visible: true },
    descriptionTranslation: { fontSize: 90, fontWeight: '400', color: '#b0b0b0', opacity: 0.85, visible: true }
  };

  const defaultPositions = {
    title: { x: 0, y: 3, width: 100, height: 8, paddingTop: 1, paddingBottom: 1, alignH: 'right', alignV: 'center' },
    titleTranslation: { x: 0, y: 40.97, width: 100, height: 8.85, paddingTop: 0, paddingBottom: 1, alignH: 'left', alignV: 'center' },
    subtitle: { x: 0, y: 11.15, width: 100, height: 10.87, paddingTop: 2, paddingBottom: 2, alignH: 'right', alignV: 'top' },
    subtitleTranslation: { x: 0, y: 50.90, width: 100, height: 9.61, paddingTop: 1, paddingBottom: 1, alignH: 'left', alignV: 'top' },
    description: { x: 0, y: 21.65, width: 100, height: 10.12, paddingTop: 1, paddingBottom: 1, alignH: 'right', alignV: 'top' },
    descriptionTranslation: { x: 0, y: 60.18, width: 100, height: 10, paddingTop: 1, paddingBottom: 1, alignH: 'left', alignV: 'center' }
  };

  const defaultReferenceStyle = { fontSize: 56, fontWeight: '500', color: '#ffffff', opacity: 0.8, visible: true };
  const defaultReferencePosition = { x: 0, y: 31.78, width: 100, height: 5.11, paddingTop: 0, paddingBottom: 0, alignH: 'right', alignV: 'center' };
  const defaultReferenceTranslationStyle = { fontSize: 60, fontWeight: '400', color: '#ffffff', opacity: 0.7, visible: true };
  const defaultReferenceTranslationPosition = { x: 0, y: 70.32, width: 100, height: 8, paddingTop: 0, paddingBottom: 0, alignH: 'left', alignV: 'center' };

  db.run(`
    INSERT INTO prayer_themes (id, name, isBuiltIn, isDefault, lineOrder, lineStyles, linePositions, referenceStyle, referencePosition, referenceTranslationStyle, referenceTranslationPosition, container, viewerBackground, canvasDimensions, backgroundBoxes, createdAt, updatedAt)
    VALUES (?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id,
    data.name,
    JSON.stringify(data.lineOrder || ['title', 'titleTranslation', 'subtitle', 'subtitleTranslation', 'description', 'descriptionTranslation', 'reference', 'referenceTranslation']),
    JSON.stringify(data.lineStyles || defaultStyles),
    JSON.stringify(data.linePositions || defaultPositions),
    JSON.stringify(data.referenceStyle || defaultReferenceStyle),
    JSON.stringify(data.referencePosition || defaultReferencePosition),
    JSON.stringify(data.referenceTranslationStyle || defaultReferenceTranslationStyle),
    JSON.stringify(data.referenceTranslationPosition || defaultReferenceTranslationPosition),
    JSON.stringify(data.container || { maxWidth: '100%', padding: '2vh 6vw', backgroundColor: 'transparent', borderRadius: '0px' }),
    JSON.stringify(data.viewerBackground || { type: 'transparent', color: null }),
    JSON.stringify(data.canvasDimensions || { width: 1920, height: 1080 }),
    data.backgroundBoxes ? JSON.stringify(data.backgroundBoxes) : null,
    now,
    now
  ]);

  saveDatabase();
  return getPrayerTheme(id);
}

/**
 * Update an existing Prayer theme
 */
export async function updatePrayerTheme(id: string, data: Partial<PrayerThemeData>): Promise<any | null> {
  console.log('[prayerThemes] updatePrayerTheme called with id:', id);
  console.log('[prayerThemes] updatePrayerTheme data:', JSON.stringify(data, null, 2));
  console.log('[prayerThemes] referenceTranslationPosition:', data.referenceTranslationPosition);
  console.log('[prayerThemes] referenceTranslationStyle:', data.referenceTranslationStyle);

  const db = getDb();
  if (!db) return null;

  const existing = await getPrayerTheme(id);
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
  if (data.referenceTranslationStyle !== undefined) {
    updates.push('referenceTranslationStyle = ?');
    values.push(JSON.stringify(data.referenceTranslationStyle));
  }
  if (data.referenceTranslationPosition !== undefined) {
    updates.push('referenceTranslationPosition = ?');
    values.push(data.referenceTranslationPosition ? JSON.stringify(data.referenceTranslationPosition) : null);
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

  const sql = `UPDATE prayer_themes SET ${updates.join(', ')} WHERE id = ?`;
  console.log('[prayerThemes] Running SQL:', sql);
  console.log('[prayerThemes] With values:', values);

  db.run(sql, values);
  saveDatabase();

  const result = await getPrayerTheme(id);
  console.log('[prayerThemes] After update, theme has referenceTranslationPosition:', result?.referenceTranslationPosition);
  return result;
}

/**
 * Delete a Prayer theme
 */
export async function deletePrayerTheme(id: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  const existing = await getPrayerTheme(id);
  if (!existing) return false;

  // Don't allow deleting built-in themes
  if (existing.isBuiltIn) {
    throw new Error('Cannot delete built-in theme');
  }

  db.run(`DELETE FROM prayer_themes WHERE id = ?`, [id]);
  saveDatabase();
  return true;
}
