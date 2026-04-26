require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/cv', require('./routes/cv'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/workspace-links', require('./routes/workspaceLinks'));
app.use('/api/template', require('./routes/template'));

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

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cv_builder';
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
