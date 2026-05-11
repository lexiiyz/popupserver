const mongoose = require('mongoose');

const HelpStepSchema = new mongoose.Schema({
  text: { type: String, default: '' }
}, { _id: false });

const HelpSchema = new mongoose.Schema({
  key: { type: String, default: 'main', unique: true },
  mobile: { type: [HelpStepSchema], default: [] },
  desktop: { type: [HelpStepSchema], default: [] }
}, { timestamps: true });

module.exports = mongoose.model('Help', HelpSchema);
