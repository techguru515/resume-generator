const CV = require('../models/CV');
const Profile = require('../models/Profile');
const { generateDocx } = require('../services/docxService');
const { generatePdf, generateCoverLetterPdf } = require('../services/pdfService');
const { generateCvJsonWithOpenAI } = require('../services/openaiCvService');
const path = require('path');
const fs = require('fs/promises');
const { resolveCvSaveDir, getDefaultCvSaveDir } = require('../utils/cvSavePath');

function safeBaseName(name) {
  const s = String(name || '').trim() || 'CV';
  return s
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

async function saveDownloadCopy({ buffer, filename, profile }) {
  let outDir;
  try {
    outDir = resolveCvSaveDir(profile);
  } catch (e) {
    console.warn('CV save folder invalid, using default ./cv:', e?.message || e);
    outDir = getDefaultCvSaveDir();
  }
  try {
    await fs.mkdir(outDir, { recursive: true });
    await fs.writeFile(path.join(outDir, filename), buffer);
  } catch (e) {
    console.warn('Could not write CV copy to disk:', e?.message || e);
  }
}

function rawProfileIdRef(ref) {
  if (ref == null) return null;
  if (typeof ref === 'object' && ref !== null && ref._id != null) return ref._id;
  return ref;
}

async function getProfileById(profileId) {
  const id = rawProfileIdRef(profileId);
  const profile = await Profile.findById(id);
  if (!profile) throw new Error('Profile not found. Please select a valid profile.');
  return profile;
}

function ownerFilter(req) {
  // Admins see all; clients see only their own
  if (req.user.role === 'admin') return {};
  return { userId: req.user._id };
}

// POST /api/cv/generate — OpenAI: extract job facts from unstructured text, then draft CV JSON (does not persist)
exports.generateWithAi = async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({
        error: 'OpenAI is not configured. Add OPENAI_API_KEY to server/.env and restart.',
      });
    }
    const { job_description, job_link, profileId } = req.body || {};
    if (!profileId) return res.status(400).json({ error: 'profileId is required' });
    const jd = job_description != null ? String(job_description).trim() : '';
    if (!jd) return res.status(400).json({ error: 'job_description is required' });

    const profile = await Profile.findOne({ _id: profileId, userId: req.user._id });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const payload = await generateCvJsonWithOpenAI({
      jobDescription: jd,
      jobLink: job_link != null ? String(job_link).trim() : '',
      profile: profile.toObject(),
    });
    res.json(payload);
  } catch (err) {
    console.error('generateWithAi:', err.message);
    res.status(500).json({ error: err.message || 'AI generation failed' });
  }
};

// POST /api/cv
exports.save = async (req, res) => {
  try {
    const { job_description, job_link, profileId, ...cvData } = req.body;
    if (!profileId) return res.status(400).json({ error: 'profileId is required' });
    const cv = new CV({ ...cvData, job_description, job_link, profileId, userId: req.user._id });
    await cv.save();
    res.status(201).json(cv);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// GET /api/cv
exports.list = async (req, res) => {
  try {
    const cvs = await CV.find(ownerFilter(req))
      .sort({ createdAt: -1 })
      .select('-experiences -skills -summary -job_description -__v')
      .populate('userId', 'name email')
      .populate('profileId', 'label');
    res.json(cvs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/cv/:id
exports.getOne = async (req, res) => {
  try {
    const cv = await CV.findOne({ _id: req.params.id, ...ownerFilter(req) });
    if (!cv) return res.status(404).json({ error: 'CV not found' });
    res.json(cv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/cv/:id
exports.update = async (req, res) => {
  try {
    const cv = await CV.findOneAndUpdate(
      { _id: req.params.id, ...ownerFilter(req) },
      req.body,
      { new: true, runValidators: true }
    );
    if (!cv) return res.status(404).json({ error: 'CV not found' });
    res.json(cv);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// POST or PATCH /api/cv/:id/status  { application_status }
exports.updateStatus = async (req, res) => {
  try {
    const { application_status } = req.body || {};
    const allowed = ['saved', 'applied', 'interview', 'offer', 'failed'];
    if (!allowed.includes(application_status))
      return res.status(400).json({ error: 'Invalid status' });
    const cv = await CV.findOneAndUpdate(
      { _id: req.params.id, ...ownerFilter(req) },
      { application_status },
      { new: true, runValidators: true }
    );
    if (!cv) return res.status(404).json({ error: 'CV not found' });
    res.json({ _id: cv._id, application_status: cv.application_status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/cv/:id
exports.remove = async (req, res) => {
  try {
    const cv = await CV.findOneAndDelete({ _id: req.params.id, ...ownerFilter(req) });
    if (!cv) return res.status(404).json({ error: 'CV not found' });
    res.json({ message: 'CV deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/cv/:id/download/docx
exports.downloadDocx = async (req, res) => {
  try {
    const cv = await CV.findOne({ _id: req.params.id, ...ownerFilter(req) });
    if (!cv) return res.status(404).json({ error: 'CV not found' });
    const profile = await Profile.findById(rawProfileIdRef(cv.profileId)).populate('templateId');
    if (!profile) return res.status(404).json({ error: 'Profile not found for this CV' });
    const tpl = profile.templateId && typeof profile.templateId === 'object' ? profile.templateId.toObject() : null;
    const format = tpl && tpl.kind === 'built_in' && tpl.builtInKey ? tpl.builtInKey : profile.cvFormat;

    const buffer = await generateDocx(cv.toObject(), profile.toObject(), { format });
    const filename = `${safeBaseName(profile.name)}.docx`;
    await saveDownloadCopy({ buffer, filename, profile });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    console.error('downloadDocx:', err?.stack || err);
    res.status(500).json({ error: err.message || 'DOCX download failed' });
  }
};

// GET /api/cv/:id/download/pdf
exports.downloadPdf = async (req, res) => {
  try {
    const cv = await CV.findOne({ _id: req.params.id, ...ownerFilter(req) });
    if (!cv) return res.status(404).json({ error: 'CV not found' });
    const profile = await Profile.findById(rawProfileIdRef(cv.profileId)).populate('templateId');
    if (!profile) return res.status(404).json({ error: 'Profile not found for this CV' });
    const tpl = profile.templateId && typeof profile.templateId === 'object' ? profile.templateId.toObject() : null;

    const buffer = await generatePdf(cv.toObject(), profile.toObject(), {
      format: profile.cvFormat,
      template: tpl,
    });
    const filename = `${safeBaseName(profile.name)}.pdf`;
    await saveDownloadCopy({ buffer, filename, profile });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);

    res.end(buffer);
  } catch (err) {
    console.error('downloadPdf:', err?.stack || err);
    res.status(500).json({ error: err.message || 'PDF download failed' });
  }
};

// GET /api/cv/:id/download/cover-letter/pdf
exports.downloadCoverLetterPdf = async (req, res) => {
  try {
    const cv = await CV.findOne({ _id: req.params.id, ...ownerFilter(req) });
    if (!cv) return res.status(404).json({ error: 'CV not found' });
    const profile = await Profile.findById(rawProfileIdRef(cv.profileId));
    if (!profile) return res.status(404).json({ error: 'Profile not found for this CV' });

    const buffer = await generateCoverLetterPdf(cv.toObject(), profile.toObject());
    const filename = `${safeBaseName(profile.name)} - Cover Letter.pdf`;
    await saveDownloadCopy({ buffer, filename, profile });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  } catch (err) {
    console.error('downloadCoverLetterPdf:', err?.stack || err);
    const msg = err.message || 'Cover letter PDF download failed';
    res.status(msg.includes('No cover letter available') ? 400 : 500).json({ error: msg });
  }
};
