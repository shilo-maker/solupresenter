/**
 * Add ShiloBible and ShiloSong themes to the database
 *
 * ShiloBible Theme:
 * - Hebrew: 45px (fontSize 83), normal (400), white, top section, RTL, right-aligned
 * - English: 42px (fontSize 78), extra-light (200), white, bottom section, left-aligned
 * - Hebrew reference: bottom-left of Hebrew section
 * - English reference: bottom-right corner
 *
 * ShiloSong Theme:
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
  process.exit(1);
}

console.log('Found database at:', dbPath);

const initSqlJs = require('sql.js');

async function addThemes() {
  const SQL = await initSqlJs();
  const dbBuffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(dbBuffer);

  const now = new Date().toISOString();

  // ========== ShiloBible Theme ==========
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

  // Check if ShiloBible already exists
  const existingBible = db.exec("SELECT id FROM bible_themes WHERE name = 'ShiloBible'");
  if (existingBible.length > 0 && existingBible[0].values.length > 0) {
    console.log('ShiloBible theme already exists, updating...');
    db.run(`
      UPDATE bible_themes
      SET lineStyles = ?, linePositions = ?, referenceStyle = ?, referencePosition = ?, updatedAt = ?
      WHERE name = 'ShiloBible'
    `, [
      JSON.stringify(bibleStyles),
      JSON.stringify(biblePositions),
      JSON.stringify(bibleReferenceStyle),
      JSON.stringify(bibleReferencePosition),
      now
    ]);
  } else {
    console.log('Creating ShiloBible theme...');
    const bibleId = 'shilo-bible-' + Date.now();
    db.run(`
      INSERT INTO bible_themes (id, name, lineStyles, linePositions, referenceStyle, referencePosition, lineOrder, isBuiltIn, isDefault, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      bibleId,
      'ShiloBible',
      JSON.stringify(bibleStyles),
      JSON.stringify(biblePositions),
      JSON.stringify(bibleReferenceStyle),
      JSON.stringify(bibleReferencePosition),
      JSON.stringify(['hebrew', 'english']),
      0,  // Not built-in (user theme)
      0,  // Not default
      now,
      now
    ]);
  }
  console.log('✓ ShiloBible theme saved');

  // ========== ShiloSong Theme ==========
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

  // Check if ShiloSong already exists
  const existingSong = db.exec("SELECT id FROM viewer_themes WHERE name = 'ShiloSong'");
  if (existingSong.length > 0 && existingSong[0].values.length > 0) {
    console.log('ShiloSong theme already exists, updating...');
    db.run(`
      UPDATE viewer_themes
      SET lineStyles = ?, linePositions = ?, updatedAt = ?
      WHERE name = 'ShiloSong'
    `, [
      JSON.stringify(songStyles),
      JSON.stringify(songPositions),
      now
    ]);
  } else {
    console.log('Creating ShiloSong theme...');
    const songId = 'shilo-song-' + Date.now();
    db.run(`
      INSERT INTO viewer_themes (id, name, lineStyles, linePositions, lineOrder, isBuiltIn, isDefault, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      songId,
      'ShiloSong',
      JSON.stringify(songStyles),
      JSON.stringify(songPositions),
      JSON.stringify(['original', 'transliteration', 'translation']),
      0,  // Not built-in (user theme)
      0,  // Not default
      now,
      now
    ]);
  }
  console.log('✓ ShiloSong theme saved');

  // Save the database
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);

  console.log('\n=== Themes saved successfully! ===');

  // Verify
  console.log('\n--- Verification ---');

  const bibleCheck = db.exec("SELECT name, lineStyles FROM bible_themes WHERE name = 'ShiloBible'");
  if (bibleCheck.length > 0 && bibleCheck[0].values.length > 0) {
    const styles = JSON.parse(bibleCheck[0].values[0][1]);
    console.log('\nShiloBible:');
    console.log('  Hebrew: fontSize', styles.hebrew?.fontSize, '(45px), weight', styles.hebrew?.fontWeight);
    console.log('  English: fontSize', styles.english?.fontSize, '(42px), weight', styles.english?.fontWeight);
  }

  const songCheck = db.exec("SELECT name, lineStyles FROM viewer_themes WHERE name = 'ShiloSong'");
  if (songCheck.length > 0 && songCheck[0].values.length > 0) {
    const styles = JSON.parse(songCheck[0].values[0][1]);
    console.log('\nShiloSong:');
    console.log('  Original: fontSize', styles.original?.fontSize, '(86px), weight', styles.original?.fontWeight);
    console.log('  Transliteration: fontSize', styles.transliteration?.fontSize, '(64px), weight', styles.transliteration?.fontWeight);
    console.log('  Translation: fontSize', styles.translation?.fontSize, '(64px), color', styles.translation?.color);
  }

  db.close();
}

addThemes().catch(err => {
  console.error('Failed to add themes:', err);
  process.exit(1);
});
