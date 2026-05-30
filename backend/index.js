require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const { PORT, CORS_ORIGIN, NODE_ENV } = require('./src/config/env');
const { getDb } = require('./src/config/db');
const { startCronJobs } = require('./src/config/cron');
const errorHandler = require('./src/middleware/errorHandler');

const authRoutes = require('./src/routes/auth');
const userRoutes = require('./src/routes/users');
const projectRoutes = require('./src/routes/projects');
const taskRoutes = require('./src/routes/tasks');
const commentRoutes = require('./src/routes/comments');
const tagRoutes = require('./src/routes/tags');
const standupRoutes = require('./src/routes/standup');
const notificationRoutes = require('./src/routes/notifications');
const attachmentRoutes = require('./src/routes/attachments');
const adminRoutes = require('./src/routes/admin');

const app = express();

app.use(helmet());
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json());
app.use(cookieParser());

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500 });
app.use('/api/', limiter);

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/projects/:projectId/tasks', taskRoutes);
app.use('/api/projects/:projectId/tags', tagRoutes);
app.use('/api/projects/:projectId/standup', standupRoutes);
app.use('/api/tasks/:taskId/comments', commentRoutes);
app.use('/api/tasks/:taskId/attachments', attachmentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use(errorHandler);

// Initialize DB and seed admin user if empty
async function init() {
  const db = getDb();
  const adminExists = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
  if (!adminExists) {
    const { hash } = require('./src/utils/password');
    const { v4: uuidv4 } = require('uuid');
    const passwordHash = await hash('admin123');
    db.prepare('INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)')
      .run(uuidv4(), 'Administrator', 'admin@taskflow.local', passwordHash, 'admin');
    console.log('[Init] Default admin created: admin@taskflow.local / admin123');
  }
  startCronJobs();
  app.listen(PORT, () => {
    console.log(`[Server] TaskFlow API running on http://localhost:${PORT}`);
  });
}

init().catch(err => {
  console.error('Startup error:', err);
  process.exit(1);
});
