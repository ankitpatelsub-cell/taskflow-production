const express = require('express');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { queryOne, execute } = require('../config/db');
const { authenticate, requireProjectAccess, requireProjectManage } = require('../middleware/auth');
const { hash } = require('../utils/password');
const { signAccess, signRefresh } = require('../utils/jwt');
const { sendInviteEmail } = require('../services/emailService');
const { APP_URL } = require('../config/env');

const router = express.Router();

// POST /api/invitations — send invite (project manager+)
router.post('/', authenticate, async (req, res) => {
  try {
    const { email, projectId, role = 'member' } = req.body;
    if (!email || !projectId) return res.status(400).json({ error: 'email and projectId required' });

    // Invitations may only grant project-level roles, never global system roles
    const INVITABLE_ROLES = ['member', 'viewer'];
    if (!INVITABLE_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Invalid role; invitations can only grant member or viewer' });
    }

    const isAdminOrAbove = ['admin', 'super_admin'].includes(req.user.role);

    // Require project_manager or above — plain members cannot send invites
    if (!isAdminOrAbove && req.user.role !== 'project_manager') {
      return res.status(403).json({ error: 'Project manager or admin required to send invitations' });
    }
    const member = await queryOne(
      'SELECT id FROM project_members WHERE project_id = ? AND user_id = ?',
      [projectId, req.user.id]
    );
    if (!member && !isAdminOrAbove) return res.status(403).json({ error: 'Not a member of this project' });

    const project = await queryOne('SELECT * FROM projects WHERE id = ?', [projectId]);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    // Invalidate existing pending invites for same email+project
    await execute(
      'UPDATE invite_tokens SET used_at = NOW() WHERE email = ? AND project_id = ? AND used_at IS NULL',
      [email.toLowerCase(), projectId]
    );

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const id = uuidv4();

    await execute(
      'INSERT INTO invite_tokens (id, email, token, project_id, invited_by, role, expires_at) VALUES (?,?,?,?,?,?,?)',
      [id, email.toLowerCase(), token, projectId, req.user.id, role, expiresAt]
    );

    const acceptUrl = `${APP_URL}/invite/${token}`;
    await sendInviteEmail({
      to: email,
      inviterName: req.user.name,
      projectName: project.name,
      acceptUrl,
    });

    res.status(201).json({ message: 'Invitation sent', expiresAt });
  } catch (err) {
    console.error('[Invite]', err.message);
    res.status(500).json({ error: 'Failed to send invitation' });
  }
});

// GET /api/invitations/:token — validate invite token (public)
router.get('/:token', async (req, res) => {
  try {
    const invite = await queryOne(`
      SELECT it.*, p.name as project_name, u.name as inviter_name
      FROM invite_tokens it
      JOIN projects p ON p.id = it.project_id
      JOIN users u ON u.id = it.invited_by
      WHERE it.token = ? AND it.used_at IS NULL AND it.expires_at > NOW()
    `, [req.params.token]);

    if (!invite) return res.status(404).json({ error: 'Invitation not found or expired' });
    res.json({
      email: invite.email,
      projectName: invite.project_name,
      inviterName: invite.inviter_name,
      role: invite.role,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to validate invitation' });
  }
});

// POST /api/invitations/:token/accept — accept invite (create account or login)
router.post('/:token/accept', async (req, res) => {
  try {
    const invite = await queryOne(`
      SELECT * FROM invite_tokens
      WHERE token = ? AND used_at IS NULL AND expires_at > NOW()
    `, [req.params.token]);

    if (!invite) return res.status(404).json({ error: 'Invitation not found or expired' });

    const { name, password } = req.body;
    let user = await queryOne('SELECT * FROM users WHERE email = ?', [invite.email]);

    if (!user) {
      if (!name || !password) return res.status(400).json({ error: 'name and password required for new account' });
      if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

      const id = uuidv4();
      const passwordHash = await hash(password);
      await execute(
        `INSERT INTO users (id, name, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?, 1)`,
        [id, name.trim(), invite.email, passwordHash, invite.role || 'member']
      );
      user = await queryOne('SELECT * FROM users WHERE id = ?', [id]);
    }

    // Add to project if not already a member
    const existing = await queryOne(
      'SELECT id FROM project_members WHERE project_id = ? AND user_id = ?',
      [invite.project_id, user.id]
    );
    if (!existing) {
      await execute(
        'INSERT INTO project_members (id, project_id, user_id) VALUES (?, ?, ?)',
        [uuidv4(), invite.project_id, user.id]
      );
    }

    // Mark invite as used
    await execute('UPDATE invite_tokens SET used_at = NOW() WHERE id = ?', [invite.id]);

    // Issue tokens
    const accessToken = signAccess({ id: user.id, email: user.email, role: user.role, name: user.name });
    const refreshToken = signRefresh({ id: user.id });
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const crypto2 = require('crypto');
    const tokenHash = crypto2.createHash('sha256').update(refreshToken).digest('hex');
    await execute(
      'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',
      [uuidv4(), user.id, tokenHash, expiresAt]
    );

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true, sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      secure: process.env.NODE_ENV === 'production',
    });

    res.json({
      accessToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      projectId: invite.project_id,
    });
  } catch (err) {
    console.error('[Invite Accept]', err.message);
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
});

module.exports = router;
