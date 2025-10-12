require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function createAdmin() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const email = 'shilo@soluisrael.org';
    const password = '1397152535Bh@';

    // Check if email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      console.log('✅ User already exists. Updating to admin role...');
      existingUser.role = 'admin';
      await existingUser.save();
      console.log('✅ User updated to admin successfully!');
    } else {
      // Create admin user
      const admin = await User.create({
        email: email.toLowerCase(),
        password,
        authProvider: 'local',
        role: 'admin'
      });

      console.log('✅ Admin account created successfully!');
      console.log('Email:', admin.email);
      console.log('Role:', admin.role);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin:', error.message);
    process.exit(1);
  }
}

createAdmin();
