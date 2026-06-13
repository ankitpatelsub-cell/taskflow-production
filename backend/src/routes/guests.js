const express = require('express');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { queryAll, queryOne, execute } = require('../config/db');
const { authenticate, requireProjectAccess, requireProjectManage } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

const VALID_PERMISSIONS = ['read', 'comment', 'edit'];

// ── Authenticated routes (project manager+) ───────────────────────────────────

// GET /api/projects/:projectId/guests
router.get('/', authenticate, requireProjectAccess, async (req, res) => {
  try {
    const rows = await queryAll(`
      SELECT gt.id, gt.label, gt.permissions, gt.expires_at, gt.used_count,
             gt.revoked_at, gt.created_at, u.name AS created_by_name
      FROM guest_tokens gt
      JOIN users u ON u.id = gt.created_by
      WHERE gt.project_id = ?
      ORDER BY gt.created_at DESC
    `, [req.params.projectId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch guest links' });
  }
});

// POST /api/projects/:projectId/guests — create guest link
router.post('/', authenticate, requireProjectManage, async (req, res) => {
  try {
    const { label, permissions = 'read', expires_days } = req.body;
    if (!label) return res.status(400).json({ error: 'label is required' });
    if (!VALID_PERMISSIONS.includes(permissions)) {
      return res.status(400).json({ error: 'permissions must be read, comment, or edit' });
    }

    const id = uuidv4();
    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = expires_days
      ? new Date(Date.now() + parseInt(expires_days) * 86400000).toISOString()
      : null;

    await execute(
      'INSERT INTO guest_tokens (id, project_id, label, token, permissions, created_by, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, req.params.projectId, label, token, permissions, req.user.id, expiresAt]
    );

    const row = await queryOne('SELECT * FROM guest_tokens WHERE id = ?', [id]);
    res.status(201).json({ ...row, token });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create guest link' });
  }
});

// DELETE /api/projects/:projectId/guests/:guestId — revoke
router.delete('/:guestId', authenticate, requireProjectManage, async (req, res) => {
  try {
    const row = await queryOne(
      'SELECT id FROM guest_tokens WHERE id = ? AND project_id = ?',
      [req.params.guestId, req.params.projectId]
    );
    if (!row) return res.status(404).json({ error: 'Guest link not found' });
    await execute('UPDATE guest_tokens SET revoked_at = NOW() WHERE id = ?', [req.params.guestId]);
    res.json({ message: 'Revoked' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to revoke guest link' });
  }
});

module.exports = router;

