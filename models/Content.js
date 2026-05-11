const mongoose = require('mongoose');

const PopupSchema = new mongoose.Schema({
  header: { type: String, default: '' },
  text: { type: String, default: '' },
  links: { type: [String], default: [] },
  qrcode: { type: String, default: '' },
  audio: { type: String, default: '' },
  image: { type: String, default: '' },
  orderNum: { type: String, default: '' }
}, { _id: false, strict: false });

const PageSchema = new mongoose.Schema({
  page: { type: Number, required: true },
  title: { type: String, default: '' },
  audio: { type: String, default: '' },
  popups: { type: [PopupSchema], default: [] }
}, { _id: false, strict: false });

const ContentSchema = new mongoose.Schema({
  key: { type: String, default: 'main', unique: true },
  pages: { type: [PageSchema], default: [] }
}, { timestamps: true });

module.exports = mongoose.model('Content', ContentSchema);
