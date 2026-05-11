/**
 * Migration Script: Seed MongoDB with existing JSON data
 * 
 * Run this ONCE after setting up MongoDB Atlas:
 *   node seed.js
 * 
 * This will read content.json and help.json and insert them into MongoDB.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const Content = require('./models/Content');
const Help = require('./models/Help');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set. Create a .env file with your MongoDB connection string.');
  process.exit(1);
}

async function seed() {
  try {
    console.log('🔌 Connecting to MongoDB Atlas...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB Atlas!');

    // --- Seed Content ---
    const contentPath = path.join(__dirname, 'data', 'content.json');
    if (fs.existsSync(contentPath)) {
      const contentData = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
      
      // Upsert: update if exists, create if not
      await Content.findOneAndUpdate(
        { key: 'main' },
        { key: 'main', pages: contentData },
        { upsert: true, new: true }
      );
      console.log(`✅ Content seeded! (${contentData.length} pages)`);
    } else {
      console.log('⚠️  content.json not found, skipping...');
    }

    // --- Seed Help ---
    const helpPath = path.join(__dirname, 'data', 'help.json');
    if (fs.existsSync(helpPath)) {
      const helpData = JSON.parse(fs.readFileSync(helpPath, 'utf8'));
      
      await Help.findOneAndUpdate(
        { key: 'main' },
        { key: 'main', mobile: helpData.mobile, desktop: helpData.desktop },
        { upsert: true, new: true }
      );
      console.log(`✅ Help seeded! (${helpData.mobile.length} mobile steps, ${helpData.desktop.length} desktop steps)`);
    } else {
      console.log('⚠️  help.json not found, skipping...');
    }

    console.log('\n🎉 Migration complete! Your data is now in MongoDB Atlas.');
    console.log('   You can safely deploy without worrying about data loss.');

  } catch (err) {
    console.error('❌ Seeding failed:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB.');
  }
}

seed();
