const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/db');
const { hash } = require('../utils/password');
const { authenticate, requireMinRole, hasMinRole } = require('../middleware/auth');

const ASSIGNABLE_ROLES = ['super_admin', 'admin', 'project_manager', 'member', 'viewer'];

const router = express.Router();
router.use(authenticate);

// GET /api/users  (admin+)
router.get('/', requireMinRole('admin'), (req, res) => {
  const db = getDb();
  const users = db.prepare('SELECT id, name, email, role, avatar_url, timezone, is_active, created_at FROM users ORDER BY name').all();
  res.json(users);
});

// POST /api/users  (admin+)
router.post('/', requireMinRole('admin'), async (req, res) => {
  const { name, email, password, role = 'member', timezone = 'UTC' } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email, password required' });
  // Only super_admin can assign super_admin role
  if (role === 'super_admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Only super_admin can assign the super_admin role' });
  }
  if (!ASSIGNABLE_ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role' });
  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'Email already in use' });
  const id = uuidv4();
  const password_hash = await hash(password);
  db.prepare('INSERT INTO users (id, name, email, password_hash, role, timezone) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, name, email, password_hash, role, timezone);
  res.status(201).json({ id, name, email, role, timezone });
});

// GET /api/users/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, name, email, role, avatar_url, timezone, is_active, created_at FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// PATCH /api/users/:id
router.patch('/:id', (req, res) => {
  const isAdmin = hasMinRole(req.user.role, 'admin');
  if (!isAdmin && req.user.id !== req.params.id) return res.status(403).json({ error: 'Forbidden' });
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { name, avatar_url, timezone, is_active, role } = req.body;

  // Role change: only admin+ can change roles; only super_admin can assign super_admin
  if (role !== undefined) {
    if (!isAdmin) return res.status(403).json({ error: 'Only admins can change roles' });
    if (!ASSIGNABLE_ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role' });
    if (role === 'super_admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only super_admin can assign the super_admin role' });
    }
  }

  db.prepare(`
    UPDATE users SET
      name       = COALESCE(?, name),
      avatar_url = COALESCE(?, avatar_url),
      timezone   = COALESCE(?, timezone),
      is_active  = COALESCE(?, is_active),
      role       = COALESCE(?, role)
    WHERE id = ?
  `).run(name ?? null, avatar_url ?? null, timezone ?? null, is_active ?? null, role ?? null, req.params.id);
  res.json({ message: 'Updated' });
});

// PATCH /api/users/:id/password
router.patch('/:id/password', requireMinRole('admin'), async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'password required' });
  const db = getDb();
  const password_hash = await hash(password);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(password_hash, req.params.id);
  res.json({ message: 'Password updated' });
});

module.exports = router;
