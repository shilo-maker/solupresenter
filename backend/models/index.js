const sequelize = require('../config/sequelize');
const User = require('./User');
const Song = require('./Song');
const Room = require('./Room');
const Setlist = require('./Setlist');
const Media = require('./Media');
const BibleVerse = require('./BibleVerse');
const PublicRoom = require('./PublicRoom');

// Define relationships
User.hasOne(Room, { as: 'activeRoom', foreignKey: 'operatorId' });
Room.belongsTo(User, { as: 'operator', foreignKey: 'operatorId' });

Song.belongsTo(User, { as: 'creator', foreignKey: 'createdById' });
Song.belongsTo(User, { as: 'approver', foreignKey: 'approvedById' });

Room.belongsTo(Setlist, { as: 'temporarySetlist', foreignKey: 'temporarySetlistId' });
Room.belongsTo(Setlist, { as: 'linkedPermanentSetlist', foreignKey: 'linkedPermanentSetlistId' });

Setlist.belongsTo(User, { as: 'creator', foreignKey: 'createdById' });
Setlist.belongsTo(Room, { as: 'linkedRoom', foreignKey: 'linkedRoomId' });

Media.belongsTo(User, { as: 'uploader', foreignKey: 'uploadedById' });

// PublicRoom relationships
PublicRoom.belongsTo(User, { as: 'owner', foreignKey: 'ownerId' });
PublicRoom.belongsTo(Room, { as: 'activeRoom', foreignKey: 'activeRoomId' });
User.hasMany(PublicRoom, { as: 'publicRooms', foreignKey: 'ownerId' });

// Export models and sequelize instance
module.exports = {
  sequelize,
  User,
  Song,
  Room,
  Setlist,
  Media,
  BibleVerse,
  PublicRoom
};
