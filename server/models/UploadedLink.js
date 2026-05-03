const mongoose = require('mongoose');

const CvErrorHistoryEntrySchema = new mongoose.Schema(
  {
    message: { type: String, required: true, maxlength: 2000 },
    failedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const UploadedLinkSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
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
    /** Latest failure message (also shown in workspace table). */
    cvError: { type: String, default: '' },
    /** Append-only log of generation failures for this link (newest at end after each push; server trims). */
    cvErrorHistory: { type: [CvErrorHistoryEntrySchema], default: [] },
  },
  { timestamps: true }
);

UploadedLinkSchema.index({ userId: 1, normalizedUrl: 1 });
// Workspace GET list + post-generate refresh: sort by activity
UploadedLinkSchema.index({ userId: 1, updatedAt: -1, createdAt: -1 });
// Optional ?profileId= filter with same sort
UploadedLinkSchema.index({ userId: 1, profileId: 1, updatedAt: -1 });

module.exports = mongoose.model('UploadedLink', UploadedLinkSchema);
