const express = require('express');
const { queryOne, queryAll, execute } = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/notifications
router.get('/', async (req, res) => {
  try {
    const [notifications, unreadRow] = await Promise.all([
      queryAll('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', [req.user.id]),
      queryOne('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0', [req.user.id]),
    ]);
    res.json({ notifications, unread_count: parseInt(unreadRow.count, 10) });
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
