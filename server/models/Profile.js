const mongoose = require('mongoose');

const EducationSchema = new mongoose.Schema({
  institution: { type: String, required: true },
  degree: { type: String, required: true },
  field: { type: String, default: '' },
  startYear: { type: String, default: '' },
  endYear: { type: String, default: '' },
}, { _id: false });

const CertificationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  issuer: { type: String, default: '' },
  year: { type: String, default: '' },
}, { _id: false });

const WorkExperienceSchema = new mongoose.Schema({
  company: { type: String, required: true },
  role: { type: String, required: true },
  startDate: { type: String, default: '' },
  endDate: { type: String, default: '' },
  current: { type: Boolean, default: false },
}, { _id: false });

const ProfileSchema = new mongoose.Schema(
  {
    userId: { type: 'ObjectId', ref: 'User', required: true },
    label: { type: String, required: true, trim: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, default: '' },
    location: { type: String, default: '' },
    linkedin: { type: String, default: '' },
    github: { type: String, default: '' },
    website: { type: String, default: '' },
    workExperiences: { type: [WorkExperienceSchema], default: [] },
    education: { type: [EducationSchema], default: [] },
    certifications: { type: [CertificationSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Profile', ProfileSchema);
