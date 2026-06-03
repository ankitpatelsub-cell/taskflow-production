const cron = require('node-cron');
const { BACKUP_CRON } = require('./env');
const { createBackup } = require('../services/backupService');
const { execute } = require('./db');

function startCronJobs() {
  cron.schedule(BACKUP_CRON, async () => {
    console.log('[Cron] Running scheduled backup...');
    try {
      await createBackup(null, 'Scheduled backup');
    } catch (err) {
      console.error('[Cron] Backup failed:', err.message);
    }
  });

  // Purge expired tokens daily at 3 AM
  cron.schedule('0 3 * * *', async () => {
    try {
      await execute("DELETE FROM password_reset_tokens WHERE expires_at < NOW()");
      await execute("DELETE FROM email_verification_tokens WHERE expires_at < NOW()");
      await execute("DELETE FROM refresh_tokens WHERE expires_at < NOW()");
      await execute("DELETE FROM invite_tokens WHERE expires_at < NOW()");
    } catch (err) {
      console.error('[Cron] Token cleanup failed:', err.message);
    }
  });

  console.log(`[Cron] Backup scheduled: ${BACKUP_CRON}`);
}

module.exports = { startCronJobs };
