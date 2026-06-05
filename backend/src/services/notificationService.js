const { v4: uuidv4 } = require('uuid');
const { execute, queryOne } = require('../config/db');
const { broadcastToUser } = require('./wsService');
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

module.exports = { logActivity, createNotification, notifyTaskAssigned, notifyComment };
