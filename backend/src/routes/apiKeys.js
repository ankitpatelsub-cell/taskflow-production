'use strict';

const express = require('express');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { queryOne, queryAll, execute } = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

function hashKey(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

// GET /api/me/api-keys
router.get('/', async (req, res) => {
  try {
    const keys = await queryAll(
      `SELECT id, name, key_prefix, scopes, last_used_at, expires_at, created_at
       FROM api_keys WHERE user_id = ? ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json(keys);
  } catch (err) { res.status(500).json({ error: 'Failed to fetch API keys' }); }
});

// POST /api/me/api-keys
router.post('/', async (req, res) => {
  try {
    const { name, scopes = 'read', expires_days } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    const validScopes = ['read', 'write', 'admin'];
    const scopeList = String(scopes).split(',').map((s) => s.trim());
    if (!scopeList.every((s) => validScopes.includes(s))) {
      return res.status(400).json({ error: 'Invalid scopes. Allowed: read, write, admin' });
    }

    // Count existing keys (max 10)
    const count = await queryOne('SELECT COUNT(*) as n FROM api_keys WHERE user_id = ?', [req.user.id]);
    if (Number(count.n) >= 10) return res.status(400).json({ error: 'Maximum 10 API keys allowed' });

    const rawKey = `tick_${crypto.randomBytes(24).toString('hex')}`;
    const prefix = rawKey.slice(0, 12);
    const id = uuidv4();
    const expiresAt = expires_days ? new Date(Date.now() + expires_days * 864e5).toISOString() : null;

    await execute(
      `INSERT INTO api_keys (id, user_id, name, key_hash, key_prefix, scopes, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, req.user.id, name.trim(), hashKey(rawKey), prefix, scopeList.join(','), expiresAt]
    );

    // Return full key ONCE — never stored in plaintext
    res.status(201).json({ id, name: name.trim(), key: rawKey, key_prefix: prefix, scopes: scopeList.join(','), expires_at: expiresAt });
  } catch (err) { res.status(500).json({ error: 'Failed to create API key' }); }
});

// DELETE /api/me/api-keys/:keyId
router.delete('/:keyId', async (req, res) => {
  try {
    const key = await queryOne('SELECT id FROM api_keys WHERE id = ? AND user_id = ?', [req.params.keyId, req.user.id]);
    if (!key) return res.status(404).json({ error: 'API key not found' });
    await execute('DELETE FROM api_keys WHERE id = ?', [req.params.keyId]);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: 'Failed to delete API key' }); }
});

module.exports = { apiKeyRouter: router, hashKey };
