// Generate a 4-character alphanumeric PIN
const generatePin = () => {
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars: 0, O, I, 1
  let pin = '';

  for (let i = 0; i < 4; i++) {
    pin += characters.charAt(Math.floor(Math.random() * characters.length));
  }

  return pin;
};

// Check if PIN is unique in the database
const generateUniquePin = async (RoomModel) => {
  let pin;
  let isUnique = false;

  while (!isUnique) {
    pin = generatePin();
    const existingRoom = await RoomModel.findOne({ where: { pin } });
    if (!existingRoom) {
      isUnique = true;
    }
  }

  return pin;
};

module.exports = {
  generatePin,
  generateUniquePin
};
