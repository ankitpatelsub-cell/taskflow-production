'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { queryOne, queryAll, execute } = require('../config/db');
const { authenticate, requireProjectAccess, requireWriteAccess } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });
router.use(authenticate, requireProjectAccess);

// ── Helper: recalculate objective progress from its key results ────────────────
async function syncObjectiveProgress(objectiveId) {
  const row = await queryOne(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN target_value > 0 THEN current_value::float / target_value ELSE 0 END) AS ratio_sum
     FROM key_results WHERE objective_id = ?`,
    [objectiveId]
  );
  const progress = row && Number(row.total) > 0
    ? Math.min(100, Math.round((Number(row.ratio_sum) / Number(row.total)) * 100))
    : 0;
  await execute('UPDATE objectives SET updated_at = NOW() WHERE id = ?', [objectiveId]);
  return progress;
}

// GET /api/projects/:projectId/okrs
router.get('/', async (req, res) => {
  try {
    const objectives = await queryAll(
      `SELECT o.*,
         u.name AS created_by_name,
         COUNT(kr.id) AS kr_count,
         COALESCE(
           CASE WHEN COUNT(kr.id) > 0
             THEN ROUND(
               SUM(CASE WHEN kr.target_value > 0 THEN kr.current_value::float / kr.target_value ELSE 0 END)
               / COUNT(kr.id) * 100
             )
           END, 0
         ) AS progress
       FROM objectives o
       LEFT JOIN users u ON u.id = o.created_by
       LEFT JOIN key_results kr ON kr.objective_id = o.id
       WHERE o.project_id = ?
       GROUP BY o.id, u.name
       ORDER BY o.created_at DESC`,
      [req.params.projectId]
    );
    res.json(objectives);
  } catch (err) { res.status(500).json({ error: 'Failed to fetch objectives' }); }
});

// POST /api/projects/:projectId/okrs
router.post('/', requireWriteAccess, async (req, res) => {
  try {
    const { title, description, start_date, end_date, color = '#6366f1' } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });
    const id = uuidv4();
    await execute(
      `INSERT INTO objectives (id, project_id, title, description, start_date, end_date, color, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, req.params.projectId, title.trim(), description || null, start_date || null, end_date || null, color, req.user.id]
    );
    const obj = await queryOne('SELECT * FROM objectives WHERE id = ?', [id]);
    res.status(201).json(obj);
  } catch (err) { res.status(500).json({ error: 'Failed to create objective' }); }
});

// PATCH /api/projects/:projectId/okrs/:objectiveId
router.patch('/:objectiveId', requireWriteAccess, async (req, res) => {
  try {
    const obj = await queryOne('SELECT id FROM objectives WHERE id = ? AND project_id = ?', [req.params.objectiveId, req.params.projectId]);
    if (!obj) return res.status(404).json({ error: 'Objective not found' });
    const { title, description, status, start_date, end_date, color } = req.body;
    await execute(
      `UPDATE objectives SET
         title = COALESCE(?, title), description = COALESCE(?, description),
         status = COALESCE(?, status), start_date = COALESCE(?, start_date),
         end_date = COALESCE(?, end_date), color = COALESCE(?, color),
         updated_at = NOW()
       WHERE id = ?`,
      [title || null, description !== undefined ? description : null, status || null,
       start_date !== undefined ? start_date : null, end_date !== undefined ? end_date : null,
       color || null, req.params.objectiveId]
    );
    const updated = await queryOne('SELECT * FROM objectives WHERE id = ?', [req.params.objectiveId]);
    res.json(updated);
  } catch (err) { res.status(500).json({ error: 'Failed to update objective' }); }
});

// DELETE /api/projects/:projectId/okrs/:objectiveId
router.delete('/:objectiveId', requireWriteAccess, async (req, res) => {
  try {
    const obj = await queryOne('SELECT id FROM objectives WHERE id = ? AND project_id = ?', [req.params.objectiveId, req.params.projectId]);
    if (!obj) return res.status(404).json({ error: 'Objective not found' });
    await execute('DELETE FROM objectives WHERE id = ?', [req.params.objectiveId]);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: 'Failed to delete objective' }); }
});

// ── Key Results ───────────────────────────────────────────────────────────────

// GET /api/projects/:projectId/okrs/:objectiveId/key-results
router.get('/:objectiveId/key-results', async (req, res) => {
  try {
    const obj = await queryOne('SELECT id FROM objectives WHERE id = ? AND project_id = ?', [req.params.objectiveId, req.params.projectId]);
    if (!obj) return res.status(404).json({ error: 'Objective not found' });
    const krs = await queryAll(
      'SELECT * FROM key_results WHERE objective_id = ? ORDER BY created_at ASC',
      [req.params.objectiveId]
    );
    res.json(krs);
  } catch (err) { res.status(500).json({ error: 'Failed to fetch key results' }); }
});

// POST /api/projects/:projectId/okrs/:objectiveId/key-results
router.post('/:objectiveId/key-results', requireWriteAccess, async (req, res) => {
  try {
    const obj = await queryOne('SELECT id FROM objectives WHERE id = ? AND project_id = ?', [req.params.objectiveId, req.params.projectId]);
    if (!obj) return res.status(404).json({ error: 'Objective not found' });
    const { title, current_value = 0, target_value = 100, unit = '%' } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });
    if (Number(target_value) <= 0) return res.status(400).json({ error: 'Target value must be positive' });
    const id = uuidv4();
    await execute(
      'INSERT INTO key_results (id, objective_id, title, current_value, target_value, unit) VALUES (?, ?, ?, ?, ?, ?)',
      [id, req.params.objectiveId, title.trim(), Number(current_value), Number(target_value), unit || '%']
    );
    const kr = await queryOne('SELECT * FROM key_results WHERE id = ?', [id]);
    res.status(201).json(kr);
  } catch (err) { res.status(500).json({ error: 'Failed to create key result' }); }
});

// PATCH /api/projects/:projectId/okrs/:objectiveId/key-results/:krId
router.patch('/:objectiveId/key-results/:krId', requireWriteAccess, async (req, res) => {
  try {
    const kr = await queryOne('SELECT id FROM key_results WHERE id = ? AND objective_id = ?', [req.params.krId, req.params.objectiveId]);
    if (!kr) return res.status(404).json({ error: 'Key result not found' });
    const { title, current_value, target_value, unit, status } = req.body;
    await execute(
      `UPDATE key_results SET
         title = COALESCE(?, title),
         current_value = COALESCE(?, current_value),
         target_value = COALESCE(?, target_value),
         unit = COALESCE(?, unit),
         status = COALESCE(?, status),
         updated_at = NOW()
       WHERE id = ?`,
      [title || null, current_value != null ? Number(current_value) : null,
       target_value != null ? Number(target_value) : null, unit || null, status || null, req.params.krId]
    );
    const updated = await queryOne('SELECT * FROM key_results WHERE id = ?', [req.params.krId]);
    res.json(updated);
  } catch (err) { res.status(500).json({ error: 'Failed to update key result' }); }
});

// DELETE /api/projects/:projectId/okrs/:objectiveId/key-results/:krId
router.delete('/:objectiveId/key-results/:krId', requireWriteAccess, async (req, res) => {
  try {
    const kr = await queryOne('SELECT id FROM key_results WHERE id = ? AND objective_id = ?', [req.params.krId, req.params.objectiveId]);
    if (!kr) return res.status(404).json({ error: 'Key result not found' });
    await execute('DELETE FROM key_results WHERE id = ?', [req.params.krId]);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: 'Failed to delete key result' }); }
});

module.exports = router;
