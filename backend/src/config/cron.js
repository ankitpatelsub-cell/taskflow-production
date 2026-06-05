const cron = require('node-cron');
const { BACKUP_CRON } = require('./env');
const { createBackup } = require('../services/backupService');
const { execute, queryAll } = require('./db');
const { createNotification } = require('../services/notificationService');
const logger = require('./logger');

function startCronJobs() {
  cron.schedule(BACKUP_CRON, async () => {
    logger.info('[cron] scheduled backup starting');
    try {
      const result = await createBackup(null, 'Scheduled backup');
      logger.info({ filename: result.filename, sizeKb: (result.size / 1024).toFixed(1) }, '[cron] backup complete');
    } catch (err) {
      logger.error({ err: err.message }, '[cron] backup failed');
    }
  });

  // Purge expired tokens daily at 3 AM
  cron.schedule('0 3 * * *', async () => {
    try {
      const [pw, ev, rt, it] = await Promise.all([
        execute("DELETE FROM password_reset_tokens WHERE expires_at < NOW()"),
        execute("DELETE FROM email_verification_tokens WHERE expires_at < NOW()"),
        execute("DELETE FROM refresh_tokens WHERE expires_at < NOW()"),
        execute("DELETE FROM invite_tokens WHERE expires_at < NOW()"),
      ]);
      logger.info({
        password_reset: pw.rowCount,
        email_verify: ev.rowCount,
        refresh: rt.rowCount,
        invite: it.rowCount,
      }, '[cron] expired tokens purged');
    } catch (err) {
      logger.error({ err: err.message }, '[cron] token cleanup failed');
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
          logger.debug({ taskId: task.id, recipientId }, '[cron] task reminder sent');
        }
        await execute('UPDATE tasks SET reminder_at = NULL WHERE id = ?', [task.id]);
      }
    } catch (err) {
      logger.error({ err: err.message }, '[cron] reminder check failed');
    }
  });

  logger.info({ schedule: BACKUP_CRON }, '[cron] jobs scheduled');
}

module.exports = { startCronJobs };
