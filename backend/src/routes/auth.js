const express = require('express');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { getDb } = require('../config/db');
const { hash, compare } = require('../utils/password');
const { signAccess, signRefresh, verifyRefresh } = require('../utils/jwt');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// POST /api/auth/register  (public — no auth required)
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name?.trim())    return res.status(400).json({ error: 'Name is required' });
  if (!email?.trim())   return res.status(400).json({ error: 'Email is required' });
  if (!password)        return res.status(400).json({ error: 'Password is required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return res.status(400).json({ error: 'Invalid email address' });

  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (existing) return res.status(409).json({ error: 'An account with this email already exists' });

  const id = uuidv4();
  const passwordHash = await hash(password);

  db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role, is_active)
    VALUES (?, ?, ?, ?, 'member', 1)
  `).run(id, name.trim(), email.toLowerCase().trim(), passwordHash);

  // Auto login — return access token
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  const payload = { id: user.id, email: user.email, role: user.role, name: user.name };
  const accessToken  = signAccess(payload);
  const refreshToken = signRefresh({ id: user.id });

  const tokenId  = uuidv4();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)')
    .run(tokenId, user.id, hashToken(refreshToken), expiresAt);

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    secure: process.env.NODE_ENV === 'production',
  });

  res.status(201).json({
    accessToken,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar_url: null },
  });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE email = ? AND is_active = 1').get(email);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = await compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const payload = { id: user.id, email: user.email, role: user.role, name: user.name };
  const accessToken = signAccess(payload);
  const refreshToken = signRefresh({ id: user.id });

  const tokenId = uuidv4();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)')
    .run(tokenId, user.id, hashToken(refreshToken), expiresAt);

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    secure: process.env.NODE_ENV === 'production',
  });

  res.json({
    accessToken,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar_url: user.avatar_url },
  });
});

// POST /api/auth/refresh
router.post('/refresh', (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) return res.status(401).json({ error: 'No refresh token' });

  let payload;
  try {
    payload = verifyRefresh(token);
  } catch {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }

  const db = getDb();
  const stored = db
    .prepare("SELECT * FROM refresh_tokens WHERE user_id = ? AND token_hash = ? AND expires_at > datetime('now')")
    .get(payload.id, hashToken(token));

  if (!stored) return res.status(401).json({ error: 'Refresh token revoked or expired' });

  const user = db.prepare('SELECT * FROM users WHERE id = ? AND is_active = 1').get(payload.id);
  if (!user) return res.status(401).json({ error: 'User not found' });

  const accessToken = signAccess({ id: user.id, email: user.email, role: user.role, name: user.name });
  res.json({ accessToken });
});

// POST /api/auth/logout
router.post('/logout', authenticate, (req, res) => {
  const token = req.cookies?.refreshToken;
  if (token) {
    const db = getDb();
    db.prepare('DELETE FROM refresh_tokens WHERE token_hash = ?').run(hashToken(token));
  }
  res.clearCookie('refreshToken');
  res.json({ message: 'Logged out' });
});

module.exports = router;
