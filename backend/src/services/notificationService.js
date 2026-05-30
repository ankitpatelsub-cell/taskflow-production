const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/db');

function logActivity(entityType, entityId, userId, action, oldValue, newValue) {
  try {
    const db = getDb();
    db.prepare(`
      INSERT INTO activity_log (id, entity_type, entity_id, user_id, action, old_value, new_value)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(), entityType, entityId, userId, action,
      oldValue ? JSON.stringify(oldValue) : null,
      newValue ? JSON.stringify(newValue) : null
    );
  } catch (err) {
    console.error('Activity log error:', err.message);
  }
}

function createNotification(userId, type, message, entityType, entityId) {
  try {
    const db = getDb();
    db.prepare(`
      INSERT INTO notifications (id, user_id, type, message, entity_type, entity_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), userId, type, message, entityType, entityId);
  } catch (err) {
    console.error('Notification error:', err.message);
  }
}

function notifyTaskAssigned(task, assignedByUser) {
  if (!task.assignee_id || task.assignee_id === assignedByUser.id) return;
  createNotification(
    task.assignee_id,
    'task_assigned',
    `${assignedByUser.name} assigned you to "${task.title}"`,
    'task',
    task.id
  );
}

function notifyComment(comment, task, commenter) {
  // Notify task assignee if different from commenter
  if (task.assignee_id && task.assignee_id !== commenter.id) {
    createNotification(
      task.assignee_id,
      'comment_added',
      `${commenter.name} commented on "${task.title}"`,
      'task',
      task.id
    );
  }
  // Notify task creator if different
  if (task.created_by !== commenter.id && task.created_by !== task.assignee_id) {
    createNotification(
      task.created_by,
      'comment_added',
      `${commenter.name} commented on "${task.title}"`,
      'task',
      task.id
    );
  }
}

module.exports = { logActivity, createNotification, notifyTaskAssigned, notifyComment };
