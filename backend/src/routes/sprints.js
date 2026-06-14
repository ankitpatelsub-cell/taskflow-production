const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { queryOne, queryAll, execute } = require('../config/db');
const { authenticate, requireProjectAccess, requireWriteAccess } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });
router.use(authenticate, requireProjectAccess);

// ─── GET /api/projects/:projectId/sprints ─────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const sprints = await queryAll(`
      SELECT s.*,
             COUNT(t.id)                                      AS task_count,
             COUNT(t.id) FILTER (WHERE t.status = 'done')    AS completed_count
      FROM sprints s
      LEFT JOIN tasks t ON t.sprint_id = s.id
      WHERE s.project_id = ?
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `, [req.params.projectId]);

    res.json(sprints);
  } catch (err) {
    req.log.error({ projectId: req.params.projectId, err: err.message }, 'sprints.list_failed');
    res.status(500).json({ error: 'Failed to fetch sprints' });
  }
});

// ─── POST /api/projects/:projectId/sprints ────────────────────────────────────
router.post('/', requireWriteAccess, async (req, res) => {
  try {
    const { name, goal, start_date, end_date } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }

    const id = uuidv4();
    await execute(`
      INSERT INTO sprints (id, project_id, name, goal, start_date, end_date, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, 'planning', ?)
    `, [id, req.params.projectId, name.trim(), goal || null, start_date || null, end_date || null, req.user.id]);

    const sprint = await queryOne('SELECT * FROM sprints WHERE id = ?', [id]);
    req.log.info({ sprintId: id, name, projectId: req.params.projectId, userId: req.user.id }, 'sprint.created');
    res.status(201).json(sprint);
  } catch (err) {
    req.log.error({ projectId: req.params.projectId, userId: req.user.id, err: err.message }, 'sprint.create_failed');
    res.status(500).json({ error: 'Failed to create sprint' });
  }
});

// ─── GET /api/projects/:projectId/sprints/velocity ───────────────────────────
router.get('/velocity', async (req, res) => {
  try {
    const rows = await queryAll(`
      SELECT s.id, s.name, s.end_date,
        COUNT(t.id) AS total_tasks,
        COUNT(CASE WHEN t.status = 'done' THEN 1 END) AS done_tasks
      FROM sprints s
      LEFT JOIN tasks t ON t.sprint_id = s.id
      WHERE s.project_id = ? AND s.status = 'completed'
      GROUP BY s.id, s.name, s.end_date
      ORDER BY s.end_date DESC
      LIMIT 10
    `, [req.params.projectId]);

    const velocity = rows.reverse().map((r) => ({
      id:             r.id,
      name:           r.name,
      end_date:       r.end_date,
      total_tasks:    Number(r.total_tasks),
      done_tasks:     Number(r.done_tasks),
      completion_pct: r.total_tasks > 0
        ? Math.round((Number(r.done_tasks) / Number(r.total_tasks)) * 100)
        : 0,
    }));

    req.log.info({ projectId: req.params.projectId, count: velocity.length }, 'sprint.velocity_fetched');
    res.json(velocity);
  } catch (err) {
    req.log.error({ projectId: req.params.projectId, err: err.message }, 'sprint.velocity_failed');
    res.status(500).json({ error: 'Failed to fetch sprint velocity' });
  }
});

// ─── GET /api/projects/:projectId/sprints/:sprintId ───────────────────────────
router.get('/:sprintId', async (req, res) => {
  try {
    const sprint = await queryOne(
      'SELECT * FROM sprints WHERE id = ? AND project_id = ?',
      [req.params.sprintId, req.params.projectId]
    );
    if (!sprint) return res.status(404).json({ error: 'Sprint not found' });

    const tasks = await queryAll(`
      SELECT t.*,
             u.name AS assignee_name,
             u.avatar_url AS assignee_avatar
      FROM tasks t
      LEFT JOIN users u ON u.id = t.assignee_id
      WHERE t.sprint_id = ?
      ORDER BY t.position, t.created_at
    `, [req.params.sprintId]);

    await Promise.all(tasks.map(async (t) => {
      t.tags = await queryAll(
        'SELECT tg.id, tg.name, tg.color FROM task_tags tt JOIN tags tg ON tg.id = tt.tag_id WHERE tt.task_id = ?',
        [t.id]
      );
    }));

    sprint.tasks = tasks;
    res.json(sprint);
  } catch (err) {
    req.log.error({ sprintId: req.params.sprintId, projectId: req.params.projectId, err: err.message }, 'sprint.get_failed');
    res.status(500).json({ error: 'Failed to fetch sprint' });
  }
});

// ─── PATCH /api/projects/:projectId/sprints/:sprintId ────────────────────────
router.patch('/:sprintId', requireWriteAccess, async (req, res) => {
  try {
    const sprint = await queryOne(
      'SELECT * FROM sprints WHERE id = ? AND project_id = ?',
      [req.params.sprintId, req.params.projectId]
    );
    if (!sprint) return res.status(404).json({ error: 'Sprint not found' });

    const { name, goal, start_date, end_date, status } = req.body;

    const sets = ['updated_at = NOW()'];
    const vals = [];

    if (name !== undefined)       { sets.push('name = ?');       vals.push(name); }
    if (goal !== undefined)       { sets.push('goal = ?');       vals.push(goal || null); }
    if (start_date !== undefined) { sets.push('start_date = ?'); vals.push(start_date || null); }
    if (end_date !== undefined)   { sets.push('end_date = ?');   vals.push(end_date || null); }
    if (status !== undefined)     { sets.push('status = ?');     vals.push(status); }

    vals.push(req.params.sprintId);
    await execute(`UPDATE sprints SET ${sets.join(', ')} WHERE id = ?`, vals);

    const updated = await queryOne('SELECT * FROM sprints WHERE id = ?', [req.params.sprintId]);
    req.log.info({ sprintId: req.params.sprintId, projectId: req.params.projectId, userId: req.user.id, fields: Object.keys(req.body) }, 'sprint.updated');
    res.json(updated);
  } catch (err) {
    req.log.error({ sprintId: req.params.sprintId, projectId: req.params.projectId, userId: req.user.id, err: err.message }, 'sprint.update_failed');
    res.status(500).json({ error: 'Failed to update sprint' });
  }
});

// ─── DELETE /api/projects/:projectId/sprints/:sprintId ───────────────────────
router.delete('/:sprintId', requireWriteAccess, async (req, res) => {
  try {
    const sprint = await queryOne(
      'SELECT id FROM sprints WHERE id = ? AND project_id = ?',
      [req.params.sprintId, req.params.projectId]
    );
    if (!sprint) return res.status(404).json({ error: 'Sprint not found' });

    // Detach tasks before deleting the sprint
    await execute('UPDATE tasks SET sprint_id = NULL, updated_at = NOW() WHERE sprint_id = ?', [req.params.sprintId]);
    await execute('DELETE FROM sprints WHERE id = ?', [req.params.sprintId]);

    req.log.info({ sprintId: req.params.sprintId, projectId: req.params.projectId, userId: req.user.id }, 'sprint.deleted');
    res.json({ message: 'Deleted' });
  } catch (err) {
    req.log.error({ sprintId: req.params.sprintId, projectId: req.params.projectId, userId: req.user.id, err: err.message }, 'sprint.delete_failed');
    res.status(500).json({ error: 'Failed to delete sprint' });
  }
});

// ─── POST /api/projects/:projectId/sprints/:sprintId/start ───────────────────
router.post('/:sprintId/start', requireWriteAccess, async (req, res) => {
  try {
    const sprint = await queryOne(
      'SELECT * FROM sprints WHERE id = ? AND project_id = ?',
      [req.params.sprintId, req.params.projectId]
    );
    if (!sprint) return res.status(404).json({ error: 'Sprint not found' });
    if (sprint.status === 'active') return res.status(400).json({ error: 'Sprint is already active' });
    if (sprint.status === 'completed') return res.status(400).json({ error: 'Cannot start a completed sprint' });

    const today = new Date().toISOString().slice(0, 10);
    await execute(
      `UPDATE sprints SET status = 'active', start_date = COALESCE(start_date, ?), updated_at = NOW() WHERE id = ?`,
      [today, req.params.sprintId]
    );

    const updated = await queryOne('SELECT * FROM sprints WHERE id = ?', [req.params.sprintId]);
    req.log.info({ sprintId: req.params.sprintId, projectId: req.params.projectId, userId: req.user.id }, 'sprint.started');
    res.json(updated);
  } catch (err) {
    req.log.error({ sprintId: req.params.sprintId, projectId: req.params.projectId, userId: req.user.id, err: err.message }, 'sprint.start_failed');
    res.status(500).json({ error: 'Failed to start sprint' });
  }
});

// ─── POST /api/projects/:projectId/sprints/:sprintId/complete ────────────────
router.post('/:sprintId/complete', requireWriteAccess, async (req, res) => {
  try {
    const sprint = await queryOne(
      'SELECT * FROM sprints WHERE id = ? AND project_id = ?',
      [req.params.sprintId, req.params.projectId]
    );
    if (!sprint) return res.status(404).json({ error: 'Sprint not found' });
    if (sprint.status === 'completed') return res.status(400).json({ error: 'Sprint is already completed' });

    const today = new Date().toISOString().slice(0, 10);
    await execute(
      `UPDATE sprints SET status = 'completed', end_date = COALESCE(end_date, ?), updated_at = NOW() WHERE id = ?`,
      [today, req.params.sprintId]
    );

    const updated = await queryOne('SELECT * FROM sprints WHERE id = ?', [req.params.sprintId]);
    req.log.info({ sprintId: req.params.sprintId, projectId: req.params.projectId, userId: req.user.id }, 'sprint.completed');
    res.json(updated);
  } catch (err) {
    req.log.error({ sprintId: req.params.sprintId, projectId: req.params.projectId, userId: req.user.id, err: err.message }, 'sprint.complete_failed');
    res.status(500).json({ error: 'Failed to complete sprint' });
  }
});

// ─── POST /api/projects/:projectId/sprints/:sprintId/tasks ───────────────────
router.post('/:sprintId/tasks', requireWriteAccess, async (req, res) => {
  try {
    const { taskId } = req.body;
    if (!taskId) return res.status(400).json({ error: 'taskId is required' });

    const sprint = await queryOne(
      'SELECT id FROM sprints WHERE id = ? AND project_id = ?',
      [req.params.sprintId, req.params.projectId]
    );
    if (!sprint) return res.status(404).json({ error: 'Sprint not found' });

    const task = await queryOne(
      'SELECT id FROM tasks WHERE id = ? AND project_id = ?',
      [taskId, req.params.projectId]
    );
    if (!task) return res.status(404).json({ error: 'Task not found' });

    await execute(
      'UPDATE tasks SET sprint_id = ?, updated_at = NOW() WHERE id = ?',
      [req.params.sprintId, taskId]
    );

    req.log.info({ sprintId: req.params.sprintId, taskId, projectId: req.params.projectId, userId: req.user.id }, 'sprint.task_added');
    res.json({ message: 'Task added to sprint' });
  } catch (err) {
    req.log.error({ sprintId: req.params.sprintId, projectId: req.params.projectId, userId: req.user.id, err: err.message }, 'sprint.add_task_failed');
    res.status(500).json({ error: 'Failed to add task to sprint' });
  }
});

// ─── DELETE /api/projects/:projectId/sprints/:sprintId/tasks/:taskId ─────────
router.delete('/:sprintId/tasks/:taskId', requireWriteAccess, async (req, res) => {
  try {
    const sprint = await queryOne(
      'SELECT id FROM sprints WHERE id = ? AND project_id = ?',
      [req.params.sprintId, req.params.projectId]
    );
    if (!sprint) return res.status(404).json({ error: 'Sprint not found' });

    const task = await queryOne(
      'SELECT id FROM tasks WHERE id = ? AND project_id = ? AND sprint_id = ?',
      [req.params.taskId, req.params.projectId, req.params.sprintId]
    );
    if (!task) return res.status(404).json({ error: 'Task not found in this sprint' });

    await execute(
      'UPDATE tasks SET sprint_id = NULL, updated_at = NOW() WHERE id = ?',
      [req.params.taskId]
    );

    req.log.info({ sprintId: req.params.sprintId, taskId: req.params.taskId, projectId: req.params.projectId, userId: req.user.id }, 'sprint.task_removed');
    res.json({ message: 'Task removed from sprint' });
  } catch (err) {
    req.log.error({ sprintId: req.params.sprintId, taskId: req.params.taskId, projectId: req.params.projectId, userId: req.user.id, err: err.message }, 'sprint.remove_task_failed');
    res.status(500).json({ error: 'Failed to remove task from sprint' });
  }
});

// ─── GET /api/projects/:projectId/sprints/:sprintId/burndown ─────────────────
// Returns an array of { date, remaining, completed } for each day of the sprint.
// Completion dates are derived from activity_log entries where action='updated'
// and changes->status transitioned to 'done'. Falls back to a linear projection
// when no activity data is available.
router.get('/:sprintId/burndown', async (req, res) => {
  try {
    const sprint = await queryOne(
      'SELECT * FROM sprints WHERE id = ? AND project_id = ?',
      [req.params.sprintId, req.params.projectId]
    );
    if (!sprint) return res.status(404).json({ error: 'Sprint not found' });

    if (!sprint.start_date || !sprint.end_date) {
      return res.status(400).json({ error: 'Sprint must have start_date and end_date for burndown data' });
    }

    // All tasks currently (or previously) in this sprint
    const tasks = await queryAll(
      'SELECT id, status, COALESCE(story_points, 1) AS points FROM tasks WHERE sprint_id = ? AND project_id = ?',
      [req.params.sprintId, req.params.projectId]
    );

    if (tasks.length === 0) return res.json([]);

    const totalPoints = tasks.reduce((sum, t) => sum + (t.points || 1), 0);
    const pointsByTaskId = Object.fromEntries(tasks.map(t => [t.id, t.points || 1]));

    const taskIds = tasks.map((t) => t.id);

    // Fetch activity log entries that recorded a status change to 'done'
    // new_value is stored as JSON, so we look for entries where the parsed new_value
    // contains status='done' for tasks in this sprint.
    let completionsByDate = {};

    if (taskIds.length > 0) {
      const placeholders = taskIds.map(() => '?').join(', ');
      const activityRows = await queryAll(`
        SELECT entity_id, created_at::date AS completed_date
        FROM activity_log
        WHERE entity_type = 'task'
          AND action = 'updated'
          AND entity_id IN (${placeholders})
          AND new_value::jsonb->>'status' = 'done'
        ORDER BY created_at
      `, taskIds);

      // For each task keep only the earliest 'done' transition; accumulate story points
      const seenTasks = new Set();
      for (const row of activityRows) {
        if (!seenTasks.has(row.entity_id)) {
          seenTasks.add(row.entity_id);
          const dateStr = typeof row.completed_date === 'string'
            ? row.completed_date
            : new Date(row.completed_date).toISOString().slice(0, 10);
          completionsByDate[dateStr] = (completionsByDate[dateStr] || 0) + (pointsByTaskId[row.entity_id] || 1);
        }
      }
    }

    // Build the day-by-day series (in story points)
    const start = new Date(sprint.start_date + 'T00:00:00Z');
    const end   = new Date(sprint.end_date   + 'T00:00:00Z');
    const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
    const effectiveEnd = end < today ? end : today;

    const hasActivityData = Object.keys(completionsByDate).length > 0;

    const series = [];
    let cumulativeCompleted = 0;
    let current = new Date(start);

    while (current <= end) {
      const dateStr = current.toISOString().slice(0, 10);

      if (hasActivityData) {
        cumulativeCompleted += (completionsByDate[dateStr] || 0);
      } else if (current > effectiveEnd) {
        const totalDays = Math.round((end - start) / 86400000) || 1;
        const dayIndex  = Math.round((current - start) / 86400000);
        cumulativeCompleted = Math.round((dayIndex / totalDays) * totalPoints);
      } else {
        const donePoints = tasks.filter(t => t.status === 'done').reduce((s, t) => s + t.points, 0);
        if (current >= effectiveEnd) cumulativeCompleted = donePoints;
      }

      series.push({
        date:      dateStr,
        remaining: Math.max(0, totalPoints - cumulativeCompleted),
        completed: Math.min(totalPoints, cumulativeCompleted),
        total:     totalPoints,
      });

      current.setUTCDate(current.getUTCDate() + 1);
    }

    req.log.info({ sprintId: req.params.sprintId, projectId: req.params.projectId, days: series.length, hasActivityData }, 'sprint.burndown_fetched');
    res.json(series);
  } catch (err) {
    req.log.error({ sprintId: req.params.sprintId, projectId: req.params.projectId, err: err.message }, 'sprint.burndown_failed');
    res.status(500).json({ error: 'Failed to fetch burndown data' });
  }
});

module.exports = router;
