/**
 * Review all unmatched SoluFlow songs
 * Shows songs that either had no match or matched below 50%
 */

require('dotenv').config();
const { Sequelize, DataTypes } = require('sequelize');
const mapping = require('./song-mapping.json');

// SoluFlow PRODUCTION database
const flowDb = new Sequelize(
  'postgresql://soluflow_2lzn_user:33ENrqD3QhoPlR8lktBPu0HaGoR7pSu1@dpg-d46aah6mcj7s73b4g7n0-a.frankfurt-postgres.render.com/soluflow_2lzn',
  {
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: { require: true, rejectUnauthorized: false }
    }
  }
);

const FlowSong = flowDb.define('Song', {
  id: { type: DataTypes.INTEGER, primaryKey: true },
  title: DataTypes.STRING,
  content: DataTypes.TEXT,
  workspace_id: DataTypes.INTEGER
}, { tableName: 'songs', timestamps: false });

async function main() {
  try {
    await flowDb.authenticate();

    // Get all SoluFlow songs
    const flowSongs = await FlowSong.findAll({ order: [['title', 'ASC']] });

    // Get mapped flow IDs
    const mappedFlowIds = new Set(mapping.mappings.map(m => m.soluflow.id));

    // Find unmatched
    const unmatched = flowSongs.filter(s => !mappedFlowIds.has(s.id));

    console.log('UNMATCHED SOLUFLOW SONGS (no match in SoluPresenter)');
    console.log('='.repeat(70));
    console.log(`Total SoluFlow songs: ${flowSongs.length}`);
    console.log(`Already mapped: ${mappedFlowIds.size}`);
    console.log(`Unmatched: ${unmatched.length}`);
    console.log('='.repeat(70));
    console.log('');
    console.log('#    | ID   | Title');
    console.log('-'.repeat(70));

    unmatched.forEach((s, i) => {
      const num = String(i + 1).padStart(4);
      const id = String(s.id).padStart(4);
      console.log(`${num} | ${id} | ${s.title}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await flowDb.close();
  }
}

main();
