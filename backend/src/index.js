require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const authRoutes           = require('./routes/auth');
const vulnerabilityRoutes  = require('./routes/vulnerabilities');
const deviceRoutes         = require('./routes/devices');
const userRoutes           = require('./routes/users');
const settingsRoutes       = require('./routes/settings');
const dashboardRoutes      = require('./routes/dashboard');
const aiRoutes             = require('./routes/ai');
const reportRoutes         = require('./routes/reports');
const errorHandler         = require('./middleware/errorHandler');
const scheduler            = require('./services/scheduler');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(express.json());

app.use('/api/auth',            authRoutes);
app.use('/api/vulnerabilities', vulnerabilityRoutes);
app.use('/api/devices',         deviceRoutes);
app.use('/api/users',           userRoutes);
app.use('/api/settings',        settingsRoutes);
app.use('/api/dashboard',       dashboardRoutes);
app.use('/api/ai',              aiRoutes);
app.use('/api/reports',         reportRoutes);

app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  scheduler.start();
});
