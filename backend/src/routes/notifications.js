const express = require('express');
const { queryOne, queryAll, execute } = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/notifications?page=1&limit=20
router.get('/', async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page  || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
    const offset = (page - 1) * limit;

    const [notifications, totalRow, unreadRow] = await Promise.all([
      queryAll(
        'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [req.user.id, limit, offset]
      ),
      queryOne('SELECT COUNT(*) as count FROM notifications WHERE user_id = ?', [req.user.id]),
      queryOne('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0', [req.user.id]),
    ]);

    const total = parseInt(totalRow.count, 10);
    res.json({
      notifications,
      unread_count: parseInt(unreadRow.count, 10),
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// PATCH /api/notifications/read
router.patch('/read', async (req, res) => {
  try {
    await execute('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user.id]);
    res.json({ message: 'All marked read' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark notifications read' });
  }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', async (req, res) => {
  try {
    await execute('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ message: 'Marked read' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark notification read' });
  }
});

module.exports = router;
