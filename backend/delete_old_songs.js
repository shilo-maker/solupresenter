const mongoose = require('mongoose');
const Song = require('./models/Song');

const MONGODB_URI = 'mongodb+srv://solupresenter:Sud5a62oLS9SBtCu@cluster0.8flpy2z.mongodb.net/solupresenter?retryWrites=true&w=majority&appName=Cluster0';

async function deleteOldDuplicates() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    const allSongs = await Song.find().sort({ createdAt: 1 }); // Sort by oldest first
    console.log(`Total songs: ${allSongs.length}`);
    
    // Group by title to find duplicates
    const songsByTitle = {};
    allSongs.forEach(song => {
      if (!songsByTitle[song.title]) {
        songsByTitle[song.title] = [];
      }
      songsByTitle[song.title].push(song);
    });
    
    let deleteCount = 0;
    for (const [title, songs] of Object.entries(songsByTitle)) {
      if (songs.length > 1) {
        // Keep the newest, delete the rest
        songs.sort((a, b) => b.createdAt - a.createdAt);
        const toDelete = songs.slice(1); // Delete all except newest
        
        for (const song of toDelete) {
          await Song.findByIdAndDelete(song._id);
          deleteCount++;
        }
      }
    }
    
    console.log(`\n✅ Deleted ${deleteCount} duplicate songs`);
    const remaining = await Song.countDocuments();
    console.log(`Remaining songs: ${remaining}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

deleteOldDuplicates();
