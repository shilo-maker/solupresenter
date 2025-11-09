require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

async function backupDatabase() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get database reference
    const db = mongoose.connection.db;

    // Create backup directory with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(__dirname, '..', '..', 'database-backups', `backup-${timestamp}`);

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    console.log(`📁 Backup directory: ${backupDir}`);

    // Backup Users
    console.log('💾 Backing up Users...');
    const users = await db.collection('users').find({}).toArray();
    fs.writeFileSync(
      path.join(backupDir, 'users.json'),
      JSON.stringify(users, null, 2)
    );
    console.log(`✅ Backed up ${users.length} users`);

    // Backup Songs
    console.log('💾 Backing up Songs...');
    const songs = await db.collection('songs').find({}).toArray();
    fs.writeFileSync(
      path.join(backupDir, 'songs.json'),
      JSON.stringify(songs, null, 2)
    );
    console.log(`✅ Backed up ${songs.length} songs`);

    // Backup Rooms
    console.log('💾 Backing up Rooms...');
    const rooms = await db.collection('rooms').find({}).toArray();
    fs.writeFileSync(
      path.join(backupDir, 'rooms.json'),
      JSON.stringify(rooms, null, 2)
    );
    console.log(`✅ Backed up ${rooms.length} rooms`);

    // Backup Setlists
    console.log('💾 Backing up Setlists...');
    const setlists = await db.collection('setlists').find({}).toArray();
    fs.writeFileSync(
      path.join(backupDir, 'setlists.json'),
      JSON.stringify(setlists, null, 2)
    );
    console.log(`✅ Backed up ${setlists.length} setlists`);

    // Backup Media
    console.log('💾 Backing up Media...');
    const media = await db.collection('media').find({}).toArray();
    fs.writeFileSync(
      path.join(backupDir, 'media.json'),
      JSON.stringify(media, null, 2)
    );
    console.log(`✅ Backed up ${media.length} media items`);

    // Backup Bible Verses
    console.log('💾 Backing up Bible Verses...');
    const bibleverses = await db.collection('bibleverses').find({}).toArray();
    fs.writeFileSync(
      path.join(backupDir, 'bibleverses.json'),
      JSON.stringify(bibleverses, null, 2)
    );
    console.log(`✅ Backed up ${bibleverses.length} Bible verses`);

    // Create backup metadata
    const metadata = {
      timestamp: new Date().toISOString(),
      counts: {
        users: users.length,
        songs: songs.length,
        rooms: rooms.length,
        setlists: setlists.length,
        media: media.length,
        bibleverses: bibleverses.length
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
    console.log(`   Media: ${media.length}`);
    console.log(`   Bible Verses: ${bibleverses.length}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Backup failed:', error);
    process.exit(1);
  }
}

// Run backup
backupDatabase();
