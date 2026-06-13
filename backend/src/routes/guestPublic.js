const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { queryAll, queryOne, execute } = require('../config/db');

const router = express.Router();

async function resolveToken(token, res) {
  const gt = await queryOne(`
    SELECT * FROM guest_tokens
    WHERE token = ?
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > NOW())
  `, [token]);
  if (!gt) { res.status(403).json({ error: 'Invalid or expired guest link' }); return null; }
  execute('UPDATE guest_tokens SET used_count = used_count + 1 WHERE id = ?', [gt.id]).catch(() => {});
  return gt;
}

// GET /api/guest/:token — project + tasks (public)
router.get('/:token', async (req, res) => {
  try {
    const gt = await resolveToken(req.params.token, res);
    if (!gt) return;

    const [project, tasks] = await Promise.all([
      queryOne('SELECT id, name, description, color, status FROM projects WHERE id = ?', [gt.project_id]),
      queryAll(`
        SELECT t.id, t.title, t.status, t.priority, t.deadline, t.assignee_id,
               u.name AS assignee_name
        FROM tasks t
        LEFT JOIN users u ON u.id = t.assignee_id
        WHERE t.project_id = ? AND t.parent_task_id IS NULL
        ORDER BY t.position ASC, t.created_at DESC
      `, [gt.project_id]),
    ]);

    res.json({ project, tasks, permissions: gt.permissions });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch guest view' });
  }
});

// POST /api/guest/:token/comment — add comment (requires comment+ permission)
router.post('/:token/comment', async (req, res) => {
  try {
    const gt = await resolveToken(req.params.token, res);
    if (!gt) return;
    if (!['comment', 'edit'].includes(gt.permissions)) {
      return res.status(403).json({ error: 'This guest link does not allow commenting' });
    }

    const { task_id, body, guest_name } = req.body;
    if (!task_id || !body?.trim()) return res.status(400).json({ error: 'task_id and body required' });
    if (!guest_name?.trim()) return res.status(400).json({ error: 'guest_name required' });

    const task = await queryOne(
      'SELECT id FROM tasks WHERE id = ? AND project_id = ?',
      [task_id, gt.project_id]
    );
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const id = uuidv4();
    await execute(
      'INSERT INTO comments (id, task_id, user_id, guest_author, content) VALUES (?, ?, NULL, ?, ?)',
      [id, task_id, guest_name.trim(), body.trim()]
    );

    res.status(201).json({ id, message: 'Comment added' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add guest comment' });
  }
});

module.exports = router;
