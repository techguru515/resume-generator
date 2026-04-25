const Profile = require('../models/Profile');

// GET /api/profile — list all profiles for the logged-in user
exports.list = async (req, res) => {
  try {
    const profiles = await Profile.find({ userId: req.user._id }).sort({ createdAt: 1 });
    res.json(profiles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/profile — create a new profile
exports.create = async (req, res) => {
  try {
    const profile = await Profile.create({ ...req.body, userId: req.user._id });
    res.status(201).json(profile);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// PUT /api/profile/:id — update a profile owned by the user
exports.update = async (req, res) => {
  try {
    const body = { ...(req.body || {}) };
    delete body.userId;
    delete body._id;
    const profile = await Profile.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      body,
      { new: true, runValidators: true }
    );
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    res.json(profile);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// GET /api/profile/:id — get a single profile (admin can access any, clients only their own)
exports.getOne = async (req, res) => {
  try {
    const filter = req.user.role === 'admin'
      ? { _id: req.params.id }
      : { _id: req.params.id, userId: req.user._id };
    const profile = await Profile.findOne(filter);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/profile/:id — delete a profile owned by the user
exports.remove = async (req, res) => {
  try {
    const profile = await Profile.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    res.json({ message: 'Profile deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
