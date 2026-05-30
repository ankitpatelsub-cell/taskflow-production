const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/db');
const { hash } = require('../utils/password');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/users
router.get('/', requireRole('admin'), (req, res) => {
  const db = getDb();
  const users = db.prepare('SELECT id, name, email, role, avatar_url, timezone, is_active, created_at FROM users ORDER BY name').all();
  res.json(users);
});

// POST /api/users
router.post('/', requireRole('admin'), async (req, res) => {
  const { name, email, password, role = 'user', timezone = 'UTC' } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email, password required' });
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
  const isAdmin = req.user.role === 'admin';
  if (!isAdmin && req.user.id !== req.params.id) return res.status(403).json({ error: 'Forbidden' });
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { name, avatar_url, timezone, is_active } = req.body;
  db.prepare(`
    UPDATE users SET
      name = COALESCE(?, name),
      avatar_url = COALESCE(?, avatar_url),
      timezone = COALESCE(?, timezone),
      is_active = COALESCE(?, is_active)
    WHERE id = ?
  `).run(name ?? null, avatar_url ?? null, timezone ?? null, is_active ?? null, req.params.id);
  res.json({ message: 'Updated' });
});

// PATCH /api/users/:id/password
router.patch('/:id/password', requireRole('admin'), async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'password required' });
  const db = getDb();
  const password_hash = await hash(password);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(password_hash, req.params.id);
  res.json({ message: 'Password updated' });
});

module.exports = router;
