const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/db');
const { authenticate, requireProjectAccess } = require('../middleware/auth');
const { logActivity, notifyTaskAssigned } = require('../services/notificationService');

const router = express.Router({ mergeParams: true });
router.use(authenticate, requireProjectAccess);

function getTaskWithDetails(db, taskId) {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  if (!task) return null;
  task.tags = db.prepare(`
    SELECT t.id, t.name, t.color FROM task_tags tt JOIN tags t ON t.id = tt.tag_id WHERE tt.task_id = ?
  `).all(taskId);
  task.subtasks = db.prepare('SELECT * FROM tasks WHERE parent_task_id = ? ORDER BY position').all(taskId);
  task.comments = db.prepare(`
    SELECT c.*, u.name as user_name, u.avatar_url FROM comments c JOIN users u ON u.id = c.user_id
    WHERE c.task_id = ? ORDER BY c.created_at
  `).all(taskId);
  task.attachments = db.prepare(`
    SELECT a.*, u.name as user_name FROM attachments a JOIN users u ON u.id = a.user_id WHERE a.task_id = ?
  `).all(taskId);
  task.activity = db.prepare(`
    SELECT al.*, u.name as user_name FROM activity_log al
    LEFT JOIN users u ON u.id = al.user_id
    WHERE al.entity_type = 'task' AND al.entity_id = ?
    ORDER BY al.created_at DESC LIMIT 50
  `).all(taskId);
  return task;
}

// GET /api/projects/:projectId/tasks
router.get('/', (req, res) => {
  const db = getDb();
  const { status, priority, assignee, tag, from, to, parent } = req.query;
  let q = `
    SELECT t.*, u.name as assignee_name, u.avatar_url as assignee_avatar,
           c.name as creator_name
    FROM tasks t
    LEFT JOIN users u ON u.id = t.assignee_id
    LEFT JOIN users c ON c.id = t.created_by
    WHERE t.project_id = ?
  `;
  const params = [req.params.projectId];
  if (status) { q += ' AND t.status = ?'; params.push(status); }
  if (priority) { q += ' AND t.priority = ?'; params.push(priority); }
  if (assignee) { q += ' AND t.assignee_id = ?'; params.push(assignee); }
  if (from) { q += ' AND t.deadline >= ?'; params.push(from); }
  if (to) { q += ' AND t.deadline <= ?'; params.push(to); }
  if (parent === 'null') { q += ' AND t.parent_task_id IS NULL'; }
  else if (parent) { q += ' AND t.parent_task_id = ?'; params.push(parent); }
  else { q += ' AND t.parent_task_id IS NULL'; }
  if (tag) {
    q += ' AND t.id IN (SELECT task_id FROM task_tags WHERE tag_id = ?)';
    params.push(tag);
  }
  q += ' ORDER BY t.position, t.created_at DESC';
  const tasks = db.prepare(q).all(...params);
  tasks.forEach(t => {
    t.tags = db.prepare('SELECT tg.id, tg.name, tg.color FROM task_tags tt JOIN tags tg ON tg.id = tt.tag_id WHERE tt.task_id = ?').all(t.id);
  });
  res.json(tasks);
});

// POST /api/projects/:projectId/tasks
router.post('/', (req, res) => {
  const db = getDb();
  const { title, description, priority = 'medium', assignee_id, deadline, estimated_hours, parent_task_id, tag_ids } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  const id = uuidv4();
  const maxPos = db.prepare('SELECT COALESCE(MAX(position),0)+1 as pos FROM tasks WHERE project_id = ? AND status = ?').get(req.params.projectId, 'todo');
  db.prepare(`
    INSERT INTO tasks (id, project_id, parent_task_id, title, description, priority, assignee_id, created_by, deadline, estimated_hours, position)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.params.projectId, parent_task_id || null, title, description || null, priority, assignee_id || null, req.user.id, deadline || null, estimated_hours || null, maxPos.pos);
  if (tag_ids?.length) {
    tag_ids.forEach(tid => db.prepare('INSERT OR IGNORE INTO task_tags (id, task_id, tag_id) VALUES (?, ?, ?)').run(uuidv4(), id, tid));
  }
  logActivity('task', id, req.user.id, 'created', null, { title });
  if (assignee_id) {
    notifyTaskAssigned({ id, title, assignee_id }, req.user);
  }
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  res.status(201).json(task);
});

// GET /api/projects/:projectId/tasks/:taskId
router.get('/:taskId', (req, res) => {
  const db = getDb();
  const task = getTaskWithDetails(db, req.params.taskId);
  if (!task || task.project_id !== req.params.projectId) return res.status(404).json({ error: 'Task not found' });
  res.json(task);
});

// PATCH /api/projects/:projectId/tasks/:taskId
router.patch('/:taskId', (req, res) => {
  const db = getDb();
  const old = db.prepare('SELECT * FROM tasks WHERE id = ? AND project_id = ?').get(req.params.taskId, req.params.projectId);
  if (!old) return res.status(404).json({ error: 'Task not found' });
  const { title, description, status, priority, assignee_id, deadline, estimated_hours, tag_ids } = req.body;
  db.prepare(`
    UPDATE tasks SET
      title = COALESCE(?, title),
      description = COALESCE(?, description),
      status = COALESCE(?, status),
      priority = COALESCE(?, priority),
      assignee_id = CASE WHEN ? IS NOT NULL THEN ? ELSE assignee_id END,
      deadline = COALESCE(?, deadline),
      estimated_hours = COALESCE(?, estimated_hours),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(title ?? null, description ?? null, status ?? null, priority ?? null,
         assignee_id ?? null, assignee_id ?? null, deadline ?? null, estimated_hours ?? null, req.params.taskId);
  if (tag_ids !== undefined) {
    db.prepare('DELETE FROM task_tags WHERE task_id = ?').run(req.params.taskId);
    tag_ids.forEach(tid => db.prepare('INSERT OR IGNORE INTO task_tags (id, task_id, tag_id) VALUES (?, ?, ?)').run(uuidv4(), req.params.taskId, tid));
  }
  logActivity('task', req.params.taskId, req.user.id, 'updated', old, req.body);
  if (assignee_id && assignee_id !== old.assignee_id) {
    const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.taskId);
    notifyTaskAssigned(updated, req.user);
  }
  res.json({ message: 'Updated' });
});

// DELETE /api/projects/:projectId/tasks/:taskId
router.delete('/:taskId', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM tasks WHERE id = ? AND project_id = ?').run(req.params.taskId, req.params.projectId);
  res.json({ message: 'Deleted' });
});

// PATCH /api/projects/:projectId/tasks/:taskId/position
router.patch('/:taskId/position', (req, res) => {
  const { status, position } = req.body;
  const db = getDb();
  db.prepare("UPDATE tasks SET status = COALESCE(?, status), position = COALESCE(?, position), updated_at = datetime('now') WHERE id = ?")
    .run(status ?? null, position ?? null, req.params.taskId);
  res.json({ message: 'Updated' });
});

module.exports = router;
