const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors({
  origin: "https://resume-generator-live.vercel.app",
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/cv', require('./routes/cv'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/workspace-links', require('./routes/workspaceLinks'));
app.use('/api/template', require('./routes/template'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/extension', require('./routes/extension'));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

async function seedAdmin() {
  const User = require('./models/User');
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;

  const exists = await User.findOne({ email });
  if (!exists) {
    await User.create({ name: 'Admin', email, password, role: 'admin', isApproved: true });
    console.log('Admin account created:', email);
  }
}

async function migrateRejectedToFailed() {
  try {
    const CV = require('./models/CV');
    const res = await CV.updateMany(
      { application_status: 'rejected' },
      { $set: { application_status: 'failed' } }
    );
    const modified = res?.modifiedCount ?? res?.nModified ?? 0;
    if (modified > 0) console.log(`Migrated ${modified} CV(s) from rejected -> failed`);
  } catch (e) {
    console.error('Rejected status migration error:', e?.message || e);
  }
}

const PORT = process.env.PORT;
const MONGO_URI = process.env.MONGODB_URI;
let server;

async function shutdown(signal) {
  try {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
      server = null;
    }
  } catch (e) {
    console.error('HTTP server shutdown error:', e?.message || e);
  }
  try {
    await mongoose.disconnect();
  } catch (e) {
    console.error('MongoDB disconnect error:', e?.message || e);
  }
  if (signal) process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

mongoose
  .connect(MONGO_URI)
  .then(async () => {
    console.log('MongoDB connected');
    await seedAdmin();
    await migrateRejectedToFailed();
    try {
      const User = require('./models/User');
      const admin = await User.findOne({ role: 'admin' }).select('_id');
      const { seedTemplates } = require('./services/templateSeedService');
      await seedTemplates({ adminUserId: admin?._id || null });
    } catch (e) {
      console.error('Template seed error:', e?.message || e);
    }
    server = app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
    server.on('error', (err) => {
      // Avoid crashing without context; common case is EADDRINUSE when a previous process still owns the port.
      console.error('HTTP server error:', err?.message || err);
      process.exit(1);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });
