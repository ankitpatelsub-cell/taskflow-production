const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { queryAll, queryOne, execute } = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });
router.use(authenticate);

// Verify caller belongs to the project that owns this task (or is admin)
async function requireTaskAccess(req, res, next) {
  try {
    if (['admin', 'super_admin'].includes(req.user.role)) return next();
    const task = await queryOne('SELECT project_id FROM tasks WHERE id = ?', [req.params.taskId]);
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
router.use(requireTaskAccess);

function detectLinkType(url) {
  if (!url) return 'url';
  if (/github\.com.*\/pull\/\d+/.test(url))    return 'github_pr';
  if (/github\.com.*\/issues\/\d+/.test(url))  return 'github_issue';
  if (/github\.com.*\/commit\//.test(url))      return 'github_commit';
  if (/github\.com/.test(url))                  return 'github';
  return 'url';
}

// GET /api/tasks/:taskId/links
router.get('/', async (req, res) => {
  try {
    const links = await queryAll(
      `SELECT tl.*, u.name as created_by_name
       FROM task_links tl LEFT JOIN users u ON u.id = tl.created_by
       WHERE tl.task_id = ? ORDER BY tl.created_at DESC`,
      [req.params.taskId]
    );
    res.json(links);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch links' });
  }
});

// POST /api/tasks/:taskId/links
router.post('/', async (req, res) => {
  try {
    const { url, title } = req.body;
    if (!url) return res.status(400).json({ error: 'url required' });

    let parsedUrl;
    try { parsedUrl = new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL' }); }

    const id = uuidv4();
    const link_type = detectLinkType(url);
    await execute(
      'INSERT INTO task_links (id, task_id, url, title, link_type, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [id, req.params.taskId, url, title?.trim() || parsedUrl.hostname, link_type, req.user.id]
    );
    const link = await queryOne(
      'SELECT tl.*, u.name as created_by_name FROM task_links tl LEFT JOIN users u ON u.id=tl.created_by WHERE tl.id=?',
      [id]
    );
    res.status(201).json(link);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add link' });
  }
});

// DELETE /api/tasks/:taskId/links/:linkId
router.delete('/:linkId', async (req, res) => {
  try {
    const link = await queryOne('SELECT * FROM task_links WHERE id = ?', [req.params.linkId]);
    if (!link) return res.status(404).json({ error: 'Not found' });
    if (link.created_by !== req.user.id && !['admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await execute('DELETE FROM task_links WHERE id = ?', [req.params.linkId]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete link' });
  }
});

module.exports = router;
