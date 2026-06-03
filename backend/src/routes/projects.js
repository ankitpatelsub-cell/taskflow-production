const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { queryOne, queryAll, execute } = require('../config/db');
const { authenticate, requireMinRole, requireProjectAccess, requireProjectManage } = require('../middleware/auth');
const { logActivity } = require('../services/notificationService');

const router = express.Router();
router.use(authenticate);

// GET /api/projects
router.get('/', async (req, res) => {
  try {
    let projects;
    if (req.user.role === 'admin' || req.user.role === 'super_admin') {
      projects = await queryAll(`
        SELECT p.*, u.name as creator_name,
          (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND parent_task_id IS NULL) as task_count,
          (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as member_count
        FROM projects p JOIN users u ON p.created_by = u.id
        ORDER BY p.created_at DESC
      `);
    } else {
      projects = await queryAll(`
        SELECT p.*, u.name as creator_name,
          (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND parent_task_id IS NULL) as task_count,
          (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as member_count
        FROM projects p
        JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
        JOIN users u ON p.created_by = u.id
        ORDER BY p.created_at DESC
      `, [req.user.id]);
    }
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// POST /api/projects
router.post('/', requireMinRole('admin'), async (req, res) => {
  try {
    const { name, description, color = '#6366f1' } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const id = uuidv4();
    await execute(
      'INSERT INTO projects (id, name, description, color, created_by) VALUES (?, ?, ?, ?, ?)',
      [id, name, description || null, color, req.user.id]
    );
    await execute(
      'INSERT INTO project_members (id, project_id, user_id) VALUES (?, ?, ?)',
      [uuidv4(), id, req.user.id]
    );
    await logActivity('project', id, req.user.id, 'created', null, { name });
    res.status(201).json({ id, name, description, color });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// GET /api/projects/:projectId
router.get('/:projectId', requireProjectAccess, async (req, res) => {
  try {
    const project = await queryOne('SELECT * FROM projects WHERE id = ?', [req.params.projectId]);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const members = await queryAll(`
      SELECT u.id, u.name, u.email, u.avatar_url, u.role, pm.joined_at
      FROM project_members pm JOIN users u ON u.id = pm.user_id
      WHERE pm.project_id = ?
    `, [req.params.projectId]);
    res.json({ ...project, members });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// PATCH /api/projects/:projectId
router.patch('/:projectId', requireProjectManage, async (req, res) => {
  try {
    const { name, description, color, status } = req.body;
    const sets = ['updated_at = NOW()'];
    const vals = [];
    if (name !== undefined)        { sets.push('name = ?');        vals.push(name); }
    if (description !== undefined) { sets.push('description = ?'); vals.push(description); }
    if (color !== undefined)       { sets.push('color = ?');       vals.push(color); }
    if (status !== undefined)      { sets.push('status = ?');      vals.push(status); }
    vals.push(req.params.projectId);
    await execute(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`, vals);
    res.json({ message: 'Updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// DELETE /api/projects/:projectId (archives it)
router.delete('/:projectId', requireProjectManage, async (req, res) => {
  try {
    await execute(
      "UPDATE projects SET status = 'archived', updated_at = NOW() WHERE id = ?",
      [req.params.projectId]
    );
    res.json({ message: 'Archived' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to archive project' });
  }
});

// POST /api/projects/:projectId/members
router.post('/:projectId/members', requireProjectManage, async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const existing = await queryOne(
      'SELECT id FROM project_members WHERE project_id = ? AND user_id = ?',
      [req.params.projectId, userId]
    );
    if (existing) return res.status(409).json({ error: 'Already a member' });
    await execute(
      'INSERT INTO project_members (id, project_id, user_id) VALUES (?, ?, ?)',
      [uuidv4(), req.params.projectId, userId]
    );
    res.status(201).json({ message: 'Member added' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add member' });
  }
});

// DELETE /api/projects/:projectId/members/:userId
router.delete('/:projectId/members/:userId', requireProjectManage, async (req, res) => {
  try {
    await execute(
      'DELETE FROM project_members WHERE project_id = ? AND user_id = ?',
      [req.params.projectId, req.params.userId]
    );
    res.json({ message: 'Member removed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// GET /api/projects/:projectId/time-report — aggregate time per task and per user
router.get('/:projectId/time-report', requireProjectAccess, async (req, res) => {
  try {
    const byTask = await queryAll(`
      SELECT t.id, t.title, t.status,
             COALESCE(SUM(tl.duration_minutes), 0) AS total_minutes
      FROM tasks t
      LEFT JOIN time_logs tl ON tl.task_id = t.id
      WHERE t.project_id = ?
      GROUP BY t.id, t.title, t.status
      ORDER BY total_minutes DESC
    `, [req.params.projectId]);

    const byUser = await queryAll(`
      SELECT u.id, u.name, u.avatar_url,
             COALESCE(SUM(tl.duration_minutes), 0) AS total_minutes
      FROM project_members pm
      JOIN users u ON u.id = pm.user_id
      LEFT JOIN time_logs tl ON tl.user_id = u.id
        AND tl.task_id IN (SELECT id FROM tasks WHERE project_id = ?)
      WHERE pm.project_id = ?
      GROUP BY u.id, u.name, u.avatar_url
      ORDER BY total_minutes DESC
    `, [req.params.projectId, req.params.projectId]);

    res.json({ byTask, byUser });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch time report' });
  }
});

module.exports = router;
