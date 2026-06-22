'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { queryOne, queryAll, execute } = require('../config/db');
const { authenticate, requireProjectAccess, requireWriteAccess } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });
router.use(authenticate, requireProjectAccess);

// GET /api/projects/:projectId/milestones
router.get('/', async (req, res) => {
  try {
    const milestones = await queryAll(`
      SELECT m.*,
        u.name as created_by_name,
        COUNT(t.id) as task_count,
        COUNT(CASE WHEN t.status = 'done' THEN 1 END) as done_count
      FROM milestones m
      LEFT JOIN users u ON u.id = m.created_by
      LEFT JOIN tasks t ON t.milestone_id = m.id
      WHERE m.project_id = ?
      GROUP BY m.id
      ORDER BY m.due_date NULLS LAST, m.created_at
    `, [req.params.projectId]);
    res.json(milestones);
  } catch (err) { res.status(500).json({ error: 'Failed to fetch milestones' }); }
});

// POST /api/projects/:projectId/milestones
router.post('/', requireWriteAccess, async (req, res) => {
  try {
    const { title, description, due_date } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });
    const id = uuidv4();
    await execute(
      'INSERT INTO milestones (id, project_id, title, description, due_date, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [id, req.params.projectId, title.trim(), description || null, due_date || null, req.user.id]
    );
    const milestone = await queryOne('SELECT * FROM milestones WHERE id = ?', [id]);
    res.status(201).json(milestone);
  } catch (err) { res.status(500).json({ error: 'Failed to create milestone' }); }
});

// PATCH /api/projects/:projectId/milestones/:milestoneId
router.patch('/:milestoneId', requireWriteAccess, async (req, res) => {
  try {
    const { title, description, due_date, status } = req.body;
    const m = await queryOne('SELECT * FROM milestones WHERE id = ? AND project_id = ?', [req.params.milestoneId, req.params.projectId]);
    if (!m) return res.status(404).json({ error: 'Milestone not found' });
    if (status && !['open', 'completed'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    await execute(
      `UPDATE milestones SET
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        due_date = COALESCE(?, due_date),
        status = COALESCE(?, status),
        updated_at = NOW()
       WHERE id = ?`,
      [title?.trim() || null, description, due_date, status, req.params.milestoneId]
    );
    res.json(await queryOne('SELECT * FROM milestones WHERE id = ?', [req.params.milestoneId]));
  } catch (err) { res.status(500).json({ error: 'Failed to update milestone' }); }
});

// DELETE /api/projects/:projectId/milestones/:milestoneId
router.delete('/:milestoneId', requireWriteAccess, async (req, res) => {
  try {
    const m = await queryOne('SELECT id FROM milestones WHERE id = ? AND project_id = ?', [req.params.milestoneId, req.params.projectId]);
    if (!m) return res.status(404).json({ error: 'Milestone not found' });
    await execute('DELETE FROM milestones WHERE id = ?', [req.params.milestoneId]);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: 'Failed to delete milestone' }); }
});

module.exports = router;
