require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { sequelize, User, Song, Room, Setlist, Media, BibleVerse } = require('../models');

async function migrateToPostgreSQL() {
  try {
    console.log('🔌 Connecting to PostgreSQL...');
    await sequelize.authenticate();
    console.log('✅ Connected to PostgreSQL\n');

    // Create all tables
    console.log('📋 Creating database tables...');
    await sequelize.sync({ force: true }); // WARNING: This will drop existing tables!
    console.log('✅ Tables created\n');

    // Find the most recent MongoDB backup
    const backupsDir = path.join(__dirname, '..', '..', 'database-backups');
    const backupDirs = fs.readdirSync(backupsDir)
      .filter(f => f.startsWith('backup-'))
      .sort().reverse();

    if (backupDirs.length === 0) {
      throw new Error('No backup found! Please run: npm run backup');
    }

    const latestBackup = path.join(backupsDir, backupDirs[0]);
    console.log(`📂 Using backup: ${backupDirs[0]}\n`);

    // Read MongoDB backup data
    const usersData = JSON.parse(fs.readFileSync(path.join(latestBackup, 'users.json'), 'utf8'));
    const songsData = JSON.parse(fs.readFileSync(path.join(latestBackup, 'songs.json'), 'utf8'));
    const roomsData = JSON.parse(fs.readFileSync(path.join(latestBackup, 'rooms.json'), 'utf8'));
    const setlistsData = JSON.parse(fs.readFileSync(path.join(latestBackup, 'setlists.json'), 'utf8'));

    // Check if bible verses and media files exist
    let bibleData = [];
    let mediaData = [];

    const bibleFile = path.join(latestBackup, 'bibleverses.json');
    if (fs.existsSync(bibleFile)) {
      bibleData = JSON.parse(fs.readFileSync(bibleFile, 'utf8'));
    }

    const mediaFile = path.join(latestBackup, 'media.json');
    if (fs.existsSync(mediaFile)) {
      mediaData = JSON.parse(fs.readFileSync(mediaFile, 'utf8'));
    }

    // Create a mapping from MongoDB _id to PostgreSQL UUID
    const idMap = {
      users: {},
      songs: {},
      rooms: {},
      setlists: {},
      media: {}
    };

    // Migrate Users
    console.log('👥 Migrating users...');
    for (const userData of usersData) {
      const newUser = await User.create({
        email: userData.email,
        password: userData.password,
        authProvider: userData.authProvider,
        googleId: userData.googleId,
        role: userData.role,
        preferences: userData.preferences,
        isEmailVerified: userData.isEmailVerified,
        emailVerificationToken: userData.emailVerificationToken,
        emailVerificationExpires: userData.emailVerificationExpires,
        createdAt: userData.createdAt
      });
      idMap.users[userData._id] = newUser.id;
    }
    console.log(`✅ Migrated ${usersData.length} users\n`);

    // Migrate Songs
    console.log('🎵 Migrating songs...');
    for (const songData of songsData) {
      const newSong = await Song.create({
        title: songData.title,
        originalLanguage: songData.originalLanguage,
        slides: songData.slides,
        tags: songData.tags,
        isPublic: songData.isPublic,
        isPendingApproval: songData.isPendingApproval,
        createdById: songData.createdBy ? idMap.users[songData.createdBy] : null,
        usageCount: songData.usageCount,
        approvedById: songData.approvedBy ? idMap.users[songData.approvedBy] : null,
        approvedAt: songData.approvedAt,
        backgroundImage: songData.backgroundImage,
        createdAt: songData.createdAt,
        updatedAt: songData.updatedAt
      });
      idMap.songs[songData._id] = newSong.id;
    }
    console.log(`✅ Migrated ${songsData.length} songs\n`);

    // Migrate Media
    if (mediaData.length > 0) {
      console.log('📷 Migrating media...');
      for (const media of mediaData) {
        const newMedia = await Media.create({
          name: media.name,
          type: media.type,
          url: media.url,
          thumbnailUrl: media.thumbnailUrl,
          isPublic: media.isPublic,
          uploadedById: idMap.users[media.uploadedBy],
          createdAt: media.createdAt
        });
        idMap.media[media._id] = newMedia.id;
      }
      console.log(`✅ Migrated ${mediaData.length} media items\n`);
    }

    // Migrate Setlists
    console.log('📋 Migrating setlists...');
    for (const setlistData of setlistsData) {
      // Transform items to use new UUIDs
      const transformedItems = setlistData.items.map(item => {
        const newItem = { ...item };
        if (item.song) {
          newItem.song = idMap.songs[item.song];
        }
        if (item.image) {
          newItem.image = idMap.media[item.image];
        }
        return newItem;
      });

      const newSetlist = await Setlist.create({
        name: setlistData.name,
        items: transformedItems,
        createdById: idMap.users[setlistData.createdBy],
        isTemporary: setlistData.isTemporary,
        usageCount: setlistData.usageCount,
        shareToken: setlistData.shareToken,
        createdAt: setlistData.createdAt,
        updatedAt: setlistData.updatedAt
      });
      idMap.setlists[setlistData._id] = newSetlist.id;
    }
    console.log(`✅ Migrated ${setlistsData.length} setlists\n`);

    // Migrate Rooms
    console.log('🏠 Migrating rooms...');
    for (const roomData of roomsData) {
      // Transform currentSlide songId if it exists
      const currentSlide = { ...roomData.currentSlide };
      if (currentSlide.songId && idMap.songs[currentSlide.songId]) {
        currentSlide.songId = idMap.songs[currentSlide.songId];
      }

      const newRoom = await Room.create({
        pin: roomData.pin,
        operatorId: idMap.users[roomData.operator],
        isActive: roomData.isActive,
        currentSlide: currentSlide,
        currentImageUrl: roomData.currentImageUrl,
        currentBibleData: roomData.currentBibleData,
        backgroundImage: roomData.backgroundImage,
        quickSlideText: roomData.quickSlideText,
        viewerCount: roomData.viewerCount,
        temporarySetlistId: roomData.temporarySetlist ? idMap.setlists[roomData.temporarySetlist] : null,
        linkedPermanentSetlistId: roomData.linkedPermanentSetlist ? idMap.setlists[roomData.linkedPermanentSetlist] : null,
        lastActivity: roomData.lastActivity,
        createdAt: roomData.createdAt,
        expiresAt: roomData.expiresAt
      });
      idMap.rooms[roomData._id] = newRoom.id;
    }
    console.log(`✅ Migrated ${roomsData.length} rooms\n`);

    // Migrate Bible Verses
    if (bibleData.length > 0) {
      console.log('📖 Migrating Bible verses...');
      for (const verse of bibleData) {
        await BibleVerse.create({
          book: verse.book,
          bookNumber: verse.bookNumber,
          testament: verse.testament,
          chapter: verse.chapter,
          verse: verse.verse,
          hebrewText: verse.hebrewText,
          englishText: verse.englishText,
          reference: verse.reference,
          createdAt: verse.createdAt,
          updatedAt: verse.updatedAt
        });
      }
      console.log(`✅ Migrated ${bibleData.length} Bible verses\n`);
    }

    // Update User activeRoomId references
    console.log('🔗 Updating user active room references...');
    for (const userData of usersData) {
      if (userData.activeRoom && idMap.rooms[userData.activeRoom]) {
        await User.update(
          { activeRoomId: idMap.rooms[userData.activeRoom] },
          { where: { id: idMap.users[userData._id] } }
        );
      }
    }
    console.log('✅ Updated user references\n');

    // Update Setlist linkedRoomId references
    console.log('🔗 Updating setlist room references...');
    for (const setlistData of setlistsData) {
      if (setlistData.linkedRoom && idMap.rooms[setlistData.linkedRoom]) {
        await Setlist.update(
          { linkedRoomId: idMap.rooms[setlistData.linkedRoom] },
          { where: { id: idMap.setlists[setlistData._id] } }
        );
      }
    }
    console.log('✅ Updated setlist references\n');

    console.log('🎉 Migration completed successfully!\n');
    console.log('Migration summary:');
    console.log(`   Users: ${usersData.length}`);
    console.log(`   Songs: ${songsData.length}`);
    console.log(`   Rooms: ${roomsData.length}`);
    console.log(`   Setlists: ${setlistsData.length}`);
    console.log(`   Media: ${mediaData.length}`);
    console.log(`   Bible Verses: ${bibleData.length}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateToPostgreSQL();
