const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { queryAll, queryOne, execute, withTransaction } = require('../config/db');
const { authenticate, requireProjectAccess, requireProjectManage } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });
router.use(authenticate, requireProjectAccess);

function nameToKey(name) {
  return name.toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 30);
}

const DEFAULT_KEYS = new Set(['todo', 'in_progress', 'review', 'done']);

// GET /api/projects/:projectId/statuses
router.get('/', async (req, res) => {
  try {
    const rows = await queryAll(
      'SELECT * FROM project_statuses WHERE project_id = ? ORDER BY position ASC',
      [req.params.projectId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch statuses' });
  }
});

// POST /api/projects/:projectId/statuses
router.post('/', requireProjectManage, async (req, res) => {
  try {
    const { name, color = '#6366f1', bg_color = '#eef2ff' } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

    const key = nameToKey(name);
    const existing = await queryOne(
      'SELECT id FROM project_statuses WHERE project_id = ? AND key = ?',
      [req.params.projectId, key]
    );
    if (existing) return res.status(409).json({ error: `Status with key "${key}" already exists` });

    const maxPos = await queryOne(
      'SELECT COALESCE(MAX(position), -1) AS m FROM project_statuses WHERE project_id = ?',
      [req.params.projectId]
    );
    const id = uuidv4();
    await execute(
      'INSERT INTO project_statuses (id, project_id, name, key, color, bg_color, position, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, false)',
      [id, req.params.projectId, name.trim(), key, color, bg_color, (maxPos?.m ?? -1) + 1]
    );
    const row = await queryOne('SELECT * FROM project_statuses WHERE id = ?', [id]);
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create status' });
  }
});

// PATCH /api/projects/:projectId/statuses/:statusId
router.patch('/:statusId', requireProjectManage, async (req, res) => {
  try {
    const status = await queryOne(
      'SELECT * FROM project_statuses WHERE id = ? AND project_id = ?',
      [req.params.statusId, req.params.projectId]
    );
    if (!status) return res.status(404).json({ error: 'Status not found' });

    const { name, color, bg_color, is_default } = req.body;

    const HEX_RE = /^#[0-9a-fA-F]{3,8}$/;
    if (name !== undefined && !String(name).trim()) {
      return res.status(400).json({ error: 'name cannot be empty' });
    }
    if (color !== undefined && color && !HEX_RE.test(color)) {
      return res.status(400).json({ error: 'color must be a valid hex color (e.g. #6366f1)' });
    }
    if (bg_color !== undefined && bg_color && !HEX_RE.test(bg_color)) {
      return res.status(400).json({ error: 'bg_color must be a valid hex color (e.g. #eef2ff)' });
    }

    const sets = []; const vals = [];
    if (name !== undefined)       { sets.push('name = ?');       vals.push(String(name).trim()); }
    if (color !== undefined)      { sets.push('color = ?');      vals.push(color); }
    if (bg_color !== undefined)   { sets.push('bg_color = ?');   vals.push(bg_color); }
    if (is_default !== undefined) {
      sets.push('is_default = ?'); vals.push(is_default);
    }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });

    // If setting a new default, do it atomically — clear all others then set the new one
    let row;
    if (is_default) {
      row = await withTransaction(async (txQuery) => {
        await txQuery('UPDATE project_statuses SET is_default = false WHERE project_id = ?', [req.params.projectId]);
        const fullVals = [...vals, req.params.statusId, req.params.projectId];
        await txQuery(`UPDATE project_statuses SET ${sets.join(', ')} WHERE id = ? AND project_id = ?`, fullVals);
        const updated = await txQuery('SELECT * FROM project_statuses WHERE id = ?', [req.params.statusId]);
        return updated.rows[0];
      });
    } else {
      vals.push(req.params.statusId, req.params.projectId);
      await execute(
        `UPDATE project_statuses SET ${sets.join(', ')} WHERE id = ? AND project_id = ?`,
        vals
      );
      row = await queryOne('SELECT * FROM project_statuses WHERE id = ?', [req.params.statusId]);
    }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// DELETE /api/projects/:projectId/statuses/:statusId
router.delete('/:statusId', requireProjectManage, async (req, res) => {
  try {
    const status = await queryOne(
      'SELECT * FROM project_statuses WHERE id = ? AND project_id = ?',
      [req.params.statusId, req.params.projectId]
    );
    if (!status) return res.status(404).json({ error: 'Status not found' });

    // Block deleting built-in defaults
    if (DEFAULT_KEYS.has(status.key)) {
      return res.status(409).json({ error: 'Default statuses (todo, in_progress, review, done) cannot be deleted' });
    }

    // Block if only 1 status left
    const count = await queryOne(
      'SELECT COUNT(*) AS c FROM project_statuses WHERE project_id = ?',
      [req.params.projectId]
    );
    if (parseInt(count.c) <= 1) {
      return res.status(409).json({ error: 'Cannot delete the last status' });
    }

    // Block if tasks are using it
    const taskCount = await queryOne(
      'SELECT COUNT(*) AS c FROM tasks WHERE project_id = ? AND status = ?',
      [req.params.projectId, status.key]
    );
    if (parseInt(taskCount.c) > 0) {
      return res.status(409).json({
        error: `${taskCount.c} task(s) use this status. Reassign them first.`,
        task_count: parseInt(taskCount.c),
      });
    }

    await execute('DELETE FROM project_statuses WHERE id = ?', [req.params.statusId]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete status' });
  }
});

// POST /api/projects/:projectId/statuses/reorder
router.post('/reorder', requireProjectManage, async (req, res) => {
  try {
    const { order } = req.body;
    if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array of status ids' });
    if (order.length > 50) return res.status(400).json({ error: 'Cannot reorder more than 50 statuses at once' });

    for (let i = 0; i < order.length; i++) {
      await execute(
        'UPDATE project_statuses SET position = ? WHERE id = ? AND project_id = ?',
        [i, order[i], req.params.projectId]
      );
    }
    const rows = await queryAll(
      'SELECT * FROM project_statuses WHERE project_id = ? ORDER BY position ASC',
      [req.params.projectId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to reorder statuses' });
  }
});

module.exports = router;
