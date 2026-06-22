const express = require('express');
const { queryOne, queryAll } = require('../config/db');
const { authenticate, requireProjectAccess } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });
router.use(authenticate, requireProjectAccess);

// POST /api/projects/:projectId/ai-sprint-plan
// Analyzes backlog + team velocity + capacity → suggests an optimal sprint
router.post('/ai-sprint-plan', async (req, res) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: 'AI features require ANTHROPIC_API_KEY to be configured' });
    }

    const { capacity_hours = 40, sprint_name, sprint_goal } = req.body;

    // Gather data for the AI
    const [backlog, velocity, teamMembers] = await Promise.all([
      // Unassigned backlog tasks
      queryAll(`
        SELECT id, title, description, priority, estimated_hours, epic_id
        FROM tasks
        WHERE project_id = $1
          AND status = 'todo'
          AND sprint_id IS NULL
          AND parent_task_id IS NULL
        ORDER BY
          CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
          position
        LIMIT 30
      `, [req.params.projectId]),

      // Last 3 sprints velocity
      queryAll(`
        SELECT s.name, s.start_date, s.end_date,
          COUNT(t.id) AS total_tasks,
          COUNT(t.id) FILTER (WHERE t.status = 'done') AS completed_tasks,
          SUM(t.estimated_hours) FILTER (WHERE t.status = 'done') AS completed_hours
        FROM sprints s
        LEFT JOIN tasks t ON t.sprint_id = s.id AND t.parent_task_id IS NULL
        WHERE s.project_id = $1 AND s.status = 'completed'
        GROUP BY s.id, s.name, s.start_date, s.end_date
        ORDER BY s.end_date DESC
        LIMIT 3
      `, [req.params.projectId]),

      // Team members
      queryAll(`
        SELECT u.id, u.name,
          COUNT(t.id) FILTER (WHERE t.status != 'done') AS active_tasks
        FROM project_members pm
        JOIN users u ON u.id = pm.user_id
        LEFT JOIN tasks t ON t.assignee_id = u.id AND t.project_id = $1
        WHERE pm.project_id = $1
        GROUP BY u.id, u.name
      `, [req.params.projectId]),
    ]);

    const avgVelocityHours = velocity.length > 0
      ? velocity.reduce((sum, s) => sum + parseFloat(s.completed_hours || 0), 0) / velocity.length
      : null;

    const prompt = `You are a sprint planning assistant. Analyze the following project data and suggest the optimal set of tasks for the next sprint.

## Team Capacity
- Total capacity for this sprint: ${capacity_hours} hours
- Team members: ${teamMembers.map(m => `${m.name} (${m.active_tasks} active tasks)`).join(', ')}
${avgVelocityHours ? `- Historical average completed hours per sprint: ${avgVelocityHours.toFixed(1)}h (last ${velocity.length} sprints)` : ''}
${sprint_goal ? `- Sprint goal: ${sprint_goal}` : ''}

## Backlog Tasks (ordered by priority)
${backlog.map((t, i) => `${i + 1}. [${t.priority?.toUpperCase()}] ${t.title}${t.estimated_hours ? ` (${t.estimated_hours}h)` : ' (no estimate)'}${t.description ? ` — ${t.description.slice(0, 80)}` : ''}`).join('\n')}

## Instructions
Select tasks from the backlog that:
1. Fit within the ${capacity_hours}-hour capacity (use estimates where available; assume 4h for unestimated tasks)
2. Prioritize urgent and high-priority items
3. Aim for a coherent sprint goal if one was provided
4. Leave 15% buffer for unexpected work

Respond with a JSON object (no markdown, just JSON):
{
  "recommended_task_ids": ["id1", "id2", ...],
  "reasoning": "brief explanation of selection logic",
  "estimated_total_hours": number,
  "capacity_utilization_pct": number,
  "warnings": ["any risks or concerns"],
  "suggested_sprint_name": "Sprint name if none provided"
}`;

    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic();
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    let result;
    try {
      result = JSON.parse(message.content[0].text);
    } catch {
      return res.status(502).json({ error: 'AI returned invalid response. Please try again.' });
    }

    // Enrich with task details
    const recommendedTasks = backlog.filter(t => result.recommended_task_ids?.includes(t.id));

    res.json({
      recommended_tasks: recommendedTasks,
      reasoning: result.reasoning,
      estimated_total_hours: result.estimated_total_hours,
      capacity_utilization_pct: result.capacity_utilization_pct,
      warnings: result.warnings || [],
      suggested_sprint_name: result.suggested_sprint_name || sprint_name || 'Next Sprint',
      avg_historical_velocity_hours: avgVelocityHours,
    });
  } catch (err) {
    req.log?.error({ err: err.message, projectId: req.params.projectId }, 'ai.sprint_plan_failed');
    res.status(500).json({ error: 'Failed to generate sprint plan' });
  }
});

// GET /api/projects/:projectId/sprints/:sprintId/risk
// Compute deadline risk score for a sprint
router.get('/sprints/:sprintId/risk', async (req, res) => {
  try {
    const sprint = await queryOne(
      'SELECT * FROM sprints WHERE id = $1 AND project_id = $2',
      [req.params.sprintId, req.params.projectId]
    );
    if (!sprint) return res.status(404).json({ error: 'Sprint not found' });
    if (sprint.status === 'completed') {
      return res.json({ risk_level: 'none', risk_score: 0, message: 'Sprint already completed' });
    }

    const [taskStats, velocityData] = await Promise.all([
      queryOne(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'done') AS done,
          COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress,
          COALESCE(SUM(estimated_hours) FILTER (WHERE status != 'done'), 0) AS remaining_hours,
          COUNT(*) FILTER (WHERE deadline < NOW() AND status != 'done') AS overdue
        FROM tasks
        WHERE sprint_id = $1 AND parent_task_id IS NULL
      `, [req.params.sprintId]),

      // Historical completion rate for last 3 sprints
      queryAll(`
        SELECT
          (COUNT(*) FILTER (WHERE t.status = 'done'))::float /
          NULLIF(COUNT(*), 0) AS completion_rate
        FROM sprints s
        JOIN tasks t ON t.sprint_id = s.id AND t.parent_task_id IS NULL
        WHERE s.project_id = $1 AND s.status = 'completed'
        GROUP BY s.id
        ORDER BY s.end_date DESC
        LIMIT 3
      `, [req.params.projectId]),
    ]);

    const now = new Date();
    const endDate = sprint.end_date ? new Date(sprint.end_date) : null;
    const startDate = sprint.start_date ? new Date(sprint.start_date) : null;

    let riskScore = 0;
    const factors = [];

    // Factor 1: Time remaining vs work remaining
    if (endDate && startDate) {
      const totalDays = Math.max(1, (endDate - startDate) / 86400000);
      const daysElapsed = Math.max(0, (now - startDate) / 86400000);
      const timeProgress = daysElapsed / totalDays;
      const taskProgress = taskStats.total > 0 ? taskStats.done / taskStats.total : 0;

      if (timeProgress > taskProgress + 0.2) {
        const deficit = timeProgress - taskProgress;
        riskScore += Math.round(deficit * 50);
        factors.push(`Behind pace: ${Math.round(taskProgress * 100)}% done but ${Math.round(timeProgress * 100)}% of time elapsed`);
      }

      // Factor 2: Days until deadline
      const daysLeft = Math.max(0, (endDate - now) / 86400000);
      if (daysLeft < 2 && taskStats.done < taskStats.total) {
        riskScore += 30;
        factors.push(`${Math.ceil(daysLeft)} day(s) left with ${taskStats.total - taskStats.done} tasks remaining`);
      }
    }

    // Factor 3: Historical velocity
    if (velocityData.length > 0) {
      const avgRate = velocityData.reduce((s, v) => s + parseFloat(v.completion_rate), 0) / velocityData.length;
      if (avgRate < 0.7) {
        riskScore += 20;
        factors.push(`Historical completion rate is low: ${Math.round(avgRate * 100)}% avg over last ${velocityData.length} sprints`);
      }
    }

    // Factor 4: No sprint tasks at all
    if (parseInt(taskStats.total) === 0) {
      return res.json({ risk_level: 'unknown', risk_score: 0, message: 'No tasks in sprint yet', factors: [] });
    }

    riskScore = Math.min(100, riskScore);
    const riskLevel = riskScore >= 70 ? 'critical' : riskScore >= 40 ? 'high' : riskScore >= 20 ? 'medium' : 'low';

    res.json({
      risk_score: riskScore,
      risk_level: riskLevel,
      factors,
      stats: {
        total_tasks: parseInt(taskStats.total),
        done: parseInt(taskStats.done),
        in_progress: parseInt(taskStats.in_progress),
        remaining_hours: parseFloat(taskStats.remaining_hours || 0),
        completion_pct: Math.round((taskStats.done / taskStats.total) * 100),
      },
      days_remaining: sprint.end_date
        ? Math.max(0, Math.ceil((new Date(sprint.end_date) - now) / 86400000))
        : null,
    });
  } catch (err) {
    req.log?.error({ err: err.message }, 'ai.risk_score_failed');
    res.status(500).json({ error: 'Failed to compute risk score' });
  }
});

// POST /api/projects/:projectId/ai-create
// Create a full project from a natural language description
router.post('/ai-create', async (req, res) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: 'AI features require ANTHROPIC_API_KEY to be configured' });
    }

    const { description, duration_weeks = 2 } = req.body;
    if (!description) return res.status(400).json({ error: 'description required' });

    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic();
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `You are a project planning assistant. Based on the following project description, create a complete task breakdown.

Project description: "${description}"
Timeline: ${duration_weeks} weeks

Generate a JSON response (no markdown, just raw JSON) with this structure:
{
  "project_name": "concise project name",
  "tasks": [
    {
      "title": "task title",
      "description": "1-2 sentence description",
      "priority": "urgent|high|medium|low",
      "estimated_hours": number,
      "offset_days": number (0 = start of project, 7 = second week, etc.),
      "subtasks": [
        { "title": "subtask", "estimated_hours": number }
      ]
    }
  ]
}

Rules:
- Generate 6-12 main tasks with clear, actionable titles
- Include subtasks only where they add real clarity
- Distribute tasks logically across the timeline
- Ensure estimated_hours are realistic (total should be 40-${duration_weeks * 40}h)`
      }]
    });

    let result;
    try {
      result = JSON.parse(message.content[0].text);
    } catch {
      return res.status(502).json({ error: 'AI returned invalid response. Please try again.' });
    }

    res.json(result);
  } catch (err) {
    req.log?.error({ err: err.message }, 'ai.project_create_failed');
    res.status(500).json({ error: 'Failed to generate project plan' });
  }
});

module.exports = router;
