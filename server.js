require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Supabase Setup ───────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  console.log('✅ Supabase client initialized');
} else {
  console.warn('⚠️  Supabase variables not set. Falling back to local files.');
}

// ─── Local Fallback Paths ─────────────────────────────────────────
const DATA_FILE = path.join(__dirname, 'data', 'content.json');
const HELP_FILE = path.join(__dirname, 'data', 'help.json');

// ─── Multer Setup (Memory Storage for Supabase) ───────────────────
// We use memoryStorage so the file is kept in RAM buffer and directly 
// uploaded to Supabase Storage without touching the ephemeral disk.
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB max

app.use(cors());
app.use(express.json());

// Serve local uploads statically (only needed if falling back to local storage)
app.use('/uploads', express.static(path.join(__dirname, 'public')));

// ─── API: Get content ───────────────────────────────────────────────
app.get('/api/content', async (req, res) => {
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('app_data')
        .select('data')
        .eq('id', 'content')
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error('Supabase error:', error);
      } else if (data) {
        return res.json(data.data);
      }
    }

    // Fallback: read from file
    fs.readFile(DATA_FILE, 'utf8', (err, data) => {
      if (err) return res.status(500).json({ error: 'Failed to read local data' });
      res.json(JSON.parse(data));
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to read data' });
  }
});

// ─── API: Save content ──────────────────────────────────────────────
app.post('/api/content', async (req, res) => {
  try {
    const newContent = req.body;

    // Auto-update QR Codes before saving
    if (Array.isArray(newContent)) {
      newContent.forEach(page => {
        if (Array.isArray(page.popups)) {
          page.popups.forEach(popup => {
            // Auto generate QR code based on the first link if not using an uploaded custom image
            if (popup.links && popup.links.length > 0) {
              // Only override if it's an auto-generated one or empty. Leave it alone if it's a custom uploaded Supabase image.
              if (!popup.qrcode || popup.qrcode.includes('api.qrserver.com')) {
                popup.qrcode = "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" + encodeURIComponent(popup.links[0]);
              }
            } else if (popup.qrcode && popup.qrcode.includes('api.qrserver.com')) {
              // If there's no link anymore but it has an auto QR, clear it
              popup.qrcode = "";
            }
          });
        }
      });
    }

    if (supabase) {
      const { error } = await supabase
        .from('app_data')
        .upsert({ id: 'content', data: newContent });
      
      if (error) {
        console.error('Supabase error:', error);
        return res.status(500).json({ error: 'Failed to save to Supabase' });
      }
      return res.json({ message: 'Content saved to Supabase successfully' });
    }

    // Fallback: write to file
    fs.writeFile(DATA_FILE, JSON.stringify(newContent, null, 2), 'utf8', (err) => {
      if (err) return res.status(500).json({ error: 'Failed to save local data' });
      res.json({ message: 'Content saved locally successfully' });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save data' });
  }
});

// ─── Help Guide API ─────────────────────────────────────────────────

// API: Get help guide steps
app.get('/api/help', async (req, res) => {
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('app_data')
        .select('data')
        .eq('id', 'help')
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Supabase error:', error);
      } else if (data) {
        return res.json(data.data);
      }
    }

    // Fallback: read from file
    fs.readFile(HELP_FILE, 'utf8', (err, data) => {
      if (err) return res.status(500).json({ error: 'Failed to read local help data' });
      res.json(JSON.parse(data));
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to read help data' });
  }
});

// API: Save help guide steps
app.post('/api/help', async (req, res) => {
  try {
    const newHelp = req.body;

    if (supabase) {
      const { error } = await supabase
        .from('app_data')
        .upsert({ id: 'help', data: newHelp });
      
      if (error) {
        console.error('Supabase error:', error);
        return res.status(500).json({ error: 'Failed to save help to Supabase' });
      }
      return res.json({ message: 'Help guide saved to Supabase successfully' });
    }

    // Fallback: write to file
    fs.writeFile(HELP_FILE, JSON.stringify(newHelp, null, 2), 'utf8', (err) => {
      if (err) return res.status(500).json({ error: 'Failed to save local help data' });
      res.json({ message: 'Help guide saved locally successfully' });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save help data' });
  }
});

// ─── API: Upload QR code & Audio ────────────────────────────────────
// Generalized upload handler for Supabase
async function handleSupabaseUpload(req, res, folderName) {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  
  if (!supabase) {
    // We cannot fallback cleanly because we removed diskStorage to save memory.
    // If you need local uploads, you should keep the old multer setup.
    return res.status(500).json({ error: 'Supabase not configured for uploads' });
  }

  try {
    const file = req.file;
    const ext = path.extname(file.originalname);
    const page = req.body.page || 'unknown';
    const index = req.body.popupIndex !== undefined ? `_i${req.body.popupIndex}` : '';
    
    // Create unique filename
    const fileName = `${folderName}/p${page}${index}_${Date.now()}${ext}`;

    // Upload to Supabase Storage Bucket 'uploads'
    const { data, error } = await supabase.storage
      .from('uploads')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      });

    if (error) throw error;

    // Get the public URL
    const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(fileName);
    
    res.json({ message: 'File uploaded successfully', url: urlData.publicUrl });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Failed to upload file to Supabase' });
  }
}

app.post('/api/upload-qr', upload.single('qrcode'), (req, res) => {
  handleSupabaseUpload(req, res, 'qrcodes');
});

app.post('/api/upload-audio', upload.single('audio'), (req, res) => {
  handleSupabaseUpload(req, res, 'audio');
});

app.listen(PORT, () => {
  console.log(`CMS Backend running at http://localhost:${PORT}`);
});
