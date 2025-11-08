require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Import models
const User = require('../models/User');
const Song = require('../models/Song');
const Room = require('../models/Room');
const Setlist = require('../models/Setlist');

async function backupDatabase() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Create backup directory with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(__dirname, '..', '..', 'database-backups', `backup-${timestamp}`);

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    console.log(`📁 Backup directory: ${backupDir}`);

    // Backup Users
    console.log('💾 Backing up Users...');
    const users = await User.find({}).lean();
    fs.writeFileSync(
      path.join(backupDir, 'users.json'),
      JSON.stringify(users, null, 2)
    );
    console.log(`✅ Backed up ${users.length} users`);

    // Backup Songs
    console.log('💾 Backing up Songs...');
    const songs = await Song.find({}).lean();
    fs.writeFileSync(
      path.join(backupDir, 'songs.json'),
      JSON.stringify(songs, null, 2)
    );
    console.log(`✅ Backed up ${songs.length} songs`);

    // Backup Rooms
    console.log('💾 Backing up Rooms...');
    const rooms = await Room.find({}).lean();
    fs.writeFileSync(
      path.join(backupDir, 'rooms.json'),
      JSON.stringify(rooms, null, 2)
    );
    console.log(`✅ Backed up ${rooms.length} rooms`);

    // Backup Setlists
    console.log('💾 Backing up Setlists...');
    const setlists = await Setlist.find({}).lean();
    fs.writeFileSync(
      path.join(backupDir, 'setlists.json'),
      JSON.stringify(setlists, null, 2)
    );
    console.log(`✅ Backed up ${setlists.length} setlists`);

    // Create backup metadata
    const metadata = {
      timestamp: new Date().toISOString(),
      counts: {
        users: users.length,
        songs: songs.length,
        rooms: rooms.length,
        setlists: setlists.length
      },
      mongoUri: process.env.MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@') // Hide password
    };

    fs.writeFileSync(
      path.join(backupDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );

    console.log('\n🎉 Backup completed successfully!');
    console.log(`📂 Backup location: ${backupDir}`);
    console.log('\nBackup summary:');
    console.log(`   Users: ${users.length}`);
    console.log(`   Songs: ${songs.length}`);
    console.log(`   Rooms: ${rooms.length}`);
    console.log(`   Setlists: ${setlists.length}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Backup failed:', error);
    process.exit(1);
  }
}

// Run backup
backupDatabase();
