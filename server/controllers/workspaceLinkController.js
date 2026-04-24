const mongoose = require('mongoose');
const UploadedLink = require('../models/UploadedLink');
const Profile = require('../models/Profile');
const CV = require('../models/CV');
const JobDescription = require('../models/JobDescription');
const { generateCvJsonWithOpenAI } = require('../services/openaiCvService');

function normalizeUrl(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  try {
    const u = new URL(s);
    const host = u.host.toLowerCase();
    let path = u.pathname || '/';
    if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
    return `${u.protocol}//${host}${path}${u.search}`.toLowerCase();
  } catch {
    return s.toLowerCase();
  }
}

// GET /api/workspace-links?profileId=
exports.list = async (req, res) => {
  try {
    const filter = { userId: req.user._id };
    const { profileId } = req.query;
    if (profileId && profileId !== 'all') {
      if (!mongoose.Types.ObjectId.isValid(profileId)) {
        return res.status(400).json({ error: 'Invalid profileId' });
      }
      filter.profileId = profileId;
    }
    const links = await UploadedLink.find(filter)
      .populate('jobDescriptionId', 'text')
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(2000)
      .lean();
    res.json(links);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/workspace-links  { sourceFileName, urls: string[] }
exports.saveBatch = async (req, res) => {
  try {
    const { sourceFileName, urls } = req.body || {};
    if (!sourceFileName || typeof sourceFileName !== 'string') {
      return res.status(400).json({ error: 'sourceFileName is required' });
    }
    if (!Array.isArray(urls)) {
      return res.status(400).json({ error: 'urls must be an array' });
    }
    const trimmedUrls = urls.map((u) => String(u || '').trim()).filter(Boolean);
    if (trimmedUrls.length === 0) {
      return res.status(400).json({ error: 'urls must contain at least one non-empty URL' });
    }
    if (trimmedUrls.length > 500) {
      return res.status(400).json({ error: 'Maximum 500 URLs per request' });
    }

    const userId = req.user._id;
    const results = [];

    for (const url of trimmedUrls) {
      if (url.length > 2048) continue;
      const normalizedUrl = normalizeUrl(url);
      if (!normalizedUrl) continue;
      const normKey = normalizedUrl.slice(0, 2048);

      const existing = await UploadedLink.findOne({ userId, normalizedUrl: normKey });

      if (existing) {
        // Same URL seen again: mark duplicate and refresh updatedAt only here — not on profile/JD/CV edits.
        await UploadedLink.updateOne(
          { _id: existing._id },
          {
            $set: {
              sourceFileName: sourceFileName.slice(0, 512),
              url: url.slice(0, 2048),
              normalizedUrl: normKey,
              profileId: existing.profileId ?? null,
              isDuplicate: true,
              updatedAt: new Date(),
            },
          },
          { timestamps: false }
        );
        const updated = await UploadedLink.findById(existing._id).lean();
        results.push(updated);
        continue;
      }

      const doc = await UploadedLink.create({
        userId,
        profileId: null, // default: no profile until a CV is created from this link
        sourceFileName: sourceFileName.slice(0, 512),
        url: url.slice(0, 2048),
        normalizedUrl: normKey,
        isDuplicate: false,
        cvStatus: 'not_started',
      });
      results.push(doc.toObject());
    }

    if (results.length === 0) {
      return res.status(400).json({ error: 'No valid URLs to save' });
    }

    res.status(201).json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/workspace-links/delete-batch  { ids: string[] }
exports.removeBatch = async (req, res) => {
  try {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids must be a non-empty array' });
    }
    if (ids.length > 500) {
      return res.status(400).json({ error: 'Maximum 500 ids per request' });
    }

    const objectIds = [];
    for (const id of ids) {
      if (!mongoose.Types.ObjectId.isValid(String(id))) {
        return res.status(400).json({ error: 'Invalid id in list' });
      }
      objectIds.push(new mongoose.Types.ObjectId(String(id)));
    }

    const result = await UploadedLink.deleteMany({
      _id: { $in: objectIds },
      userId: req.user._id,
    });

    res.json({ deletedCount: result.deletedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/workspace-links/set-profile  { ids: string[], profileId: string }
// Used when a link is used to create a CV; sets the profile that was used at that moment.
exports.setProfileForLinks = async (req, res) => {
  try {
    const { ids, profileId } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids must be a non-empty array' });
    }
    if (ids.length > 500) {
      return res.status(400).json({ error: 'Maximum 500 ids per request' });
    }

    const objectIds = [];
    for (const id of ids) {
      if (!mongoose.Types.ObjectId.isValid(String(id))) {
        return res.status(400).json({ error: 'Invalid id in list' });
      }
      objectIds.push(new mongoose.Types.ObjectId(String(id)));
    }

    // Allow clearing profile back to "no profile"
    const requested = profileId == null ? '' : String(profileId).trim();
    if (!requested) {
      const result = await UploadedLink.updateMany(
        { _id: { $in: objectIds }, userId: req.user._id },
        { $set: { profileId: null } },
        { timestamps: false }
      );
      return res.json({
        matchedCount: result.matchedCount ?? result.n,
        modifiedCount: result.modifiedCount ?? result.nModified,
      });
    }

    if (!mongoose.Types.ObjectId.isValid(requested)) {
      return res.status(400).json({ error: 'Invalid profileId' });
    }

    const profile = await Profile.findOne({ _id: requested, userId: req.user._id }).lean();
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const result = await UploadedLink.updateMany(
      { _id: { $in: objectIds }, userId: req.user._id },
      { $set: { profileId: profile._id } },
      { timestamps: false }
    );

    res.json({ matchedCount: result.matchedCount ?? result.n, modifiedCount: result.modifiedCount ?? result.nModified });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/workspace-links/set-jd  { id: string, jobDescription: string }
exports.setJobDescriptionForLink = async (req, res) => {
  try {
    const { id, jobDescription } = req.body || {};
    if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const jd = String(jobDescription || '')
      .replace(/\r/g, '\n')
      .trim()
      .slice(0, 18_000);

    const link = await UploadedLink.findOne({ _id: String(id), userId: req.user._id });
    if (!link) return res.status(404).json({ error: 'Link not found' });

    let jdDoc = null;
    if (link.jobDescriptionId) {
      jdDoc = await JobDescription.findOneAndUpdate(
        { _id: link.jobDescriptionId, userId: req.user._id },
        { $set: { text: jd } },
        { new: true }
      ).lean();
    }
    if (!jdDoc) {
      jdDoc = await JobDescription.create({ userId: req.user._id, text: jd });
      await UploadedLink.updateOne(
        { _id: link._id, userId: req.user._id },
        { $set: { jobDescriptionId: jdDoc._id } },
        { timestamps: false }
      );
    }

    const updated = await UploadedLink.findOne({ _id: String(id), userId: req.user._id })
      .populate('jobDescriptionId', 'text')
      .lean();

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

function validOid(v) {
  return v != null && v !== '' && mongoose.Types.ObjectId.isValid(String(v));
}

function linkProfileIdOrDefault(link, defaultProfileId) {
  if (validOid(link.profileId)) return String(link.profileId);
  return defaultProfileId;
}

// POST /api/workspace-links/generate-cvs  { ids: string[], profileId: string, jobDescriptionsByLinkId?: Record<string,string> }
// Uses each link's stored profileId when set; otherwise falls back to body profileId.
exports.generateCvsForLinks = async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({
        error: 'OpenAI is not configured. Add OPENAI_API_KEY to server/.env and restart.',
      });
    }

    const { ids, profileId, jobDescriptionsByLinkId } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids must be a non-empty array' });
    }
    if (ids.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 links per request' });
    }

    const objectIds = [];
    for (const id of ids) {
      if (!mongoose.Types.ObjectId.isValid(String(id))) {
        return res.status(400).json({ error: 'Invalid id in list' });
      }
      objectIds.push(new mongoose.Types.ObjectId(String(id)));
    }

    const links = await UploadedLink.find({ _id: { $in: objectIds }, userId: req.user._id }).lean();
    if (links.length === 0) return res.status(404).json({ error: 'No matching links found' });

    const defaultProfileId = validOid(profileId) ? String(profileId) : '';
    const linksNeedingDefault = links.filter((l) => !validOid(l.profileId));
    if (linksNeedingDefault.length > 0 && !defaultProfileId) {
      return res.status(400).json({
        error:
          'Assign a profile to each selected link (Profile column), or send profileId for links without one.',
      });
    }

    // Mark as pending first (best-effort).
    await UploadedLink.updateMany(
      { _id: { $in: links.map((l) => l._id) }, userId: req.user._id },
      { $set: { cvStatus: 'pending', cvError: '' } },
      { timestamps: false }
    );

    const created = [];
    const failed = [];

    const jdMap = (jobDescriptionsByLinkId && typeof jobDescriptionsByLinkId === 'object')
      ? jobDescriptionsByLinkId
      : {};

    const jdIds = [...new Set(links.map((l) => String(l.jobDescriptionId || '')).filter(Boolean))];
    const jdDocs = jdIds.length
      ? await JobDescription.find({ _id: { $in: jdIds }, userId: req.user._id }).lean()
      : [];
    const jdTextById = Object.fromEntries(jdDocs.map((d) => [String(d._id), String(d.text || '')]));

    const profileCache = new Map();

    async function profileForLink(link) {
      const pid = linkProfileIdOrDefault(link, defaultProfileId);
      if (!validOid(pid)) {
        throw new Error('No profile for this link. Choose one in the Profile column.');
      }
      const key = String(pid);
      if (profileCache.has(key)) return profileCache.get(key);
      const doc = await Profile.findOne({ _id: pid, userId: req.user._id });
      if (!doc) throw new Error('Profile not found for this link.');
      profileCache.set(key, doc);
      return doc;
    }

    // Sequential to avoid many OpenAI calls at once.
    for (const link of links) {
      const linkId = String(link._id);
      const jobLink = String(link.url || '').trim();
      try {
        if (!jobLink) throw new Error('Link URL is empty');

        const rawJd = String(jdTextById[String(link.jobDescriptionId || '')] || jdMap[linkId] || '').trim();
        const jobText = rawJd
          .replace(/\r/g, '\n')
          .replace(/[ \t]+\n/g, '\n')
          .replace(/\n{3,}/g, '\n\n')
          .trim()
          .slice(0, 18_000);

        if (!jobText || jobText.length < 40) {
          throw new Error('Job description is missing for this link');
        }

        const profile = await profileForLink(link);

        const payload = await generateCvJsonWithOpenAI({
          jobDescription: jobText,
          jobLink,
          profile: profile.toObject(),
        });

        const cv = new CV({
          ...payload,
          userId: req.user._id,
          profileId: profile._id,
          job_link: jobLink,
          job_description: jobText,
          jobDescriptionId: link.jobDescriptionId || null,
        });
        await cv.save();

        await UploadedLink.updateOne(
          { _id: link._id, userId: req.user._id },
          { $set: { cvStatus: 'created', cvId: cv._id, cvError: '', profileId: profile._id } },
          { timestamps: false }
        );

        created.push(cv.toObject());
      } catch (err) {
        const msg = err?.message ? String(err.message) : 'CV generation failed';
        await UploadedLink.updateOne(
          { _id: link._id, userId: req.user._id },
          { $set: { cvStatus: 'failed', cvError: msg.slice(0, 600) } },
          { timestamps: false }
        );
        failed.push({ linkId, error: msg });
      }
    }

    const freshLinks = await UploadedLink.find({ userId: req.user._id })
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(2000)
      .lean();

    res.json({ createdCount: created.length, failedCount: failed.length, created, failed, links: freshLinks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
