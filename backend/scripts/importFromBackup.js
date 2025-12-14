require('dotenv').config();
const fs = require('fs');
const path = require('path');

async function importFromBackup() {
  // Initialize sequelize and models
  const sequelize = require('../config/sequelize');
  const Song = require('../models/Song');

  try {
    // Wait for DB connection
    await sequelize.authenticate();
    console.log('Database connected');

    // Sync models
    await sequelize.sync();

    // Read backup file
    const backupPath = path.join(__dirname, '../../database-backups/backup-2025-11-08T21-13-43-096Z/songs.json');
    const songs = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

    console.log(`Found ${songs.length} songs in backup`);

    let imported = 0;
    let skipped = 0;

    for (const song of songs) {
      // Check if song already exists
      const existing = await Song.findOne({ where: { title: song.title } });
      if (existing) {
        console.log(`Skipping "${song.title}" - already exists`);
        skipped++;
        continue;
      }

      // Create song
      await Song.create({
        title: song.title,
        originalLanguage: song.originalLanguage || 'he',
        slides: song.slides || [],
        tags: song.tags || [],
        isPublic: song.isPublic !== false,
        isPendingApproval: false,
        usageCount: song.usageCount || 0,
        backgroundImage: song.backgroundImage || ''
      });

      console.log(`Imported: "${song.title}"`);
      imported++;
    }

    console.log(`\nDone! Imported ${imported} songs, skipped ${skipped}`);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

importFromBackup();
