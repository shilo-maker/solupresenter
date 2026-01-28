import { getDb, saveDatabase, generateId, queryAll, queryOne, createBackup } from './index';

export interface TextBox {
  id: string;
  text: string;
  x: number;        // 0-100 percentage
  y: number;        // 0-100 percentage
  width: number;    // 0-100 percentage
  height: number;   // 0-100 percentage
  fontSize: number; // 50-200 percentage
  color: string;
  backgroundColor: string;
  textAlign: 'left' | 'center' | 'right';
  verticalAlign: 'top' | 'center' | 'bottom';
  bold: boolean;
  italic: boolean;
  underline: boolean;
  opacity: number;  // 0-1
  zIndex?: number;  // Layer order (higher = front)
  textDirection?: 'ltr' | 'rtl';  // Text direction for Hebrew/Arabic support

  // Enhanced properties (all optional for backward compatibility)
  fontWeight?: string;              // '300'-'800' (overrides bold when set)
  backgroundOpacity?: number;       // 0-1 (separate from text opacity)
  visible?: boolean;                // default true

  // Per-side borders
  borderTop?: number;
  borderRight?: number;
  borderBottom?: number;
  borderLeft?: number;
  borderColor?: string;

  // Per-corner radius
  borderRadiusTopLeft?: number;
  borderRadiusTopRight?: number;
  borderRadiusBottomRight?: number;
  borderRadiusBottomLeft?: number;

  // Per-side padding
  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;

  // Flow positioning
  positionMode?: 'absolute' | 'flow';
  flowAnchor?: string;              // ID of element to position relative to
  flowGap?: number;                 // Gap in percentage
  autoHeight?: boolean;             // Auto-expand based on content
  growDirection?: 'up' | 'down';    // Direction to grow when auto-height
}

export interface ImageBox {
  id: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  objectFit: 'contain' | 'cover' | 'fill';
  borderRadius: number;
  zIndex?: number;
  visible?: boolean;                // default true
}

// Texture types for background boxes
export type TextureType = 'none' | 'paper' | 'parchment' | 'linen' | 'canvas' | 'noise';

// Background box interface for decorative rectangles
export interface PresentationBackgroundBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  opacity: number;
  borderRadius: number;
  texture?: TextureType;
  textureOpacity?: number;
  zIndex?: number;
  visible?: boolean;
}

export interface Slide {
  id: string;
  order: number;
  textBoxes: TextBox[];
  imageBoxes?: ImageBox[];
  backgroundBoxes?: PresentationBackgroundBox[];
  backgroundColor?: string;
  backgroundGradient?: string;      // CSS gradient value
  backgroundType?: 'color' | 'gradient' | 'transparent';
}

export interface QuickModeMetadata {
  type: 'sermon' | 'prayer' | 'announcements';
  title: string;  // Original title (e.g., "Prayer Requests")
  subtitles: Array<{
    subtitle: string;
    subtitleTranslation?: string;
    description?: string;
    descriptionTranslation?: string;
    bibleRef?: { reference: string; hebrewReference?: string };
  }>;
}

export interface PresentationData {
  title: string;
  slides?: Slide[];
  canvasDimensions?: { width: number; height: number };
  quickModeData?: QuickModeMetadata;  // Store Quick Mode data for theme-based rendering
}

export interface Presentation extends PresentationData {
  id: string;
  slides: Slide[];
  canvasDimensions: { width: number; height: number };
  createdAt: string;
  updatedAt: string;
}

/**
 * Generate a unique presentation title by appending (1), (2), etc. if needed
 */
function generateUniquePresentationTitle(title: string, excludeId?: string): string {
  const baseTitle = title.trim();

  // Check if exact title exists
  const existingQuery = excludeId
    ? queryOne('SELECT id FROM presentations WHERE title = ? AND id != ?', [baseTitle, excludeId])
    : queryOne('SELECT id FROM presentations WHERE title = ?', [baseTitle]);

  if (!existingQuery) {
    return baseTitle;
  }

  // Find all presentations with titles matching the pattern "baseTitle" or "baseTitle (N)"
  const pattern = `${baseTitle} (%)`;
  const existingPresentations = queryAll(
    excludeId
      ? 'SELECT title FROM presentations WHERE (title = ? OR title LIKE ?) AND id != ?'
      : 'SELECT title FROM presentations WHERE title = ? OR title LIKE ?',
    excludeId ? [baseTitle, pattern, excludeId] : [baseTitle, pattern]
  );

  // Extract existing numbers
  const usedNumbers = new Set<number>([0]); // 0 represents the base title
  const regex = new RegExp(`^${baseTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\((\\d+)\\)$`);

  for (const presentation of existingPresentations) {
    const match = presentation.title.match(regex);
    if (match) {
      usedNumbers.add(parseInt(match[1], 10));
    }
  }

  // Find the next available number
  let nextNumber = 1;
  while (usedNumbers.has(nextNumber)) {
    nextNumber++;
  }

  return `${baseTitle} (${nextNumber})`;
}

/**
 * Get all presentations
 */
export async function getPresentations(): Promise<Presentation[]> {
  return queryAll('SELECT * FROM presentations ORDER BY updatedAt DESC') as Presentation[];
}

/**
 * Get a single presentation by ID
 */
export async function getPresentation(id: string): Promise<Presentation | null> {
  // Validate input
  if (!id || typeof id !== 'string') {
    console.warn('[presentations] getPresentation: invalid id');
    return null;
  }
  return queryOne('SELECT * FROM presentations WHERE id = ?', [id]) as Presentation | null;
}

/**
 * Create a new presentation
 */
export async function createPresentation(data: PresentationData): Promise<Presentation> {
  const db = getDb();
  if (!db) throw new Error('Database not initialized');

  // Validate input
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid presentation data');
  }
  if (!data.title || typeof data.title !== 'string') {
    throw new Error('Presentation title is required');
  }
  // Sanitize title and ensure uniqueness
  const rawTitle = data.title.trim().substring(0, 500);
  if (rawTitle.length === 0) {
    throw new Error('Presentation title cannot be empty');
  }
  const sanitizedTitle = generateUniquePresentationTitle(rawTitle);

  const id = generateId();
  const now = new Date().toISOString();

  const defaultSlide: Slide = {
    id: generateId(),
    order: 0,
    textBoxes: []
  };

  // Prepare values for return
  const slides = data.slides || [defaultSlide];
  const canvasDimensions = data.canvasDimensions || { width: 1920, height: 1080 };

  try {
    db.run(`
      INSERT INTO presentations (id, title, slides, canvasDimensions, quickModeData, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      sanitizedTitle,
      JSON.stringify(slides),
      JSON.stringify(canvasDimensions),
      data.quickModeData ? JSON.stringify(data.quickModeData) : null,
      now,
      now
    ]);

    saveDatabase();

    // Return the created object directly instead of re-querying
    return {
      id,
      title: sanitizedTitle,
      slides,
      canvasDimensions,
      quickModeData: data.quickModeData,
      createdAt: now,
      updatedAt: now
    };
  } catch (error) {
    console.error('Error creating presentation:', error);
    throw error;
  }
}

/**
 * Update an existing presentation
 */
export async function updatePresentation(id: string, data: Partial<PresentationData>): Promise<Presentation | null> {
  const db = getDb();
  if (!db) return null;

  // Validate inputs
  if (!id || typeof id !== 'string') {
    console.warn('[presentations] updatePresentation: invalid id');
    return null;
  }
  if (!data || typeof data !== 'object') {
    console.warn('[presentations] updatePresentation: invalid data');
    return null;
  }

  const existing = await getPresentation(id);
  if (!existing) return null;

  const updates: string[] = [];
  const values: any[] = [];
  const now = new Date().toISOString();

  // Track updated values for return object
  const updatedPresentation = { ...existing };

  if (data.title !== undefined) {
    // Ensure unique title (excluding current presentation)
    const uniqueTitle = generateUniquePresentationTitle(data.title.trim(), id);
    updates.push('title = ?');
    values.push(uniqueTitle);
    updatedPresentation.title = uniqueTitle;
  }
  if (data.slides !== undefined) {
    updates.push('slides = ?');
    values.push(JSON.stringify(data.slides));
    updatedPresentation.slides = data.slides;
  }
  if (data.canvasDimensions !== undefined) {
    updates.push('canvasDimensions = ?');
    values.push(JSON.stringify(data.canvasDimensions));
    updatedPresentation.canvasDimensions = data.canvasDimensions;
  }
  if (data.quickModeData !== undefined) {
    updates.push('quickModeData = ?');
    values.push(data.quickModeData ? JSON.stringify(data.quickModeData) : null);
    updatedPresentation.quickModeData = data.quickModeData;
  }

  updates.push('updatedAt = ?');
  values.push(now);
  values.push(id);
  updatedPresentation.updatedAt = now;

  db.run(`UPDATE presentations SET ${updates.join(', ')} WHERE id = ?`, values);
  saveDatabase();

  // Return the updated object directly instead of re-querying
  return updatedPresentation;
}

/**
 * Delete a presentation
 */
export async function deletePresentation(id: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  // Validate input
  if (!id || typeof id !== 'string') {
    console.warn('[presentations] deletePresentation: invalid id');
    return false;
  }

  // Create backup before destructive operation
  createBackup('delete_presentation');

  db.run(`DELETE FROM presentations WHERE id = ?`, [id]);
  saveDatabase();
  return true;
}
