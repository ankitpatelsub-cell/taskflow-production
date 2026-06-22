const express = require('express');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const { queryOne, queryAll, execute } = require('../config/db');
const { authenticate, requireProjectAccess, requireWriteAccess } = require('../middleware/auth');
const { logActivity, notifyTaskAssigned, notifyWatchers } = require('../services/notificationService');
const { broadcast } = require('../services/wsService');
const { notifySlack } = require('../services/slackService');
const { validate, createTaskSchema, updateTaskSchema } = require('../config/validate');
const { runAutomations } = require('../services/automationService');
// req.log (pino-http) used for request-scoped logging

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// ─── CSV helpers ──────────────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const result = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const row = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { field += '"'; i++; }
        else if (ch === '"') { inQuotes = false; }
        else { field += ch; }
      } else {
        if (ch === '"') { inQuotes = true; }
        else if (ch === ',') { row.push(field.trim()); field = ''; }
        else { field += ch; }
      }
    }
    row.push(field.trim());
    result.push(row);
  }
  return result;
}

const HEADER_MAP = {
  title: ['title', 'name', 'task', 'task name', 'summary'],
  description: ['description', 'desc', 'notes', 'body', 'details'],
  status: ['status', 'state'],
  priority: ['priority', 'importance'],
  deadline: ['deadline', 'due date', 'due', 'due_date', 'end date'],
  assignee: ['assignee', 'assigned to', 'owner', 'assigned_to'],
  estimated_hours: ['estimated hours', 'estimate', 'hours', 'estimated_hours', 'est hours'],
};

function normalizeStatus(v) {
  const s = (v || '').toLowerCase().trim().replace(/\s+/g, '_');
  if (['todo', 'to_do', 'to do', 'open', 'not started', 'backlog'].includes(s)) return 'todo';
  if (['in_progress', 'in progress', 'doing', 'wip', 'active'].includes(s)) return 'in_progress';
  if (['review', 'in review', 'in_review', 'testing'].includes(s)) return 'review';
  if (['done', 'complete', 'completed', 'closed', 'finished'].includes(s)) return 'done';
  return 'todo';
}

function normalizePriority(v) {
  const p = (v || '').toLowerCase().trim();
  if (['critical', 'urgent', 'blocker', 'highest'].includes(p)) return 'critical';
  if (['high', 'important', 'major'].includes(p)) return 'high';
  if (['low', 'minor', 'lowest', 'trivial'].includes(p)) return 'low';
  return 'medium';
}

function normalizeDate(v) {
  if (!v) return null;
  const s = v.trim();
  // Accept YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const parts = s.split(/[/\-\.]/);
  if (parts.length === 3) {
    const [a, b, c] = parts;
    if (a.length === 4) return `${a}-${b.padStart(2,'0')}-${c.padStart(2,'0')}`;
    if (c.length === 4) return `${c}-${a.padStart(2,'0')}-${b.padStart(2,'0')}`;
  }
  return null;
}

// ─── Recurrence helper ────────────────────────────────────────────────────────
function calcNextDate(deadline, rule, interval = 1, days = null) {
  if (!deadline || !rule) return null;
  const d = new Date(deadline + 'T12:00:00Z');

  if (rule === 'daily') {
    d.setUTCDate(d.getUTCDate() + interval);
    return d.toISOString().slice(0, 10);
  }

  if (rule === 'weekly') {
    let parsed = null;
    if (days) { try { parsed = JSON.parse(days); } catch { parsed = null; } }
    const targets = parsed ? parsed.map(Number).sort((a, b) => a - b) : [d.getUTCDay()];
    const cur = d.getUTCDay();
    let found = null;
    for (let week = 0; week < interval + 1; week++) {
      for (const t of targets) {
        const diff = (t - cur + 7) % 7 + week * 7;
        if (diff === 0) continue;
        const candidate = new Date(d);
        candidate.setUTCDate(d.getUTCDate() + diff);
        if (!found || candidate < found) found = candidate;
      }
      if (found) {
        const minDiff = (interval - 1) * 7 + 1;
        const actualDiff = Math.round((found - d) / 86400000);
        if (actualDiff >= minDiff) break;
        found = null;
      }
    }
    if (!found) {
      d.setUTCDate(d.getUTCDate() + interval * 7);
      return d.toISOString().slice(0, 10);
    }
    return found.toISOString().slice(0, 10);
  }

  if (rule === 'monthly') {
    d.setUTCMonth(d.getUTCMonth() + interval);
    return d.toISOString().slice(0, 10);
  }

  return null;
}

async function maybeCreateNextOccurrence(task, userId) {
  if (!task.recurrence_rule) return null;
  const nextDate = calcNextDate(task.deadline, task.recurrence_rule, task.recurrence_interval || 1, task.recurrence_days);
  if (!nextDate) return null;
  if (task.recurrence_ends_at && nextDate > task.recurrence_ends_at) return null;

  const newId = uuidv4();
  const parentId = task.recurrence_parent_id || task.id;
  const maxPosRow = await queryOne(
    "SELECT COALESCE(MAX(position),0)+1 as pos FROM tasks WHERE project_id = ? AND status = 'todo'",
    [task.project_id]
  );

  await execute(`
    INSERT INTO tasks (
      id, project_id, parent_task_id, title, description, status, priority,
      assignee_id, created_by, deadline, estimated_hours, position,
      recurrence_rule, recurrence_interval, recurrence_days,
      recurrence_ends_at, recurrence_parent_id
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `, [
    newId, task.project_id, null, // recurrences are always top-level tasks
    task.title, task.description || null, 'todo', task.priority,
    task.assignee_id || null, userId, nextDate,
    task.estimated_hours || null, maxPosRow.pos,
    task.recurrence_rule, task.recurrence_interval || 1,
    task.recurrence_days || null, task.recurrence_ends_at || null, parentId,
  ]);

  const tags = await queryAll('SELECT tag_id FROM task_tags WHERE task_id = ?', [task.id]);
  for (const t of tags) {
    await execute(
      'INSERT INTO task_tags (id, task_id, tag_id) VALUES (?,?,?) ON CONFLICT (task_id, tag_id) DO NOTHING',
      [uuidv4(), newId, t.tag_id]
    );
  }

  await logActivity('task', newId, userId, 'created', null, {
    title: task.title,
    note: `Auto-created from recurring task (${task.recurrence_rule})`,
  });

  if (task.assignee_id) {
    await notifyTaskAssigned(
      { id: newId, title: task.title, assignee_id: task.assignee_id },
      { id: userId, name: 'System' }
    );
  }

  return newId;
}

const router = express.Router({ mergeParams: true });
router.use(authenticate, requireProjectAccess);

async function getTaskWithDetails(taskId) {
  const task = await queryOne(`
    SELECT t.*,
           a.name AS assignee_name, a.avatar_url AS assignee_avatar,
           c.name AS creator_name
    FROM tasks t
    LEFT JOIN users a ON a.id = t.assignee_id
    LEFT JOIN users c ON c.id = t.created_by
    WHERE t.id = ?
  `, [taskId]);
  if (!task) return null;

  const [tags, subtasks, comments, attachments, activity] = await Promise.all([
    queryAll('SELECT tg.id, tg.name, tg.color FROM task_tags tt JOIN tags tg ON tg.id = tt.tag_id WHERE tt.task_id = ?', [taskId]),
    queryAll('SELECT t.*, u.name as assignee_name FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id WHERE t.parent_task_id = ? ORDER BY t.position', [taskId]),
    queryAll('SELECT c.*, u.name as user_name, u.avatar_url FROM comments c JOIN users u ON u.id = c.user_id WHERE c.task_id = ? ORDER BY c.created_at', [taskId]),
    queryAll('SELECT a.*, u.name as user_name FROM attachments a JOIN users u ON u.id = a.user_id WHERE a.task_id = ?', [taskId]),
    queryAll("SELECT al.*, u.name as user_name FROM activity_log al LEFT JOIN users u ON u.id = al.user_id WHERE al.entity_type = 'task' AND al.entity_id = ? ORDER BY al.created_at DESC LIMIT 50", [taskId]),
  ]);

  task.tags = tags;
  task.subtasks = subtasks;
  task.comments = comments;
  task.attachments = attachments;
  task.activity = activity;
  return task;
}

// GET /tasks
// GET /api/projects/:projectId/tasks/similar?title=...
// Returns up to 5 non-done tasks with similar titles (word-overlap based)
router.get('/similar', async (req, res) => {
  try {
    const { title = '' } = req.query;
    const words = title.toLowerCase().split(/\W+/).filter((w) => w.length >= 3);
    if (!words.length) return res.json([]);

    // Build ILIKE conditions — a task is "similar" if it shares ≥1 significant word
    const conditions = words.map(() => 'LOWER(title) LIKE ?');
    const params = [...words.map((w) => `%${w}%`), req.params.projectId];
    const tasks = await queryAll(
      `SELECT id, title, status, priority FROM tasks
       WHERE (${conditions.join(' OR ')}) AND project_id = ? AND status != 'done'
       LIMIT 5`,
      params
    );
    // Score each result by word overlap (higher = more similar)
    const queryWords = new Set(words);
    const scored = tasks.map((t) => {
      const tWords = t.title.toLowerCase().split(/\W+/).filter((w) => w.length >= 3);
      const overlap = tWords.filter((w) => queryWords.has(w)).length;
      const score = overlap / Math.max(queryWords.size, tWords.length);
      return { ...t, score };
    }).filter((t) => t.score >= 0.3).sort((a, b) => b.score - a.score);
    res.json(scored.slice(0, 5));
  } catch (err) { res.status(500).json({ error: 'Similarity check failed' }); }
});

router.get('/', async (req, res) => {
  try {
    const { status, priority, assignee, tag, from, to, parent, q, page = 1, limit = 50 } = req.query;

    const conditions = ['t.project_id = ?'];
    const params = [req.params.projectId];

    if (status)   { conditions.push('t.status = ?');     params.push(status); }
    if (priority) { conditions.push('t.priority = ?');   params.push(priority); }
    if (assignee) { conditions.push('t.assignee_id = ?');params.push(assignee); }
    if (from)     { conditions.push('t.deadline >= ?');  params.push(from); }
    if (to)       { conditions.push('t.deadline <= ?');  params.push(to); }
    if (q) {
      conditions.push('(t.title ILIKE ? OR t.description ILIKE ?)');
      params.push(`%${q}%`, `%${q}%`);
    }
    if (parent === 'null' || parent === undefined) {
      conditions.push('t.parent_task_id IS NULL');
    } else if (parent) {
      conditions.push('t.parent_task_id = ?');
      params.push(parent);
    }
    if (tag) {
      conditions.push('t.id IN (SELECT task_id FROM task_tags WHERE tag_id = ?)');
      params.push(tag);
    }

    const where = conditions.join(' AND ');
    const pageNum  = Math.max(1, parseInt(page, 10));
    const pageSize = Math.min(200, Math.max(1, parseInt(limit, 10)));
    const offset   = (pageNum - 1) * pageSize;

    const [countRow, tasks] = await Promise.all([
      queryOne(`SELECT COUNT(*) as total FROM tasks t WHERE ${where}`, params),
      queryAll(`
        SELECT t.*, u.name as assignee_name, u.avatar_url as assignee_avatar, c.name as creator_name
        FROM tasks t
        LEFT JOIN users u ON u.id = t.assignee_id
        LEFT JOIN users c ON c.id = t.created_by
        WHERE ${where}
        ORDER BY t.position, t.created_at DESC
        LIMIT ? OFFSET ?
      `, [...params, pageSize, offset]),
    ]);

    const total = parseInt(countRow.total, 10);
    await Promise.all(tasks.map(async (t) => {
      t.tags = await queryAll(
        'SELECT tg.id, tg.name, tg.color FROM task_tags tt JOIN tags tg ON tg.id = tt.tag_id WHERE tt.task_id = ?',
        [t.id]
      );
    }));

    res.json({
      tasks,
      pagination: { total, page: pageNum, limit: pageSize, pages: Math.ceil(total / pageSize) },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// GET /tasks/export.csv
router.get('/export.csv', async (req, res) => {
  try {
    const tasks = await queryAll(`
      SELECT t.title, t.description, t.status, t.priority, t.deadline,
             t.estimated_hours, t.created_at, t.updated_at,
             u.name as assignee, c.name as created_by
      FROM tasks t
      LEFT JOIN users u ON u.id = t.assignee_id
      LEFT JOIN users c ON c.id = t.created_by
      WHERE t.project_id = ? AND t.parent_task_id IS NULL
      ORDER BY t.created_at DESC
    `, [req.params.projectId]);

    const header = ['Title','Description','Status','Priority','Assignee','Deadline','Estimated Hours','Created By','Created At'];
    const rows = tasks.map((t) => [
      t.title, t.description || '', t.status, t.priority,
      t.assignee || '', t.deadline || '', t.estimated_hours || '',
      t.created_by || '', t.created_at,
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`));

    const csv = [header, ...rows].map((r) => r.join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="tasks-${req.params.projectId}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: 'Export failed' });
  }
});

// POST /tasks/import  — CSV bulk import
router.post('/import', requireWriteAccess, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const mimeOk = req.file.mimetype === 'text/csv' || req.file.mimetype === 'application/vnd.ms-excel' || req.file.originalname?.endsWith('.csv');
    if (!mimeOk) return res.status(400).json({ error: 'File must be a CSV' });

    // Strip UTF-8 BOM if present
    const raw = req.file.buffer;
    const hasBom = raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf;
    const text = raw.slice(hasBom ? 3 : 0).toString('utf-8');
    const rows = parseCSV(text);
    if (rows.length < 2) return res.status(400).json({ error: 'CSV must have a header row and at least one data row' });

    // Map header columns
    const rawHeaders = rows[0].map((h) => h.toLowerCase().trim());
    const colIndex = {};
    for (const [field, aliases] of Object.entries(HEADER_MAP)) {
      const idx = rawHeaders.findIndex((h) => aliases.includes(h));
      if (idx !== -1) colIndex[field] = idx;
    }

    if (colIndex.title === undefined) {
      return res.status(400).json({ error: 'CSV must have a "Title" column' });
    }

    // Load project members for assignee resolution (by name or email)
    const members = await queryAll(`
      SELECT u.id, u.name, u.email
      FROM project_members pm JOIN users u ON u.id = pm.user_id
      WHERE pm.project_id = ?
    `, [req.params.projectId]);

    function resolveAssignee(val) {
      if (!val) return null;
      const v = val.toLowerCase().trim();
      const m = members.find((u) => u.email.toLowerCase() === v || u.name.toLowerCase() === v);
      return m ? m.id : null;
    }

    const maxPosRow = await queryOne(
      "SELECT COALESCE(MAX(position),0) as pos FROM tasks WHERE project_id = ? AND status = 'todo'",
      [req.params.projectId]
    );
    let nextPos = (parseInt(maxPosRow.pos, 10) || 0) + 1;

    const created = [];
    const failed = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.every((c) => !c)) continue; // skip blank rows

      const title = colIndex.title !== undefined ? row[colIndex.title] : '';
      if (!title.trim()) { failed.push({ row: i + 1, error: 'Missing title' }); continue; }

      const description   = colIndex.description    !== undefined ? row[colIndex.description]    || null : null;
      const rawStatus     = colIndex.status         !== undefined ? row[colIndex.status]                : '';
      const rawPriority   = colIndex.priority       !== undefined ? row[colIndex.priority]              : '';
      const rawDeadline   = colIndex.deadline        !== undefined ? row[colIndex.deadline]              : '';
      const rawAssignee   = colIndex.assignee       !== undefined ? row[colIndex.assignee]              : '';
      const rawEstimate   = colIndex.estimated_hours !== undefined ? row[colIndex.estimated_hours]       : '';

      const status      = normalizeStatus(rawStatus);
      const priority    = normalizePriority(rawPriority);
      const deadline    = normalizeDate(rawDeadline);
      const assignee_id = resolveAssignee(rawAssignee);
      const estimated_hours = rawEstimate ? parseFloat(rawEstimate) || null : null;

      try {
        const id = uuidv4();
        await execute(`
          INSERT INTO tasks (id, project_id, title, description, status, priority,
                             assignee_id, created_by, deadline, estimated_hours, position)
          VALUES (?,?,?,?,?,?,?,?,?,?,?)
        `, [id, req.params.projectId, title.trim(), description, status, priority,
            assignee_id, req.user.id, deadline, estimated_hours, nextPos++]);

        await logActivity('task', id, req.user.id, 'created', null, { title, source: 'csv_import' });
        created.push(id);
      } catch (err) {
        failed.push({ row: i + 1, title: title.trim(), error: err.message });
      }
    }

    req.log.info({ projectId: req.params.projectId, userId: req.user.id, created: created.length, failed: failed.length }, 'tasks.import');
    res.json({ created: created.length, failed });
  } catch (err) {
    req.log.error({ projectId: req.params.projectId, err: err.message }, 'tasks.import_failed');
    res.status(500).json({ error: 'Import failed' });
  }
});

// POST /tasks
router.post('/', requireWriteAccess, validate(createTaskSchema), async (req, res) => {
  try {
    const {
      title, description, priority, status, assignee_id, deadline, estimated_hours,
      story_points, parent_task_id, tag_ids,
      recurrence_rule, recurrence_interval, recurrence_days, recurrence_ends_at,
    } = req.body;

    if (parent_task_id) {
      const parent = await queryOne('SELECT project_id FROM tasks WHERE id = ?', [parent_task_id]);
      if (!parent || parent.project_id !== req.params.projectId) {
        return res.status(400).json({ error: 'parent_task_id must belong to the same project' });
      }
    }

    const id = uuidv4();
    const maxPosRow = await queryOne(
      'SELECT COALESCE(MAX(position),0)+1 as pos FROM tasks WHERE project_id = ? AND status = ?',
      [req.params.projectId, status || 'todo']
    );

    await execute(`
      INSERT INTO tasks (
        id, project_id, parent_task_id, title, description, status, priority,
        assignee_id, created_by, deadline, estimated_hours, story_points, position,
        recurrence_rule, recurrence_interval, recurrence_days, recurrence_ends_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, [
      id, req.params.projectId, parent_task_id || null,
      title, description || null, status || 'todo', priority || 'medium',
      assignee_id || null, req.user.id, deadline || null, estimated_hours || null,
      story_points ? parseInt(story_points) : null, maxPosRow.pos,
      recurrence_rule || null, recurrence_interval || 1,
      recurrence_days || null, recurrence_ends_at || null,
    ]);

    if (tag_ids?.length) {
      for (const tid of tag_ids) {
        await execute(
          'INSERT INTO task_tags (id, task_id, tag_id) VALUES (?,?,?) ON CONFLICT (task_id, tag_id) DO NOTHING',
          [uuidv4(), id, tid]
        );
      }
    }

    await logActivity('task', id, req.user.id, 'created', null, { title });
    if (assignee_id) await notifyTaskAssigned({ id, title, assignee_id }, req.user);

    const task = await queryOne('SELECT * FROM tasks WHERE id = ?', [id]);
    broadcast(req.params.projectId, { type: 'task:created', payload: task });
    runAutomations('task_created', task, null, req.user).catch(() => {});
    notifySlack(req.params.projectId, 'created', task);

    req.log.info({ taskId: id, title, projectId: req.params.projectId, userId: req.user.id }, 'task.created');
    res.status(201).json(task);
  } catch (err) {
    req.log.error({ projectId: req.params.projectId, userId: req.user.id, err: err.message }, 'task.create_failed');
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// GET /tasks/:taskId
router.get('/:taskId', async (req, res) => {
  try {
    const task = await getTaskWithDetails(req.params.taskId);
    if (!task || task.project_id !== req.params.projectId) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

// PATCH /tasks/:taskId
router.patch('/:taskId', requireWriteAccess, validate(updateTaskSchema), async (req, res) => {
  try {
    const old = await queryOne('SELECT * FROM tasks WHERE id = ? AND project_id = ?', [req.params.taskId, req.params.projectId]);
    if (!old) return res.status(404).json({ error: 'Task not found' });

    const {
      title, description, status, priority, assignee_id, deadline, estimated_hours, story_points, tag_ids,
      recurrence_rule, recurrence_interval, recurrence_days, recurrence_ends_at, reminder_at,
    } = req.body;

    const sets = ['updated_at = NOW()'];
    const vals = [];

    if (title !== undefined) {
      const trimmedTitle = String(title).trim();
      if (!trimmedTitle) return res.status(400).json({ error: 'title cannot be empty' });
      sets.push('title = ?');
      vals.push(trimmedTitle);
    }
    if (description !== undefined)     { sets.push('description = ?');        vals.push(description); }
    if (status !== undefined)          { sets.push('status = ?');             vals.push(status); }
    if (priority !== undefined)        { sets.push('priority = ?');           vals.push(priority); }
    if (assignee_id !== undefined)     { sets.push('assignee_id = ?');        vals.push(assignee_id || null); }
    if (deadline !== undefined)        { sets.push('deadline = ?');           vals.push(deadline || null); }
    if (estimated_hours !== undefined) { sets.push('estimated_hours = ?');    vals.push(estimated_hours || null); }
    if (story_points !== undefined)    { sets.push('story_points = ?');       vals.push(story_points ? parseInt(story_points) : null); }
    if (recurrence_rule !== undefined) { sets.push('recurrence_rule = ?');    vals.push(recurrence_rule || null); }
    if (recurrence_interval !== undefined) { sets.push('recurrence_interval = ?'); vals.push(recurrence_interval); }
    if (recurrence_days !== undefined) { sets.push('recurrence_days = ?');    vals.push(recurrence_days || null); }
    if (recurrence_ends_at !== undefined) { sets.push('recurrence_ends_at = ?'); vals.push(recurrence_ends_at || null); }
    if (reminder_at !== undefined)     { sets.push('reminder_at = ?');        vals.push(reminder_at || null); }

    vals.push(req.params.taskId);
    await execute(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`, vals);

    if (tag_ids !== undefined) {
      await execute('DELETE FROM task_tags WHERE task_id = ?', [req.params.taskId]);
      for (const tid of tag_ids) {
        await execute(
          'INSERT INTO task_tags (id, task_id, tag_id) VALUES (?,?,?) ON CONFLICT (task_id, tag_id) DO NOTHING',
          [uuidv4(), req.params.taskId, tid]
        );
      }
    }

    await logActivity('task', req.params.taskId, req.user.id, 'updated', old, req.body);
    if (assignee_id !== undefined && assignee_id !== old.assignee_id) {
      await notifyTaskAssigned({ id: req.params.taskId, title: title || old.title, assignee_id }, req.user);
    }
    if (status !== undefined && status !== old.status) {
      await notifyWatchers(
        { id: req.params.taskId, title: title || old.title },
        req.user.id,
        'task_updated',
        `${req.user.name} moved "${title || old.title}" to ${status}`
      );
    }

    let nextTaskId = null;
    if (status === 'done' && old.status !== 'done') {
      const fresh = await queryOne('SELECT * FROM tasks WHERE id = ?', [req.params.taskId]);
      nextTaskId = await maybeCreateNextOccurrence(fresh, req.user.id);
    }

    const updated = await queryOne('SELECT * FROM tasks WHERE id = ?', [req.params.taskId]);
    broadcast(req.params.projectId, { type: 'task:updated', payload: updated });
    notifySlack(req.params.projectId, updated.status === 'done' && old.status !== 'done' ? 'completed' : 'updated', updated);

    const triggers = [];
    if (status !== undefined && status !== old.status) triggers.push('task_status_changed');
    if (assignee_id !== undefined && assignee_id !== old.assignee_id) triggers.push('task_assigned');
    for (const t of triggers) runAutomations(t, updated, old, req.user).catch(() => {});

    req.log.info({
      taskId: req.params.taskId,
      projectId: req.params.projectId,
      userId: req.user.id,
      fields: Object.keys(req.body),
    }, 'task.updated');
    res.json({ message: 'Updated', nextTaskId });
  } catch (err) {
    req.log.error({ taskId: req.params.taskId, projectId: req.params.projectId, userId: req.user.id, err: err.message }, 'task.update_failed');
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// DELETE /tasks/:taskId
router.delete('/:taskId', requireWriteAccess, async (req, res) => {
  try {
    const t = await queryOne('SELECT id FROM tasks WHERE id = ? AND project_id = ?', [req.params.taskId, req.params.projectId]);
    if (!t) return res.status(404).json({ error: 'Task not found' });
    await execute('DELETE FROM tasks WHERE id = ?', [req.params.taskId]);
    broadcast(req.params.projectId, { type: 'task:deleted', payload: { id: req.params.taskId } });
    req.log.info({ taskId: req.params.taskId, projectId: req.params.projectId, userId: req.user.id }, 'task.deleted');
    res.json({ message: 'Deleted' });
  } catch (err) {
    req.log.error({ taskId: req.params.taskId, projectId: req.params.projectId, userId: req.user.id, err: err.message }, 'task.delete_failed');
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// PATCH /tasks/:taskId/position
router.patch('/:taskId/position', requireWriteAccess, async (req, res) => {
  try {
    const { status, position } = req.body;

    if (status !== undefined) {
      const DEFAULT_STATUSES = ['todo', 'in_progress', 'review', 'done'];
      const customStatuses = await queryAll(
        'SELECT key FROM project_statuses WHERE project_id = ?',
        [req.params.projectId]
      );
      const validStatuses = customStatuses.length
        ? customStatuses.map((s) => s.key)
        : DEFAULT_STATUSES;
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
      }
    }

    const old = await queryOne('SELECT * FROM tasks WHERE id = ? AND project_id = ?', [req.params.taskId, req.params.projectId]);
    if (!old) return res.status(404).json({ error: 'Task not found' });

    const sets = ['updated_at = NOW()'];
    const vals = [];
    if (status !== undefined)   { sets.push('status = ?');   vals.push(status); }
    if (position !== undefined) { sets.push('position = ?'); vals.push(position); }
    vals.push(req.params.taskId);
    await execute(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`, vals);

    let nextTaskId = null;
    if (status === 'done' && old && old.status !== 'done') {
      const fresh = await queryOne('SELECT * FROM tasks WHERE id = ?', [req.params.taskId]);
      nextTaskId = await maybeCreateNextOccurrence(fresh, req.user.id);
    }

    const updated = await queryOne('SELECT * FROM tasks WHERE id = ?', [req.params.taskId]);
    broadcast(req.params.projectId, { type: 'task:updated', payload: updated });
    req.log.info({ taskId: req.params.taskId, projectId: req.params.projectId, userId: req.user.id, status, position }, 'task.moved');
    res.json({ message: 'Updated', nextTaskId });
  } catch (err) {
    req.log.error({ taskId: req.params.taskId, projectId: req.params.projectId, err: err.message }, 'task.move_failed');
    res.status(500).json({ error: 'Failed to update position' });
  }
});

// PATCH /tasks/bulk/update
router.patch('/bulk/update', requireWriteAccess, async (req, res) => {
  try {
    const { taskIds, updates } = req.body;
    if (!Array.isArray(taskIds) || !taskIds.length) return res.status(400).json({ error: 'taskIds required' });
    if (taskIds.length > 100) return res.status(400).json({ error: 'Cannot bulk-update more than 100 tasks at once' });

    const allowed = ['status', 'priority', 'assignee_id'];
    const entries = Object.entries(updates || {}).filter(([k]) => allowed.includes(k));
    if (!entries.length) return res.status(400).json({ error: 'No valid fields to update' });

    const setClauses = entries.map(([k]) => `${k} = ?`).join(', ');
    const values = entries.map(([, v]) => v);
    const placeholders = taskIds.map(() => '?').join(',');

    await execute(
      `UPDATE tasks SET ${setClauses}, updated_at = NOW() WHERE id IN (${placeholders}) AND project_id = ?`,
      [...values, ...taskIds, req.params.projectId]
    );

    for (const id of taskIds) {
      await logActivity('task', id, req.user.id, 'bulk updated', null, updates);
    }
    broadcast(req.params.projectId, { type: 'tasks:bulk_updated', payload: { taskIds, updates } });
    req.log.info({ count: taskIds.length, projectId: req.params.projectId, userId: req.user.id, updates }, 'tasks.bulk_updated');
    res.json({ message: `Updated ${taskIds.length} tasks` });
  } catch (err) {
    req.log.error({ projectId: req.params.projectId, userId: req.user.id, err: err.message }, 'tasks.bulk_update_failed');
    res.status(500).json({ error: 'Bulk update failed' });
  }
});

module.exports = router;
