const mongoose = require('mongoose');
const UploadedLink = require('../models/UploadedLink');
const Profile = require('../models/Profile');

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
        const prevUpdated = existing.updatedAt || existing.createdAt;
        await UploadedLink.collection.updateOne(
          { _id: existing._id },
          {
            $set: {
              sourceFileName: sourceFileName.slice(0, 512),
              // Keep any profileId set during CV creation; uploads default to no profile.
              profileId: existing.profileId ?? null,
              url: url.slice(0, 2048),
              normalizedUrl: normKey,
              createdAt: prevUpdated,
              updatedAt: new Date(),
              isDuplicate: false,
            },
          }
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
    if (!profileId || !mongoose.Types.ObjectId.isValid(String(profileId))) {
      return res.status(400).json({ error: 'Invalid profileId' });
    }

    const profile = await Profile.findOne({ _id: profileId, userId: req.user._id }).lean();
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const objectIds = [];
    for (const id of ids) {
      if (!mongoose.Types.ObjectId.isValid(String(id))) {
        return res.status(400).json({ error: 'Invalid id in list' });
      }
      objectIds.push(new mongoose.Types.ObjectId(String(id)));
    }

    const result = await UploadedLink.updateMany(
      { _id: { $in: objectIds }, userId: req.user._id },
      { $set: { profileId: profile._id } }
    );

    res.json({ matchedCount: result.matchedCount ?? result.n, modifiedCount: result.modifiedCount ?? result.nModified });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
