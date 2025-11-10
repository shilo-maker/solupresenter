const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Add passwordResetToken column
  db.run('ALTER TABLE users ADD COLUMN passwordResetToken TEXT', (err) => {
    if (err) {
      if (err.message.includes('duplicate')) {
        console.log('ℹ️  passwordResetToken column already exists');
      } else {
        console.error('❌ Error adding passwordResetToken:', err.message);
      }
    } else {
      console.log('✅ Added passwordResetToken column');
    }
  });

  // Add passwordResetExpires column
  db.run('ALTER TABLE users ADD COLUMN passwordResetExpires TEXT', (err) => {
    if (err) {
      if (err.message.includes('duplicate')) {
        console.log('ℹ️  passwordResetExpires column already exists');
      } else {
        console.error('❌ Error adding passwordResetExpires:', err.message);
      }
    } else {
      console.log('✅ Added passwordResetExpires column');
    }

    db.close(() => {
      console.log('✅ Database migration completed');
      process.exit(0);
    });
  });
});
