'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { queryOne, queryAll, execute } = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });
router.use(authenticate);

async function requireTaskAccess(req, res, next) {
  try {
    if (['admin', 'super_admin'].includes(req.user.role)) return next();
    const task = await queryOne('SELECT project_id FROM tasks WHERE id = ?', [req.params.taskId]);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    const member = await queryOne(
      'SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?',
      [task.project_id, req.user.id]
    );
    if (!member) return res.status(403).json({ error: 'Access denied' });
    next();
  } catch (err) { next(err); }
}
router.use(requireTaskAccess);

// GET /api/tasks/:taskId/watchers
router.get('/', async (req, res) => {
  try {
    const watchers = await queryAll(
      `SELECT tw.id, tw.user_id, u.name, u.avatar_url, tw.created_at
       FROM task_watchers tw JOIN users u ON u.id = tw.user_id
       WHERE tw.task_id = ? ORDER BY tw.created_at`,
      [req.params.taskId]
    );
    const isWatching = watchers.some((w) => w.user_id === req.user.id);
    res.json({ watchers, isWatching, count: watchers.length });
  } catch (err) { res.status(500).json({ error: 'Failed to fetch watchers' }); }
});

// POST /api/tasks/:taskId/watch  — start watching
router.post('/', async (req, res) => {
  try {
    await execute(
      'INSERT INTO task_watchers (id, task_id, user_id) VALUES (?, ?, ?) ON CONFLICT (task_id, user_id) DO NOTHING',
      [uuidv4(), req.params.taskId, req.user.id]
    );
    res.status(201).json({ watching: true });
  } catch (err) { res.status(500).json({ error: 'Failed to watch task' }); }
});

// DELETE /api/tasks/:taskId/watch  — stop watching
router.delete('/', async (req, res) => {
  try {
    await execute(
      'DELETE FROM task_watchers WHERE task_id = ? AND user_id = ?',
      [req.params.taskId, req.user.id]
    );
    res.json({ watching: false });
  } catch (err) { res.status(500).json({ error: 'Failed to unwatch task' }); }
});

module.exports = router;
