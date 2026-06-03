const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { queryAll, queryOne, execute } = require('../config/db');
const { authenticate, requireProjectAccess, requireProjectManage } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });
router.use(authenticate, requireProjectAccess);

const VALID_TRIGGERS = ['task_status_changed', 'task_created', 'task_assigned'];
const VALID_ACTIONS  = ['notify_assignee', 'notify_members', 'change_status'];

// GET /api/projects/:projectId/automations
router.get('/', async (req, res) => {
  try {
    const rows = await queryAll(
      'SELECT * FROM automations WHERE project_id = ? ORDER BY created_at DESC',
      [req.params.projectId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch automations' });
  }
});

// POST /api/projects/:projectId/automations
router.post('/', requireProjectManage, async (req, res) => {
  try {
    const { name, trigger_type, trigger_value, action_type, action_value } = req.body;
    if (!name || !trigger_type || !action_type) {
      return res.status(400).json({ error: 'name, trigger_type, action_type required' });
    }
    if (!VALID_TRIGGERS.includes(trigger_type)) {
      return res.status(400).json({ error: `trigger_type must be one of: ${VALID_TRIGGERS.join(', ')}` });
    }
    if (!VALID_ACTIONS.includes(action_type)) {
      return res.status(400).json({ error: `action_type must be one of: ${VALID_ACTIONS.join(', ')}` });
    }

    const id = uuidv4();
    await execute(
      'INSERT INTO automations (id, project_id, name, trigger_type, trigger_value, action_type, action_value, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, req.params.projectId, name, trigger_type, trigger_value || null, action_type, action_value || null, req.user.id]
    );
    const row = await queryOne('SELECT * FROM automations WHERE id = ?', [id]);
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create automation' });
  }
});

// PATCH /api/projects/:projectId/automations/:automationId
router.patch('/:automationId', requireProjectManage, async (req, res) => {
  try {
    const { name, trigger_type, trigger_value, action_type, action_value, is_active } = req.body;
    const sets = []; const vals = [];
    if (name !== undefined)          { sets.push('name = ?');          vals.push(name); }
    if (trigger_type !== undefined)  { sets.push('trigger_type = ?');  vals.push(trigger_type); }
    if (trigger_value !== undefined) { sets.push('trigger_value = ?'); vals.push(trigger_value); }
    if (action_type !== undefined)   { sets.push('action_type = ?');   vals.push(action_type); }
    if (action_value !== undefined)  { sets.push('action_value = ?');  vals.push(action_value); }
    if (is_active !== undefined)     { sets.push('is_active = ?');     vals.push(is_active ? 1 : 0); }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });

    vals.push(req.params.automationId);
    await execute(`UPDATE automations SET ${sets.join(', ')} WHERE id = ? AND project_id = ?`, [...vals, req.params.projectId]);
    const row = await queryOne('SELECT * FROM automations WHERE id = ?', [req.params.automationId]);
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update automation' });
  }
});

// DELETE /api/projects/:projectId/automations/:automationId
router.delete('/:automationId', requireProjectManage, async (req, res) => {
  try {
    await execute('DELETE FROM automations WHERE id = ? AND project_id = ?',
      [req.params.automationId, req.params.projectId]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete automation' });
  }
});

module.exports = router;
