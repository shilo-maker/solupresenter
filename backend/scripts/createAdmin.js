require('dotenv').config();
const mongoose = require('mongoose');
const readline = require('readline');
const User = require('../models/User');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function createAdmin() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      console.log('\n⚠️  An admin account already exists:');
      console.log('Email:', existingAdmin.email);

      const confirm = await question('\nDo you want to create another admin? (yes/no): ');
      if (confirm.toLowerCase() !== 'yes') {
        console.log('Operation cancelled.');
        process.exit(0);
      }
    }

    console.log('\n=== Create Admin Account ===\n');

    // Get admin details
    const email = await question('Enter admin email: ');
    const password = await question('Enter admin password (min 6 characters): ');

    // Validate input
    if (!email || !password) {
      console.error('❌ Email and password are required');
      process.exit(1);
    }

    if (password.length < 6) {
      console.error('❌ Password must be at least 6 characters');
      process.exit(1);
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      console.error('❌ Email already registered');
      process.exit(1);
    }

    // Create admin user
    const admin = await User.create({
      email: email.toLowerCase(),
      password,
      authProvider: 'local',
      role: 'admin'
    });

    console.log('\n✅ Admin account created successfully!');
    console.log('Email:', admin.email);
    console.log('Role:', admin.role);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error creating admin:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run the script
createAdmin();
