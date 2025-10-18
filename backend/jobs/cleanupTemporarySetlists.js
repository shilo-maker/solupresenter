const Setlist = require('../models/Setlist');
const Room = require('../models/Room');

/**
 * Cleanup temporary setlists that are linked to expired/deleted rooms
 * This job should run periodically (e.g., every hour)
 */
async function cleanupTemporarySetlists() {
  try {
    console.log('🧹 Starting cleanup of temporary setlists...');

    // Find all temporary setlists
    const temporarySetlists = await Setlist.find({ isTemporary: true });

    let deletedCount = 0;

    for (const setlist of temporarySetlists) {
      // Check if the linked room still exists and is active
      if (setlist.linkedRoom) {
        const room = await Room.findOne({
          _id: setlist.linkedRoom,
          isActive: true
        });

        // If room doesn't exist or is inactive, delete the setlist
        if (!room) {
          await Setlist.findByIdAndDelete(setlist._id);
          deletedCount++;
          console.log(`  ✓ Deleted orphaned temporary setlist: ${setlist.name} (${setlist._id})`);
        }
      } else {
        // If linkedRoom is null, this is an orphaned setlist, delete it
        await Setlist.findByIdAndDelete(setlist._id);
        deletedCount++;
        console.log(`  ✓ Deleted orphaned temporary setlist (no linked room): ${setlist.name} (${setlist._id})`);
      }
    }

    console.log(`✅ Cleanup completed. Deleted ${deletedCount} temporary setlists.`);
  } catch (error) {
    console.error('❌ Error during temporary setlist cleanup:', error);
  }
}

module.exports = cleanupTemporarySetlists;
