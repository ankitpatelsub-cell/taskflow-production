const { queryAll, queryOne } = require('../config/db');
const logger = require('../config/logger');

async function createNotification(userId, type, message, entityType, entityId) {
  const { execute } = require('../config/db');
  const { v4: uuidv4 } = require('uuid');
  const { broadcastToUser } = require('./wsService');
  try {
    const id = uuidv4();
    await execute(
      'INSERT INTO notifications (id, user_id, type, message, entity_type, entity_id) VALUES (?, ?, ?, ?, ?, ?)',
      [id, userId, type, message, entityType, entityId]
    );
    broadcastToUser(userId, { type: 'notification:new', payload: { id, type, message, entityType, entityId } });
  } catch (err) {
    logger.error({ userId, type, err: err.message }, 'automation.notify_failed');
  }
}

/**
 * Run automations triggered by a task event.
 * @param {string} triggerType  — 'task_status_changed' | 'task_created' | 'task_assigned'
 * @param {object} task         — current task row
 * @param {object} old          — previous task row (null for task_created)
 * @param {object} actor        — user who performed the action
 */
async function runAutomations(triggerType, task, old, actor) {
  try {
    const automations = await queryAll(
      "SELECT * FROM automations WHERE project_id = ? AND trigger_type = ? AND is_active = 1",
      [task.project_id, triggerType]
    );

    if (!automations.length) return;

    for (const a of automations) {
      if (triggerType === 'task_status_changed') {
        if (a.trigger_value && task.status !== a.trigger_value) continue;
        if (old && old.status === task.status) continue;
      }
      if (triggerType === 'task_assigned') {
        if (old && old.assignee_id === task.assignee_id) continue;
      }

      if (a.action_type === 'notify_assignee' && task.assignee_id) {
        await createNotification(
          task.assignee_id,
          'automation',
          `[${a.name}] Task "${task.title}" — ${triggerType.replace(/_/g, ' ')}`,
          'task', task.id
        );
        logger.debug({ automationId: a.id, taskId: task.id, action: a.action_type }, 'automation.fired');
      }

      if (a.action_type === 'notify_members') {
        const members = await queryAll(
          'SELECT user_id FROM project_members WHERE project_id = ?',
          [task.project_id]
        );
        for (const m of members) {
          if (m.user_id === actor?.id) continue;
          await createNotification(
            m.user_id,
            'automation',
            `[${a.name}] Task "${task.title}" — ${triggerType.replace(/_/g, ' ')}`,
            'task', task.id
          );
        }
        logger.debug({ automationId: a.id, taskId: task.id, notified: members.length }, 'automation.fired');
      }

      if (a.action_type === 'change_status' && a.action_value) {
        const { execute } = require('../config/db');
        await execute(
          'UPDATE tasks SET status = ?, updated_at = NOW() WHERE id = ?',
          [a.action_value, task.id]
        );
        logger.info({ automationId: a.id, taskId: task.id, newStatus: a.action_value }, 'automation.status_changed');
      }
    }
  } catch (err) {
    logger.error({ triggerType, taskId: task.id, projectId: task.project_id, err: err.message }, 'automation.run_failed');
  }
}

module.exports = { runAutomations };
