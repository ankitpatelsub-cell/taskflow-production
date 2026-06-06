const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { queryOne, queryAll, execute } = require('../config/db');
const { authenticate, requireProjectAccess, requireWriteAccess } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });
router.use(authenticate, requireProjectAccess);

// ─── GET /api/projects/:projectId/epics ───────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const epics = await queryAll(`
      SELECT e.*,
             COUNT(t.id)                                      AS task_count,
             COUNT(t.id) FILTER (WHERE t.status = 'done')    AS done_count,
             CASE
               WHEN COUNT(t.id) = 0 THEN 0
               ELSE ROUND(
                 COUNT(t.id) FILTER (WHERE t.status = 'done')::numeric
                 / COUNT(t.id) * 100
               )
             END AS progress
      FROM epics e
      LEFT JOIN tasks t ON t.epic_id = e.id
      WHERE e.project_id = ?
      GROUP BY e.id
      ORDER BY e.created_at DESC
    `, [req.params.projectId]);

    res.json(epics);
  } catch (err) {
    req.log.error({ projectId: req.params.projectId, err: err.message }, 'epics.list_failed');
    res.status(500).json({ error: 'Failed to fetch epics' });
  }
});

// ─── POST /api/projects/:projectId/epics ──────────────────────────────────────
router.post('/', requireWriteAccess, async (req, res) => {
  try {
    const { title, description, color, start_date, end_date } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'title is required' });
    }

    const id = uuidv4();
    await execute(`
      INSERT INTO epics (id, project_id, title, description, color, status, start_date, end_date, created_by)
      VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)
    `, [
      id, req.params.projectId, title.trim(),
      description || null, color || null,
      start_date || null, end_date || null,
      req.user.id,
    ]);

    const epic = await queryOne('SELECT * FROM epics WHERE id = ?', [id]);
    req.log.info({ epicId: id, title, projectId: req.params.projectId, userId: req.user.id }, 'epic.created');
    res.status(201).json(epic);
  } catch (err) {
    req.log.error({ projectId: req.params.projectId, userId: req.user.id, err: err.message }, 'epic.create_failed');
    res.status(500).json({ error: 'Failed to create epic' });
  }
});

// ─── GET /api/projects/:projectId/epics/:epicId ───────────────────────────────
router.get('/:epicId', async (req, res) => {
  try {
    const epic = await queryOne(
      'SELECT * FROM epics WHERE id = ? AND project_id = ?',
      [req.params.epicId, req.params.projectId]
    );
    if (!epic) return res.status(404).json({ error: 'Epic not found' });

    const tasks = await queryAll(`
      SELECT t.id, t.title, t.status, t.priority, t.deadline,
             u.name AS assignee_name, u.avatar_url AS assignee_avatar
      FROM tasks t
      LEFT JOIN users u ON u.id = t.assignee_id
      WHERE t.epic_id = ?
      ORDER BY t.position, t.created_at
    `, [req.params.epicId]);

    epic.tasks = tasks;
    res.json(epic);
  } catch (err) {
    req.log.error({ epicId: req.params.epicId, projectId: req.params.projectId, err: err.message }, 'epic.get_failed');
    res.status(500).json({ error: 'Failed to fetch epic' });
  }
});

// ─── PATCH /api/projects/:projectId/epics/:epicId ────────────────────────────
router.patch('/:epicId', requireWriteAccess, async (req, res) => {
  try {
    const epic = await queryOne(
      'SELECT id FROM epics WHERE id = ? AND project_id = ?',
      [req.params.epicId, req.params.projectId]
    );
    if (!epic) return res.status(404).json({ error: 'Epic not found' });

    const { title, description, color, status, start_date, end_date } = req.body;

    const sets = ['updated_at = NOW()'];
    const vals = [];

    if (title !== undefined)       { sets.push('title = ?');       vals.push(title); }
    if (description !== undefined) { sets.push('description = ?'); vals.push(description || null); }
    if (color !== undefined)       { sets.push('color = ?');       vals.push(color || null); }
    if (status !== undefined)      { sets.push('status = ?');      vals.push(status); }
    if (start_date !== undefined)  { sets.push('start_date = ?');  vals.push(start_date || null); }
    if (end_date !== undefined)    { sets.push('end_date = ?');    vals.push(end_date || null); }

    vals.push(req.params.epicId);
    await execute(`UPDATE epics SET ${sets.join(', ')} WHERE id = ?`, vals);

    const updated = await queryOne('SELECT * FROM epics WHERE id = ?', [req.params.epicId]);
    req.log.info({ epicId: req.params.epicId, projectId: req.params.projectId, userId: req.user.id, fields: Object.keys(req.body) }, 'epic.updated');
    res.json(updated);
  } catch (err) {
    req.log.error({ epicId: req.params.epicId, projectId: req.params.projectId, userId: req.user.id, err: err.message }, 'epic.update_failed');
    res.status(500).json({ error: 'Failed to update epic' });
  }
});

// ─── DELETE /api/projects/:projectId/epics/:epicId ───────────────────────────
router.delete('/:epicId', requireWriteAccess, async (req, res) => {
  try {
    const epic = await queryOne(
      'SELECT id FROM epics WHERE id = ? AND project_id = ?',
      [req.params.epicId, req.params.projectId]
    );
    if (!epic) return res.status(404).json({ error: 'Epic not found' });

    // Detach tasks before deleting the epic
    await execute('UPDATE tasks SET epic_id = NULL, updated_at = NOW() WHERE epic_id = ?', [req.params.epicId]);
    await execute('DELETE FROM epics WHERE id = ?', [req.params.epicId]);

    req.log.info({ epicId: req.params.epicId, projectId: req.params.projectId, userId: req.user.id }, 'epic.deleted');
    res.json({ message: 'Deleted' });
  } catch (err) {
    req.log.error({ epicId: req.params.epicId, projectId: req.params.projectId, userId: req.user.id, err: err.message }, 'epic.delete_failed');
    res.status(500).json({ error: 'Failed to delete epic' });
  }
});

module.exports = router;
