const Template = require('../models/Template');
const CV = require('../models/CV');
const Profile = require('../models/Profile');
const { buildResumeViewModel, renderHandlebarsTemplate } = require('../services/templateRenderService');

function ownerFilter(req) {
  if (req.user?.role === 'admin') return {};
  return { $or: [{ isPublic: true }, { createdBy: req.user._id }] };
}

function cvOwnerFilter(req) {
  if (req.user?.role === 'admin') return {};
  return { userId: req.user._id };
}

const ALLOWED_TEMPLATE_NAMES = new Set([
  'Classic',
  'Executive (Two-column)',
  'Executive (Color)',
]);

exports.list = async (req, res) => {
  try {
    const templates = await Template.find(ownerFilter(req))
      .sort({ createdAt: 1 })
      .select('name kind builtInKey isPublic createdAt updatedAt');
    res.json((templates || []).filter((t) => ALLOWED_TEMPLATE_NAMES.has(String(t?.name || ''))));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    const t = await Template.findOne({ _id: req.params.id, ...ownerFilter(req) });
    if (!t) return res.status(404).json({ error: 'Template not found' });
    res.json(t);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/template/:id/preview?cvId=...
// Renders HTML for quick browser verification (Handlebars templates).
exports.preview = async (req, res) => {
  try {
    const { cvId } = req.query || {};
    if (!cvId) return res.status(400).send('cvId is required');

    const t = await Template.findOne({ _id: req.params.id, ...ownerFilter(req) });
    if (!t) return res.status(404).send('Template not found');

    if (t.kind !== 'handlebars') {
      return res
        .status(400)
        .send('Preview is currently supported for DB (handlebars) templates only.');
    }

    const cv = await CV.findOne({ _id: cvId, ...cvOwnerFilter(req) });
    if (!cv) return res.status(404).send('CV not found');

    const profile = await Profile.findById(cv.profileId);
    if (!profile) return res.status(404).send('Profile not found');

    const vm = buildResumeViewModel(cv.toObject(), profile.toObject());
    const html = renderHandlebarsTemplate({ html: t.html, css: t.css }, vm);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    res.status(500).send(err.message || 'Template preview failed');
  }
};

// Admin only
exports.create = async (req, res) => {
  try {
    const body = { ...(req.body || {}) };
    const t = await Template.create({
      name: body.name,
      kind: body.kind,
      builtInKey: body.builtInKey ?? null,
      html: body.html ?? '',
      css: body.css ?? '',
      isPublic: body.isPublic !== false,
      createdBy: req.user?._id || null,
    });
    res.status(201).json(t);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Admin only
exports.update = async (req, res) => {
  try {
    const body = { ...(req.body || {}) };
    delete body._id;
    delete body.createdBy;
    const t = await Template.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true });
    if (!t) return res.status(404).json({ error: 'Template not found' });
    res.json(t);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Admin only
exports.remove = async (req, res) => {
  try {
    const t = await Template.findByIdAndDelete(req.params.id);
    if (!t) return res.status(404).json({ error: 'Template not found' });
    res.json({ message: 'Template deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

