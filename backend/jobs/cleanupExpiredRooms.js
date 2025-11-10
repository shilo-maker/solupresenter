const { Op } = require('sequelize');
const { Room, Setlist } = require('../models');

/**
 * Cleanup expired rooms and their associated temporary setlists
 * Runs every 15 minutes to check for rooms past their expiresAt timestamp
 */
async function cleanupExpiredRooms() {
  try {
    console.log('🧹 Running room cleanup job...');

    const now = new Date();

    // Find all expired rooms
    const expiredRooms = await Room.findAll({
      where: {
        expiresAt: {
          [Op.lt]: now // Less than current time = expired
        }
      },
      include: [{
        model: Setlist,
        as: 'temporarySetlist',
        required: false
      }]
    });

    if (expiredRooms.length === 0) {
      console.log('✅ No expired rooms found');
      return;
    }

    console.log(`🗑️ Found ${expiredRooms.length} expired room(s) to clean up`);

    for (const room of expiredRooms) {
      console.log(`   Removing room ${room.pin} (expired at ${room.expiresAt})`);

      // Delete associated temporary setlist if it exists
      if (room.temporarySetlistId) {
        await Setlist.destroy({
          where: {
            id: room.temporarySetlistId,
            isTemporary: true
          }
        });
        console.log(`   └─ Deleted temporary setlist`);
      }

      // Delete the room
      await room.destroy();
    }

    console.log(`✅ Cleaned up ${expiredRooms.length} expired room(s)`);
  } catch (error) {
    console.error('❌ Error during room cleanup:', error);
  }
}

module.exports = cleanupExpiredRooms;
