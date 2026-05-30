require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const REQUIRED = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'BACKUP_ENCRYPTION_KEY'];

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
};
