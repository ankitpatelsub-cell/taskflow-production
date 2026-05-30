require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const pinoHttp = require('pino-http');

const { PORT, CORS_ORIGIN, NODE_ENV } = require('./src/config/env');
const logger = require('./src/config/logger');
const { getDb } = require('./src/config/db');
const { startCronJobs } = require('./src/config/cron');
const errorHandler = require('./src/middleware/errorHandler');

const authRoutes         = require('./src/routes/auth');
const userRoutes         = require('./src/routes/users');
const projectRoutes      = require('./src/routes/projects');
const taskRoutes         = require('./src/routes/tasks');
const commentRoutes      = require('./src/routes/comments');
const tagRoutes          = require('./src/routes/tags');
const standupRoutes      = require('./src/routes/standup');
const notificationRoutes = require('./src/routes/notifications');
const attachmentRoutes   = require('./src/routes/attachments');
const adminRoutes        = require('./src/routes/admin');

const app = express();

// ── Security headers ───────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      imgSrc:     ["'self'", 'data:'],
      connectSrc: ["'self'"],
    },
  },
}));

app.use(cors({ origin: CORS_ORIGIN, credentials: true }));

// ── Logging ────────────────────────────────────────────────────────────────────
if (NODE_ENV !== 'test') {
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/health' } }));
}

app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());

// ── Rate limiting ──────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { error: 'Too many login attempts. Please wait 15 minutes.' },
  skipSuccessfulRequests: true,
});

app.use('/api/', globalLimiter);
app.use('/api/auth/login',   authLimiter);
app.use('/api/auth/refresh', authLimiter);

// ── Routes ─────────────────────────────────────────────────────────────────────
app.use('/api/auth',                         authRoutes);
app.use('/api/users',                        userRoutes);
app.use('/api/projects',                     projectRoutes);
app.use('/api/projects/:projectId/tasks',    taskRoutes);
app.use('/api/projects/:projectId/tags',     tagRoutes);
app.use('/api/projects/:projectId/standup',  standupRoutes);
app.use('/api/tasks/:taskId/comments',       commentRoutes);
app.use('/api/tasks/:taskId/attachments',    attachmentRoutes);
app.use('/api/notifications',                notificationRoutes);
app.use('/api/admin',                        adminRoutes);

app.get('/api/health', (req, res) => {
  const db = getDb();
  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  res.json({ status: 'ok', time: new Date().toISOString(), users: userCount });
});

app.use(errorHandler);

// ── Startup ────────────────────────────────────────────────────────────────────
async function init() {
  const db = getDb();
  const adminExists = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
  if (!adminExists) {
    const { hash } = require('./src/utils/password');
    const { v4: uuidv4 } = require('uuid');
    const passwordHash = await hash('admin123');
    db.prepare('INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)')
      .run(uuidv4(), 'Administrator', 'admin@taskflow.local', passwordHash, 'admin');
    logger.info('Default admin created: admin@taskflow.local / admin123');
  }
  startCronJobs();
  app.listen(PORT, () => {
    logger.info(`TaskFlow API running on http://localhost:${PORT} [${NODE_ENV}]`);
  });
}

init().catch((err) => {
  logger.error(err, 'Startup failed');
  process.exit(1);
});
