/**
 * Export specific themes from the user's database to the seed database
 * This script copies the selected themes to resources/seed-database.sqlite
 * so they will be included in the installer package.
 */

const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

// Paths
const userDbPath = path.join(process.env.APPDATA, 'solupresenter-desktop', 'solupresenter.sqlite');
const seedDbPath = path.join(__dirname, '..', 'resources', 'seed-database.sqlite');

// Themes to export (by name)
const THEMES_TO_EXPORT = {
  viewer_themes: ['DefaultSong'],
  stage_monitor_themes: ['Classic Stage'],
  bible_themes: ['DefaultBible'],
  prayer_themes: ['DefaultPrayer'],
  obs_themes: ['DefaultOBSSong', 'DefaultOBSBible', 'DefaultOBSPrayer']
};

async function main() {
  console.log('Initializing SQL.js...');
  const SQL = await initSqlJs();

  // Check if user database exists
  if (!fs.existsSync(userDbPath)) {
    console.error('User database not found at:', userDbPath);
    process.exit(1);
  }

  console.log('Loading user database from:', userDbPath);
  const userDbBuffer = fs.readFileSync(userDbPath);
  const userDb = new SQL.Database(userDbBuffer);

  // Create or load seed database
  let seedDb;
  if (fs.existsSync(seedDbPath)) {
    console.log('Loading existing seed database from:', seedDbPath);
    const seedDbBuffer = fs.readFileSync(seedDbPath);
    seedDb = new SQL.Database(seedDbBuffer);
  } else {
    console.log('Creating new seed database');
    seedDb = new SQL.Database();
  }

  // Ensure tables exist in seed database
  createTablesIfNotExist(seedDb);

  // Export each theme type
  let totalExported = 0;

  for (const [tableName, themeNames] of Object.entries(THEMES_TO_EXPORT)) {
    console.log(`\nProcessing ${tableName}...`);

    for (const themeName of themeNames) {
      const exported = exportTheme(userDb, seedDb, tableName, themeName);
      if (exported) {
        totalExported++;
        console.log(`  ✓ Exported: ${themeName}`);
      } else {
        console.log(`  ✗ Not found: ${themeName}`);
      }
    }
  }

  // Save seed database
  console.log('\nSaving seed database...');
  const data = seedDb.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(seedDbPath, buffer);

  console.log(`\nDone! Exported ${totalExported} themes to seed database.`);
  console.log('Seed database saved to:', seedDbPath);

  // Close databases
  userDb.close();
  seedDb.close();
}

function createTablesIfNotExist(db) {
  // viewer_themes table
  db.run(`
    CREATE TABLE IF NOT EXISTS viewer_themes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      isBuiltIn INTEGER DEFAULT 0,
      isDefault INTEGER DEFAULT 0,
      lineOrder TEXT DEFAULT '["original","transliteration","translation"]',
      lineStyles TEXT DEFAULT '{}',
      linePositions TEXT DEFAULT '{}',
      container TEXT DEFAULT '{}',
      viewerBackground TEXT DEFAULT '',
      canvasDimensions TEXT DEFAULT '{"width":1920,"height":1080}',
      backgroundBoxes TEXT DEFAULT '[]',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // stage_monitor_themes table
  db.run(`
    CREATE TABLE IF NOT EXISTS stage_monitor_themes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      isBuiltIn INTEGER DEFAULT 0,
      isDefault INTEGER DEFAULT 0,
      canvasDimensions TEXT DEFAULT '{"width":1920,"height":1080}',
      colors TEXT DEFAULT '{}',
      elements TEXT DEFAULT '{}',
      currentSlideText TEXT DEFAULT '{}',
      nextSlideText TEXT DEFAULT '{}',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // bible_themes table
  db.run(`
    CREATE TABLE IF NOT EXISTS bible_themes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      isBuiltIn INTEGER DEFAULT 0,
      isDefault INTEGER DEFAULT 0,
      lineOrder TEXT DEFAULT '["hebrew","english"]',
      lineStyles TEXT DEFAULT '{}',
      linePositions TEXT DEFAULT '{}',
      referenceStyle TEXT DEFAULT '{}',
      referencePosition TEXT DEFAULT '{}',
      referenceEnglishStyle TEXT DEFAULT '{}',
      referenceEnglishPosition TEXT DEFAULT '{}',
      container TEXT DEFAULT '{}',
      viewerBackground TEXT DEFAULT '',
      canvasDimensions TEXT DEFAULT '{"width":1920,"height":1080}',
      backgroundBoxes TEXT DEFAULT '[]',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // obs_themes table
  db.run(`
    CREATE TABLE IF NOT EXISTS obs_themes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT DEFAULT 'songs',
      isBuiltIn INTEGER DEFAULT 0,
      isDefault INTEGER DEFAULT 0,
      lineOrder TEXT DEFAULT '["original","transliteration","translation"]',
      lineStyles TEXT DEFAULT '{}',
      linePositions TEXT DEFAULT '{}',
      referenceStyle TEXT DEFAULT '{}',
      referencePosition TEXT DEFAULT '{}',
      referenceEnglishStyle TEXT DEFAULT '{}',
      referenceEnglishPosition TEXT DEFAULT '{}',
      viewerBackground TEXT DEFAULT '',
      canvasDimensions TEXT DEFAULT '{"width":1920,"height":1080}',
      backgroundBoxes TEXT DEFAULT '[]',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // prayer_themes table
  db.run(`
    CREATE TABLE IF NOT EXISTS prayer_themes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      isBuiltIn INTEGER DEFAULT 0,
      isDefault INTEGER DEFAULT 0,
      lineOrder TEXT DEFAULT '[]',
      lineStyles TEXT DEFAULT '{}',
      linePositions TEXT DEFAULT '{}',
      referenceStyle TEXT DEFAULT '{}',
      referencePosition TEXT DEFAULT '{}',
      referenceTranslationStyle TEXT DEFAULT '{}',
      referenceTranslationPosition TEXT DEFAULT '{}',
      container TEXT DEFAULT '{}',
      viewerBackground TEXT DEFAULT '',
      canvasDimensions TEXT DEFAULT '{"width":1920,"height":1080}',
      backgroundBoxes TEXT DEFAULT '[]',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

function exportTheme(userDb, seedDb, tableName, themeName) {
  // Find theme in user database
  const result = userDb.exec(`SELECT * FROM ${tableName} WHERE name = ?`, [themeName]);

  if (!result.length || !result[0].values.length) {
    return false;
  }

  const columns = result[0].columns;
  const values = result[0].values[0];

  // Create theme object
  const theme = {};
  columns.forEach((col, i) => {
    theme[col] = values[i];
  });

  // Mark as built-in and default for the installer
  theme.isBuiltIn = 1;
  theme.isDefault = 1;

  // Delete existing theme with same name OR same id in seed database
  seedDb.run(`DELETE FROM ${tableName} WHERE name = ? OR id = ?`, [themeName, theme.id]);

  // Insert theme into seed database
  const insertColumns = Object.keys(theme);
  const placeholders = insertColumns.map(() => '?').join(', ');
  const insertValues = insertColumns.map(col => theme[col]);

  seedDb.run(
    `INSERT INTO ${tableName} (${insertColumns.join(', ')}) VALUES (${placeholders})`,
    insertValues
  );

  return true;
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
