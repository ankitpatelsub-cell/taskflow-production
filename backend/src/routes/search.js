'use strict';

const express = require('express');
const { queryAll } = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/search?q=...&type=all|tasks|projects|comments&status=...&priority=...&limit=20
router.get('/', async (req, res) => {
  try {
    const { q = '', type = 'all', status, priority, assignee, limit = 20 } = req.query;
    if (!q || q.trim().length < 2) return res.json({ tasks: [], projects: [], comments: [] });

    const lim = Math.min(Number(limit) || 20, 50);
    const search = `%${q}%`;

    const results = {};

    if (type === 'all' || type === 'tasks') {
      const taskConditions = [
        '(t.title ILIKE ? OR t.description ILIKE ?)',
        '(pm.user_id = ? OR t.created_by = ? OR t.assignee_id = ?)',
      ];
      const taskParams = [search, search, req.user.id, req.user.id, req.user.id];
      if (status) { taskConditions.push('t.status = ?'); taskParams.push(status); }
      if (priority) { taskConditions.push('t.priority = ?'); taskParams.push(priority); }
      if (assignee) { taskConditions.push('t.assignee_id = ?'); taskParams.push(assignee); }
      taskParams.push(lim);

      results.tasks = await queryAll(
        `SELECT DISTINCT t.id, t.title, t.status, t.priority, t.deadline,
                t.project_id, p.name AS project_name, p.color AS project_color,
                u.name AS assignee_name
         FROM tasks t
         JOIN projects p ON p.id = t.project_id
         LEFT JOIN project_members pm ON pm.project_id = t.project_id AND pm.user_id = ?
         LEFT JOIN users u ON u.id = t.assignee_id
         WHERE ${taskConditions.join(' AND ')}
         ORDER BY t.created_at DESC
         LIMIT ?`,
        [req.user.id, ...taskParams]
      );
    }

    if (type === 'all' || type === 'projects') {
      results.projects = await queryAll(
        `SELECT DISTINCT p.id, p.name, p.color, p.description,
                COUNT(t.id) AS task_count
         FROM projects p
         LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
         LEFT JOIN tasks t ON t.project_id = p.id
         WHERE (pm.user_id = ? OR ? IN ('admin','super_admin'))
           AND (p.name ILIKE ? OR p.description ILIKE ?)
         GROUP BY p.id
         ORDER BY p.name
         LIMIT ?`,
        [req.user.id, req.user.id, req.user.role, search, search, Math.min(lim, 10)]
      );
    }

    if (type === 'all' || type === 'comments') {
      results.comments = await queryAll(
        `SELECT DISTINCT c.id, c.body, c.created_at,
                t.id AS task_id, t.title AS task_title, t.project_id,
                p.name AS project_name, u.name AS author_name
         FROM comments c
         JOIN tasks t ON t.id = c.task_id
         JOIN projects p ON p.id = t.project_id
         JOIN users u ON u.id = c.user_id
         LEFT JOIN project_members pm ON pm.project_id = t.project_id AND pm.user_id = ?
         WHERE c.body ILIKE ?
           AND (pm.user_id = ? OR c.user_id = ?)
         ORDER BY c.created_at DESC
         LIMIT ?`,
        [req.user.id, search, req.user.id, req.user.id, Math.min(lim, 10)]
      );
    }

    res.json(results);
  } catch (err) { res.status(500).json({ error: 'Search failed' }); }
});

// GET /api/projects/all/tasks — kept for backward-compat with CommandPalette
router.get('/projects/all/tasks', async (req, res) => {
  const { q = '', limit = 8 } = req.query;
  if (!q || q.trim().length < 2) return res.json([]);
  try {
    const tasks = await queryAll(
      `SELECT DISTINCT t.id, t.title, t.status, t.priority, t.project_id, p.name AS project_name
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       LEFT JOIN project_members pm ON pm.project_id = t.project_id AND pm.user_id = ?
       WHERE (pm.user_id = ? OR t.created_by = ?)
         AND (t.title ILIKE ? OR t.description ILIKE ?)
       ORDER BY t.created_at DESC LIMIT ?`,
      [req.user.id, req.user.id, req.user.id, `%${q}%`, `%${q}%`, Number(limit)]
    );
    res.json(tasks);
  } catch (err) { res.status(500).json({ error: 'Search failed' }); }
});

module.exports = router;
