/**
 * Script to prepare the seed database for distribution
 * - Renames themes to their "Classic" names
 * - Sets default themes
 *
 * Run with: node scripts/prepare-seed-database.js
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const SEED_DB_PATH = path.join(__dirname, '..', 'resources', 'seed-database.sqlite');

async function prepareSeedDatabase() {
  console.log('Preparing seed database...');
  console.log('Database path:', SEED_DB_PATH);

  if (!fs.existsSync(SEED_DB_PATH)) {
    console.error('Seed database not found! Please copy it first.');
    process.exit(1);
  }

  // Load sql.js
  const SQL = await initSqlJs();

  // Load the database
  const fileBuffer = fs.readFileSync(SEED_DB_PATH);
  const db = new SQL.Database(fileBuffer);

  console.log('\n=== Current Themes ===');

  // List viewer themes
  console.log('\nViewer Themes:');
  let result = db.exec('SELECT id, name, isDefault FROM viewer_themes');
  if (result.length > 0) {
    result[0].values.forEach(row => console.log(`  ${row[0].substring(0, 8)}... - ${row[1]} (default: ${row[2]})`));
  }

  // List bible themes
  console.log('\nBible Themes:');
  result = db.exec('SELECT id, name, isDefault FROM bible_themes');
  if (result.length > 0) {
    result[0].values.forEach(row => console.log(`  ${row[0].substring(0, 8)}... - ${row[1]} (default: ${row[2]})`));
  }

  // List prayer themes
  console.log('\nPrayer Themes:');
  result = db.exec('SELECT id, name, isDefault FROM prayer_themes');
  if (result.length > 0) {
    result[0].values.forEach(row => console.log(`  ${row[0].substring(0, 8)}... - ${row[1]} (default: ${row[2]})`));
  }

  // List stage themes
  console.log('\nStage Themes:');
  result = db.exec('SELECT id, name, isDefault FROM stage_monitor_themes');
  if (result.length > 0) {
    result[0].values.forEach(row => console.log(`  ${row[0].substring(0, 8)}... - ${row[1]} (default: ${row[2]})`));
  }

  console.log('\n=== Updating Themes ===');

  // Rename ShiloSong to Classic Song and set as default
  db.run('UPDATE viewer_themes SET isDefault = 0'); // Clear all defaults first
  db.run("UPDATE viewer_themes SET name = 'Classic Song', isDefault = 1, isBuiltIn = 1 WHERE name = 'ShiloSong'");
  console.log('Updated ShiloSong -> Classic Song (default)');

  // Rename ShiloBible to Classic Bible and set as default
  db.run('UPDATE bible_themes SET isDefault = 0'); // Clear all defaults first
  db.run("UPDATE bible_themes SET name = 'Classic Bible', isDefault = 1, isBuiltIn = 1 WHERE name = 'ShiloBible'");
  console.log('Updated ShiloBible -> Classic Bible (default)');

  // Rename NewClassicPrayer to Classic Prayer and set as default
  db.run('UPDATE prayer_themes SET isDefault = 0'); // Clear all defaults first
  db.run("UPDATE prayer_themes SET name = 'Classic Prayer', isDefault = 1, isBuiltIn = 1 WHERE name = 'NewClassicPrayer'");
  console.log('Updated NewClassicPrayer -> Classic Prayer (default)');

  // Set Classic Stage as default (if it exists)
  db.run('UPDATE stage_monitor_themes SET isDefault = 0'); // Clear all defaults first
  db.run("UPDATE stage_monitor_themes SET isDefault = 1, isBuiltIn = 1 WHERE name = 'Classic Stage'");
  console.log('Updated Classic Stage (default)');

  console.log('\n=== Updated Themes ===');

  // Verify changes
  console.log('\nViewer Themes:');
  result = db.exec('SELECT id, name, isDefault, isBuiltIn FROM viewer_themes');
  if (result.length > 0) {
    result[0].values.forEach(row => console.log(`  ${row[0].substring(0, 8)}... - ${row[1]} (default: ${row[2]}, builtIn: ${row[3]})`));
  }

  console.log('\nBible Themes:');
  result = db.exec('SELECT id, name, isDefault, isBuiltIn FROM bible_themes');
  if (result.length > 0) {
    result[0].values.forEach(row => console.log(`  ${row[0].substring(0, 8)}... - ${row[1]} (default: ${row[2]}, builtIn: ${row[3]})`));
  }

  console.log('\nPrayer Themes:');
  result = db.exec('SELECT id, name, isDefault, isBuiltIn FROM prayer_themes');
  if (result.length > 0) {
    result[0].values.forEach(row => console.log(`  ${row[0].substring(0, 8)}... - ${row[1]} (default: ${row[2]}, builtIn: ${row[3]})`));
  }

  console.log('\nStage Themes:');
  result = db.exec('SELECT id, name, isDefault, isBuiltIn FROM stage_monitor_themes');
  if (result.length > 0) {
    result[0].values.forEach(row => console.log(`  ${row[0].substring(0, 8)}... - ${row[1]} (default: ${row[2]}, builtIn: ${row[3]})`));
  }

  // Save the database
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(SEED_DB_PATH, buffer);
  console.log('\nSeed database saved successfully!');

  db.close();
}

prepareSeedDatabase().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
