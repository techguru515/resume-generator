const mongoose = require('mongoose');

const CVSchema = new mongoose.Schema(
  {
    role_title: { type: String, required: true },
    developer_title: { type: String, required: true },
    company_name: { type: String, required: true },
    job_type: { type: String, enum: ['Contract', 'Permanent'], required: true },
    remote_status: {
      type: String,
      enum: ['Remote', 'Hybrid', 'On-site', 'Unspecified'],
      default: 'Unspecified',
    },
    salary_range: { type: String, default: '' },
    summary: { type: String, required: true },
    skills: { type: Map, of: [String], required: true },
    /**
     * Dynamic experience payload.
     * - When profile has workExperiences: keys are experience1..experienceN (arrays of strings).
     * - When profile has no workExperiences: may include role1/company1/date1 + experience1, etc (up to syntheticRoleCount).
     */
    experiences: { type: mongoose.Schema.Types.Mixed, default: {} },
    job_link: { type: String, default: '' },
    job_description: { type: String },
    jobDescriptionId: { type: 'ObjectId', ref: 'JobDescription', default: null },
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
