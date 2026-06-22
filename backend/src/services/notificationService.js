const { v4: uuidv4 } = require('uuid');
const { execute, queryOne, queryAll } = require('../config/db');
const { broadcastToUser } = require('./wsService');
const { sendEmail } = require('./emailService');
const logger = require('../config/logger');

async function logActivity(entityType, entityId, userId, action, oldValue, newValue) {
  try {
    await execute(
      `INSERT INTO activity_log (id, entity_type, entity_id, user_id, action, old_value, new_value)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(), entityType, entityId, userId, action,
        oldValue ? JSON.stringify(oldValue) : null,
        newValue ? JSON.stringify(newValue) : null,
      ]
    );
  } catch (err) {
    logger.error({ entityType, entityId, userId, action, err: err.message }, 'activity_log.write_failed');
  }
}

async function createNotification(userId, type, message, entityType, entityId) {
  try {
    const id = uuidv4();
    await execute(
      `INSERT INTO notifications (id, user_id, type, message, entity_type, entity_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, userId, type, message, entityType, entityId]
    );
    broadcastToUser(userId, { type: 'notification:new', payload: { id, type, message, entityType, entityId } });

    // Email delivery for high-priority notification types (non-blocking)
    if (process.env.SMTP_HOST && (type === 'task_assigned' || type === 'mention')) {
      queryOne('SELECT email, name FROM users WHERE id = ?', [userId])
        .then((user) => {
          if (!user?.email) return;
          return sendEmail({
            to: user.email,
            subject: message,
            html: `<p>${message}</p><p><a href="${process.env.APP_URL}">Open Tick</a></p>`,
          });
        })
        .catch(() => {}); // never block on email failure
    }
  } catch (err) {
    logger.error({ userId, type, entityType, entityId, err: err.message }, 'notification.create_failed');
  }
}

async function notifyTaskAssigned(task, assignedByUser) {
  if (!task.assignee_id || task.assignee_id === assignedByUser.id) return;
  await createNotification(
    task.assignee_id,
    'task_assigned',
    `${assignedByUser.name} assigned you to "${task.title}"`,
    'task',
    task.id
  );
}

async function notifyComment(comment, task, commenter) {
  if (task.assignee_id && task.assignee_id !== commenter.id) {
    await createNotification(
      task.assignee_id,
      'comment_added',
      `${commenter.name} commented on "${task.title}"`,
      'task',
      task.id
    );
  }
  if (task.created_by !== commenter.id && task.created_by !== task.assignee_id) {
    await createNotification(
      task.created_by,
      'comment_added',
      `${commenter.name} commented on "${task.title}"`,
      'task',
      task.id
    );
  }
}

async function notifyWatchers(task, actorId, type, message) {
  try {
    const watchers = await queryAll(
      'SELECT user_id FROM task_watchers WHERE task_id = ? AND user_id != ?',
      [task.id, actorId]
    );
    await Promise.all(
      watchers.map((w) => createNotification(w.user_id, type, message, 'task', task.id))
    );
  } catch (err) {
    logger.error({ taskId: task.id, err: err.message }, 'notify_watchers.failed');
  }
}

module.exports = { logActivity, createNotification, notifyTaskAssigned, notifyComment, notifyWatchers };
