const mongoose = require('mongoose');

const CVSchema = new mongoose.Schema(
  {
    role_title: { type: String, required: true },
    developer_title: { type: String, required: true },
    company_name: { type: String, required: true },
    job_type: { type: String, enum: ['Contract', 'Permanent'], required: true },
    salary_range: { type: String, default: '' },
    summary: { type: String, required: true },
    skills: { type: Map, of: [String], required: true },
    experiences: {
      role1: String,
      experience1: [String],
      role2: String,
      experience2: [String],
      role3: String,
      experience3: [String],
    },
    job_link: { type: String, default: '' },
    job_description: { type: String },
    application_status: {
      type: String,
      enum: ['saved', 'applied', 'interview', 'offer', 'rejected'],
      default: 'saved',
    },
    userId: { type: 'ObjectId', ref: 'User' },
    profileId: { type: 'ObjectId', ref: 'Profile' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CV', CVSchema);
