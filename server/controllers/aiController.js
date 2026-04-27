const CV = require('../models/CV');
const Profile = require('../models/Profile');
const { askCvAssistant } = require('../services/openaiAssistantService');

function ownerFilter(req) {
  if (req.user?.role === 'admin') return {};
  return { userId: req.user._id };
}

// POST /api/ai/cv-chat  { cvId, message, history?: [{role,content}] }
exports.cvChat = async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({
        error: 'OpenAI is not configured. Add OPENAI_API_KEY to server/.env and restart.',
      });
    }

    const { cvId, message, history } = req.body || {};
    if (!cvId) return res.status(400).json({ error: 'cvId is required' });
    const q = String(message || '').trim();
    if (!q) return res.status(400).json({ error: 'message is required' });

    const cv = await CV.findOne({ _id: cvId, ...ownerFilter(req) }).lean();
    if (!cv) return res.status(404).json({ error: 'CV not found' });

    const profile = await Profile.findById(cv.profileId).lean();
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const answer = await askCvAssistant({
      profile,
      cv,
      jobDescription: cv.job_description || '',
      question: q,
      history,
    });

    res.json({ answer });
  } catch (err) {
    console.error('cvChat:', err?.stack || err);
    res.status(500).json({ error: err.message || 'AI assistant failed' });
  }
};

