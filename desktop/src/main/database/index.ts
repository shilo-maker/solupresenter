import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import initSqlJs, { Database } from 'sql.js';

// Database path
const dbPath = path.join(app.getPath('userData'), 'solupresenter.sqlite');
const backupDir = path.join(app.getPath('userData'), 'backups');
const MAX_BACKUPS = 5;  // Keep only the last 5 backups

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
const CURRENT_SCHEMA_VERSION = 3;

let db: Database | null = null;

// Debounce state for batched database saves
let saveTimeoutId: ReturnType<typeof setTimeout> | null = null;
let isDirty = false;
const SAVE_DEBOUNCE_MS = 500; // Save at most every 500ms

// Initialization mode - skips individual saves, does one save at the end
let isInitializing = false;

// Rate limiting for backup creation
let lastBackupTime = 0;
const BACKUP_MIN_INTERVAL_MS = 60 * 1000; // Minimum 1 minute between backups

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
  if (fromVersion < 2) {
    console.log('Running migration to version 2: Adding display_theme_overrides table...');
    db.run(`
      CREATE TABLE IF NOT EXISTS display_theme_overrides (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        displayId INTEGER NOT NULL,
        themeType TEXT NOT NULL CHECK(themeType IN ('viewer', 'stage', 'bible', 'prayer')),
        themeId TEXT NOT NULL,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(displayId, themeType)
      )
    `);
    db.run(`CREATE INDEX IF NOT EXISTS idx_display_theme_overrides_displayId ON display_theme_overrides(displayId)`);
  }

  if (fromVersion < 3) {
    console.log('Running migration to version 3: Adding arrangements column to songs...');
    try {
      db.run(`ALTER TABLE songs ADD COLUMN arrangements TEXT DEFAULT '[]'`);
    } catch (e) {
      // Column might already exist
      console.log('[Migration] arrangements column may already exist');
    }
  }

  setSchemaVersion(CURRENT_SCHEMA_VERSION);
  console.log(`Migrations complete. Schema is now at version ${CURRENT_SCHEMA_VERSION}`);
}

/**
 * Get path to seed database bundled with the app
 */
function getSeedDatabasePath(): string {
  const isDev = !app.isPackaged;
  if (isDev) {
    return path.join(__dirname, '..', '..', '..', 'resources', 'seed-database.sqlite');
  }
  // Production - check extraResources
  const possiblePaths = [
    path.join(process.resourcesPath, 'seed-database.sqlite'),
    path.join(app.getAppPath(), 'resources', 'seed-database.sqlite'),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return '';
}

/**
 * Get path to seed media bundled with the app
 */
function getSeedMediaPath(): string {
  const isDev = !app.isPackaged;
  if (isDev) {
    return path.join(__dirname, '..', '..', '..', 'resources', 'seed-media');
  }
  // Production - check extraResources
  const possiblePaths = [
    path.join(process.resourcesPath, 'seed-media'),
    path.join(app.getAppPath(), 'resources', 'seed-media'),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return '';
}

/**
 * Copy seed media files to user's media library
 */
function copySeedMedia(): void {
  const seedMediaPath = getSeedMediaPath();
  if (!seedMediaPath || !fs.existsSync(seedMediaPath)) {
    console.log('[Database] No seed media found');
    return;
  }

  const mediaLibraryPath = path.join(app.getPath('userData'), 'media-library');
  if (!fs.existsSync(mediaLibraryPath)) {
    fs.mkdirSync(mediaLibraryPath, { recursive: true });
  }

  try {
    const files = fs.readdirSync(seedMediaPath);
    for (const file of files) {
      const srcPath = path.join(seedMediaPath, file);
      const destPath = path.join(mediaLibraryPath, file);
      if (!fs.existsSync(destPath)) {
        fs.copyFileSync(srcPath, destPath);
        console.log('[Database] Copied seed media:', file);
      }
    }
  } catch (err) {
    console.error('[Database] Failed to copy seed media:', err);
  }
}

/**
 * Initialize database
 */
export async function initDatabase(): Promise<void> {
  const startTime = Date.now();
  isInitializing = true; // Skip individual saves during init for faster startup
  try {
    const wasmPath = getSqlJsWasmPath();
    const sqlConfig: any = {};
    if (wasmPath && fs.existsSync(wasmPath)) {
      // Load WASM file directly as a buffer for more reliable loading
      sqlConfig.wasmBinary = fs.readFileSync(wasmPath);
    }

    const SQL = await initSqlJs(sqlConfig);

    // Ensure directory exists
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Load existing database, copy from seed, or create new
    let isNewInstall = false;
    if (fs.existsSync(dbPath)) {
      const fileBuffer = fs.readFileSync(dbPath);
      db = new SQL.Database(fileBuffer);
    } else {
      // Check for seed database
      const seedPath = getSeedDatabasePath();
      if (seedPath && fs.existsSync(seedPath)) {
        console.log('[Database] Copying seed database from:', seedPath);
        const seedBuffer = fs.readFileSync(seedPath);
        db = new SQL.Database(seedBuffer);
        isNewInstall = true;
        // Copy seed media files
        copySeedMedia();
      } else {
        db = new SQL.Database();
        isNewInstall = true;
      }
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
        arrangements TEXT DEFAULT '[]',
        usageCount INTEGER DEFAULT 0,
        remoteId TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Migration: Add arrangements column if it doesn't exist (for existing databases)
    try {
      db.run(`ALTER TABLE songs ADD COLUMN arrangements TEXT DEFAULT '[]'`);
    } catch (e) {
      // Column already exists
    }

    // Create indexes on songs for faster lookups and sorting
    db.run(`CREATE INDEX IF NOT EXISTS idx_songs_remoteId ON songs(remoteId)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_songs_title ON songs(title)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_songs_author ON songs(author)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_songs_updatedAt ON songs(updatedAt)`);

    db.run(`
      CREATE TABLE IF NOT EXISTS setlists (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        items TEXT DEFAULT '[]',
        venue TEXT,
        usageCount INTEGER DEFAULT 0,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create index on setlists for faster sorting
    db.run(`CREATE INDEX IF NOT EXISTS idx_setlists_updatedAt ON setlists(updatedAt)`);

    // Add venue column to existing setlists table if it doesn't exist
    try {
      db.run(`ALTER TABLE setlists ADD COLUMN venue TEXT`);
    } catch (e) {
      // Column already exists, ignore error
    }

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
        selectedOBSBibleThemeId TEXT,
        selectedPrayerThemeId TEXT,
        selectedOBSPrayerThemeId TEXT
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
    if (!columnNames.includes('selectedOBSBibleThemeId')) {
      db.run('ALTER TABLE settings ADD COLUMN selectedOBSBibleThemeId TEXT');
    }
    if (!columnNames.includes('selectedPrayerThemeId')) {
      db.run('ALTER TABLE settings ADD COLUMN selectedPrayerThemeId TEXT');
    }
    if (!columnNames.includes('selectedOBSPrayerThemeId')) {
      db.run('ALTER TABLE settings ADD COLUMN selectedOBSPrayerThemeId TEXT');
    }

    // Save after creating tables
    saveDatabase();

    // Check if any default viewer theme already exists (from seed database)
    const existingDefaultViewerTheme = db.exec(`SELECT id FROM viewer_themes WHERE isDefault = 1`);
    const hasDefaultViewerTheme = existingDefaultViewerTheme.length > 0 && existingDefaultViewerTheme[0].values.length > 0;

    // Seed classic theme if it doesn't exist
    const CLASSIC_THEME_ID = '00000000-0000-0000-0000-000000000001';
    const existingTheme = db.exec(`SELECT id FROM viewer_themes WHERE id = '${CLASSIC_THEME_ID}'`);

    if (existingTheme.length === 0 || existingTheme[0].values.length === 0) {
      // Default Song Theme - with flow positioning for stacked lines
      const defaultStyles = {
        original: { fontSize: 178, fontWeight: '700', color: '#ffffff', opacity: 1, visible: true },
        transliteration: { fontSize: 136, fontWeight: '400', color: '#ffffff', opacity: 0.9, visible: true },
        translation: { fontSize: 146, fontWeight: '400', color: '#cfcfcf', opacity: 0.85, visible: true }
      };
      const defaultLinePositions = {
        original: { x: 0, y: 31.79, width: 100, height: 11.38, paddingTop: 0, paddingBottom: 0, alignH: 'center', alignV: 'center', autoHeight: true, growDirection: 'up', positionMode: 'absolute', flowGap: 1 },
        transliteration: { x: 0, y: 38.97, width: 100, height: 12.14, paddingTop: 0, paddingBottom: 0, alignH: 'center', alignV: 'center', autoHeight: true, positionMode: 'flow', flowGap: 0, flowAnchor: 'original' },
        translation: { x: 0, y: 51.10, width: 100, height: 26.92, paddingTop: 0, paddingBottom: 0, alignH: 'center', alignV: 'center', autoHeight: true, positionMode: 'flow', flowGap: 0, flowAnchor: 'transliteration' }
      };

      db.run(`
        INSERT INTO viewer_themes (id, name, isBuiltIn, isDefault, lineOrder, lineStyles, positioning, container, viewerBackground, canvasDimensions, linePositions, backgroundBoxes)
        VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        CLASSIC_THEME_ID,
        'Default',
        hasDefaultViewerTheme ? 0 : 1,
        JSON.stringify(['original', 'transliteration', 'translation']),
        JSON.stringify(defaultStyles),
        JSON.stringify({ vertical: 'center', horizontal: 'center' }),
        JSON.stringify({ maxWidth: '100%', padding: '2vh 6vw', backgroundColor: 'transparent', borderRadius: '0px' }),
        JSON.stringify({ type: 'color', color: '#000000' }),
        JSON.stringify({ width: 1920, height: 1080 }),
        JSON.stringify(defaultLinePositions),
        JSON.stringify([])
      ]);
      
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

    // Create indexes for media_items for fast filtering and lookups
    db.run(`CREATE INDEX IF NOT EXISTS idx_media_items_folderId ON media_items(folderId)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_media_items_type ON media_items(type)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_media_items_originalPath ON media_items(originalPath)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_media_items_createdAt ON media_items(createdAt)`);

    // Migration: Add folderId column if it doesn't exist
    try {
      db.run(`ALTER TABLE media_items ADD COLUMN folderId TEXT`);
    } catch {
      // Column already exists
    }

    // Migration: Add tags column if it doesn't exist
    try {
      db.run(`ALTER TABLE media_items ADD COLUMN tags TEXT`);
    } catch {
      // Column already exists
    }

    // Migration: Add width column if it doesn't exist
    try {
      db.run(`ALTER TABLE media_items ADD COLUMN width INTEGER`);
    } catch {
      // Column already exists
    }

    // Migration: Add height column if it doesn't exist
    try {
      db.run(`ALTER TABLE media_items ADD COLUMN height INTEGER`);
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
        nextSlideText TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Migration: Add nextSlideText column to stage_monitor_themes if it doesn't exist
    try {
      db.run(`ALTER TABLE stage_monitor_themes ADD COLUMN nextSlideText TEXT`);
      console.log('[DB Migration] Added nextSlideText column to stage_monitor_themes');
    } catch {
      // Column already exists
    }

    // Check if any default stage theme already exists (from seed database)
    const existingDefaultStageTheme = db.exec(`SELECT id FROM stage_monitor_themes WHERE isDefault = 1`);
    const hasDefaultStageTheme = existingDefaultStageTheme.length > 0 && existingDefaultStageTheme[0].values.length > 0;

    // Seed default stage monitor theme if it doesn't exist
    const CLASSIC_STAGE_THEME_ID = '00000000-0000-0000-0000-000000000002';
    const existingStageTheme = db.exec(`SELECT id FROM stage_monitor_themes WHERE id = '${CLASSIC_STAGE_THEME_ID}'`);

    if (existingStageTheme.length === 0 || existingStageTheme[0].values.length === 0) {
      // Default Stage Theme
      const defaultColors = {
        background: '#0a0a0a',
        text: '#ffffff',
        accent: '#4a90d9',
        secondary: '#888888',
        border: '#333333'
      };
      const defaultElements = {
        header: { visible: true, x: 0, y: 0, width: 100, height: 8, backgroundColor: 'rgba(255,255,255,0.05)' },
        clock: { visible: true, x: 67.86, y: 2.07, width: 30.14, height: 5.93, color: '#ffffff', fontFamily: 'monospace', showSeconds: false, fontSize: 126 },
        songTitle: { visible: true, x: 2, y: 2.07, width: 64.17, height: 5.93, color: '#4a90d9', fontWeight: '600', fontSize: 138 },
        currentSlideArea: { visible: true, x: 2, y: 12, width: 64, height: 84, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12 },
        nextSlideArea: { visible: true, x: 68, y: 12, width: 30, height: 84, backgroundColor: '#1a1a1a', borderRadius: 8, labelText: 'Next', opacity: 0.8 }
      };
      const defaultCurrentSlideText = {
        original: { visible: true, color: '#ffffff', fontSize: 113, fontWeight: 'bold', opacity: 1, x: 5, y: 37.28, width: 58, height: 10.37, alignH: 'center', alignV: 'center', positionMode: 'absolute', autoHeight: true, growDirection: 'down' },
        transliteration: { visible: true, color: '#ffffff', fontSize: 91, fontWeight: '400', opacity: 1, x: 5, y: 49.14, width: 58, height: 6.91, alignH: 'center', alignV: 'center', positionMode: 'flow', autoHeight: true, growDirection: 'down', flowGap: 2, flowAnchor: 'original' },
        translation: { visible: true, color: '#ffffff', fontSize: 86, fontWeight: '400', opacity: 0.9, x: 5, y: 55.57, width: 58, height: 5.68, alignH: 'center', alignV: 'center', positionMode: 'flow', autoHeight: true, growDirection: 'down', flowGap: 2, flowAnchor: 'transliteration' }
      };
      const defaultNextSlideText = {
        original: { visible: true, color: '#8f8f8f', fontSize: 115, fontWeight: 'bold', opacity: 0.8, x: 70, y: 39.63, width: 26, height: 6.67, alignH: 'center', alignV: 'center', positionMode: 'absolute', autoHeight: true, growDirection: 'up' },
        transliteration: { visible: true, color: '#8f8f8f', fontSize: 91, fontWeight: '400', opacity: 0.7, x: 70, y: 46.30, width: 26, height: 3.21, alignH: 'center', alignV: 'center', positionMode: 'flow', autoHeight: true, growDirection: 'down', flowGap: 0, flowAnchor: 'nextOriginal' },
        translation: { visible: true, color: '#8f8f8f', fontSize: 92, fontWeight: '400', opacity: 0.7, x: 70, y: 50.49, width: 26, height: 3.21, alignH: 'center', alignV: 'center', positionMode: 'flow', autoHeight: true, growDirection: 'down', flowGap: 0, flowAnchor: 'nextTransliteration' }
      };

      db.run(`
        INSERT INTO stage_monitor_themes (id, name, isBuiltIn, isDefault, canvasDimensions, colors, elements, currentSlideText, nextSlideText)
        VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?)
      `, [
        CLASSIC_STAGE_THEME_ID,
        'Default Stage',
        hasDefaultStageTheme ? 0 : 1,
        JSON.stringify({ width: 1920, height: 1080 }),
        JSON.stringify(defaultColors),
        JSON.stringify(defaultElements),
        JSON.stringify(defaultCurrentSlideText),
        JSON.stringify(defaultNextSlideText)
      ]);
      
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
        referenceEnglishStyle TEXT,
        referenceEnglishPosition TEXT,
        viewerBackground TEXT,
        canvasDimensions TEXT DEFAULT '{"width":1920,"height":1080}',
        backgroundBoxes TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create bible_verses table for local Bible storage
    db.run(`
      CREATE TABLE IF NOT EXISTS bible_verses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        book TEXT NOT NULL,
        bookNumber INTEGER NOT NULL,
        testament TEXT NOT NULL CHECK(testament IN ('old', 'new')),
        chapter INTEGER NOT NULL,
        verse INTEGER NOT NULL,
        hebrewText TEXT DEFAULT '',
        englishText TEXT DEFAULT '',
        UNIQUE(book, chapter, verse)
      )
    `);

    // Create index for fast Bible lookups
    db.run(`CREATE INDEX IF NOT EXISTS idx_bible_book_chapter ON bible_verses(book, chapter)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_bible_testament ON bible_verses(testament)`);

    // Create audio_playlists table
    db.run(`
      CREATE TABLE IF NOT EXISTS audio_playlists (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        tracks TEXT DEFAULT '[]',
        shuffle INTEGER DEFAULT 0,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    db.run(`CREATE INDEX IF NOT EXISTS idx_audio_playlists_name ON audio_playlists(name)`);

    // Create display_theme_overrides table
    db.run(`
      CREATE TABLE IF NOT EXISTS display_theme_overrides (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        displayId INTEGER NOT NULL,
        themeType TEXT NOT NULL CHECK(themeType IN ('viewer', 'stage', 'bible', 'prayer')),
        themeId TEXT NOT NULL,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(displayId, themeType)
      )
    `);
    db.run(`CREATE INDEX IF NOT EXISTS idx_display_theme_overrides_displayId ON display_theme_overrides(displayId)`);

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

    // Add referenceEnglishStyle and referenceEnglishPosition columns to bible_themes if they don't exist (migration)
    const bibleThemeColumns = db.exec("PRAGMA table_info(bible_themes)");
    const existingBibleColumns = bibleThemeColumns.length > 0
      ? bibleThemeColumns[0].values.map((row: any) => row[1])
      : [];
    console.log('[DB Init] Existing bible_themes columns:', existingBibleColumns);

    if (!existingBibleColumns.includes('referenceEnglishStyle')) {
      console.log('[DB Init] Adding referenceEnglishStyle column to bible_themes');
      db.run(`ALTER TABLE bible_themes ADD COLUMN referenceEnglishStyle TEXT`);
      saveDatabase();
    }
    if (!existingBibleColumns.includes('referenceEnglishPosition')) {
      console.log('[DB Init] Adding referenceEnglishPosition column to bible_themes');
      db.run(`ALTER TABLE bible_themes ADD COLUMN referenceEnglishPosition TEXT`);
      saveDatabase();
    }

    // Add referenceEnglishStyle and referenceEnglishPosition columns to obs_themes if they don't exist (migration)
    const obsThemeColumns = db.exec("PRAGMA table_info(obs_themes)");
    const existingOBSColumns = obsThemeColumns.length > 0
      ? obsThemeColumns[0].values.map((row: any) => row[1])
      : [];
    console.log('[DB Init] Existing obs_themes columns:', existingOBSColumns);

    if (!existingOBSColumns.includes('referenceEnglishStyle')) {
      console.log('[DB Init] Adding referenceEnglishStyle column to obs_themes');
      db.run(`ALTER TABLE obs_themes ADD COLUMN referenceEnglishStyle TEXT`);
      saveDatabase();
    }
    if (!existingOBSColumns.includes('referenceEnglishPosition')) {
      console.log('[DB Init] Adding referenceEnglishPosition column to obs_themes');
      db.run(`ALTER TABLE obs_themes ADD COLUMN referenceEnglishPosition TEXT`);
      saveDatabase();
    }

    // Check if any default Bible theme already exists (from seed database)
    const existingDefaultBibleTheme = db.exec(`SELECT id FROM bible_themes WHERE isDefault = 1`);
    const hasDefaultBibleTheme = existingDefaultBibleTheme.length > 0 && existingDefaultBibleTheme[0].values.length > 0;

    // Seed default Bible theme if it doesn't exist
    const CLASSIC_BIBLE_THEME_ID = '00000000-0000-0000-0000-000000000003';
    console.log('[DB Init] Checking for classic Bible theme...');
    const existingBibleTheme = db.exec(`SELECT id FROM bible_themes WHERE id = '${CLASSIC_BIBLE_THEME_ID}'`);
    console.log('[DB Init] Existing Bible theme check result:', existingBibleTheme.length, existingBibleTheme[0]?.values?.length);

    // Default reference styles for Bible themes
    const defaultReferenceStyle = { fontSize: 63, fontWeight: '400', color: '#a0a0a0', opacity: 1, visible: true, borderTop: 0, borderBottom: 1, borderLeft: 1, borderRadiusTopLeft: 0, borderRadiusBottomLeft: 4 };
    const defaultReferencePosition = { x: 2, y: 40.97, width: 20.88, height: 8.10, paddingTop: 0, paddingBottom: 0, alignH: 'left', alignV: 'center', autoHeight: true, positionMode: 'flow', flowGap: 0, flowAnchor: 'hebrew', paddingRight: 0, paddingLeft: 5 };
    const defaultReferenceEnglishStyle = { fontSize: 61, fontWeight: '400', color: '#a0a0a0', opacity: 1, visible: true, borderRight: 1, borderBottom: 1, borderRadiusBottomRight: 5 };
    const defaultReferenceEnglishPosition = { x: 77.12, y: 90, width: 20.88, height: 5, paddingTop: 0, paddingBottom: 0, alignH: 'right', alignV: 'center', autoHeight: true, positionMode: 'flow', flowGap: 0, flowAnchor: 'english', paddingRight: 9 };

    if (existingBibleTheme.length === 0 || existingBibleTheme[0].values.length === 0) {
      // Default Bible Theme - with flow positioning
      const defaultBibleStyles = {
        hebrew: { fontSize: 143, fontWeight: '600', color: '#ffffff', opacity: 1, visible: true },
        english: { fontSize: 120, fontWeight: '400', color: '#e0e0e0', opacity: 0.9, visible: true }
      };
      const defaultBiblePositions = {
        hebrew: { x: 2, y: 1.57, width: 96, height: 11.24, paddingTop: 0, paddingBottom: 0, alignH: 'right', alignV: 'center', autoHeight: true },
        english: { x: 2, y: 51.27, width: 96, height: 20.13, paddingTop: 1, paddingBottom: 1, alignH: 'left', alignV: 'center', autoHeight: true, positionMode: 'flow', flowGap: 1, flowAnchor: 'reference' }
      };

      db.run(`
        INSERT INTO bible_themes (id, name, isBuiltIn, isDefault, lineOrder, lineStyles, linePositions, referenceStyle, referencePosition, referenceEnglishStyle, referenceEnglishPosition, viewerBackground, canvasDimensions, backgroundBoxes)
        VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        CLASSIC_BIBLE_THEME_ID,
        'Default Bible',
        hasDefaultBibleTheme ? 0 : 1,
        JSON.stringify(['hebrew', 'reference', 'english', 'referenceEnglish']),
        JSON.stringify(defaultBibleStyles),
        JSON.stringify(defaultBiblePositions),
        JSON.stringify(defaultReferenceStyle),
        JSON.stringify(defaultReferencePosition),
        JSON.stringify(defaultReferenceEnglishStyle),
        JSON.stringify(defaultReferenceEnglishPosition),
        JSON.stringify({ type: 'color', color: '#000000' }),
        JSON.stringify({ width: 1920, height: 1080 }),
        JSON.stringify([])
      ]);
      
      saveDatabase();
    } else {
      // Migration: Update existing classic Bible theme to add referenceEnglishStyle and referenceEnglishPosition if missing
      const classicTheme = db.exec(`SELECT referenceEnglishStyle, referenceEnglishPosition FROM bible_themes WHERE id = '${CLASSIC_BIBLE_THEME_ID}'`);
      if (classicTheme.length > 0 && classicTheme[0].values.length > 0) {
        const [refEnglishStyle, refEnglishPosition] = classicTheme[0].values[0];
        if (!refEnglishStyle || !refEnglishPosition) {
          console.log('[DB Migration] Adding referenceEnglishStyle and referenceEnglishPosition to Classic Bible theme');
          db.run(`
            UPDATE bible_themes
            SET referenceEnglishStyle = ?, referenceEnglishPosition = ?
            WHERE id = ?
          `, [
            JSON.stringify(defaultReferenceEnglishStyle),
            JSON.stringify(defaultReferenceEnglishPosition),
            CLASSIC_BIBLE_THEME_ID
          ]);
          saveDatabase();
        }
      }
    }

    // Check if any default OBS themes already exist (from seed database)
    const existingDefaultOBSSongsTheme = db.exec(`SELECT id FROM obs_themes WHERE isDefault = 1 AND type = 'songs'`);
    const hasDefaultOBSSongsTheme = existingDefaultOBSSongsTheme.length > 0 && existingDefaultOBSSongsTheme[0].values.length > 0;
    const existingDefaultOBSBibleTheme = db.exec(`SELECT id FROM obs_themes WHERE isDefault = 1 AND type = 'bible'`);
    const hasDefaultOBSBibleTheme = existingDefaultOBSBibleTheme.length > 0 && existingDefaultOBSBibleTheme[0].values.length > 0;
    const existingDefaultOBSPrayerTheme = db.exec(`SELECT id FROM obs_themes WHERE isDefault = 1 AND type = 'prayer'`);
    const hasDefaultOBSPrayerTheme = existingDefaultOBSPrayerTheme.length > 0 && existingDefaultOBSPrayerTheme[0].values.length > 0;

    // Seed default OBS Songs theme if it doesn't exist
    const CLASSIC_OBS_SONGS_THEME_ID = '00000000-0000-0000-0000-000000000004';
    const existingOBSSongsTheme = db.exec(`SELECT id FROM obs_themes WHERE id = '${CLASSIC_OBS_SONGS_THEME_ID}'`);

    if (existingOBSSongsTheme.length === 0 || existingOBSSongsTheme[0].values.length === 0) {
      // Default OBS Songs Theme - with flow positioning
      const defaultOBSStyles = {
        original: { fontSize: 114, fontWeight: '700', color: '#ffffff', opacity: 1, visible: true },
        transliteration: { fontSize: 88, fontWeight: '400', color: '#ffffff', opacity: 1, visible: true },
        translation: { fontSize: 90, fontWeight: '400', color: '#ffffff', opacity: 1, visible: true }
      };
      const defaultOBSPositions = {
        original: { x: 0, y: 74.64, width: 100, height: 10, paddingTop: 1, paddingBottom: 1, alignH: 'center', alignV: 'center', autoHeight: true },
        transliteration: { x: 0, y: 80, width: 100, height: 8, paddingTop: 1, paddingBottom: 1, alignH: 'center', alignV: 'center', autoHeight: true, positionMode: 'flow', flowGap: 0, flowAnchor: 'original' },
        translation: { x: 0, y: 88, width: 100, height: 10, paddingTop: 1, paddingBottom: 1, alignH: 'center', alignV: 'center', autoHeight: true, positionMode: 'flow', flowGap: 0, flowAnchor: 'transliteration' }
      };

      db.run(`
        INSERT INTO obs_themes (id, name, type, isBuiltIn, isDefault, lineOrder, lineStyles, linePositions, viewerBackground, canvasDimensions, backgroundBoxes)
        VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)
      `, [
        CLASSIC_OBS_SONGS_THEME_ID,
        'Default OBS Songs',
        'songs',
        hasDefaultOBSSongsTheme ? 0 : 1,
        JSON.stringify(['original', 'transliteration', 'translation']),
        JSON.stringify(defaultOBSStyles),
        JSON.stringify(defaultOBSPositions),
        JSON.stringify({ type: 'transparent', color: null }),
        JSON.stringify({ width: 1920, height: 1080 }),
        JSON.stringify([])
      ]);
      
      saveDatabase();
    }

    // Seed default OBS Bible theme if it doesn't exist
    const CLASSIC_OBS_BIBLE_THEME_ID = '00000000-0000-0000-0000-000000000005';
    const existingOBSBibleTheme = db.exec(`SELECT id FROM obs_themes WHERE id = '${CLASSIC_OBS_BIBLE_THEME_ID}'`);

    if (existingOBSBibleTheme.length === 0 || existingOBSBibleTheme[0].values.length === 0) {
      // Default OBS Bible Theme - with paper texture background box and flow positioning
      const defaultOBSBibleStyles = {
        hebrew: { fontSize: 83, fontWeight: '700', color: '#000000', opacity: 1, visible: true },
        english: { fontSize: 72, fontWeight: '600', color: '#000000', opacity: 1, visible: true }
      };
      const defaultOBSBiblePositions = {
        hebrew: { x: 2.87, y: 33.12, width: 32.35, height: 31.37, paddingTop: 0, paddingBottom: 0, alignH: 'right', alignV: 'top', autoHeight: true, growDirection: 'up' },
        english: { x: 2.65, y: 29.18, width: 32.35, height: 44.97, paddingTop: 0, paddingBottom: 0, alignH: 'left', alignV: 'top', autoHeight: true, positionMode: 'flow', flowGap: 1, flowAnchor: 'reference' }
      };
      const defaultOBSReferenceStyle = { fontSize: 54, fontWeight: '400', color: '#000000', opacity: 1, visible: true };
      const defaultOBSReferencePosition = { x: 2.65, y: 13.89, width: 26.68, height: 12.81, paddingTop: 0, paddingBottom: 0, alignH: 'left', alignV: 'center', autoHeight: true, positionMode: 'flow', flowGap: 1, flowAnchor: 'hebrew' };
      const defaultOBSReferenceEnglishStyle = { fontSize: 50, fontWeight: '400', color: '#000000', opacity: 1, visible: true };
      const defaultOBSReferenceEnglishPosition = { x: 10.15, y: 66.21, width: 24.85, height: 31.37, paddingTop: 0, paddingBottom: 0, alignH: 'right', alignV: 'center', autoHeight: true, positionMode: 'flow', flowGap: 0, flowAnchor: 'english' };

      db.run(`
        INSERT INTO obs_themes (id, name, type, isBuiltIn, isDefault, lineOrder, lineStyles, linePositions, referenceStyle, referencePosition, referenceEnglishStyle, referenceEnglishPosition, viewerBackground, canvasDimensions, backgroundBoxes)
        VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        CLASSIC_OBS_BIBLE_THEME_ID,
        'Default OBS Bible',
        'bible',
        hasDefaultOBSBibleTheme ? 0 : 1,
        JSON.stringify(['hebrew', 'reference', 'english', 'referenceEnglish']),
        JSON.stringify(defaultOBSBibleStyles),
        JSON.stringify(defaultOBSBiblePositions),
        JSON.stringify(defaultOBSReferenceStyle),
        JSON.stringify(defaultOBSReferencePosition),
        JSON.stringify(defaultOBSReferenceEnglishStyle),
        JSON.stringify(defaultOBSReferenceEnglishPosition),
        JSON.stringify({ type: 'transparent', color: null }),
        JSON.stringify({ width: 1920, height: 1080 }),
        JSON.stringify([{ id: 'box-default', x: 0, y: 0, width: 38.09, height: 100, color: '#e8dcc8', opacity: 0.87, borderRadius: 8, texture: 'paper', textureOpacity: 0.3 }])
      ]);
      
      saveDatabase();
    }

    // Seed default OBS Prayer theme if it doesn't exist
    const CLASSIC_OBS_PRAYER_THEME_ID = '00000000-0000-0000-0000-000000000008';
    const existingOBSPrayerTheme = db.exec(`SELECT id FROM obs_themes WHERE id = '${CLASSIC_OBS_PRAYER_THEME_ID}'`);

    if (existingOBSPrayerTheme.length === 0 || existingOBSPrayerTheme[0].values.length === 0) {
      // Default OBS Prayer theme - with paper texture background and flow positioning
      const defaultOBSPrayerStyles = {
        title: { fontSize: 130, fontWeight: '700', color: '#000000', opacity: 1, visible: true },
        titleTranslation: { fontSize: 129, fontWeight: '700', color: '#000000', opacity: 0.9, visible: true },
        subtitle: { fontSize: 94, fontWeight: '700', color: '#000000', opacity: 1, visible: true },
        subtitleTranslation: { fontSize: 94, fontWeight: '700', color: '#000000', opacity: 0.9, visible: true },
        description: { fontSize: 90, fontWeight: '400', color: '#000000', opacity: 0.9, visible: true },
        descriptionTranslation: { fontSize: 90, fontWeight: '400', color: '#000000', opacity: 0.85, visible: true },
        reference: { fontSize: 56, fontWeight: '500', color: '#000000', opacity: 0.8, visible: true },
        referenceTranslation: { fontSize: 60, fontWeight: '400', color: '#000000', opacity: 0.7, visible: true }
      };
      // Side-by-side positioning with flow for OBS overlay
      const defaultOBSPrayerPositions = {
        title: { x: 2.65, y: 16.17, width: 39.71, height: 9.15, paddingTop: 1, paddingBottom: 1, alignH: 'right', alignV: 'center', autoHeight: true },
        titleTranslation: { x: 3.24, y: 55.35, width: 39.71, height: 9.15, paddingTop: 1, paddingBottom: 1, alignH: 'left', alignV: 'center', autoHeight: true, positionMode: 'flow', flowGap: 3, flowAnchor: 'reference' },
        subtitle: { x: 3.24, y: 21.65, width: 39.71, height: 6.54, paddingTop: 1, paddingBottom: 1, alignH: 'right', alignV: 'center', autoHeight: true, positionMode: 'flow', flowGap: 0, flowAnchor: 'title' },
        subtitleTranslation: { x: 3.24, y: 66.85, width: 39.71, height: 6.54, paddingTop: 1, paddingBottom: 1, alignH: 'left', alignV: 'center', autoHeight: true, positionMode: 'flow', flowGap: 0, flowAnchor: 'titleTranslation' },
        description: { x: 3.24, y: 31.18, width: 39.71, height: 6.27, paddingTop: 1, paddingBottom: 1, alignH: 'right', alignV: 'center', autoHeight: true, positionMode: 'flow', flowGap: 0, flowAnchor: 'subtitle' },
        descriptionTranslation: { x: 3.24, y: 79.97, width: 39.71, height: 6.27, paddingTop: 1, paddingBottom: 1, alignH: 'left', alignV: 'center', autoHeight: true, positionMode: 'flow', flowGap: 0, flowAnchor: 'subtitleTranslation' },
        reference: { x: 3.24, y: 41.63, width: 39.71, height: 5, paddingTop: 0, paddingBottom: 0, alignH: 'right', alignV: 'center', autoHeight: true, positionMode: 'flow', flowGap: 0, flowAnchor: 'description' },
        referenceTranslation: { x: 3.24, y: 86.25, width: 39.71, height: 5, paddingTop: 0, paddingBottom: 0, alignH: 'left', alignV: 'center', autoHeight: true, positionMode: 'flow', flowGap: 0, flowAnchor: 'descriptionTranslation' }
      };

      db.run(`
        INSERT INTO obs_themes (id, name, type, isBuiltIn, isDefault, lineOrder, lineStyles, linePositions, viewerBackground, canvasDimensions, backgroundBoxes)
        VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)
      `, [
        CLASSIC_OBS_PRAYER_THEME_ID,
        'Default OBS Prayer',
        'prayer',
        hasDefaultOBSPrayerTheme ? 0 : 1,
        JSON.stringify(['title', 'subtitle', 'description', 'reference', 'titleTranslation', 'subtitleTranslation', 'descriptionTranslation', 'referenceTranslation']),
        JSON.stringify(defaultOBSPrayerStyles),
        JSON.stringify(defaultOBSPrayerPositions),
        JSON.stringify({ type: 'transparent', color: null }),
        JSON.stringify({ width: 1920, height: 1080 }),
        JSON.stringify([{ id: 'default-box', x: 0, y: 0.07, width: 45, height: 99.87, color: '#d4c4a8', opacity: 0.84, borderRadius: 0, texture: 'paper', textureOpacity: 0.3 }])
      ]);
      
      saveDatabase();
    }

    // Check if any default Prayer theme already exists (from seed database)
    const existingDefaultPrayerTheme = db.exec(`SELECT id FROM prayer_themes WHERE isDefault = 1`);
    const hasDefaultPrayerTheme = existingDefaultPrayerTheme.length > 0 && existingDefaultPrayerTheme[0].values.length > 0;

    // Seed default Prayer theme if it doesn't exist
    const CLASSIC_PRAYER_THEME_ID = '00000000-0000-0000-0000-000000000006';
    const existingPrayerTheme = db.exec(`SELECT id FROM prayer_themes WHERE id = '${CLASSIC_PRAYER_THEME_ID}'`);

    if (existingPrayerTheme.length === 0 || existingPrayerTheme[0].values.length === 0) {
      // Default Prayer theme - Hebrew text aligned right, English text aligned left, with flow positioning
      const defaultPrayerStyles = {
        title: { fontSize: 165, fontWeight: '700', color: '#ffffff', opacity: 1, visible: true },
        titleTranslation: { fontSize: 147, fontWeight: '700', color: '#ffffff', opacity: 0.9, visible: true },
        subtitle: { fontSize: 113, fontWeight: '700', color: '#ffffff', opacity: 1, visible: true },
        subtitleTranslation: { fontSize: 109, fontWeight: '700', color: '#e0e0e0', opacity: 0.9, visible: true },
        description: { fontSize: 97, fontWeight: '400', color: '#e0e0e0', opacity: 0.9, visible: true },
        descriptionTranslation: { fontSize: 95, fontWeight: '400', color: '#b0b0b0', opacity: 0.85, visible: true }
      };
      const defaultPrayerPositions = {
        title: { x: 3.63, y: 8.34, width: 92.75, height: 9.11, paddingTop: 0, paddingBottom: 0, alignH: 'right', alignV: 'center', autoHeight: true },
        titleTranslation: { x: 3.63, y: 41.60, width: 92.75, height: 9.11, paddingTop: 0, paddingBottom: 0, alignH: 'left', alignV: 'center', autoHeight: true, positionMode: 'flow', flowGap: 2, flowAnchor: 'reference' },
        subtitle: { x: 3.63, y: 10.78, width: 92.75, height: 6.67, paddingTop: 0, paddingBottom: 0, alignH: 'right', alignV: 'center', autoHeight: true, positionMode: 'flow', flowGap: 0, flowAnchor: 'title' },
        subtitleTranslation: { x: 3.63, y: 50.71, width: 92.75, height: 6.67, paddingTop: 0, paddingBottom: 0, alignH: 'left', alignV: 'center', autoHeight: true, positionMode: 'flow', flowGap: 0, flowAnchor: 'titleTranslation' },
        description: { x: 3.63, y: 21.66, width: 92.75, height: 6.22, paddingTop: 0, paddingBottom: 0, alignH: 'right', alignV: 'center', autoHeight: true, positionMode: 'flow', flowGap: 0, flowAnchor: 'subtitle' },
        descriptionTranslation: { x: 3.63, y: 60.32, width: 92.75, height: 6.22, paddingTop: 0, paddingBottom: 0, alignH: 'left', alignV: 'center', autoHeight: true, positionMode: 'flow', flowGap: 0, flowAnchor: 'subtitleTranslation' }
      };
      const defaultPrayerReferenceStyle = { fontSize: 71, fontWeight: '500', color: '#ffffff', opacity: 0.8, visible: true };
      const defaultPrayerReferencePosition = { x: 75.75, y: 31.78, width: 20.63, height: 5.11, paddingTop: 0, paddingBottom: 0, alignH: 'right', alignV: 'center', autoHeight: true, positionMode: 'flow', flowGap: 0, flowAnchor: 'description' };
      const defaultPrayerRefTransStyle = { fontSize: 60, fontWeight: '400', color: '#ffffff', opacity: 0.7, visible: true };
      const defaultPrayerRefTransPosition = { x: 3.63, y: 70.10, width: 24.88, height: 5.11, paddingTop: 0, paddingBottom: 0, alignH: 'left', alignV: 'center', autoHeight: true, positionMode: 'flow', flowGap: 0, flowAnchor: 'descriptionTranslation' };

      db.run(`
        INSERT INTO prayer_themes (id, name, isBuiltIn, isDefault, lineOrder, lineStyles, linePositions, referenceStyle, referencePosition, referenceTranslationStyle, referenceTranslationPosition, container, viewerBackground, canvasDimensions, backgroundBoxes)
        VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        CLASSIC_PRAYER_THEME_ID,
        'Default Prayer',
        hasDefaultPrayerTheme ? 0 : 1,
        JSON.stringify(['title', 'subtitle', 'description', 'reference', 'titleTranslation', 'subtitleTranslation', 'descriptionTranslation', 'referenceTranslation']),
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
      
      saveDatabase();
    }

    // End initialization mode and do a single save
    isInitializing = false;
    if (isDirty) {
      performSave();
    }

    console.log(`[Database] Initialized in ${Date.now() - startTime}ms`);
  } catch (error) {
    isInitializing = false;
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

/**
 * Internal function to actually save the database to disk
 */
function performSave(): void {
  if (db && isDirty) {
    try {
      const data = db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(dbPath, buffer);
      isDirty = false;
      console.log('[Database] Saved to disk');
    } catch (error) {
      console.error('[Database] Failed to save to disk:', error);
      // Emit error event for potential UI notification
      // Keep isDirty = true so save will be retried on next saveDatabase() call
    }
  }
}

/**
 * Save database to file (debounced)
 * Multiple calls within SAVE_DEBOUNCE_MS will be batched into one save
 * During initialization, saves are skipped and done once at the end
 */
export function saveDatabase(): void {
  if (!db) return;

  isDirty = true;

  // During initialization, skip individual saves - we'll save once at the end
  if (isInitializing) return;

  // Clear existing timeout to reset the debounce
  if (saveTimeoutId) {
    clearTimeout(saveTimeoutId);
  }

  // Schedule a save after the debounce period
  saveTimeoutId = setTimeout(() => {
    performSave();
    saveTimeoutId = null;
  }, SAVE_DEBOUNCE_MS);
}

/**
 * Flush any pending database save immediately
 * Call this on app quit or when you need immediate persistence
 */
export function flushDatabase(): void {
  if (saveTimeoutId) {
    clearTimeout(saveTimeoutId);
    saveTimeoutId = null;
  }
  performSave();
}

/**
 * Force immediate save without debouncing (for critical operations)
 */
export function saveDatabaseSync(): void {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
    isDirty = false;
  }
}

/**
 * Create a backup of the database before destructive operations
 * Returns the backup path if successful, null if failed
 * Rate-limited to prevent backup spam on frequent operations
 */
export function createBackup(operation?: string): string | null {
  if (!db) {
    console.warn('[Database] Cannot create backup: database not initialized');
    return null;
  }

  // Rate limit backups to prevent spam on frequent delete operations
  const now = Date.now();
  if (now - lastBackupTime < BACKUP_MIN_INTERVAL_MS) {
    console.log('[Database] Skipping backup (rate limited)');
    return null;
  }

  try {
    // Ensure backup directory exists
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Create backup filename with timestamp and operation
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const opSuffix = operation ? `_${operation.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
    const backupFilename = `backup_${timestamp}${opSuffix}.sqlite`;
    const backupPath = path.join(backupDir, backupFilename);

    // Export current database state and save to backup
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(backupPath, buffer);

    // Update last backup time
    lastBackupTime = now;

    console.log(`[Database] Created backup: ${backupFilename}`);

    // Cleanup old backups to avoid disk space issues
    cleanupOldBackups();

    return backupPath;
  } catch (error) {
    console.error('[Database] Failed to create backup:', error);
    return null;
  }
}

/**
 * Remove old backups, keeping only MAX_BACKUPS most recent
 */
function cleanupOldBackups(): void {
  try {
    if (!fs.existsSync(backupDir)) return;

    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('backup_') && f.endsWith('.sqlite'))
      .map(f => ({
        name: f,
        path: path.join(backupDir, f),
        mtime: fs.statSync(path.join(backupDir, f)).mtime.getTime()
      }))
      .sort((a, b) => b.mtime - a.mtime);  // Sort newest first

    // Remove backups beyond MAX_BACKUPS
    if (files.length > MAX_BACKUPS) {
      const toDelete = files.slice(MAX_BACKUPS);
      for (const file of toDelete) {
        try {
          fs.unlinkSync(file.path);
          console.log(`[Database] Deleted old backup: ${file.name}`);
        } catch (err) {
          console.warn(`[Database] Failed to delete old backup: ${file.name}`, err);
        }
      }
    }
  } catch (error) {
    console.warn('[Database] Failed to cleanup old backups:', error);
  }
}

/**
 * Restore database from a backup file
 * Returns true if successful, false otherwise
 */
export async function restoreFromBackup(backupPath: string): Promise<boolean> {
  if (!fs.existsSync(backupPath)) {
    console.error('[Database] Backup file not found:', backupPath);
    return false;
  }

  try {
    // Create a backup of current state before restoring
    createBackup('pre_restore');

    // Load the backup
    const backupBuffer = fs.readFileSync(backupPath);
    const wasmPath = getSqlJsWasmPath();
    const wasmBinary = fs.existsSync(wasmPath)
      ? fs.readFileSync(wasmPath).buffer as ArrayBuffer
      : undefined;
    const SQL = await initSqlJs({ wasmBinary });

    // Close current database and load backup
    if (db) {
      db.close();
    }
    db = new SQL.Database(backupBuffer);

    // Save the restored database
    saveDatabaseSync();

    console.log('[Database] Successfully restored from backup:', backupPath);
    return true;
  } catch (error) {
    console.error('[Database] Failed to restore from backup:', error);
    return false;
  }
}

/**
 * List available backups
 */
export function listBackups(): Array<{ name: string; path: string; date: Date; size: number }> {
  try {
    if (!fs.existsSync(backupDir)) return [];

    return fs.readdirSync(backupDir)
      .filter(f => f.startsWith('backup_') && f.endsWith('.sqlite'))
      .map(f => {
        const filePath = path.join(backupDir, f);
        const stats = fs.statSync(filePath);
        return {
          name: f,
          path: filePath,
          date: stats.mtime,
          size: stats.size
        };
      })
      .sort((a, b) => b.date.getTime() - a.date.getTime());  // Sort newest first
  } catch (error) {
    console.error('[Database] Failed to list backups:', error);
    return [];
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
  const firstResult = result[0];
  if (!firstResult || !firstResult.columns || !firstResult.values) return [];
  const columns = firstResult.columns;
  return firstResult.values.map((row: any[]) => {
    const obj: any = {};
    columns.forEach((col: string, i: number) => {
      // Bounds check before accessing row element
      let value = i < row.length ? row[i] : undefined;
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
  obsBibleThemeId: string | null;
  prayerThemeId: string | null;
  obsPrayerThemeId: string | null;
} {
  if (!db) return { viewerThemeId: null, stageThemeId: null, bibleThemeId: null, obsThemeId: null, obsBibleThemeId: null, prayerThemeId: null, obsPrayerThemeId: null };

  const result = db.exec(`
    SELECT selectedViewerThemeId, selectedStageThemeId, selectedBibleThemeId, selectedOBSThemeId, selectedOBSBibleThemeId, selectedPrayerThemeId, selectedOBSPrayerThemeId
    FROM settings WHERE id = 1
  `);

  if (result.length === 0 || !result[0].values || result[0].values.length === 0) {
    return { viewerThemeId: null, stageThemeId: null, bibleThemeId: null, obsThemeId: null, obsBibleThemeId: null, prayerThemeId: null, obsPrayerThemeId: null };
  }

  const row = result[0].values[0];
  // Bounds check: ensure row has expected number of elements
  if (!Array.isArray(row) || row.length < 7) {
    return { viewerThemeId: null, stageThemeId: null, bibleThemeId: null, obsThemeId: null, obsBibleThemeId: null, prayerThemeId: null, obsPrayerThemeId: null };
  }
  return {
    viewerThemeId: row[0] as string | null,
    stageThemeId: row[1] as string | null,
    bibleThemeId: row[2] as string | null,
    obsThemeId: row[3] as string | null,
    obsBibleThemeId: row[4] as string | null,
    prayerThemeId: row[5] as string | null,
    obsPrayerThemeId: row[6] as string | null
  };
}

// Save selected theme ID
export function saveSelectedThemeId(
  themeType: 'viewer' | 'stage' | 'bible' | 'obs' | 'obsBible' | 'prayer' | 'obsPrayer',
  themeId: string | null
): void {
  if (!db) return;

  const columnMap: Record<string, string> = {
    viewer: 'selectedViewerThemeId',
    stage: 'selectedStageThemeId',
    bible: 'selectedBibleThemeId',
    obs: 'selectedOBSThemeId',
    obsBible: 'selectedOBSBibleThemeId',
    prayer: 'selectedPrayerThemeId',
    obsPrayer: 'selectedOBSPrayerThemeId'
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
          } catch (parseError) {
            console.warn(`Failed to parse JSON for field "${key}":`, value.substring(0, 100));
          }
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
export const CLASSIC_OBS_PRAYER_THEME_ID = '00000000-0000-0000-0000-000000000008';

// ============ Display Theme Overrides ============

export type DisplayThemeType = 'viewer' | 'stage' | 'bible' | 'prayer';

export interface DisplayThemeOverride {
  id: number;
  displayId: number;
  themeType: DisplayThemeType;
  themeId: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Get all display theme overrides
 */
export function getAllDisplayThemeOverrides(): DisplayThemeOverride[] {
  return queryAll('SELECT * FROM display_theme_overrides ORDER BY displayId, themeType');
}

/**
 * Get theme overrides for a specific display
 */
export function getDisplayThemeOverrides(displayId: number): DisplayThemeOverride[] {
  return queryAll('SELECT * FROM display_theme_overrides WHERE displayId = ?', [displayId]);
}

/**
 * Get a specific theme override for a display and theme type
 */
export function getDisplayThemeOverride(displayId: number, themeType: DisplayThemeType): DisplayThemeOverride | null {
  return queryOne('SELECT * FROM display_theme_overrides WHERE displayId = ? AND themeType = ?', [displayId, themeType]);
}

/**
 * Set a theme override for a display (upsert)
 * Uses transaction to prevent race conditions between DELETE and INSERT
 */
export function setDisplayThemeOverride(displayId: number, themeType: DisplayThemeType, themeId: string): DisplayThemeOverride | null {
  if (!db) return null;

  const now = new Date().toISOString();

  // Check if override already exists to preserve createdAt
  const existing = getDisplayThemeOverride(displayId, themeType);
  const createdAt = existing?.createdAt || now;

  try {
    // Use transaction to ensure atomic DELETE-INSERT
    beginTransaction();

    // Delete existing record if any
    if (existing) {
      db.run('DELETE FROM display_theme_overrides WHERE displayId = ? AND themeType = ?', [displayId, themeType]);
    }

    // Insert the new/updated record
    db.run(`
      INSERT INTO display_theme_overrides (displayId, themeType, themeId, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?)
    `, [displayId, themeType, themeId, createdAt, now]);

    commitTransaction();
  } catch (error) {
    rollbackTransaction();
    console.error('setDisplayThemeOverride error:', error);
    return null;
  }

  return getDisplayThemeOverride(displayId, themeType);
}

/**
 * Remove a theme override for a display and theme type
 */
export function removeDisplayThemeOverride(displayId: number, themeType: DisplayThemeType): boolean {
  if (!db) return false;

  db.run('DELETE FROM display_theme_overrides WHERE displayId = ? AND themeType = ?', [displayId, themeType]);
  saveDatabase();
  return true;
}

/**
 * Remove all theme overrides for a display
 */
export function removeAllDisplayThemeOverrides(displayId: number): boolean {
  if (!db) return false;

  db.run('DELETE FROM display_theme_overrides WHERE displayId = ?', [displayId]);
  saveDatabase();
  return true;
}

/**
 * Clear all display theme overrides
 */
export function clearAllDisplayThemeOverrides(): boolean {
  if (!db) return false;

  db.run('DELETE FROM display_theme_overrides');
  saveDatabase();
  return true;
}

/**
 * Remove all overrides that reference a specific theme ID
 * Called when a theme is deleted to prevent orphaned references
 */
export function removeOverridesForTheme(themeId: string): number {
  if (!db) return 0;

  const result = db.run('DELETE FROM display_theme_overrides WHERE themeId = ?', [themeId]);
  saveDatabase();
  return result.changes || 0;
}
