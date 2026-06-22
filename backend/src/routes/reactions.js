const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { queryAll, queryOne, execute } = require('../config/db');
const { authenticate } = require('../middleware/auth');

// Mounted at: /api/comments/:commentId/reactions

const router = express.Router({ mergeParams: true });
router.use(authenticate);

// Verify caller belongs to the project that owns the comment's task (or is admin)
async function requireCommentAccess(req, res, next) {
  try {
    if (['admin', 'super_admin'].includes(req.user.role)) return next();
    const comment = await queryOne('SELECT task_id FROM comments WHERE id = ?', [req.params.commentId]);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });
    const task = await queryOne('SELECT project_id FROM tasks WHERE id = ?', [comment.task_id]);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    const member = await queryOne(
      'SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?',
      [task.project_id, req.user.id]
    );
    if (!member) return res.status(403).json({ error: 'Access denied' });
    next();
  } catch (err) {
    next(err);
  }
}
router.use(requireCommentAccess);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns reaction counts grouped by emoji for a given comment,
 * each group including the list of user display names who reacted.
 * Shape: [{ emoji, count, users: [name, ...] }]
 */
async function getGroupedReactions(commentId) {
  const rows = await queryAll(
    `SELECT r.emoji, u.name AS user_name
     FROM reactions r
     JOIN users u ON u.id = r.user_id
     WHERE r.comment_id = ?
     ORDER BY r.emoji, r.created_at`,
    [commentId]
  );

  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.emoji)) {
      map.set(row.emoji, { emoji: row.emoji, count: 0, users: [] });
    }
    const group = map.get(row.emoji);
    group.count += 1;
    group.users.push(row.user_name);
  }
  return Array.from(map.values());
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/comments/:commentId/reactions
router.get('/', async (req, res) => {
  try {
    const grouped = await getGroupedReactions(req.params.commentId);
    res.json(grouped);
  } catch (err) {
    req.log.error({ err, commentId: req.params.commentId }, 'reactions.list.error');
    res.status(500).json({ error: 'Failed to fetch reactions' });
  }
});

// POST /api/comments/:commentId/reactions
router.post('/', async (req, res) => {
  try {
    const { emoji } = req.body;

    if (!emoji || typeof emoji !== 'string') {
      return res.status(400).json({ error: 'emoji is required' });
    }

    // Validate emoji is 1-2 characters (allowing for multi-byte Unicode emoji)
    const emojiChars = [...emoji]; // Spread correctly splits Unicode code points
    if (emojiChars.length < 1 || emojiChars.length > 2) {
      return res.status(400).json({ error: 'emoji must be 1-2 characters' });
    }

    // Verify the comment exists
    const comment = await queryOne(
      'SELECT id FROM comments WHERE id = ?',
      [req.params.commentId]
    );
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const id = uuidv4();
    // ON CONFLICT DO NOTHING honours the UNIQUE(comment_id, user_id, emoji) constraint;
    // a duplicate reaction from the same user is silently ignored.
    await execute(
      `INSERT INTO reactions (id, comment_id, user_id, emoji)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (comment_id, user_id, emoji) DO NOTHING`,
      [id, req.params.commentId, req.user.id, emoji]
    );

    req.log.info({ commentId: req.params.commentId, userId: req.user.id, emoji }, 'reactions.added');

    const grouped = await getGroupedReactions(req.params.commentId);
    res.status(201).json(grouped);
  } catch (err) {
    req.log.error({ err, commentId: req.params.commentId }, 'reactions.add.error');
    res.status(500).json({ error: 'Failed to add reaction' });
  }
});

// DELETE /api/comments/:commentId/reactions/:emoji
router.delete('/:emoji', async (req, res) => {
  try {
    const emoji = decodeURIComponent(req.params.emoji);

    await execute(
      'DELETE FROM reactions WHERE comment_id = ? AND user_id = ? AND emoji = ?',
      [req.params.commentId, req.user.id, emoji]
    );

    req.log.info({ commentId: req.params.commentId, userId: req.user.id, emoji }, 'reactions.removed');
    res.json({ message: 'Reaction removed' });
  } catch (err) {
    req.log.error({ err, commentId: req.params.commentId, emoji: req.params.emoji }, 'reactions.remove.error');
    res.status(500).json({ error: 'Failed to remove reaction' });
  }
});

module.exports = router;
