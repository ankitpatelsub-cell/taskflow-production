const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { queryOne, queryAll, execute } = require('../config/db');
const { authenticate, requireMinRole, requireProjectAccess, requireProjectManage } = require('../middleware/auth');
const { logActivity } = require('../services/notificationService');
// req.log (pino-http) used for request-scoped logging

const PLAN_LIMITS = {
  free: { projects: 3, members: 5 },
  pro:  { projects: 10, members: 25 },
  team: { projects: Infinity, members: Infinity },
};

const router = express.Router();
router.use(authenticate);

// GET /api/projects
// Optional query param: workspace_id — scopes results to that workspace (caller must be a member)
router.get('/', async (req, res) => {
  try {
    const { workspace_id } = req.query;
    let projects;

    if (workspace_id) {
      // Verify caller is a workspace member
      const isMember = await queryOne(
        'SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
        [workspace_id, req.user.id]
      );
      if (!isMember && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Not a workspace member' });
      }
      projects = await queryAll(`
        SELECT p.*, u.name as creator_name,
          (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND parent_task_id IS NULL) as task_count,
          (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND parent_task_id IS NULL AND status = 'done') as done_count,
          (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as member_count
        FROM projects p JOIN users u ON p.created_by = u.id
        WHERE p.workspace_id = ?
        ORDER BY p.created_at DESC
      `, [workspace_id]);
    } else if (req.user.role === 'admin' || req.user.role === 'super_admin') {
      projects = await queryAll(`
        SELECT p.*, u.name as creator_name,
          (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND parent_task_id IS NULL) as task_count,
          (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND parent_task_id IS NULL AND status = 'done') as done_count,
          (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as member_count
        FROM projects p JOIN users u ON p.created_by = u.id
        ORDER BY p.created_at DESC
      `);
    } else {
      projects = await queryAll(`
        SELECT p.*, u.name as creator_name,
          (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND parent_task_id IS NULL) as task_count,
          (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND parent_task_id IS NULL AND status = 'done') as done_count,
          (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as member_count
        FROM projects p
        JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
        JOIN users u ON p.created_by = u.id
        ORDER BY p.created_at DESC
      `, [req.user.id]);
    }
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// POST /api/projects
// workspace_id is required. Caller must be a workspace admin/owner (or global admin).
router.post('/', async (req, res) => {
  try {
    const { name, description, color = '#6366f1', workspace_id } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    if (!workspace_id) return res.status(400).json({ error: 'workspace_id required' });

    // Verify caller has admin/owner role in the workspace (or is global admin)
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      const wsMember = await queryOne(
        'SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
        [workspace_id, req.user.id]
      );
      if (!wsMember) return res.status(403).json({ error: 'Not a workspace member' });
      if (wsMember.role === 'member') return res.status(403).json({ error: 'Workspace admin access required to create projects' });
    }

    // Plan limit check
    const sub = await queryOne('SELECT plan FROM subscriptions ORDER BY created_at DESC LIMIT 1');
    const plan = sub?.plan || 'free';
    const planLimit = (PLAN_LIMITS[plan] || PLAN_LIMITS.free).projects;
    if (planLimit !== Infinity) {
      const countRow = await queryOne("SELECT COUNT(*) as c FROM projects WHERE workspace_id = ? AND status = 'active'", [workspace_id]);
      if (parseInt(countRow.c, 10) >= planLimit) {
        return res.status(402).json({
          error: `${plan.charAt(0).toUpperCase() + plan.slice(1)} plan allows up to ${planLimit} active projects per workspace. Upgrade to create more.`,
          code: 'PLAN_LIMIT_REACHED',
        });
      }
    }

    const id = uuidv4();
    await execute(
      'INSERT INTO projects (id, name, description, color, created_by, workspace_id) VALUES (?, ?, ?, ?, ?, ?)',
      [id, name, description || null, color, req.user.id, workspace_id]
    );
    await execute(
      'INSERT INTO project_members (id, project_id, user_id) VALUES (?, ?, ?)',
      [uuidv4(), id, req.user.id]
    );
    await logActivity('project', id, req.user.id, 'created', null, { name });
    req.log.info({ projectId: id, name, userId: req.user.id, workspace_id }, 'project.created');
    res.status(201).json({ id, name, description, color, workspace_id });
  } catch (err) {
    req.log.error({ userId: req.user.id, err: err.message }, 'project.create_failed');
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// GET /api/projects/:projectId
router.get('/:projectId', requireProjectAccess, async (req, res) => {
  try {
    const project = await queryOne('SELECT * FROM projects WHERE id = ?', [req.params.projectId]);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const members = await queryAll(`
      SELECT u.id, u.name, u.email, u.avatar_url, u.role, pm.joined_at
      FROM project_members pm JOIN users u ON u.id = pm.user_id
      WHERE pm.project_id = ?
    `, [req.params.projectId]);
    res.json({ ...project, members });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// POST /api/projects/:projectId/slack-test
router.post('/:projectId/slack-test', requireProjectManage, async (req, res) => {
  try {
    const proj = await queryOne('SELECT slack_webhook_url FROM projects WHERE id = ?', [req.params.projectId]);
    if (!proj?.slack_webhook_url) return res.status(400).json({ error: 'No Slack webhook URL configured' });
    const https = require('https');
    const url = new URL(proj.slack_webhook_url);
    const body = JSON.stringify({ text: ':white_check_mark: Tick is connected to this Slack channel!' });
    await new Promise((resolve, reject) => {
      const r = https.request({ hostname: url.hostname, path: url.pathname + url.search, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, (resp) => {
        let d = ''; resp.on('data', (c) => d += c); resp.on('end', () => resp.statusCode < 300 ? resolve(d) : reject(new Error(`Slack returned ${resp.statusCode}`)));
      });
      r.on('error', reject); r.write(body); r.end();
    });
    res.json({ message: 'Test message sent' });
  } catch (err) {
    req.log.error({ err: err.message, projectId: req.params.projectId }, 'slack.test.failed');
    res.status(502).json({ error: err.message || 'Slack test failed' });
  }
});

// PATCH /api/projects/:projectId
router.patch('/:projectId', requireProjectManage, async (req, res) => {
  try {
    const { name, description, color, status, slack_webhook_url } = req.body;
    const sets = ['updated_at = NOW()'];
    const vals = [];
    if (name !== undefined)              { sets.push('name = ?');              vals.push(name); }
    if (description !== undefined)       { sets.push('description = ?');       vals.push(description); }
    if (color !== undefined)             { sets.push('color = ?');             vals.push(color); }
    if (status !== undefined)            { sets.push('status = ?');            vals.push(status); }
    if (slack_webhook_url !== undefined) { sets.push('slack_webhook_url = ?'); vals.push(slack_webhook_url); }
    vals.push(req.params.projectId);
    await execute(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`, vals);
    req.log.info({ projectId: req.params.projectId, userId: req.user.id, fields: Object.keys(req.body) }, 'project.updated');
    res.json({ message: 'Updated' });
  } catch (err) {
    req.log.error({ projectId: req.params.projectId, userId: req.user.id, err: err.message }, 'project.update_failed');
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// DELETE /api/projects/:projectId (archives it)
router.delete('/:projectId', requireProjectManage, async (req, res) => {
  try {
    await execute(
      "UPDATE projects SET status = 'archived', updated_at = NOW() WHERE id = ?",
      [req.params.projectId]
    );
    req.log.info({ projectId: req.params.projectId, userId: req.user.id }, 'project.archived');
    res.json({ message: 'Archived' });
  } catch (err) {
    req.log.error({ projectId: req.params.projectId, userId: req.user.id, err: err.message }, 'project.archive_failed');
    res.status(500).json({ error: 'Failed to archive project' });
  }
});

// POST /api/projects/:projectId/members
router.post('/:projectId/members', requireProjectManage, async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const existing = await queryOne(
      'SELECT id FROM project_members WHERE project_id = ? AND user_id = ?',
      [req.params.projectId, userId]
    );
    if (existing) return res.status(409).json({ error: 'Already a member' });
    await execute(
      'INSERT INTO project_members (id, project_id, user_id) VALUES (?, ?, ?)',
      [uuidv4(), req.params.projectId, userId]
    );
    req.log.info({ projectId: req.params.projectId, addedUserId: userId, byUserId: req.user.id }, 'project.member_added');
    res.status(201).json({ message: 'Member added' });
  } catch (err) {
    req.log.error({ projectId: req.params.projectId, userId: req.user.id, err: err.message }, 'project.member_add_failed');
    res.status(500).json({ error: 'Failed to add member' });
  }
});

// DELETE /api/projects/:projectId/members/:userId
router.delete('/:projectId/members/:userId', requireProjectManage, async (req, res) => {
  try {
    await execute(
      'DELETE FROM project_members WHERE project_id = ? AND user_id = ?',
      [req.params.projectId, req.params.userId]
    );
    req.log.info({ projectId: req.params.projectId, removedUserId: req.params.userId, byUserId: req.user.id }, 'project.member_removed');
    res.json({ message: 'Member removed' });
  } catch (err) {
    req.log.error({ projectId: req.params.projectId, userId: req.user.id, err: err.message }, 'project.member_remove_failed');
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// GET /api/projects/:projectId/time-report — aggregate time per task and per user
// Accepts optional query params: from=YYYY-MM-DD and to=YYYY-MM-DD to filter by started_at
router.get('/:projectId/time-report', requireProjectAccess, async (req, res) => {
  try {
    const { from, to } = req.query;

    // Build optional date-range filter fragments for time_logs.started_at
    const dateConditions = [];
    const dateParams = [];
    if (from) {
      dateConditions.push('tl.logged_at >= ?');
      dateParams.push(from);
    }
    if (to) {
      // Include the full "to" day by going up to end-of-day
      dateConditions.push('tl.logged_at <= ?');
      dateParams.push(`${to} 23:59:59`);
    }
    const dateFilter = dateConditions.length > 0
      ? 'AND ' + dateConditions.join(' AND ')
      : '';

    const byTask = await queryAll(`
      SELECT t.id, t.title, t.status,
             COALESCE(SUM(tl.duration_minutes), 0) AS total_minutes
      FROM tasks t
      LEFT JOIN time_logs tl ON tl.task_id = t.id ${dateFilter}
      WHERE t.project_id = ?
      GROUP BY t.id, t.title, t.status
      ORDER BY total_minutes DESC
    `, [...dateParams, req.params.projectId]);

    const byUser = await queryAll(`
      SELECT u.id, u.name, u.avatar_url,
             COALESCE(SUM(tl.duration_minutes), 0) AS total_minutes,
             COUNT(DISTINCT CASE WHEN tl.id IS NOT NULL THEN tl.task_id END) AS task_count
      FROM project_members pm
      JOIN users u ON u.id = pm.user_id
      LEFT JOIN time_logs tl ON tl.user_id = u.id
        AND tl.task_id IN (SELECT id FROM tasks WHERE project_id = ?)
        ${dateFilter}
      WHERE pm.project_id = ?
      GROUP BY u.id, u.name, u.avatar_url
      ORDER BY total_minutes DESC
    `, [req.params.projectId, ...dateParams, req.params.projectId]);

    res.json({ byTask, byUser });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch time report' });
  }
});

module.exports = router;
