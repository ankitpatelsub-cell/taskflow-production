'use strict';

const express = require('express');
const { TOTP, NobleCryptoPlugin, ScureBase32Plugin } = require('otplib');
const authenticator = new TOTP({ crypto: new NobleCryptoPlugin(), base32: new ScureBase32Plugin() });
const qrcode = require('qrcode');
const { queryOne, execute } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { signAccess, signRefresh } = require('../utils/jwt');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a standard otpauth:// URI for TOTP apps (Google Authenticator, Authy, etc.)
 */
function buildOtpauthUrl(secret, email) {
  const label = encodeURIComponent(`Tick:${email}`);
  const issuer = encodeURIComponent('Tick');
  return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}

async function issueTokens(user) {
  const payload = { id: user.id, email: user.email, role: user.role, name: user.name };
  const accessToken = signAccess(payload);
  const refreshToken = signRefresh({ id: user.id });

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await execute(
    'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',
    [
      uuidv4(),
      user.id,
      require('crypto').createHash('sha256').update(refreshToken).digest('hex'),
      expiresAt,
    ]
  );

  return { accessToken, refreshToken };
}

// ── GET /api/auth/2fa/setup ───────────────────────────────────────────────────
// Generate a fresh TOTP secret and QR code. Does NOT persist to DB yet.
router.get('/setup', authenticate, async (req, res) => {
  try {
    const secret = authenticator.generateSecret();
    const otpauthUrl = buildOtpauthUrl(secret, req.user.email);
    const qrDataUrl = await qrcode.toDataURL(otpauthUrl);

    req.log.info({ userId: req.user.id }, '2fa.setup_initiated');

    return res.json({
      secret,
      qrDataUrl,
      manualCode: secret,
    });
  } catch (err) {
    req.log.error({ userId: req.user.id, err: err.message }, '2fa.setup_failed');
    return res.status(500).json({ error: 'Failed to generate 2FA setup' });
  }
});

// ── POST /api/auth/2fa/verify-setup ──────────────────────────────────────────
// Verify a TOTP code and, if valid, persist the secret to the DB.
// Body: { secret, token }
router.post('/verify-setup', authenticate, async (req, res) => {
  try {
    const { secret, token } = req.body;

    if (!secret || !token) {
      return res.status(400).json({ error: 'secret and token are required' });
    }

    const isValid = await authenticator.verify(String(token), { secret });
    if (!isValid) {
      req.log.warn({ userId: req.user.id }, '2fa.verify_setup_invalid_code');
      return res.status(400).json({ error: 'Invalid TOTP code — please try again' });
    }

    await execute(
      'UPDATE users SET totp_secret = ?, totp_enabled = TRUE WHERE id = ?',
      [secret, req.user.id]
    );

    req.log.info({ userId: req.user.id }, '2fa.enabled');

    return res.json({ message: '2FA enabled successfully' });
  } catch (err) {
    req.log.error({ userId: req.user.id, err: err.message }, '2fa.verify_setup_failed');
    return res.status(500).json({ error: 'Failed to enable 2FA' });
  }
});

// ── POST /api/auth/2fa/disable ────────────────────────────────────────────────
// Verify the current TOTP token then disable 2FA.
// Body: { token }
router.post('/disable', authenticate, async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'token is required' });
    }

    const user = await queryOne(
      'SELECT totp_secret, totp_enabled FROM users WHERE id = ?',
      [req.user.id]
    );

    if (!user || !user.totp_enabled || !user.totp_secret) {
      return res.status(400).json({ error: '2FA is not currently enabled' });
    }

    const isValid = await authenticator.verify(String(token), { secret: user.totp_secret });
    if (!isValid) {
      req.log.warn({ userId: req.user.id }, '2fa.disable_invalid_code');
      return res.status(400).json({ error: 'Invalid TOTP code' });
    }

    await execute(
      'UPDATE users SET totp_enabled = FALSE, totp_secret = NULL WHERE id = ?',
      [req.user.id]
    );

    req.log.info({ userId: req.user.id }, '2fa.disabled');

    return res.json({ message: '2FA disabled successfully' });
  } catch (err) {
    req.log.error({ userId: req.user.id, err: err.message }, '2fa.disable_failed');
    return res.status(500).json({ error: 'Failed to disable 2FA' });
  }
});

// ── POST /api/auth/2fa/verify ─────────────────────────────────────────────────
// Second step of the login flow. Called after password auth succeeds but
// totp_enabled = TRUE. No full authenticate middleware — uses userId from body.
// Body: { userId, token }
router.post('/verify', async (req, res) => {
  try {
    const { userId, token } = req.body;

    if (!userId || !token) {
      return res.status(400).json({ error: 'userId and token are required' });
    }

    const user = await queryOne(
      'SELECT id, name, email, role, avatar_url, totp_secret, totp_enabled, is_active FROM users WHERE id = ?',
      [userId]
    );

    if (!user || !user.is_active) {
      // Intentionally vague to avoid user-enumeration
      req.log.warn({ userId, ip: req.ip }, '2fa.verify_user_not_found');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.totp_enabled || !user.totp_secret) {
      return res.status(400).json({ error: '2FA is not enabled for this account' });
    }

    const isValid = await authenticator.verify(String(token), { secret: user.totp_secret });
    if (!isValid) {
      req.log.warn({ userId, ip: req.ip }, '2fa.verify_invalid_code');
      return res.status(401).json({ error: 'Invalid TOTP code' });
    }

    const { accessToken, refreshToken } = await issueTokens(user);

    req.log.info({ userId: user.id, email: user.email }, '2fa.verify_success');

    return res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar_url: user.avatar_url,
      },
    });
  } catch (err) {
    req.log.error({ userId: req.body?.userId, err: err.message }, '2fa.verify_failed');
    return res.status(500).json({ error: '2FA verification failed' });
  }
});

module.exports = router;
