require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function seed() {
  console.log('🔌 Connecting to Supabase...');

  try {
    // --- Seed Content ---
    const contentPath = path.join(__dirname, 'data', 'content.json');
    if (fs.existsSync(contentPath)) {
      const contentData = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
      const { error } = await supabase
        .from('app_data')
        .upsert({ id: 'content', data: contentData });
      
      if (error) throw error;
      console.log('✅ content.json seeded to Supabase!');
    }

    // --- Seed Help ---
    const helpPath = path.join(__dirname, 'data', 'help.json');
    if (fs.existsSync(helpPath)) {
      const helpData = JSON.parse(fs.readFileSync(helpPath, 'utf8'));
      const { error } = await supabase
        .from('app_data')
        .upsert({ id: 'help', data: helpData });
      
      if (error) throw error;
      console.log('✅ help.json seeded to Supabase!');
    }

    console.log('\n🎉 Migration complete!');
  } catch (err) {
    console.error('❌ Seeding failed:', err.message);
  }
}

seed();
