import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import initSqlJs, { Database } from 'sql.js';

// Database path
const dbPath = path.join(app.getPath('userData'), 'solupresenter.sqlite');

// Get the path to sql.js WASM file
function getSqlJsWasmPath(): string {
  // In development, use node_modules path
  // In production, the WASM file should be in resources/sql-wasm.wasm
  const isDev = !app.isPackaged;

  if (isDev) {
    // Development - use node_modules
    return path.join(__dirname, '..', '..', '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
  } else {
    // Production - check multiple possible locations
    const possiblePaths = [
      path.join(process.resourcesPath, 'sql-wasm.wasm'),
      path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
      path.join(app.getAppPath(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        console.log('[Database] Found sql-wasm.wasm at:', p);
        return p;
      }
    }

    // Fallback - let sql.js try to find it
    console.warn('[Database] Could not find sql-wasm.wasm, letting sql.js locate it');
    return '';
  }
}

// Current schema version - increment when adding migrations
const CURRENT_SCHEMA_VERSION = 1;

let db: Database | null = null;

/**
 * Get current schema version from database
 */
function getSchemaVersion(): number {
  if (!db) return 0;
  try {
    const result = db.exec('SELECT version FROM schema_version LIMIT 1');
    if (result.length > 0 && result[0].values.length > 0) {
      return result[0].values[0][0] as number;
    }
  } catch {
    // Table doesn't exist yet
  }
  return 0;
}

/**
 * Set schema version in database
 */
function setSchemaVersion(version: number): void {
  if (!db) return;
  const existing = getSchemaVersion();
  if (existing === 0) {
    db.run('INSERT INTO schema_version (version, updatedAt) VALUES (?, ?)', [version, new Date().toISOString()]);
  } else {
    db.run('UPDATE schema_version SET version = ?, updatedAt = ?', [version, new Date().toISOString()]);
  }
}

/**
 * Run database migrations
 */
function runMigrations(fromVersion: number): void {
  if (!db) return;
  console.log(`Running migrations from version ${fromVersion} to ${CURRENT_SCHEMA_VERSION}`);

  // Add new migrations here as the schema evolves
  // Example:
  // if (fromVersion < 2) {
  //   console.log('Running migration to version 2...');
  //   db.run('ALTER TABLE songs ADD COLUMN newField TEXT');
  // }
  // if (fromVersion < 3) {
  //   console.log('Running migration to version 3...');
  //   db.run('CREATE TABLE new_table (...)');
  // }

  setSchemaVersion(CURRENT_SCHEMA_VERSION);
  console.log(`Migrations complete. Schema is now at version ${CURRENT_SCHEMA_VERSION}`);
}

/**
 * Initialize database
 */
export async function initDatabase(): Promise<void> {
  console.log('initDatabase: starting...');
  try {
    console.log('initDatabase: loading sql.js...');
    const wasmPath = getSqlJsWasmPath();
    console.log('initDatabase: WASM path:', wasmPath);

    const sqlConfig: any = {};
    if (wasmPath && fs.existsSync(wasmPath)) {
      // Load WASM file directly as a buffer for more reliable loading
      const wasmBinary = fs.readFileSync(wasmPath);
      sqlConfig.wasmBinary = wasmBinary;
      console.log('initDatabase: Loaded WASM binary, size:', wasmBinary.length);
    }

    const SQL = await initSqlJs(sqlConfig);
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

    // Create schema_version table first
    db.run(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `);

    // Check and run migrations if needed
    const currentVersion = getSchemaVersion();
    if (currentVersion < CURRENT_SCHEMA_VERSION) {
      runMigrations(currentVersion);
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
        autoConnectOnline INTEGER DEFAULT 0,
        selectedViewerThemeId TEXT,
        selectedStageThemeId TEXT,
        selectedBibleThemeId TEXT,
        selectedOBSThemeId TEXT,
        selectedPrayerThemeId TEXT
      )
    `);

    // Migration: Add new theme columns if they don't exist (for existing databases)
    const tableInfo = db.exec("PRAGMA table_info(settings)");
    const columnNames = tableInfo[0]?.values?.map((row: any) => row[1]) || [];
    if (!columnNames.includes('selectedViewerThemeId')) {
      db.run('ALTER TABLE settings ADD COLUMN selectedViewerThemeId TEXT');
    }
    if (!columnNames.includes('selectedStageThemeId')) {
      db.run('ALTER TABLE settings ADD COLUMN selectedStageThemeId TEXT');
    }
    if (!columnNames.includes('selectedBibleThemeId')) {
      db.run('ALTER TABLE settings ADD COLUMN selectedBibleThemeId TEXT');
    }
    if (!columnNames.includes('selectedOBSThemeId')) {
      db.run('ALTER TABLE settings ADD COLUMN selectedOBSThemeId TEXT');
    }
    if (!columnNames.includes('selectedPrayerThemeId')) {
      db.run('ALTER TABLE settings ADD COLUMN selectedPrayerThemeId TEXT');
    }

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
        quickModeData TEXT,
        createdAt TEXT,
        updatedAt TEXT
      )
    `);

    // Migration: Add quickModeData column to presentations (for prayer/sermon theme support)
    try {
      const presentationsInfo = db.exec("PRAGMA table_info(presentations)");
      const columns = presentationsInfo[0]?.values?.map((row: any) => row[1]) || [];
      console.log('[DB Migration] presentations table columns:', columns);
      if (!columns.includes('quickModeData')) {
        db.run('ALTER TABLE presentations ADD COLUMN quickModeData TEXT');
        console.log('[DB Migration] Added quickModeData column to presentations table');
        saveDatabase();
      } else {
        console.log('[DB Migration] quickModeData column already exists');
      }
    } catch (e) {
      console.error('[DB Migration] Error checking/adding quickModeData column:', e);
    }

    // Create bible_themes table
    db.run(`
      CREATE TABLE IF NOT EXISTS bible_themes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        isBuiltIn INTEGER DEFAULT 0,
        isDefault INTEGER DEFAULT 0,
        lineOrder TEXT DEFAULT '["hebrew","english"]',
        lineStyles TEXT,
        linePositions TEXT,
        referenceStyle TEXT,
        referencePosition TEXT,
        container TEXT,
        viewerBackground TEXT,
        canvasDimensions TEXT DEFAULT '{"width":1920,"height":1080}',
        backgroundBoxes TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create obs_themes table
    db.run(`
      CREATE TABLE IF NOT EXISTS obs_themes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        isBuiltIn INTEGER DEFAULT 0,
        isDefault INTEGER DEFAULT 0,
        lineOrder TEXT,
        lineStyles TEXT,
        linePositions TEXT,
        referenceStyle TEXT,
        referencePosition TEXT,
        viewerBackground TEXT,
        canvasDimensions TEXT DEFAULT '{"width":1920,"height":1080}',
        backgroundBoxes TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create prayer_themes table
    db.run(`
      CREATE TABLE IF NOT EXISTS prayer_themes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        isBuiltIn INTEGER DEFAULT 0,
        isDefault INTEGER DEFAULT 0,
        lineOrder TEXT DEFAULT '["title","titleTranslation","subtitle","subtitleTranslation","description","descriptionTranslation","reference","referenceTranslation"]',
        lineStyles TEXT,
        linePositions TEXT,
        referenceStyle TEXT,
        referencePosition TEXT,
        referenceTranslationStyle TEXT,
        referenceTranslationPosition TEXT,
        container TEXT,
        viewerBackground TEXT,
        canvasDimensions TEXT DEFAULT '{"width":1920,"height":1080}',
        backgroundBoxes TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add referenceTranslationStyle and referenceTranslationPosition columns if they don't exist (migration)
    const prayerThemeColumns = db.exec("PRAGMA table_info(prayer_themes)");
    const existingColumns = prayerThemeColumns.length > 0
      ? prayerThemeColumns[0].values.map((row: any) => row[1])
      : [];
    console.log('[DB Init] Existing prayer_themes columns:', existingColumns);

    if (!existingColumns.includes('referenceTranslationStyle')) {
      console.log('[DB Init] Adding referenceTranslationStyle column to prayer_themes');
      db.run(`ALTER TABLE prayer_themes ADD COLUMN referenceTranslationStyle TEXT`);
      saveDatabase();
    }
    if (!existingColumns.includes('referenceTranslationPosition')) {
      console.log('[DB Init] Adding referenceTranslationPosition column to prayer_themes');
      db.run(`ALTER TABLE prayer_themes ADD COLUMN referenceTranslationPosition TEXT`);
      saveDatabase();
    }

    // Seed default Bible theme if it doesn't exist
    const CLASSIC_BIBLE_THEME_ID = '00000000-0000-0000-0000-000000000003';
    console.log('[DB Init] Checking for classic Bible theme...');
    const existingBibleTheme = db.exec(`SELECT id FROM bible_themes WHERE id = '${CLASSIC_BIBLE_THEME_ID}'`);
    console.log('[DB Init] Existing Bible theme check result:', existingBibleTheme.length, existingBibleTheme[0]?.values?.length);

    if (existingBibleTheme.length === 0 || existingBibleTheme[0].values.length === 0) {
      const defaultBibleStyles = {
        hebrew: { fontSize: 160, fontWeight: '700', color: '#ffffff', opacity: 1, visible: true },
        english: { fontSize: 120, fontWeight: '400', color: '#e0e0e0', opacity: 0.9, visible: true }
      };
      const defaultBiblePositions = {
        hebrew: { x: 0, y: 25, width: 100, height: 20, paddingTop: 2, paddingBottom: 2, alignH: 'center', alignV: 'center' },
        english: { x: 0, y: 45, width: 100, height: 20, paddingTop: 1, paddingBottom: 1, alignH: 'center', alignV: 'center' }
      };
      const defaultReferenceStyle = { fontSize: 80, fontWeight: '500', color: '#FF8C42', opacity: 0.9 };
      const defaultReferencePosition = { x: 0, y: 70, width: 100, height: 10, alignH: 'center', alignV: 'center' };

      db.run(`
        INSERT INTO bible_themes (id, name, isBuiltIn, isDefault, lineOrder, lineStyles, linePositions, referenceStyle, referencePosition, viewerBackground, canvasDimensions, backgroundBoxes)
        VALUES (?, ?, 1, 1, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        CLASSIC_BIBLE_THEME_ID,
        'Classic Bible',
        JSON.stringify(['hebrew', 'english']),
        JSON.stringify(defaultBibleStyles),
        JSON.stringify(defaultBiblePositions),
        JSON.stringify(defaultReferenceStyle),
        JSON.stringify(defaultReferencePosition),
        JSON.stringify({ type: 'color', color: '#000000' }),
        JSON.stringify({ width: 1920, height: 1080 }),
        JSON.stringify([])
      ]);
      console.log('Created Classic Bible theme');
      saveDatabase();
    }

    // Seed default OBS Songs theme if it doesn't exist
    const CLASSIC_OBS_SONGS_THEME_ID = '00000000-0000-0000-0000-000000000004';
    const existingOBSSongsTheme = db.exec(`SELECT id FROM obs_themes WHERE id = '${CLASSIC_OBS_SONGS_THEME_ID}'`);

    if (existingOBSSongsTheme.length === 0 || existingOBSSongsTheme[0].values.length === 0) {
      const defaultOBSStyles = {
        original: { fontSize: 120, fontWeight: '700', color: '#ffffff', opacity: 1, visible: true },
        transliteration: { fontSize: 90, fontWeight: '400', color: '#e0e0e0', opacity: 0.9, visible: true },
        translation: { fontSize: 100, fontWeight: '400', color: '#b0b0b0', opacity: 0.85, visible: true }
      };
      const defaultOBSPositions = {
        original: { x: 0, y: 70, width: 100, height: 10, paddingTop: 1, paddingBottom: 1, alignH: 'center', alignV: 'center' },
        transliteration: { x: 0, y: 80, width: 100, height: 8, paddingTop: 1, paddingBottom: 1, alignH: 'center', alignV: 'center' },
        translation: { x: 0, y: 88, width: 100, height: 10, paddingTop: 1, paddingBottom: 1, alignH: 'center', alignV: 'center' }
      };

      db.run(`
        INSERT INTO obs_themes (id, name, type, isBuiltIn, isDefault, lineOrder, lineStyles, linePositions, viewerBackground, canvasDimensions, backgroundBoxes)
        VALUES (?, ?, ?, 1, 1, ?, ?, ?, ?, ?, ?)
      `, [
        CLASSIC_OBS_SONGS_THEME_ID,
        'Classic OBS Songs',
        'songs',
        JSON.stringify(['original', 'transliteration', 'translation']),
        JSON.stringify(defaultOBSStyles),
        JSON.stringify(defaultOBSPositions),
        JSON.stringify({ type: 'transparent', color: null }),
        JSON.stringify({ width: 1920, height: 1080 }),
        JSON.stringify([{ x: 0, y: 68, width: 100, height: 32, color: '#000000', opacity: 0.7, borderRadius: 0 }])
      ]);
      console.log('Created Classic OBS Songs theme');
      saveDatabase();
    }

    // Seed default OBS Bible theme if it doesn't exist
    const CLASSIC_OBS_BIBLE_THEME_ID = '00000000-0000-0000-0000-000000000005';
    const existingOBSBibleTheme = db.exec(`SELECT id FROM obs_themes WHERE id = '${CLASSIC_OBS_BIBLE_THEME_ID}'`);

    if (existingOBSBibleTheme.length === 0 || existingOBSBibleTheme[0].values.length === 0) {
      const defaultOBSBibleStyles = {
        hebrew: { fontSize: 100, fontWeight: '700', color: '#ffffff', opacity: 1, visible: true },
        english: { fontSize: 80, fontWeight: '400', color: '#e0e0e0', opacity: 0.9, visible: true }
      };
      const defaultOBSBiblePositions = {
        hebrew: { x: 0, y: 72, width: 100, height: 10, paddingTop: 1, paddingBottom: 1, alignH: 'center', alignV: 'center' },
        english: { x: 0, y: 82, width: 100, height: 10, paddingTop: 1, paddingBottom: 1, alignH: 'center', alignV: 'center' }
      };
      const defaultOBSReferenceStyle = { fontSize: 60, fontWeight: '500', color: '#FF8C42', opacity: 0.9 };
      const defaultOBSReferencePosition = { x: 0, y: 92, width: 100, height: 6, alignH: 'center', alignV: 'center' };

      db.run(`
        INSERT INTO obs_themes (id, name, type, isBuiltIn, isDefault, lineOrder, lineStyles, linePositions, referenceStyle, referencePosition, viewerBackground, canvasDimensions, backgroundBoxes)
        VALUES (?, ?, ?, 1, 1, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        CLASSIC_OBS_BIBLE_THEME_ID,
        'Classic OBS Bible',
        'bible',
        JSON.stringify(['hebrew', 'english']),
        JSON.stringify(defaultOBSBibleStyles),
        JSON.stringify(defaultOBSBiblePositions),
        JSON.stringify(defaultOBSReferenceStyle),
        JSON.stringify(defaultOBSReferencePosition),
        JSON.stringify({ type: 'transparent', color: null }),
        JSON.stringify({ width: 1920, height: 1080 }),
        JSON.stringify([{ x: 0, y: 70, width: 100, height: 30, color: '#000000', opacity: 0.7, borderRadius: 0 }])
      ]);
      console.log('Created Classic OBS Bible theme');
      saveDatabase();
    }

    // Seed default Prayer theme if it doesn't exist
    const CLASSIC_PRAYER_THEME_ID = '00000000-0000-0000-0000-000000000006';
    const existingPrayerTheme = db.exec(`SELECT id FROM prayer_themes WHERE id = '${CLASSIC_PRAYER_THEME_ID}'`);

    if (existingPrayerTheme.length === 0 || existingPrayerTheme[0].values.length === 0) {
      // Classic Prayer theme based on NewClassicPrayer layout
      // Hebrew text aligned right, English text aligned left
      const defaultPrayerStyles = {
        title: { fontSize: 130, fontWeight: '700', color: '#FF8C42', opacity: 1, visible: true },
        titleTranslation: { fontSize: 129, fontWeight: '700', color: '#FF8C42', opacity: 0.9, visible: true },
        subtitle: { fontSize: 94, fontWeight: '700', color: '#ffffff', opacity: 1, visible: true },
        subtitleTranslation: { fontSize: 94, fontWeight: '700', color: '#e0e0e0', opacity: 0.9, visible: true },
        description: { fontSize: 90, fontWeight: '400', color: '#e0e0e0', opacity: 0.9, visible: true },
        descriptionTranslation: { fontSize: 90, fontWeight: '400', color: '#b0b0b0', opacity: 0.85, visible: true }
      };
      const defaultPrayerPositions = {
        title: { x: 0, y: 3, width: 100, height: 8, paddingTop: 1, paddingBottom: 1, alignH: 'right', alignV: 'center' },
        titleTranslation: { x: 0, y: 40.97, width: 100, height: 8.85, paddingTop: 0, paddingBottom: 1, alignH: 'left', alignV: 'center' },
        subtitle: { x: 0, y: 11.15, width: 100, height: 10.87, paddingTop: 2, paddingBottom: 2, alignH: 'right', alignV: 'top' },
        subtitleTranslation: { x: 0, y: 50.90, width: 100, height: 9.61, paddingTop: 1, paddingBottom: 1, alignH: 'left', alignV: 'top' },
        description: { x: 0, y: 21.65, width: 100, height: 10.12, paddingTop: 1, paddingBottom: 1, alignH: 'right', alignV: 'top' },
        descriptionTranslation: { x: 0, y: 60.18, width: 100, height: 10, paddingTop: 1, paddingBottom: 1, alignH: 'left', alignV: 'center' }
      };
      const defaultPrayerReferenceStyle = { fontSize: 56, fontWeight: '500', color: '#ffffff', opacity: 0.8, visible: true };
      const defaultPrayerReferencePosition = { x: 0, y: 31.78, width: 100, height: 5.11, paddingTop: 0, paddingBottom: 0, alignH: 'right', alignV: 'center' };
      const defaultPrayerRefTransStyle = { fontSize: 60, fontWeight: '400', color: '#ffffff', opacity: 0.7, visible: true };
      const defaultPrayerRefTransPosition = { x: 0, y: 70.32, width: 100, height: 8, paddingTop: 0, paddingBottom: 0, alignH: 'left', alignV: 'center' };

      db.run(`
        INSERT INTO prayer_themes (id, name, isBuiltIn, isDefault, lineOrder, lineStyles, linePositions, referenceStyle, referencePosition, referenceTranslationStyle, referenceTranslationPosition, container, viewerBackground, canvasDimensions, backgroundBoxes)
        VALUES (?, ?, 1, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        CLASSIC_PRAYER_THEME_ID,
        'Classic Prayer',
        JSON.stringify(['title', 'titleTranslation', 'subtitle', 'subtitleTranslation', 'description', 'descriptionTranslation', 'reference', 'referenceTranslation']),
        JSON.stringify(defaultPrayerStyles),
        JSON.stringify(defaultPrayerPositions),
        JSON.stringify(defaultPrayerReferenceStyle),
        JSON.stringify(defaultPrayerReferencePosition),
        JSON.stringify(defaultPrayerRefTransStyle),
        JSON.stringify(defaultPrayerRefTransPosition),
        JSON.stringify({ maxWidth: '100%', padding: '2vh 6vw', backgroundColor: 'transparent', borderRadius: '0px' }),
        JSON.stringify({ type: 'transparent', color: null }),
        JSON.stringify({ width: 1920, height: 1080 }),
        JSON.stringify([])
      ]);
      console.log('Created Classic Prayer theme');
      saveDatabase();
    }

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

// Get selected theme IDs from settings
export function getSelectedThemeIds(): {
  viewerThemeId: string | null;
  stageThemeId: string | null;
  bibleThemeId: string | null;
  obsThemeId: string | null;
  prayerThemeId: string | null;
} {
  if (!db) return { viewerThemeId: null, stageThemeId: null, bibleThemeId: null, obsThemeId: null, prayerThemeId: null };

  const result = db.exec(`
    SELECT selectedViewerThemeId, selectedStageThemeId, selectedBibleThemeId, selectedOBSThemeId, selectedPrayerThemeId
    FROM settings WHERE id = 1
  `);

  if (result.length === 0 || result[0].values.length === 0) {
    return { viewerThemeId: null, stageThemeId: null, bibleThemeId: null, obsThemeId: null, prayerThemeId: null };
  }

  const row = result[0].values[0];
  return {
    viewerThemeId: row[0] as string | null,
    stageThemeId: row[1] as string | null,
    bibleThemeId: row[2] as string | null,
    obsThemeId: row[3] as string | null,
    prayerThemeId: row[4] as string | null
  };
}

// Save selected theme ID
export function saveSelectedThemeId(
  themeType: 'viewer' | 'stage' | 'bible' | 'obs' | 'prayer',
  themeId: string | null
): void {
  if (!db) return;

  const columnMap: Record<string, string> = {
    viewer: 'selectedViewerThemeId',
    stage: 'selectedStageThemeId',
    bible: 'selectedBibleThemeId',
    obs: 'selectedOBSThemeId',
    prayer: 'selectedPrayerThemeId'
  };

  const column = columnMap[themeType];
  db.run(`UPDATE settings SET ${column} = ? WHERE id = 1`, [themeId]);
  saveDatabase();
}

/**
 * Helper function for parameterized SELECT queries - returns all matching rows
 * This prevents SQL injection by using prepared statements
 */
export function queryAll(sql: string, params: any[] = []): any[] {
  if (!db) return [];
  try {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const results: any[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      // Parse JSON fields
      for (const key in row) {
        const value = row[key];
        if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) {
          try {
            row[key] = JSON.parse(value);
          } catch {}
        }
      }
      results.push(row);
    }
    stmt.free();
    return results;
  } catch (error) {
    console.error('queryAll error:', error);
    return [];
  }
}

/**
 * Helper function for parameterized SELECT queries - returns single row or null
 * This prevents SQL injection by using prepared statements
 */
export function queryOne(sql: string, params: any[] = []): any | null {
  const results = queryAll(sql, params);
  return results.length > 0 ? results[0] : null;
}

/**
 * Begin a database transaction
 */
export function beginTransaction(): void {
  if (!db) return;
  try {
    db.run('BEGIN TRANSACTION');
  } catch (error) {
    console.error('beginTransaction error:', error);
  }
}

/**
 * Commit a database transaction
 */
export function commitTransaction(): void {
  if (!db) return;
  try {
    db.run('COMMIT');
    saveDatabase();
  } catch (error) {
    console.error('commitTransaction error:', error);
    throw error;
  }
}

/**
 * Rollback a database transaction
 */
export function rollbackTransaction(): void {
  if (!db) return;
  try {
    db.run('ROLLBACK');
  } catch (error) {
    console.error('rollbackTransaction error:', error);
  }
}

/**
 * Execute a function within a transaction
 * Automatically commits on success or rolls back on error
 */
export async function withTransaction<T>(fn: () => T | Promise<T>): Promise<T> {
  beginTransaction();
  try {
    const result = await fn();
    commitTransaction();
    return result;
  } catch (error) {
    rollbackTransaction();
    throw error;
  }
}

export const CLASSIC_THEME_ID = '00000000-0000-0000-0000-000000000001';
export const CLASSIC_STAGE_THEME_ID = '00000000-0000-0000-0000-000000000002';
export const CLASSIC_BIBLE_THEME_ID = '00000000-0000-0000-0000-000000000003';
export const CLASSIC_OBS_SONGS_THEME_ID = '00000000-0000-0000-0000-000000000004';
export const CLASSIC_OBS_BIBLE_THEME_ID = '00000000-0000-0000-0000-000000000005';
export const CLASSIC_PRAYER_THEME_ID = '00000000-0000-0000-0000-000000000006';
