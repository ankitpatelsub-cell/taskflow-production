'use strict';

const express = require('express');
const crypto = require('crypto');
const { queryOne, queryAll, execute } = require('../config/db');
const { authenticate, requireProjectAccess, requireProjectManage } = require('../middleware/auth');
const { APP_URL } = require('../config/env');

// ── Public share router — mounted at /share by the top-level app ──────────────
const publicShareRouter = express.Router();

// GET /share/:token — no auth required
publicShareRouter.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const project = await queryOne(
      'SELECT id, name, color FROM projects WHERE share_token = ? AND share_enabled = TRUE',
      [token]
    );
    if (!project) {
      return res.status(404).json({ error: 'Share link not found or sharing has been disabled' });
    }

    const [tasks, memberCount] = await Promise.all([
      queryAll(
        `SELECT t.title, t.status, t.priority, t.deadline,
                u.name AS assignee_name
         FROM tasks t
         LEFT JOIN users u ON u.id = t.assignee_id
         WHERE t.project_id = ? AND t.parent_task_id IS NULL
         ORDER BY t.priority DESC, t.deadline ASC NULLS LAST`,
        [project.id]
      ),
      queryOne(
        'SELECT COUNT(*) AS cnt FROM project_members WHERE project_id = ?',
        [project.id]
      ),
    ]);

    // Attach tags for each task (no user IDs or emails exposed)
    const tagRows = await Promise.all(
      tasks.map((t) =>
        queryAll(
          `SELECT tg.name, tg.color
           FROM task_tags tt
           JOIN tags tg ON tg.id = tt.tag_id
           WHERE tt.task_id = ?`,
          [t.id]
        )
      )
    );
    tasks.forEach((t, i) => {
      t.tags = tagRows[i];
    });

    req.log
      ? req.log.info({ token, projectId: project.id }, 'share.public_view')
      : undefined;

    return res.json({
      name: project.name,
      color: project.color,
      members_count: parseInt(memberCount.cnt, 10),
      tasks,
    });
  } catch (err) {
    const log = req.log || console;
    log.error({ token: req.params.token, err: err.message }, 'share.public_view_failed');
    return res.status(500).json({ error: 'Failed to load shared project' });
  }
});

// ── API share router — nested under /api/projects/:projectId/share ────────────
const shareApiRouter = express.Router({ mergeParams: true });
shareApiRouter.use(authenticate);

// POST /api/projects/:projectId/share — generate / enable share link
shareApiRouter.post(
  '/',
  requireProjectAccess,
  requireProjectManage,
  async (req, res) => {
    try {
      const { projectId } = req.params;

      // Fetch current token (may already exist)
      const project = await queryOne(
        'SELECT share_token FROM projects WHERE id = ?',
        [projectId]
      );
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      let token = project.share_token;
      if (!token) {
        token = crypto.randomBytes(24).toString('hex');
      }

      await execute(
        'UPDATE projects SET share_token = ?, share_enabled = TRUE, updated_at = NOW() WHERE id = ?',
        [token, projectId]
      );

      req.log.info({ projectId, userId: req.user.id }, 'share.enabled');

      return res.json({
        token,
        url: `/share/${token}`,
      });
    } catch (err) {
      req.log.error({ projectId: req.params.projectId, userId: req.user.id, err: err.message }, 'share.enable_failed');
      return res.status(500).json({ error: 'Failed to create share link' });
    }
  }
);

// DELETE /api/projects/:projectId/share — disable sharing
shareApiRouter.delete(
  '/',
  requireProjectAccess,
  requireProjectManage,
  async (req, res) => {
    try {
      const { projectId } = req.params;

      await execute(
        'UPDATE projects SET share_enabled = FALSE, updated_at = NOW() WHERE id = ?',
        [projectId]
      );

      req.log.info({ projectId, userId: req.user.id }, 'share.disabled');

      return res.json({ message: 'Sharing disabled' });
    } catch (err) {
      req.log.error({ projectId: req.params.projectId, userId: req.user.id, err: err.message }, 'share.disable_failed');
      return res.status(500).json({ error: 'Failed to disable sharing' });
    }
  }
);

module.exports = { shareApiRouter, publicShareRouter };
