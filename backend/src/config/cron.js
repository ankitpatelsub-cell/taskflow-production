const cron = require('node-cron');
const { BACKUP_CRON } = require('./env');
const { createBackup } = require('../services/backupService');
const { execute, queryAll } = require('./db');
const { createNotification } = require('../services/notificationService');

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

  // Fire task reminders every minute
  cron.schedule('* * * * *', async () => {
    try {
      const due = await queryAll(
        `SELECT id, title, assignee_id, created_by
         FROM tasks
         WHERE reminder_at IS NOT NULL
           AND reminder_at <= NOW()
           AND reminder_at > NOW() - INTERVAL '2 minutes'`,
        []
      );
      for (const task of due) {
        const recipientId = task.assignee_id || task.created_by;
        if (recipientId) {
          await createNotification(
            recipientId,
            'task_reminder',
            `Reminder: "${task.title}"`,
            'task',
            task.id
          );
        }
        // Clear the reminder so it doesn't re-fire on the next tick
        await execute('UPDATE tasks SET reminder_at = NULL WHERE id = ?', [task.id]);
      }
    } catch (err) {
      console.error('[Cron] Reminder check failed:', err.message);
    }
  });

  console.log(`[Cron] Backup scheduled: ${BACKUP_CRON}`);
}

module.exports = { startCronJobs };
