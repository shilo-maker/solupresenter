/**
 * Update existing themes to new design specifications
 *
 * Bible Theme:
 * - Hebrew: 45px (fontSize 83), normal (400), white, top section, RTL, right-aligned
 * - English: 42px (fontSize 78), extra-light (200), white, bottom section, left-aligned
 * - Hebrew reference: bottom-left of Hebrew section
 * - English reference: bottom-right corner
 *
 * Song Theme:
 * - Hebrew: 86px (fontSize 159), bold (700), white, centered
 * - Transliteration: 64px (fontSize 119), light (300), white, centered
 * - Translation: 64px (fontSize 119), light (300), #b7b7b7, centered
 */

const fs = require('fs');
const path = require('path');

// Find the database file
const possiblePaths = [
  path.join(__dirname, '..', 'solupresenter.sqlite'),
  path.join(process.env.APPDATA || '', 'solupresenter-desktop', 'solupresenter.sqlite'),
];

let dbPath = null;
for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    dbPath = p;
    break;
  }
}

if (!dbPath) {
  console.error('Database not found. Checked paths:', possiblePaths);
  console.log('\nMake sure you have run the desktop app at least once to create the database.');
  process.exit(1);
}

console.log('Found database at:', dbPath);

// Load sql.js
const initSqlJs = require('sql.js');

async function updateThemes() {
  const SQL = await initSqlJs();

  // Read the database file
  const dbBuffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(dbBuffer);

  // New Bible theme values
  const bibleStyles = {
    hebrew: { fontSize: 83, fontWeight: '400', color: '#ffffff', opacity: 1, visible: true },
    english: { fontSize: 78, fontWeight: '200', color: '#ffffff', opacity: 1, visible: true }
  };

  const biblePositions = {
    hebrew: { x: 2, y: 2, width: 96, height: 45, paddingTop: 0, paddingBottom: 0, alignH: 'right', alignV: 'top' },
    english: { x: 2, y: 50, width: 96, height: 45, paddingTop: 0, paddingBottom: 0, alignH: 'left', alignV: 'top' }
  };

  const bibleReferenceStyle = { fontSize: 50, fontWeight: '400', color: '#a0a0a0', opacity: 1 };
  const bibleReferencePosition = { x: 2, y: 44, width: 50, height: 5, alignH: 'left', alignV: 'center' };

  // New Song theme values
  const songStyles = {
    original: { fontSize: 159, fontWeight: '700', color: '#ffffff', opacity: 1, visible: true },
    transliteration: { fontSize: 119, fontWeight: '300', color: '#ffffff', opacity: 1, visible: true },
    translation: { fontSize: 119, fontWeight: '300', color: '#b7b7b7', opacity: 1, visible: true }
  };

  const songPositions = {
    original: { x: 0, y: 20, width: 100, height: 15, paddingTop: 0, paddingBottom: 0, alignH: 'center', alignV: 'center' },
    transliteration: { x: 0, y: 36, width: 100, height: 12, paddingTop: 0, paddingBottom: 0, alignH: 'center', alignV: 'center' },
    translation: { x: 0, y: 55, width: 100, height: 30, paddingTop: 0, paddingBottom: 0, alignH: 'center', alignV: 'top' }
  };

  // Update Bible themes
  console.log('\n--- Updating Bible Themes ---');
  try {
    const result = db.run(`
      UPDATE bible_themes
      SET lineStyles = ?,
          linePositions = ?,
          referenceStyle = ?,
          referencePosition = ?,
          updatedAt = ?
      WHERE isBuiltIn = 1
    `, [
      JSON.stringify(bibleStyles),
      JSON.stringify(biblePositions),
      JSON.stringify(bibleReferenceStyle),
      JSON.stringify(bibleReferencePosition),
      new Date().toISOString()
    ]);
    console.log('Updated built-in Bible themes');
  } catch (err) {
    console.error('Error updating Bible themes:', err.message);
  }

  // Update Viewer/Song themes
  console.log('\n--- Updating Song/Viewer Themes ---');
  try {
    const result = db.run(`
      UPDATE viewer_themes
      SET lineStyles = ?,
          linePositions = ?,
          updatedAt = ?
      WHERE isBuiltIn = 1
    `, [
      JSON.stringify(songStyles),
      JSON.stringify(songPositions),
      new Date().toISOString()
    ]);
    console.log('Updated built-in Viewer themes');
  } catch (err) {
    console.error('Error updating Viewer themes:', err.message);
  }

  // Also update OBS themes if they exist
  console.log('\n--- Updating OBS Themes ---');
  try {
    // OBS Songs theme
    db.run(`
      UPDATE obs_themes
      SET lineStyles = ?,
          linePositions = ?,
          updatedAt = ?
      WHERE type = 'songs' AND isBuiltIn = 1
    `, [
      JSON.stringify(songStyles),
      JSON.stringify(songPositions),
      new Date().toISOString()
    ]);
    console.log('Updated OBS Songs themes');

    // OBS Bible theme
    db.run(`
      UPDATE obs_themes
      SET lineStyles = ?,
          linePositions = ?,
          updatedAt = ?
      WHERE type = 'bible' AND isBuiltIn = 1
    `, [
      JSON.stringify(bibleStyles),
      JSON.stringify(biblePositions),
      new Date().toISOString()
    ]);
    console.log('Updated OBS Bible themes');
  } catch (err) {
    console.error('Error updating OBS themes:', err.message);
  }

  // Save the database
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);

  console.log('\n=== Database updated successfully! ===');
  console.log('Database saved to:', dbPath);

  // Show current theme values for verification
  console.log('\n--- Verification ---');

  const bibleThemes = db.exec('SELECT name, lineStyles FROM bible_themes WHERE isBuiltIn = 1');
  if (bibleThemes.length > 0 && bibleThemes[0].values.length > 0) {
    console.log('\nBible Theme styles:', bibleThemes[0].values[0][0]);
    const styles = JSON.parse(bibleThemes[0].values[0][1]);
    console.log('  Hebrew fontSize:', styles.hebrew?.fontSize, '(should be 83 = 45px)');
    console.log('  English fontSize:', styles.english?.fontSize, '(should be 78 = 42px)');
  }

  const viewerThemes = db.exec('SELECT name, lineStyles FROM viewer_themes WHERE isBuiltIn = 1');
  if (viewerThemes.length > 0 && viewerThemes[0].values.length > 0) {
    console.log('\nSong Theme styles:', viewerThemes[0].values[0][0]);
    const styles = JSON.parse(viewerThemes[0].values[0][1]);
    console.log('  Original fontSize:', styles.original?.fontSize, '(should be 159 = 86px)');
    console.log('  Transliteration fontSize:', styles.transliteration?.fontSize, '(should be 119 = 64px)');
    console.log('  Translation fontSize:', styles.translation?.fontSize, '(should be 119 = 64px)');
    console.log('  Translation color:', styles.translation?.color, '(should be #b7b7b7)');
  }

  db.close();
}

updateThemes().catch(err => {
  console.error('Failed to update themes:', err);
  process.exit(1);
});
