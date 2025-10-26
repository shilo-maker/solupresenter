const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://solupresenter:Sud5a62oLS9SBtCu@cluster0.8flpy2z.mongodb.net/solupresenter?retryWrites=true&w=majority&appName=Cluster0';

async function checkSongs() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const Song = mongoose.model('Song', new mongoose.Schema({}, { strict: false }));

    const count = await Song.countDocuments();
    console.log(`Total songs in database: ${count}`);

    // Get first 10 songs with their IDs and titles
    const songs = await Song.find().limit(10).select('_id title createdAt');
    console.log('\nFirst 10 songs (with IDs):');
    songs.forEach(song => {
      console.log(`  ID: ${song._id}, Title: ${song.title}, Created: ${song.createdAt}`);
    });

    // Check if the specific ID from the error exists
    const problemId = '68f693eca87914cbc340b7e7';
    const problemSong = await Song.findById(problemId);
    console.log(`\nLooking for problem ID ${problemId}:`, problemSong ? 'FOUND' : 'NOT FOUND');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkSongs();
