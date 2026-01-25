// Script to sync OBS Bible theme with regular Bible theme settings
const path = require('path');
const fs = require('fs');

async function syncThemes() {
  // Load sql.js
  const initSqlJs = require('sql.js');

  // Get database path
  const dbPath = path.join(
    process.env.APPDATA || process.env.HOME,
    'solupresenter-desktop',
    'solupresenter.sqlite'
  );

  console.log('Database path:', dbPath);

  if (!fs.existsSync(dbPath)) {
    console.error('Database not found at:', dbPath);
    process.exit(1);
  }

  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(fileBuffer);

  // Get the ShiloBible theme specifically
  const bibleTheme = db.exec(`SELECT * FROM bible_themes WHERE name = 'ShiloBible' LIMIT 1`);

  if (!bibleTheme.length || !bibleTheme[0].values.length) {
    console.error('No Bible theme found');
    process.exit(1);
  }

  const columns = bibleTheme[0].columns;
  const values = bibleTheme[0].values[0];
  const theme = {};
  columns.forEach((col, i) => {
    theme[col] = values[i];
  });

  console.log('Found Bible theme:', theme.name);
  console.log('Line styles:', theme.lineStyles);
  console.log('Line positions:', theme.linePositions);
  console.log('Reference style:', theme.referenceStyle);
  console.log('Reference position:', theme.referencePosition);

  // Update OBS Bible theme with same settings but keep transparent background
  const OBS_BIBLE_THEME_ID = '00000000-0000-0000-0000-000000000005';

  console.log('Reference English style:', theme.referenceEnglishStyle);
  console.log('Reference English position:', theme.referenceEnglishPosition);

  db.run(`
    UPDATE obs_themes
    SET
      lineStyles = ?,
      linePositions = ?,
      referenceStyle = ?,
      referencePosition = ?,
      referenceEnglishStyle = ?,
      referenceEnglishPosition = ?,
      canvasDimensions = ?,
      updatedAt = ?
    WHERE id = ?
  `, [
    theme.lineStyles,
    theme.linePositions,
    theme.referenceStyle,
    theme.referencePosition,
    theme.referenceEnglishStyle,
    theme.referenceEnglishPosition,
    theme.canvasDimensions || JSON.stringify({ width: 1920, height: 1080 }),
    new Date().toISOString(),
    OBS_BIBLE_THEME_ID
  ]);

  // Save the database
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);

  console.log('\nOBS Bible theme updated successfully!');
  console.log('Restart the desktop app to see the changes.');

  db.close();
}

syncThemes().catch(console.error);
