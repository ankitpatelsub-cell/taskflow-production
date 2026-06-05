const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { queryAll, queryOne, execute } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const logger = require('../config/logger');

const router = express.Router({ mergeParams: true });
router.use(authenticate);

// GET /api/tasks/:taskId/dependencies
// Returns { blocks: [...], blocked_by: [...] }
router.get('/', async (req, res) => {
  try {
    const { taskId } = req.params;

    const [blockedBy, blocks] = await Promise.all([
      // Tasks this task depends on (i.e., must be done before this one)
      queryAll(`
        SELECT t.id, t.title, t.status, t.priority, t.deadline, u.name as assignee_name,
               td.id as dep_id
        FROM task_dependencies td
        JOIN tasks t ON t.id = td.depends_on
        LEFT JOIN users u ON u.id = t.assignee_id
        WHERE td.task_id = ?
        ORDER BY t.created_at
      `, [taskId]),
      // Tasks that depend on this task (i.e., this task must be done first)
      queryAll(`
        SELECT t.id, t.title, t.status, t.priority, t.deadline, u.name as assignee_name,
               td.id as dep_id
        FROM task_dependencies td
        JOIN tasks t ON t.id = td.task_id
        LEFT JOIN users u ON u.id = t.assignee_id
        WHERE td.depends_on = ?
        ORDER BY t.created_at
      `, [taskId]),
    ]);

    res.json({ blocked_by: blockedBy, blocks });
  } catch (err) {
    req.log.error({ taskId: req.params.taskId, err: err.message }, 'deps.fetch_failed');
    res.status(500).json({ error: 'Failed to fetch dependencies' });
  }
});

// POST /api/tasks/:taskId/dependencies
// Body: { depends_on: taskId }  — this task is blocked by depends_on
router.post('/', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { depends_on } = req.body;

    if (!depends_on) return res.status(400).json({ error: 'depends_on required' });
    if (depends_on === taskId) return res.status(400).json({ error: 'A task cannot depend on itself' });

    const target = await queryOne('SELECT id, title FROM tasks WHERE id = ?', [depends_on]);
    if (!target) return res.status(404).json({ error: 'Target task not found' });

    // Check for circular dependency: does depends_on already depend on taskId (directly or indirectly)?
    const wouldCycle = await queryOne(
      'SELECT id FROM task_dependencies WHERE task_id = ? AND depends_on = ?',
      [depends_on, taskId]
    );
    if (wouldCycle) return res.status(409).json({ error: 'Would create a circular dependency' });

    const id = uuidv4();
    await execute(
      'INSERT INTO task_dependencies (id, task_id, depends_on, created_by) VALUES (?, ?, ?, ?)',
      [id, taskId, depends_on, req.user.id]
    );

    req.log.info({ taskId, dependsOn: depends_on, userId: req.user.id }, 'dep.created');
    res.status(201).json({ id, task_id: taskId, depends_on, title: target.title });
  } catch (err) {
    if (err.message?.includes('unique')) return res.status(409).json({ error: 'Dependency already exists' });
    req.log.error({ taskId: req.params.taskId, err: err.message }, 'dep.create_failed');
    res.status(500).json({ error: 'Failed to add dependency' });
  }
});

// DELETE /api/tasks/:taskId/dependencies/:depId
router.delete('/:depId', async (req, res) => {
  try {
    const { taskId, depId } = req.params;
    await execute(
      'DELETE FROM task_dependencies WHERE id = ? AND (task_id = ? OR depends_on = ?)',
      [depId, taskId, taskId]
    );
    req.log.info({ taskId, depId, userId: req.user.id }, 'dep.deleted');
    res.json({ message: 'Dependency removed' });
  } catch (err) {
    req.log.error({ taskId: req.params.taskId, err: err.message }, 'dep.delete_failed');
    res.status(500).json({ error: 'Failed to remove dependency' });
  }
});

module.exports = router;
