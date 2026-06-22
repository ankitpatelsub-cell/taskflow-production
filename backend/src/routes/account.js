const express = require('express');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { queryOne, execute } = require('../config/db');
const { hash } = require('../utils/password');
const { authenticate } = require('../middleware/auth');
const { sendPasswordResetEmail } = require('../services/emailService');
const { APP_URL } = require('../config/env');
const { signAccess } = require('../utils/jwt');

const router = express.Router();

// POST /api/auth/forgot-password — request reset link
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const user = await queryOne('SELECT * FROM users WHERE email = ? AND is_active = 1', [email.toLowerCase().trim()]);

    // Always respond 200 to prevent email enumeration
    if (!user) return res.json({ message: 'If that email exists, a reset link was sent.' });
    if (!user.password_hash) return res.json({ message: 'If that email exists, a reset link was sent.' }); // OAuth user

    // Invalidate previous tokens
    await execute("DELETE FROM password_reset_tokens WHERE user_id = ?", [user.id]);

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
    await execute(
      'INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',
      [uuidv4(), user.id, crypto.createHash('sha256').update(token).digest('hex'), expiresAt]
    );

    const resetUrl = `${APP_URL}/reset-password/${token}`;
    await sendPasswordResetEmail({ to: user.email, resetUrl });

    res.json({ message: 'If that email exists, a reset link was sent.' });
  } catch (err) {
    console.error('[ForgotPassword]', err.message);
    res.status(500).json({ error: 'Failed to send reset email' });
  }
});

// POST /api/auth/reset-password — set new password using token
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Token and password required' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      return res.status(400).json({ error: 'Password must contain at least one uppercase letter and one number' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const record = await queryOne(
      "SELECT * FROM password_reset_tokens WHERE token_hash = ? AND expires_at > NOW() AND used_at IS NULL",
      [tokenHash]
    );
    if (!record) return res.status(400).json({ error: 'Invalid or expired reset link' });

    const passwordHash = await hash(password);
    await execute('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, record.user_id]);
    await execute('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?', [record.id]);
    // Revoke all refresh tokens for security
    await execute('DELETE FROM refresh_tokens WHERE user_id = ?', [record.user_id]);

    res.json({ message: 'Password updated. Please log in.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// POST /api/auth/verify-email — verify email address
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token required' });

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const record = await queryOne(
      "SELECT * FROM email_verification_tokens WHERE token_hash = ? AND expires_at > NOW() AND used_at IS NULL",
      [tokenHash]
    );
    if (!record) return res.status(400).json({ error: 'Invalid or expired verification link' });

    await execute('UPDATE users SET email_verified = 1 WHERE id = ?', [record.user_id]);
    await execute('UPDATE email_verification_tokens SET used_at = NOW() WHERE id = ?', [record.id]);

    // Return a fresh access token with email_verified: true so the client updates immediately
    const user = await queryOne('SELECT id, name, email, role, avatar_url FROM users WHERE id = ?', [record.user_id]);
    const accessToken = signAccess({
      id: user.id, email: user.email, role: user.role, name: user.name, email_verified: true,
    });
    res.json({ message: 'Email verified.', accessToken, user });
  } catch (err) {
    res.status(500).json({ error: 'Verification failed' });
  }
});

// DELETE /api/account — delete own account (GDPR right to erasure)
router.delete('/account', authenticate, async (req, res) => {
  try {
    const { confirm } = req.body;
    if (confirm !== 'DELETE') return res.status(400).json({ error: 'Send { confirm: "DELETE" } to confirm' });

    const userId = req.user.id;

    // Anonymise activity log (keep for audit, remove PII)
    await execute("UPDATE activity_log SET user_id = NULL WHERE user_id = ?", [userId]);
    // Delete the user — cascade handles tokens, notifications, memberships
    await execute('DELETE FROM users WHERE id = ?', [userId]);

    res.clearCookie('refreshToken');
    res.json({ message: 'Account deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

// GET /api/account/data-export — GDPR data export
router.get('/account/data-export', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const [user, tasks, comments, notifications] = await Promise.all([
      queryOne('SELECT id, name, email, role, timezone, created_at FROM users WHERE id = ?', [userId]),
      require('../config/db').queryAll(
        'SELECT t.title, t.description, t.status, t.priority, t.deadline, t.created_at FROM tasks t WHERE t.created_by = ? OR t.assignee_id = ?',
        [userId, userId]
      ),
      require('../config/db').queryAll(
        'SELECT c.content, c.created_at FROM comments c WHERE c.user_id = ?',
        [userId]
      ),
      require('../config/db').queryAll(
        'SELECT n.message, n.type, n.created_at FROM notifications n WHERE n.user_id = ?',
        [userId]
      ),
    ]);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="my-taskflow-data.json"');
    res.json({
      exported_at: new Date().toISOString(),
      profile: user,
      tasks,
      comments,
      notifications,
    });
  } catch (err) {
    res.status(500).json({ error: 'Export failed' });
  }
});

module.exports = router;
