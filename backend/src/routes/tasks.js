const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/db');
const { authenticate, requireProjectAccess } = require('../middleware/auth');
const { logActivity, notifyTaskAssigned } = require('../services/notificationService');
const { validate, createTaskSchema, updateTaskSchema } = require('../config/validate');

// ─── Recurrence helper ────────────────────────────────────────────────────────
/**
 * Calculate the next occurrence date for a recurring task.
 * @param {string} deadline  ISO date string "YYYY-MM-DD"
 * @param {string} rule      'daily' | 'weekly' | 'monthly'
 * @param {number} interval  every N days/weeks/months
 * @param {string|null} days JSON array of weekday numbers [0..6], only for 'weekly'
 * @returns {string|null}    next "YYYY-MM-DD" or null if can't compute
 */
function calcNextDate(deadline, rule, interval = 1, days = null) {
  if (!deadline || !rule) return null;
  const d = new Date(deadline + 'T12:00:00Z'); // noon UTC avoids DST edge cases

  if (rule === 'daily') {
    d.setUTCDate(d.getUTCDate() + interval);
    return d.toISOString().slice(0, 10);
  }

  if (rule === 'weekly') {
    const targets = days ? JSON.parse(days).map(Number).sort((a, b) => a - b) : [d.getUTCDay()];
    const cur = d.getUTCDay();
    // Look for the next target day AFTER today (within the next interval weeks)
    let found = null;
    for (let week = 0; week < interval + 1; week++) {
      for (const t of targets) {
        const diff = (t - cur + 7) % 7 + week * 7;
        if (diff === 0) continue; // skip same day
        const candidate = new Date(d);
        candidate.setUTCDate(d.getUTCDate() + diff);
        if (!found || candidate < found) found = candidate;
      }
      if (found) {
        // If interval > 1, the first match must be at least interval*7 days ahead
        const minDiff = (interval - 1) * 7 + 1;
        const actualDiff = Math.round((found - d) / 86400000);
        if (actualDiff >= minDiff) break;
        found = null; // too soon, keep looking next week
      }
    }
    if (!found) {
      // Fallback: just add interval weeks
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

/**
 * When a recurring task is marked done, create the next occurrence.
 * Returns the new task id (or null if no recurrence / ends reached).
 */
function maybeCreateNextOccurrence(db, task, userId) {
  if (!task.recurrence_rule) return null;

  const nextDate = calcNextDate(
    task.deadline,
    task.recurrence_rule,
    task.recurrence_interval || 1,
    task.recurrence_days
  );
  if (!nextDate) return null;

  // Check recurrence_ends_at
  if (task.recurrence_ends_at && nextDate > task.recurrence_ends_at) return null;

  const newId = uuidv4();
  const parentId = task.recurrence_parent_id || task.id;
  const maxPos = db.prepare(
    "SELECT COALESCE(MAX(position),0)+1 as pos FROM tasks WHERE project_id = ? AND status = 'todo'"
  ).get(task.project_id);

  db.prepare(`
    INSERT INTO tasks (
      id, project_id, parent_task_id, title, description, status, priority,
      assignee_id, created_by, deadline, estimated_hours, position,
      recurrence_rule, recurrence_interval, recurrence_days,
      recurrence_ends_at, recurrence_parent_id
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    newId,
    task.project_id,
    task.parent_task_id || null,
    task.title,
    task.description || null,
    'todo',
    task.priority,
    task.assignee_id || null,
    userId,
    nextDate,
    task.estimated_hours || null,
    maxPos.pos,
    task.recurrence_rule,
    task.recurrence_interval || 1,
    task.recurrence_days || null,
    task.recurrence_ends_at || null,
    parentId
  );

  // Copy tags from original task
  const tags = db.prepare('SELECT tag_id FROM task_tags WHERE task_id = ?').all(task.id);
  tags.forEach((t) =>
    db.prepare('INSERT OR IGNORE INTO task_tags (id, task_id, tag_id) VALUES (?,?,?)').run(uuidv4(), newId, t.tag_id)
  );

  logActivity('task', newId, userId, 'created', null, {
    title: task.title,
    note: `Auto-created from recurring task (${task.recurrence_rule})`,
  });

  if (task.assignee_id) {
    notifyTaskAssigned(
      { id: newId, title: task.title, assignee_id: task.assignee_id },
      { id: userId, name: 'System' }
    );
  }

  return newId;
}

const router = express.Router({ mergeParams: true });
router.use(authenticate, requireProjectAccess);

function getTaskWithDetails(db, taskId) {
  const task = db.prepare(`
    SELECT t.*,
           a.name  AS assignee_name, a.avatar_url AS assignee_avatar,
           c.name  AS creator_name
    FROM tasks t
    LEFT JOIN users a ON a.id = t.assignee_id
    LEFT JOIN users c ON c.id = t.created_by
    WHERE t.id = ?
  `).get(taskId);
  if (!task) return null;
  task.tags        = db.prepare('SELECT tg.id, tg.name, tg.color FROM task_tags tt JOIN tags tg ON tg.id = tt.tag_id WHERE tt.task_id = ?').all(taskId);
  task.subtasks    = db.prepare('SELECT t.*, u.name as assignee_name FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id WHERE t.parent_task_id = ? ORDER BY t.position').all(taskId);
  task.comments    = db.prepare('SELECT c.*, u.name as user_name, u.avatar_url FROM comments c JOIN users u ON u.id = c.user_id WHERE c.task_id = ? ORDER BY c.created_at').all(taskId);
  task.attachments = db.prepare('SELECT a.*, u.name as user_name FROM attachments a JOIN users u ON u.id = a.user_id WHERE a.task_id = ?').all(taskId);
  task.activity    = db.prepare("SELECT al.*, u.name as user_name FROM activity_log al LEFT JOIN users u ON u.id = al.user_id WHERE al.entity_type = 'task' AND al.entity_id = ? ORDER BY al.created_at DESC LIMIT 50").all(taskId);
  return task;
}

// ─── GET /tasks — list with filters + pagination + search ────────────────────
router.get('/', (req, res) => {
  const db = getDb();
  const { status, priority, assignee, tag, from, to, parent, q,
          page = 1, limit = 50 } = req.query;

  let countQ = 'SELECT COUNT(*) as total FROM tasks t WHERE t.project_id = ?';
  let dataQ = `
    SELECT t.*, u.name as assignee_name, u.avatar_url as assignee_avatar,
           c.name as creator_name
    FROM tasks t
    LEFT JOIN users u ON u.id = t.assignee_id
    LEFT JOIN users c ON c.id = t.created_by
    WHERE t.project_id = ?
  `;
  const params = [req.params.projectId];

  if (status)   { dataQ += ' AND t.status = ?';    countQ += ' AND t.status = ?';    params.push(status); }
  if (priority) { dataQ += ' AND t.priority = ?';  countQ += ' AND t.priority = ?';  params.push(priority); }
  if (assignee) { dataQ += ' AND t.assignee_id = ?'; countQ += ' AND t.assignee_id = ?'; params.push(assignee); }
  if (from)     { dataQ += ' AND t.deadline >= ?'; countQ += ' AND t.deadline >= ?'; params.push(from); }
  if (to)       { dataQ += ' AND t.deadline <= ?'; countQ += ' AND t.deadline <= ?'; params.push(to); }

  // Full-text search on title + description
  if (q) {
    dataQ  += " AND (t.title LIKE ? OR t.description LIKE ?)";
    countQ += " AND (t.title LIKE ? OR t.description LIKE ?)";
    params.push(`%${q}%`, `%${q}%`);
  }

  if (parent === 'null' || parent === undefined) {
    dataQ  += ' AND t.parent_task_id IS NULL';
    countQ += ' AND t.parent_task_id IS NULL';
  } else if (parent) {
    dataQ  += ' AND t.parent_task_id = ?';
    countQ += ' AND t.parent_task_id = ?';
    params.push(parent);
  }

  if (tag) {
    dataQ  += ' AND t.id IN (SELECT task_id FROM task_tags WHERE tag_id = ?)';
    countQ += ' AND t.id IN (SELECT task_id FROM task_tags WHERE tag_id = ?)';
    params.push(tag);
  }

  const total    = db.prepare(countQ).get(...params).total;
  const pageNum  = Math.max(1, parseInt(page, 10));
  const pageSize = Math.min(200, Math.max(1, parseInt(limit, 10)));
  const offset   = (pageNum - 1) * pageSize;

  dataQ += ' ORDER BY t.position, t.created_at DESC LIMIT ? OFFSET ?';
  const tasks = db.prepare(dataQ).all(...params, pageSize, offset);
  tasks.forEach((t) => {
    t.tags = db.prepare('SELECT tg.id, tg.name, tg.color FROM task_tags tt JOIN tags tg ON tg.id = tt.tag_id WHERE tt.task_id = ?').all(t.id);
  });

  res.json({
    tasks,
    pagination: { total, page: pageNum, limit: pageSize, pages: Math.ceil(total / pageSize) },
  });
});

// ─── GET /tasks/export.csv ────────────────────────────────────────────────────
router.get('/export.csv', (req, res) => {
  const db = getDb();
  const tasks = db.prepare(`
    SELECT t.title, t.description, t.status, t.priority, t.deadline,
           t.estimated_hours, t.created_at, t.updated_at,
           u.name as assignee, c.name as created_by
    FROM tasks t
    LEFT JOIN users u ON u.id = t.assignee_id
    LEFT JOIN users c ON c.id = t.created_by
    WHERE t.project_id = ? AND t.parent_task_id IS NULL
    ORDER BY t.created_at DESC
  `).all(req.params.projectId);

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
});

// ─── POST /tasks ──────────────────────────────────────────────────────────────
router.post('/', validate(createTaskSchema), (req, res) => {
  const db = getDb();
  const {
    title, description, priority, status, assignee_id, deadline, estimated_hours,
    parent_task_id, tag_ids,
    recurrence_rule, recurrence_interval, recurrence_days, recurrence_ends_at,
  } = req.body;
  const id = uuidv4();
  const maxPos = db.prepare("SELECT COALESCE(MAX(position),0)+1 as pos FROM tasks WHERE project_id = ? AND status = ?").get(req.params.projectId, status || 'todo');
  db.prepare(`
    INSERT INTO tasks (
      id, project_id, parent_task_id, title, description, status, priority,
      assignee_id, created_by, deadline, estimated_hours, position,
      recurrence_rule, recurrence_interval, recurrence_days, recurrence_ends_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    id, req.params.projectId, parent_task_id || null,
    title, description || null, status || 'todo', priority || 'medium',
    assignee_id || null, req.user.id, deadline || null, estimated_hours || null, maxPos.pos,
    recurrence_rule || null, recurrence_interval || 1,
    recurrence_days || null, recurrence_ends_at || null
  );
  if (tag_ids?.length) {
    tag_ids.forEach((tid) => db.prepare('INSERT OR IGNORE INTO task_tags (id, task_id, tag_id) VALUES (?,?,?)').run(uuidv4(), id, tid));
  }
  logActivity('task', id, req.user.id, 'created', null, { title });
  if (assignee_id) notifyTaskAssigned({ id, title, assignee_id }, req.user);
  res.status(201).json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(id));
});

// ─── GET /tasks/:taskId ───────────────────────────────────────────────────────
router.get('/:taskId', (req, res) => {
  const db = getDb();
  const task = getTaskWithDetails(db, req.params.taskId);
  if (!task || task.project_id !== req.params.projectId) return res.status(404).json({ error: 'Task not found' });
  res.json(task);
});

// ─── PATCH /tasks/:taskId ─────────────────────────────────────────────────────
router.patch('/:taskId', validate(updateTaskSchema), (req, res) => {
  const db = getDb();
  const old = db.prepare('SELECT * FROM tasks WHERE id = ? AND project_id = ?').get(req.params.taskId, req.params.projectId);
  if (!old) return res.status(404).json({ error: 'Task not found' });

  const {
    title, description, status, priority, assignee_id, deadline, estimated_hours, tag_ids,
    recurrence_rule, recurrence_interval, recurrence_days, recurrence_ends_at,
  } = req.body;

  // Handle explicit recurrence_rule = null (user removing recurrence)
  const newRecurrenceRule = recurrence_rule !== undefined ? (recurrence_rule || null) : undefined;

  db.prepare(`
    UPDATE tasks SET
      title              = COALESCE(?, title),
      description        = COALESCE(?, description),
      status             = COALESCE(?, status),
      priority           = COALESCE(?, priority),
      assignee_id        = CASE WHEN ? IS NOT NULL THEN ? ELSE assignee_id END,
      deadline           = COALESCE(?, deadline),
      estimated_hours    = COALESCE(?, estimated_hours),
      recurrence_rule    = CASE WHEN ? IS NOT NULL THEN ? ELSE recurrence_rule END,
      recurrence_interval= COALESCE(?, recurrence_interval),
      recurrence_days    = CASE WHEN ? IS NOT NULL THEN ? ELSE recurrence_days END,
      recurrence_ends_at = CASE WHEN ? IS NOT NULL THEN ? ELSE recurrence_ends_at END,
      updated_at         = datetime('now')
    WHERE id = ?
  `).run(
    title ?? null, description ?? null, status ?? null, priority ?? null,
    assignee_id ?? null, assignee_id ?? null,
    deadline ?? null, estimated_hours ?? null,
    recurrence_rule !== undefined ? 'set' : null, newRecurrenceRule,
    recurrence_interval ?? null,
    recurrence_days !== undefined ? 'set' : null, recurrence_days ?? null,
    recurrence_ends_at !== undefined ? 'set' : null, recurrence_ends_at ?? null,
    req.params.taskId
  );

  if (tag_ids !== undefined) {
    db.prepare('DELETE FROM task_tags WHERE task_id = ?').run(req.params.taskId);
    tag_ids.forEach((tid) => db.prepare('INSERT OR IGNORE INTO task_tags (id, task_id, tag_id) VALUES (?,?,?)').run(uuidv4(), req.params.taskId, tid));
  }

  logActivity('task', req.params.taskId, req.user.id, 'updated', old, req.body);
  if (assignee_id && assignee_id !== old.assignee_id) {
    notifyTaskAssigned({ id: req.params.taskId, title: title || old.title, assignee_id }, req.user);
  }

  // ── Auto-create next occurrence when marked done ──────────────────────────
  let nextTaskId = null;
  if (status === 'done' && old.status !== 'done') {
    const fresh = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.taskId);
    nextTaskId = maybeCreateNextOccurrence(db, fresh, req.user.id);
  }

  res.json({ message: 'Updated', nextTaskId });
});

// ─── DELETE /tasks/:taskId ────────────────────────────────────────────────────
router.delete('/:taskId', (req, res) => {
  const db = getDb();
  const t = db.prepare('SELECT id FROM tasks WHERE id = ? AND project_id = ?').get(req.params.taskId, req.params.projectId);
  if (!t) return res.status(404).json({ error: 'Task not found' });
  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.taskId);
  res.json({ message: 'Deleted' });
});

// ─── PATCH /tasks/:taskId/position ───────────────────────────────────────────
router.patch('/:taskId/position', (req, res) => {
  const { status, position } = req.body;
  const db = getDb();
  const old = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.taskId);
  db.prepare("UPDATE tasks SET status = COALESCE(?, status), position = COALESCE(?, position), updated_at = datetime('now') WHERE id = ?").run(status ?? null, position ?? null, req.params.taskId);

  // Auto-create next occurrence when dragged to done
  let nextTaskId = null;
  if (status === 'done' && old && old.status !== 'done') {
    const fresh = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.taskId);
    nextTaskId = maybeCreateNextOccurrence(db, fresh, req.user.id);
  }

  res.json({ message: 'Updated', nextTaskId });
});

// ─── PATCH /tasks/bulk ────────────────────────────────────────────────────────
router.patch('/bulk/update', (req, res) => {
  const { taskIds, updates } = req.body;
  if (!Array.isArray(taskIds) || !taskIds.length) return res.status(400).json({ error: 'taskIds required' });
  const db = getDb();
  const allowed = ['status', 'priority', 'assignee_id'];
  const entries = Object.entries(updates || {}).filter(([k]) => allowed.includes(k));
  if (!entries.length) return res.status(400).json({ error: 'No valid fields to update' });

  const setClauses = entries.map(([k]) => `${k} = ?`).join(', ');
  const values     = entries.map(([, v]) => v);
  const placeholders = taskIds.map(() => '?').join(',');

  db.prepare(`UPDATE tasks SET ${setClauses}, updated_at = datetime('now') WHERE id IN (${placeholders}) AND project_id = ?`)
    .run(...values, ...taskIds, req.params.projectId);

  taskIds.forEach((id) => logActivity('task', id, req.user.id, 'bulk updated', null, updates));
  res.json({ message: `Updated ${taskIds.length} tasks` });
});

module.exports = router;
