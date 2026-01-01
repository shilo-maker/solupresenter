import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import initSqlJs, { Database } from 'sql.js';

// Database path
const dbPath = path.join(app.getPath('userData'), 'solupresenter.sqlite');

let db: Database | null = null;

/**
 * Initialize database
 */
export async function initDatabase(): Promise<void> {
  console.log('initDatabase: starting...');
  try {
    console.log('initDatabase: loading sql.js...');
    const SQL = await initSqlJs();
    console.log('initDatabase: sql.js loaded');

    // Ensure directory exists
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Load existing database or create new
    if (fs.existsSync(dbPath)) {
      const fileBuffer = fs.readFileSync(dbPath);
      db = new SQL.Database(fileBuffer);
    } else {
      db = new SQL.Database();
    }

    // Create tables
    db.run(`
      CREATE TABLE IF NOT EXISTS songs (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        originalLanguage TEXT DEFAULT 'he',
        slides TEXT DEFAULT '[]',
        tags TEXT DEFAULT '[]',
        author TEXT,
        backgroundImage TEXT DEFAULT '',
        usageCount INTEGER DEFAULT 0,
        remoteId TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS setlists (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        items TEXT DEFAULT '[]',
        usageCount INTEGER DEFAULT 0,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS viewer_themes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        isBuiltIn INTEGER DEFAULT 0,
        isDefault INTEGER DEFAULT 0,
        lineOrder TEXT DEFAULT '["original","transliteration","translation"]',
        lineStyles TEXT,
        positioning TEXT,
        container TEXT,
        viewerBackground TEXT,
        linePositions TEXT,
        canvasDimensions TEXT,
        backgroundBoxes TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        defaultThemeId TEXT,
        onlineServerUrl TEXT DEFAULT 'https://solupresenter-backend-4rn5.onrender.com',
        onlineToken TEXT,
        language TEXT DEFAULT 'he',
        autoConnectOnline INTEGER DEFAULT 0
      )
    `);

    // Save after creating tables
    saveDatabase();

    // Seed classic theme if it doesn't exist
    const CLASSIC_THEME_ID = '00000000-0000-0000-0000-000000000001';
    const existingTheme = db.exec(`SELECT id FROM viewer_themes WHERE id = '${CLASSIC_THEME_ID}'`);

    if (existingTheme.length === 0 || existingTheme[0].values.length === 0) {
      const defaultStyles = {
        original: { fontSize: 187, fontWeight: '700', color: '#ffffff', opacity: 1, visible: true },
        transliteration: { fontSize: 136, fontWeight: '400', color: '#e0e0e0', opacity: 0.9, visible: true },
        translation: { fontSize: 146, fontWeight: '400', color: '#b0b0b0', opacity: 0.85, visible: true }
      };
      const defaultLinePositions = {
        original: { x: 0, y: 27.897104546981193, width: 100, height: 11.379800853485063, paddingTop: 2, paddingBottom: 2, alignH: 'center', alignV: 'center' },
        transliteration: { x: 0, y: 38.96539940433855, width: 100, height: 12.138454243717401, paddingTop: 1, paddingBottom: 1, alignH: 'center', alignV: 'center' },
        translation: { x: 0, y: 50.838474679449185, width: 100, height: 27.311522048364157, paddingTop: 1, paddingBottom: 1, alignH: 'center', alignV: 'top' }
      };

      db.run(`
        INSERT INTO viewer_themes (id, name, isBuiltIn, isDefault, lineOrder, lineStyles, positioning, container, viewerBackground, canvasDimensions, linePositions, backgroundBoxes)
        VALUES (?, ?, 1, 1, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        CLASSIC_THEME_ID,
        'Classic',
        JSON.stringify(['original', 'transliteration', 'translation']),
        JSON.stringify(defaultStyles),
        JSON.stringify({ vertical: 'center', horizontal: 'center' }),
        JSON.stringify({ maxWidth: '100%', padding: '2vh 6vw', backgroundColor: 'transparent', borderRadius: '0px' }),
        JSON.stringify({ type: 'color', color: '#000000' }),
        JSON.stringify({ width: 1920, height: 1080 }),
        JSON.stringify(defaultLinePositions),
        JSON.stringify([])
      ]);
      console.log('Created Classic theme');
      saveDatabase();
    }

    // Ensure settings exist
    const existingSettings = db.exec('SELECT id FROM settings WHERE id = 1');
    if (existingSettings.length === 0 || existingSettings[0].values.length === 0) {
      db.run('INSERT INTO settings (id) VALUES (1)');
      console.log('Created default settings');
      saveDatabase();
    }

    // Create media_folders table
    db.run(`
      CREATE TABLE IF NOT EXISTS media_folders (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create media_items table with folderId
    db.run(`
      CREATE TABLE IF NOT EXISTS media_items (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        originalPath TEXT NOT NULL,
        processedPath TEXT NOT NULL,
        duration REAL,
        thumbnailPath TEXT,
        fileSize INTEGER DEFAULT 0,
        folderId TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Migration: Add folderId column if it doesn't exist
    try {
      db.run(`ALTER TABLE media_items ADD COLUMN folderId TEXT`);
    } catch {
      // Column already exists
    }

    // Migration: Add venue column to setlists if it doesn't exist
    try {
      db.run(`ALTER TABLE setlists ADD COLUMN venue TEXT`);
    } catch {
      // Column already exists
    }

    // Create stage_monitor_themes table
    db.run(`
      CREATE TABLE IF NOT EXISTS stage_monitor_themes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        isBuiltIn INTEGER DEFAULT 0,
        isDefault INTEGER DEFAULT 0,
        canvasDimensions TEXT DEFAULT '{"width":1920,"height":1080}',
        colors TEXT,
        elements TEXT,
        currentSlideText TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Seed default stage monitor theme if it doesn't exist
    const CLASSIC_STAGE_THEME_ID = '00000000-0000-0000-0000-000000000002';
    const existingStageTheme = db.exec(`SELECT id FROM stage_monitor_themes WHERE id = '${CLASSIC_STAGE_THEME_ID}'`);

    if (existingStageTheme.length === 0 || existingStageTheme[0].values.length === 0) {
      const defaultColors = {
        background: '#1a1a2e',
        text: '#FFFFFF',
        accent: '#FF8C42',
        secondary: '#667eea',
        border: 'rgba(255,255,255,0.1)'
      };
      const defaultElements = {
        header: { visible: true, x: 0, y: 0, width: 100, height: 8, backgroundColor: 'rgba(0,0,0,0.5)' },
        clock: { visible: true, x: 85, y: 1, width: 14, height: 6, fontSize: 24, fontWeight: '600', color: '#FFFFFF', showSeconds: true },
        songTitle: { visible: true, x: 2, y: 1, width: 60, height: 6, fontSize: 20, fontWeight: '600', color: '#FF8C42' },
        currentSlide: { visible: true, x: 2, y: 12, width: 60, height: 55, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 8 },
        nextSlide: { visible: true, x: 65, y: 12, width: 33, height: 35, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 8, labelText: 'NEXT', labelColor: 'rgba(255,255,255,0.5)' }
      };
      const defaultSlideText = {
        original: { visible: true, fontSize: 32, fontWeight: '500', color: '#FFFFFF', opacity: 1 },
        transliteration: { visible: true, fontSize: 24, fontWeight: '400', color: '#FFFFFF', opacity: 0.9 },
        translation: { visible: true, fontSize: 24, fontWeight: '400', color: '#FFFFFF', opacity: 0.9 }
      };

      db.run(`
        INSERT INTO stage_monitor_themes (id, name, isBuiltIn, isDefault, canvasDimensions, colors, elements, currentSlideText)
        VALUES (?, ?, 1, 1, ?, ?, ?, ?)
      `, [
        CLASSIC_STAGE_THEME_ID,
        'Classic Stage',
        JSON.stringify({ width: 1920, height: 1080 }),
        JSON.stringify(defaultColors),
        JSON.stringify(defaultElements),
        JSON.stringify(defaultSlideText)
      ]);
      console.log('Created Classic Stage theme');
      saveDatabase();
    }

    // Create presentations table
    db.run(`
      CREATE TABLE IF NOT EXISTS presentations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        slides TEXT DEFAULT '[]',
        canvasDimensions TEXT DEFAULT '{"width":1920,"height":1080}',
        createdAt TEXT,
        updatedAt TEXT
      )
    `);

    saveDatabase();

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

/**
 * Save database to file
 */
export function saveDatabase(): void {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

/**
 * Get database instance
 */
export function getDb(): Database | null {
  return db;
}

/**
 * Generate UUID
 */
export function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Helper to convert query results to objects
export function rowsToObjects(result: any[]): any[] {
  if (!result || result.length === 0) return [];
  const columns = result[0].columns;
  return result[0].values.map((row: any[]) => {
    const obj: any = {};
    columns.forEach((col: string, i: number) => {
      let value = row[i];
      // Parse JSON fields
      if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) {
        try {
          value = JSON.parse(value);
        } catch {}
      }
      obj[col] = value;
    });
    return obj;
  });
}

export const CLASSIC_THEME_ID = '00000000-0000-0000-0000-000000000001';
export const CLASSIC_STAGE_THEME_ID = '00000000-0000-0000-0000-000000000002';
