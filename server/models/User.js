const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'client'], default: 'client' },
    isApproved: { type: Boolean, default: false },
    avatar: { type: String, default: '' },
  },
  { timestamps: true }
);

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

UserSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

// Admin client list (role + sort); stats counts by role / approval
UserSchema.index({ role: 1, createdAt: -1 });
UserSchema.index({ role: 1, isApproved: 1 });

module.exports = mongoose.model('User', UserSchema);
