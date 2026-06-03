const express = require('express');
const { queryAll, queryOne } = require('../config/db');
const { authenticate, requireProjectAccess } = require('../middleware/auth');
const { ANTHROPIC_API_KEY } = require('../config/env');

const router = express.Router({ mergeParams: true });
router.use(authenticate, requireProjectAccess);

// POST /api/projects/:projectId/ai-summary
router.post('/', async (req, res) => {
  try {
    const { projectId } = req.params;

    const [project, tasks, recentActivity] = await Promise.all([
      queryOne('SELECT * FROM projects WHERE id = ?', [projectId]),
      queryAll(`
        SELECT t.title, t.status, t.priority, t.deadline, t.estimated_hours,
               u.name as assignee_name
        FROM tasks t
        LEFT JOIN users u ON u.id = t.assignee_id
        WHERE t.project_id = ? AND t.parent_task_id IS NULL
        ORDER BY t.priority DESC, t.deadline ASC NULLS LAST
      `, [projectId]),
      queryAll(`
        SELECT al.action, al.entity_type, u.name as user_name, al.created_at
        FROM activity_log al
        LEFT JOIN users u ON u.id = al.user_id
        WHERE al.entity_type = 'task'
          AND al.entity_id IN (SELECT id FROM tasks WHERE project_id = ?)
        ORDER BY al.created_at DESC LIMIT 20
      `, [projectId]),
    ]);

    const now = new Date();
    const statusCounts = { todo: 0, in_progress: 0, review: 0, done: 0 };
    const overdue = [];
    const blocked = [];
    const criticals = [];

    for (const t of tasks) {
      if (statusCounts[t.status] !== undefined) statusCounts[t.status]++;
      if (t.deadline && new Date(t.deadline) < now && t.status !== 'done') overdue.push(t.title);
      if (t.priority === 'critical' && t.status !== 'done') criticals.push(t.title);
    }

    const completion = tasks.length
      ? Math.round((statusCounts.done / tasks.length) * 100) : 0;

    // Use Claude AI if API key is set
    if (ANTHROPIC_API_KEY) {
      const Anthropic = require('@anthropic-ai/sdk');
      const client = new Anthropic.default({ apiKey: ANTHROPIC_API_KEY });

      const prompt = `You are a project management assistant. Summarize the following project status in 3-4 sentences. Be concise and actionable. Focus on what's going well, what's at risk, and the top 1-2 recommendations.

Project: ${project.name}
Progress: ${completion}% complete (${statusCounts.done}/${tasks.length} tasks done)
Status breakdown: ${statusCounts.todo} todo, ${statusCounts.in_progress} in progress, ${statusCounts.review} in review
Overdue tasks: ${overdue.length > 0 ? overdue.slice(0, 3).join(', ') : 'None'}
Critical tasks: ${criticals.length > 0 ? criticals.slice(0, 3).join(', ') : 'None'}
Recent activity: ${recentActivity.slice(0, 5).map(a => `${a.user_name} ${a.action} a task`).join('; ')}

Respond with JSON: { "status": "on_track|at_risk|blocked", "summary": "...", "risks": ["..."], "recommendations": ["..."] }`;

      const message = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = message.content[0].text;
      try {
        const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)[0]);
        return res.json({ ...parsed, completion, statusCounts, generated_by: 'ai' });
      } catch {
        return res.json({ summary: text, completion, statusCounts, generated_by: 'ai' });
      }
    }

    // Rule-based fallback (no API key needed)
    let status = 'on_track';
    const risks = [];
    const recommendations = [];

    if (overdue.length > 0) {
      status = overdue.length > 2 ? 'blocked' : 'at_risk';
      risks.push(`${overdue.length} overdue task${overdue.length > 1 ? 's' : ''}: ${overdue.slice(0,2).join(', ')}`);
      recommendations.push('Prioritize overdue tasks or adjust deadlines.');
    }
    if (criticals.length > 0) {
      if (status === 'on_track') status = 'at_risk';
      risks.push(`${criticals.length} critical task${criticals.length > 1 ? 's' : ''} pending.`);
      recommendations.push('Focus on critical tasks before lower-priority items.');
    }
    if (statusCounts.in_progress > 5) {
      recommendations.push('Too many tasks in progress — finish before starting new ones.');
    }
    if (recommendations.length === 0) {
      recommendations.push('Keep up the good work! Review deadlines regularly.');
    }

    const summaryParts = [];
    summaryParts.push(`${project.name} is ${completion}% complete with ${tasks.length} tasks.`);
    if (statusCounts.in_progress > 0) summaryParts.push(`${statusCounts.in_progress} task${statusCounts.in_progress > 1 ? 's are' : ' is'} in progress.`);
    if (overdue.length > 0) summaryParts.push(`${overdue.length} task${overdue.length > 1 ? 's are' : ' is'} overdue.`);
    else summaryParts.push('No tasks are overdue.');

    res.json({
      status,
      summary: summaryParts.join(' '),
      risks,
      recommendations,
      completion,
      statusCounts,
      generated_by: 'rules',
    });
  } catch (err) {
    console.error('[AI Summary]', err.message);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

module.exports = router;
