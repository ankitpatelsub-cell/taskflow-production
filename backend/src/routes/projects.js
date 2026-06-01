const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/db');
const { authenticate, requireRole, requireMinRole, requireProjectAccess, requireProjectManage } = require('../middleware/auth');
const { logActivity } = require('../services/notificationService');

const router = express.Router();
router.use(authenticate);

// GET /api/projects
router.get('/', (req, res) => {
  const db = getDb();
  let projects;
  if (req.user.role === 'admin') {
    projects = db.prepare(`
      SELECT p.*, u.name as creator_name,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND parent_task_id IS NULL) as task_count,
        (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as member_count
      FROM projects p JOIN users u ON p.created_by = u.id
      ORDER BY p.created_at DESC
    `).all();
  } else {
    projects = db.prepare(`
      SELECT p.*, u.name as creator_name,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND parent_task_id IS NULL) as task_count,
        (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as member_count
      FROM projects p
      JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
      JOIN users u ON p.created_by = u.id
      ORDER BY p.created_at DESC
    `).all(req.user.id);
  }
  res.json(projects);
});

// POST /api/projects  (admin+)
router.post('/', requireMinRole('admin'), (req, res) => {
  const { name, description, color = '#6366f1' } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const db = getDb();
  const id = uuidv4();
  db.prepare('INSERT INTO projects (id, name, description, color, created_by) VALUES (?, ?, ?, ?, ?)')
    .run(id, name, description || null, color, req.user.id);
  // Creator is automatically a member
  db.prepare('INSERT INTO project_members (id, project_id, user_id) VALUES (?, ?, ?)')
    .run(uuidv4(), id, req.user.id);
  logActivity('project', id, req.user.id, 'created', null, { name });
  res.status(201).json({ id, name, description, color });
});

// GET /api/projects/:projectId
router.get('/:projectId', requireProjectAccess, (req, res) => {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  const members = db.prepare(`
    SELECT u.id, u.name, u.email, u.avatar_url, u.role, pm.joined_at
    FROM project_members pm JOIN users u ON u.id = pm.user_id
    WHERE pm.project_id = ?
  `).all(req.params.projectId);
  res.json({ ...project, members });
});

// PATCH /api/projects/:projectId  (admin+ OR project_manager who is a member)
router.patch('/:projectId', requireProjectManage, (req, res) => {
  const db = getDb();
  const { name, description, color, status } = req.body;
  db.prepare(`
    UPDATE projects SET
      name = COALESCE(?, name),
      description = COALESCE(?, description),
      color = COALESCE(?, color),
      status = COALESCE(?, status),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(name ?? null, description ?? null, color ?? null, status ?? null, req.params.projectId);
  res.json({ message: 'Updated' });
});

// DELETE /api/projects/:projectId  (admin+ OR project_manager who is a member)
router.delete('/:projectId', requireProjectManage, (req, res) => {
  const db = getDb();
  db.prepare("UPDATE projects SET status = 'archived', updated_at = datetime('now') WHERE id = ?")
    .run(req.params.projectId);
  res.json({ message: 'Archived' });
});

// POST /api/projects/:projectId/members  (admin+ OR project_manager who is a member)
router.post('/:projectId/members', requireProjectManage, (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  const db = getDb();
  const existing = db.prepare('SELECT id FROM project_members WHERE project_id = ? AND user_id = ?')
    .get(req.params.projectId, userId);
  if (existing) return res.status(409).json({ error: 'Already a member' });
  db.prepare('INSERT INTO project_members (id, project_id, user_id) VALUES (?, ?, ?)')
    .run(uuidv4(), req.params.projectId, userId);
  res.status(201).json({ message: 'Member added' });
});

// DELETE /api/projects/:projectId/members/:userId  (admin+ OR project_manager who is a member)
router.delete('/:projectId/members/:userId', requireProjectManage, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?')
    .run(req.params.projectId, req.params.userId);
  res.json({ message: 'Member removed' });
});

module.exports = router;
