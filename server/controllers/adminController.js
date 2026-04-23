const User = require('../models/User');
const CV = require('../models/CV');
const Profile = require('../models/Profile');

// GET /api/admin/users
exports.listUsers = async (req, res) => {
  try {
    const users = await User.find({ role: 'client' }).select('-password').sort({ createdAt: -1 });
    const cvCounts = await CV.aggregate([
      { $group: { _id: '$userId', count: { $sum: 1 } } },
    ]);
    const countMap = Object.fromEntries(cvCounts.map((c) => [c._id?.toString(), c.count]));

    const result = users.map((u) => ({
      ...u.toObject(),
      cvCount: countMap[u._id.toString()] || 0,
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/admin/users/:id/approve
exports.toggleApprove = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || user.role === 'admin') return res.status(404).json({ error: 'User not found' });
    user.isApproved = !user.isApproved;
    await user.save();
    res.json({ _id: user._id, isApproved: user.isApproved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/admin/stats
exports.stats = async (req, res) => {
  try {
    const [totalClients, approvedClients, totalCVs] = await Promise.all([
      User.countDocuments({ role: 'client' }),
      User.countDocuments({ role: 'client', isApproved: true }),
      CV.countDocuments(),
    ]);
    res.json({ totalClients, approvedClients, pendingClients: totalClients - approvedClients, totalCVs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/admin/cvs  — all CVs across all users
exports.listAllCVs = async (req, res) => {
  try {
    const cvs = await CV.find()
      .sort({ createdAt: -1 })
      .select('-experiences -skills -summary -job_description -__v')
      .populate('userId', 'name email');
    res.json(cvs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/admin/users/:id/cvs
exports.getUserCVs = async (req, res) => {
  try {
    const cvs = await CV.find({ userId: req.params.id })
      .sort({ createdAt: -1 })
      .select('-experiences -skills -summary -job_description -__v')
      .populate('userId', 'name email');
    res.json(cvs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/admin/users/:id/profiles
exports.getUserProfiles = async (req, res) => {
  try {
    const profiles = await Profile.find({ userId: req.params.id }).sort({ createdAt: -1 });
    res.json(profiles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
