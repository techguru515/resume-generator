const mongoose = require('mongoose');

const UploadedLinkSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    profileId: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', default: null },
    sourceFileName: { type: String, required: true },
    url: { type: String, required: true },
    normalizedUrl: { type: String, required: true },
    isDuplicate: { type: Boolean, default: false },
    jobDescriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'JobDescription', default: null },
    cvStatus: {
      type: String,
      enum: ['not_started', 'pending', 'created', 'failed'],
      default: 'not_started',
      index: true,
    },
    cvId: { type: mongoose.Schema.Types.ObjectId, ref: 'CV', default: null },
    cvError: { type: String, default: '' },
  },
  { timestamps: true }
);

UploadedLinkSchema.index({ userId: 1, normalizedUrl: 1 });

module.exports = mongoose.model('UploadedLink', UploadedLinkSchema);
