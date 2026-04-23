const jwt = require('jsonwebtoken');
const User = require('../models/User');

function signToken(id) {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

// POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: 'name, email and password are required' });

    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ error: 'Email already registered' });

    const user = await User.create({ name, email, password, role: 'client', isApproved: false });
    res.status(201).json({
      token: signToken(user._id),
      user: { _id: user._id, name: user.name, email: user.email, role: user.role, isApproved: user.isApproved, avatar: user.avatar || '' },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ error: 'Invalid email or password' });

    res.json({
      token: signToken(user._id),
      user: { _id: user._id, name: user.name, email: user.email, role: user.role, isApproved: user.isApproved, avatar: user.avatar || '' },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/auth/me
exports.me = async (req, res) => {
  res.json({
    _id: req.user._id,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role,
    isApproved: req.user.isApproved,
    avatar: req.user.avatar || '',
  });
};

// PATCH /api/auth/avatar
exports.updateAvatar = async (req, res) => {
  try {
    const { avatar } = req.body;
    if (!avatar) return res.status(400).json({ error: 'avatar is required' });
    // Limit to ~150 KB base64
    const user = await User.findById(req.user._id);
    user.avatar = avatar;
    await user.save();
    res.json({ avatar: user.avatar });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/auth/change-password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ error: 'currentPassword and newPassword are required' });
    if (newPassword.length < 6)
      return res.status(400).json({ error: 'New password must be at least 6 characters' });

    const user = await require('../models/User').findById(req.user._id);
    if (!(await user.comparePassword(currentPassword)))
      return res.status(401).json({ error: 'Current password is incorrect' });

    user.password = newPassword;
    await user.save();
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
