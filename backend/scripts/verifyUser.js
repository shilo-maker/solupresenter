require('dotenv').config();
const mongoose = require('mongoose');
const readline = require('readline');
const User = require('../models/User');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function verifyUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    console.log('\n=== Verify User Email ===\n');

    // Get user email
    const email = await question('Enter email address to verify: ');

    if (!email) {
      console.error('❌ Email is required');
      process.exit(1);
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      console.error('❌ User not found');
      process.exit(1);
    }

    if (user.isEmailVerified) {
      console.log('✅ User email is already verified');
      process.exit(0);
    }

    // Verify the user
    user.isEmailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await user.save();

    console.log('\n✅ User email verified successfully!');
    console.log('Email:', user.email);
    console.log('Role:', user.role);
    console.log('Verified:', user.isEmailVerified);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error verifying user:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run the script
verifyUser();
