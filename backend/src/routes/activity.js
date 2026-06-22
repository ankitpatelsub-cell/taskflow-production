'use strict';

const express = require('express');
const { queryAll } = require('../config/db');
const { authenticate, requireProjectAccess } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });
router.use(authenticate, requireProjectAccess);

// GET /api/projects/:projectId/activity?limit=50&offset=0&user_id=...&action=...
router.get('/', async (req, res) => {
  try {
    const { limit = 50, offset = 0, user_id, action } = req.query;
    const lim = Math.min(Number(limit) || 50, 200);

    const conditions = ['t.project_id = ?'];
    const params = [req.params.projectId];

    if (user_id) { conditions.push('al.user_id = ?'); params.push(user_id); }
    if (action)  { conditions.push('al.action = ?');  params.push(action); }

    params.push(lim, Number(offset) || 0);

    const items = await queryAll(
      `SELECT al.id, al.entity_type, al.entity_id, al.action, al.old_value, al.new_value, al.created_at,
              u.id AS user_id, u.name AS user_name,
              t.title AS task_title
       FROM activity_log al
       JOIN tasks t ON t.id = al.entity_id AND al.entity_type = 'task'
       LEFT JOIN users u ON u.id = al.user_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY al.created_at DESC
       LIMIT ? OFFSET ?`,
      params
    );

    res.json(items.map((item) => ({
      ...item,
      old_value: item.old_value ? JSON.parse(item.old_value) : null,
      new_value: item.new_value ? JSON.parse(item.new_value) : null,
    })));
  } catch (err) { res.status(500).json({ error: 'Failed to fetch activity' }); }
});

module.exports = router;
