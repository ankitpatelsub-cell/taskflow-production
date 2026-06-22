const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { queryAll, queryOne, execute } = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const VALID_PRIORITIES = ['low', 'medium', 'high', 'critical'];
const VALID_STATUSES   = ['todo', 'done'];
const DATE_RE          = /^\d{4}-\d{2}-\d{2}$/;

// All queries scope to req.user.id — no other user can ever access these tasks

// GET /api/me/tasks
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
    }
    const rows = await queryAll(
      `SELECT * FROM personal_tasks
       WHERE owner_id = ?
       ${status ? 'AND status = ?' : ''}
       ORDER BY status ASC, position ASC, created_at DESC`,
      status ? [req.user.id, status] : [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch personal tasks' });
  }
});

// POST /api/me/tasks
router.post('/', async (req, res) => {
  try {
    const { title, notes, priority = 'medium', due_date } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'title is required' });
    if (!VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({ error: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}` });
    }
    if (due_date && !DATE_RE.test(due_date)) {
      return res.status(400).json({ error: 'due_date must be in YYYY-MM-DD format' });
    }

    const maxPos = await queryOne(
      'SELECT COALESCE(MAX(position), -1) AS m FROM personal_tasks WHERE owner_id = ?',
      [req.user.id]
    );
    const id = uuidv4();
    await execute(
      'INSERT INTO personal_tasks (id, owner_id, title, notes, priority, due_date, position) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, req.user.id, title.trim(), notes || null, priority, due_date || null, (maxPos?.m ?? -1) + 1]
    );
    const row = await queryOne('SELECT * FROM personal_tasks WHERE id = ?', [id]);
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create personal task' });
  }
});

// PATCH /api/me/tasks/:id
router.patch('/:id', async (req, res) => {
  try {
    const task = await queryOne(
      'SELECT id FROM personal_tasks WHERE id = ? AND owner_id = ?',
      [req.params.id, req.user.id]
    );
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const { title, notes, status, priority, due_date, position } = req.body;

    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
    }
    if (priority !== undefined && !VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({ error: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}` });
    }
    if (due_date && !DATE_RE.test(due_date)) {
      return res.status(400).json({ error: 'due_date must be in YYYY-MM-DD format' });
    }
    if (title !== undefined && !title.trim()) {
      return res.status(400).json({ error: 'title cannot be empty' });
    }

    const sets = []; const vals = [];
    if (title !== undefined)    { sets.push('title = ?');    vals.push(title.trim()); }
    if (notes !== undefined)    { sets.push('notes = ?');    vals.push(notes || null); }
    if (status !== undefined)   { sets.push('status = ?');   vals.push(status); }
    if (priority !== undefined) { sets.push('priority = ?'); vals.push(priority); }
    if (due_date !== undefined) { sets.push('due_date = ?'); vals.push(due_date || null); }
    if (position !== undefined) { sets.push('position = ?'); vals.push(position); }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });

    sets.push('updated_at = NOW()');
    await execute(
      `UPDATE personal_tasks SET ${sets.join(', ')} WHERE id = ? AND owner_id = ?`,
      [...vals, req.params.id, req.user.id]
    );
    const row = await queryOne('SELECT * FROM personal_tasks WHERE id = ?', [req.params.id]);
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update personal task' });
  }
});

// DELETE /api/me/tasks/done — bulk clear completed tasks
// IMPORTANT: this route MUST be registered before DELETE /:id so Express does not
// match "done" as a task ID.
router.delete('/done', async (req, res) => {
  try {
    await execute(
      "DELETE FROM personal_tasks WHERE owner_id = ? AND status = 'done'",
      [req.user.id]
    );
    res.json({ message: 'Cleared completed tasks' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear completed tasks' });
  }
});

// DELETE /api/me/tasks/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await execute(
      'DELETE FROM personal_tasks WHERE id = ? AND owner_id = ?',
      [req.params.id, req.user.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Task not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete personal task' });
  }
});

module.exports = router;
