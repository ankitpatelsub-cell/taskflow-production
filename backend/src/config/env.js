require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const REQUIRED = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'BACKUP_ENCRYPTION_KEY', 'DATABASE_URL'];

function validateEnv() {
  const missing = REQUIRED.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`[Startup] Missing required environment variables: ${missing.join(', ')}`);
    console.error('[Startup] Copy backend/.env.example to backend/.env and fill in the values.');
    process.exit(1);
  }
  if (process.env.JWT_SECRET.length < 20) {
    console.error('[Startup] JWT_SECRET must be at least 20 characters long.');
    process.exit(1);
  }
}

validateEnv();

module.exports = {
  PORT:                   process.env.PORT || 3001,
  NODE_ENV:               process.env.NODE_ENV || 'development',
  CORS_ORIGIN:            process.env.CORS_ORIGIN || 'http://localhost:5173',
  JWT_SECRET:             process.env.JWT_SECRET,
  JWT_REFRESH_SECRET:     process.env.JWT_REFRESH_SECRET,
  BACKUP_ENCRYPTION_KEY:  process.env.BACKUP_ENCRYPTION_KEY,
  BACKUP_CRON:            process.env.BACKUP_CRON || '0 2 * * *',
  BACKUP_RETENTION_DAYS:  parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10),
  DATABASE_URL:           process.env.DATABASE_URL,
  // Email
  SMTP_HOST:              process.env.SMTP_HOST,
  SMTP_PORT:              parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_USER:              process.env.SMTP_USER,
  SMTP_PASS:              process.env.SMTP_PASS,
  EMAIL_FROM:             process.env.EMAIL_FROM || 'TaskFlow <noreply@taskflow.app>',
  APP_URL:                process.env.APP_URL || 'http://localhost:5173',
  // Stripe
  STRIPE_SECRET_KEY:      process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET:  process.env.STRIPE_WEBHOOK_SECRET,
  STRIPE_PRO_PRICE_ID:    process.env.STRIPE_PRO_PRICE_ID,
  STRIPE_TEAM_PRICE_ID:   process.env.STRIPE_TEAM_PRICE_ID,
  // OAuth
  GOOGLE_CLIENT_ID:       process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET:   process.env.GOOGLE_CLIENT_SECRET,
  // AI (optional — leave blank to use rule-based fallback)
  ANTHROPIC_API_KEY:      process.env.ANTHROPIC_API_KEY,
};
