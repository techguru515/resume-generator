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

mongoose
  .connect(MONGO_URI)
  .then(async () => {
    console.log('MongoDB connected');
    await seedAdmin();
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });
