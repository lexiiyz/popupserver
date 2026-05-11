require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const Content = require('./models/Content');
const Help = require('./models/Help');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;
const DATA_FILE = path.join(__dirname, 'data', 'content.json');

// ─── MongoDB Connection ─────────────────────────────────────────────
if (MONGODB_URI) {
  mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ Connected to MongoDB Atlas'))
    .catch(err => console.error('❌ MongoDB connection error:', err.message));
} else {
  console.warn('⚠️  MONGODB_URI not set. Falling back to local JSON files.');
}

// Helper: check if MongoDB is connected
function isMongoConnected() {
  return mongoose.connection.readyState === 1;
}

// Ensure upload directories exist
const QR_DIR = path.join(__dirname, 'public', 'qrcodes');
if (!fs.existsSync(QR_DIR)) fs.mkdirSync(QR_DIR, { recursive: true });

const AUDIO_DIR = path.join(__dirname, 'public', 'audio');
if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });

// Multer config for QR code uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, QR_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const page = req.body.page || 'unknown';
    const index = req.body.popupIndex !== undefined ? `_i${req.body.popupIndex}` : '';
    const name = `qr_p${page}${index}_${Date.now()}${ext}`;
    cb(null, name);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Multer config for Audio uploads
const storageAudio = multer.diskStorage({
  destination: (req, file, cb) => cb(null, AUDIO_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const page = req.body.page || 'unknown';
    const type = req.body.type || 'bg'; // bg or popup
    const index = req.body.popupIndex !== undefined ? `_i${req.body.popupIndex}` : '';
    const name = `audio_${type}_p${page}${index}_${Date.now()}${ext}`;
    cb(null, name);
  }
});
const uploadAudio = multer({ storage: storageAudio, limits: { fileSize: 50 * 1024 * 1024 } });

app.use(cors());
app.use(express.json());

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'public')));

// ─── API: Get content ───────────────────────────────────────────────
app.get('/api/content', async (req, res) => {
  try {
    if (isMongoConnected()) {
      const doc = await Content.findOne({ key: 'main' });
      if (doc) {
        return res.json(doc.pages);
      }
      // If no data in MongoDB yet, return empty array
      return res.json([]);
    }

    // Fallback: read from file
    fs.readFile(DATA_FILE, 'utf8', (err, data) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Failed to read data' });
      }
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

    if (isMongoConnected()) {
      await Content.findOneAndUpdate(
        { key: 'main' },
        { key: 'main', pages: newContent },
        { upsert: true, new: true }
      );
      return res.json({ message: 'Content saved successfully' });
    }

    // Fallback: write to file
    fs.writeFile(DATA_FILE, JSON.stringify(newContent, null, 2), 'utf8', (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Failed to save data' });
      }
      res.json({ message: 'Content saved successfully' });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save data' });
  }
});

// ─── API: Upload QR code ────────────────────────────────────────────
app.post('/api/upload-qr', upload.single('qrcode'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const url = `/uploads/qrcodes/${req.file.filename}`;
  res.json({ message: 'QR code uploaded', url });
});

// ─── API: Upload Audio ──────────────────────────────────────────────
app.post('/api/upload-audio', uploadAudio.single('audio'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const url = `/uploads/audio/${req.file.filename}`;
  res.json({ message: 'Audio uploaded', url });
});

// ─── Help Guide API ─────────────────────────────────────────────────
const HELP_FILE = path.join(__dirname, 'data', 'help.json');

// API: Get help guide steps
app.get('/api/help', async (req, res) => {
  try {
    if (isMongoConnected()) {
      const doc = await Help.findOne({ key: 'main' });
      if (doc) {
        return res.json({ mobile: doc.mobile, desktop: doc.desktop });
      }
      return res.json({ mobile: [], desktop: [] });
    }

    // Fallback: read from file
    fs.readFile(HELP_FILE, 'utf8', (err, data) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Failed to read help data' });
      }
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

    if (isMongoConnected()) {
      await Help.findOneAndUpdate(
        { key: 'main' },
        { key: 'main', mobile: newHelp.mobile, desktop: newHelp.desktop },
        { upsert: true, new: true }
      );
      return res.json({ message: 'Help guide saved successfully' });
    }

    // Fallback: write to file
    fs.writeFile(HELP_FILE, JSON.stringify(newHelp, null, 2), 'utf8', (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Failed to save help data' });
      }
      res.json({ message: 'Help guide saved successfully' });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save help data' });
  }
});

app.listen(PORT, () => {
  console.log(`CMS Backend running at http://localhost:${PORT}`);
});
