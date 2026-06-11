const express = require('express');
const { queryOne, queryAll } = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/analytics/portfolio — cross-project metrics for the caller's projects
router.get('/portfolio', async (req, res) => {
  try {
    const { workspace_id } = req.query;
    const isAdmin = ['admin', 'super_admin'].includes(req.user.role);

    // Projects the user can see
    const projectFilter = workspace_id
      ? `p.workspace_id = $1`
      : isAdmin
        ? `1=1`
        : `p.id IN (SELECT project_id FROM project_members WHERE user_id = $1)`;
    const projectParams = workspace_id ? [workspace_id] : isAdmin ? [] : [req.user.id];

    const [projects, taskStats, sprintStats, memberStats, overdueStats] = await Promise.all([
      // Active projects
      queryAll(`
        SELECT p.id, p.name, p.color, p.status, p.created_at,
          (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND parent_task_id IS NULL) AS total_tasks,
          (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND parent_task_id IS NULL AND status = 'done') AS done_tasks,
          (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) AS member_count,
          (SELECT MAX(created_at) FROM tasks WHERE project_id = p.id) AS last_activity
        FROM projects p
        WHERE ${projectFilter} AND p.status = 'active'
        ORDER BY p.created_at DESC
        LIMIT 20
      `, projectParams),

      // Overall task completion rate (last 30 days)
      queryOne(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'done') AS completed,
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'done' AND updated_at >= NOW() - INTERVAL '30 days') AS completed_30d,
          COUNT(*) FILTER (WHERE deadline < NOW() AND status != 'done') AS overdue
        FROM tasks t
        JOIN projects p ON p.id = t.project_id
        WHERE ${projectFilter} AND t.parent_task_id IS NULL
      `, projectParams),

      // Sprint on-time delivery rate
      queryOne(`
        SELECT
          COUNT(*) AS total_sprints,
          COUNT(*) FILTER (WHERE status = 'completed') AS completed_sprints,
          COUNT(*) FILTER (WHERE status = 'completed' AND end_date >= CURRENT_DATE) AS on_time_sprints
        FROM sprints s
        JOIN projects p ON p.id = s.project_id
        WHERE ${projectFilter}
      `, projectParams),

      // Team productivity (tasks done per member last 30 days)
      queryAll(`
        SELECT u.id, u.name, u.avatar_url,
          COUNT(t.id) FILTER (WHERE t.status = 'done') AS tasks_done,
          COUNT(t.id) FILTER (WHERE t.status != 'done' AND t.deadline < NOW()) AS overdue_tasks,
          COALESCE(SUM(tl.duration_minutes), 0) AS total_minutes_logged
        FROM users u
        JOIN project_members pm ON pm.user_id = u.id
        JOIN projects p ON p.id = pm.project_id
        LEFT JOIN tasks t ON t.assignee_id = u.id AND t.project_id = p.id AND t.parent_task_id IS NULL
          AND t.updated_at >= NOW() - INTERVAL '30 days'
        LEFT JOIN time_logs tl ON tl.user_id = u.id AND tl.logged_at >= NOW() - INTERVAL '30 days'
        WHERE ${projectFilter}
        GROUP BY u.id, u.name, u.avatar_url
        ORDER BY tasks_done DESC
        LIMIT 10
      `, projectParams),

      // Overdue tasks by project
      queryAll(`
        SELECT p.id, p.name, p.color,
          COUNT(*) AS overdue_count
        FROM tasks t
        JOIN projects p ON p.id = t.project_id
        WHERE ${projectFilter}
          AND t.status != 'done'
          AND t.deadline < NOW()
          AND t.parent_task_id IS NULL
        GROUP BY p.id, p.name, p.color
        ORDER BY overdue_count DESC
      `, projectParams),
    ]);

    // Completion trend — last 8 weeks
    const weeklyTrend = await queryAll(`
      SELECT
        DATE_TRUNC('week', updated_at)::date AS week,
        COUNT(*) AS completed
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      WHERE ${projectFilter}
        AND t.status = 'done'
        AND t.updated_at >= NOW() - INTERVAL '8 weeks'
        AND t.parent_task_id IS NULL
      GROUP BY DATE_TRUNC('week', updated_at)::date
      ORDER BY week
    `, projectParams);

    res.json({
      projects,
      summary: {
        total_projects: projects.length,
        total_tasks: parseInt(taskStats?.total || 0),
        completed_tasks: parseInt(taskStats?.completed || 0),
        completion_rate: taskStats?.total > 0
          ? Math.round((taskStats.completed / taskStats.total) * 100)
          : 0,
        overdue_tasks: parseInt(taskStats?.overdue || 0),
        on_time_sprint_rate: sprintStats?.completed_sprints > 0
          ? Math.round((sprintStats.on_time_sprints / sprintStats.completed_sprints) * 100)
          : null,
      },
      team_performance: memberStats,
      overdue_by_project: overdueStats,
      weekly_trend: weeklyTrend,
    });
  } catch (err) {
    req.log?.error({ err: err.message }, 'analytics.portfolio_failed');
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// GET /api/analytics/projects/:projectId/health — single project health score
router.get('/projects/:projectId/health', async (req, res) => {
  try {
    // Verify access
    const isMember = ['admin', 'super_admin'].includes(req.user.role)
      ? true
      : await queryOne(
          'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2',
          [req.params.projectId, req.user.id]
        );
    if (!isMember) return res.status(403).json({ error: 'Access denied' });

    const [taskStats, sprintStats, budgetInfo, recentActivity] = await Promise.all([
      queryOne(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'done') AS done,
          COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress,
          COUNT(*) FILTER (WHERE deadline < NOW() AND status != 'done') AS overdue,
          AVG(estimated_hours) FILTER (WHERE estimated_hours IS NOT NULL) AS avg_estimated,
          COALESCE(SUM(tl.duration_minutes), 0) / 60.0 AS actual_hours
        FROM tasks t
        LEFT JOIN time_logs tl ON tl.task_id = t.id
        WHERE t.project_id = $1 AND t.parent_task_id IS NULL
      `, [req.params.projectId]),

      queryOne(`
        SELECT
          COUNT(*) AS total_sprints,
          COUNT(*) FILTER (WHERE status = 'active') AS active_sprints,
          AVG(
            (SELECT COUNT(*) FROM tasks WHERE sprint_id = s.id AND status = 'done')::float /
            NULLIF((SELECT COUNT(*) FROM tasks WHERE sprint_id = s.id), 0)
          ) AS avg_completion_rate
        FROM sprints s
        WHERE s.project_id = $1
      `, [req.params.projectId]),

      queryOne(
        'SELECT budget_limit, hourly_rate, budget_currency FROM projects WHERE id = $1',
        [req.params.projectId]
      ),

      queryOne(`
        SELECT MAX(created_at) AS last_activity,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS activity_7d
        FROM activity_log
        WHERE entity_type = 'task'
          AND entity_id IN (SELECT id FROM tasks WHERE project_id = $1)
      `, [req.params.projectId]),
    ]);

    // Compute health score (0-100)
    let score = 100;
    const overdueRatio = taskStats.total > 0 ? taskStats.overdue / taskStats.total : 0;
    score -= Math.round(overdueRatio * 40); // up to -40 for overdue tasks
    if (recentActivity?.activity_7d === 0) score -= 15; // inactive project
    const completionRate = taskStats.total > 0 ? taskStats.done / taskStats.total : 0;
    if (completionRate < 0.1) score -= 10;
    score = Math.max(0, Math.min(100, score));

    const healthLabel = score >= 80 ? 'healthy' : score >= 50 ? 'at_risk' : 'critical';

    // Budget burn rate
    let budgetStatus = null;
    if (budgetInfo?.budget_limit && budgetInfo?.hourly_rate) {
      const spent = parseFloat(taskStats.actual_hours) * parseFloat(budgetInfo.hourly_rate);
      const budgetPct = Math.round((spent / budgetInfo.budget_limit) * 100);
      budgetStatus = {
        budget_limit: parseFloat(budgetInfo.budget_limit),
        spent,
        budget_pct: budgetPct,
        currency: budgetInfo.budget_currency || 'USD',
        over_budget: budgetPct > 100,
      };
    }

    res.json({
      health_score: score,
      health_label: healthLabel,
      task_stats: {
        total: parseInt(taskStats.total),
        done: parseInt(taskStats.done),
        in_progress: parseInt(taskStats.in_progress),
        overdue: parseInt(taskStats.overdue),
        completion_rate: taskStats.total > 0 ? Math.round(completionRate * 100) : 0,
        actual_hours: parseFloat(taskStats.actual_hours || 0).toFixed(1),
      },
      sprint_stats: {
        total_sprints: parseInt(sprintStats?.total_sprints || 0),
        active_sprints: parseInt(sprintStats?.active_sprints || 0),
        avg_completion_rate: sprintStats?.avg_completion_rate
          ? Math.round(parseFloat(sprintStats.avg_completion_rate) * 100)
          : null,
      },
      budget: budgetStatus,
      last_activity: recentActivity?.last_activity,
      activity_7d: parseInt(recentActivity?.activity_7d || 0),
    });
  } catch (err) {
    req.log?.error({ err: err.message, projectId: req.params.projectId }, 'analytics.health_failed');
    res.status(500).json({ error: 'Failed to compute project health' });
  }
});

module.exports = router;
