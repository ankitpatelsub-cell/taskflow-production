const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { queryAll, execute } = require('../config/db');
const { authenticate, requireProjectAccess } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });
router.use(authenticate, requireProjectAccess);

// GET /api/projects/:projectId/tags
router.get('/', async (req, res) => {
  try {
    const tags = await queryAll('SELECT * FROM tags WHERE project_id = ? ORDER BY name', [req.params.projectId]);
    res.json(tags);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

// POST /api/projects/:projectId/tags
router.post('/', async (req, res) => {
  try {
    const { name, color = '#64748b' } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const id = uuidv4();
    await execute(
      'INSERT INTO tags (id, project_id, name, color) VALUES (?, ?, ?, ?)',
      [id, req.params.projectId, name, color]
    );
    res.status(201).json({ id, name, color });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Tag already exists' });
    res.status(500).json({ error: 'Failed to create tag' });
  }
});

// DELETE /api/projects/:projectId/tags/:tagId
router.delete('/:tagId', async (req, res) => {
  try {
    await execute('DELETE FROM tags WHERE id = ? AND project_id = ?', [req.params.tagId, req.params.projectId]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete tag' });
  }
});

module.exports = router;
