import { getDb, saveDatabase, generateId, rowsToObjects } from './index';

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
}

export interface Slide {
  id: string;
  order: number;
  textBoxes: TextBox[];
  backgroundColor?: string;
}

export interface PresentationData {
  title: string;
  slides?: Slide[];
  canvasDimensions?: { width: number; height: number };
}

export interface Presentation extends PresentationData {
  id: string;
  slides: Slide[];
  canvasDimensions: { width: number; height: number };
  createdAt: string;
  updatedAt: string;
}

/**
 * Get all presentations
 */
export async function getPresentations(): Promise<Presentation[]> {
  const db = getDb();
  if (!db) return [];

  const result = db.exec('SELECT * FROM presentations ORDER BY updatedAt DESC');
  return rowsToObjects(result) as Presentation[];
}

/**
 * Get a single presentation by ID
 */
export async function getPresentation(id: string): Promise<Presentation | null> {
  const db = getDb();
  if (!db) return null;

  const result = db.exec(`SELECT * FROM presentations WHERE id = '${id.replace(/'/g, "''")}'`);
  const presentations = rowsToObjects(result) as Presentation[];
  return presentations.length > 0 ? presentations[0] : null;
}

/**
 * Create a new presentation
 */
export async function createPresentation(data: PresentationData): Promise<Presentation> {
  const db = getDb();
  if (!db) throw new Error('Database not initialized');

  const id = generateId();
  const now = new Date().toISOString();

  const defaultSlide: Slide = {
    id: generateId(),
    order: 0,
    textBoxes: []
  };

  try {
    db.run(`
      INSERT INTO presentations (id, title, slides, canvasDimensions, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      id,
      data.title,
      JSON.stringify(data.slides || [defaultSlide]),
      JSON.stringify(data.canvasDimensions || { width: 1920, height: 1080 }),
      now,
      now
    ]);

    saveDatabase();

    const created = await getPresentation(id);
    if (!created) {
      throw new Error('Failed to retrieve created presentation');
    }
    return created;
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

  const existing = await getPresentation(id);
  if (!existing) return null;

  const updates: string[] = [];
  const values: any[] = [];

  if (data.title !== undefined) {
    updates.push('title = ?');
    values.push(data.title);
  }
  if (data.slides !== undefined) {
    updates.push('slides = ?');
    values.push(JSON.stringify(data.slides));
  }
  if (data.canvasDimensions !== undefined) {
    updates.push('canvasDimensions = ?');
    values.push(JSON.stringify(data.canvasDimensions));
  }

  updates.push('updatedAt = ?');
  values.push(new Date().toISOString());
  values.push(id);

  db.run(`UPDATE presentations SET ${updates.join(', ')} WHERE id = ?`, values);
  saveDatabase();

  return getPresentation(id);
}

/**
 * Delete a presentation
 */
export async function deletePresentation(id: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  db.run(`DELETE FROM presentations WHERE id = ?`, [id]);
  saveDatabase();
  return true;
}
