const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data', 'content.json');

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

// API: Get content
app.get('/api/content', (req, res) => {
  fs.readFile(DATA_FILE, 'utf8', (err, data) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to read data' });
    }
    res.json(JSON.parse(data));
  });
});

// API: Save content
app.post('/api/content', (req, res) => {
  const newContent = req.body;
  fs.writeFile(DATA_FILE, JSON.stringify(newContent, null, 2), 'utf8', (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to save data' });
    }
    res.json({ message: 'Content saved successfully' });
  });
});

// API: Upload QR code
app.post('/api/upload-qr', upload.single('qrcode'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const url = `/uploads/qrcodes/${req.file.filename}`;
  res.json({ message: 'QR code uploaded', url });
});

// API: Upload Audio
app.post('/api/upload-audio', uploadAudio.single('audio'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const url = `/uploads/audio/${req.file.filename}`;
  res.json({ message: 'Audio uploaded', url });
});

app.listen(PORT, () => {
  console.log(`CMS Backend running at http://localhost:${PORT}`);
});
