const cron = require('node-cron');
const { BACKUP_CRON } = require('./env');
const { createBackup } = require('../services/backupService');

function startCronJobs() {
  cron.schedule(BACKUP_CRON, async () => {
    console.log('[Cron] Running scheduled backup...');
    try {
      await createBackup(null, 'Scheduled backup');
    } catch (err) {
      console.error('[Cron] Backup failed:', err.message);
    }
  });
  console.log(`[Cron] Backup scheduled: ${BACKUP_CRON}`);
}

module.exports = { startCronJobs };
