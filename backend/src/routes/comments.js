const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { queryOne, queryAll, execute } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { notifyComment } = require('../services/notificationService');
const { broadcast } = require('../services/wsService');
const { validate, createCommentSchema } = require('../config/validate');

const router = express.Router({ mergeParams: true });
router.use(authenticate);

// GET /api/tasks/:taskId/comments
router.get('/', async (req, res) => {
  try {
    const comments = await queryAll(`
      SELECT c.*, u.name as user_name, u.avatar_url
      FROM comments c JOIN users u ON u.id = c.user_id
      WHERE c.task_id = ? ORDER BY c.created_at
    `, [req.params.taskId]);
    res.json(comments);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// POST /api/tasks/:taskId/comments
router.post('/', validate(createCommentSchema), async (req, res) => {
  try {
    const { content } = req.body;

    const id = uuidv4();
    await execute('INSERT INTO comments (id, task_id, user_id, content) VALUES (?, ?, ?, ?)',
      [id, req.params.taskId, req.user.id, content]);

    const [comment, task] = await Promise.all([
      queryOne('SELECT * FROM comments WHERE id = ?', [id]),
      queryOne('SELECT * FROM tasks WHERE id = ?', [req.params.taskId]),
    ]);

    await notifyComment(comment, task, req.user);
    broadcast(task.project_id, { type: 'comment:created', payload: { taskId: req.params.taskId, comment } });
    res.status(201).json(comment);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

// PATCH /api/tasks/:taskId/comments/:commentId
router.patch('/:commentId', validate(createCommentSchema), async (req, res) => {
  try {
    const { content } = req.body;
    const comment = await queryOne('SELECT * FROM comments WHERE id = ?', [req.params.commentId]);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });
    if (comment.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await execute('UPDATE comments SET content = ?, updated_at = NOW() WHERE id = ?', [content, req.params.commentId]);
    res.json({ message: 'Updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update comment' });
  }
});

// DELETE /api/tasks/:taskId/comments/:commentId
router.delete('/:commentId', async (req, res) => {
  try {
    const comment = await queryOne('SELECT * FROM comments WHERE id = ?', [req.params.commentId]);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });
    if (comment.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await execute('DELETE FROM comments WHERE id = ?', [req.params.commentId]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

module.exports = router;
