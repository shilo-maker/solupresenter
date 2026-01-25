/**
 * Mark all unmatched SoluFlow songs as "No Match"
 * This creates SongMapping entries with noMatch=true for all SoluFlow songs
 * that don't have an existing mapping.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Sequelize, DataTypes } = require('sequelize');
const SongMapping = require('../models/SongMapping');

// SoluFlow external database connection
const soluflowDb = new Sequelize(
  'postgresql://soluflow_2lzn_user:33ENrqD3QhoPlR8lktBPu0HaGoR7pSu1@dpg-d46aah6mcj7s73b4g7n0-a.frankfurt-postgres.render.com/soluflow_2lzn',
  {
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: { require: true, rejectUnauthorized: false }
    }
  }
);

// SoluFlow Song model
const SoluflowSong = soluflowDb.define('Song', {
  id: { type: DataTypes.INTEGER, primaryKey: true },
  title: DataTypes.STRING,
  content: DataTypes.TEXT,
  workspace_id: DataTypes.INTEGER
}, { tableName: 'songs', timestamps: false });

async function markAllUnmatchedAsNoMatch() {
  try {
    console.log('Connecting to databases...');

    // Test connections
    await soluflowDb.authenticate();
    console.log('✓ Connected to SoluFlow database');

    const sequelize = require('../config/sequelize');
    await sequelize.authenticate();
    console.log('✓ Connected to SoluPresenter database');

    // Sync SongMapping model
    await SongMapping.sync();
    console.log('✓ SongMapping table synced');

    // Get all SoluFlow songs
    const flowSongs = await SoluflowSong.findAll({
      order: [['title', 'ASC']]
    });
    console.log(`\nTotal SoluFlow songs: ${flowSongs.length}`);

    // Get all existing mappings
    const existingMappings = await SongMapping.findAll({
      attributes: ['soluflowId']
    });
    const mappedIds = new Set(existingMappings.map(m => m.soluflowId));
    console.log(`Already mapped: ${mappedIds.size}`);

    // Find unmatched songs
    const unmatchedSongs = flowSongs.filter(s => !mappedIds.has(s.id));
    console.log(`Unmatched songs to mark: ${unmatchedSongs.length}\n`);

    if (unmatchedSongs.length === 0) {
      console.log('No unmatched songs to process!');
      return;
    }

    // Create "No Match" mappings for each unmatched song
    let created = 0;
    let errors = 0;

    for (const song of unmatchedSongs) {
      try {
        await SongMapping.create({
          soluflowId: song.id,
          soluflowTitle: song.title,
          solupresenterId: null,
          solupresenterTitle: null,
          confidence: null,
          manuallyLinked: true,
          noMatch: true
        });
        created++;
        process.stdout.write(`\rCreated: ${created}/${unmatchedSongs.length}`);
      } catch (err) {
        errors++;
        console.error(`\nError creating mapping for song ${song.id} (${song.title}):`, err.message);
      }
    }

    console.log(`\n\n✓ Done!`);
    console.log(`  Created: ${created}`);
    console.log(`  Errors: ${errors}`);

    // Final stats
    const totalMappings = await SongMapping.count();
    const noMatchCount = await SongMapping.count({ where: { noMatch: true } });
    const linkedCount = totalMappings - noMatchCount;

    console.log(`\nFinal mapping stats:`);
    console.log(`  Total mappings: ${totalMappings}`);
    console.log(`  Linked to SoluPresenter: ${linkedCount}`);
    console.log(`  Marked as "No Match": ${noMatchCount}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await soluflowDb.close();
    process.exit(0);
  }
}

markAllUnmatchedAsNoMatch();
