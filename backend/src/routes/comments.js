const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { notifyComment } = require('../services/notificationService');

const router = express.Router({ mergeParams: true });
router.use(authenticate);

// GET /api/tasks/:taskId/comments
router.get('/', (req, res) => {
  const db = getDb();
  const comments = db.prepare(`
    SELECT c.*, u.name as user_name, u.avatar_url
    FROM comments c JOIN users u ON u.id = c.user_id
    WHERE c.task_id = ? ORDER BY c.created_at
  `).all(req.params.taskId);
  res.json(comments);
});

// POST /api/tasks/:taskId/comments
router.post('/', (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'content required' });
  const db = getDb();
  const id = uuidv4();
  db.prepare('INSERT INTO comments (id, task_id, user_id, content) VALUES (?, ?, ?, ?)')
    .run(id, req.params.taskId, req.user.id, content);
  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(id);
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.taskId);
  notifyComment(comment, task, req.user);
  res.status(201).json(comment);
});

// PATCH /api/tasks/:taskId/comments/:commentId
router.patch('/:commentId', (req, res) => {
  const { content } = req.body;
  const db = getDb();
  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(req.params.commentId);
  if (!comment) return res.status(404).json({ error: 'Comment not found' });
  if (comment.user_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  db.prepare("UPDATE comments SET content = ?, updated_at = datetime('now') WHERE id = ?").run(content, req.params.commentId);
  res.json({ message: 'Updated' });
});

// DELETE /api/tasks/:taskId/comments/:commentId
router.delete('/:commentId', (req, res) => {
  const db = getDb();
  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(req.params.commentId);
  if (!comment) return res.status(404).json({ error: 'Comment not found' });
  if (comment.user_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  db.prepare('DELETE FROM comments WHERE id = ?').run(req.params.commentId);
  res.json({ message: 'Deleted' });
});

module.exports = router;
