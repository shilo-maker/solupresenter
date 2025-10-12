require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function makeAdmin() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get email from command line argument
    const email = process.argv[2];

    if (!email) {
      console.error('❌ Please provide an email address');
      console.log('Usage: node scripts/makeAdmin.js <email>');
      process.exit(1);
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      console.error(`❌ User not found: ${email}`);
      process.exit(1);
    }

    // Check if already admin
    if (user.isAdmin) {
      console.log(`✅ User ${email} is already an admin`);
      process.exit(0);
    }

    // Make admin
    user.isAdmin = true;
    await user.save();

    console.log(`✅ User ${email} is now an admin!`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

makeAdmin();
