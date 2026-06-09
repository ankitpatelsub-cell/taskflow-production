require('dotenv').config({ path: require('path').join(__dirname, '.env') });

// Sentry must be initialised before any other imports
if (process.env.SENTRY_DSN) {
  const Sentry = require('@sentry/node');
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.2,
  });
}

const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const pinoHttp = require('pino-http');
const passport = require('passport');
const { WebSocketServer } = require('ws');

const { PORT, CORS_ORIGIN, NODE_ENV } = require('./src/config/env');
const logger = require('./src/config/logger');
const { initSchema, queryOne, execute } = require('./src/config/db');
const { startCronJobs } = require('./src/config/cron');
const errorHandler = require('./src/middleware/errorHandler');
const wsService = require('./src/services/wsService');

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
const invitationRoutes   = require('./src/routes/invitations');
const billingRoutes      = require('./src/routes/billing');
const accountRoutes      = require('./src/routes/account');
const timeLogRoutes      = require('./src/routes/timeLogs');
const workloadRoutes     = require('./src/routes/workload');
const automationRoutes   = require('./src/routes/automations');
const aiSummaryRoutes    = require('./src/routes/aiSummary');
const taskLinkRoutes     = require('./src/routes/taskLinks');
const dependencyRoutes   = require('./src/routes/taskDependencies');
const sprintRoutes       = require('./src/routes/sprints');
const epicRoutes         = require('./src/routes/epics');
const { fieldDefsRouter, fieldValuesRouter } = require('./src/routes/customFields');
const webhookRoutes      = require('./src/routes/webhooks');
const reactionRoutes     = require('./src/routes/reactions');
const { shareApiRouter, publicShareRouter } = require('./src/routes/share');
const twoFactorRoutes    = require('./src/routes/twoFactor');
const aiTaskRoutes       = require('./src/routes/aiTasks');
const templateRoutes       = require('./src/routes/templates');
const analyticsRoutes      = require('./src/routes/analytics');
const aiPlanningRoutes     = require('./src/routes/aiPlanning');
const sprintInsightsRoutes = require('./src/routes/sprintInsights');
const workspaceRoutes      = require('./src/routes/workspaces');

const app = express();
const server = http.createServer(app);

// ── Trust proxy (required for correct req.ip behind nginx/load balancer) ──────
app.set('trust proxy', 1);

// ── WebSocket server ───────────────────────────────────────────────────────────
const wss = new WebSocketServer({ server, path: '/ws' });
wsService.register(wss);

// ── Security headers ───────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      imgSrc:     ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'wss:', 'ws:'],
    },
  },
}));

if (CORS_ORIGIN === '*') throw new Error('CORS_ORIGIN cannot be * when credentials=true');
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));

// ── Logging ────────────────────────────────────────────────────────────────────
if (NODE_ENV !== 'test') {
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/health' } }));
}

// ── Public share (no auth, no /api prefix, must be before JSON middleware) ────
app.use('/share', publicShareRouter);

// ── Stripe webhook needs raw body — mount BEFORE express.json() ───────────────
app.use('/api/billing/webhook', billingRoutes);

app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());
app.use(passport.initialize());

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

// Per-user limit: 120 req/min keyed by token suffix (requires trust proxy above)
const userLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const auth = req.headers.authorization;
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    return token?.length > 10 ? `u:${token.slice(-24)}` : `ip:${req.ip}`;
  },
  message: { error: 'Too many requests. Please slow down.' },
  skip: (req) => req.path === '/health' || req.path === '/version',
});

app.use('/api/', globalLimiter);
app.use('/api/', userLimiter);
app.use('/api/auth/login',                authLimiter);
app.use('/api/auth/refresh',              authLimiter);
app.use('/api/auth/register',             authLimiter);
app.use('/api/auth/forgot-password',      authLimiter);
app.use('/api/auth/resend-verification',  authLimiter);

// ── Email verification gate ────────────────────────────────────────────────────
// All authenticated API calls (except /api/auth/* and read-only public routes)
// are blocked until the user has verified their email address.
// The check reads the claim from the already-verified JWT — no extra DB query.
const { verifyAccess: _verifyAccess } = require('./src/utils/jwt');
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/auth/') || req.path === '/health' || req.path === '/version') {
    return next();
  }
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next(); // unauthenticated — let route handle it
  try {
    const payload = _verifyAccess(header.slice(7));
    if (!payload.email_verified) {
      return res.status(403).json({ error: 'Email not verified', code: 'EMAIL_NOT_VERIFIED' });
    }
  } catch {
    // Invalid token — let the route's authenticate middleware emit the 401
  }
  next();
});

// ── Routes ─────────────────────────────────────────────────────────────────────
app.use('/api/auth',                         authRoutes);
app.use('/api/workspaces',                   workspaceRoutes);
app.use('/api/users',                        userRoutes);
app.use('/api/projects',                     projectRoutes);
app.use('/api/projects/:projectId/tasks',    taskRoutes);
app.use('/api/projects/:projectId/tags',     tagRoutes);
app.use('/api/projects/:projectId/standup',  standupRoutes);
app.use('/api/tasks/:taskId/comments',           commentRoutes);
app.use('/api/tasks/:taskId/attachments',        attachmentRoutes);
app.use('/api/tasks/:taskId/time-logs',          timeLogRoutes);
app.use('/api/tasks/:taskId/links',              taskLinkRoutes);
app.use('/api/tasks/:taskId/dependencies',       dependencyRoutes);
app.use('/api/projects/:projectId/sprints',     sprintRoutes);
app.use('/api/projects/:projectId/sprints',     sprintInsightsRoutes);
app.use('/api/projects/:projectId/epics',       epicRoutes);
app.use('/api/projects/:projectId/custom-fields', fieldDefsRouter);
app.use('/api/tasks/:taskId/custom-field-values', fieldValuesRouter);
app.use('/api/projects/:projectId/webhooks',    webhookRoutes);
app.use('/api/comments/:commentId/reactions',   reactionRoutes);
app.use('/api/projects/:projectId/share',       shareApiRouter);
app.use('/api/auth/2fa',                        twoFactorRoutes);
app.use('/api/projects/:projectId/ai',          aiTaskRoutes);
app.use('/api/projects/:projectId/workload',     workloadRoutes);
app.use('/api/projects/:projectId/automations',  automationRoutes);
app.use('/api/projects/:projectId/ai-summary',   aiSummaryRoutes);
app.use('/api/templates',                    templateRoutes);
app.use('/api/analytics',                    analyticsRoutes);
app.use('/api/projects/:projectId',          aiPlanningRoutes);
app.use('/api/notifications',                notificationRoutes);
app.use('/api/admin',                        adminRoutes);
app.use('/api/invitations',                  invitationRoutes);
app.use('/api/billing',                      billingRoutes);
app.use('/api/auth',                         accountRoutes);
app.use('/api',                              accountRoutes);

app.get('/api/version', (req, res) => {
  res.json({ version: require('./package.json').version });
});

app.get('/api/health', async (req, res) => {
  try {
    const row = await queryOne('SELECT COUNT(*) as c FROM users');
    res.json({ status: 'ok', time: new Date().toISOString(), users: parseInt(row.c, 10) });
  } catch (err) {
    res.status(503).json({ status: 'error', error: err.message });
  }
});

app.use(errorHandler);

// ── Startup ────────────────────────────────────────────────────────────────────
async function init() {
  // Wait for PostgreSQL schema
  await initSchema();
  logger.info('[DB] Schema initialized');

  // Seed default admin if none exists
  const { hash } = require('./src/utils/password');
  const { v4: uuidv4 } = require('uuid');
  const adminExists = await queryOne("SELECT id FROM users WHERE role IN ('admin','super_admin') LIMIT 1");
  if (!adminExists) {
    const tempPassword = require('crypto').randomBytes(10).toString('hex'); // 20-char random hex
    const passwordHash = await hash(tempPassword);
    await execute(
      "INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, 'admin')",
      [uuidv4(), 'Administrator', 'admin@taskflow.local', passwordHash]
    );
    logger.warn('═══════════════════════════════════════════════════');
    logger.warn('  DEFAULT ADMIN CREATED — SAVE THESE CREDENTIALS   ');
    logger.warn(`  Email:    admin@taskflow.local                    `);
    logger.warn(`  Password: ${tempPassword}                         `);
    logger.warn('  Change this password immediately after first login');
    logger.warn('═══════════════════════════════════════════════════');
  }

  startCronJobs();

  server.listen(PORT, () => {
    logger.info(`Tick API running on http://localhost:${PORT} [${NODE_ENV}]`);
    logger.info(`WebSocket server at ws://localhost:${PORT}/ws`);
  });
}

// ── Unhandled rejection safety net ────────────────────────────────────────────
process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection');
});
process.on('uncaughtException', (err) => {
  logger.error(err, 'Uncaught exception — shutting down');
  process.exit(1);
});

// ── Graceful shutdown ──────────────────────────────────────────────────────────
function shutdown() {
  logger.info('Shutting down gracefully...');
  server.close(async () => {
    const { closePool } = require('./src/config/db');
    await closePool();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT',  shutdown);

init().catch((err) => {
  logger.error(err, 'Startup failed');
  process.exit(1);
});
