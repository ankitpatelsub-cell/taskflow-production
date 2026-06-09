const express = require('express');
const { queryOne, queryAll, execute } = require('../config/db');
const { authenticate, requireProjectAccess } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });
router.use(authenticate, requireProjectAccess);

// GET /api/projects/:projectId/sprints/:sprintId/scope-changes
// Returns all scope changes made after sprint start
router.get('/:sprintId/scope-changes', async (req, res) => {
  try {
    const sprint = await queryOne(
      'SELECT * FROM sprints WHERE id = $1 AND project_id = $2',
      [req.params.sprintId, req.params.projectId]
    );
    if (!sprint) return res.status(404).json({ error: 'Sprint not found' });

    const startDate = sprint.start_date || sprint.created_at;

    const [added, removed, reestimated, pushed] = await Promise.all([
      // Tasks added to sprint after it started
      queryAll(`
        SELECT al.created_at, al.user_id, u.name as user_name,
          t.id as task_id, t.title, t.priority, t.estimated_hours
        FROM activity_log al
        JOIN tasks t ON t.id = al.entity_id
        LEFT JOIN users u ON u.id = al.user_id
        WHERE al.entity_type = 'task'
          AND al.entity_id IN (SELECT id FROM tasks WHERE sprint_id = $1)
          AND al.action = 'updated'
          AND al.new_value::text LIKE '%sprint_id%'
          AND al.created_at > $2
        ORDER BY al.created_at
      `, [req.params.sprintId, startDate]),

      // Tasks removed from sprint after it started
      queryAll(`
        SELECT al.created_at, al.user_id, u.name as user_name,
          al.entity_id as task_id,
          al.old_value::jsonb->>'title' as title
        FROM activity_log al
        LEFT JOIN users u ON u.id = al.user_id
        WHERE al.entity_type = 'task'
          AND al.action = 'updated'
          AND al.old_value::text LIKE '%sprint_id%'
          AND al.new_value::jsonb->>'sprint_id' IS NULL
          AND al.created_at > $1
          AND al.entity_id IN (
            SELECT id FROM tasks WHERE project_id = $2
          )
        ORDER BY al.created_at
      `, [startDate, req.params.projectId]),

      // Tasks re-estimated (estimate changed up/down)
      queryAll(`
        SELECT al.created_at, al.user_id, u.name as user_name,
          t.id as task_id, t.title,
          (al.old_value::jsonb->>'estimated_hours')::numeric as old_hours,
          (al.new_value::jsonb->>'estimated_hours')::numeric as new_hours
        FROM activity_log al
        JOIN tasks t ON t.id = al.entity_id AND t.sprint_id = $1
        LEFT JOIN users u ON u.id = al.user_id
        WHERE al.entity_type = 'task'
          AND al.action = 'updated'
          AND al.old_value::text LIKE '%estimated_hours%'
          AND al.created_at > $2
        ORDER BY al.created_at
      `, [req.params.sprintId, startDate]),

      // Tasks with deadlines pushed
      queryAll(`
        SELECT al.created_at, al.user_id, u.name as user_name,
          t.id as task_id, t.title,
          al.old_value::jsonb->>'deadline' as old_deadline,
          al.new_value::jsonb->>'deadline' as new_deadline
        FROM activity_log al
        JOIN tasks t ON t.id = al.entity_id AND t.sprint_id = $1
        LEFT JOIN users u ON u.id = al.user_id
        WHERE al.entity_type = 'task'
          AND al.action = 'updated'
          AND al.old_value::text LIKE '%deadline%'
          AND al.created_at > $2
        ORDER BY al.created_at
      `, [req.params.sprintId, startDate]),
    ]);

    // Summary stats
    const currentTasks = await queryOne(
      'SELECT COUNT(*) as total, COALESCE(SUM(estimated_hours), 0) as total_hours FROM tasks WHERE sprint_id = $1 AND parent_task_id IS NULL',
      [req.params.sprintId]
    );

    res.json({
      sprint: { id: sprint.id, name: sprint.name, start_date: sprint.start_date, status: sprint.status },
      scope_changes: {
        added,
        removed,
        reestimated,
        deadlines_pushed: pushed,
      },
      summary: {
        tasks_added_after_start: added.length,
        tasks_removed_after_start: removed.length,
        tasks_reestimated: reestimated.length,
        current_task_count: parseInt(currentTasks.total),
        current_estimated_hours: parseFloat(currentTasks.total_hours),
      },
    });
  } catch (err) {
    req.log?.error({ err: err.message }, 'scope.changes_failed');
    res.status(500).json({ error: 'Failed to fetch scope changes' });
  }
});

// POST /api/projects/:projectId/sprints/:sprintId/retrospective
// AI-generated retrospective from actual sprint data
router.post('/:sprintId/retrospective', async (req, res) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: 'AI features require ANTHROPIC_API_KEY to be configured' });
    }

    const sprint = await queryOne(
      'SELECT * FROM sprints WHERE id = $1 AND project_id = $2',
      [req.params.sprintId, req.params.projectId]
    );
    if (!sprint) return res.status(404).json({ error: 'Sprint not found' });

    const [taskStats, slippedTasks, overloadedMembers, scopeAdds] = await Promise.all([
      queryOne(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'done') AS completed,
          COUNT(*) FILTER (WHERE status != 'done') AS incomplete,
          COALESCE(SUM(estimated_hours) FILTER (WHERE status = 'done'), 0) AS completed_hours,
          COALESCE(SUM(estimated_hours), 0) AS total_hours
        FROM tasks WHERE sprint_id = $1 AND parent_task_id IS NULL
      `, [req.params.sprintId]),

      queryAll(`
        SELECT t.title, t.priority, t.status,
          u.name as assignee_name,
          t.estimated_hours,
          COALESCE(SUM(tl.duration_minutes), 0) / 60.0 as actual_hours
        FROM tasks t
        LEFT JOIN users u ON u.id = t.assignee_id
        LEFT JOIN time_logs tl ON tl.task_id = t.id
        WHERE t.sprint_id = $1 AND t.status != 'done' AND t.parent_task_id IS NULL
        GROUP BY t.id, t.title, t.priority, t.status, u.name, t.estimated_hours
        LIMIT 10
      `, [req.params.sprintId]),

      queryAll(`
        SELECT u.name,
          COUNT(t.id) AS assigned_tasks,
          COALESCE(SUM(tl.duration_minutes), 0) / 60.0 AS logged_hours
        FROM project_members pm
        JOIN users u ON u.id = pm.user_id
        LEFT JOIN tasks t ON t.assignee_id = u.id AND t.sprint_id = $1
        LEFT JOIN time_logs tl ON tl.user_id = u.id
          AND tl.task_id IN (SELECT id FROM tasks WHERE sprint_id = $1)
        WHERE pm.project_id = $2
        GROUP BY u.id, u.name
        HAVING COUNT(t.id) > 0
        ORDER BY assigned_tasks DESC
        LIMIT 8
      `, [req.params.sprintId, req.params.projectId]),

      // Tasks added mid-sprint
      queryAll(`
        SELECT t.title, al.created_at
        FROM activity_log al
        JOIN tasks t ON t.id = al.entity_id AND t.sprint_id = $1
        WHERE al.entity_type = 'task' AND al.action = 'updated'
          AND al.new_value::text LIKE '%sprint_id%'
          AND al.created_at > $2
        LIMIT 5
      `, [req.params.sprintId, sprint.start_date || sprint.created_at]),
    ]);

    const completionRate = taskStats.total > 0
      ? Math.round((taskStats.completed / taskStats.total) * 100)
      : 0;

    const prompt = `You are an experienced Agile coach generating a sprint retrospective.

## Sprint: ${sprint.name}
${sprint.goal ? `Goal: ${sprint.goal}` : ''}
${sprint.start_date ? `Duration: ${sprint.start_date} to ${sprint.end_date || 'ongoing'}` : ''}

## Sprint Results
- Tasks committed: ${taskStats.total}
- Tasks completed: ${taskStats.completed} (${completionRate}%)
- Tasks incomplete: ${taskStats.incomplete}
- Estimated hours completed: ${parseFloat(taskStats.completed_hours).toFixed(1)}h out of ${parseFloat(taskStats.total_hours).toFixed(1)}h planned

## Incomplete Tasks
${slippedTasks.length > 0 ? slippedTasks.map(t => `- [${t.priority}] ${t.title} (assigned to: ${t.assignee_name || 'unassigned'}, estimated: ${t.estimated_hours || '?'}h, logged: ${parseFloat(t.actual_hours).toFixed(1)}h)`).join('\n') : 'None'}

## Team Workload
${overloadedMembers.map(m => `- ${m.name}: ${m.assigned_tasks} tasks, ${parseFloat(m.logged_hours).toFixed(1)}h logged`).join('\n')}

## Mid-Sprint Scope Additions
${scopeAdds.length > 0 ? scopeAdds.map(t => `- "${t.title}" added on ${new Date(t.created_at).toLocaleDateString()}`).join('\n') : 'None (scope was stable)'}

Generate a retrospective with this JSON structure (no markdown, raw JSON):
{
  "summary": "2-3 sentence executive summary of the sprint",
  "went_well": ["specific thing 1", "specific thing 2", "specific thing 3"],
  "improvement_areas": ["specific area 1", "specific area 2"],
  "action_items": [
    { "action": "what to do", "owner": "role or person", "by_when": "next sprint / 1 week / etc." }
  ],
  "health_score": number (0-100),
  "key_metric": "one headline metric worth celebrating or addressing"
}`;

    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic();
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    let retro;
    try {
      retro = JSON.parse(message.content[0].text);
    } catch {
      return res.status(502).json({ error: 'AI returned invalid response. Please try again.' });
    }

    res.json({
      sprint: { id: sprint.id, name: sprint.name, goal: sprint.goal },
      metrics: {
        total_tasks: parseInt(taskStats.total),
        completed: parseInt(taskStats.completed),
        completion_rate: completionRate,
        scope_adds: scopeAdds.length,
      },
      retrospective: retro,
    });
  } catch (err) {
    req.log?.error({ err: err.message }, 'retro.autopilot_failed');
    res.status(500).json({ error: 'Failed to generate retrospective' });
  }
});

module.exports = router;
