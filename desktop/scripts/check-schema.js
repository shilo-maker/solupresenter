const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const dbPath = path.join(process.env.APPDATA, 'solupresenter-desktop', 'solupresenter.sqlite');

initSqlJs().then(SQL => {
  const db = new SQL.Database(fs.readFileSync(dbPath));

  const r = db.exec("PRAGMA table_info(bible_themes)");
  console.log('bible_themes columns:');
  r[0].values.forEach(v => console.log('  ', v[1], v[2]));

  const r2 = db.exec("PRAGMA table_info(viewer_themes)");
  console.log('\nviewer_themes columns:');
  r2[0].values.forEach(v => console.log('  ', v[1], v[2]));

  db.close();
});
