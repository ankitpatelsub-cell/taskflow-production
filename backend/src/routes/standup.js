const express = require('express');
const { getDb } = require('../config/db');
const { authenticate, requireProjectAccess } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });
router.use(authenticate, requireProjectAccess);

// GET /api/projects/:projectId/standup?date=YYYY-MM-DD&status=
router.get('/', (req, res) => {
  const db = getDb();
  const { date, status } = req.query;
  const today = date || new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(new Date(today).getTime() + 86400000).toISOString().slice(0, 10);

  let q = `
    SELECT t.*, u.name as assignee_name, u.email as assignee_email, u.avatar_url as assignee_avatar,
           c.name as creator_name
    FROM tasks t
    LEFT JOIN users u ON u.id = t.assignee_id
    LEFT JOIN users c ON c.id = t.created_by
    WHERE t.project_id = ? AND t.parent_task_id IS NULL
  `;
  const params = [req.params.projectId];
  if (status) { q += ' AND t.status = ?'; params.push(status); }
  q += ' ORDER BY u.name, t.priority DESC, t.deadline';

  const tasks = db.prepare(q).all(...params);
  tasks.forEach(t => {
    t.is_overdue = t.deadline && t.deadline < today && t.status !== 'done';
    t.due_today = t.deadline && t.deadline >= today && t.deadline < tomorrow;
    t.tags = db.prepare('SELECT tg.id, tg.name, tg.color FROM task_tags tt JOIN tags tg ON tg.id = tt.tag_id WHERE tt.task_id = ?').all(t.id);
  });

  // Group by assignee
  const grouped = {};
  const unassigned = [];
  tasks.forEach(task => {
    if (!task.assignee_id) {
      unassigned.push(task);
    } else {
      if (!grouped[task.assignee_id]) {
        grouped[task.assignee_id] = {
          user: { id: task.assignee_id, name: task.assignee_name, email: task.assignee_email, avatar_url: task.assignee_avatar },
          tasks: [],
          stats: { total: 0, done: 0, in_progress: 0, overdue: 0 },
        };
      }
      grouped[task.assignee_id].tasks.push(task);
      grouped[task.assignee_id].stats.total++;
      if (task.status === 'done') grouped[task.assignee_id].stats.done++;
      if (task.status === 'in_progress') grouped[task.assignee_id].stats.in_progress++;
      if (task.is_overdue) grouped[task.assignee_id].stats.overdue++;
    }
  });

  res.json({
    date: today,
    groups: Object.values(grouped),
    unassigned,
  });
});

module.exports = router;
