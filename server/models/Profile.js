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

const CV_FORMATS = ['classic', 'minimal', 'executive'];

/** Drives OpenAI CV JSON shape / counts for this profile (Profiles tab → “CV generation”). */
const CvGenerationSchema = new mongoose.Schema(
  {
    yearsExperienceMention: { type: Number, default: 11 },
    summarySentencesMin: { type: Number, default: 3 },
    summarySentencesMax: { type: Number, default: 4 },
    skillsCategoriesMin: { type: Number, default: 4 },
    skillsCategoriesMax: { type: Number, default: 6 },
    skillsPerCategoryMin: { type: Number, default: 8 },
    skillsPerCategoryMax: { type: Number, default: 10 },
    skillsMinTotal: { type: Number, default: 30 },
    /** e.g. ["12-15","10-12","6-8"] — job slot i uses index min(i-1, length-1) for further rows */
    experienceBulletRanges: { type: [String], default: undefined },
    /** When profile has no work rows: number of synthetic role/bullet blocks (max 3 matches CV schema). */
    syntheticRoleCount: { type: Number, default: 3, min: 1, max: 3 },
    preCheckEnabled: { type: Boolean, default: true },
    extraInstructions: { type: String, default: '' },
    /** When non-empty, replaces the built ATS template for OpenAI system message (see server appendJsonContract). */
    customSystemPrompt: { type: String, default: '', maxlength: 48000 },
  },
  { _id: false }
);

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
    /** Export layout style used for DOCX/PDF generation. */
    cvFormat: { type: String, enum: CV_FORMATS, default: 'classic' },
    /** Selected template for PDF rendering (optional). */
    templateId: { type: 'ObjectId', ref: 'Template', default: null },
    /**
     * Server-side folder for extra copies when users download PDF/DOCX (optional).
     * Empty uses project-root ./cv. Absolute OS path or path relative to project root (no ".." escape).
     */
    cvSaveFolder: { type: String, default: '', trim: true, maxlength: 2048 },
    cvGeneration: { type: CvGenerationSchema, default: () => ({}) },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Profile', ProfileSchema);
