const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { queryAll, queryOne, execute } = require('../config/db');
const { authenticate, requireProjectAccess, requireWriteAccess } = require('../middleware/auth');

// ─── Field Definitions Router ────────────────────────────────────────────────
// Mounted at: /api/projects/:projectId/custom-fields

const fieldDefsRouter = express.Router({ mergeParams: true });
fieldDefsRouter.use(authenticate, requireProjectAccess);

const VALID_FIELD_TYPES = ['text', 'number', 'select', 'date', 'checkbox', 'url'];

// GET /api/projects/:projectId/custom-fields
fieldDefsRouter.get('/', async (req, res) => {
  try {
    const fields = await queryAll(
      'SELECT * FROM custom_field_definitions WHERE project_id = ? ORDER BY position',
      [req.params.projectId]
    );
    res.json(fields);
  } catch (err) {
    req.log.error({ err, projectId: req.params.projectId }, 'customFields.listDefs.error');
    res.status(500).json({ error: 'Failed to fetch custom field definitions' });
  }
});

// POST /api/projects/:projectId/custom-fields
fieldDefsRouter.post('/', requireWriteAccess, async (req, res) => {
  try {
    const { name, type, options, position } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    if (!type) {
      return res.status(400).json({ error: 'type is required' });
    }
    if (!VALID_FIELD_TYPES.includes(type)) {
      return res.status(400).json({ error: `type must be one of: ${VALID_FIELD_TYPES.join(', ')}` });
    }
    if (type === 'select' && options !== undefined && !Array.isArray(options)) {
      return res.status(400).json({ error: 'options must be an array for select fields' });
    }

    const id = uuidv4();
    const resolvedOptions = options !== undefined ? JSON.stringify(options) : null;

    await execute(
      `INSERT INTO custom_field_definitions (id, project_id, name, type, options, position)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, req.params.projectId, name.trim(), type, resolvedOptions, position ?? null]
    );

    const field = await queryOne(
      'SELECT * FROM custom_field_definitions WHERE id = ?',
      [id]
    );

    req.log.info({ fieldId: id, projectId: req.params.projectId, type }, 'customFields.created');
    res.status(201).json(field);
  } catch (err) {
    req.log.error({ err, projectId: req.params.projectId }, 'customFields.create.error');
    res.status(500).json({ error: 'Failed to create custom field definition' });
  }
});

// PATCH /api/projects/:projectId/custom-fields/:fieldId
fieldDefsRouter.patch('/:fieldId', requireWriteAccess, async (req, res) => {
  try {
    const existing = await queryOne(
      'SELECT * FROM custom_field_definitions WHERE id = ? AND project_id = ?',
      [req.params.fieldId, req.params.projectId]
    );
    if (!existing) {
      return res.status(404).json({ error: 'Custom field not found' });
    }

    const { name, type, options, position } = req.body;
    const sets = [];
    const vals = [];

    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ error: 'name cannot be empty' });
      sets.push('name = ?');
      vals.push(name.trim());
    }
    if (type !== undefined) {
      if (!VALID_FIELD_TYPES.includes(type)) {
        return res.status(400).json({ error: `type must be one of: ${VALID_FIELD_TYPES.join(', ')}` });
      }
      sets.push('type = ?');
      vals.push(type);
    }
    if (options !== undefined) {
      if (!Array.isArray(options)) return res.status(400).json({ error: 'options must be an array' });
      sets.push('options = ?');
      vals.push(JSON.stringify(options));
    }
    if (position !== undefined) {
      sets.push('position = ?');
      vals.push(position);
    }

    if (!sets.length) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    vals.push(req.params.fieldId, req.params.projectId);
    await execute(
      `UPDATE custom_field_definitions SET ${sets.join(', ')} WHERE id = ? AND project_id = ?`,
      vals
    );

    const field = await queryOne(
      'SELECT * FROM custom_field_definitions WHERE id = ?',
      [req.params.fieldId]
    );

    req.log.info({ fieldId: req.params.fieldId, projectId: req.params.projectId }, 'customFields.updated');
    res.json(field);
  } catch (err) {
    req.log.error({ err, fieldId: req.params.fieldId, projectId: req.params.projectId }, 'customFields.update.error');
    res.status(500).json({ error: 'Failed to update custom field definition' });
  }
});

// DELETE /api/projects/:projectId/custom-fields/:fieldId
fieldDefsRouter.delete('/:fieldId', requireWriteAccess, async (req, res) => {
  try {
    const existing = await queryOne(
      'SELECT id FROM custom_field_definitions WHERE id = ? AND project_id = ?',
      [req.params.fieldId, req.params.projectId]
    );
    if (!existing) {
      return res.status(404).json({ error: 'Custom field not found' });
    }

    // Delete all values for this field first, then the definition
    await execute(
      'DELETE FROM custom_field_values WHERE field_id = ?',
      [req.params.fieldId]
    );
    await execute(
      'DELETE FROM custom_field_definitions WHERE id = ? AND project_id = ?',
      [req.params.fieldId, req.params.projectId]
    );

    req.log.info({ fieldId: req.params.fieldId, projectId: req.params.projectId }, 'customFields.deleted');
    res.json({ message: 'Deleted' });
  } catch (err) {
    req.log.error({ err, fieldId: req.params.fieldId, projectId: req.params.projectId }, 'customFields.delete.error');
    res.status(500).json({ error: 'Failed to delete custom field definition' });
  }
});

// ─── Field Values Router ──────────────────────────────────────────────────────
// Mounted at: /api/tasks/:taskId/custom-field-values

const fieldValuesRouter = express.Router({ mergeParams: true });
fieldValuesRouter.use(authenticate);

// GET /api/tasks/:taskId/custom-field-values
fieldValuesRouter.get('/', async (req, res) => {
  try {
    const values = await queryAll(
      `SELECT
         cfv.id,
         cfv.task_id,
         cfv.field_id,
         cfv.value,
         cfv.updated_at,
         cfd.name       AS field_name,
         cfd.type       AS field_type,
         cfd.options    AS field_options,
         cfd.position   AS field_position
       FROM custom_field_values cfv
       JOIN custom_field_definitions cfd ON cfd.id = cfv.field_id
       WHERE cfv.task_id = ?
       ORDER BY cfd.position`,
      [req.params.taskId]
    );
    res.json(values);
  } catch (err) {
    req.log.error({ err, taskId: req.params.taskId }, 'customFieldValues.list.error');
    res.status(500).json({ error: 'Failed to fetch custom field values' });
  }
});

// PUT /api/tasks/:taskId/custom-field-values/:fieldId
fieldValuesRouter.put('/:fieldId', async (req, res) => {
  try {
    const { value } = req.body;
    if (value === undefined) {
      return res.status(400).json({ error: 'value is required' });
    }

    // Verify the field definition exists
    const field = await queryOne(
      'SELECT * FROM custom_field_definitions WHERE id = ?',
      [req.params.fieldId]
    );
    if (!field) {
      return res.status(404).json({ error: 'Custom field not found' });
    }

    const id = uuidv4();
    await execute(
      `INSERT INTO custom_field_values (id, task_id, field_id, value, updated_at)
       VALUES (?, ?, ?, ?, NOW())
       ON CONFLICT (task_id, field_id) DO UPDATE
         SET value = EXCLUDED.value, updated_at = NOW()`,
      [id, req.params.taskId, req.params.fieldId, value]
    );

    const updated = await queryOne(
      `SELECT
         cfv.id,
         cfv.task_id,
         cfv.field_id,
         cfv.value,
         cfv.updated_at,
         cfd.name       AS field_name,
         cfd.type       AS field_type,
         cfd.options    AS field_options,
         cfd.position   AS field_position
       FROM custom_field_values cfv
       JOIN custom_field_definitions cfd ON cfd.id = cfv.field_id
       WHERE cfv.task_id = ? AND cfv.field_id = ?`,
      [req.params.taskId, req.params.fieldId]
    );

    req.log.info({ taskId: req.params.taskId, fieldId: req.params.fieldId }, 'customFieldValues.upserted');
    res.json(updated);
  } catch (err) {
    req.log.error({ err, taskId: req.params.taskId, fieldId: req.params.fieldId }, 'customFieldValues.upsert.error');
    res.status(500).json({ error: 'Failed to upsert custom field value' });
  }
});

module.exports = { fieldDefsRouter, fieldValuesRouter };
