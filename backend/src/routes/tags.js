const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/db');
const { authenticate, requireProjectAccess } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });
router.use(authenticate, requireProjectAccess);

// GET /api/projects/:projectId/tags
router.get('/', (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM tags WHERE project_id = ? ORDER BY name').all(req.params.projectId));
});

// POST /api/projects/:projectId/tags
router.post('/', (req, res) => {
  const { name, color = '#64748b' } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const db = getDb();
  const id = uuidv4();
  try {
    db.prepare('INSERT INTO tags (id, project_id, name, color) VALUES (?, ?, ?, ?)').run(id, req.params.projectId, name, color);
    res.status(201).json({ id, name, color });
  } catch {
    res.status(409).json({ error: 'Tag already exists' });
  }
});

// DELETE /api/projects/:projectId/tags/:tagId
router.delete('/:tagId', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM tags WHERE id = ? AND project_id = ?').run(req.params.tagId, req.params.projectId);
  res.json({ message: 'Deleted' });
});

module.exports = router;
