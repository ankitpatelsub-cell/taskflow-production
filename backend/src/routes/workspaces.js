'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { queryOne, queryAll, execute } = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// ── Helpers ───────────────────────────────────────────────────────────────────

async function requireWorkspaceMember(req, res) {
  const row = await queryOne(
    'SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
    [req.params.workspaceId, req.user.id]
  );
  if (!row) { res.status(403).json({ error: 'Not a workspace member' }); return null; }
  return row.role;
}

async function requireWorkspaceAdmin(req, res) {
  const role = await requireWorkspaceMember(req, res);
  if (!role) return null;
  if (role === 'member') { res.status(403).json({ error: 'Workspace admin access required' }); return null; }
  return role;
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'workspace';
}

// ── GET /api/workspaces — list all workspaces the caller belongs to ───────────
router.get('/', async (req, res) => {
  try {
    const workspaces = await queryAll(`
      SELECT w.*, wm.role AS member_role,
        (SELECT COUNT(*) FROM workspace_members WHERE workspace_id = w.id) AS member_count,
        (SELECT COUNT(*) FROM projects WHERE workspace_id = w.id) AS project_count
      FROM workspaces w
      JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = ?
      ORDER BY w.created_at
    `, [req.user.id]);
    res.json(workspaces);
  } catch (err) {
    req.log?.error({ err: err.message }, 'workspaces.list_failed');
    res.status(500).json({ error: 'Failed to fetch workspaces' });
  }
});

// ── POST /api/workspaces — create a new workspace ─────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

    const id = uuidv4();
    const base = slugify(name.trim());
    let slug = base;
    let n = 1;
    while (await queryOne('SELECT 1 FROM workspaces WHERE slug = ?', [slug])) {
      slug = `${base}-${n++}`;
    }

    await execute(
      'INSERT INTO workspaces (id, name, slug, owner_id) VALUES (?, ?, ?, ?)',
      [id, name.trim(), slug, req.user.id]
    );
    await execute(
      'INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)',
      [id, req.user.id, 'owner']
    );

    const workspace = await queryOne('SELECT * FROM workspaces WHERE id = ?', [id]);
    res.status(201).json({ ...workspace, member_role: 'owner', member_count: 1, project_count: 0 });
  } catch (err) {
    req.log?.error({ err: err.message }, 'workspaces.create_failed');
    res.status(500).json({ error: 'Failed to create workspace' });
  }
});

// ── GET /api/workspaces/:workspaceId ─────────────────────────────────────────
router.get('/:workspaceId', async (req, res) => {
  try {
    const role = await requireWorkspaceMember(req, res);
    if (!role) return;

    const workspace = await queryOne('SELECT * FROM workspaces WHERE id = ?', [req.params.workspaceId]);
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

    const members = await queryAll(`
      SELECT u.id, u.name, u.email, u.avatar_url, wm.role, wm.joined_at
      FROM workspace_members wm
      JOIN users u ON u.id = wm.user_id
      WHERE wm.workspace_id = ?
      ORDER BY wm.joined_at
    `, [req.params.workspaceId]);

    res.json({ ...workspace, members, member_role: role });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch workspace' });
  }
});

// ── PATCH /api/workspaces/:workspaceId ───────────────────────────────────────
router.patch('/:workspaceId', async (req, res) => {
  try {
    const role = await requireWorkspaceAdmin(req, res);
    if (!role) return;

    const { name, logo_url } = req.body;
    const sets = ['updated_at = NOW()'];
    const vals = [];
    if (name !== undefined)     { sets.push('name = ?');     vals.push(name); }
    if (logo_url !== undefined) { sets.push('logo_url = ?'); vals.push(logo_url); }
    if (vals.length === 0) return res.status(400).json({ error: 'Nothing to update' });
    vals.push(req.params.workspaceId);
    await execute(`UPDATE workspaces SET ${sets.join(', ')} WHERE id = ?`, vals);
    res.json({ message: 'Updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update workspace' });
  }
});

// ── GET /api/workspaces/:workspaceId/members ──────────────────────────────────
router.get('/:workspaceId/members', async (req, res) => {
  try {
    const role = await requireWorkspaceMember(req, res);
    if (!role) return;
    const members = await queryAll(`
      SELECT u.id, u.name, u.email, u.avatar_url, wm.role, wm.joined_at
      FROM workspace_members wm JOIN users u ON u.id = wm.user_id
      WHERE wm.workspace_id = ? ORDER BY wm.joined_at
    `, [req.params.workspaceId]);
    res.json(members);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// ── POST /api/workspaces/:workspaceId/members — add member by email ───────────
router.post('/:workspaceId/members', async (req, res) => {
  try {
    const role = await requireWorkspaceAdmin(req, res);
    if (!role) return;

    const { email, role: memberRole = 'member' } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });
    if (!['admin', 'member'].includes(memberRole)) {
      return res.status(400).json({ error: 'role must be admin or member' });
    }

    const user = await queryOne('SELECT id, name, email FROM users WHERE email = ?', [email.toLowerCase()]);
    if (!user) return res.status(404).json({ error: 'User not found. They must register first.' });

    const existing = await queryOne(
      'SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
      [req.params.workspaceId, user.id]
    );
    if (existing) return res.status(409).json({ error: 'User is already a workspace member' });

    await execute(
      'INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)',
      [req.params.workspaceId, user.id, memberRole]
    );
    res.status(201).json({ message: 'Member added', user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add member' });
  }
});

// ── PATCH /api/workspaces/:workspaceId/members/:userId — change role ──────────
router.patch('/:workspaceId/members/:userId', async (req, res) => {
  try {
    const myRole = await requireWorkspaceAdmin(req, res);
    if (!myRole) return;

    const { role } = req.body;
    if (!['admin', 'member'].includes(role)) {
      return res.status(400).json({ error: 'role must be admin or member' });
    }
    const target = await queryOne(
      'SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
      [req.params.workspaceId, req.params.userId]
    );
    if (!target) return res.status(404).json({ error: 'Member not found' });
    if (target.role === 'owner') return res.status(403).json({ error: 'Cannot change owner role' });

    await execute(
      'UPDATE workspace_members SET role = ? WHERE workspace_id = ? AND user_id = ?',
      [role, req.params.workspaceId, req.params.userId]
    );
    res.json({ message: 'Role updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update member role' });
  }
});

// ── DELETE /api/workspaces/:workspaceId/members/:userId — remove member ───────
router.delete('/:workspaceId/members/:userId', async (req, res) => {
  try {
    const myRole = await requireWorkspaceAdmin(req, res);
    if (!myRole) return;

    const target = await queryOne(
      'SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
      [req.params.workspaceId, req.params.userId]
    );
    if (!target) return res.status(404).json({ error: 'Member not found' });
    if (target.role === 'owner') return res.status(403).json({ error: 'Cannot remove workspace owner' });
    if (req.params.userId === req.user.id) return res.status(400).json({ error: 'Leave via the leave endpoint' });

    await execute(
      'DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
      [req.params.workspaceId, req.params.userId]
    );
    res.json({ message: 'Member removed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// ── DELETE /api/workspaces/:workspaceId — delete workspace (owner only) ───────
router.delete('/:workspaceId', async (req, res) => {
  try {
    const workspace = await queryOne(
      'SELECT owner_id FROM workspaces WHERE id = ?',
      [req.params.workspaceId]
    );
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });
    if (workspace.owner_id !== req.user.id && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only the workspace owner can delete it' });
    }
    await execute('DELETE FROM workspaces WHERE id = ?', [req.params.workspaceId]);
    res.json({ message: 'Workspace deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete workspace' });
  }
});

module.exports = router;
