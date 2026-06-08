const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { queryOne, queryAll, execute } = require('../config/db');
const { hash, compare } = require('../utils/password');
const { authenticate, requireMinRole, hasMinRole } = require('../middleware/auth');

const ASSIGNABLE_ROLES = ['super_admin', 'admin', 'project_manager', 'member', 'viewer'];

const router = express.Router();
router.use(authenticate);

// GET /api/users
router.get('/', requireMinRole('admin'), async (req, res) => {
  try {
    const users = await queryAll(
      'SELECT id, name, email, role, avatar_url, timezone, is_active, created_at FROM users ORDER BY name'
    );
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// POST /api/users
router.post('/', requireMinRole('admin'), async (req, res) => {
  try {
    const { name, email, password, role = 'member', timezone = 'UTC' } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'name, email, password required' });
    if (role === 'super_admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only super_admin can assign the super_admin role' });
    }
    if (!ASSIGNABLE_ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role' });

    const existing = await queryOne('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) return res.status(409).json({ error: 'Email already in use' });

    const id = uuidv4();
    const password_hash = await hash(password);
    await execute(
      'INSERT INTO users (id, name, email, password_hash, role, timezone) VALUES (?, ?, ?, ?, ?, ?)',
      [id, name, email, password_hash, role, timezone]
    );
    res.status(201).json({ id, name, email, role, timezone });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// GET /api/users/:id
router.get('/:id', async (req, res) => {
  try {
    const user = await queryOne(
      'SELECT id, name, email, role, avatar_url, timezone, is_active, created_at FROM users WHERE id = ?',
      [req.params.id]
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// PATCH /api/users/:id
router.patch('/:id', async (req, res) => {
  try {
    const isAdmin = hasMinRole(req.user.role, 'admin');
    if (!isAdmin && req.user.id !== req.params.id) return res.status(403).json({ error: 'Forbidden' });

    const user = await queryOne('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { name, avatar_url, timezone, is_active, role } = req.body;
    if (role !== undefined) {
      if (!isAdmin) return res.status(403).json({ error: 'Only admins can change roles' });
      if (!ASSIGNABLE_ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role' });
      if (role === 'super_admin' && req.user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Only super_admin can assign the super_admin role' });
      }
    }

    const sets = [];
    const vals = [];
    if (name !== undefined)       { sets.push('name = ?');       vals.push(name); }
    if (avatar_url !== undefined)  { sets.push('avatar_url = ?');  vals.push(avatar_url); }
    if (timezone !== undefined)    { sets.push('timezone = ?');    vals.push(timezone); }
    if (is_active !== undefined)   { sets.push('is_active = ?');   vals.push(is_active); }
    if (role !== undefined)        { sets.push('role = ?');        vals.push(role); }

    if (sets.length) {
      vals.push(req.params.id);
      await execute(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, vals);
    }

    res.json({ message: 'Updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// PATCH /api/users/:id/password — admin can set anyone's; self-service requires currentPassword
router.patch('/:id/password', async (req, res) => {
  try {
    const isSelf = req.params.id === req.user.id;
    const isAdmin = hasMinRole(req.user.role, 'admin');
    if (!isSelf && !isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const { password, currentPassword } = req.body;
    if (!password) return res.status(400).json({ error: 'password required' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      return res.status(400).json({ error: 'Password must contain at least one uppercase letter and one number' });
    }

    if (isSelf && !isAdmin) {
      if (!currentPassword) return res.status(400).json({ error: 'currentPassword required' });
      const user = await queryOne('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
      const valid = user?.password_hash && await compare(currentPassword, user.password_hash);
      if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const password_hash = await hash(password);
    await execute('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash, req.params.id]);
    await execute('DELETE FROM refresh_tokens WHERE user_id = ?', [req.params.id]);
    res.json({ message: 'Password updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update password' });
  }
});

// GET /api/users/me/tasks — tasks assigned to current user across all projects
router.get('/me/tasks', async (req, res) => {
  try {
    const { status, limit = 50 } = req.query;
    const conditions = ['t.assignee_id = ?', 'pm.user_id = ?'];
    const params = [req.user.id, req.user.id];

    if (status) {
      conditions.push('t.status = ?');
      params.push(status);
    } else {
      conditions.push("t.status != 'done'");
    }

    const tasks = await queryAll(`
      SELECT t.*, p.name as project_name, p.color as project_color,
             u.name as assignee_name
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      JOIN project_members pm ON pm.project_id = p.id
      LEFT JOIN users u ON u.id = t.assignee_id
      WHERE ${conditions.join(' AND ')}
        AND t.parent_task_id IS NULL
      ORDER BY
        CASE WHEN t.deadline IS NOT NULL AND t.deadline::date < CURRENT_DATE THEN 0 ELSE 1 END,
        t.deadline ASC NULLS LAST,
        t.created_at DESC
      LIMIT ?
    `, [...params, parseInt(limit, 10)]);

    const overdue = tasks.filter((t) => t.deadline && new Date(t.deadline) < new Date(new Date().toDateString()));
    res.json({ tasks, overdue_count: overdue.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch my tasks' });
  }
});

module.exports = router;
