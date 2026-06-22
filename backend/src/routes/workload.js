const express = require('express');
const { queryAll } = require('../config/db');
const { authenticate, requireProjectAccess } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });
router.use(authenticate, requireProjectAccess);

// GET /api/projects/:projectId/workload
router.get('/', async (req, res) => {
  try {
    const { projectId } = req.params;

    const members = await queryAll(`
      SELECT
        u.id, u.name, u.avatar_url, u.email,
        COUNT(t.id) FILTER (WHERE t.status != 'done') AS active_tasks,
        COUNT(t.id) FILTER (WHERE t.status = 'done')  AS done_tasks,
        COUNT(t.id) FILTER (WHERE t.status = 'todo')  AS todo_tasks,
        COUNT(t.id) FILTER (WHERE t.status = 'in_progress') AS in_progress_tasks,
        COUNT(t.id) FILTER (WHERE t.status = 'review') AS review_tasks,
        COUNT(t.id) FILTER (WHERE t.deadline IS NOT NULL AND t.deadline::date < CURRENT_DATE AND t.status != 'done') AS overdue_tasks,
        COALESCE(SUM(t.estimated_hours) FILTER (WHERE t.status != 'done'), 0) AS estimated_hours_remaining,
        COALESCE(SUM(tl.duration_minutes), 0) AS logged_minutes
      FROM project_members pm
      JOIN users u ON u.id = pm.user_id
      LEFT JOIN tasks t ON t.assignee_id = u.id AND t.project_id = ?
      LEFT JOIN time_logs tl ON tl.user_id = u.id
        AND tl.task_id IN (SELECT id FROM tasks WHERE project_id = ?)
      WHERE pm.project_id = ?
      GROUP BY u.id, u.name, u.avatar_url, u.email
      ORDER BY active_tasks DESC
    `, [projectId, projectId, projectId]);

    // Per-member task list (top 5 active)
    const tasksByMember = {};
    if (members.length > 0) {
      const memberIds = members.map(m => m.id);
      const tasks = await queryAll(`
        SELECT t.id, t.title, t.status, t.priority, t.deadline, t.assignee_id
        FROM tasks t
        WHERE t.project_id = ? AND t.assignee_id = ANY(?)
          AND t.status != 'done'
        ORDER BY t.priority DESC, t.deadline ASC NULLS LAST
      `, [projectId, memberIds]);

      for (const t of tasks) {
        if (!tasksByMember[t.assignee_id]) tasksByMember[t.assignee_id] = [];
        tasksByMember[t.assignee_id].push(t);
      }
    }

    const result = members.map(m => ({
      ...m,
      active_tasks:    parseInt(m.active_tasks, 10),
      done_tasks:      parseInt(m.done_tasks, 10),
      overdue_tasks:   parseInt(m.overdue_tasks, 10),
      estimated_hours_remaining: parseFloat(m.estimated_hours_remaining || 0),
      logged_minutes:  parseInt(m.logged_minutes, 10),
      top_tasks:       (tasksByMember[m.id] || []).slice(0, 5),
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch workload' });
  }
});

module.exports = router;
