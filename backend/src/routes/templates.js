const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { queryOne, queryAll, execute } = require('../config/db');
const { authenticate, requireProjectAccess } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/templates — list all templates (built-in + user's own)
router.get('/', async (req, res) => {
  try {
    const templates = await queryAll(`
      SELECT pt.*,
        (SELECT COUNT(*) FROM template_tasks WHERE template_id = pt.id) AS task_count,
        u.name AS creator_name
      FROM project_templates pt
      LEFT JOIN users u ON u.id = pt.created_by
      WHERE pt.is_builtin = true OR pt.created_by = $1
      ORDER BY pt.is_builtin DESC, pt.created_at DESC
    `, [req.user.id]);
    res.json(templates);
  } catch (err) {
    req.log?.error({ err: err.message }, 'templates.list_failed');
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// GET /api/templates/:templateId — get template with tasks
router.get('/:templateId', async (req, res) => {
  try {
    const template = await queryOne(
      'SELECT * FROM project_templates WHERE id = $1 AND (is_builtin = true OR created_by = $2)',
      [req.params.templateId, req.user.id]
    );
    if (!template) return res.status(404).json({ error: 'Template not found' });
    const tasks = await queryAll(
      'SELECT * FROM template_tasks WHERE template_id = $1 ORDER BY position',
      [req.params.templateId]
    );
    res.json({ ...template, tasks });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

// POST /api/templates — save current project as a template
router.post('/', async (req, res) => {
  try {
    const { name, description, category = 'general', color = '#6366f1', project_id } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });

    const id = uuidv4();
    await execute(
      `INSERT INTO project_templates (id, name, description, category, color, is_builtin, created_by)
       VALUES ($1, $2, $3, $4, $5, false, $6)`,
      [id, name, description || null, category, color, req.user.id]
    );

    // If project_id provided, copy its tasks as template tasks
    if (project_id) {
      const tasks = await queryAll(
        `SELECT title, description, status, priority, position, estimated_hours
         FROM tasks WHERE project_id = $1 AND parent_task_id IS NULL ORDER BY position LIMIT 50`,
        [project_id]
      );
      for (const t of tasks) {
        await execute(
          `INSERT INTO template_tasks (id, template_id, title, description, status, priority, position, estimated_hours)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [uuidv4(), id, t.title, t.description || null, t.status, t.priority, t.position, t.estimated_hours || null]
        );
      }
    }

    res.status(201).json({ id, name, description, category, color });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// POST /api/templates/:templateId/apply — create a project from this template
router.post('/:templateId/apply', async (req, res) => {
  try {
    const { project_id, start_date } = req.body;
    if (!project_id) return res.status(400).json({ error: 'project_id required' });

    const template = await queryOne(
      'SELECT * FROM project_templates WHERE id = $1 AND (is_builtin = true OR created_by = $2)',
      [req.params.templateId, req.user.id]
    );
    if (!template) return res.status(404).json({ error: 'Template not found' });

    const tasks = await queryAll(
      'SELECT * FROM template_tasks WHERE template_id = $1 ORDER BY position',
      [req.params.templateId]
    );

    const base = start_date ? new Date(start_date) : new Date();
    let pos = 0;
    for (const t of tasks) {
      const deadline = t.offset_days
        ? new Date(base.getTime() + t.offset_days * 86400000).toISOString().slice(0, 10)
        : null;
      await execute(
        `INSERT INTO tasks (id, project_id, title, description, status, priority, position, estimated_hours, deadline, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [uuidv4(), project_id, t.title, t.description || null, 'todo', t.priority, pos++, t.estimated_hours || null, deadline, req.user.id]
      );
    }

    res.json({ message: `Applied template: ${tasks.length} tasks created` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to apply template' });
  }
});

module.exports = router;
