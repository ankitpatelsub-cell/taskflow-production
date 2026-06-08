const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { queryOne, queryAll, execute } = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });
router.use(authenticate);

async function requireTaskAccess(req, res) {
  const task = await queryOne('SELECT project_id FROM tasks WHERE id = ?', [req.params.taskId]);
  if (!task) { res.status(404).json({ error: 'Task not found' }); return false; }
  if (req.user.role === 'admin' || req.user.role === 'super_admin') return true;
  const member = await queryOne(
    'SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?',
    [task.project_id, req.user.id]
  );
  if (!member) { res.status(403).json({ error: 'Access denied' }); return false; }
  return true;
}

// GET /api/tasks/:taskId/time-logs
router.get('/', async (req, res) => {
  try {
    if (!await requireTaskAccess(req, res)) return;
    const logs = await queryAll(`
      SELECT tl.*, u.name as user_name
      FROM time_logs tl
      JOIN users u ON u.id = tl.user_id
      WHERE tl.task_id = ?
      ORDER BY tl.logged_at DESC
    `, [req.params.taskId]);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch time logs' });
  }
});

// POST /api/tasks/:taskId/time-logs
router.post('/', async (req, res) => {
  try {
    if (!await requireTaskAccess(req, res)) return;
    const { duration_minutes, note } = req.body;
    if (!duration_minutes || duration_minutes < 1) {
      return res.status(400).json({ error: 'duration_minutes must be at least 1' });
    }
    if (duration_minutes > 1440) {
      return res.status(400).json({ error: 'Cannot log more than 24 hours at once' });
    }
    const id = uuidv4();
    await execute(
      'INSERT INTO time_logs (id, task_id, user_id, duration_minutes, note) VALUES (?, ?, ?, ?, ?)',
      [id, req.params.taskId, req.user.id, duration_minutes, note || null]
    );
    const log = await queryOne(
      'SELECT tl.*, u.name as user_name FROM time_logs tl JOIN users u ON u.id=tl.user_id WHERE tl.id=?',
      [id]
    );
    res.status(201).json(log);
  } catch (err) {
    res.status(500).json({ error: 'Failed to log time' });
  }
});

// DELETE /api/tasks/:taskId/time-logs/:logId
router.delete('/:logId', async (req, res) => {
  try {
    const log = await queryOne('SELECT * FROM time_logs WHERE id = ?', [req.params.logId]);
    if (!log) return res.status(404).json({ error: 'Log not found' });
    if (log.user_id !== req.user.id && !['admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await execute('DELETE FROM time_logs WHERE id = ?', [req.params.logId]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete log' });
  }
});

module.exports = router;
