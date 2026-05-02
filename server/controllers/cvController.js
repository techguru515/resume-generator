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

function setCvCopyPathHeader(res, meta) {
  if (!meta?.ok || !meta.path) return;
  try {
    res.setHeader('X-CV-Server-Copy-Path', Buffer.from(meta.path, 'utf8').toString('base64'));
  } catch (_) {
    /* ignore */
  }
}

async function saveDownloadCopy({ buffer, filename, profile }) {
  const configured =
    profile?.cvSaveFolder != null && String(profile.cvSaveFolder).trim() !== '';

  let outDir;
  try {
    outDir = resolveCvSaveDir(profile);
  } catch (e) {
    if (configured) {
      console.error(
        '[cv-save] Profile cvSaveFolder is set but invalid on this OS/path rules — using default ./cv. Folder was:',
        JSON.stringify(profile.cvSaveFolder),
        'Reason:',
        e?.message || e
      );
    } else {
      console.warn('[cv-save] resolve fallback:', e?.message || e);
    }
    outDir = getDefaultCvSaveDir();
  }

  const fullPath = path.join(outDir, filename);
  try {
    await fs.mkdir(outDir, { recursive: true });
    await fs.writeFile(fullPath, buffer);
    console.log('[cv-save] wrote server copy:', fullPath);
    return { ok: true, path: fullPath, dir: outDir };
  } catch (e) {
    console.error('[cv-save] Could not write CV copy:', fullPath, e?.message || e);
    return { ok: false, path: fullPath, dir: outDir, error: e?.message || String(e) };
  }
}

function rawProfileIdRef(ref) {
  if (ref == null) return null;
  if (typeof ref === 'object' && ref !== null && ref._id != null) return ref._id;
  return ref;
}

/** DOCX uses layout themes; DB templates are Handlebars for PDF — map by template name. */
function resolveDocxLayoutFormat(profile, tplPlain) {
  if (tplPlain?.kind === 'built_in' && tplPlain.builtInKey) return tplPlain.builtInKey;
  const n = String(tplPlain?.name || '');
  if (n === 'Classic') return 'classic';
  if (n.includes('Executive')) return 'executive';
  return profile.cvFormat || 'classic';
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
    const format = resolveDocxLayoutFormat(profile.toObject(), tpl);

    const buffer = await generateDocx(cv.toObject(), profile.toObject(), { format });
    const filename = `${safeBaseName(profile.name)}.docx`;
    const copyMeta = await saveDownloadCopy({ buffer, filename, profile });
    setCvCopyPathHeader(res, copyMeta);

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
    const copyMeta = await saveDownloadCopy({ buffer, filename, profile });
    setCvCopyPathHeader(res, copyMeta);

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
    const copyMeta = await saveDownloadCopy({ buffer, filename, profile });
    setCvCopyPathHeader(res, copyMeta);

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
