const mongoose = require('mongoose');

const JobDescriptionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    text: { type: String, default: '' },
  },
  { timestamps: true }
);

JobDescriptionSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('JobDescription', JobDescriptionSchema);

