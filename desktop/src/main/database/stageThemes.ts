import { getDb, saveDatabase, generateId, queryAll, queryOne, CLASSIC_STAGE_THEME_ID, beginTransaction, commitTransaction, rollbackTransaction, createBackup } from './index';

export interface StageMonitorTheme {
  id: string;
  name: string;
  isBuiltIn: boolean;
  isDefault: boolean;
  canvasDimensions: {
    width: number;
    height: number;
  };
  colors: {
    background: string;
    text: string;
    accent: string;
    secondary: string;
    border: string;
  };
  elements: {
    header: StageElement & { backgroundColor: string };
    clock: StageElement & { fontSize: number; fontWeight: string; color: string; showSeconds: boolean };
    songTitle: StageElement & { fontSize: number; fontWeight: string; color: string };
    currentSlide: StageSlideArea;
    nextSlide: StageSlideArea & { labelText: string; labelColor: string };
  };
  currentSlideText: {
    original: TextStyle;
    transliteration: TextStyle;
    translation: TextStyle;
  };
  createdAt: string;
  updatedAt: string;
}

export interface StageElement {
  visible: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface StageSlideArea extends StageElement {
  backgroundColor: string;
  borderRadius: number;
}

export interface TextStyle {
  visible: boolean;
  fontSize: number;
  fontWeight: string;
  color: string;
  opacity: number;
}

/**
 * Get all stage monitor themes
 */
export function getStageThemes(): StageMonitorTheme[] {
  return queryAll('SELECT * FROM stage_monitor_themes ORDER BY isBuiltIn DESC, name ASC') as StageMonitorTheme[];
}

/**
 * Get a single stage monitor theme by ID
 */
export function getStageTheme(id: string): StageMonitorTheme | null {
  return queryOne('SELECT * FROM stage_monitor_themes WHERE id = ?', [id]) as StageMonitorTheme | null;
}

/**
 * Get the default stage monitor theme
 */
export function getDefaultStageTheme(): StageMonitorTheme | null {
  // Try to find default theme
  const theme = queryOne('SELECT * FROM stage_monitor_themes WHERE isDefault = 1 LIMIT 1') as StageMonitorTheme | null;
  if (theme) return theme;

  // Fall back to classic stage theme
  return queryOne('SELECT * FROM stage_monitor_themes WHERE id = ?', [CLASSIC_STAGE_THEME_ID]) as StageMonitorTheme | null;
}

/**
 * Create a new stage monitor theme
 */
export function createStageTheme(data: Partial<StageMonitorTheme>): StageMonitorTheme {
  const db = getDb();
  if (!db) throw new Error('Database not initialized');

  const id = generateId();
  const now = new Date().toISOString();

  const theme: StageMonitorTheme = {
    id,
    name: data.name || 'New Stage Theme',
    isBuiltIn: false,
    isDefault: false,
    canvasDimensions: data.canvasDimensions || { width: 1920, height: 1080 },
    colors: data.colors || {
      background: '#1a1a2e',
      text: '#FFFFFF',
      accent: '#FF8C42',
      secondary: '#667eea',
      border: 'rgba(255,255,255,0.1)'
    },
    elements: data.elements || {
      header: { visible: true, x: 0, y: 0, width: 100, height: 8, backgroundColor: 'rgba(0,0,0,0.5)' },
      clock: { visible: true, x: 85, y: 1, width: 14, height: 6, fontSize: 24, fontWeight: '600', color: '#FFFFFF', showSeconds: true },
      songTitle: { visible: true, x: 2, y: 1, width: 60, height: 6, fontSize: 20, fontWeight: '600', color: '#FF8C42' },
      currentSlide: { visible: true, x: 2, y: 12, width: 60, height: 55, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 8 },
      nextSlide: { visible: true, x: 65, y: 12, width: 33, height: 35, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 8, labelText: 'NEXT', labelColor: 'rgba(255,255,255,0.5)' }
    },
    currentSlideText: data.currentSlideText || {
      original: { visible: true, fontSize: 32, fontWeight: '500', color: '#FFFFFF', opacity: 1 },
      transliteration: { visible: true, fontSize: 24, fontWeight: '400', color: '#FFFFFF', opacity: 0.9 },
      translation: { visible: true, fontSize: 24, fontWeight: '400', color: '#FFFFFF', opacity: 0.9 }
    },
    createdAt: now,
    updatedAt: now
  };

  db.run(`
    INSERT INTO stage_monitor_themes (id, name, isBuiltIn, isDefault, canvasDimensions, colors, elements, currentSlideText, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    theme.id,
    theme.name,
    theme.isBuiltIn ? 1 : 0,
    theme.isDefault ? 1 : 0,
    JSON.stringify(theme.canvasDimensions),
    JSON.stringify(theme.colors),
    JSON.stringify(theme.elements),
    JSON.stringify(theme.currentSlideText),
    theme.createdAt,
    theme.updatedAt
  ]);

  saveDatabase();
  return theme;
}

/**
 * Update an existing stage monitor theme
 */
export function updateStageTheme(id: string, data: Partial<StageMonitorTheme>): StageMonitorTheme | null {
  const db = getDb();
  if (!db) return null;

  // Check if theme exists and is not built-in
  const existing = getStageTheme(id);
  if (!existing) return null;
  if (existing.isBuiltIn) {
    throw new Error('Cannot modify built-in theme');
  }

  const updatedAt = new Date().toISOString();

  // Track updated values for return object
  const updatedTheme = { ...existing };

  // Build update query dynamically
  const updates: string[] = [];
  const values: any[] = [];

  if (data.name !== undefined) {
    updates.push('name = ?');
    values.push(data.name);
    updatedTheme.name = data.name;
  }
  if (data.canvasDimensions !== undefined) {
    updates.push('canvasDimensions = ?');
    values.push(JSON.stringify(data.canvasDimensions));
    updatedTheme.canvasDimensions = data.canvasDimensions;
  }
  if (data.colors !== undefined) {
    updates.push('colors = ?');
    values.push(JSON.stringify(data.colors));
    updatedTheme.colors = data.colors;
  }
  if (data.elements !== undefined) {
    updates.push('elements = ?');
    values.push(JSON.stringify(data.elements));
    updatedTheme.elements = data.elements;
  }
  if (data.currentSlideText !== undefined) {
    updates.push('currentSlideText = ?');
    values.push(JSON.stringify(data.currentSlideText));
    updatedTheme.currentSlideText = data.currentSlideText;
  }
  if (data.isDefault !== undefined) {
    updates.push('isDefault = ?');
    values.push(data.isDefault ? 1 : 0);
    updatedTheme.isDefault = data.isDefault;
  }

  updates.push('updatedAt = ?');
  values.push(updatedAt);
  values.push(id);
  updatedTheme.updatedAt = updatedAt;

  // Use transaction if setting as default (multiple statements)
  if (data.isDefault) {
    beginTransaction();
    try {
      db.run('UPDATE stage_monitor_themes SET isDefault = 0');
      db.run(`UPDATE stage_monitor_themes SET ${updates.join(', ')} WHERE id = ?`, values);
      commitTransaction();
    } catch (error) {
      rollbackTransaction();
      throw error;
    }
  } else {
    db.run(`UPDATE stage_monitor_themes SET ${updates.join(', ')} WHERE id = ?`, values);
    saveDatabase();
  }

  // Return the updated object directly instead of re-querying
  return updatedTheme;
}

/**
 * Delete a stage monitor theme
 */
export function deleteStageTheme(id: string): boolean {
  const db = getDb();
  if (!db) return false;

  // Validate input
  if (!id || typeof id !== 'string') return false;

  // Check if theme is built-in
  const existing = getStageTheme(id);
  if (!existing) return false;
  if (existing.isBuiltIn) {
    throw new Error('Cannot delete built-in theme');
  }

  // Create backup before destructive operation
  createBackup('delete_stage_theme');

  try {
    db.run(`DELETE FROM stage_monitor_themes WHERE id = ?`, [id]);
    saveDatabase();
    return true;
  } catch (error) {
    console.error('[stageThemes] deleteStageTheme error:', error);
    throw new Error(`Failed to delete Stage theme: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Duplicate a stage monitor theme
 */
export function duplicateStageTheme(id: string, newName?: string): StageMonitorTheme | null {
  const existing = getStageTheme(id);
  if (!existing) return null;

  return createStageTheme({
    name: newName || `${existing.name} (Copy)`,
    canvasDimensions: existing.canvasDimensions,
    colors: existing.colors,
    elements: existing.elements,
    currentSlideText: existing.currentSlideText
  });
}

/**
 * Set a theme as the default
 */
export function setDefaultStageTheme(id: string): boolean {
  const db = getDb();
  if (!db) return false;

  // Use transaction for atomic default change
  beginTransaction();
  try {
    // Clear existing default
    db.run('UPDATE stage_monitor_themes SET isDefault = 0');
    // Set new default
    db.run('UPDATE stage_monitor_themes SET isDefault = 1 WHERE id = ?', [id]);
    commitTransaction();
    return true;
  } catch (error) {
    rollbackTransaction();
    console.error('setDefaultStageTheme error:', error);
    return false;
  }
}
